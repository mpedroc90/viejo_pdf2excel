/* Punto de entrada: conecta la página con el parser, el Excel y la UI. */
import { pdfReady, openPdf, parseDoc } from "./pdf/parser.js";
import { excelReady, buildWorkbook, fileName } from "./excel/workbook.js";
import { aplicaAlias, sinAlias } from "./storage/aliases.js";
import { render, renderInicio, showTab, setStatus, setError } from "./ui/render.js";
import { pideAlias } from "./ui/aliasDialog.js";

var $ = function (id) { return document.getElementById(id); };
var state = { data: null };

function show(data) {
  state.data = data;
  render(data);
}

function libsReady() {
  if (!pdfReady() || !excelReady()) {
    setError("No se cargaron las librerías de vendor/. Abre la página desde un servidor (GitHub Pages o python3 -m http.server), no con doble clic.");
    return false;
  }
  return true;
}

function handleFile(file) {
  if (!file) return;
  if (!libsReady()) return;
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
    setError("Ese archivo no es un PDF."); return;
  }
  setError("");
  setStatus("Leyendo " + file.name + "…");
  $("dl").disabled = true;
  file.arrayBuffer().then(openPdf).then(function (pdf) {
    return parseDoc(pdf, function (p, n) { setStatus("Procesando página " + p + " de " + n + "…"); });
  }).then(function (data) {
    setStatus("");
    var pend = sinAlias(data);
    return (pend.length ? pideAlias(pend) : Promise.resolve()).then(function () {
      show(aplicaAlias(data));
    });
  }).catch(function (e) {
    setStatus("");
    setError("No se pudo procesar el PDF: " + (e && e.message ? e.message : e));
  });
}

function saveBlob(blob, name) {
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
}

function download() {
  if (!state.data) return;
  if (!libsReady()) return;
  var data = state.data;
  $("dl").disabled = true;
  var prev = $("dl").textContent;
  $("dl").textContent = "Generando…";
  buildWorkbook(data).xlsx.writeBuffer().then(function (buf) {
    var name = fileName(data.meta);
    saveBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), name);
  }).catch(function (e) {
    setError("No se pudo generar el Excel: " + (e && e.message ? e.message : e));
  }).then(function () {
    $("dl").textContent = prev;
    $("dl").disabled = false;
  });
}

var drop = $("drop");
["dragenter", "dragover"].forEach(function (ev) {
  drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); });
});
["dragleave", "drop"].forEach(function (ev) {
  drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); });
});
drop.addEventListener("drop", function (e) {
  if (e.dataTransfer && e.dataTransfer.files) handleFile(e.dataTransfer.files[0]);
});
$("file").addEventListener("change", function (e) { handleFile(e.target.files[0]); });
$("dl").addEventListener("click", download);
$("tab-resumen").addEventListener("click", function () { showTab("resumen"); });
$("tab-plantillas").addEventListener("click", function () { showTab("plantillas"); });
$("reset").addEventListener("click", function () {
  $("file").value = "";
  setError("");
  state.data = null;
  renderInicio();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

renderInicio();
