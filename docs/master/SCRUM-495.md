# SCRUM-495 · Los tres registros que no se enteraron de que hay una tabla nueva

**Fecha:** 12-ago-2026 · **Carril:** integración del esquema · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `d09d48632f24593988db767a9dfb3972bde9981e` · 2026-08-12T11:54:35+01:00

> **Cero líneas de `src/`, de `public/` y de `prisma/schema.prisma`.** Las 24 líneas del modelo ya
> estaban verificadas contra las tres bases (SCRUM-475 FASE 4: cero diferencias en 12 columnas, PK y
> 3 índices) y no se vuelven a tocar.

## 1 · PASO 0

`main` = `aa743fe3` **antes** del primer `fetch` y `934ce469` **después**: se movió. Y siguió
moviéndose durante la sesión — `c9499faa` → `d09d4863` —, traído dentro cada vez (nunca rebase).

Búsqueda **por contenido** (`email_messages`, `EmailMessage`, `emailMessage`) sobre los tres
registros, en `main` y en toda la historia de todas las ramas con `git log --all -S`:

| Registro | En `main` | En cualquier rama |
| --- | --- | --- |
| `tests/_merchant-fixture.mjs` | **no lo tiene** | ningún commit lo añade |
| `docs/sql/deriva-prod.sql` | **no lo tiene** | ningún commit lo añade |
| `TABLES` de `scripts/backup-dump.mjs` | **no lo tiene** | ningún commit lo añade |

Ninguno queda fuera del encargo: los tres estaban sin tocar. El carril de RGPD
(`scrum-485-borrar-cuenta`, `e4a8f0b7` · Luis · 12-ago 10:26 +0200) **ya está en `main`**,
comprobado con `merge-base --is-ancestor`, y se ha leído antes de tocar nada.

## 2 · 🔴 El reparto de los 11 rojos — MEDIDO, y corrige el del encargo

El encargo daba **8 / 2 / 1**. Medido uno a uno, es **5 / 3 / 2 / 1**, y la diferencia no es
cosmética: **tres de los ocho no viven donde decía el reparto.**

| Registro | Rojos | Dónde vive | ¿Se arregla aquí? |
| --- | --- | --- | --- |
| `MODELOS_POR_MERCHANT` | **5** | `tests/_merchant-fixture.mjs` | ✅ **sí** |
| `ORDEN_BORRADO_MERCHANT` | **3** | `src/modules/system/domain/borradoMerchant.ts` | 🔸 **no** — `src/` está fuera del encargo |
| `docs/sql/deriva-prod.sql` | **2** | ese fichero (generado) | ✅ **sí** |
| `TABLES` del backup | **1** | `scripts/backup-dump.mjs` | ✅ **sí** |

**5 + 3 + 2 + 1 = 11.** Las categorías suman su total.

### De dónde salían los «8», y por qué eran 5

El test `SCRUM-172 · todo modelo con merchantId está en MODELOS_POR_MERCHANT` está definido **una
vez** (`tests/scrum172-cobertura-tenancy.test.mjs:59`) y su fichero lo **importan otros cinco**
(`scrum192`, `scrum244` ×2, `scrum314`, `bot-suite`) para reutilizar `modelosConTenancy`. Cada
importación vuelve a registrar el `test()` en su proceso, así que **un solo defecto sale cinco
veces**. No eran ocho rojos de esa lista: eran cinco apariciones de uno, más tres de otra lista
distinta.

Los tres de la otra lista:

* `SCRUM-192 · todo modelo con merchantId está en el orden o declarado fuera` → *«Añádelos al
  **ORDEN**»*, que es `ORDEN_BORRADO_MERCHANT`.
* `SCRUM-314` ×2 → llega ahí por `barridoDemo`, que **reutiliza `ORDEN_BORRADO_MERCHANT` a propósito**
  para no mantener dos listas (su propia cabecera lo explica).

