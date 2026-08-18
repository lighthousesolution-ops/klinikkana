// LocalStorage-based data store for immediate browser testing.
// Mimics a REST API so switching to the PHP backend later is trivial.

import { SEED_USERS, SEED_CUSTOMERS, SEED_SPAREPARTS, SEED_REPAIRS, SEED_BRANCHES } from './mockData';

const KEYS = {
  users: 'kk_users',
  customers: 'kk_customers',
  spareparts: 'kk_spareparts',
  repairs: 'kk_repairs',
  branches: 'kk_branches',
  currentBranch: 'kk_current_branch',
  session: 'kk_session',
  settings: 'kk_settings',
  seeded: 'kk_seeded_v2',
};

const DEFAULT_SETTINGS = {
  shop_name: 'Klinik Kana',
  shop_tagline: 'Servis HP Profesional',
  shop_address: 'Jl. Contoh No. 123, Jakarta',
  shop_phone: '021-1234567 / 0812-3456-7890',
  logo_url: '',
  invoice_footer: 'Terima kasih atas kepercayaan Anda.\nGaransi servis 14 hari untuk sparepart yang diganti.',
  wa_template: 'Halo {customer_name},\n\nDari {shop_name}. Info servis Anda:\n\n• Tiket: {ticket_no}\n• Perangkat: {device}\n• Status: {status}\n• Total: {total}\n• DP: {deposit}\n• Sisa: {balance}\n\n{status_message}\n\nCek status kapan saja: {status_url}\n\nTerima kasih!',
  wa_status_pending: 'Perangkat Anda telah kami terima dan sedang antre pemeriksaan.',
  wa_status_in_progress: 'Perangkat Anda sedang dalam proses perbaikan.',
  wa_status_ready: 'Perangkat Anda sudah selesai dan siap diambil! Silakan datang ke toko kami.',
  wa_status_picked_up: 'Perangkat Anda sudah diambil. Semoga puas dengan layanan kami!',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function ensureSeed() {
  if (!localStorage.getItem(KEYS.seeded)) {
    // Clear previous version's keys to avoid mixing schemas
    ['kk_seeded_v1'].forEach((k) => localStorage.removeItem(k));
    write(KEYS.users, SEED_USERS);
    write(KEYS.customers, SEED_CUSTOMERS);
    write(KEYS.spareparts, SEED_SPAREPARTS);
    write(KEYS.repairs, SEED_REPAIRS);
    write(KEYS.branches, SEED_BRANCHES);
    write(KEYS.settings, DEFAULT_SETTINGS);
    write(KEYS.seeded, '1');
  }
  // Backfill
  if (!localStorage.getItem(KEYS.settings)) {
    write(KEYS.settings, DEFAULT_SETTINGS);
  }
  if (!localStorage.getItem(KEYS.branches)) {
    write(KEYS.branches, SEED_BRANCHES);
  }
}

export function resetData() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  ensureSeed();
}

// ============ BRANCHES (Multi Cabang) ============
function fireBranchMutation() {
  window.dispatchEvent(new Event('kk_branch_changed'));
}

