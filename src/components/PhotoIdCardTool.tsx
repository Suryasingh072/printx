import React, { useState, useRef, useEffect } from 'react';
import { Upload, Sliders, RefreshCw, Layers, CheckCircle2, AlertCircle, Eye, Printer, Sparkles, Image as ImageIcon } from 'lucide-react';

interface PhotoIdCardToolProps {
  onReadyToPrint: (preparedFile: { file: File; orderType: 'id_card' | 'photo'; previewUrl: string }) => void;
}

export const PhotoIdCardTool: React.FC<PhotoIdCardToolProps> = ({ onReadyToPrint }) => {
  const [mode, setMode] = useState<'id_card' | 'photo'>('id_card');

  // ID Card State
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<'side_by_side' | 'stacked'>('stacked');
  const [copiesOnSheet, setCopiesOnSheet] = useState<number>(1);
  const [showBorderLines, setShowBorderLines] = useState<boolean>(true);

  // Adjustments
  const [brightness, setBrightness] = useState<number>(0); // -50 to +50
  const [contrast, setContrast] = useState<number>(0); // -30 to +30
  const [cropPreset, setCropPreset] = useState<'standard_card' | 'passport' | 'custom'>('standard_card');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load sample demo ID images for instant testing
  const loadDemoCard = () => {
    // Generate simple sample card visuals
    const createSampleCardCanvas = (title: string, sub: string, color: string) => {
      const c = document.createElement('canvas');
      c.width = 600;
      c.height = 378; // 85.6mm x 53.98mm ratio ~ 1.586
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
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(40, 110, 140, 180);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 110, 140, 180);
      ctx.fillStyle = '#64748b';
      ctx.font = '16px sans-serif';
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

    setFrontImage(createSampleCardCanvas('GOVERNMENT IDENTITY CARD', 'Front Side Verification', '#1e40af'));
    setBackImage(createSampleCardCanvas('RESIDENTIAL ADDRESS & QR', 'Back Side Address Proof', '#065f46'));
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

    // Standard card dimensions on A4: 85.6mm x 53.98mm
    // At ~150 DPI (5.9 pixels/mm): Width ~ 505px, Height ~ 318px
    const cardW = 505;
    const cardH = 318;

    const renderCard = (imgSrc: string, x: number, y: number, label: string) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          // Draw card with border
          ctx.drawImage(img, x, y, cardW, cardH);
          if (showBorderLines) {
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]); // cutting guideline dash
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
            // Second set in lower half
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
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Upload Front and Back card photos above to preview A4 print sheet', centerX, 400);
        ctx.font = '18px sans-serif';
        ctx.fillText('Standard 85.6mm × 54mm ID Card Layout with Cut Guidelines', centerX, 440);
      }
    };

    renderSheet();
  }, [frontImage, backImage, layoutMode, copiesOnSheet, showBorderLines, brightness, contrast]);

  const handleSendToPrint = async () => {
    const canvas = canvasRef.current;
    if (!canvas || (!frontImage && !backImage)) {
      alert('Please upload front and back images first.');
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
    <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Layers className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">🪪 ID Card 2-in-1 Sheet Arranger (A4 Paper)</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Aadhaar, Voter ID, PAN ya Driving License ke Front aur Back side ko A4 sheet par center align karein.
          </p>
        </div>

        <button
          type="button"
          onClick={loadDemoCard}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition cursor-pointer border border-indigo-100"
        >
          <Sparkles className="w-3.5 h-3.5" /> Sample Card
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
        {/* Controls Column */}
        <div className="lg:col-span-5 space-y-6">
          {/* Step 1: Uploads */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">1. Upload Card Images</h4>
            
            <div className="grid grid-cols-2 gap-3">
              {/* Front Side */}
              <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-3 text-center transition bg-slate-50">
                <input
                  type="file"
                  id="front-upload"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'front')}
                />
                <label htmlFor="front-upload" className="cursor-pointer block">
                  {frontImage ? (
                    <div className="relative group">
                      <img src={frontImage} alt="Front preview" className="w-full h-24 object-cover rounded-lg border border-slate-200" />
                      <span className="absolute inset-0 bg-black/40 text-white text-xs font-medium flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-lg transition">
                        Change Front
                      </span>
                    </div>
                  ) : (
                    <div className="py-4">
                      <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                      <p className="text-xs font-semibold text-slate-700">Front Side</p>
                      <p className="text-[10px] text-slate-400">JPG, PNG</p>
                    </div>
                  )}
                </label>
              </div>

              {/* Back Side */}
              <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-3 text-center transition bg-slate-50">
                <input
                  type="file"
                  id="back-upload"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'back')}
                />
                <label htmlFor="back-upload" className="cursor-pointer block">
                  {backImage ? (
                    <div className="relative group">
                      <img src={backImage} alt="Back preview" className="w-full h-24 object-cover rounded-lg border border-slate-200" />
                      <span className="absolute inset-0 bg-black/40 text-white text-xs font-medium flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-lg transition">
                        Change Back
                      </span>
                    </div>
                  ) : (
                    <div className="py-4">
                      <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                      <p className="text-xs font-semibold text-slate-700">Back Side</p>
                      <p className="text-[10px] text-slate-400">JPG, PNG</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>

          {/* Step 2: Layout & Arrangement */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">2. Sheet Layout Options</h4>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLayoutMode('stacked')}
                className={`px-3 py-2 text-xs font-medium rounded-xl border text-center transition ${
                  layoutMode === 'stacked'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                Top & Bottom (Vertical)
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('side_by_side')}
                className={`px-3 py-2 text-xs font-medium rounded-xl border text-center transition ${
                  layoutMode === 'side_by_side'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                Side by Side (Horizontal)
              </button>
            </div>

            <div className="flex items-center justify-between text-xs font-medium text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span>Card Sets on A4:</span>
              <div className="flex gap-2">
                {[1, 2].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCopiesOnSheet(num)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      copiesOnSheet === num
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {num} {num === 1 ? 'Set' : 'Sets'}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
              <input
                type="checkbox"
                checked={showBorderLines}
                onChange={(e) => setShowBorderLines(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Include dashed cutting guidelines & standard border
            </label>
          </div>

          {/* Step 3: Photo Adjustments */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between">
              <span>3. Image Adjustments</span>
              <button
                type="button"
                onClick={() => {
                  setBrightness(0);
                  setContrast(0);
                }}
                className="text-[11px] text-indigo-600 hover:underline font-normal"
              >
                Reset
              </button>
            </h4>

            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Brightness:</span>
                <span className="font-semibold">{brightness > 0 ? `+${brightness}%` : `${brightness}%`}</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                value={brightness}
                onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Contrast:</span>
                <span className="font-semibold">{contrast > 0 ? `+${contrast}%` : `${contrast}%`}</span>
              </div>
              <input
                type="range"
                min="-30"
                max="30"
                value={contrast}
                onChange={(e) => setContrast(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Print Action */}
          <button
            type="button"
            disabled={!frontImage || isProcessing}
            onClick={handleSendToPrint}
            className={`w-full py-4 px-4 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 shadow-lg transition ${
              frontImage && !isProcessing
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-indigo-500/25 cursor-pointer'
                : 'bg-slate-300 cursor-not-allowed shadow-none'
            }`}
          >
            <Printer className="w-4 h-4" />
            {isProcessing ? 'Generating High-Res A4 Sheet...' : 'Done! Add ID Card Sheet to Print Queue (A4)'}
          </button>
        </div>

        {/* Live A4 Canvas Preview Column */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-3 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5 text-slate-700">
              <Eye className="w-4 h-4 text-indigo-600" /> Live A4 Sheet Preview (210mm x 297mm)
            </span>
            <span className="text-slate-400">Scale: 100% Print Simulation</span>
          </div>

          <div className="w-full max-w-[420px] bg-slate-200 p-3 rounded-2xl shadow-inner border border-slate-300/80">
            {/* Canvas with fixed A4 proportion (1 : 1.414) */}
            <canvas
              ref={canvasRef}
              className="w-full aspect-[210/297] bg-white rounded-lg shadow-md border border-slate-300 block"
            />
          </div>

          <p className="text-[11px] text-slate-400 text-center mt-3 max-w-sm">
            Exact card dimension: 85.6mm × 54.0mm (standard PVC credit card ratio). Perfect for laser or inkjet duplex print.
          </p>
        </div>
      </div>
    </div>
  );
};