## 3 · 🔴 REGISTRO 1 · lo que sí es RGPD y lo que no — leído en la fuente, no citado

El encargo mandaba leer `suprimirMerchant` antes de tocar nada. Leído, y **la lista de los 8 rojos
no es la que gobierna la supresión de un merchant real**. Son tres registros distintos:

| Lista | Dónde | Qué hace | Quién la usa |
| --- | --- | --- | --- |
| `MODELOS_POR_MERCHANT` | `tests/_merchant-fixture.mjs` | **`deleteMany`** por `merchantId` | `limpiarMerchant`: el merchant **efímero de los tests** |
| `ORDEN_BORRADO_MERCHANT` | `src/…/borradoMerchant.ts` | **borra** | `borrarMerchant` (gateado OFF) y `barridoDemo` |
| `CAMPOS_PERSONALES` | `src/…/anonimizarMerchant.ts` | **anonimiza** campo a campo | `suprimirMerchant`: el camino RGPD vivo |

**En la lista que este ticket toca, borrar es lo correcto**: son datos de un merchant de prueba que
no deben sobrevivir a su test. Ahí no hay decisión de RGPD que tomar, y por eso no hay STOP.

### Qué anonimiza hoy `suprimirMerchant`, campo a campo — medido

`suprimirMerchant` anota primero en `auditLog` (`merchant_anonimizado`, con actor y base legal) y
después hace un `updateMany` por modelo con el texto `[borrado a petición del interesado]`:

| Modelo | Campos que anonimiza hoy |
| --- | --- |
| `merchant` | `name` · `email` · `legalName` · `taxId` · `address` · `whatsappPhone` |
| `customer` | `name` · `phone` · `email` · `legalName` · `taxId` · `notes` |

Doce campos, dos modelos. **Y `emailMessage.toEmail` no está.**

### 🔴 EL HUECO, que es el hallazgo de esta sesión

> Tras una supresión, la dirección de correo del cliente **sigue en claro** en `email_messages`.

El principio del asesor dice que el HECHO sobrevive y la DIRECCIÓN no. Hoy sobreviven los dos. El
arreglo es una línea —`emailMessage: ['toEmail']` en `CAMPOS_PERSONALES`— **y vive en `src/`, que
este encargo excluye**. No se hace aquí, y **no se compensa metiendo la tabla en la lista de borrar
de producción**: eso sería exactamente lo que el STOP 1 prohíbe.

**No se silencia.** `tests/scrum495-tres-registros.test.mjs` lo deja MEDIDO en un test que afirma lo
que HAY (la lista cubre `merchant` y `customer`, con su suelo de ≥5 campos cada uno para que no pase
en verde sobre una lista vacía) y que **CAE el día que alguien lo arregle**, obligando a venir a
borrarlo. Un hueco que se olvida es un hueco que nadie ve.

### Lo construido en el registro 1

`emailMessage` entra con los de **columna suelta** y **antes de `customer`**:

* no declara **ninguna** relación (medido en el DMMF), así que **no hay FK que proteste**:
  `merchant.delete` «tiene éxito» dejando sus filas huérfanas. Fallo **MUDO**, el peor de los dos.
* `email_messages.customer_id` apunta a un cliente **sin FK**: barrer al cliente primero dejaría
  filas apuntando a un id inexistente y nada avisaría. Hay test del orden.

Y la prosa del fichero se corrige con lo medido: **22 modelos** con `merchantId` (eran 21), **12 con
FK RESTRICT + 10 de columna suelta** (eran 9). Un comentario que sigue diciendo 21 es una afirmación
que ya no se cumple.

## 4 · REGISTRO 2 · el censo de deriva, regenerado con la herramienta

`node scripts/generar-sql-deriva.mjs`. **No se edita a mano**: su propia cabecera explica que una
lista copiada envejece en silencio y su forma de envejecer es la peor —deja de preguntar por la
columna nueva y contesta «0 filas», o sea **«en sync» justo sobre la tabla que acaba de nacer**.

