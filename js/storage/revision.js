/* Revisión humana de plantillas (localStorage): plantilla -> "ok" | "mal". */
var LS = "pdf2excel.revision";

export function leeRevision() {
  try {
    var v = JSON.parse(localStorage.getItem(LS));
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch (e) { return {}; }
}

export function marcaRevision(plantilla, estado) {
  var r = leeRevision();
  if (estado) r[plantilla] = estado; else delete r[plantilla];
  try { localStorage.setItem(LS, JSON.stringify(r)); } catch (e) {}
  return r;
}
