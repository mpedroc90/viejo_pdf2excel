/* Alias de comercios (localStorage).
   Comercios del PDF que no están en COMERCIOS: el usuario los asocia a uno
   conocido o los ignora. Se guarda por nombre normalizado. */
import { COMERCIOS, etiquetaComercio } from "../config.js";
import { sinTildes } from "../util.js";

var LS_ALIAS = "pdf2excel.alias", LS_IGNORADOS = "pdf2excel.ignorados";

function leeLS(key, def) {
  try {
    var v = JSON.parse(localStorage.getItem(key));
    return v && typeof v === "object" && Array.isArray(v) === Array.isArray(def) ? v : def;
  } catch (e) { return def; }
}
function guardaLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
}
function claveAlias(t) { return sinTildes(t).replace(/\s+/g, " ").trim().toUpperCase(); }

/* Código conocido al que apunta un nombre del PDF, o null. */
function aliasDe(alias, nombre) {
  var a = alias[claveAlias(nombre)];
  return a && COMERCIOS[a.codigo] ? a.codigo : null;
}

export function aplicaAlias(data) {
  var alias = leeLS(LS_ALIAS, {});
  data.rows.forEach(function (r) {
    if (r.comercioFijo || !r.comercioPdf) return;
    var k = aliasDe(alias, r.comercioPdf);
    r.comercio = k ? etiquetaComercio(k) : r.comercioPdf;
  });
  return data;
}

/* Nombres del PDF sin comercio conocido, sin alias y no ignorados. */
export function sinAlias(data) {
  var alias = leeLS(LS_ALIAS, {}), ign = leeLS(LS_IGNORADOS, []), vistos = {}, out = [];
  data.rows.forEach(function (r) {
    if (r.comercioFijo || !r.comercioPdf) return;
    var c = claveAlias(r.comercioPdf);
    if (aliasDe(alias, r.comercioPdf) || ign.indexOf(c) !== -1) return;
    if (!vistos[c]) { vistos[c] = { clave: c, nombre: r.comercioPdf, n: 0 }; out.push(vistos[c]); }
    vistos[c].n++;
  });
  return out;
}

/* Guarda la elección del usuario. codigos[i] es el código elegido para pend[i]
   ("" = ignorar); sin codigos se ignoran todos. */
export function guardaEleccion(pend, codigos) {
  var alias = leeLS(LS_ALIAS, {}), ign = leeLS(LS_IGNORADOS, []);
  pend.forEach(function (p, i) {
    var k = codigos ? codigos[i] : "";
    if (k && COMERCIOS[k]) {
      alias[p.clave] = { codigo: k, comercio: etiquetaComercio(k), pdf: p.nombre };
      var j = ign.indexOf(p.clave);
      if (j !== -1) ign.splice(j, 1);
    } else if (ign.indexOf(p.clave) === -1) {
      ign.push(p.clave);
    }
  });
  guardaLS(LS_ALIAS, alias);
  guardaLS(LS_IGNORADOS, ign);
}
