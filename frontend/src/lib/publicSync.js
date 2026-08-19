/**
 * Public repair sync bridge
 * =========================
 * The main data store lives in localStorage (device-local mock), which means a
 * customer scanning the QR on their phone would otherwise see stale seed data.
 *
 * To fix that we mirror a tiny public-facing snapshot of each repair into the
 * FastAPI + Mongo backend on every mutation. The PublicStatus page then reads
 * from the server so the status is truly shared across devices.
 *
 * If the server is unreachable, calls fail silently — localStorage remains the
 * source of truth for the admin app.
 */
import axios from 'axios';
import { customersApi, usersApi, settingsApi, computeTotal } from '@/lib/store';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const api = axios.create({
  baseURL: `${BACKEND}/api`,
  timeout: 5000,
});

function buildSnapshot(repair) {
  const customer = customersApi.get(repair.customer_id) || {};
  const users = usersApi.list();
  const technician = repair.technician_id ? users.find((u) => u.id === repair.technician_id) : null;
  const replyUser = repair.admin_reply_by ? users.find((u) => u.id === repair.admin_reply_by) : null;
  const settings = settingsApi.get();
  const totals = computeTotal(repair);
  return {
    ticket_no: repair.ticket_no,
    status: repair.status,
    device_brand: repair.device_brand || '',
    device_model: repair.device_model || '',
    serial_no: repair.serial_no || null,
    complaint: repair.complaint || '',
    customer_name: customer.name || '',
    customer_phone: customer.phone || '',
    technician_name: technician?.full_name || null,
    created_at: repair.created_at || null,
    completed_at: repair.completed_at || null,
    picked_up_at: repair.picked_up_at || null,
    total: Number(totals.total) || 0,
    paid: Number(totals.paid) || 0,
    balance: Number(totals.balance) || 0,
    rating: repair.rating || null,
    review: repair.review || null,
    rated_at: repair.rated_at || null,
    admin_reply: repair.admin_reply || null,
    admin_reply_by_name: replyUser?.full_name || null,
    admin_reply_at: repair.admin_reply_at || null,
    shop: {
      name: settings.shop_name,
      tagline: settings.shop_tagline,
      address: settings.shop_address,
      phone: settings.shop_phone,
      logo_url: settings.logo_url || '',
    },
    updated_at: repair.updated_at || new Date().toISOString(),
  };
}

export function syncRepairPublic(repair, { onlyIfNew = false } = {}) {
  if (!repair?.ticket_no) return;
  const snapshot = buildSnapshot(repair);
  const qs = onlyIfNew ? '?only_if_new=true' : '';
  // Fire-and-forget; do NOT block UI. Log errors quietly.
  api.post(`/public-sync/${encodeURIComponent(repair.ticket_no)}${qs}`, snapshot).catch((e) => {
    // eslint-disable-next-line no-console
    console.debug('[public-sync] failed', repair.ticket_no, e?.message);
  });
}

export async function fetchPublicRepair(ticket_no) {
  try {
    const { data } = await api.get(`/public-sync/${encodeURIComponent(ticket_no)}`);
    return data;
  } catch (e) {
    return null;
  }
}

export async function fetchAllReviews() {
  try {
    const { data } = await api.get('/public-sync/reviews');
    return data?.reviews || [];
  } catch (e) {
    return [];
  }
}

export async function submitAdminReplyServer(ticket_no, reply, admin_reply_by_name) {
  const { data } = await api.post(`/public-sync/${encodeURIComponent(ticket_no)}/reply`, {
    reply: reply || '',
    admin_reply_by_name: admin_reply_by_name || 'Admin',
  });
  return data;
}

export async function submitPublicRating(ticket_no, rating, review) {
  const { data } = await api.post(`/public-sync/${encodeURIComponent(ticket_no)}/rating`, {
    rating,
    review: review || '',
  });
  return data;
}
