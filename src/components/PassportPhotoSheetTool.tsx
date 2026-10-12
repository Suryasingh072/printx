import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Layers,
  Sparkles,
  Scissors,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Printer,
  Grid,
  FileCheck,
  RotateCw,
} from 'lucide-react';

interface PassportPhotoSheetToolProps {
  onReadyToPrint: (preparedFile: { file: File; orderType: 'photo'; previewUrl: string; sheetCount: number }) => void;
}

export const PassportPhotoSheetTool: React.FC<PassportPhotoSheetToolProps> = ({ onReadyToPrint }) => {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string>('passport_photo.jpg');
  const [sheetType, setSheetType] = useState<'4x6_6photos' | '4x6_4photos' | 'a4_8photos'>('4x6_6photos');
  const [paperOrientation, setPaperOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [showCuttingLines, setShowCuttingLines] = useState<boolean>(true);
  const [addBorder, setAddBorder] = useState<boolean>(true);
  const [brightness, setBrightness] = useState<number>(0);
  const [contrast, setContrast] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load sample demo passport photo for instant test
  const loadDemoPhoto = () => {
    const c = document.createElement('canvas');
    c.width = 413; // 35mm at 300 DPI
    c.height = 531; // 45mm at 300 DPI
    const ctx = c.getContext('2d')!;

    // Clean neutral studio passport background
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(0, 0, 413, 531);

    // Head / Face
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.ellipse(206, 210, 80, 105, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(206, 170, 86, Math.PI, 0, false);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(175, 205, 7, 0, Math.PI * 2);
    ctx.arc(237, 205, 7, 0, Math.PI * 2);
    ctx.fill();

    // Gentle smile
    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(206, 245, 28, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();

    // Formal Suit / Coat
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.moveTo(90, 531);
    ctx.lineTo(130, 360);
    ctx.lineTo(206, 420);
    ctx.lineTo(282, 360);
    ctx.lineTo(323, 531);
    ctx.closePath();
    ctx.fill();

    // White Shirt Collar
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(170, 340);
    ctx.lineTo(206, 400);
    ctx.lineTo(242, 340);
    ctx.closePath();
    ctx.fill();

    setPhotoUrl(c.toDataURL('image/jpeg'));
    setPhotoFileName('Sample_Passport_Studio_Photo.jpg');
  };

  const handleUploadPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Re-draw 4x6 / A4 Photo Sheet on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High resolution 4x6 inch at 300 DPI: 1800 x 1200 px (Landscape)
    // A4 sheet: 2480 x 3508 px at 300 DPI
    if (sheetType === 'a4_8photos') {
      canvas.width = 2480;
      canvas.height = 3508;
    } else {
      // 4x6 inch standard photo printer format
      if (paperOrientation === 'landscape') {
        canvas.width = 1800; // 6 inch
        canvas.height = 1200; // 4 inch
      } else {
        canvas.width = 1200; // 4 inch
        canvas.height = 1800; // 6 inch
      }
    }

    // High quality white glossy paper background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!photoUrl) {
      // Placeholder instructions
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('4×6 Passport Photo Sheet Ready', canvas.width / 2, canvas.height / 2 - 30);
      ctx.font = '24px sans-serif';
      ctx.fillText('Apna photo upload karein — 4 ya 6 ki sheet auto banegi with cutting lines', canvas.width / 2, canvas.height / 2 + 30);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Apply filters
      ctx.filter = `brightness(${100 + brightness}%) contrast(${100 + contrast}%)`;

      // Standard passport photo dimension: 35mm x 45mm
      // At 300 DPI: ~413px width, ~531px height
      const pw = 413;
      const ph = 531;

      interface Slot {
        x: number;
        y: number;
      }
      let slots: Slot[] = [];

      if (sheetType === '4x6_6photos') {
        // 6 photos on 4x6 Landscape: 3 columns x 2 rows
        const startX = (canvas.width - (3 * pw + 2 * 60)) / 2;
        const startY = (canvas.height - (2 * ph + 1 * 50)) / 2;

        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 3; c++) {
            slots.push({
              x: startX + c * (pw + 60),
              y: startY + r * (ph + 50),
            });
          }
        }
      } else if (sheetType === '4x6_4photos') {
        // 4 larger photos on 4x6: 2 columns x 2 rows
        const p4w = 480;
        const p4h = 600;
        const startX = (canvas.width - (2 * p4w + 1 * 100)) / 2;
        const startY = (canvas.height - (2 * p4h + 1 * 60)) / 2;

        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 2; c++) {
            slots.push({
              x: startX + c * (p4w + 100),
              y: startY + r * (p4h + 60),
            });
          }
        }
      } else {
        // A4 8 photos: 4 columns x 2 rows
        const startX = (canvas.width - (4 * pw + 3 * 100)) / 2;
        const startY = 300;

        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 4; c++) {
            slots.push({
              x: startX + c * (pw + 100),
              y: startY + r * (ph + 100),
            });
          }
        }
      }

      // Render each slot with cutting lines and thin neat border
      slots.forEach((s, idx) => {
        const targetW = sheetType === '4x6_4photos' ? 480 : pw;
        const targetH = sheetType === '4x6_4photos' ? 600 : ph;

        // Draw photo
        ctx.drawImage(img, s.x, s.y, targetW, targetH);

        // Optional thin photo edge border
        if (addBorder) {
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 2;
          ctx.strokeRect(s.x, s.y, targetW, targetH);
        }

        // Precise Scissors Cutting Guidelines
        if (showCuttingLines) {
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([8, 8]);
          // Outer cut box around the photo
          ctx.strokeRect(s.x - 8, s.y - 8, targetW + 16, targetH + 16);
          ctx.setLineDash([]);

          // Corner cross-hair markers
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 2;
          // Top Left
          ctx.beginPath();
          ctx.moveTo(s.x - 16, s.y - 8);
          ctx.lineTo(s.x - 4, s.y - 8);
          ctx.moveTo(s.x - 8, s.y - 16);
          ctx.lineTo(s.x - 8, s.y - 4);
          ctx.stroke();

          // Top Right
          ctx.beginPath();
          ctx.moveTo(s.x + targetW + 4, s.y - 8);
          ctx.lineTo(s.x + targetW + 16, s.y - 8);
          ctx.moveTo(s.x + targetW + 8, s.y - 16);
          ctx.lineTo(s.x + targetW + 8, s.y - 4);
          ctx.stroke();
        }
      });

      // Bottom label badge
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      const labelText = sheetType === '4x6_6photos'
        ? 'printx 4×6 Photo Paper (6 Passport Photos • 35mm × 45mm)'
        : sheetType === '4x6_4photos'
        ? 'printx 4×6 Photo Paper (4 Large Portrait Photos)'
        : 'printx A4 Standard Sheet (8 Passport Photos)';
      ctx.fillText(labelText, canvas.width / 2, canvas.height - 20);
    };
    img.src = photoUrl;
  }, [photoUrl, sheetType, paperOrientation, showCuttingLines, addBorder, brightness, contrast]);

  const handleGenerateAndPrint = () => {
    const canvas = canvasRef.current;
    if (!canvas || !photoUrl) {
      alert('Pehle ek photo upload karein ya sample photo load karein.');
      return;
    }

    setIsProcessing(true);
    canvas.toBlob(
      (blob) => {
        setIsProcessing(false);
        if (blob) {
          const fileName = `Passport_Sheet_${Date.now()}.png`;
          const file = new File([blob], fileName, { type: 'image/png' });
          const previewUrl = URL.createObjectURL(blob);

          onReadyToPrint({
            file,
            orderType: 'photo',
            previewUrl,
            sheetCount: 1,
          });
        }
      },
      'image/png',
      0.95
    );
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-sm space-y-8">
      {/* Tool Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Grid className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">4×6 Passport Photo Maker</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-cyan-100 text-cyan-800 border border-cyan-200 uppercase">
                Cutting Lines Included
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Photo bhejo, 4 ya 6 ki sheet khud ban ke photo printer se niklegi — direct scissors guidelines ke saath.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadDemoPhoto}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition cursor-pointer border border-blue-200/70 shrink-0 shadow-xs"
        >
          <Sparkles className="w-4 h-4 text-blue-600" /> Load Sample Passport Photo
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Controls Column (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* 1. Upload Photo */}
          <div>
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 block mb-2">
              1. Passport Photo Chunein
            </label>
            <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-6 text-center transition bg-slate-50/60">
              <input
                type="file"
                id="passport-upload"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleUploadPhoto}
              />
              <label htmlFor="passport-upload" className="cursor-pointer block">
                <div className="w-12 h-12 bg-white text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-xs border border-slate-200">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-800">Tap to upload your photo</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Mobile camera photo, gallery ya selfie</p>
              </label>
            </div>
          </div>

          {/* 2. Sheet Format Selector */}
          <div>
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 block mb-2">
              2. Photo Sheet Format
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={() => setSheetType('4x6_6photos')}
                className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                  sheetType === '4x6_6photos'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div>
                  <p className="text-xs font-black">6 Photos on 4×6 Glossy Paper (Standard)</p>
                  <p className="text-[11px] text-slate-500 font-normal">35mm × 45mm Govt & Exam Specification</p>
                </div>
                {sheetType === '4x6_6photos' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
              </button>

              <button
                type="button"
                onClick={() => setSheetType('4x6_4photos')}
                className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                  sheetType === '4x6_4photos'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div>
                  <p className="text-xs font-black">4 Large Photos on 4×6 Paper</p>
                  <p className="text-[11px] text-slate-500 font-normal">Larger 2×2 inch Visa specification</p>
                </div>
                {sheetType === '4x6_4photos' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
              </button>

              <button
                type="button"
                onClick={() => setSheetType('a4_8photos')}
                className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                  sheetType === 'a4_8photos'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div>
                  <p className="text-xs font-black">8 Photos on A4 Standard Sheet</p>
                  <p className="text-[11px] text-slate-500 font-normal">Regular A4 color laser / inkjet printer</p>
                </div>
                {sheetType === 'a4_8photos' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
              </button>
            </div>
          </div>

          {/* 3. Options: Cutting Lines & Border */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 block">
              3. Cutting & Border Settings
            </label>

            <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showCuttingLines}
                onChange={(e) => setShowCuttingLines(e.target.checked)}
                className="w-4 h-4 rounded-md accent-blue-600"
              />
              <span>Include Scissors Cutting Dash Lines (✂️)</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={addBorder}
                onChange={(e) => setAddBorder(e.target.checked)}
                className="w-4 h-4 rounded-md accent-blue-600"
              />
              <span>Add Thin White/Grey Border to each photo</span>
            </label>
          </div>

          {/* Adjustments: Brightness & Contrast */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Brightness Correction</span>
              <span className="font-mono text-blue-600 font-bold">{brightness > 0 ? `+${brightness}` : brightness}</span>
            </div>
            <input
              type="range"
              min="-40"
              max="40"
              value={brightness}
              onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleGenerateAndPrint}
            disabled={!photoUrl || isProcessing}
            className={`w-full py-4 px-6 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2 shadow-lg transition cursor-pointer ${
              photoUrl && !isProcessing
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25'
                : 'bg-slate-300 cursor-not-allowed shadow-none'
            }`}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" /> Sheet Generate Ho Rahi Hai...
              </>
            ) : (
              <>
                <FileCheck className="w-5 h-5 stroke-[2.5]" /> Done! Send Passport Sheet to Print
              </>
            )}
          </button>
        </div>

        {/* Live Preview Column (7 cols) */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-inner">
          <div className="w-full flex items-center justify-between pb-3 text-xs text-slate-400 border-b border-slate-800 mb-4">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5 text-cyan-400" /> Live Sheet Layout Preview
            </span>
            <span className="font-mono text-[11px] text-cyan-400">
              {sheetType === '4x6_6photos' ? '4×6 Inch (1800×1200 px)' : sheetType === '4x6_4photos' ? '4×6 Inch (4 Photos)' : 'A4 Sheet (2480×3508 px)'}
            </span>
          </div>

          <div className="w-full flex items-center justify-center overflow-auto max-h-[600px] p-2">
            <canvas
              ref={canvasRef}
              className="max-h-[520px] max-w-full rounded-xl shadow-2xl border-4 border-slate-800 bg-white object-contain"
            />
          </div>

          <p className="text-[11px] text-slate-400 mt-4 text-center">
            Cutting guidelines ke hisaab se printer se nikalne ke baad scissors se aasani se alag karein.
          </p>
        </div>
      </div>
    </div>
  );
};
