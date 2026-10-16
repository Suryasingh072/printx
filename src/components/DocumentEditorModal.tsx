import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  X,
  RotateCw,
  RotateCcw,
  CheckCircle2,
  FileText,
  Check,
  Eye,
  Sliders,
  Sun,
  Contrast,
  Crop,
  ZoomIn,
  ZoomOut,
  FlipHorizontal,
  FlipVertical,
  Sparkles,
  RefreshCw,
  Layers,
  ArrowRight,
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

interface DocumentEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File;
  fileName: string;
  initialPageCount: number;
  initialRotation?: number;
  initialPageRange?: string;
  initialExcludedPages?: number[];
  initialNotes?: string;
  onSave: (edits: {
    name: string;
    pageCount: number;
    rotation: number;
    pageRange: string;
    excludedPages: number[];
    customNotes?: string;
  }) => void;
}

interface PageThumbnail {
  pageNumber: number;
  dataUrl?: string;
  isLoading: boolean;
}

type AspectRatioPreset = 'free' | 'a4' | '1:1' | '3:4' | '4:3' | '16:9';

export const DocumentEditorModal: React.FC<DocumentEditorModalProps> = ({
  isOpen,
  onClose,
  file,
  fileName,
  initialPageCount,
  initialRotation = 0,
  initialPageRange = 'all',
  initialExcludedPages = [],
  initialNotes = '',
  onSave,
}) => {
  const [docName, setDocName] = useState(fileName);
  const [rotation, setRotation] = useState<number>(initialRotation);
  const [fineAngle, setFineAngle] = useState<number>(0); // -45 to +45
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [brightness, setBrightness] = useState<number>(0); // -100 to +100
  const [contrast, setContrast] = useState<number>(0); // -100 to +100
  const [saturation, setSaturation] = useState<number>(100); // 0 to 200
  const [aspectRatio, setAspectRatio] = useState<AspectRatioPreset>('a4');
  const [zoom, setZoom] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);

  const [activeTab, setActiveTab] = useState<'edit' | 'pages'>('edit');
  const [selectedPageNum, setSelectedPageNum] = useState<number>(1);
  const [excludedPages, setExcludedPages] = useState<number[]>(initialExcludedPages);
  const [notes, setNotes] = useState(initialNotes);
  const [totalPages, setTotalPages] = useState<number>(initialPageCount || 1);
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentImageRef = useRef<HTMLImageElement | null>(null);
  const pdfDocRef = useRef<any>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Load PDF and render thumbnails
  useEffect(() => {
    if (!isOpen || !file) return;

    let isMounted = true;
    setLoadingPdf(true);
    setLoadError(null);

    const loadPages = async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        if (!isMounted) return;
        pdfDocRef.current = pdf;
        const count = pdf.numPages;
        setTotalPages(count);

        const thumbs: PageThumbnail[] = Array.from({ length: count }, (_, i) => ({
          pageNumber: i + 1,
          isLoading: true,
        }));
        setThumbnails(thumbs);

        // Load page 1 into editor first
        loadHighResPage(1, pdf);

        // Render thumbnails for selection list
        const renderLimit = Math.min(count, 18);
        for (let p = 1; p <= renderLimit; p++) {
          if (!isMounted) break;
          try {
            const page = await pdf.getPage(p);
            const viewport = page.getViewport({ scale: 0.35 });
            const c = document.createElement('canvas');
            c.width = viewport.width;
            c.height = viewport.height;
            const ctx = c.getContext('2d');
            if (ctx) {
              await (page.render as any)({ canvasContext: ctx, viewport, canvas: c }).promise;
              const dataUrl = c.toDataURL('image/jpeg', 0.85);
              if (isMounted) {
                setThumbnails((prev) =>
                  prev.map((t) => (t.pageNumber === p ? { ...t, dataUrl, isLoading: false } : t))
                );
              }
            }
          } catch (pageErr) {
            console.warn(`Could not render thumbnail for page ${p}:`, pageErr);
          }
        }
      } catch (err: any) {
        console.error('Failed to load PDF in editor modal:', err);
        if (isMounted) {
          setLoadError('PDF preview could not be generated, but page settings can still be edited.');
        }
      } finally {
        if (isMounted) setLoadingPdf(false);
      }
    };

    loadPages();

    return () => {
      isMounted = false;
    };
  }, [isOpen, file]);

  // Load a single page at high resolution onto the interactive canvas
  const loadHighResPage = async (pageNum: number, customPdf?: any) => {
    const pdf = customPdf || pdfDocRef.current;
    if (!pdf) return;

    try {
      setSelectedPageNum(pageNum);
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 }); // High-res for editing
      const c = document.createElement('canvas');
      c.width = viewport.width;
      c.height = viewport.height;
      const ctx = c.getContext('2d');
      if (ctx) {
        await (page.render as any)({ canvasContext: ctx, viewport, canvas: c }).promise;
        const img = new Image();
        img.onload = () => {
          currentImageRef.current = img;
          renderLiveCanvas();
        };
        img.src = c.toDataURL('image/png');
      }
    } catch (e) {
      console.warn('Could not load high-res page:', e);
    }
  };

  // Live Canvas Rendering with Crop, Rotate, Brightness, Contrast & Zoom
  const renderLiveCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = currentImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const totalAngle = (rotation + fineAngle) % 360;
    const rad = (totalAngle * Math.PI) / 180;

    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    const rotatedW = img.width * cos + img.height * sin;
    const rotatedH = img.width * sin + img.height * cos;

    let targetW = rotatedW;
    let targetH = rotatedH;

    if (aspectRatio === 'a4') {
      const ratio = 1 / 1.414; // Standard A4 ratio
      if (rotatedW / rotatedH > ratio) {
        targetW = rotatedH * ratio;
        targetH = rotatedH;
      } else {
        targetW = rotatedW;
        targetH = rotatedW / ratio;
      }
    } else if (aspectRatio === '1:1') {
      const minDim = Math.min(rotatedW, rotatedH);
      targetW = minDim;
      targetH = minDim;
    } else if (aspectRatio === '3:4') {
      const ratio = 3 / 4;
      if (rotatedW / rotatedH > ratio) {
        targetW = rotatedH * ratio;
        targetH = rotatedH;
      } else {
        targetW = rotatedW;
        targetH = rotatedW / ratio;
      }
    } else if (aspectRatio === '4:3') {
      const ratio = 4 / 3;
      if (rotatedW / rotatedH > ratio) {
        targetW = rotatedH * ratio;
        targetH = rotatedH;
      } else {
        targetW = rotatedW;
        targetH = rotatedW / ratio;
      }
    } else if (aspectRatio === '16:9') {
      const ratio = 16 / 9;
      if (rotatedW / rotatedH > ratio) {
        targetW = rotatedH * ratio;
        targetH = rotatedH;
      } else {
        targetW = rotatedW;
        targetH = rotatedW / ratio;
      }
    }

    canvas.width = Math.round(targetW);
    canvas.height = Math.round(targetH);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply Live CSS Filters for Brightness, Contrast & Saturation
    ctx.filter = `brightness(${100 + brightness}%) contrast(${100 + contrast}%) saturate(${saturation}%)`;

    ctx.save();
    ctx.translate(canvas.width / 2 + panX, canvas.height / 2 + panY);

    const scaleX = (flipH ? -1 : 1) * zoom;
    const scaleY = (flipV ? -1 : 1) * zoom;
    ctx.scale(scaleX, scaleY);

    ctx.rotate(rad);
    ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
    ctx.restore();
  }, [rotation, fineAngle, flipH, flipV, brightness, contrast, saturation, aspectRatio, zoom, panX, panY]);

  useEffect(() => {
    if (isOpen && currentImageRef.current) {
      renderLiveCanvas();
    }
  }, [isOpen, renderLiveCanvas]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - panX, y: e.clientY - panY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    setPanX(e.clientX - dragStartRef.current.x);
    setPanY(e.clientY - dragStartRef.current.y);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Toggle exclusion of a single page
  const handleTogglePage = (pageNum: number) => {
    setExcludedPages((prev) => {
      if (prev.includes(pageNum)) {
        return prev.filter((p) => p !== pageNum);
      } else {
        if (prev.length >= totalPages - 1) {
          alert('Kam se kam ek page print ke liye select hona zaroori hai.');
          return prev;
        }
        return [...prev, pageNum];
      }
    });
  };

  const handleApplyRangePreset = (preset: 'all' | 'first' | 'odd' | 'even') => {
    if (preset === 'all') {
      setExcludedPages([]);
    } else if (preset === 'first') {
      const excluded = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p !== 1);
      setExcludedPages(excluded);
    } else if (preset === 'odd') {
      const excluded = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 0);
      setExcludedPages(excluded);
    } else if (preset === 'even') {
      const excluded = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 !== 0);
      if (excluded.length === totalPages) {
        alert('Is document me koi even page nahi hai.');
        return;
      }
      setExcludedPages(excluded);
    }
  };

  const handleResetAdjustments = () => {
    setRotation(0);
    setFineAngle(0);
    setFlipH(false);
    setFlipV(false);
    setBrightness(0);
    setContrast(0);
    setSaturation(100);
    setAspectRatio('a4');
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  // Preset: High-Contrast Crisp B&W Document
  const handleCleanDocumentPreset = () => {
    setBrightness(15);
    setContrast(45);
    setSaturation(0); // Crisp pure B&W
  };

  const effectivePageCount = Math.max(1, totalPages - excludedPages.length);

  const handleSaveAndApply = () => {
    onSave({
      name: docName.trim() || fileName,
      pageCount: effectivePageCount,
      rotation,
      pageRange: excludedPages.length > 0 ? `${effectivePageCount} of ${totalPages} pages` : 'all',
      excludedPages,
      customNotes: notes.trim() || undefined,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-[#0c101d] border border-white/15 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3 truncate">
            <div className="w-10 h-10 rounded-xl bg-grad grid place-items-center shadow-[0_4px_16px_rgba(255,46,99,0.35)] shrink-0">
              <Crop className="w-5 h-5 text-white stroke-[2.2]" />
            </div>
            <div className="truncate">
              <h3 className="text-base font-black text-white font-head tracking-tight truncate flex items-center gap-2">
                Edit & Crop Document: {fileName}
              </h3>
              <p className="text-xs text-slate-400 truncate">
                Crop, rotate, and adjust brightness with live preview right inside the browser • {totalPages} {totalPages === 1 ? 'Page' : 'Pages'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetAdjustments}
              className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-xl border border-white/10 hover:bg-white/5 transition flex items-center gap-1 cursor-pointer"
              title="Reset all adjustments"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reset
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-white/10 bg-white/[0.02] px-6 pt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'edit'
                ? 'bg-grad text-white shadow-[0_4px_16px_rgba(255,46,99,0.3)]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Crop className="w-3.5 h-3.5" />
            Crop, Rotate & Brightness (Live Preview)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pages')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'pages'
                ? 'bg-grad text-white shadow-[0_4px_16px_rgba(255,46,99,0.3)]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Select Pages ({effectivePageCount}/{totalPages})
          </button>
        </div>

        {/* Modal Body */}
        {activeTab === 'edit' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Live Interactive Viewport */}
            <div
              className="p-4 sm:p-5 bg-[#050810] flex items-center justify-center min-h-[260px] flex-1 overflow-hidden relative select-none"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, #090d19 25%, transparent 25%), linear-gradient(-45deg, #090d19 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #090d19 75%), linear-gradient(-45deg, transparent 75%, #090d19 75%)',
                backgroundSize: '24px 24px',
                backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px',
              }}
            >
              {loadingPdf ? (
                <div className="text-center space-y-2">
                  <div className="w-8 h-8 border-3 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">Loading Page {selectedPageNum}...</p>
                </div>
              ) : (
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className={`max-h-[38vh] max-w-full rounded-xl shadow-2xl border border-white/10 object-contain ${
                    zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                  }`}
                />
              )}

              {/* Floating Page Indicator */}
              <div className="absolute top-3 left-4 bg-black/75 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-mono font-bold text-pink-300 border border-white/10">
                Viewing Page {selectedPageNum} of {totalPages}
              </div>

              {/* Quick Clean Document Button */}
              <button
                type="button"
                onClick={handleCleanDocumentPreset}
                className="absolute top-3 right-4 bg-gradient-to-r from-pink-500/20 to-purple-500/20 hover:from-pink-500/30 hover:to-purple-500/30 text-pink-300 border border-pink-500/30 px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer backdrop-blur-md"
                title="Boost contrast & remove grey shadows for clean black & white printing"
              >
                <Sparkles className="w-3.5 h-3.5 text-pink-400" /> Clean Document B&W
              </button>
            </div>

            {/* Editing Controls Bar */}
            <div className="p-5 bg-[#0c101d] border-t border-white/10 space-y-4 max-h-[34vh] overflow-y-auto">
              {/* Row 1: Page Picker (if multi-page) */}
              {totalPages > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                  <span className="text-slate-400 font-bold shrink-0">Select Page:</span>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => loadHighResPage(p)}
                      className={`px-3 py-1 rounded-lg font-bold shrink-0 transition cursor-pointer ${
                        selectedPageNum === p
                          ? 'bg-pink-500 text-white shadow-xs'
                          : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      Page {p}
                    </button>
                  ))}
                </div>
              )}

              {/* Row 2: Crop Aspect Ratio & Zoom */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 px-2 uppercase">Ratio:</span>
                  {[
                    { id: 'a4', label: 'A4 Sheet' },
                    { id: 'free', label: 'Original' },
                    { id: '1:1', label: '1:1 Square' },
                    { id: '3:4', label: '3:4 Card' },
                    { id: '4:3', label: '4:3 Photo' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setAspectRatio(preset.id as AspectRatioPreset)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                        aspectRatio === preset.id
                          ? 'bg-pink-500 text-white shadow-xs'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Zoom:</span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-xs font-bold text-cyan-400 w-10 text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Row 3: Rotation & Flips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                  className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-violet-400" /> Rotate -90°
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5 text-pink-400" /> Rotate +90° ({rotation}°)
                </button>
                <button
                  type="button"
                  onClick={() => setFlipH((f) => !f)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    flipH ? 'bg-pink-500/20 border-pink-500 text-pink-300' : 'bg-white/5 border-white/10 text-slate-300'
                  }`}
                >
                  <FlipHorizontal className="w-3.5 h-3.5 text-cyan-400" /> Flip H
                </button>
                <button
                  type="button"
                  onClick={() => setFlipV((f) => !f)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    flipV ? 'bg-pink-500/20 border-pink-500 text-pink-300' : 'bg-white/5 border-white/10 text-slate-300'
                  }`}
                >
                  <FlipVertical className="w-3.5 h-3.5 text-emerald-400" /> Flip V
                </button>
              </div>

              {/* Row 4: Brightness & Contrast Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                      <Sun className="w-3.5 h-3.5 text-amber-400" /> Brightness
                    </span>
                    <span className="font-mono text-pink-400 font-bold">{brightness > 0 ? `+${brightness}%` : `${brightness}%`}</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                    className="w-full accent-pink-500 cursor-pointer"
                  />
                </div>

                <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                      <Contrast className="w-3.5 h-3.5 text-violet-400" /> Contrast
                    </span>
                    <span className="font-mono text-pink-400 font-bold">{contrast > 0 ? `+${contrast}%` : `${contrast}%`}</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={contrast}
                    onChange={(e) => setContrast(parseInt(e.target.value, 10))}
                    className="w-full accent-pink-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Page Selection & Notes */}
        {activeTab === 'pages' && (
          <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
            {/* Quick Presets */}
            <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10">
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider font-head">Page Print Range</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tap any page thumbnail to exclude/include. Selected: <strong className="text-white font-bold">{effectivePageCount}</strong> of {totalPages}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleApplyRangePreset('all')}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold"
                >
                  All ({totalPages})
                </button>
                {totalPages > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleApplyRangePreset('first')}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold"
                    >
                      P. 1 Only
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyRangePreset('odd')}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold"
                    >
                      Odd Pages
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Thumbnails Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-56 overflow-y-auto pr-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                const isExcluded = excludedPages.includes(pageNum);
                const thumb = thumbnails.find((t) => t.pageNumber === pageNum);

                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => handleTogglePage(pageNum)}
                    className={`relative flex flex-col items-center p-2 rounded-xl border text-center transition cursor-pointer ${
                      !isExcluded
                        ? 'bg-pink-950/30 border-pink-500/50 shadow-sm'
                        : 'bg-white/[0.02] border-white/10 opacity-30 hover:opacity-60'
                    }`}
                  >
                    <div className="w-full aspect-[210/297] bg-white rounded-lg overflow-hidden flex items-center justify-center border border-white/20 shadow-inner">
                      {thumb?.dataUrl ? (
                        <img
                          src={thumb.dataUrl}
                          alt={`Page ${pageNum}`}
                          style={{ transform: `rotate(${rotation}deg)` }}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="text-slate-500 font-mono text-[10px]">P. {pageNum}</div>
                      )}
                    </div>

                    <div className="mt-1.5 text-[11px] font-bold">
                      {!isExcluded ? (
                        <span className="text-pink-400 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 stroke-[3]" /> Page {pageNum}
                        </span>
                      ) : (
                        <span className="text-slate-500">Skip P.{pageNum}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Document display name and notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Document Display Name
                </label>
                <input
                  type="text"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className="w-full py-2.5 px-3 bg-white/5 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Specific Print Instructions (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Print landscape, high quality, staple top left"
                  className="w-full py-2.5 px-3 bg-white/5 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="text-xs">
            <span className="text-slate-400">Pages to Print: </span>
            <span className="font-black text-white text-sm font-head text-pink-300">
              {effectivePageCount} Pages
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost py-2.5 px-5 text-xs font-bold text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndApply}
              className="btn btn-primary py-2.5 px-6 text-xs font-black shadow-[0_4px_20px_rgba(255,46,99,0.4)] flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" /> Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
