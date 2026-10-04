import readXlsx from "read-excel-file/node";

export const MAX_FILE_BYTES = 2 * 1024 * 1024;

// A spreadsheet is a zip. A small file can promise gigabytes once unpacked, so the sizes it declares are checked first.
const MAX_UNPACKED = 60 * 1024 * 1024;
export function zipTooBig(b: Uint8Array): boolean {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.byteLength - 22; i >= Math.max(0, b.byteLength - 22 - 65_535); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return false; // not a zip we can read: the parser will reject it
  const entries = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  if (entries === 0xffff || p === 0xffffffff || entries > 5_000) return true;
  let total = 0;
  for (let i = 0; i < entries; i++) {
    if (p + 46 > b.byteLength || v.getUint32(p, true) !== 0x02014b50) return true;
    const size = v.getUint32(p + 24, true);
    if (size === 0xffffffff) return true;
    total += size;
    if (total > MAX_UNPACKED) return true;
    p += 46 + v.getUint16(p + 28, true) + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  return false;
}

export type FileText = { text: string; note: string | null } | { error: string };

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).replace(/[\t\r\n]+/g, " ").trim();
};

// A spreadsheet or text file becomes plain text the reader can work with. Anything else gets a clear instruction, not a failure.
export async function fileToText(name: string, bytes: Uint8Array): Promise<FileText> {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  if (bytes.byteLength === 0) return { error: "That file is empty." };
  if (bytes.byteLength > MAX_FILE_BYTES) return { error: "That file is bigger than 2 MB. Paste the part you need instead." };

  if (ext === "xlsx") {
    if (zipTooBig(bytes)) return { error: "That spreadsheet is too large once opened. Paste the part you need instead." };
    try {
      const sheets = await readXlsx(Buffer.from(bytes));
      const parts = sheets
        .map((s) => ({ name: s.sheet, rows: s.data.map((r) => r.map(cell).join("\t")).filter((r) => r.replace(/\t/g, "") !== "") }))
        .filter((s) => s.rows.length);
      if (!parts.length) return { error: "That spreadsheet has no cells with anything in them." };
      const many = parts.length > 1;
      return {
        text: parts.map((s) => (many ? `Sheet: ${s.name}\n` : "") + s.rows.join("\n")).join("\n\n"),
        note: many ? `That file has ${parts.length} sheets. I read all of them, with the sheet names kept.` : null,
      };
    } catch {
      return { error: "I could not open that spreadsheet. Save it again as .xlsx, or copy the cells and paste them." };
    }
  }
  if (["csv", "tsv", "txt", "md"].includes(ext)) {
    const text = new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "").trim();
    return text ? { text, note: null } : { error: "That file is empty." };
  }
  if (ext === "xls") return { error: "That is an older Excel format (.xls). Open it and save as .xlsx, or copy the cells and paste them." };
  if (["pdf", "png", "jpg", "jpeg", "heic", "webp", "doc", "docx", "pages", "numbers"].includes(ext)) {
    return { error: "I can read Excel (.xlsx), CSV and text files, and pasted text. For a PDF, a photo or a Word file, select the text, copy it and paste it here." };
  }
  return { error: "I can read Excel (.xlsx), CSV and text files, and pasted text." };
}
