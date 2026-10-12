import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Shop } from '../types.js';

export async function generateShopPosterPdf(shop: Shop): Promise<void> {
  const shopUrl = `${window.location.origin}/shop/${shop.slug}`;
  const qrDataUrl = await QRCode.toDataURL(shopUrl, {
    width: 600,
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });

  // Standard A4: 210mm x 297mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Background decoration: Top banner
  doc.setFillColor(37, 99, 235); // #2563eb (Royal Blue)
  doc.rect(0, 0, 210, 36, 'F');

  // Top header text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('SELF-SERVICE PRINT STATION', 105, 18, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Powered by printx - Smart Self-Service Printing & Xerox', 105, 27, { align: 'center' });

  // Shop Name & Details
  doc.setTextColor(15, 23, 42); // #0f172a
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text(shop.name.toUpperCase(), 105, 52, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`${shop.address}, ${shop.city} | Ph: ${shop.phone}`, 105, 60, { align: 'center' });

  // QR Code Frame
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.setFillColor(248, 250, 252); // #f8fafc
  doc.roundedRect(45, 72, 120, 128, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(37, 99, 235);
  doc.text('SCAN QR CODE TO PRINT', 105, 84, { align: 'center' });

  // Add QR Code Image
  doc.addImage(qrDataUrl, 'PNG', 55, 90, 100, 100);

  // Short URL under QR
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(shopUrl, 105, 195, { align: 'center' });

  // 3-Step Instruction Cards
  const stepY = 208;
  const cardWidth = 56;
  const cardHeight = 36;
  const startX = 14;

  const steps = [
    { num: '1', title: 'SCAN & UPLOAD', desc: 'Scan QR with phone. Upload PDF, JPG, PNG or ID Cards.' },
    { num: '2', title: 'CHOOSE OPTIONS', desc: 'Select Color / B&W, copies, and review exact price.' },
    { num: '3', title: 'COLLECT PRINTS', desc: 'Show Order Number at counter, pay and take your prints.' },
  ];

  steps.forEach((step, idx) => {
    const x = startX + idx * (cardWidth + 8);

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(x, stepY, cardWidth, cardHeight, 4, 4, 'F');

    // Badge circle
    doc.setFillColor(37, 99, 235);
    doc.circle(x + 10, stepY + 10, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(step.num, x + 10, stepY + 12.5, { align: 'center' });

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(step.title, x + 20, stepY + 12);

    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const splitDesc = doc.splitTextToSize(step.desc, cardWidth - 8);
    doc.text(splitDesc, x + 4, stepY + 22);
  });

  // Footer Caution Note
  doc.setFillColor(254, 242, 242); // Light red
  doc.roundedRect(14, 254, 182, 18, 3, 3, 'F');
  doc.setTextColor(185, 28, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('COUNTER PAYMENT REQUIRED', 105, 261, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Payment must be collected at the counter before documents are printed and released.', 105, 267, { align: 'center' });

  // Bottom branding
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`printx Smart QR Print System - Printed on ${new Date().toLocaleDateString()}`, 105, 288, { align: 'center' });

  // Trigger browser download
  doc.save(`${shop.slug}-printx-Poster.pdf`);
}
