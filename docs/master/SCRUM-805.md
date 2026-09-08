# SCRUM-805 · Qué firmó el cliente — la evidencia de firma del presupuesto

**Fecha:** 7-sep-2026 · **Carril:** producto · documentos firmados · **Gate:** sin gate — corre en `npm test`
**Medido contra:** `origin/main` = `64b5d80ae3b11dcc34d736de21670eb6b5ce6dda` · 2026-09-07T07:01:07+01:00
**Mutaciones:** **3 vivas · 0 mudas · 0 ciegas**, árbol restaurado byte a byte.
**Tanda (árbol YA MEZCLADO con main):** **5866 pruebas · 5764 en verde · 0 rojas · 102 saltadas** · 226,0 s · salida 0.
**Mutaciones re-corridas tras mezclar:** 3 vivas · 0 mudas · 0 ciegas, árbol restaurado byte a byte.
**Guards de entrada:** 4 en verde (21 tests).

> ✅ **7-sep-2026 · EL `ALTER` YA ESTÁ EN LAS TRES BASES, así que el PR es MERGEABLE.** Aquí ponía
> «⛔ ESTE PR NO SE PUEDE MERGEAR HASTA QUE EL `ALTER` ESTÉ EN LAS TRES BASES», y era cierto
> cuando se escribió: la sesión que lo escribió no había aplicado nada en ninguna base. Hoy
> `quotes.evidencia_firma` es `jsonb` en dev (aplicada por la sesión del 7-sep con
> `aplicar-sql-dev.mjs`), en staging y en producción (aplicadas por el fundador), las tres
> verificadas leyendo `information_schema`. El motivo del bloqueo —`assertSchemaSinDeriva`
> **impide arrancar** si la base no tiene la columna— no se borra: es lo que explica por qué el
> orden importaba. Detalle y medidas en `docs/MIGRATIONS_PENDING.md`.


> **`main` se movió 7 commits mientras trabajaba** (SCRUM-759, SCRUM-797 y sus merges). Se
> mezcló DENTRO, se recompiló, se regeneró el cliente Prisma y se volvió a medir TODO: tanda,
> guards de entrada y mutaciones. El único conflicto fue en `docs/MIGRATIONS_PENDING.md` y era de
> POSICIÓN, no de significado —dos entradas nuevas al final del mismo documento—: **se conservan
> las dos**, verificado que no queda ningún marcador y que los dos `ALTER` siguen presentes.

---

## OBLIGACIÓN 0 · comprobado que no estaba hecho

`git ls-remote --heads origin` (**543 ramas**, listado completo) → ninguna de 805 ·
`git ls-tree origin/main docs/master/` → **no existe** `SCRUM-805.md` (sí 801, 804, 806, 807, 808) ·
ningún test de 805 en `origin/main` · `git log origin/main --grep=SCRUM-805` → **vacío**.

## 🔴 EL ROJO, PRIMERO · corriendo contra dev, no citándolo

`dev = acela.proxy.rlwy.net/yaqu_dev_javier`, **7-sep-2026 07:12 UTC**. Se siembra un presupuesto,
se firma con **exactamente los campos que escribe el camino real**, se le cambia el contenido
después y se le pregunta a la fila «¿qué se firmó?».

```
① TRAS FIRMAR · columnas NO nulas de la fila:
   id, merchantId, customerId, status, total, currency, lines, acceptedAt,
   decisionChannel, signatureUrl, internalNotes, revision, createdAt, updatedAt
   evidence: null      ← la columna EXISTE y el camino de firma NO la escribe
   → columnas que identifiquen QUÉ documento se firmó: 🔴 NINGUNA

② SE ALTERA EL CONTENIDO DESPUÉS DE FIRMAR (85 € → 385 € en la línea 1):
   total: 148.34 → 511.34 · signatureUrl intacta: true · acceptedAt intacta: true
   → el documento firmado dice ahora 511,34 €, la firma sigue ahí, y NO HAY NADA
     EN LA FILA QUE PUEDA DESMENTIRLO.

✅ CONTROL POSITIVO · el mismo cambio con el mecanismo del ALBARÁN:
   detecta la alteración: true · no da falsos positivos: true
```

