# SCRUM-895 · El botón que dice «[PENDIENTE microcopy oficial]» y siempre falla

**Medido contra:** `origin/main` = `aa465cdd6fc64625bc5a4e16d575fd0810064be6` · 2026-09-17T09:28:36+01:00

(`aa465cdd Merge pull request #1382 from lwislg99/scrum-orquestador-puestos-a-fuego`)
**Rama:** `scrum-895-boton-pendiente-microcopy` · **Worktree:** `cobroflash-b6`

---

## PASO 0 · lo que se midió antes de tocar nada

### (a) Cuántos sitios más llevan un marcador sin texto real

**Tres instrumentos contestan tres preguntas distintas, y sólo uno contesta la del ticket.**

| instrumento | población declarada | lo que cuenta | resultado |
|---|---|---|---|
| `guard:marcadores-en-pantalla` (SCRUM-722) | **27 vistas × 3 estados · 91 scripts** | lo que llega al **DOM renderizado** | **12** apariciones, en 2 vistas (`quotes-new` 6, `export` 6), las dos **en su techo** |
| `censo-marcadores.mjs` (SCRUM-293) | **389 ficheros** | marcas escritas y su cierre transitivo | 29 marcas · «250 superficies» |
| recuento propio, a nivel de **sitio de rótulo** | 59 sitios (8 literales + 51 a un salto) | dónde el marcador se junta (o no) con una palabra | 37 mudos brutos → **~15 que pintan de verdad** |

**El guard es la autoridad, y su verde es verdadero:** corrió su control negativo en la misma
ejecución (`✅ el marcador inyectado se detecta`) y no ha subido ningún techo.

#### 🔴 Hallazgo 1 — el censo estático dice 250 superficies y no son 250 rótulos

`censo-marcadores.mjs` propaga por identificador **sin tope de saltos**:

    MARCA → COPY.buscar = MARCA + ' Busca por…' → input.placeholder = COPY.buscar

La misma etiqueta se cuenta dos o tres veces, y en el cierre transitivo entran líneas que no pintan
texto ninguno: `setTimeout(cargar, 250)`, `pintarFilas(datos)`, `window.ALB_ORIGEN_COPY = COPY`.
Eso explica el salto de **113** superficies (censo del 17-ago, recontado a mano) a **250** hoy sin
que el producto haya empeorado el doble. Para su pregunta —un trinquete que sólo baja— sirve. Para
«¿cuántos rótulos ve un profesional?» no. **No se toca** (regla 9): queda anotado.

#### 🔴 Hallazgo 2 — el guard tiene un punto ciego, y SCRUM-895 vive justo en él

`scripts/guard-marcadores-en-pantalla.mjs:194`:

```js
if (/\/admin\/albaranes\//.test(limpia)) v.estado = 'borrador';
```

`albaran-detail` **sí** está entre las 27 vistas vigiladas, pero su banco sirve **siempre un
albarán en borrador**. El botón de este ticket sólo existe en `firmado`. Por eso el marcador más
grave del producto —la primaria de un documento que se firma en la obra— nunca salió en un guard
que lleva meses en verde. El guard hace exactamente lo que promete; lo que no cubre es un estado.

#### 🔴 Hallazgo 3 — 9 sitios donde el marcador es el texto ENTERO, fuera de toda población

Ningún guard los mira: el de SCRUM-722 mide el DOM del panel, y estos son respuestas de API y un
PDF.

| fichero:línea | qué lee el usuario |
|---|---|
| `albaranes.routes.ts:1368` | 409 `albaran_no_firmado` |
| `albaranes.routes.ts:1371` | 409 `albaran_ya_facturado` |
| `albaranes.routes.ts:1388` | 409 `facturacion_no_disponible` ← **el de este ticket** |
| `albaranes.routes.ts:1426` | mensaje de la respuesta de conversión |
| `albaranes.routes.ts:1565` | mensaje cuando no queda sellada o falla el adicional |
| `albaranes.routes.ts:1572` | 409 `facturacion_no_disponible` (facturar-parcial) |
| `invoicesAdmin.routes.ts:986` | 409 del bloqueo de rectificativa (SCRUM-308) |
| `albaranFirmante.ts:269` | etiqueta de calidad del firmante |
| **`pdf.service.ts:613`** | **impreso en el PDF que recibe el cliente** |

