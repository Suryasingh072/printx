import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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
