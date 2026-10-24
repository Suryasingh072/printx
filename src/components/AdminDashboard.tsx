import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Edit,
  Plus,
  Store,
  MapPin,
  Phone,
  User as UserIcon,
  LogOut,
  RefreshCw,
  Search,
  ExternalLink,
  Lock,
  Mail,
  Copy,
  Users,
  KeyRound,
  Check,
  Shield,
  Database,
  Cloud,
  AlertTriangle,
  CheckCircle,
  Printer,
  X,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { User } from '../types.js';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
  onNavigateHome: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, onNavigateHome }) => {
  const [activeTab, setActiveTab] = useState<'shops' | 'users' | 'supabase'>('shops');
  const [shops, setShops] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Supabase Cloud State
  const [supabaseStatus, setSupabaseStatus] = useState<any | null>(null);
  const [supabaseUrl, setSupabaseUrl] = useState('https://ovyimgjzfzhysyubqycw.supabase.co');
  const [supabaseServiceKey, setSupabaseServiceKey] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [isSavingSupabase, setIsSavingSupabase] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Edit / Create Shop Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingShop, setEditingShop] = useState<any | null>(null);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'pending_review' | 'suspended'>('active');
  const [formOwnerName, setFormOwnerName] = useState('');
  const [formOwnerEmail, setFormOwnerEmail] = useState('');
  const [formOwnerPassword, setFormOwnerPassword] = useState('');

  // User Management Modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userFormName, setUserFormName] = useState('');
  const [userFormEmail, setUserFormEmail] = useState('');
  const [userFormPhone, setUserFormPhone] = useState('');
  const [userFormRole, setUserFormRole] = useState<'shop_owner' | 'admin'>('shop_owner');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormShopId, setUserFormShopId] = useState('');

  // Credential confirmation popup
  const [createdCredentials, setCreatedCredentials] = useState<{
    title: string;
    email: string;
    password?: string;
    role: string;
    shopName?: string;
  } | null>(null);

  const [copiedKey, setCopiedKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [shopsData, usersData] = await Promise.all([
        api.getAdminShops().catch(() => []),
        api.getAdminUsers().catch(() => []),
      ]);
      setShops(shopsData);
      setUsers(usersData);
      loadSupabaseStatus();
    } catch (e: any) {
      showToast(e.message || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSupabaseStatus = async () => {
    try {
      const res = await api.getSupabaseStatus();
      setSupabaseStatus(res);
      if (res?.url) setSupabaseUrl(res.url);
    } catch (_) {}
  };

  const handleSaveSupabaseConfig = async () => {
    try {
      setIsSavingSupabase(true);
      const res = await api.updateSupabaseConfig({
        url: supabaseUrl,
        serviceRoleKey: supabaseServiceKey,
        anonKey: supabaseAnonKey,
      });
      setSupabaseStatus(res.status);
      showToast('Supabase settings updated & tested', 'success');
      loadData();
    } catch (e: any) {
      showToast(e.message || 'Failed to update Supabase configuration', 'error');
    } finally {
      setIsSavingSupabase(false);
    }
  };

  const handleSyncSupabaseNow = async () => {
    try {
      setIsSyncingSupabase(true);
      const res = await api.syncSupabase();
      setSupabaseStatus(res.status);
      if (res.success) {
        showToast('All shops and data successfully synced to Supabase Cloud', 'success');
        loadData();
      } else {
        showToast(res.status?.error || 'Supabase sync failed. Check RLS or Service Key.', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Supabase sync error', 'error');
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreateShopModal = () => {
    setEditingShop(null);
    setFormName('');
    setFormSlug('');
    setFormPhone('');
    setFormAddress('');
    setFormCity('');
    setFormStatus('active');
    setFormOwnerName('');
    setFormOwnerEmail('');
    setFormOwnerPassword('Shop#1234');
    setShowEditModal(true);
  };

  const handleOpenEditShopModal = (shop: any) => {
    setEditingShop(shop);
    setFormName(shop.name);
    setFormSlug(shop.slug);
    setFormPhone(shop.phone);
    setFormAddress(shop.address);
    setFormCity(shop.city);
    setFormStatus(shop.status);
    setFormOwnerName(shop.ownerName || '');
    setFormOwnerEmail(shop.ownerEmail || '');
    setFormOwnerPassword('');
    setShowEditModal(true);
  };

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingShop) {
        await api.editShop(editingShop.id, {
          name: formName,
          slug: formSlug,
          phone: formPhone,
          address: formAddress,
          city: formCity,
          status: formStatus,
          ownerName: formOwnerName,
          ownerEmail: formOwnerEmail,
          ownerPassword: formOwnerPassword || undefined,
        });
        showToast('Shop details updated successfully', 'success');
        if (formOwnerPassword) {
          setCreatedCredentials({
            title: `Updated Credentials for ${formName}`,
            email: formOwnerEmail,
            password: formOwnerPassword,
            role: 'Shop Owner',
            shopName: formName,
          });
        }
      } else {
        const targetPassword = formOwnerPassword || 'Shop#1234';
        const targetEmail = formOwnerEmail || `${(formSlug || formName).toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'shop'}@printx.shop`;

        await api.createShop({
          name: formName,
          slug: formSlug || undefined,
          phone: formPhone,
          address: formAddress,
          city: formCity,
          ownerName: formOwnerName || formName,
          ownerEmail: targetEmail,
          ownerPassword: targetPassword,
        });

        showToast('New shop registered and activated successfully', 'success');
        setCreatedCredentials({
          title: `New Shop Registered: ${formName}`,
          email: targetEmail,
          password: targetPassword,
          role: 'Shop Owner',
          shopName: formName,
        });
      }
      setShowEditModal(false);
      await loadData();
    } catch (e: any) {
      showToast(e.message || 'Operation failed', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteShop = async (shop: any) => {
    if (!window.confirm(`Are you sure you want to delete shop "${shop.name}"? This action is permanent.`)) {
      return;
    }
    try {
      await api.deleteShop(shop.id);
      showToast(`Shop "${shop.name}" deleted successfully`, 'success');
      loadData();
    } catch (e: any) {
      showToast(e.message || 'Failed to delete shop', 'error');
    }
  };

  const handleActivateShop = async (shopId: string) => {
    try {
      await api.activateShop(shopId, 'activate');
      showToast('Shop approved and activated successfully', 'success');
      loadData();
    } catch (e: any) {
      showToast(e.message || 'Failed to activate shop', 'error');
    }
  };

  const handleOpenCreateUserModal = () => {
    setEditingUser(null);
    setUserFormName('');
    setUserFormEmail('');
    setUserFormPhone('');
    setUserFormRole('shop_owner');
    setUserFormPassword('User#1234');
    setUserFormShopId(shops[0]?.id || '');
    setShowUserModal(true);
  };

  const handleOpenEditUserModal = (userItem: any) => {
    setEditingUser(userItem);
    setUserFormName(userItem.fullName || '');
    setUserFormEmail(userItem.email || '');
    setUserFormPhone(userItem.whatsappNumber || '');
    setUserFormRole(userItem.role || 'shop_owner');
    setUserFormPassword('');
    setUserFormShopId(userItem.linkedShop?.id || '');
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingUser) {
        await api.editAdminUser(editingUser.id, {
          fullName: userFormName,
          email: userFormEmail,
          whatsappNumber: userFormPhone,
          role: userFormRole,
          password: userFormPassword || undefined,
          shopId: userFormShopId || undefined,
        });
        showToast(`User "${userFormName}" updated successfully`, 'success');
        if (userFormPassword) {
          setCreatedCredentials({
            title: `Password Reset for ${userFormName}`,
            email: userFormEmail,
            password: userFormPassword,
            role: userFormRole === 'admin' ? 'Administrator' : 'Shop Owner',
          });
        }
      } else {
        await api.createAdminUser({
          fullName: userFormName,
          email: userFormEmail,
          whatsappNumber: userFormPhone,
          role: userFormRole,
          password: userFormPassword,
          shopId: userFormShopId || undefined,
        });
        showToast(`User "${userFormName}" created successfully`, 'success');
        setCreatedCredentials({
          title: `New User Created: ${userFormName}`,
          email: userFormEmail,
          password: userFormPassword,
          role: userFormRole === 'admin' ? 'Administrator' : 'Shop Owner',
        });
      }
      setShowUserModal(false);
      await loadData();
    } catch (e: any) {
      showToast(e.message || 'Failed to save user', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (userItem: any) => {
    if (userItem.email?.toLowerCase() === 'printx286351@gmail.com') {
      showToast('Cannot delete master administrator account.', 'error');
      return;
    }
    if (!window.confirm(`Permanently delete user "${userItem.fullName}" (${userItem.email})?`)) {
      return;
    }
    try {
      await api.deleteAdminUser(userItem.id);
      showToast(`User "${userItem.fullName}" removed`, 'success');
      loadData();
    } catch (e: any) {
      showToast(e.message || 'Failed to delete user', 'error');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    showToast('Credentials copied to clipboard', 'info');
  };

  const filteredShops = shops.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q) ||
      (s.ownerName && s.ownerName.toLowerCase().includes(q)) ||
      (s.ownerEmail && s.ownerEmail.toLowerCase().includes(q)) ||
      (s.city && s.city.toLowerCase().includes(q))
    );
  });

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      (u.fullName && u.fullName.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.whatsappNumber && u.whatsappNumber.includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q)) ||
      (u.linkedShop && u.linkedShop.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-white/[0.08] bg-[#0f172a] sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white font-['Sora']">PrintX System Admin</span>
                <span className="badge badge-blue text-[10.5px]">Master</span>
              </div>
              <p className="text-[11px] text-slate-400">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="btn btn-secondary btn-sm"
              title="Refresh All Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
            <button
              onClick={onNavigateHome}
              className="btn btn-ghost btn-sm text-xs font-medium"
            >
              Website Home
            </button>
            <button
              onClick={onLogout}
              className="btn btn-ghost btn-sm text-xs text-slate-400 hover:text-white"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-t border-white/[0.06] bg-[#0c1220]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1">
            <button
              onClick={() => setActiveTab('shops')}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'shops'
                  ? 'border-blue-500 text-white font-semibold bg-white/[0.04]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              Registered Shops ({shops.length})
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'users'
                  ? 'border-blue-500 text-white font-semibold bg-white/[0.04]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Users & Accounts ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('supabase')}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'supabase'
                  ? 'border-blue-500 text-white font-semibold bg-white/[0.04]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              Supabase Cloud DB
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={activeTab === 'shops' ? 'Filter shops by name or city...' : 'Filter users by email or role...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-8 py-1.5 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'shops' && (
              <button
                onClick={handleOpenCreateShopModal}
                className="btn btn-primary btn-sm font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Register New Shop
              </button>
            )}
            {activeTab === 'users' && (
              <button
                onClick={handleOpenCreateUserModal}
                className="btn btn-primary btn-sm font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Create New User
              </button>
            )}
            {activeTab === 'supabase' && (
              <button
                onClick={handleSyncSupabaseNow}
                disabled={isSyncingSupabase}
                className="btn btn-primary btn-sm font-medium"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSupabase ? 'animate-spin' : ''}`} />
                {isSyncingSupabase ? 'Syncing...' : 'Sync to Supabase'}
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: SHOPS TABLE */}
        {activeTab === 'shops' && (
          <div className="card bg-[#0f172a] border border-white/[0.08] overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-[#090d16] text-slate-400 uppercase text-[11px]">
                    <th className="py-3 px-4 font-semibold">Shop Name & Slug</th>
                    <th className="py-3 px-4 font-semibold">Location</th>
                    <th className="py-3 px-4 font-semibold">Contact</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-slate-300">
                  {filteredShops.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No shops match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredShops.map((s) => (
                      <tr key={s.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{s.name}</div>
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">/shop/{s.slug}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{s.city}</td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-300">{s.phone}</td>
                        <td className="py-3 px-4">
                          <span className={`badge text-[10.5px] uppercase ${s.status === 'active' ? 'badge-green' : 'badge-amber'}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          {s.status !== 'active' && (
                            <button
                              onClick={() => handleActivateShop(s.id)}
                              className="btn btn-secondary btn-sm text-[11px] text-emerald-400"
                            >
                              Activate
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditShopModal(s)}
                            className="btn btn-ghost btn-sm text-[11px]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteShop(s)}
                            className="p-1.5 text-slate-400 hover:text-red-400 rounded"
                            title="Delete Shop"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: USERS TABLE */}
        {activeTab === 'users' && (
          <div className="card bg-[#0f172a] border border-white/[0.08] overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-[#090d16] text-slate-400 uppercase text-[11px]">
                    <th className="py-3 px-4 font-semibold">User Name & Email</th>
                    <th className="py-3 px-4 font-semibold">Role</th>
                    <th className="py-3 px-4 font-semibold">Phone</th>
                    <th className="py-3 px-4 font-semibold">Linked Shop</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-slate-300">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{u.fullName}</div>
                          <div className="text-[11px] font-mono text-slate-400">{u.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`badge text-[10.5px] uppercase ${u.role === 'admin' ? 'badge-blue' : 'badge-neutral'}`}>
                            {u.role === 'admin' ? 'Administrator' : 'Shop Owner'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-300">
                          {u.whatsappNumber || '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {u.linkedShop?.name || '—'}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          <button
                            onClick={() => handleOpenEditUserModal(u)}
                            className="btn btn-ghost btn-sm text-[11px]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 text-slate-400 hover:text-red-400 rounded"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SUPABASE CONFIG */}
        {activeTab === 'supabase' && (
          <div className="card max-w-2xl bg-[#0f172a] border border-white/[0.08] p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold font-['Sora'] text-white">Supabase Cloud Database Settings</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure your Supabase Cloud project credentials and verify connection status.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Supabase Project URL</label>
                <input
                  type="text"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="input-field text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Service Role Key</label>
                <input
                  type="password"
                  value={supabaseServiceKey}
                  onChange={(e) => setSupabaseServiceKey(e.target.value)}
                  placeholder="••••••••"
                  className="input-field text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Anon / Public Key</label>
                <input
                  type="password"
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="••••••••"
                  className="input-field text-xs font-mono"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={handleSaveSupabaseConfig}
                  disabled={isSavingSupabase}
                  className="btn btn-primary btn-sm font-medium"
                >
                  {isSavingSupabase ? 'Testing & Saving...' : 'Save & Verify Connection'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}

      {/* Edit/Create Shop Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-white/[0.12] rounded-xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <h3 className="text-sm font-bold font-['Sora'] text-white">
                {editingShop ? 'Edit Shop' : 'Register New Shop'}
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveShop} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Shop Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="input-field text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="input-field text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="input-field text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Address *</label>
                <input
                  type="text"
                  required
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="input-field text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Owner Email</label>
                <input
                  type="email"
                  value={formOwnerEmail}
                  onChange={(e) => setFormOwnerEmail(e.target.value)}
                  className="input-field text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  {editingShop ? 'New Password (leave empty to keep current)' : 'Initial Password'}
                </label>
                <input
                  type="password"
                  value={formOwnerPassword}
                  onChange={(e) => setFormOwnerPassword(e.target.value)}
                  placeholder={editingShop ? '••••••••' : 'Shop#1234'}
                  className="input-field text-xs"
                />
              </div>

              <div className="pt-3 border-t border-white/[0.08] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn btn-primary btn-sm font-medium"
                >
                  {isSaving ? 'Saving...' : 'Save Shop'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit/Create User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-white/[0.12] rounded-xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <h3 className="text-sm font-bold font-['Sora'] text-white">
                {editingUser ? 'Edit User' : 'Create User'}
              </h3>
              <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={userFormName}
                  onChange={(e) => setUserFormName(e.target.value)}
                  className="input-field text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={userFormEmail}
                  onChange={(e) => setUserFormEmail(e.target.value)}
                  className="input-field text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={userFormPhone}
                    onChange={(e) => setUserFormPhone(e.target.value)}
                    className="input-field text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Role</label>
                  <select
                    value={userFormRole}
                    onChange={(e) => setUserFormRole(e.target.value as any)}
                    className="input-field text-xs bg-[#0d1322]"
                  >
                    <option value="shop_owner">Shop Owner</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Linked Shop</label>
                <select
                  value={userFormShopId}
                  onChange={(e) => setUserFormShopId(e.target.value)}
                  className="input-field text-xs bg-[#0d1322]"
                >
                  <option value="">None / Independent</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.city})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  {editingUser ? 'New Password (leave empty to keep current)' : 'Password *'}
                </label>
                <input
                  type="password"
                  value={userFormPassword}
                  onChange={(e) => setUserFormPassword(e.target.value)}
                  placeholder={editingUser ? '••••••••' : 'User#1234'}
                  className="input-field text-xs"
                />
              </div>

              <div className="pt-3 border-t border-white/[0.08] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn btn-primary btn-sm font-medium"
                >
                  {isSaving ? 'Saving...' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credential Confirmation Modal */}
      {createdCredentials && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-white/[0.12] rounded-xl max-w-sm w-full p-6 text-white space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold font-['Sora'] text-white">{createdCredentials.title}</h3>
            <div className="p-3 bg-[#090d16] border border-white/[0.08] rounded-lg text-xs space-y-2 font-mono">
              <div>
                <span className="text-slate-400">Email: </span>
                <span className="text-white font-bold">{createdCredentials.email}</span>
              </div>
              {createdCredentials.password && (
                <div>
                  <span className="text-slate-400">Password: </span>
                  <span className="text-blue-400 font-bold">{createdCredentials.password}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  copyToClipboard(`Email: ${createdCredentials.email}\nPassword: ${createdCredentials.password || ''}`);
                }}
                className="btn btn-secondary btn-sm flex-1"
              >
                Copy
              </button>
              <button
                onClick={() => setCreatedCredentials(null)}
                className="btn btn-primary btn-sm flex-1 font-medium"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50">
          <div className="px-4 py-3 rounded-lg bg-[#0f172a] border border-white/[0.12] text-xs font-medium text-white shadow-xl flex items-center gap-2">
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white ml-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