El último es el peor de la lista: no es una pantalla que se pueda recargar, es un documento que ya
salió por WhatsApp.

> **Lo que NO es un hallazgo.** `semaforoFiscal.js` usa `'[PENDIENTE ASESOR]'` como **centinela**:
> `bloquePendiente()` devuelve `null` cuando lo encuentra, o sea que **no se pinta a propósito**.
> Sale en el barrido por texto y no es un defecto. Lo mismo las ~20 líneas de reexportación
> (`window.X = X`) y listas de parámetros, que no pintan nada.

### (b) Por qué da 409 — son DOS defectos distintos en el mismo botón

**No comparten causa, y arreglar uno no toca al otro.**

**El 409** sale de `albaranes.routes.ts:1386-1389`: la ruta emite un documento **fiscal**, y
`getEmissionMode(merchant)` devuelve `'receipt'` para un merchant ES real con
`INVOICING_ES_ENABLED` apagado. En ese modo la factura **no existe**, así que el 409 no es un fallo
intermitente: es el único desenlace posible. No depende del albarán ni del presupuesto.

**El texto que falta** es otra cosa: `btnConvertirFactura` **no tiene entrada** en
`ROTULOS_ALBARAN` (`albaranDetailView.js:79-95`, diez claves, ninguna es ésa), así que
`mk()` cae al respaldo de la línea 399:

```js
b.textContent = ROTULOS_ALBARAN[id] || MICROCOPY_PENDIENTE;
```

Es exactamente la familia de SCRUM-302 —seis botones se quedaron sin rótulo al partir el objeto— y
`tests/scrum302-rotulos-completos.test.mjs` existe para eso. Aquí no saltó porque el rótulo no está
**partido**: nunca se escribió.

Que los dos coincidan en el mismo botón es casualidad. **Escribir el rótulo dejaría un botón bien
rotulado que sigue fallando siempre; arreglar el 409 dejaría un botón que funciona y no dice qué
hace.** Por eso este ticket hace lo segundo y PARA en lo primero (regla 30).

### (c) Qué debería ofrecer esa pantalla con la facturación ES apagada

**La respuesta honesta NO es «nada útil», y eso corrige la frase del ticket.** Un albarán
`firmado` ofrece hoy, derivado de `ALBARAN_ACTION_REGISTRY`:

| acción | destino en `firmado` | ¿funciona con el flag apagado? |
|---|---|---|
| `btnConvertirFactura` | primaria (contextual) | ❌ **409 siempre** |
| `btnFacturar` | primaria (contextual, excluyente) | ❌ lleva al Trabajo, y ahí `facturar-parcial` también corta con 409 en este modo |
| `btnPdf` — «Descargar PDF» | secundaria | ✅ |
| `btnWhatsApp` — «Enviar por WhatsApp» | secundaria | ✅ |
| `btnVerTrabajo` — «Ver trabajo» | ⋮ | ✅ |
| `btnDuplicar` — «Duplicar» | ⋮ | ✅ |
| `btnFoto` — «📷 Añadir foto» | ⋮ | ❌ **409 `albaran_locked` siempre** (ver abajo) |

Así que el botón **no es lo único que ofrece la pantalla**: quedan cuatro acciones válidas y
aprobadas. Lo que es cierto —y es lo grave— es que **es la única PRIMARIA**, el siguiente paso que
la pantalla señala, y ese siguiente paso no existe en este modo. Al quitarlo, el albarán firmado se
queda sin primaria, que es información correcta: en modo justificante, un parte firmado no tiene
siguiente paso documental.

---

## EL ARREGLO

**Una sola regla, en un solo sitio.** `albaranAccion.js` gana `facturaFiscalDisponible()` y la
condición `sin-valorar-convertible` la exige. El criterio se lee de `window.appModoEmision`
(`app.js`, SCRUM-298), que **ya existía** y lo calcula el servidor: regla 27 intacta, ni estado ni
flag nuevo, ni dependencias (regla 36), vanilla sin bundler (regla 4).

