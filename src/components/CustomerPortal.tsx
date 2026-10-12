import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Upload,
  FileText,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  Phone,
  MapPin,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  Sparkles,
  Layers,
  FileCheck,
  Eye,
  Store,
  RotateCcw,
  CreditCard,
  QrCode,
  Zap,
  Scissors,
  Edit,
  Trash2,
  Plus,
  Image as ImageIcon,
  Check,
  ChevronDown,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { Shop, ShopPricing, Order, ColorMode, DuplexMode, PaperSize, OrderFileItem } from '../types.js';
import { PhotoIdCardTool } from './PhotoIdCardTool.js';
import { PassportPhotoSheetTool } from './PassportPhotoSheetTool.js';
import { ImageEditorModal } from './ImageEditorModal.js';
import { DocumentViewerModal } from './DocumentViewerModal.js';

interface CustomerPortalProps {
  shopSlug: string;
  onNavigateHome: () => void;
}

interface MultiFileQueueItem {
  id: string;
  file: File;
  name: string;
  type: string;
  sizeBytes: number;
  previewUrl: string;
  serverInfo?: {
    fileId: string;
    fileName: string;
    filePath: string;
    mimeType: string;
    sizeBytes: number;
    pageCount: number;
  };
  pageCount: number;
  isUploading: boolean;
  isEdited: boolean;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({ shopSlug, onNavigateHome }) => {
  const [shop, setShop] = useState<Shop | null>(null);
  const [pricing, setPricing] = useState<ShopPricing | null>(null);
  const [requiresCounterPayment, setRequiresCounterPayment] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Tab: 'document' (Multi-file), 'id_card', or 'passport_photo'
  const [activeTab, setActiveTab] = useState<'document' | 'id_card' | 'passport_photo'>('document');

  // Multi-File Print Queue (5 to 10 files support)
  const [fileQueue, setFileQueue] = useState<MultiFileQueueItem[]>([]);
  const [isBulkUploading, setIsBulkUploading] = useState(false);

  // Phone Se Hi Editing Modal State
  const [editingItem, setEditingItem] = useState<MultiFileQueueItem | null>(null);

  // Print Configuration Options (applied to batch order)
  const [copies, setCopies] = useState<number>(1);
  const [colorMode, setColorMode] = useState<ColorMode>('bw');
  const [duplexMode, setDuplexMode] = useState<DuplexMode>('single');
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customNotes, setCustomNotes] = useState<string>('');

