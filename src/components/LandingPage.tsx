import React, { useState } from 'react';
import {
  Printer,
  QrCode,
  Upload,
  CheckCircle2,
  Sliders,
  Laptop,
  BarChart3,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Phone,
  FileText,
  DollarSign,
  HelpCircle,
  Clock,
  Layers,
  Play,
  Lock,
  User,
} from 'lucide-react';
import { api } from '../lib/api.js';

interface LandingPageProps {
  onOpenCustomerPortal: (slug: string) => void;
  onLoginSuccess: (user: any, shop?: any) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenCustomerPortal, onLoginSuccess }) => {
  // Modal states
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register Form
  const [regShopName, setRegShopName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regOtp, setRegOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpDevHint, setOtpDevHint] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!regPhone || regPhone.replace(/[^0-9]/g, '').length < 10) {
      alert('Please enter a valid 10-digit Indian WhatsApp number.');
      return;
    }
    setOtpSending(true);
    try {
      const res = await api.sendRegistrationOtp(regPhone, regShopName);
      setOtpSent(true);
      if (res.devHint) setOtpDevHint(res.devHint);
      alert(`Verification code sent to WhatsApp: ${regPhone}`);
    } catch (e: any) {
      alert(e.message || 'Failed to send WhatsApp OTP');
    } finally {
      setOtpSending(false);
    }
  };

  // Reset Password State
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');

  // Interactive Live Price Estimator State
  const [calcPages, setCalcPages] = useState<number>(10);
  const [calcCopies, setCalcCopies] = useState<number>(1);
  const [calcColor, setCalcColor] = useState<'bw' | 'color'>('bw');
  const [calcDuplex, setCalcDuplex] = useState<'single' | 'duplex'>('single');

  // Interactive FAQ Open State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const res = await api.login(loginEmail, loginPassword);
      setShowLoginModal(false);
      onLoginSuccess(res.user, res.shop);
    } catch (err: any) {
      alert(err.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }
    setRegLoading(true);
    try {
      const res = await api.register({
        shopName: regShopName,
        email: regEmail,
        password: regPassword,
        whatsappNumber: regPhone,
        otpCode: regOtp,
        verified: Boolean(regOtp),
      });
      setShowRegisterModal(false);
      onLoginSuccess(res.user, res.shop);
    } catch (err: any) {
      alert(err.message || 'Registration failed');
    } finally {
      setRegLoading(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.resetPasswordRequest(resetEmail);
      if (res.resetToken) {
        setResetToken(res.resetToken);
        setResetStep('confirm');
      } else {
        alert(res.message);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.resetPasswordConfirm(resetToken, newPassword);
      alert(res.message);
      setShowForgotModal(false);
      setShowLoginModal(true);
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Calculator price formula
  const getCalculatedPrice = () => {
    let rate = 2.0;
    if (calcColor === 'bw') {
      rate = calcDuplex === 'duplex' ? 1.5 : 2.0;
    } else {
      rate = calcDuplex === 'duplex' ? 9.0 : 10.0;
    }
    return (rate * calcPages * calcCopies).toFixed(2);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">
      {/* ========================================================
          NAVBAR
         ======================================================== */}
      <nav className="bg-white/95 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-slate-900">
                ADRTech <span className="text-blue-600">PrintQR</span>
              </span>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                Self-Service Print Station System
              </p>
            </div>
          </div>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#how-it-works" className="hover:text-blue-600 transition">How It Works</a>
            <a href="#features" className="hover:text-blue-600 transition">Features</a>
            <a href="#calculator" className="hover:text-blue-600 transition">Price Calculator</a>
            <a href="#faq" className="hover:text-blue-600 transition">FAQ</a>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenCustomerPortal('apex-print')}
              className="px-4 py-2 text-sm font-bold text-blue-600 hover:text-blue-700 transition"
            >
              Customer QR Portal
            </button>

            <button
              onClick={() => setShowLoginModal(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-600/20 hover:shadow-lg transition flex items-center gap-1.5"
            >
              Sign In <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* ========================================================
          3. HERO SECTION
         ======================================================== */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 bg-gradient-to-b from-blue-50/40 via-white to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Hero Copy */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100/80 text-blue-800 text-xs font-bold">
                <Sparkles className="w-4 h-4 text-blue-600" />
                Direct QR & Online Payment Printing for Local Xerox & Print Shops
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.12]">
                Customers Scan, Pay Online & Print.{' '}
                <span className="text-blue-600">Your Machine Prints Instantly.</span>
              </h1>

              <p className="text-lg text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Transform your Xerox center, cyber cafe, or digital studio into an automated self-service hub. Customers pay online via UPI, and prints dispatch directly to your Windows desktop printer.
              </p>

              {/* Hero Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                <button
                  onClick={() => onOpenCustomerPortal('apex-print')}
                  className="w-full sm:w-auto px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl text-base shadow-lg shadow-blue-600/25 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <QrCode className="w-5 h-5 text-white" /> Open Customer Print Portal <ChevronRight className="w-5 h-5" />
                </button>

                <button
                  onClick={() => setShowLoginModal(true)}
                  className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-2xl text-base shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-5 h-5 text-blue-600" /> Shop Owner / Admin Login
                </button>
              </div>

              {/* Trust Badges */}
              <div className="pt-6 grid grid-cols-3 gap-4 border-t border-slate-200/80 max-w-xl mx-auto lg:mx-0 text-left">
                <div>
                  <p className="text-xs font-semibold text-slate-500">⚡ Fast Workflow</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">5-Sec Customer Upload</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">🔒 100% Secure</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">Private File Storage</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">🖨️ Windows Native</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">Direct Spooler Queue</p>
                </div>
              </div>
            </div>

            {/* Right Hero Visual Card */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200/80">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-slate-800">Live Counter Standee Simulation</span>
                  </div>
                  <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    No App Needed
                  </span>
                </div>

                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 my-4 text-center">
                  <div className="w-44 h-44 bg-white p-3 rounded-2xl shadow-sm border border-slate-200 mx-auto mb-3 flex items-center justify-center">
                    <QrCode className="w-36 h-36 text-slate-900" />
                  </div>
                  <p className="text-xs font-bold text-slate-900">Scan with Phone Camera to Print</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Supports PDF, JPG, PNG & ID Cards</p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between text-emerald-900 font-medium">
                    <span>ORD-920412 (12 Pages, B&W)</span>
                    <span className="font-bold">₹18.00 • Paid at Counter</span>
                  </div>
                  <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between text-blue-900 font-medium">
                    <span>ORD-920415 (Aadhaar Front/Back)</span>
                    <span className="font-bold">₹30.00 • Spooling to HP</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          4. HOW IT WORKS SECTION
         ======================================================== */}
      <section id="how-it-works" className="py-20 bg-slate-50 border-t border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs uppercase font-extrabold text-blue-600 tracking-wider">Simple 3-Step Process</span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-2">
              How QR Printing Works For Your Customers
            </h2>
            <p className="text-slate-600 text-sm mt-3">
              No registration or software installation required for customers. Works smoothly in any mobile browser.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-2xl flex items-center justify-center font-black text-lg mb-6">
                1
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Scan & Upload</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Customer scans the shop counter QR code with their phone camera and selects their PDF or photo files. Built-in ID Card Arranger formats front and back onto A4.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center font-black text-lg mb-6">
                2
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Review & Approve</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                The platform computes the exact price based on your shop's per-page rates. Small orders can auto-approve, while large batches queue for counter review.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center font-black text-lg mb-6">
                3
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Print & Collect</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Customer shows their Order Number at the counter and pays cash/UPI. Your paired Windows Desktop Agent spools the print job directly to your laser or inkjet machine.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          5. CORE PLATFORM FEATURES
         ======================================================== */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs uppercase font-extrabold text-blue-600 tracking-wider">Engineered For Print Shops</span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-2">
              Everything Your Xerox & Print Center Needs
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Printable Shop QR Standees</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Download a clean, ready-to-print A4 counter poster PDF featuring your shop name, contact, instructions, and unique QR code.
              </p>
            </div>

            <div className="p-8 rounded-3xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Photo & ID-Card Tools</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Customers can snap front and back of Aadhaar, Voter, or Student cards and arrange them on an A4 sheet with brightness and cutting guides.
              </p>
            </div>

            <div className="p-8 rounded-3xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                <Laptop className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Windows Desktop Agent</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Native Python/PySide6 desktop app connects to your shop queue. Features atomic claims, dry-run mode, and automatic spooling.
              </p>
            </div>

            <div className="p-8 rounded-3xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition">
              <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-4">
                <Sliders className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Smart Approval Rules</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Switch between Manual Review, Automatic, or Smart rules (&lt; 10 pages auto-approved) with mandatory counter payment enforcement.
              </p>
            </div>

            <div className="p-8 rounded-3xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition">
              <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mb-4">
                <DollarSign className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Custom Price Snapshots</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Define B&W single/duplex, Color single/duplex, Legal, and Photo rates. Order prices are calculated server-side and preserved indefinitely.
              </p>
            </div>

            <div className="p-8 rounded-3xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition">
              <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Sales Reports & Audit Logs</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Track today's, weekly, and monthly collected revenue, page impression counts, and inspect timestamped activity trails.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          6. INTERACTIVE PRICE CALCULATOR
         ======================================================== */}
      <section id="calculator" className="py-20 bg-slate-50 border-t border-b border-slate-200/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs uppercase font-extrabold text-blue-600 tracking-wider">Live Simulator</span>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-1">
              Interactive Print Cost Estimator
            </h2>
            <p className="text-slate-600 text-xs mt-2">
              See how transparent pricing works for customers based on page count and paper settings.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-2">
                    <span>Number of Pages:</span>
                    <span className="text-blue-600 font-extrabold">{calcPages} Pages</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={calcPages}
                    onChange={(e) => setCalcPages(parseInt(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-2">
                    <span>Copies:</span>
                    <span className="text-blue-600 font-extrabold">{calcCopies} {calcCopies === 1 ? 'Copy' : 'Copies'}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={calcCopies}
                    onChange={(e) => setCalcCopies(parseInt(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Color Mode</label>
                    <select
                      value={calcColor}
                      onChange={(e) => setCalcColor(e.target.value as any)}
                      className="w-full py-2 px-3 border border-slate-200 rounded-xl text-xs font-semibold bg-white"
                    >
                      <option value="bw">Black & White (B&W)</option>
                      <option value="color">Full Colour</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Duplex Sides</label>
                    <select
                      value={calcDuplex}
                      onChange={(e) => setCalcDuplex(e.target.value as any)}
                      className="w-full py-2 px-3 border border-slate-200 rounded-xl text-xs font-semibold bg-white"
                    >
                      <option value="single">Single-Sided</option>
                      <option value="duplex">Double-Sided (Duplex)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Price Output Box */}
              <div className="bg-slate-900 text-white p-8 rounded-2xl text-center flex flex-col justify-center">
                <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Estimated Total Price</p>
                <p className="text-5xl font-black text-emerald-400 tracking-tight my-3">₹{getCalculatedPrice()}</p>
                <p className="text-xs text-slate-400">
                  {calcPages} pages × {calcCopies} {calcCopies === 1 ? 'copy' : 'copies'} ({calcColor.toUpperCase()}, {calcDuplex})
                </p>
                <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-400">
                  Paid at shop counter via Cash or UPI QR.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          7. FAQ SECTION
         ======================================================== */}
      <section id="faq" className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs uppercase font-extrabold text-blue-600 tracking-wider">Got Questions?</span>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-1">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: 'How does payment collection work?',
                a: 'Customers do not pay online. They pay directly at your shop counter using cash or your counter UPI QR code. The shopkeeper confirms payment in the dashboard before prints are released.',
              },
              {
                q: 'Do customers need to download an app or register?',
                a: 'No. Customers simply scan your counter QR code with any smartphone camera. It opens directly in their browser without login or app installation.',
              },
              {
                q: 'What file formats are supported?',
                a: 'PDF, JPG, PNG, and WebP files up to 50MB. Word (.docx) and Excel (.xlsx) files must be exported to PDF before uploading.',
              },
              {
                q: 'How does the Windows desktop printing application work?',
                a: 'The Windows Agent is a lightweight PySide6 application that runs in your shop PC background. It polls your shop queue, securely claims authorized paid jobs, and sends them directly to your Windows print spooler.',
              },
              {
                q: 'Why does my shop status say "Pending Review"?',
                a: 'To maintain platform trust and prevent fraudulent shops, new registrations are reviewed by an administrator before customer orders go live.',
              },
            ].map((faq, idx) => (
              <div
                key={idx}
                className="border border-slate-200 rounded-2xl overflow-hidden transition"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full p-5 text-left font-bold text-sm text-slate-900 flex items-center justify-between hover:bg-slate-50"
                >
                  <span>{faq.q}</span>
                  <span className="text-slate-400 text-lg">{openFaq === idx ? '−' : '+'}</span>
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================
          8. FOOTER
         ======================================================== */}
      <footer className="bg-slate-900 text-white py-12 border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white">
                <Printer className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold">ADRTech PrintQR</span>
            </div>

            <div className="flex flex-wrap gap-6 text-xs text-slate-400">
              <a href="#how-it-works" className="hover:text-white">How It Works</a>
              <a href="#features" className="hover:text-white">Features</a>
              <a href="#calculator" className="hover:text-white">Price Estimator</a>
              <a href="#faq" className="hover:text-white">FAQ</a>
              <button onClick={() => setShowLoginModal(true)} className="hover:text-white font-bold text-blue-400">
                Shop & Admin Portal
              </button>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <p>© {new Date().getFullYear()} ADRTech QR Print Service. All rights reserved.</p>
            <p>Built with enterprise security • Private Document Storage • Spooler Integration</p>
          </div>
        </div>
      </footer>

      {/* ========================================================
          LOGIN MODAL
         ======================================================== */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <h3 className="text-lg font-bold text-slate-900">Sign In to Shop Dashboard</h3>
              <button
                onClick={() => setShowLoginModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="e.g. printx286351@gmail.com"
                  className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLoginModal(false);
                      setShowForgotModal(true);
                    }}
                    className="text-[11px] text-blue-600 hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition shadow-xs mt-2 cursor-pointer"
              >
                {loginLoading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">
                Shop accounts are managed & approved exclusively by the System Administrator.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          SHOP REGISTRATION MODAL
         ======================================================== */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Register your print shop</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Create your owner account and verify WhatsApp. Shop activation follows platform settings.
                </p>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Shop name</label>
                <input
                  type="text"
                  required
                  value={regShopName}
                  onChange={(e) => setRegShopName(e.target.value)}
                  placeholder="The name customers will see"
                  className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Email address</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">WhatsApp number</label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="10-digit Indian WhatsApp number"
                    className="flex-1 py-2.5 px-3 border border-slate-200 rounded-xl text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={otpSending}
                    className="px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 shrink-0 transition"
                  >
                    {otpSending ? 'Sending...' : 'Send WhatsApp OTP'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Send verification codes and enabled account updates to this WhatsApp number.
                </p>

                {otpDevHint && (
                  <p className="text-[11px] text-blue-600 font-bold bg-blue-50 p-2 rounded-lg mt-2">
                    {otpDevHint}
                  </p>
                )}

                {otpSent && (
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder="Enter 6-digit WhatsApp OTP"
                      maxLength={6}
                      value={regOtp}
                      onChange={(e) => setRegOtp(e.target.value)}
                      className="w-full py-2 px-3 border border-emerald-300 bg-emerald-50/40 rounded-xl text-xs font-bold"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Use at least 6 characters."
                  className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm"
                />
                <p className="text-[11px] text-slate-400 mt-0.5">Use at least 6 characters.</p>
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition shadow-xs mt-3 cursor-pointer"
              >
                {regLoading ? 'Creating account...' : 'Create owner account'}
              </button>

              <div className="pt-3 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-500">
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegisterModal(false);
                      setShowLoginModal(true);
                    }}
                    className="font-bold text-blue-600 hover:underline"
                  >
                    Sign in
                  </button>{' '}
                  |{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegisterModal(false);
                      setShowForgotModal(true);
                    }}
                    className="font-bold text-blue-600 hover:underline"
                  >
                    Forgot password?
                  </button>
                </p>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          PASSWORD RESET MODAL
         ======================================================== */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-1">Reset Password</h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter your email to receive a password reset token.
            </p>

            {resetStep === 'request' ? (
              <form onSubmit={handleResetRequest} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
                  >
                    Request Token
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetConfirm} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Reset Token</label>
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
                >
                  Set New Password
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
