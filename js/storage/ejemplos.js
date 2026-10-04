/* Ejemplos de cada plantilla (localStorage), para mostrarla al abrir la app sin PDF:
   plantilla -> { ejemplos, marcas, fechaSrc, comercioSrc }. Solo se guardan unos pocos. */
var LS = "pdf2excel.ejemplos", MAX = 2;

export function leeEjemplos() {
  try {
    var v = JSON.parse(localStorage.getItem(LS));
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch (e) { return {}; }
}

/* ps: plantillas del PDF recién leído. Las que no están en este PDF conservan lo guardado. */
export function guardaEjemplos(ps) {
  var g = leeEjemplos();
  ps.forEach(function (p) {
    g[p.plantilla] = { ejemplos: p.ejemplos.slice(0, MAX), marcas: p.marcas, fechaSrc: p.fechaSrc, comercioSrc: p.comercioSrc };
  });
  try { localStorage.setItem(LS, JSON.stringify(g)); } catch (e) {}
}

/* Quita los ejemplos guardados de una plantilla (ya se guardan con la clave nueva). */
export function quitaEjemplos(clave) {
  var g = leeEjemplos();
  if (!g[clave]) return;
  delete g[clave];
  try { localStorage.setItem(LS, JSON.stringify(g)); } catch (e) {}
}
