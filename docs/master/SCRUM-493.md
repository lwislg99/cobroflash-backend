# SCRUM-493 · Los dos instrumentos de alcance, lado a lado — y dónde discrepan exactamente

**Medido contra:** `origin/main` = `aa743fe3995900a60b34b26d2a7d517c629c2487` · 2026-08-12T11:21:14+01:00
**Fecha:** 12-ago-2026 · **Carril:** guards · **Gate:** sin gate, corre en `npm test`
**Cero borrados.** Este encargo mide; no limpia. Y **no funde los dos instrumentos**: esa decisión
es de los fundadores y va después, con esta tabla delante.

---

## 0 · Paso 0

| | |
|---|---|
| `main` antes del fetch | `d5fdedaf25ab16e2fea17e5a9c33cf3c1149e35c` |
| `main` después del fetch | `d5fdedaf25ab16e2fea17e5a9c33cf3c1149e35c` (sin cambio; otra sesión ya lo había traído — los cuatro worktrees comparten refs) |
| `main` al cerrar, tras mezclarlo dentro | `aa743fe3995900a60b34b26d2a7d517c629c2487` |

* **El instrumento ② está en `main`, comprobado por CONTENIDO** (`git show main:tests/_alcance-desde-entradas.mjs`), no por nombre de rama.
* **`_alcance-dominio.mjs` NO lo ha tocado nadie desde mi medición:** su último commit es
  `1e389563` (Luis, 2026-08-10 10:13:53 +0100), dos días anterior.
* **La rama vecina `scrum-485-borrar-cuenta` (`e4a8f0b7`) ya está DENTRO de `main`**
  (`git merge-base --is-ancestor` → 0); su ref sigue en el remoto, sin borrar.
* 🔴 **La premisa SIGUE SIENDO CIERTA.** Re-corridos los dos hoy sobre el mismo corpus:
  **160 discrepancias sobre 519 exports**. El ticket no se cae.

---

## 1 · Qué pregunta contesta cada uno de verdad

| | Instrumento | Pregunta literal | Cómo indexa |
|---|---|---|---|
| ① | `tests/_alcance-dominio.mjs` (SCRUM-411, **carril ajeno**) | «¿algún fichero alcanzable importa este **nombre**?» | por **NOMBRE global** |
| ② | `tests/_alcance-desde-entradas.mjs` (SCRUM-411 fase 2b) | «¿lo alcanza el **proceso** desde una entrada viva?» | por `(módulo, nombre)`, exige que el nombre se **use**, y propaga por el grafo interno |

🔴 **No son la misma pregunta**, y por eso esto es una tabla y no un empate. Se comparan porque
**las dos se están usando para lo mismo**: decidir si algo se puede borrar. ① es un **proxy** de la
pregunta de ②, y lo que se enumera abajo son los sitios donde el proxy falla, en cada dirección.

**A `_alcance-dominio.mjs` solo se le LLAMA.** No se ha modificado ni una línea (regla 9); se pudo
invocar tal cual, sin tocarlo.

### La misma definición de «entrada viva», y el mismo corpus

`src/index.ts` · `src/app.ts` · los `scripts/*.mjs` que **declara `package.json`**. `tests/` **no**.
Los dos instrumentos la toman del **mismo sitio** (`ENTRADAS` + `entradasDeComando`).

**Corpus común: solo los exports de `src/modules/*/domain/**`**, que es lo único que ① censa.
Comparar sobre todo `src/` daría una diferencia que solo diría que ① mira menos sitios.

---

## 2 · El resultado, y cómo se contó

**Contado** comparando el veredicto **normalizado** de cada instrumento, export por export, por
`(módulo, nombre)`. Normalización: ① `huérfano → NO`, resto `→ SÍ`; ② `ALCANZABLE → SÍ`,
`NO_ALCANZABLE → NO`, `NO_SE_PUDO_DETERMINAR → NO SÉ`.

