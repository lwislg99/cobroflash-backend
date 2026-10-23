// tests/_cambios-autorizados-de-la-factura.mjs — SCRUM-1446d
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA VÍA DE CAMBIO AUTORIZADO DEL PDF DE LA FACTURA
//
// `scrum603b` (el cuerpo de `generateInvoicePdf`) y `scrum723` (su ámbito alcanzable) comparan
// el código que genera la factura con el PUNTO DE PARTIDA de la rama. Hasta el 23-oct-2026 eso
// los hacía PROHIBIR cualquier cambio, también uno autorizado: en CI la base es la punta de
// `main`, así que un PR que toca esa función salía rojo por construcción (medido en SCRUM-1446,
// c.18895 y c.18901). El fundador decidió abrir una vía (SCRUM-1446 c.20473, «Sí, abrir la vía»).
//
// 🔴 LA VÍA NO ES UNA EXCEPCIÓN POR NOMBRE NI POR FICHERO: es UN PAR DE HUELLAS. Un cambio pasa
// sólo si la huella del texto en la BASE y la del texto en el DISCO son, las dos, las que se
// declararon aquí junto a su firma. Lo que no casa con un par declarado sigue cayendo igual que
// antes:
//   · un cambio sin declarar → cae (lo de siempre);
//   · el cambio autorizado MÁS cualquier otro byte → cambia la huella del disco → cae;
//   · el mismo cambio sobre otra base (main tocó la factura entretanto) → cambia la huella de
//     la base → cae, y hay que volver a pedirlo.
// Y una vez el cambio está en `main`, base y disco coinciden y la declaración ya no interviene:
// se queda como historia legible de quién autorizó qué.
//
// LA FIRMA SE LOCALIZA: cada entrada nombra el comentario de Jira (`SCRUM-N c.M`) y su registro,
// que es el del mismo ticket en docs/master y tiene que contener ese número de comentario Y la
// cita literal.
// Lo comprueba `tests/scrum1446d-via-de-cambio-autorizado.test.mjs`.
//
// ⚠️ Lo que este fichero NO puede comprobar: que el comentario de Jira exista y diga lo que la
// cita dice. Jira no se lee desde la tanda; eso lo mira quien revisa el PR.
// ═════════════════════════════════════════════════════════════════════════════════════════
import crypto from 'node:crypto';

/** La huella de un trozo de código. Sin `\r`: el blob de git y el disco de Windows no difieren. */
export function huella(texto) {
  return crypto.createHash('sha256').update(String(texto).replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

/**
 * Cada cambio autorizado del código de la factura. `cuerpo` es lo que compara `scrum603b`;
 * `ambito`, lo que compara `scrum723`. `de` es la huella en la base y `a` la del disco.
 * Se genera EJECUTANDO `docs/master/evidencias/SCRUM-1446d/huellas.mjs`, nunca a mano.
 */
export const CAMBIOS_AUTORIZADOS = [
  {
    // El rótulo del tipo deja de redondearse a entero: un 7,5 % se imprimía «8%».
    firma: 'SCRUM-1446 c.20473',
    registro: 'docs/master/SCRUM-1446.md',
    cita: '«Sí, abrir la vía»',
    cuerpo: {
      de: '50ad8aa09d1c6195d237aed071a09b76179d381ec9eeedd84fd03135aaa5c984',
      a: '48cc44fa273e62c744d7eeae63b5205f830f4dda77b30925787da38a5af7e05a',
    },
    ambito: {
      de: '44c1fa96abbb71b898e89b6db1de90d94a4d5a8d423456e694f51b65ce4dbe2a',
      a: '7e8ce68f697dccf494c35fd831adccace46de06909171b01e2072e3699c57de8',
    },
  },
  {
    // SCRUM-1470c · la «Fecha:» de la factura imprime el día natural de su registro (zona del negocio).
    firma: 'SCRUM-1470 c.20530',
    registro: 'docs/master/SCRUM-1470.md',
    cita: '«Sí, el mismo día»',
    cuerpo: {
      de: '48cc44fa273e62c744d7eeae63b5205f830f4dda77b30925787da38a5af7e05a',
      a: 'fdaddbd5bb32a099baa5eaa0acddba18685f76b437f4bc4b8e4838e2b7718acc',
    },
    ambito: {
      de: '7e8ce68f697dccf494c35fd831adccace46de06909171b01e2072e3699c57de8',
      a: '7109a19821c60f7e303d855def8a08e45ed0f02e8ee36fb2dd5cad6e5df4ff83',
    },
  },
];

/**
 * La entrada que autoriza pasar de `enBase` a `enDisco` en el trozo `clave` ('cuerpo' o
 * 'ambito'), o `null` si ninguna lo autoriza.
 */
export function cambioAutorizado(clave, enBase, enDisco, lista = CAMBIOS_AUTORIZADOS) {
  const de = huella(enBase);
  const a = huella(enDisco);
  return lista.find((c) => c[clave] && c[clave].de === de && c[clave].a === a) ?? null;
}
