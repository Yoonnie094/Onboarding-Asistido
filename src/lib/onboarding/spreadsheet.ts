// Lectura de planillas de cuarteles (CSV / XLSX) en el navegador.
// Todo se convierte a texto: la interpretación de números y fechas la hace validation.ts.

import Papa from "papaparse";

export const SPREADSHEET_LIMITS = {
  maxRows: 5000,
  maxBytes: 5 * 1024 * 1024,
} as const;

export type ParsedSpreadsheet = {
  headers: string[];
  rows: Record<string, string>[];
  sheetName: string | null;
};

export class SpreadsheetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpreadsheetError";
  }
}

type Matrix = string[][];

function extensionOf(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  return match ? match[1].toLowerCase() : "";
}

/** Formatea una fecha como dd-mm-aaaa (formato chileno). */
function formatDate(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${date.getUTCFullYear()}`;
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : formatDate(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    // Decimales con coma, sin separador de miles (lo interpreta validation.ts).
    const rounded = Math.round(value * 1e6) / 1e6;
    return String(rounded).replace(".", ",");
  }
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value).replace(/\s+/g, " ").trim();
}

/** Convierte una matriz (primera fila no vacía = encabezados) en filas con clave = encabezado. */
function matrixToTable(matrix: Matrix, sheetName: string | null): ParsedSpreadsheet {
  const nonEmpty = matrix.filter((row) => row.some((cell) => cell.trim() !== ""));
  if (nonEmpty.length === 0) {
    throw new SpreadsheetError("La planilla está vacía: no encontramos filas con datos.");
  }

  const [headerRow, ...dataRows] = nonEmpty;

  // Encabezados: trim, nombres para columnas sin título y desduplicar.
  const seen = new Map<string, number>();
  const headerSlots = headerRow.map((raw, index) => {
    let header = raw.trim() || `Columna ${index + 1}`;
    const count = seen.get(header.toLowerCase()) ?? 0;
    seen.set(header.toLowerCase(), count + 1);
    if (count > 0) header = `${header} (${count + 1})`;
    return header;
  });

  // Quitamos columnas sin título que además no tienen datos.
  const usedIndexes = headerSlots
    .map((header, index) => ({ header, index }))
    .filter(({ index }) => headerRow[index]?.trim() !== "" || dataRows.some((row) => (row[index] ?? "").trim() !== ""));

  if (usedIndexes.length === 0) {
    throw new SpreadsheetError("No encontramos encabezados en la primera fila de la planilla.");
  }
  if (dataRows.length === 0) {
    throw new SpreadsheetError("La planilla solo tiene encabezados: agrega al menos una fila con datos.");
  }
  if (dataRows.length > SPREADSHEET_LIMITS.maxRows) {
    throw new SpreadsheetError(
      `La planilla tiene ${dataRows.length.toLocaleString("es-CL")} filas. Para esta demo el máximo es ${SPREADSHEET_LIMITS.maxRows.toLocaleString("es-CL")}.`,
    );
  }

  const headers = usedIndexes.map(({ header }) => header);
  const rows = dataRows.map((row) => {
    const record: Record<string, string> = {};
    for (const { header, index } of usedIndexes) {
      record[header] = (row[index] ?? "").trim();
    }
    return record;
  });

  return { headers, rows, sheetName };
}

async function readText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  // Si hay caracteres de reemplazo, probablemente viene en Latin-1 / Windows-1252 (Excel en Windows).
  if (utf8.includes("�")) {
    try {
      return new TextDecoder("windows-1252").decode(buffer);
    } catch {
      return utf8;
    }
  }
  return utf8.replace(/^﻿/, "");
}

function detectDelimiter(text: string): string {
  const firstLines = text.split(/\r?\n/).filter((line) => line.trim() !== "").slice(0, 5);
  const candidates = [";", ",", "\t"];
  let best = ",";
  let bestScore = -1;
  for (const delimiter of candidates) {
    const counts = firstLines.map((line) => line.split(delimiter).length - 1);
    const min = counts.length ? Math.min(...counts) : 0;
    if (min > bestScore) {
      bestScore = min;
      best = delimiter;
    }
  }
  return best;
}

async function parseCsv(file: File): Promise<ParsedSpreadsheet> {
  const text = await readText(file);
  if (!text.trim()) throw new SpreadsheetError("El archivo CSV está vacío.");

  const result = Papa.parse<string[]>(text, {
    delimiter: detectDelimiter(text),
    skipEmptyLines: "greedy",
  });

  if (result.data.length === 0) {
    const first = result.errors[0];
    throw new SpreadsheetError(
      first ? `No pudimos leer el CSV (fila ${first.row ?? "?"}: ${first.message}).` : "No pudimos leer el CSV.",
    );
  }

  const matrix = result.data.map((row) => row.map((cell) => cellToString(cell)));
  return matrixToTable(matrix, null);
}

async function parseXlsx(file: File): Promise<ParsedSpreadsheet> {
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  let sheets;
  try {
    sheets = await readXlsxFile(file);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    throw new SpreadsheetError(
      `No pudimos abrir el archivo Excel. Verifica que sea un .xlsx válido${detail ? ` (${detail})` : ""}.`,
    );
  }
  const first = sheets.find((sheet) => sheet.data.some((row) => row.some((cell) => cell !== null && cell !== "")));
  if (!first) throw new SpreadsheetError("El archivo Excel no tiene hojas con datos.");

  const matrix = first.data.map((row) => row.map((cell) => cellToString(cell)));
  return matrixToTable(matrix, first.sheet ?? null);
}

/** Lee un archivo CSV o XLSX y devuelve encabezados + filas como texto. */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSpreadsheet> {
  if (file.size === 0) throw new SpreadsheetError("El archivo está vacío.");
  if (file.size > SPREADSHEET_LIMITS.maxBytes) {
    throw new SpreadsheetError(
      `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1).replace(".", ",")} MB. Para esta demo el máximo es 5 MB.`,
    );
  }

  const ext = extensionOf(file.name);
  if (ext === "csv" || ext === "txt" || file.type === "text/csv") return parseCsv(file);
  if (ext === "xlsx" || ext === "xlsm") return parseXlsx(file);
  if (ext === "xls") {
    throw new SpreadsheetError(
      "El formato .xls (Excel 97-2003) no es compatible. Abre el archivo en Excel y guárdalo como .xlsx o CSV.",
    );
  }
  throw new SpreadsheetError("Formato no reconocido. Sube un archivo .xlsx o .csv.");
}
