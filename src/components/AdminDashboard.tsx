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
} from 'lucide-react';
import { api } from '../lib/api.js';
import { User } from '../types.js';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
  onNavigateHome: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, onNavigateHome }) => {
  const [activeTab, setActiveTab] = useState<'shops' | 'users'>('shops');
  const [shops, setShops] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
    } catch (e: any) {
      showToast(e.message || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Shop Handlers ---
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
        showToast('Shop details and credentials updated successfully!', 'success');
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

        showToast('New shop registered and activated successfully!', 'success');
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
      showToast(`Shop "${shop.name}" deleted successfully.`, 'success');
      loadData();
    } catch (e: any) {
      showToast(e.message || 'Failed to delete shop.', 'error');
    }
  };

  const handleActivateShop = async (shopId: string) => {
    try {
      await api.activateShop(shopId, 'activate');
      showToast('Shop approved and activated successfully! Customer orders are live.', 'success');
      loadData();
    } catch (e: any) {
      showToast(e.message || 'Failed to activate shop', 'error');
    }
  };

  // --- User Handlers ---
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
        showToast(`User "${userFormName}" updated successfully!`, 'success');
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
        showToast(`User "${userFormName}" created and permanently saved!`, 'success');
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
      showToast('Cannot delete the master system administrator account.', 'error');
      return;
    }
    if (!window.confirm(`Permanently delete user "${userItem.fullName}" (${userItem.email})?`)) {
      return;
    }
    try {
      await api.deleteAdminUser(userItem.id);
      showToast(`User "${userItem.fullName}" permanently removed.`, 'success');
      loadData();
    } catch (e: any) {
      showToast(e.message || 'Failed to delete user', 'error');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    showToast('Credentials copied to clipboard!', 'info');
  };

  // Filtered lists
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
    <div className="min-h-screen bg-[#080b14] text-[#f1f5f9] flex flex-col relative overflow-hidden font-sans">
      {/* Background Neon Ambient Glows */}
      <div className="w-96 h-96 bg-[rgba(255,46,99,0.12)] blur-[140px] rounded-full pointer-events-none absolute -top-24 -left-24 z-0" />
      <div className="w-96 h-96 bg-[rgba(124,92,255,0.14)] blur-[140px] rounded-full pointer-events-none absolute top-1/3 -right-24 z-0" />

      {/* Admin Navbar */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#080b14]/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-grad grid place-items-center shadow-[0_6px_20px_rgba(255,46,99,0.4)] text-white">
              <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-tight font-head">
                  print<span className="grad font-extrabold">x</span> Master Admin
                </span>
                <span className="badge text-[10px] font-black uppercase tracking-wider py-0.5 px-2.5 border-violet-500/30 bg-violet-500/10 text-violet-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-slate-400">{user.fullName} ({user.email})</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadData}
              className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 rounded-xl transition cursor-pointer"
              title="Refresh All Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-pink-400' : ''}`} />
            </button>
            <button
              onClick={onNavigateHome}
              className="btn btn-ghost btn-sm text-xs font-bold"
            >
              Website Home
            </button>
            <button
              onClick={onLogout}
              className="px-3.5 py-2 text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-xl transition border border-rose-500/25 flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-7 relative z-10">
        {/* Navigation Tabs Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="eyebrow">MASTER NETWORK MANAGEMENT</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-head tracking-tight text-white">
              System Administration <span className="grad">Control Hub</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Create and manage retail shops, shop owners, user accounts, credentials, and network routing.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'shops' ? (
              <button
                onClick={handleOpenCreateShopModal}
                className="btn btn-primary text-xs font-black shadow-[0_10px_30px_rgba(255,46,99,0.35)] flex items-center gap-2"
              >
                <Plus className="w-4 h-4 stroke-[3]" /> Register New Shop
              </button>
            ) : (
              <button
                onClick={handleOpenCreateUserModal}
                className="btn btn-primary text-xs font-black shadow-[0_10px_30px_rgba(124,92,255,0.35)] flex items-center gap-2"
              >
                <Plus className="w-4 h-4 stroke-[3]" /> Create New User
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-3 bg-white/[0.03] p-1.5 rounded-2xl border border-white/10 w-fit">
          <button
            onClick={() => setActiveTab('shops')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'shops'
                ? 'bg-grad text-white shadow-lg shadow-pink-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Store className="w-4 h-4" />
            Registered Shops ({shops.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'users'
                ? 'bg-grad text-white shadow-lg shadow-pink-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            Users & Accounts ({users.length})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
          <input
            type="text"
            placeholder={
              activeTab === 'shops'
                ? 'Search shops by name, slug (/shop/slug), owner email or city...'
                : 'Search users by name, email, WhatsApp, role, or linked shop...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/80 focus:ring-1 focus:ring-pink-500/50 shadow-inner transition"
          />
        </div>

        {/* ========================================================
            TAB 1: REGISTERED SHOPS
           ======================================================== */}
        {activeTab === 'shops' && (
          <div className="space-y-6">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase font-black tracking-wider">Total Registered Shops</p>
                  <h3 className="text-2xl font-black text-white mt-1 font-head">{shops.length}</h3>
                  <p className="text-[11px] text-slate-400 mt-1">Platform-wide total counters</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-violet-400 text-xl font-black">
                  🏪
                </div>
              </div>

              <div className="card flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase font-black tracking-wider">Active Live Shops</p>
                  <h3 className="text-2xl font-black text-emerald-400 mt-1 font-head">
                    {shops.filter((s) => s.status === 'active').length}
                  </h3>
                  <p className="text-[11px] text-emerald-400/80 mt-1">Receiving customer orders 24/7</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl font-black">
                  ⚡
                </div>
              </div>

              <div className="card flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase font-black tracking-wider">Pending Review</p>
                  <h3 className="text-2xl font-black text-amber-400 mt-1 font-head">
                    {shops.filter((s) => s.status !== 'active').length}
                  </h3>
                  <p className="text-[11px] text-amber-400/80 mt-1">Awaiting review or suspended</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xl font-black">
                  ⏳
                </div>
              </div>
            </div>

            {/* Shops Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredShops.map((s) => (
                <div
                  key={s.id}
                  className="card space-y-4 hover:border-white/20 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-white font-head">{s.name}</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            s.status === 'active'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : s.status === 'pending_review'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {s.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-1">
                        Live Portal: <span className="text-pink-300 font-bold">/shop/{s.slug}</span>
                      </p>
                    </div>

                    <a
                      href={`/shop/${s.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost btn-sm text-xs text-pink-300 hover:text-white flex items-center gap-1.5"
                    >
                      Visit Portal <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Details */}
                  <div className="p-3.5 bg-white/[0.03] rounded-xl border border-white/[0.06] text-xs space-y-2 text-slate-300">
                    <p className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <UserIcon className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        <span>Owner: <strong className="text-white">{s.ownerName || 'Unassigned'}</strong></span>
                      </span>
                      <span className="text-[11px] text-pink-300 font-mono bg-pink-500/10 px-2 py-0.5 rounded-lg border border-pink-500/20">
                        {s.ownerEmail || 'No email set'}
                      </span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                      <span>
                        Phone: <strong className="text-white">{s.phone}</strong>
                      </span>
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        Location: <strong className="text-white">{s.city}</strong> ({s.address})
                      </span>
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      {s.status !== 'active' && (
                        <button
                          onClick={() => handleActivateShop(s.id)}
                          className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Activate
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEditShopModal(s)}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" /> Edit Shop & Password
                      </button>
                      <button
                        onClick={() => handleDeleteShop(s)}
                        className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 rounded-xl transition cursor-pointer"
                        title="Delete Shop"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredShops.length === 0 && (
              <div className="card text-center py-16 space-y-3">
                <Store className="w-12 h-12 text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-slate-300">No registered shops match your search.</p>
                <button
                  onClick={handleOpenCreateShopModal}
                  className="btn btn-primary btn-sm text-xs"
                >
                  Register New Shop
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 2: USERS & ACCOUNTS MANAGEMENT
           ======================================================== */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase font-black tracking-wider">Total User Accounts</p>
                  <h3 className="text-2xl font-black text-white mt-1 font-head">{users.length}</h3>
                  <p className="text-[11px] text-slate-400 mt-1">Guaranteed persistent in database</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-pink-400 text-xl font-black">
                  👥
                </div>
              </div>

              <div className="card flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase font-black tracking-wider">Shop Owners</p>
                  <h3 className="text-2xl font-black text-emerald-400 mt-1 font-head">
                    {users.filter((u) => u.role === 'shop_owner').length}
                  </h3>
                  <p className="text-[11px] text-emerald-400/80 mt-1">Counter operators & proprietors</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl font-black">
                  🏪
                </div>
              </div>

              <div className="card flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase font-black tracking-wider">System Administrators</p>
                  <h3 className="text-2xl font-black text-violet-400 mt-1 font-head">
                    {users.filter((u) => u.role === 'admin').length}
                  </h3>
                  <p className="text-[11px] text-violet-400/80 mt-1">Full platform authority</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 text-xl font-black">
                  🛡️
                </div>
              </div>
            </div>

            {/* Users Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className="card space-y-4 hover:border-white/20 transition-all duration-200 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white font-bold text-sm">
                        {u.role === 'admin' ? <Shield className="w-5 h-5 text-violet-400" /> : <UserIcon className="w-5 h-5 text-pink-400" />}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{u.fullName || 'User'}</h4>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mt-0.5 ${
                            u.role === 'admin'
                              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {u.role === 'admin' ? 'Super Admin' : 'Shop Owner'}
                        </span>
                      </div>
                    </div>

                    {u.email?.toLowerCase() !== 'printx286351@gmail.com' && (
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 rounded-lg transition cursor-pointer"
                        title="Delete User"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.06] text-xs space-y-2 text-slate-300 font-mono">
                    <p className="flex items-center justify-between gap-2 overflow-hidden text-ellipsis">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Mail className="w-3.5 h-3.5 text-pink-400 shrink-0" /> Email:
                      </span>
                      <strong className="text-white text-xs truncate">{u.email}</strong>
                    </p>
                    <p className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> WhatsApp:
                      </span>
                      <strong className="text-white text-xs">{u.whatsappNumber || 'N/A'}</strong>
                    </p>
                    <p className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Store className="w-3.5 h-3.5 text-amber-400 shrink-0" /> Linked Shop:
                      </span>
                      <span className="text-pink-300 font-bold truncate">
                        {u.linkedShop ? u.linkedShop.name : 'Not Assigned'}
                      </span>
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleOpenEditUserModal(u)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer flex-1 justify-center"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-pink-400" /> Edit / Reset Password
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredUsers.length === 0 && (
              <div className="card text-center py-16 space-y-3">
                <Users className="w-12 h-12 text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-slate-300">No users match your search query.</p>
                <button
                  onClick={handleOpenCreateUserModal}
                  className="btn btn-primary btn-sm text-xs"
                >
                  Create New User
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ========================================================
          MODAL: CREATE / EDIT SHOP
         ======================================================== */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0f172a] border border-white/15 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative text-white max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold font-head text-white mb-1">
              {editingShop ? `Edit Shop & Owner: ${editingShop.name}` : 'Register & Activate New Shop'}
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              {editingShop
                ? 'Update retail shop counter details and reset shopkeeper login credentials.'
                : 'Instantly registers a counter, generates the customer print portal URL, and creates the owner account.'}
            </p>

            <form onSubmit={handleSaveShop} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Shop Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Apex Cyber Solutions"
                  className="w-full py-2.5 px-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Live URL Slug (/shop/slug)</label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="e.g. apex-cyber (auto-generated if left blank)"
                  className="w-full py-2.5 px-3.5 bg-white/5 border border-white/10 rounded-xl text-xs font-mono text-pink-300 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Phone / Support</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+919876543210"
                    className="w-full py-2 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-pink-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">City</label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    placeholder="e.g. Ekma, Bihar"
                    className="w-full py-2 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Counter Address</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="e.g. Main Market, Near Railway Station"
                  className="w-full py-2 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              {editingShop && (
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full py-2 px-3 bg-[#1e293b] border border-white/10 rounded-xl text-sm text-white focus:outline-none"
                  >
                    <option value="active">Active (Receiving Orders)</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              )}

              {/* Owner Credentials */}
              <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-pink-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-pink-300">
                    Owner Login Credentials (Saved Durably)
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Owner Full Name</label>
                  <input
                    type="text"
                    value={formOwnerName}
                    onChange={(e) => setFormOwnerName(e.target.value)}
                    placeholder="Proprietor / Owner Name"
                    className="w-full py-2 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Owner Email / Login ID</label>
                    <input
                      type="email"
                      value={formOwnerEmail}
                      onChange={(e) => setFormOwnerEmail(e.target.value)}
                      placeholder="owner@printshop.in"
                      className="w-full py-2 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      {editingShop ? 'New Password (or leave blank)' : 'Login Password *'}
                    </label>
                    <input
                      type="text"
                      value={formOwnerPassword}
                      onChange={(e) => setFormOwnerPassword(e.target.value)}
                      placeholder={editingShop ? 'Keep unchanged' : 'Shop#1234'}
                      className="w-full py-2 px-3 bg-white/5 border border-white/10 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-ghost flex-1 py-3 text-sm font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn btn-primary flex-1 py-3 text-sm font-black cursor-pointer shadow-[0_10px_25px_rgba(255,46,99,0.35)]"
                >
                  {isSaving ? 'Saving...' : editingShop ? 'Update Shop' : 'Register & Save Shop'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CREATE / EDIT USER
         ======================================================== */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0f172a] border border-white/15 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-white max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold font-head text-white mb-1">
              {editingUser ? `Edit User: ${editingUser.fullName}` : 'Create New User Account'}
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              {editingUser
                ? 'Update contact details, role, or reset password.'
                : 'Create a permanent system account for shop owners or administrators.'}
            </p>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={userFormName}
                  onChange={(e) => setUserFormName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full py-2.5 px-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={userFormEmail}
                  onChange={(e) => setUserFormEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full py-2.5 px-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    value={userFormPhone}
                    onChange={(e) => setUserFormPhone(e.target.value)}
                    placeholder="+919876543210"
                    className="w-full py-2 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-pink-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Role *</label>
                  <select
                    value={userFormRole}
                    onChange={(e) => setUserFormRole(e.target.value as any)}
                    className="w-full py-2 px-3 bg-[#1e293b] border border-white/10 rounded-xl text-sm text-white focus:outline-none"
                  >
                    <option value="shop_owner">Shop Owner</option>
                    <option value="admin">System Administrator</option>
                  </select>
                </div>
              </div>

              {/* Linked Shop (if shop owner) */}
              {userFormRole === 'shop_owner' && (
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Link to Shop Counter</label>
                  <select
                    value={userFormShopId}
                    onChange={(e) => setUserFormShopId(e.target.value)}
                    className="w-full py-2 px-3 bg-[#1e293b] border border-white/10 rounded-xl text-sm text-white focus:outline-none"
                  >
                    <option value="">-- No Shop (Standalone Account) --</option>
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (/shop/{s.slug})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Password */}
              <div className="p-3.5 bg-white/[0.02] border border-white/10 rounded-2xl space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-pink-300 block">
                  {editingUser ? 'Reset Password (or leave blank)' : 'Login Password *'}
                </label>
                <input
                  type="text"
                  required={!editingUser}
                  value={userFormPassword}
                  onChange={(e) => setUserFormPassword(e.target.value)}
                  placeholder={editingUser ? 'Leave blank to keep unchanged' : 'Min 6 characters (e.g. User#1234)'}
                  className="w-full py-2 px-3 bg-white/5 border border-white/10 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="btn btn-ghost flex-1 py-3 text-sm font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn btn-primary flex-1 py-3 text-sm font-black cursor-pointer shadow-[0_10px_25px_rgba(124,92,255,0.35)]"
                >
                  {isSaving ? 'Saving...' : editingUser ? 'Update User' : 'Create & Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          POPUP: CREDENTIALS CONFIRMATION & COPY MODAL
         ======================================================== */}
      {createdCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0f172a] border border-emerald-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-[0_20px_50px_rgba(16,185,129,0.25)] relative text-white">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 mx-auto text-xl">
              ✓
            </div>
            <h3 className="text-lg font-bold font-head text-center text-white">{createdCredentials.title}</h3>
            <p className="text-xs text-center text-slate-400 mt-1 mb-5">
              Account credentials have been permanently saved in the database.
            </p>

            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2.5 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Email:</span>
                <strong className="text-white select-all">{createdCredentials.email}</strong>
              </div>
              {createdCredentials.password && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Password:</span>
                  <strong className="text-pink-300 select-all font-black">{createdCredentials.password}</strong>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Role:</span>
                <span className="text-emerald-400 font-bold">{createdCredentials.role}</span>
              </div>
              {createdCredentials.shopName && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Shop:</span>
                  <span className="text-amber-300 font-bold">{createdCredentials.shopName}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() =>
                  copyToClipboard(
                    `Login ID: ${createdCredentials.email}\nPassword: ${createdCredentials.password || '(unchanged)'}`
                  )
                }
                className="btn btn-primary flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedKey ? 'Copied!' : 'Copy Login Details'}
              </button>
              <button
                onClick={() => setCreatedCredentials(null)}
                className="btn btn-ghost px-5 py-2.5 text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Notification Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border text-sm font-bold backdrop-blur-md transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-950/95 text-emerald-200 border-emerald-500 shadow-[0_10px_30px_rgba(34,197,94,0.3)]'
                : toast.type === 'error'
                ? 'bg-rose-950/95 text-rose-200 border-rose-500 shadow-[0_10px_30px_rgba(244,63,94,0.3)]'
                : 'bg-[#0d1220]/95 text-sky-200 border-sky-500'
            }`}
          >
            <span className="text-base">{toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}</span>
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-3 text-xs opacity-60 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
