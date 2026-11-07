import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Shop } from '../types.js';

/**
 * Generates an A4 Printable Poster PDF for the shop matching the exact
 * Green & White PrintX branding template provided in the attached design:
 * - "PrintX" logo with radiant green accents and printer icon
 * - Green ribbon: "SCAN • UPLOAD • PAY • PRINT"
 * - 3-step flowchart cards with Hindi + English instructions
 * - High-res center QR code configured specifically for this shop's URL
 * - "AUTOMATIC PRINT - Pay Online Or Pay Cash Option Available" ribbon
 * - Bottom emerald green banner: "AVAILABLE ONLY AT <SHOP NAME>"
 */
export async function generateShopPosterPdf(shop: Shop): Promise<void> {
  const shopUrl = `${window.location.origin}/shop/${shop.slug}`;

  // 1. Generate High-Res Shop QR Code Data URL
  const qrDataUrl = await QRCode.toDataURL(shopUrl, {
    width: 800,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  });

  // Target template dimensions (matches high-res A4 vertical poster)
  const canvasWidth = 1087;
  const canvasHeight = 1536;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  // Load template asset if available
  const templatePath = '/assets/aistudio/ChatGPT_Image_Nov_7__2026__09_26_48_AM_b65c10a8.png';
  let templateLoaded = false;

  try {
    const templateImg = await loadImage(templatePath);
    ctx.drawImage(templateImg, 0, 0, canvasWidth, canvasHeight);
    templateLoaded = true;

    // Overlay 1: Live Shop QR Code into the center green framed box
    // Center of template: x ~543, Box width ~380. Inner white QR area: x: 382, y: 480, w: 324, h: 324
    const qrImg = await loadImage(qrDataUrl);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(380, 478, 328, 328);
    ctx.drawImage(qrImg, 385, 483, 318, 318);

    // Overlay 2: Shop Name in the bottom emerald green footer
    // Green footer background color: #008726
    const footerY = 1365;
    const footerH = canvasHeight - footerY;
    const footerGreen = '#008726';

    // Clear the center text area of the footer to replace "ECE" with this shop's name
    ctx.fillStyle = footerGreen;
    ctx.fillRect(360, footerY + 10, 365, footerH - 20);

    // Redraw "AVAILABLE ONLY AT"
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 24px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('AVAILABLE ONLY AT', 543.5, 1412);

    // Draw the shop's name in bold white
    const shopDisplayName = (shop.name || 'PRINTX STATION').toUpperCase();
    let fontSize = 68;
    ctx.font = `900 ${fontSize}px "Inter", "Arial Black", -apple-system, BlinkMacSystemFont, sans-serif`;

    // Adjust font size dynamically so long shop names fit cleanly without overlapping icons
    const maxTextWidth = 340;
    while (ctx.measureText(shopDisplayName).width > maxTextWidth && fontSize > 28) {
      fontSize -= 2;
      ctx.font = `900 ${fontSize}px "Inter", "Arial Black", -apple-system, BlinkMacSystemFont, sans-serif`;
    }

    ctx.fillText(shopDisplayName, 543.5, 1475);

  } catch {
    templateLoaded = false;
  }

  // Fallback: If template image fails to load, render the complete vector design from scratch
  if (!templateLoaded) {
    renderFallbackPoster(ctx, canvasWidth, canvasHeight, shop, qrDataUrl);
  }

  // 3. Export Canvas to A4 PDF (210mm x 297mm)
  const posterDataUrl = canvas.toDataURL('image/png', 1.0);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  doc.addImage(posterDataUrl, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
  doc.save(`${shop.slug}-PrintX-Poster.pdf`);
}

/**
 * Loads an image from a URL or Data URL asynchronously
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Complete standalone fallback vector renderer if template PNG is not accessible
 */
async function renderFallbackPoster(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  shop: Shop,
  qrDataUrl: string
): Promise<void> {
  const brandGreen = '#00a82d';
  const darkGreen = '#008726';
  const ribbonGreen = '#009e2e';
  const blackColor = '#0f172a';

  // 1. Clean White Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // 2. Radiant Green Sunburst Rays at top
  drawSunburstRays(ctx, 110, 140, brandGreen);
  drawSunburstRays(ctx, 977, 140, brandGreen);

  // 3. "PrintX" Logo
  ctx.textBaseline = 'alphabetic';
  ctx.font = '900 120px "Inter", "Arial Black", sans-serif';
  ctx.textAlign = 'left';
  const printWidth = ctx.measureText('Print').width;
  const startLogoX = (w - (printWidth + 110 + 90)) / 2;

  // "Print" in black
  ctx.fillStyle = blackColor;
  ctx.fillText('Print', startLogoX, 160);

  // "X" in vibrant green
  ctx.fillStyle = brandGreen;
  ctx.fillText('X', startLogoX + printWidth - 6, 160);

  // Top Printer Icon
  drawMiniPrinter(ctx, startLogoX + printWidth + 100, 95, 75);

  // 4. Green Ribbon: "SCAN • UPLOAD • PAY • PRINT"
  ctx.fillStyle = ribbonGreen;
  drawRibbonBanner(ctx, 45, 215, w - 90, 75, 20);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 38px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SCAN • UPLOAD • PAY • PRINT', w / 2, 252);

  // 5. Middle Flowchart
  // Center QR Box
  const qrBoxX = 355;
  const qrBoxY = 325;
  const qrBoxSize = 377;
  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 20, '#ffffff', ribbonGreen, 6);

  // Draw QR code inside
  try {
    const qrImg = await loadImage(qrDataUrl);
    ctx.drawImage(qrImg, qrBoxX + 25, qrBoxY + 25, qrBoxSize - 50, qrBoxSize - 50);
  } catch {
    // fallback if QR image failed
  }

  // Downward triangle on QR box
  ctx.fillStyle = ribbonGreen;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 25, qrBoxY + qrBoxSize);
  ctx.lineTo(w / 2 + 25, qrBoxY + qrBoxSize);
  ctx.lineTo(w / 2, qrBoxY + qrBoxSize + 25);
  ctx.closePath();
  ctx.fill();

  // Left Card: 1. SCAN
  const cardW = 270;
  const cardH = 377;
  const card1X = 45;
  const card1Y = 325;
  drawRoundedRect(ctx, card1X, card1Y, cardW, cardH, 20, '#ffffff', ribbonGreen, 6);
  // Scan Icon Badge
  drawRoundedRect(ctx, card1X + 60, card1Y + 30, 150, 150, 28, ribbonGreen);
  drawScanIcon(ctx, card1X + 135, card1Y + 105, 70);

  ctx.fillStyle = ribbonGreen;
  ctx.font = '900 36px "Inter", sans-serif';
  ctx.fillText('1. SCAN', card1X + 135, card1Y + 235);
  ctx.fillStyle = blackColor;
  ctx.font = '700 28px "Inter", sans-serif';
  ctx.fillText('QR Code', card1X + 135, card1Y + 280);
  ctx.fillText('Scan करें', card1X + 135, card1Y + 325);

  // Arrow 1 -> QR
  drawArrow(ctx, card1X + cardW + 8, card1Y + 180, qrBoxX - 8, card1Y + 180, ribbonGreen, 24);

  // Right Card: 3. PRINT
  const card3X = w - 45 - cardW;
  const card3Y = 325;
  drawRoundedRect(ctx, card3X, card3Y, cardW, cardH, 20, '#ffffff', ribbonGreen, 6);
  // Print Icon Badge
  ctx.fillStyle = ribbonGreen;
  ctx.beginPath();
  ctx.arc(card3X + 135, card3Y + 105, 75, 0, Math.PI * 2);
  ctx.fill();
  drawWhitePrinter(ctx, card3X + 135, card3Y + 105, 70);

  ctx.fillStyle = ribbonGreen;
  ctx.font = '900 36px "Inter", sans-serif';
  ctx.fillText('3. PRINT', card3X + 135, card3Y + 235);
  ctx.fillStyle = blackColor;
  ctx.font = '700 28px "Inter", sans-serif';
  ctx.fillText('Automatic', card3X + 135, card3Y + 280);
  ctx.fillText('Print होगा', card3X + 135, card3Y + 325);

  // Arrow QR -> 3
  drawArrow(ctx, qrBoxX + qrBoxSize + 8, card1Y + 180, card3X - 8, card1Y + 180, ribbonGreen, 24);

  // Bottom Flow Card: 2. UPLOAD & PAY
  const card2W = 600;
  const card2H = 200;
  const card2X = (w - card2W) / 2;
  const card2Y = 745;
  drawRoundedRect(ctx, card2X, card2Y, card2W, card2H, 20, '#ffffff', ribbonGreen, 6);

  // Phone & ₹ Icon Badge
  drawRoundedRect(ctx, card2X + 35, card2Y + 25, 120, 150, 24, ribbonGreen);
  drawPhoneRupeeIcon(ctx, card2X + 95, card2Y + 100, 60);

  ctx.textAlign = 'left';
  ctx.fillStyle = ribbonGreen;
  ctx.font = '900 42px "Inter", sans-serif';
  ctx.fillText('2. UPLOAD & PAY', card2X + 180, card2Y + 70);

  ctx.fillStyle = blackColor;
  ctx.font = '700 30px "Inter", sans-serif';
  ctx.fillText('अपनी File Upload करें', card2X + 180, card2Y + 120);
  ctx.fillText('और Payment करें', card2X + 180, card2Y + 165);

  // 6. Brush Stroke Highlight: "AUTOMATIC PRINT"
  const brushY = 1000;
  ctx.fillStyle = '#22c55e';
  drawRoundedRect(ctx, 120, brushY, w - 240, 120, 20, '#22c55e');

  drawSunburstRays(ctx, 75, brushY + 60, brandGreen);
  drawSunburstRays(ctx, w - 75, brushY + 60, brandGreen);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.font = '900 60px "Inter", "Arial Black", sans-serif';
  ctx.fillText('🖨️  AUTOMATIC PRINT', w / 2, brushY + 68);

  // Subtitle
  ctx.font = '900 36px "Inter", sans-serif';
  ctx.fillText('Pay Online Or Pay Cash Option Available', w / 2, 1175);

  // 7. Bottom Green Banner: "AVAILABLE ONLY AT <SHOP>"
  const footY = 1270;
  const footH = h - footY;
  ctx.fillStyle = darkGreen;
  ctx.fillRect(0, footY, w, footH);

  drawSunburstRays(ctx, 230, footY + footH / 2, '#ffffff');
  drawSunburstRays(ctx, w - 230, footY + footH / 2, '#ffffff');

  // Location Pin
  drawLocationPin(ctx, 330, footY + footH / 2, 45);

  // Shop Name & Details
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = '900 26px "Inter", sans-serif';
  ctx.fillText('AVAILABLE ONLY AT', w / 2 + 10, footY + 70);

  let footFontSize = 68;
  const shopNameStr = (shop.name || 'PRINTX').toUpperCase();
  ctx.font = `900 ${footFontSize}px "Inter", "Arial Black", sans-serif`;
  while (ctx.measureText(shopNameStr).width > 480 && footFontSize > 28) {
    footFontSize -= 2;
    ctx.font = `900 ${footFontSize}px "Inter", "Arial Black", sans-serif`;
  }
  ctx.fillText(shopNameStr, w / 2 + 10, footY + 160);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillColor?: string,
  strokeColor?: string,
  lineWidth?: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor && lineWidth) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawRibbonBanner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  notch: number
) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - notch, y + h / 2);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + notch, y + h / 2);
  ctx.closePath();
  ctx.fill();
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  thickness: number
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const arrowHead = 24;
  ctx.rect(x1, y1 - thickness / 2, (x2 - x1) - arrowHead, thickness);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x2 - arrowHead, y2 - thickness);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2 - arrowHead, y2 + thickness);
  ctx.closePath();
  ctx.fill();
}

