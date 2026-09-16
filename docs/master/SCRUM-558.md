# SCRUM-558 · el ancla exige que el usuario pueda LLEGAR, no sólo que el símbolo exista

**Medido contra:** `origin/main` = `ea56653f23cf7bc57e9a94fa60ef5c99ec3cc186` · 2026-08-20T12:01:39+01:00
(la rama nació de `f6912462`; `main` se movió con SCRUM-542 y SCRUM-561 y se mezcló antes de cerrar)

> **20-ago-2026 · mecanismo de vigilancia. NO cambia comportamiento del producto, NO toca ningún
> texto, ningún `hidden` ni ningún marcador. Un flag apagado sigue apagado.**

## El hueco, y quién lo destapó

`gremios[climatizacion]/p#1` —«la revisión del año que viene queda anotada sola»— **pasó el censo
de SCRUM-551 en verde y es falsa para todo merchant nuevo.** Su ancla estaba bien puesta:
`runMaintenanceProposals` existe y lo dispara el cron de verdad.

```
El censo preguntaba «¿existe el símbolo?».
Un símbolo que existe NO significa que el usuario pueda llegar a él.
Es «apagado ≠ no construido» del revés:  CONSTRUIDO ≠ ALCANZABLE.
```

Las tres que el censo ya cazaba se cazaron **porque no tenían ancla**. Ésta la tenía.

Lo medido para climatización, punto por punto:

| | |
|---|---|
| `src/core/flags.ts` | `MAINTENANCE_ENABLED: false` — opt-in del merchant, apagado |
| `registerMerchant` | no escribe `flags` (la palabra no aparece ni una vez en el fichero) → sin override → resuelve a `false` |
| `maintenance.routes.ts` | con el flag apagado, la ruta da 404 |
| `maintenance.service.ts:266` | el cron salta el plan, motivo `flag_off` |
| `quotesAdmin.routes.ts:701` | ni se le ofrece el interruptor al aceptar el presupuesto |
| SCRUM-207 | y tampoco puede activarlo él: escribir `merchants.flags` es acción manual |

## 🔴 LO QUE NO SE HA HECHO, Y ES LA MITAD DEL TICKET

**«Detrás de un flag» NO se ha convertido en «es mentira».** Lo que decide es el **valor**, y se
LEE de la tabla P en vez de suponerse.

Medido: la tabla tiene hoy un flag encendido por defecto, `WHATSAPP_TEMPLATES_ENABLED: true`. Una
frase detrás de él sería perfectamente cierta. Hay un test que lo prueba **con el flag encendido
real, no con uno inventado**, y que además falla declarándose ciego el día que no quede ninguno —
porque entonces ese caso estaría pasando por vacío.

> ⚠️ Y un dato que salió al medirlo y conviene que esté escrito: **`WHATSAPP_TEMPLATES_ENABLED`
> no se comprueba en ningún sitio de `src/`.** Está en la tabla con default `true` y cero
> lectores. No es de este ticket, pero un flag que nadie lee no gobierna nada.

## EL REPASO DE LAS 17 · el resultado del ticket

De las 17 unidades, **6 tienen ancla real**. Repasadas una a una con el criterio nuevo:

| unidad | ancla | ¿llega un merchant nuevo? |
|---|---|---|
| `heroe-f4/h1#1` | `whatsapp.ts::sendWhatsAppTemplate` | ✅ credenciales de **plataforma**, sin puerta |
| `heroe-f4/p#2` | `auth.service.ts::planExpiresAt` | ✅ sin puerta |
| `gremios[fontaneria]/p#1` | `quotes.routes.ts::signatureData` | ✅ sin puerta |
| `gremios[cerrajeria]/p#1` | `quotes.routes.ts::signatureData` | ✅ sin puerta |
| `gremios[reformas]/p#1` | `stageLines` + `canTransitionAlbaran` | ✅ ninguno tiene puerta |
| `gremios[climatizacion]/p#1` | `runMaintenanceProposals` | 🔴 **`MAINTENANCE_ENABLED` = false** |

