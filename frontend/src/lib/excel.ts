import * as XLSX from "xlsx";

type ExcelValue = string | number | boolean | null | undefined;

export function downloadExcel(rows: Record<string, ExcelValue>[], filename: string, sheetName = "Datos") {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const columns = rows.length ? Object.keys(rows[0]) : [];
  worksheet["!cols"] = columns.map((column) => {
    const longest = Math.max(column.length, ...rows.map((row) => String(row[column] ?? "").length));
    return { wch: Math.min(Math.max(longest + 2, 12), 60) };
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, filename);
}
