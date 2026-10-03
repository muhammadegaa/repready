import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fileToText, MAX_FILE_BYTES } from "./files";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("reading files", () => {
  it("turns a real .xlsx into tab-separated text, numbers and all", async () => {
    const r = await fileToText("week.xlsx", new Uint8Array(readFileSync(join(__dirname, "fixtures/week.xlsx"))));
    expect(r).toMatchObject({ note: null });
    const text = (r as { text: string }).text;
    expect(text.split("\n")[0]).toBe("Day\tExercise\tSets\tReps\tLoad\tGroup");
    expect(text).toContain("Tuesday\tBack squat\t4\t5\t85% 1RM\t");
    expect(text).toContain("Tuesday\tBack squat\t5\t5\t85% 1RM\tReserves");
    expect(text.split("\n")).toHaveLength(5);
  });
  it("reads CSV and plain text, dropping a byte-order mark", async () => {
    expect(await fileToText("a.csv", bytes("﻿Day,Exercise\nMon,Squat"))).toEqual({ text: "Day,Exercise\nMon,Squat", note: null });
    expect(await fileToText("notes.TXT", bytes("Tuesday: squat 4x5"))).toMatchObject({ text: "Tuesday: squat 4x5" });
  });
  it("says what to do for formats it cannot read yet, in plain words", async () => {
    for (const n of ["plan.pdf", "board.JPG", "plan.docx"]) expect(await fileToText(n, bytes("x"))).toMatchObject({ error: expect.stringMatching(/copy it and paste/) });
    expect(await fileToText("old.xls", bytes("x"))).toMatchObject({ error: expect.stringMatching(/save as \.xlsx/) });
    expect(await fileToText("thing.zip", bytes("x"))).toMatchObject({ error: expect.stringMatching(/Excel/) });
  });
  it("refuses empty and oversized files, and survives a broken spreadsheet", async () => {
    expect(await fileToText("a.csv", new Uint8Array())).toMatchObject({ error: "That file is empty." });
    expect(await fileToText("a.csv", bytes("   \n  "))).toMatchObject({ error: "That file is empty." });
    expect(await fileToText("big.csv", new Uint8Array(MAX_FILE_BYTES + 1))).toMatchObject({ error: expect.stringMatching(/2 MB/) });
    expect(await fileToText("bad.xlsx", bytes("this is not a zip"))).toMatchObject({ error: expect.stringMatching(/could not open/) });
  });
});