**Y se cerró la segunda fuente.** `albaranDetailView.js` tenía su propia copia inline del contexto
—idéntica palabra por palabra a la de `albaranAccion.js`—, resto de SCRUM-831, que sacó el
resolutor fuera para las tres superficies y dejó ésta sin migrar. Con dos copias, la condición
nueva habría entrado en una y no en la otra: la **lista de Albaranes** escondería el botón
imposible y el **detalle** lo seguiría ofreciendo. Ahora el detalle pregunta:

```js
const ctx = typeof ctxAlbaranDeFila === 'function' ? ctxAlbaranDeFila(alb) : {};
```

Sin contexto se ocultan las dos primarias contextuales, que es como falla el resto de la pantalla
(`destinoEfectivo` devuelve `'oculta'` ante una condición que nadie sabe responder). Un respaldo
que recalculara el criterio aquí volvería a abrir la segunda fuente.

### Por qué se OCULTA y no se deshabilita

Canon de SCRUM-823, nacido en esta misma sección de Albaranes:

> Un control que no se puede usar y no puede explicar por qué, no se deshabilita: se quita.

Deshabilitarlo dejaría un control muerto y el profesional no sabría si es su permiso, un fallo de
carga o su modo fiscal. Decírselo exigiría un texto que nadie ha firmado.

### Lo que NO se hizo, a propósito

- **El rótulo del botón sigue siendo el marcador** en modo `fiscal` y `demo`, donde el botón sí se
  ofrece. Es microcopy: se propone y se para (regla 30). Los literales van abajo.
- **Los 9 mensajes de servidor siguen siendo el marcador.** Igual.
- **`INVOICING_ES_ENABLED` no se ha tocado** ni para probar: las dos ramas se miden moviendo
  `window.appModoEmision`, que es el veredicto **ya calculado** que el navegador recibe.

---

## LAS DOS MITADES

`tests/scrum895-boton-imposible.test.mjs` · 7 tests.

| mitad | qué exige |
|---|---|
| **ROJO REAL** | con `appModoEmision='receipt'`, `primariaDeAlbaran` de un albarán firmado · SIN_VALORAR · con presupuesto devuelve `null`, no `btnConvertirFactura` |
| **VERDE REAL** | con `appModoEmision='fiscal'`, devuelve `btnConvertirFactura` |

Más: `demo` conserva el botón (regla 8), el modo **desconocido** (`null`) lo conserva también —y
eso es una decisión declarada, no un descuido—, el detalle no tiene segunda copia del criterio, y
un **suelo** que se declara ciego si el resolutor no discrimina por estado.

### Que el rojo era rojo, medido

Sin tocar el árbol y sin `stash`, se montó el mismo resolutor con los ficheros de `origin/main`
(`git show origin/main:<fichero>`):

```
── EL MAIN DE HOY, albarán FIRMADO · SIN_VALORAR · con presupuesto ──
  modo 'receipt' (facturación ES APAGADA) → primaria: btnConvertirFactura
  modo 'fiscal'  (facturación ES ENCENDIDA) → primaria: btnConvertirFactura
```

Las dos ramas daban **lo mismo**: el defecto existe y el ROJO habría fallado. El VERDE ya pasaba
antes, así que el arreglo no ha apagado la acción para quien sí puede usarla.

---

## 🔴 LO QUE ME ENCONTRÉ Y NO ARREGLO (regla 9 · tope A7)

**`btnFoto` es el mismo defecto, en el mismo documento, sin arreglar.** «📷 Añadir foto» se ofrece
en el «⋮» de un albarán **firmado** (`albaranActionsRegistry.js:65`) y el servidor lo rechaza
siempre: `albaranes.routes.ts:1051` corta con 409 `albaran_locked` para `estado === 'firmado'`. Es
un botón que sólo sabe fallar, igual que éste, y con víctima hoy: cualquier profesional que abra un
parte firmado y quiera añadir una foto de la obra.

Se diferencia en algo importante: **su 409 sí lleva texto real** —«Un albarán firmado está
congelado: no admite fotos nuevas.»—, así que el profesional al menos se entera de por qué. Por eso
no lo meto aquí: es otro ticket, no un fleco de éste, y tocarlo sería alcance que no me diste.

**No abro el ticket**: el tope A7 es tuyo. Te lo traigo con su medición hecha.

---

## 🔴 PROPUESTA DE MICROCOPY — NI APROBADA NI APLICADA