**Climatización es la única.** Y no se ha resuelto mirando sólo el fichero del ancla: se buscaron
todos los ficheros que nombran cada símbolo y se miró cuáles comprueban flags. Salieron **tres
coincidencias, y las tres son de otra cosa** — co-ocurrir en un fichero no es gobernar:

- `whatsappIncoming.routes.ts` comprueba `BOT_INBOUND_ENABLED`: es el bot **entrante**, no el envío.
- `quotesAdmin.routes.ts:701` comprueba `MAINTENANCE_ENABLED`: gobierna el bloque de mantenimiento
  **dentro del detalle del presupuesto**, no la firma.
- `app.ts` comprueba cuatro flags: es el fichero de rutas, y ninguno cuelga de `planExpiresAt`.

## El mecanismo: se DECLARA y se DERIVA, y las dos tienen que coincidir

**La declaración.** Cada unidad puede declarar su puerta:

```js
tras: [{ flag: 'MAINTENANCE_ENABLED', porDefecto: false, motivo: '…' }]
```

**La derivación.** El censo lee `FLAG_DEFAULTS` de `src/core/flags.ts` (del FUENTE, no de `dist/`:
un `dist/` viejo trae un default caducado que se lee igual de bien que uno vigente) y compara:

- flag que la tabla P no tiene → **NO SUPE MIRAR**, no «lo doy por encendido».
- `porDefecto` declarado ≠ el de la tabla → **CADUCÓ**. Sin esto, `porDefecto` no sería una
  medición: sería un comentario, y encima uno que silencia el veredicto.
- valor real `false` → **INALCANZABLE**, nombrando la frase y el flag.

**La red de seguridad**, que es lo que impide que esto sólo proteja contra los casos que alguien
ya se sabía: si el fichero del ancla comprueba un flag que el registro **no** declara, es rojo —
citando la frase y traduciendo el valor («está APAGADO por defecto», «está ENCENDIDO», «no he
sabido leerlo»).

### Por qué mira el FICHERO y no el módulo — descartado MIDIENDO

Se probó por módulo. `src/modules/invoicing` comprueba `INVOICING_ES_ENABLED` y `SIF_ENABLED`, los
dos apagados, y **habría marcado como inalcanzable el ancla de reformas** (`invoiceLines.service.ts::stageLines`),
que no está detrás de ningún flag. Un detector que grita de más se acaba ignorando.

### Y lo que este detector NO ve, dicho con esas palabras

Mira el fichero del ancla y nada más. **Una puerta que viva sólo en la ruta que expone el símbolo
—y las hay: `maintenance.routes.ts` devuelve 404 con el flag apagado— no aparece.** Por eso la
puerta se **declara** y la derivación es la red que caza al que se olvide, no la medida de la que
sale el veredicto. Está escrito en el propio fichero, junto al código.

## La premisa de la que cuelga todo

Leer el default sólo describe a un merchant nuevo **si nadie le escribe un override al nacer**.
Medido el 20-ago-2026: `registerMerchant` crea la fila sin tocar `flags`. Y se vigila, en vez de
darse por hecho para siempre: el día que el alta escriba flags, el censo lo dice y avisa de que
«default de la tabla P» y «lo que tiene un merchant nuevo» han dejado de ser lo mismo.

## El trinquete: de 3 a 4, con las dos clases separadas

`SIN_ANCLA_HOY` sigue con sus tres. `INALCANZABLES_HOY` trae la cuarta. El trinquete que sube es
el de la **unión**: lo que no puede crecer es el número de frases publicables que hoy no son
ciertas.

No se fusionan porque **se arreglan distinto**, y fusionarlas perdería justo lo que este ticket
vino a distinguir:

- **sin ancla** → no hay mecanismo. Se arregla construyéndolo o reescribiendo el texto.
- **inalcanzable** → el mecanismo está. Se arregla abriendo el camino o reescribiendo el texto.

## Verificación

