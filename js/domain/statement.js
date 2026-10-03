/* Convierte las operaciones crudas del PDF en el estado de cuenta:
   filas normalizadas, saldo inicial/final, totales y comprobación de saldos. */
import { conceptoTransito } from "../config.js";
import { num, round2 } from "../util.js";
import { fields, esTransito } from "./classify.js";

function totales(rows) {
  return {
    totalCredito: rows.reduce(function (a, r) { return a + (r.credito || 0); }, 0),
    totalDebito: rows.reduce(function (a, r) { return a + (r.debito || 0); }, 0)
  };
}

/* txs: [{ pagina, fecha, ref[], obs[], oper, imp[], saldo[] }] tal como salen del PDF. */
export function buildStatement(txs, meta) {
  if (!txs.length) throw new Error("No se encontró ninguna operación en el PDF. ¿Es un estado de cuenta de Banca Remota?");
  var rows = [], fecha = "", first = txs[0];
  var opening = null;

  if (/Saldo\s*Inicial/i.test(first.obs.join(""))) {
    opening = num(first.saldo.join(""));
    fecha = first.fecha;
    txs = txs.slice(1);
  }

  txs.forEach(function (t) {
    if (t.fecha) fecha = t.fecha;
    var f = fields(t.obs.join(""), t.oper === "DB" ? "DB" : "CR");
    var imp = num(t.imp.join("")) || 0;
    rows.push({
      fecha: fecha,
      ref: t.ref.join("").replace(/\s/g, ""),
      desc: f.desc,
      comercio: f.comercio,
      comercioPdf: f.comercioPdf,
      comercioFijo: f.comercioFijo,
      concepto: esTransito(fecha, f.obs) ? conceptoTransito(f.concepto) : f.concepto,
      debito: t.oper === "DB" ? imp : null,
      credito: t.oper === "DB" ? null : imp,
      saldoBanco: num(t.saldo.join("")),
      obs: f.obs,
      pagina: t.pagina
    });
  });

  if (opening === null && rows.length) {
    var r0 = rows[0];
    opening = (r0.saldoBanco || 0) - (r0.credito || 0) + (r0.debito || 0);
  }

  var run = opening, mism = 0;
  rows.forEach(function (r) {
    run = round2(run - (r.debito || 0) + (r.credito || 0));
    r.saldoCalc = run;
    r.dif = r.saldoBanco === null ? 0 : round2(run - r.saldoBanco);
    if (r.dif !== 0) mism++;
  });

  meta.fecha = fecha;
  if (!meta.periodo && fecha) meta.periodo = fecha;
  var t = totales(rows);
  return {
    rows: rows, meta: meta, opening: opening, closing: run, mismatches: mism,
    totalCredito: t.totalCredito, totalDebito: t.totalDebito
  };
}

export { totales };
