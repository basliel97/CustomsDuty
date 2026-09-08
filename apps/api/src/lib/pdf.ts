import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NOTO_TTF = path.resolve(__dirname, "../assets/NotoSansEthiopic.ttf");

const A4 = { width: 595.28, height: 841.89 };
const PAGE_MARGIN = 48;

export interface PdfItem {
  line_number: number;
  hsCode: string;
  item_description: string;
  quantity: number;
  unit_price_foreign: number;
  cif_etb: number;
  duty_amount: number;
  excise_amount: number;
  vat_amount: number;
  surtax_amount: number;
  withholding_amount: number;
}

export interface PdfSummary {
  totalCifEtb: number;
  totalDutyEtb: number;
  totalExciseEtb: number;
  totalVatEtb: number;
  totalSurtaxEtb: number;
  totalWithholdingEtb: number;
  scanningFee: number;
  grandTotalPayable: number;
  totalPaidEtb: number;
  remainingBalanceEtb: number;
}

export interface PdfData {
  assessmentNumber: string;
  issuedAt: Date;
  status: string;
  exemptionType: string;
  officerBadge: string | null;
  officerName: string | null;
  declarantName: string;
  declarantTin: string;
  declarantPassportNo: string | null;
  branchNameEn: string;
  branchNameAm: string;
  branchCity: string | null;
  currency: string;
  exchangeRate: number;
  qrPayload: string;
  items: PdfItem[];
  summary: PdfSummary;
}

const MAGENTA = "#1d4ed8";

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const ten = TENS[Math.floor(n / 10)];
  const one = ONES[n % 10];
  return one ? `${ten}-${one}` : ten;
}

function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  let out = "";
  if (hundreds > 0) out = `${ONES[hundreds]} Hundred`;
  if (rest > 0) out = `${out} ${twoDigits(rest)}`.trim();
  return out;
}

const SCALES = [
  { value: 1_000_000_000_000, word: "Trillion" },
  { value: 1_000_000_000, word: "Billion" },
  { value: 1_000_000, word: "Million" },
  { value: 1_000, word: "Thousand" },
];

function integerToWords(num: number): string {
  if (num === 0) return "Zero";
  let remaining = num;
  let parts: string[] = [];
  for (const scale of SCALES) {
    if (remaining >= scale.value) {
      const count = Math.floor(remaining / scale.value);
      parts.push(`${threeDigits(count)} ${scale.word}`);
      remaining %= scale.value;
    }
  }
  if (remaining > 0) parts.push(threeDigits(remaining));
  return parts.join(" ");
}

export function amountInWords(amount: number): string {
  const birr = Math.floor(amount);
  const cents = Math.round((amount - birr) * 100);
  const birrWord = integerToWords(birr);
  if (cents === 0) return `${birrWord} Birr Only`;
  return `${birrWord} Birr and ${twoDigits(cents)} Cents Only`;
}

type Doc = PDFKit.PDFDocument;

function escalatorFont(doc: Doc) {
  doc.font(NOTO_TTF);
}

