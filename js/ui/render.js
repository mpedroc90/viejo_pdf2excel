/* Pinta el estado de cuenta en la página: metadatos, tiles, y comprobación. */
import { fmt } from "../util.js";
import { resumen } from "../domain/summary.js";
import { FECHA_FORMATOS } from "../domain/classify.js";
import { plantillas } from "../domain/drain.js";
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

function plantillaHtml(p) {
  return p.tokens.map(function (t, i) {
    var m = p.marcas[i];
    return m.length ? '<mark class="' + m.map(function (c) { return "m-" + c; }).join(" ") + '">' + esc(t) + "</mark>" : esc(t);
  }).join(" ");
}

function tablaPlantillas(ps, total) {
  return '<table class="sum tpl"><thead><tr><th>Plantilla</th><th>Concepto</th><th>Op.</th><th>%</th><th>Crédito</th><th>Débito</th></tr></thead><tbody>' +
    ps.map(function (p) {
      return '<tr><td><code>' + plantillaHtml(p) + '</code><div class="ej">' + esc(p.ejemplo) + '</div></td><td class="cpt">' + esc(p.concepto) + (p.fechaSrc ? '<div class="ej">fecha: ' + esc(FECHA_FORMATOS[p.fechaSrc] || p.fechaSrc) + "</div>" : "") +
        (p.comercioSrc ? '<div class="ej">comercio: ' + esc(p.comercioSrc) + "</div>" : "") + "</td><td>" + p.n + "</td><td>" +
        (p.n * 100 / total).toFixed(1) + '</td><td class="cr">' + fmt(p.cr) + '</td><td class="db">' + fmt(p.db) + "</td></tr>";
    }).join("") + "</tbody></table>";
}

export function showTab(name) {
  ["resumen", "plantillas"].forEach(function (t) {
    $("panel-" + t).hidden = t !== name;
    $("tab-" + t).setAttribute("aria-selected", String(t === name));
  });
}

export function render(data, isSample) {
  $("sample-note").hidden = !isSample;
  $("reset").hidden = !!isSample;

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

  var res = resumen(data);
  var tot = { n: data.rows.length, cr: data.totalCredito, db: data.totalDebito };
  $("chart-saldo").innerHTML = lineaSaldo(data.opening, data.rows);
  $("chart-conceptos").innerHTML = barras(res.conceptos);
  $("chart-comercios").innerHTML = barras(res.comercios);
  $("tbl-conceptos").innerHTML = tabla(res.conceptos, tot, "Concepto");
  $("tbl-comercios").innerHTML = tabla(res.comercios, tot, "Comercio");

  var ps = plantillas(data.rows);
  $("tpl-note").textContent = ps.length + " plantilla(s) en " + data.rows.length + " operaciones (algoritmo Drain sobre el texto de Observaciones; <*> = parte variable).";
  var fmts = {};
  ps.forEach(function (p) { if (p.fechaSrc) fmts[p.fechaSrc] = (fmts[p.fechaSrc] || 0) + 1; });
  var fk = Object.keys(fmts).sort(function (a, b) { return fmts[b] - fmts[a]; });
  $("tpl-fechas").innerHTML = fk.length
    ? "Formatos de fecha en la descripción: " + fk.map(function (k) {
        return "<code>" + esc(FECHA_FORMATOS[k] || k) + "</code> (" + fmts[k] + ")";
      }).join(" · ")
    : "Ninguna descripción trae fecha.";
  $("tbl-plantillas").innerHTML = tablaPlantillas(ps, data.rows.length || 1);

  $("dl").disabled = false;
  $("dlhint").textContent = isSample ? "Este botón exporta el ejemplo; carga tu PDF para exportar tus datos." : "";
}

export function setStatus(msg) {
  $("status").hidden = !msg;
  if (msg) $("status-text").textContent = msg;
}

export function setError(msg) {
  $("error").hidden = !msg;
  if (msg) $("error").textContent = msg;
}
