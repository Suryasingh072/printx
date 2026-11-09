import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  RotateCw,
  RotateCcw,
  Sun,
  Contrast,
  Crop,
  Check,
  X,
  Sliders,
  ZoomIn,
  ZoomOut,
  FlipHorizontal,
  FlipVertical,
  Rotate3D,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface ImageEditorModalProps {
  imageUrl: string;
  fileName: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (editedBlob: Blob, previewUrl: string) => void;
}

type CropPreset = 'custom' | 'a4' | 'original';

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
  imageUrl,
  fileName,
  isOpen,
  onClose,
  onSave,
}) => {
  // Editing state
  const [rotation, setRotation] = useState<number>(0); // in degrees: 0, 90, 180, 270
  const [fineAngle, setFineAngle] = useState<number>(0); // -45 to +45
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [brightness, setBrightness] = useState<number>(0); // -100 to +100
  const [contrast, setContrast] = useState<number>(0); // -100 to +100
  const [saturation, setSaturation] = useState<number>(100); // 0 (B&W) to 200 (Vivid)

  // Custom Manual Crop & Framing
  const [cropPreset, setCropPreset] = useState<CropPreset>('custom');
  const [cropTop, setCropTop] = useState<number>(0); // 0% to 50%
  const [cropBottom, setCropBottom] = useState<number>(0); // 0% to 50%
  const [cropLeft, setCropLeft] = useState<number>(0); // 0% to 50%
  const [cropRight, setCropRight] = useState<number>(0); // 0% to 50%

  const [zoom, setZoom] = useState<number>(1); // 1x to 3x
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'crop' | 'adjust' | 'rotate'>('crop');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageObjRef = useRef<HTMLImageElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Reset controls when a new image is loaded
  useEffect(() => {
    if (!isOpen) return;
    setRotation(0);
    setFineAngle(0);
    setFlipH(false);
    setFlipV(false);
    setBrightness(0);
    setContrast(0);
    setSaturation(100);
    setCropPreset('custom');
    setCropTop(0);
    setCropBottom(0);
    setCropLeft(0);
    setCropRight(0);
    setZoom(1);
    setPanX(0);
    setPanY(0);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageObjRef.current = img;
      renderCanvas();
    };
    img.src = imageUrl;
  }, [isOpen, imageUrl]);

  // Main canvas render function with live preview
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageObjRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Total rotation angle
    const totalAngle = (rotation + fineAngle) % 360;
    const rad = (totalAngle * Math.PI) / 180;

    // Calculate bounding box after rotation
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    const rotatedW = img.width * cos + img.height * sin;
    const rotatedH = img.width * sin + img.height * cos;

    // Determine target canvas dimensions according to crop preset
    let targetW = rotatedW;
    let targetH = rotatedH;

    if (cropPreset === 'a4') {
      const ratio = 1 / 1.414; // A4 portrait
      if (rotatedW / rotatedH > ratio) {
        targetW = rotatedH * ratio;
        targetH = rotatedH;
      } else {
        targetW = rotatedW;
        targetH = rotatedW / ratio;
      }
    } else if (cropPreset === 'custom') {
      // Free manual crop based on user's custom edge adjustments
      const visibleW = Math.max(0.1, 1 - (cropLeft + cropRight) / 100);
      const visibleH = Math.max(0.1, 1 - (cropTop + cropBottom) / 100);
      targetW = rotatedW * visibleW;
      targetH = rotatedH * visibleH;
    } else {
      // Full original
      targetW = rotatedW;
      targetH = rotatedH;
    }

    // Set canvas dimensions
    canvas.width = Math.round(targetW);
    canvas.height = Math.round(targetH);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply CSS filters for Brightness, Contrast, Saturation
    ctx.filter = `brightness(${100 + brightness}%) contrast(${100 + contrast}%) saturate(${saturation}%)`;

    ctx.save();

    // Translate to center of canvas with pan and custom crop offsets
    const cropOffsetX = cropPreset === 'custom' ? ((cropRight - cropLeft) / 200) * rotatedW : 0;
    const cropOffsetY = cropPreset === 'custom' ? ((cropBottom - cropTop) / 200) * rotatedH : 0;

    ctx.translate(canvas.width / 2 + panX + cropOffsetX, canvas.height / 2 + panY + cropOffsetY);

    // Apply scale for zoom and flips
    const scaleX = (flipH ? -1 : 1) * zoom;
    const scaleY = (flipV ? -1 : 1) * zoom;
    ctx.scale(scaleX, scaleY);

    // Apply rotation
    ctx.rotate(rad);

    // Draw the image centered
    ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);

    ctx.restore();
  }, [rotation, fineAngle, flipH, flipV, brightness, contrast, saturation, cropPreset, cropTop, cropBottom, cropLeft, cropRight, zoom, panX, panY]);

  // Re-render whenever parameters change
  useEffect(() => {
    if (isOpen && imageObjRef.current) {
      renderCanvas();
    }
  }, [isOpen, renderCanvas]);

  // Mouse / Touch Drag to Pan when zoomed
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

  // Mobile Touch Pan Handlers (smooth zero-lag finger panning on smartphones)
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.touches[0].clientX - panX, y: e.touches[0].clientY - panY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || e.touches.length !== 1) return;
    setPanX(e.touches[0].clientX - dragStartRef.current.x);
    setPanY(e.touches[0].clientY - dragStartRef.current.y);
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
  };

  const handleApplyChanges = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsProcessing(true);
    canvas.toBlob(
      (blob) => {
        setIsProcessing(false);
        if (blob) {
          const previewUrl = URL.createObjectURL(blob);
          onSave(blob, previewUrl);
          onClose();
        }
      },
      'image/jpeg',
      0.95
    );
  };

  const handleResetAll = () => {
    setRotation(0);
    setFineAngle(0);
    setFlipH(false);
    setFlipV(false);
    setBrightness(0);
    setContrast(0);
    setSaturation(100);
    setCropPreset('custom');
    setCropTop(0);
    setCropBottom(0);
    setCropLeft(0);
    setCropRight(0);
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#0c101d] border border-white/15 rounded-3xl max-w-4xl w-full text-white shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-grad grid place-items-center shadow-[0_4px_16px_rgba(255,46,99,0.35)] shrink-0">
              <Crop className="w-5 h-5 text-white stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white font-head tracking-tight truncate max-w-xs sm:max-w-md">
                  Edit & Crop: {fileName}
                </h3>
                <span className="badge text-[10px] font-black uppercase tracking-wider py-0.5 px-2 border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                  Live Preview
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Crop, rotate, and adjust brightness with live preview right inside the browser.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetAll}
              className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-xl border border-white/10 hover:bg-white/5 transition flex items-center gap-1 cursor-pointer"
              title="Reset all adjustments"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewport Canvas Area with Checkered Transparency Grid */}
        <div
          className="p-4 sm:p-6 bg-[#050810] flex items-center justify-center min-h-[300px] flex-1 overflow-hidden relative select-none"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #090d19 25%, transparent 25%), linear-gradient(-45deg, #090d19 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #090d19 75%), linear-gradient(-45deg, transparent 75%, #090d19 75%)',
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px',
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            className={`touch-none max-h-[36vh] sm:max-h-[44vh] max-w-full rounded-xl shadow-2xl border border-white/10 object-contain ${
              zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
            }`}
          />

          {/* Floating Zoom Indicator */}
          {zoom > 1 && (
            <div className="absolute bottom-3 left-4 bg-black/70 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-mono font-bold text-cyan-300 border border-white/10">
              Zoom: {Math.round(zoom * 100)}% (Drag with finger or mouse)
            </div>
          )}
        </div>

        {/* Controls Sub-tabs */}
        <div className="border-t border-white/10 bg-white/[0.02] px-3 sm:px-6 pt-2.5 pb-2 flex gap-1.5 sm:gap-2 overflow-x-auto">
          {[
            { id: 'crop', label: 'Crop & Ratio', icon: Crop },
            { id: 'rotate', label: 'Rotate & Flip', icon: RotateCw },
            { id: 'adjust', label: 'Brightness & Colors', icon: Sun },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 sm:px-4 py-2 text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-grad text-white shadow-[0_4px_16px_rgba(255,46,99,0.3)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Panel */}
        <div className="p-4 sm:p-6 bg-[#0c101d] space-y-4">
          {/* TAB 1: CROP & ASPECT RATIO */}
          {activeTab === 'crop' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-head">
                  Crop Selection Mode:
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Zoom:</span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10"
                    title="Zoom Out"
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
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'custom', label: '✂️ Manual Free Crop', sub: 'Apne hisaab se crop karein' },
                  { id: 'a4', label: '📄 A4 Sheet', sub: 'Standard Document Fit' },
                  { id: 'original', label: '📐 Full Original', sub: 'Poori photo bina cut' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setCropPreset(preset.id as CropPreset)}
                    className={`p-2.5 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                      cropPreset === preset.id
                        ? 'border-pink-500 bg-pink-500/15 text-pink-300 shadow-[0_2px_12px_rgba(255,46,99,0.25)]'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <p className="text-xs font-black">{preset.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{preset.sub}</p>
                  </button>
                ))}
              </div>

              {/* Manual Crop Margin Cut Controls */}
              {cropPreset === 'custom' && (
                <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                    <span className="flex items-center gap-1.5 text-pink-300">
                      <Crop className="w-3.5 h-3.5" /> Manual Crop Edges (Kinare Cut Karein):
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setCropTop(5);
                          setCropBottom(5);
                          setCropLeft(5);
                          setCropRight(5);
                        }}
                        className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[10px] font-bold text-slate-200 cursor-pointer"
                        title="Remove image borders"
                      >
                        Trim Borders (5%)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCropTop(0);
                          setCropBottom(50);
                          setCropLeft(0);
                          setCropRight(0);
                        }}
                        className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[10px] font-bold text-slate-200 cursor-pointer"
                        title="Keep upper portion"
                      >
                        Top Half
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCropTop(50);
                          setCropBottom(0);
                          setCropLeft(0);
                          setCropRight(0);
                        }}
                        className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[10px] font-bold text-slate-200 cursor-pointer"
                        title="Keep lower portion"
                      >
                        Bottom Half
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCropTop(0);
                          setCropBottom(0);
                          setCropLeft(0);
                          setCropRight(0);
                        }}
                        className="px-2 py-1 rounded-lg bg-pink-500/20 text-pink-300 hover:bg-pink-500/30 text-[10px] font-bold cursor-pointer"
                        title="Reset all edge cuts"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {/* Top Margin */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-300">
                        <span>⬆️ Top Cut:</span>
                        <span className="font-mono text-pink-400 font-bold">{cropTop}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={cropTop}
                        onChange={(e) => setCropTop(parseInt(e.target.value, 10))}
                        className="w-full accent-pink-500 cursor-pointer"
                      />
                    </div>

                    {/* Bottom Margin */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-300">
                        <span>⬇️ Bottom Cut:</span>
                        <span className="font-mono text-pink-400 font-bold">{cropBottom}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={cropBottom}
                        onChange={(e) => setCropBottom(parseInt(e.target.value, 10))}
                        className="w-full accent-pink-500 cursor-pointer"
                      />
                    </div>

                    {/* Left Margin */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-300">
                        <span>⬅️ Left Cut:</span>
                        <span className="font-mono text-pink-400 font-bold">{cropLeft}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={cropLeft}
                        onChange={(e) => setCropLeft(parseInt(e.target.value, 10))}
                        className="w-full accent-pink-500 cursor-pointer"
                      />
                    </div>

                    {/* Right Margin */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-300">
                        <span>➡️ Right Cut:</span>
                        <span className="font-mono text-pink-400 font-bold">{cropRight}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={cropRight}
                        onChange={(e) => setCropRight(parseInt(e.target.value, 10))}
                        className="w-full accent-pink-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="text-[11px] text-slate-400 italic">
                💡 Tip: Ungli ya mouse se drag karke crop position adjust karein
              </div>
            </div>
          )}

          {/* TAB 2: ROTATE & FLIP */}
          {activeTab === 'rotate' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-head">
                  Quick 90° Turn & Mirror:
                </span>
                <span className="font-mono text-xs font-bold text-pink-400">
                  Total Angle: {(rotation + fineAngle) % 360}°
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                  className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 hover:text-white flex items-center justify-center gap-2 cursor-pointer transition"
                >
                  <RotateCcw className="w-4 h-4 text-violet-400" /> Rotate -90°
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 hover:text-white flex items-center justify-center gap-2 cursor-pointer transition"
                >
                  <RotateCw className="w-4 h-4 text-pink-400" /> Rotate +90°
                </button>
                <button
                  type="button"
                  onClick={() => setFlipH((f) => !f)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                    flipH
                      ? 'bg-pink-500/20 border-pink-500 text-pink-300'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200 hover:text-white'
                  }`}
                >
                  <FlipHorizontal className="w-4 h-4 text-cyan-400" /> Flip Horizontal
                </button>
                <button
                  type="button"
                  onClick={() => setFlipV((f) => !f)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                    flipV
                      ? 'bg-pink-500/20 border-pink-500 text-pink-300'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200 hover:text-white'
                  }`}
                >
                  <FlipVertical className="w-4 h-4 text-emerald-400" /> Flip Vertical
                </button>
              </div>

              {/* Fine angle straightening slider */}
              <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-pink-400" /> Fine Angle Straightener (For skewed phone scans):
                  </span>
                  <span className="font-mono text-pink-400 font-bold">{fineAngle > 0 ? `+${fineAngle}°` : `${fineAngle}°`}</span>
                </div>
                <input
                  type="range"
                  min="-45"
                  max="45"
                  value={fineAngle}
                  onChange={(e) => setFineAngle(parseInt(e.target.value, 10))}
                  className="w-full accent-pink-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 3: BRIGHTNESS, CONTRAST, SATURATION */}
          {activeTab === 'adjust' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Brightness */}
              <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Sun className="w-4 h-4 text-amber-400" /> Brightness
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

              {/* Contrast */}
              <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Contrast className="w-4 h-4 text-violet-400" /> Contrast
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

              {/* Saturation */}
              <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-cyan-400" /> Saturation
                  </span>
                  <span className="font-mono text-cyan-400 font-bold">{saturation}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={saturation}
                  onChange={(e) => setSaturation(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Bottom Actions Bar */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost py-2.5 px-5 text-xs font-bold text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyChanges}
              disabled={isProcessing}
              className="btn btn-primary py-2.5 px-7 text-xs font-black shadow-[0_4px_20px_rgba(255,46,99,0.4)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              {isProcessing ? 'Processing High-Res Image...' : 'Apply & Save Edits'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
