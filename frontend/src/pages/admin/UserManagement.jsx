import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, Loader2, AlertCircle, Shield, UserCog, Ban, CheckCircle2,
  ChevronLeft, ChevronRight, KeyRound, ToggleLeft, ToggleRight
} from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';

const UserManagement = () => {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ totalPages: 1 });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [passwordModal, setPasswordModal] = useState(null); // user object để mở modal đổi mk
  const [newPassword, setNewPassword] = useState('');

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
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter]);

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

  const handlePermissionToggle = async (user, permissionKey) => {
    if (user.id === currentUser?.id) {
      alert('You cannot change your own permissions.');
      return;
    }
    setProcessingId(user.id);
    setError('');
    try {
      const updatedPermissions = {
        canManageInventory: user.canManageInventory,
        canManagePosts: user.canManagePosts,
        canAccessChat: user.canAccessChat,
      };
      updatedPermissions[permissionKey] = !updatedPermissions[permissionKey];
      await api.patch(`/admin/users/${user.id}/permissions`, updatedPermissions);
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
      alert('Password must be at least 8 characters.');
      return;
    }
    setProcessingId(passwordModal.id);
    setError('');
    try {
      await api.patch(`/admin/users/${passwordModal.id}/password`, { newPassword });
      setPasswordModal(null);
      setNewPassword('');
    } catch (err) {
      console.error('Failed to change password:', err);
      setError('Failed to change password.');
    } finally {
      setProcessingId(null);
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
        <p className="text-gray-500">Manage user roles, permissions, and account status</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, name, or phone..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Roles</option>
          <option value="CUSTOMER">Customer</option>
          <option value="STAFF">Staff</option>
          <option value="ADMIN">Admin</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="BANNED">Banned</option>
          <option value="DELETED">Deleted</option>
        </select>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {/* Users table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No users found.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inventory</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Posts</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chat</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
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
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(user.status)}`}>
                      {user.status}
                    </span>
                  </td>
                  {/* Permission toggles */}
                  <td className="px-4 py-3">
                    {user.role === 'ADMIN' ? (
                      <span className="text-green-500">✓</span>
                    ) : (
                      <button
                        onClick={() => handlePermissionToggle(user, 'canManageInventory')}
                        disabled={processingId === user.id || user.role !== 'STAFF' && user.role !== 'MODERATOR'}
                        className="p-1"
                      >
                        {user.canManageInventory ? <ToggleRight className="h-5 w-5 text-green-500" /> : <ToggleLeft className="h-5 w-5 text-gray-400" />}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.role === 'ADMIN' ? (
                      <span className="text-green-500">✓</span>
                    ) : (
                      <button
                        onClick={() => handlePermissionToggle(user, 'canManagePosts')}
                        disabled={processingId === user.id || user.role !== 'STAFF' && user.role !== 'MODERATOR'}
                        className="p-1"
                      >
                        {user.canManagePosts ? <ToggleRight className="h-5 w-5 text-green-500" /> : <ToggleLeft className="h-5 w-5 text-gray-400" />}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.role === 'ADMIN' ? (
                      <span className="text-green-500">✓</span>
                    ) : (
                      <button
                        onClick={() => handlePermissionToggle(user, 'canAccessChat')}
                        disabled={processingId === user.id || user.role !== 'STAFF' && user.role !== 'MODERATOR'}
                        className="p-1"
                      >
                        {user.canAccessChat ? <ToggleRight className="h-5 w-5 text-green-500" /> : <ToggleLeft className="h-5 w-5 text-gray-400" />}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={processingId === user.id || user.id === currentUser?.id}
                        className="text-xs border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="CUSTOMER">Customer</option>
                        <option value="STAFF">Staff</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      {user.status === 'ACTIVE' ? (
                        <button onClick={() => handleStatusChange(user.id, 'BANNED')} disabled={processingId === user.id || user.id === currentUser?.id} className="p-1 text-red-500"><Ban className="h-5 w-5" /></button>
                      ) : (
                        <button onClick={() => handleStatusChange(user.id, 'ACTIVE')} disabled={processingId === user.id || user.id === currentUser?.id} className="p-1 text-green-500"><CheckCircle2 className="h-5 w-5" /></button>
                      )}
                      <button onClick={() => openPasswordModal(user)} disabled={processingId === user.id} className="p-1 text-blue-600" title="Change password"><KeyRound className="h-5 w-5" /></button>
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
          <span>Page {page} of {meta.totalPages}</span>
          <button onClick={() => setPage(Math.min(meta.totalPages, page + 1))} disabled={page >= meta.totalPages} className="p-2 border border-gray-300 rounded-lg"><ChevronRight className="h-5 w-5" /></button>
        </div>
      )}

      {/* Password Modal */}
      {passwordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-2">Change Password</h3>
            <p className="text-sm text-gray-500 mb-4">Set new password for {passwordModal.email}</p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8 chars)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
            />
            <div className="flex justify-end space-x-3">
              <button onClick={() => setPasswordModal(null)} className="px-4 py-2 border border-gray-300 rounded-lg">Cancel</button>
              <button onClick={handleChangePassword} disabled={processingId === passwordModal.id} className="px-4 py-2 bg-primary-600 text-white rounded-lg">
                {processingId === passwordModal.id ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;