**Limpieza verificada**: 0 quotes y 0 customers con la marca al terminar.

> ⚠️ El control positivo salió **falso** en la primera pasada (`h1 !== h2` → `false`). No era que
> el albarán no sellara: **el caso estaba mal elegido** — usé `concept`/`qty` y el canónico espera
> `concepto`/`cantidad`, así que las dos líneas colapsaban al mismo objeto. Corregido y repetido.
> Queda escrito porque un control positivo que no se mira habría dejado pasar el rojo entero.

## ⚠️ TRES CORRECCIONES AL ENUNCIADO, medidas

| el encargo dice | medido el 7-sep-2026 |
|---|---|
| «ningún `quote.update` escribe `lines` ni `total`. Los importes no cambian» | 🔴 **Falso.** El propio camino de firma los escribe cuando el cliente elige un tramo (`quotes.routes.ts`, `...(tierTotal ? { total } : {})`). Lo dice su propio comentario de SCRUM-734. **Cambia el diseño**: hay que sellar el contenido FINAL, no el de antes. |
| «cero menciones de "pdf" en las 803 líneas de la landing de firma» | ⚠️ **Caducó.** El fichero tiene **854 líneas** y **11 menciones**: SCRUM-806 entró en `main` y añadió `GET /pay/quote/:token/pdf`. **Lo sustancial aguanta**: esa ruta la usa el portal del cliente y la landing de firma **sigue sin enlazarla** — cero menciones dentro del HTML que ve el firmante. |
| «guarda `signatureUrl` y `acceptedAt`. Y NADA MÁS» | ⚠️ Existe además `Quote.evidence Json?`, pero **el camino público de firma no la escribe nunca**: la escribe el camino de ADMIN (`{method, typedName}`). Se deja intacta; mezclarlas rompería lo que ya lee `invoicesAdmin.routes.ts`. |

## 🟢 LA DECISIÓN DEL FUNDADOR QUE CAMBIÓ EL DISEÑO

El encargo pedía **reutilizar `computeAlbaranContentHash`**. Medido antes de escribir nada: su
canónico **no sella `total`, ni `validUntil`, ni `paymentTerms`, ni las cláusulas** — justo lo que
se discute. Y hay precedente en `main`: **SCRUM-652 se encontró exactamente esto con el parte de
trabajo** y escribió canónico propio, con el motivo escrito en `parteTrabajo.ts`:

> «⛔ El canónico del albarán NO SE TOCA. Son dos documentos con dos sellos distintos, y
> unificarlos rompería uno de los dos.»

Presentada la medida, **el fundador retiró la instrucción**: *«Tu medición es correcta y corrige un
error mío en el encargo. […] Lo ÚNICO que compartes es sha256. Un algoritmo de hash no es un
canónico.»* Se construye **canónico propio** y no se toca el sellador del albarán.

## LO CONSTRUIDO

**`src/modules/quotes/domain/presupuestoSello.ts`** — `contenidoCanonicoPresupuesto` **v:1**, que
sella lo que **el papel enseña** (derivado de `presupuestoParaPdf.ts`, no de mi criterio): número,
fecha, moneda, cliente/emisor/NIF congelados, líneas **con precio, IVA y descuento**, descuento
global, modo de IVA, **total**, **validez**, **condiciones de pago**, **cláusulas excluidas**, los
dos textos libres y la dirección de obra.

* **No entra** `internalNotes` (el cliente no la ve, así que no la firmó) ni el TEXTO de las
  cláusulas del merchant (dato vivo suyo: editarlo rompería sellos de documentos intactos).
* **El bloque congelado nace de entrada.** El albarán llegó ahí por las malas: sus v:1 y v:2
  recalculaban desde filas vivas, así que corregir la razón social de un cliente hacía que el
  verificador dijera «no coincide» sobre un documento intacto (SCRUM-431 → v:3 en SCRUM-438).
* **La versión viaja DENTRO de la evidencia**, no al lado.

**`Quote.evidenciaFirma Json?`** — una columna, aditiva y nullable, con el sobre de nueve claves
del albarán: `v, canal, firmadoAt, ip, ua, tokenId, firmante, hashAlg, contentHash` (+ el bloque
congelado, que es lo que permite verificar sin datos vivos). Es el patrón del albarán porque **el
presupuesto se firma en REMOTO** y tiene canal/ip/ua/token que registrar — a diferencia del parte,
que se firma en mano y por eso le bastan dos escalares.