export const branchesApi = {
  list: () => read(KEYS.branches, []),
  get: (id) => read(KEYS.branches, []).find((b) => b.id === id),
  create: (data) => {
    const items = read(KEYS.branches, []);
    if (items.some((b) => b.code === data.code)) throw new Error('Kode cabang sudah dipakai');
    const item = { id: uid('br'), created_at: new Date().toISOString(), is_default: false, ...data };
    items.push(item);
    write(KEYS.branches, items);
    fireBranchMutation();
    return item;
  },
  update: (id, data) => {
    const items = read(KEYS.branches, []);
    const idx = items.findIndex((b) => b.id === id);
    if (idx === -1) throw new Error('Cabang tidak ditemukan');
    items[idx] = { ...items[idx], ...data };
    write(KEYS.branches, items);
    fireBranchMutation();
    return items[idx];
  },
  delete: (id) => {
    const items = read(KEYS.branches, []);
    const target = items.find((b) => b.id === id);
    if (target?.is_default) throw new Error('Cabang default tidak dapat dihapus');
    const hasRepairs = read(KEYS.repairs, []).some((r) => r.branch_id === id);
    const hasParts = read(KEYS.spareparts, []).some((s) => s.branch_id === id);
    if (hasRepairs || hasParts) {
      throw new Error('Cabang masih memiliki data tiket atau sparepart. Pindahkan atau hapus dulu.');
    }
    write(KEYS.branches, items.filter((b) => b.id !== id));
    fireBranchMutation();
  },
  setCurrent: (id) => {
    if (id === null || id === 'all') localStorage.removeItem(KEYS.currentBranch);
    else localStorage.setItem(KEYS.currentBranch, id);
    fireBranchMutation();
  },
  getCurrent: () => localStorage.getItem(KEYS.currentBranch) || null,
};

// ============ SETTINGS ============
export const settingsApi = {
  get: () => ({ ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) }),
  update: (patch) => {
    const current = settingsApi.get();
    const merged = { ...current, ...patch };
    write(KEYS.settings, merged);
    return merged;
  },
  reset: () => { write(KEYS.settings, DEFAULT_SETTINGS); return DEFAULT_SETTINGS; },
};

// ============ AUTH ============
export const authApi = {
  login: (username, password) => {
    const users = read(KEYS.users, []);
    const user = users.find((u) => u.username === username && u.password === password);
    if (!user) throw new Error('Username atau password salah');
    const session = { user_id: user.id, token: `mock_${user.id}_${Date.now()}`, exp: Date.now() + 8 * 3600 * 1000 };
    write(KEYS.session, session);
    return { user: { ...user, password: undefined }, token: session.token };
  },
  logout: () => { localStorage.removeItem(KEYS.session); },
  currentUser: () => {
    const session = read(KEYS.session, null);
    if (!session || session.exp < Date.now()) return null;
    const users = read(KEYS.users, []);
    const user = users.find((u) => u.id === session.user_id);
    return user ? { ...user, password: undefined } : null;
  },
};

// ============ USERS ============
export const usersApi = {
  list: () => read(KEYS.users, []).map((u) => ({ ...u, password: undefined })),
  create: (data) => {
    const users = read(KEYS.users, []);
    if (users.some((u) => u.username === data.username)) throw new Error('Username sudah dipakai');
    const user = { id: uid('u'), created_at: new Date().toISOString(), ...data };
    users.push(user);
    write(KEYS.users, users);
    return { ...user, password: undefined };
  },
  update: (id, data) => {
    const users = read(KEYS.users, []);
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error('User tidak ditemukan');
    if (!data.password) delete data.password;
    users[idx] = { ...users[idx], ...data };
    write(KEYS.users, users);
    return { ...users[idx], password: undefined };
  },
  delete: (id) => {
    const users = read(KEYS.users, []).filter((u) => u.id !== id);
    write(KEYS.users, users);
  },
};

// ============ CUSTOMERS ============
// Note: Customers are GLOBAL across all branches (not scoped). branch_id is
// only informational metadata showing where customer was first registered.
function normalizePhone(p) {
  return String(p || '').replace(/\D/g, '');
}
function findDuplicatePhone(customers, phone, exceptId = null) {
  const target = normalizePhone(phone);
  if (!target) return null;
  return customers.find((c) => c.id !== exceptId && normalizePhone(c.phone) === target);
}

