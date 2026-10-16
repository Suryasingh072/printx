import React, { useState, useEffect } from 'react';
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
  Scissors,
  Camera,
  Zap,
  Check,
  ExternalLink,
  Mail,
  X,
  MessageSquare,
  Globe,
  Terminal,
  Moon,
  Sun,
  Menu,
  LogIn,
} from 'lucide-react';
import { api } from '../lib/api.js';

interface LandingPageProps {
  onOpenCustomerPortal: (slug: string) => void;
  onLoginSuccess: (user: any, shop?: any) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenCustomerPortal, onLoginSuccess }) => {
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('px-theme') as 'dark' | 'light';
      if (saved) {
        setTheme(saved);
        document.documentElement.dataset.theme = saved;
      } else {
        document.documentElement.dataset.theme = 'dark';
      }
    } catch {}
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('px-theme', next);
    } catch {}
  };

  // Active section scroll / tab
  const [activeSection, setActiveSection] = useState<'home' | 'how-it-works' | 'features' | 'for-shops' | 'faq' | 'contact'>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Legal Modal States
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | 'refund' | null>(null);

  // Interactive Hero Preview Stage
  const [stageStep, setStageStep] = useState<number>(0);
  const [userInteractedStage, setUserInteractedStage] = useState(false);
  const [paperEmerge, setPaperEmerge] = useState(false);
  const [demoLogs, setDemoLogs] = useState<string[]>([]);

  useEffect(() => {
    if (userInteractedStage) return;
    const interval = setInterval(() => {
      setStageStep((prev) => (prev + 1) % 4);
    }, 4500);
    return () => clearInterval(interval);
  }, [userInteractedStage]);

  useEffect(() => {
    if (stageStep === 3) {
      setPaperEmerge(false);
      setDemoLogs([]);
      setTimeout(() => setPaperEmerge(true), 200);
      const lines = [
        'Order picked up by agent',
        'File type verified: PDF ✓ (A4 Standard)',
        'Spooling silent print to HP LaserJet...',
        'Printed ✓ — file auto-purge scheduled in 5m',
      ];
      lines.forEach((l, i) => {
        setTimeout(() => {
          setDemoLogs((prev) => [...prev, l]);
        }, 500 + i * 800);
      });
    }
  }, [stageStep]);

  // Auth Modals
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Login Form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Reset Password State
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  // Interactive FAQ Accordion
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await api.login(loginEmail, loginPassword);
      setShowLoginModal(false);
      onLoginSuccess(res.user, res.shop);
    } catch (err: any) {
      setLoginError(err.message || 'Invalid email or password');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      const res = await api.requestPasswordReset(resetEmail);
      setResetMsg(res.message);
      if (res.devHint) {
        const match = res.devHint.match(/token=([a-f0-9]+)/);
        if (match) setResetToken(match[1]);
      }
      setResetStep('confirm');
    } catch (e: any) {
      setResetMsg(e.message || 'Failed to request reset');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      const res = await api.confirmPasswordReset(resetToken, newPassword);
      alert(res.message || 'Password reset successfully! Please sign in.');
      setShowForgotModal(false);
      setShowLoginModal(true);
      setResetStep('request');
    } catch (e: any) {
      setResetMsg(e.message || 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };

  const handleOpenPrintPortal = () => {
    const slug = prompt('Apni Shop ka QR Code Name / Slug enter karein (e.g. ekta-communication):', 'ekta-communication');
    if (slug && slug.trim()) {
      onOpenCustomerPortal(slug.trim().toLowerCase());
    }
  };

  return (
    <div className={`min-h-screen text-slate-100 ${theme === 'light' ? 'bg-[#f6f7fb] text-slate-900' : 'bg-[#080b14]'}`}>
      {/* ========================================================
          1. TOP NAVIGATION BAR (Exact design from prompt)
         ======================================================== */}
      <nav className="fixed inset-x-0 top-0 z-50 backdrop-blur-xl border-b border-white/10 bg-[#080b14]/85 transition-colors">
        <div className="max-w-6xl mx-auto px-5 flex items-center justify-between h-[68px]">
          {/* Brand Logo */}
          <button
            onClick={() => { setActiveSection('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="flex items-center gap-2.5 font-['Sora'] font-extrabold text-xl tracking-tight text-white cursor-pointer"
          >
            <span className="w-9 h-9 rounded-xl bg-grad flex items-center justify-center shadow-lg shadow-rose-500/30">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
            </span>
            <span>printx</span>
          </button>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-7 text-[14.5px] font-medium text-slate-400">
            {[
              { id: 'home', label: 'Home' },
              { id: 'how-it-works', label: 'How it works' },
              { id: 'features', label: 'Features' },
              { id: 'for-shops', label: 'For shops' },
              { id: 'faq', label: 'FAQ' },
              { id: 'contact', label: 'Contact' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id as any);
                  const el = document.getElementById(item.id);
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`transition hover:text-white cursor-pointer py-1 relative ${
                  activeSection === item.id ? 'text-white font-semibold after:content-[""] after:absolute after:bottom-[-4px] after:inset-x-0 after:h-[2px] after:bg-grad after:rounded-full' : ''
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Nav Right CTA */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-sm cursor-pointer transition"
              title="Toggle theme"
            >
              {theme === 'dark' ? '🌓' : '☀️'}
            </button>

            <button
              onClick={() => setShowLoginModal(true)}
              className="px-5 py-2.5 text-sm font-black btn-grad rounded-xl cursor-pointer flex items-center gap-2 shadow-[0_4px_16px_rgba(255,46,99,0.35)]"
            >
              <LogIn className="w-4 h-4" />
              Sign in
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-10 h-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-slate-200 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0d1220] border-b border-white/10 px-6 py-4 space-y-3">
            {[
              { id: 'home', label: 'Home' },
              { id: 'how-it-works', label: 'How it works' },
              { id: 'features', label: 'Features' },
              { id: 'for-shops', label: 'For shops' },
              { id: 'faq', label: 'FAQ' },
              { id: 'contact', label: 'Contact' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id as any);
                  setMobileMenuOpen(false);
                  const el = document.getElementById(item.id);
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="block w-full text-left py-2 text-sm text-slate-300 font-medium hover:text-white"
              >
                {item.label}
              </button>
            ))}
            <div className="pt-3 border-t border-white/10">
              <button
                onClick={() => { setMobileMenuOpen(false); setShowLoginModal(true); }}
                className="w-full py-2.5 text-center text-xs font-bold btn-grad rounded-xl flex items-center justify-center gap-2"
              >
                <LogIn className="w-3.5 h-3.5" /> Sign in
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* ========================================================
          2. HERO SECTION WITH 4-STEP LIVE PREVIEW STAGE
         ======================================================== */}
      <section id="home" className="pt-36 pb-20 relative overflow-hidden">
        {/* Ambient Glowing Orbs */}
        <div className="absolute top-[-100px] left-[-120px] w-[520px] h-[520px] bg-rose-500/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-24 right-[-100px] w-[460px] h-[460px] bg-purple-600/15 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-5 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/15 bg-white/5 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
              For cyber cafes, copy shops and CSC centres
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[58px] font-extrabold font-['Sora'] leading-[1.12] tracking-tight">
              Customers scan.{' '}
              <span className="text-grad block mt-1">Your printer does the rest.</span>
            </h1>

            <p className="text-slate-400 text-base sm:text-lg max-w-xl leading-relaxed">
              Customers scan your QR code, upload files from their phone and send them straight to your printer. No WhatsApp, no pen drives, no app to install.
            </p>

            <div className="flex flex-wrap gap-3.5 pt-2">
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-8 py-4 rounded-xl font-black text-sm btn-grad flex items-center gap-2.5 cursor-pointer shadow-xl shadow-rose-500/25 transition hover:scale-[1.02]"
              >
                <LogIn className="w-4 h-4" />
                Sign in →
              </button>
            </div>

            {/* Chips */}
            <div className="flex flex-wrap gap-2.5 pt-4">
              {[
                'Any Windows printer',
                'Wi-Fi printer not required',
                'B&W and colour',
                'Files auto-deleted',
              ].map((chip) => (
                <div
                  key={chip}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-slate-300 font-medium"
                >
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>{chip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Hero Stage: Interactive 4-step Phone & Printer Preview */}
          <div className="lg:col-span-5">
            <div className="relative border border-white/15 rounded-3xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-6 shadow-2xl backdrop-blur-md">
              {/* Header */}
              <div className="flex items-center justify-between text-xs text-slate-400 pb-4 mb-4 border-b border-white/10">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {userInteractedStage ? 'Interactive preview' : 'Auto-playing preview'}
                </span>
              </div>

              {/* Step Buttons */}
              <div className="grid grid-cols-4 gap-2 mb-6">
                {[
                  { icon: '📱', label: 'Scan' },
                  { icon: '📄', label: 'Upload' },
                  { icon: '💳', label: 'Pay' },
                  { icon: '🖨️', label: 'Print' },
                ].map((s, idx) => (
                  <button
                    key={s.label}
                    onClick={() => {
                      setUserInteractedStage(true);
                      setStageStep(idx);
                    }}
                    className={`py-2 px-1 text-center rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      stageStep === idx
                        ? 'bg-grad text-white border-transparent shadow-md shadow-rose-500/30 font-bold'
                        : stageStep > idx
                        ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                        : 'border-white/10 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <span className="block text-base">{s.icon}</span>
                    <span className="text-[11px]">{s.label}</span>
                  </button>
                ))}
              </div>

              {/* Stage Viewport */}
              <div className="min-h-[290px] flex items-center justify-center">
                {/* Step 0: Scan QR */}
                {stageStep === 0 && (
                  <div className="w-[220px] border-2 border-white/20 rounded-[28px] p-4 bg-[#0d1220] shadow-xl text-center space-y-3">
                    <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-2" />
                    <div className="w-32 h-32 mx-auto bg-white rounded-xl p-2 relative overflow-hidden shadow-inner flex items-center justify-center">
                      <QrCode className="w-28 h-28 text-slate-900" />
                      <div className="absolute inset-x-0 h-1 bg-rose-500 shadow-[0_0_12px_#ff2e63] animate-scanline" />
                    </div>
                    <p className="text-xs text-slate-300 font-semibold">Scanning shop counter QR…</p>
                    <div className="text-[10px] text-slate-400 font-mono py-1 border border-dashed border-white/20 rounded-lg">
                      printx.shop/counter
                    </div>
                  </div>
                )}

                {/* Step 1: Upload */}
                {stageStep === 1 && (
                  <div className="w-[230px] border-2 border-white/20 rounded-[28px] p-4 bg-[#0d1220] shadow-xl space-y-2.5">
                    <div className="w-12 h-1 bg-white/20 rounded-full mx-auto" />
                    <p className="text-xs font-bold text-center text-slate-200">Select Files to Print</p>
                    <div className="p-2 border border-white/10 rounded-xl bg-white/5 flex items-center justify-between text-xs">
                      <span>📄 Resume_2026.pdf</span>
                      <span className="text-[10px] text-emerald-400 font-bold">2 pgs ✓</span>
                    </div>
                    <div className="p-2 border border-white/10 rounded-xl bg-white/5 flex items-center justify-between text-xs">
                      <span>🖼️ ID_Proof.jpg</span>
                      <span className="text-[10px] text-emerald-400 font-bold">1 pg ✓</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <div className="text-center py-1 text-[11px] font-bold rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        B&W (₹2)
                      </div>
                      <div className="text-center py-1 text-[11px] rounded-lg border border-white/10 text-slate-400">
                        Colour (₹10)
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Pay */}
                {stageStep === 2 && (
                  <div className="w-[230px] border-2 border-white/20 rounded-[28px] p-4 bg-[#0d1220] shadow-xl space-y-3">
                    <div className="w-12 h-1 bg-white/20 rounded-full mx-auto" />
                    <p className="text-xs font-bold text-center text-slate-200">Order Summary</p>
                    <div className="p-2.5 border border-white/10 rounded-xl bg-white/5 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Pages:</span>
                        <span className="font-bold">3 Pages (A4)</span>
                      </div>
                      <div className="flex justify-between text-emerald-400 font-bold">
                        <span>Amount Due:</span>
                        <span>₹6.00</span>
                      </div>
                    </div>
                    <div className="w-full py-2 bg-grad rounded-xl text-center text-xs font-bold text-white shadow-md shadow-rose-500/30">
                      Place Order → ORD-920412
                    </div>
                    <p className="text-[10px] text-slate-400 text-center">
                      Confirm cash or UPI at counter, then auto-prints!
                    </p>
                  </div>
                )}

                {/* Step 3: Print */}
                {stageStep === 3 && (
                  <div className="w-full max-w-[280px] text-center space-y-3">
                    {/* Printer graphic */}
                    <div className="relative w-44 mx-auto pt-4">
                      <div className="h-16 rounded-2xl bg-slate-800 border-2 border-white/20 flex items-center justify-center text-3xl shadow-xl relative z-10">
                        🖨️
                      </div>
                      {/* Evolving Paper */}
                      <div
                        className={`absolute left-6 right-6 top-10 bg-white rounded-b-md shadow-md transition-all duration-1000 overflow-hidden ${
                          paperEmerge ? 'h-20' : 'h-0'
                        }`}
                      >
                        <div className="p-2 space-y-1">
                          <div className="h-1 bg-slate-300 rounded" />
                          <div className="h-1 bg-slate-300 rounded w-3/4" />
                          <div className="h-1 bg-slate-200 rounded w-1/2" />
                        </div>
                      </div>
                    </div>

                    {/* Console log */}
                    <div className="mt-8 p-3 rounded-xl bg-black/60 border border-white/10 text-[11px] font-mono text-left space-y-1 min-h-[90px]">
                      {demoLogs.map((log, i) => (
                        <div key={i} className="text-slate-300">
                          <span className="text-emerald-400">› </span>
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="text-center text-[11px] text-slate-500 mt-2">
                Tap any step above to explore the workflow
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          3. HOW IT WORKS (01 Scan, 02 Upload, 03 Pay, 04 Print)
         ======================================================== */}
      <section id="how-it-works" className="py-24 border-t border-white/5 relative">
        <div className="max-w-6xl mx-auto px-5">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-rose-400 mb-3">
            <span className="w-5 h-0.5 bg-grad rounded-full" />
            How it works
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold font-['Sora'] tracking-tight max-w-2xl">
            Your job: stick up the QR.{' '}
            <span className="text-grad">That's it.</span>
          </h2>
          <p className="text-slate-400 text-base max-w-xl mt-3">
            Set up once. After that, every order reaches your counter without you touching a single file.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
            {[
              {
                num: '01',
                icon: '🔲',
                title: 'Scan',
                desc: 'Customers scan your unique shop QR code. The print page opens in their phone browser without installing any app.',
              },
              {
                num: '02',
                icon: '📤',
                title: 'Upload',
                desc: 'They add PDFs or photos, crop/rotate on phone, choose colour or B&W, copies and single/double-sided on A4.',
              },
              {
                num: '03',
                icon: '💳',
                title: 'Pay',
                desc: 'The server works out the exact price from your rates. You confirm cash or UPI payment at the counter.',
              },
              {
                num: '04',
                icon: '🖨️',
                title: 'Print',
                desc: 'Your Windows agent automatically claims the approved job, sends it to the printer silently, and reports success.',
              },
            ].map((step) => (
              <div
                key={step.num}
                className="p-6 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition relative group"
              >
                <span className="absolute top-4 right-5 text-4xl font-extrabold font-['Sora'] text-white/5 group-hover:text-white/10 transition">
                  {step.num}
                </span>
                <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-xl mb-4">
                  {step.icon}
                </div>
                <h3 className="text-lg font-bold font-['Sora'] mb-2">{step.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          {/* Privacy Box: Files purged in 5 min */}
          <div className="mt-16 p-8 rounded-3xl border border-white/15 bg-gradient-to-r from-rose-500/[0.08] via-purple-600/[0.08] to-transparent grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-7 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Privacy by design</span>
              <h3 className="text-2xl font-bold font-['Sora']">Customer files don't stick around</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Customers print Aadhaar cards, admit cards, marksheet and certificates. printx permanently purges uploaded files exactly 5 minutes after print completion.
              </p>
            </div>
            <div className="md:col-span-5 bg-black/80 border border-white/15 rounded-2xl p-4 font-mono text-xs text-slate-300 space-y-1.5 shadow-xl">
              <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-white/10 text-[10px] text-slate-500">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span>TERMINAL SPARK / AUDIT TRAIL</span>
              </div>
              <div>12:04:11 Order ORD-920412 approved</div>
              <div>12:04:11 job claimed by Windows agent</div>
              <div className="text-emerald-400">12:04:12 file verified: PDF ✓ (A4)</div>
              <div>12:04:13 printing → HP LaserJet (1 copy)</div>
              <div className="text-emerald-400 font-bold">12:04:19 report: printed</div>
              <div className="text-rose-400 font-bold">12:09:19 file purged from storage</div>
              <div className="text-slate-500">12:09:19 order record kept, file gone</div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          4. FEATURES SECTION (Customer & Shopkeeper)
         ======================================================== */}
      <section id="features" className="py-24 border-t border-white/5 relative">
        <div className="max-w-6xl mx-auto px-5">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-rose-400 mb-3">
            <span className="w-5 h-0.5 bg-grad rounded-full" />
            Counter System Features
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold font-['Sora'] tracking-tight">
            More than printing — <span className="text-grad">a complete counter system</span>
          </h2>

          {/* Subhead: For Customers */}
          <h3 className="text-xl font-bold font-['Sora'] mt-12 mb-6 text-slate-200">For customers</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: '📱', title: 'No app, no login', desc: 'Works in any mobile browser straight from the counter QR code.' },
              { icon: '📑', title: 'Multi-file orders', desc: 'Up to 15 PDFs and photos in a single order with one consolidated counter payment.' },
              { icon: '✂️', title: 'Edit on the phone', desc: 'Crop, rotate, and adjust brightness with live preview right inside the browser.' },
              { icon: '🪪', title: 'ID-card arranger', desc: 'Front and back of Aadhaar / PAN card placed together on one clean A4 sheet.' },
              { icon: '🎛️', title: 'Print options', desc: 'B&W or Colour, number of copies, single or double-sided back-to-back on A4.' },
              { icon: '⚡', title: 'Instant order number', desc: 'Customer shows their 6-digit order number at the counter for 5-second pickup.' },
            ].map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-xl mb-4">
                  {f.icon}
                </div>
                <h4 className="text-base font-bold font-['Sora'] mb-1.5">{f.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
                <span className="inline-block mt-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400">
                  Available
                </span>
              </div>
            ))}
          </div>

          {/* Subhead: For Shop Owners */}
          <h3 className="text-xl font-bold font-['Sora'] mt-16 mb-6 text-slate-200">For shop owners</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: '🔲', title: 'Your own QR & poster', desc: 'Unique shop link and QR code, plus a 1-click downloadable A4 counter standee.' },
              { icon: '💰', title: 'Your rates & pricing', desc: 'Set per-page rates for B&W, colour, duplex, and ID cards. Auto-calculated on server.' },
              { icon: '✅', title: 'Approval rules', desc: 'Manual review, automatic release, or smart threshold auto-approving small jobs.' },
              { icon: '📊', title: 'Sales reports & analytics', desc: 'Daily, weekly and monthly revenue, print volume, and paper page counts.' },
              { icon: '🧾', title: 'Activity log', desc: 'Timestamped audit trail of what happened to every order and print spool.' },
              { icon: '🛡️', title: 'Supabase cloud persistence', desc: 'Shop data and orders stay safe and auto-synchronized across sessions.' },
            ].map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-xl mb-4">
                  {f.icon}
                </div>
                <h4 className="text-base font-bold font-['Sora'] mb-1.5">{f.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
                <span className="inline-block mt-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400">
                  Available
                </span>
              </div>
            ))}
          </div>

          {/* Comparison Table: WhatsApp / Pen Drive vs printx */}
          <div className="mt-16 rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h4 className="text-lg font-bold font-['Sora']">WhatsApp / Pen Drive vs printx</h4>
              <p className="text-xs text-slate-400 mt-1">See why shops switch to printx counter automation.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-5">Scenario</th>
                    <th className="py-3 px-5 text-rose-400">WhatsApp / Pen Drive</th>
                    <th className="py-3 px-5 text-emerald-400 font-bold">printx Solution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  <tr>
                    <td className="py-3.5 px-5 font-bold">Receiving files</td>
                    <td className="py-3.5 px-5 text-slate-400">Share personal number, search through chats</td>
                    <td className="py-3.5 px-5 text-white font-semibold">Customer scans QR — your number stays private</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 font-bold">Your time & labor</td>
                    <td className="py-3.5 px-5 text-slate-400">Open WhatsApp Web, download file, open print dialog</td>
                    <td className="py-3.5 px-5 text-white font-semibold">Approved jobs print automatically without opening files</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 font-bold">Order tracking</td>
                    <td className="py-3.5 px-5 text-slate-400">Rely on memory of who paid and what they ordered</td>
                    <td className="py-3.5 px-5 text-white font-semibold">Every order has an ID, exact amount, and paid status</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 font-bold">Computer security</td>
                    <td className="py-3.5 px-5 text-slate-400">Customer pen drives can carry shortcuts & viruses</td>
                    <td className="py-3.5 px-5 text-white font-semibold">Cloud uploads only — nothing plugged into your PC</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 font-bold">Rush hours</td>
                    <td className="py-3.5 px-5 text-slate-400">One customer at a time causes long counter queues</td>
                    <td className="py-3.5 px-5 text-white font-semibold">Everyone uploads at once from their phones</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          5. FOR SHOPS (5-Minute Onboarding)
         ======================================================== */}
      <section id="for-shops" className="py-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-5">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-rose-400 mb-3">
            <span className="w-5 h-0.5 bg-grad rounded-full" />
            Quick Setup
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold font-['Sora'] tracking-tight">
            Set up your shop in <span className="text-grad">a few minutes</span>
          </h2>
          <p className="text-slate-400 text-base max-w-xl mt-3">
            If your printer already works from your Windows PC, it works with printx.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-12">
            {[
              { step: '1', title: 'Register shop', desc: 'Create your account and enter your WhatsApp number.' },
              { step: '2', title: 'Install agent', desc: 'Download printx Windows Desktop package from dashboard.' },
              { step: '3', title: '6-digit pairing', desc: 'Enter the 6-digit code shown in your dashboard to connect.' },
              { step: '4', title: 'Set your rates', desc: 'Configure your per-page Xerox & colour rates for A4 sheets.' },
              { step: '5', title: 'Put up QR', desc: 'Download and print the ready A4 poster for your counter.' },
            ].map((s) => (
              <div key={s.step} className="p-5 rounded-2xl border border-white/10 bg-white/[0.03] space-y-2">
                <span className="w-8 h-8 rounded-lg bg-grad flex items-center justify-center font-['Sora'] font-extrabold text-sm text-white">
                  {s.step}
                </span>
                <h4 className="text-sm font-bold font-['Sora'] text-slate-100">{s.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-8">
            <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
              <span className="text-2xl mb-2 block">💻</span>
              <h4 className="text-sm font-bold font-['Sora'] mb-1">A Windows PC</h4>
              <p className="text-xs text-slate-400">Windows 10 or 11 at the counter, running during shop hours.</p>
            </div>
            <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
              <span className="text-2xl mb-2 block">🖨️</span>
              <h4 className="text-sm font-bold font-['Sora'] mb-1">A working printer</h4>
              <p className="text-xs text-slate-400">Any inkjet or laser printer installed on that PC. Wi-Fi not required.</p>
            </div>
            <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
              <span className="text-2xl mb-2 block">🌐</span>
              <h4 className="text-sm font-bold font-['Sora'] mb-1">Standard Internet</h4>
              <p className="text-xs text-slate-400">Broadband or mobile hotspot. Jobs queue safely if connection drops.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          6. FAQ ACCORDION
         ======================================================== */}
      <section id="faq" className="py-24 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-5">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-rose-400 mb-3">
            <span className="w-5 h-0.5 bg-grad rounded-full" />
            Frequently Asked Questions
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold font-['Sora'] tracking-tight mb-8">
            Got questions? <span className="text-grad">We've got answers.</span>
          </h2>

          <div className="space-y-3">
            {[
              {
                q: 'Do customers need to install an app or register?',
                a: 'No. Customers scan your shop counter QR code with their phone camera and the upload page opens immediately in the mobile browser. There is no app to download and no account required.',
              },
              {
                q: 'How do customers pay?',
                a: 'Customers pay you directly at your shop counter in cash or through your own UPI QR code. You click "Confirm Payment" in your shop dashboard to release the print job to the spooler.',
              },
              {
                q: 'Which file formats are supported?',
                a: 'PDF, JPG, PNG and WebP can be uploaded directly on the website. For Word or Excel files, customers can simply tap Share -> Print -> Save as PDF on their phone before uploading.',
              },
              {
                q: 'Which printers work with printx?',
                a: 'Any printer already installed on your shop Windows PC (HP, Canon, Epson, Brother, TVS, etc.), USB or network. A Wi-Fi printer is not required because the Windows PC sends the job.',
              },
              {
                q: 'How does the Windows agent work?',
                a: 'The desktop agent runs quietly in your Windows system tray. You pair it once using a 6-digit code from your dashboard. It monitors approved jobs and sends them silently to your selected printer.',
              },
              {
                q: 'What happens to customer files?',
                a: 'All uploaded files are stored in private storage and are permanently deleted exactly 5 minutes after print completion. Order statistics and financial totals remain for your accounting.',
              },
              {
                q: 'What if the internet connection drops?',
                a: 'All orders stay safely queued in the cloud. As soon as your Windows PC reconnects to the internet, pending approved jobs resume printing automatically.',
              },
              {
                q: 'Can I route Colour and B&W to different printers?',
                a: 'Yes. In your Windows Agent tab, you can select one default printer for black-and-white Xerox and a separate inkjet/colour printer for colour documents.',
              },
            ].map((faq, idx) => (
              <div
                key={faq.q}
                className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden transition"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full text-left p-5 flex items-center justify-between gap-4 font-bold font-['Sora'] text-sm sm:text-base text-slate-100 cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <span className={`text-rose-400 text-lg transition-transform ${openFaq === idx ? 'rotate-45' : ''}`}>
                    +
                  </span>
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-slate-400 leading-relaxed border-t border-white/5 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================
          7. CONTACT SECTION (From user config.js)
         ======================================================== */}
      <section id="contact" className="py-24 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-5 text-center space-y-6">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-rose-400">
            <span className="w-5 h-0.5 bg-grad rounded-full" />
            Get In Touch
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold font-['Sora'] tracking-tight">
            Let's <span className="text-grad">talk</span>
          </h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Questions about setup, your shop, or the platform? Reach out through any channel below.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto text-left pt-4">
            <a
              href="https://github.com/Suryasingh072"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition flex items-center gap-3.5"
            >
              <span className="text-2xl">💻</span>
              <div>
                <h4 className="text-xs font-bold text-slate-200">GitHub</h4>
                <p className="text-[11px] text-slate-400">github.com/Suryasingh072</p>
              </div>
            </a>

            <a
              href="https://www.linkedin.com/in/surya-pratap-singh-b82a0b367/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition flex items-center gap-3.5"
            >
              <span className="text-2xl">🔗</span>
              <div>
                <h4 className="text-xs font-bold text-slate-200">LinkedIn</h4>
                <p className="text-[11px] text-slate-400">Surya Pratap Singh</p>
              </div>
            </a>
          </div>

          <p className="text-xs text-slate-500 pt-4">
            Already a shop owner?{' '}
            <button
              onClick={() => setShowLoginModal(true)}
              className="text-rose-400 hover:underline font-bold cursor-pointer"
            >
              Sign in to your dashboard
            </button>{' '}
            for order and printer support.
          </p>
        </div>
      </section>

      {/* ========================================================
          8. FOOTER
         ======================================================== */}
      <footer className="border-t border-white/10 py-16 bg-[#05070d]">
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">
            {/* Col 1: Brand */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center gap-2.5 font-['Sora'] font-extrabold text-xl text-white">
                <span className="w-8 h-8 rounded-xl bg-grad flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" className="w-4 h-4">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                </span>
                <span>printx</span>
              </div>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                QR-based self-service printing for cyber cafes, copy shops and CSC centres. Scan, upload, and auto-print.
              </p>
            </div>

            {/* Col 2: Product */}
            <div className="space-y-2 text-xs">
              <h5 className="font-['Sora'] font-bold text-slate-300 uppercase tracking-wider text-[11px] mb-3">Product</h5>
              <p><a href="#how-it-works" className="text-slate-400 hover:text-white transition">How it works</a></p>
              <p><a href="#features" className="text-slate-400 hover:text-white transition">Features</a></p>
              <p><a href="#for-shops" className="text-slate-400 hover:text-white transition">For shops</a></p>
              <p><a href="#faq" className="text-slate-400 hover:text-white transition">FAQ</a></p>
            </div>

            {/* Col 3: Legal */}
            <div className="space-y-2 text-xs">
              <h5 className="font-['Sora'] font-bold text-slate-300 uppercase tracking-wider text-[11px] mb-3">Legal</h5>
              <p><button onClick={() => setLegalModal('privacy')} className="text-slate-400 hover:text-white transition cursor-pointer">Privacy Policy</button></p>
              <p><button onClick={() => setLegalModal('terms')} className="text-slate-400 hover:text-white transition cursor-pointer">Terms of Use</button></p>
              <p><button onClick={() => setLegalModal('refund')} className="text-slate-400 hover:text-white transition cursor-pointer">Refund Policy</button></p>
            </div>

            {/* Col 4: Shop Access */}
            <div className="space-y-2 text-xs">
              <h5 className="font-['Sora'] font-bold text-slate-300 uppercase tracking-wider text-[11px] mb-3">Shop Access</h5>
              <p><button onClick={() => setShowLoginModal(true)} className="text-slate-400 hover:text-white transition cursor-pointer">Shop Sign In</button></p>
              <p><a href="#for-shops" className="text-slate-400 hover:text-white transition">Shop Benefits</a></p>
              <p><a href="#how-it-works" className="text-slate-400 hover:text-white transition">How it works</a></p>
              <p><a href="#contact" className="text-slate-400 hover:text-white transition">Contact</a></p>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
            <span>© 2026 printx. All rights reserved.</span>
            <span>Built in Lucknow, India</span>
          </div>
        </div>
      </footer>

      {/* ========================================================
          9. MODALS: LOGIN, REGISTER, FORGOT, LEGAL
         ======================================================== */}

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-white/15 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-white">
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <h3 className="text-xl font-bold font-['Sora']">Sign in to printx</h3>
              <p className="text-xs text-slate-400 mt-1">Access your print queue, rates, and Windows agent.</p>
            </div>

            {loginError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="e.g. shop@printx.com"
                  className="w-full py-2.5 px-3.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => { setShowLoginModal(false); setShowForgotModal(true); }}
                    className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                  >
                    Forgot?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full py-2.5 px-3.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 rounded-xl font-bold text-sm btn-grad transition cursor-pointer mt-2"
              >
                {loginLoading ? 'Signing in...' : 'Sign In to Dashboard'}
              </button>
            </form>

            <div className="mt-5 text-center text-xs text-slate-400">
              Need a new shop registered? <span className="text-pink-400 font-semibold">Managed exclusively by System Administrator.</span>
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-white/15 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-white">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold font-['Sora'] mb-1">Reset Password</h3>
            <p className="text-xs text-slate-400 mb-6">Enter your registered email to receive a recovery link.</p>

            {resetMsg && (
              <div className="mb-4 p-3 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs">
                {resetMsg}
              </div>
            )}

            {resetStep === 'request' ? (
              <form onSubmit={handleResetRequest} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="shop@example.com"
                    className="w-full py-2.5 px-3.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-3 rounded-xl font-bold text-sm btn-grad transition cursor-pointer"
                >
                  {resetLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetConfirm} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Reset Token</label>
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="w-full py-2.5 px-3.5 rounded-xl border border-white/15 bg-white/5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full py-2.5 px-3.5 rounded-xl border border-white/15 bg-white/5 text-sm text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-3 rounded-xl font-bold text-sm btn-grad transition cursor-pointer"
                >
                  {resetLoading ? 'Resetting...' : 'Save New Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Legal Policy Modal */}
      {legalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-white/15 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl relative text-white max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setLegalModal(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {legalModal === 'privacy' && (
              <div className="space-y-4 text-xs sm:text-sm text-slate-300">
                <h3 className="text-xl font-bold font-['Sora'] text-white">Privacy Policy</h3>
                <p className="text-[11px] text-slate-400">Last updated: October 2026</p>
                <h4 className="font-bold text-white text-sm">Customer Documents</h4>
                <p>Files you upload are stored privately and used solely to complete your print order.</p>
                <p>Shop staff open documents through short-lived signed links. All customer files are permanently erased approximately 5 minutes after print completion. Order statistics (number, pages, amount) remain for accounting.</p>
                <h4 className="font-bold text-white text-sm">Information Handled</h4>
                <p>Customers: Uploaded documents, copies, and optional name/phone on the order form.</p>
                <p>Shop owners: Shop name, email, WhatsApp number, and printer configurations.</p>
                <p>Windows Agent: Pairing token stored securely using Windows DPAPI protection.</p>
              </div>
            )}

            {legalModal === 'terms' && (
              <div className="space-y-4 text-xs sm:text-sm text-slate-300">
                <h3 className="text-xl font-bold font-['Sora'] text-white">Terms of Use</h3>
                <p className="text-[11px] text-slate-400">Last updated: October 2026</p>
                <h4 className="font-bold text-white text-sm">The Platform</h4>
                <p>printx is software that connects customers with local print shops. Each shop is an independent business responsible for paper, ink, printing quality, and payments.</p>
                <h4 className="font-bold text-white text-sm">Acceptable Use</h4>
                <p>Do not upload illegal, copyright-infringing, or harmful documents.</p>
              </div>
            )}

            {legalModal === 'refund' && (
              <div className="space-y-4 text-xs sm:text-sm text-slate-300">
                <h3 className="text-xl font-bold font-['Sora'] text-white">Refund Policy</h3>
                <p className="text-[11px] text-slate-400">Last updated: October 2026</p>
                <h4 className="font-bold text-white text-sm">Payments at the Counter</h4>
                <p>Customers pay the shop directly at the counter. Refunds or reprints for paper jams or printer defects are settled directly with the shopkeeper before leaving the counter.</p>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setLegalModal(null)}
                className="px-5 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