function drawSunburstRays(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';

  const len = 32;
  const angles = [-35, 0, 35];
  angles.forEach((deg) => {
    const rad = (deg * Math.PI) / 180;
    const x1 = cx + Math.cos(rad) * 12;
    const y1 = cy + Math.sin(rad) * 12;
    const x2 = cx + Math.cos(rad) * (12 + len);
    const y2 = cy + Math.sin(rad) * (12 + len);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });
}

function drawMiniPrinter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
) {
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 5;
  ctx.strokeRect(x, y + 20, size, size - 35);
  ctx.strokeRect(x + 12, y, size - 24, 20);
  ctx.fillStyle = '#00a82d';
  ctx.fillRect(x + 16, y + size - 15, size - 32, 14);
}

function drawScanIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number
) {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  const half = size / 2;
  const len = 18;

  // Top-left
  ctx.beginPath();
  ctx.moveTo(cx - half, cy - half + len);
  ctx.lineTo(cx - half, cy - half);
  ctx.lineTo(cx - half + len, cy - half);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(cx + half - len, cy - half);
  ctx.lineTo(cx + half, cy - half);
  ctx.lineTo(cx + half, cy - half + len);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(cx - half, cy + half - len);
  ctx.lineTo(cx - half, cy + half);
  ctx.lineTo(cx - half + len, cy + half);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(cx + half - len, cy + half);
  ctx.lineTo(cx + half, cy + half);
  ctx.lineTo(cx + half, cy + half - len);
  ctx.stroke();
}

function drawWhitePrinter(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number
) {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.strokeRect(cx - size / 2, cy - size / 4, size, size / 2);
  ctx.strokeRect(cx - size / 3, cy - size / 2, (size * 2) / 3, size / 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - size / 4, cy + size / 4, size / 2, 8);
}

function drawPhoneRupeeIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number
) {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.strokeRect(cx - size / 3, cy - size / 2, (size * 2) / 3, size);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('₹', cx, cy - 5);
}

function drawLocationPin(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number
) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy - 10, size / 2, Math.PI, 0, false);
  ctx.lineTo(cx, cy + size / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#008726';
  ctx.beginPath();
  ctx.arc(cx, cy - 10, size / 5, 0, Math.PI * 2);
  ctx.fill();
}
