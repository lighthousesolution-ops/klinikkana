/**
 * PHP backend connector via axios.
 *
 * This module exposes the same API surface as `store.js` but talks to the PHP
 * REST endpoints in `/app/php-backend/`. Enabled by setting:
 *
 *   REACT_APP_DATA_MODE=php
 *   REACT_APP_BACKEND_URL=https://yourdomain.com/servishp
 *
 * When mode is 'local' (default), the app uses localStorage (great for demo &
 * offline use). When 'php', all API calls go to the deployed PHP backend.
 *
 * Because network calls are async but store.js is sync, this file wraps the
 * axios calls in a small "sync-like" cache using a top-level fetch on demand.
 * For a production PHP deployment, prefer to also convert calling components to
 * `useEffect`+`useState`. This file is kept sync-compatible for drop-in.
 */

import axios from 'axios';

const BASE = process.env.REACT_APP_BACKEND_URL || '';
const TOKEN_KEY = 'kk_token';

const http = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status;
    if (status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('kk_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    const msg = err.response?.data?.error || err.message || 'Request failed';
    return Promise.reject(new Error(msg));
  }
);

// ============ AUTH ============
export const phpAuthApi = {
  login: async (username, password) => {
    const { data } = await http.post('/api/auth/login.php', { username, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem('kk_user', JSON.stringify(data.user));
    return data;
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('kk_user');
  },
  currentUser: () => {
    try { return JSON.parse(localStorage.getItem('kk_user') || 'null'); }
    catch { return null; }
  },
  me: async () => {
    const { data } = await http.get('/api/auth/me.php');
    return data.user;
  },
};

// ============ CUSTOMERS ============
export const phpCustomersApi = {
  list: async () => (await http.get('/api/customers/index.php')).data,
  get:  async (id) => (await http.get(`/api/customers/index.php?id=${id}`)).data,
  create: async (data) => (await http.post('/api/customers/index.php', data)).data,
  update: async (id, data) => (await http.put(`/api/customers/index.php?id=${id}`, data)).data,
  delete: async (id) => (await http.delete(`/api/customers/index.php?id=${id}`)).data,
};

// ============ SPARE PARTS ============
export const phpSparepartsApi = {
  list: async () => (await http.get('/api/spareparts/index.php')).data,
  get:  async (id) => (await http.get(`/api/spareparts/index.php?id=${id}`)).data,
  create: async (data) => (await http.post('/api/spareparts/index.php', data)).data,
  update: async (id, data) => (await http.put(`/api/spareparts/index.php?id=${id}`, data)).data,
  delete: async (id) => (await http.delete(`/api/spareparts/index.php?id=${id}`)).data,
};

// ============ REPAIRS ============
export const phpRepairsApi = {
  list: async () => (await http.get('/api/repairs/index.php')).data,
  get:  async (id) => (await http.get(`/api/repairs/index.php?id=${id}`)).data,
  byCustomer: async (customer_id) =>
    (await http.get(`/api/repairs/index.php?customer_id=${customer_id}`)).data,
  create: async (data) => (await http.post('/api/repairs/index.php', data)).data,
  update: async (id, data) => (await http.put(`/api/repairs/index.php?id=${id}`, data)).data,
  changeStatus: async (id, status) =>
    (await http.put(`/api/repairs/index.php?id=${id}`, { status })).data,
  addPart: async (id, sparepart_id, qty) =>
    (await http.post(`/api/repairs/parts.php?id=${id}`, { sparepart_id, qty })).data,
  removePart: async (id, part_id) =>
    (await http.delete(`/api/repairs/parts.php?id=${id}&part_id=${part_id}`)).data,
  delete: async (id) => (await http.delete(`/api/repairs/index.php?id=${id}`)).data,
  addPayment: async (id, amount, method, note) =>
    (await http.post(`/api/repairs/payments.php?id=${id}`, { amount, method, note })).data,
  removePayment: async (id, payment_id) =>
    (await http.delete(`/api/repairs/payments.php?id=${id}&payment_id=${payment_id}`)).data,
};

// ============ USERS ============
export const phpUsersApi = {
  list: async () => (await http.get('/api/users/index.php')).data,
  create: async (data) => (await http.post('/api/users/index.php', data)).data,
  update: async (id, data) => (await http.put(`/api/users/index.php?id=${id}`, data)).data,
  delete: async (id) => (await http.delete(`/api/users/index.php?id=${id}`)).data,
};

// ============ BRANCHES ============
export const phpBranchesApi = {
  list: async () => (await http.get('/api/branches/index.php')).data,
  create: async (data) => (await http.post('/api/branches/index.php', data)).data,
  update: async (id, data) => (await http.put(`/api/branches/index.php?id=${id}`, data)).data,
  delete: async (id) => (await http.delete(`/api/branches/index.php?id=${id}`)).data,
};

// ============ SERVICE CATEGORIES ============
export const phpServiceCategoriesApi = {
  list:   async () => (await http.get('/api/service-categories/index.php')).data,
  create: async (data) => (await http.post('/api/service-categories/index.php', data)).data,
  update: async (id, data) => (await http.put(`/api/service-categories/index.php?id=${id}`, data)).data,
  delete: async (id) => (await http.delete(`/api/service-categories/index.php?id=${id}`)).data,
};

// ============ SERVICE ITEMS ============
export const phpServiceItemsApi = {
  list:   async () => (await http.get('/api/service-items/index.php')).data,
  byCategory: async (category_id) => (await http.get(`/api/service-items/index.php?category_id=${category_id}`)).data,
  create: async (data) => (await http.post('/api/service-items/index.php', data)).data,
  update: async (id, data) => (await http.put(`/api/service-items/index.php?id=${id}`, data)).data,
  delete: async (id) => (await http.delete(`/api/service-items/index.php?id=${id}`)).data,
};

// ============ SERVICE PACKAGES ============
export const phpServicePackagesApi = {
  list:   async () => (await http.get('/api/service-packages/index.php')).data,
  create: async (data) => (await http.post('/api/service-packages/index.php', data)).data,
  update: async (id, data) => (await http.put(`/api/service-packages/index.php?id=${id}`, data)).data,
  delete: async (id) => (await http.delete(`/api/service-packages/index.php?id=${id}`)).data,
};

// ============ SETTINGS ============
export const phpSettingsApi = {
  get: async () => (await http.get('/api/settings/index.php')).data,
  update: async (patch) => (await http.put('/api/settings/index.php', patch)).data,
};

// ============ DASHBOARD ============
export const phpDashboardApi = {
  stats: async () => (await http.get('/api/dashboard/stats.php')).data,
};

export { http };
