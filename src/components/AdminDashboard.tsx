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
  AlertTriangle,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { User } from '../types.js';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
  onNavigateHome: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, onNavigateHome }) => {
  const [shops, setShops] = useState<any[]>([]);
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
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchShops = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminShops();
      setShops(data);
    } catch (e: any) {
      showToast(e.message || 'Failed to load shops', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShops();
  }, []);

  const handleOpenCreateModal = () => {
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

  const handleOpenEditModal = (shop: any) => {
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
        // Update existing shop
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
      } else {
        // Register new shop by Admin
        await api.createShop({
          name: formName,
          slug: formSlug || undefined,
          phone: formPhone,
          address: formAddress,
          city: formCity,
          ownerName: formOwnerName || formName,
          ownerEmail: formOwnerEmail || `${(formSlug || formName).toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'shop'}@printx.shop`,
          ownerPassword: formOwnerPassword || 'Shop#1234',
        });
        showToast('New shop registered and activated successfully!', 'success');
      }
      setShowEditModal(false);
      await fetchShops();
    } catch (e: any) {
      showToast(e.message || 'Operation failed', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteShop = async (shop: any) => {
    try {
      await api.deleteShop(shop.id);
      showToast(`Shop "${shop.name}" deleted successfully.`, 'success');
      fetchShops();
    } catch (e: any) {
      showToast(e.message || 'Failed to delete shop.', 'error');
    }
  };

  const handleActivate = async (shopId: string) => {
    try {
      await api.activateShop(shopId, 'activate');
      showToast('Shop approved and activated successfully! Customer orders are live.', 'success');
      fetchShops();
    } catch (e: any) {
      showToast(e.message || 'Failed to activate shop', 'error');
    }
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
              onClick={fetchShops}
              className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 rounded-xl transition cursor-pointer"
              title="Refresh"
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
        {/* Header Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="eyebrow">MASTER NETWORK MANAGEMENT</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-head tracking-tight text-white">
              Registered Shop <span className="grad">Command Center</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Add new retail shops, customize live URLs, activate pending accounts, and manage system-wide print routing.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenCreateModal}
              className="btn btn-primary text-xs font-black shadow-[0_10px_30px_rgba(255,46,99,0.35)]"
            >
              <Plus className="w-4 h-4 stroke-[3]" /> Register New Shop
            </button>
          </div>
        </div>

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
              <p className="text-[11px] text-amber-400/80 mt-1">Awaiting admin review</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xl font-black">
              ⏳
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
          <input
            type="text"
            placeholder="Search shops by name, slug (/shop/slug), owner email or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/80 focus:ring-1 focus:ring-pink-500/50 shadow-inner transition"
          />
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
                    Slug: <span className="text-pink-300 font-bold">/shop/{s.slug}</span>
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
                <p className="flex items-center gap-2">
                  <UserIcon className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <span>
                    Owner: <strong className="text-white">{s.ownerName}</strong> ({s.ownerEmail})
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span>
                    Phone: <strong className="text-white">{s.phone}</strong> | WhatsApp: <strong className="text-white">{s.ownerWhatsApp}</strong>
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{s.address}, {s.city}</span>
                </p>
              </div>

              {/* Action buttons: Edit & Delete */}
              <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                {s.status !== 'active' && (
                  <button
                    onClick={() => handleActivate(s.id)}
                    className="flex-1 py-2 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve & Activate
                  </button>
                )}

                <button
                  onClick={() => handleOpenEditModal(s)}
                  className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5 text-blue-400" /> Edit Shop
                </button>

                <button
                  onClick={() => handleDeleteShop(s)}
                  className="py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Delete Shop Permanently"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Edit / Create Shop Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-[#0d1220] border border-white/15 rounded-3xl max-w-lg w-full p-8 shadow-2xl my-8 text-white relative">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
              <div>
                <h3 className="text-xl font-bold font-head text-white">
                  {editingShop ? `Edit Shop: ${editingShop.name}` : 'Register New Print Shop'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Administrator exclusive master controls.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-white font-bold p-1 cursor-pointer rounded-lg hover:bg-white/5"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveShop} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Shop Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Apex Print & Digital Studio"
                  className="w-full py-2.5 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Custom Slug (URL identifier)</label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="e.g. apex-print"
                  className="w-full py-2.5 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+919812345678"
                    className="w-full py-2.5 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    placeholder="e.g. Noida / Ekma"
                    className="w-full py-2.5 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Full Counter Address</label>
                <input
                  type="text"
                  required
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Shop #12, Market Square"
                  className="w-full py-2.5 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              {editingShop && (
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full py-2.5 px-3 bg-slate-900 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-pink-500"
                  >
                    <option value="active">Active (Live Customer Orders)</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              )}

              <div className="pt-2 border-t border-white/10">
                <p className="text-xs font-bold text-pink-300 mb-3 uppercase tracking-wider font-head">
                  {editingShop ? 'Owner Account Credentials (Optional to Change)' : 'Owner Account Credentials'}
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Owner Name</label>
                    <input
                      type="text"
                      value={formOwnerName}
                      onChange={(e) => setFormOwnerName(e.target.value)}
                      placeholder="Rajesh Sharma"
                      className="w-full py-2 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-pink-500"
                    />
                  </div>
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
                      {editingShop ? 'New Password (Leave blank to keep unchanged)' : 'Initial Password'}
                    </label>
                    <input
                      type="text"
                      value={formOwnerPassword}
                      onChange={(e) => setFormOwnerPassword(e.target.value)}
                      placeholder={editingShop ? 'Leave blank or enter new password' : 'Shop#1234'}
                      className="w-full py-2 px-3 bg-white/5 border border-white/10 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-ghost flex-1 py-3 text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn btn-primary flex-1 py-3 text-sm font-black"
                >
                  {isSaving ? 'Saving...' : editingShop ? 'Update Shop' : 'Register Shop'}
                </button>
              </div>
            </form>
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
