import React, { useState, useRef, useEffect } from 'react';
import {
  RotateCw,
  Sun,
  Contrast,
  Crop,
  Check,
  X,
  Sparkles,
  Sliders,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface ImageEditorModalProps {
  imageUrl: string;
  fileName: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (editedBlob: Blob, previewUrl: string) => void;
}

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
  imageUrl,
  fileName,
  isOpen,
  onClose,
  onSave,
}) => {
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [brightness, setBrightness] = useState<number>(0); // -50 to +50
  const [contrast, setContrast] = useState<number>(0); // -50 to +50
  const [aspectRatio, setAspectRatio] = useState<'free' | '1:1' | '4:3' | '3:4' | '16:9' | 'passport'>('free');
  const [isProcessing, setIsProcessing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setRotation(0);
    setBrightness(0);
    setContrast(0);
    setAspectRatio('free');
  }, [isOpen, imageUrl]);

  useEffect(() => {
    if (!isOpen || !imageUrl) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Determine canvas size based on rotation
      const isSideways = rotation === 90 || rotation === 270;
      const targetW = isSideways ? img.height : img.width;
      const targetH = isSideways ? img.width : img.height;

      // Handle aspect ratio crop simulation
      let srcX = 0;
      let srcY = 0;
      let srcW = img.width;
      let srcH = img.height;

      if (aspectRatio === '1:1') {
        const size = Math.min(img.width, img.height);
        srcX = (img.width - size) / 2;
        srcY = (img.height - size) / 2;
        srcW = size;
        srcH = size;
      } else if (aspectRatio === '3:4' || aspectRatio === 'passport') {
        const ratio = 3 / 4;
        if (img.width / img.height > ratio) {
          srcW = img.height * ratio;
          srcX = (img.width - srcW) / 2;
        } else {
          srcH = img.width / ratio;
          srcY = (img.height - srcH) / 2;
        }
      } else if (aspectRatio === '4:3') {
        const ratio = 4 / 3;
        if (img.width / img.height > ratio) {
          srcW = img.height * ratio;
          srcX = (img.width - srcW) / 2;
        } else {
          srcH = img.width / ratio;
          srcY = (img.height - srcH) / 2;
        }
      }

      canvas.width = isSideways ? srcH : srcW;
      canvas.height = isSideways ? srcW : srcH;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      // Translate to center for rotation
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      // Filters
      ctx.filter = `brightness(${100 + brightness}%) contrast(${100 + contrast}%)`;

      // Draw image
      ctx.drawImage(
        img,
        srcX,
        srcY,
        srcW,
        srcH,
        -srcW / 2,
        -srcH / 2,
        srcW,
        srcH
      );

      ctx.restore();
    };
    img.src = imageUrl;
  }, [isOpen, imageUrl, rotation, brightness, contrast, aspectRatio]);

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full text-white shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Crop className="w-4 h-4 text-cyan-400" /> Phone Se Hi Editing: {fileName}
            </h3>
            <p className="text-xs text-slate-400">Crop, rotate, aur brightness adjust karein upload se pehle</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Canvas Preview Area */}
        <div className="p-4 sm:p-6 bg-slate-950 flex items-center justify-center min-h-[300px] max-h-[50vh] overflow-hidden">
          <canvas
            ref={canvasRef}
            className="max-h-[46vh] max-w-full rounded-xl shadow-lg border border-slate-800 object-contain"
          />
        </div>

        {/* Toolbar Controls */}
        <div className="p-6 bg-slate-900 border-t border-slate-800 space-y-5">
          {/* Preset Buttons & Rotation */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700/60 text-xs">
              <span className="text-[11px] font-bold text-slate-400 px-2 uppercase">Aspect Ratio:</span>
              <button
                type="button"
                onClick={() => setAspectRatio('free')}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                  aspectRatio === 'free' ? 'bg-cyan-500 text-slate-950 shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                Original
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio('passport')}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                  aspectRatio === 'passport' ? 'bg-cyan-500 text-slate-950 shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                Passport (3:4)
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio('1:1')}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                  aspectRatio === '1:1' ? 'bg-cyan-500 text-slate-950 shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                1:1 Square
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio('4:3')}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                  aspectRatio === '4:3' ? 'bg-cyan-500 text-slate-950 shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                Landscape 4:3
              </button>
            </div>

            <button
              type="button"
              onClick={() => setRotation((prev) => (prev + 90) % 360)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <RotateCw className="w-4 h-4 text-cyan-400" /> Rotate 90° ({rotation}°)
            </button>
          </div>

          {/* Sliders: Brightness & Contrast */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <Sun className="w-3.5 h-3.5 text-amber-400" /> Brightness
                </span>
                <span className="font-mono text-cyan-400 font-bold">{brightness > 0 ? `+${brightness}` : brightness}</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                value={brightness}
                onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <Contrast className="w-3.5 h-3.5 text-indigo-400" /> Contrast
                </span>
                <span className="font-mono text-cyan-400 font-bold">{contrast > 0 ? `+${contrast}` : contrast}</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                value={contrast}
                onChange={(e) => setContrast(parseInt(e.target.value, 10))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyChanges}
              disabled={isProcessing}
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-cyan-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              {isProcessing ? 'Processing...' : 'Apply & Save Edits'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
