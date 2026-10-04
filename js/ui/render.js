/* Pinta el estado de cuenta en la página: metadatos, tiles, y comprobación. */
import { fmt } from "../util.js";
import { resumen } from "../domain/summary.js";
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

  renderPlantillas(data);

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