**El sellado, en `quotes.routes.ts`** — en el **MISMO `update`** que la firma y con el contenido
**FINAL**: si se sellara la fila anterior al tramo, certificaría el presupuesto que el cliente NO
eligió. `firmadoAt` sale del **reloj del servidor** (`now`), nunca del cliente.

**El PDF** — bloque «Certificado de evidencias de la firma» con los literales del albarán
**copiados byte a byte**, y el rótulo «Documento sin validez fiscal. No es una factura.» (medido:
el PDF del presupuesto no tenía ninguno; el de la línea 668 es del justificante de cobro).
⚠️ **`ip` y `ua` NUNCA se imprimen**: son dato personal y viven solo en la BD.

⛔ **No es VeriFactu y no se rotula como tal.** La huella fiscal es la de la FACTURA —encadenada y
con QR—, y **a ésa no se le ha añadido nada**.

## 🔴 EL CENSO (obligación 3) · qué documentos se firman

Población: **271 ficheros `.ts` de `src/`** y los **27 modelos del DMMF** de Prisma (dato, no
texto). Firmables = los que escriben el trazo o la marca de firma. Con sello = **el fichero que
escribe la firma alcanza `crypto.createHash`** — el ancla es la primitiva de Node, no un nombre.

| documento | se firma en | ¿sella qué se firmó? |
|---|---|---|
| `albaran` | `albaranes.routes.ts`, `albaranPublic.routes.ts` | ✅ sí (SCRUM-68) — **control positivo** |
| `parteTrabajo` | `partes.routes.ts` | ✅ sí (SCRUM-652, `contenidoHash`) |
| `quote` | `quotes.routes.ts` | 🔴 **no** → **es este ticket** |

> 🔴 **Mi primer censo se equivocó y lo dejo escrito.** Preguntaba por NOMBRES de columna
> (`/evidencia|contentHash|sello/`) y **clasificó el parte como SIN sello**, cuando lo tiene desde
> SCRUM-652: se llama `contenidoHash` y no casaba. Un censo que pregunta por nombres **devuelve un
> número más bajo en vez de declararse ciego**. Por eso el criterio final se ancla en
> `crypto.createHash`. **No hay un tercer documento sin evidencia**: el único era el presupuesto.

## CONTROLES

* 🔴 **EL QUE DECIDE** · `cada campo del contenido mueve el hash`: se muta **cada campo del
  canónico, uno a uno y derivado del propio objeto** (no una lista de casos escrita a mano), y se
  exige que el hash cambie en todos. Más los cuatro que el fundador nombró con su nombre —`total`,
  `validUntil`, `paymentTerms`, una cláusula— para que el rojo diga cuál. Y el precio de una
  línea, que es el caso del rojo medido en dev.
* ✅ **POSITIVO** · dos presupuestos idénticos dan el MISMO hash, y `Decimal`/`number`/`string`
  producen el mismo texto: sin esto no se sabe si el instrumento distingue o si siempre dice
  «distinto».
* ✅ **NEGATIVO** · regenerar sin tocar el contenido NO mueve el hash, y el trazo y la ruta del PDF
  no entran: se sella el CONTENIDO, no el binario.
* ✅ **POSITIVO (lo ya firmado)** · la columna es nullable y sin default —comprobado en el DMMF— y
  el bloque del PDF sólo se pinta si hay `contentHash`: los presupuestos firmados antes salen
  exactamente como salían.
* 🔴 **SUELO** · el recorrido exige ≥14 campos mutados y que se prueben todos; el censo exige >200
  ficheros leídos y ≥3 documentos, y **falla declarándose CIEGO** si el albarán sale «sin sello»
  —porque entonces lo que diga de los demás vale lo mismo.
* 🔴 **LOS LITERALES** · comparados **contra `albaranPdf.service.ts` leyendo el fichero**, no
  contra una copia escrita aquí.