🔴 **Los números que me salen NO son los del encargo, y no los ajusto:**

| | encargo | medido por mí |
| --- | --- | --- |
| columnas | 350 → 362 | **351 → 363** (y **365** tras el segundo merge de `main`) |
| tablas | 24 → 25 | **24 → 25** ✅ |

El **delta sí es exacto**: comparado par a par, la regeneración añade **12 pares, todos de
`email_messages`**, y **cero desaparecidos**. Los absolutos difieren porque el 362 se midió sobre un
árbol con una columna menos, y `main` añadió más columnas durante la sesión (SCRUM-293, SCRUM-441).
Es la diferencia entre un ABSOLUTO —que caduca cuando su objeto se mueve— y un DELTA, que no.

⚠️ `main` regeneró el mismo fichero mientras yo lo tenía cambiado (353 columnas, SCRUM-293) y el
merge **dio conflicto en él**. Se resolvió **volviendo a generarlo**, que es la única resolución
válida para un artefacto derivado: resolver a mano un fichero generado produce un tercer estado que
no corresponde a ningún esquema.

## 5 · REGISTRO 3 · la tabla entra en el backup

Decisión del asesor, y va escrita en el fichero: **es el único sitio donde consta si una factura
llegó a su destinatario.** Un backup que no la lleva restaura un sistema que ha olvidado qué mandó, y
la pregunta *«¿se le envió la factura F-2026-014 y cuándo?»* deja de tener respuesta **justo después
de una restauración**, que es cuando más falta hace.

**El rojo por el mecanismo ya existía y no hacía falta uno nuevo.** Al quitar la tabla de `TABLES`,
el guard AJENO de SCRUM-241 dice *«FALTAN (el dump lógico NO las volcaría): email_messages»* — eso es
decir que hay una tabla del esquema fuera del volcado, no «falta un elemento en la lista». Probado
por inyección y revertido.

## 6 · Verificación

| | Qué | |
| --- | --- | --- |
| **🔴 CONTROL POSITIVO** | al limpiar un merchant se barre `emailMessage` **y filtrado por su merchant** — un `deleteMany` sin `where` se llevaría las filas de todos | ✅ |
| **🔴 SU ROJO** | con la lista **vacía** el control positivo falla: si pasara, estaría probando el espía y no el barrido | ✅ |
| **🔴 SUELO** ×3 | si el espía no ve ≥20 borrados, o el censo se lee con <300 pares, o `TABLES` con <24 tablas → **NO SUPE MIRAR**, no verde | ✅ |
| **ORDEN** | `emailMessage` antes de `customer`, con su motivo (no hay FK) | ✅ |
| **🔴 EL HUECO** | la anonimización real NO cubre `toEmail`: medido, declarado, y con test que cae al arreglarse | ✅ |
| **DOS INSTRUMENTOS** | el espía sobre `limpiarMerchant` (comportamiento) **y** la lectura de los ficheros de los otros dos registros (estado) — cada uno dice lo suyo | ✅ |
| **ROJO POR EL MECANISMO** | quitar `emailMessage` de la lista → *«EL BARRIDO NO TOCA `emailMessage` … fallo MUDO en las tres bases»* | ✅ |
| **Sin BD y sin red** | cliente espía; ni una conexión | ✅ |

### 🔴 Y cómo NO se mide una línea base — me pasó dos veces en esta sesión

1. Medí con `dist/` **sin reconstruir** tras el merge: aparecieron **4 rojos de SCRUM-441** que no
   existían. `main` sola estaba verde, así que el rojo lo produjo el método.
2. Al volver de medir `main` en detached, el **cliente de Prisma quedó desparejado** (24 modelos
   contra un esquema de 25) y aparecieron **8 rojos más** de SCRUM-235/244/461. El `pretest` de la
   casa regenera el cliente; `node --test` a pelo **no**, y ahí se cuela.

