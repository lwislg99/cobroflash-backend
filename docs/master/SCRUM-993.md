# SCRUM-993 · Enviar el albarán a firmar en UN toque desde la puerta del cliente

**Medido contra:** `origin/main` = `29b492b0c2f246941e5c514d682887c18fd19494` · 2026-09-28T14:28:49Z

**Escribe:** Sesión 4 (S4, `s4-27a`) · **Carril:** S4 (producto/microcopy). Cogido el 27-sep-2026
~19:00Z, medido antes de construir (comentario 17259) y con las dos decisiones + firma del
orquestador en el comentario 17261/17262/17263.

## Encargo

Propuesta de consultoría (S0), 21-sep-2026: encadenar en un solo botón las tres rutas ya
existentes (crear albarán, emitir, enviar a firmar) desde la hoja de alta, en vez de que el
profesional vuelva a la ficha del Trabajo tres veces.

## Medido antes de construir (comentario 17259)

- El servidor está completo: `POST /admin/jobs/:id/albaranes`, `POST /admin/albaranes/:id/emitir`,
  `POST /admin/albaranes/:id/enviar-para-firmar` ya existen. Nada que construir ahí.
- `jobNextAction.js` (SCRUM-366) trata el flujo del albarán como tres niveles secuenciales
  (`nuevo`/`emitir`/`firmar`), «gana el más avanzado».
- `SCRUM-303` (guard `scrum303-albaran-una-pantalla.test.mjs`) exige UNA sola alta de albarán en
  el front; vive en `jobDetailView.js`/`openAlbCrearSheet`.
- `SCRUM-841` congela 5 columnas del cliente exactamente al EMITIR.

## Decisiones del orquestador (comentario 17261/17262/17263)

1. **Secundario, no sustituye la escalera.** No toca `jobNextAction.js` ni su guard de SCRUM-366;
   si la escalera de tres pasos es el problema de fondo, es un rediseño con ticket propio
   (SCRUM-917).
2. **Confirmación SÍ, y por un motivo más fuerte que «no perder el checkpoint»**: emitir es
   irreversible (congela al cliente, SCRUM-841) y un solo toque lo haría sin que el profesional lo
   viera pasar. La confirmación DICE lo que va a pasar, no pregunta «¿seguro?».
3. **Rótulo firmado:** «Entregar y enviar a firmar».
4. **El texto nombra el canal (WhatsApp) condicionalmente** — interino con
   `job.customer?.phone || job.customer?.mobile` porque el detalle del Trabajo no expone
   `tieneNumeroDeContacto` (eso es del detalle del PRESUPUESTO, SCRUM-1166; medido en
   `jobs.routes.ts:87`). Se cambia por el dato preciso cuando SCRUM-1171 lo añada al detalle del
   Trabajo — marcado en el código como INTERINO con esa referencia.
5. **Aviso de fallo de envío firmado:** «Albarán emitido — el envío por WhatsApp falló,
   reenvíalo desde el trabajo.» — dice PRIMERO lo que sí pasó (irreversible), copiando la forma
   de SCRUM-126 (`collect-rest`).

## Construido

- `crearAlbaran(cuerpo)`: el ÚNICO POST de creación, compartido por «Guardar» (sin tocar su cuerpo
  ni su receptor, que vigilan SCRUM-593e/607) y por el nuevo flujo — satisface SCRUM-303/606 (una
  sola alta).
- `leerLineasDelFormulario()`: extraída VERBATIM del cuerpo de `save` (mismo criterio que SCRUM-366
  con la escalera: traslado, no rediseño), para no duplicar la lectura de líneas.
- Botón secundario «Entregar y enviar a firmar» en `buildAlbEditor`, visible solo en la hoja de
  ALTA (`onEntregarYFirmar` es exclusivo de `onGuardar`). Primer clic abre una confirmación DENTRO
  de la misma hoja (mismo patrón que SCRUM-292, «revisión antes de emitir»); solo su botón de
  continuar ejecuta la cadena crear→emitir→enviar.
- Constantes de texto y la función colocadas DELIBERADAMENTE lejos de `ALB_MOTIVO`/
  `decidirAperturaAlbaran`: ese bloque vive dentro de un recorte acotado por
  `tests/scrum303-albaran-una-pantalla.test.mjs` con techo de 4000 caracteres (ya lo advertía el
  propio comentario del test: «se movió el código nuevo en vez de tocar el guard ajeno»).

## Verificación

- `npm run build` exit 0.
- `tests/scrum993-boton-un-toque.test.mjs` (nuevo, DOM real vía `_banco-vistas.mjs`): 7/7 — primer
  clic no ejecuta nada; texto de confirmación con/sin teléfono; las tres llamadas en orden con una
  sola alta; envío fallido deja el toast firmado; cancelar no llama a nada; **CONTROL**: «Guardar»
  sigue haciendo exactamente una llamada, sin emitir ni enviar (condición del orquestador: el
  refactor no cambia la conducta de la hoja de alta).