**Rojo por el mecanismo**, con el commit `0a747f65` ya hecho. Se re-ancla una frase que HOY es
alcanzable (fontanería) a un símbolo REAL detrás de un flag apagado, y **la misma inyección** se
pasa por las dos versiones del censo:

| | criterio de hoy (`origin/main`) | criterio nuevo |
|---|---|---|
| ① sin declarar `tras` | ✅ verde para fontanería | 🔴 `PUERTA SIN DECLARAR (MAINTENANCE_ENABLED …)` + la frase + «está APAGADO por defecto» |
| ② declarando `tras` | ✅ verde para fontanería | 🔴 `ANCLADA PERO INALCANZABLE (MAINTENANCE_ENABLED = false)` + la frase |

El script comprueba antes de empezar que la versión de `origin/main` **no** contiene ya la segunda
condición: si el viejo también cayera, el rojo del nuevo no probaría nada.

**Control positivo:** en las dos inyecciones, las otras cuatro ancladas alcanzables contagiadas =
**0**. Reversión `Buffer.compare` contra el blob = **0** en las dos, `git status` limpio.

**Suelo:** con la tabla ilegible, la respuesta es `NO SUPE MIRAR` y no «lo doy por encendido» —
hay un test que lo ejercita con una raíz donde `flags.ts` no está. El parser además lleva control
propio (si lee menos de 8 flags se declara roto) y se comprueba que **sepa ver los dos valores**:
uno que sólo supiera ver `false` daría el veredicto correcto aquí por pura suerte.

**Suite:** `3858 tests · 3781 pass · 0 fail · 77 skipped`.
⚠️ La pasada anterior dio `3859 · 3781 · 1 fail` por el abort intermitente de
`tests/scrum334-destino-de-los-cta.test.mjs` (SCRUM-560). Es ajeno, no deja tests sin ejecutar y
no se ha tocado.

## Un defecto propio que encontró la demostración

La primera pasada del rojo cayó por la rama correcta y **el mensaje no nombraba la frase**: decía
el flag y el fichero, y quien lo leyera sabía que había una puerta pero no qué texto estaba en
riesgo ni si el valor era el malo. Corregido en `1561a231`, con su caso.

## Los dos encargos sueltos

✅ **`#comparativa`**: su motivo se leía como hueco. Verificado antes de reescribirlo —
`tests/scrum332-comparativa-anclas.test.mjs`, 5 tests en verde, con correspondencia en **los dos
sentidos** (ninguna fila sin ancla, ningún ancla sin fila). Añadido además el eje de la
aprobación, que midió SCRUM-561: sus 20 textos **sí** están en el documento, 20 de 20, inéditos 0.
Lo que le falta es su entrada en ESTE registro, no vigilancia. (Se conserva `SCRUM-555` en la
cadena porque `tests/scrum557-alcance-por-identidad.test.mjs:157` lo exige.)

🟡 **La reclasificación del censo de SCRUM-553 — NO se hace aquí, y el motivo importa.** El censo
confunde dos clases: un extractor que **busca** marcado y un literal que lo **construye**. Es
cierto y merece arreglo. Pero cambiar esa clasificación mueve el conteo contra el que **S3 está
midiendo ahora mismo** (acaba de esquivar un 30 sobre tope 29 sacando el literal a una constante),
y un clasificador mal calibrado ahí es peor que el conteo actual, que es tosco pero honesto. Se
queda apuntado en SCRUM-553.

## Ficheros

| fichero | qué |
|---|---|
| `scripts/censo-anclas-bloque-f.mjs` | la segunda condición: `defaultsDeLaTablaP`, `flagsQueVigilaElFichero`, `elAltaNoEscribeFlags`, `alcanzabilidad`; el `tras` de climatización; el motivo de `#comparativa` |
| `tests/scrum558-ancla-alcanzable.test.mjs` | 12 tests: suelo, el valor decide, las dos formas de engañar al criterio, la premisa, y el control positivo sobre la landing real |
| `tests/scrum551-anclas-bloque-f.test.mjs` | `INALCANZABLES_HOY` y el trinquete unido de 4 |
