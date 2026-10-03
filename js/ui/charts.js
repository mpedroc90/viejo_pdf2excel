/* Gráficos sin librerías: barras en HTML/CSS y línea de saldo en SVG. */
import { fmt } from "../util.js";

function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

/* items: [{ k, cr, db }] → par de barras (crédito / débito) por fila. */
export function barras(items) {
  var max = Math.max.apply(null, items.map(function (i) { return Math.max(i.cr, i.db); }).concat([1]));
  return '<div class="bars">' + items.map(function (i) {
    return '<div class="bar-row"><div class="bar-label" title="' + esc(i.k) + '">' + esc(i.k) + "</div><div class=\"bar-pair\">" +
      '<div class="bar cr" style="width:' + (i.cr / max * 100) + '%"></div><span>' + fmt(i.cr) + "</span>" +
      '<div class="bar db" style="width:' + (i.db / max * 100) + '%"></div><span>' + fmt(i.db) + "</span>" +
      "</div></div>";
  }).join("") + "</div>";
}

/* Evolución del saldo calculado a lo largo de las operaciones. */
export function lineaSaldo(opening, rows) {
  var pts = [opening].concat(rows.map(function (r) { return r.saldoCalc; }));
  var W = 600, H = 180, P = 8;
  var lo = Math.min.apply(null, pts), hi = Math.max.apply(null, pts);
  if (hi === lo) { hi += 1; lo -= 1; }
  var path = pts.map(function (v, i) {
    var x = P + (pts.length > 1 ? i / (pts.length - 1) : 0) * (W - 2 * P);
    var y = P + (1 - (v - lo) / (hi - lo)) * (H - 2 * P);
    return (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
  }).join(" ");
  return '<svg class="line" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img" aria-label="Evolución del saldo">' +
    '<path d="' + path + '" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>' +
    '<div class="line-axis"><span>Mín ' + fmt(lo) + "</span><span>Máx " + fmt(hi) + "</span></div>";
}
