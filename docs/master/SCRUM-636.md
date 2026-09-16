# SCRUM-636 · El sitio único del dinero — el albarán, la frontera y su trinquete

**Fecha:** 2-sep-2026 · **Carril:** B · **Gate:** parcial — la FACTURA queda fuera y se dice por qué
**Medido contra:** `origin/main` = `03c5bce4ed5b37bb68a38d03bb27a6c8887783ed` · 2026-09-02T00:00:00+02:00
**Rama:** `scrum-636-sitio-unico-dinero`

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

---

## 1 · LOS TRES ROJOS APARCADOS ERAN **UNO**

`ReferenceError: formatImporteEs is not defined`, tres veces. La causa es una sola y es de diseño:
**`SCRUM-468` saca el formateador del PDF del árbol por AST y lo EJECUTA** (`new Function('v',
cuerpo)`). Ese guard daba por hecho que el formateador era **autosuficiente**; al delegar en un
helper compartido, el cuerpo extraído referencia algo que no existe en ese ámbito.

**Arreglo:** se le dan a ese `new Function` los helpers **REALES** de `utils` —no dobles—, así que
lo que se ejecuta sigue siendo el código de verdad y una divergencia futura se seguiría viendo. No
se ha relajado ninguna comparación: los 6 tests de 468 están verdes.

## 2 · SCRUM-436 NO SE ELIGE: **SE EXTIENDE**

El encargo pedía medir 436 antes de elegir superviviente. Medido sobre los diez valores de borde de
SCRUM-625:

| | |
|---|---|
| `fmtMoneyEs` (api.js, el de 436) vs `formatMoneyEs` (utils.ts) | **10/10 idénticas** |
| `formatImporteEs` vs `formatMoneyEs` sin el ` €` | **idénticas** |

**El formateador de 436 ya estaba en el backend.** `formatMoneyEs` es A6.6 + A18.2 y lleva el mismo
`useGrouping:'always'`. Así que esto no es escoger otro: es terminar lo que 436 dejó fuera.

### Por qué 436 se quedó en `public/`: **nadie lo escribió**

Su censo cablea `const DIR = 'public/dashboard/js'` sin motivo declarado. Lo que sí se puede medir:

* `api.js` cuelga de `window`; el servidor **no puede importarlo**. Sólo se podía compartir el
  algoritmo, y el backend ya lo tenía.
* Su detector fija `ts.ScriptKind.JS`, o sea que está escrito para el JS del front.
* **Soltado sobre `src/` (248 ficheros .ts, con suelo verde): 4 ficheros, 5 sitios — y ninguno es
  un defecto.** Uno es el propio formateador de la casa (`utils.ts`), dos son **mensajes de error
  del sellador** (falsos positivos), y dos son `formatImporteEs(v) + ' €'`, que es delegar.

> **Extender ese censo a `src/` es otro ticket**, y no trivial: hoy acusaría al sellador. Se deja
> medido, no hecho.

## 3 · EL SEXTO SITIO — lo encontró el GUARD, no un censo

El PDF del albarán escribía `1234,50 €` y su propia vista `1.234,50 €`. **El separador de millares
también divergía**, y eso no estaba en el enunciado. Los dos delegan ya en el sitio único.

## 4 · 🛑 LA FACTURA QUEDA FUERA — y no por técnica

`fmtImporte` **lo comparten el presupuesto y la factura**, así que delegarlo mueve **los dos**: la
factura pasaría de escribir `1000,00` a `1.000,00`. **SCRUM-623 (S1) está tocando ahora mismo cómo
se presentan los importes de la factura.**

Se retira el cambio de `pdf.service.ts` (y el del guard de SCRUM-604b, que era su sujeto). La
exclusión queda **PINCHADA con un test**: el día que 623 entre, ese test cae y obliga a decidir en
vez de quedarse así para siempre.

## 5 · LA FRONTERA DEL SELLADOR, con trinquete

El criterio, literal: «`.toFixed(2)` no es un defecto por sí mismo: es correcto en el XML y defecto
en el PDF. Ésa es la partición.» `verifactu.service.ts` y `registro.builder.ts` quedan fuera, con un
guard **anclado en CONTENIDO** (marcas del fichero como `<sum1:CuotaTotal>`, nunca líneas).

**Aplicado el criterio de SCRUM-645:** la lista de formateadores **no se hereda de `utils.ts`**. Se
escribe a mano y se **compara** con lo que utils exporta de verdad, derivado por AST. Un formateador
nuevo que no esté en la lista **hace caer el guard**, en vez de dejar el sellador sin vigilar en
silencio. Si se importara, esto no saltaría jamás.

## 6 · UN FALSO POSITIVO PROPIO, cazado por el suelo

Mi primer guard del albarán buscaba `toLocaleString` **por texto** y acusaba a dos usos de
`albaranPdf.service.ts` que **no son dinero**: una CANTIDAD (`maximumFractionDigits` sin mínimo) y
una FECHA. Es exactamente lo que la cabecera del censo de 436 ya advierte. Ahora se ancla **por AST
a la función de dinero**.

