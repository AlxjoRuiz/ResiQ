import { Unzip, UnzipInflate, zipSync } from "fflate";

const maxEntries = 64;
const maxEntryBytes = 2 * 1024 * 1024;
const maxExpandedBytes = 8 * 1024 * 1024;

function checkWorksheetBounds(xml: string) {
  const rows = xml.match(/<(?:[\w.-]+:)?row\b[^>]*>/g) ?? [];
  if (rows.length > 501) throw new Error("xlsx_row_limit");
  for (const row of rows) {
    const index = row.match(/\br\s*=\s*["']([^"']*)["']/)?.[1];
    if (index !== undefined && (!/^\d+$/.test(index) || Number(index) < 1 || Number(index) > 501)) throw new Error("xlsx_row_limit");
  }
  const cells = xml.match(/<(?:[\w.-]+:)?c\b[^>]*>/g) ?? [];
  if (cells.length > 501 * 32) throw new Error("xlsx_cell_limit");
  for (const cell of cells) {
    const reference = cell.match(/\br\s*=\s*["']([^"']*)["']/)?.[1];
    if (reference === undefined) continue;
    const match = /^([A-Z]{1,2})([0-9]+)$/.exec(reference);
    const column = match?.[1].split("").reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0);
    if (!match || !column || column > 32 || Number(match[2]) < 1 || Number(match[2]) > 501) throw new Error("xlsx_cell_limit");
  }
}

/** Repack bounded XML entries before a parser can allocate from untrusted ZIP sizes. */
export function boundedXlsx(input: Uint8Array): Uint8Array {
  if (input.length > 2 * 1024 * 1024 || input[0] !== 0x50 || input[1] !== 0x4b) throw new Error("invalid_xlsx");
  const files: Record<string, Uint8Array> = Object.create(null);
  const names = new Set<string>();
  let total = 0, unfinished = 0;
  let failure: Error | undefined;
  const unzip = new Unzip((file) => {
    if (names.has(file.name) || names.size >= maxEntries || file.name.includes("\\") || file.name.split("/").includes("..")) {
      failure = new Error("invalid_xlsx_archive"); return;
    }
    names.add(file.name);
    if (!file.name.endsWith(".xml") && !file.name.endsWith(".xml.rels")) return;
    if ((file.originalSize ?? 0) > maxEntryBytes) { failure = new Error("xlsx_expansion_limit"); return; }
    const chunks: Uint8Array[] = [];
    let size = 0;
    unfinished++;
    file.ondata = (error, data, final) => {
      if (error) { failure = error; return; }
      size += data.length; total += data.length;
      if (size > maxEntryBytes || total > maxExpandedBytes) {
        failure = new Error("xlsx_expansion_limit"); file.terminate(); return;
      }
      chunks.push(data);
      if (final) {
        const content = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { content.set(chunk, offset); offset += chunk.length; }
        const xml = new TextDecoder().decode(content);
        if (/<!DOCTYPE|<!ENTITY/i.test(xml)) { failure = new Error("invalid_xlsx_xml"); return; }
        if (file.name.startsWith("xl/worksheets/")) {
          try { checkWorksheetBounds(xml); } catch (error) { failure = error as Error; return; }
        }
        files[file.name] = content;
        unfinished--;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  // Small compressed chunks bound transient inflation before each size check.
  for (let offset = 0; offset < input.length; offset += 512) {
    unzip.push(input.subarray(offset, offset + 512), offset + 512 >= input.length);
    if (failure) throw failure;
  }
  if (unfinished || !files["xl/workbook.xml"] || !Object.keys(files).some((name) => name.startsWith("xl/worksheets/"))) throw new Error("invalid_xlsx_archive");
  return zipSync(files, { level: 0 });
}
