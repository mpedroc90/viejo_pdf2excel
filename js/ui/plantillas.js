/* Pestaña Plantillas: una tarjeta por plantilla para revisarla a ojo. */
import { fmt, sinTildes } from "../util.js";
import { FECHA_FORMATOS } from "../domain/classify.js";
import { CONCEPTO_ORDEN } from "../config.js";
import { leeRevision, marcaRevision } from "../storage/revision.js";
import { leeConceptos, marcaConcepto } from "../storage/conceptos.js";

var $ = function (id) { return document.getElementById(id); };
function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

var AVISOS = {
  "sin-concepto": "Sin concepto (queda «Otro»)",
  "sin-fecha": "Sin fecha en la descripción",
  "sin-comercio": "Sin comercio",
  "mixto": "Filas con conceptos distintos",
  "alt-fec": "Hay otra fecha distinta en el texto",
  "alt-con": "Casan otros conceptos distintos"
};
var FILTROS = [
  ["todas", "Todas"], ["pendientes", "Pendientes"], ["avisos", "Con avisos"], ["mal", "Marcadas para corregir"], ["ok", "Correctas"]
];
var state = { ps: [], total: 1, rev: {}, over: {}, onChange: null, filtro: "pendientes", q: "", concepto: "", aviso: "", abiertas: {} };

/* Texto con los tramos extraídos resaltados. */
function resalta(texto, spans) {
  var marks = [];
  for (var i = 0; i < texto.length; i++) marks.push([]);
  spans.forEach(function (sp) { for (var i = sp.s; i < sp.e && i < texto.length; i++) marks[i].push(sp.c); });
  var out = "", i = 0;
  while (i < texto.length) {
    var j = i, k = marks[i].join(" ");
    while (j < texto.length && marks[j].join(" ") === k) j++;
    var seg = esc(texto.slice(i, j));
    out += k ? '<mark class="' + marks[i].map(function (c) { return "m-" + c; }).join(" ") + '">' + seg + "</mark>" : seg;
    i = j;
  }
  return out;
}

function plantillaHtml(p) {
  return p.tokens.map(function (t, i) {
    var m = p.marcas[i];
    return m.length ? '<mark class="' + m.map(function (c) { return "m-" + c; }).join(" ") + '">' + esc(t) + "</mark>" : esc(t);
  }).join(" ");
}

function campo(nombre, cls, valor, de) {
  return '<div class="campo"><div class="cn"><mark class="m-' + cls + '">' + nombre + "</mark></div><div class=\"cv\">" +
    (valor ? esc(valor) : '<span class="nada">no se encontró</span>') + "</div>" +
    (de ? '<div class="cd">' + de + "</div>" : "") + "</div>";
}

function ejemplo(e) {
  var transito = e.fecha && e.fechaFila && e.fecha.slice(-7) !== e.fechaFila.slice(-7) && e.fecha.length > 7;
  return '<li><div class="txt">' + resalta(e.texto, e.spans) + "</div>" +
    '<div class="res">' +
    campo("Concepto", "con", e.concepto, e.conceptoTxt ? "por «" + esc(e.conceptoTxt) + "»" : "") +
    campo("Fecha", "fec", e.fecha, e.fechaTxt ? "de «" + esc(e.fechaTxt) + "»" + (e.fechaFila ? " · fila: " + esc(e.fechaFila) : "") + (transito ? " · tránsito" : "") : "") +
    campo("Comercio", "com", e.comercio, e.comercioSrc ? esc(e.comercioSrc) : "") +
    "</div>" + alternativas(e) + "</li>";
}

var TIPOS = { fec: "Fecha", con: "Concepto" };
function alternativas(e) {
  if (!e.alt.length) return "";
  return '<ul class="alts">' + e.alt.map(function (a) {
    var f = a.src && FECHA_FORMATOS[a.src] ? FECHA_FORMATOS[a.src] : a.src;
    return '<li><mark class="m-alt-' + a.tipo + '">' + TIPOS[a.tipo] + " alterno</mark> «" + esc(a.texto) + "»" +
      (a.valor ? " → <b>" + esc(a.valor) + "</b>" : "") +
      (a.tipo === "fec" && a.valor && !a.dif ? " (misma fecha)" : "") +
      (f ? ' <span class="cd">' + esc(f) + "</span>" : "") +
      (a.nota ? ' <span class="cd">· ' + esc(a.nota) + "</span>" : "") +
      (a.dif ? ' <span class="dif">distinto del usado</span>' : "") + "</li>";
  }).join("") + "</ul>";
}

var SENTIDOS = [["DB", "Débito"], ["CR", "Crédito"]];

/* Concepto que se usa para un sentido: el elegido (solo si la plantilla está "Correcta") o el de las reglas. */
function efectivo(p, oper) {
  var e = state.rev[p.plantilla] === "ok" && state.over[p.plantilla];
  return (e && e[oper]) || p.auto[oper];
}
function conceptosDe(p) {
  var c = [];
  SENTIDOS.forEach(function (s) {
    var k = efectivo(p, s[0]);
    if (k && c.indexOf(k) < 0) c.push(k);
  });
  return c;
}

