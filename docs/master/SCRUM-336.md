# SCRUM-336 · La atribución deja de guardarse en el navegador del visitante y pasa a viajar en la URL

**Fecha:** 5-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `21375e6108b26a70211b21d86bcf7429f9c2e917` · 2026-08-05T05:10:59+01:00

> **La medición previa cambió la decisión, y por eso existe esta entrada.** El plan era «dejar de
> guardar lo que nadie lee». Medido: **los dos valores tenían dueño**, así que esto no es una
> eliminación — es un **cambio de mecanismo** (opción B, decidida por el fundador tras la parada).

---

## Lo que la medición previa encontró, y que contradecía la premisa

**La premisa era «un dato que nadie consume».** SCRUM-327 midió que no hay analítica **de terceros**;
de ahí se leyó que nadie consume estos datos. La instrumentación **propia** sí existe:

* **`yaqu_src` → `Merchant.acquisitionSource`** (`register.html` → `auth.service.ts:304`) → lo lee
  **`getPlatformFunnel`** (`metrics.service.ts:317-394`), que **agrupa el embudo por canal**
  (`:388-394`: *«¿qué canal trae altas que ACABAN cobrando?»*) y se pinta en el BO
  (`reportsView.js:590`). Es la única instrumentación de negocio que hay.
* **`yaqu_ref` → `Merchant.referredBy`** (`auth.service.ts:291-303`) → **`referral.service.ts:111-125`
  da +1 mes gratis al referidor cuando el referido paga**. Romperlo no es perder un dato: es dejar
  de pagar una recompensa prometida.

Y dos cosas más que el ticket no recogía:

* **La escritura estaba en DOS páginas**, no en una: `index.html` **y** `precios.html`.
* **Las dos claves están diseñadas para sobrevivir a varias visitas** (first-touch: solo escriben si
  no había valor previo), y `register.html:65-67` lo decía literalmente: *«localStorage, first-touch,
  sobrevive días»*.
* **Ningún CTA llevaba parámetros**: los **8** enlaces a `/register.html` eran `href="/register.html"`
  a secas, así que con URL sola la atribución se perdía **siempre** que el visitante pasara por la
  landing, que es el camino normal.

---

## Lo que se ha hecho

**El criterio no cambia** —no se guarda en el terminal sin consentimiento— **pero el cómo sí**,
porque el dato resultó tener dueño. **Un parámetro en la URL no es almacenamiento en el terminal:**
el art. 5.3 deja de aplicar, sin banner y sin romper la atribución del camino normal.

| Cambio | Dónde |
| --- | --- |
| Retiradas las escrituras de `localStorage` de las dos claves, en **las dos páginas** | `public/index.html`, `public/precios.html` |
| Retirados los dos respaldos de almacenamiento del registro (la URL pasa a ser la **única** fuente) | `public/register.html` |
| **Nuevo**: la atribución viaja en la URL — propaga `ref`, `utm_*` y `src` a los enlaces del registro | `public/js/atribucion.js` |
| Cargado el script donde hay CTA al registro | `index.html`, `precios.html`, `login.html` |

**Los enlaces NO están escritos en ninguna parte.** El script los **deriva del DOM**
(`a[href^="/register.html"]`), así que un CTA nuevo mañana atribuye solo. Hoy son 8 en 4 ficheros;
mañana da igual cuántos sean. Y hay una red de seguridad en captura (`click` + `auxclick`) para los
enlaces que se inyectan después de cargar — la demo de la landing añade el suyo.

**La rama muerta, retirada:** `register.html` leía `sessionStorage` como respaldo *legacy* y **el
censo derivado no encontró ni una escritura suya en toda la superficie pública**. No cambia
comportamiento: no podía devolver nada.

### Una decisión que tomé y que puedes revertir

El script hace una cosa que no estaba en el encargo: cuando el visitante llega **sin UTM pero desde
un sitio externo**, propaga `utm_source=referrer:<host>` — exactamente el mismo valor que antes se
calculaba en la landing y se guardaba. Sin esto, **todo el tráfico orgánico** (llegar desde Google
sin campaña) dejaría de atribuirse, que es justo el dato que el embudo consume. Se hace con el
parámetro que `register.html` **ya sabía leer**, así que el valor que acaba en la base es el mismo y
el registro no ha tenido que cambiar. **Coste:** aparece un `utm_source` sintético en la barra de
direcciones. Si prefieres perder esa atribución, se quita en una línea.

