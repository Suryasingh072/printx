import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Upload,
  FileText,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  Phone,
  MapPin,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  Sparkles,
  Layers,
  FileCheck,
  Eye,
  LogOut,
  Store,
  RotateCcw,
  CreditCard,
  QrCode,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { Shop, ShopPricing, Order, ColorMode, DuplexMode, PaperSize } from '../types.js';
import { PhotoIdCardTool } from './PhotoIdCardTool.js';
import { DocumentViewerModal } from './DocumentViewerModal.js';

interface CustomerPortalProps {
  shopSlug: string;
  onNavigateHome: () => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({ shopSlug, onNavigateHome }) => {
  const [shop, setShop] = useState<Shop | null>(null);
  const [pricing, setPricing] = useState<ShopPricing | null>(null);
  const [requiresCounterPayment, setRequiresCounterPayment] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Tab: 'document' or 'id_card'
  const [activeTab, setActiveTab] = useState<'document' | 'id_card'>('document');

  // Document Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{
    fileId: string;
    fileName: string;
    filePath: string;
    mimeType: string;
    sizeBytes: number;
    pageCount: number;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Print Configuration Options
  const [copies, setCopies] = useState<number>(1);
  const [colorMode, setColorMode] = useState<ColorMode>('bw');
  const [duplexMode, setDuplexMode] = useState<DuplexMode>('single');
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [pageRange, setPageRange] = useState<string>('all');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customNotes, setCustomNotes] = useState<string>('');

  // Order Submission & Live Tracking State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [isPollingOrder, setIsPollingOrder] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isPayingOnline, setIsPayingOnline] = useState(false);
  const [onlineUpiSuccess, setOnlineUpiSuccess] = useState(false);

