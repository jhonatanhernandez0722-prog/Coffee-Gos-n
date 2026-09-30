import * as XLSX from "xlsx-js-style";

type ExcelValue = string | number | boolean | null | undefined;

const currencyColumn = /valor|total|monto|pendiente|original|pagado|ingresos?|egresos?|costo|precio|saldo|ganancia/i;
const countColumn = /cantidad|unidades|registros|compras|soportes|líneas/i;
const textOnlyColumn = /tel[eé]fono|celular|phone|identificaci[oó]n|documento|c[oó]digo|pin/i;
const numericText = /^-?\d+(\.\d+)?$/;
const isoDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const longTextLimit = 45;

function themeColor(token: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1).toUpperCase() : fallback;
}

/** Montos que llegan como texto desde la API ("12000.00") se exportan como números. */
function normalizeRows(rows: Record<string, ExcelValue>[]) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([column, value]) => [
    column,
    typeof value === "string" && numericText.test(value.trim()) && !textOnlyColumn.test(column)
      ? Number(value)
      : typeof value === "string" && isoDateTime.test(value)
        ? new Date(value).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })
        : value,
  ])));
}

/** Texto tal como lo verá la persona en Excel, para calcular el ancho de la columna. */
function displayText(value: ExcelValue, isCurrency: boolean) {
  if (typeof value === "number") {
    const formatted = new Intl.NumberFormat("es-CO", { maximumFractionDigits: isCurrency ? 0 : 3 }).format(value);
    return isCurrency ? `$ ${formatted}` : formatted;
  }
  return String(value ?? "");
}

/** Descarga un informe de Excel con título, encabezado de color, filas alternadas, contenido centrado y columnas autoajustadas. */
export function downloadExcel(sourceRows: Record<string, ExcelValue>[], filename: string, sheetName = "Datos") {
  const rows = normalizeRows(sourceRows);
  const accent = themeColor("--blue-main", "087EA4");
  const ink = themeColor("--ink", "083344");
  const soft = themeColor("--blue-light", "CFFAFE");
  const columns = rows.length ? Object.keys(rows[0]) : ["Sin datos"];
  const title = `Coffee Gosen · ${sheetName}`;
  const generated = `Generado el ${new Date().toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" })} · ${rows.length} registro(s)`;

  const worksheet = XLSX.utils.aoa_to_sheet([[title], [generated], []]);
  XLSX.utils.sheet_add_json(worksheet, rows.length ? rows : [{ "Sin datos": "No hay registros para exportar" }], { origin: "A4" });

  const border = { style: "thin", color: { rgb: "D9E2E7" } };
  const cellBorder = { top: border, bottom: border, left: border, right: border };
  const lastColumn = Math.max(columns.length - 1, 0);
  const headerRow = 3;
  const lastRow = headerRow + Math.max(rows.length, 1);

  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastColumn } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastColumn } },
  ];
  const titleStyle = { font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: ink } }, alignment: { vertical: "center", horizontal: "center" } };
  const subtitleStyle = { font: { italic: true, sz: 10, color: { rgb: "5B6B73" } }, alignment: { vertical: "center", horizontal: "center" } };
  for (let column = 0; column <= lastColumn; column += 1) {
    const titleAddress = XLSX.utils.encode_cell({ r: 0, c: column });
    const subtitleAddress = XLSX.utils.encode_cell({ r: 1, c: column });
    worksheet[titleAddress] = { ...(worksheet[titleAddress] ?? { t: "s", v: "" }), s: titleStyle };
    worksheet[subtitleAddress] = { ...(worksheet[subtitleAddress] ?? { t: "s", v: "" }), s: subtitleStyle };
  }

  const widths = columns.map((column, columnIndex) => {
    const isCurrency = currencyColumn.test(column) && !countColumn.test(column);
    const headerAddress = XLSX.utils.encode_cell({ r: headerRow, c: columnIndex });
    if (worksheet[headerAddress]) {
      worksheet[headerAddress].s = { font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: accent } }, alignment: { vertical: "center", horizontal: "center" }, border: cellBorder };
    }
    let longest = Math.ceil(column.length * 1.15);
    for (let row = headerRow + 1; row <= lastRow; row += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: columnIndex });
      const cell = worksheet[address] ?? (worksheet[address] = { t: "s", v: "" });
      const text = displayText(cell.v as ExcelValue, isCurrency);
      const isLongText = cell.t !== "n" && text.length > longTextLimit;
      longest = Math.max(longest, isLongText ? longTextLimit : text.length);
      cell.s = {
        font: { sz: 11, color: { rgb: "1F2D35" } },
        fill: { fgColor: { rgb: (row - headerRow) % 2 === 0 ? soft : "FFFFFF" } },
        alignment: { vertical: "center", horizontal: isLongText ? "left" : "center", wrapText: isLongText },
        border: cellBorder,
      };
      if (cell.t === "n") cell.z = isCurrency ? '"$" #,##0' : Number.isInteger(cell.v) ? "#,##0" : "#,##0.###";
    }
    return Math.min(Math.max(longest + 4, 10), longTextLimit + 4);
  });

  // El título ocupa todas las columnas; si la tabla es angosta se ensancha la primera para que quepa.
  const tableWidth = widths.reduce((sum, width) => sum + width, 0);
  const titleWidth = Math.max(title.length * 1.6, generated.length * 0.95);
  if (tableWidth < titleWidth) widths[0] += Math.ceil(titleWidth - tableWidth);

  worksheet["!cols"] = widths.map((wch) => ({ wch }));
  worksheet["!rows"] = [{ hpt: 32 }, { hpt: 20 }, { hpt: 8 }, { hpt: 26 }];
  worksheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: lastRow, c: lastColumn } }) };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, filename);
}
