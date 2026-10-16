import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Layers,
  Sparkles,
  Printer,
  Eye,
  Sun,
  Contrast,
  RotateCcw,
  CheckCircle2,
  Trash2,
  FileCheck2,
} from 'lucide-react';

interface PhotoIdCardToolProps {
  onReadyToPrint: (preparedFile: { file: File; orderType: 'id_card' | 'photo'; previewUrl: string }) => void;
}

export const PhotoIdCardTool: React.FC<PhotoIdCardToolProps> = ({ onReadyToPrint }) => {
  // ID Card State
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<'side_by_side' | 'stacked'>('stacked');
  const [copiesOnSheet, setCopiesOnSheet] = useState<number>(1);
  const [showBorderLines, setShowBorderLines] = useState<boolean>(true);

  // Adjustments
  const [brightness, setBrightness] = useState<number>(0); // -50 to +50
  const [contrast, setContrast] = useState<number>(0); // -30 to +30

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load sample demo ID images for instant testing
  const loadDemoCard = () => {
    const createSampleCardCanvas = (title: string, sub: string, color: string) => {
      const c = document.createElement('canvas');
      c.width = 600;
      c.height = 378;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 600, 378);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, 592, 370);

      // Header
      ctx.fillStyle = color;
      ctx.fillRect(4, 4, 592, 70);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(title, 24, 46);

      // Avatar placeholder
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(40, 110, 140, 180);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 110, 140, 180);
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('PHOTO', 80, 205);

      // Text lines
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('NAME: RAHUL KUMAR', 210, 140);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#334155';
      ctx.fillText('DOB: 14/08/1998', 210, 175);
      ctx.fillText('GENDER: MALE', 210, 210);
      ctx.fillText('CARD NO: 4920 8492 1092', 210, 245);
      ctx.fillStyle = '#64748b';
      ctx.font = 'italic 14px sans-serif';
      ctx.fillText(sub, 210, 280);

      return c.toDataURL('image/png');
    };

    setFrontImage(createSampleCardCanvas('GOVERNMENT IDENTITY CARD', 'Front Side Verification', '#ff2e63'));
    setBackImage(createSampleCardCanvas('RESIDENTIAL ADDRESS & QR', 'Back Side Address Proof', '#7c5cff'));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Please upload a valid image (JPG, PNG, or WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (side === 'front') setFrontImage(dataUrl);
      else setBackImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Render the A4 composite sheet whenever parameters change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // A4 Aspect Ratio at high resolution: 1240 x 1754 px (~150 DPI)
    canvas.width = 1240;
    canvas.height = 1754;

    // Background white A4 sheet
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply brightness & contrast filters
    ctx.filter = `brightness(${100 + brightness}%) contrast(${100 + contrast}%)`;

    // Standard card dimensions on A4: 85.6mm x 53.98mm (~505px x 318px)
    const cardW = 505;
    const cardH = 318;

    const renderCard = (imgSrc: string, x: number, y: number, label: string) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.drawImage(img, x, y, cardW, cardH);
          if (showBorderLines) {
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 5]); // cutting guideline dash
            ctx.strokeRect(x - 2, y - 2, cardW + 4, cardH + 4);
            ctx.setLineDash([]);
          }
          // Small sub-label
          ctx.fillStyle = '#94a3b8';
          ctx.font = '14px sans-serif';
          ctx.fillText(label, x, y - 8);
          resolve();
        };
        img.src = imgSrc;
      });
    };

    const renderSheet = async () => {
      const centerX = canvas.width / 2;

      if (frontImage && backImage) {
        if (layoutMode === 'stacked') {
          // Top and Bottom in center of upper half
          const startY = 160;
          await renderCard(frontImage, centerX - cardW / 2, startY, 'FRONT SIDE (85.6mm x 54mm)');
          await renderCard(backImage, centerX - cardW / 2, startY + cardH + 70, 'BACK SIDE (85.6mm x 54mm)');

          if (copiesOnSheet === 2) {
            const secondStartY = startY + (cardH * 2) + 160;
            await renderCard(frontImage, centerX - cardW / 2, secondStartY, 'FRONT SIDE (COPY 2)');
            await renderCard(backImage, centerX - cardW / 2, secondStartY + cardH + 70, 'BACK SIDE (COPY 2)');
          }
        } else {
          // Side by side
          const startY = 220;
          const gap = 40;
          const leftX = centerX - cardW - (gap / 2);
          const rightX = centerX + (gap / 2);

          await renderCard(frontImage, leftX, startY, 'FRONT SIDE');
          await renderCard(backImage, rightX, startY, 'BACK SIDE');

          if (copiesOnSheet === 2) {
            const secondY = startY + cardH + 120;
            await renderCard(frontImage, leftX, secondY, 'FRONT SIDE (COPY 2)');
            await renderCard(backImage, rightX, secondY, 'BACK SIDE (COPY 2)');
          }
        }
      } else if (frontImage) {
        // Single side
        const startY = 200;
        await renderCard(frontImage, centerX - cardW / 2, startY, 'FRONT SIDE');
      } else {
        // Placeholder preview
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 26px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Upload Front & Back card photos to preview A4 print sheet', centerX, 400);
        ctx.font = '18px sans-serif';
        ctx.fillText('Standard 85.6mm × 54mm ID Card Layout with Cutting Guidelines', centerX, 440);
      }
    };

    renderSheet();
  }, [frontImage, backImage, layoutMode, copiesOnSheet, showBorderLines, brightness, contrast]);

  const handleSendToPrint = async () => {
    const canvas = canvasRef.current;
    if (!canvas || (!frontImage && !backImage)) {
      alert('Please upload at least the front side of the ID card.');
      return;
    }

    setIsProcessing(true);
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          alert('Could not generate sheet image.');
          setIsProcessing(false);
          return;
        }

        const fileName = `ID_Card_A4_Sheet_${Date.now()}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });
        const previewUrl = URL.createObjectURL(blob);

        onReadyToPrint({
          file,
          orderType: 'id_card',
          previewUrl,
        });
        setIsProcessing(false);
      }, 'image/png');
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
    }
  };

  return (
    <div className="card space-y-6 border border-white/10 bg-[#0c101d]/90 backdrop-blur-xl shadow-2xl rounded-3xl p-5 sm:p-7 text-white relative overflow-hidden">
      {/* Background Decorative Accent Glow */}
      <div className="w-80 h-80 bg-[rgba(255,46,99,0.08)] blur-[100px] rounded-full pointer-events-none absolute -top-16 -right-16 z-0" />
      <div className="w-80 h-80 bg-[rgba(124,92,255,0.08)] blur-[100px] rounded-full pointer-events-none absolute -bottom-16 -left-16 z-0" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-grad grid place-items-center shadow-[0_4px_20px_rgba(255,46,99,0.35)] shrink-0">
            <Layers className="w-6 h-6 text-white stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-white font-head tracking-tight">ID Card 2-in-1 Sheet Arranger</h3>
              <span className="badge text-[10px] font-black uppercase tracking-wider py-0.5 px-2 border-pink-500/30 bg-pink-500/10 text-pink-300">
                A4 Paper
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Aadhaar, Voter ID, PAN ya Driving License ke Front & Back side ko A4 sheet par center align karein.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadDemoCard}
          className="btn btn-ghost py-2 px-3 text-xs font-bold border-pink-500/30 text-pink-300 hover:bg-pink-500/10 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-pink-400" />
          Load Sample Card
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        {/* Controls Column */}
        <div className="lg:col-span-5 space-y-6">
          {/* Step 1: Uploads */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-pink-300 uppercase tracking-wider font-head flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5 text-pink-400" /> 1. Upload Card Sides
            </h4>

            <div className="grid grid-cols-2 gap-3">
              {/* Front Side */}
              <div className="relative group border-2 border-dashed border-white/15 hover:border-pink-500/50 rounded-2xl p-3 text-center transition bg-white/[0.02] hover:bg-white/[0.04]">
                <input
                  type="file"
                  id="front-upload"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'front')}
                />
                {frontImage ? (
                  <div className="space-y-2">
                    <div className="relative rounded-xl overflow-hidden border border-white/15 aspect-[1.586/1]">
                      <img src={frontImage} alt="Front preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                        <label htmlFor="front-upload" className="px-2.5 py-1 bg-pink-500 text-white text-[11px] font-bold rounded-lg cursor-pointer hover:bg-pink-400">
                          Change
                        </label>
                        <button
                          type="button"
                          onClick={() => setFrontImage(null)}
                          className="p-1.5 bg-rose-500/80 text-white rounded-lg hover:bg-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Front Ready
                    </div>
                  </div>
                ) : (
                  <label htmlFor="front-upload" className="cursor-pointer block py-5">
                    <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center mx-auto mb-2 border border-pink-500/20 group-hover:scale-110 transition">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-white">Front Side</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Click to upload photo</p>
                  </label>
                )}
              </div>

              {/* Back Side */}
              <div className="relative group border-2 border-dashed border-white/15 hover:border-violet-500/50 rounded-2xl p-3 text-center transition bg-white/[0.02] hover:bg-white/[0.04]">
                <input
                  type="file"
                  id="back-upload"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'back')}
                />
                {backImage ? (
                  <div className="space-y-2">
                    <div className="relative rounded-xl overflow-hidden border border-white/15 aspect-[1.586/1]">
                      <img src={backImage} alt="Back preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                        <label htmlFor="back-upload" className="px-2.5 py-1 bg-violet-500 text-white text-[11px] font-bold rounded-lg cursor-pointer hover:bg-violet-400">
                          Change
                        </label>
                        <button
                          type="button"
                          onClick={() => setBackImage(null)}
                          className="p-1.5 bg-rose-500/80 text-white rounded-lg hover:bg-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Back Ready
                    </div>
                  </div>
                ) : (
                  <label htmlFor="back-upload" className="cursor-pointer block py-5">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center mx-auto mb-2 border border-violet-500/20 group-hover:scale-110 transition">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-white">Back Side</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Click to upload photo</p>
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: Sheet Layout Options */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-pink-300 uppercase tracking-wider font-head">2. Sheet Arrangement</h4>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLayoutMode('stacked')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  layoutMode === 'stacked'
                    ? 'bg-grad text-white border-pink-500 shadow-[0_4px_16px_rgba(255,46,99,0.3)]'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                Stacked (Top & Bottom)
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('side_by_side')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  layoutMode === 'side_by_side'
                    ? 'bg-grad text-white border-pink-500 shadow-[0_4px_16px_rgba(255,46,99,0.3)]'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                Side by Side (Horizontal)
              </button>
            </div>

            <div className="flex items-center justify-between text-xs bg-white/5 p-3 rounded-xl border border-white/10">
              <span className="font-semibold text-slate-300">Card Sets on A4 Sheet:</span>
              <div className="flex gap-1.5">
                {[1, 2].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCopiesOnSheet(num)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      copiesOnSheet === num
                        ? 'bg-pink-500 text-white shadow-xs'
                        : 'bg-white/10 text-slate-300 hover:bg-white/15'
                    }`}
                  >
                    {num} {num === 1 ? 'Single Set' : '2 Sets (Duplicate)'}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300 pt-1">
              <input
                type="checkbox"
                checked={showBorderLines}
                onChange={(e) => setShowBorderLines(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-pink-500 focus:ring-0 cursor-pointer accent-pink-500"
              />
              <span>Include dashed cutting guidelines & standard border</span>
            </label>
          </div>

          {/* Step 3: Photo Adjustments */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-pink-300 uppercase tracking-wider font-head">3. Image Adjustments</h4>
              {(brightness !== 0 || contrast !== 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setBrightness(0);
                    setContrast(0);
                  }}
                  className="text-[11px] text-pink-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              )}
            </div>

            <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-3">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-400" /> Brightness:
                  </span>
                  <span className="font-mono text-pink-400 font-bold">{brightness > 0 ? `+${brightness}%` : `${brightness}%`}</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={brightness}
                  onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                  className="w-full accent-pink-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Contrast className="w-3.5 h-3.5 text-violet-400" /> Contrast:
                  </span>
                  <span className="font-mono text-pink-400 font-bold">{contrast > 0 ? `+${contrast}%` : `${contrast}%`}</span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  value={contrast}
                  onChange={(e) => setContrast(parseInt(e.target.value, 10))}
                  className="w-full accent-pink-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Print Action */}
          <button
            type="button"
            disabled={!frontImage || isProcessing}
            onClick={handleSendToPrint}
            className={`w-full py-4 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 shadow-xl transition cursor-pointer ${
              frontImage && !isProcessing
                ? 'btn btn-primary shadow-[0_8px_25px_rgba(255,46,99,0.4)] hover:scale-[1.01]'
                : 'bg-white/10 text-slate-500 border border-white/10 cursor-not-allowed shadow-none'
            }`}
          >
            <Printer className="w-4.5 h-4.5 stroke-[2.5]" />
            {isProcessing ? 'Generating High-Res A4 Sheet...' : 'Add ID Card Sheet to Print Queue (A4)'}
          </button>
        </div>

        {/* Live A4 Canvas Preview Column */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-3 text-xs">
            <span className="flex items-center gap-1.5 text-slate-200 font-bold">
              <Eye className="w-4 h-4 text-pink-400" /> Live A4 Sheet Preview (210mm x 297mm)
            </span>
            <span className="badge text-[10px] font-bold text-cyan-300 border-cyan-500/30 bg-cyan-500/10">
              100% Print Simulation
            </span>
          </div>

          <div className="w-full max-w-[440px] bg-[#050810] p-4 rounded-3xl shadow-2xl border border-white/10 flex items-center justify-center">
            {/* Canvas with fixed A4 proportion (1 : 1.414) */}
            <canvas
              ref={canvasRef}
              className="w-full aspect-[210/297] bg-white rounded-xl shadow-2xl block border border-slate-300"
            />
          </div>

          <p className="text-[11px] text-slate-400 text-center mt-3 max-w-sm">
            Exact card dimensions: 85.6mm × 54.0mm (standard PVC ID card size). Fits standard laminating pouches.
          </p>
        </div>
      </div>
    </div>
  );
};
