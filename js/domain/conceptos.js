/* Concepto de cada fila: el elegido en su plantilla si está marcada "Correcta";
   si no, el que decide la clasificación por reglas (config.js), guardado en conceptoAuto. */
import { conceptoTransito } from "../config.js";
import { esTransito } from "./classify.js";

export var operDe = function (r) { return r.debito != null ? "DB" : "CR"; };

/* ps: plantillas con "ids"; rev: plantilla -> "ok"|"mal"; elegidos: plantilla -> {DB, CR}. */
export function aplicaConceptos(rows, ps, rev, elegidos) {
  rows.forEach(function (r) {
    if (r.conceptoAuto == null) r.conceptoAuto = r.concepto;
    r.concepto = r.conceptoAuto;
  });
  ps.forEach(function (p) {
    var e = rev[p.plantilla] === "ok" && elegidos[p.plantilla];
    if (!e) return;
    p.ids.forEach(function (i) {
      var r = rows[i], c = e[operDe(r)];
      if (c) r.concepto = esTransito(r.fecha, r.obs) ? conceptoTransito(c) : c;
    });
  });
}
