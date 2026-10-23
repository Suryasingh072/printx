import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { jsPDF } from 'jspdf';

const isVercel = Boolean(process.env.VERCEL);
const UPLOAD_ROOT = isVercel
  ? '/tmp/qrprint-uploads'
  : path.resolve(process.cwd(), process.env.STORAGE_DIR || './uploads');
const DOCS_DIR = path.join(UPLOAD_ROOT, 'documents');
const SECRET_KEY = process.env.AUTH_SECRET || 'adrtech-printqr-secure-storage-secret-2026';

// Ensure directories exist safely without crashing
try {
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('Could not create DOCS_DIR in storageService:', err);
}

export interface StoredFile {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  filePath: string;
  pageCount: number;
  createdAt: string;
}

export class StorageService {
  /**
   * Validate file mime type, extension, and size
   */
  public validateFile(originalName: string, mimeType: string, sizeBytes: number): { valid: boolean; error?: string } {
    const ext = path.extname(originalName).toLowerCase();
    const cleanMime = (mimeType || '').toLowerCase();

    // Check if it's Office doc
    if (['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(ext)) {
      return {
        valid: false,
        error: `"${originalName}" is a Word/Excel document. Please open it on your phone and tap Print -> Save as PDF before uploading.`,
      };
    }

    const isPdf = ext === '.pdf' || cleanMime.includes('pdf');
    const isImage =
      ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.heic', '.heif'].includes(ext) ||
      cleanMime.startsWith('image/') ||
      cleanMime === 'application/octet-stream';

    if (!isPdf && !isImage) {
      return {
        valid: false,
        error: `Unsupported file format (${ext || cleanMime}). Please upload PDF documents or photos (JPG, PNG, WebP).`,
      };
    }

    const maxSizeBytes = 50 * 1024 * 1024; // 50MB
    if (sizeBytes > maxSizeBytes) {
      return {
        valid: false,
        error: `File size exceeds the 50MB limit (Uploaded: ${(sizeBytes / (1024 * 1024)).toFixed(1)}MB).`,
      };
    }

    return { valid: true };
  }

  /**
   * Saves buffer into private storage with auto format detection
   */
  public saveFileBuffer(buffer: Buffer, originalName: string, mimeType: string): StoredFile {
    const fileId = crypto.randomUUID();
    const ext = path.extname(originalName).toLowerCase();
    
    // Auto-detect format from magic bytes or extension
    const isPdfMagic = buffer.slice(0, 5).toString('ascii') === '%PDF-';
    const isJpegMagic = buffer[0] === 0xff && buffer[1] === 0xd8;
    const isPngMagic = buffer.slice(0, 4).toString('hex') === '89504e47';

    let finalMime = mimeType;
    let finalExt = ext;

    if (isPdfMagic || ext === '.pdf') {
      finalMime = 'application/pdf';
      finalExt = '.pdf';
    } else if (isJpegMagic || ext === '.jpg' || ext === '.jpeg') {
      finalMime = 'image/jpeg';
      finalExt = '.jpg';
    } else if (isPngMagic || ext === '.png') {
      finalMime = 'image/png';
      finalExt = '.png';
    } else if (ext === '.webp') {
      finalMime = 'image/webp';
      finalExt = '.webp';
    }

    const safeFilename = `${fileId}${finalExt || '.bin'}`;
    const destinationPath = path.join(DOCS_DIR, safeFilename);

    fs.writeFileSync(destinationPath, buffer);

    // If file is an image (JPEG, PNG, WebP), generate companion A4 PDF immediately
    if (finalMime.startsWith('image/')) {
      try {
        const companionPdfBuffer = this.convertImageToA4Pdf(buffer, finalMime);
        const companionPdfPath = path.join(DOCS_DIR, `${fileId}.pdf`);
        fs.writeFileSync(companionPdfPath, companionPdfBuffer);
      } catch (err) {
        console.warn('Could not generate companion A4 PDF for image:', err);
      }
    }

    // Calculate pages
    let pageCount = 1;
    if (finalMime === 'application/pdf') {
      pageCount = this.estimatePdfPages(buffer);
    }

    return {
      id: fileId,
      originalName: path.basename(originalName),
      mimeType: finalMime,
      sizeBytes: buffer.length,
      filePath: safeFilename,
      pageCount,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Converts any image (JPEG/PNG/WebP) into a standard, perfectly centered A4 printable PDF
   */
  public convertImageToA4Pdf(imageBuffer: Buffer, mimeType = 'image/jpeg'): Buffer {
    try {
      const format = mimeType.includes('png') ? 'PNG' : 'JPEG';
      const base64 = `data:${mimeType};base64,` + imageBuffer.toString('base64');
      const doc = new jsPDF({ format: 'a4', unit: 'pt' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const imgProps = doc.getImageProperties(base64);
      const margin = 36; // 0.5 inch margins
      const maxW = pageWidth - margin * 2;
      const maxH = pageHeight - margin * 2;

      const imgW = imgProps.width || 1200;
      const imgH = imgProps.height || 800;

      const scale = Math.min(maxW / imgW, maxH / imgH);
      const w = imgW * scale;
      const h = imgH * scale;
      const x = (pageWidth - w) / 2;
      const y = (pageHeight - h) / 2;

      doc.addImage(base64, format, x, y, w, h);
      return Buffer.from(doc.output('arraybuffer'));
    } catch (err) {
      console.error('convertImageToA4Pdf error:', err);
      return imageBuffer;
    }
  }

  /**
   * Returns a ready-to-print A4 PDF path for any document or image.
   * If it is an image, generates or retrieves the companion A4 PDF so printers never print blank pages!
   */
  public getOrCreatePrintablePdfPath(safeFilename: string): string {
    const fullPath = this.getAbsolutePath(safeFilename);
    if (!fs.existsSync(fullPath)) return fullPath;

    if (safeFilename.toLowerCase().endsWith('.pdf')) {
      return fullPath;
    }

    const base = path.basename(safeFilename.trim());
    const dotIdx = base.lastIndexOf('.');
    const nameWithoutExt = dotIdx > 0 ? base.substring(0, dotIdx) : base;
    const companionPdfPath = path.join(DOCS_DIR, `${nameWithoutExt}.pdf`);

    if (fs.existsSync(companionPdfPath) && fs.statSync(companionPdfPath).size > 0) {
      return companionPdfPath;
    }

    // Generate companion A4 PDF on the fly and cache it
    try {
      const imgBuffer = fs.readFileSync(fullPath);
      const ext = path.extname(fullPath).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
      const pdfBuffer = this.convertImageToA4Pdf(imgBuffer, mime);
      fs.writeFileSync(companionPdfPath, pdfBuffer);
      return companionPdfPath;
    } catch (e) {
      return fullPath;
    }
  }

  /**
   * Fast server-side PDF page counter without heavy native dependencies
   */
  public estimatePdfPages(buffer: Buffer): number {
    try {
      const content = buffer.toString('latin1');
      // Count /Type /Page (excluding /Pages) with case insensitivity and whitespace tolerance
      const pageMatches = content.match(/\/Type\s*\/Page(?![a-zA-Z])/gi);
      if (pageMatches && pageMatches.length > 0) {
        return pageMatches.length;
      }

      // Check /Count inside /Pages objects
      const countMatches = Array.from(content.matchAll(/\/Count\s+(\d+)/gi));
      if (countMatches.length > 0) {
        // The root catalog /Pages tree usually has the highest count
        const counts = countMatches.map((m) => parseInt(m[1], 10)).filter((n) => !isNaN(n) && n > 0);
        if (counts.length > 0) {
          return Math.max(...counts);
        }
      }
    } catch (e) {
      console.warn('Could not estimate PDF pages, defaulting to 1');
    }
    return 1;
  }

  /**
   * Generate secure expiring signed URL token
   */
  public generateSignedToken(orderId: string, durationMinutes = 15): { token: string; expiresAt: number } {
    const expiresAt = Date.now() + durationMinutes * 60 * 1000;
    const payload = `${orderId}:${expiresAt}`;
    const hmac = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');
    const token = `${Buffer.from(payload).toString('base64url')}.${hmac}`;
    return { token, expiresAt };
  }

  /**
   * Verify expiring signed token
   */
  public verifySignedToken(token: string, orderId: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 2) return false;

      const [encodedPayload, receivedHmac] = parts;
      const payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
      const [tokenOrderId, expiresAtStr] = payload.split(':');

      if (tokenOrderId !== orderId) return false;

      const expiresAt = parseInt(expiresAtStr, 10);
      if (Date.now() > expiresAt) return false;

      const expectedHmac = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(receivedHmac), Buffer.from(expectedHmac));
    } catch {
      return false;
    }
  }

  /**
   * Get physical file path with fallback directory resolution
   */
  public getAbsolutePath(safeFilename: string): string {
    if (!safeFilename || typeof safeFilename !== 'string' || !safeFilename.trim()) {
      return path.join(DOCS_DIR, '__missing_file__');
    }

    const trimmed = safeFilename.trim();

    // 1. If already an existing absolute path
    if (path.isAbsolute(trimmed) && fs.existsSync(trimmed)) {
      try {
        if (fs.statSync(trimmed).isFile()) {
          return trimmed;
        }
      } catch {}
    }

    // 2. Extract safe basename
    const base = path.basename(trimmed);
    if (!base || base === '.' || base === '..') {
      return path.join(DOCS_DIR, '__missing_file__');
    }

    // 3. Check in primary DOCS_DIR
    const inDocs = path.join(DOCS_DIR, base);
    if (fs.existsSync(inDocs)) {
      try {
        if (fs.statSync(inDocs).isFile()) {
          return inDocs;
        }
      } catch {}
    }

    // 4. Check in UPLOAD_ROOT
    const inUploadRoot = path.join(UPLOAD_ROOT, base);
    if (fs.existsSync(inUploadRoot)) {
      try {
        if (fs.statSync(inUploadRoot).isFile()) {
          return inUploadRoot;
        }
      } catch {}
    }

    // 5. Check in ./uploads/documents relative to cwd
    const inCwd = path.resolve(process.cwd(), './uploads/documents', base);
    if (fs.existsSync(inCwd)) {
      try {
        if (fs.statSync(inCwd).isFile()) {
          return inCwd;
        }
      } catch {}
    }

    return inDocs;
  }

  /**
   * Check if a file physically exists on disk and is non-empty
   */
  public hasValidFile(safeFilename: string): boolean {
    try {
      const full = this.getAbsolutePath(safeFilename);
      if (fs.existsSync(full)) {
        const stat = fs.statSync(full);
        return stat.isFile() && stat.size > 0;
      }
    } catch {}
    return false;
  }

  /**
   * Purge expired documents per retention policy while keeping database record
   */
  public purgeDocument(safeFilename: string): boolean {
    try {
      const full = this.getAbsolutePath(safeFilename);
      if (fs.existsSync(full)) {
        fs.unlinkSync(full);
        return true;
      }
    } catch (e) {
      console.error('Error purging file:', safeFilename, e);
    }
    return false;
  }
}

export const storageService = new StorageService();
