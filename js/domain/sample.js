/* Datos de ejemplo que se muestran antes de cargar un PDF. */
import { round2 } from "../util.js";
import { concepto } from "./classify.js";
import { totales } from "./statement.js";

export function sampleData() {
  var raw = [
    ["03/07/2026", "BR0000EJEM01", "PAGO DE SERVICIO RECIBIDO por BancaMovil | Tarjeta 9200XXXXXX0001", "Comercio de ejemplo A", null, 1250.00],
    ["03/07/2026", "BR0000EJEM02", "PAGO DE SERVICIO RECIBIDO por BancaMovil | Tarjeta 9200XXXXXX0002", "Comercio de ejemplo B", null, 3480.50],
    ["03/07/2026", "BR0000EJEM03", "Nomina", "", 96000.00, null],
    ["03/07/2026", "BR0000EJEM04", "Comision por acreditacion de nomina", "", 9.00, null],
    ["04/07/2026", "BR0000EJEM05", "PAGO DE SERVICIO RECIBIDO por BancaMovil | Tarjeta 9200XXXXXX0003", "Comercio de ejemplo A", null, 780.25],
    ["04/07/2026", "BR0000EJEM06", "Comision por cobro", "Comercio de ejemplo A", 20.31, null],
    ["04/07/2026", "BR0000EJEM07", "Bonificación", "Comercio de ejemplo A", null, 125.75],
    ["04/07/2026", "BR0000EJEM08", "Transferencia automática", "Comercio de ejemplo B", 3480.50, null],
    ["04/07/2026", "BR0000EJEM09", "Transferencia automática", "", 50000.00, null]
  ];
  var opening = 100000, run = opening, rows = [];
  raw.forEach(function (r) {
    run = round2(run - (r[4] || 0) + (r[5] || 0));
    rows.push({
      fecha: r[0], ref: r[1], desc: r[2], comercio: r[3], concepto: concepto(r[2]),
      debito: r[4], credito: r[5],
      saldoBanco: run, saldoCalc: run, dif: 0, obs: r[2], pagina: 1
    });
  });
  var t = totales(rows);
  return {
    rows: rows, opening: opening, closing: run, mismatches: 0,
    totalCredito: t.totalCredito, totalDebito: t.totalDebito,
    meta: { cuenta: "", periodo: "03/07/2026 – 04/07/2026", paginas: 1, fecha: "03/07/2026" }
  };
}
