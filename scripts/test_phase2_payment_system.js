require("dotenv").config();
const { db } = require("../src/api/v1/database");
const { runWithContext } = require("../src/api/v1/helpers/requestContext");
const {
    createVendorBill,
    fetchAllVendorBills,
    fetchVendorBillById,
    updateVendorBill,
    deleteVendorBill,
    fetchUnpaidVendorBillsByParty
} = require("../src/api/v1/models/vendorBill.model");
const {
    createVendorPaymentTransaction,
    applyCustomerAdvanceTransaction,
    fetchAvailableAdvancesByParty,
    cancelPaymentTransaction,
    fetchAllVendorPayments,
    fetchPaymentById,
    createReceiptTransaction
} = require("../src/api/v1/models/payment.model");
const { deletePartyMaster } = require("../src/api/v1/models/parties.model");

const runTests = async () => {
    console.log("==================================================");
    console.log("   PHASE 2 PAYMENT SYSTEM VERIFICATION SUITE       ");
    console.log("==================================================");

    // Pick firm and party
    const firm = await db("firms").where({ id: 1 }).first() || await db("firms").first();
    const firmId = firm.id;
    const userId = 1;

    console.log(`Using Firm: ID ${firmId} (${firm.firm_name})`);

    // Find or create a test vendor
    let testVendor = await db("parties").where({ firm_id: firmId, is_active: true }).first();
    if (!testVendor) {
        throw new Error("No active party found for firm.");
    }
    console.log(`Using Test Party/Vendor: ID ${testVendor.id} (${testVendor.legal_name})`);

    const paymentMode = await db("payment_modes").where({ code: 'NEFT' }).first() || await db("payment_modes").first();

    await runWithContext({ firmId, userId }, async () => {
        let testBillId = null;
        let testPayment1Id = null;
        let testPayment2Id = null;
        let testReceiptId = null;
        let testInvoice1Id = null;
        let testInvoice2Id = null;

        try {
            // -------------------------------------------------------------
            // TEST 1: Create Vendor Bill (Summary Mode + Balance calculation)
            // -------------------------------------------------------------
            console.log("\n[TEST 1] Creating Vendor Bill (₹1,00,000)...");
            const billNo = `TEST-BILL-${Date.now().toString().slice(-6)}`;
            const billData = {
                partyId: testVendor.id,
                billNo,
                billDate: "2026-09-09",
                dueDays: 30,
                taxableAmount: 84745.76,
                cgst: 7627.12,
                sgst: 7627.12,
                igst: 0,
                otherCharges: 0,
                roundOff: 0,
                total: 100000.00,
                notes: "Raw materials purchase for project Alpha"
            };

            const createdBill = await createVendorBill(billData);
            testBillId = createdBill.id;
            console.log(`✓ Bill #${createdBill.bill_no} created successfully with ID: ${testBillId}`);
            console.log(`  Total: ₹${createdBill.total}, Paid: ₹${createdBill.paid_amount}, Balance: ₹${createdBill.balance_amount}`);

            if (Number(createdBill.total) !== 100000 || Number(createdBill.balance_amount) !== 100000 || Number(createdBill.paid_amount) !== 0) {
                throw new Error("Initial bill balances do not match expected ₹1,00,000.");
            }

            // -------------------------------------------------------------
            // TEST 2: Duplicate Bill Prevention on Same Vendor
            // -------------------------------------------------------------
            console.log("\n[TEST 2] Testing Duplicate Bill Number Prevention...");
            try {
                await createVendorBill(billData);
                throw new Error("Duplicate bill should have been rejected!");
            } catch (err) {
                if (err.statusCode === 409) {
                    console.log(`✓ Duplicate bill rejected with 409 Conflict: "${err.message}"`);
                } else {
                    throw err;
                }
            }

            // -------------------------------------------------------------
            // TEST 3: Partial Outward Payment (Installment 1: ₹30,000)
            // -------------------------------------------------------------
            console.log("\n[TEST 3] Making Partial Payment of ₹30,000 on Bill (Total: ₹1,00,000)...");
            const payment1 = await createVendorPaymentTransaction({
                paymentDate: "2026-09-09",
                partyId: testVendor.id,
                totalAmount: 30000,
                paymentModeId: paymentMode.id,
                referenceNo: "UTR-TEST-30K-001",
                bankName: "HDFC Bank",
                notes: "Part payment installment 1",
                allocations: [
                    {
                        vendorBillId: testBillId,
                        allocatedAmount: 30000,
                        tdsAmount: 0,
                        writeOffAmount: 0
                    }
                ]
            });
            testPayment1Id = payment1.id;
            console.log(`✓ Payment Voucher generated: ${payment1.payment_no} (ID: ${testPayment1Id})`);

            // Verify updated bill state
            const billAfterPart1 = await fetchVendorBillById(testBillId);
            console.log(`  Updated Bill #${billAfterPart1.billNo} State:`);
            console.log(`  Paid: ₹${billAfterPart1.paidAmount}, Balance Due: ₹${billAfterPart1.balanceAmount}, Status: ${billAfterPart1.paymentStatusCode}`);

            if (Number(billAfterPart1.paidAmount) !== 30000 || Number(billAfterPart1.balanceAmount) !== 70000 || billAfterPart1.paymentStatusCode !== 'PARTIAL') {
                throw new Error(`Expected Paid: 30000, Balance: 70000, Status: PARTIAL. Got Paid: ${billAfterPart1.paidAmount}, Balance: ${billAfterPart1.balanceAmount}, Status: ${billAfterPart1.paymentStatusCode}`);
            }

            // -------------------------------------------------------------
            // TEST 4: Protective Check: Prevent Deleting or Editing Paid Bill
            // -------------------------------------------------------------
            console.log("\n[TEST 4] Testing Deletion & Edit Guards on Partially Paid Bill...");
            try {
                await deleteVendorBill(testBillId);
                throw new Error("Partially paid bill should NOT be deletable!");
            } catch (err) {
                if (err.statusCode === 422) {
                    console.log(`✓ Delete guard caught correctly: "${err.message}"`);
                } else {
                    throw err;
                }
            }

            try {
                await updateVendorBill(testBillId, { total: 20000 });
                throw new Error("Bill monetary amount should NOT be editable while payments exist!");
            } catch (err) {
                if (err.statusCode === 422) {
                    console.log(`✓ Monetary edit guard caught correctly: "${err.message}"`);
                } else {
                    throw err;
                }
            }

            // -------------------------------------------------------------
            // TEST 5: Second Partial Payment (Installment 2: ₹70,000 -> Clears Bill)
            // -------------------------------------------------------------
            console.log("\n[TEST 5] Making 2nd Payment of remaining ₹70,000...");
            const payment2 = await createVendorPaymentTransaction({
                paymentDate: "2026-09-09",
                partyId: testVendor.id,
                totalAmount: 70000,
                paymentModeId: paymentMode.id,
                referenceNo: "UTR-TEST-70K-002",
                bankName: "HDFC Bank",
                notes: "Final clearance installment 2",
                allocations: [
                    {
                        vendorBillId: testBillId,
                        allocatedAmount: 70000,
                        tdsAmount: 0,
                        writeOffAmount: 0
                    }
                ]
            });
            testPayment2Id = payment2.id;
            console.log(`✓ Payment Voucher generated: ${payment2.payment_no} (ID: ${testPayment2Id})`);

            const billAfterPart2 = await fetchVendorBillById(testBillId);
            console.log(`  Updated Bill State: Paid: ₹${billAfterPart2.paidAmount}, Balance: ₹${billAfterPart2.balanceAmount}, Status: ${billAfterPart2.paymentStatusCode}`);

            if (Number(billAfterPart2.paidAmount) !== 100000 || Number(billAfterPart2.balanceAmount) !== 0 || billAfterPart2.paymentStatusCode !== 'PAID') {
                throw new Error(`Expected Paid: 100000, Balance: 0, Status: PAID. Got Paid: ${billAfterPart2.paidAmount}, Balance: ${billAfterPart2.balanceAmount}, Status: ${billAfterPart2.paymentStatusCode}`);
            }

            // -------------------------------------------------------------
            // TEST 6: Payment Cancellation & Reversion
            // -------------------------------------------------------------
            console.log("\n[TEST 6] Cancelling Payment Voucher 2 (₹70,000)...");
            const cancelRes2 = await cancelPaymentTransaction(testPayment2Id);
            console.log(`✓ Cancelled payment voucher ${cancelRes2.paymentNo}`);

            const billAfterCancel2 = await fetchVendorBillById(testBillId);
            console.log(`  Bill State after cancelling 2nd payment: Paid: ₹${billAfterCancel2.paidAmount}, Balance: ₹${billAfterCancel2.balanceAmount}, Status: ${billAfterCancel2.paymentStatusCode}`);

            if (Number(billAfterCancel2.paidAmount) !== 30000 || Number(billAfterCancel2.balanceAmount) !== 70000 || billAfterCancel2.paymentStatusCode !== 'PARTIAL') {
                throw new Error(`Bill failed to revert to ₹70,000 PARTIAL balance!`);
            }

            console.log("\nCancelling Payment Voucher 1 (₹30,000)...");
            const cancelRes1 = await cancelPaymentTransaction(testPayment1Id);
            console.log(`✓ Cancelled payment voucher ${cancelRes1.paymentNo}`);

            const billAfterCancel1 = await fetchVendorBillById(testBillId);
            console.log(`  Bill State after cancelling 1st payment: Paid: ₹${billAfterCancel1.paidAmount}, Balance: ₹${billAfterCancel1.balanceAmount}, Status: ${billAfterCancel1.paymentStatusCode}`);

            if (Number(billAfterCancel1.paidAmount) !== 0 || Number(billAfterCancel1.balanceAmount) !== 100000 || billAfterCancel1.paymentStatusCode !== 'PENDING') {
                throw new Error(`Bill failed to revert to ₹1,00,000 PENDING balance!`);
            }

            // -------------------------------------------------------------
            // TEST 7: Customer Advance Adjustment / Knock-Off Engine
            // -------------------------------------------------------------
            console.log("\n[TEST 7] Testing Customer Advance Adjustment Flow...");
            const { getPaymentStatusIds } = require("../src/api/v1/models/payment.model");
            const statusMap = await getPaymentStatusIds();

            // Create test invoice 1 (₹30,000)
            const [inv1] = await db("invoices").insert({
                firm_id: firmId,
                party_id: testVendor.id,
                customer_name: testVendor.legal_name,
                invoice_no: `INV-ADV-TEST-${Date.now().toString().slice(-4)}-1`,
                invoice_date: "2026-09-09",
                total: 30000,
                paid_amount: 0,
                balance_amount: 30000,
                payment_status_id: statusMap['PENDING'],
                payment_mode_id: paymentMode.id,
                status: "FINAL"
            }).returning("*");
            testInvoice1Id = inv1.id;

            // Create customer receipt of ₹50,000, settling ₹30,000 on Invoice 1, leaving ₹20,000 advance
            const receipt = await createReceiptTransaction({
                paymentDate: "2026-09-09",
                partyId: testVendor.id,
                totalAmount: 50000,
                paymentModeId: paymentMode.id,
                referenceNo: "CHQ-ADV-50K",
                bankName: "SBI",
                notes: "Receipt with advance balance",
                allocations: [
                    {
                        invoiceId: testInvoice1Id,
                        allocatedAmount: 30000,
                        tdsAmount: 0,
                        writeOffAmount: 0
                    }
                ]
            });
            testReceiptId = receipt.id;
            console.log(`✓ Receipt ${receipt.payment_no} created: Total ₹50,000, Allocated ₹30,000, Unallocated Advance ₹${receipt.unallocated_amount}`);

            if (Number(receipt.unallocated_amount) !== 20000) {
                throw new Error(`Expected unallocated advance ₹20,000, got ₹${receipt.unallocated_amount}`);
            }

            // Verify available advances API
            const advances = await fetchAvailableAdvancesByParty(testVendor.id, 'INWARD');
            console.log(`✓ Available advances for party: found ${advances.length} advance receipt(s).`);

            // Now create test invoice 2 (₹20,000)
            const [inv2] = await db("invoices").insert({
                firm_id: firmId,
                party_id: testVendor.id,
                customer_name: testVendor.legal_name,
                invoice_no: `INV-ADV-TEST-${Date.now().toString().slice(-4)}-2`,
                invoice_date: "2026-09-09",
                total: 20000,
                paid_amount: 0,
                balance_amount: 20000,
                payment_status_id: statusMap['PENDING'],
                payment_mode_id: paymentMode.id,
                status: "FINAL"
            }).returning("*");
            testInvoice2Id = inv2.id;
            console.log(`✓ Created new invoice #${inv2.invoice_no} for ₹20,000`);

            // Apply ₹20,000 advance from receipt to invoice 2
            console.log("Applying ₹20,000 customer advance to new Invoice 2...");
            const advanceAdjustResult = await applyCustomerAdvanceTransaction({
                paymentId: testReceiptId,
                allocations: [
                    {
                        invoiceId: testInvoice2Id,
                        allocatedAmount: 20000,
                        tdsAmount: 0,
                        writeOffAmount: 0
                    }
                ]
            });
            console.log(`✓ Advance Applied: Applied ₹${advanceAdjustResult.appliedAmount}, Remaining Advance ₹${advanceAdjustResult.remainingAdvance}`);

            // Verify invoice 2 is now fully PAID
            const inv2Updated = await db("invoices").where({ id: testInvoice2Id }).first();
            console.log(`✓ Invoice 2 status: paid ₹${inv2Updated.paid_amount}, balance ₹${inv2Updated.balance_amount}, statusId: ${inv2Updated.payment_status_id}`);

            if (Number(inv2Updated.balance_amount) !== 0 || Number(inv2Updated.paid_amount) !== 20000) {
                throw new Error("Advance knock-off failed to clear invoice 2 balance!");
            }

            // -------------------------------------------------------------
            // TEST 8: Party Deletion Guard
            // -------------------------------------------------------------
            console.log("\n[TEST 8] Testing Party Deletion Guard against Active Bills/Payments...");
            try {
                await deletePartyMaster(testVendor.id);
                throw new Error("Party with active bills/payments should NOT be deletable!");
            } catch (err) {
                if (err.statusCode === 422) {
                    console.log(`✓ Party deletion guard caught correctly: "${err.message}"`);
                } else {
                    throw err;
                }
            }

            console.log("\n==================================================");
            console.log("   ALL 8 VERIFICATION TESTS PASSED SUCCESSFULLY!  ");
            console.log("==================================================");

        } finally {
            // Cleanup test data
            console.log("\nCleaning up test records...");
            if (testReceiptId) {
                await db("payment_allocations").where({ payment_id: testReceiptId }).del();
                await db("payments").where({ id: testReceiptId }).del();
            }
            if (testPayment1Id) {
                await db("payment_allocations").where({ payment_id: testPayment1Id }).del();
                await db("payments").where({ id: testPayment1Id }).del();
            }
            if (testPayment2Id) {
                await db("payment_allocations").where({ payment_id: testPayment2Id }).del();
                await db("payments").where({ id: testPayment2Id }).del();
            }
            if (testInvoice1Id) {
                await db("invoices").where({ id: testInvoice1Id }).del();
            }
            if (testInvoice2Id) {
                await db("invoices").where({ id: testInvoice2Id }).del();
            }
            if (testBillId) {
                await db("payment_allocations").where({ vendor_bill_id: testBillId }).del();
                await db("vendor_bills").where({ id: testBillId }).del();
            }
            console.log("Cleanup completed.");
        }
    });

    process.exit(0);
};

runTests().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
