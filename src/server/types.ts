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
  passwordHash: string;
  fullName: string;
  whatsappNumber: string;
  whatsappVerified: boolean;
  whatsappOtp?: string;
  whatsappOtpExpiresAt?: string;
  role: UserRole;
  shopId?: string;
  resetToken?: string;
  resetTokenExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
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
  activatedBy?: string;
  qrCodeUrl?: string;
  paymentGatewayUrl?: string;
  createdAt: string;
  updatedAt: string;
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
  authTokenHash?: string;
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
  gatewayPaymentUrl?: string;
  gatewayOrderId?: string;
  gatewayCheckLink?: string;
  files?: Array<{
    id: string;
    name: string;
    type: string;
    sizeBytes: number;
    filePath: string;
    pageCount: number;
  }>;
  approvedAt?: string;
  approvedBy?: string;
  printedAt?: string;
  archivedAt?: string;
  documentRetentionUntil?: string;
  isDocumentPurged?: boolean;
  purgedAt?: string;
  purgeDueAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  previousStatus?: OrderStatus;
  newStatus: OrderStatus;
  changedByName: string;
  changedById?: string;
  comment?: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  shopId: string;
  amount: number;
  method: PaymentMethod;
  status: 'collected' | 'refunded';
  collectedBy: string;
  notes?: string;
  collectedAt: string;
}

export interface PrintJob {
  id: string;
  orderId: string;
  shopId: string;
  agentId?: string;
  printerName: string;
  claimToken?: string;
  status: 'pending' | 'claimed' | 'spooling' | 'printed' | 'failed';
  claimedAt?: string;
  completedAt?: string;
  retryCount: number;
  errorMessage?: string;
  filePath?: string;
  documentName?: string;
  documentType?: string;
  fileIndex?: number;
  totalFiles?: number;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  shopId: string;
  userId?: string;
  actionType: string;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
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
