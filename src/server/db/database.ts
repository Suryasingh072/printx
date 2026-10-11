import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  User,
  Shop,
  ShopPricing,
  ShopApprovalRules,
  WindowsAgent,
  Order,
  OrderStatusHistory,
  PaymentRecord,
  PrintJob,
  ActivityLog,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  ShopStats,
} from '../types.js';

interface DatabaseSchema {
  users: User[];
  shops: Shop[];
  pricing: ShopPricing[];
  approvalRules: ShopApprovalRules[];
  agents: WindowsAgent[];
  orders: Order[];
  orderHistory: OrderStatusHistory[];
  payments: PaymentRecord[];
  printJobs: PrintJob[];
  activityLogs: ActivityLog[];
}

const DB_DIR = path.resolve(process.cwd(), './data');
const DB_FILE = path.join(DB_DIR, 'qrprint.db.json');

// Ensure DB directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

export class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadOrCreateDatabase();
  }

  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  public verifyPassword(plain: string, hash: string): boolean {
    return this.hashPassword(plain) === hash;
  }

  private save(): void {
    try {
      const tempPath = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (e) {
      console.error('Failed to persist database to disk:', e);
    }
  }

  private loadOrCreateDatabase(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // Ensure the fixed admin account printx286351@gmail.com / Ekma#1234 exists and is active
        let admin = parsed.users?.find((u: any) => u.email?.toLowerCase() === 'printx286351@gmail.com' || u.role === 'admin');
        if (admin) {
          admin.email = 'printx286351@gmail.com';
          admin.passwordHash = this.hashPassword('Ekma#1234');
          admin.role = 'admin';
          admin.fullName = 'ADRTech System Administrator';
        } else if (parsed.users) {
          parsed.users.push({
            id: 'usr-admin-001',
            email: 'printx286351@gmail.com',
            passwordHash: this.hashPassword('Ekma#1234'),
            fullName: 'ADRTech System Administrator',
            whatsappNumber: '+919876543210',
            whatsappVerified: true,
            role: 'admin',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        return parsed;
      } catch (e) {
        console.error('Error reading database file, loading default seed data:', e);
      }
    }

    const initial = this.generateSeedData();
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error writing initial database file:', e);
    }
    return initial;
  }

  private generateSeedData(): DatabaseSchema {
    const now = new Date().toISOString();
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const adminUser: User = {
      id: 'usr-admin-001',
      email: 'printx286351@gmail.com',
      passwordHash: this.hashPassword('Ekma#1234'),
      fullName: 'ADRTech System Administrator',
      whatsappNumber: '+919876543210',
      whatsappVerified: true,
      role: 'admin',
      createdAt: yesterday,
      updatedAt: yesterday,
    };

    const owner1: User = {
      id: 'usr-owner-001',
      email: 'rajesh@apexprint.in',
      passwordHash: this.hashPassword('Apex@1234'),
      fullName: 'Rajesh Sharma',
      whatsappNumber: '+919812345678',
      whatsappVerified: true,
      role: 'shop_owner',
      createdAt: yesterday,
      updatedAt: yesterday,
    };

    const owner2: User = {
      id: 'usr-owner-002',
      email: 'kavita@saidigital.com',
      passwordHash: this.hashPassword('Sai@1234'),
      fullName: 'Kavita Verma',
      whatsappNumber: '+919711223344',
      whatsappVerified: true,
      role: 'shop_owner',
      createdAt: yesterday,
      updatedAt: yesterday,
    };

    const shop1: Shop = {
      id: 'shp-apex-001',
      slug: 'apex-print',
      name: 'Apex Print & Copy Hub',
      ownerId: owner1.id,
      phone: '+919812345678',
      address: 'Shop 14, Commercial Complex, Sector 18',
      city: 'Noida',
      status: 'active',
      activatedAt: yesterday,
      activatedBy: adminUser.id,
      createdAt: yesterday,
      updatedAt: yesterday,
    };

    const shop2: Shop = {
      id: 'shp-sai-002',
      slug: 'sai-digital',
      name: 'Sai Digital Xerox & Cyber Cafe',
      ownerId: owner2.id,
      phone: '+919711223344',
      address: 'Near Metro Gate 2, Main Market, Laxmi Nagar',
      city: 'Delhi',
      status: 'pending_review',
      createdAt: yesterday,
      updatedAt: yesterday,
    };

    const pricing1: ShopPricing = {
      id: 'prc-apex-001',
      shopId: shop1.id,
      bwSinglePrice: 2.00,
      bwDuplexPrice: 3.00,
      colorSinglePrice: 10.00,
      colorDuplexPrice: 18.00,
      legalExtra: 1.00,
      photo4x6Price: 20.00,
      idCardSinglePrice: 15.00,
      currency: 'INR',
      updatedAt: yesterday,
    };

    const pricing2: ShopPricing = {
      id: 'prc-sai-002',
      shopId: shop2.id,
      bwSinglePrice: 2.50,
      bwDuplexPrice: 4.00,
      colorSinglePrice: 12.00,
      colorDuplexPrice: 20.00,
      legalExtra: 1.50,
      photo4x6Price: 25.00,
      idCardSinglePrice: 15.00,
      currency: 'INR',
      updatedAt: yesterday,
    };

    const rules1: ShopApprovalRules = {
      id: 'rul-apex-001',
      shopId: shop1.id,
      mode: 'smart',
      maxAutoPages: 10,
      maxAutoAmount: 50.00,
      requirePaymentBeforePrint: true,
      notifyWhatsapp: true,
      updatedAt: yesterday,
    };

    const rules2: ShopApprovalRules = {
      id: 'rul-sai-002',
      shopId: shop2.id,
      mode: 'manual',
      maxAutoPages: 5,
      maxAutoAmount: 30.00,
      requirePaymentBeforePrint: true,
      notifyWhatsapp: false,
      updatedAt: yesterday,
    };

    const agent1: WindowsAgent = {
      id: 'agt-apex-001',
      shopId: shop1.id,
      deviceName: 'DESKTOP-PRINT-01 (Shop Front Counter)',
      pairingCode: '749102',
      authTokenHash: crypto.createHash('sha256').update('token_agent_apex_2026').digest('hex'),
      status: 'online',
      lastSeenAt: now,
      defaultPrinter: 'HP LaserJet Pro M404dn',
      bwPrinter: 'HP LaserJet Pro M404dn',
      colorPrinter: 'Canon PIXMA G3010',
      installedPrinters: [
        {
          name: 'HP LaserJet Pro M404dn',
          isDefault: true,
          status: 'Ready',
          supportsColor: false,
          driverName: 'HP PCL 6 Driver',
        },
        {
          name: 'Canon PIXMA G3010',
          isDefault: false,
          status: 'Ready',
          supportsColor: true,
          driverName: 'Canon G3000 Series',
        },
        {
          name: 'Epson L3150 Series',
          isDefault: false,
          status: 'Ready',
          supportsColor: true,
          driverName: 'Epson ESC/P-R',
        },
      ],
      ipAddress: '192.168.1.104',
      appVersion: '1.2.0',
      dryRunMode: false,
      createdAt: yesterday,
    };

    const sampleOrders: Order[] = [
      {
        id: 'ord-001',
        orderNumber: 'ORD-920412',
        shopId: shop1.id,
        customerName: 'Anil Gupta',
        customerPhone: '+919899123456',
        documentName: 'Project_Report_Semester_6.pdf',
        documentType: 'application/pdf',
        filePath: 'sample_report.pdf',
        fileSizeBytes: 1420500,
        pageCount: 12,
        copies: 1,
        colorMode: 'bw',
        duplexMode: 'duplex',
        paperSize: 'A4',
        orderType: 'document',
        pageRange: 'all',
        customNotes: 'Please staple top-left corner',
        unitPrice: 1.50,
        totalAmount: 18.00,
        status: 'payment_pending',
        paymentStatus: 'unpaid',
        approvedAt: tenMinAgo,
        approvedBy: owner1.id,
        createdAt: tenMinAgo,
        updatedAt: tenMinAgo,
      },
      {
        id: 'ord-002',
        orderNumber: 'ORD-920415',
        shopId: shop1.id,
        customerName: 'Priya Sharma',
        customerPhone: '+919877445566',
        documentName: 'Aadhaar_Front_Back_Sheet.png',
        documentType: 'image/png',
        filePath: 'sample_idcard.png',
        fileSizeBytes: 890400,
        pageCount: 1,
        copies: 2,
        colorMode: 'color',
        duplexMode: 'single',
        paperSize: 'A4',
        orderType: 'id_card',
        unitPrice: 15.00,
        totalAmount: 30.00,
        status: 'queued',
        paymentStatus: 'collected',
        paymentCollectedAt: tenMinAgo,
        paymentCollectorName: 'Rajesh Sharma',
        paymentMethod: 'counter_upi',
        approvedAt: tenMinAgo,
        approvedBy: owner1.id,
        createdAt: tenMinAgo,
        updatedAt: tenMinAgo,
      },
      {
        id: 'ord-003',
        orderNumber: 'ORD-920420',
        shopId: shop1.id,
        customerName: 'Sunil Mehta',
        customerPhone: '+919911882233',
        documentName: 'Indigo_Boarding_Pass.pdf',
        documentType: 'application/pdf',
        filePath: 'sample_ticket.pdf',
        fileSizeBytes: 420000,
        pageCount: 2,
        copies: 1,
        colorMode: 'color',
        duplexMode: 'single',
        paperSize: 'A4',
        orderType: 'document',
        unitPrice: 10.00,
        totalAmount: 20.00,
        status: 'completed',
        paymentStatus: 'collected',
        paymentCollectedAt: oneHourAgo,
        paymentCollectorName: 'Rajesh Sharma',
        paymentMethod: 'online_upi',
        approvedAt: oneHourAgo,
        approvedBy: owner1.id,
        printedAt: oneHourAgo,
        createdAt: oneHourAgo,
        updatedAt: oneHourAgo,
      },
      {
        id: 'ord-004',
        orderNumber: 'ORD-920428',
        shopId: shop1.id,
        customerName: 'Deepak Yadav',
        customerPhone: '+919811009988',
        documentName: 'Tender_Document_Vol_2.pdf',
        documentType: 'application/pdf',
        filePath: 'sample_tender.pdf',
        fileSizeBytes: 4890000,
        pageCount: 45,
        copies: 2,
        colorMode: 'bw',
        duplexMode: 'single',
        paperSize: 'A4',
        orderType: 'document',
        unitPrice: 2.00,
        totalAmount: 180.00,
        status: 'pending_approval',
        paymentStatus: 'unpaid',
        createdAt: now,
        updatedAt: now,
      },
    ];

    const samplePayments: PaymentRecord[] = [
      {
        id: 'pay-001',
        orderId: 'ord-002',
        shopId: shop1.id,
        amount: 30.00,
        method: 'counter_upi',
        status: 'collected',
        collectedBy: 'Rajesh Sharma',
        notes: 'Paid via GPay counter QR',
        collectedAt: tenMinAgo,
      },
      {
        id: 'pay-002',
        orderId: 'ord-003',
        shopId: shop1.id,
        amount: 20.00,
        method: 'online_upi',
        status: 'collected',
        collectedBy: 'Rajesh Sharma',
        notes: 'Online UPI payment verified',
        collectedAt: oneHourAgo,
      },
    ];

    const sampleJobs: PrintJob[] = [
      {
        id: 'job-001',
        orderId: 'ord-002',
        shopId: shop1.id,
        agentId: agent1.id,
        printerName: 'Canon PIXMA G3010',
        status: 'pending',
        retryCount: 0,
        createdAt: tenMinAgo,
      },
    ];

    const sampleLogs: ActivityLog[] = [
      {
        id: 'log-001',
        shopId: shop1.id,
        userId: owner1.id,
        actionType: 'pricing_updated',
        description: 'Updated A4 Colour duplex pricing to ₹18.00',
        createdAt: yesterday,
      },
      {
        id: 'log-002',
        shopId: shop1.id,
        actionType: 'order_submitted',
        description: 'New customer order ORD-920428 submitted for Tender_Document_Vol_2.pdf (45 pages, 2 copies)',
        createdAt: now,
      },
      {
        id: 'log-003',
        shopId: shop1.id,
        userId: owner1.id,
        actionType: 'payment_collected',
        description: 'Collected ₹30.00 via UPI for order ORD-920415',
        createdAt: tenMinAgo,
      },
    ];

    return {
      users: [adminUser, owner1, owner2],
      shops: [shop1, shop2],
      pricing: [pricing1, pricing2],
      approvalRules: [rules1, rules2],
      agents: [agent1],
      orders: sampleOrders,
      orderHistory: [],
      payments: samplePayments,
      printJobs: sampleJobs,
      activityLogs: sampleLogs,
    };
  }

  // --- User Queries ---
  public getUserByEmail(email: string): User | undefined {
    const clean = (email || '').trim().toLowerCase();
    return this.data.users.find((u) => u.email.toLowerCase() === clean);
  }

  public getUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public getUserByWhatsApp(phone: string): User | undefined {
    const clean = phone.replace(/[^0-9]/g, '');
    return this.data.users.find((u) => u.whatsappNumber.replace(/[^0-9]/g, '') === clean);
  }

  public createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): User {
    const newUser: User = {
      ...user,
      id: `usr-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.users.push(newUser);
    this.save();
    return newUser;
  }

  public updateUser(id: string, updates: Partial<User>): User | undefined {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return undefined;
    this.data.users[idx] = {
      ...this.data.users[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.data.users[idx];
  }

  // --- Shop Queries ---
  public getShopBySlug(slug: string): Shop | undefined {
    return this.data.shops.find((s) => s.slug.toLowerCase() === slug.toLowerCase());
  }

  public getShopById(id: string): Shop | undefined {
    return this.data.shops.find((s) => s.id === id);
  }

  public getShopByOwnerId(ownerId: string): Shop | undefined {
    return this.data.shops.find((s) => s.ownerId === ownerId);
  }

  public getAllShops(): Shop[] {
    return this.data.shops;
  }

  public createShop(shop: Omit<Shop, 'id' | 'createdAt' | 'updatedAt'>): Shop {
    const newShop: Shop = {
      ...shop,
      id: `shp-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.shops.push(newShop);

    // Create default pricing
    const defaultPricing: ShopPricing = {
      id: `prc-${crypto.randomUUID().slice(0, 8)}`,
      shopId: newShop.id,
      bwSinglePrice: 2.00,
      bwDuplexPrice: 3.00,
      colorSinglePrice: 10.00,
      colorDuplexPrice: 18.00,
      legalExtra: 1.00,
      photo4x6Price: 20.00,
      idCardSinglePrice: 15.00,
      currency: 'INR',
      updatedAt: new Date().toISOString(),
    };
    this.data.pricing.push(defaultPricing);

    // Create default approval rules
    const defaultRules: ShopApprovalRules = {
      id: `rul-${crypto.randomUUID().slice(0, 8)}`,
      shopId: newShop.id,
      mode: 'smart',
      maxAutoPages: 10,
      maxAutoAmount: 50.00,
      requirePaymentBeforePrint: true,
      notifyWhatsapp: true,
      updatedAt: new Date().toISOString(),
    };
    this.data.approvalRules.push(defaultRules);

    this.save();
    return newShop;
  }

  public deleteShop(id: string): boolean {
    const idx = this.data.shops.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    this.data.shops.splice(idx, 1);
    this.data.orders = this.data.orders.filter((o) => o.shopId !== id);
    this.data.payments = this.data.payments.filter((p) => p.shopId !== id);
    this.data.pricing = this.data.pricing.filter((p) => p.shopId !== id);
    this.data.approvalRules = this.data.approvalRules.filter((r) => r.shopId !== id);
    this.data.agents = this.data.agents.filter((a) => a.shopId !== id);
    this.save();
    return true;
  }

  public updateShop(id: string, updates: Partial<Shop>): Shop | undefined {
    const idx = this.data.shops.findIndex((s) => s.id === id);
    if (idx === -1) return undefined;
    this.data.shops[idx] = {
      ...this.data.shops[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.data.shops[idx];
  }

  // --- Pricing Queries ---
  public getShopPricing(shopId: string): ShopPricing {
    const found = this.data.pricing.find((p) => p.shopId === shopId);
    if (found) return found;

    // Fallback default
    const fallback: ShopPricing = {
      id: `prc-${crypto.randomUUID().slice(0, 8)}`,
      shopId,
      bwSinglePrice: 2.00,
      bwDuplexPrice: 3.00,
      colorSinglePrice: 10.00,
      colorDuplexPrice: 18.00,
      legalExtra: 1.00,
      photo4x6Price: 20.00,
      idCardSinglePrice: 15.00,
      currency: 'INR',
      updatedAt: new Date().toISOString(),
    };
    this.data.pricing.push(fallback);
    this.save();
    return fallback;
  }

  public updateShopPricing(shopId: string, updates: Partial<ShopPricing>): ShopPricing {
    const idx = this.data.pricing.findIndex((p) => p.shopId === shopId);
    if (idx === -1) {
      const created: ShopPricing = {
        id: `prc-${crypto.randomUUID().slice(0, 8)}`,
        shopId,
        bwSinglePrice: updates.bwSinglePrice ?? 2.00,
        bwDuplexPrice: updates.bwDuplexPrice ?? 3.00,
        colorSinglePrice: updates.colorSinglePrice ?? 10.00,
        colorDuplexPrice: updates.colorDuplexPrice ?? 18.00,
        legalExtra: updates.legalExtra ?? 1.00,
        photo4x6Price: updates.photo4x6Price ?? 20.00,
        idCardSinglePrice: updates.idCardSinglePrice ?? 15.00,
        currency: updates.currency ?? 'INR',
        updatedAt: new Date().toISOString(),
      };
      this.data.pricing.push(created);
      this.save();
      return created;
    }

    this.data.pricing[idx] = {
      ...this.data.pricing[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.data.pricing[idx];
  }

  // --- Approval Rules ---
  public getShopApprovalRules(shopId: string): ShopApprovalRules {
    const found = this.data.approvalRules.find((r) => r.shopId === shopId);
    if (found) return found;

    const fallback: ShopApprovalRules = {
      id: `rul-${crypto.randomUUID().slice(0, 8)}`,
      shopId,
      mode: 'smart',
      maxAutoPages: 10,
      maxAutoAmount: 50.00,
      requirePaymentBeforePrint: true,
      notifyWhatsapp: true,
      updatedAt: new Date().toISOString(),
    };
    this.data.approvalRules.push(fallback);
    this.save();
    return fallback;
  }

  public updateShopApprovalRules(shopId: string, updates: Partial<ShopApprovalRules>): ShopApprovalRules {
    const idx = this.data.approvalRules.findIndex((r) => r.shopId === shopId);
    if (idx === -1) {
      const created: ShopApprovalRules = {
        id: `rul-${crypto.randomUUID().slice(0, 8)}`,
        shopId,
        mode: updates.mode ?? 'smart',
        maxAutoPages: updates.maxAutoPages ?? 10,
        maxAutoAmount: updates.maxAutoAmount ?? 50.00,
        requirePaymentBeforePrint: updates.requirePaymentBeforePrint ?? true,
        notifyWhatsapp: updates.notifyWhatsapp ?? true,
        updatedAt: new Date().toISOString(),
      };
      this.data.approvalRules.push(created);
      this.save();
      return created;
    }

    this.data.approvalRules[idx] = {
      ...this.data.approvalRules[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.data.approvalRules[idx];
  }

  // --- Orders ---
  public getOrderById(id: string): Order | undefined {
    return this.data.orders.find((o) => o.id === id);
  }

  public getOrderByNumber(orderNumber: string): Order | undefined {
    return this.data.orders.find((o) => o.orderNumber.toUpperCase() === orderNumber.toUpperCase());
  }

  public getOrdersByShop(shopId: string, filter?: string): Order[] {
    let orders = this.data.orders.filter((o) => o.shopId === shopId);
    if (filter && filter !== 'all') {
      if (filter === 'payment_due') {
        orders = orders.filter((o) => o.paymentStatus === 'unpaid' && o.status !== 'rejected');
      } else if (filter === 'pending_approval') {
        orders = orders.filter((o) => o.status === 'pending_approval');
      } else if (filter === 'queued') {
        orders = orders.filter((o) => o.status === 'queued' || o.status === 'approved');
      } else if (filter === 'printing') {
        orders = orders.filter((o) => o.status === 'printing');
      } else if (filter === 'completed') {
        orders = orders.filter((o) => o.status === 'completed');
      } else if (filter === 'archived') {
        orders = orders.filter((o) => o.status === 'archived');
      } else {
        orders = orders.filter((o) => o.status === filter);
      }
    } else if (!filter || filter === 'all') {
      // Exclude archived by default in "all" view
      orders = orders.filter((o) => o.status !== 'archived');
    }
    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public generateOrderNumber(): string {
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `ORD-${rand}`;
  }

  public createOrder(order: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>): Order {
    const orderNumber = this.generateOrderNumber();
    const newOrder: Order = {
      ...order,
      id: `ord-${crypto.randomUUID().slice(0, 8)}`,
      orderNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.orders.push(newOrder);

    // Add status history
    this.data.orderHistory.push({
      id: `hst-${crypto.randomUUID().slice(0, 8)}`,
      orderId: newOrder.id,
      newStatus: newOrder.status,
      changedByName: 'Customer Submission',
      comment: 'Order placed by customer via Shop QR Portal',
      createdAt: new Date().toISOString(),
    });

    this.save();
    return newOrder;
  }

  public updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    changedByName: string,
    changedById?: string,
    comment?: string
  ): Order | undefined {
    const idx = this.data.orders.findIndex((o) => o.id === orderId);
    if (idx === -1) return undefined;

    const previousStatus = this.data.orders[idx].status;
    this.data.orders[idx].status = newStatus;
    this.data.orders[idx].updatedAt = new Date().toISOString();

    if (newStatus === 'approved') {
      this.data.orders[idx].approvedAt = new Date().toISOString();
      this.data.orders[idx].approvedBy = changedById;
    } else if (newStatus === 'completed') {
      this.data.orders[idx].printedAt = new Date().toISOString();
    } else if (newStatus === 'archived') {
      this.data.orders[idx].archivedAt = new Date().toISOString();
    }

    this.data.orderHistory.push({
      id: `hst-${crypto.randomUUID().slice(0, 8)}`,
      orderId,
      previousStatus,
      newStatus,
      changedByName,
      changedById,
      comment,
      createdAt: new Date().toISOString(),
    });

    this.save();
    return this.data.orders[idx];
  }

  public deleteOrder(orderId: string): boolean {
    const idx = this.data.orders.findIndex((o) => o.id === orderId);
    if (idx === -1) return false;
    const order = this.data.orders[idx];
    if (order.filePath && fs.existsSync(order.filePath)) {
      try {
        fs.unlinkSync(order.filePath);
      } catch (err) {
        console.warn('Could not delete order file:', err);
      }
    }
    this.data.orders.splice(idx, 1);
    this.data.orderHistory = this.data.orderHistory.filter((h) => h.orderId !== orderId);
    this.data.printJobs = this.data.printJobs.filter((j) => j.orderId !== orderId);
    this.data.payments = this.data.payments.filter((p) => p.orderId !== orderId);
    this.save();
    return true;
  }

  public recordPayment(params: {
    orderId: string;
    shopId: string;
    amount: number;
    method: PaymentMethod;
    collectorName: string;
    notes?: string;
  }): PaymentRecord | undefined {
    const order = this.getOrderById(params.orderId);
    if (!order) return undefined;

    const payment: PaymentRecord = {
      id: `pay-${crypto.randomUUID().slice(0, 8)}`,
      orderId: params.orderId,
      shopId: params.shopId,
      amount: params.amount,
      method: params.method,
      status: 'collected',
      collectedBy: params.collectorName,
      notes: params.notes,
      collectedAt: new Date().toISOString(),
    };

    this.data.payments.push(payment);

    // Update order payment status
    order.paymentStatus = 'collected';
    order.paymentCollectedAt = payment.collectedAt;
    order.paymentCollectorName = params.collectorName;
    order.paymentMethod = params.method;
    order.updatedAt = new Date().toISOString();

    // If order was in payment_pending and already approved, transition to queued
    if (order.status === 'payment_pending') {
      order.status = 'queued';
    }

    this.save();
    return payment;
  }

  // --- Windows Agent & Print Jobs ---
  public getAgentByShopId(shopId: string): WindowsAgent | undefined {
    return this.data.agents.find((a) => a.shopId === shopId && a.status !== 'revoked');
  }

  public getAgentByToken(token: string): WindowsAgent | undefined {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return this.data.agents.find(
      (a) => (a.authTokenHash === hash || a.utilityApiKey === token) && a.status !== 'revoked'
    );
  }

  public createUtilityApiKey(shopId: string): { key: string; agent: WindowsAgent } {
    const rawKey = `adr_util_live_${crypto.randomBytes(16).toString('hex')}`;
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

    let agent = this.getAgentByShopId(shopId);
    if (!agent) {
      agent = {
        id: `agt-${crypto.randomUUID().slice(0, 8)}`,
        shopId,
        deviceName: 'Windows Shop Workstation',
        status: 'online',
        authTokenHash: hash,
        utilityApiKey: rawKey,
        installedPrinters: [
          { name: 'HP LaserJet Pro M404dn', isDefault: true, status: 'Ready', supportsColor: false },
          { name: 'Canon PIXMA G3010', isDefault: false, status: 'Ready', supportsColor: true },
          { name: 'Epson L3150 Series', isDefault: false, status: 'Ready', supportsColor: true },
        ],
        defaultPrinter: 'HP LaserJet Pro M404dn',
        bwPrinter: 'HP LaserJet Pro M404dn',
        colorPrinter: 'Canon PIXMA G3010',
        appVersion: '1.2.0',
        dryRunMode: false,
        createdAt: new Date().toISOString(),
      };
      this.data.agents.push(agent);
    } else {
      agent.authTokenHash = hash;
      agent.utilityApiKey = rawKey;
      agent.status = 'online';
      if (!agent.installedPrinters || agent.installedPrinters.length === 0) {
        agent.installedPrinters = [
          { name: 'HP LaserJet Pro M404dn', isDefault: true, status: 'Ready', supportsColor: false },
          { name: 'Canon PIXMA G3010', isDefault: false, status: 'Ready', supportsColor: true },
        ];
        agent.defaultPrinter = 'HP LaserJet Pro M404dn';
      }
    }

    this.save();
    return { key: rawKey, agent };
  }

  public generatePairingCode(shopId: string): { code: string; expiresAt: string } {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    let agent = this.getAgentByShopId(shopId);
    if (!agent) {
      agent = {
        id: `agt-${crypto.randomUUID().slice(0, 8)}`,
        shopId,
        deviceName: 'New Shop Windows PC',
        pairingCode: code,
        pairingCodeExpiresAt: expiresAt,
        status: 'offline',
        installedPrinters: [],
        appVersion: '1.2.0',
        dryRunMode: false,
        createdAt: new Date().toISOString(),
      };
      this.data.agents.push(agent);
    } else {
      agent.pairingCode = code;
      agent.pairingCodeExpiresAt = expiresAt;
    }

    this.save();
    return { code, expiresAt };
  }

  public pairAgent(pairingCode: string, deviceName: string, ipAddress?: string): { agent: WindowsAgent; token: string } | null {
    const cleanCode = pairingCode.trim();
    // Allow matching 6-digit pairing code OR direct utilityApiKey
    const agent = this.data.agents.find(
      (a) =>
        (a.pairingCode === cleanCode &&
          a.pairingCodeExpiresAt &&
          new Date(a.pairingCodeExpiresAt).getTime() > Date.now()) ||
        (a.utilityApiKey && a.utilityApiKey === cleanCode)
    );

    if (!agent) return null;

    const token = `agt_token_${crypto.randomBytes(24).toString('hex')}`;
    agent.authTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    agent.deviceName = deviceName;
    agent.ipAddress = ipAddress;
    agent.status = 'online';
    agent.lastSeenAt = new Date().toISOString();
    agent.pairingCode = undefined;
    agent.pairingCodeExpiresAt = undefined;

    this.save();
    return { agent, token };
  }

  public updateAgentHeartbeat(agentId: string, installedPrinters: any[], defaultPrinter?: string): WindowsAgent | undefined {
    const agent = this.data.agents.find((a) => a.id === agentId);
    if (!agent) return undefined;

    agent.lastSeenAt = new Date().toISOString();
    agent.status = 'online';
    if (installedPrinters && Array.isArray(installedPrinters)) {
      agent.installedPrinters = installedPrinters;
    }
    if (defaultPrinter) {
      agent.defaultPrinter = defaultPrinter;
    }

    this.save();
    return agent;
  }

  public revokeAgent(shopId: string): boolean {
    const agent = this.getAgentByShopId(shopId);
    if (!agent) return false;
    agent.status = 'revoked';
    agent.authTokenHash = undefined;
    this.save();
    return true;
  }

  public createPrintJob(orderId: string, shopId: string, printerName: string): PrintJob {
    const job: PrintJob = {
      id: `job-${crypto.randomUUID().slice(0, 8)}`,
      orderId,
      shopId,
      printerName,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.data.printJobs.push(job);
    this.save();
    return job;
  }

  public getPendingPrintJobsForShop(shopId: string): { job: PrintJob; order: Order }[] {
    const jobs = this.data.printJobs.filter((j) => j.shopId === shopId && j.status === 'pending');
    const result: { job: PrintJob; order: Order }[] = [];

    for (const job of jobs) {
      const order = this.getOrderById(job.orderId);
      if (order) {
        // Enforce approval and payment checks before handing to printer!
        const rules = this.getShopApprovalRules(shopId);
        const isApproved = order.status === 'queued' || order.status === 'approved' || order.status === 'printing';
        const isPaymentSatisfied = !rules.requirePaymentBeforePrint || order.paymentStatus === 'collected';

        if (isApproved && isPaymentSatisfied) {
          result.push({ job, order });
        }
      }
    }
    return result;
  }

  public claimPrintJob(jobId: string, agentId: string): { success: boolean; claimToken?: string; job?: PrintJob } {
    const job = this.data.printJobs.find((j) => j.id === jobId);
    if (!job || job.status !== 'pending') {
      return { success: false };
    }

    const claimToken = `claim_${crypto.randomUUID()}`;
    job.status = 'claimed';
    job.agentId = agentId;
    job.claimToken = claimToken;
    job.claimedAt = new Date().toISOString();

    // Update order status to printing
    const order = this.getOrderById(job.orderId);
    if (order) {
      order.status = 'printing';
      order.updatedAt = new Date().toISOString();
    }

    this.save();
    return { success: true, claimToken, job };
  }

  public reportPrintJobStatus(
    jobId: string,
    claimToken: string,
    status: 'spooling' | 'printed' | 'failed',
    errorMessage?: string
  ): boolean {
    const job = this.data.printJobs.find((j) => j.id === jobId && j.claimToken === claimToken);
    if (!job) return false;

    job.status = status;
    if (errorMessage) {
      job.errorMessage = errorMessage;
    }

    const order = this.getOrderById(job.orderId);
    if (order) {
      if (status === 'printed') {
        order.status = 'completed';
        order.printedAt = new Date().toISOString();
        job.completedAt = new Date().toISOString();
      } else if (status === 'failed') {
        job.retryCount += 1;
        // Don't fail permanently on first try if under 3 retries
        if (job.retryCount >= 3) {
          order.status = 'queued'; // return to queue with alert
        }
      }
    }

    this.save();
    return true;
  }

  // --- Activity Logs ---
  public logActivity(log: Omit<ActivityLog, 'id' | 'createdAt'>): ActivityLog {
    const newLog: ActivityLog = {
      ...log,
      id: `log-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
    };
    this.data.activityLogs.unshift(newLog);
    // Keep max 500 recent logs
    if (this.data.activityLogs.length > 500) {
      this.data.activityLogs = this.data.activityLogs.slice(0, 500);
    }
    this.save();
    return newLog;
  }

  public getActivityLogs(shopId: string): ActivityLog[] {
    return this.data.activityLogs
      .filter((l) => l.shopId === shopId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // --- Statistics & Reports ---
  public getShopStats(shopId: string): ShopStats {
    const orders = this.data.orders.filter((o) => o.shopId === shopId && o.status !== 'rejected');
    const payments = this.data.payments.filter((p) => p.shopId === shopId && p.status === 'collected');

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let todayOrders = 0;
    let todayRevenue = 0;
    let weeklyOrders = 0;
    let weeklyRevenue = 0;
    let monthlyOrders = 0;
    let monthlyRevenue = 0;
    let lifetimeOrders = orders.length;
    let lifetimeRevenue = 0;
    let totalPageCount = 0;
    let pendingOrders = 0;
    let completedJobs = 0;

    for (const order of orders) {
      const orderTime = new Date(order.createdAt).getTime();
      totalPageCount += (order.pageCount || 1) * (order.copies || 1);

      if (order.status === 'pending_approval' || order.status === 'payment_pending' || order.status === 'queued') {
        pendingOrders += 1;
      }
      if (order.status === 'completed') {
        completedJobs += 1;
      }

      if (orderTime >= startOfToday) {
        todayOrders += 1;
      }
      if (orderTime >= startOfWeek) {
        weeklyOrders += 1;
      }
      if (orderTime >= startOfMonth) {
        monthlyOrders += 1;
      }
    }

    for (const p of payments) {
      const pTime = new Date(p.collectedAt).getTime();
      lifetimeRevenue += p.amount;

      if (pTime >= startOfToday) {
        todayRevenue += p.amount;
      }
      if (pTime >= startOfWeek) {
        weeklyRevenue += p.amount;
      }
      if (pTime >= startOfMonth) {
        monthlyRevenue += p.amount;
      }
    }

    return {
      todayOrders,
      todayRevenue: Number(todayRevenue.toFixed(2)),
      weeklyOrders,
      weeklyRevenue: Number(weeklyRevenue.toFixed(2)),
      monthlyOrders,
      monthlyRevenue: Number(monthlyRevenue.toFixed(2)),
      lifetimeOrders,
      lifetimeRevenue: Number(lifetimeRevenue.toFixed(2)),
      totalPageCount,
      pendingOrders,
      completedJobs,
    };
  }
}

export const db = new Database();
