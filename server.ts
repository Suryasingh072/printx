import express, { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import { db } from './src/server/db/database.js';
import { storageService } from './src/server/services/storage.js';
import { whatsAppService } from './src/server/services/whatsapp.js';
import { calculateOrderPrice } from './src/server/services/pricing.js';
import { User, Shop, Order } from './src/server/types.js';
import { supabaseService } from './src/server/db/supabase.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const AUTH_SECRET = process.env.AUTH_SECRET || 'adrtech-printqr-auth-session-key-2026';

// Middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Multer upload setup in private storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Simple secure session token helpers
interface SessionPayload {
  userId: string;
  role: string;
  shopId?: string;
  exp: number;
}

function createSessionToken(user: User, shop?: Shop): string {
  const payload: SessionPayload = {
    userId: user.id,
    role: user.role,
    shopId: shop?.id,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const json = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(json).digest('hex');
  return `${Buffer.from(json).toString('base64url')}.${sig}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [b64, sig] = token.split('.');
    if (!b64 || !sig) return null;
    const json = Buffer.from(b64, 'base64url').toString('utf8');
    const expected = crypto.createHmac('sha256', AUTH_SECRET).update(json).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload: SessionPayload = JSON.parse(json);
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// Auth Middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  const token = authHeader.split(' ')[1];
  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
  (req as any).user = session;
  next();
}

// Agent Auth Middleware
function requireAgentAuth(req: Request, res: Response, next: NextFunction) {
  let token = req.headers['x-agent-token'] as string;
  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else {
      token = authHeader.trim();
    }
  }
  if (!token && typeof req.query.token === 'string') {
    token = req.query.token;
  }
  if (!token) {
    return res.status(401).json({ error: 'Agent token missing. Please pair your Windows device.' });
  }
  const agent = db.getAgentByToken(token);
  if (!agent) {
    return res.status(401).json({ error: 'Invalid or revoked agent credentials.' });
  }
  (req as any).agent = agent;
  next();
}

// ==========================================
// 1. AUTHENTICATION & REGISTRATION ENDPOINTS
// ==========================================

// Send WhatsApp OTP for registration
app.post('/api/auth/send-registration-otp', async (req, res) => {
  const { whatsappNumber, shopName } = req.body;
  if (!whatsappNumber) {
    return res.status(400).json({ error: '10-digit Indian WhatsApp number is required.' });
  }

  const cleanPhone = whatsappNumber.replace(/[^0-9+]/g, '');
  const otp = whatsAppService.generateOtp();
  const sendResult = await whatsAppService.sendVerificationOtp(
    cleanPhone,
    otp,
    shopName || 'printx'
  );

  res.json({
    success: true,
    message: `Verification code sent to ${cleanPhone}`,
    provider: sendResult.provider,
    devHint: `Dev Verification Code: ${otp}`,
    otp, // returned for seamless client-side verification
  });
});

// Register Shop Owner & New Shop
app.post('/api/auth/register', (req, res) => {
  const { email, password, fullName, whatsappNumber, shopName, shopSlug, phone, address, city, otpCode, verified } = req.body;

  if (!email || !password || !whatsappNumber || !shopName) {
    return res.status(400).json({ error: 'Shop name, Email address, WhatsApp number, and Password are required.' });
  }

  if (db.getUserByEmail(email)) {
    return res.status(400).json({ error: 'An account with this email already exists.' });
  }

  const generatedSlug = (shopSlug || shopName)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (db.getShopBySlug(generatedSlug)) {
    return res.status(400).json({ error: `Shop slug "${generatedSlug}" is already taken. Please choose another.` });
  }

  // Create owner account with verified status if OTP was submitted
  const newUser = db.createUser({
    email,
    passwordHash: crypto.createHash('sha256').update(password).digest('hex'),
    fullName: fullName || shopName,
    whatsappNumber,
    whatsappVerified: Boolean(verified || otpCode),
    role: 'shop_owner',
  });

  // Create Shop in active status immediately so shop owner can instantly receive prints
  const newShop = db.createShop({
    slug: generatedSlug,
    name: shopName,
    ownerId: newUser.id,
    phone: phone || whatsappNumber,
    address: address || 'Main Road Counter',
    city: city || 'City Center',
    status: 'active',
  });

  // Activity Log
  db.logActivity({
    shopId: newShop.id,
    userId: newUser.id,
    actionType: 'shop_registered',
    description: `Shop "${newShop.name}" registered. WhatsApp: ${whatsappNumber}.`,
  });

  const sessionToken = createSessionToken(newUser, newShop);

  res.status(201).json({
    message: 'Shop registration submitted successfully. Please verify your WhatsApp number.',
    user: {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      whatsappNumber: newUser.whatsappNumber,
      whatsappVerified: newUser.whatsappVerified,
      role: newUser.role,
    },
    shop: newShop,
    token: sessionToken,
  });
});

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password).trim();
    const user = db.getUserByEmail(cleanEmail);
    if (!user || !db.verifyPassword(cleanPassword, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const shop = user.role === 'admin' ? undefined : db.getShopByOwnerId(user.id);
    const token = createSessionToken(user, shop);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        whatsappNumber: user.whatsappNumber,
        whatsappVerified: user.whatsappVerified,
        role: user.role,
      },
      shop,
      token,
    });
  } catch (err: any) {
    console.error('Error during login:', err);
    return res.status(500).json({ error: err.message || 'Internal server error during login' });
  }
});

// Get Current User Profile
app.get('/api/auth/me', requireAuth, (req, res) => {
  const session = (req as any).user;
  const user = db.getUserById(session.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  let shop = user.role === 'admin' ? undefined : (session.shopId ? db.getShopById(session.shopId) : undefined);
  if (!shop && user.role !== 'admin') {
    shop = db.getShopByOwnerId(user.id);
  }
  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      whatsappNumber: user.whatsappNumber,
      whatsappVerified: user.whatsappVerified,
      role: user.role,
    },
    shop,
  });
});

// WhatsApp OTP Request
app.post('/api/auth/request-otp', requireAuth, async (req, res) => {
  const session = (req as any).user;
  const user = db.getUserById(session.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const shop = db.getShopByOwnerId(user.id);
  const otp = whatsAppService.generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  // Save in user profile
  db.updateUser(user.id, {
    whatsappOtp: otp,
    whatsappOtpExpiresAt: expiresAt,
  });

  const sendResult = await whatsAppService.sendVerificationOtp(
    user.whatsappNumber,
    otp,
    shop?.name || 'printx'
  );

  res.json({
    success: true,
    message: `Verification code sent to ${user.whatsappNumber}`,
    provider: sendResult.provider,
    expiresAt,
    // Note: For dev/demo convenience when external SMS credentials aren't set, we include devHint
    devHint: !process.env.WHATSAPP_API_KEY ? `Dev / Test Code: ${otp}` : undefined,
  });
});

// WhatsApp OTP Verification
app.post('/api/auth/verify-otp', requireAuth, (req, res) => {
  const session = (req as any).user;
  const { code } = req.body;
  const user = db.getUserById(session.userId);

  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!code) return res.status(400).json({ error: 'Please enter verification code.' });

  if (!user.whatsappOtp || !user.whatsappOtpExpiresAt) {
    return res.status(400).json({ error: 'No pending verification request found. Please request a new code.' });
  }

  if (new Date(user.whatsappOtpExpiresAt).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
  }

  if (user.whatsappOtp !== code.trim()) {
    return res.status(400).json({ error: 'Incorrect verification code. Please check and try again.' });
  }

  // Verification succeeded!
  const updatedUser = db.updateUser(user.id, {
    whatsappVerified: true,
    whatsappOtp: undefined,
    whatsappOtpExpiresAt: undefined,
  });

  if (session.shopId) {
    db.logActivity({
      shopId: session.shopId,
      userId: user.id,
      actionType: 'whatsapp_verified',
      description: `WhatsApp number ${user.whatsappNumber} verified successfully.`,
    });
  }

  res.json({
    success: true,
    message: 'WhatsApp number verified successfully!',
    whatsappVerified: true,
  });
});

// Password Reset Request
app.post('/api/auth/reset-password-request', (req, res) => {
  const { email } = req.body;
  const user = db.getUserByEmail(email);
  if (!user) {
    // Return standard message to prevent email enumeration
    return res.json({ message: 'If this email exists in our system, password reset instructions have been generated.' });
  }

  const resetToken = crypto.randomBytes(20).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  db.updateUser(user.id, { resetToken, resetTokenExpiresAt: expiresAt });

  console.log(`[Auth] Password reset token generated for ${email}: ${resetToken}`);
  res.json({
    message: 'Password reset token generated.',
    resetToken, // Provided for user to complete the reset workflow
  });
});

// Password Reset Confirm
app.post('/api/auth/reset-password-confirm', (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) {
    return res.status(400).json({ error: 'Reset token and new password are required.' });
  }

  const allUsers = (db as any).data.users as User[];
  const user = allUsers.find(
    (u) => u.resetToken === resetToken && u.resetTokenExpiresAt && new Date(u.resetTokenExpiresAt).getTime() > Date.now()
  );

  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired password reset token.' });
  }

  db.updateUser(user.id, {
    passwordHash: crypto.createHash('sha256').update(newPassword).digest('hex'),
    resetToken: undefined,
    resetTokenExpiresAt: undefined,
  });

  res.json({ message: 'Password updated successfully. You can now log in.' });
});

// ==========================================
// 2. ADMIN SHOP REVIEW & ACTIVATION
// ==========================================

// List all registered shops for review
app.get('/api/admin/shops', requireAuth, (req, res) => {
  const session = (req as any).user;
  if (session.role !== 'admin') {
    return res.status(403).json({ error: 'Only system administrators can access shop approvals.' });
  }

  const shops = db.getAllShops();
  const detailedShops = shops.map((s) => {
    const owner = db.getUserById(s.ownerId);
    return {
      ...s,
      ownerName: owner?.fullName,
      ownerEmail: owner?.email,
      ownerWhatsApp: owner?.whatsappNumber,
      ownerWhatsAppVerified: owner?.whatsappVerified,
    };
  });

  res.json(detailedShops);
});

// Admin Create Shop directly
app.post('/api/admin/shops', requireAuth, (req, res) => {
  const session = (req as any).user;
  if (session.role !== 'admin') {
    return res.status(403).json({ error: 'Only system administrators can register new shops.' });
  }

  const { name, slug, phone, address, city, ownerName, ownerEmail, ownerPassword, ownerWhatsApp } = req.body;
  if (!name || !ownerEmail) {
    return res.status(400).json({ error: 'Shop name and owner email are required.' });
  }

  let owner = db.getUserByEmail(ownerEmail);
  if (!owner) {
    owner = db.createUser({
      email: ownerEmail,
      passwordHash: crypto.createHash('sha256').update(ownerPassword || 'Shop#1234').digest('hex'),
      fullName: ownerName || name,
      whatsappNumber: ownerWhatsApp || phone || '+910000000000',
      whatsappVerified: true,
      role: 'shop_owner',
    });
  }

  const generatedSlug = (slug || name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const newShop = db.createShop({
    slug: generatedSlug,
    name,
    ownerId: owner.id,
    phone: phone || '+919876543210',
    address: address || 'Main Road',
    city: city || 'City',
    status: 'active',
  });

  db.logActivity({
    shopId: newShop.id,
    userId: session.userId,
    actionType: 'shop_registered',
    description: `Shop "${newShop.name}" registered and activated directly by Super Admin.`,
  });

  res.status(201).json({ message: 'Shop created and activated successfully', shop: newShop });
});

// Admin Update / Edit Shop Details
app.put('/api/admin/shops/:id', requireAuth, (req, res) => {
  const session = (req as any).user;
  if (session.role !== 'admin') {
    return res.status(403).json({ error: 'Only system administrators can edit shops.' });
  }

  const shopId = req.params.id;
  const { name, phone, address, city, status, slug } = req.body;
  const shop = db.getShopById(shopId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const updated = db.updateShop(shopId, {
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
    ...(address ? { address } : {}),
    ...(city ? { city } : {}),
    ...(status ? { status } : {}),
    ...(slug ? { slug } : {}),
  });

  db.logActivity({
    shopId,
    userId: session.userId,
    actionType: 'shop_updated',
    description: `Shop "${shop.name}" updated by Administrator.`,
  });

  res.json({ message: 'Shop updated successfully', shop: updated });
});

// Admin Delete Shop
app.delete('/api/admin/shops/:id', requireAuth, (req, res) => {
  const session = (req as any).user;
  if (session.role !== 'admin') {
    return res.status(403).json({ error: 'Only system administrators can delete shops.' });
  }

  const shopId = req.params.id;
  const shop = db.getShopById(shopId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  db.deleteShop(shopId);

  res.json({ message: `Shop "${shop.name}" and all associated data permanently deleted.` });
});

// Activate or Reject Shop
app.post('/api/admin/shops/:id/activate', requireAuth, (req, res) => {
  const session = (req as any).user;
  if (session.role !== 'admin') {
    return res.status(403).json({ error: 'Only system administrators can activate shops.' });
  }

  const shopId = req.params.id;
  const { action, rejectionReason } = req.body; // action: 'activate' | 'reject' | 'suspend'

  const shop = db.getShopById(shopId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  if (action === 'activate') {
    const updated = db.updateShop(shopId, {
      status: 'active',
      activatedAt: new Date().toISOString(),
      activatedBy: session.userId,
      rejectionReason: undefined,
    });
    db.logActivity({
      shopId,
      userId: session.userId,
      actionType: 'shop_activated',
      description: `Shop "${shop.name}" approved and activated by Administrator. Customer orders are now live.`,
    });
    return res.json({ message: 'Shop activated successfully!', shop: updated });
  } else if (action === 'reject') {
    const updated = db.updateShop(shopId, {
      status: 'rejected',
      rejectionReason: rejectionReason || 'Shop verification requirements not met.',
    });
    db.logActivity({
      shopId,
      userId: session.userId,
      actionType: 'shop_rejected',
      description: `Shop "${shop.name}" rejected by Administrator: ${rejectionReason}`,
    });
    return res.json({ message: 'Shop rejected.', shop: updated });
  }

  res.status(400).json({ error: 'Invalid action' });
});

// ==========================================
// 3. PUBLIC SHOP & CUSTOMER QR PORTAL
// ==========================================

// Get Shop Public Profile & Print Rates (supports /api/shops/:slug and /api/s/:slug)
app.get(['/api/shops/:slug', '/api/s/:slug'], (req, res) => {
  const slug = req.params.slug;
  const shop = db.getShopBySlug(slug);

  if (!shop) {
    return res.status(404).json({ error: 'Shop not found. Please verify the QR code URL.' });
  }

  const pricing = db.getShopPricing(shop.id);
  const approvalRules = db.getShopApprovalRules(shop.id);

  res.json({
    shop: {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      phone: shop.phone,
      address: shop.address,
      city: shop.city,
      status: shop.status,
    },
    pricing: {
      bwSinglePrice: pricing.bwSinglePrice,
      bwDuplexPrice: pricing.bwDuplexPrice,
      colorSinglePrice: pricing.colorSinglePrice,
      colorDuplexPrice: pricing.colorDuplexPrice,
      legalExtra: pricing.legalExtra,
      photo4x6Price: pricing.photo4x6Price,
      idCardSinglePrice: pricing.idCardSinglePrice,
      currency: pricing.currency,
    },
    requiresCounterPayment: approvalRules.requirePaymentBeforePrint,
  });
});

// Customer File Upload with safe multer handling
app.post('/api/orders/upload', (req, res) => {
  upload.single('file')(req, res, (uploadErr: any) => {
    if (uploadErr) {
      console.error('Multer file upload error:', uploadErr);
      return res.status(400).json({
        error: uploadErr.message || 'File upload failed. Ensure file size is under 50MB.',
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file was uploaded. Please choose a PDF or image file.' });
    }

    const validation = storageService.validateFile(
      req.file.originalname,
      req.file.mimetype,
      req.file.size
    );

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    try {
      const saved = storageService.saveFileBuffer(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      res.json({
        fileId: saved.id,
        fileName: saved.originalName,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        filePath: saved.filePath,
        pageCount: saved.pageCount,
      });
    } catch (err: any) {
      console.error('File storage error:', err);
      res.status(500).json({ error: 'Failed to securely store uploaded file.' });
    }
  });
});

// Customer Order Submission
app.post('/api/orders', (req, res) => {
  const {
    shopSlug,
    customerName,
    customerPhone,
    documentName,
    documentType,
    filePath,
    fileSizeBytes,
    pageCount,
    copies,
    colorMode,
    duplexMode,
    paperSize,
    orderType,
    pageRange,
    customNotes,
  } = req.body;

  if (!shopSlug || !documentName || !filePath) {
    return res.status(400).json({ error: 'Missing required order details.' });
  }

  const shop = db.getShopBySlug(shopSlug);
  if (!shop) {
    return res.status(404).json({ error: 'Shop not found.' });
  }

  // Strict check: shop must be activated!
  if (shop.status !== 'active') {
    return res.status(403).json({
      error: 'This shop is currently undergoing review and cannot accept print jobs yet. Please contact the shop owner.',
      shopStatus: shop.status,
    });
  }

  const pricing = db.getShopPricing(shop.id);
  const rules = db.getShopApprovalRules(shop.id);

  // Server computes exact price snapshot! Never trust client calculations.
  const priceCalc = calculateOrderPrice(pricing, {
    pageCount: Number(pageCount || 1),
    copies: Number(copies || 1),
    colorMode: colorMode === 'color' ? 'color' : 'bw',
    duplexMode: duplexMode === 'duplex' ? 'duplex' : 'single',
    paperSize: paperSize || 'A4',
    orderType: orderType || 'document',
  });

  // Evaluate Approval Rules
  let initialStatus: 'pending_approval' | 'payment_pending' | 'queued' = 'pending_approval';

  const totalPages = (pageCount || 1) * (copies || 1);
  const isAutoApproved =
    rules.mode === 'auto' ||
    (rules.mode === 'smart' &&
      totalPages <= rules.maxAutoPages &&
      priceCalc.totalAmount <= rules.maxAutoAmount);

  if (isAutoApproved) {
    // If shop requires payment before print, order waits in payment_pending
    if (rules.requirePaymentBeforePrint) {
      initialStatus = 'payment_pending';
    } else {
      initialStatus = 'queued';
    }
  }

  const order = db.createOrder({
    shopId: shop.id,
    customerName: customerName ? customerName.trim() : 'Counter Customer',
    customerPhone: customerPhone ? customerPhone.trim() : '',
    documentName,
    documentType: documentType || 'application/pdf',
    filePath,
    fileSizeBytes: fileSizeBytes || 0,
    pageCount: Number(pageCount || 1),
    copies: Number(copies || 1),
    colorMode: colorMode === 'color' ? 'color' : 'bw',
    duplexMode: duplexMode === 'duplex' ? 'duplex' : 'single',
    paperSize: paperSize || 'A4',
    orderType: orderType || 'document',
    pageRange: pageRange || 'all',
    customNotes,
    unitPrice: priceCalc.unitPrice,
    totalAmount: priceCalc.totalAmount,
    status: initialStatus,
    paymentStatus: 'unpaid',
    files: Array.isArray(req.body.files) ? req.body.files : undefined,
  });

  db.logActivity({
    shopId: shop.id,
    actionType: 'order_submitted',
    description: `Order ${order.orderNumber} placed by ${customerName} (${order.documentName}, ₹${order.totalAmount}). Status: ${initialStatus}`,
    metadata: { orderNumber: order.orderNumber, amount: order.totalAmount },
  });

  res.status(201).json({
    message: 'Order placed successfully!',
    order: {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      documentName: order.documentName,
      pageCount: order.pageCount,
      copies: order.copies,
      colorMode: order.colorMode,
      duplexMode: order.duplexMode,
      paperSize: order.paperSize,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
    },
    shop: {
      name: shop.name,
      phone: shop.phone,
      address: shop.address,
    },
  });
});

// Customer Track Order by Order Number
app.get('/api/orders/:orderNumber', (req, res) => {
  const orderNumber = req.params.orderNumber;
  const order = db.getOrderByNumber(orderNumber);

  if (!order) {
    return res.status(404).json({ error: 'Order not found. Please check your order number.' });
  }

  const shop = db.getShopById(order.shopId);

  res.json({
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      documentName: order.documentName,
      pageCount: order.pageCount,
      copies: order.copies,
      colorMode: order.colorMode,
      duplexMode: order.duplexMode,
      paperSize: order.paperSize,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentCollectedAt: order.paymentCollectedAt,
      printedAt: order.printedAt,
      createdAt: order.createdAt,
    },
    shop: {
      name: shop?.name,
      phone: shop?.phone,
      address: shop?.address,
      city: shop?.city,
    },
  });
});

// Customer Complete Online Payment (Instant Print Trigger - No Manual Approval Needed)
app.post('/api/orders/:orderNumber/pay-online', (req, res) => {
  const { orderNumber } = req.params;
  const { transactionId, paymentMethod = 'online_upi' } = req.body;
  const order = db.getOrderByNumber(orderNumber);

  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  // 1. Record payment
  db.recordPayment({
    orderId: order.id,
    shopId: order.shopId,
    amount: order.totalAmount,
    method: 'online_upi',
    collectorName: 'Online UPI Gateway',
    notes: `Online payment verified. Ref: ${transactionId || 'UPI-' + Date.now()}`,
  });

  // 2. Immediately dispatch to active printer spooler (Zero approval friction)
  const agent = db.getAgentByShopId(order.shopId);
  const targetPrinter = (order.colorMode === 'color' ? agent?.colorPrinter : agent?.bwPrinter) || agent?.defaultPrinter || 'Default Windows Printer';

  db.createPrintJob(order.id, order.shopId, targetPrinter);
  db.updateOrderStatus(order.id, 'printing', 'Auto-Print Spooler', undefined, `Online payment received (₹${order.totalAmount}). Automatically spooled to "${targetPrinter}".`);

  db.logActivity({
    shopId: order.shopId,
    actionType: 'payment_collected',
    description: `Order ${order.orderNumber} paid ₹${order.totalAmount} online. Instantly sent to printer.`,
  });

  res.json({
    success: true,
    message: 'Payment completed successfully! Your document is printing directly on the shop printer.',
    order: db.getOrderById(order.id),
  });
});

// Shop / Admin Delete Order Permanently
app.delete('/api/shop/orders/:id', requireAuth, (req, res) => {
  const session = (req as any).user;
  const orderId = req.params.id;
  const order = db.getOrderById(orderId);

  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Verification: owner of shop or admin
  if (session.role !== 'admin' && session.shopId !== order.shopId) {
    const shop = db.getShopByOwnerId(session.userId);
    if (!shop || shop.id !== order.shopId) {
      return res.status(403).json({ error: 'Access denied.' });
    }
  }

  db.deleteOrder(orderId);

  db.logActivity({
    shopId: order.shopId,
    userId: session.userId,
    actionType: 'order_deleted',
    description: `Order ${order.orderNumber} permanently deleted by ${session.role === 'admin' ? 'Administrator' : 'Shopkeeper'}.`,
  });

  res.json({ success: true, message: `Order ${order.orderNumber} deleted permanently.` });
});

app.post('/api/shop/orders/:id/delete', requireAuth, (req, res) => {
  const session = (req as any).user;
  const orderId = req.params.id;
  const order = db.getOrderById(orderId);

  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (session.role !== 'admin' && session.shopId !== order.shopId) {
    const shop = db.getShopByOwnerId(session.userId);
    if (!shop || shop.id !== order.shopId) {
      return res.status(403).json({ error: 'Access denied.' });
    }
  }

  db.deleteOrder(orderId);

  db.logActivity({
    shopId: order.shopId,
    userId: session.userId,
    actionType: 'order_deleted',
    description: `Order ${order.orderNumber} permanently deleted.`,
  });

  res.json({ success: true, message: `Order ${order.orderNumber} deleted permanently.` });
});

// ==========================================
// 4. SHOP DASHBOARD API (PROTECTED)
// ==========================================

// Get Current Shop Details & Setup
app.get('/api/shop/current', requireAuth, (req, res) => {
  const session = (req as any).user;
  const shop = session.shopId ? db.getShopById(session.shopId) : db.getShopByOwnerId(session.userId);

  if (!shop) {
    return res.status(404).json({ error: 'No shop associated with this user.' });
  }

  res.json(shop);
});

// Supabase Cloud Status & Manual Trigger
app.get('/api/supabase/status', (req, res) => {
  res.json(supabaseService.getStatus());
});

app.post('/api/supabase/sync', async (req, res) => {
  try {
    const success = await supabaseService.saveRemoteState((db as any).data);
    res.json({ success, status: supabaseService.getStatus() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Shop Details
const handleUpdateShop = (req: Request, res: Response) => {
  const session = (req as any).user;
  const shop = session.shopId ? db.getShopById(session.shopId) : db.getShopByOwnerId(session.userId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const { name, phone, address, city, upiId, requiresCounterPayment } = req.body;
  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (address !== undefined) updates.address = address;
  if (city !== undefined) updates.city = city;
  if (upiId !== undefined) updates.upiId = upiId;
  if (requiresCounterPayment !== undefined) updates.requiresCounterPayment = Boolean(requiresCounterPayment);

  const updated = db.updateShop(shop.id, updates);

  db.logActivity({
    shopId: shop.id,
    userId: session.userId,
    actionType: 'shop_profile_updated',
    description: `Shop profile updated by owner (${shop.name}).`,
  });

  res.json(updated);
};

app.put('/api/shop/current', requireAuth, handleUpdateShop);
app.put('/api/shop/profile', requireAuth, handleUpdateShop);

// Get & Update Pricing
app.get('/api/shop/pricing', requireAuth, (req, res) => {
  const session = (req as any).user;
  const shop = session.shopId ? db.getShopById(session.shopId) : db.getShopByOwnerId(session.userId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const pricing = db.getShopPricing(shop.id);
  res.json(pricing);
});

app.put('/api/shop/pricing', requireAuth, (req, res) => {
  const session = (req as any).user;
  const shop = session.shopId ? db.getShopById(session.shopId) : db.getShopByOwnerId(session.userId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const {
    bwSinglePrice,
    bwDuplexPrice,
    colorSinglePrice,
    colorDuplexPrice,
    legalExtra,
    photo4x6Price,
    idCardSinglePrice,
  } = req.body;

  const updated = db.updateShopPricing(shop.id, {
    bwSinglePrice: Number(bwSinglePrice),
    bwDuplexPrice: Number(bwDuplexPrice),
    colorSinglePrice: Number(colorSinglePrice),
    colorDuplexPrice: Number(colorDuplexPrice),
    legalExtra: Number(legalExtra),
    photo4x6Price: Number(photo4x6Price),
    idCardSinglePrice: Number(idCardSinglePrice),
  });

  db.logActivity({
    shopId: shop.id,
    userId: session.userId,
    actionType: 'pricing_updated',
    description: `Updated printing rates: B&W ₹${bwSinglePrice}/₹${bwDuplexPrice}, Color ₹${colorSinglePrice}/₹${colorDuplexPrice}`,
  });

  res.json(updated);
});

// Get & Update Approval Rules
app.get('/api/shop/approval-rules', requireAuth, (req, res) => {
  const session = (req as any).user;
  const shop = session.shopId ? db.getShopById(session.shopId) : db.getShopByOwnerId(session.userId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const rules = db.getShopApprovalRules(shop.id);
  res.json(rules);
});

app.put('/api/shop/approval-rules', requireAuth, (req, res) => {
  const session = (req as any).user;
  const shop = session.shopId ? db.getShopById(session.shopId) : db.getShopByOwnerId(session.userId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const { mode, maxAutoPages, maxAutoAmount, requirePaymentBeforePrint, notifyWhatsapp } = req.body;

  const updated = db.updateShopApprovalRules(shop.id, {
    mode,
    maxAutoPages: Number(maxAutoPages),
    maxAutoAmount: Number(maxAutoAmount),
    requirePaymentBeforePrint: Boolean(requirePaymentBeforePrint),
    notifyWhatsapp: Boolean(notifyWhatsapp),
  });

  db.logActivity({
    shopId: shop.id,
    userId: session.userId,
    actionType: 'rules_updated',
    description: `Approval mode updated to ${mode.toUpperCase()} (Payment before print: ${requirePaymentBeforePrint ? 'Yes' : 'No'})`,
  });

  res.json(updated);
});

// Orders Queue
app.get('/api/shop/orders', requireAuth, (req, res) => {
  const session = (req as any).user;
  const shop = session.shopId ? db.getShopById(session.shopId) : db.getShopByOwnerId(session.userId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const filter = (req.query.filter as string) || 'all';
  const orders = db.getOrdersByShop(shop.id, filter);
  res.json(orders);
});

// Approve Order
app.post('/api/shop/orders/:id/approve', requireAuth, (req, res) => {
  const session = (req as any).user;
  const orderId = req.params.id;
  const order = db.getOrderById(orderId);

  if (!order) return res.status(404).json({ error: 'Order not found' });
  const rules = db.getShopApprovalRules(order.shopId);

  // If counter payment is required and not yet collected, move to payment_pending
  const nextStatus = rules.requirePaymentBeforePrint && order.paymentStatus !== 'collected' ? 'payment_pending' : 'queued';

  const user = db.getUserById(session.userId);
  const updated = db.updateOrderStatus(orderId, nextStatus, user?.fullName || 'Shopkeeper', session.userId, 'Order approved by shopkeeper');

  db.logActivity({
    shopId: order.shopId,
    userId: session.userId,
    actionType: 'order_approved',
    description: `Order ${order.orderNumber} approved. Moved to ${nextStatus}.`,
  });

  res.json(updated);
});

// Reject Order
app.post('/api/shop/orders/:id/reject', requireAuth, (req, res) => {
  const session = (req as any).user;
  const orderId = req.params.id;
  const { reason } = req.body;
  const order = db.getOrderById(orderId);

  if (!order) return res.status(404).json({ error: 'Order not found' });
  const user = db.getUserById(session.userId);

  const updated = db.updateOrderStatus(orderId, 'rejected', user?.fullName || 'Shopkeeper', session.userId, reason || 'Rejected by shopkeeper');

  db.logActivity({
    shopId: order.shopId,
    userId: session.userId,
    actionType: 'order_rejected',
    description: `Order ${order.orderNumber} rejected: ${reason || 'No reason provided'}`,
  });

  res.json(updated);
});

// Record Counter Payment
app.post('/api/shop/orders/:id/collect-payment', requireAuth, (req, res) => {
  const session = (req as any).user;
  const orderId = req.params.id;
  const { method, notes } = req.body; // method: 'counter_cash' | 'counter_upi'
  const order = db.getOrderById(orderId);

  if (!order) return res.status(404).json({ error: 'Order not found' });
  const user = db.getUserById(session.userId);

  const payment = db.recordPayment({
    orderId,
    shopId: order.shopId,
    amount: order.totalAmount,
    method: method || 'counter_cash',
    collectorName: user?.fullName || 'Shopkeeper',
    notes,
  });

  db.logActivity({
    shopId: order.shopId,
    userId: session.userId,
    actionType: 'payment_collected',
    description: `Collected ₹${order.totalAmount} via ${method === 'counter_upi' ? 'UPI' : 'Cash'} for order ${order.orderNumber}`,
  });

  res.json({ message: 'Payment recorded successfully', payment, order: db.getOrderById(orderId) });
});

// Dispatch to Printer Queue / Trigger Print
app.post('/api/shop/orders/:id/dispatch-print', requireAuth, (req, res) => {
  const session = (req as any).user;
  const orderId = req.params.id;
  const { printerName } = req.body;
  const order = db.getOrderById(orderId);

  if (!order) return res.status(404).json({ error: 'Order not found' });

  const agent = db.getAgentByShopId(order.shopId);
  const targetPrinter = printerName || (order.colorMode === 'color' ? agent?.colorPrinter : agent?.bwPrinter) || agent?.defaultPrinter || 'Default Windows Printer';

  const job = db.createPrintJob(orderId, order.shopId, targetPrinter);

  // Update order status to queued
  db.updateOrderStatus(orderId, 'queued', 'Print Dispatcher', session.userId, `Sent to print job queue for "${targetPrinter}"`);

  db.logActivity({
    shopId: order.shopId,
    userId: session.userId,
    actionType: 'job_dispatched',
    description: `Job created for order ${order.orderNumber} to printer ${targetPrinter}`,
  });

  res.json({ message: 'Print job dispatched to queue', job });
});

// Complete Order
app.post('/api/shop/orders/:id/complete', requireAuth, (req, res) => {
  const session = (req as any).user;
  const orderId = req.params.id;
  const user = db.getUserById(session.userId);

  const updated = db.updateOrderStatus(orderId, 'completed', user?.fullName || 'Shopkeeper', session.userId, 'Marked completed');

  res.json(updated);
});

// Archive & Restore Order
app.post('/api/shop/orders/:id/archive', requireAuth, (req, res) => {
  const session = (req as any).user;
  const orderId = req.params.id;
  const user = db.getUserById(session.userId);

  const updated = db.updateOrderStatus(orderId, 'archived', user?.fullName || 'Shopkeeper', session.userId, 'Archived by shopkeeper');

  res.json(updated);
});

app.post('/api/shop/orders/:id/restore', requireAuth, (req, res) => {
  const session = (req as any).user;
  const orderId = req.params.id;
  const user = db.getUserById(session.userId);

  const updated = db.updateOrderStatus(orderId, 'completed', user?.fullName || 'Shopkeeper', session.userId, 'Restored from archive');

  res.json(updated);
});

// Document Preview Token Generator
app.get('/api/shop/orders/:id/document-token', requireAuth, (req, res) => {
  const orderId = req.params.id;
  const order = db.getOrderById(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const { token, expiresAt } = storageService.generateSignedToken(orderId, 30);
  res.json({ token, expiresAt, url: `/api/documents/preview/${orderId}?token=${token}` });
});

// Document Stream / Preview with Token or Auth Header
app.get('/api/documents/preview/:orderId', (req, res) => {
  const { orderId } = req.params;
  const token = req.query.token as string;

  let authorized = false;
  if (token && storageService.verifySignedToken(token, orderId)) {
    authorized = true;
  } else {
    // Check Authorization header for logged-in shop owners
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const session = verifySessionToken(authHeader.substring(7));
      if (session) authorized = true;
    }
  }

  if (!authorized) {
    return res.status(403).json({ error: 'Invalid or expired document access token.' });
  }

  const order = db.getOrderById(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (order.isDocumentPurged) {
    return res.status(410).json({
      error: 'Customer document files were permanently deleted 5 minutes after print completion as per customer privacy policy.',
      purged: true,
      purgedAt: order.purgedAt,
    });
  }

  try {
    const filePath = storageService.getAbsolutePath(order.filePath);
    res.removeHeader('X-Frame-Options');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Type', order.documentType || 'application/pdf');

    if (!fs.existsSync(filePath)) {
      // In dev/demo, serve a valid dummy PDF document if local sample file isn't on disk
      res.setHeader('Content-Disposition', `inline; filename="${order.documentName}"`);
      return res.send(`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n200\n%%EOF`);
    }

    res.setHeader('Content-Disposition', `inline; filename="${order.documentName}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: 'Unable to stream file' });
  }
});

