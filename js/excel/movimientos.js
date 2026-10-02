/* Hoja "Movimientos": una fila por operación, saldo como fórmula y notas. */
import { concepto } from "../domain/classify.js";
import { MONEY, NAVY, BAND, solid } from "./styles.js";

var HEADERS = ["Fecha", "Referencia", "Descripción", "Comercio / Beneficiario",
  "Débito (CUP)", "Crédito (CUP)", "Saldo calculado (CUP)", "Saldo según banco (CUP)",
  "Diferencia", "Detalle completo", "Concepto"];

/* Devuelve la última fila de datos y la fila de totales, que usa el Resumen. */
export function addMovimientos(wb, data) {
  var ws = wb.addWorksheet("Movimientos", { views: [{ state: "frozen", ySplit: 1 }] });

  ws.columns = [
    { width: 12 }, { width: 16 }, { width: 46 }, { width: 24 }, { width: 15 },
    { width: 15 }, { width: 19 }, { width: 21 }, { width: 12 }, { width: 60 },
    { width: 26, hidden: true }
  ];

  var head = ws.getRow(1);
  HEADERS.forEach(function (h, i) { head.getCell(i + 1).value = h; });
  head.height = 32;
  head.eachCell(function (c) {
    c.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = solid(NAVY);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  var r2 = ws.getRow(2);
  r2.getCell(1).value = data.meta.fecha || "";
  r2.getCell(3).value = "Saldo inicial";
  r2.getCell(7).value = data.opening;
  r2.getCell(7).font = { name: "Arial", size: 10, bold: true, color: { argb: "FF0000FF" } };
  r2.getCell(8).value = data.opening;

  data.rows.forEach(function (r, i) {
    var n = 3 + i, row = ws.getRow(n);
    row.getCell(1).value = r.fecha;
    row.getCell(2).value = r.ref;
    row.getCell(3).value = r.desc;
    row.getCell(4).value = r.comercio;
    if (r.debito !== null) row.getCell(5).value = r.debito;
    if (r.credito !== null) row.getCell(6).value = r.credito;
    row.getCell(7).value = { formula: "G" + (n - 1) + "-N(E" + n + ")+N(F" + n + ")", result: r.saldoCalc };
    row.getCell(8).value = r.saldoBanco;
    row.getCell(9).value = { formula: "ROUND(G" + n + "-H" + n + ",2)", result: r.dif };
    row.getCell(10).value = r.obs;
    row.getCell(11).value = r.concepto || concepto(r.obs || r.desc);
  });

  var last = 2 + data.rows.length, tot = last + 1;
  var t = ws.getRow(tot);
  t.getCell(3).value = "TOTALES";
  t.getCell(5).value = { formula: "SUM(E3:E" + last + ")", result: data.totalDebito };
  t.getCell(6).value = { formula: "SUM(F3:F" + last + ")", result: data.totalCredito };
  t.getCell(7).value = { formula: "G" + last, result: data.closing };
  t.getCell(8).value = { formula: "H" + last, result: data.rows.length ? data.rows[data.rows.length - 1].saldoBanco : data.opening };
  t.getCell(9).value = { formula: "SUM(I3:I" + last + ")", result: 0 };

  for (var n2 = 2; n2 <= tot; n2++) {
    var row2 = ws.getRow(n2);
    for (var c = 1; c <= 10; c++) {
      var cell = row2.getCell(c);
      cell.font = { name: "Arial", size: 10, bold: n2 === tot };
      cell.border = { bottom: { style: "thin", color: { argb: "FFBFBFBF" } } };
      if (c >= 5 && c <= 9) cell.numFmt = MONEY;
      if (c === 1) cell.alignment = { horizontal: "center" };
      if (c === 3 || c === 4) cell.alignment = { vertical: "top", wrapText: true };
      if (c === 10) cell.alignment = { vertical: "top" };
      if (n2 === tot) cell.fill = solid(BAND);
    }
  }
  ws.autoFilter = { from: "A1", to: "J" + last };

  var notes = [
    "Notas:",
    "• Datos extraídos del PDF “Estado de Cuenta” de Banca Remota" +
      (data.meta.cuenta ? ", cuenta " + data.meta.cuenta : "") +
      (data.meta.periodo ? ", período " + data.meta.periodo : "") + ".",
    "• El PDF trae una sola columna “Importe” con un indicador de operación (CR/DB); CR se colocó en Crédito y DB en Débito.",
    "• El “Saldo calculado” es una fórmula: saldo anterior − débito + crédito. El “Saldo según banco” es el que imprime el PDF.",
    "• La columna Diferencia debe ser 0 en todas las filas (comprobación de la extracción).",
    "• El saldo inicial (en azul) es el único importe fijo; proviene de la primera línea del estado de cuenta.",
    "• La columna K (oculta) guarda el Concepto de cada fila (Pago recibido, Comisión, Transferencia automática, Bonificación, Nómina, Otro). La hoja Resumen muestra, por comercio, todos los conceptos, el grupo Tránsito con su subtotal y el subtotal del comercio.",
    "• Tránsito: operación cuya fecha en la descripción (FECHA / FECHA CONTABLE / FECHA PAGO) cae en un mes distinto al de la fila; conserva su concepto con el prefijo “Tránsito · ”."
  ];
  notes.forEach(function (txt, i) {
    var cell = ws.getRow(tot + 2 + i).getCell(3);
    cell.value = txt;
    cell.font = { name: "Arial", size: i === 0 ? 10 : 9, bold: i === 0, italic: i > 0 };
  });

  return { last: last, tot: tot };
}
