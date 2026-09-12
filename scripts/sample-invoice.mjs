import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { mkdir, writeFile } from 'node:fs/promises'
const doc = await PDFDocument.create(); const page = doc.addPage([595, 842]); const font = await doc.embedFont(StandardFonts.Helvetica)
const text = (value, y, size = 12) => page.drawText(value, { x: 55, y, size, font, color: rgb(.1, .2, .25) })
text('ABC TRADERS', 765, 25); text('SYNTHETIC SAMPLE - NOT A REAL TAX INVOICE', 738, 10)
text('Invoice: INV-2041', 690); text('Bill to: Sample business', 665); text('Invoice date: 02/09/2026', 640); text('Due date: 02/10/2026', 615)
text('Business supplies', 540, 15); text('Subtotal: INR 42,000.00', 480); text('GST: INR 7,560.00', 450); text('Total: INR 49,560.00', 405, 20)
text('Unpaid. This document is for testing Invoxa only.', 330)
await mkdir('docs/samples', { recursive: true }); await writeFile('docs/samples/sample-invoice.pdf', await doc.save()); console.log('Created docs/samples/sample-invoice.pdf')