export const customersApi = {
  list: () => read(KEYS.customers, []),
  get: (id) => read(KEYS.customers, []).find((c) => c.id === id),
  findByPhone: (phone) => {
    const customers = read(KEYS.customers, []);
    return findDuplicatePhone(customers, phone);
  },
  create: (data) => {
    const customers = read(KEYS.customers, []);
    const dup = findDuplicatePhone(customers, data.phone);
    if (dup) throw new Error(`Nomor HP sudah dipakai oleh pelanggan "${dup.name}"`);
    const branch_id = data.branch_id || branchesApi.getCurrent() || (branchesApi.list().find((b) => b.is_default)?.id) || null;
    const item = { id: uid('c'), created_at: new Date().toISOString(), branch_id, ...data };
    customers.push(item);
    write(KEYS.customers, customers);
    return item;
  },
  update: (id, data) => {
    const customers = read(KEYS.customers, []);
    const idx = customers.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Pelanggan tidak ditemukan');
    if (data.phone !== undefined) {
      const dup = findDuplicatePhone(customers, data.phone, id);
      if (dup) throw new Error(`Nomor HP sudah dipakai oleh pelanggan "${dup.name}"`);
    }
    customers[idx] = { ...customers[idx], ...data };
    write(KEYS.customers, customers);
    return customers[idx];
  },
  delete: (id) => {
    const customers = read(KEYS.customers, []).filter((c) => c.id !== id);
    write(KEYS.customers, customers);
  },
};

// ============ SPARE PARTS ============
export const sparepartsApi = {
  list: () => read(KEYS.spareparts, []),
  get: (id) => read(KEYS.spareparts, []).find((s) => s.id === id),
  create: (data) => {
    const items = read(KEYS.spareparts, []);
    if (items.some((s) => s.sku === data.sku)) throw new Error('SKU sudah dipakai');
    const branch_id = data.branch_id || branchesApi.getCurrent() || (branchesApi.list().find((b) => b.is_default)?.id) || null;
    const item = { id: uid('sp'), branch_id, ...data };
    items.push(item);
    write(KEYS.spareparts, items);
    return item;
  },
  update: (id, data) => {
    const items = read(KEYS.spareparts, []);
    const idx = items.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('Sparepart tidak ditemukan');
    items[idx] = { ...items[idx], ...data };
    write(KEYS.spareparts, items);
    return items[idx];
  },
  delete: (id) => {
    const items = read(KEYS.spareparts, []).filter((s) => s.id !== id);
    write(KEYS.spareparts, items);
  },
  adjustStock: (id, delta) => {
    const items = read(KEYS.spareparts, []);
    const idx = items.findIndex((s) => s.id === id);
    if (idx !== -1) {
      items[idx].stock = Math.max(0, items[idx].stock + delta);
      write(KEYS.spareparts, items);
    }
  },
};

