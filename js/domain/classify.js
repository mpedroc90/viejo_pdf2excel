/* Interpreta el texto de "Observaciones": concepto, comercio, descripción y tránsito. */
import { COMERCIOS, CONCEPTOS, etiquetaComercio } from "../config.js";
import { sinTildes } from "../util.js";

/* Quita tildes carácter a carácter para conservar los índices del texto original. */
function sinTildesPos(t) { return t.replace(/[\u00C0-\u017F]/g, function (c) { return c.normalize("NFD")[0]; }); }

/* Regla que decide el concepto y dónde casa en el texto: {cat, index, len} o null.
   oper: "DB" | "CR" | undefined (sin sentido conocido: no se filtra). */
export function conceptoMatch(o, oper) {
  var t = sinTildesPos(o);
  for (var i = 0; i < CONCEPTOS.length; i++) {
    var c = CONCEPTOS[i];
    if (c.oper && oper && c.oper !== oper) continue;
    var m = t.match(c.re);
    if (m) return { cat: c.cat, index: m.index, len: m[0].length };
  }
  return null;
}

export function concepto(o, oper) {
  var m = conceptoMatch(o, oper);
  return m ? m.cat : "Otro";
}

/* Fecha que trae la descripción. Cada entrada: [nombre, regex, (match) => {d, m, y}].
   Gana la primera que coincide, así que van por prioridad. El PDF corta el texto a
   mitad de palabra y pierde la ñ, de ahí los \s* y el "A.?O" de Mes.año. */
var yy = function (s) { return s.length === 2 ? 2000 + +s : +s; };
var dmy = function (m) { return { d: +m[1], m: +m[2], y: yy(m[3]) }; };

var PATRONES = [
  /* FECHA: 12.08.26 | FECHA:01.09.26. | DET PAGO FECHA 28.08.2026 (dos puntos opcional) */
  ["FECHA", /(?<![A-Z])FECHA\s*:?\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4}|\d{2})(?!\d)/i, dmy],
  /* FECHA CONTABLE: 04.09.2026 */
  ["FECHA_CONTABLE", /FECHA\s*CONTABLE\s*:?\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4}|\d{2})(?!\d)/i, dmy],
  /* FECHA PAGO 2026.09.01 (nómina, año primero) */
  ["FECHA_PAGO_YMD", /FECHA\s*PAGO\s*:?\s*(\d{4})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})(?!\d)/i,
    function (m) { return { d: +m[3], m: +m[2], y: +m[1] }; }],
  /* PERIODO A LIQUIDAR:31.08.2026 (aporte al presupuesto) */
  ["PERIODO_LIQUIDAR", /PERIODO\s*A\s*LIQUIDAR\s*:?\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4}|\d{2})(?!\d)/i, dmy],
  /* Fecha Pago:11.09.2026 (día primero) */
  ["FECHA_PAGO_DMY", /FECHA\s*PAGO\s*:?\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})(?!\d)/i, dmy],
  /* Mes.año: 08.2026 (liquidación) */
  ["MES_ANO", /MES\s*\.?\s*A.?O\s*:\s*(\d{1,2})\s*[./]\s*(\d{4})(?!\d)/i,
    function (m) { return { d: null, m: +m[1], y: +m[2] }; }],
  /* Compensación ... del día 300826 (ddmmaa sin separadores; "día" sale como "d a") */
  ["ENZONA_DIA", /\bDEL\s*D[IÍ\s]?A\s*:?\s*(\d{2})\s?(\d{2})\s?(\d{2})(?!\d)/i,
    function (m) { return { d: +m[1], m: +m[2], y: 2000 + +m[3] }; }],
  /* ADJUNTO TM 2026826 (aaaa + mes y día sin ceros) */
  ["TM", /(?<![A-Z])TM\s+(20\d{2})(\d{2,4})\b/i, function (m) { return tmFecha(m[1], m[2]); }],
  /* VENCTO 31.08.26 (fecha de liquidación; solo como último recurso) */
  ["VENCTO", /(?<![A-Z])VENCTO\s*:?\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4}|\d{2})(?!\d)/i, dmy],
  /* REF UNICA RU260909001964100026 (empieza por aammdd; último recurso) */
  ["REF_UNICA_RU", /REF\s*UNICA\s*RU(\d{2})(\d{2})(\d{2})\d/i,
    function (m) { return { d: +m[3], m: +m[2], y: 2000 + +m[1] }; }]
];

