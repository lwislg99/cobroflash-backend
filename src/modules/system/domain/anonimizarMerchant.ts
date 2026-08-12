// src/modules/system/domain/anonimizarMerchant.ts — SCRUM-244 (RGPD-1) · el derecho al olvido,
// sin destruir la prueba fiscal.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL RASTRO FISCAL SE ANONIMIZA, NO SE BORRA — decisión del fundador, 10-ago-2026
//
// El **art. 17.3.b RGPD** excluye del derecho de supresión lo necesario para cumplir una
// obligación legal, y el registro de facturación **hay obligación de conservarlo**. No hay
// conflicto entre las dos normas: se eliminan los **datos personales identificativos** y se
// **conserva el asiento con su encadenamiento intacto**.
//
// Borrar el `AuditLog` fiscal destruiría justo la prueba que SCRUM-207 y SCRUM-221 existen para
// poder dar — y que protege al FUNDADOR como productor del SIF, que es interés legítimo propio y
// no un dato del interesado. `borradoMerchant.ts` lo tenía escrito como **decisión abierta desde
// SCRUM-207**, con la lectura del contrato §9 D-4 (conservar las filas fiscales redactadas, con
// `plantilla`+`version`+`hash` intactos). Esto la cierra en ese sentido.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ LO QUE NO SE TOCA, Y ES LO QUE DECIDE SI ESTO VALE
//
// **Ni una huella.** `vfHash`, `vfPrevHash`, `vfAnulHash`, `number`, `total`, `qrData` y las
// `lines` selladas se quedan como están: lo sellado no se toca ni para arreglarlo (regla 29), y si
// la cadena se rompiera habríamos cambiado un problema legal por otro peor. Un test comprueba que
// **después de anonimizar la cadena sigue verificando**.
//
// Lo que se va son los identificativos: nombre, email, teléfono, NIF, dirección, notas.

/** El texto con el que se sustituye un dato personal. Reconocible y no confundible con un dato. */
export const REDACTADO = '[borrado a petición del interesado]';

/**
 * Campos personales por modelo. **Lista explícita a propósito**: una anonimización derivada «de
 * todo lo que parezca texto» borraría el concepto de una factura o el número de un albarán, que
 * son parte del asiento. Aquí cada campo está elegido, y lo que no está en la lista **no se toca**.
 */
export const CAMPOS_PERSONALES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  merchant: ['name', 'email', 'legalName', 'taxId', 'address', 'whatsappPhone'],
  customer: ['name', 'phone', 'email', 'legalName', 'taxId', 'notes'],
  // SCRUM-497 · `email_messages` guarda la DIRECCIÓN a la que se mandó cada correo, y hasta hoy
  // sobrevivía intacta a una supresión: quedaba constancia de que el profesional ejerció su
  // derecho y las direcciones de sus clientes seguían en claro.
  //
  // 🔴 SE ANONIMIZA, NO SE BORRA, y es el mismo criterio que el resto de esta lista: la FILA es la
  // constancia de que se envió algo, cuándo y con qué resultado (art. 17.3.b), y eso sobrevive. Lo
  // que desaparece es la dirección. Un registro de envíos sin destinatario sigue acreditando el
  // envío, que es para lo que existe.
  //
  // ⚠️ Solo `toEmail`. `providerId` es el identificador que da el proveedor —no es un dato del
  // interesado y es lo que permite cruzar un rebote con su fila—, y `kind`/`status`/las fechas son
  // el hecho, no la persona.
  emailMessage: ['toEmail'],
});

/** Lo que NUNCA se toca, con su motivo. Sirve de documentación y de guard a la vez. */
export const INTOCABLES: Readonly<Record<string, string>> = Object.freeze({
  vfHash: 'la huella sellada — regla 29',
  vfPrevHash: 'el eslabón anterior de la cadena',
  vfAnulHash: 'la huella del registro de anulación',
  vfAnulPrevHash: 'el eslabón anterior de la anulación',
  number: 'el número es la identidad fiscal del documento',
  total: 'el importe declarado',
  qrData: 'el QR entregado al cliente',
  lines: 'las líneas que entraron en la huella',
});

export interface PlanAnonimizado {
  /** Qué se va a redactar, modelo por modelo. */
  redacciones: { modelo: string; campos: readonly string[] }[];
  /** Qué se conserva y por qué. Viaja con el plan para que quede en el rastro. */
  conservado: { que: string; porque: string }[];
}

/**
 * El plan, calculado aparte de su ejecución para poder ANOTARLO ANTES de tocar nada.
 *
 * ⚠️ Ese orden es el ticket entero: si primero se ejecuta y luego se anota, un fallo a mitad deja
 * datos borrados sin constancia de quién lo pidió ni de qué se hizo.
 */
export function planDeAnonimizado(): PlanAnonimizado {
  return {
    redacciones: Object.entries(CAMPOS_PERSONALES).map(([modelo, campos]) => ({ modelo, campos })),
    conservado: [
      { que: 'el asiento fiscal (número, importe, fechas, líneas selladas)', porque: 'art. 17.3.b RGPD: obligación legal de conservación del registro de facturación' },
      { que: 'la cadena de huellas (vfHash / vfPrevHash)', porque: 'lo sellado no se toca ni para arreglarlo (regla 29); romperla invalidaría la prueba de todos los documentos siguientes' },
      { que: 'el rastro de AuditLog fiscal, con sus textos redactados', porque: 'es la defensa del productor del SIF (SCRUM-207/221), interés legítimo propio y no un dato del interesado' },
    ],
  };
}

/** Los `data` de cada `updateMany`, derivados de la lista. Puro: no toca la base. */
export function redaccionesPara(modelo: string): Record<string, string> | null {
  const campos = CAMPOS_PERSONALES[modelo];
  if (!campos) return null;
  const data: Record<string, string> = {};
  for (const c of campos) data[c] = REDACTADO;
  return data;
}

/**
 * ¿Este `data` de actualización toca algo intocable? Se usa como red antes de ejecutar.
 *
 * Existe porque la lista de campos personales la mantiene una persona: el día que alguien añada
 * `total` o `vfHash` «para limpiar bien», esto lo para antes de que llegue a la base.
 */
export function tocaIntocables(data: Record<string, unknown>): string[] {
  return Object.keys(data ?? {}).filter((k) => k in INTOCABLES);
}
