/* Paleta y formatos compartidos por las hojas del Excel. */

export var MONEY = '#,##0.00;-#,##0.00;-';
export var MONEY_N = '#,##0.00;[Red]-#,##0.00;"-"';

export var NAVY = "FF1F3864", BAND = "FFD9E2F3", SOFT = "FFF4F7FC", GREY = "FFE7E9EC";
/* Grupo Tránsito: tono ámbar para separarlo de los conceptos del mes. */
export var TR_TEXT = "FF8A4B0F", TR_HEAD = "FFFBE3C4", TR_SOFT = "FFFFF7EC";

var THIN = { style: "thin", color: { argb: "FFB4BCC8" } };
export var BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };

export function solid(argb) { return { type: "pattern", pattern: "solid", fgColor: { argb: argb } }; }
