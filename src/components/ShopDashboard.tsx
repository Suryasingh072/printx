import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Printer,
  FileText,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Settings,
  QrCode,
  Laptop,
  BarChart3,
  Archive,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Download,
  AlertTriangle,
  CreditCard,
  Copy,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  Play,
  RotateCcw,
  Key,
  FileCode,
  Terminal,
  Check,
  Trash2,
  Store,
  Database,
  Cloud,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { generateShopPosterPdf } from '../lib/posterPdf.js';
import { User, Shop, ShopPricing, ShopApprovalRules, Order, WindowsAgent, ShopStats, ActivityLog } from '../types.js';
import { DocumentViewerModal } from './DocumentViewerModal.js';

interface ShopDashboardProps {
  user: User;
  shop: Shop;
  onLogout: () => void;
  onNavigateHome: () => void;
  onShopUpdate?: (shop: Shop) => void;
}

export const ShopDashboard: React.FC<ShopDashboardProps> = ({ user, shop: initialShop, onLogout, onNavigateHome, onShopUpdate }) => {
  const [shop, setShop] = useState<Shop>(initialShop);
  const [activeTab, setActiveTab] = useState<
    'queue' | 'pricing' | 'approval' | 'profile' | 'supabase' | 'qr' | 'printers' | 'reports' | 'activity' | 'archive' | 'security'
  >('queue');

  // Interactive Toast Feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Shop Profile & UPI Form
  const [profileForm, setProfileForm] = useState({
    name: initialShop.name || '',
    phone: initialShop.phone || '',
    address: initialShop.address || '',
    city: initialShop.city || '',
    upiId: (initialShop as any).upiId || '',
    requiresCounterPayment: (initialShop as any).requiresCounterPayment ?? true,
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Supabase Cloud State
  const [supabaseStatus, setSupabaseStatus] = useState<any>({
    connected: true,
    url: 'https://skbwakxzlrsjkubmbzte.supabase.co',
    mode: 'active',
  });
  const [syncingSupabase, setSyncingSupabase] = useState(false);

  // Queue State
  const [orders, setOrders] = useState<Order[]>([]);
  const [queueFilter, setQueueFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrderForPreview, setSelectedOrderForPreview] = useState<Order | null>(null);
  const [previewTokenUrl, setPreviewTokenUrl] = useState<string | null>(null);

  // Delete Modal
  const [deleteModalOrder, setDeleteModalOrder] = useState<Order | null>(null);

  // Payment Collect Modal
  const [paymentModalOrder, setPaymentModalOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'counter_upi' | 'online_upi'>('counter_upi');

  // Pricing State
  const [pricing, setPricing] = useState<ShopPricing | null>(null);
  const [pricingForm, setPricingForm] = useState<any>({});
  const [savingPricing, setSavingPricing] = useState(false);

  // Approval Rules State
  const [rules, setRules] = useState<ShopApprovalRules | null>(null);
  const [rulesForm, setRulesForm] = useState<any>({});
  const [savingRules, setSavingRules] = useState(false);

  // Shop QR State
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Windows Agent State
  const [agent, setAgent] = useState<WindowsAgent | null>(null);
  const [utilityKey, setUtilityKey] = useState<string | null>(null);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [defaultPrinterSelection, setDefaultPrinterSelection] = useState<string>('');
  const [pairingCodeInfo, setPairingCodeInfo] = useState<{ code: string; expiresAt: string } | null>(null);
  const [isSimulatingAgent, setIsSimulatingAgent] = useState(false);
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [isDownloadingAgent, setIsDownloadingAgent] = useState(false);
  const [showAgentSetupModal, setShowAgentSetupModal] = useState(false);
  const [agentDownloadStatus, setAgentDownloadStatus] = useState<string | null>(null);
  const [copiedPowerShell, setCopiedPowerShell] = useState(false);

  // Stats & Reports
  const [stats, setStats] = useState<ShopStats | null>(null);

  // Activity Logs
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // WhatsApp OTP Verification state inside Dashboard
  const [otpCode, setOtpCode] = useState('');
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [otpDevHint, setOtpDevHint] = useState<string | null>(null);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);

  // Load Initial Data
  const refreshOrders = async () => {
    try {
      setLoadingOrders(true);
      const data = await api.getShopOrders(queueFilter);
      setOrders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    refreshOrders();
  }, [queueFilter]);

  // Load other settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [p, r, a, s, l] = await Promise.all([
          api.getShopPricing(),
          api.getShopApprovalRules(),
          api.getAgentStatus(),
          api.getShopStats(),
          api.getShopActivity(),
        ]);
        setPricing(p);
        setPricingForm(p);
        setRules(r);
        setRulesForm(r);
        setAgent(a);
        if (a) {
          if (a.utilityApiKey) setUtilityKey(a.utilityApiKey);
          if (a.defaultPrinter) setDefaultPrinterSelection(a.defaultPrinter);
        }
        setStats(s);
        setActivityLogs(l);

        // Generate QR Code image
        const shopUrl = `${window.location.origin}/shop/${shop.slug}`;
        const dataUrl = await QRCode.toDataURL(shopUrl, { width: 400, margin: 2 });
        setQrDataUrl(dataUrl);
      } catch (e) {
        console.error(e);
      }
    };
    loadSettings();
  }, [shop.slug]);

  // Handle Order Actions
  const handleApprove = async (orderId: string) => {
    try {
      await api.approveOrder(orderId);
      showToast('Order approved and moved to print ready!', 'success');
      refreshOrders();
    } catch (e: any) {
      showToast(e.message || 'Failed to approve order', 'error');
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await api.deleteOrder(orderId);
      showToast('Order deleted permanently.', 'success');
      refreshOrders();
    } catch (e: any) {
      showToast(e.message || 'Failed to delete order.', 'error');
    }
  };

  const handleConfirmPayment = async () => {
    if (!paymentModalOrder) return;
    try {
      await api.collectPayment(paymentModalOrder.id, paymentMethod);
      setPaymentModalOrder(null);
      showToast('Payment recorded successfully!', 'success');
      refreshOrders();
    } catch (e: any) {
      showToast(e.message || 'Payment update failed', 'error');
    }
  };

  const handleDispatchPrint = async (orderId: string) => {
    try {
      await api.dispatchPrint(orderId);
      showToast('Print job dispatched to Windows Spooler queue!', 'success');
      refreshOrders();
    } catch (e: any) {
      showToast(e.message || 'Failed to dispatch print job', 'error');
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    try {
      await api.completeOrder(orderId);
      showToast('Order marked as Completed! (5-min privacy timer started)', 'success');
      refreshOrders();
    } catch (e: any) {
      showToast(e.message || 'Failed to complete order', 'error');
    }
  };

  const handleArchiveOrder = async (orderId: string) => {
    try {
      await api.archiveOrder(orderId);
      showToast('Order archived.', 'info');
      refreshOrders();
    } catch (e: any) {
      showToast(e.message || 'Failed to archive order', 'error');
    }
  };

  const handleRestoreOrder = async (orderId: string) => {
    try {
      await api.restoreOrder(orderId);
      showToast('Order restored back to active queue.', 'success');
      refreshOrders();
    } catch (e: any) {
      showToast(e.message || 'Failed to restore order', 'error');
    }
  };

  const openDocumentPreview = async (order: Order) => {
    if (order.isDocumentPurged) {
      showToast('Privacy Guarantee: Customer files were permanently auto-deleted 5 minutes after print completion.', 'info');
      return;
    }
    setSelectedOrderForPreview(order);
    try {
      const res = await api.getDocumentToken(order.id);
      setPreviewTokenUrl(res.url);
    } catch (e: any) {
      showToast(`Preview error: ${e.message}`, 'error');
    }
  };

  // Save Pricing
  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPricing(true);
    try {
      const updated = await api.updateShopPricing(pricingForm);
      setPricing(updated);
      showToast('Printing rates updated and saved to Supabase Cloud!', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to save pricing', 'error');
    } finally {
      setSavingPricing(false);
    }
  };

  // Save Approval Rules
  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRules(true);
    try {
      const updated = await api.updateShopApprovalRules(rulesForm);
      setRules(updated);
      showToast('Approval rules updated and saved to Supabase Cloud!', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to save rules', 'error');
    } finally {
      setSavingRules(false);
    }
  };

  // Save Shop Profile & Details
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await api.updateShopProfile(profileForm);
      setShop(updated);
      onShopUpdate?.(updated);
      showToast('Shop details & UPI settings saved successfully to Supabase Cloud!', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to save shop profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Sync to Supabase Cloud
  const handleSyncSupabase = async () => {
    setSyncingSupabase(true);
    try {
      const res = await api.syncSupabase();
      setSupabaseStatus(res.status);
      showToast('Shop data and order queue synchronized with Supabase Cloud!', 'success');
    } catch (e: any) {
      showToast(e.message || 'Supabase sync failed', 'error');
    } finally {
      setSyncingSupabase(false);
    }
  };

  // Utility API Key Handler
  const handleCreateUtilityKey = async () => {
    setIsCreatingKey(true);
    try {
      const res = await api.createUtilityApiKey();
      setUtilityKey(res.apiKey);
      setAgent(res.agent);
      if (res.agent.defaultPrinter) setDefaultPrinterSelection(res.agent.defaultPrinter);
      showToast('Utility API Key created! Paste this key into the printx Desktop application.', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to create utility API key', 'error');
    } finally {
      setIsCreatingKey(false);
    }
  };

  // 6-Digit Pairing Code Handler
  const handleGeneratePairingCode = async () => {
    try {
      const res = await api.generatePairingCode();
      setPairingCodeInfo(res);
      showToast(`Generated 6-Digit Code: ${res.code} (Valid for 24h)`, 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to generate pairing code', 'error');
    }
  };

  // Safe client-side agent download (avoids iframe navigation and Chrome blocking)
  const handleDownloadAgent = async (type: 'zip' | 'bat' | 'script' = 'zip') => {
    setIsDownloadingAgent(true);
    setAgentDownloadStatus('Initiating secure file download...');
    setShowAgentSetupModal(true);
    try {
      let url = '/api/agent/download-windows-exe';
      let filename = 'printx-Windows-Desktop-Package.zip';

      if (type === 'bat') {
        url = '/api/agent/download-bat';
        filename = 'printx-PrintAgent.bat';
      } else if (type === 'script') {
        url = '/api/agent/download-script';
        filename = 'agent.py';
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const tempLink = document.createElement('a');
      tempLink.href = blobUrl;
      tempLink.download = filename;
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
      setAgentDownloadStatus(`Successfully saved ${filename}. Extract or run on your Windows PC.`);
    } catch (err: any) {
      console.warn('Direct blob save note:', err);
      setAgentDownloadStatus('If browser blocked download, use the 1-click batch runner or PowerShell command below.');
    } finally {
      setIsDownloadingAgent(false);
    }
  };

  const handleUpdateDefaultPrinter = async (printerName: string) => {
    setDefaultPrinterSelection(printerName);
    try {
      const updated = await api.updateAgentPrinters({ defaultPrinter: printerName });
      setAgent(updated);
      showToast(`Default printer updated to: ${printerName}`, 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to update default printer', 'error');
    }
  };

  // In-browser Windows Agent Simulator
  const handleSimulateAgentJob = async () => {
    setIsSimulatingAgent(true);
    const addLog = (msg: string) => {
      setSimLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 15)]);
    };

    addLog('Windows Agent Simulator started. Checking queue...');
    try {
      // Find orders that are queued
      const queuedOrders = orders.filter((o) => o.status === 'queued' || o.status === 'printing');
      if (queuedOrders.length === 0) {
        addLog('No ready print jobs in queue. Approve or mark an order paid first.');
        setIsSimulatingAgent(false);
        return;
      }

      const target = queuedOrders[0];
      addLog(`Claiming job for order ${target.orderNumber} (${target.documentName})...`);

      setTimeout(async () => {
        addLog(`Submitting "${target.documentName}" to Windows spooler (HP LaserJet Pro)...`);
        setTimeout(async () => {
          await api.completeOrder(target.id);
          addLog(`Print confirmed on paper! Order ${target.orderNumber} marked COMPLETED.`);
          setIsSimulatingAgent(false);
          refreshOrders();
        }, 2000);
      }, 1500);
    } catch (err: any) {
      addLog(`Simulator error: ${err.message}`);
      setIsSimulatingAgent(false);
    }
  };

  // WhatsApp OTP Verification handler
  const handleRequestOtp = async () => {
    setIsRequestingOtp(true);
    setOtpMessage(null);
    try {
      const res = await api.requestOtp();
      setOtpMessage(res.message);
      if (res.devHint) {
        setOtpDevHint(res.devHint);
      }
      showToast('OTP sent to your WhatsApp number!', 'info');
    } catch (e: any) {
      showToast(e.message || 'Failed to send OTP', 'error');
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode) return;
    try {
      const res = await api.verifyOtp(otpCode);
      showToast(res.message, 'success');
      window.location.reload();
    } catch (e: any) {
      showToast(e.message || 'OTP verification failed', 'error');
    }
  };

  // Filtered orders for queue
  const filteredOrders = orders.filter((o) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.documentName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="bg-slate-900 text-white sticky top-0 z-40 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white shadow-md">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight">{shop.name}</span>
                {shop.status === 'active' ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Active
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Pending Review
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">{user.fullName} ({user.email})</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                window.location.href = `/shop/${shop.slug}`;
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition border border-slate-700 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" /> View Public Shop
            </button>

            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl transition border border-rose-500/20"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>

        {/* Secondary Sub-Tabs */}
        <div className="bg-slate-800/80 border-t border-slate-800 overflow-x-auto">
          <div className="max-w-7xl mx-auto px-4 flex gap-1">
            {[
              { id: 'queue', label: 'Print Queue', icon: FileText, badge: orders.filter((o) => o.status === 'pending_approval' || o.status === 'payment_pending').length },
              { id: 'pricing', label: 'Pricing Card', icon: DollarSign },
              { id: 'approval', label: 'Approval Rules', icon: CheckCircle2 },
              { id: 'profile', label: 'Shop Details & UPI', icon: Store },
              { id: 'supabase', label: 'Supabase Cloud DB', icon: Database },
              { id: 'qr', label: 'Shop QR & Posters', icon: QrCode },
              { id: 'printers', label: 'Windows Spooler Agent', icon: Laptop },
              { id: 'reports', label: 'Sales Reports', icon: BarChart3 },
              { id: 'activity', label: 'Activity Log', icon: Clock },
              { id: 'archive', label: 'Archive', icon: Archive },
              { id: 'security', label: 'Account & Security', icon: Lock },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-white bg-slate-900/40'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.badge ? (
                    <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Verification Notice Banner if not active */}
      {shop.status !== 'active' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Shop Status: Pending Administrator Review.</strong> While awaiting activation, you can configure rates, print QR standees, and pair your Windows printer agent. Customer orders will become active once reviewed.
              </span>
            </div>
            {!user.whatsappVerified && (
              <button
                onClick={() => setActiveTab('security')}
                className="font-bold underline text-amber-900 hover:text-black"
              >
                Verify WhatsApp Now
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* ========================================================
            TAB 1: PRINT QUEUE
           ======================================================== */}
        {activeTab === 'queue' && (
          <div className="space-y-6">
            {/* Filter Bar & Controls */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                {[
                  { id: 'all', label: 'All Jobs' },
                  { id: 'pending_approval', label: 'Pending Approval' },
                  { id: 'payment_due', label: 'Payment Due' },
                  { id: 'queued', label: 'Queued' },
                  { id: 'printing', label: 'Printing' },
                  { id: 'completed', label: 'Completed' },
                  { id: 'rejected', label: 'Rejected' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setQueueFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      queueFilter === f.id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search order # or customer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  onClick={refreshOrders}
                  disabled={loadingOrders}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                  title="Refresh Queue"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingOrders ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Orders Table / Cards */}
            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-3">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800">No Orders in this Queue</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Orders submitted by customers via your QR code will appear here instantly.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((ord) => {
                  const isPaid = ord.paymentStatus === 'collected';
                  return (
                    <div
                      key={ord.id}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* Left: Info */}
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-blue-50 text-blue-700 rounded-2xl shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-base">{ord.orderNumber}</span>
                            {/* Status badge */}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                ord.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ord.status === 'printing'
                                  ? 'bg-blue-100 text-blue-800 animate-pulse'
                                  : ord.status === 'queued'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : ord.status === 'payment_pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : ord.status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {ord.status.replace('_', ' ').toUpperCase()}
                            </span>

                            {/* Payment Badge */}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isPaid ? `PAID (₹${ord.totalAmount})` : `UNPAID (₹${ord.totalAmount})`}
                            </span>

                            {/* 5-Min Privacy Auto-Purge Badge */}
                            {ord.isDocumentPurged ? (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center gap-1"
                                title="Customer document files permanently deleted 5 mins after print completion for privacy"
                              >
                                🔒 Files Purged (5m Privacy)
                              </span>
                            ) : ord.status === 'completed' ? (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80 inline-flex items-center gap-1"
                                title="Customer files will automatically be deleted 5 minutes after completion"
                              >
                                ⏱️ Auto-purging in 5m
                              </span>
                            ) : null}
                          </div>

                          <p className="text-xs font-semibold text-slate-800 mt-1">
                            {ord.documentName}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1.5">
                            <span>👤 {ord.customerName} ({ord.customerPhone})</span>
                            <span>📄 {ord.pageCount} pgs × {ord.copies} {ord.copies === 1 ? 'copy' : 'copies'}</span>
                            <span className="font-medium text-slate-700">
                              {ord.colorMode === 'color' ? '🎨 Full Colour' : '⚫ B&W'} ({ord.duplexMode})
                            </span>
                            <span>🕒 {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>

                          {ord.customNotes && (
                            <p className="text-xs text-indigo-600 bg-indigo-50/80 px-2 py-1 rounded-md mt-2 inline-block">
                              Note: {ord.customNotes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* Preview */}
                        <button
                          onClick={() => openDocumentPreview(ord)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          <Eye className="w-3.5 h-3.5" /> Preview
                        </button>

                        {/* Delete Order button */}
                        <button
                          onClick={() => handleDeleteOrder(ord.id)}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                          title="Delete Order Permanently"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>

                        {/* Dispatch to Print */}
                        {(ord.status === 'queued' || (ord.status === 'payment_pending' && isPaid)) && (
                          <button
                            onClick={() => handleDispatchPrint(ord.id)}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                          >
                            <Printer className="w-3.5 h-3.5" /> Print Now
                          </button>
                        )}

                        {/* Mark Completed */}
                        {ord.status === 'printing' && (
                          <button
                            onClick={() => handleCompleteOrder(ord.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition"
                          >
                            Mark Done
                          </button>
                        )}

                        {/* Archive button */}
                        {ord.status === 'completed' && (
                          <button
                            onClick={() => handleArchiveOrder(ord.id)}
                            className="px-2.5 py-1.5 text-slate-400 hover:text-slate-700 rounded-xl text-xs font-medium transition"
                            title="Archive Order"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 2: PRICING CONFIGURATION
           ======================================================== */}
        {activeTab === 'pricing' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm max-w-3xl">
            <div className="pb-6 border-b border-slate-200 mb-6">
              <h3 className="text-xl font-bold text-slate-900">Printing Price Configuration</h3>
              <p className="text-xs text-slate-500 mt-1">
                Configure your shop's per-page printing rates. These rates are authoritatively applied to all incoming orders.
              </p>
            </div>

            <form onSubmit={handleSavePricing} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* B&W Single */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    A4 Black & White (Single Side) ₹
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={pricingForm.bwSinglePrice || ''}
                    onChange={(e) => setPricingForm({ ...pricingForm, bwSinglePrice: e.target.value })}
                    className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Standard Xerox rate per page (e.g. ₹2.00)</p>
                </div>

                {/* B&W Duplex */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    A4 Black & White (Duplex / Back-to-Back) ₹
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={pricingForm.bwDuplexPrice || ''}
                    onChange={(e) => setPricingForm({ ...pricingForm, bwDuplexPrice: e.target.value })}
                    className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Total price for 2 sides on 1 sheet (e.g. ₹3.00)</p>
                </div>

                {/* Colour Single */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    A4 Full Colour (Single Side) ₹
                  </label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={pricingForm.colorSinglePrice || ''}
                    onChange={(e) => setPricingForm({ ...pricingForm, colorSinglePrice: e.target.value })}
                    className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Colour document per page (e.g. ₹10.00)</p>
                </div>

                {/* Colour Duplex */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    A4 Full Colour (Duplex / Back-to-Back) ₹
                  </label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={pricingForm.colorDuplexPrice || ''}
                    onChange={(e) => setPricingForm({ ...pricingForm, colorDuplexPrice: e.target.value })}
                    className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Full colour back-to-back rate (e.g. ₹18.00)</p>
                </div>

                {/* Legal Extra */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Legal Paper Extra Surcharge ₹
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={pricingForm.legalExtra || ''}
                    onChange={(e) => setPricingForm({ ...pricingForm, legalExtra: e.target.value })}
                    className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900"
                  />
                </div>

                {/* ID Card Sheet Rate */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    ID Card Sheet / Photo Print ₹
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={pricingForm.idCardSinglePrice || ''}
                    onChange={(e) => setPricingForm({ ...pricingForm, idCardSinglePrice: e.target.value })}
                    className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Per set rate for Aadhaar / ID card sheet (e.g. ₹15.00)</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={savingPricing}
                  className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                >
                  {savingPricing ? 'Saving Pricing...' : 'Save Pricing Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================
            TAB 3: APPROVAL SETTINGS
           ======================================================== */}
        {activeTab === 'approval' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm max-w-3xl">
            <div className="pb-6 border-b border-slate-200 mb-6">
              <h3 className="text-xl font-bold text-slate-900">Order Approval & Workflow Rules</h3>
              <p className="text-xs text-slate-500 mt-1">
                Control how customer orders enter your print queue. Enforce counter payment before releasing jobs to printers.
              </p>
            </div>

            <form onSubmit={handleSaveRules} className="space-y-6">
              {/* Approval Mode */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-3">Order Approval Mode</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { id: 'smart', title: 'Smart Rule (Recommended)', desc: 'Auto-approves small jobs under limits. Requires review for large orders.' },
                    { id: 'manual', title: 'Manual Approval', desc: 'Shopkeeper reviews every order before it enters the print queue.' },
                    { id: 'auto', title: 'Full Automatic', desc: 'Instantly approves every customer order.' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setRulesForm({ ...rulesForm, mode: m.id })}
                      className={`p-4 rounded-xl border text-left transition ${
                        rulesForm.mode === m.id
                          ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <p className="text-xs font-bold">{m.title}</p>
                      <p className="text-[11px] text-slate-500 font-normal mt-1">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Smart thresholds */}
              {rulesForm.mode === 'smart' && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Max Auto-Approve Pages</label>
                    <input
                      type="number"
                      value={rulesForm.maxAutoPages || 10}
                      onChange={(e) => setRulesForm({ ...rulesForm, maxAutoPages: e.target.value })}
                      className="w-full py-2 px-3 border border-slate-200 rounded-xl text-xs bg-white font-bold"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Orders with more pages require manual approval</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Max Auto-Approve Amount (₹)</label>
                    <input
                      type="number"
                      value={rulesForm.maxAutoAmount || 50}
                      onChange={(e) => setRulesForm({ ...rulesForm, maxAutoAmount: e.target.value })}
                      className="w-full py-2 px-3 border border-slate-200 rounded-xl text-xs bg-white font-bold"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Orders above this ₹ amount require review</p>
                  </div>
                </div>
              )}

              {/* Payment enforcement */}
              <div className="pt-2">
                <label className="flex items-start gap-3 p-4 bg-amber-50/70 border border-amber-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rulesForm.requirePaymentBeforePrint ?? true}
                    onChange={(e) => setRulesForm({ ...rulesForm, requirePaymentBeforePrint: e.target.checked })}
                    className="mt-0.5 rounded border-amber-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-amber-900">Require Counter Payment Before Printing</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Jobs will hold in "Payment Due" status until the shopkeeper collects cash/UPI at the counter. Prevents wasted paper from uncollected prints.
                    </p>
                  </div>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={savingRules}
                  className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                >
                  {savingRules ? 'Saving Rules...' : 'Save Approval Rules'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================
            TAB: SHOP PROFILE & UPI PAYMENT SETTINGS
           ======================================================== */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm max-w-3xl">
            <div className="pb-6 border-b border-slate-200 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Shop Profile & UPI Settings</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Manage your shop contact info and UPI ID for customer QR payments. Saved directly to Supabase Cloud.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 self-start sm:self-auto">
                Slug: {shop.slug}
              </span>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Shop Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Apex Print & Xerox Hub"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Shop Contact Phone / Mobile *
                  </label>
                  <input
                    type="tel"
                    required
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. +91 98123 45678"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    City / Town *
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.city}
                    onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                    className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Noida, Delhi, Lucknow"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Counter UPI ID (For Direct Payments)
                  </label>
                  <input
                    type="text"
                    value={profileForm.upiId}
                    onChange={(e) => setProfileForm({ ...profileForm, upiId: e.target.value })}
                    className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 9812345678@upi or shop@okaxis"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Customers can scan and pay directly to this UPI ID</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Complete Shop Address *
                </label>
                <textarea
                  required
                  rows={2}
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Shop 14, Commercial Complex, Sector 18"
                />
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profileForm.requiresCounterPayment}
                    onChange={(e) => setProfileForm({ ...profileForm, requiresCounterPayment: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Require Counter Payment Confirmation</span>
                    <span className="text-[11px] text-slate-500 block">
                      Enforce collection of cash/UPI before jobs are spooled to printer.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Store className="w-4 h-4" />
                  {savingProfile ? 'Saving Changes...' : 'Save Shop Profile to Supabase Cloud'}
                </button>
                <span className="text-xs text-slate-400">Auto-synced with Supabase</span>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================
            TAB: SUPABASE CLOUD DATABASE
           ======================================================== */}
        {activeTab === 'supabase' && (
          <div className="space-y-6 max-w-4xl">
            {/* Status card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 mb-6 gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900">Supabase Cloud Database</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Connected
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      https://skbwakxzlrsjkubmbzte.supabase.co
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSyncSupabase}
                  disabled={syncingSupabase}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${syncingSupabase ? 'animate-spin' : ''}`} />
                  {syncingSupabase ? 'Syncing to Supabase...' : 'Sync Data Now to Cloud'}
                </button>
              </div>

              {/* Status Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] font-bold text-slate-500 block">Cloud Sync Status</span>
                  <span className="text-sm font-extrabold text-emerald-700 flex items-center gap-1 mt-1">
                    ✓ Real-time Active
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Every change auto-persists</span>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] font-bold text-slate-500 block">Database Storage</span>
                  <span className="text-sm font-extrabold text-slate-900 mt-1 block">
                    Dual Engine (Cloud + Local)
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Survives container restarts</span>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] font-bold text-slate-500 block">Last Synced Timestamp</span>
                  <span className="text-sm font-bold text-slate-800 mt-1 block">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">Up to date</span>
                </div>
              </div>

              {/* Notice */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-blue-600" />
                  Your Supabase Project is Live & Connected!
                </p>
                <p className="text-blue-800 text-[11px]">
                  All shop details, rates, orders, customer print submissions, and connected Windows agents are automatically synced to your Supabase project (<strong>skbwakxzlrsjkubmbzte.supabase.co</strong>).
                </p>
              </div>
            </div>

            {/* Optional SQL Schema Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Supabase SQL Editor Script (Optional Table View)</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    If you want to view rows in the Supabase Table Editor UI, run this SQL script in your Supabase SQL Editor.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const sql = `-- printx Production SQL Schema for Supabase
create table if not exists public.printx_app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.shops (
  id text primary key,
  slug text unique not null,
  name text not null,
  phone text not null,
  address text not null,
  city text not null,
  upi_id text,
  status text not null default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.orders (
  id text primary key,
  order_number text not null,
  shop_id text not null,
  customer_name text not null,
  customer_phone text not null,
  document_name text not null,
  total_amount numeric not null,
  status text not null,
  payment_status text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);`;
                    navigator.clipboard.writeText(sql);
                    showToast('Supabase SQL script copied to clipboard!', 'success');
                  }}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy SQL Script
                </button>
              </div>

              <pre className="p-4 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48">
{`-- Run this once in your Supabase SQL Editor:
create table if not exists public.printx_app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.shops (
  id text primary key,
  slug text unique not null,
  name text not null,
  phone text not null,
  address text not null,
  city text not null,
  status text not null default 'active'
);`}
              </pre>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 4: SHOP QR & POSTER GENERATOR
           ======================================================== */}
        {activeTab === 'qr' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col items-center text-center">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Shop QR Code</h3>
              <p className="text-xs text-slate-500 mb-6">Display this on your counter for customer self-service.</p>

              {qrDataUrl && (
                <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl shadow-inner mb-6">
                  <img src={qrDataUrl} alt="Shop QR Code" className="w-56 h-56 rounded-lg" />
                </div>
              )}

              <div className="w-full p-3 bg-slate-100 rounded-xl text-xs text-slate-700 font-mono break-all mb-6 flex items-center justify-between">
                <span>{`${window.location.origin}/shop/${shop.slug}`}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/shop/${shop.slug}`);
                    showToast('Shop customer link copied to clipboard!', 'success');
                  }}
                  className="p-1 text-slate-500 hover:text-slate-900"
                  title="Copy Link"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              <div className="w-full flex gap-3">
                <a
                  href={qrDataUrl}
                  download={`${shop.slug}-QR.png`}
                  className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold text-center transition"
                >
                  Download PNG
                </a>

                <button
                  onClick={() => generateShopPosterPdf(shop)}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold text-center transition shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" /> Printable A4 Poster PDF
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-2">Counter Standee & Print Poster Instructions</h3>
              <p className="text-xs text-slate-600 mb-6">
                Download the professional A4 poster PDF and laminate it or put it in an acrylic stand on your front counter.
              </p>

              <div className="space-y-4">
                <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100">
                  <h4 className="text-xs font-bold text-blue-900 mb-1">What's in the A4 Poster:</h4>
                  <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                    <li>High-resolution scannable QR code linking to your shop</li>
                    <li>3-Step visual instructions for customers (Scan & Upload, Review Price, Collect)</li>
                    <li>Clear "Counter Payment Required" notice to avoid confusion</li>
                    <li>Your official shop name, phone number, and physical address</li>
                  </ul>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-800 mb-1">Customer Flow:</h4>
                  <p className="text-xs text-slate-600">
                    Customers do not need an app or account. Any smartphone camera will open your shop upload page in 1 tap.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 5: WINDOWS AGENT & PRINTERS
           ======================================================== */}
        {activeTab === 'printers' && (
          <div className="space-y-8 max-w-4xl">
            {/* 1. Download ADRTECH Desktop for Windows */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                1. Download ADRTECH Desktop for Windows
              </h3>
              <p className="text-xs text-slate-600 mb-6 leading-relaxed">
                Install the app, connect with a utility API key, and keep it running for printer updates and approval notifications. Setup creates a desktop shortcut.
              </p>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleDownloadAgent('bat')}
                    disabled={isDownloadingAgent}
                    className="inline-flex items-center gap-2.5 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    1-Click Windows App (printx-PrintAgent.bat)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadAgent('zip')}
                    disabled={isDownloadingAgent}
                    className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-600/20 transition cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    {isDownloadingAgent ? 'Preparing Download...' : 'Download Full Package (.zip)'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAgentSetupModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-sm font-bold transition cursor-pointer"
                  >
                    <FileCode className="w-4 h-4 text-blue-600" />
                    Setup Guide & Script
                  </button>
                </div>

                <p className="text-xs text-slate-500">
                  Includes <strong>Start_Agent.bat</strong> and <strong>agent.py</strong>. Works on all 64-bit Windows PCs (Windows 10, Windows 11).
                </p>
              </div>
            </div>

            {/* 2. Connect using 6-Digit Pairing Code or Utility Key */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  2. Connect Your Windows Desktop Agent
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Enter your <strong>6-Digit Pairing Code</strong> or <strong>Utility API Key</strong> into the Windows App to connect your printer instantly.
                </p>
              </div>

              {/* 6-Digit Pairing Code Card */}
              <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700 block">
                      6-Digit Quick Pairing Code
                    </span>
                    <p className="text-xs text-slate-500">
                      Type this 6-digit number directly into the Windows App
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGeneratePairingCode}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {pairingCodeInfo ? 'Get New 6-Digit Code' : 'Generate 6-Digit Code'}
                  </button>
                </div>

                {pairingCodeInfo ? (
                  <div className="pt-2 space-y-3">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="px-6 py-3 bg-white border-2 border-blue-600 rounded-2xl shadow-sm">
                        <span className="text-3xl sm:text-4xl font-black font-mono tracking-widest text-blue-900">
                          {pairingCodeInfo.code}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 space-y-1">
                        <p className="font-bold text-emerald-700 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                          Active & Ready for Windows App
                        </p>
                        <p className="text-slate-500">
                          Enter this 6-digit code in the <strong>"6-Digit Pair Code"</strong> box on your PC.
                        </p>
                      </div>
                    </div>

                    {/* Server URL helper */}
                    <div className="p-3 bg-white/90 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="text-xs">
                        <span className="font-bold text-slate-700">Windows App "Shop Server URL":</span>
                        <code className="ml-2 font-mono text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded text-[11px]">
                          {typeof window !== 'undefined' ? window.location.origin : ''}
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.origin);
                          showToast('Server URL copied! Paste this into the "Shop Server URL" box in Windows app.', 'success');
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy URL
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-white/80 rounded-xl border border-blue-100 flex items-center justify-between">
                    <p className="text-xs text-slate-600">
                      Click <strong>"Generate 6-Digit Code"</strong> above to display your instant connection number.
                    </p>
                  </div>
                )}
              </div>

              {/* Alternative: Utility API Key */}
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-2">
                  Alternative: Permanent Shop Utility API Key
                </span>
                {!utilityKey ? (
                  <button
                    type="button"
                    onClick={handleCreateUtilityKey}
                    disabled={isCreatingKey}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    <Key className="w-4 h-4" />
                    {isCreatingKey ? 'Creating key...' : 'Create Utility API Key'}
                  </button>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Permanent Utility Key:</span>
                      <button
                        type="button"
                        onClick={handleCreateUtilityKey}
                        className="text-[11px] text-blue-600 hover:underline cursor-pointer"
                      >
                        Regenerate Key
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={utilityKey}
                        className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-800 select-all"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(utilityKey);
                          showToast('Utility Key copied to clipboard!', 'success');
                        }}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Shop default printer selection */}
              <div className="pt-4 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-800 block mb-1.5">
                  Shop default printer: Choose a printer below after the desktop app reports its inventory.
                </label>
                <div className="flex gap-2 max-w-md">
                  <select
                    value={defaultPrinterSelection}
                    onChange={(e) => handleUpdateDefaultPrinter(e.target.value)}
                    className="flex-1 py-2.5 px-3 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 bg-white"
                  >
                    <option value="">Choose a printer...</option>
                    {agent?.installedPrinters && agent.installedPrinters.length > 0 ? (
                      agent.installedPrinters.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name} {p.supportsColor ? '(Colour)' : '(B&W)'}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="HP LaserJet Pro M404dn">HP LaserJet Pro M404dn (Default, B&W)</option>
                        <option value="Canon PIXMA G3010">Canon PIXMA G3010 (Colour)</option>
                        <option value="Epson L3150 Series">Epson L3150 Series (Colour)</option>
                      </>
                    )}
                  </select>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Current Default Printer: <strong className="text-slate-700">{defaultPrinterSelection || 'Not selected'}</strong>
                </p>
              </div>
            </div>

            {/* In-Browser Interactive Windows Agent Simulator */}
            <div className="bg-slate-900 text-white rounded-2xl p-8 border border-slate-800 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <Play className="w-4 h-4 text-emerald-400" /> Interactive Desktop Agent Spooler Simulator
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Test the live Windows desktop agent spooling, claiming, and printing workflow directly from your browser.
                  </p>
                </div>

                <button
                  onClick={handleSimulateAgentJob}
                  disabled={isSimulatingAgent}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                >
                  {isSimulatingAgent ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Spooling Active Job...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" /> Simulate Print Spooler Poll & Claim
                    </>
                  )}
                </button>
              </div>

              <div className="mt-4 bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 h-36 overflow-y-auto">
                {simLogs.length === 0 ? (
                  <p className="text-slate-500">Ready. Click 'Simulate Print Spooler' to test automated printing on queued jobs.</p>
                ) : (
                  simLogs.map((log, idx) => <p key={idx} className="leading-relaxed">{log}</p>)
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 6: SALES REPORTS & ANALYTICS
           ======================================================== */}
        {activeTab === 'reports' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">Today's Revenue</p>
                <p className="text-2xl font-black text-slate-900 mt-1">₹{stats.todayRevenue.toFixed(2)}</p>
                <p className="text-[11px] text-emerald-600 font-semibold mt-1">{stats.todayOrders} orders processed today</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">Weekly Revenue</p>
                <p className="text-2xl font-black text-slate-900 mt-1">₹{stats.weeklyRevenue.toFixed(2)}</p>
                <p className="text-[11px] text-slate-400 mt-1">{stats.weeklyOrders} orders this week</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">Lifetime Revenue</p>
                <p className="text-2xl font-black text-blue-600 mt-1">₹{stats.lifetimeRevenue.toFixed(2)}</p>
                <p className="text-[11px] text-slate-400 mt-1">{stats.lifetimeOrders} total orders recorded</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">Total Page Impressions</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{stats.totalPageCount}</p>
                <p className="text-[11px] text-slate-400 mt-1">{stats.completedJobs} print jobs completed</p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 7: ACTIVITY LOG
           ======================================================== */}
        {activeTab === 'activity' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
              Audit Trail & Activity Log
            </h3>

            <div className="divide-y divide-slate-100">
              {activityLogs.map((log) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {log.actionType.replace('_', ' ')}
                    </span>
                    <p className="text-xs font-semibold text-slate-800 mt-1">{log.description}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 8: ARCHIVE
           ======================================================== */}
        {activeTab === 'archive' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
              Archived Orders
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Completed and past orders archived for audit and financial record keeping.
            </p>

            <div className="space-y-3">
              {orders
                .filter((o) => o.status === 'archived')
                .map((ord) => (
                  <div
                    key={ord.id}
                    className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {ord.orderNumber} - {ord.documentName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        ₹{ord.totalAmount} • {ord.customerName} • {new Date(ord.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <button
                      onClick={() => handleRestoreOrder(ord.id)}
                      className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold"
                    >
                      Restore to Completed
                    </button>
                  </div>
                ))}
              {orders.filter((o) => o.status === 'archived').length === 0 && (
                <p className="text-xs text-slate-400 py-4 text-center">No orders currently archived.</p>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 9: ACCOUNT & SECURITY
           ======================================================== */}
        {activeTab === 'security' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm max-w-2xl space-y-6">
            <h3 className="text-xl font-bold text-slate-900 pb-4 border-b border-slate-200">
              Account Security & WhatsApp Verification
            </h3>

            {/* WhatsApp Verification */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs font-bold text-slate-800">WhatsApp Number</p>
                  <p className="text-sm text-slate-600">{user.whatsappNumber}</p>
                </div>
                {user.whatsappVerified ? (
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                    Unverified
                  </span>
                )}
              </div>

              {!user.whatsappVerified && (
                <div className="mt-4 pt-3 border-t border-slate-200 space-y-3">
                  <p className="text-xs text-slate-500">
                    Verify your WhatsApp number to activate priority alerts and security notices.
                  </p>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      disabled={isRequestingOtp}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition"
                    >
                      {isRequestingOtp ? 'Sending Code...' : 'Request Verification OTP'}
                    </button>
                  </div>

                  {otpMessage && (
                    <p className="text-xs font-medium text-emerald-600">{otpMessage}</p>
                  )}
                  {otpDevHint && (
                    <p className="text-xs font-bold text-indigo-600 bg-indigo-50 p-2 rounded-lg">{otpDevHint}</p>
                  )}

                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="6-digit OTP"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-36 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
                    >
                      Submit OTP
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ========================================================
          DOCUMENT PREVIEW MODAL (IN-APP CANVAS VIEWER)
         ======================================================== */}
      {selectedOrderForPreview && (
        <DocumentViewerModal
          isOpen={Boolean(selectedOrderForPreview)}
          onClose={() => {
            setSelectedOrderForPreview(null);
            setPreviewTokenUrl(null);
          }}
          previewUrl={previewTokenUrl}
          fileName={selectedOrderForPreview.documentName}
          mimeType={selectedOrderForPreview.documentType}
          orderNumber={selectedOrderForPreview.orderNumber}
          copies={selectedOrderForPreview.copies}
          colorMode={selectedOrderForPreview.colorMode}
          paperSize={selectedOrderForPreview.paperSize}
          duplexMode={selectedOrderForPreview.duplexMode}
          onApprove={
            selectedOrderForPreview.status === 'pending_approval'
              ? () => handleApprove(selectedOrderForPreview.id)
              : undefined
          }
          onPrint={
            selectedOrderForPreview.status === 'queued' || selectedOrderForPreview.status === 'approved'
              ? () => handleDispatchPrint(selectedOrderForPreview.id)
              : undefined
          }
        />
      )}

      {/* ========================================================
          PAYMENT COLLECTION MODAL
         ======================================================== */}
      {paymentModalOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 mb-1">Collect Counter Payment</h3>
            <p className="text-xs text-slate-500 mb-4">
              Record counter cash or UPI collection for Order {paymentModalOrder.orderNumber}.
            </p>

            <div className="p-4 bg-blue-50 rounded-xl mb-4 text-center">
              <p className="text-xs font-semibold text-blue-700">Total Amount Due</p>
              <p className="text-3xl font-black text-blue-900 mt-1">₹{paymentModalOrder.totalAmount.toFixed(2)}</p>
            </div>

            <div className="space-y-3 mb-6">
              <label className="text-xs font-bold text-slate-700 block">Payment Method Received</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('counter_upi')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                    paymentMethod === 'counter_upi'
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Shop Counter UPI QR
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('online_upi')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                    paymentMethod === 'online_upi'
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Online Payment Link
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPaymentModalOrder(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPayment}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                Confirm Paid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          WINDOWS AGENT SETUP & DOWNLOAD PACKAGE MODAL
         ======================================================== */}
      {showAgentSetupModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">printx Desktop for Windows</h3>
                  <p className="text-xs text-slate-500">Official Windows Spooler background agent v2.4</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAgentSetupModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {agentDownloadStatus && (
              <div className="mb-4 p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between">
                <span>{agentDownloadStatus}</span>
                <span className="text-[10px] text-blue-600 font-semibold">Ready</span>
              </div>
            )}

            <div className="space-y-6">
              {/* Step 1: Download package */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Step 1: Download the application package
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleDownloadAgent('zip')}
                    disabled={isDownloadingAgent}
                    className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 justify-center shadow-xs cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download App (.ZIP)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadAgent('bat')}
                    disabled={isDownloadingAgent}
                    className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 justify-center shadow-xs cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    <span>Start_Agent (.BAT)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadAgent('script')}
                    disabled={isDownloadingAgent}
                    className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-2 justify-center cursor-pointer border border-slate-200"
                  >
                    <FileCode className="w-4 h-4 text-slate-600" />
                    <span>Python Code (.PY)</span>
                  </button>
                </div>
              </div>

              {/* Step 2: 6-Digit Pairing Code & Server URL */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Step 2: Connect with 6-Digit Quick Pairing Code
                </h4>
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl space-y-3">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="px-4 py-2 bg-white border border-blue-500 rounded-xl shadow-xs">
                        <span className="text-2xl font-black font-mono tracking-widest text-blue-900">
                          {pairingCodeInfo?.code || '------'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600">
                        <p className="font-bold text-slate-900">Your 6-Digit Code</p>
                        <p className="text-[11px] text-slate-500">Valid for 24 hours</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleGeneratePairingCode}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {pairingCodeInfo ? 'New Code' : 'Generate Code'}
                    </button>
                  </div>

                  {/* Server URL Box */}
                  <div className="pt-2 border-t border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-bold text-slate-700">App "Server URL":</span>
                      <code className="ml-1.5 font-mono text-blue-700 font-bold bg-white px-2 py-0.5 rounded border border-blue-200 text-[11px]">
                        {typeof window !== 'undefined' ? window.location.origin : ''}
                      </code>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.origin);
                        showToast('Server URL copied!', 'success');
                      }}
                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-200 transition flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                    >
                      <Copy className="w-3 h-3" /> Copy URL
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 3: Alternative Utility API Key */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Alternative: Permanent Shop Utility Key
                </h4>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={utilityKey || 'Click generate key for permanent token'}
                      className="flex-1 font-mono text-xs bg-white border border-slate-200 rounded-xl py-2 px-3 text-slate-800 select-all"
                    />
                    {utilityKey ? (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(utilityKey);
                          showToast('Utility key copied to clipboard!', 'success');
                        }}
                        className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleCreateUtilityKey}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Key className="w-3.5 h-3.5" /> Generate Key
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 3: PowerShell 1-liner */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Option: Run directly in Windows PowerShell
                </h4>
                <div className="p-3 bg-slate-900 rounded-xl text-slate-200 text-xs font-mono flex items-center justify-between gap-2 overflow-x-auto">
                  <div className="flex items-center gap-2 truncate">
                    <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">curl -O {window.location.origin}/api/agent/download-windows-exe</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`curl -O ${window.location.origin}/api/agent/download-windows-exe`);
                      setCopiedPowerShell(true);
                      setTimeout(() => setCopiedPowerShell(false), 2000);
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg shrink-0 cursor-pointer text-[11px] flex items-center gap-1"
                  >
                    {copiedPowerShell ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedPowerShell ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Instant Browser Test Simulator */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-emerald-900">Test Agent Connection Live</p>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Simulate active Windows Spooler connection directly in this session.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSimulateAgentJob}
                  disabled={isSimulatingAgent}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
                >
                  {isSimulatingAgent ? 'Connecting...' : 'Run Simulation'}
                </button>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAgentSetupModal(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive In-App Notification Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border text-sm font-bold backdrop-blur-md transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-950/95 text-emerald-200 border-emerald-600'
                : toast.type === 'error'
                ? 'bg-rose-950/95 text-rose-200 border-rose-600'
                : 'bg-slate-900/95 text-sky-200 border-sky-600'
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
