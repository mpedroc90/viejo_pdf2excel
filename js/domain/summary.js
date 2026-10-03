/* Agregados para el resumen en pantalla: por concepto y por comercio. */
import { CONCEPTO_TODOS } from "../config.js";
import { concepto } from "./classify.js";
import { round2 } from "../util.js";

var SIN_COM = "Sin comercio asociado";

function add(map, key, r) {
  var g = map[key] || (map[key] = { k: key, n: 0, cr: 0, db: 0 });
  g.n++; g.cr += r.credito || 0; g.db += r.debito || 0;
}

function finish(g) { g.cr = round2(g.cr); g.db = round2(g.db); g.neto = round2(g.cr - g.db); return g; }

export function resumen(data) {
  var porCon = {}, porCom = {};
  data.rows.forEach(function (r) {
    add(porCon, r.concepto || concepto(r.obs || r.desc), r);
    add(porCom, r.comercio || SIN_COM, r);
  });
  var conceptos = CONCEPTO_TODOS.filter(function (c) { return porCon[c]; })
    .concat(Object.keys(porCon).filter(function (c) { return CONCEPTO_TODOS.indexOf(c) === -1; }))
    .map(function (c) { return finish(porCon[c]); });
  var comercios = Object.keys(porCom).sort(function (a, b) {
    if (a === SIN_COM) return 1;
    if (b === SIN_COM) return -1;
    return a.localeCompare(b, "es");
  }).map(function (c) { return finish(porCom[c]); });
  return { conceptos: conceptos, comercios: comercios };
}
