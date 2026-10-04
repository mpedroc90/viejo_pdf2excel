/* Pinta el estado de cuenta en la página: metadatos, tiles, y comprobación. */
import { fmt } from "../util.js";
import { resumen } from "../domain/summary.js";
import { plantillas } from "../domain/drain.js";
import { aplicaConceptos } from "../domain/conceptos.js";
import { leeRevision } from "../storage/revision.js";
import { leeConceptos } from "../storage/conceptos.js";
import { leeEjemplos, guardaEjemplos } from "../storage/ejemplos.js";
import { heredaPlantillas } from "../storage/herencia.js";
import { renderPlantillas } from "./plantillas.js";
import { barras, lineaSaldo } from "./charts.js";

var $ = function (id) { return document.getElementById(id); };

function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

function tabla(items, tot, titulo) {
  return '<table class="sum"><thead><tr><th>' + titulo + '</th><th>Op.</th><th>Crédito</th><th>Débito</th><th>Neto</th></tr></thead><tbody>' +
    items.map(function (g) {
      return "<tr><td>" + esc(g.k) + "</td><td>" + g.n + '</td><td class="cr">' + fmt(g.cr) + '</td><td class="db">' + fmt(g.db) +
        "</td><td>" + fmt(g.neto) + "</td></tr>";
    }).join("") +
    '</tbody><tfoot><tr><td>Total</td><td>' + tot.n + "</td><td>" + fmt(tot.cr) + "</td><td>" + fmt(tot.db) + "</td><td>" + fmt(tot.cr - tot.db) +
    "</td></tr></tfoot></table>";
}

export function showTab(name) {
  ["resumen", "plantillas"].forEach(function (t) {
    $("panel-" + t).hidden = t !== name;
    $("tab-" + t).setAttribute("aria-selected", String(t === name));
  });
}

/* Plantillas con marca o concepto guardados, sin PDF: solo se conoce su patrón. */
function plantillasGuardadas() {
  var rev = leeRevision(), con = leeConceptos(), ejs = leeEjemplos(), vistas = {};
  return Object.keys(rev).concat(Object.keys(con)).filter(function (k) {
    return !vistas[k] && (vistas[k] = true);
  }).map(function (k) {
    var tokens = k.split(" "), c = con[k] || {}, g = ejs[k] || {};
    return { plantilla: k, tokens: tokens, marcas: g.marcas || tokens.map(function () { return []; }), n: 0, cr: 0, db: 0,
      concepto: c.DB || c.CR || "", ids: [], auto: { DB: c.DB || "", CR: c.CR || "" },
      fechaSrc: g.fechaSrc || "", comercioSrc: g.comercioSrc || "", ejemplo: "", ejemplos: g.ejemplos || [], avisos: [], guardada: true };
  });
}

/* Arranque sin PDF: resumen vacío y la pestaña Plantillas con las guardadas. */
export function renderInicio() {
  $("sample-note").hidden = false;
  $("reset").hidden = true;
  ["meta", "tiles", "check", "chart-saldo", "chart-conceptos", "chart-comercios", "tbl-conceptos", "tbl-comercios"].forEach(function (id) { $(id).innerHTML = ""; });
  $("check").className = "check";
  $("dl").disabled = true;
  $("dlhint").textContent = "Carga tu PDF para exportar.";
  renderPlantillas({ rows: [] }, plantillasGuardadas(), function () {});
}

export function render(data) {
  $("sample-note").hidden = true;
  $("reset").hidden = false;

  $("meta").innerHTML =
    (data.meta.cuenta ? "<div>Cuenta <b><span>" + data.meta.cuenta + "</span></b></div>" : "") +
    (data.meta.periodo ? "<div>Período <b><span>" + data.meta.periodo + "</span></b></div>" : "") +
    "<div>Páginas <b><span>" + data.meta.paginas + "</span></b></div>" +
    "<div>Operaciones <b><span>" + data.rows.length + "</span></b></div>";

  $("tiles").innerHTML = [
    ["Saldo inicial", fmt(data.opening), ""],
    ["Créditos", fmt(data.totalCredito), "cr"],
    ["Débitos", fmt(data.totalDebito), "db"],
    ["Saldo final", fmt(data.closing), ""]
  ].map(function (t) {
    return '<div class="tile"><div class="k">' + t[0] + '</div><div class="v ' + t[2] + '">' + t[1] + "</div></div>";
  }).join("");

  var chk = $("check");
  if (data.mismatches === 0) {
    chk.className = "check ok";
    chk.innerHTML = '<span class="mark">✓</span><span>El saldo calculado coincide con el saldo impreso en las ' +
      data.rows.length + " operaciones. Cierre: " + fmt(data.closing) + " CUP.</span>";
  } else {
    chk.className = "check bad";
    chk.innerHTML = '<span class="mark">!</span><span>' + data.mismatches +
      " fila(s) no cuadran con el saldo impreso en el PDF. Revísalas en la columna <i>Diferencia</i> del Excel antes de usarlo.</span>";
  }

  var ps = plantillas(data.rows);
  heredaPlantillas(ps);
  guardaEjemplos(ps);
  var aplica = function () { aplicaConceptos(data.rows, ps, leeRevision(), leeConceptos()); };
  aplica();
  pintaResumen(data);
  /* Si en Plantillas se cambia un concepto o una revisión, el resumen se recalcula. */
  renderPlantillas(data, ps, function () { aplica(); pintaResumen(data); });

  $("dl").disabled = false;
  $("dlhint").textContent = "";
}

function pintaResumen(data) {
  var res = resumen(data);
  var tot = { n: data.rows.length, cr: data.totalCredito, db: data.totalDebito };
  $("chart-saldo").innerHTML = lineaSaldo(data.opening, data.rows);
  $("chart-conceptos").innerHTML = barras(res.conceptos);
  $("chart-comercios").innerHTML = barras(res.comercios);
  $("tbl-conceptos").innerHTML = tabla(res.conceptos, tot, "Concepto");
  $("tbl-comercios").innerHTML = tabla(res.comercios, tot, "Comercio");
}

export function setStatus(msg) {
  $("status").hidden = !msg;
  if (msg) $("status-text").textContent = msg;
}

export function setError(msg) {
  $("error").hidden = !msg;
  if (msg) $("error").textContent = msg;
}
