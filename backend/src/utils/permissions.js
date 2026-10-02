// ============================================================================
// Granular staff permissions — single source of truth for the 5 operational
// modules that mirror the Staff Panel sidebar.
//
// The database stores one boolean column per module; the API also exposes the
// aggregate `permissions: { orders, inventory, virtual_box, posts, vouchers }`
// object so the frontend can drive menu visibility and route guards directly
// from a logged-in user payload.
// ============================================================================

const MODULES = ['orders', 'inventory', 'virtual_box', 'posts', 'vouchers'];

// flag (API / frontend)  ->  Prisma model column
const FLAG_TO_COLUMN = {
  orders: 'canManageOrders',
  inventory: 'canManageInventory',
  virtual_box: 'canManageVirtualBox',
  posts: 'canManagePosts',
  vouchers: 'canManageVouchers'
};

const PERMISSION_COLUMNS = Object.values(FLAG_TO_COLUMN);

const ALL_PERMISSIONS = MODULES.reduce((acc, flag) => {
  acc[flag] = true;
  return acc;
}, {});

// Prisma `select` fragment with every granular flag.
const permissionSelect = PERMISSION_COLUMNS.reduce((acc, column) => {
  acc[column] = true;
  return acc;
}, {});

/** Build the aggregate permissions object from a user row. */
const toPermissions = (user) => {
  const permissions = {};
  for (const flag of MODULES) {
    permissions[flag] = Boolean(user?.[FLAG_TO_COLUMN[flag]]);
  }
  return permissions;
};

/** ADMIN always has full access; every other role is driven by its flags. */
const resolvePermissions = (user) => {
  if (!user) return { ...ALL_PERMISSIONS, orders: false, inventory: false, virtual_box: false, posts: false, vouchers: false };
  if (user.role === 'ADMIN') return { ...ALL_PERMISSIONS };
  return toPermissions(user);
};

/** Attach the aggregate `permissions` object to a user payload. */
const withPermissions = (user) => (user ? { ...user, permissions: toPermissions(user) } : user);

/**
 * Map an arbitrary permissions payload (nested `permissions` object and/or
 * flat camelCase booleans) onto Prisma column updates.
 * Returns only the fields explicitly provided.
 */
const extractPermissionUpdate = (body = {}) => {
  const data = {};
  const nested = body.permissions && typeof body.permissions === 'object' ? body.permissions : null;

  for (const flag of MODULES) {
    const column = FLAG_TO_COLUMN[flag];
    if (nested && typeof nested[flag] === 'boolean') {
      data[column] = nested[flag];
    } else if (typeof body[column] === 'boolean') {
      data[column] = body[column];
    }
  }
  return data;
};

module.exports = {
  MODULES,
  FLAG_TO_COLUMN,
  PERMISSION_COLUMNS,
  ALL_PERMISSIONS,
  permissionSelect,
  toPermissions,
  resolvePermissions,
  withPermissions,
  extractPermissionUpdate
};
