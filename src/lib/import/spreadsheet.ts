import * as XLSX from 'xlsx'

export interface ParsedWorkbook {
  sheetNames: string[]
  /** Raw rows for `sheetName`, keyed for quick re-reads without re-parsing the file. */
  getRows: (sheetName: string) => unknown[][]
}

/**
 * Reads a .csv/.xlsx/.xls File client-side with SheetJS (`xlsx`) and
 * returns its sheet names plus a way to pull raw rows (array-of-arrays,
 * header row included as rows[0]) for whichever sheet the user picks.
 * Cell values keep their native type (numbers stay numbers, including
 * Excel date serials) so the import pipeline can tell an Excel date serial
 * apart from a plain numeric-looking string.
 */
export async function parseSpreadsheetFile(file: File): Promise<ParsedWorkbook> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheetNames = workbook.SheetNames

  return {
    sheetNames,
    getRows(sheetName: string): unknown[][] {
      const sheet = workbook.Sheets[sheetName]
      if (!sheet) return []
      return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: true,
        defval: null,
        blankrows: false,
      })
    },
  }
}
