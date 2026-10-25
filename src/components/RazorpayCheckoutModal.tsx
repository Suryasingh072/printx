import React, { useState } from 'react';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Zap,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { initiateRazorpayCheckout } from '../lib/razorpay.js';

interface RazorpayCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAmountRupees?: number;
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  onPaymentSuccess?: (result: {
    paymentId: string;
    orderId: string;
    signature: string;
  }) => void;
}

export const RazorpayCheckoutModal: React.FC<RazorpayCheckoutModalProps> = ({
  isOpen,
  onClose,
  defaultAmountRupees = 5,
  orderNumber,
  customerName = '',
  customerPhone = '',
  customerEmail = '',
  onPaymentSuccess,
}) => {
  const [amountRupees, setAmountRupees] = useState<number>(defaultAmountRupees);
  const [name, setName] = useState<string>(customerName);
  const [phone, setPhone] = useState<string>(customerPhone);
  const [email, setEmail] = useState<string>(customerEmail);
  const [status, setStatus] = useState<'idle' | 'creating_order' | 'modal_opened' | 'verifying' | 'success' | 'failed' | 'cancelled'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifiedPayment, setVerifiedPayment] = useState<{
    paymentId: string;
    orderId: string;
    signature: string;
    amount: number;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handlePayNow = async () => {
    setErrorMessage(null);
    if (!amountRupees || amountRupees < 1) {
      setErrorMessage('Minimum payment amount is ₹1.00 (100 paise).');
      return;
    }

    try {
      setStatus('creating_order');

      await initiateRazorpayCheckout({
        amountInRupees: amountRupees,
        orderNumber,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        description: orderNumber ? `Print Order ${orderNumber}` : 'Razorpay Web Checkout',
        onDismiss: () => {
          setStatus('cancelled');
        },
        onError: (err) => {
          setStatus('failed');
          setErrorMessage(err.description || 'Payment was unsuccessful or cancelled.');
        },
        onSuccess: (result) => {
          setStatus('success');
          setVerifiedPayment({
            paymentId: result.paymentId,
            orderId: result.orderId,
            signature: result.signature,
            amount: amountRupees,
          });

          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 },
          });

          onPaymentSuccess?.({
            paymentId: result.paymentId,
            orderId: result.orderId,
            signature: result.signature,
          });
        },
      });
    } catch (err: any) {
      setStatus('failed');
      setErrorMessage(err?.message || 'Payment initiation failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0d1326] border border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 text-white overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-pink-500/15 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-indigo-500/15 blur-3xl rounded-full pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0c2340] to-[#0284c7] border border-sky-400/30 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <CreditCard className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base font-['Sora'] text-white">Razorpay Standard Checkout</h3>
                <span className="badge text-[10px] font-bold py-0.5 px-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Live Payment
                </span>
              </div>
              <p className="text-xs text-slate-400">Cards, UPI, Netbanking & Wallets with Signature Verification</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {status === 'success' && verifiedPayment ? (
          <div className="space-y-5 py-2 relative z-10">
            <div className="p-5 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-bold text-emerald-300 font-['Sora']">Payment Verified Successfully!</h4>
              <p className="text-xs text-slate-300">
                HMAC-SHA256 signature verified on server. Amount: <span className="font-bold text-white">₹{verifiedPayment.amount.toFixed(2)}</span>
              </p>
            </div>

            <div className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="text-slate-400">Payment ID:</span>
                <button
                  type="button"
                  onClick={() => handleCopy(verifiedPayment.paymentId, 'pid')}
                  className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-bold cursor-pointer"
                >
                  <span>{verifiedPayment.paymentId}</span>
                  {copiedKey === 'pid' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                </button>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="text-slate-400">Razorpay Order ID:</span>
                <button
                  type="button"
                  onClick={() => handleCopy(verifiedPayment.orderId, 'oid')}
                  className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-bold cursor-pointer"
                >
                  <span>{verifiedPayment.orderId}</span>
                  {copiedKey === 'oid' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Signature:</span>
                <span className="text-slate-300 text-[10px] truncate max-w-[220px]" title={verifiedPayment.signature}>
                  {verifiedPayment.signature.slice(0, 24)}...
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setStatus('idle');
                  setVerifiedPayment(null);
                }}
                className="btn bg-white/10 hover:bg-white/15 text-white py-3 px-4 text-xs font-bold rounded-xl flex-1 cursor-pointer"
              >
                Pay Another Amount
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-primary py-3 px-6 text-xs font-bold rounded-xl flex-1 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Payment Form View */
          <div className="space-y-5 relative z-10">
            {/* Amount Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Amount to Pay (INR)</span>
                <span className="text-[11px] text-slate-400">Min: ₹1.00 (100 paise)</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(Math.max(1, parseFloat(e.target.value) || 0))}
                  placeholder="Enter amount"
                  className="w-full pl-9 pr-4 py-3 bg-white/[0.05] border border-white/15 rounded-2xl text-lg font-bold text-white font-mono focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                {[1, 5, 10, 50].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmountRupees(preset)}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      amountRupees === preset
                        ? 'bg-sky-500/20 text-sky-300 border-sky-400/50'
                        : 'bg-white/[0.03] text-slate-400 border-white/10 hover:text-white'
                    }`}
                  >
                    ₹{preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Customer Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-400">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Customer Name"
                  className="w-full py-2 px-3 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-sky-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-400">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile"
                  className="w-full py-2 px-3 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>

            {/* Status alerts */}
            {errorMessage && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {status === 'cancelled' && (
              <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center gap-2 text-xs text-amber-300">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>Checkout modal was closed. You can retry anytime.</span>
              </div>
            )}

            {/* Action Button */}
            <button
              type="button"
              onClick={handlePayNow}
              disabled={status === 'creating_order' || status === 'verifying'}
              className="btn w-full bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-sky-600/30 flex items-center justify-center gap-2 text-sm font-['Sora'] cursor-pointer transition transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {status === 'creating_order' ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating Razorpay Order...</span>
                </>
              ) : status === 'verifying' ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Signature...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-white" />
                  <span>Pay ₹{amountRupees.toFixed(2)} with Razorpay</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Security Assurance */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
                <ShieldCheck className="w-4 h-4" /> 256-bit SSL & HMAC-SHA256
              </span>
              <span>Razorpay Standard Checkout</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
