# SCRUM-1229 · La firma del técnico se registra desde el panel — medido por el viaje

**Medido contra:** `origin/main` = `4583f537880241f948a78c9ee274d1b1a59c59a0` · 2026-09-28T15:24:32Z
**Medido en:** sesión `s4` · rama `scrum-1229-firma-tecnico-viaje`

## El defecto

La pantalla del parte mandaba el nombre del técnico como `firmadoPorNombre`, y
`POST /admin/partes/:id/firmar-tecnico` lee `firmadoTecnicoNombre` → **400 `firma_sin_nombre`,
siempre**. La cola sin conexión tampoco lo salvaba: `subirFirmaDeLaCola` solo reenviaba
`firmadoPorNombre/Calidad/CalidadOtro`, así que una firma del técnico encolada subía sin nombre, el
servidor la rechazaba y **salía de la cola como rechazada: se perdía**.

Además el pad, abierto para el técnico, le decía «Pide al cliente que firme…» y le ofrecía el «en
calidad de qué» que SCRUM-653 c.14494 le quitó a propósito.

**Corrección a la medición del 28-sep (SCRUM-1215 c.17360):** allí dije que el pad «le propone el
nombre del cliente». No es así en producción: el chip «Es %s» sale de `chipNombreCliente`, que está
en las ayudas del albarán y **no** en `PARTE_AYUDAS`. Solo aparecería si `/admin/me` no sirviera las
del parte. Aun así, al técnico ya no se le pasa ninguna sugerencia.

## El arreglo — en quien llama, no en quien recibe

- `parteDetailView.js` · `firmarParte`: cuando firma el técnico, el cuerpo es
  `{ signatureData, firmadoTecnicoNombre }`; el pad se abre **sin pista** (`hint: null`) y con
  `firmante: { sugerencia: '', sinCalidad: true }`. La firma del cliente no cambia.
- `signaturePad.js` (componente compartido; **inventario: lo abren `albaranDetailView.js` y
  `parteDetailView.js`, nadie más**): dos opciones nuevas que solo actúan si se pasan —
  `hint: null` (sin pista; `undefined` sigue dando la de siempre) y `firmante.sinCalidad`. El albarán
  no pasa ninguna de las dos, así que se comporta igual.
- `colaDeFirmas.js` · `subirFirmaDeLaCola`: reenvía también `firmadoTecnicoNombre`.
- `partes.routes.ts` **no se toca**: aceptar los dos nombres dejaría el contrato con dos puertas.

Sin texto nuevo: al técnico se le **quita** la pista del cliente, no se le escribe otra.

## Verificación — el viaje, no el gesto

`tests/scrum1229-firma-del-tecnico-viaje.test.mjs` carga el **panel entero** en el banco
(`cargarDashboard`: `api.js`, `signaturePad.js`, `colaDeFirmas.js`, `parteDetailView.js` de verdad),
pinta el parte, pulsa «Firma del técnico», escribe el nombre **en el pad**, traza y confirma. El
cuerpo que se mira es el que sale por `fetch`; nadie lo escribe a mano. Lo que el servidor exige se
**lee de `partes.routes.ts` por AST** (qué campo pasa cada ruta de firma a `exigirNombreFirmante`) y
se comprueba con la función real del dominio.

- **Rojo antes**, con el código de `origin/main`: 3 de 5 caen, cada uno por su causa (la ruta lee
  `firmadoTecnicoNombre` y la pantalla mandaba `firmadoPorNombre`; «Pide al cliente» en el pad del
  técnico; la cola sube sin el campo). El suelo y el control positivo pasan.
- **Verde después:** 5/5. Incluye el camino **sin red**: se encola, vuelve la red, se drena y sube
  con el nombre que la ruta lee.
- **Control positivo:** el cliente sigue firmando por `/firmar`, con su «en calidad de qué».
- Tanda de todo lo que toca pad, cola, parte o carga el panel (126 ficheros + censos 1157 y 1185):
  **1211 · 1211 pass · 0 fail · 0 skip · 0 cancelled**.

**NO VERIFICABLE en yaqu.app** desde S4: la lectura de producción está denegada por el clasificador
de permisos a esta sesión.