/* Un selector por sentido que tenga filas. Elegir el concepto de las reglas quita la elección. */
function selectores(p) {
  var est = state.rev[p.plantilla], e = state.over[p.plantilla] || {};
  return '<div class="elige">' + SENTIDOS.filter(function (s) { return p.auto[s[0]]; }).map(function (s) {
    var o = s[0], act = e[o] || p.auto[o], lista = CONCEPTO_ORDEN.indexOf(act) < 0 ? CONCEPTO_ORDEN.concat(act) : CONCEPTO_ORDEN;
    return '<label>' + s[1] + ' <select data-o="' + o + '">' + lista.map(function (k) {
      return '<option value="' + esc(k) + '"' + (k === act ? " selected" : "") + ">" + esc(k) + (k === p.auto[o] ? " (reglas)" : "") + "</option>";
    }).join("") + "</select></label>" +
      (e[o] && est !== "ok" ? ' <span class="cd">se aplica al marcar «Correcta»</span>' : "");
  }).join("") + "</div>";
}

function tarjeta(p, idx) {
  var est = state.rev[p.plantilla] || "";
  var avisos = p.avisos.map(function (a) { return '<span class="aviso">' + esc(AVISOS[a]) + "</span>"; }).join("");
  var fe = p.fechaSrc ? FECHA_FORMATOS[p.fechaSrc] || p.fechaSrc : "";
  return '<details class="card ' + est + '" data-i="' + idx + '"' + (state.abiertas[p.plantilla] ? " open" : "") + ">" +
    '<summary><span class="est" aria-hidden="true">' + (est === "ok" ? "✓" : est === "mal" ? "!" : "") + "</span>" +
    '<span class="tp"><code>' + plantillaHtml(p) + "</code></span>" +
    '<span class="bd"><b>' + esc(conceptosDe(p).join(" / ")) + "</b> · " + p.n + " op. (" + (p.n * 100 / state.total).toFixed(1) + "%)</span>" +
    (avisos ? '<span class="avisos">' + avisos + "</span>" : "") +
    '<span class="rapido">' + selectores(p) +
    '<button class="btn ' + (est === "ok" ? "" : "ghost") + '" data-r="ok">✓ Aceptar</button>' +
    '<button class="btn ' + (est === "mal" ? "" : "ghost") + '" data-r="mal">! Corregir</button></span></summary>' +
    '<div class="cuerpo">' +
    '<div class="tot">Crédito <b class="cr">' + fmt(p.cr) + '</b> · Débito <b class="db">' + fmt(p.db) + "</b>" +
    (fe ? " · Formato de fecha: <code>" + esc(fe) + "</code>" : "") + "</div>" +
    "<h4>Ejemplos (" + p.ejemplos.length + " de " + p.n + ")</h4><ol class=\"ejs\">" + p.ejemplos.map(ejemplo).join("") + "</ol>" +
    '<div class="rev"><button class="btn ' + (est === "ok" ? "" : "ghost") + '" data-r="ok">✓ Correcta</button>' +
    '<button class="btn ' + (est === "mal" ? "" : "ghost") + '" data-r="mal">! Corregir</button>' +
    (est ? '<button class="btn ghost" data-r="">Quitar marca</button>' : "") + "</div></div></details>";
}

/* Texto donde busca: plantilla, concepto y los ejemplos con lo que se extrajo de ellos. */
function pajar(p) {
  if (p.pajar) return p.pajar;
  return p.pajar = sinTildes([p.plantilla, p.auto.DB, p.auto.CR].concat(p.ejemplos.map(function (e) {
    return [e.texto, e.concepto, e.fecha, e.comercio].join(" ");
  })).join(" ")).toLowerCase();
}

function visible(p) {
  var est = state.rev[p.plantilla] || "";
  if (state.q && state.q.split(/\s+/).some(function (w) { return pajar(p).indexOf(w) < 0; })) return false;
  if (state.concepto && conceptosDe(p).indexOf(state.concepto) < 0) return false;
  if (state.aviso && (state.aviso === "ninguno" ? p.avisos.length : p.avisos.indexOf(state.aviso) < 0)) return false;
  switch (state.filtro) {
    case "pendientes": return !est;
    case "avisos": return p.avisos.length > 0;
    case "mal": return est === "mal";
    case "ok": return est === "ok";
    default: return true;
  }
}