> ⚠️ **El guard de los literales me cazó a mí en su primera pasada.** El párrafo largo está escrito
> en el albarán como **tres literales unidos por `+`**, así que mi lector no lo encontraba y
> declaraba «ya no está en el albarán» sobre un fichero que lo tiene entero. Ahora resuelve
> concatenaciones. Es literalmente el defecto que ese test existe para impedir —comparar contra mi
> memoria del texto en vez de contra el fichero— cometido por el propio guard.

## MUTACIONES · 3 vivas · 0 mudas · 0 ciegas

| mutación | cae |
|---|---|
| el canónico deja de sellar `total` | `EL QUE DECIDE: cada campo del contenido mueve el hash` |
| la firma deja de escribir `evidenciaFirma` | `un presupuesto firmado SIN evidencia no puede pasar` |
| se acorta el título del certificado en el PDF | `los literales del PDF son BYTE A BYTE los del albarán` |

La primera arrastra **1 colateral** (`el bloque congelado hace verificable el documento`), y es
correcto: sin `total` en el canónico, el verificador tampoco detecta que lo cambien.

## ⚠️ INCUMPLIMIENTO PROPIO, declarado

Ejecuté una vez `npx --no-install prisma generate`. La regla dice **nunca `npx` para el CLI de
Prisma**: aunque fue con `--no-install` (CLI local, sin red) y sin tocar ninguna base, incumplí la
letra. Rehecho por la puerta de la casa (`npm run prisma:generate`).

## HALLAZGO REPORTADO, no arreglado (regla 9)

`tokenId` guarda el token de firma **entero** en la evidencia — el presupuesto sigue aquí el
precedente del albarán (`tokenId: albaran.firmaToken`). Ese token es una credencial pública viva,
y guardarlo en el sobre la replica. **No se cambia aquí**: hacerlo en el presupuesto y no en el
albarán dejaría dos criterios, y cambiar el del albarán es tocar su sellado (STOP AA1.4). Queda
dicho para quien abra el ticket de seguridad que corresponda.

## LOS SEIS GUARDS QUE DISPARÓ LA COLUMNA NUEVA, ATENDIDOS UNO A UNO

La primera tanda salió con **10 rojas**, y ninguna era ruido: son los guards de la casa exigiendo
que una columna nueva de `Quote` no pase en silencio. **Ninguno se ha silenciado.**

| guard | qué exigía | qué se hizo |
|---|---|---|
| **SCRUM-655b** | clasificar el campo para las revisiones | **NO se hereda**, y con su motivo en `revision.ts`: su `contentHash` certifica el contenido de AQUEL documento, así que en una versión nueva no cuadraría — y un sello que no cuadra se lee como una falsificación que nadie ha cometido |
| **SCRUM-411** | 4 exports huérfanos | declarados en TRES categorías distintas con su motivo. El guard proponía quitarles el `export` y medir por superficie pública: eso habría hecho imposible el control que el fundador puso como condición |
| **SCRUM-461** | el censo SQL dejaba de mirar la columna | regenerado (`node scripts/generar-sql-deriva.mjs`, 423 columnas) |
| **SCRUM-601** | el reparto de literales visibles se movió 151 → 152 | subido **con** el análisis que el propio guard pide: cuál se movió, por qué cae en «a pelo» y por qué NO va a `PENDIENTES_DE_FIRMA` (es copy ya aprobada) |
| **SCRUM-758** | mi entrada de migración era «prosa muda» | convertida a casillas por base. ⛔ El guard prohíbe subir el tope, y **no se subió** |
| **SCRUM-222 · 733 · 765** | arrastre de los anteriores | verdes al arreglar la causa |

## ⛔ SIN TOCAR

* `computeAlbaranContentHash` y **ninguna** de sus versiones congeladas · `buildFirmaEvidencia`
  del albarán · el sellador del parte (SCRUM-652).
* El camino de emisión de la factura y su huella VeriFactu: **cero cambios**. Ni un hash al lado
  del oficial.
* El mecanismo de regeneración del PDF (SCRUM-762, en la mesa del fundador): sólo se **añade** un
  bloque al final del documento del presupuesto.
* `Quote.evidence`, que es de otro camino y de otro significado.
* **Ninguna base**: ni producción, ni staging, ni dev. El `ALTER` está escrito y sin aplicar.