---

## 🔴 Lo que se pierde, y se declara

**El first-touch multi-visita.** Quien aterriza hoy con `?ref=` y **vuelve en tres días** sin
parámetros **queda sin atribuir**. La atribución pasa de **«sobrevive días»** a **«sobrevive la
navegación en curso»**.

Recuperarlo es cosa del banner, que es **SCRUM-329 (F2)**, no este ticket: cuando haya
consentimiento, `localStorage` vuelve a ser legítimo y se repone el first-touch. Quien construya el
banner tiene que saber que **no es solo pintar una casilla**: hay una capacidad que reponer.

---

## Verificado en rojo — y el primer caso es el que pedía el ticket

| Caso | Qué se hizo | Resultado |
| --- | --- | --- |
| **R1** · «hoy escribe, después no» | El **mismo detector** sobre el árbol de **antes** (sacado de `git show HEAD:…`, no un fixture) y sobre el de ahora | **ANTES: 11 accesos, 4 escrituras** (`index.html:570,577` · `precios.html:99,113`) → **AHORA: 0 accesos, 0 escrituras**. El guard habría estado rojo antes y está verde ahora |
| **R2** · vuelve el `localStorage` | `setItem` real añadido a `index.html` | 🔴 cae «no guarda NADA» |
| **R3** · otra tecnología | `document.cookie = …` real añadido a `precios.html` | 🔴 cae el mismo assert — la cobertura no es por clave ni por API, es por **almacenar** |
| **R4** · la atribución deja de viajar | Se quita `ref` de la propagación en el script real | 🔴 cae **«LA CARA QUE PAGA»** |
| **N** · control negativo | Enlace que no es al registro · enlace **externo** · `?ref=` ya escrito en el CTA · página sin parámetros · hash | 🟢 no toca ninguno |

**R4 es el que importa de verdad.** Si el guard solo mirase que no hay almacenamiento, la forma más
fácil de tenerlo verde sería romper la atribución del todo — y nadie se enteraría **hasta que un
referidor reclamara su mes gratis**. Por eso el guard tiene dos caras y esta es la segunda.

Restauración desde **memoria**, nunca con `git checkout`: la lección de SCRUM-337, donde eso se
llevó por delante trabajo sin commitear.

## Lo que NO cubre

* **No se ha abierto un navegador.** Los dos casos de propagación ejecutan el **script real** con un
  DOM de mentira y los **enlaces reales** extraídos de `index.html`, pero nadie ha hecho clic. La
  red de seguridad en `click`/`auxclick` (para enlaces inyectados) **no está cubierta por un test**:
  se ejercita al pulsar, y eso pide navegador.
* **No se ha probado el alta contra la base**: `resolveReferrer` y el escritor de
  `acquisitionSource` no se han tocado, y el test comprueba que el registro **sigue mandando** `ref`
  y `source`. La cadena servidor→BD queda como estaba.
* **No se toca el banner** (SCRUM-329), ni el programa de referidos, ni microcopy, ni el schema.
* **El panel (`public/dashboard/`) queda fuera del censo a propósito**: es la app tras
  identificarse, su almacenamiento es otra conversación. Y sirve de **control positivo** del
  detector.

## Ficheros

* `public/js/atribucion.js` — **nuevo.** La propagación (deriva los enlaces; no guarda nada).
* `public/index.html`, `public/precios.html` — fuera las escrituras; dentro el script.
* `public/register.html` — fuera los dos respaldos de almacenamiento.
* `public/login.html` — carga el script (también enlaza al registro).
* `tests/_censo-almacenamiento-publico.mjs` — **nuevo.** Censo derivado (AST).
* `tests/scrum336-atribucion-sin-almacenamiento.test.mjs` — **nuevo.** El guard (8 asserts).
* `docs/master/SCRUM-336.md` — este registro.
