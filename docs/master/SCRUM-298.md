# SCRUM-298 (A8) · El modo de emisión, VISIBLE — y el modal que NO se construye

**Fecha:** 7-ago-2026 · **Carril:** A (facturación) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `343ab7b6e5580f951689a060ccf355c476ff5468` · 2026-08-07T11:15:00+02:00
**Tanda:** 2134 tests, 2061 pass, 0 fail, 73 gateados a staging

> **ENTREGA PARCIAL Y DECLARADA, por decisión del fundador tras el PASO 0.** Se construye la
> VISIBILIDAD. **El modal de dos caminos NO se construye**, ni con la segunda salida
> deshabilitada, y el motivo está medido más abajo.

## PASO 0 — la mitad del enunciado no existía

| Qué | Resultado |
|---|---|
| ¿Rama con el 298? | ninguna |
| ¿Entrada de máster? | no existía |
| ¿`getEmissionMode` llega al navegador? | **NO. Cero consumidores en `public/`** |
| ¿Existe «se envía»? | **NO** — ver abajo |

**La mitad cierta:** el modo no se ve. Lo único que llegaba al navegador era `documentoSuelto`
(A0.5), y solo sirve para elegir el rótulo de un botón. Dos estados que producen documentos
**distintos** se veían exactamente igual en pantalla — el mismo defecto de toda la semana, pero
aquí el que se equivoca responde ante Hacienda.

## 🔴 «Se envía» NO EXISTE — medido, no supuesto

Barrido ignorando comentarios y URLs de spec:

- **cero clientes SOAP/mTLS** contra la AEAT (el único acierto del grep era `pdf.service.ts`, que
  es renderizado);
- **`VfSubmission` no está en el schema** — no hay cola de remisión;
- `applyVeriFactu` calcula la **cadena de huellas SHA-256** y la URL del QR: **sella en local**;
- `registro.builder.ts` **construye el sobre** y los XSD están vendorizados, pero **nadie los manda
  a ningún sitio**.

**Hoy todo es «se guarda».**

### Por eso el modal no se construye, y la razón es la asimetría de coste

> **No enseñarlo no cuesta nada. Enseñarlo inerte cuesta que un profesional crea que está
> remitiendo a la AEAT cuando no lo está.**

Una salida visible pero deshabilitada le dice que **elegir remitir es algo que él podría hacer**, y
eso es exactamente la clase de creencia que la regla 26 existe para no fabricar. Un interruptor de
dos caminos donde uno no lleva a ninguna parte es el «botón que hace la mitad» con una etiqueta
fiscal encima.

**Siguiente acción concreta:** el modal se desbloquea cuando exista la remisión (S1-B/S1-D):
cliente mTLS, `VfSubmission` y su FSM, y la cola. Antes de eso no hay dos caminos que ofrecer.

## 🔴 SEGUNDO HALLAZGO: el interruptor tiene MOTOR y no tiene SUPERFICIE

`cambiarFlagFiscal` (SCRUM-218) existe como servicio de dominio, con `FLAGS_FISCALES`
(`INVOICING_ES_ENABLED`, `SIF_ENABLED`) y su auditoría **en la misma transacción** — sin
constancia el hecho no ocurre. Y **no tiene ninguna ruta**. Es justo lo contrario del problema que
esperaba encontrar.

⚠️ **Y NO se le pone.** Una ruta que permita cambiar el flag fiscal desde la interfaz choca de
frente con la regla 24 (`INVOICING_ES_ENABLED` OFF para merchants reales). **Que exista el motor y
no la puerta es, hoy, lo correcto.** Queda escrito para que nadie lo lea como un olvido y le añada
la superficie «que falta».

## Lo que sí se construye

`modoVisible.ts` — puro, **solo lectura**, derivado de `getEmissionMode`. El modo viaja en
`GET /admin/me` como `modoEmision` y la pantalla lo **recibe**, no lo recalcula.

**Fuente única, y es el punto entero:** quien decide qué documento sale y quien dice qué modo se
enseña son la MISMA función. Con dos, la pantalla dice una cosa y el documento sale de otra.
`documentoSuelto` y `modoEmision` se calculan además desde **un solo objeto** (`merchantParaModo`):
construirlo dos veces serían dos lecturas que pueden divergir. Es la lección de A0.5, cuando
`facturaSueltaDisponible` se sustituyó en vez de dejar los dos campos conviviendo.

### El suelo: `null` es un valor de primera clase

Sin merchant —o con un valor fuera del contrato— sale **`null`, nunca un modo por defecto**, y la
pantalla **no pinta nada**. Enseñar el modo equivocado es peor que no enseñar ninguno: quien lo lee
toma decisiones fiscales sobre una pantalla que le miente y no tiene forma de sospecharlo. El
navegador tampoco normaliza: normalizar sería inventarse el estado fiscal de alguien.

## Microcopy — las TRES ramas con marcador (reglas 30 **y** 26)

`ROTULO_MODO_EMISION` tiene las tres claves y las tres valen `[PENDIENTE microcopy oficial]`. **No
dos y una «provisional que se lee bien»**: un texto que no chirría se queda para siempre.

**PROCEDENCIA del bloqueo: esta sección.** Los aprueba el fundador.

Y **no se ha escrito ni una palabra** que explique qué es cada modo, por qué, desde cuándo, ni nada
sobre VeriFactu, la AEAT, el registro o el calendario. Esa pregunta se responde **solo con el guion
H2**. Hay guard que lo exige, con hermano positivo.

## Verificado en rojo

| # | Qué se rompe | Qué cae |
|---|---|---|
| 1 | Se aplana `demo` en `fiscal` | 🔴 3 tests, y el de mecanismo **nombra** el modo y el merchant |
| 2 | Sin merchant se cae a un modo por defecto | 🔴 «eso es inventarse el estado fiscal de alguien» |
| 3 | El front reconstruye el criterio | 🔴 «está reconstruyendo el modo en vez de recibirlo» |
| 4 | Microcopy escrita en **una** de las tres ramas | 🔴 el guard que recorre **todas** las ramas |

El **4 es el que hereda mi propio hallazgo**: el rótulo sale de un **objeto indexado**
(`ROTULO_MODO_EMISION[modo]`), que es otra forma del ternario ciego de SCRUM-346. Un guard que
mirase solo el literal de la asignación no vería **ninguna** de las tres ramas. El extractor
recorre ternario, `||`/`??` y objeto indexado, **con su propio suelo** que exige que vea las tres
formas.

> Y el guard me dio **rojo en falso** al primer intento: cortaba desde la primera aparición de
> «SCRUM-298» —la declaración de constantes, arriba del fichero— y se tragaba la cabecera de
> Ajustes, cuyo copy está aprobado desde otro carril. Acotado a mi bloque. Un guard que grita sin
> motivo se acaba silenciando.

## Regla 24 y regla 38

**No enciende nada.** El módulo solo lee, y hay guard **estructural** que lo fija: sus
importaciones tienen que ser exactamente `['./emission.service']`. Con Prisma o el servicio de
flags dentro, dejaría de ser solo lectura.

**Camino de emisión intacto**: cero cambios en `invoicing.service.ts`, `invoiceNumber.service.ts`,
`emission.service.ts` y `prisma/`.

Ficheros: `src/modules/invoicing/domain/modoVisible.ts` (nuevo — el derivador) ·
`src/app.ts` (`modoEmision` en `/admin/me`, y el objeto único de modo) ·
`public/dashboard/js/app.js` · `public/dashboard/js/settingsView.js` (la fila, con marcadores) ·
`tests/scrum298-modo-visible.test.mjs` (12, nuevo).
