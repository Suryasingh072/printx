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

  const fetchShops = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminShops();
      setShops(data);
    } catch (e: any) {
      alert(e.message);
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
        });
        alert('Shop details updated successfully!');
      } else {
        // Register new shop by Admin
        await api.createShop({
          name: formName,
          slug: formSlug,
          phone: formPhone,
          address: formAddress,
          city: formCity,
          ownerName: formOwnerName,
          ownerEmail: formOwnerEmail,
          ownerPassword: formOwnerPassword || 'Ekma#1234',
        });
        alert('New shop registered and activated successfully!');
      }
      setShowEditModal(false);
      fetchShops();
    } catch (e: any) {
      alert(e.message || 'Operation failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteShop = async (shop: any) => {
    if (!window.confirm(`Are you sure you want to permanently delete shop "${shop.name}"? This removes all printer configurations, queued orders, and records.`)) {
      return;
    }
    try {
      await api.deleteShop(shop.id);
      alert(`Shop "${shop.name}" deleted successfully.`);
      fetchShops();
    } catch (e: any) {
      alert(e.message || 'Failed to delete shop.');
    }
  };

  const handleActivate = async (shopId: string) => {
    try {
      await api.activateShop(shopId, 'activate');
      alert('Shop approved and activated successfully! Customer orders are live.');
      fetchShops();
    } catch (e: any) {
      alert(e.message);
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
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Admin Navbar */}
      <header className="bg-slate-900 text-white sticky top-0 z-40 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-white shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base tracking-tight">print<span className="text-blue-400">x</span> Master Admin</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-slate-400">{user.fullName} ({user.email})</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchShops}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onLogout}
              className="px-3 py-1.5 text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl transition border border-rose-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Registered Shop Master Management</h2>
            <p className="text-xs text-slate-500 mt-1">
              Add new shops, edit all shop configurations, or delete shop accounts. Only Administrator has full control.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Register New Shop
            </button>
            <span className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-xs">
              Total Shops: {shops.length}
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search shops by name, slug, owner email or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
          />
        </div>

        {/* Shops Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredShops.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">{s.name}</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.status === 'pending_review'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {s.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">Slug: /shop/{s.slug}</p>
                </div>

                <a
                  href={`/shop/${s.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                >
                  Visit Portal <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Details */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5 text-slate-600">
                <p className="flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Owner: <strong className="text-slate-800">{s.ownerName}</strong> ({s.ownerEmail})</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Phone: <strong className="text-slate-800">{s.phone}</strong> | WhatsApp: <strong className="text-slate-800">{s.ownerWhatsApp}</strong></span>
                </p>
                <p className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{s.address}, {s.city}</span>
                </p>
              </div>

              {/* Action buttons: Edit & Delete */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                {s.status !== 'active' && (
                  <button
                    onClick={() => handleActivate(s.id)}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve & Activate
                  </button>
                )}

                <button
                  onClick={() => handleOpenEditModal(s)}
                  className="flex-1 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" /> Edit Shop
                </button>

                <button
                  onClick={() => handleDeleteShop(s)}
                  className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {editingShop ? `Edit Shop: ${editingShop.name}` : 'Register New Print Shop'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Administrator exclusive master controls.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveShop} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Shop Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Apex Print & Digital Studio"
                  className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Custom Slug (URL identifier)</label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="e.g. apex-print"
                  className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+919812345678"
                    className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    placeholder="e.g. Noida / Ekma"
                    className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Full Counter Address</label>
                <input
                  type="text"
                  required
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Shop #12, Market Square"
                  className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              {editingShop ? (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="active">Active (Live Customer Orders)</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              ) : (
                <>
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-900 mb-3 uppercase tracking-wider">Owner Account Credentials</p>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Owner Name</label>
                        <input
                          type="text"
                          required
                          value={formOwnerName}
                          onChange={(e) => setFormOwnerName(e.target.value)}
                          placeholder="Rajesh Sharma"
                          className="w-full py-2 px-3 border border-slate-200 rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Owner Email</label>
                        <input
                          type="email"
                          required
                          value={formOwnerEmail}
                          onChange={(e) => setFormOwnerEmail(e.target.value)}
                          placeholder="owner@printshop.in"
                          className="w-full py-2 px-3 border border-slate-200 rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Initial Password</label>
                        <input
                          type="text"
                          value={formOwnerPassword}
                          onChange={(e) => setFormOwnerPassword(e.target.value)}
                          placeholder="Shop#1234"
                          className="w-full py-2 px-3 border border-slate-200 rounded-xl text-sm font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition shadow-xs cursor-pointer"
                >
                  {isSaving ? 'Saving...' : editingShop ? 'Update Shop' : 'Register Shop'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
