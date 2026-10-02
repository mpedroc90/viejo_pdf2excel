/* Arma el libro de Excel (ExcelJS) a partir del estado de cuenta. */
import { addMovimientos } from "./movimientos.js";
import { addResumen } from "./resumen.js";

export function excelReady() { return !!globalThis.ExcelJS; }

export function buildWorkbook(data) {
  var wb = new globalThis.ExcelJS.Workbook();
  wb.created = new Date();
  var mov = addMovimientos(wb, data);
  addResumen(wb, data, mov);
  return wb;
}

export function fileName(meta) {
  var p = (meta.periodo || meta.fecha || "").split(/\s*–\s*/);
  if (p.length === 2 && p[0] === p[1]) p = [p[0]];
  var per = p.join("_a_").replace(/\//g, "-").replace(/\s/g, "");
  return "Estado_de_Cuenta" + (meta.cuenta ? "_" + meta.cuenta : "") + (per ? "_" + per : "") + ".xlsx";
}
