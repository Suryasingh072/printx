import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Upload,
  Camera,
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
  X,
  Crop,
  ExternalLink,
  Copy,
} from 'lucide-react';
import QRCode from 'qrcode';
import { api } from '../lib/api.js';
import { Shop, ShopPricing, Order, ColorMode, DuplexMode, PaperSize, OrderFileItem } from '../types.js';
import { PhotoIdCardTool } from './PhotoIdCardTool.js';
import { ImageEditorModal } from './ImageEditorModal.js';
import { DocumentViewerModal } from './DocumentViewerModal.js';
import { DocumentEditorModal } from './DocumentEditorModal.js';
import { initiateRazorpayCheckout } from '../lib/razorpay.js';

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
  uploadError?: string;
  isEdited: boolean;
  rotation?: number;
  pageRange?: string;
  excludedPages?: number[];
  customNotes?: string;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({ shopSlug, onNavigateHome }) => {
  const [shop, setShop] = useState<Shop | null>(null);
  const [pricing, setPricing] = useState<ShopPricing | null>(null);
  const [requiresCounterPayment, setRequiresCounterPayment] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Tab: 'document' (Multi-file) or 'id_card'
  const [activeTab, setActiveTab] = useState<'document' | 'id_card'>('document');

  // Multi-File Print Queue (5 to 10 files support)
  const [fileQueue, setFileQueue] = useState<MultiFileQueueItem[]>([]);
  const [isBulkUploading, setIsBulkUploading] = useState(false);

  // Phone Se Hi Editing Modal States (Image Editor + Document/PDF Editor)
  const [editingItem, setEditingItem] = useState<MultiFileQueueItem | null>(null);
  const [editingDocItem, setEditingDocItem] = useState<MultiFileQueueItem | null>(null);

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

  // Razorpay Standard Web Checkout State
  const [isRazorpayLoading, setIsRazorpayLoading] = useState(false);
  const [razorpayMessage, setRazorpayMessage] = useState<{ type: 'error' | 'info' | 'success'; text: string } | null>(null);

  const handlePayWithRazorpay = async (orderToPay?: any) => {
    const order = orderToPay || placedOrder;
    if (!order) return;
    setIsRazorpayLoading(true);
    setRazorpayMessage(null);

    try {
      await initiateRazorpayCheckout({
        amountInRupees: order.totalAmount,
        orderNumber: order.orderNumber,
        customerName: order.customerName || customerName,
        customerPhone: order.customerPhone || customerPhone,
        description: `Print Order ${order.orderNumber}`,
        onDismiss: () => {
          setIsRazorpayLoading(false);
          setRazorpayMessage({
            type: 'info',
            text: 'Razorpay checkout modal was closed. You can retry payment anytime.',
          });
        },
        onError: (err) => {
          setIsRazorpayLoading(false);
          setRazorpayMessage({
            type: 'error',
            text: err.description || 'Razorpay payment was declined or could not be completed.',
          });
        },
        onSuccess: (result) => {
          setIsRazorpayLoading(false);
          setOnlineUpiSuccess(true);
          if (result.verificationData?.order) {
            setPlacedOrder(result.verificationData.order);
          }
          setRazorpayMessage({
            type: 'success',
            text: `Payment verified via Razorpay! Payment ID: ${result.paymentId}`,
          });

          confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.6 },
          });

          // Reset queue
          setFileQueue([]);
          setCustomerName('');
          setCustomerPhone('');
          setCustomNotes('');
          setCopies(1);
        },
      });
    } catch (err: any) {
      setIsRazorpayLoading(false);
      setRazorpayMessage({
        type: 'error',
        text: err?.message || 'Failed to start Razorpay checkout.',
      });
    }
  };

  // Fetch shop details & initial agent status
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

  // Client-side image optimization to make phone camera photo uploads blazing fast (10x faster)
  const optimizeImageForFastUpload = async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/')) return file;
    // If under 1.2MB, already fast
    if (file.size < 1.2 * 1024 * 1024) return file;

    return new Promise<File>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 2400; // Optimal 300 DPI clarity for A4
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(file);

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob && blob.size < file.size) {
                const optimizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(optimizedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.88
          );
        };
        img.onerror = () => resolve(file);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  // Handle Multi-File Input Selection (PDF + Photos)
  const handleMultipleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length === 0) return;

    // Filter out unsupported Word/Excel
    const validRawFiles: File[] = [];
    for (const f of rawFiles) {
      const lower = f.name.toLowerCase();
      if (lower.endsWith('.doc') || lower.endsWith('.docx') || lower.endsWith('.xls') || lower.endsWith('.xlsx')) {
        alert(`"${f.name}" is a Word/Excel document. Please Export to PDF before uploading.`);
      } else {
        validRawFiles.push(f);
      }
    }

    if (validRawFiles.length === 0) return;

    // Limit check (max 15 files)
    if (fileQueue.length + validRawFiles.length > 15) {
      alert('Aap ek saath maximum 15 files upload kar sakte hain.');
      return;
    }

    // Instant local preview for immediate user feedback (zero lag)
    const initialItems: MultiFileQueueItem[] = validRawFiles.map((file) => ({
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

    setFileQueue((prev) => [...prev, ...initialItems]);
    setIsBulkUploading(true);

    // Fast parallel upload with image optimization
    await Promise.all(
      initialItems.map(async (item) => {
        try {
          // Optimize large camera photos on the fly for 10x faster transfer
          const fileToUpload = await optimizeImageForFastUpload(item.file);
          const res = await api.uploadFile(fileToUpload);
          setFileQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? {
                    ...q,
                    file: fileToUpload,
                    serverInfo: res,
                    pageCount: res.pageCount,
                    sizeBytes: fileToUpload.size,
                    isUploading: false,
                    uploadError: undefined,
                  }
                : q
            )
          );
        } catch (err: any) {
          console.error('File upload failure:', err);
          setFileQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? {
                    ...q,
                    isUploading: false,
                    uploadError: err.message || 'Upload failed. Tap to retry.',
                  }
                : q
            )
          );
        }
      })
    );

    setIsBulkUploading(false);
    // Reset input
    e.target.value = '';
  };

  // Retry failed upload for a specific file
  const handleRetryUpload = async (itemId: string) => {
    const item = fileQueue.find((q) => q.id === itemId);
    if (!item) return;

    setFileQueue((prev) =>
      prev.map((q) => (q.id === itemId ? { ...q, isUploading: true, uploadError: undefined } : q))
    );

    try {
      const res = await api.uploadFile(item.file);
      setFileQueue((prev) =>
        prev.map((q) =>
          q.id === itemId
            ? {
                ...q,
                serverInfo: res,
                pageCount: res.pageCount,
                isUploading: false,
                uploadError: undefined,
              }
            : q
        )
      );
    } catch (err: any) {
      setFileQueue((prev) =>
        prev.map((q) =>
          q.id === itemId
            ? {
                ...q,
                isUploading: false,
                uploadError: err.message || 'Retry failed. Check network or file size.',
              }
            : q
        )
      );
    }
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

  // Save Edited Document Options (Page Range, Excluded Pages, Rotation, Notes)
  const handleSaveEditedDocument = (edits: {
    name: string;
    pageCount: number;
    rotation: number;
    pageRange: string;
    excludedPages: number[];
    customNotes?: string;
  }) => {
    if (!editingDocItem) return;

    setFileQueue((prev) =>
      prev.map((item) =>
        item.id === editingDocItem.id
          ? {
              ...item,
              name: edits.name,
              pageCount: edits.pageCount,
              rotation: edits.rotation,
              pageRange: edits.pageRange,
              excludedPages: edits.excludedPages,
              customNotes: edits.customNotes,
              isEdited: true,
            }
          : item
      )
    );
    setEditingDocItem(null);
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

  // Calculate Total Amount across all files in Queue (A4 Standard)
  const calculateTotal = (): { totalPages: number; unitPrice: number; total: number } => {
    if (!pricing || fileQueue.length === 0) return { totalPages: 0, unitPrice: 0, total: 0 };

    let totalPages = 0;
    let totalCost = 0;
    const validCopies = Math.max(1, copies);

    for (const item of fileQueue) {
      const isIdCard = item.name.includes('ID_Card') || item.name.includes('Aadhaar');

      if (isIdCard) {
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

    const failed = fileQueue.filter((f) => f.uploadError);
    if (failed.length > 0) {
      alert(`Kuch files upload nahi ho saki: "${failed.map((f) => f.name).join(', ')}". Kripya unhe Retry karein ya Remove karein.`);
      return;
    }

    const invalidFiles = fileQueue.filter(
      (f) => !f.serverInfo?.filePath || !f.serverInfo?.filePath.trim() || f.sizeBytes === 0
    );
    if (invalidFiles.length > 0) {
      alert('Kuch files theek se upload nahi ho paayi hain. Kripya unhe dubara upload karein.');
      return;
    }

    const stillUploading = fileQueue.filter((f) => f.isUploading || !f.serverInfo);
    if (stillUploading.length > 0) {
      alert('Files abhi upload ho rahi hain, kripya thoda intezaar karein.');
      return;
    }

    setIsSubmitting(true);
    try {
      const primaryFile = fileQueue[0];
      const hasIdCard = fileQueue.some((f) => f.name.includes('ID_Card') || f.name.includes('Aadhaar'));
      const orderType = hasIdCard ? 'id_card' : 'document';
      const docName = fileQueue.length === 1
        ? primaryFile.name
        : `${fileQueue[0].name} + ${fileQueue.length - 1} aur files (${fileQueue.length} items)`;

      const filesPayload: OrderFileItem[] = fileQueue.map((item) => ({
        id: item.serverInfo?.fileId || item.id,
        name: item.name,
        type: item.serverInfo?.mimeType || item.file?.type || item.type,
        sizeBytes: item.sizeBytes,
        filePath: item.serverInfo?.filePath || '',
        pageCount: item.pageCount,
        previewUrl: item.previewUrl,
        edited: item.isEdited,
        rotation: item.rotation,
        pageRange: item.pageRange,
        customNotes: item.customNotes,
      } as any));

      const totalPages = fileQueue.reduce((acc, curr) => acc + curr.pageCount, 0);
      const totalSizeBytes = fileQueue.reduce((acc, curr) => acc + curr.sizeBytes, 0);

      const res = await api.createOrder({
        shopSlug,
        customerName: customerName ? customerName.trim() : 'Online Customer',
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
      // Seamless Razorpay checkout modal trigger
      handlePayWithRazorpay(res.order);
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
    }, 2000);
    return () => clearInterval(interval);
  }, [placedOrder]);

  const { totalPages, total } = calculateTotal();
  const isPaid = placedOrder ? placedOrder.paymentStatus === 'collected' || onlineUpiSuccess : false;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080b14] text-[#f1f5f9] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="w-96 h-96 bg-[rgba(255,46,99,0.12)] blur-[140px] rounded-full pointer-events-none absolute -top-24 -left-24 z-0" />
        <div className="text-center space-y-4 relative z-10">
          <div className="w-12 h-12 border-3 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto shadow-[0_0_20px_rgba(255,46,99,0.4)]" />
          <p className="text-sm font-bold text-slate-300 font-head tracking-tight">Connecting to print shop...</p>
        </div>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen bg-[#080b14] text-[#f1f5f9] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="w-96 h-96 bg-[rgba(255,46,99,0.12)] blur-[140px] rounded-full pointer-events-none absolute -top-24 -left-24 z-0" />
        <div className="max-w-md w-full card p-8 text-center space-y-4 relative z-10">
          <div className="w-16 h-16 bg-rose-500/15 border border-rose-500/30 text-rose-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-rose-500/20">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black font-head text-white">Shop Not Found</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {error || 'The requested print shop link is invalid or expired. Please rescan the QR code at the counter.'}
          </p>
          <button
            onClick={onNavigateHome}
            className="btn btn-primary w-full py-3 text-xs font-black shadow-lg shadow-rose-500/30 cursor-pointer"
          >
            Go to printx Home
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: MAIN CUSTOMER PRINT PORTAL
  // ==========================================
  return (
    <div className="min-h-screen bg-[#080b14] text-[#f1f5f9] font-sans pb-32 sm:pb-16 relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="w-96 h-96 bg-[rgba(255,46,99,0.12)] blur-[140px] rounded-full pointer-events-none absolute -top-24 -left-24 z-0" />
      <div className="w-96 h-96 bg-[rgba(124,92,255,0.14)] blur-[140px] rounded-full pointer-events-none absolute top-1/3 -right-24 z-0" />

      {/* Top Shop Banner (Vibrant Cyber Glass) */}
      <header className="backdrop-blur-xl bg-[#080b14]/80 border-b border-white/10 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-grad rounded-2xl flex items-center justify-center text-white font-black shadow-[0_6px_20px_rgba(255,46,99,0.4)] shrink-0">
              <Printer className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base sm:text-lg font-black text-white font-head tracking-tight">{shop.name}</h1>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-pink-400" /> {shop.city} • Ph: {shop.phone}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-7 relative z-10">
        {/* Live Active Order Status & Payment Banner (No Exit Page) */}
        {placedOrder && (
          <div className="card bg-gradient-to-br from-[#0d1326] via-[#14122d] to-[#0c101d] border-2 border-emerald-500/40 rounded-3xl p-5 sm:p-7 shadow-[0_12px_40px_rgba(34,197,94,0.18)] space-y-5 animate-in fade-in duration-300 relative overflow-hidden">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(34,197,94,0.3)] shrink-0">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="badge text-[10px] font-black uppercase tracking-wider py-0.5 px-2.5 border-emerald-500/30 bg-emerald-500/20 text-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Order Active & Queued
                    </span>
                    <span className="font-mono text-sm font-black text-white">{placedOrder.orderNumber}</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Live Status: <span className="font-bold text-pink-400 uppercase">{placedOrder.status.replace('_', ' ')}</span> • {placedOrder.pageCount} Pages • {placedOrder.copies} {placedOrder.copies === 1 ? 'Copy' : 'Copies'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto">
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Amount</p>
                  <p className="text-2xl font-black text-white font-head grad">₹{placedOrder.totalAmount.toFixed(2)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPlacedOrder(null);
                    setFileQueue([]);
                    setOnlineUpiSuccess(false);
                  }}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
                  title="Dismiss order banner"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Payment Row / Razorpay Standard Checkout */}
            {isPaid ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-emerald-950/30 border border-emerald-500/40 p-4 sm:p-5 rounded-2xl">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
                    <Check className="w-5 h-5 stroke-[3]" /> Payment Verified via Razorpay & Dispatched to Printer!
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Aapka order automatically printer queue me chala gaya hai. Print machine se turant collect karein.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPlacedOrder(null);
                    setFileQueue([]);
                    setOnlineUpiSuccess(false);
                  }}
                  className="btn btn-primary py-2.5 px-5 text-xs font-black shadow-[0_4px_16px_rgba(255,46,99,0.35)] flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  Naya Print / Upload Karein
                </button>
              </div>
            ) : (
              <div className="space-y-5 bg-gradient-to-br from-[#0c1830] via-[#0f172a] to-[#0a1120] p-5 sm:p-6 rounded-2xl border-2 border-sky-500/40 shadow-[0_8px_30px_rgba(14,165,233,0.15)]">
                {/* Gateway Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/30 shrink-0">
                      <CreditCard className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-black text-white font-head">Razorpay Standard Checkout</h4>
                        <span className="badge text-[10px] font-black uppercase tracking-wider py-0.5 px-2.5 bg-sky-500/20 text-sky-300 border border-sky-500/40">
                          100% Online & Live
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        UPI (Google Pay • PhonePe • Paytm • BHIM) • Debit/Credit Cards • Netbanking
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 bg-white/[0.04] sm:bg-transparent px-4 py-2.5 sm:p-0 rounded-xl border border-white/5 sm:border-0">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Payable:</span>
                    <span className="text-3xl font-black text-white font-mono grad font-head">₹{placedOrder.totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Main Razorpay Action Button */}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handlePayWithRazorpay}
                    disabled={isRazorpayLoading}
                    className="w-full btn bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black py-4 px-6 rounded-2xl shadow-[0_8px_25px_rgba(2,132,199,0.35)] flex items-center justify-center gap-3 text-sm font-head cursor-pointer transition transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                  >
                    {isRazorpayLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Opening Razorpay Secure Checkout...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5 fill-white" />
                        <span>Pay ₹{placedOrder.totalAmount.toFixed(2)} with Razorpay</span>
                        <ArrowRight className="w-5 h-5 ml-auto" />
                      </>
                    )}
                  </button>

                  {razorpayMessage && (
                    <div
                      className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
                        razorpayMessage.type === 'error'
                          ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                          : razorpayMessage.type === 'success'
                          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                          : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                      }`}
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{razorpayMessage.text}</span>
                    </div>
                  )}
                </div>

                {/* Assurance Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-300">
                    <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>256-bit Encrypted Checkout</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-300">
                    <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Instant Auto-Print on Pay</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-300">
                    <Check className="w-4 h-4 text-teal-400 shrink-0" />
                    <span>Direct Machine Spooling</span>
                  </div>
                </div>

                {/* Footer Assurance */}
                <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 text-sky-400 font-bold">
                    <ShieldCheck className="w-4 h-4 shrink-0" /> Razorpay Standard Web Checkout
                  </span>
                  <span className="text-[11px] text-slate-400 text-right">
                    Payment complete hote hi printer automatic chalu ho jayega (Zero counter wait)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Service Selector: 2 Clean Options (Document & ID Card) */}
        <div className="grid grid-cols-2 p-1.5 bg-white/[0.04] border border-white/10 rounded-2xl max-w-xl mx-auto shadow-inner text-xs font-black gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('document')}
            className={`py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 transition cursor-pointer text-[11px] sm:text-xs font-black text-center ${
              activeTab === 'document'
                ? 'bg-grad text-white shadow-[0_8px_25px_rgba(255,46,99,0.35)]'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">📄 Document & Photo Print (A4)</span>
            <span className="sm:hidden">📄 Document Print</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('id_card')}
            className={`py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 transition cursor-pointer text-[11px] sm:text-xs font-black text-center ${
              activeTab === 'id_card'
                ? 'bg-grad text-white shadow-[0_8px_25px_rgba(255,46,99,0.35)]'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">🪪 ID Card 2-in-1 Sheet (A4)</span>
            <span className="sm:hidden">🪪 ID Card Sheet</span>
          </button>
        </div>

        {/* Tab 2: ID Card Arranger Tool */}
        {activeTab === 'id_card' && (
          <PhotoIdCardTool onReadyToPrint={handleIdCardReady} />
        )}

        {/* Tab 1: Multi-file Print & Phone Editing Portal */}
        {activeTab === 'document' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Upload & Multi-file List */}
            <div className="lg:col-span-7 space-y-6">
              {/* 1. Multi-file Upload Box */}
              <div className="card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 font-head">
                      <Upload className="w-4 h-4 text-pink-400" /> 1. Upload Documents & Photos
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ek saath 5–10 files bhejein (PDF + photo mix) — ek payment, sahi order me print.
                    </p>
                  </div>
                  <span className="badge text-[11px] font-bold">
                    {fileQueue.length} files
                  </span>
                </div>

                {/* Single Unified Upload Dropzone (Tap or Drag & Drop) */}
                <div
                  onClick={() => document.getElementById('multi-upload')?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handleMultipleFilesSelected({ target: { files: e.dataTransfer.files } } as any);
                    }
                  }}
                  className="border-2 border-dashed border-pink-500/35 hover:border-pink-500/75 rounded-3xl p-6 sm:p-8 text-center transition bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer group shadow-inner"
                >
                  <input
                    type="file"
                    id="multi-upload"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                    className="hidden"
                    onChange={handleMultipleFilesSelected}
                    disabled={isBulkUploading}
                  />

                  <div className="space-y-4">
                    <div className="w-14 h-14 bg-grad text-white rounded-2xl flex items-center justify-center mx-auto shadow-[0_8px_24px_rgba(255,46,99,0.35)] group-hover:scale-105 transition transform">
                      <Upload className="w-7 h-7 stroke-[2.5]" />
                    </div>

                    <div>
                      <p className="text-base sm:text-lg font-black text-white font-head">
                        Tap or Drag & Drop Documents / Photos Here
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        PDF, JPG, PNG sabhi format supported hain • Single ya Multiple Files
                      </p>
                    </div>

                    <div className="pt-1">
                      <span className="btn btn-primary py-2.5 px-6 text-xs font-black shadow-lg shadow-pink-500/30 inline-flex items-center gap-2 pointer-events-none">
                        <Plus className="w-4 h-4 stroke-[3]" /> Choose Files or Snap Photos
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-300 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" /> Word ya Excel ko PDF bana kar upload karein
                    </div>
                  </div>
                </div>

                {/* Selected Files Queue List with Editing Action */}
                {fileQueue.length > 0 && (
                  <div className="space-y-2.5 pt-2">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-300">
                      Print Queue Order ({fileQueue.length} Files):
                    </p>
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {fileQueue.map((item, index) => {
                        const isImage = item.type.startsWith('image/');

                        return (
                          <div
                            key={item.id}
                            className={`rounded-2xl p-3 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                              item.uploadError
                                ? 'bg-rose-500/10 border-rose-500/30'
                                : item.isUploading
                                ? 'bg-blue-500/10 border-blue-500/30'
                                : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center gap-3 truncate min-w-0">
                              <span className="w-6 h-6 rounded-lg bg-white/10 text-white font-black text-xs flex items-center justify-center shrink-0">
                                {index + 1}
                              </span>

                              {isImage && item.previewUrl ? (
                                <img
                                  src={item.previewUrl}
                                  alt={item.name}
                                  className="w-10 h-10 object-cover rounded-xl border border-white/10 shrink-0"
                                />
                              ) : (
                                <div className="p-2.5 bg-pink-500/15 text-pink-300 border border-pink-500/20 rounded-xl shrink-0">
                                  <FileText className="w-5 h-5" />
                                </div>
                              )}

                              <div className="truncate">
                                <p className="text-xs font-bold text-white truncate">{item.name}</p>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                                  {item.uploadError ? (
                                    <span className="text-rose-400 font-bold flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" /> {item.uploadError}
                                    </span>
                                  ) : item.isUploading ? (
                                    <span className="text-pink-400 font-bold flex items-center gap-1">
                                      <RefreshCw className="w-3 h-3 animate-spin" /> Uploading...
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                      {item.pageCount} {item.pageCount === 1 ? 'Page' : 'Pages'} • {(item.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                                    </span>
                                  )}
                                  {item.pageRange && item.pageRange !== 'all' && (
                                    <span className="text-violet-300 font-bold bg-violet-500/20 border border-violet-500/30 px-1.5 py-0.2 rounded text-[10px]">
                                      {item.pageRange}
                                    </span>
                                  )}
                                  {item.rotation && item.rotation > 0 ? (
                                    <span className="text-pink-300 font-bold bg-pink-500/20 border border-pink-500/30 px-1.5 py-0.2 rounded text-[10px]">
                                      {item.rotation}°
                                    </span>
                                  ) : null}
                                  {item.isEdited && (
                                    <span className="text-cyan-300 font-bold bg-cyan-500/20 border border-cyan-500/30 px-1.5 py-0.2 rounded text-[10px]">
                                      Edited
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Actions: Retry (if error), Edit (if image), Reorder, Delete */}
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                              {item.uploadError && (
                                <button
                                  type="button"
                                  onClick={() => handleRetryUpload(item.id)}
                                  className="px-2.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                                >
                                  <RefreshCw className="w-3 h-3" /> Retry
                                </button>
                              )}

                              {/* Image Editor button (Crop, Rotate, Brightness) */}
                              {isImage && !item.uploadError && (
                                <button
                                  type="button"
                                  onClick={() => setEditingItem(item)}
                                  className="px-3 py-1.5 bg-gradient-to-r from-cyan-500/15 to-blue-500/15 hover:from-cyan-500/25 hover:to-blue-500/25 text-cyan-300 rounded-xl text-xs font-black transition flex items-center gap-1.5 border border-cyan-500/30 cursor-pointer shadow-xs"
                                  title="Browser me crop, rotate aur brightness live adjust karein"
                                >
                                  <Crop className="w-3.5 h-3.5" />
                                  <span>Crop, Rotate & Edit</span>
                                </button>
                              )}

                              {/* Document / PDF Editor button (Crop, Rotate, Brightness, Pages) */}
                              {!isImage && !item.uploadError && (
                                <button
                                  type="button"
                                  onClick={() => setEditingDocItem(item)}
                                  className="px-3 py-1.5 bg-gradient-to-r from-pink-500/15 to-purple-500/15 hover:from-pink-500/25 hover:to-purple-500/25 text-pink-300 rounded-xl text-xs font-black transition flex items-center gap-1.5 border border-pink-500/30 cursor-pointer shadow-xs"
                                  title="PDF pages ko crop, rotate aur brightness live adjust karein"
                                >
                                  <Crop className="w-3.5 h-3.5" />
                                  <span>Crop, Rotate & Edit</span>
                                </button>
                              )}

                              {/* Re-order arrows */}
                              {fileQueue.length > 1 && (
                                <div className="flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    disabled={index === 0}
                                    onClick={() => handleMoveFile(index, 'up')}
                                    className="p-1.5 text-slate-400 hover:text-white disabled:opacity-20 rounded hover:bg-white/5 transition cursor-pointer"
                                    title="Move Up"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    type="button"
                                    disabled={index === fileQueue.length - 1}
                                    onClick={() => handleMoveFile(index, 'down')}
                                    className="p-1.5 text-slate-400 hover:text-white disabled:opacity-20 rounded hover:bg-white/5 transition cursor-pointer"
                                    title="Move Down"
                                  >
                                    ▼
                                  </button>
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => handleRemoveFile(item.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition cursor-pointer"
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
              <form onSubmit={handleSubmitBatchOrder} id="print-order-form" className="card space-y-6">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 font-head">
                  <Printer className="w-4 h-4 text-pink-400" /> 2. Print Preferences
                </h3>

                {/* Color Mode */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">Print Colour</label>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setColorMode('bw')}
                      className={`p-2.5 sm:p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                        colorMode === 'bw'
                          ? 'border-pink-500 bg-pink-500/15 text-white shadow-[0_0_20px_rgba(255,46,99,0.25)]'
                          : 'border-white/10 hover:border-white/20 bg-white/[0.02] text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 pr-1">
                        <p className="text-[11px] sm:text-xs font-black font-head truncate">Black & White (B&W)</p>
                        <p className="text-[10px] sm:text-[11px] text-slate-400 font-normal mt-0.5">₹{pricing?.bwSinglePrice} / page</p>
                      </div>
                      {colorMode === 'bw' && <CheckCircle2 className="w-4 h-4 text-pink-400 shrink-0" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setColorMode('color')}
                      className={`p-2.5 sm:p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                        colorMode === 'color'
                          ? 'border-pink-500 bg-pink-500/15 text-white shadow-[0_0_20px_rgba(255,46,99,0.25)]'
                          : 'border-white/10 hover:border-white/20 bg-white/[0.02] text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 pr-1">
                        <p className="text-[11px] sm:text-xs font-black font-head truncate">Full Colour</p>
                        <p className="text-[10px] sm:text-[11px] text-slate-400 font-normal mt-0.5">₹{pricing?.colorSinglePrice} / page</p>
                      </div>
                      {colorMode === 'color' && <CheckCircle2 className="w-4 h-4 text-pink-400 shrink-0" />}
                    </button>
                  </div>
                </div>

                {/* Duplex Mode */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">Sides</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setDuplexMode('single')}
                      className={`p-2.5 sm:p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                        duplexMode === 'single'
                          ? 'border-violet-500 bg-violet-500/15 text-white shadow-[0_0_20px_rgba(124,92,255,0.25)]'
                          : 'border-white/10 hover:border-white/20 bg-white/[0.02] text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 pr-1">
                        <p className="text-[11px] sm:text-xs font-black font-head">Single-Sided</p>
                        <p className="text-[10px] sm:text-[11px] text-slate-400 font-normal mt-0.5">Standard 1 side per sheet</p>
                      </div>
                      {duplexMode === 'single' && <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDuplexMode('duplex')}
                      className={`p-2.5 sm:p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                        duplexMode === 'duplex'
                          ? 'border-violet-500 bg-violet-500/15 text-white shadow-[0_0_20px_rgba(124,92,255,0.25)]'
                          : 'border-white/10 hover:border-white/20 bg-white/[0.02] text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 pr-1">
                        <p className="text-[11px] sm:text-xs font-black font-head">Double-Sided (Duplex)</p>
                        <p className="text-[10px] sm:text-[11px] text-slate-400 font-normal mt-0.5">Both sides of sheet</p>
                      </div>
                      {duplexMode === 'duplex' && <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />}
                    </button>
                  </div>
                </div>

                {/* Copies & Paper Size */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Number of Sets / Copies</label>
                    <div className="flex items-center border border-white/10 rounded-xl overflow-hidden bg-white/[0.04]">
                      <button
                        type="button"
                        onClick={() => setCopies(Math.max(1, copies - 1))}
                        className="px-4 py-2.5 text-slate-300 hover:text-white hover:bg-white/5 font-black cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={copies}
                        onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full text-center text-sm font-black text-white bg-transparent focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setCopies(copies + 1)}
                        className="px-4 py-2.5 text-slate-300 hover:text-white hover:bg-white/5 font-black cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Paper Size</label>
                    <div className="w-full py-2.5 px-3 border border-white/10 rounded-xl text-xs font-bold text-slate-200 bg-white/[0.04] flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-pink-400" /> A4 Standard (210 × 297 mm)
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Locked</span>
                    </div>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Your Name (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full py-2.5 px-3 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">WhatsApp / Phone (Optional)</label>
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full py-2.5 px-3 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>

                {/* Special Instructions */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Special Instructions (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Staple on top-left, print in sequence"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    className="w-full py-2.5 px-3 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={fileQueue.length === 0 || isSubmitting || isBulkUploading}
                  className={`btn btn-primary w-full py-4 text-sm font-black disabled:opacity-40 disabled:pointer-events-none cursor-pointer`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" /> Submitting Order...
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-5 h-5 stroke-[2.5]" /> Place Order & Pay with Razorpay • ₹{total.toFixed(2)}
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Right Column: Price Breakdown Card */}
            <div className="lg:col-span-5 space-y-6">
              <div className="card sticky top-24 space-y-4">
                <h3 className="text-sm font-black text-white uppercase tracking-wider pb-3 border-b border-white/10 flex items-center justify-between font-head">
                  <span>Price Calculation</span>
                  <span className="badge text-[10px] text-pink-300 font-mono">{fileQueue.length} files</span>
                </h3>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Total Pages in Queue:</span>
                    <span className="font-black text-white font-mono">{totalPages} Pages</span>
                  </div>

                  <div className="flex justify-between text-slate-300">
                    <span>Copies / Sets:</span>
                    <span className="font-black text-white font-mono">{copies}</span>
                  </div>

                  <div className="flex justify-between text-slate-300">
                    <span>Color Mode:</span>
                    <span className="font-bold uppercase text-pink-300">{colorMode}</span>
                  </div>

                  <div className="flex justify-between text-slate-300">
                    <span>Printing Sides:</span>
                    <span className="font-bold uppercase text-violet-300">{duplexMode}</span>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-baseline justify-between">
                    <span className="text-sm font-black text-white">Total Price:</span>
                    <span className="text-3xl font-black grad font-head font-mono">₹{total.toFixed(2)}</span>
                  </div>

                  {/* Payment Gateway Badge */}
                  <div className="p-3 bg-gradient-to-r from-sky-500/10 via-blue-500/10 to-indigo-500/10 rounded-2xl border border-sky-500/20 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-black text-sky-300">
                        <CreditCard className="w-3.5 h-3.5 text-sky-400" />
                        Razorpay Standard Checkout
                      </span>
                      <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        100% Online Payment
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      UPI (GPay • PhonePe • Paytm • BHIM), Cards & Netbanking. Amount pre-loaded, printer auto-starts on payment.
                    </p>
                  </div>
                </div>

                {/* Features Highlights like website */}
                <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/[0.06] space-y-2 text-[11px] text-slate-400">
                  <p className="flex items-center gap-2 font-medium text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    No WhatsApp or Pen Drive required
                  </p>
                  <p className="flex items-center gap-2 font-medium text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    Private & Secure — files auto-purged after printing
                  </p>
                  <p className="flex items-center gap-2 font-medium text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    Auto-print directly from your phone to shop counter
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Floating Sticky Checkout Bar (Zero-friction mobile checkout) */}
      {!placedOrder && fileQueue.length > 0 && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#080d1a]/95 backdrop-blur-xl border-t border-emerald-500/30 p-3.5 shadow-[0_-10px_35px_rgba(0,0,0,0.85)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Total ({totalPages} pgs)</p>
              <p className="text-xl font-black text-white font-head grad">₹{total.toFixed(2)}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const form = document.getElementById('print-order-form') as HTMLFormElement;
                if (form) form.requestSubmit();
              }}
              disabled={fileQueue.length === 0 || isSubmitting || isBulkUploading}
              className="btn bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white font-black py-3 px-5 text-xs rounded-xl shadow-lg shadow-emerald-500/30 flex items-center gap-2 cursor-pointer disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" /> Pay with Razorpay • ₹{total.toFixed(2)}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Phone Se Hi Editing Modal (Crop, Rotate, Brightness for Images) */}
      {editingItem && (
        <ImageEditorModal
          isOpen={Boolean(editingItem)}
          imageUrl={editingItem.previewUrl}
          fileName={editingItem.name}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveEditedImage}
        />
      )}

      {/* Phone Se Hi Document/PDF Editing Modal (Page Range, Exclude Pages, Rotate, Notes) */}
      {editingDocItem && (
        <DocumentEditorModal
          isOpen={Boolean(editingDocItem)}
          file={editingDocItem.file}
          fileName={editingDocItem.name}
          initialPageCount={editingDocItem.pageCount}
          initialRotation={editingDocItem.rotation || 0}
          initialPageRange={editingDocItem.pageRange || 'all'}
          initialExcludedPages={editingDocItem.excludedPages || []}
          initialNotes={editingDocItem.customNotes || ''}
          onClose={() => setEditingDocItem(null)}
          onSave={handleSaveEditedDocument}
        />
      )}
    </div>
  );
};
