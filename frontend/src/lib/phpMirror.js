/**
 * PHP Backend Mirror — write-through cache adapter.
 * ================================================================
 * Ketika `REACT_APP_DATA_MODE=php`, semua mutasi di admin app tetap
 * berjalan cepat via localStorage (source of truth untuk UI), TAPI
 * setiap perubahan ke-mirror ke PHP backend supaya MySQL di server VPS
 * ikut terupdate. Read tetap dari localStorage — tidak perlu refactor
 * seluruh komponen jadi async.
 *
 * Kalau backend PHP unreachable, mutasi tetap tercatat di localStorage,
 * jadi UI tidak stuck. Failed calls di-log ke console browser via
 * console.warn.
 *
 * Dalam mode `local`, semua fungsi ini no-op (return undefined).
 */
import axios from 'axios';
import { IS_PHP } from './dataMode';

const BASE = process.env.REACT_APP_BACKEND_URL || '';
const TOKEN_KEY = 'kk_token';

const http = axios.create({
  baseURL: BASE,
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((cfg) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

/**
 * Low-level fire — always fires the request. Used by the debug hook so QA
 * can verify endpoints without switching REACT_APP_DATA_MODE.
 */
function rawFire(method, url, data) {
  const req = (method === 'get' || method === 'delete')
    ? http[method](url)
    : http[method](url, data);
  return req
    .then((r) => {
      // eslint-disable-next-line no-console
      console.debug('[phpMirror]', method.toUpperCase(), url, '→', r.status);
      return r.data;
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[phpMirror] FAILED', method.toUpperCase(), url, err.message);
    });
}

/**
 * Fire-and-forget request to the PHP backend. Never throws — silent
 * warn on failure so the admin UI keeps working locally. In LOCAL data
 * mode this is a no-op (returns undefined) so seeded demo data is not
 * accidentally pushed to a non-existent backend.
 */
function fire(method, url, data) {
  if (!IS_PHP) return; // no-op in local/mock mode
  return rawFire(method, url, data);
}

export const phpMirror = {
  isEnabled: () => IS_PHP,

  customer: {
    upsert: (c) => (c.__isNew || !c.id)
      ? fire('post', '/api/customers/index.php', c)
      : fire('put', `/api/customers/index.php?id=${encodeURIComponent(c.id)}`, c),
    remove: (id) => fire('delete', `/api/customers/index.php?id=${encodeURIComponent(id)}`),
  },

  sparepart: {
    upsert: (s) => (s.__isNew || !s.id)
      ? fire('post', '/api/spareparts/index.php', s)
      : fire('put', `/api/spareparts/index.php?id=${encodeURIComponent(s.id)}`, s),
    remove: (id) => fire('delete', `/api/spareparts/index.php?id=${encodeURIComponent(id)}`),
  },

  repair: {
    upsert: (r) => (r.__isNew || !r.id)
      ? fire('post', '/api/repairs/index.php', r)
      : fire('put', `/api/repairs/index.php?id=${encodeURIComponent(r.id)}`, r),
    remove: (id) => fire('delete', `/api/repairs/index.php?id=${encodeURIComponent(id)}`),
    addPart: (id, sparepart_id, qty) =>
      fire('post', `/api/repairs/parts.php?id=${encodeURIComponent(id)}`, { sparepart_id, qty }),
    removePart: (id, part_id) =>
      fire('delete', `/api/repairs/parts.php?id=${encodeURIComponent(id)}&part_id=${encodeURIComponent(part_id)}`),
    addPayment: (id, amount, method, note) =>
      fire('post', `/api/repairs/payments.php?id=${encodeURIComponent(id)}`, { amount, method, note }),
    removePayment: (id, payment_id) =>
      fire('delete', `/api/repairs/payments.php?id=${encodeURIComponent(id)}&payment_id=${encodeURIComponent(payment_id)}`),
  },

  user: {
    upsert: (u) => (u.__isNew || !u.id)
      ? fire('post', '/api/users/index.php', u)
      : fire('put', `/api/users/index.php?id=${encodeURIComponent(u.id)}`, u),
    remove: (id) => fire('delete', `/api/users/index.php?id=${encodeURIComponent(id)}`),
  },

  settings: {
    update: (patch) => fire('put', '/api/settings/index.php', patch),
  },
};

// Debug/test hook: expose in browser so QA can verify PHP endpoint calls
// without needing a live PHP server. Only attached when running in a browser.
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-underscore-dangle
  window.__phpMirror = { ...phpMirror, IS_PHP, BASE, _fire: rawFire };
}