> **Por qué vive aquí y no en `docs/microcopy/`.** El encargo decía ese directorio, y ahí no cabe:
> `tests/scrum726-quien-firma-la-microcopy.test.mjs` exige que **todo** registro de
> `docs/microcopy/` lleve una firma que cuente —la del fundador, o la delegada completa y
> vigente—, y una propuesta sin firmar lo pone en rojo (`firmante: null`). Ese directorio es el
> archivo de lo ya firmado, no el buzón de lo que espera firma. Se probó, se midió el rojo y se
> movió aquí: el arreglo va en mi fichero, nunca en la lista del guard (A7).
>
> **Ninguno de estos cuatro literales está en el producto.** Hasta que los firmes, siguen saliendo
> como `[PENDIENTE microcopy oficial]`, que es feo a propósito.

### (A) El rótulo del botón — el único que se ve hoy en pantalla

`albaranDetailView.js`, objeto `ROTULOS_ALBARAN`, clave `btnConvertirFactura` (hoy ausente).
Primaria de `firmado` para el parte **SIN_VALORAR** con presupuesto detrás, en modo `fiscal`/`demo`.

**Qué hace:** emite una factura con las **cantidades del parte** y los **precios del presupuesto
firmado**. Lo añadido en obra **no se factura**: dispara un presupuesto adicional que el cliente
firma.
**Qué necesita entender el profesional antes de pulsar:** que factura ya, que los precios son los
que su cliente aceptó (no los que él teclee ahora), y que lo añadido va aparte.
**Sus nueve hermanos de barra, ya aprobados, son todos verbos:** `Emitir`, `Enviar para firmar`,
`Facturar lo entregado`, `Firmar aquí mismo`, `Descargar PDF`, `Enviar por WhatsApp`,
`Editar líneas`, `Duplicar`, `Ver trabajo`.

    Facturar con el presupuesto

27 caracteres. Es verbo como sus hermanos, y la única mitad que hay que distinguir de
`Facturar lo entregado` es **de dónde salen los precios** — justo lo que evita que se ponga a
teclear importes. Las dos primarias son excluyentes por construcción (`VALORADO` o `SIN_VALORAR`,
nunca las dos), así que no se leen juntas.

| alternativa | car. | gana | pierde |
|---|---|---|---|
| `Facturar con el presupuesto` | 27 | dice de dónde salen los precios | el más largo de la barra |
| `Facturar este parte` | 19 | corto y llano | no dice que los precios son los del presupuesto |
| `Facturar lo entregado` | 21 | letra por letra el de su hermano | dos acciones distintas con el mismo rótulo |

⚠️ **El aviso de `paraAdicional` no lo propongo.** La cabecera de la ruta lo manda a
`docs/legal/PREGUNTAS_ASESOR.md` §G **pregunta 25** (si la firma digital acredita la aceptación del
adicional). Eso lo contesta el asesor: escribirlo antes sería cerrar por escrito una cuestión legal
abierta.

### (B) (C) (D) Los tres motivos de rechazo de la ruta

`albaranes.routes.ts`, constante `MICROCOPY_PENDIENTE_290`, líneas 1368 · 1371 · 1388. Salen como
`message` de un 409. **Ya no se leen desde ese botón** tras el arreglo; siguen siendo la respuesta
de la API a quien la llame por otra vía.

**(B) `facturacion_no_disponible` — l. 1388** · 80 caracteres. Dice qué pasa, sin prometer fecha ni
mandar a Ajustes (la regla 26 prohíbe explicar por qué sale un justificante):

    Este documento es una factura, y en tu modo actual emites justificantes de cobro.

**(C) `albaran_no_firmado` — l. 1368** · 80 caracteres. La segunda frase evita que se lea como una
avería:

    Este parte todavía no está firmado. Solo se factura lo que el cliente ha firmado.

**(D) `albaran_ya_facturado` — l. 1371** · 35 caracteres:

    Este parte ya está facturado entero.

**Procedencia, y mi reserva:** creo que la pregunta 25 alcanza al aviso del adicional —que habla de
**qué se le puede cobrar al cliente**— y **no** a estos tres, que son operativos: dicen el estado
del documento. Pero esa lectura es tuya. Si decides que también esperan al asesor, se quedan con el
marcador y no pasa nada.
