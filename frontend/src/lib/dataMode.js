/**
 * Data mode adapter.
 *
 * - Default (REACT_APP_DATA_MODE=local): uses localStorage via store.js.
 * - When REACT_APP_DATA_MODE=php: exports async wrappers over the PHP endpoints
 *   (see apiPhp.js). Components using these APIs must then use useEffect+
 *   useState to fetch data.
 *
 * The two modes are export-compatible in signature, but note:
 *   - local mode returns synchronously.
 *   - php mode returns Promises.
 *
 * This flag also drives `authApi` / `settingsApi` selection at boot.
 */

const MODE = (process.env.REACT_APP_DATA_MODE || 'local').toLowerCase();

export const DATA_MODE = MODE;
export const IS_PHP = MODE === 'php';
export const IS_LOCAL = !IS_PHP;