> **Un árbol a medio actualizar no es «la base»: es un tercer estado que no existe en ningún sitio.**
> Es la misma lección que dejó escrita SCRUM-362, esta vez por dos caminos nuevos. La base buena se
> mide con `dist/` construido, el cliente regenerado y **sin borrar nada del disco**.

## 7 · Números

| | tests | pass | fail | skipped |
| --- | --- | --- | --- | --- |
| **línea base** — el conjunto de tests **de `main`** sobre este árbol, medida aparte | 3.417 | 3.337 | **3** | 77 |
| **después** — la tanda entera de esta rama | 3.428 | 3.348 | **3** | 77 |
| diferencia | **+11** | **+11** | 0 | **0** |

Los **+11 cuadran exactamente**: 6 de `scrum495-tres-registros` y 5 de `scrum475-schema-vs-sql`, que
está en esta rama y todavía no en `main`. Ni un salto nuevo.

**Los 11 rojos pasan a 3.** Los 3 son los de `ORDEN_BORRADO_MERCHANT`, declarados aquí con su sitio.

* `npm run guards:entrada` — 4 guards · 17 tests · 0 fallos.
* `tests/scrum393-marcadores-de-conflicto.test.mjs` — 6 tests · 0 fallos (el merge con conflicto no
  dejó ni un marcador).

## 8 · Lo que hace falta para cerrar los 3 que quedan — para el fundador

Dos cambios en `src/`, y **son dos decisiones distintas**:

1. **`ORDEN_BORRADO_MERCHANT`** (`src/modules/system/domain/borradoMerchant.ts:51`): añadir
   `emailMessage` con los de columna suelta. Cierra los 3 rojos. Afecta a `barridoDemo` —donde borrar
   es lo correcto: el botón «Eliminar datos de ejemplo» promete una cuenta limpia— y a
   `borrarMerchant`, que está gateado OFF y cuya retirada paró SCRUM-485.
2. **`CAMPOS_PERSONALES`** (`src/modules/system/domain/anonimizarMerchant.ts:36`): añadir
   `emailMessage: ['toEmail']`. **No cierra ningún rojo** —ningún guard lo exige— y es el que cumple
   el principio del asesor. Es el hueco del §3.

**El 1 sin el 2 deja el hueco de RGPD abierto y la suite verde**, que es la peor combinación: verde
sin señal. Van juntos.

## 9 · Lo que NO se ha tocado

`prisma/schema.prisma` · `src/` · `public/` · ninguna base de datos (ni un comando que escriba) ·
ninguna cadena de conexión escrita, pedida, impresa ni inventada · el criterio de detección de
ninguno de los guards ajenos: los cinco que saltaron **tenían razón** y se han satisfecho, no
ablandado · la fase 2 de SCRUM-475 (sigue esperando el secreto del webhook de Resend).

## 10 · Huecos declarados

* 🔸 **3 rojos vivos**, y con nombre: `SCRUM-192` y `SCRUM-314` ×2. La rama **no se puede mergear**
  hasta que se toque `src/`. No se silencian, no se saltan y no se marcan como pendientes.
* 🔸 **La dirección de correo sobrevive a una supresión RGPD.** Medido en §3. Es el hallazgo, y su
  arreglo es de `src/`.
* **La prosa de otros cuatro ficheros sigue diciendo «21 modelos»** (`scrum244`, `scrum272`,
  `scrum314`, `_censo-merchant-de-la-url`, `src/app.ts`). Su suelo es `>= 20`, así que **ninguno
  falla**; solo el texto quedó viejo. Fuera de carril: se reporta.
* **Nada verificado contra una base.** El control positivo usa un cliente espía; que el `deleteMany`
  funcione de verdad contra Postgres lo cubren los gateados de staging, que no se han lanzado aquí.
