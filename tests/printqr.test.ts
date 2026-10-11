import assert from 'node:assert';
import { calculateOrderPrice } from '../src/server/services/pricing.js';
import { storageService } from '../src/server/services/storage.js';
import { whatsAppService } from '../src/server/services/whatsapp.js';
import { db } from '../src/server/db/database.js';

console.log('🧪 Starting PrintQR Critical Workflows Test Suite...\n');

// 1. Pricing Engine Tests
console.log('--- Test 1: Authoritative Price Calculation ---');
const samplePricing = {
  id: 'test-prc-1',
  shopId: 'shp-1',
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

// 10 pages B&W single, 2 copies: 10 * 2 * 2.00 = 40.00
const price1 = calculateOrderPrice(samplePricing, {
  pageCount: 10,
  copies: 2,
  colorMode: 'bw',
  duplexMode: 'single',
  paperSize: 'A4',
  orderType: 'document',
});
assert.strictEqual(price1.totalAmount, 40.00, 'B&W single price mismatch');
assert.strictEqual(price1.unitPrice, 2.00);
console.log('✓ B&W Single price calculation passed (₹40.00)');

// 10 pages B&W duplex (rate = 3.00 / 2 = 1.50 per page): 10 * 1 * 1.50 = 15.00
const price2 = calculateOrderPrice(samplePricing, {
  pageCount: 10,
  copies: 1,
  colorMode: 'bw',
  duplexMode: 'duplex',
  paperSize: 'A4',
  orderType: 'document',
});
assert.strictEqual(price2.totalAmount, 15.00, 'B&W duplex price mismatch');
console.log('✓ B&W Duplex discounted price passed (₹15.00)');

// ID Card Sheet: 3 copies at 15.00 = 45.00
const price3 = calculateOrderPrice(samplePricing, {
  pageCount: 1,
  copies: 3,
  colorMode: 'color',
  duplexMode: 'single',
  paperSize: 'A4',
  orderType: 'id_card',
});
assert.strictEqual(price3.totalAmount, 45.00, 'ID Card calculation mismatch');
console.log('✓ ID Card sheet rate calculation passed (₹45.00)');

// 2. Storage & Expiring Signed Token Tests
console.log('\n--- Test 2: Document Security & Expiring Signed Tokens ---');
const validationOk = storageService.validateFile('thesis.pdf', 'application/pdf', 1024 * 1024);
assert.strictEqual(validationOk.valid, true);

const validationReject = storageService.validateFile('virus.exe', 'application/x-msdownload', 1024);
assert.strictEqual(validationReject.valid, false);
console.log('✓ File type validation accurately rejects unsupported/dangerous extensions');

const { token } = storageService.generateSignedToken('test-order-99', 15);
assert.strictEqual(storageService.verifySignedToken(token, 'test-order-99'), true, 'Valid token failed verification');
assert.strictEqual(storageService.verifySignedToken(token, 'tampered-order-88'), false, 'Tampered token was accepted');
console.log('✓ HMAC-signed expiring tokens verified and tamper-proof');

// 3. WhatsApp OTP Service Tests
console.log('\n--- Test 3: WhatsApp OTP Verification Flow ---');
const generatedOtp = whatsAppService.generateOtp();
assert.strictEqual(generatedOtp.length, 6);
assert.strictEqual(/^\d{6}$/.test(generatedOtp), true);
console.log(`✓ 6-Digit WhatsApp OTP generation format verified: [${generatedOtp}]`);

// 4. Windows Agent Atomic Job Claim & Spooler Transition
console.log('\n--- Test 4: Atomic Job Claim & Spooler Prevention of Duplicate Dispatch ---');
const testOrder = db.createOrder({
  shopId: 'shp-apex-001',
  customerName: 'Test Customer',
  customerPhone: '+919999988888',
  documentName: 'TestDoc.pdf',
  documentType: 'application/pdf',
  filePath: 'sample_test.pdf',
  fileSizeBytes: 50000,
  pageCount: 1,
  copies: 1,
  colorMode: 'bw',
  duplexMode: 'single',
  paperSize: 'A4',
  orderType: 'document',
  unitPrice: 2.0,
  totalAmount: 2.0,
  status: 'queued',
  paymentStatus: 'collected',
});

const printJob = db.createPrintJob(testOrder.id, 'shp-apex-001', 'HP LaserJet Pro M404dn');
assert.strictEqual(printJob.status, 'pending');

// Claim 1: Should succeed
const claimResult1 = db.claimPrintJob(printJob.id, 'agt-apex-001');
assert.strictEqual(claimResult1.success, true);
assert.ok(claimResult1.claimToken);

// Claim 2: Duplicate claim attempt should fail
const claimResult2 = db.claimPrintJob(printJob.id, 'another-agent-002');
assert.strictEqual(claimResult2.success, false, 'Duplicate claim was not prevented!');
console.log('✓ Atomic claim lock successfully prevented duplicate Windows spooler print dispatch');

// Report status printed
const reportOk = db.reportPrintJobStatus(printJob.id, claimResult1.claimToken!, 'printed');
assert.strictEqual(reportOk, true);
const updatedOrder = db.getOrderById(testOrder.id);
assert.strictEqual(updatedOrder?.status, 'completed');
console.log('✓ Spooler completion confirmed and order updated to completed');

console.log('\n===========================================');
console.log('🎉 ALL INTEGRATION AND UNIT TESTS PASSED!');
console.log('===========================================\n');
