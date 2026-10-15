import { User, Shop, ShopPricing, ShopApprovalRules, Order, WindowsAgent, ShopStats, ActivityLog } from '../types.js';

const TOKEN_KEY = 'printqr_auth_token';

export const api = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
    }

    return data as T;
  },

  // Auth
  async login(email: string, password: string): Promise<{ user: User; shop?: Shop; token: string }> {
    const res = await this.request<{ user: User; shop?: Shop; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token);
    return res;
  },

  async sendRegistrationOtp(whatsappNumber: string, shopName?: string): Promise<{ success: boolean; message: string; otp?: string; devHint?: string }> {
    return this.request('/api/auth/send-registration-otp', {
      method: 'POST',
      body: JSON.stringify({ whatsappNumber, shopName }),
    });
  },

  async register(params: any): Promise<{ user: User; shop: Shop; token: string }> {
    const res = await this.request<{ user: User; shop: Shop; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    this.setToken(res.token);
    return res;
  },

  async getMe(): Promise<{ user: User; shop?: Shop }> {
    return this.request<{ user: User; shop?: Shop }>('/api/auth/me');
  },

  logout() {
    this.clearToken();
  },

  async requestOtp(): Promise<{ success: boolean; message: string; provider: string; expiresAt: string; devHint?: string }> {
    return this.request('/api/auth/request-otp', { method: 'POST' });
  },

  async verifyOtp(code: string): Promise<{ success: boolean; message: string }> {
    return this.request('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async resetPasswordRequest(email: string): Promise<{ message: string; resetToken?: string; devHint?: string }> {
    return this.request('/api/auth/reset-password-request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async requestPasswordReset(email: string): Promise<{ message: string; resetToken?: string; devHint?: string }> {
    return this.resetPasswordRequest(email);
  },

  async resetPasswordConfirm(resetToken: string, newPassword: string): Promise<{ message: string }> {
    return this.request('/api/auth/reset-password-confirm', {
      method: 'POST',
      body: JSON.stringify({ resetToken, newPassword }),
    });
  },

  async confirmPasswordReset(resetToken: string, newPassword: string): Promise<{ message: string }> {
    return this.resetPasswordConfirm(resetToken, newPassword);
  },

  // Admin
  async getAdminShops(): Promise<any[]> {
    return this.request('/api/admin/shops');
  },

  async createShop(shopData: any): Promise<any> {
    return this.request('/api/admin/shops', {
      method: 'POST',
      body: JSON.stringify(shopData),
    });
  },

  async editShop(shopId: string, shopData: any): Promise<any> {
    return this.request(`/api/admin/shops/${shopId}`, {
      method: 'PUT',
      body: JSON.stringify(shopData),
    });
  },

  async deleteShop(shopId: string): Promise<any> {
    return this.request(`/api/admin/shops/${shopId}`, {
      method: 'DELETE',
    });
  },

  async activateShop(shopId: string, action: 'activate' | 'reject', rejectionReason?: string): Promise<any> {
    return this.request(`/api/admin/shops/${shopId}/activate`, {
      method: 'POST',
      body: JSON.stringify({ action, rejectionReason }),
    });
  },

  // Public Shop
  async getPublicShop(slug: string): Promise<{ shop: Shop; pricing: ShopPricing; requiresCounterPayment: boolean }> {
    return this.request(`/api/shops/${slug}`);
  },

  async uploadFile(file: File): Promise<{
    fileId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    filePath: string;
    pageCount: number;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/orders/upload', {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to upload file');
    }
    return data;
  },

  async createOrder(orderData: any): Promise<{ message: string; order: Order; shop: any }> {
    return this.request('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  },

  async trackOrder(orderNumber: string): Promise<{ order: Order; shop: any }> {
    return this.request(`/api/orders/${orderNumber}`);
  },

  // Shop Dashboard
  async getCurrentShop(): Promise<Shop> {
    return this.request('/api/shop/current');
  },

  async updateCurrentShop(data: Partial<Shop>): Promise<Shop> {
    return this.request('/api/shop/current', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getShopPricing(): Promise<ShopPricing> {
    return this.request('/api/shop/pricing');
  },

  async updateShopPricing(pricing: Partial<ShopPricing>): Promise<ShopPricing> {
    return this.request('/api/shop/pricing', {
      method: 'PUT',
      body: JSON.stringify(pricing),
    });
  },

  async getShopApprovalRules(): Promise<ShopApprovalRules> {
    return this.request('/api/shop/approval-rules');
  },

  async updateShopApprovalRules(rules: Partial<ShopApprovalRules>): Promise<ShopApprovalRules> {
    return this.request('/api/shop/approval-rules', {
      method: 'PUT',
      body: JSON.stringify(rules),
    });
  },

  async getShopOrders(filter = 'all'): Promise<Order[]> {
    return this.request(`/api/shop/orders?filter=${filter}`);
  },

  async approveOrder(orderId: string): Promise<Order> {
    return this.request(`/api/shop/orders/${orderId}/approve`, { method: 'POST' });
  },

  async rejectOrder(orderId: string, reason: string): Promise<Order> {
    return this.request(`/api/shop/orders/${orderId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async deleteOrder(orderId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/shop/orders/${orderId}`, {
      method: 'DELETE',
    });
  },

  async payOnline(orderNumber: string, transactionId?: string): Promise<any> {
    return this.request(`/api/orders/${orderNumber}/pay-online`, {
      method: 'POST',
      body: JSON.stringify({ transactionId }),
    });
  },

  async collectPayment(orderId: string, method: 'counter_upi' | 'online_upi', notes?: string): Promise<any> {
    return this.request(`/api/shop/orders/${orderId}/collect-payment`, {
      method: 'POST',
      body: JSON.stringify({ method, notes }),
    });
  },

  async dispatchPrint(orderId: string, printerName?: string): Promise<any> {
    return this.request(`/api/shop/orders/${orderId}/dispatch-print`, {
      method: 'POST',
      body: JSON.stringify({ printerName }),
    });
  },

  async completeOrder(orderId: string): Promise<Order> {
    return this.request(`/api/shop/orders/${orderId}/complete`, { method: 'POST' });
  },

  async archiveOrder(orderId: string): Promise<Order> {
    return this.request(`/api/shop/orders/${orderId}/archive`, { method: 'POST' });
  },

  async restoreOrder(orderId: string): Promise<Order> {
    return this.request(`/api/shop/orders/${orderId}/restore`, { method: 'POST' });
  },

  async getDocumentToken(orderId: string): Promise<{ token: string; url: string }> {
    return this.request(`/api/shop/orders/${orderId}/document-token`);
  },

  async getShopStats(): Promise<ShopStats> {
    return this.request('/api/shop/stats');
  },

  async getShopActivity(): Promise<ActivityLog[]> {
    return this.request('/api/shop/activity');
  },

  // Agent API
  async createUtilityApiKey(): Promise<{ apiKey: string; agent: WindowsAgent }> {
    return this.request('/api/shop/agent/utility-key', { method: 'POST' });
  },

  async generatePairingCode(reset = false): Promise<{ code: string; isFixed?: boolean }> {
    return this.request(`/api/shop/agent/pairing-code${reset ? '?reset=true' : ''}`, { method: 'POST' });
  },

  async getAgentStatus(): Promise<WindowsAgent | null> {
    return this.request('/api/shop/agent/status');
  },

  async updateAgentPrinters(data: { defaultPrinter?: string; bwPrinter?: string; colorPrinter?: string; dryRunMode?: boolean }): Promise<WindowsAgent> {
    return this.request('/api/shop/agent/printers', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async revokeAgent(): Promise<{ message: string }> {
    return this.request('/api/shop/agent/revoke', { method: 'POST' });
  },

  async updateShopProfile(data: Partial<Shop>): Promise<Shop> {
    return this.request('/api/shop/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getSupabaseStatus(): Promise<{ connected: boolean; url: string; lastSyncedAt?: string; mode: string; error?: string }> {
    return this.request('/api/supabase/status');
  },

  async syncSupabase(): Promise<{ success: boolean; status: any }> {
    return this.request('/api/supabase/sync', { method: 'POST' });
  },
};
