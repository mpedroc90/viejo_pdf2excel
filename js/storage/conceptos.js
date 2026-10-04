/* Concepto elegido por plantilla (localStorage): plantilla -> { DB?: concepto, CR?: concepto }. */
var LS = "pdf2excel.conceptos";

export function leeConceptos() {
  try {
    var v = JSON.parse(localStorage.getItem(LS));
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch (e) { return {}; }
}

/* concepto "" = quitar la elección de ese sentido. */
export function marcaConcepto(plantilla, oper, concepto) {
  var c = leeConceptos(), p = c[plantilla] || {};
  if (concepto) p[oper] = concepto; else delete p[oper];
  if (Object.keys(p).length) c[plantilla] = p; else delete c[plantilla];
  try { localStorage.setItem(LS, JSON.stringify(c)); } catch (e) {}
  return c;
}