| | |
|---|---|
| corpus común | **519** exports |
| **acuerdan** | **359** |
| **discrepan** | **160** |

### La lista exacta, clasificada por mecanismo

| clase | casos | ① | ② | qué la produce |
|---|---|---|---|---|
| `LLAMADA_INTRA_MODULO` | **158** | NO | SÍ | nadie lo importa, pero lo llama por dentro un export que sí entra desde una entrada viva |
| `IMPORT_DINAMICO` | **1** | NO | NO SÉ | `email.service.ts::sendQuoteEmail` — se carga con `await import()` (`quotesAdmin.routes.ts:578`) y el nombre no queda atado |
| `REEXPORT` | **1** | SÍ | NO SÉ | `email.service.ts::sendInvoiceEmail` — se llega por el re-export de `lib/email.ts:4` |
| `OTRO` | **0** | | | — |

🔴 **`OTRO` está vacío, y hay un test que lo exige.** Una discrepancia sin mecanismo no está
clasificada: **está sin mirar**, y es justo la que decidiría mal un borrado.

Las clases que el comparador sabe detectar y que hoy **no tienen ningún caso**:
`NOMBRE_REPETIDO` (dos módulos exportando el mismo nombre), `NAMESPACE_OPACO` y
`TABLA_DE_DESPACHO`. Se dejan implementadas porque el día que aparezca una, tiene dónde caer en vez
de irse a `OTRO`.

---

## 3 · 🔴 Qué sesgo produce cada clase, y hacia dónde falla

Es lo único accionable para quien vaya a borrar. Cada fila de la tabla lleva este campo, y hay un
test que exige que esté.

### `LLAMADA_INTRA_MODULO` — 158 casos · **el sesgo de ①, y es el peligroso**

① las da por **HUÉRFANAS** y el proceso **sí pasa por ellas**. Son el **30 % del corpus común**.

> **Borrar guiándose por ① borra código vivo.** El ejemplo canónico es `ensureReferralCode`: no lo
> importa nadie, pero lo llama `getReferralStats`, al que se llega desde la ruta montada
> `GET /admin/referral`. Un merchant antiguo **sí** obtiene su código de referido.

Causa: ①, por diseño, contesta «¿lo importa alguien?». Un export usado **solo dentro de su fichero**
no tiene importador y sale huérfano — **correcto para su pregunta, y equivocado para la de borrar.**

### `IMPORT_DINAMICO` — 1 caso · **el peor de los cuatro cuadrantes**

`sendQuoteEmail`: ① dice **huérfano**, ② dice **no sé**. **Nadie ha comprobado nada**, y aun así
aparecería en una lista de borrables si se mira solo el número de ①. Y sí se manda: lo llama
`quotesAdmin.routes.ts` con `const { sendQuoteEmail } = await import(…)`.

### `REEXPORT` — 1 caso · **el sesgo de ②, y lo digo yo de mi propio instrumento**

`sendInvoiceEmail`: aquí **① acierta** y **el que se queda corto es el mío**. Se llega por el
re-export de `lib/email.ts:4`, y ② tira ese camino porque el módulo **también** entra por un import
dinámico: **su opacidad es de grano grueso y se traga un camino que sí era determinable.**

### El resumen para quien decida

| Instrumento | Falla hacia… | Consecuencia si se borra con él |
|---|---|---|
| ① `_alcance-dominio` | marca **huérfano** lo que el proceso ejecuta (158) | 🔴 **borra código vivo** |
| ① `_alcance-dominio` | marca **vivo** por nombre global | sobre-marca vivos → no borra de más, pero tapa deuda |
| ② `_alcance-desde-entradas` | dice **no sé** de grano grueso (2) | se queda corto: su número **no basta** para borrar |
| ② `_alcance-desde-entradas` | no sigue tablas de despacho | acusaría de más → **medido hoy: 0 casos** |