export async function buildAssessmentPdf(data: PdfData): Promise<Buffer> {
  const doc = new PDFDocument({
    size: [A4.width, A4.height],
    margin: PAGE_MARGIN,
    bufferPages: true,
    autoFirstPage: true,
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  registerFonts(doc);

  const watermark = data.status === "APPROVED" || data.status === "PAID" ? "OFFICIAL" : "DRAFT";
  drawWatermark(doc, watermark);

  drawHeader(doc, data);
  drawMeta(doc, data);
  drawItems(doc, data);
  drawSummary(doc, data);
  await drawFooter(doc, data);

  doc.end();
  return done;
}

function registerFonts(doc: Doc) {
  doc.registerFont("Noto", NOTO_TTF);
  doc.registerFont("Noto-Bold", NOTO_TTF);
  escalatorFont(doc);
}

function drawWatermark(doc: Doc, label: string) {
  escalatorFont(doc);
  doc
    .fontSize(72)
    .fillColor("#eeeeee")
    .rotate(-35, { origin: [A4.width / 2, A4.height / 2] })
    .text(label, 0, A4.height / 2 - 120, { width: A4.width, align: "center" })
    .rotate(35, { origin: [A4.width / 2, A4.height / 2] })
    .fillColor("#000000");
}

function drawHeader(doc: Doc, data: PdfData) {
  escalatorFont(doc);

  doc
    .rect(0, 0, A4.width, 18)
    .fill("#0f172a");
  doc
    .moveDown(0.2)
    .fontSize(13)
    .fillColor("#ffffff");

  doc
    .fillColor("#ffffff")
    .text(`ETHIOPIAN CUSTOMS COMMISSION`, { align: "center" })
    .fontSize(11)
    .text(`á‹¨áŠ¢á‰µá‹®áŒµá‹« áŒ‰áˆáˆ©áŠ­ áŠ®áˆšáˆ½áŠ•`, { align: "center" })
    .fillColor("#000000");

  doc
    .moveDown(0.6)
    .fontSize(12)
    .fillColor(MAGENTA)
    .text(`OFFICIAL CUSTOMS ASSESSMENT NOTICE`, { align: "center" })
    .fillColor("#000000");

  doc
    .fontSize(9)
    .fillColor("#475569")
    .text(`Branch: ${data.branchNameEn} ${data.branchCity ? `- ${data.branchCity}` : ""} (${data.branchNameAm})`, { align: "center" })
    .moveDown(0.3)
    .fillColor("#000000");
}

function drawMeta(doc: Doc, data: PdfData) {
  escalatorFont(doc);
  const labelWidth = 130;
  const left = PAGE_MARGIN;
  const top = doc.y;

  doc.roundedRect(left - 10, top - 8, A4.width - 2 * PAGE_MARGIN + 20, 78, 4).stroke("#cbd5e1");

  let y = top;
  const row = (label: string, value: string, x: number) => {
    escalatorFont(doc);
    doc.fontSize(9).fillColor("#64748b").text(label, x, y, { width: labelWidth });
    doc.fillColor("#0f172a").text(value, x + labelWidth, y, { width: A4.width - 2 * PAGE_MARGIN - labelWidth - 40 });
    y += 16;
  };

  row("Assessment No.", data.assessmentNumber, left);
  row("Date", data.issuedAt.toDateString(), left + 250);
  row("Declarant", data.declarantName, left);
  row("TIN", data.declarantTin, left + 250);
  row("Passport", data.declarantPassportNo ?? "-", left);
  row("Officer", data.officerBadge ? `${data.officerName ?? ""} (${data.officerBadge})` : (data.officerName ?? "-"), left + 250);
  row("Exemption", data.exemptionType, left);
  row(`Rate ${data.currency}->ETB`, String(data.exchangeRate), left + 250);

  doc.y = top + 84;
}

function drawItems(doc: Doc, data: PdfData) {
  escalatorFont(doc);
  doc.moveDown(0.6).fontSize(10).fillColor(MAGENTA).text("SECTION A: ITEMIZED TAX COMPUTATION", { underline: true }).fillColor("#000000");
  doc.moveDown(0.3);

  const colX = {
    line: PAGE_MARGIN,
    hs: PAGE_MARGIN + 28,
    desc: PAGE_MARGIN + 92,
    cif: A4.width - PAGE_MARGIN - 260,
    tax: A4.width - PAGE_MARGIN - 130,
  };

  const headerY = doc.y;
  drawRowCells(doc, headerY, [
    { x: colX.line, w: 26, text: "#" },
    { x: colX.hs, w: 60, text: "HS Code" },
    { x: colX.desc, w: 150, text: "Description" },
    { x: colX.cif, w: 128, text: "CIF (ETB)", align: "right" },
    { x: colX.tax, w: 130, text: "Tax Breakdown (ETB)", align: "right" },
  ], "#f1f5f9");
  doc.y = headerY + 20;

  for (const item of data.items) {
    const rowY = doc.y;
    if (rowY + 40 > A4.height - PAGE_MARGIN - 160) {
      doc.addPage();
      registerFonts(doc);
      doc.y = PAGE_MARGIN;
    }
    drawRowCells(doc, doc.y, [
      { x: colX.line, w: 26, text: String(item.line_number) },
      { x: colX.hs, w: 60, text: item.hsCode },
      { x: colX.desc, w: 150, text: `${item.item_description}  (Qty ${item.quantity} @ ${item.unit_price_foreign})` },
      { x: colX.cif, w: 128, text: fmt(item.cif_etb), align: "right" },
      {
        x: colX.tax,
        w: 130,
        text: `D:${fmt(item.duty_amount)} E:${fmt(item.excise_amount)}\nV:${fmt(item.vat_amount)} S:${fmt(item.surtax_amount)} W:${fmt(item.withholding_amount)}`,
        align: "right",
        height: 24,
      },
    ]);
    doc.y += 28;
  }
}

interface Cell {
  x: number;
  w: number;
  text: string;
  align?: "left" | "center" | "right";
  height?: number;
}

function drawRowCells(doc: Doc, y: number, cells: Cell[], fill?: string) {
  escalatorFont(doc);
  doc.fontSize(8);
  if (fill) doc.rect(PAGE_MARGIN, y, A4.width - 2 * PAGE_MARGIN, 20).fill(fill);
  doc.fillColor("#0f172a");
  let maxH = 20;
  for (const cell of cells) {
    const lines = cell.text.split("\n");
    const h = Math.max(cell.height ?? 20, lines.length * 8 + 4);
    if (h > maxH) maxH = h;
  }
  for (const cell of cells) {
    const lines = cell.text.split("\n");
    doc.fontSize(8).text(lines.join("\n"), cell.x, y + 4, { width: cell.w, align: cell.align ?? "left", lineBreak: false });
  }
  doc.rect(PAGE_MARGIN, y, A4.width - 2 * PAGE_MARGIN, maxH).stroke("#cbd5e1");
}

function drawSummary(doc: Doc, data: PdfData) {
  escalatorFont(doc);
  doc.moveDown(0.6).fontSize(10).fillColor(MAGENTA).text("SECTION B: TAX SUMMARY", { underline: true }).fillColor("#000000");
  doc.moveDown(0.3);

  const s = data.summary;
  const rows: [string, string][] = [
    ["Customs Duty  (á‰€áˆ¨áŒ¥)", fmt(s.totalDutyEtb)],
    ["Excise Tax  (áŠ¤áŠ­áˆ³á‹­áˆµ)", fmt(s.totalExciseEtb)],
    ["VAT  (á‹¨á‰°áŒ¨áˆ›áˆª áŠ¥áˆ´á‰µ á‰³áŠ­áˆµ)", fmt(s.totalVatEtb)],
    ["Sur-Tax  (áˆ°áˆ­ á‰³áŠ­áˆµ)", fmt(s.totalSurtaxEtb)],
    ["Withholding  (á‹¨á‰…á‹µáˆšá‹« áŒá‰¥áˆ­)", fmt(s.totalWithholdingEtb)],
    ["Scanning/Admin Fee", fmt(s.scanningFee)],
  ];

  const boxWidth = 240;
  const boxX = A4.width - PAGE_MARGIN - boxWidth;
  let y = doc.y;

  doc.roundedRect(boxX, y, boxWidth, rows.length * 18 + 24, 4).stroke("#cbd5e1");
  for (const [label, value] of rows) {
    escalatorFont(doc);
    doc.fontSize(8.5).fillColor("#334155").text(label, boxX + 8, y + 6, { width: boxWidth - 120 });
    doc.fillColor("#0f172a").text(value, boxX + boxWidth - 80, y + 6, { width: 72, align: "right" });
    y += 18;
  }
  doc.moveTo(boxX + 4, y).lineTo(boxX + boxWidth - 4, y).lineWidth(1).stroke();
  doc.fontSize(10).fillColor(MAGENTA).text("TOTAL PAYABLE", boxX + 8, y + 6, { width: boxWidth - 120 });
  doc.fillColor("#0f172a").text(`${fmt(s.grandTotalPayable)}`, boxX + boxWidth - 88, y + 4, { width: 80, align: "right" });
  y += 40;

  doc.fillColor("#000000").fontSize(9).text(
    "TOTAL IN WORDS:",
    PAGE_MARGIN,
    y,
    { width: boxWidth }
  );
  doc
    .fontSize(9)
    .text(amountInWords(s.grandTotalPayable), PAGE_MARGIN, y + 14, {
      width: A4.width - 2 * PAGE_MARGIN - boxWidth - 20,
    });

  doc.y = Math.max(y + 70, doc.y + 30);
}

async function drawFooter(doc: Doc, data: PdfData) {
  escalatorFont(doc);
  if (doc.y > A4.height - PAGE_MARGIN - 120) {
    doc.addPage();
    registerFonts(doc);
    doc.y = PAGE_MARGIN;
  }

  const qrX = PAGE_MARGIN;
  const qrY = A4.height - PAGE_MARGIN - 150;

  if (data.qrPayload) {
    const qrImage = await QRCode.toBuffer(data.qrPayload, {
      type: "png",
      errorCorrectionLevel: "H",
      width: 150,
      margin: 1,
    });
    doc.image(qrImage, qrX, qrY, { width: 130, height: 130 });
    escalatorFont(doc);
    doc.fontSize(8).fillColor("#475569").text("Scan to verify", qrX, qrY + 134, { width: 130, align: "center" });
    doc.fillColor("#0f172a").fontSize(8.5).text(data.assessmentNumber, qrX, qrY + 148, { width: 130, align: "center" });
  } else {
    doc
      .rect(qrX, qrY, 130, 130)
      .lineWidth(1)
      .stroke("#cbd5e1");
    escalatorFont(doc);
    doc.fontSize(8).fillColor("#64748b").text("QR code available after approval", qrX, qrY + 45, { width: 130, align: "center" });
    doc.fillColor("#0f172a").fontSize(8.5).text(data.assessmentNumber, qrX, qrY + 148, { width: 130, align: "center" });
  }

  doc
    .fontSize(8.5)
    .fillColor("#475569")
    .text(
      "Digitally generated by CustomsDuty Pro. The QR code embeds a signed token verifiable at the customs gate.",
      A4.width / 2,
      qrY + 20,
      { width: A4.width / 2 - PAGE_MARGIN - 20 }
    );

  const sigX = A4.width / 2 + 20;
  const sigY = qrY + 60;
  doc
    .moveTo(sigX, sigY)
    .lineTo(A4.width - PAGE_MARGIN, sigY)
    .stroke("#0f172a");
  doc
    .fontSize(8.5)
    .text(`${data.officerName ?? ""} ${data.officerBadge ? `(${data.officerBadge})` : ""}`, sigX, sigY + 5, { width: A4.width - PAGE_MARGIN - sigX });
  doc
    .fontSize(8)
    .fillColor("#475569")
    .text("Officer Stamp & Signature", sigX, sigY + 17, { width: A4.width - PAGE_MARGIN - sigX });
  doc.fillColor("#000000");
}