/* Opciones de concepto y aviso con cuántas plantillas hay de cada uno. */
function llenaSelects() {
  var cons = {}, avis = {}, sinAviso = 0;
  state.ps.forEach(function (p) {
    conceptosDe(p).forEach(function (k) { cons[k] = (cons[k] || 0) + 1; });
    if (!p.avisos.length) sinAviso++;
    p.avisos.forEach(function (a) { avis[a] = (avis[a] || 0) + 1; });
  });
  if (!cons[state.concepto]) state.concepto = "";
  if (state.aviso !== "ninguno" && !avis[state.aviso]) state.aviso = "";
  var opt = function (v, t, sel) { return '<option value="' + esc(v) + '"' + (sel ? " selected" : "") + ">" + esc(t) + "</option>"; };
  $("tpl-con").innerHTML = opt("", "Todos los conceptos", !state.concepto) + Object.keys(cons).sort().map(function (k) {
    return opt(k, k + " (" + cons[k] + ")", state.concepto === k);
  }).join("");
  $("tpl-avi").innerHTML = opt("", "Todos los avisos", !state.aviso) + opt("ninguno", "Sin avisos (" + sinAviso + ")", state.aviso === "ninguno") +
    Object.keys(AVISOS).filter(function (a) { return avis[a]; }).map(function (a) {
      return opt(a, AVISOS[a] + " (" + avis[a] + ")", state.aviso === a);
    }).join("");
}

function pinta() {
  var hechas = state.ps.filter(function (p) { return state.rev[p.plantilla]; }).length;
  var malas = state.ps.filter(function (p) { return state.rev[p.plantilla] === "mal"; }).length;
  $("tpl-chips").innerHTML = FILTROS.map(function (f) {
    return '<button class="chip" data-f="' + f[0] + '" aria-pressed="' + (state.filtro === f[0]) + '">' + f[1] + "</button>";
  }).join("");
  var vis = state.ps.filter(visible).length;
  $("tpl-prog").textContent = "Revisadas " + hechas + " de " + state.ps.length + (malas ? " · " + malas + " por corregir" : "") +
    " · mostrando " + vis;
  var lista = state.ps.map(function (p, i) { return visible(p) ? tarjeta(p, i) : ""; }).join("");
  $("tbl-plantillas").innerHTML = lista || '<p class="vacio">No hay plantillas con este filtro o búsqueda.</p>';
}

/* Revisión o concepto cambiaron: recalcula filas y resumen, y repinta la lista. */
function cambio() {
  if (state.onChange) state.onChange();
  llenaSelects();
  pinta();
}

function eventos() {
  $("tpl-chips").addEventListener("click", function (e) {
    var b = e.target.closest("[data-f]");
    if (b) { state.filtro = b.dataset.f; pinta(); }
  });
  $("tpl-con").addEventListener("change", function (e) { state.concepto = e.target.value; pinta(); });
  $("tpl-avi").addEventListener("change", function (e) { state.aviso = e.target.value; pinta(); });
  $("tpl-q").addEventListener("input", function (e) {
    state.q = sinTildes(e.target.value).toLowerCase().trim();
    pinta();
  });
  var lista = $("tbl-plantillas");
  lista.addEventListener("toggle", function (e) {
    var d = e.target, p = d.dataset && state.ps[+d.dataset.i];
    if (!p) return;
    state.abiertas[p.plantilla] = d.open;
    /* Solo una abierta a la vez: la que se está revisando. */
    if (d.open) lista.querySelectorAll("details.card[open]").forEach(function (o) { if (o !== d) o.open = false; });
  }, true);
  lista.addEventListener("click", function (e) {
    var b = e.target.closest("[data-r]");
    if (!b) return;
    e.preventDefault(); /* el botón del resumen no debe abrir/cerrar la tarjeta */
    var p = state.ps[+b.closest("details").dataset.i];
    state.abiertas[p.plantilla] = false;
    state.rev = marcaRevision(p.plantilla, b.dataset.r);
    cambio();
  });
  lista.addEventListener("change", function (e) {
    var s = e.target.closest("select[data-o]");
    if (!s) return;
    var p = state.ps[+s.closest("details").dataset.i];
    state.over = marcaConcepto(p.plantilla, s.dataset.o, s.value === p.auto[s.dataset.o] ? "" : s.value);
    cambio();
  });
}

var conectado = false;
export function renderPlantillas(data, ps, onChange) {
  state.ps = ps;
  state.onChange = onChange;
  state.over = leeConceptos();
  state.total = data.rows.length || 1;
  state.rev = leeRevision();
  state.abiertas = {};
  if (!conectado) { eventos(); conectado = true; }

  $("tpl-note").textContent = state.ps.length + " plantilla(s) en " + data.rows.length + " operaciones (algoritmo Drain sobre el texto de Observaciones; <*> = parte variable). Abre cada una, revisa los ejemplos y márcala.";
  var fmts = {};
  state.ps.forEach(function (p) { if (p.fechaSrc) fmts[p.fechaSrc] = (fmts[p.fechaSrc] || 0) + 1; });
  var fk = Object.keys(fmts).sort(function (a, b) { return fmts[b] - fmts[a]; });
  $("tpl-fechas").innerHTML = fk.length
    ? "Formatos de fecha en la descripción: " + fk.map(function (k) {
        return "<code>" + esc(FECHA_FORMATOS[k] || k) + "</code> (" + fmts[k] + ")";
      }).join(" · ")
    : "Ninguna descripción trae fecha.";
  llenaSelects();
  pinta();
}