**Ninguno de los dos basta solo, y no fallan en la misma dirección.** Ésa es la razón de que la
decisión de fundirlos sea de los fundadores y no de una sesión.

---

## 4 · Verificación

| | Qué | |
|---|---|---|
| 🔴 **AUTOPRUEBA** | discrepancia **sintética plantada**: vale solo si encuentra EXACTAMENTE la plantada — ni una menos (ciego) ni una más (inventa) | ✅ |
| 🔴 **SUELO** | lista vacía → **falla declarándose ciego**. Sabemos de al menos una medida a mano | ✅ |
| 🔴 **CONTROL POSITIVO** (dentro del test) | `sendQuoteEmail` sale `NO_SE_PUDO_DETERMINAR`, **no muerto** | ✅ |
| **CONTROL NEGATIVO** | donde coinciden, coinciden: 359 acuerdos. Un comparador que lo marcara todo también «encontraría la plantada» | ✅ |
| **NUNCA UN SOLO INSTRUMENTO** | ① + ② + un tercer barrido AST para clasificar (re-exports, imports dinámicos, namespaces, nombres repetidos, literales) | ✅ |
| **`OTRO` vacío** | toda discrepancia lleva mecanismo | ✅ |

### Los rojos por el mecanismo, probados uno a uno

| Mutación | Cae diciendo | Tests |
|---|---|---|
| el comparador deja de comparar (todo a «acuerdo») | *«CERO DISCREPANCIAS … un cero significa que el comparador se ha quedado ciego, no que los dos instrumentos coincidan»* | 5 |
| se pierde la detección de la llamada intra-módulo | *«hay 158 discrepancia(s) que el comparador NO sabe explicar … está sin mirar»* | 1 |
| el sesgo deja de decir la consecuencia | *«ha dejado de decir la consecuencia. Es LA frase del ticket: quien borre guiándose por ① borra código que el proceso ejecuta»* | 1 |

**Suite:** línea base **3.366 · 3.289 pasan · 0 fallos · 77 saltados**, medida aparte apartando el
fichero nuevo del glob (no se borró nada del disco). `guards:entrada` en verde.

---

## 5 · Huecos declarados

* 🔴 **Los 108 exports no alcanzables de `src/` siguen sin clasificar.** Es el hueco que el propio
  encargo nombra para que no se vuelva permanente, y **este ticket no lo cierra**.
* **`TABLA_DE_DESPACHO` es una SEÑAL, no una prueba.** Se detecta por literal de cadena o clave de
  objeto con el mismo texto, y un literal puede ser cualquier cosa. Se usa para **explicar** una
  discrepancia que ya existe, nunca para afirmar que algo está vivo. Hoy no clasifica ningún caso.
* **El corpus común deja fuera todo lo que no es `domain/`.** ② censa 805 exports y ① solo 519 de
  dominio: la comparación no dice nada de `integrations/`, `core/` ni las rutas.
* **`NO SÉ` de ② es de grano grueso:** un import dinámico o un `import * as` deja indeterminado el
  módulo **entero**, aunque otros caminos al mismo export sí sean determinables. Es exactamente lo
  que produce el caso `REEXPORT`.
* **No se ha medido cuántos casos escapan a ② por tabla de despacho.** Hoy salen 0, pero 0 aquí
  significa «el comparador no encontró ninguno», no «no los hay».

## 6 · Lo que NO se ha hecho

`tests/_alcance-dominio.mjs` ni ningún fichero del carril ajeno (cero líneas de diff) · **no se han
fundido los dos instrumentos** · **no se ha borrado ni un export**, aunque los dos coincidan en que
no se alcanza · `prisma/schema.prisma` · ninguna dependencia nueva.

## 7 · Ficheros

* `tests/_comparador-alcance.mjs` (nuevo) — el comparador, sus clases y su autoprueba.
* `tests/scrum493-dos-instrumentos.test.mjs` (nuevo) — 8 tests.
* `docs/master/SCRUM-493.md` — esta entrada.