- `tests/scrum412-primaria-nunca-es-sm.test.mjs`: `confirmContinuar` declarado (acción de modal).
- Suite dirigida de 80 ficheros que referencian `jobDetailView.js`: 665/666 pass, 1 skip, 0 fail
  (antes y después del refactor de `crearAlbaran`/`leerLineasDelFormulario`).
- `tests/scrum726-quien-firma-la-microcopy.test.mjs`: verde con el nuevo registro
  `docs/microcopy/2026-09-27-SCRUM-993-un-toque.md`.

## Error propio, declarado

El primer intento de `crearAlbaran` tomaba los `datos` crudos y hacía su propio cuerpo+POST,
duplicando la llamada de creación que ya hacía `onGuardar` — dos altas de albarán en el mismo
fichero, exactamente lo que `SCRUM-303`/`SCRUM-606` existen para impedir, y sus guards lo
cazaron. Se corrigió dejando `onGuardar` con su cuerpo intacto (para no invalidar el receptor que
vigila SCRUM-593e/607) y que `crearAlbaran` reciba el cuerpo YA CONSTRUIDO, siendo el único punto
que llama a `apiRequest`.

Un segundo error: las constantes nuevas y el botón de confirmación usaban estilos en línea
(`style.cssText`) y un `btn-primary btn-sm` sin declarar, tumbando SCRUM-713c (trinquete de
estilos) y SCRUM-412 (primaria nunca `btn-sm`) — corregido con clases CSS (`.alb-confirmar-fila`,
reuso de `.alert.info`) y la declaración correspondiente.

## Fuera de este incremento

- El criterio interino de WhatsApp se sustituye cuando SCRUM-1171 exista (referencia dejada en el
  código).
- No se toca `jobNextAction.js` ni la escalera: si su rediseño hace falta, es SCRUM-917.

## 2ª vuelta · 2026-09-28 · opción A y la hoja que se cierra (S4, relevo de `s4-28b`)

Construye la decisión del orquestador en **SCRUM-993 comentario 17327**, que contesta a la medición
del comentario 17325. Los tests de esta vuelta los dejó escritos `s4-28b` sin commitear al caer
(`exit 4`, 14:19:55Z); se leyeron, sirven, y se completaron.

**Qué cambia en `jobDetailView.js`:**

1. **Sin teléfono ni móvil, `onEntregarYFirmar` es `undefined`** y `buildAlbEditor` no monta ni el
   botón ni la confirmación. «Crear albarán» sigue. El criterio sigue siendo el INTERINO de 17263
   (SCRUM-1171 lo sustituye).
2. **RETIRADO** el texto de confirmación sin canal (constante borrada; el registro de microcopy lo
   tacha, no lo borra).
3. **Una vez creado el albarán, `onEntregarYFirmar` ya no lanza.** El `catch` de la hoja (que la
   deja abierta y rehabilita «continuar») solo recibe los fallos del ALTA, que no dejan nada creado.
   Un fallo de EMITIR deja un borrador visible en la ficha tras el refresco (aviso ya existente «No se
   pudo completar la entrega.»); un fallo del ENVÍO —incluido el 409 `customer_missing_phone`, que
   LANZA en `apiRequest`— pinta el aviso firmado en 17263. En los dos casos la hoja se cierra y la
   ficha se refresca: el segundo clic que creaba y EMITÍA otro albarán ya no existe.
4. **El éxito solo con `sent === true`.** Distinguible de verdad: el servidor pone `sent: true`
   únicamente en `sendSuccessBody` (`src/lib/sendOutcome.ts`); el fallo con 200 lleva `sent: false`
   y el resto son no-2xx. La condición de la firma de 17327 se cumple.

**Verificación en rojo:** `tests/scrum993-boton-un-toque.test.mjs` contra el `jobDetailView.js` de
`origin/main`: 7 pass / **4 fail** (los cuatro nuevos). Con el cambio: **11/11**. Suite dirigida
(81 ficheros que citan `jobDetailView`/SCRUM-993): 737 tests, 735 pass, 1 skip, 1 fail → era
SCRUM-644 (trinquete de `.message` crudos): el primer intento pintaba `e.data.message` del servidor
en el fallo de emitir. Arreglado el CÓDIGO (texto fijo ya existente), no el trinquete.

**Hallazgo del banco, no arreglado aquí:** en `_banco-vistas.mjs`, `removeChild` desregistra el id
del nodo quitado pero NO los de su subárbol — tras `overlay.remove()`, `getElementById` seguía
encontrando el «continuar» de dentro, y el test salía rojo con la hoja ya cerrada. El test mide con
`sigueMontado` (sube por `_padre` hasta `body`), con control positivo antes de pulsar. Y un
`assert.equal(nodo, null)` que falla sobre un nodo del mini-DOM **agota la memoria** al
inspeccionarlo (`RangeError: Array buffer allocation failed`, 100 s): se aserta con `=== null`.
