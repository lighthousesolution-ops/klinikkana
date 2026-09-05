/**
 * Public repair sync bridge
 * =========================
 * In LOCAL/preview mode, we mirror status + review data to the FastAPI +
 * Mongo backend so QR-scanning customers see the same status across devices.
 *
 * In PHP production mode, we skip FastAPI entirely and read from the PHP
 * endpoints (which query MySQL — the single source of truth). Writes to
 * MySQL happen via `phpMirror` on every mutation, so no explicit "public
 * sync" push is needed here.
 */
import axios from 'axios';
import { customersApi, usersApi, settingsApi, computeTotal, serviceCategoriesApi } from '@/lib/store';
import { IS_PHP } from './dataMode';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const api = axios.create({
  baseURL: `${BACKEND}/api`,
  timeout: 8000,
});

function buildSnapshot(repair) {
  const customer = customersApi.get(repair.customer_id) || {};
  const users = usersApi.list();
  const technician = repair.technician_id ? users.find((u) => u.id === repair.technician_id) : null;
  const replyUser = repair.admin_reply_by ? users.find((u) => u.id === repair.admin_reply_by) : null;
  const settings = settingsApi.get();
  const totals = computeTotal(repair);
  // Build public-safe services list (no unit price, only names + category)
  const catMap = Object.fromEntries(serviceCategoriesApi.list().map((c) => [c.id, c.name]));
  const services = (Array.isArray(repair.services_json) ? repair.services_json : []).map((s) => ({
    name: s.name || '',
    category_name: s.category_id ? (catMap[s.category_id] || null) : null,
    is_custom: !!s.is_custom,
    from_package: s.from_package || null,
  }));
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
    services,
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

/** Normalize PHP public-status response into the shape the UI expects. */
function normalizePhpPublicStatus(d) {
  if (!d) return null;
  return {
    ticket_no: d.ticket_no,
    status: d.status,
    device_brand: d.device?.brand || '',
    device_model: d.device?.model || '',
    serial_no: d.device?.serial_no || null,
    complaint: d.complaint || '',
    customer_name: d.customer?.name || '',
    customer_phone: d.customer?.phone || '',
    technician_name: d.technician || null,
    created_at: d.created_at || null,
    completed_at: d.completed_at || null,
    picked_up_at: d.picked_up_at || null,
    total: Number(d.totals?.total) || 0,
    paid: Number(d.totals?.paid) || 0,
    balance: Number(d.totals?.balance) || 0,
    rating: d.rating || null,
    review: d.review || null,
    rated_at: d.rated_at || null,
    admin_reply: d.admin_reply || null,
    admin_reply_by_name: null,
    admin_reply_at: d.admin_reply_at || null,
    parts_used: d.parts_used || [],
    services: Array.isArray(d.services) ? d.services : [],
  };
}

export function syncRepairPublic(repair, { onlyIfNew = false } = {}) {
  if (!repair?.ticket_no) return;
  // In PHP mode, phpMirror already pushed the mutation to MySQL. The public
  // status page reads directly from MySQL, so no further sync is needed.
  if (IS_PHP) return;
  const snapshot = buildSnapshot(repair);
  const qs = onlyIfNew ? '?only_if_new=true' : '';
  api.post(`/public-sync/${encodeURIComponent(repair.ticket_no)}${qs}`, snapshot).catch((e) => {
    // eslint-disable-next-line no-console
    console.debug('[public-sync] failed', repair.ticket_no, e?.message);
  });
}

export async function fetchPublicRepair(ticket_no) {
  try {
    if (IS_PHP) {
      const { data } = await api.get(`/public/status.php?ticket=${encodeURIComponent(ticket_no)}`);
      return normalizePhpPublicStatus(data);
    }
    const { data } = await api.get(`/public-sync/${encodeURIComponent(ticket_no)}`);
    return data;
  } catch (e) {
    return null;
  }
}

export async function fetchAllReviews() {
  try {
    if (IS_PHP) {
      // Reviews live inside the repairs table; the admin app already reads
      // repairs from localStorage (synced from MySQL via pullAllFromServer).
      // Reviews.jsx will fall back to that store when this returns [].
      return [];
    }
    const { data } = await api.get('/public-sync/reviews');
    return data?.reviews || [];
  } catch (e) {
    return [];
  }
}

export async function submitAdminReplyServer(ticket_no, reply, admin_reply_by_name) {
  if (IS_PHP) {
    // In PHP mode, Reviews.jsx should call the authenticated
    // /api/repairs/reply.php endpoint (with Bearer token) — falling through
    // to the local store update path so phpMirror pushes to MySQL.
    return null;
  }
  const { data } = await api.post(`/public-sync/${encodeURIComponent(ticket_no)}/reply`, {
    reply: reply || '',
    admin_reply_by_name: admin_reply_by_name || 'Admin',
  });
  return data;
}

export async function submitPublicRating(ticket_no, rating, review) {
  if (IS_PHP) {
    const { data } = await api.post('/public/rating.php', {
      ticket: ticket_no,
      rating,
      review: review || '',
    });
    return data;
  }
  const { data } = await api.post(`/public-sync/${encodeURIComponent(ticket_no)}/rating`, {
    rating,
    review: review || '',
  });
  return data;
}
