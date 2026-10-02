// ============================================================================
// Granular staff permissions — mirrors the backend `utils/permissions.js`.
//
// The Staff Panel sidebar has five operational modules; each one maps to a
// boolean permission flag that an Admin can toggle independently per account
// from /admin/users. This module is the single source of truth used by the
// user table, the sidebar and the route guards.
// ============================================================================

// `key`     -> API/frontend flag
// `column`  -> database boolean returned on user payloads
// `labelKey`-> i18n key for the column header
export const PERMISSION_MODULES = [
  { key: 'orders', column: 'canManageOrders', labelKey: 'admin.users.colOrders' },
  { key: 'inventory', column: 'canManageInventory', labelKey: 'admin.users.colInventory' },
  { key: 'virtual_box', column: 'canManageVirtualBox', labelKey: 'admin.users.colVirtualBox' },
  { key: 'posts', column: 'canManagePosts', labelKey: 'admin.users.colPosts' },
  { key: 'vouchers', column: 'canManageVouchers', labelKey: 'admin.users.colVouchers' }
];

// Staff sidebar route -> required permission flag.
export const ROUTE_PERMISSIONS = {
  '/staff/products': 'inventory',
  '/staff/posts': 'posts',
  '/staff/vouchers': 'vouchers',
  '/staff/orders': 'orders',
  '/staff/virtual-boxes': 'virtual_box'
};

const NO_PERMISSIONS = PERMISSION_MODULES.reduce((acc, m) => {
  acc[m.key] = false;
  return acc;
}, {});

export const ALL_PERMISSIONS = PERMISSION_MODULES.reduce((acc, m) => {
  acc[m.key] = true;
  return acc;
}, {});

/** Derive the 5-flag permission object for a user. ADMIN always gets all. */
export const resolvePermissions = (user) => {
  if (!user) return { ...NO_PERMISSIONS };
  if (user.role === 'ADMIN') return { ...ALL_PERMISSIONS };

  if (user.permissions && typeof user.permissions === 'object') {
    const normalized = {};
    for (const m of PERMISSION_MODULES) normalized[m.key] = Boolean(user.permissions[m.key]);
    return normalized;
  }

  const derived = {};
  for (const m of PERMISSION_MODULES) derived[m.key] = Boolean(user[m.column]);
  return derived;
};

export const hasPermission = (user, key) => Boolean(resolvePermissions(user)[key]);
