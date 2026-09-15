// src/modules/jobs/domain/albaranEmision.ts — SCRUM-841
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EMITIR UN ALBARÁN ES CONGELAR A SU CLIENTE. LAS DOS COSAS, O NINGUNA.
//
// `albaranes` tiene desde SCRUM-729 (paso 6) las mismas cinco columnas de congelado que
// `invoices` —nombre, denominación legal, NIF, email y teléfono— y tenía el mismo hueco: el
// ALTER estaba aplicado en las tres bases y **no las escribía nadie**. Medido corriendo el
// 15-sep-2026 con el handler real: `POST /admin/albaranes/:id/emitir` mandaba a la base
// exactamente `{"estado":"emitido"}`, cero de cinco.
//
// Consecuencia, que es la misma que arreglaba SCRUM-729 en la factura: el albarán **emitido y
// todavía sin firmar** reimprime el cliente de HOY. Si el cliente corrige su razón social o su
// NIF después de que se le entregara el parte, el papel que se reimprime ya no es el que se
// entregó, y nadie tocó el documento.
//
// ── POR QUÉ ESTO ES UN MÓDULO Y NO TRES LÍNEAS EN LA RUTA ────────────────────────────────
//
// Por el mismo motivo que `crearFacturaEmitida` (SCRUM-729 §2): para que el congelado **no
// dependa de que alguien se acuerde**. `estado: 'emitido'` y los cinco campos salen de aquí
// juntos y el cliente es parámetro OBLIGATORIO, así que un emisor nuevo que se olvide del
// congelado no compila — en vez de compilar y emitir documentos con las cinco a NULL, que es
// justo el estado del que venimos.
//
// La diferencia con la factura es de escala y está medida: allí había SIETE `invoice.create` y
// hubo que crear la línea única; aquí hay **un solo** emisor de albaranes, y lo que este módulo
// impide es que aparezca el segundo por la puerta de atrás. El guard de
// `tests/scrum841-el-escritor-del-albaran.test.mjs` lo comprueba por AST: ningún otro
// `albaran.update` de `src/` puede poner `estado: 'emitido'` a mano.
//
// ── LO QUE ESTE MÓDULO **NO** HACE, dicho aquí en vez de descubrirse luego ────────────────
//
// 🔴 **No toca el sellado de la firma, y no es un olvido.** El sobre v:3 (SCRUM-438) congela su
// propio `cliente` —`customer.legalName || customer.name`— dentro de `evidenciaFirma`, y lo
// hace AL FIRMAR, no al emitir. Son dos congelados en dos instantes distintos y legítimamente
// distintos. Unificarlos exige mover a la vez el sellador y el verificador —`albaran.service.ts`
// avisa de que esa expresión está SUJETA POR UN GUARD a otra en otro fichero— y eso es tocar el
// camino del sello: regla 29 y trabajo del ticket que toque el sellado, no de éste.
//
// 🔴 **No hay lector todavía.** El PDF sigue resolviendo por `contenidoSegunVersion`, exactamente
// igual que ayer: ni un byte cambia en ningún documento ya generado. Cablear los lectores a la
// columna es el paso siguiente, y es el que hay que hacer con cuidado — hacerlo a medias
// reabriría SCRUM-452 (el papel diciendo una cosa y el sello certificando otra).
//
// 🔴 **No rellena ni una fila existente.** Sin backfill, por la razón de SCRUM-729 §5: escribir
// hoy la ficha de hoy en un documento emitido en marzo no es un relleno, es fabricar un dato
// que aquel día no constaba. `NULL` en las cinco significa «anterior al escritor», y es una
// afirmación con significado sólo mientras nadie la invente.
// ═════════════════════════════════════════════════════════════════════════════════════════
import type { ClienteCongelado } from '../../invoicing/domain/clienteCongelado';

/**
 * Lo que se escribe al emitir: la transición y el retrato del cliente, en el MISMO `update`.
 *
 * `estado` va literal —no `string`— para que el tipo diga qué documento es esto. Los cinco
 * campos entran por derrame de `ClienteCongelado`, que ya lleva el nombre exacto de la columna
 * (`clienteCongelado.ts`): un mapeo a mano aquí sería una segunda lista que puede derivar de la
 * de allí sin que nadie lo note.
 */
export interface DatosDeAlbaranEmitido extends ClienteCongelado {
  estado: 'emitido';
}

/**
 * 🔴 EL CLIENTE ES OBLIGATORIO. Ahí está todo el mecanismo.
 *
 * No hay sobrecarga sin cliente, ni valor por defecto, ni `Partial`. Quien emita un albarán
 * tiene que haberlo congelado antes, y si no lo hace el compilador se lo dice. Probado en rojo:
 * quitando el argumento, `npm run build` cae con `TS2554`.
 *
 * El viaje que lo obtiene (`congelarCliente`) va en el llamador y **fuera de cualquier
 * transacción**, como en la factura: aquí no se consulta nada.
 */
export function datosDeAlbaranEmitido(cliente: ClienteCongelado): DatosDeAlbaranEmitido {
  return { estado: 'emitido', ...cliente };
}
