import { z } from "zod";
export const MAX_BYTES = 8 * 1024 * 1024;
export const MAX_PAGES = 10;
export const MAX_INVOICES = 1000;
export const currencies = ["INR"] as const;
const date = z
  .string()
  .refine(
    (v) =>
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      !isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Use a valid calendar date",
  );
const amount = z.number().int().min(0).max(100_000_000_000);
export const lineItemSchema = z.object({
  description: z.string().trim().max(500),
  quantity: z.number().min(0).max(1_000_000).nullable(),
  unitPrice: amount.nullable(),
  amount: amount.nullable(),
  confidence: z.number().min(0).max(100).nullable(),
});
export type LineItem = z.infer<typeof lineItemSchema>;
export const fieldsSchema = z.object({
  vendor: z.string().trim().min(1).max(200),
  number: z.string().trim().min(1).max(100),
  date,
  due: z.union([date, z.literal("")]),
  subtotal: amount,
  tax: amount,
  total: amount.positive(),
  currency: z.enum(currencies),
  payment: z.enum(["paid", "unpaid"]),
  notes: z.string().max(2000),
  vendorAddress: z.string().trim().max(1000).default(""),
  vendorTaxId: z.string().trim().max(100).default(""),
  lineItems: z.array(lineItemSchema).max(200).default([]),
});
export type Fields = z.infer<typeof fieldsSchema>;
export function normalizeRoutePath(path: string) {
  if (!path || path === "/") return "/";
  const withoutHash = path.split("#")[0];
  const withoutQuery = withoutHash.split("?")[0];
  const cleaned = withoutQuery.replace(/\/+$/, "") || "/";
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
}
export interface Invoice extends Fields {
  id: string;
  workspaceId: string;
  version: number;
  reviewed: boolean;
  archived: boolean;
  processing:
    | "rejected"
    | "awaiting-upload"
    | "needs-review"
    | "processing"
    | "failed"
    | "confirmed";
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  file?: {
    name: string;
    type: string;
    size: number;
    key: string;
    hash?: string;
  };
  extraction?: {
    source: "textract" | "manual" | "demo";
    confidence: Record<string, number>;
    warnings: string[];
    reviewFields?: string[];
    completedAt?: string;
  };
  duplicate?: { invoiceId: string; reason: "same-file" | "matching-details" };
  failure?: string;
  jobId?: string;
}
export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  email: string;
  reminders: boolean;
  reminderDays: number;
  version: number;
}
export interface Identity {
  id: string;
  email: string;
}
export const workspaceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  reminders: z.boolean(),
  reminderDays: z.number().int().min(1).max(30),
});
export const uploadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .regex(/^[^/\\\x00-\x1f]+$/),
  type: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  size: z.number().int().positive().max(MAX_BYTES),
});
export const today = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
export function plusDays(value: string, days: number) {
  const d = new Date(`${value}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function invoiceStatus(i: Invoice, day = today()) {
  if (i.archived) return "Archived";
  if (i.processing === "rejected") return "Invalid document";
  if (i.processing === "awaiting-upload") return "Awaiting upload";
  if (i.processing === "processing") return "Processing";
  if (i.processing === "failed") return "Extraction failed";
  if (!i.reviewed) return "Needs review";
  if (i.payment === "paid") return "Paid";
  if (!i.due) return "Unpaid";
  if (i.due < day) return "Overdue";
  if (i.due === day) return "Due today";
  if (i.due <= plusDays(day, 7)) return "Due soon";
  return "Unpaid";
}
export function summary(invoices: Invoice[], day = today()) {
  const confirmed = invoices.filter((i) => i.reviewed && !i.archived);
  const unpaid = confirmed.filter((i) => i.payment === "unpaid");
  const month = day.slice(0, 7);
  const monthly = confirmed.filter((i) => i.date.startsWith(month));
  const vendors = new Map<string, number>();
  for (const i of monthly)
    vendors.set(i.vendor, (vendors.get(i.vendor) || 0) + i.total);
  return {
    outstanding: unpaid.reduce((n, i) => n + i.total, 0),
    overdue: unpaid
      .filter((i) => i.due && i.due < day)
      .reduce((n, i) => n + i.total, 0),
    dueSoon: unpaid.filter(
      (i) => i.due && i.due >= day && i.due <= plusDays(day, 7),
    ).length,
    monthlyCount: monthly.length,
    monthlyTotal: monthly.reduce((n, i) => n + i.total, 0),
    monthlyTax: monthly.reduce((n, i) => n + i.tax, 0),
    reviewCount: invoices.filter((i) => !i.reviewed && !i.archived).length,
    topVendors: [...vendors].sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
}
export function toPaise(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return NaN;
  const [whole, fraction = ""] = value.trim().split(".");
  const n = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(n) ? n : NaN;
}
export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
export const dateLabel = (value: string) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${value}T00:00:00Z`))
    : "Not provided";
export function csv(invoices: Invoice[]) {
  const cell = (value: unknown) => {
    let s = String(value ?? "");
    if (/^[\s]*[=+@-]/.test(s)) s = `'${s}`;
    return `"${s.replaceAll('"', '""')}"`;
  };
  return [
    [
      "Vendor",
      "Vendor address",
      "GST / tax ID",
      "Invoice number",
      "Invoice date",
      "Due date",
      "Subtotal INR",
      "GST INR",
      "Total INR",
      "Line items",
      "Status",
      "Notes",
    ],
    ...invoices.map((i) => [
      i.vendor,
      i.vendorAddress || "",
      i.vendorTaxId || "",
      i.number,
      i.date,
      i.due,
      (i.subtotal / 100).toFixed(2),
      (i.tax / 100).toFixed(2),
      (i.total / 100).toFixed(2),
      (i.lineItems || [])
        .map((item) => item.description)
        .filter(Boolean)
        .join("; "),
      invoiceStatus(i),
      i.notes,
    ]),
  ]
    .map((r) => r.map(cell).join(","))
    .join("\r\n");
}
export function reminderInvoices(
  invoices: Invoice[],
  workspace: Workspace,
  day = today(),
) {
  return invoices.filter(
    (i) =>
      i.reviewed &&
      !i.archived &&
      i.payment === "unpaid" &&
      i.due &&
      i.due <= plusDays(day, workspace.reminderDays),
  );
}
export const emptyFields = (): Fields => ({
  vendor: "",
  number: "",
  date: "",
  due: "",
  subtotal: 0,
  tax: 0,
  total: 0,
  currency: "INR",
  payment: "unpaid",
  notes: "",
  vendorAddress: "",
  vendorTaxId: "",
  lineItems: [],
});
