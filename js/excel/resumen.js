/* Hoja "Resumen": informe por comercio y concepto, totales por concepto y cuadre del período.
   Las cifras son fórmulas sobre la hoja Movimientos (con el resultado precalculado). */
import { TRANSITO, CONCEPTO_TRANSITO, CONCEPTO_TODOS } from "../config.js";
import { concepto } from "../domain/classify.js";
import { round2 } from "../util.js";
import { MONEY_N, NAVY, BAND, SOFT, GREY, TR_TEXT, TR_HEAD, TR_SOFT, BOX, solid } from "./styles.js";

/* Etiqueta de las operaciones de la cuenta que no pertenecen a ningun comercio. */
var SIN_COM = "Sin comercio asociado";

/* Cita un texto para usarlo como criterio literal dentro de una formula. */
function q(t) { return '"' + String(t).replace(/"/g, '""') + '"'; }

function sumFilas(col, filas) {
  return filas.map(function (r) { return col + r; }).join("+") || "0";
}

/* En el Resumen el grupo ya dice "Tránsito": se muestra el concepto sin prefijo. */
function etiquetaConcepto(con) {
  return con.indexOf(TRANSITO) === 0 ? con.slice(TRANSITO.length) : con;
}

/* mov: { last, tot } filas de la hoja Movimientos (última de datos y totales). */
export function addResumen(wb, data, mov) {
  var last = mov.last, tot = mov.tot;

  var ws2 = wb.addWorksheet("Resumen", {
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: {
      paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 }
    }
  });
  ws2.pageSetup.printTitlesRow = "5:5";
  ws2.headerFooter = { oddFooter: "&LResumen de operaciones&CPagina &P de &N&R&D" };
  ws2.columns = [{ width: 30 }, { width: 26 }, { width: 11 }, { width: 16 }, { width: 16 }, { width: 16 }];

  function banner(rn, txt, size, fg, bg) {
    ws2.mergeCells(rn, 1, rn, 6);
    var c = ws2.getRow(rn).getCell(1);
    c.value = txt;
    c.font = { name: "Arial", size: size, bold: true, color: { argb: fg } };
    c.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    if (bg) c.fill = solid(bg);
    return c;
  }

  /* Fila de cabecera del grupo Tránsito (columnas B:F combinadas). */
  function cabeceraTransito(r, desde) {
    ws2.getRow(r).getCell(desde).value = "EN TRÁNSITO (fecha de la operación en otro mes)";
  }

  /* Encabezado del informe */
  ws2.getRow(1).height = 26;
  banner(1, "RESUMEN DE OPERACIONES POR COMERCIO Y CONCEPTO", 13, "FFFFFFFF", NAVY);
  banner(2, "Cuenta: " + (data.meta.cuenta || "—") + "   ·   Período: " + (data.meta.periodo || "—"), 10, "FF1F3864", SOFT);
  banner(3, "Importes en CUP   ·   Generado el " + new Date().toLocaleDateString("es-CU") +
    "   ·   " + data.rows.length + " operaciones extraídas de " + data.meta.paginas + " página(s) del PDF",
    9, "FF5A6472", SOFT).font = { name: "Arial", size: 9, italic: true, color: { argb: "FF5A6472" } };
  ws2.getRow(4).height = 6;

  var HEAD2 = ["Comercio / Beneficiario", "Concepto", "Nº de op.", "Crédito (CUP)", "Débito (CUP)", "Neto (CUP)"];
  var h2 = ws2.getRow(5);
  h2.height = 30;
  HEAD2.forEach(function (h, i) {
    var c = h2.getCell(i + 1);
    c.value = h;
    c.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = solid(NAVY);
    c.alignment = { horizontal: i < 2 ? "left" : "center", vertical: "middle", wrapText: true, indent: i < 2 ? 1 : 0 };
    c.border = BOX;
  });

  /* --- bloque 1: por comercio y concepto --- */
  /* Agregado por par comercio x concepto, y en paralelo por concepto suelto. */
  var agg = {}, order = [], porConcepto = {};
  data.rows.forEach(function (r) {
    var com = r.comercio || SIN_COM;
    var con = r.concepto || concepto(r.obs || r.desc);
    var k = com + " » " + con;
    if (!agg[k]) { agg[k] = { com: com, con: con, n: 0, cr: 0, db: 0 }; order.push(k); }
    agg[k].n++; agg[k].cr += r.credito || 0; agg[k].db += r.debito || 0;
    porConcepto[con] = porConcepto[con] || { n: 0, cr: 0, db: 0 };
    porConcepto[con].n++; porConcepto[con].cr += r.credito || 0; porConcepto[con].db += r.debito || 0;
  });

  /* Cada comercio lleva todos los conceptos, aunque no tengan movimientos (salen a cero). */
  order.map(function (k) { return agg[k].com; })
    .filter(function (com, i, arr) { return arr.indexOf(com) === i; })
    .forEach(function (com) {
      CONCEPTO_TODOS.forEach(function (con) {
        var k = com + " » " + con;
        if (!agg[k]) { agg[k] = { com: com, con: con, n: 0, cr: 0, db: 0 }; order.push(k); }
      });
    });

  /* Comercios alfabeticos, "(sin comercio)" al final; dentro, conceptos en orden fijo
     (primero los regulares, luego el grupo Tránsito). */
  var keys = order.sort(function (ka, kb) {
    var x = agg[ka], y = agg[kb];
    if (x.com !== y.com) {
      if (x.com === SIN_COM) return 1;
      if (y.com === SIN_COM) return -1;
      return x.com.localeCompare(y.com, "es");
    }
    return CONCEPTO_TODOS.indexOf(x.con) - CONCEPTO_TODOS.indexOf(y.con);
  });

  var D = "Movimientos!$D$3:$D$" + last, K = "Movimientos!$K$3:$K$" + last;
  var CR = "Movimientos!$F$3:$F$" + last, DB = "Movimientos!$E$3:$E$" + last;

  var n = 5, merges = [], subtotalRows = [], comercioRows = [], shadedRows = [];
  var trHeadRows = [], trSubRows = [], trDetRows = [];
  var blockStart = 0, blockRows = [], trRows = [], shade = false;

  /* Cierra un comercio: Subtotal Tránsito (solo su grupo) y Subtotal del comercio
     (regulares + Subtotal Tránsito). */
  function cierraBloque(com) {
    if (!blockRows.length) return;
    var regRows = blockRows.filter(function (r) { return trRows.indexOf(r) === -1; });
    var partes = regRows.slice();
    if (trRows.length) {
      n++;
      var ts = ws2.getRow(n);
      ts.getCell(2).value = "Subtotal Tránsito";
      ["C", "D", "E"].forEach(function (col, i) {
        ts.getCell(3 + i).value = { formula: sumFilas(col, trRows) };
      });
      ts.getCell(6).value = { formula: "D" + n + "-E" + n };
      trSubRows.push(n);
      partes.push(n);
    }
    if (partes.length > 1) {
      n++;
      var sr = ws2.getRow(n);
      sr.getCell(2).value = "Subtotal " + com;
      ["C", "D", "E"].forEach(function (col, i) {
        sr.getCell(3 + i).value = { formula: sumFilas(col, partes) };
      });
      sr.getCell(6).value = { formula: "D" + n + "-E" + n };
      subtotalRows.push(n);
    }
    comercioRows.push(n);
    if (n > blockStart) merges.push([blockStart, n]);
    blockRows = []; trRows = [];
    shade = !shade;
  }

  keys.forEach(function (k, i) {
    var g = agg[k], prev = i ? agg[keys[i - 1]] : null;
    if (prev && prev.com !== g.com) cierraBloque(prev.com);
    var esTr = CONCEPTO_TRANSITO.indexOf(g.con) !== -1;
    n++;
    if (!blockRows.length) blockStart = n;
    if (esTr && !trRows.length) {
      ws2.getRow(n).getCell(1).value = g.com;
      cabeceraTransito(n, 2);
      trHeadRows.push(n);
      n++;
    }
    var row = ws2.getRow(n);
    var critCom = g.com === SIN_COM ? '""' : q(g.com);
    row.getCell(1).value = g.com;
    row.getCell(2).value = etiquetaConcepto(g.con);
    row.getCell(3).value = { formula: "COUNTIFS(" + D + "," + critCom + "," + K + "," + q(g.con) + ")", result: g.n };
    row.getCell(4).value = { formula: "SUMIFS(" + CR + "," + D + "," + critCom + "," + K + "," + q(g.con) + ")", result: round2(g.cr) };
    row.getCell(5).value = { formula: "SUMIFS(" + DB + "," + D + "," + critCom + "," + K + "," + q(g.con) + ")", result: round2(g.db) };
    row.getCell(6).value = { formula: "D" + n + "-E" + n, result: round2(g.cr - g.db) };
    if (shade && !esTr) shadedRows.push(n);
    blockRows.push(n);
    if (esTr) { trRows.push(n); trDetRows.push(n); }
  });
  if (keys.length) cierraBloque(agg[keys[keys.length - 1]].com);

  /* TOTAL GENERAL: suma el subtotal de cada comercio (incluye su Tránsito). */
  function sumDetalle(col) { return sumFilas(col, comercioRows); }
  n++;
  var rt = n, tr = ws2.getRow(rt);
  ws2.mergeCells(rt, 1, rt, 2);
  tr.getCell(1).value = "TOTAL GENERAL";
  tr.getCell(3).value = { formula: sumDetalle("C"), result: data.rows.length };
  tr.getCell(4).value = { formula: sumDetalle("D"), result: round2(data.totalCredito) };
  tr.getCell(5).value = { formula: sumDetalle("E"), result: round2(data.totalDebito) };
  tr.getCell(6).value = { formula: "D" + rt + "-E" + rt, result: round2(data.totalCredito - data.totalDebito) };

  /* Estilo del bloque principal */
  for (var r2 = 6; r2 <= rt; r2++) {
    var esSub = subtotalRows.indexOf(r2) !== -1, esTot = r2 === rt, esGris = shadedRows.indexOf(r2) !== -1;
    var esTrHead = trHeadRows.indexOf(r2) !== -1, esTrSub = trSubRows.indexOf(r2) !== -1;
    var esTrDet = trDetRows.indexOf(r2) !== -1, esTrAny = esTrHead || esTrSub || esTrDet;
    for (var c2 = 1; c2 <= 6; c2++) {
      var cc = ws2.getRow(r2).getCell(c2);
      cc.border = BOX;
      cc.font = {
        name: "Arial", size: esTrHead ? 9 : 10, bold: esSub || esTot || esTrHead || esTrSub,
        italic: (esSub || esTrSub) && c2 === 2,
        color: esTrAny && c2 > 1 ? { argb: TR_TEXT } : undefined
      };
      cc.alignment = {
        horizontal: c2 <= 2 ? "left" : c2 === 3 ? "center" : "right",
        vertical: c2 === 1 ? "middle" : "center", wrapText: c2 <= 2,
        indent: c2 === 2 && esTrDet ? 3 : 1
      };
      if (c2 === 3) cc.numFmt = "#,##0";
      if (c2 >= 4) cc.numFmt = MONEY_N;
      /* Columna A va combinada por comercio: manda el sombreado del bloque. */
      if (c2 === 1 && !esTot) {
        if (esGris) cc.fill = solid(SOFT);
        continue;
      }
      if (esTot) cc.fill = solid(BAND);
      else if (esTrHead || esTrSub) cc.fill = solid(TR_HEAD);
      else if (esTrDet) cc.fill = solid(TR_SOFT);
      else if (esSub) cc.fill = solid(GREY);
      else if (esGris) cc.fill = solid(SOFT);
    }
  }
  trHeadRows.forEach(function (r) { ws2.mergeCells(r, 2, r, 6); });
  /* Una sola celda de comercio por bloque. */
  merges.forEach(function (m) { if (m[1] > m[0]) ws2.mergeCells(m[0], 1, m[1], 1); });

  /* --- bloque 2: totales por concepto (todos los comercios juntos) --- */
  n = rt + 2;
  banner(n, "TOTALES POR CONCEPTO", 11, "FFFFFFFF", NAVY);
  n++;
  var hc = ws2.getRow(n);
  ["Concepto", "", "Nº de op.", "Crédito (CUP)", "Débito (CUP)", "Neto (CUP)"].forEach(function (h, i) {
    var c = hc.getCell(i + 1);
    c.value = h;
    c.font = { name: "Arial", size: 10, bold: true, color: { argb: NAVY } };
    c.fill = solid(BAND);
    c.alignment = { horizontal: i < 2 ? "left" : i === 2 ? "center" : "right", indent: 1 };
    c.border = BOX;
  });
  ws2.mergeCells(n, 1, n, 2);

  var concFilas = [], trFilas = [], trHeadRow = 0;
  /* Todos los conceptos, aunque no tengan movimientos (salen a cero):
     regulares, luego el grupo Tránsito con su cabecera y subtotal. */
  CONCEPTO_TODOS.forEach(function (con) {
    var esTr = CONCEPTO_TRANSITO.indexOf(con) !== -1;
    n++;
    if (esTr && !trHeadRow) {
      trHeadRow = n;
      cabeceraTransito(n, 1);
      ws2.mergeCells(n, 1, n, 6);
      n++;
    }
    var g = porConcepto[con] || { n: 0, cr: 0, db: 0 }, row = ws2.getRow(n);
    row.getCell(1).value = etiquetaConcepto(con);
    row.getCell(3).value = { formula: "COUNTIF(" + K + "," + q(con) + ")", result: g.n };
    row.getCell(4).value = { formula: "SUMIF(" + K + "," + q(con) + "," + CR + ")", result: round2(g.cr) };
    row.getCell(5).value = { formula: "SUMIF(" + K + "," + q(con) + "," + DB + ")", result: round2(g.db) };
    row.getCell(6).value = { formula: "D" + n + "-E" + n, result: round2(g.cr - g.db) };
    ws2.mergeCells(n, 1, n, 2);
    concFilas.push(n);
    if (esTr) trFilas.push(n);
  });
  n++;
  var trSubRow = n, ts = ws2.getRow(trSubRow);
  ts.getCell(1).value = "Subtotal Tránsito";
  ["C", "D", "E"].forEach(function (col, i) {
    ts.getCell(3 + i).value = { formula: sumFilas(col, trFilas) };
  });
  ts.getCell(6).value = { formula: "D" + trSubRow + "-E" + trSubRow };
  ws2.mergeCells(trSubRow, 1, trSubRow, 2);
  /* TOTAL: suma solo las filas de concepto, nunca el subtotal. */
  n++;
  var ctRow = n, ct = ws2.getRow(ctRow);
  ct.getCell(1).value = "TOTAL";
  ct.getCell(3).value = { formula: sumFilas("C", concFilas), result: data.rows.length };
  ct.getCell(4).value = { formula: sumFilas("D", concFilas), result: round2(data.totalCredito) };
  ct.getCell(5).value = { formula: sumFilas("E", concFilas), result: round2(data.totalDebito) };
  ct.getCell(6).value = { formula: "D" + ctRow + "-E" + ctRow, result: round2(data.totalCredito - data.totalDebito) };
  ws2.mergeCells(ctRow, 1, ctRow, 2);

  for (var r3 = concFilas[0]; r3 <= ctRow; r3++) {
    var esTrH = r3 === trHeadRow || r3 === trSubRow, esTrD = trFilas.indexOf(r3) !== -1;
    for (var c4 = 1; c4 <= 6; c4++) {
      var c5 = ws2.getRow(r3).getCell(c4);
      c5.border = BOX;
      c5.font = {
        name: "Arial", size: r3 === trHeadRow ? 9 : 10, bold: r3 === ctRow || esTrH, italic: r3 === trSubRow,
        color: esTrH || esTrD ? { argb: TR_TEXT } : undefined
      };
      c5.alignment = { horizontal: c4 <= 2 ? "left" : c4 === 3 ? "center" : "right", indent: c4 === 1 && esTrD ? 3 : 1 };
      if (c4 === 3) c5.numFmt = "#,##0";
      if (c4 >= 4) c5.numFmt = MONEY_N;
      if (r3 === ctRow) c5.fill = solid(BAND);
      else if (esTrH) c5.fill = solid(TR_HEAD);
      else if (esTrD) c5.fill = solid(TR_SOFT);
    }
  }

  /* --- bloque 3: cuadre del periodo --- */
  n = ctRow + 2;
  banner(n, "CUADRE DEL PERÍODO", 11, "FFFFFFFF", NAVY);
  var saldoFinalBanco = data.rows.length ? data.rows[data.rows.length - 1].saldoBanco : data.opening;
  var cuadre = [
    ["Saldo inicial", "Movimientos!$G$2", data.opening, false],
    ["(+) Total créditos del período", "Movimientos!$F$" + tot, data.totalCredito, false],
    ["(−) Total débitos del período", "Movimientos!$E$" + tot, data.totalDebito, false],
    ["(=) Saldo final calculado", "Movimientos!$G$" + tot, data.closing, true],
    ["Saldo final según el banco", "Movimientos!$H$" + tot, saldoFinalBanco, false],
    ["Diferencia (debe ser 0.00)", "Movimientos!$I$" + tot, 0, true]
  ];
  var cuadreIni = n + 1;
  cuadre.forEach(function (it, i) {
    var rn = cuadreIni + i, row = ws2.getRow(rn);
    row.getCell(1).value = it[0];
    row.getCell(5).value = { formula: it[1], result: it[2] };
    for (var c6 = 1; c6 <= 6; c6++) {
      var cq = row.getCell(c6);
      cq.border = BOX;
      cq.font = { name: "Arial", size: 10, bold: it[3], color: { argb: it[3] ? NAVY : "FF000000" } };
      cq.alignment = { horizontal: c6 <= 4 ? "left" : "right", indent: 1 };
      if (c6 >= 5) cq.numFmt = MONEY_N;
      if (it[3]) cq.fill = solid(BAND);
    }
    ws2.mergeCells(rn, 1, rn, 4);
    ws2.mergeCells(rn, 5, rn, 6);
  });

  var avisoRow = cuadreIni + cuadre.length + 1;
  var aviso = ws2.getRow(avisoRow).getCell(1);
  aviso.value = data.mismatches === 0
    ? "Cuadre correcto: el saldo calculado coincide con el del banco en todas las operaciones."
    : "ATENCIÓN: " + data.mismatches + " operación(es) con diferencia. Revise la columna Diferencia de la hoja Movimientos.";
  aviso.font = {
    name: "Arial", size: 9, italic: true, bold: data.mismatches !== 0,
    color: { argb: data.mismatches === 0 ? "FF2E7D32" : "FFC62828" }
  };
  aviso.alignment = { horizontal: "left", indent: 1 };
  ws2.mergeCells(avisoRow, 1, avisoRow, 6);
}