/* Formato legible de cada patrón de fecha (para mostrar en la UI). */
export var FECHA_FORMATOS = {
  FECHA: "FECHA: dd.mm.aa | dd.mm.aaaa",
  FECHA_CONTABLE: "FECHA CONTABLE: dd.mm.aaaa",
  FECHA_PAGO_YMD: "FECHA PAGO aaaa.mm.dd",
  PERIODO_LIQUIDAR: "PERIODO A LIQUIDAR: dd.mm.aaaa",
  FECHA_PAGO_DMY: "Fecha Pago: dd.mm.aaaa",
  MES_ANO: "Mes.año: mm.aaaa (sin día)",
  ENZONA_DIA: "del día ddmmaa",
  TM: "TM aaaa + mes y día sin ceros",
  VENCTO: "VENCTO dd.mm.aa",
  REF_UNICA_RU: "REF UNICA RU aammdd…"
};

/* "826" -> 8/26, "94" -> 9/4, "1015" -> 10/15. Con 3 dígitos puede ser ambiguo
   ("111" = 1/11 u 11/1): se devuelve la primera y las demás en "ambiguous". */
function tmFecha(y, md) {
  var ok = function (m, d) { return m >= 1 && m <= 12 && d >= 1 && d <= 31; }, c = [];
  if (md.length === 2) c.push({ m: +md[0], d: +md[1] });
  if (md.length === 4) c.push({ m: +md.slice(0, 2), d: +md.slice(2) });
  if (md.length === 3) {
    if (md[1] !== "0") c.push({ m: +md[0], d: +md.slice(1) });
    if (md[2] !== "0") c.push({ m: +md.slice(0, 2), d: +md[2] });
  }
  var v = c.filter(function (x) { return ok(x.m, x.d); }).map(function (x) { return { d: x.d, m: x.m, y: +y }; });
  if (!v.length) return null;
  return v.length === 1 ? v[0] : { d: v[0].d, m: v[0].m, y: v[0].y, ambiguous: v };
}

export function fechaDesc(o) {
  for (var i = 0; i < PATRONES.length; i++) {
    var m = o.match(PATRONES[i][1]);
    if (!m) continue;
    var r = PATRONES[i][2](m);
    if (r && r.m >= 1 && r.m <= 12) { r.src = PATRONES[i][0]; r.index = m.index; r.len = m[0].length; return r; }
  }
  return null;
}

/* Tránsito: la fecha de la descripción cae en otro mes que la fecha de la fila. */
export function esTransito(fecha, obs) {
  var f = (fecha || "").match(/^\d{2}\/(\d{2})\/(\d{4})$/), d = fechaDesc(obs || "");
  return !!(f && d && (+f[1] !== d.m || +f[2] !== d.y));
}

/* De dónde sale el comercio en el texto: {index, len, src} o null. Misma lógica que fields():
   un código conocido (config.js) gana sobre el campo "COMERCIO: ... .DATOS BENEFI". */
export function comercioMatch(obs) {
  var o = obs.replace(/\s+/g, " ").trim(), r = null;
  var com = o.match(/COMERCIO:\s*(.*?)\s*\.DATOS BENEFI/);
  if (com && com[1]) r = { index: com.index + com[0].indexOf(com[1]), len: com[1].length, src: "COMERCIO:" };
  Object.keys(COMERCIOS).forEach(function (k) {
    var m = o.match(new RegExp(k, "i"));
    if (m) r = { index: m.index, len: m[0].length, src: "código " + k };
  });
  return r;
}

export function fields(obs, oper) {
  var o = obs.replace(/\s+/g, " ").trim();
  var com = o.match(/COMERCIO:\s*(.*?)\s*\.DATOS BENEFI/);
  var comercioPdf = com ? com[1] : "", fijo = false;

  Object.keys(COMERCIOS).forEach(function (k) {
    var re = new RegExp(k, "i");
    if (re.test(o)) { com = [null, etiquetaComercio(k)]; fijo = true; }
  });

  var det = o.match(/\.DATOS BENEFI DET PAGO\s*(.*?)\s*\.DET PAGO/);
  var tar = o.match(/Tarjeta\s*:\s*([0-9X]+)/);
  var desc;
  if (det) desc = det[1].split(/\s*Tarjeta\s*:/)[0].trim();
  else if (/COMISION\s+POR\s+ACREDITACION/i.test(o)) desc = "Comision por acreditacion de nomina";
  else if (/COBRO\s+POR\s+COMISION/i.test(o)) desc = "Comision por cobro a comercio";
  else if (/COMISION\s+POR\s+TRANSFERENCIA/i.test(o)) desc = "Comision por transferencia";
  else if (/^NOMINA/i.test(o)) desc = "Nomina";
  else if (/BONIFICACION|BONIF\s+A\s+COMERCIO/i.test(o)) desc = "Bonificación";
  else if (/TRANSFERENCIA\s*AUTOMATICA|TRANSF\.?\s*AUTOMATICA/i.test(o)) desc = "Transferencia automática";
  else desc = o.slice(0, 140);
  if (tar) desc += " | Tarjeta " + tar[1];
  var comercio = com ? com[1] : "";
  return { desc: desc, comercio: comercio, comercioPdf: comercioPdf, comercioFijo: fijo, concepto: concepto(o, oper), obs: o };
}
