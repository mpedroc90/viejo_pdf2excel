/* Modal para asociar comercios desconocidos del PDF a uno conocido. */
import { COMERCIOS, etiquetaComercio } from "../config.js";
import { guardaEleccion } from "../storage/aliases.js";

/* Muestra el modal y guarda la elección. Cerrar sin guardar ignora todos. */
export function pideAlias(pend) {
  var dlg = document.getElementById("alias-dlg");
  if (!dlg || typeof dlg.showModal !== "function") return Promise.resolve();
  var list = document.getElementById("alias-list");
  var skip = document.getElementById("alias-skip");
  list.textContent = "";
  var selects = pend.map(function (p) {
    var row = document.createElement("label");
    row.className = "alias-row";
    var nom = document.createElement("div");
    nom.className = "nom";
    nom.textContent = p.nombre;
    var sm = document.createElement("small");
    sm.textContent = p.n + (p.n === 1 ? " op." : " ops.");
    nom.appendChild(sm);
    var sel = document.createElement("select");
    var o0 = document.createElement("option");
    o0.value = "";
    o0.textContent = "Ignorar — no volver a preguntar";
    sel.appendChild(o0);
    Object.keys(COMERCIOS).forEach(function (k) {
      var o = document.createElement("option");
      o.value = k;
      o.textContent = etiquetaComercio(k);
      sel.appendChild(o);
    });
    row.appendChild(nom);
    row.appendChild(sel);
    list.appendChild(row);
    return sel;
  });

  return new Promise(function (resolve) {
    function cerrar() {
      dlg.removeEventListener("close", cerrar);
      skip.onclick = null;
      var guardar = dlg.returnValue === "ok";
      guardaEleccion(pend, guardar ? selects.map(function (s) { return s.value; }) : null);
      resolve();
    }
    skip.onclick = function () { dlg.close("skip"); };
    dlg.addEventListener("close", cerrar);
    dlg.returnValue = "";
    dlg.showModal();
  });
}
