import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, Loader2, AlertCircle, Shield, UserCog, Trash2, CheckCircle2,
  ChevronLeft, ChevronRight, KeyRound, AlertTriangle, Eye
} from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/LanguageContext';
import UserDetailModal from '../../components/UserDetailModal';
import { PERMISSION_MODULES, resolvePermissions } from '../../utils/permissions';

const ROLE_KEYS = {
  CUSTOMER: 'admin.users.customer',
  STAFF: 'admin.users.staff',
  ADMIN: 'admin.users.admin'
};

const USER_STATUS_KEYS = {
  ACTIVE: 'admin.users.active',
  BANNED: 'admin.users.banned',
  DELETED: 'admin.users.deleted'
};

const UserManagement = () => {
  const { user: currentUser } = useAuthStore();
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ totalPages: 1 });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [passwordModal, setPasswordModal] = useState(null); // user object để mở modal đổi mk
  const [detailUser, setDetailUser] = useState(null); // user đang xem chi tiết (read-only drawer)
  const [newPassword, setNewPassword] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null); // user đang chờ xóa
  const [deleteStep, setDeleteStep] = useState(1); // 1 = xác nhận, 2 = gõ từ khóa
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;
      const response = await api.get('/admin/users', { params });
      setUsers(response.data.data.items || []);
      setMeta(response.data.data.meta || { totalPages: 1 });
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError(t('admin.users.empty'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, roleFilter, statusFilter, t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId, newRole) => {
    if (userId === currentUser?.id) {
      alert('You cannot change your own role.');
      return;
    }
    setProcessingId(userId);
    setError('');
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      fetchUsers();
    } catch (err) {
      console.error('Failed to update role:', err);
      setError('Failed to update user role.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleStatusChange = async (userId, newStatus) => {
    if (userId === currentUser?.id) {
      alert('You cannot change your own status.');
      return;
    }
    setProcessingId(userId);
    setError('');
    try {
      await api.patch(`/admin/users/${userId}/status`, { status: newStatus });
      fetchUsers();
    } catch (err) {
      console.error('Failed to update status:', err);
      setError('Failed to update user status.');
    } finally {
      setProcessingId(null);
    }
  };

  const handlePermissionToggle = async (user, moduleKey) => {
    if (user.id === currentUser?.id) {
      alert('You cannot change your own permissions.');
      return;
    }
    setProcessingId(user.id);
    setError('');
    try {
      const current = resolvePermissions(user);
      const nextPermissions = { ...current, [moduleKey]: !current[moduleKey] };
      await api.patch(`/admin/users/${user.id}/permissions`, { permissions: nextPermissions });
      fetchUsers();
    } catch (err) {
      console.error('Failed to update permissions:', err);
      setError('Failed to update user permissions.');
    } finally {
      setProcessingId(null);
    }
  };

  const openPasswordModal = (user) => {
    setPasswordModal(user);
    setNewPassword('');
  };

  const handleChangePassword = async () => {
    if (!passwordModal) return;
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setProcessingId(passwordModal.id);
    setError('');
    try {
      await api.patch(`/admin/users/${passwordModal.id}/password`, { newPassword });
      setPasswordModal(null);
      setNewPassword('');
      showToast(`Đã đổi mật khẩu cho ${passwordModal.email}.`);
    } catch (err) {
      console.error('Failed to change password:', err);
      const detail = err.response?.data?.error?.details?.map((d) => d.message).join('. ');
      setError(detail || err.response?.data?.error?.message || 'Failed to change password.');
    } finally {
      setProcessingId(null);
    }
  };

  const openDeleteModal = (user) => {
    if (user.id === currentUser?.id) return;
    setDeleteTarget(user);
    setDeleteStep(1);
    setDeleteConfirmText('');
    setError('');
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteStep(1);
    setDeleteConfirmText('');
  };

  const isDeleteConfirmValid = ['DELETE', 'XÓA'].includes(deleteConfirmText.trim().toUpperCase());

  const handleDeleteUser = async () => {
    if (!deleteTarget || !isDeleteConfirmValid) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/admin/users/${deleteTarget.id}`);
      setDeleteTarget(null);
      setDeleteStep(1);
      setDeleteConfirmText('');
      showToast('Đã xóa tài khoản thành công');
      fetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
      const detail = err.response?.data?.error?.message;
      setError(detail || 'Không thể xóa tài khoản. Vui lòng thử lại.');
      setDeleteTarget(null);
      setDeleteStep(1);
      setDeleteConfirmText('');
    } finally {
      setDeleting(false);
    }
  };

  const getRoleBadge = (role) => {
    if (role === 'ADMIN') return 'bg-red-100 text-red-800';
    if (role === 'STAFF') return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getStatusBadge = (status) => {
    if (status === 'ACTIVE') return 'bg-green-100 text-green-800';
    if (status === 'BANNED') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  // Responsive permission switch. The hidden checkbox carries the test hooks
  // (`data-permission` / `data-enabled`) so Playwright can target a specific
  // module within a specific user row.
  const PermissionSwitch = ({ moduleKey, enabled, disabled, onToggle, label }) => (
    <label className="relative inline-flex items-center cursor-pointer align-middle">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={enabled}
        disabled={disabled}
        onChange={onToggle}
        data-permission={moduleKey}
        data-testid={`perm-toggle-${moduleKey}`}
        data-enabled={enabled ? 'true' : 'false'}
        aria-label={label}
      />
      <span
        className={`relative w-10 h-5 rounded-full transition-colors bg-gray-300 dark:bg-neutral-600 peer-checked:bg-pink-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-pink-400 ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      />
    </label>
  );

  // One cell per permission module, role-aware:
  //  ADMIN  -> read-only full-access checkmark
  //  CUSTOMER -> disabled dash (no operational access)
  //  STAFF/MODERATOR -> interactive toggle
  const renderPermissionCell = (user, module) => {
    const enabled = resolvePermissions(user)[module.key];
    const label = t(module.labelKey);

    if (user.role === 'ADMIN') {
      return (
        <span
          className="inline-flex h-5 w-10 items-center justify-center text-green-500 font-bold"
          data-permission={module.key}
          data-enabled="true"
          title={`${label}: ${t('admin.users.detail.yes')}`}
        >
          ✓
        </span>
      );
    }

    if (user.role !== 'STAFF' && user.role !== 'MODERATOR') {
      return (
        <span className="inline-flex h-5 w-10 items-center justify-center text-gray-300 dark:text-neutral-600" data-permission={module.key} data-enabled="false">
          –
        </span>
      );
    }

    return (
      <PermissionSwitch
        moduleKey={module.key}
        enabled={enabled}
        disabled={processingId === user.id}
        onToggle={() => handlePermissionToggle(user, module.key)}
        label={`${label}: ${enabled ? t('admin.users.detail.yes') : t('admin.users.detail.no')}`}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">{t('admin.users.title')}</h2>
        <p className="text-gray-500">{t('admin.users.subtitle')}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.users.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">{t('admin.users.allRoles')}</option>
          <option value="CUSTOMER">{t('admin.users.customer')}</option>
          <option value="STAFF">{t('admin.users.staff')}</option>
          <option value="ADMIN">{t('admin.users.admin')}</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">{t('admin.users.allStatus')}</option>
          <option value="ACTIVE">{t('admin.users.active')}</option>
          <option value="BANNED">{t('admin.users.banned')}</option>
          <option value="DELETED">{t('admin.users.deleted')}</option>
        </select>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {toast && (
        <div className="p-3 bg-green-50 text-green-700 rounded-lg flex items-center">
          <CheckCircle2 className="h-5 w-5 mr-2" />
          {toast.message}
        </div>
      )}

      {/* Users table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-gray-500">{t('admin.users.empty')}</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.users.colUser')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.users.colRole')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.users.colStatus')}</th>
                {PERMISSION_MODULES.map((module) => (
                  <th
                    key={module.key}
                    data-permission-column={module.key}
                    className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap"
                  >
                    {t(module.labelKey)}
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.users.colActions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <UserCog className="h-5 w-5 text-gray-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{user.fullName}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadge(user.role)}`}>
                      {t(ROLE_KEYS[user.role]) || user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(user.status)}`}>
                      {t(USER_STATUS_KEYS[user.status]) || user.status}
                    </span>
                  </td>
                  {/* Granular permission toggles — one column per Staff module */}
                  {PERMISSION_MODULES.map((module) => (
                    <td key={module.key} className="px-4 py-3 text-center whitespace-nowrap">
                      {renderPermissionCell(user, module)}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                       <select
                         value={user.role}
                         onChange={(e) => handleRoleChange(user.id, e.target.value)}
                         disabled={processingId === user.id || user.id === currentUser?.id}
                         className="text-xs border border-gray-300 rounded px-2 py-1"
                       >
                         <option value="CUSTOMER">{t('admin.users.customer')}</option>
                         <option value="STAFF">{t('admin.users.staff')}</option>
                         <option value="ADMIN">{t('admin.users.admin')}</option>
                       </select>
                      {user.status !== 'ACTIVE' && (
                        <button onClick={() => handleStatusChange(user.id, 'ACTIVE')} disabled={processingId === user.id || user.id === currentUser?.id} className="p-1 text-green-500" title="Kích hoạt lại"><CheckCircle2 className="h-5 w-5" /></button>
                      )}
                      <button
                        onClick={() => setDetailUser(user)}
                        data-testid="view-user-btn"
                        title={t('admin.users.viewDetails')}
                        className="text-pink-600 hover:text-pink-700 hover:bg-pink-50 dark:text-pink-400 dark:hover:bg-pink-950/40 p-2 rounded-xl transition-colors"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                      <button onClick={() => openPasswordModal(user)} disabled={processingId === user.id} className="p-1 text-blue-600" title={t('admin.users.changePassword')}><KeyRound className="h-5 w-5" /></button>
                      <button
                        onClick={() => openDeleteModal(user)}
                        disabled={processingId === user.id || user.id === currentUser?.id}
                        data-testid="delete-user-btn"
                        data-self={user.id === currentUser?.id ? 'true' : 'false'}
                        title={user.id === currentUser?.id ? 'Không thể tự xóa tài khoản' : 'Xóa tài khoản'}
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-2 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-rose-500"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="p-2 border border-gray-300 rounded-lg"><ChevronLeft className="h-5 w-5" /></button>
          <span>{t('news.pageOf', { page, total: meta.totalPages })}</span>
          <button onClick={() => setPage(Math.min(meta.totalPages, page + 1))} disabled={page >= meta.totalPages} className="p-2 border border-gray-300 rounded-lg"><ChevronRight className="h-5 w-5" /></button>
        </div>
      )}

      {/* User Detail Drawer — read-only aggregated profile */}
      {detailUser && (
        <UserDetailModal user={detailUser} onClose={() => setDetailUser(null)} />
      )}

      {/* Password Modal */}
      {passwordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-2">{t('admin.users.changePasswordTitle')}</h3>
            <p className="text-sm text-gray-500 mb-4">{t('admin.users.changePassword')} — {passwordModal.email}</p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('admin.users.newPassword')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
            />
            <div className="flex justify-end space-x-3">
              <button onClick={() => setPasswordModal(null)} className="px-4 py-2 border border-gray-300 rounded-lg">{t('admin.users.cancel')}</button>
              <button onClick={handleChangePassword} disabled={processingId === passwordModal.id} className="px-4 py-2 bg-primary-600 text-white rounded-lg">
                {processingId === passwordModal.id ? <Loader2 className="h-5 w-5 animate-spin" /> : t('admin.users.changePassword')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User — 2-Step Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" data-testid="delete-user-modal">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 w-full max-w-md">
            {deleteStep === 1 ? (
              <div data-testid="delete-user-modal-step1">
                <div className="flex items-center space-x-3 mb-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/40">
                    <Trash2 className="h-5 w-5 text-rose-500" />
                  </span>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Xác nhận xóa tài khoản</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                  Bạn có chắc chắn muốn xóa tài khoản <strong>{deleteTarget.email || deleteTarget.fullName}</strong>? Hành động này sẽ xóa dữ liệu người dùng khỏi hệ thống.
                </p>
                <div className="flex justify-end space-x-3">
                  <button data-testid="delete-cancel-btn" onClick={closeDeleteModal} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200 dark:border-slate-700">{t('admin.users.cancel')}</button>
                  <button data-testid="delete-proceed-btn" onClick={() => setDeleteStep(2)} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors">Tiếp tục xóa</button>
                </div>
              </div>
            ) : (
              <div data-testid="delete-user-modal-step2">
                <div className="flex items-center space-x-3 mb-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/40">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  </span>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">⚠️ Cảnh báo xác nhận lần 2</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Đây là hành động <strong>KHÔNG THỂ KHÔI PHỤC</strong>. Vui lòng gõ chữ <strong>DELETE</strong> (hoặc <strong>XÓA</strong>) vào ô bên dưới để xác nhận:
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  data-testid="delete-confirm-input"
                  placeholder="DELETE"
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg mb-6 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <div className="flex justify-end space-x-3">
                  <button data-testid="delete-back-btn" onClick={() => { setDeleteStep(1); setDeleteConfirmText(''); }} disabled={deleting} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200 dark:border-slate-700 disabled:opacity-50">{t('admin.users.cancel')}</button>
                  <button
                    data-testid="delete-confirm-btn"
                    onClick={handleDeleteUser}
                    disabled={!isDeleteConfirmValid || deleting}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-rose-600 inline-flex items-center space-x-2"
                  >
                    {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>Xóa vĩnh viễn</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;