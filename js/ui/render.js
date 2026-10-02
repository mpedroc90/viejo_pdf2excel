/* Pinta el estado de cuenta en la página: metadatos, tiles, y comprobación. */
import { fmt } from "../util.js";

var $ = function (id) { return document.getElementById(id); };

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
