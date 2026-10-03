import readXlsx from "read-excel-file/node";

export const MAX_FILE_BYTES = 2 * 1024 * 1024;

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