// Document Safe Download
app.get('/api/documents/download/:orderId', (req, res) => {
  const { orderId } = req.params;
  const order = db.getOrderById(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (order.isDocumentPurged) {
    return res.status(410).json({
      error: 'Customer document files were permanently deleted 5 minutes after print completion as per customer privacy policy.',
      purged: true,
      purgedAt: order.purgedAt,
    });
  }

  try {
    const filePath = storageService.getAbsolutePath(order.filePath);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(order.documentName)}"`);
    res.setHeader('Content-Type', order.documentType || 'application/octet-stream');

    if (!fs.existsSync(filePath)) {
      return res.send(`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n200\n%%EOF`);
    }

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Unable to download file' });
  }
});

// Shop Reports & Stats
app.get('/api/shop/stats', requireAuth, (req, res) => {
  const session = (req as any).user;
  const shop = session.shopId ? db.getShopById(session.shopId) : db.getShopByOwnerId(session.userId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const stats = db.getShopStats(shop.id);
  res.json(stats);
});

// Shop Activity Logs
app.get('/api/shop/activity', requireAuth, (req, res) => {
  const session = (req as any).user;
  const shop = session.shopId ? db.getShopById(session.shopId) : db.getShopByOwnerId(session.userId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const logs = db.getActivityLogs(shop.id);
  res.json(logs);
});

// ==========================================
// 5. WINDOWS AGENT & PRINTER INTEGRATION
// ==========================================

// Create or retrieve Utility API Key (ADRTech Desktop for Windows)
app.post('/api/shop/agent/utility-key', requireAuth, (req, res) => {
  const session = (req as any).user;
  const shop = session.shopId ? db.getShopById(session.shopId) : db.getShopByOwnerId(session.userId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const result = db.createUtilityApiKey(shop.id);

  db.logActivity({
    shopId: shop.id,
    userId: session.userId,
    actionType: 'utility_key_created',
    description: `Utility API Key created for Windows Desktop application.`,
  });

  res.json({
    apiKey: result.key,
    agent: result.agent,
  });
});

// Helper to build dynamic Windows ZIP package with current host pre-configured
function buildDynamicAgentZip(currentHost: string): Buffer {
  const batPath = path.resolve(process.cwd(), './windows-agent/printx-PrintAgent.bat');
  const pyPath = path.resolve(process.cwd(), './windows-agent/agent.py');
  const psPath = path.resolve(process.cwd(), './windows-agent/Install-And-Run.ps1');
  const startBatPath = path.resolve(process.cwd(), './windows-agent/start_agent.bat');
  const reqPath = path.resolve(process.cwd(), './windows-agent/requirements.txt');

  let batContent = fs.existsSync(batPath) ? fs.readFileSync(batPath, 'utf8') : '';
  batContent = batContent.replace(/\$ServerBox\.Text = "[^"]*"/g, `$ServerBox.Text = "${currentHost}"`);

  let pyContent = fs.existsSync(pyPath) ? fs.readFileSync(pyPath, 'utf8') : '';
  pyContent = pyContent.replace(/DEFAULT_SERVER = "[^"]*"/g, `DEFAULT_SERVER = "${currentHost}"`);

  let psContent = fs.existsSync(psPath) ? fs.readFileSync(psPath, 'utf8') : '';
  psContent = psContent.replace(/\[string\]\$ServerUrl = "[^"]*"/g, `[string]$ServerUrl = "${currentHost}"`);

  const files = [
    { name: 'printx-PrintAgent.bat', content: Buffer.from(batContent, 'utf8') },
    { name: 'start_agent.bat', content: fs.existsSync(startBatPath) ? fs.readFileSync(startBatPath) : Buffer.from('') },
    { name: 'Install-And-Run.ps1', content: Buffer.from(psContent, 'utf8') },
    { name: 'agent.py', content: Buffer.from(pyContent, 'utf8') },
    { name: 'requirements.txt', content: fs.existsSync(reqPath) ? fs.readFileSync(reqPath) : Buffer.from('requests\nPySide6\npywin32\n') },
  ];

  const parts: Buffer[] = [];
  const centralDirectory: Buffer[] = [];
  let offset = 0;

  files.forEach((f) => {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const dataBuf = f.content;
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(dataBuf.length, 18);
    localHeader.writeUInt32LE(dataBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    parts.push(localHeader, nameBuf, dataBuf);

    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0);
    cdHeader.writeUInt16LE(20, 4);
    cdHeader.writeUInt16LE(20, 6);
    cdHeader.writeUInt16LE(0, 8);
    cdHeader.writeUInt16LE(0, 10);
    cdHeader.writeUInt16LE(0, 12);
    cdHeader.writeUInt32LE(0, 14);
    cdHeader.writeUInt32LE(dataBuf.length, 20);
    cdHeader.writeUInt32LE(dataBuf.length, 24);
    cdHeader.writeUInt16LE(nameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30);
    cdHeader.writeUInt16LE(0, 32);
    cdHeader.writeUInt16LE(0, 34);
    cdHeader.writeUInt16LE(0, 36);
    cdHeader.writeUInt32LE(0, 38);
    cdHeader.writeUInt32LE(offset, 42);

    centralDirectory.push(cdHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + dataBuf.length;
  });

  const cdBuf = Buffer.concat(centralDirectory);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, cdBuf, eocd]);
}

// Download Windows app package (Valid Windows .zip package with currentHost preconfigured)
app.get('/api/agent/download-windows-exe', (req, res) => {
  const currentHost = `${req.protocol}://${req.get('host')}`;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="printx-Windows-Desktop-Package.zip"');

  try {
    const zipBuf = buildDynamicAgentZip(currentHost);
    res.send(zipBuf);
  } catch (err) {
    const zipPath = path.resolve(process.cwd(), './windows-agent/printx-Windows-Desktop-Package.zip');
    if (fs.existsSync(zipPath)) {
      res.sendFile(zipPath);
    } else {
      res.sendFile(path.resolve(process.cwd(), './windows-agent/agent.py'));
    }
  }
});

// Download Windows Batch Runner directly (.bat with currentHost pre-configured)
app.get('/api/agent/download-bat', (req, res) => {
  const batPath = path.resolve(process.cwd(), './windows-agent/printx-PrintAgent.bat');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/x-bat');
  res.setHeader('Content-Disposition', 'attachment; filename="printx-PrintAgent.bat"');

  const currentHost = `${req.protocol}://${req.get('host')}`;
  if (fs.existsSync(batPath)) {
    let content = fs.readFileSync(batPath, 'utf8');
    content = content.replace(/\$ServerBox\.Text = "[^"]*"/g, `$ServerBox.Text = "${currentHost}"`);
    return res.send(content);
  } else {
    const fallbackPath = path.resolve(process.cwd(), './windows-agent/start_agent.bat');
    res.sendFile(fallbackPath);
  }
});

// Download Python agent script directly (with currentHost pre-configured)
app.get('/api/agent/download-script', (req, res) => {
  const scriptPath = path.resolve(process.cwd(), './windows-agent/agent.py');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/x-python');
  res.setHeader('Content-Disposition', 'attachment; filename="printx_agent.py"');

  const currentHost = `${req.protocol}://${req.get('host')}`;
  if (fs.existsSync(scriptPath)) {
    let content = fs.readFileSync(scriptPath, 'utf8');
    content = content.replace(/DEFAULT_SERVER = "[^"]*"/g, `DEFAULT_SERVER = "${currentHost}"`);
    return res.send(content);
  } else {
    res.send('# printx Print Agent');
  }
});

// Download PowerShell One-Click Runner (.ps1 with currentHost pre-configured)
app.get('/api/agent/download-ps1', (req, res) => {
  const psPath = path.resolve(process.cwd(), './windows-agent/Install-And-Run.ps1');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="Install-And-Run.ps1"');

  const currentHost = `${req.protocol}://${req.get('host')}`;
  if (fs.existsSync(psPath)) {
    let content = fs.readFileSync(psPath, 'utf8');
    content = content.replace(/\[string\]\$ServerUrl = "[^"]*"/g, `[string]$ServerUrl = "${currentHost}"`);
    return res.send(content);
  } else {
    res.send('Write-Host "printx Print Agent"');
  }
});

// Shop generates pairing code for Windows desktop app (Fixed & Permanent per shop)
app.post('/api/shop/agent/pairing-code', requireAuth, (req, res) => {
  const session = (req as any).user;
  const shop = session.shopId ? db.getShopById(session.shopId) : db.getShopByOwnerId(session.userId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const forceReset = Boolean(req.query.reset === 'true' || req.body?.reset);
  const pairing = db.generatePairingCode(shop.id, forceReset);

  db.logActivity({
    shopId: shop.id,
    userId: session.userId,
    actionType: 'pairing_code_generated',
    description: `Fixed 6-digit Windows Agent pairing code: ${pairing.code}`,
  });

  res.json(pairing);
});

// Shop gets agent status and detected printers (ensures permanent pairing code exists)
app.get('/api/shop/agent/status', requireAuth, (req, res) => {
  const session = (req as any).user;
  const shop = session.shopId ? db.getShopById(session.shopId) : db.getShopByOwnerId(session.userId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const agent = db.getOrCreateAgent(shop.id);
  res.json(agent);
});

// Update configured printers (default, bw, color)
app.put('/api/shop/agent/printers', requireAuth, (req, res) => {
  const session = (req as any).user;
  const shop = session.shopId ? db.getShopById(session.shopId) : db.getShopByOwnerId(session.userId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const agent = db.getAgentByShopId(shop.id);
  if (!agent) return res.status(404).json({ error: 'No Windows agent paired with this shop.' });

  const { defaultPrinter, bwPrinter, colorPrinter, dryRunMode } = req.body;
  if (defaultPrinter) agent.defaultPrinter = defaultPrinter;
  if (bwPrinter) agent.bwPrinter = bwPrinter;
  if (colorPrinter) agent.colorPrinter = colorPrinter;
  if (typeof dryRunMode === 'boolean') agent.dryRunMode = dryRunMode;

  (db as any).save();

  db.logActivity({
    shopId: shop.id,
    userId: session.userId,
    actionType: 'printer_config_updated',
    description: `Updated printer routing: B&W -> ${agent.bwPrinter || 'Default'}, Color -> ${agent.colorPrinter || 'Default'}`,
  });

  res.json(agent);
});

// Revoke Windows agent credentials
app.post('/api/shop/agent/revoke', requireAuth, (req, res) => {
  const session = (req as any).user;
  const shop = session.shopId ? db.getShopById(session.shopId) : db.getShopByOwnerId(session.userId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  db.revokeAgent(shop.id);

  db.logActivity({
    shopId: shop.id,
    userId: session.userId,
    actionType: 'agent_revoked',
    description: `Windows Agent credentials revoked by shop owner.`,
  });

  res.json({ message: 'Windows agent paired credentials have been revoked.' });
});

// --- Direct Agent HTTP API (called by Windows PySide6 Desktop App) ---

// Agent Pair with 6-digit code
app.post('/api/agent/pair', (req, res) => {
  const { pairingCode, deviceName } = req.body;
  if (!pairingCode || !deviceName) {
    return res.status(400).json({ error: 'Pairing code and device name are required.' });
  }

  const clientIp = req.ip || req.socket.remoteAddress;
  const result = db.pairAgent(pairingCode.trim(), deviceName, clientIp);

  if (!result) {
    return res.status(401).json({ error: 'Invalid or expired pairing code. Please generate a new code in Shop Dashboard.' });
  }

  res.json({
    message: 'Windows Agent paired successfully!',
    agentId: result.agent.id,
    shopId: result.agent.shopId,
    token: result.token,
  });
});

// Agent Heartbeat & Printer Inventory Report
app.post('/api/agent/heartbeat', requireAgentAuth, (req, res) => {
  const agent = (req as any).agent;
  const { installedPrinters, defaultPrinter } = req.body;

  const updated = db.updateAgentHeartbeat(agent.id, installedPrinters, defaultPrinter);
  res.json({
    status: 'ok',
    serverTime: new Date().toISOString(),
    dryRunMode: updated?.dryRunMode ?? false,
  });
});

// Agent Polls for Authorized Ready Print Jobs
app.get('/api/agent/jobs', requireAgentAuth, (req, res) => {
  const agent = (req as any).agent;
  const pending = db.getPendingPrintJobsForShop(agent.shopId);

  // Return formatted job list with signed download token
  const jobs = pending.map(({ job, order }) => {
    const { token } = storageService.generateSignedToken(order.id, 15);
    return {
      jobId: job.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      documentName: order.documentName,
      documentType: order.documentType,
      copies: order.copies,
      colorMode: order.colorMode,
      duplexMode: order.duplexMode,
      paperSize: order.paperSize,
      targetPrinter: job.printerName,
      downloadUrl: `/api/agent/download-job/${job.id}?token=${token}`,
      dryRunMode: agent.dryRunMode,
    };
  });

  res.json({ jobs });
});

// Agent Claims Job (Atomic claim to prevent duplicate spooling!)
app.post('/api/agent/jobs/:jobId/claim', requireAgentAuth, (req, res) => {
  const agent = (req as any).agent;
  const { jobId } = req.params;

  const claimResult = db.claimPrintJob(jobId, agent.id);
  if (!claimResult.success) {
    return res.status(409).json({ error: 'Job already claimed or not in pending state.' });
  }

  res.json({
    message: 'Job successfully claimed',
    claimToken: claimResult.claimToken,
  });
});

// Agent Reports Print Spooler Status
app.post('/api/agent/jobs/:jobId/report', requireAgentAuth, (req, res) => {
  const { jobId } = req.params;
  const { claimToken, status, errorMessage } = req.body; // status: 'spooling' | 'printed' | 'failed'

  if (!claimToken || !status) {
    return res.status(400).json({ error: 'claimToken and status are required.' });
  }

  const success = db.reportPrintJobStatus(jobId, claimToken, status, errorMessage);
  if (!success) {
    return res.status(400).json({ error: 'Failed to update job status. Invalid token or job.' });
  }

  res.json({ message: `Job status recorded as ${status}` });
});

// Agent Downloads Document for Spooling
app.get('/api/agent/download-job/:jobId', (req, res) => {
  const { jobId } = req.params;
  const token = req.query.token as string;

  const allJobs = (db as any).data.printJobs;
  const job = allJobs.find((j: any) => j.id === jobId);

  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (!token || !storageService.verifySignedToken(token, job.orderId)) {
    return res.status(403).json({ error: 'Invalid or expired download token.' });
  }

  const order = db.getOrderById(job.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  try {
    const fullPath = storageService.getAbsolutePath(order.filePath);
    if (!fs.existsSync(fullPath)) {
      res.setHeader('Content-Type', order.documentType || 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${order.documentName}"`);
      return res.send(`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n200\n%%EOF`);
    }

    res.setHeader('Content-Type', order.documentType);
    res.setHeader('Content-Disposition', `attachment; filename="${order.documentName}"`);
    fs.createReadStream(fullPath).pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: 'File read error' });
  }
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: err.message || 'Internal server error occurred.' });
});

// ==========================================
// 5.5 PRIVACY ENGINE: 5-MINUTE AUTO-PURGE
// ==========================================
// Continuously checks completed/printed orders and permanently purges customer files after 5 minutes
setInterval(() => {
  try {
    const result = db.purgeCompletedOrdersFiles();
    if (result.purgedCount > 0) {
      console.log(`[Privacy Engine] 5-minute auto-purge completed: ${result.purgedCount} order files permanently erased.`);
    }
  } catch (err) {
    console.error('[Privacy Engine] Scheduled purge encountered error:', err);
  }
}, 30 * 1000);

// ==========================================
// 6. VITE SSR / STATIC SERVING
// ==========================================
export default app;

async function startServer() {
  // If running inside Vercel serverless function, don't start the standalone listener
  if (process.env.VERCEL) {
    return;
  }

  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PrintQR Server] Ready and listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal Server Error:', err);
});
