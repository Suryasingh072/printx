import React, { useEffect } from 'react';
import {
  Printer,
  ShieldCheck,
  RefreshCw,
  FileText,
  Phone,
  Mail,
  MapPin,
  Clock,
  ArrowLeft,
  CheckCircle2,
  Lock,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

export type PolicyType = 'privacy' | 'refund' | 'terms' | 'contact';

interface PolicyPagesProps {
  initialPolicy?: PolicyType;
  onNavigateHome: () => void;
  onNavigatePolicy: (policy: PolicyType) => void;
}

export const PolicyPages: React.FC<PolicyPagesProps> = ({
  initialPolicy = 'privacy',
  onNavigateHome,
  onNavigatePolicy,
}) => {
  const [activeTab, setActiveTab] = React.useState<PolicyType>(initialPolicy);

  useEffect(() => {
    setActiveTab(initialPolicy);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [initialPolicy]);

  const handleTabChange = (tab: PolicyType) => {
    setActiveTab(tab);
    onNavigatePolicy(tab);
  };

  return (
    <div className="min-h-screen bg-[#070913] text-[#f1f5f9] flex flex-col font-sans selection:bg-pink-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#070913]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
          </button>
          <div className="h-4 w-px bg-white/15 hidden sm:block" />
          <div
            onClick={onNavigateHome}
            className="flex items-center gap-2 cursor-pointer font-['Sora'] font-black text-lg text-white tracking-tight"
          >
            <span className="w-7 h-7 rounded-lg bg-gradient-to-tr from-pink-500 via-rose-500 to-violet-600 flex items-center justify-center shadow-lg shadow-pink-500/25">
              <Printer className="w-4 h-4 text-white" />
            </span>
            <span>printx</span>
          </div>
        </div>

        {/* Tab Badges */}
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => handleTabChange('privacy')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'privacy'
                ? 'bg-pink-500 text-white shadow-md shadow-pink-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Privacy Policy
          </button>
          <button
            onClick={() => handleTabChange('refund')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'refund'
                ? 'bg-pink-500 text-white shadow-md shadow-pink-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Refund Policy
          </button>
          <button
            onClick={() => handleTabChange('terms')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'terms'
                ? 'bg-pink-500 text-white shadow-md shadow-pink-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Terms & Conditions
          </button>
          <button
            onClick={() => handleTabChange('contact')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'contact'
                ? 'bg-pink-500 text-white shadow-md shadow-pink-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Contact Us
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* ========================================================
            1. PRIVACY POLICY
           ======================================================== */}
        {activeTab === 'privacy' && (
          <article className="space-y-8 animate-fadeIn">
            <div className="border-b border-white/10 pb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-3">
                <ShieldCheck className="w-3.5 h-3.5" /> 5-Minute Zero-Retention Guarantee
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold font-['Sora'] text-white">Privacy Policy</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-2">
                Effective Date: October 24, 2026 | Last Updated: October 2026
              </p>
            </div>

            <section className="space-y-4 text-sm text-slate-300 leading-relaxed">
              <p>
                At <strong>printx</strong> ("we", "our", or "us"), operated under printx Cloud Printing Technologies,
                we treat the privacy and confidentiality of your documents with paramount importance. This Privacy Policy
                explains how information is collected, used, and safeguarded when customers upload documents for printing
                and when shopkeepers manage their print counters.
              </p>

              <h2 className="text-lg font-bold text-white font-['Sora'] pt-4 border-t border-white/10 flex items-center gap-2">
                <Lock className="w-4 h-4 text-pink-400" /> 1. Customer Document Privacy & Auto-Purge Engine
              </h2>
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <p className="font-semibold text-white">Our Core Privacy Commitment:</p>
                <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-300">
                  <li>
                    <strong>Strictly Ephemeral Storage:</strong> Customer files (PDFs, ID cards, photographs, certificates) are
                    temporarily stored solely to transmit and spool them to the authorized local shop printer.
                  </li>
                  <li>
                    <strong>Automated 5-Minute Deletion:</strong> Exactly five (5) minutes after your print job is completed
                    or released at the printer, our automated privacy engine permanently deletes physical document files from our servers.
                  </li>
                  <li>
                    <strong>Short-Lived Signed Tokens:</strong> Shop workstations can only download documents using time-limited,
                    cryptographically signed HMAC tokens that expire automatically.
                  </li>
                  <li>
                    <strong>No Content Mining:</strong> We do not index, read, OCR, train machine learning models, or sell your uploaded documents under any circumstances.
                  </li>
                </ul>
              </div>

              <h2 className="text-lg font-bold text-white font-['Sora'] pt-4 border-t border-white/10">
                2. Information We Collect
              </h2>
              <p>Depending on whether you are a printing customer or a shop owner, we collect:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Customer Orders:</strong> Uploaded document files, page count, paper preferences (color/BW, single/duplex),
                  optional customer name, optional phone number for order tracking, and transaction identifiers.
                </li>
                <li>
                  <strong>Shopkeeper Accounts:</strong> Business name, shop owner name, email address, WhatsApp contact number,
                  shop counter location/address, per-page rates, and paired Windows printing workstation details.
                </li>
                <li>
                  <strong>Payment Data:</strong> All online payments are handled securely through <strong>Razorpay</strong>.
                  We do not store complete credit/debit card numbers, CVVs, or UPI MPINs on our servers.
                </li>
              </ul>

              <h2 className="text-lg font-bold text-white font-['Sora'] pt-4 border-t border-white/10">
                3. Payment Gateway Security (Razorpay)
              </h2>
              <p>
                Online payments on printx are processed through Razorpay Payment Services Pvt. Ltd. Razorpay is certified
                under <strong>PCI-DSS Level 1</strong>, the highest global security standard for online financial transactions.
                Your payment credentials (UPI handles, card details, net banking credentials) are encrypted end-to-end
                directly between your device and Razorpay's banking network.
              </p>

              <h2 className="text-lg font-bold text-white font-['Sora'] pt-4 border-t border-white/10">
                4. Data Retention & Accounting Logs
              </h2>
              <p>
                While document files are permanently purged after 5 minutes, non-personal audit logs (such as Order Number,
                timestamp, total page count, and amount paid) are retained securely to help shopkeepers manage counter accounts
                and resolve customer inquiries.
              </p>

              <h2 className="text-lg font-bold text-white font-['Sora'] pt-4 border-t border-white/10">
                5. Contacting the Grievance Officer
              </h2>
              <p>
                In accordance with the Information Technology Act 2000 and rules made thereunder, any queries regarding this
                privacy policy can be directed to our Grievance Officer at <a href="mailto:privacy@printx.in" className="text-pink-400 underline">privacy@printx.in</a>.
              </p>
            </section>
          </article>
        )}

        {/* ========================================================
            2. REFUND AND CANCELLATION POLICY
           ======================================================== */}
        {activeTab === 'refund' && (
          <article className="space-y-8 animate-fadeIn">
            <div className="border-b border-white/10 pb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-3">
                <RefreshCw className="w-3.5 h-3.5" /> Fair & Transparent Refunds
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold font-['Sora'] text-white">Refund & Cancellation Policy</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-2">
                Effective Date: October 24, 2026 | Last Updated: October 2026
              </p>
            </div>

            <section className="space-y-4 text-sm text-slate-300 leading-relaxed">
              <p>
                At <strong>printx</strong>, we strive to ensure that every print job is produced smoothly and to your satisfaction.
                Since printing involves physical paper, toner, and hardware machinery operated at independent local shops, this
                policy outlines how cancellations and refunds are handled.
              </p>

              <h2 className="text-lg font-bold text-white font-['Sora'] pt-4 border-t border-white/10">
                1. Order Cancellation Window
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Before Print Spooling:</strong> If you place an order and need to cancel before the shopkeeper has
                  spooled it to the printer (order status is "Pending" or "Queued"), you may request cancellation directly
                  at the counter or via support.
                </li>
                <li>
                  <strong>After Spooling / Printing Begun:</strong> Once physical printing has begun on the shop hardware,
                  cancellations cannot be processed as paper and ink resources have already been consumed.
                </li>
              </ul>

              <h2 className="text-lg font-bold text-white font-['Sora'] pt-4 border-t border-white/10">
                2. Eligibility for Refunds
              </h2>
              <p>You are eligible for a full refund or an immediate free reprint in any of the following circumstances:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                  <p className="font-bold text-white text-xs mb-1">🖨️ Hardware / Technical Failure</p>
                  <p className="text-xs text-slate-400">
                    Printer paper jams, power outages, ink streak defects, or hardware faults preventing document output.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                  <p className="font-bold text-white text-xs mb-1">💳 Double Payment / Deduction</p>
                  <p className="text-xs text-slate-400">
                    If an online transaction was deducted more than once for the same Order Number via Razorpay.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                  <p className="font-bold text-white text-xs mb-1">📄 Server Transmission Error</p>
                  <p className="text-xs text-slate-400">
                    If the shop's computer failed to download your file due to network or server communication errors.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                  <p className="font-bold text-white text-xs mb-1">🏪 Shop Closure</p>
                  <p className="text-xs text-slate-400">
                    If payment was completed online but the shop workstation was offline or closed for business.
                  </p>
                </div>
              </div>

              <h2 className="text-lg font-bold text-white font-['Sora'] pt-4 border-t border-white/10">
                3. Refund Process & Settlement Timelines
              </h2>
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <p className="font-semibold text-white">How and When You Receive Your Money:</p>
                <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-300">
                  <li>
                    <strong>Immediate Counter Reprint (Fastest):</strong> For physical paper jams or minor ink streaks,
                    the shopkeeper will reprint your document immediately at zero extra charge.
                  </li>
                  <li>
                    <strong>Online Payment Refunds via Razorpay:</strong> When a monetary refund is approved, it is reversed
                    directly to your original payment method (Bank Account, UPI ID, or Card) through Razorpay.
                  </li>
                  <li>
                    <strong>Timeline:</strong> Razorpay refunds are initiated within <strong>24 to 48 hours</strong>. It typically
                    takes <strong>5 to 7 business days</strong> for the amount to reflect in your bank account, depending on your bank's NEFT/IMPS clearing cycle.
                  </li>
                </ul>
              </div>

              <h2 className="text-lg font-bold text-white font-['Sora'] pt-4 border-t border-white/10">
                4. How to Request a Refund
              </h2>
              <p>
                To request an online refund, please send your <strong>Order Number</strong> (e.g. ORD-123456), transaction reference,
                and brief reason to <a href="mailto:refunds@printx.in" className="text-pink-400 underline">refunds@printx.in</a> or
                contact us on WhatsApp at <strong>+91 91206 58739</strong>.
              </p>
            </section>
          </article>
        )}

        {/* ========================================================
            3. TERMS AND CONDITIONS
           ======================================================== */}
        {activeTab === 'terms' && (
          <article className="space-y-8 animate-fadeIn">
            <div className="border-b border-white/10 pb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-bold mb-3">
                <FileText className="w-3.5 h-3.5" /> User Agreement
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold font-['Sora'] text-white">Terms & Conditions</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-2">
                Effective Date: October 24, 2026 | Last Updated: October 2026
              </p>
            </div>

            <section className="space-y-4 text-sm text-slate-300 leading-relaxed">
              <p>
                Welcome to <strong>printx</strong>. By accessing our website, scanning a printx shop QR standee,
                or using our self-service printing software, you agree to comply with and be bound by the following Terms and Conditions.
              </p>

              <h2 className="text-lg font-bold text-white font-['Sora'] pt-4 border-t border-white/10">
                1. Nature of the Service
              </h2>
              <p>
                printx operates a software-as-a-service platform facilitating contactless file transfers, queue management,
                and automatic desktop spooling for independent print centers, stationery stores, cyber cafes, and copy shops.
                Each shop partner is an independent merchant responsible for their own hardware, paper quality, physical operations, and pricing.
              </p>

              <h2 className="text-lg font-bold text-white font-['Sora'] pt-4 border-t border-white/10">
                2. Acceptable Use & Prohibited Documents
              </h2>
              <p>You agree not to upload, store, or submit for printing any content that:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-300">
                <li>Violates copyright, trademark, or intellectual property rights of third parties without authorization.</li>
                <li>Contains counterfeit currency, fraudulent government seals, or forged identification credentials.</li>
                <li>Contains defamatory, obscene, pornographic, or unlawful material under the laws of India.</li>
                <li>Threatens national security or public order.</li>
              </ul>
              <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
                ⚠️ Shopkeepers and system administrators reserve the right to decline print requests that violate applicable legal regulations.
              </p>

              <h2 className="text-lg font-bold text-white font-['Sora'] pt-4 border-t border-white/10">
                3. Per-Page Pricing & Payment Obligations
              </h2>
              <p>
                Per-page printing rates (Black & White vs. Color, Single vs. Duplex) are set authoritatively by each shop owner.
                The total amount calculated before order submission is binding. Customers must complete payment via our integrated
                Razorpay gateway or in cash/UPI at the counter as permitted by the shop's counter rules.
              </p>

              <h2 className="text-lg font-bold text-white font-['Sora'] pt-4 border-t border-white/10">
                4. Limitation of Liability
              </h2>
              <p>
                To the maximum extent permitted by applicable Indian law, printx and its operators shall not be liable for
                indirect, incidental, or consequential damages resulting from hardware malfunctions at local shops, power cuts,
                delays, or user errors in document formatting. In all cases, maximum aggregate liability is limited to the amount paid for the specific print order.
              </p>

              <h2 className="text-lg font-bold text-white font-['Sora'] pt-4 border-t border-white/10">
                5. Governing Law and Jurisdiction
              </h2>
              <p>
                These terms shall be governed by and construed in accordance with the laws of the Republic of India.
                Any disputes arising under or in connection with these terms shall be subject to the exclusive jurisdiction of the competent courts in Lucknow, Uttar Pradesh, India.
              </p>
            </section>
          </article>
        )}

        {/* ========================================================
            4. CONTACT US
           ======================================================== */}
        {activeTab === 'contact' && (
          <article className="space-y-8 animate-fadeIn">
            <div className="border-b border-white/10 pb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-bold mb-3">
                <Phone className="w-3.5 h-3.5" /> Fast Counter & Technical Support
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold font-['Sora'] text-white">Contact Us</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-2">
                Have questions about an order, payment, or shop onboarding? We are here to help.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Contact Card 1 */}
              <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                <div className="w-10 h-10 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base font-['Sora']">Email Support</h3>
                  <p className="text-xs text-slate-400 mt-1">Official customer & merchant inquiries</p>
                </div>
                <div className="space-y-1.5 text-xs text-slate-300">
                  <p>Customer Support: <a href="mailto:support@printx.in" className="text-pink-400 font-medium hover:underline">support@printx.in</a></p>
                  <p>Billing & Refunds: <a href="mailto:refunds@printx.in" className="text-pink-400 font-medium hover:underline">refunds@printx.in</a></p>
                  <p>Shop Partnership: <a href="mailto:partners@printx.in" className="text-pink-400 font-medium hover:underline">partners@printx.in</a></p>
                </div>
              </div>

              {/* Contact Card 2 */}
              <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base font-['Sora']">WhatsApp & Phone Support</h3>
                  <p className="text-xs text-slate-400 mt-1">Direct support for shopkeepers and customers</p>
                </div>
                <div className="space-y-1.5 text-xs text-slate-300">
                  <p>Helpline: <span className="font-mono text-white font-bold">+91 91206 58739</span></p>
                  <p>WhatsApp: <span className="font-mono text-emerald-400 font-bold">+91 91206 58739</span></p>
                  <p className="text-slate-400">Monday to Saturday: 9:00 AM – 8:00 PM IST</p>
                </div>
              </div>

              {/* Contact Card 3: Registered Office */}
              <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4 md:col-span-2">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-white text-base font-['Sora']">Registered Operating Office</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong>printx Technologies Pvt. Ltd.</strong><br />
                      BBD University Campus Road, Faizabad Road,<br />
                      Lucknow, Uttar Pradesh 226028, India
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                      <Clock className="w-3.5 h-3.5 text-pink-400" /> Response Time: Within 2 to 4 business hours
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Feedback Notice */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-pink-500/10 via-violet-500/10 to-transparent border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="font-bold text-white text-sm font-['Sora']">Are you a Print Shop Owner?</p>
                <p className="text-xs text-slate-400 mt-0.5">Automate your counter queue with instant QR codes and desktop auto-printing.</p>
              </div>
              <button
                onClick={onNavigateHome}
                className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs shadow-lg shadow-pink-500/25 transition cursor-pointer whitespace-nowrap"
              >
                Sign In to Shop Dashboard →
              </button>
            </div>
          </article>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 bg-[#04060c] text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© 2026 printx Technologies. All rights reserved.</span>
          <div className="flex items-center gap-4 text-slate-400">
            <button onClick={() => handleTabChange('privacy')} className="hover:text-white transition cursor-pointer">Privacy</button>
            <button onClick={() => handleTabChange('refund')} className="hover:text-white transition cursor-pointer">Refunds</button>
            <button onClick={() => handleTabChange('terms')} className="hover:text-white transition cursor-pointer">Terms</button>
            <button onClick={() => handleTabChange('contact')} className="hover:text-white transition cursor-pointer">Contact</button>
          </div>
        </div>
      </footer>
    </div>
  );
};
