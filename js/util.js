/* Utilidades puras de formato y texto. */

export function fmt(n) {
  if (n === null || n === undefined || n === "") return "";
  var neg = n < 0, s = Math.abs(n).toFixed(2), p = s.split(".");
  var int = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (neg ? "-" : "") + int + "." + p[1];
}

export function num(txt) {
  var t = (txt || "").replace(/\s/g, "").replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return parseFloat(t);
}

/* Quita tildes: el PDF escribe "COMISION"/"BONIFICACION" sin acentos,
   pero la descripción ya normalizada puede llevarlos. */
export function sinTildes(t) {
  return (t || "").normalize ? (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "") : (t || "");
}

export function round2(n) { return Math.round(n * 100) / 100; }