// ============ REPAIRS ============
function nextTicketNo(existing) {
  const d = new Date();
  const ym = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `KK-${ym}-`;
  const nums = existing
    .filter((r) => r.ticket_no?.startsWith(prefix))
    .map((r) => parseInt(r.ticket_no.split('-')[2], 10) || 0);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

export const repairsApi = {
  list: () => read(KEYS.repairs, []),
  get: (id) => read(KEYS.repairs, []).find((r) => r.id === id),
  getByTicket: (ticket_no) => read(KEYS.repairs, []).find((r) => r.ticket_no === ticket_no),
  byCustomer: (customer_id) => read(KEYS.repairs, []).filter((r) => r.customer_id === customer_id),
  create: (data) => {
    const items = read(KEYS.repairs, []);
    // Inherit branch from customer, fallback to current/default
    let branch_id = data.branch_id;
    if (!branch_id && data.customer_id) {
      const customers = read(KEYS.customers, []);
      const cust = customers.find((c) => c.id === data.customer_id);
      branch_id = cust?.branch_id || branchesApi.getCurrent() || (branchesApi.list().find((b) => b.is_default)?.id) || null;
    }
    const item = {
      id: uid('r'),
      ticket_no: nextTicketNo(items),
      status: 'pending',
      parts_used: [],
      payments: [],
      notes: '',
      technician_id: null,
      service_fee: 0,
      deposit: 0,
      branch_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data,
    };
    items.push(item);
    write(KEYS.repairs, items);
    return item;
  },
  update: (id, data) => {
    const items = read(KEYS.repairs, []);
    const idx = items.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Servis tidak ditemukan');
    items[idx] = { ...items[idx], ...data, updated_at: new Date().toISOString() };
    write(KEYS.repairs, items);
    return items[idx];
  },
  changeStatus: (id, status) => {
    const items = read(KEYS.repairs, []);
    const idx = items.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Servis tidak ditemukan');
    const now = new Date().toISOString();
    items[idx] = { ...items[idx], status, updated_at: now };
    if (status === 'ready') items[idx].completed_at = now;
    if (status === 'picked_up') items[idx].picked_up_at = now;
    write(KEYS.repairs, items);
    return items[idx];
  },
  addPart: (id, sparepart_id, qty) => {
    const items = read(KEYS.repairs, []);
    const spareparts = read(KEYS.spareparts, []);
    const idx = items.findIndex((r) => r.id === id);
    const sp = spareparts.find((s) => s.id === sparepart_id);
    if (idx === -1) throw new Error('Servis tidak ditemukan');
    if (!sp) throw new Error('Sparepart tidak ditemukan');
    if (sp.stock < qty) throw new Error('Stok tidak cukup');
    items[idx].parts_used = items[idx].parts_used || [];
    items[idx].parts_used.push({ sparepart_id, qty, price: sp.selling_price });
    items[idx].updated_at = new Date().toISOString();
    sp.stock -= qty;
    write(KEYS.repairs, items);
    write(KEYS.spareparts, spareparts);
    return items[idx];
  },
  removePart: (id, partIndex) => {
    const items = read(KEYS.repairs, []);
    const spareparts = read(KEYS.spareparts, []);
    const idx = items.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Servis tidak ditemukan');
    const removed = items[idx].parts_used[partIndex];
    if (removed) {
      const sp = spareparts.find((s) => s.id === removed.sparepart_id);
      if (sp) sp.stock += removed.qty;
      items[idx].parts_used.splice(partIndex, 1);
      items[idx].updated_at = new Date().toISOString();
      write(KEYS.repairs, items);
      write(KEYS.spareparts, spareparts);
    }
    return items[idx];
  },
  delete: (id) => {
    const items = read(KEYS.repairs, []).filter((r) => r.id !== id);
    write(KEYS.repairs, items);
  },
  addPayment: (id, amount, method, note) => {
    const items = read(KEYS.repairs, []);
    const idx = items.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Servis tidak ditemukan');
    const amt = Number(amount);
    if (!amt || amt <= 0) throw new Error('Jumlah tidak valid');
    items[idx].payments = items[idx].payments || [];
    items[idx].payments.push({
      id: uid('pay'),
      amount: amt,
      method: method || 'Tunai',
      note: note || '',
      paid_at: new Date().toISOString(),
    });
    items[idx].updated_at = new Date().toISOString();
    write(KEYS.repairs, items);
    return items[idx];
  },
  removePayment: (id, payment_id) => {
    const items = read(KEYS.repairs, []);
    const idx = items.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    items[idx].payments = (items[idx].payments || []).filter((p) => p.id !== payment_id);
    items[idx].updated_at = new Date().toISOString();
    write(KEYS.repairs, items);
    return items[idx];
  },
};

// Helper: compute totals with payments
export function computeTotal(repair) {
  const parts = (repair.parts_used || []).reduce((s, p) => s + p.qty * p.price, 0);
  const total = (repair.service_fee || 0) + parts;
  const deposit = Number(repair.deposit) || 0;
  const paymentsTotal = (repair.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const paid = deposit + paymentsTotal;
  const balance = total - paid;
  return { parts_total: parts, total, deposit, payments_total: paymentsTotal, paid, balance };
}
