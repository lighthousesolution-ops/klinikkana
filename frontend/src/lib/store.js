// LocalStorage-based data store for immediate browser testing.
// Mimics a REST API so switching to the PHP backend later is trivial.

import { SEED_USERS, SEED_CUSTOMERS, SEED_SPAREPARTS, SEED_REPAIRS } from './mockData';

const KEYS = {
  users: 'kk_users',
  customers: 'kk_customers',
  spareparts: 'kk_spareparts',
  repairs: 'kk_repairs',
  session: 'kk_session',
  seeded: 'kk_seeded_v1',
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
    write(KEYS.users, SEED_USERS);
    write(KEYS.customers, SEED_CUSTOMERS);
    write(KEYS.spareparts, SEED_SPAREPARTS);
    write(KEYS.repairs, SEED_REPAIRS);
    write(KEYS.seeded, '1');
  }
}

export function resetData() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  ensureSeed();
}

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
export const customersApi = {
  list: () => read(KEYS.customers, []),
  get: (id) => read(KEYS.customers, []).find((c) => c.id === id),
  create: (data) => {
    const customers = read(KEYS.customers, []);
    const item = { id: uid('c'), created_at: new Date().toISOString(), ...data };
    customers.push(item);
    write(KEYS.customers, customers);
    return item;
  },
  update: (id, data) => {
    const customers = read(KEYS.customers, []);
    const idx = customers.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Pelanggan tidak ditemukan');
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
    const item = { id: uid('sp'), ...data };
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
  byCustomer: (customer_id) => read(KEYS.repairs, []).filter((r) => r.customer_id === customer_id),
  create: (data) => {
    const items = read(KEYS.repairs, []);
    const item = {
      id: uid('r'),
      ticket_no: nextTicketNo(items),
      status: 'pending',
      parts_used: [],
      notes: '',
      technician_id: null,
      service_fee: 0,
      deposit: 0,
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
};

// Helper: compute totals
export function computeTotal(repair) {
  const parts = (repair.parts_used || []).reduce((s, p) => s + p.qty * p.price, 0);
  const total = (repair.service_fee || 0) + parts;
  const balance = total - (repair.deposit || 0);
  return { parts_total: parts, total, balance };
}
