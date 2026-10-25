/**
 * Razorpay Standard Web Checkout Integration Helper
 * Reference: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
 */

import { api } from './api.js';

export interface RazorpayCheckoutOptions {
  amountInRupees?: number;
  amountInPaise?: number;
  currency?: string;
  orderNumber?: string;
  receipt?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  notes?: Record<string, any>;
  description?: string;
  themeColor?: string;
  onSuccess?: (paymentResult: {
    paymentId: string;
    orderId: string;
    signature: string;
    verificationData: any;
  }) => void;
  onError?: (error: { code?: string; description?: string; raw?: any }) => void;
  onDismiss?: () => void;
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

/**
 * Dynamically loads the Razorpay Standard Checkout script if not already available in DOM.
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      return resolve(false);
    }

    if (window.Razorpay) {
      return resolve(true);
    }

    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('Failed to load Razorpay Checkout script.');
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

/**
 * Initiates Razorpay Standard Checkout:
 * 1. Calls backend /api/create-order
 * 2. Opens Razorpay payment modal with order_id
 * 3. On success, calls backend /api/verify-payment to verify HMAC-SHA256 signature
 */
export async function initiateRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<void> {
  // 1. Ensure Razorpay script is loaded
  const scriptLoaded = await loadRazorpayScript();
  if (!scriptLoaded || !window.Razorpay) {
    const err = { description: 'Razorpay SDK could not be loaded. Please check your internet connection.' };
    options.onError?.(err);
    throw new Error(err.description);
  }

  // 2. Compute amount in paise (minimum 100 paise = ₹1.00)
  let paise = options.amountInPaise;
  if (!paise && options.amountInRupees !== undefined) {
    paise = Math.round(options.amountInRupees * 100);
  }

  if (!paise || paise < 100) {
    const err = { description: 'Minimum payment amount is ₹1.00 (100 paise).' };
    options.onError?.(err);
    throw new Error(err.description);
  }

  const receipt = options.receipt || (options.orderNumber ? `rcpt_${options.orderNumber}` : `rcpt_${Date.now()}`);
  const currency = options.currency || 'INR';

  // 3. Step 1: Create Order via Backend POST /api/create-order
  const createdOrder = await api.createRazorpayOrder(
    paise,
    currency,
    receipt,
    {
      orderNumber: options.orderNumber || '',
      ...(options.notes || {}),
    }
  );

  if (!createdOrder || !createdOrder.order_id) {
    const err = { description: 'Failed to obtain Razorpay order_id from server.' };
    options.onError?.(err);
    throw new Error(err.description);
  }

  // 4. Resolve client key ID from env or server response
  const clientKey =
    import.meta.env?.VITE_RAZORPAY_KEY_ID ||
    createdOrder.key_id ||
    (await api.getRazorpayConfig().catch(() => ({ key_id: '' }))).key_id ||
    'rzp_live_TsAzwEO7ucpLWe';

  // 5. Open Razorpay Checkout Modal
  return new Promise((resolve, reject) => {
    let isCompleted = false;

    const modalOptions = {
      key: clientKey,
      amount: createdOrder.amount, // in paise
      currency: createdOrder.currency || 'INR',
      name: 'printx',
      description: options.description || (options.orderNumber ? `Print Order ${options.orderNumber}` : 'Payment Checkout'),
      image: '/favicon.svg',
      order_id: createdOrder.order_id,
      prefill: {
        name: options.customerName || '',
        contact: options.customerPhone || '',
        email: options.customerEmail || '',
      },
      notes: {
        orderNumber: options.orderNumber || '',
        receipt: createdOrder.receipt || receipt,
      },
      theme: {
        color: options.themeColor || '#ff2e63',
      },
      modal: {
        backdropclose: false,
        escape: true,
        handleback: true,
        confirm_close: true,
        ondismiss: function () {
          if (!isCompleted) {
            console.log('[Razorpay] Payment modal dismissed by user');
            options.onDismiss?.();
            resolve();
          }
        },
      },
      handler: async function (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) {
        isCompleted = true;
        try {
          // STEP 3: Verify Signature via Backend POST /api/verify-payment
          const verifyResult = await api.verifyRazorpayPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            orderNumber: options.orderNumber,
            receipt: createdOrder.receipt,
          });

          if (verifyResult.success) {
            options.onSuccess?.({
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              signature: response.razorpay_signature,
              verificationData: verifyResult,
            });
            resolve();
          } else {
            const err = { description: verifyResult.message || 'Payment signature verification failed.' };
            options.onError?.(err);
            reject(new Error(err.description));
          }
        } catch (verifyErr: any) {
          const err = { description: verifyErr?.message || 'Payment verification failed on server.' };
          options.onError?.(err);
          reject(verifyErr);
        }
      },
    };

    const rzp = new window.Razorpay(modalOptions);

    // Error Handling: payment.failed event
    rzp.on('payment.failed', function (failedResponse: any) {
      console.error('[Razorpay] Payment Failed:', failedResponse?.error);
      const errorPayload = {
        code: failedResponse?.error?.code,
        description: failedResponse?.error?.description || 'Payment was unsuccessful or declined by bank.',
        raw: failedResponse?.error,
      };
      options.onError?.(errorPayload);
    });

    rzp.open();
  });
}
