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

---

# TRAMO 2 · la fila se muda a `Cumplimiento`, y dos de los tres rótulos se aprueban

**Fecha:** 7-ago-2026 · **Carril:** S3 · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `c6546bc19b9366a397127c7ea8c9704883f69697` · 2026-08-07T17:52:10+01:00
**Tanda:** 2154 tests · 2081 pass · **0 fail** · 73 gateados

> Confirmadas por el fundador las decisiones del PASO 0: **no se construye el interruptor ni el
> modal**, y **`cambiarFlagFiscal` sigue sin ruta** — es lo que impide la regla 24. La frase
> «Preparado para VERI\*FACTU…» **no va en esta pantalla**: es copy de landing (bloque F).

## R1, R2 y R4 quedan RETIRADAS — las retiró el fundador, y eran suyas

Las tres verificaciones venían en el encargo de esta sesión y **se retiran por medición, no por
dificultad**. Queda escrito porque una verificación que desaparece sin motivo se lee mañana como un
hueco:

| # | Lo que pedía | Por qué se retira |
|---|---|---|
| **R1** | un merchant real NO puede encender el interruptor | **no hay interruptor que encender.** `cambiarFlagFiscal` no tiene ruta y no se le pone. Lo más cercano que sí existe y sigue verde: el guard estructural de regla 24 (`modoVisible` no puede escribir nada) |
| **R2** | cambiar de modo no altera facturas ya emitidas (regla 29) | **nada cambia de modo desde la interfaz**, porque no hay superficie que lo cambie. La regla 29 la sostienen los guards del camino de emisión, que este ticket no toca |
| **R4** | control positivo: «se envía» sigue funcionando en staging | 🔴 **«se envía» NO EXISTE.** No es que no se midiera: no hay sujeto que medir. Ver la sección de arriba |

**R3 y R5 se mantienen, y estaban ya cubiertas más fuerte de lo que pedía el encargo**: el suelo no
degrada «hacia se guarda», es que **no pinta nada** (`null`), y el rojo por mecanismo **nombra** el
modo y el merchant.

## La mudanza a `Configuración › Cumplimiento`

La fila vivía en la cabecera de la tarjeta (`card.insertBefore(fila, nav)`), **fuera de los diez
paneles** — por eso el submenú seguía figurando como hueco declarado. Ahora se pide el panel **por
el mapa** (`panelDeSuperficie("modoEmision")`), nunca por una clave escrita a mano, y el modo se
registra como **superficie** (`ASIGNACION_SUPERFICIE`), no como campo: es ESTADO, no un ajuste que
se guarde. La derivación **no se tocó** al mudarla — sigue llegando de `getEmissionMode` por
`/admin/me`.

`cumplimiento` **sale de `VACIOS_DECLARADOS`**: un hueco que ya tiene contenido deja de ser un
hueco. Si se hubiera dejado, `vaciosQueYaNoLoEstan` lo habría cazado.

### El choque de guards que destapó la mudanza (y por qué se arregló el guard)

Con `cumplimiento` **dentro** de `VACIOS_DECLARADOS` caía el guard ④ (que cuenta campos **y**
superficies). **Fuera**, caía el negativo «ningún submenú REAL queda vacío por accidente», que
contaba **solo campos** y por tanto asumía sin escribirlo que *todo submenú no declarado vacío tiene
CAMPOS*. `cumplimiento` es el primero con superficie y sin campos.

> **No existía ninguna forma de declarar la verdad que dejara los dos verdes.** Cuando ningún código
> correcto puede pasar dos guards a la vez, la contradicción está en los guards — aquí, en que dos
> tests del MISMO fichero contaban poblaciones distintas mientras `tieneAlgo` ya las contaba bien.

Arreglado el negativo para que cuente las dos poblaciones, **conservando su suelo** (que los campos
sigan repartidos y la pantalla no se quede sin ajustes). Es la misma familia que SCRUM-392.

## Microcopy — dos aprobados CON procedencia, uno DEVUELTO

Aprobados por el fundador el 7-ago-2026 **con la condición de verificar cada afirmación contra el
mecanismo antes de escribirla**. Se verificaron las tres:

| Modo | Estado | Medición |
|---|---|---|
| `fiscal` | ✅ escrito | numera con la serie fiscal (`formatInvoiceNumber`, lock `SERIE_LOCK_NS`); «no se edita ni borra» en `invoicesAdmin.routes.ts:68` — SOLO ALTA, regla 29 |
| `demo` | ✅ escrito | `DEMO_WATERMARK = 'DEMO — no válida fiscalmente'` (`emission.service.ts:12`), aplicada en `lib/invoicing.ts:122` y `:257` |
| `receipt` | 🔴 devuelto → ✅ **escrito** (2.ª redacción) | ver abajo |

### 🔴 `receipt` — la 1.ª redacción decía «con su propia numeración», y era FALSO

El código lo dice en su propio comentario (`invoiceNumber.service.ts:32-35`):

