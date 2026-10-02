/* Reglas de negocio: comercios conocidos y conceptos del Resumen.
   Editar aquí para añadir comercios o conceptos. */

export const COMERCIOS = {
  '4235584': "Tienda La Tuya",
  '4235585': "Tienda Merkhogar",
  '4235586': "Tienda Bx3",
  '4235587': "Mercado 5ta y C",
  '6333080': "Tienda Componente",
  '6333081': "El Paraíso",
  '6331632': "Multi Axess"
};

export function etiquetaComercio(k) { return k + " - " + COMERCIOS[k]; }

/* Conceptos: el Resumen abre una fila por cada par comercio × concepto.
   El orden importa, se devuelve la primera coincidencia. */
export var CONCEPTOS = [
  { re: /TRANSFERENCIA\s*AUTOMATICA|TRANSF\.?\s*AUTOMATICA/i, cat: "Transferencia automática" },
  { re: /COMISION/i, cat: "Comisión" },
  { re: /BONIFICACION/i, cat: "Bonificación" },
  { re: /NOMINA/i, cat: "Nómina" },
  { re: /PAGO\s+DE\s+SERVICIO|DET\s*PAGO/i, cat: "Pago recibido" }
];
/* Orden de presentación dentro de cada comercio (distinto del orden de coincidencia). */
export var CONCEPTO_ORDEN = ["Pago recibido", "Comisión", "Transferencia automática", "Bonificación", "Nómina", "Otro"];
/* Tránsito es un grupo: la fila conserva su concepto con el prefijo "Tránsito · ". */
export var TRANSITO = "Tránsito · ";
export function conceptoTransito(c) { return TRANSITO + c; }
export var CONCEPTO_TRANSITO = CONCEPTO_ORDEN.map(conceptoTransito);
export var CONCEPTO_TODOS = CONCEPTO_ORDEN.concat(CONCEPTO_TRANSITO);
