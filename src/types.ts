export type UserRole = 'admin' | 'shop_owner' | 'shop_staff';

export type ShopStatus = 'pending_review' | 'active' | 'suspended' | 'rejected';

export type OrderStatus =
  | 'pending_approval'
  | 'approved'
  | 'payment_pending'
  | 'queued'
  | 'printing'
  | 'completed'
  | 'rejected'
  | 'archived';

export type PaymentStatus = 'unpaid' | 'collected' | 'refunded';
export type PaymentMethod = 'counter_upi' | 'online_upi' | 'other';

export type ColorMode = 'bw' | 'color';
export type DuplexMode = 'single' | 'duplex';
export type PaperSize = 'A4' | 'Legal' | 'Photo4x6';
export type OrderType = 'document' | 'id_card' | 'photo';

export interface User {
  id: string;
  email: string;
  fullName: string;
  whatsappNumber: string;
  whatsappVerified: boolean;
  role: UserRole;
}

export interface Shop {
  id: string;
  slug: string;
  name: string;
  ownerId: string;
  phone: string;
  address: string;
  city: string;
  status: ShopStatus;
  rejectionReason?: string;
  activatedAt?: string;
  qrCodeUrl?: string;
  createdAt: string;
}

export interface ShopPricing {
  id: string;
  shopId: string;
  bwSinglePrice: number;
  bwDuplexPrice: number;
  colorSinglePrice: number;
  colorDuplexPrice: number;
  legalExtra: number;
  photo4x6Price: number;
  idCardSinglePrice: number;
  currency: string;
  updatedAt: string;
}

export interface ShopApprovalRules {
  id: string;
  shopId: string;
  mode: 'manual' | 'auto' | 'smart';
  maxAutoPages: number;
  maxAutoAmount: number;
  requirePaymentBeforePrint: boolean;
  notifyWhatsapp: boolean;
  updatedAt: string;
}

export interface InstalledPrinter {
  name: string;
  isDefault: boolean;
  status: 'Ready' | 'Busy' | 'Offline' | 'Error';
  supportsColor: boolean;
  driverName?: string;
}

export interface WindowsAgent {
  id: string;
  shopId: string;
  deviceName: string;
  pairingCode?: string;
  pairingCodeExpiresAt?: string;
  utilityApiKey?: string;
  status: 'online' | 'offline' | 'revoked';
  lastSeenAt?: string;
  defaultPrinter?: string;
  bwPrinter?: string;
  colorPrinter?: string;
  installedPrinters: InstalledPrinter[];
  ipAddress?: string;
  appVersion: string;
  dryRunMode: boolean;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  shopId: string;
  customerName: string;
  customerPhone: string;
  documentName: string;
  documentType: string;
  filePath: string;
  fileSizeBytes: number;
  pageCount: number;
  copies: number;
  colorMode: ColorMode;
  duplexMode: DuplexMode;
  paperSize: PaperSize;
  orderType: OrderType;
  pageRange?: string;
  customNotes?: string;
  unitPrice: number;
  totalAmount: number;
  status: OrderStatus;
  rejectionReason?: string;
  paymentStatus: PaymentStatus;
  paymentCollectedAt?: string;
  paymentCollectorName?: string;
  paymentMethod?: PaymentMethod;
  approvedAt?: string;
  printedAt?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  shopId: string;
  userId?: string;
  actionType: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface ShopStats {
  todayOrders: number;
  todayRevenue: number;
  weeklyOrders: number;
  weeklyRevenue: number;
  monthlyOrders: number;
  monthlyRevenue: number;
  lifetimeOrders: number;
  lifetimeRevenue: number;
  totalPageCount: number;
  pendingOrders: number;
  completedJobs: number;
}
