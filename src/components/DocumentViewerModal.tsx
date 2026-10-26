import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minimize2,
  FileText,
  AlertCircle,
  RefreshCw,
  Printer
} from 'lucide-react';

// Configure pdfjs worker
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch (e) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  } catch (err) {
    console.warn('PDF.js worker setup note:', err);
  }
}

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Either a local File or a remote URL (with optional auth token)
  file?: File | null;
  previewUrl?: string | null;
  fileName: string;
  mimeType?: string;
  orderNumber?: string;
  copies?: number;
  colorMode?: 'bw' | 'color';
  paperSize?: string;
  duplexMode?: string;
  onApprove?: () => void;
  onPrint?: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  onClose,
  file,
  previewUrl,
  fileName,
  mimeType = '',
  orderNumber,
  copies,
  colorMode,
  paperSize,
  duplexMode,
  onApprove,
  onPrint,
}) => {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // PDF State
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [zoomScale, setZoomScale] = useState<number>(1.2);
  const [rotation, setRotation] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Image State
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  const isPdf =
    mimeType.includes('pdf') ||
    fileName.toLowerCase().endsWith('.pdf');

  const isImage =
    mimeType.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif)$/i.test(fileName);

  // Reset states on open or change
  useEffect(() => {
    if (!isOpen) {
      if (imageObjectUrl && imageObjectUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageObjectUrl);
      }
      setImageObjectUrl(null);
      setPdfDoc(null);
      setLoading(true);
      setErrorMessage(null);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setCurrentPage(1);
    setRotation(0);
    setZoomScale(1.2);

    let active = true;

    async function loadDocument() {
      try {
        let arrayBuffer: ArrayBuffer;

        if (file) {
          if (isImage) {
            const url = URL.createObjectURL(file);
            setImageObjectUrl(url);
            setLoading(false);
            return;
          }
          arrayBuffer = await file.arrayBuffer();
        } else if (previewUrl) {
          if (isImage) {
            setImageObjectUrl(previewUrl);
            setLoading(false);
            return;
          }
          // Fetch PDF arraybuffer safely with auth header if available
          const token = localStorage.getItem('printqr_auth_token');
          const headers: Record<string, string> = {};
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          const res = await fetch(previewUrl, { headers });
          if (!res.ok) {
            throw new Error(`Failed to load document (${res.status} ${res.statusText})`);
          }
          arrayBuffer = await res.arrayBuffer();
        } else {
          // Waiting for previewUrl or file to become available
          setLoading(true);
          return;
        }

        if (!active) return;

        if (isPdf) {
          const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/cmaps/',
            cMapPacked: true,
          });

          const doc = await loadingTask.promise;
          if (!active) return;

          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setLoading(false);
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        if (!active) return;
        console.error('Document preview error:', err);
        setErrorMessage(err.message || 'Unable to render document preview.');
        setLoading(false);
      }
    }

    loadDocument();

    return () => {
      active = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore cancel error
        }
      }
    };
  }, [isOpen, file, previewUrl, fileName, mimeType]);

  // Render current PDF page whenever pdfDoc, currentPage, zoomScale, or rotation changes
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !isOpen) return;

    let isCancelled = false;

    async function renderPage() {
      try {
        if (renderTaskRef.current) {
          try {
            await renderTaskRef.current.cancel();
          } catch {
            // ignore
          }
        }

        const page = await pdfDoc.getPage(currentPage);
        if (isCancelled || !canvasRef.current) return;

        const viewport = page.getViewport({ scale: zoomScale, rotation });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + 'px';
        canvas.style.height = Math.floor(viewport.height) + 'px';

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        const renderContext = {
          canvasContext: ctx,
          viewport,
          transform,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('PDF Page render warning:', err);
        }
      }
    }

    renderPage();

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, currentPage, zoomScale, rotation, isOpen]);

  // Safe direct file download without opening blocked tabs
  const handleDownload = async () => {
    try {
      if (file) {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else if (previewUrl) {
        const res = await fetch(previewUrl);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e: any) {
      alert(`Download failed: ${e.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[100] flex flex-col bg-slate-950/90 backdrop-blur-sm transition-all duration-200 ${
        isFullscreen ? 'p-0' : 'p-2 sm:p-6'
      }`}
    >
      <div
        className={`flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl mx-auto w-full transition-all ${
          isFullscreen ? 'h-full rounded-none border-none' : 'max-w-5xl h-[92vh]'
        }`}
      >
        {/* Top Navbar */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-4 shrink-0">
          {/* File info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                {fileName}
              </h3>
              <p className="text-xs text-slate-400 truncate">
                {orderNumber && <span className="text-blue-400 font-semibold">{orderNumber} • </span>}
                {isPdf && totalPages > 0 ? `${totalPages} Pages • ` : ''}
                {colorMode ? (colorMode === 'color' ? 'Full Colour' : 'B&W') : ''}
                {paperSize ? ` • ${paperSize}` : ''}
                {copies ? ` • ${copies} Copies` : ''}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700">
              <button
                type="button"
                onClick={() => setZoomScale((z) => Math.max(0.6, Number((z - 0.2).toFixed(1))))}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-300 px-2 min-w-[48px] text-center">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomScale((z) => Math.min(3.0, Number((z + 0.2).toFixed(1))))}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition ml-1"
                title="Rotate 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {/* Direct Safe Download */}
            <button
              type="button"
              onClick={handleDownload}
              className="p-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
              title="Download File Safely"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Save</span>
            </button>

            {/* Action buttons if passed from dashboard */}
            {onApprove && (
              <button
                type="button"
                onClick={() => {
                  onApprove();
                  onClose();
                }}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                Approve Order
              </button>
            )}

            {onPrint && (
              <button
                type="button"
                onClick={() => {
                  onPrint();
                  onClose();
                }}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            )}

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition hidden md:block"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-rose-900/40 rounded-xl transition"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Viewport Area */}
        <div className="flex-1 overflow-auto bg-slate-950 p-4 flex items-center justify-center relative select-none">
          {loading ? (
            <div className="text-center py-12 text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" />
              <p className="text-xs font-semibold">Rendering high-resolution document preview...</p>
            </div>
          ) : errorMessage ? (
            <div className="max-w-md p-6 bg-slate-900 rounded-2xl border border-rose-900/50 text-center space-y-4">
              <div className="w-12 h-12 bg-rose-950/60 text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-800/40">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">Document Preview Unavailable</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{errorMessage}</p>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 mx-auto"
              >
                <Download className="w-4 h-4" /> Download Original Document
              </button>
            </div>
          ) : isPdf ? (
            <div className="my-auto flex flex-col items-center justify-center">
              <div
                className="bg-white rounded-lg shadow-2xl overflow-hidden border border-slate-700 transition-transform duration-100"
                style={{
                  transform: `scale(1)`,
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                }}
              >
                <canvas ref={canvasRef} className="block" />
              </div>
            </div>
          ) : isImage && imageObjectUrl ? (
            <div className="my-auto max-w-full max-h-full flex items-center justify-center p-2">
              <img
                src={imageObjectUrl}
                alt={fileName}
                style={{
                  transform: `scale(${zoomScale}) rotate(${rotation}deg)`,
                  transition: 'transform 0.15s ease-out',
                  maxHeight: isFullscreen ? '85vh' : '72vh',
                }}
                className="max-w-full object-contain rounded-lg shadow-2xl border border-slate-800 bg-white"
              />
            </div>
          ) : (
            <div className="text-center text-slate-400 p-8 space-y-3">
              <FileText className="w-12 h-12 mx-auto text-blue-400" />
              <p className="text-sm font-bold text-white">{fileName}</p>
              <p className="text-xs text-slate-500">File format ready for printing</p>
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
              >
                Download File
              </button>
            </div>
          )}
        </div>

        {/* Bottom Pagination Bar for Multi-Page PDFs */}
        {isPdf && totalPages > 1 && !loading && (
          <div className="bg-slate-900 border-t border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs text-slate-300 shrink-0">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1 transition"
            >
              <ChevronLeft className="w-4 h-4" /> Previous Page
            </button>

            <div className="flex items-center gap-2 font-semibold">
              <span>Page</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={currentPage}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (val >= 1 && val <= totalPages) setCurrentPage(val);
                }}
                className="w-12 py-1 px-1.5 text-center bg-slate-800 border border-slate-700 text-white rounded-lg font-bold text-xs"
              />
              <span>of {totalPages}</span>
            </div>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1 transition"
            >
              Next Page <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
