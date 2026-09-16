// src/modules/billing/domain/avisoBizumSinTelefono.ts — SCRUM-328 (F1).
//
// EL FALLO MUDO: el profesional enciende Bizum, su cliente NO lo ve, y él concluye que el producto
// está roto. Nadie le dice que le falta un teléfono.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE PASA HOY, medido en los dos lados
//
//   · EL CLIENTE (`payInvoice.routes.ts:69-71`): `hasBizum` exige flag **y** teléfono **y**
//     importe ≤ 1000 €. Sin teléfono la opción **simplemente no se pinta**. No hay error, no hay
//     aviso: no está. Desde fuera es indistinguible de «este producto no hace Bizum».
//   · EL PROFESIONAL: nada. Y peor — `homeView.js:309` da por HECHO el paso «Configura cómo
//     cobras» con `iban || bizumPhone`, así que **quien puso solo el IBAN ve un ✅** y no tiene
//     ningún motivo para sospechar que le falta algo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CRITERIO ES EL MISMO QUE EL DEL CLIENTE, Y NO UNA COPIA APROXIMADA
//
// `payInvoice` cae a `whatsappPhone` cuando no hay `bizumPhone`. Si este aviso mirara solo
// `bizumPhone`, avisaría a merchants **que están bien** — y un aviso que sale cuando no toca se
// aprende a ignorar, con lo que deja de proteger al que sí lo necesita. Se mira lo mismo: los dos.
//
// ⚠️ EL VEREDICTO LO DA EL SERVIDOR. El navegador no reimplementa la regla, la recibe — mismo
// criterio que `bizumManualEnabled` (`app.ts:380`): dos sitios decidiendo lo mismo acaban
// discrepando, y aquí discrepar significa o no avisar a quien hay que avisar, o avisar a quien no.

/** Los tres estados. `no_se_pudo_leer` NO es «tiene teléfono»: es su propio caso. */
export type AvisoBizum = 'no_aplica' | 'falta_telefono' | 'no_se_pudo_leer';

export type EntradaAviso = {
  /** ¿Está encendido el Bizum manual para este merchant? */
  flagBizum: unknown;
  bizumPhone: unknown;
  whatsappPhone: unknown;
};

/** Un teléfono sirve si es una cadena con algo dentro. Ni `null`, ni `''`, ni un número suelto. */
function telefonoUtil(v: unknown): boolean | null {
  if (v === null || v === undefined) return false;      // ausente: es una respuesta, no un fallo
  if (typeof v === 'string') return v.trim().length > 0;
  return null;                                           // cualquier otra cosa: no se sabe leer
}

/**
 * ¿Hay que avisar a este profesional?
 *
 * 🔴 EL SUELO, Y ESTÁ EN EL SITIO MÁS PELIGROSO POSIBLE: si el teléfono no se puede leer, **no se
 * cae a «tiene teléfono»**. Ese valor es justo el que hace DESAPARECER el aviso, así que degradar
 * ahí sería reproducir el fallo mudo con una capa más de silencio — el producto creería que ha
 * avisado. Un dato ilegible sale por su propia puerta (`no_se_pudo_leer`) y **también avisa**.
 */
export function decidirAvisoBizum(entrada: EntradaAviso): AvisoBizum {
  if (entrada.flagBizum !== true) return 'no_aplica';   // apagado: no hay nada que avisar

  const bizum = telefonoUtil(entrada.bizumPhone);
  const wa = telefonoUtil(entrada.whatsappPhone);

  if (bizum === null || wa === null) return 'no_se_pudo_leer';
  if (bizum || wa) return 'no_aplica';                  // hay teléfono: el cliente verá Bizum
  return 'falta_telefono';
}

/** ¿Se pinta el aviso? Las dos puertas que no son «no_aplica». */
export function hayQueAvisar(estado: AvisoBizum): boolean {
  return estado === 'falta_telefono' || estado === 'no_se_pudo_leer';
}
