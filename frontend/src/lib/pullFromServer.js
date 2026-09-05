/**
 * Pull-from-server helper.
 *
 * When REACT_APP_DATA_MODE=php, localStorage is only a cache; MySQL is the
 * source of truth. This module fetches core entities from PHP endpoints and
 * writes them into localStorage so every device sees the same data.
 *
 * Called from AuthContext:
 *   - Once on app mount if a PHP session token exists.
 *   - After a successful login.
 *   - Manually via Settings → "Sync sekarang" button.
 *
 * Never throws — logs to console.warn on failure so the UI keeps working
 * offline. Users can retry with the manual button.
 */
import { IS_PHP } from './dataMode';
import {
  phpCustomersApi,
  phpSparepartsApi,
  phpRepairsApi,
  phpUsersApi,
  phpSettingsApi,
  phpBranchesApi,
  phpServiceCategoriesApi,
  phpServiceItemsApi,
  phpServicePackagesApi,
} from './apiPhp';

const KEYS = {
  users: 'kk_users',
  customers: 'kk_customers',
  spareparts: 'kk_spareparts',
  repairs: 'kk_repairs',
  settings: 'kk_settings',
  branches: 'kk_branches',
  serviceCategories: 'kk_service_categories',
  serviceItems: 'kk_service_items',
  servicePackages: 'kk_service_packages',
};

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Storage quota exceeded — very unlikely for this dataset size.
    // eslint-disable-next-line no-console
    console.warn('[pull] localStorage write failed for', key, e);
  }
}

/**
 * Fetch all core entities in parallel and mirror them into localStorage.
 * Returns { ok: boolean, errors: string[] }.
 */
export async function pullAllFromServer() {
  if (!IS_PHP) return { ok: true, errors: [], skipped: true };

  const results = await Promise.allSettled([
    phpUsersApi.list(),
    phpCustomersApi.list(),
    phpSparepartsApi.list(),
    phpRepairsApi.list(),
    phpSettingsApi.get(),
    phpBranchesApi.list(),
    phpServiceCategoriesApi.list(),
    phpServiceItemsApi.list(),
    phpServicePackagesApi.list(),
  ]);

  const [users, customers, spareparts, repairs, settings, branches, serviceCategories, serviceItems, servicePackages] = results;
  const errors = [];

  if (users.status === 'fulfilled')       write(KEYS.users, users.value);
  else errors.push(`users: ${users.reason?.message || 'failed'}`);

  if (customers.status === 'fulfilled')   write(KEYS.customers, customers.value);
  else errors.push(`customers: ${customers.reason?.message || 'failed'}`);

  if (spareparts.status === 'fulfilled')  write(KEYS.spareparts, spareparts.value);
  else errors.push(`spareparts: ${spareparts.reason?.message || 'failed'}`);

  if (repairs.status === 'fulfilled')     write(KEYS.repairs, repairs.value);
  else errors.push(`repairs: ${repairs.reason?.message || 'failed'}`);

  if (settings.status === 'fulfilled')    write(KEYS.settings, settings.value);
  else errors.push(`settings: ${settings.reason?.message || 'failed'}`);

  if (branches.status === 'fulfilled') {
    // Coerce is_default to boolean because MySQL returns 0/1.
    const list = (branches.value || []).map((b) => ({ ...b, is_default: !!Number(b.is_default) }));
    write(KEYS.branches, list);
  } else errors.push(`branches: ${branches.reason?.message || 'failed'}`);

  if (serviceCategories.status === 'fulfilled') write(KEYS.serviceCategories, serviceCategories.value || []);
  else errors.push(`service_categories: ${serviceCategories.reason?.message || 'failed'}`);

  if (serviceItems.status === 'fulfilled') {
    // Normalise numeric fields — MySQL DECIMAL returns strings via PDO
    const list = (serviceItems.value || []).map((s) => ({
      ...s,
      default_price: Number(s.default_price) || 0,
      duration_minutes: s.duration_minutes ? Number(s.duration_minutes) : null,
    }));
    write(KEYS.serviceItems, list);
  } else errors.push(`service_items: ${serviceItems.reason?.message || 'failed'}`);

  if (servicePackages.status === 'fulfilled') {
    // items_json arrives decoded (array); safeguard the type in case of legacy rows.
    const list = (servicePackages.value || []).map((p) => ({
      ...p,
      items_json: Array.isArray(p.items_json) ? p.items_json : [],
    }));
    write(KEYS.servicePackages, list);
  } else errors.push(`service_packages: ${servicePackages.reason?.message || 'failed'}`);

  const ok = errors.length === 0;
  if (!ok) {
    // eslint-disable-next-line no-console
    console.warn('[pull] Some entities failed to sync:', errors);
  } else {
    // eslint-disable-next-line no-console
    console.debug('[pull] All entities synced from MySQL to localStorage');
  }
  return { ok, errors };
}
