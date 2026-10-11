import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const UPLOAD_ROOT = path.resolve(process.cwd(), process.env.STORAGE_DIR || './uploads');
const DOCS_DIR = path.join(UPLOAD_ROOT, 'documents');
const SECRET_KEY = process.env.AUTH_SECRET || 'adrtech-printqr-secure-storage-secret-2026';

// Ensure directories exist
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
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
   * Validate file mime type and size
   */
  public validateFile(originalName: string, mimeType: string, sizeBytes: number): { valid: boolean; error?: string } {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];

    if (!allowedMimes.includes(mimeType.toLowerCase())) {
      return {
        valid: false,
        error: `Unsupported file type: ${mimeType}. Please upload PDF, JPG, or PNG. For Word or Excel files, export to PDF first.`,
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
   * Saves buffer into private storage
   */
  public saveFileBuffer(buffer: Buffer, originalName: string, mimeType: string): StoredFile {
    const fileId = crypto.randomUUID();
    const extension = path.extname(originalName) || (mimeType === 'application/pdf' ? '.pdf' : '.png');
    const safeFilename = `${fileId}${extension}`;
    const destinationPath = path.join(DOCS_DIR, safeFilename);

    fs.writeFileSync(destinationPath, buffer);

    // Rough page count estimation for PDF if not parsed
    let pageCount = 1;
    if (mimeType === 'application/pdf') {
      pageCount = this.estimatePdfPages(buffer);
    }

    return {
      id: fileId,
      originalName: path.basename(originalName),
      mimeType,
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
      // Count /Type /Page (excluding /Pages)
      const matches = content.match(/\/Type[\s]*\/Page[^s]/g);
      if (matches && matches.length > 0) {
        return matches.length;
      }
      // Alternate check: /Count inside /Pages
      const countMatch = content.match(/\/Count[\s]+(\d+)/);
      if (countMatch && countMatch[1]) {
        const count = parseInt(countMatch[1], 10);
        if (!isNaN(count) && count > 0) return count;
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
   * Get physical file path
   */
  public getAbsolutePath(safeFilename: string): string {
    const full = path.join(DOCS_DIR, safeFilename);
    // Security check: ensure within DOCS_DIR
    if (!full.startsWith(DOCS_DIR)) {
      throw new Error('Access denied: Path traversal detected');
    }
    return full;
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