  // Order Submission & Live Tracking State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [isPollingOrder, setIsPollingOrder] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDocumentUrl, setPreviewDocumentUrl] = useState<string | null>(null);
  const [previewDocumentName, setPreviewDocumentName] = useState<string>('Document');
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
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      alert(err.message || 'Payment simulation failed.');
    } finally {
      setIsPayingOnline(false);
    }
  };

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

  // Handle Multi-File Input Selection (PDF + Photos)
  const handleMultipleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Filter out unsupported Word/Excel
    const validFiles: File[] = [];
    for (const f of files) {
      const lower = f.name.toLowerCase();
      if (lower.endsWith('.doc') || lower.endsWith('.docx') || lower.endsWith('.xls') || lower.endsWith('.xlsx')) {
        alert(`"${f.name}" is a Word/Excel document. Please Export to PDF before uploading.`);
      } else {
        validFiles.push(f);
      }
    }

    if (validFiles.length === 0) return;

    // Limit check (max 15 files)
    if (fileQueue.length + validFiles.length > 15) {
      alert('Aap ek saath maximum 15 files upload kar sakte hain.');
      return;
    }

    const newQueueItems: MultiFileQueueItem[] = validFiles.map((file) => ({
      id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      file,
      name: file.name,
      type: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      previewUrl: URL.createObjectURL(file),
      pageCount: file.type === 'application/pdf' ? 1 : 1,
      isUploading: true,
      isEdited: false,
    }));

    setFileQueue((prev) => [...prev, ...newQueueItems]);
    setIsBulkUploading(true);

    // Upload each file to server to obtain valid file token & page count
    for (const item of newQueueItems) {
      try {
        const res = await api.uploadFile(item.file);
        setFileQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  serverInfo: res,
                  pageCount: res.pageCount,
                  isUploading: false,
                }
              : q
          )
        );
      } catch (err: any) {
        console.error('File upload failure:', err);
        setFileQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, isUploading: false } : q))
        );
      }
    }

    setIsBulkUploading(false);
    // Reset input
    e.target.value = '';
  };

  // Remove file from queue
  const handleRemoveFile = (id: string) => {
    setFileQueue((prev) => prev.filter((f) => f.id !== id));
  };

  // Re-order files in queue
  const handleMoveFile = (index: number, direction: 'up' | 'down') => {
    setFileQueue((prev) => {
      const copy = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // Save Edited Image from Phone Se Hi Editing Modal
  const handleSaveEditedImage = async (editedBlob: Blob, newPreviewUrl: string) => {
    if (!editingItem) return;

    const editedFile = new File([editedBlob], `Edited_${editingItem.name}`, { type: 'image/jpeg' });

    // Update locally and upload edited version
    setFileQueue((prev) =>
      prev.map((item) =>
        item.id === editingItem.id
          ? {
              ...item,
              file: editedFile,
              previewUrl: newPreviewUrl,
              sizeBytes: editedBlob.size,
              isEdited: true,
              isUploading: true,
            }
          : item
      )
    );

    try {
      const res = await api.uploadFile(editedFile);
      setFileQueue((prev) =>
        prev.map((item) =>
          item.id === editingItem.id
            ? {
                ...item,
                serverInfo: res,
                isUploading: false,
              }
            : item
        )
      );
    } catch (err) {
      console.error(err);
      setFileQueue((prev) =>
        prev.map((item) => (item.id === editingItem.id ? { ...item, isUploading: false } : item))
      );
    }
  };

  // Handle Prepared Passport Sheet Output
  const handlePassportPhotoReady = async (prepared: {
    file: File;
    orderType: 'photo';
    previewUrl: string;
    sheetCount: number;
  }) => {
    const queueItem: MultiFileQueueItem = {
      id: `passport_${Date.now()}`,
      file: prepared.file,
      name: prepared.file.name,
      type: prepared.file.type,
      sizeBytes: prepared.file.size,
      previewUrl: prepared.previewUrl,
      pageCount: 1,
      isUploading: true,
      isEdited: true,
    };

    setFileQueue((prev) => [...prev, queueItem]);
    setActiveTab('document');

    try {
      const res = await api.uploadFile(prepared.file);
      setFileQueue((prev) =>
        prev.map((q) =>
          q.id === queueItem.id
            ? {
                ...q,
                serverInfo: res,
                isUploading: false,
              }
            : q
        )
      );
    } catch (err) {
      console.error(err);
      setFileQueue((prev) =>
        prev.map((q) => (q.id === queueItem.id ? { ...q, isUploading: false } : q))
      );
    }
  };

  // Handle Prepared ID Card Sheet Output
  const handleIdCardReady = async (prepared: { file: File; orderType: 'id_card' | 'photo'; previewUrl: string }) => {
    const queueItem: MultiFileQueueItem = {
      id: `idcard_${Date.now()}`,
      file: prepared.file,
      name: prepared.file.name,
      type: prepared.file.type,
      sizeBytes: prepared.file.size,
      previewUrl: prepared.previewUrl,
      pageCount: 1,
      isUploading: true,
      isEdited: true,
    };

    setFileQueue((prev) => [...prev, queueItem]);
    setActiveTab('document');

    try {
      const res = await api.uploadFile(prepared.file);
      setFileQueue((prev) =>
        prev.map((q) =>
          q.id === queueItem.id
            ? {
                ...q,
                serverInfo: res,
                isUploading: false,
              }
            : q
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  // Calculate Total Amount across all files in Queue
  const calculateTotal = (): { totalPages: number; unitPrice: number; total: number } => {
    if (!pricing || fileQueue.length === 0) return { totalPages: 0, unitPrice: 0, total: 0 };

    let totalPages = 0;
    let totalCost = 0;
    const validCopies = Math.max(1, copies);

    for (const item of fileQueue) {
      const isIdCard = item.name.includes('ID_Card') || item.name.includes('Aadhaar');
      const isPassportSheet = item.name.includes('Passport_Sheet');

      if (isPassportSheet) {
        const cost = (pricing.photo4x6Price || 25) * validCopies;
        totalCost += cost;
        totalPages += 1;
      } else if (isIdCard) {
        const cost = (pricing.idCardSinglePrice || 15) * validCopies;
        totalCost += cost;
        totalPages += 1;
      } else {
        const pages = Math.max(1, item.pageCount || 1);
        totalPages += pages;

        let pageRate = 0;
        if (colorMode === 'bw') {
          pageRate = duplexMode === 'duplex' ? (pricing.bwDuplexPrice || 3) / 2 : (pricing.bwSinglePrice || 2);
        } else {
          pageRate = duplexMode === 'duplex' ? (pricing.colorDuplexPrice || 18) / 2 : (pricing.colorSinglePrice || 10);
        }

        if (paperSize === 'Legal') {
          pageRate += pricing.legalExtra || 1;
        }

        totalCost += pageRate * pages * validCopies;
      }
    }

    const avgRate = totalPages > 0 ? totalCost / (totalPages * validCopies) : 2;

    return {
      totalPages,
      unitPrice: Number(avgRate.toFixed(2)),
      total: Number(totalCost.toFixed(2)),
    };
  };

  // Submit Multi-File Order
  const handleSubmitBatchOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fileQueue.length === 0) {
      alert('Pehle kam se kam ek document ya photo upload karein.');
      return;
    }

    const pending = fileQueue.filter((f) => !f.serverInfo);
    if (pending.length > 0) {
      alert('Kuch files upload ho rahi hain, kripya 2 second wait karein.');
      return;
    }

    setIsSubmitting(true);
    try {
      const primaryFile = fileQueue[0];
      const hasPassport = fileQueue.some((f) => f.name.includes('Passport_Sheet'));
      const hasIdCard = fileQueue.some((f) => f.name.includes('ID_Card'));

      const orderType = hasPassport ? 'photo' : hasIdCard ? 'id_card' : 'document';
      const docName = fileQueue.length === 1
        ? primaryFile.name
        : `${fileQueue[0].name} + ${fileQueue.length - 1} aur files (${fileQueue.length} items)`;

      const filesPayload: OrderFileItem[] = fileQueue.map((item) => ({
        id: item.serverInfo?.fileId || item.id,
        name: item.name,
        type: item.type,
        sizeBytes: item.sizeBytes,
        filePath: item.serverInfo?.filePath || '',
        pageCount: item.pageCount,
        previewUrl: item.previewUrl,
        edited: item.isEdited,
      }));

      const totalPages = fileQueue.reduce((acc, curr) => acc + curr.pageCount, 0);
      const totalSizeBytes = fileQueue.reduce((acc, curr) => acc + curr.sizeBytes, 0);

      const res = await api.createOrder({
        shopSlug,
        customerName: customerName ? customerName.trim() : 'Counter Customer',
        customerPhone: customerPhone ? customerPhone.trim() : '',
        documentName: docName,
        documentType: primaryFile.type,
        filePath: primaryFile.serverInfo?.filePath || '',
        fileSizeBytes: totalSizeBytes,
        pageCount: totalPages,
        copies,
        colorMode,
        duplexMode,
        paperSize,
        orderType,
        pageRange: 'all',
        customNotes,
        files: filesPayload as any,
      });

      setPlacedOrder(res.order);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      alert(err.message || 'Order submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Poll for placed order status
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
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-700">Connecting to print shop...</p>
        </div>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Shop Not Found</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {error || 'The requested print shop link is invalid or expired. Please rescan the QR code at the counter.'}
          </p>
          <button
            onClick={onNavigateHome}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Go to printx Home
          </button>
        </div>
      </div>
    );
  }

  const { totalPages, total } = calculateTotal();

  // ==========================================
  // RENDER: ORDER CONFIRMATION & LIVE TRACKER
  // ==========================================
  if (placedOrder) {
    const isPaid = placedOrder.paymentStatus === 'collected' || onlineUpiSuccess;

    return (
      <div className="min-h-screen bg-slate-900 text-white py-12 px-4 flex flex-col items-center justify-center">
        <div className="max-w-xl w-full bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider inline-block">
              Order Placed Successfully
            </span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{placedOrder.orderNumber}</h2>
            <p className="text-xs text-slate-400">
              {shop.name} • {shop.address}, {shop.city}
            </p>
          </div>

          {/* Amount Due & Online Payment Option */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Print Amount</p>
              <p className="text-4xl font-black text-white mt-1">₹{placedOrder.totalAmount.toFixed(2)}</p>
            </div>

            {isPaid ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center justify-center gap-2">
                <Check className="w-4 h-4 stroke-[3]" /> Payment Verified & Order Dispatched to Printer
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handlePayOnlineNow}
                  disabled={isPayingOnline}
                  className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black rounded-2xl text-sm shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 fill-slate-950" />
                  {isPayingOnline ? 'Verifying UPI...' : 'Pay Online (UPI / GPay / PhonePe)'}
                </button>
                <p className="text-[11px] text-slate-400">
                  Instant Auto-Print: Online pay karte hi document direct printer tray me print hona start ho jayega.
                </p>
              </div>
            )}
          </div>

          {/* Order Status Progress */}
          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">Live Printer Status:</span>
              <span className="px-2.5 py-0.5 rounded-full font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase text-[10px]">
                {placedOrder.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Documents / Files:</span>
                <span className="font-bold truncate max-w-[240px] text-right">{placedOrder.documentName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Total Pages:</span>
                <span className="font-bold">{placedOrder.pageCount} Pages • {placedOrder.copies} {placedOrder.copies === 1 ? 'Copy' : 'Copies'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Color & Sides:</span>
                <span className="font-bold uppercase">{placedOrder.colorMode} • {placedOrder.duplexMode}</span>
              </div>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setPlacedOrder(null);
                setFileQueue([]);
                setOnlineUpiSuccess(false);
              }}
              className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition text-center cursor-pointer"
            >
              Print Another Document
            </button>
            <button
              onClick={onNavigateHome}
              className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition border border-slate-800 cursor-pointer"
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
    <div className="min-h-screen bg-slate-50 font-sans pb-16">
      {/* Top Shop Banner (Clean & Modern like qrseprints.in) */}
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-black shadow-sm">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-slate-900 tracking-tight">{shop.name}</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3" /> Live Counter
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <MapPin className="w-3 h-3 text-slate-400" /> {shop.city} • Ph: {shop.phone}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
              printx Smart Shop
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Service Selector Tabs (Like qrseprints.in) */}
        <div className="grid grid-cols-3 p-1.5 bg-slate-200/80 rounded-2xl max-w-xl mx-auto shadow-inner text-xs font-black">
          <button
            type="button"
            onClick={() => setActiveTab('document')}
            className={`py-3 px-2 sm:px-4 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'document'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span className="truncate">📄 Multi-File Print</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('passport_photo')}
            className={`py-3 px-2 sm:px-4 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'passport_photo'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scissors className="w-4 h-4" />
            <span className="truncate">📷 4×6 Passport Sheet</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('id_card')}
            className={`py-3 px-2 sm:px-4 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'id_card'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span className="truncate">🪪 ID Card Arranger</span>
          </button>
        </div>

        {/* Tab 2: 4x6 Passport Photos Sheet Maker */}
        {activeTab === 'passport_photo' && (
          <PassportPhotoSheetTool onReadyToPrint={handlePassportPhotoReady} />
        )}

        {/* Tab 3: ID Card Arranger Tool */}
        {activeTab === 'id_card' && (
          <PhotoIdCardTool onReadyToPrint={handleIdCardReady} />
        )}

        {/* Tab 1: Multi-file Print & Phone Editing Portal */}
        {activeTab === 'document' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Upload & Multi-file List */}
            <div className="lg:col-span-7 space-y-6">
              {/* 1. Multi-file Upload Box */}
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Upload className="w-4 h-4 text-blue-600" /> 1. Upload Documents & Photos
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ek saath 5–10 files bhejein (PDF + photo mix) — ek payment, sahi order me print.
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                    {fileQueue.length} files selected
                  </span>
                </div>

                {/* Upload Zone */}
                <div className="border-2 border-dashed border-blue-200 hover:border-blue-500 rounded-2xl p-6 text-center transition bg-blue-50/20">
                  <input
                    type="file"
                    id="multi-upload"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={handleMultipleFilesSelected}
                    disabled={isBulkUploading}
                  />
                  <label htmlFor="multi-upload" className="cursor-pointer block">
                    <div className="w-12 h-12 bg-blue-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md shadow-blue-500/20">
                      <Plus className="w-6 h-6 stroke-[3]" />
                    </div>
                    <p className="text-sm font-black text-slate-900">
                      Tap to select multiple files (PDF + Photos)
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      PDF, JPG, PNG sabhi format ek saath upload karein
                    </p>

                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200/80 rounded-lg text-[11px] text-amber-800 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" /> Word ya Excel ko PDF bana kar upload karein
                    </div>
                  </label>
                </div>

                {/* Selected Files Queue List with Editing Action */}
                {fileQueue.length > 0 && (
                  <div className="space-y-2.5 pt-2">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Print Queue Order ({fileQueue.length} Files):
                    </p>
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {fileQueue.map((item, index) => {
                        const isImage = item.type.startsWith('image/');

                        return (
                          <div
                            key={item.id}
                            className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 flex items-center justify-between gap-3 shadow-xs hover:border-blue-200 transition"
                          >
                            <div className="flex items-center gap-3 truncate min-w-0">
                              <span className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center shrink-0">
                                {index + 1}
                              </span>

                              {isImage && item.previewUrl ? (
                                <img
                                  src={item.previewUrl}
                                  alt={item.name}
                                  className="w-10 h-10 object-cover rounded-xl border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl shrink-0">
                                  <FileText className="w-5 h-5" />
                                </div>
                              )}

                              <div className="truncate">
                                <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {item.isUploading
                                    ? 'Uploading...'
                                    : `${item.pageCount} ${item.pageCount === 1 ? 'Page' : 'Pages'} • ${(item.sizeBytes / (1024 * 1024)).toFixed(1)} MB`}
                                  {item.isEdited && (
                                    <span className="ml-1.5 text-cyan-700 font-bold bg-cyan-100 px-1.5 py-0.2 rounded text-[10px]">
                                      Edited
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>

                            {/* Actions: Phone Se Hi Editing (Crop/Rotate/Brightness) + Delete */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isImage && (
                                <button
                                  type="button"
                                  onClick={() => setEditingItem(item)}
                                  className="px-2.5 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-xl text-xs font-bold transition flex items-center gap-1 border border-cyan-200 cursor-pointer shadow-xs"
                                  title="Phone Se Hi Editing (Crop, rotate, brightness)"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Edit</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleRemoveFile(item.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                title="Remove file"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Print Preferences Form */}
              <form onSubmit={handleSubmitBatchOrder} className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-6">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Printer className="w-4 h-4 text-blue-600" /> 2. Print Preferences
                </h3>

                {/* Color Mode */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-2">Print Colour</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setColorMode('bw')}
                      className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                        colorMode === 'bw'
                          ? 'border-blue-600 bg-blue-50/80 text-blue-900 font-bold shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-black">Black & White (B&W)</p>
                        <p className="text-[11px] text-slate-500 font-normal">₹{pricing?.bwSinglePrice} / page</p>
                      </div>
                      {colorMode === 'bw' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setColorMode('color')}
                      className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                        colorMode === 'color'
                          ? 'border-blue-600 bg-blue-50/80 text-blue-900 font-bold shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-black">Full Colour</p>
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
                      className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                        duplexMode === 'single'
                          ? 'border-blue-600 bg-blue-50/80 text-blue-900 font-bold shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-black">Single-Sided</p>
                        <p className="text-[11px] text-slate-500 font-normal">Standard 1 side per sheet</p>
                      </div>
                      {duplexMode === 'single' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDuplexMode('duplex')}
                      className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                        duplexMode === 'duplex'
                          ? 'border-blue-600 bg-blue-50/80 text-blue-900 font-bold shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-black">Double-Sided (Duplex)</p>
                        <p className="text-[11px] text-slate-500 font-normal">Both sides of sheet (save paper)</p>
                      </div>
                      {duplexMode === 'duplex' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                    </button>
                  </div>
                </div>

                {/* Copies & Paper Size */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Number of Sets / Copies</label>
                    <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <button
                        type="button"
                        onClick={() => setCopies(Math.max(1, copies - 1))}
                        className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 font-black cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={copies}
                        onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full text-center text-sm font-black text-slate-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setCopies(copies + 1)}
                        className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 font-black cursor-pointer"
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
                      className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white"
                    >
                      <option value="A4">A4 (Standard)</option>
                      <option value="Legal">Legal (+₹{pricing?.legalExtra})</option>
                    </select>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Your Name (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">WhatsApp / Phone (Optional)</label>
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50/50"
                    />
                  </div>
                </div>

                {/* Special Instructions */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Special Instructions (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Staple on top-left, print in sequence"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50/50"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={fileQueue.length === 0 || isSubmitting || isBulkUploading}
                  className={`w-full py-4 px-6 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2 shadow-lg transition cursor-pointer ${
                    fileQueue.length > 0 && !isSubmitting && !isBulkUploading
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25'
                      : 'bg-slate-300 cursor-not-allowed shadow-none'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" /> Submitting Order...
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-5 h-5 stroke-[2.5]" /> Place Print Order • ₹{total.toFixed(2)}
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Right Column: Price Breakdown Card */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm sticky top-24 space-y-4">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center justify-between">
                  <span>Price Calculation</span>
                  <span className="text-blue-600 font-mono text-xs">{fileQueue.length} files</span>
                </h3>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Pages in Queue:</span>
                    <span className="font-black text-slate-900">{totalPages} Pages</span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Copies / Sets:</span>
                    <span className="font-black text-slate-900">{copies}</span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Color Mode:</span>
                    <span className="font-bold uppercase text-slate-800">{colorMode}</span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Printing Sides:</span>
                    <span className="font-bold uppercase text-slate-800">{duplexMode}</span>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
                    <span className="text-sm font-black text-slate-900">Total Price:</span>
                    <span className="text-3xl font-black text-blue-600">₹{total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Features Highlights like qrseprints.in */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-[11px] text-slate-600">
                  <p className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    No WhatsApp or Pen Drive needed
                  </p>
                  <p className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Private & Secure — files deleted after printing
                  </p>
                  <p className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Auto-print directly from your phone
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Phone Se Hi Editing Modal (Crop, Rotate, Brightness) */}
      {editingItem && (
        <ImageEditorModal
          isOpen={Boolean(editingItem)}
          imageUrl={editingItem.previewUrl}
          fileName={editingItem.name}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveEditedImage}
        />
      )}
    </div>
  );
};
