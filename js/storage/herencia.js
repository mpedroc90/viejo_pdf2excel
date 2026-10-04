/* Plantillas de un PDF frente a las ya conocidas (localStorage). Drain generaliza distinto según el PDF,
   así que una plantilla ya revisada puede salir con otra forma. Si la nueva plantilla y una guardada se
   cubren o se parecen, la nueva hereda su marca, su concepto y deja de ser pendiente; las guardadas
   que quedan reemplazadas se quitan. Si las heredadas se contradicen, queda "Corregir". */
import { similitud, alinea } from "../domain/drain.js";
import { leeRevision, marcaRevision } from "./revision.js";
import { leeConceptos, marcaConcepto } from "./conceptos.js";
import { leeEjemplos, quitaEjemplos } from "./ejemplos.js";

var UMBRAL = 0.5, WILD = "<*>";

/* Tokens de una clave guardada, con los "<*>" seguidos comprimidos (multi = cubre uno o más tokens). */
function patron(clave) {
  var tpl = [], multi = [];
  clave.split(" ").forEach(function (t) {
    if (t === WILD && tpl.length && tpl[tpl.length - 1] === WILD) multi[multi.length - 1] = true;
    else { tpl.push(t); multi.push(false); }
  });
  return { tpl: tpl, multi: multi };
}

/* Un patrón cubre a otro si sus "<*>" absorben el texto del otro y al menos la mitad de sus tokens son fijos. */
function cubre(a, b) {
  var fijos = a.tpl.filter(function (t) { return t !== WILD; }).length;
  return fijos * 2 >= a.tpl.length && !!alinea(a.tpl, a.multi, b.tpl);
}

function relacionadas(p, g) {
  var a = { tpl: p.tokens, multi: p.multi || p.tokens.map(function () { return false; }) };
  return cubre(a, g) || cubre(g, a) || similitud(a.tpl, g.tpl) >= UMBRAL;
}

/* Añade a p.avisos "heredada" (recibió la marca de plantillas guardadas), "conflicto-herencia" (esas
   marcas se contradecían), o "nueva" (no se parece a ninguna guardada). Llamar antes de guardar ejemplos. */
export function heredaPlantillas(ps) {
  var rev = leeRevision(), con = leeConceptos(), gv = {};
  [rev, con, leeEjemplos()].forEach(function (m) { Object.keys(m).forEach(function (k) { gv[k] = true; }); });
  var claves = Object.keys(gv);
  if (!claves.length) return;
  var actuales = {};
  ps.forEach(function (p) { actuales[p.plantilla] = true; });
  var libres = claves.filter(function (k) { return !actuales[k]; }).map(function (k) { return { clave: k, pat: patron(k) }; });
  var usadas = {};
  ps.forEach(function (p) {
    if (gv[p.plantilla]) return;
    var rel = libres.filter(function (g) { return relacionadas(p, g.pat); });
    if (!rel.length) { p.avisos.push("nueva"); return; }
    rel.forEach(function (g) { usadas[g.clave] = true; });
    var estados = [], elegidos = { DB: [], CR: [] };
    rel.forEach(function (g) {
      if (rev[g.clave] && estados.indexOf(rev[g.clave]) < 0) estados.push(rev[g.clave]);
      ["DB", "CR"].forEach(function (o) {
        var c = con[g.clave] && con[g.clave][o];
        if (c && elegidos[o].indexOf(c) < 0) elegidos[o].push(c);
      });
    });
    var choque = estados.length > 1 || elegidos.DB.length > 1 || elegidos.CR.length > 1;
    if (estados.length) marcaRevision(p.plantilla, choque ? "mal" : estados[0]);
    else if (choque) marcaRevision(p.plantilla, "mal");
    ["DB", "CR"].forEach(function (o) { if (elegidos[o].length === 1) marcaConcepto(p.plantilla, o, elegidos[o][0]); });
    p.avisos.push(choque ? "conflicto-herencia" : "heredada");
  });
  /* Las guardadas que ya tienen heredera se quitan; las que no, se conservan. */
  Object.keys(usadas).forEach(function (k) {
    marcaRevision(k, "");
    ["DB", "CR"].forEach(function (o) { marcaConcepto(k, o, ""); });
    quitaEjemplos(k);
  });
}
