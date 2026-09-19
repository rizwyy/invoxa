import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { LocalRepository } from "../backend/adapters/local";
import { LocalFiles } from "../backend/adapters/local-files";
import { LocalAuth } from "../backend/local-auth";
import { InvoiceService } from "../backend/service";
import { Conflict } from "../backend/repository";
import { validateFile } from "../backend/files";
import { findPossibleDuplicate, normalizeExpense } from "../backend/extraction";
import { runReminders } from "../backend/reminders";
import {
  csv,
  emptyFields,
  invoiceStatus,
  reminderInvoices,
  summary,
  toPaise,
  fieldsSchema,
  normalizeRoutePath,
  type Invoice,
} from "../shared/domain";
const alice = { id: "alice", email: "alice@example.test" };
const bob = { id: "bob", email: "bob@example.test" };
async function fixture(t: any) {
  const dir = await mkdtemp(join(tmpdir(), "invoxa-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const repo = new LocalRepository(dir);
  const files = new LocalFiles(dir);
  return { repo, files, service: new InvoiceService(repo, files), dir };
}
async function pdf() {
  const doc = await PDFDocument.create();
  doc.addPage().drawText("Sample invoice: total INR 118.00");
  return doc.save();
}
async function uploaded(service: InvoiceService, files: LocalFiles) {
  await service.createWorkspace(alice, { name: "Alice business" });
  const bytes = await pdf();
  const result = await service.reserve(alice, {
    name: "bill.pdf",
    type: "application/pdf",
    size: bytes.length,
  });
  await files.write(result.invoice.file!.key, bytes);
  return service.complete(alice, result.invoice.id);
}
function fields() {
  return {
    vendor: "Supplier",
    number: "INV-1",
    date: "2026-09-01",
    due: "2026-09-12",
    subtotal: 10000,
    tax: 1800,
    total: 11800,
    currency: "INR",
    payment: "unpaid",
    notes: "",
    acknowledged: true,
  };
}
function invoice(patch: Partial<Invoice> = {}): Invoice {
  return {
    ...emptyFields(),
    id: "i",
    workspaceId: "w",
    version: 1,
    reviewed: true,
    archived: false,
    processing: "confirmed",
    createdAt: "",
    updatedAt: "",
    paidAt: null,
    total: 11800,
    tax: 1800,
    date: "2026-09-01",
    due: "2026-09-12",
    ...patch,
  };
}
test("route paths normalize trailing slashes for callback auth guarding", () => {
  assert.equal(normalizeRoutePath("/auth/callback/"), "/auth/callback");
  assert.equal(normalizeRoutePath("/login/"), "/login");
  assert.equal(normalizeRoutePath("/"), "/");
});
test("money and dates reject precision loss and impossible dates", () => {
  assert.equal(toPaise("49.56"), 4956);
  assert.equal(toPaise("0.29"), 29);
  assert.ok(Number.isNaN(toPaise("1.001")));
  assert.ok(Number.isNaN(toPaise("1e4")));
  assert.equal(
    fieldsSchema.safeParse({ ...fields(), date: "2026-02-30" }).success,
    false,
  );
});
test("overdue boundaries, missing due dates, paid and unreviewed totals", () => {
  assert.equal(invoiceStatus(invoice(), "2026-09-12"), "Due today");
  assert.equal(invoiceStatus(invoice(), "2026-09-13"), "Overdue");
  assert.equal(invoiceStatus(invoice({ due: "" }), "2026-09-13"), "Unpaid");
  const s = summary(
    [
      invoice(),
      invoice({ reviewed: false }),
      invoice({ archived: true }),
      invoice({ payment: "paid" }),
    ],
    "2026-09-12",
  );
  assert.equal(s.outstanding, 11800);
  assert.equal(s.overdue, 0);
  assert.equal(s.monthlyTotal, 23600);
});
test("tenant isolation covers reads, edits, file access and archive operations", async (t) => {
  const { service, files } = await fixture(t);
  const i = await uploaded(service, files);
  await service.createWorkspace(bob, { name: "Bob business" });
  assert.equal((await service.list(bob)).length, 0);
  for (const fn of [
    () => service.get(bob, i.id),
    () => service.edit(bob, i.id, { ...fields(), version: i.version }),
    () => service.document(bob, i.id),
    () => service.action(bob, i.id, { action: "archive", version: i.version }),
  ])
    await assert.rejects(fn, /not found/);
  assert.equal((await service.get(alice, i.id)).reviewed, false);
});
test("uploads persist, originals freeze, review requires acknowledgement and stale writes conflict", async (t) => {
  const { service, files, dir } = await fixture(t);
  const i = await uploaded(service, files);
  assert.equal(i.extraction?.source, "manual");
  assert.equal(i.processing, "needs-review");
  await assert.rejects(
    () =>
      service.edit(alice, i.id, {
        ...fields(),
        acknowledged: false,
        version: i.version,
      }),
    /reviewed/,
  );
  await assert.rejects(
    () =>
      service.edit(alice, i.id, {
        ...fields(),
        total: 11801,
        version: i.version,
      }),
    /difference/,
  );
  const saved = await service.edit(alice, i.id, {
    ...fields(),
    version: i.version,
  });
  await assert.rejects(
    () => service.edit(alice, i.id, { ...fields(), version: i.version }),
    Conflict,
  );
  const restarted = new InvoiceService(
    new LocalRepository(dir),
    new LocalFiles(dir),
  );
  assert.equal((await restarted.get(alice, saved.id)).total, 11800);
  await assert.rejects(
    () => files.write(saved.file!.key, new Uint8Array([1, 2, 3])),
    /frozen/,
  );
  const archived = await service.action(alice, saved.id, {
    action: "archive",
    version: saved.version,
  });
  assert.equal(summary(await service.list(alice)).outstanding, 0);
  const restored = await service.action(alice, saved.id, {
    action: "restore",
    version: archived.version,
  });
  const paid = await service.action(alice, saved.id, {
    action: "paid",
    version: restored.version,
  });
  assert.ok(paid.paidAt);
});
test("file validation rejects spoofed, encrypted/invalid and oversized documents", async () => {
  await assert.rejects(() =>
    validateFile(new TextEncoder().encode("<script>hi</script>"), "image/png"),
  );
  await assert.rejects(() =>
    validateFile(new TextEncoder().encode("%PDF-invalid"), "application/pdf"),
  );
  const doc = await PDFDocument.create();
  for (let n = 0; n < 11; n++) doc.addPage();
  await assert.rejects(() => validateFile(awaited(), "application/pdf"));
  function awaited() {
    return new Uint8Array(9 * 1024 * 1024);
  }
  await assert.rejects(() =>
    doc.save().then((b) => validateFile(b, "application/pdf")),
  );
  assert.equal((await validateFile(await pdf(), "application/pdf")).length, 64);
});
test("local passwords are hashed, sessions survive restart and logout invalidates sessions", async (t) => {
  const { repo, dir } = await fixture(t);
  const auth = new LocalAuth(repo);
  const token = await auth.signup({
    email: "owner@example.test",
    password: "long-unique-test-password",
  });
  assert.equal(
    (await new LocalAuth(new LocalRepository(dir)).identify(token)).email,
    "owner@example.test",
  );
  const stored = await repo.get("EMAIL#owner@example.test", "ACCOUNT");
  assert.equal(stored?.data.password, undefined);
  await assert.rejects(
    () =>
      auth.login({ email: "owner@example.test", password: "a-wrong-password" }),
    /incorrect/,
  );
  await auth.logout(token);
  await assert.rejects(() => auth.identify(token), /expired/);
});
test("concurrent quota requests cannot exceed configured cap", async (t) => {
  const { service } = await fixture(t);
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () => service.consumeQuota("test", "day", 3)),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
});
test("Textract maps conservative values and warns on ambiguity, low confidence and foreign currency", () => {
  const result = normalizeExpense([
    {
      SummaryFields: [
        {
          Type: { Text: "TOTAL" },
          ValueDetection: { Text: "₹49,560.00", Confidence: 99 },
          Currency: { Code: "INR" },
        },
        {
          Type: { Text: "INVOICE_RECEIPT_DATE" },
          ValueDetection: { Text: "02/09/2026", Confidence: 80 },
        },
      ],
    },
  ]);
  assert.equal(result.fields.total, 4956000);
  assert.equal(result.fields.date, "2026-09-02");
  assert.ok(result.warnings.some((s) => s.includes("day/month")));
  assert.ok(result.warnings.some((s) => s.includes("confidence")));
});
test("Textract maps vendor details and editable line items while flagging weak item confidence", () => {
  const result = normalizeExpense([
    {
      SummaryFields: [
        {
          Type: { Text: "VENDOR_NAME" },
          ValueDetection: { Text: "ABC Traders", Confidence: 99 },
        },
        {
          Type: { Text: "INVOICE_RECEIPT_ID" },
          ValueDetection: { Text: "INV-1022", Confidence: 98 },
        },
        {
          Type: { Text: "INVOICE_RECEIPT_DATE" },
          ValueDetection: { Text: "10/09/2026", Confidence: 99 },
        },
        {
          Type: { Text: "DUE_DATE" },
          ValueDetection: { Text: "10/10/2026", Confidence: 76 },
        },
        {
          Type: { Text: "VENDOR_ADDRESS" },
          ValueDetection: { Text: "Kochi, Kerala", Confidence: 97 },
        },
        {
          Type: { Text: "TAX_PAYER_ID" },
          ValueDetection: { Text: "32ABCDE1234F1Z5", Confidence: 96 },
        },
        {
          Type: { Text: "TOTAL" },
          ValueDetection: { Text: "₹59,000.00", Confidence: 99 },
          Currency: { Code: "INR" },
        },
      ],
      LineItemGroups: [
        {
          LineItems: [
            {
              LineItemExpenseFields: [
                {
                  Type: { Text: "ITEM" },
                  ValueDetection: { Text: "Office chairs", Confidence: 94 },
                },
                {
                  Type: { Text: "QUANTITY" },
                  ValueDetection: { Text: "5", Confidence: 93 },
                },
                {
                  Type: { Text: "UNIT_PRICE" },
                  ValueDetection: { Text: "₹10,000.00", Confidence: 88 },
                },
                {
                  Type: { Text: "PRICE" },
                  ValueDetection: { Text: "₹50,000.00", Confidence: 92 },
                },
              ],
            },
          ],
        },
      ],
    },
  ]);
  assert.equal(result.fields.vendorAddress, "Kochi, Kerala");
  assert.equal(result.fields.vendorTaxId, "32ABCDE1234F1Z5");
  assert.deepEqual(result.fields.lineItems?.[0], {
    description: "Office chairs",
    quantity: 5,
    unitPrice: 1000000,
    amount: 5000000,
    confidence: 88,
  });
  assert.ok(result.reviewFields.includes("due"));
  assert.ok(result.reviewFields.includes("lineItems"));
});
test("duplicate detection requires the same normalized supplier, invoice number and amount", () => {
  const candidate = invoice({
    id: "existing",
    vendor: "ABC Traders Pvt. Ltd.",
    number: "INV-1022",
    total: 5900000,
  });
  assert.deepEqual(
    findPossibleDuplicate(
      invoice({
        id: "new",
        vendor: "ABC Traders Pvt Ltd",
        number: "INV 1022",
        total: 5900000,
      }),
      [candidate],
    ),
    { invoiceId: "existing", reason: "matching-details" },
  );
  assert.equal(
    findPossibleDuplicate(
      invoice({
        id: "new",
        vendor: "ABC Traders Pvt Ltd",
        number: "INV 1022",
        total: 5900001,
      }),
      [candidate],
    ),
    undefined,
  );
});
test("reminders respect opt-in and payment state and are claimed once per day", async (t) => {
  const { service, files, repo } = await fixture(t);
  const i = await uploaded(service, files);
  await service.edit(alice, i.id, { ...fields(), version: i.version });
  const w = (await service.workspace(alice))!;
  let sends = 0;
  const mailer = {
    async send() {
      sends++;
    },
  };
  await runReminders(repo, mailer, "2026-09-12");
  assert.equal(sends, 0);
  await service.updateWorkspace(alice, { ...w, reminders: true });
  await runReminders(repo, mailer, "2026-09-12");
  await runReminders(repo, mailer, "2026-09-12");
  assert.equal(sends, 1);
  assert.equal(
    reminderInvoices(
      [
        invoice({ payment: "paid" }),
        invoice({ due: "" }),
        invoice({ reviewed: false }),
      ],
      w,
      "2026-09-12",
    ).length,
    0,
  );
});
test("CSV export escapes formulas and quotes", () => {
  const text = csv([invoice({ vendor: "=1+2", number: 'a"b' })]);
  assert.ok(text.includes('"\'=1+2"'));
  assert.ok(text.includes('"a""b"'));
});
test("rejected documents cannot be previewed or confirmed", async (t) => {
  const { service, files } = await fixture(t);
  await service.createWorkspace(alice, { name: "Test workspace" });
  const bytes = new TextEncoder().encode("this is not a PDF");
  const { invoice: i } = await service.reserve(alice, {
    name: "bad.pdf",
    type: "application/pdf",
    size: bytes.length,
  });
  await files.write(i.file!.key, bytes);
  await assert.rejects(() => service.complete(alice, i.id));
  const rejected = await service.get(alice, i.id);
  assert.equal(rejected.processing, "rejected");
  await assert.rejects(() => service.document(alice, i.id), /not ready/);
  await assert.rejects(
    () => service.edit(alice, i.id, { ...fields(), version: rejected.version }),
    /valid document/,
  );
});
test("reminder storage failures are surfaced instead of silently skipped", async (t) => {
  const { service, files, repo } = await fixture(t);
  const i = await uploaded(service, files);
  await service.edit(alice, i.id, { ...fields(), version: i.version });
  const w = (await service.workspace(alice))!;
  await service.updateWorkspace(alice, { ...w, reminders: true });
  repo.put = async () => {
    throw new Error("Database unavailable");
  };
  await assert.rejects(
    () =>
      runReminders(
        repo,
        {
          async send() {
            throw new Error("Must not send");
          },
        },
        "2026-09-12",
      ),
    /Database unavailable/,
  );
});
