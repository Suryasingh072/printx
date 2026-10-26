import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import Razorpay from 'razorpay';
import { db, resolveTargetPrinter } from './src/server/db/database.js';
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
  const { email, password, fullName, whatsappNumber, shopName, shopSlug, phone, address, city, otpCode, verified } = req.body || {};

  if (!email || !password || !whatsappNumber || !shopName) {
    return res.status(400).json({ error: 'Shop name, Email address, WhatsApp number, and Password are required.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPassword = String(password).trim();
  const cleanWhatsApp = String(whatsappNumber).trim();
  const cleanShopName = String(shopName).trim();

  if (db.getUserByEmail(cleanEmail)) {
    return res.status(400).json({ error: 'An account with this email already exists. Please sign in instead.' });
  }

  let generatedSlug = (shopSlug || cleanShopName)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (!generatedSlug) {
    generatedSlug = `shop-${crypto.randomBytes(3).toString('hex')}`;
  }

  let uniqueSlug = generatedSlug;
  let counter = 1;
  while (db.getShopBySlug(uniqueSlug)) {
    counter++;
    uniqueSlug = `${generatedSlug}-${counter}`;
  }

  const passHash = crypto.createHash('sha256').update(cleanPassword).digest('hex');

  // Create owner account with verified status
  const newUser = db.createUser({
    email: cleanEmail,
    passwordHash: passHash,
    fullName: (fullName || cleanShopName).trim(),
    whatsappNumber: cleanWhatsApp,
    whatsappVerified: true,
    role: 'shop_owner',
  });

  // Create Shop in active status immediately so shop owner can instantly receive prints
  const newShop = db.createShop({
    slug: uniqueSlug,
    name: cleanShopName,
    ownerId: newUser.id,
    phone: phone ? String(phone).trim() : cleanWhatsApp,
    address: address ? String(address).trim() : 'Main Counter',
    city: city ? String(city).trim() : 'City Center',
    status: 'active',
  });

  // Explicitly link user to shop
  db.updateUser(newUser.id, { shopId: newShop.id } as any);

  // Activity Log
  db.logActivity({
    shopId: newShop.id,
    userId: newUser.id,
    actionType: 'shop_registered',
    description: `Shop "${newShop.name}" registered and activated live. WhatsApp: ${cleanWhatsApp}.`,
  });

  db.save();

  const sessionToken = createSessionToken(newUser, newShop);

  res.status(201).json({
    message: 'Shop registration submitted successfully. Your shop is live!',
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

// Login (Supports Email, WhatsApp Number, or Shop Slug)
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password, phone, identifier } = req.body || {};
    const inputId = String(identifier || email || phone || '').trim();
    const rawPass = String(password || '');

    if (!inputId || !rawPass) {
      return res.status(400).json({ error: 'Email/Phone and password are required.' });
    }

    const cleanEmail = inputId.toLowerCase();
    const user = db.getUserByIdentifier(inputId) || db.getUserByEmail(cleanEmail);
    if (!user || !db.verifyPassword(rawPass, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email, phone number, or password.' });
    }

    let shop = user.role === 'admin' ? undefined : db.getShopByOwnerId(user.id);
    if (!shop && user.role !== 'admin') {
      const allShops = db.getAllShops();
      let match = allShops.find((s) => s.ownerId === user.id);
      if (!match) {
        match = allShops.find((s) => {
          const owner = db.getUserById(s.ownerId);
          const ownerEmail = (owner?.email || '').trim().toLowerCase();
          return ownerEmail && ownerEmail === (user.email || '').trim().toLowerCase();
        });
      }
      if (!match && user.shopId) {
        match = db.getShopById(user.shopId);
      }
      if (!match) {
        // Fallback: auto-create active counter for this owner so they never get stuck outside dashboard
        const baseSlug = (user.fullName || user.email.split('@')[0])
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || `counter-${user.id.slice(-4)}`;
        const slug = db.getShopBySlug(baseSlug) ? `${baseSlug}-${Date.now().toString().slice(-4)}` : baseSlug;
        match = db.createShop({
          name: user.fullName || 'Print Counter',
          slug,
          ownerId: user.id,
          phone: user.whatsappNumber || '+919876543210',
          address: 'Main Counter',
          city: 'City Center',
          status: 'active',
        });
      }
      if (match) {
        db.updateShop(match.id, { ownerId: user.id });
        db.updateUser(user.id, { shopId: match.id } as any);
        shop = match;
      }
    }

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
    if (!shop) {
      const allShops = db.getAllShops();
      const match = allShops.find((s) => s.ownerId === user.id);
      if (match) shop = match;
    }
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

// ==========================================
// ADMIN USER MANAGEMENT (CREATE, EDIT, LIST, DELETE)
// ==========================================

// List all registered users
app.get('/api/admin/users', requireAuth, (req, res) => {
  const session = (req as any).user;
  if (session.role !== 'admin') {
    return res.status(403).json({ error: 'Only system administrators can access user management.' });
  }

  const users = db.getAllUsers();
  const allShops = db.getAllShops();

  const userList = users.map((u) => {
    const linkedShop = allShops.find((s) => s.ownerId === u.id);
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      whatsappNumber: u.whatsappNumber,
      whatsappVerified: u.whatsappVerified,
      role: u.role,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      linkedShop: linkedShop ? { id: linkedShop.id, name: linkedShop.name, slug: linkedShop.slug } : null,
    };
  });

  res.json(userList);
});

// Admin Create User directly
app.post('/api/admin/users', requireAuth, (req, res) => {
  const session = (req as any).user;
  if (session.role !== 'admin') {
    return res.status(403).json({ error: 'Only system administrators can create users.' });
  }

  const { email, password, fullName, whatsappNumber, role, shopId } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email address is required.' });
  }
  if (!password || password.trim().length < 6) {
    return res.status(400).json({ error: 'Password is required (minimum 6 characters).' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const existing = db.getUserByEmail(cleanEmail);
  if (existing) {
    return res.status(400).json({ error: `A user with email "${cleanEmail}" already exists.` });
  }

  const newUser = db.createUser({
    email: cleanEmail,
    passwordHash: crypto.createHash('sha256').update(password.trim()).digest('hex'),
    fullName: (fullName && fullName.trim()) || cleanEmail.split('@')[0],
    whatsappNumber: (whatsappNumber && whatsappNumber.trim()) || '+919876543210',
    whatsappVerified: true,
    role: role === 'admin' ? 'admin' : 'shop_owner',
  });

  if (shopId) {
    const shop = db.getShopById(shopId);
    if (shop) {
      db.updateShop(shop.id, { ownerId: newUser.id });
    }
  }

  db.save();

  res.status(201).json({
    message: 'User created successfully and permanently saved.',
    user: {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      whatsappNumber: newUser.whatsappNumber,
      role: newUser.role,
    },
  });
});

// Admin Update User
app.put('/api/admin/users/:id', requireAuth, (req, res) => {
  const session = (req as any).user;
  if (session.role !== 'admin') {
    return res.status(403).json({ error: 'Only system administrators can edit users.' });
  }

  const userId = req.params.id;
  const user = db.getUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const { email, fullName, whatsappNumber, role, password, shopId } = req.body;
  const updates: Partial<User> = {};

  if (fullName && fullName.trim()) updates.fullName = fullName.trim();
  if (whatsappNumber && whatsappNumber.trim()) updates.whatsappNumber = whatsappNumber.trim();
  if (role && (role === 'admin' || role === 'shop_owner')) updates.role = role;
  if (email && email.trim() && email.trim().toLowerCase() !== user.email.toLowerCase()) {
    const cleanEmail = email.trim().toLowerCase();
    const other = db.getUserByEmail(cleanEmail);
    if (other && other.id !== userId) {
      return res.status(400).json({ error: `Email "${cleanEmail}" is already used by another user.` });
    }
    updates.email = cleanEmail;
  }

  if (password && password.trim()) {
    updates.passwordHash = crypto.createHash('sha256').update(password.trim()).digest('hex');
  }

  const updatedUser = db.updateUser(userId, updates);

  if (shopId) {
    const shop = db.getShopById(shopId);
    if (shop) {
      db.updateShop(shop.id, { ownerId: userId });
    }
  }

  db.save();

  res.json({ message: 'User updated successfully', user: updatedUser });
});

// Admin Delete User
app.delete('/api/admin/users/:id', requireAuth, (req, res) => {
  const session = (req as any).user;
  if (session.role !== 'admin') {
    return res.status(403).json({ error: 'Only system administrators can delete users.' });
  }

  const userId = req.params.id;
  const user = db.getUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  if (user.email?.toLowerCase() === 'printx286351@gmail.com') {
    return res.status(400).json({ error: 'Cannot delete the master system administrator.' });
  }

  db.deleteUser(userId);
  db.save();

  res.json({ message: `User "${user.fullName}" (${user.email}) deleted successfully.` });
});

// List all registered shops for public directory / discovery
app.get('/api/shops', (_req, res) => {
  const shops = db.getAllShops().filter((s) => s.status !== 'suspended');
  res.json(shops.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    phone: s.phone,
    address: s.address,
    city: s.city,
    status: s.status,
  })));
});

// Admin Create Shop directly
app.post('/api/admin/shops', requireAuth, (req, res) => {
  const session = (req as any).user;
  if (session.role !== 'admin') {
    return res.status(403).json({ error: 'Only system administrators can register new shops.' });
  }

  const { name, slug, phone, address, city, ownerName, ownerEmail, ownerPassword, ownerWhatsApp } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Shop name is required.' });
  }

  // Generate clean slug with collision prevention
  let baseSlug = (slug || name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (!baseSlug) {
    baseSlug = `shop-${crypto.randomBytes(3).toString('hex')}`;
  }

  let uniqueSlug = baseSlug;
  let counter = 1;
  while (db.getShopBySlug(uniqueSlug)) {
    counter++;
    uniqueSlug = `${baseSlug}-${counter}`;
  }

  const effectiveEmail = (ownerEmail && ownerEmail.trim())
    ? ownerEmail.trim().toLowerCase()
    : `${uniqueSlug}@printx.shop`;

  const effectivePassword = ownerPassword && ownerPassword.trim() ? ownerPassword.trim() : 'Shop#1234';
  const effectiveHash = crypto.createHash('sha256').update(effectivePassword).digest('hex');

  let owner = db.getUserByEmail(effectiveEmail);
  if (!owner) {
    owner = db.createUser({
      email: effectiveEmail,
      passwordHash: effectiveHash,
      fullName: (ownerName || name).trim(),
      whatsappNumber: (ownerWhatsApp || phone || '+919876543210').trim(),
      whatsappVerified: true,
      role: 'shop_owner',
    });
  } else {
    // Never demote admin
    if (owner.role !== 'admin') {
      db.updateUser(owner.id, {
        role: 'shop_owner',
        fullName: (ownerName || owner.fullName).trim(),
        passwordHash: effectiveHash,
      });
    }
  }

  const newShop = db.createShop({
    slug: uniqueSlug,
    name: name.trim(),
    ownerId: owner.id,
    phone: (phone || ownerWhatsApp || '+919876543210').trim(),
    address: (address || 'Main Road Counter').trim(),
    city: (city || 'City Center').trim(),
    status: 'active',
  });

  db.updateUser(owner.id, { shopId: newShop.id } as any);

  db.logActivity({
    shopId: newShop.id,
    userId: session.userId,
    actionType: 'shop_registered',
    description: `Shop "${newShop.name}" registered and activated directly by Super Admin.`,
  });

  // Ensure disk save is executed immediately
  db.save();

  res.status(201).json({
    message: 'Shop created and activated successfully',
    shop: {
      ...newShop,
      ownerEmail: owner.email,
      ownerName: owner.fullName,
    },
  });
});

// Admin Update / Edit Shop Details
app.put('/api/admin/shops/:id', requireAuth, (req, res) => {
  const session = (req as any).user;
  if (session.role !== 'admin') {
    return res.status(403).json({ error: 'Only system administrators can edit shops.' });
  }

  const shopId = req.params.id;
  const { name, phone, address, city, status, slug, ownerName, ownerEmail, ownerPassword } = req.body;
  const shop = db.getShopById(shopId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  let newSlug = shop.slug;
  if (slug && slug.trim() && slug.trim().toLowerCase() !== shop.slug) {
    const candidate = slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const existing = db.getShopBySlug(candidate);
    if (!existing || existing.id === shopId) {
      newSlug = candidate;
    }
  }

  const updated = db.updateShop(shopId, {
    ...(name ? { name: name.trim() } : {}),
    ...(phone ? { phone: phone.trim() } : {}),
    ...(address ? { address: address.trim() } : {}),
    ...(city ? { city: city.trim() } : {}),
    ...(status ? { status } : {}),
    slug: newSlug,
  });

  // Update owner details if provided
  if (shop.ownerId) {
    const owner = db.getUserById(shop.ownerId);
    if (owner) {
      const userUpdates: Partial<User> = {};
      if (ownerName && ownerName.trim()) userUpdates.fullName = ownerName.trim();
      if (ownerEmail && ownerEmail.trim()) userUpdates.email = ownerEmail.trim().toLowerCase();
      if (ownerPassword && ownerPassword.trim()) {
        userUpdates.passwordHash = crypto.createHash('sha256').update(ownerPassword.trim()).digest('hex');
      }
      if (Object.keys(userUpdates).length > 0) {
        db.updateUser(owner.id, userUpdates);
      }
    }
  }

  db.logActivity({
    shopId,
    userId: session.userId,
    actionType: 'shop_updated',
    description: `Shop "${shop.name}" updated by Administrator.`,
  });

  db.save();

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

// Helper to determine if Windows Agent is actively connected and polling
function isShopAgentOnline(shopId: string): boolean {
  const agent = db.getAgentByShopId(shopId);
  if (!agent) return false;
  if (agent.status !== 'online') return false;
  if (!agent.lastSeenAt) return false;
  // Windows Agent polls every 2 seconds. Allow up to 30 seconds for network delay.
  const diffMs = Date.now() - new Date(agent.lastSeenAt).getTime();
  return diffMs < 30000;
}

// Get Shop Public Profile & Print Rates (supports /api/shops/:slug and /api/s/:slug)
app.get(['/api/shops/:slug', '/api/s/:slug'], (req, res) => {
  const slug = req.params.slug;
  const shop = db.getShopBySlug(slug);

  if (!shop) {
    return res.status(404).json({ error: 'Shop not found. Please verify the QR code URL.' });
  }

  const pricing = db.getShopPricing(shop.id);
  const approvalRules = db.getShopApprovalRules(shop.id);
  const agentOnline = isShopAgentOnline(shop.id);

  res.json({
    shop: {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      phone: shop.phone,
      address: shop.address,
      city: shop.city,
      status: shop.status,
      paymentGatewayUrl: shop.paymentGatewayUrl || '',
      agentOnline,
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
    requireOnlinePayment: approvalRules.requireOnlinePayment ?? true,
    rules: approvalRules,
    agentOnline,
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

// Customer Order Submission (100% Online Payment Portal with Razorpay)
app.post('/api/orders', async (req, res) => {
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

  if (!shopSlug || !documentName || !filePath || !String(filePath).trim()) {
    return res.status(400).json({ error: 'Missing required order details or document file.' });
  }

  // Ensure uploaded physical file exists and is not 0 bytes to prevent blank print jobs!
  if (!storageService.hasValidFile(filePath)) {
    return res.status(400).json({
      error: 'Uploaded document file could not be verified on the server. Please select and upload your file again.',
    });
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
  const isOnlinePaymentRequired = rules.requireOnlinePayment !== false;
  const isCounterPaymentRequested = req.body.paymentMethod === 'counter_cash' || req.body.paymentMethod === 'counter_upi' || req.body.isCounterPayment === true;
  const totalPages = (pageCount || 1) * (copies || 1);
  const isAutoApproved =
    rules.mode === 'auto' ||
    (rules.mode === 'smart' &&
      totalPages <= rules.maxAutoPages &&
      priceCalc.totalAmount <= rules.maxAutoAmount);

  let initialStatus: 'pending_approval' | 'payment_pending' | 'queued' = 'payment_pending';
  if (!isAutoApproved) {
    initialStatus = 'pending_approval';
  } else if (!isOnlinePaymentRequired && isCounterPaymentRequested) {
    // If shopkeeper allows pay at counter and customer chooses counter, queue order for counter payment & print
    initialStatus = 'payment_pending';
  } else {
    initialStatus = 'payment_pending';
  }

  const order = db.createOrder({
    shopId: shop.id,
    customerName: customerName ? customerName.trim() : 'Online Customer',
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

  const orderDesc = (!isOnlinePaymentRequired && isCounterPaymentRequested)
    ? `Order ${order.orderNumber} placed by ${order.customerName} (${order.documentName}, ₹${order.totalAmount}). Pay at Counter chosen.`
    : `Order ${order.orderNumber} placed by ${order.customerName} (${order.documentName}, ₹${order.totalAmount}). Online checkout ready.`;

  db.logActivity({
    shopId: shop.id,
    actionType: 'order_submitted',
    description: orderDesc,
    metadata: { orderNumber: order.orderNumber, amount: order.totalAmount, counterPayment: !isOnlinePaymentRequired && isCounterPaymentRequested },
  });

  res.status(201).json({
    message: (!isOnlinePaymentRequired && isCounterPaymentRequested)
      ? 'Order placed successfully! Please collect your print at the counter and pay.'
      : 'Order placed successfully! Please complete online payment via Razorpay.',
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
      gatewayPaymentUrl: order.gatewayPaymentUrl,
      gatewayOrderId: order.gatewayOrderId,
      gatewayCheckLink: order.gatewayCheckLink,
      createdAt: order.createdAt,
    },
    shop: {
      name: shop.name,
      phone: shop.phone,
      address: shop.address,
    },
  });
});

// Customer Track Order by Order Number (Auto-Syncs Mobile Razorpay Status!)
app.get('/api/orders/:orderNumber', async (req, res) => {
  const orderNumber = req.params.orderNumber;
  let order = db.getOrderByNumber(orderNumber);

  if (!order) {
    return res.status(404).json({ error: 'Order not found. Please check your order number.' });
  }

  // Automatic Background Verification for Mobile Payments:
  // If user paid on mobile phone via UPI app and returned to browser, verify directly with Razorpay
  if (order.paymentStatus !== 'collected' && order.gatewayOrderId) {
    try {
      const { key_id, key_secret } = getRazorpayCredentials();
      if (key_id && key_secret) {
        const razorpay = new Razorpay({ key_id, key_secret });
        const rzpOrder = await razorpay.orders.fetch(order.gatewayOrderId);
        if (rzpOrder && (rzpOrder.status === 'paid' || (Number(rzpOrder.amount_paid || 0) >= Number(rzpOrder.amount)))) {
          db.recordPayment({
            orderId: order.id,
            shopId: order.shopId,
            amount: order.totalAmount,
            method: 'online_upi',
            collectorName: 'Razorpay Auto-Sync',
            notes: `Mobile Payment Detected Paid: ${order.gatewayOrderId}`,
          });

          const agent = db.getAgentByShopId(order.shopId);
          const targetPrinter = resolveTargetPrinter(agent, order.colorMode);

          db.createPrintJobsForOrder(order.id, targetPrinter);
          db.updateOrderStatus(
            order.id,
            'queued',
            'Razorpay Auto-Spooler',
            undefined,
            `Mobile Razorpay payment verified (₹${order.totalAmount}). Automatically spooled to "${targetPrinter}".`
          );
          db.save();
          order = db.getOrderById(order.id) || order;
        }
      }
    } catch (_syncErr) {
      // Non-blocking catch
    }
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
      gatewayPaymentUrl: order.gatewayPaymentUrl,
      gatewayOrderId: order.gatewayOrderId,
      gatewayCheckLink: order.gatewayCheckLink,
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
  const targetPrinter = resolveTargetPrinter(agent, order.colorMode);

  db.createPrintJobsForOrder(order.id, targetPrinter);
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

// ==========================================
// RAZORPAY STANDARD WEB CHECKOUT ENDPOINTS
// ==========================================

// Safely expose client public key (Never secret)
const DEFAULT_RAZORPAY_KEY_ID = 'rzp_live_TsAzwEO7ucpLWe';
const DEFAULT_RAZORPAY_KEY_SECRET = '7J61s5xHH2Em62idHwSm5hxU';

const getRazorpayCredentials = () => {
  const key_id = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || DEFAULT_RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET || DEFAULT_RAZORPAY_KEY_SECRET;
  return { key_id, key_secret };
};

app.get(['/api/razorpay/config', '/api/razorpay-key'], (_req, res) => {
  const { key_id, key_secret } = getRazorpayCredentials();
  res.json({
    key_id,
    enabled: Boolean(key_id && key_secret),
  });
});

// STEP 1: BACKEND - Create Order
// Endpoint: POST /api/create-order
// Request: { amount (paise), currency, receipt }
// Return: { order_id, amount, currency }
// Minimum amount: 100 paise
app.post('/api/create-order', async (req, res) => {
  try {
    const { key_id, key_secret } = getRazorpayCredentials();

    if (!key_id || !key_secret) {
      return res.status(401).json({
        error: 'Razorpay API credentials not configured or unauthorized. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.',
      });
    }

    const { amount, currency = 'INR', receipt, notes } = req.body || {};

    // Validate amount >= 100 paise
    const numericAmount = Number(amount);
    if (!amount || isNaN(numericAmount) || numericAmount < 100) {
      return res.status(400).json({
        error: 'Invalid amount. Minimum amount is 100 paise (₹1.00).',
      });
    }

    const razorpay = new Razorpay({
      key_id,
      key_secret,
    });

    const orderPayload = {
      amount: Math.round(numericAmount),
      currency: String(currency || 'INR').toUpperCase(),
      receipt: receipt ? String(receipt).slice(0, 40) : `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      notes: typeof notes === 'object' && notes !== null ? notes : {},
    };

    const razorpayOrder = await razorpay.orders.create(orderPayload);

    // Link gatewayOrderId to existing shop order immediately if receipt or notes has orderNumber!
    const targetOrdRef = (notes && notes.orderNumber) || (receipt ? String(receipt).replace(/^rcpt_/, '') : '');
    if (targetOrdRef) {
      const ord = db.getOrderByNumber(targetOrdRef) || db.getOrderById(targetOrdRef);
      if (ord) {
        ord.gatewayOrderId = razorpayOrder.id;
        db.save();
      }
    }

    return res.status(200).json({
      order_id: razorpayOrder.id,
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      receipt: razorpayOrder.receipt,
      key_id,
    });
  } catch (err: any) {
    console.error('[Razorpay] Create order error:', err);
    const isAuthError =
      err?.statusCode === 401 ||
      err?.status === 401 ||
      (err?.error?.code === 'BAD_REQUEST_ERROR' && String(err?.error?.description).toLowerCase().includes('auth'));

    const statusCode = isAuthError ? 401 : 500;
    return res.status(statusCode).json({
      error: err?.error?.description || err?.message || 'Razorpay order creation failed',
      code: err?.error?.code,
    });
  }
});

// STEP 3: BACKEND - Verify Signature
// Endpoint: POST /api/verify-payment
// Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
// Compare generated signature with razorpay_signature
// Return success only if signatures match
app.post('/api/verify-payment', (req, res) => {
  try {
    const order_id = req.body.razorpay_order_id || req.body.order_id;
    const payment_id = req.body.razorpay_payment_id || req.body.payment_id;
    const razorpay_signature = req.body.razorpay_signature || req.body.signature;

    // Missing fields: return 400
    if (!order_id || !payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: order_id, payment_id, and signature are required.',
      });
    }

    const { key_secret } = getRazorpayCredentials();
    if (!key_secret) {
      return res.status(401).json({
        success: false,
        error: 'Razorpay KEY_SECRET is not configured on the server.',
      });
    }

    // Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const generatedSignature = crypto
      .createHmac('sha256', key_secret)
      .update(`${order_id}|${payment_id}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(generatedSignature, 'utf8');
    const signatureBuffer = Buffer.from(String(razorpay_signature), 'utf8');

    const isMatch =
      expectedBuffer.length === signatureBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, signatureBuffer);

    // Signature mismatch: return 400, do NOT mark as paid
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Signature verification failed. Signatures do not match.',
      });
    }

    // If payment belongs to a print shop order, mark it as collected and auto-spool to printer!
    const orderRef = req.body.orderNumber || req.body.orderRef || req.body.receipt;
    let existingOrder = null;
    if (orderRef) {
      const cleanRef = String(orderRef).replace(/^rcpt_/, '').trim();
      existingOrder = db.getOrderByNumber(cleanRef) || db.getOrderById(cleanRef) || db.getOrderByNumber(orderRef) || db.getOrderById(orderRef);
    }
    if (!existingOrder && order_id) {
      existingOrder = (db as any).data.orders.find((o: any) => o.gatewayOrderId === order_id);
    }

    let orderRecord = null;
    if (existingOrder) {
      existingOrder.gatewayOrderId = order_id;
      if (existingOrder.paymentStatus !== 'collected') {
        db.recordPayment({
          orderId: existingOrder.id,
          shopId: existingOrder.shopId,
          amount: existingOrder.totalAmount,
          method: 'online_upi',
          collectorName: 'Razorpay Standard Checkout',
          notes: `Razorpay Payment Verified: ${payment_id} | Order: ${order_id}`,
        });

        const agent = db.getAgentByShopId(existingOrder.shopId);
        const targetPrinter = resolveTargetPrinter(agent, existingOrder.colorMode);

        db.createPrintJobsForOrder(existingOrder.id, targetPrinter);
        db.updateOrderStatus(
          existingOrder.id,
          'queued',
          'Razorpay Auto-Spooler',
          undefined,
          `Razorpay verified (₹${existingOrder.totalAmount}). Automatically spooled to "${targetPrinter}".`
        );

        db.logActivity({
          shopId: existingOrder.shopId,
          actionType: 'payment_collected',
          description: `Order ${existingOrder.orderNumber} paid ₹${existingOrder.totalAmount} via Razorpay. Dispatched to printer.`,
          metadata: { razorpay_payment_id: payment_id, razorpay_order_id: order_id },
        });

        db.save();
      }
      orderRecord = db.getOrderById(existingOrder.id);
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      order_id,
      payment_id,
      order: orderRecord,
    });
  } catch (err: any) {
    console.error('[Razorpay] Signature verification error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error during signature verification',
    });
  }
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

// Helper to resolve shop for the authenticated user/session with multi-fallback & auto-healing
function getShopForSession(req: Request): Shop | undefined {
  const session = (req as any).user;
  if (!session) return undefined;

  // 1. Explicit shop ID or slug from headers or query params
  const requestedId =
    (req.headers['x-shop-id'] as string) ||
    (req.headers['x-shop-slug'] as string) ||
    (req.query.shopId as string);

  if (requestedId) {
    const s = db.getShopById(requestedId) || db.getShopBySlug(requestedId);
    if (s) {
      if (session.role === 'admin' || s.ownerId === session.userId) {
        return s;
      }
      const user = db.getUserById(session.userId);
      const owner = db.getUserById(s.ownerId);
      if (user && owner && user.email.toLowerCase() === owner.email.toLowerCase()) {
        db.updateShop(s.id, { ownerId: user.id });
        return s;
      }
    }
  }

  // 2. From session token shopId
  if (session.shopId) {
    const s = db.getShopById(session.shopId);
    if (s) return s;
  }

  // 3. From owner ID
  if (session.userId) {
    const s = db.getShopByOwnerId(session.userId);
    if (s) return s;

    // 4. Try matching shop by owner's email address
    const user = db.getUserById(session.userId);
    if (user && user.email) {
      const cleanEmail = user.email.toLowerCase();
      const allShops = db.getAllShops();
      const match = allShops.find((shop) => {
        if (shop.ownerId === user.id) return true;
        const owner = db.getUserById(shop.ownerId);
        return owner?.email?.toLowerCase() === cleanEmail;
      });
      if (match) {
        db.updateShop(match.id, { ownerId: user.id });
        return match;
      }
    }

    // 5. If user is an Admin, default to the first active shop
    if (session.role === 'admin') {
      const allShops = db.getAllShops();
      if (allShops.length > 0) return allShops[0];
    }
  }

  return undefined;
}

// Get Current Shop Details & Setup
app.get('/api/shop/current', requireAuth, (req, res) => {
  const shop = getShopForSession(req);

  if (!shop) {
    return res.status(404).json({ error: 'No shop associated with this user.' });
  }

  res.json(shop);
});

// Supabase Cloud Status, Config & Manual Trigger
app.get('/api/supabase/status', (req, res) => {
  res.json(supabaseService.getStatus());
});

app.post('/api/supabase/config', async (req, res) => {
  try {
    const { url, serviceRoleKey, anonKey } = req.body || {};
    const status = await supabaseService.updateConfig({ url, serviceRoleKey, anonKey });
    // If connected, sync local state
    if (status.connected && status.mode !== 'rls_blocked') {
      await supabaseService.saveRemoteState((db as any).data);
    }
    res.json({ success: true, status: supabaseService.getStatus() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/supabase/sync', async (req, res) => {
  try {
    // 1. Try to push local database to Supabase
    const saved = await supabaseService.saveRemoteState((db as any).data);

    // 2. Also try to pull any remote data that may have been saved from previous sessions
    try {
      const remote = await supabaseService.loadRemoteState();
      if (remote) {
        db.mergeRemoteData(remote);
      }
    } catch (_) {}

    res.json({ success: saved, status: supabaseService.getStatus() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Shop Details
const handleUpdateShop = (req: Request, res: Response) => {
  const session = (req as any).user;
  const shop = getShopForSession(req);
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
  const shop = getShopForSession(req);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const pricing = db.getShopPricing(shop.id);
  res.json(pricing);
});

app.put('/api/shop/pricing', requireAuth, (req, res) => {
  const session = (req as any).user;
  const shop = getShopForSession(req);
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
  const shop = getShopForSession(req);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const rules = db.getShopApprovalRules(shop.id);
  res.json(rules);
});

app.put('/api/shop/approval-rules', requireAuth, (req, res) => {
  const session = (req as any).user;
  const shop = getShopForSession(req);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const { mode, maxAutoPages, maxAutoAmount, requirePaymentBeforePrint, requireOnlinePayment, notifyWhatsapp } = req.body;

  const updated = db.updateShopApprovalRules(shop.id, {
    mode,
    maxAutoPages: Number(maxAutoPages),
    maxAutoAmount: Number(maxAutoAmount),
    requirePaymentBeforePrint: Boolean(requirePaymentBeforePrint),
    requireOnlinePayment: requireOnlinePayment !== undefined ? Boolean(requireOnlinePayment) : true,
    notifyWhatsapp: Boolean(notifyWhatsapp),
  });

  db.logActivity({
    shopId: shop.id,
    userId: session.userId,
    actionType: 'rules_updated',
    description: `Approval mode updated to ${mode.toUpperCase()} (Online Payment Only: ${requireOnlinePayment !== false ? 'ON' : 'OFF'}, Payment before print: ${requirePaymentBeforePrint ? 'Yes' : 'No'})`,
  });

  res.json(updated);
});

// Orders Queue
app.get('/api/shop/orders', requireAuth, (req, res) => {
  const shop = getShopForSession(req);
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

// Record Counter Payment & Auto-Print Spooling
app.post('/api/shop/orders/:id/collect-payment', requireAuth, (req, res) => {
  const session = (req as any).user;
  const orderId = req.params.id;
  const { method = 'counter_cash', notes, autoPrint = true, printerName } = req.body; // method: 'counter_cash' | 'counter_upi'
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

  let jobs: any[] = [];
  if (autoPrint) {
    const agent = db.getAgentByShopId(order.shopId);
    const targetPrinter = resolveTargetPrinter(agent, order.colorMode, printerName);

    jobs = db.createPrintJobsForOrder(orderId, targetPrinter);
    db.updateOrderStatus(orderId, 'queued', 'Shop Counter Payment', session.userId, `Counter payment collected (₹${order.totalAmount}). Automatically spooled to "${targetPrinter}".`);
  }

  db.logActivity({
    shopId: order.shopId,
    userId: session.userId,
    actionType: 'payment_collected',
    description: `Collected ₹${order.totalAmount} via ${method === 'counter_upi' ? 'UPI' : 'Cash'} for order ${order.orderNumber}${autoPrint ? ' & spooled to printer' : ''}`,
  });

  (db as any).save();

  res.json({
    message: autoPrint ? 'Payment recorded and print job dispatched to printer!' : 'Payment recorded successfully',
    payment,
    order: db.getOrderById(orderId),
    jobs,
  });
});

// Dispatch to Printer Queue / Trigger Print
app.post('/api/shop/orders/:id/dispatch-print', requireAuth, (req, res) => {
  const session = (req as any).user;
  const orderId = req.params.id;
  const { printerName } = req.body;
  const order = db.getOrderById(orderId);

  if (!order) return res.status(404).json({ error: 'Order not found' });

  const agent = db.getAgentByShopId(order.shopId);
  const targetPrinter = resolveTargetPrinter(agent, order.colorMode, printerName);

  const jobs = db.createPrintJobsForOrder(orderId, targetPrinter);

  // Update order status to queued
  db.updateOrderStatus(orderId, 'queued', 'Print Dispatcher', session.userId, `Sent to print job queue for "${targetPrinter}" (${jobs.length} file${jobs.length > 1 ? 's' : ''})`);

  db.logActivity({
    shopId: order.shopId,
    userId: session.userId,
    actionType: 'job_dispatched',
    description: `Dispatched ${jobs.length} job(s) for order ${order.orderNumber} to printer ${targetPrinter}`,
  });

  res.json({ message: 'Print job(s) dispatched to queue', jobs });
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

app.options('/api/documents/preview/:orderId', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.sendStatus(204);
});

// Document Stream / Preview with Token or Auth Header
app.get('/api/documents/preview/:orderId', (req, res) => {
  const { orderId } = req.params;
  const token = (req.query.token as string) || (req.query.auth as string);

  let authorized = false;
  if (token && storageService.verifySignedToken(token, orderId)) {
    authorized = true;
  } else if (token && verifySessionToken(token)) {
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
      return res.status(404).json({ error: 'Document file not found on server.' });
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
      error: 'Customer document files were permanently deleted after print completion as per customer privacy policy.',
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
      return res.status(404).json({ error: 'Document file not found on server.' });
    }

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Unable to download file' });
  }
});

// Shop Reports & Stats
app.get('/api/shop/stats', requireAuth, (req, res) => {
  const shop = getShopForSession(req);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const stats = db.getShopStats(shop.id);
  res.json(stats);
});

// Shop Activity Logs
app.get('/api/shop/activity', requireAuth, (req, res) => {
  const shop = getShopForSession(req);
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
  const shop = getShopForSession(req);
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
  const shop = getShopForSession(req);
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
  const shop = getShopForSession(req);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const agent = db.getOrCreateAgent(shop.id);
  res.json(agent);
});

// Update configured printers (default, bw, color)
app.put('/api/shop/agent/printers', requireAuth, (req, res) => {
  const session = (req as any).user;
  const shop = getShopForSession(req);
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
  const shop = getShopForSession(req);
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
  // Keep agent status actively online with current timestamp
  agent.lastSeenAt = new Date().toISOString();
  agent.status = 'online';

  const pending = db.getPendingPrintJobsForShop(agent.shopId);

  // Return formatted job list with signed download token
  const jobs = pending.map(({ job, order }) => {
    const { token } = storageService.generateSignedToken(order.id, 60);
    const docName = job.documentName || order.documentName;
    const docType = job.documentType || order.documentType;
    return {
      jobId: job.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      documentName: docName,
      documentType: docType,
      fileIndex: job.fileIndex || 1,
      totalFiles: job.totalFiles || 1,
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

// Agent Downloads Document for Spooling (Supports both /api/agent/download-job/:jobId and /api/agent/jobs/:jobId/document)
const handleAgentJobDownload = (req: Request, res: Response) => {
  const { jobId } = req.params;
  const token = (req.query.token as string) || (req.headers['x-claim-token'] as string);

  const allJobs = (db as any).data.printJobs;
  const job = allJobs.find((j: any) => j.id === jobId);

  if (!job) return res.status(404).json({ error: 'Job not found' });

  // Token valid if matches job.claimToken, or is a signed storage token, or agent auth matches shop
  let tokenValid = false;
  if (token && job.claimToken && token === job.claimToken) {
    tokenValid = true;
  } else if (token && storageService.verifySignedToken(token, job.orderId)) {
    tokenValid = true;
  } else {
    const authHeader = req.headers.authorization;
    const headerToken = req.headers['x-agent-token'] as string;
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const agentCandidate = db.getAgentByToken(headerToken || bearer || '');
    if (agentCandidate && agentCandidate.shopId === job.shopId) {
      tokenValid = true;
    }
  }

  if (!tokenValid) {
    return res.status(403).json({ error: 'Invalid or expired download token.' });
  }

  const order = db.getOrderById(job.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  try {
    const targetFilePath = job.filePath || order.filePath;
    const docName = job.documentName || order.documentName;
    const docType = job.documentType || order.documentType || 'application/pdf';

    const hasTarget = storageService.hasValidFile(targetFilePath);
    const hasOrderPrimary = storageService.hasValidFile(order.filePath);

    if (!hasTarget && !hasOrderPrimary) {
      console.error(`[Download Error] Physical document file missing on server for job ${jobId}. target: ${targetFilePath}, primary: ${order.filePath}`);
      return res.status(404).json({ error: 'Document file missing on server. Print skipped to prevent blank paper.' });
    }

    const rawFullPath = hasTarget
      ? storageService.getAbsolutePath(targetFilePath)
      : storageService.getAbsolutePath(order.filePath);

    // Auto-synthesize or retrieve standard A4 printable PDF so physical printers never print blank pages!
    const printablePath = storageService.getOrCreatePrintablePdfPath(hasTarget ? targetFilePath : order.filePath);
    const fullPath = fs.existsSync(printablePath) && fs.statSync(printablePath).size > 0 ? printablePath : rawFullPath;

    const isPdf = fullPath.toLowerCase().endsWith('.pdf');
    const effectiveMime = isPdf ? 'application/pdf' : docType;
    const effectiveDocName = isPdf && !docName.toLowerCase().endsWith('.pdf')
      ? `${docName.replace(/\.[^/.]+$/, '')}.pdf`
      : docName;

    const stat = fs.statSync(fullPath);
    if (!stat || stat.size === 0) {
      console.error(`[Download Error] Physical file is 0 bytes for job ${jobId}: ${fullPath}`);
      return res.status(404).json({ error: 'File is 0 bytes on server. Print skipped to prevent blank paper.' });
    }

    console.log(`[Agent Spooler] Streaming file for job ${jobId} (#${order.orderNumber}, file ${job.fileIndex || 1}/${job.totalFiles || 1}: ${effectiveDocName}, ${stat.size} bytes, isPdf: ${isPdf})`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', effectiveMime);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(effectiveDocName)}"`);

    fs.createReadStream(fullPath).pipe(res);
  } catch (err: any) {
    console.error(`[Download Error] Exception serving job ${jobId}:`, err);
    res.status(500).json({ error: 'File read error' });
  }
};

app.get('/api/agent/download-job/:jobId', handleAgentJobDownload);
app.get('/api/agent/jobs/:jobId/document', handleAgentJobDownload);

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

  // Pre-hydrate all persistent state from Supabase Cloud on boot
  try {
    await db.hydrateFromCloud();
    console.log(`[Startup] Supabase Cloud hydration complete. Active shops: ${db.getAllShops().length}`);
  } catch (err) {
    console.warn('[Startup] Supabase cloud hydration notice:', err);
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
