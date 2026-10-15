import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  X,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Check,
  Eye,
  Sliders,
  Sparkles,
  Info
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
  const [rangeMode, setRangeMode] = useState<'all' | 'custom'>(initialPageRange === 'all' ? 'all' : 'custom');
  const [customRangeInput, setCustomRangeInput] = useState(initialPageRange === 'all' ? '' : initialPageRange);
  const [excludedPages, setExcludedPages] = useState<number[]>(initialExcludedPages);
  const [notes, setNotes] = useState(initialNotes);
  const [totalPages, setTotalPages] = useState<number>(initialPageCount || 1);
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load and render PDF page thumbnails
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
        const count = pdf.numPages;
        setTotalPages(count);

        const thumbs: PageThumbnail[] = Array.from({ length: count }, (_, i) => ({
          pageNumber: i + 1,
          isLoading: true,
        }));
        setThumbnails(thumbs);

        // Render each page thumbnail (up to first 12 pages for fast responsive preview)
        const renderLimit = Math.min(count, 12);
        for (let p = 1; p <= renderLimit; p++) {
          if (!isMounted) break;
          try {
            const page = await pdf.getPage(p);
            const viewport = page.getViewport({ scale: 0.3 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              await (page.render as any)({ canvasContext: ctx, viewport, canvas }).promise;
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
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

  if (!isOpen) return null;

  // Toggle inclusion of a single page
  const handleTogglePage = (pageNum: number) => {
    setExcludedPages((prev) => {
      if (prev.includes(pageNum)) {
        return prev.filter((p) => p !== pageNum);
      } else {
        // Prevent excluding all pages
        if (prev.length >= totalPages - 1) {
          alert('Kam se kam ek page print ke liye select hona zaroori hai.');
          return prev;
        }
        return [...prev, pageNum];
      }
    });
  };

  // Quick range helper
  const handleApplyRangePreset = (preset: 'all' | 'first' | 'odd' | 'even') => {
    if (preset === 'all') {
      setRangeMode('all');
      setExcludedPages([]);
      setCustomRangeInput('');
    } else if (preset === 'first') {
      setRangeMode('custom');
      const excluded = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p !== 1);
      setExcludedPages(excluded);
      setCustomRangeInput('1');
    } else if (preset === 'odd') {
      setRangeMode('custom');
      const excluded = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 0);
      setExcludedPages(excluded);
      setCustomRangeInput('Odd Pages');
    } else if (preset === 'even') {
      setRangeMode('custom');
      const excluded = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 !== 0);
      if (excluded.length === totalPages) {
        alert('Is document me koi even page nahi hai.');
        return;
      }
      setExcludedPages(excluded);
      setCustomRangeInput('Even Pages');
    }
  };

  // Calculate effective printed pages
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3 truncate">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h3 className="text-base font-black text-white truncate flex items-center gap-2">
                Edit Document Print Options
              </h3>
              <p className="text-xs text-slate-400 truncate">
                {fileName} • {totalPages} {totalPages === 1 ? 'Page' : 'Pages'} total
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* 1. Document Name & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                Document Display Name
              </label>
              <input
                type="text"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                className="w-full py-2.5 px-3 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 text-xs"
                placeholder="e.g. Aadhaar Card Copy"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                Orientation / Rotation
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                  className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCw className="w-4 h-4 text-blue-400" />
                  Rotate 90° ({rotation}°)
                </button>
                {rotation !== 0 && (
                  <button
                    type="button"
                    onClick={() => setRotation(0)}
                    className="py-2.5 px-3 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 rounded-xl font-semibold transition cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2. Page Range Selector & Exclude Pages */}
          <div className="space-y-3 p-4 bg-slate-950/50 border border-slate-800/80 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-blue-400" /> Select Pages to Print
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Jo page print nahi karna use tap karke uncheck karein (Aapko sirf selected pages ka charge lagega).
                </p>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleApplyRangePreset('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    excludedPages.length === 0
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  All ({totalPages})
                </button>
                {totalPages > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleApplyRangePreset('first')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        excludedPages.length === totalPages - 1 && !excludedPages.includes(1)
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Page 1 Only
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyRangePreset('odd')}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      Odd Pages
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Interactive Page Thumbnails Grid */}
            <div className="pt-2">
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
                          ? 'bg-blue-950/40 border-blue-500/60 shadow-sm'
                          : 'bg-slate-900 border-slate-800 opacity-40 hover:opacity-70'
                      }`}
                    >
                      {/* Page Preview Thumbnail */}
                      <div className="w-full aspect-[210/297] bg-white rounded-lg overflow-hidden flex items-center justify-center border border-slate-700 shadow-inner">
                        {thumb?.dataUrl ? (
                          <img
                            src={thumb.dataUrl}
                            alt={`Page ${pageNum}`}
                            style={{ transform: `rotate(${rotation}deg)` }}
                            className="w-full h-full object-contain transition-transform"
                          />
                        ) : (
                          <div className="text-slate-500 font-mono text-[10px]">
                            {thumb?.isLoading ? 'Loading...' : `P. ${pageNum}`}
                          </div>
                        )}
                      </div>

                      {/* Checkbox badge */}
                      <div className="mt-1.5 flex items-center gap-1 text-[11px] font-bold">
                        {!isExcluded ? (
                          <span className="text-blue-400 flex items-center gap-1">
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
            </div>

            {/* Effective Print Summary Note */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
              <span>
                Selected to Print: <strong className="text-white font-black">{effectivePageCount}</strong> of {totalPages} Pages
              </span>
              {excludedPages.length > 0 && (
                <span className="text-amber-400 font-semibold">
                  ({excludedPages.length} {excludedPages.length === 1 ? 'page' : 'pages'} skipped)
                </span>
              )}
            </div>
          </div>

          {/* 3. Special Instructions for this file */}
          <div>
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
              Specific Instructions for this File (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Print landscape, high quality form, staple page 1"
              className="w-full py-2.5 px-3 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 text-xs"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="text-xs">
            <span className="text-slate-400">Final Pages: </span>
            <span className="font-black text-white text-sm">{effectivePageCount} Pages</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition cursor-pointer text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndApply}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-black transition cursor-pointer shadow-lg shadow-blue-500/25 flex items-center gap-2 text-xs"
            >
              <CheckCircle2 className="w-4 h-4" /> Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