## 7 · EL ROJO, PROBADO POR EL MECANISMO

Cuatro roturas sobre código ya commiteado; cada una tumba la suya y nada más:

| Rotura | Qué cae |
|---|---|
| el PDF del albarán deja de delegar | «EL SEXTO SITIO» |
| nace otro formateador en `utils.ts` | el **TRINQUETE** |
| el sellador pasa al formateador de presentación | la **FRONTERA** |
| la factura se unifica sin coordinar | la exclusión de **SCRUM-623** |

## 8 · DEUDA SALDADA

El comentario de `nombreParaDocumento.ts` ya no lista las copias por número de línea —caducó en
veinticuatro horas, y `pdf.service.ts:482` se movió con el trabajo del propio SCRUM-577 que lo
escribió—. Ahora van **por función**, que es lo que no se mueve al insertar código encima.

## 9 · NÚMEROS

* **Suite: 4.265 tests · 4.186 verdes · 0 rojos · 79 saltados.** `guards:entrada`: 21/21.
* Los 3 rojos aparcados: **resueltos**, con su causa única declarada.

## 10 · LO QUE NO SE HA TOCADO

El sellador, el CSV de evidencias (`paquete.ts`), la zona horaria y merchants (S2, SCRUM-643), y el
desglose de IVA de la factura (S1, SCRUM-623) — de cuyo fichero me he retirado.

---

# APÉNDICE · 2-sep-2026 · LA CONVENCIÓN ESPAÑOLA EN LOS CINCO SITIOS

**Medido contra:** `origin/main` = `6b4f122def32c75615af06d5c311dadb43740888` · 2026-09-02T00:00:00+02:00
**Rama:** `scrum-636-separador-en-los-cinco`

> La exclusión de la factura **se levanta**. Decisión del fundador con la medición delante.

## Lo que cambió el marco

**No era una política: era un artefacto de CLDR.** `toLocaleString('es-ES')` no agrupa los enteros
de cuatro cifras, así que la factura escribía `1000,00` **y** `12.345,67` — incoherente consigo
misma, y fallando justo en la banda **1.000–9.999 €**, que es el importe corriente de un trabajo.
Eso no se estaba eligiendo: se estaba padeciendo.

| valor | antes | ahora |
|---|---|---|
| 999,99 | `999,99` | `999,99` |
| **1000** | **`1000,00`** | **`1.000,00`** |
| **2383,7** | **`2383,70`** | **`2.383,70`** |
| **9999,99** | **`9999,99`** | **`9.999,99`** |
| 12345,67 | `12.345,67` | `12.345,67` |

## Los cinco, unificados en `formatImporteEs`

`payBizum.routes.ts` · `pdf.service.ts` (`fmtImporte` y el `fmt` de la factura) ·
`weeklyDigest.service.ts` · `customerPortal.routes.ts`

Censo sobre los **250 ficheros `.ts` de `src/`**, con suelo: **cero copias** de la expresión.

## La exclusión se retira CON su motivo, no en silencio

El test que la pinchaba **cumplió — y de forma más limpia de lo previsto: no llegó a caer.** Estaba
anclado al FORMATEADOR y no al fichero, y SCRUM-623 añadió 125 líneas de desglose sin tocarlo. Lo
que forzó la decisión fue la medición que lo acompañaba. El motivo queda escrito en el propio
fichero de tests, donde estaba el guard.

## Cambio visible en documento fiscal → control por TEXTO REAL del PDF

Se **genera** la factura con los doce valores de borde de SCRUM-625 y se **lee el texto del PDF**:
los doce salen con la convención española, y en la banda 1.000–9.999 ya no aparece la forma sin
agrupar. Test aparte: **ninguna cifra cambia, sólo su escritura.**

Probado por el mecanismo: con la factura escribiendo sin agrupar, **caen los dos guards de PDF**;
con una copia de vuelta en `customerPortal`, cae el censo. Árbol limpio después.

## SCRUM-604b cambia de REFERENCIA, no de intención

Comprobaba contra `toLocaleString`, o sea **contra el algoritmo que se acaba de retirar**. Lo que
existía para impedir —que los dos formateadores del fichero se separen— se comprueba ahora **más
fuerte**: en vez de exigir dos cuerpos iguales, se exige que sean **el mismo**, porque uno llama al
otro y el otro al sitio único. El porqué queda escrito dentro del test.

## Fuera, como estaban

El **sellador** (`.toFixed(2)`; el XML de la AEAT exige punto) y el **CSV de evidencias**. La
partición sigue mandando. Y el hueco declarado sigue **anotado y sin arreglar**: el censo de
SCRUM-436 no ve un `toLocaleString` a secas —sólo si concatena el símbolo—, que era justo la forma
de estas cinco copias. Extenderlo es otro ticket, y hoy además acusaría al sellador.

**Suite: 4.280 tests · 4.201 verdes · 0 rojos · 79 saltados.** `guards:entrada`: 21/21.