> los merchants ES reales con `INVOICING_ES_ENABLED` off **NO consumen la serie fiscal** — reciben
> una **referencia** `J-YYYYMMDD-XXXX` **fuera de toda serie de facturación** («**sin numeración de
> factura**», Parte M).

Y `makeReceiptNumber` cierra la referencia con **`Math.random()`**, no con un contador: dos
justificantes del mismo día no guardan ningún orden entre sí. Prometer «numeración» promete una
**correlatividad que no existe**, y es el modo en el que están **hoy todos los merchants ES reales**.

Lo que sí se sostiene de la propuesta: «**no es una factura**» — `type: 'JUST'`, prefijo `J-`, y
nunca entra en la cadena de huellas (`verifactu.service.ts:333`).

#### ✅ Resuelto: 2.ª redacción, y las tres afirmaciones medidas

El fundador la reescribió el mismo día cambiando «numeración» por **referencia** y añadiendo lo que
de verdad le importa al profesional — que su serie no se gasta:

> **Se emiten justificantes de cobro** · «Cada cobro genera un justificante para tu cliente, con su
> propia referencia. No es una factura y no consume tu serie de facturación.»

| Afirmación | Medición |
|---|---|
| «con su propia referencia» | distinta por `@@unique([merchantId, number])` de `Invoice`: no pueden coexistir dos iguales. **Habla de DISTINCIÓN, nunca de orden** — dos del mismo día no guardan ninguno |
| «no es una factura» | `type: 'JUST'`, prefijo `J-`, fuera de la cadena de huellas |
| «no consume tu serie de facturación» | **la más fuerte**: `invoiceNumber.service.ts:214-219` genera la referencia y hace `return` **ANTES** del `tx.merchant.update` que avanza `nextInvoiceNumber`. El contador no se toca ni por accidente |

Y la prueba de que el guard protege justo esa regresión: volver a escribir «numeración» en el texto
aprobado lo pone **rojo** (mutación verificada en disco, fichero restaurado idéntico).

> **La condición del fundador —verificar cada afirmación contra el mecanismo antes de escribirla—
> se estrenó aquí y cazó una de tres a la primera.** Un rótulo que promete de más es peor que un
> marcador `[PENDIENTE]`: el marcador pide permiso, y el texto que suena bien ya no lo pide nunca.

### El guard de microcopy evoluciona: marcador **o** aprobado con procedencia

Antes exigía que **los tres** textos fueran el marcador, así que aprobar dos lo ponía rojo — por
diseño. Ahora la propiedad es: *o es el marcador, o está en `APROBADOS` con **dónde consta** y
**contra qué se verificó***. Y **caduca**: un texto listado que deje de pintarse pone el guard rojo,
para que la entrada se borre. Sin eso la lista solo crecería y acabaría pre-aprobando frases que
nadie decidió — *una excepción que sobrevive a su causa deja de ser una nota y pasa a ser un
permiso*. La aprobación es **literal**: cambiar una coma vuelve a rojo.

⚠️ El guard de la **regla 26** no se ha tocado, y sigue verde.

## Verificado en rojo — 8 mutaciones, inyección comprobada en disco

| Qué se rompe | Qué cae |
|---|---|
| el front reconstruye el criterio (R5) | 🔴 «settingsView.js está reconstruyendo el modo en vez de recibirlo» |
| se aplana `demo` en `fiscal` | 🔴 «la pantalla enseñaría «fiscal» y se emitiría «demo» para demo@yaqu.app» |
| la fila se pinta sin comprobar el modo (R3) | 🔴 «con `null` enseñaría un hueco o, peor, un valor por defecto» |
| texto sin aprobar en la rama `receipt` | 🔴 «HAY MICROCOPY ESCRITA SIN APROBAR» |
| un texto aprobado cambia **una coma** | 🔴 «HAY MICROCOPY ESCRITA SIN APROBAR» |
| un aprobado deja de pintarse y sigue listado | 🔴 «hay textos APROBADOS que ya no se pintan» |
| la fila se coloca a mano en vez de por el mapa | 🔴 «la vista escribe claves de submenú como literal» |
| `cumplimiento` vuelve a declararse vacío | 🔴 «ESTOS SUBMENÚS YA NO ESTÁN VACÍOS y siguen declarados como hueco» |

> ⚠️ Dos de las ocho **no saltaron al primer intento**, y no por el código: las anclas se escribieron
> con `\n` sobre ficheros en **CRLF**, así que la mutación no llegó a aplicarse. Lo delató que el
> script imprime su propio fallo (`[!! ANCLA NO ENCONTRADA]`). Es el caso A de `METODO_YAQU.md`,
> repetido — y la razón de que ese aviso exista.

Ficheros de este tramo: `public/dashboard/js/settingsView.js` (rótulos + mudanza) ·
`public/dashboard/js/settingsSubmenus.js` (superficie + retirada del hueco) ·
`tests/scrum298-modo-visible.test.mjs` (guard de microcopy con procedencia y caducidad) ·
`tests/scrum284-asignacion-submenus.test.mjs` (el negativo cuenta las dos poblaciones).