  const handlePayOnlineNow = async () => {
    if (!placedOrder) return;
    setIsPayingOnline(true);
    try {
      const res = await api.payOnline(placedOrder.orderNumber);
      setPlacedOrder(res.order);
      setOnlineUpiSuccess(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      alert(err.message || 'Payment simulation failed.');
    } finally {
      setIsPayingOnline(false);
    }
  };

  // Leave Shop State & Confirmation
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [hasLeftShop, setHasLeftShop] = useState(false);

  // Fetch shop details
  useEffect(() => {
    const fetchShop = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getPublicShop(shopSlug);
        setShop(data.shop);
        setPricing(data.pricing);
        setRequiresCounterPayment(data.requiresCounterPayment);
      } catch (err: any) {
        setError(err.message || 'Could not load shop information.');
      } finally {
        setLoading(false);
      }
    };
    fetchShop();
  }, [shopSlug]);

  // Handle direct file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check unsupported types (Word / Excel)
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.doc') || lowerName.endsWith('.docx') || lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx')) {
      alert('Word and Excel files cannot be processed directly. Please open Microsoft Word / Excel and click "Save As PDF" or "Export to PDF" before uploading.');
      return;
    }

    setSelectedFile(file);
    setIsUploading(true);
    try {
      const res = await api.uploadFile(file);
      setUploadedFileInfo(res);
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
      setSelectedFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle ID card tool output
  const handleIdCardPrepared = async (prepared: { file: File; orderType: 'id_card' | 'photo'; previewUrl: string }) => {
    setSelectedFile(prepared.file);
    setIsUploading(true);
    try {
      const res = await api.uploadFile(prepared.file);
      setUploadedFileInfo({
        ...res,
        pageCount: 1,
      });
      // Switch back to review & submit view
      setActiveTab('document');
    } catch (err: any) {
      alert(`Failed to upload prepared card sheet: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Calculate live price
  const calculateTotal = (): { unitPrice: number; total: number } => {
    if (!pricing) return { unitPrice: 0, total: 0 };
    const pages = Math.max(1, uploadedFileInfo?.pageCount || 1);
    const validCopies = Math.max(1, copies);

    // If ID card
    if (uploadedFileInfo?.fileName.includes('ID_Card') || activeTab === 'id_card') {
      const unit = pricing.idCardSinglePrice || 15;
      return { unitPrice: unit, total: unit * validCopies };
    }

    let rate = 0;
    if (colorMode === 'bw') {
      rate = duplexMode === 'duplex' ? (pricing.bwDuplexPrice || 3) / 2 : (pricing.bwSinglePrice || 2);
    } else {
      rate = duplexMode === 'duplex' ? (pricing.colorDuplexPrice || 18) / 2 : (pricing.colorSinglePrice || 10);
    }

    if (paperSize === 'Legal') {
      rate += pricing.legalExtra || 1;
    }

    const total = rate * pages * validCopies;
    return {
      unitPrice: Number(rate.toFixed(2)),
      total: Number(total.toFixed(2)),
    };
  };

  // Submit order
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFileInfo) {
      alert('Please upload a document or ID card first.');
      return;
    }

    setIsSubmitting(true);
    try {
      const isIdCard = uploadedFileInfo.fileName.includes('ID_Card');
      const res = await api.createOrder({
        shopSlug,
        customerName: customerName ? customerName.trim() : 'Counter Customer',
        customerPhone: customerPhone ? customerPhone.trim() : '',
        documentName: uploadedFileInfo.fileName,
        documentType: uploadedFileInfo.mimeType,
        filePath: uploadedFileInfo.filePath,
        fileSizeBytes: uploadedFileInfo.sizeBytes,
        pageCount: uploadedFileInfo.pageCount,
        copies,
        colorMode,
        duplexMode,
        paperSize,
        orderType: isIdCard ? 'id_card' : 'document',
        pageRange,
        customNotes,
      });

      setPlacedOrder(res.order);
      // Trigger celebratory confetti
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      alert(err.message || 'Failed to submit order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Poll for order status updates
  useEffect(() => {
    if (!placedOrder) return;
    const interval = setInterval(async () => {
      try {
        setIsPollingOrder(true);
        const res = await api.trackOrder(placedOrder.orderNumber);
        setPlacedOrder(res.order);
      } catch (err) {
        // silent polling catch
      } finally {
        setIsPollingOrder(false);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [placedOrder]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading shop print portal...</p>
        </div>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center border border-slate-200 shadow-sm">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Shop Not Available</h2>
          <p className="text-sm text-slate-600 mb-6">{error || 'Could not locate this shop.'}</p>
          <button
            onClick={onNavigateHome}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Shop not yet activated condition
  if (shop.status !== 'active') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-lg w-full p-8 text-center border border-amber-200 shadow-sm">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
            <Clock className="w-8 h-8" />
          </div>
          <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full uppercase tracking-wider">
            Review in Progress
          </span>
          <h2 className="text-2xl font-bold text-slate-900 mt-4 mb-2">{shop.name}</h2>
          <p className="text-sm text-slate-600 mb-4">
            This shop has been registered and is currently under review by platform administrators. Customer orders will be enabled immediately once the shop is activated.
          </p>
          <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-500 text-left border border-slate-200 space-y-1 mb-6">
            <p className="font-semibold text-slate-700">Shop Address:</p>
            <p>{shop.address}, {shop.city}</p>
            <p className="font-semibold text-slate-700 pt-2">Phone:</p>
            <p>{shop.phone}</p>
          </div>
          <button
            onClick={onNavigateHome}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition"
          >
            Return to Homepage
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: SHOP LEFT / SESSION ENDED SCREEN
  // ==========================================
  if (hasLeftShop) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200/60 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xl text-center">
          {/* Top Shop Icon Badge */}
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-xs">
            <Store className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-semibold text-slate-600 mb-3">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            Shop Session Left
          </div>

          <h2 className="text-2xl font-black text-slate-900 mb-2">
            You Have Left {shop.name}
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
            You have exited this counter session. Private file previews and active order data on this screen have been cleared.
          </p>

          {/* Shop Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left text-xs text-slate-600 space-y-2 mb-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-blue-600" /> {shop.name}
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                Verified Shop
              </span>
            </div>
            <p className="flex items-center gap-1.5 text-slate-500">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{shop.address}, {shop.city}</span>
            </p>
            <p className="flex items-center gap-1.5 text-slate-500">
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Counter Phone: {shop.phone}</span>
            </p>
          </div>

          {/* If there was a placed order */}
          {placedOrder && (
            <div className="mb-6 p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900">Your Submitted Order:</span>
                <span className="font-mono text-xs font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                  {placedOrder.orderNumber}
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-1">
                Your order is safely registered in the shop printer queue. Provide Order #{placedOrder.orderNumber} to the shopkeeper at the counter.
              </p>
            </div>
          )}

          {/* Action CTAs */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setHasLeftShop(false);
                setSelectedFile(null);
                setUploadedFileInfo(null);
              }}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> Re-enter Shop / Print Documents
            </button>

            <button
              type="button"
              onClick={onNavigateHome}
              className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              Go to Homepage
            </button>
          </div>

          <p className="text-[11px] text-slate-400 mt-6">
            ADRTech QR Print Service • Fast & Private Self-Service Printing
          </p>
        </div>
      </div>
    );
  }

  const { unitPrice, total } = calculateTotal();

  // ==========================================
  // RENDER: ORDER CONFIRMATION & LIVE TRACKER
  // ==========================================
  if (placedOrder) {
    const getStatusStepIndex = (status: string) => {
      switch (status) {
        case 'pending_approval':
          return 1;
        case 'payment_pending':
          return 2;
        case 'queued':
          return 3;
        case 'printing':
          return 4;
        case 'completed':
          return 5;
        default:
          return 1;
      }
    };

    const currentStep = getStatusStepIndex(placedOrder.status);

    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="max-w-xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">Order Placed Successfully!</h1>
            <p className="text-sm text-slate-500 mt-1">
              Your document has been sent to <span className="font-semibold text-slate-800">{shop.name}</span>
            </p>

            <div className="my-6 p-4 bg-blue-50 border-2 border-dashed border-blue-300 rounded-2xl">
              <p className="text-xs uppercase font-bold text-blue-600 tracking-wider">Your Order Number</p>
              <p className="text-3xl font-black text-blue-900 tracking-wider mt-1">{placedOrder.orderNumber}</p>
              <p className="text-xs text-blue-700 mt-2 font-medium">
                Show this Order Number at the counter to pay and collect your prints.
              </p>
            </div>

            {/* Online Payment & Direct Auto-Print Section */}
            {placedOrder.paymentStatus !== 'collected' ? (
              <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl shadow-md text-left space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200">Total Payable</span>
                    <p className="text-3xl font-black">₹{placedOrder.totalAmount.toFixed(2)}</p>
                  </div>
                  <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xs">
                    <CreditCard className="w-6 h-6 text-white" />
                  </div>
                </div>

                <div className="p-3 bg-white/10 rounded-xl text-xs text-blue-100 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>Instant Print Enabled: Pay online and your job prints automatically on the shop machine.</span>
                </div>

                <button
                  type="button"
                  onClick={handlePayOnlineNow}
                  disabled={isPayingOnline}
                  className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-extrabold shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isPayingOnline ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Verifying Online UPI Payment...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Pay Online (UPI / Card / NetBanking) • Instant Print
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-left flex items-start gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-emerald-900">
                    Payment Verified: ₹{placedOrder.totalAmount.toFixed(2)} ({placedOrder.paymentMethod || 'Online UPI'})
                  </p>
                  <p className="text-emerald-800 mt-0.5">
                    Order sent directly to shop printer. Printing in progress!
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Status Tracker */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Live Spooler Status</h2>
              {isPollingOrder && (
                <span className="inline-flex items-center gap-1 text-[11px] text-blue-600">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Live syncing...
                </span>
              )}
            </div>

            <div className="space-y-4">
              {/* Step 1 */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-emerald-600 text-white">
                  1
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Document Uploaded</p>
                  <p className="text-xs text-slate-500">{placedOrder.documentName}</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  placedOrder.paymentStatus === 'collected' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                }`}>
                  2
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Online Payment</p>
                  <p className="text-xs text-slate-500">
                    {placedOrder.paymentStatus === 'collected'
                      ? `Paid ₹${placedOrder.totalAmount.toFixed(2)} (Online)`
                      : 'Pending Online UPI Payment'}
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  placedOrder.status === 'printing' || placedOrder.status === 'completed'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  3
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Automatic Printing on Machine</p>
                  <p className="text-xs text-slate-500">
                    {placedOrder.status === 'printing'
                      ? 'Spooling directly to laser printer...'
                      : placedOrder.status === 'completed'
                      ? 'Document printed successfully!'
                      : 'Awaiting payment confirmation to print'}
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  placedOrder.status === 'completed' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  4
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Ready for Counter Collection</p>
                  <p className="text-xs text-slate-500">
                    {placedOrder.status === 'completed'
                      ? 'Fresh prints ready on shop counter!'
                      : 'Collect from counter once printing finishes'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {selectedFile && (
              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition flex items-center justify-center gap-1.5"
              >
                <Eye className="w-4 h-4" /> Preview Submitted File
              </button>
            )}
            <button
              onClick={() => {
                setPlacedOrder(null);
                setSelectedFile(null);
                setUploadedFileInfo(null);
              }}
              className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition shadow-sm text-center"
            >
              Print Another Document
            </button>
            <button
              onClick={() => setHasLeftShop(true)}
              className="py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition"
            >
              Exit
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: MAIN CUSTOMER PRINT PORTAL
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Shop Banner */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-extrabold shadow-sm">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900">{shop.name}</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="w-3 h-3" /> Verified Shop
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-2">
                <MapPin className="w-3 h-3 text-slate-400" /> {shop.city} | Ph: {shop.phone}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowLeaveConfirmModal(true)}
            className="text-xs font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition px-3 py-1.5 rounded-xl border border-transparent hover:border-rose-200 flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Leave Shop
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Service Selector Tabs */}
        <div className="flex p-1 bg-slate-200/80 rounded-2xl mb-8 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => setActiveTab('document')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
              activeTab === 'document'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" /> Standard Document Print
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('id_card')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
              activeTab === 'id_card'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" /> Photo & ID Card Arranger
          </button>
        </div>

        {/* Tab 2: ID Card Arranger Tool */}
        {activeTab === 'id_card' ? (
          <div className="space-y-6">
            <PhotoIdCardTool onReadyToPrint={handleIdCardPrepared} />
          </div>
        ) : (
          /* Tab 1: Standard Document Upload & Options */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Upload & Options */}
            <div className="lg:col-span-7 space-y-6">
              {/* File Upload Box */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Upload className="w-4 h-4 text-blue-600" /> 1. Upload Your Document
                  </h3>
                  <span className="text-xs font-medium text-slate-500">Max size: 50MB</span>
                </div>

                {!uploadedFileInfo ? (
                  <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-8 text-center transition bg-slate-50/50">
                    <input
                      type="file"
                      id="doc-upload"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={isUploading}
                    />
                    <label htmlFor="doc-upload" className="cursor-pointer block">
                      {isUploading ? (
                        <div className="py-4">
                          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                          <p className="text-sm font-semibold text-slate-700">Uploading & Analyzing Pages...</p>
                        </div>
                      ) : (
                        <div className="py-2">
                          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <Upload className="w-6 h-6" />
                          </div>
                          <p className="text-sm font-bold text-slate-800">Tap to select or drop document</p>
                          <p className="text-xs text-slate-500 mt-1">Accepts PDF, JPG, and PNG files</p>
                          
                          <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200/80 rounded-lg text-[11px] text-amber-800 font-medium">
                            <AlertCircle className="w-3.5 h-3.5" /> For Word & Excel: Export to PDF first before uploading
                          </div>
                        </div>
                      )}
                    </label>
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs">
                          {uploadedFileInfo.fileName}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {uploadedFileInfo.pageCount} {uploadedFileInfo.pageCount === 1 ? 'Page' : 'Pages'} • {(uploadedFileInfo.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowPreviewModal(true)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-blue-200/80 cursor-pointer shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" /> Preview
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          setUploadedFileInfo(null);
                        }}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-2 py-1 cursor-pointer"
                      >
                        Change File
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Print Configuration Form */}
              <form onSubmit={handleSubmitOrder} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Printer className="w-4 h-4 text-blue-600" /> 2. Print Preferences
                </h3>

                {/* Color Mode */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-2">Print Colour</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setColorMode('bw')}
                      className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                        colorMode === 'bw'
                          ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold">Black & White (B&W)</p>
                        <p className="text-[11px] text-slate-500 font-normal">₹{pricing?.bwSinglePrice} / page</p>
                      </div>
                      {colorMode === 'bw' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setColorMode('color')}
                      className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                        colorMode === 'color'
                          ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold">Full Colour</p>
                        <p className="text-[11px] text-slate-500 font-normal">₹{pricing?.colorSinglePrice} / page</p>
                      </div>
                      {colorMode === 'color' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                    </button>
                  </div>
                </div>

                {/* Duplex Mode */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-2">Sides</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDuplexMode('single')}
                      className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                        duplexMode === 'single'
                          ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold">Single-Sided</p>
                        <p className="text-[11px] text-slate-500 font-normal">Standard 1 side per sheet</p>
                      </div>
                      {duplexMode === 'single' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDuplexMode('duplex')}
                      className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                        duplexMode === 'duplex'
                          ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold">Double-Sided (Duplex)</p>
                        <p className="text-[11px] text-slate-500 font-normal">Both sides of sheet</p>
                      </div>
                      {duplexMode === 'duplex' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                    </button>
                  </div>
                </div>

                {/* Copies & Paper Size */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Number of Copies</label>
                    <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <button
                        type="button"
                        onClick={() => setCopies(Math.max(1, copies - 1))}
                        className="px-3 py-2 text-slate-600 hover:bg-slate-100 font-bold"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={copies}
                        onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full text-center text-sm font-bold text-slate-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setCopies(copies + 1)}
                        className="px-3 py-2 text-slate-600 hover:bg-slate-100 font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Paper Size</label>
                    <select
                      value={paperSize}
                      onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                      className="w-full py-2 px-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 bg-white"
                    >
                      <option value="A4">A4 (Standard)</option>
                      <option value="Legal">Legal (+₹{pricing?.legalExtra})</option>
                    </select>
                  </div>
                </div>

                {/* Optional Note */}
                <div className="pt-2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Special Instructions (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g., Staple top-left, spiral bind, glossy paper"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50/50"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!uploadedFileInfo || isSubmitting}
                  className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 shadow-sm transition ${
                    uploadedFileInfo && !isSubmitting
                      ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Submitting Order...
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4" /> Place Print Order • ₹{total.toFixed(2)}
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Right Column: Order Summary & Price Breakdown */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm sticky top-20">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100">
                  Price Calculation
                </h3>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Document:</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[150px]">
                      {uploadedFileInfo?.fileName || 'No file selected'}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Pages Detected:</span>
                    <span className="font-semibold text-slate-800">{uploadedFileInfo?.pageCount || 1}</span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Copies:</span>
                    <span className="font-semibold text-slate-800">{copies}</span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Print Type:</span>
                    <span className="font-semibold text-slate-800">
                      {colorMode === 'color' ? 'Full Colour' : 'Black & White'} ({duplexMode})
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Rate:</span>
                    <span className="font-semibold text-slate-800">₹{unitPrice.toFixed(2)} / page</span>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
                    <div>
                      <p className="text-base font-extrabold text-slate-900">Total Payable</p>
                      <p className="text-[11px] text-emerald-600 font-semibold">Online Payment • Instant Print</p>
                    </div>
                    <p className="text-2xl font-black text-blue-600">₹{total.toFixed(2)}</p>
                  </div>
                </div>

                <div className="mt-6 p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900 space-y-1.5">
                  <p className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" /> Transparent Pricing Guarantee
                  </p>
                  <p className="text-blue-700">
                    This order price is calculated directly from {shop.name}'s verified rate card. No hidden charges.
                  </p>
                </div>

                <div className="mt-4 p-3 bg-slate-50 rounded-xl text-xs text-slate-500 space-y-1">
                  <p className="font-semibold text-slate-700">Instant Print Process:</p>
                  <p>1. Submit order & pay online via UPI.</p>
                  <p>2. Direct auto-print spools immediately to shop printer.</p>
                  <p>3. Pick up your fresh prints from counter!</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* In-App Document & PDF Preview Modal */}
      <DocumentViewerModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        file={selectedFile}
        fileName={uploadedFileInfo?.fileName || 'Uploaded Document'}
        mimeType={uploadedFileInfo?.mimeType}
        copies={copies}
        colorMode={colorMode}
        paperSize={paperSize}
        duplexMode={duplexMode}
      />

      {/* Leave Shop Confirmation Modal */}
      {showLeaveConfirmModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100 shadow-xs">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Exit Shop Session?</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Are you sure you want to leave <strong className="text-slate-800">{shop.name}</strong>? You can scan the counter QR code at any time to submit new prints.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowLeaveConfirmModal(false)}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Stay in Shop
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLeaveConfirmModal(false);
                  setHasLeftShop(true);
                }}
                className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-rose-600/20 cursor-pointer"
              >
                Yes, Leave Shop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
