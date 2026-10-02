/* Interpreta el texto de "Observaciones": concepto, comercio, descripción y tránsito. */
import { COMERCIOS, CONCEPTOS, etiquetaComercio } from "../config.js";
import { sinTildes } from "../util.js";

export function concepto(o) {
  var t = sinTildes(o);
  for (var i = 0; i < CONCEPTOS.length; i++) {
    if (CONCEPTOS[i].re.test(t)) return CONCEPTOS[i].cat;
  }
  return "Otro";
}

/* Fecha que trae la descripción: "FECHA: 26.07.26", "FECHA CONTABLE: 30.07.2026"
   o "FECHA PAGO 2026.08.04". El PDF corta el texto a mitad de palabra, de ahí los \s*. */
export function fechaDesc(o) {
  var m = o.match(/FECHA\s*:\s*(\d{2})\s*\.\s*(\d{2})\s*\.\s*(\d{2}(?:\d{2})?)/i)
    || o.match(/FECHA\s*CONTABLE\s*:\s*(\d{2})\s*\.\s*(\d{2})\s*\.\s*(\d{4})/i);
  if (m) return { m: +m[2], y: m[3].length === 2 ? 2000 + +m[3] : +m[3] };
  m = o.match(/FECHA\s*PAGO\s*(\d{4})\s*\.\s*(\d{2})\s*\.\s*(\d{2})/i);
  if (m) return { m: +m[2], y: +m[1] };
  return null;
}

/* Tránsito: la fecha de la descripción cae en otro mes que la fecha de la fila. */
export function esTransito(fecha, obs) {
  var f = (fecha || "").match(/^\d{2}\/(\d{2})\/(\d{4})$/), d = fechaDesc(obs || "");
  return !!(f && d && (+f[1] !== d.m || +f[2] !== d.y));
}

export function fields(obs) {
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
  else if (/^COMISION/i.test(o)) desc = "Comision por acreditacion de nomina";
  else if (/^NOMINA/i.test(o)) desc = "Nomina";
  else if (/^BONIFICACION/i.test(o)) desc = "Bonificación";
  else if (/TRANSFERENCIA\s*AUTOMATICA|TRANSF\.?\s*AUTOMATICA/i.test(o)) desc = "Transferencia automática";
  else desc = o.slice(0, 140);
  if (tar) desc += " | Tarjeta " + tar[1];
  var comercio = com ? com[1] : "";
  return { desc: desc, comercio: comercio, comercioPdf: comercioPdf, comercioFijo: fijo, concepto: concepto(o), obs: o };
}
