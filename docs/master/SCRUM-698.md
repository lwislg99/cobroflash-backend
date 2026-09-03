# SCRUM-698 · Las pantallas que el banco no podía mirar, y el fallo que no decía quién fue

**Fecha:** 3-sep-2026 · **Carril:** banco de vistas (tests) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `9ba054a988866284ee6b3694f2e653451ba79a81` · 2026-09-03T12:57:16+01:00

**Tanda:** **4.941 pruebas · 4.857 en verde · 0 fallos · 84 saltadas** — con `main` ya mergeado
dentro y medida DESPUÉS del último cambio de código. Lo único posterior es esta cifra, que no es
código y no se puede medir antes de existir.

---

## PASO 0

**ENTRADA: no hay entrada de usuario.** Esto no está en ninguna pantalla. Se llega por
`tests/_banco-vistas.mjs` → `pintarVista(banco, '<vista>')`, que es como miden las sesiones. La
víctima no es un profesional: son **seis pantallas del panel sobre las que ningún guard podía
afirmar nada**.

**MECANISMO — existía casi entero, y el trabajo fue darle superficie.** El banco ya tenía el
canal de datos (`opciones.datos`, que el `fetch` simulado consulta), las cuatro inserciones de
DOM, `removeChild`, `parentNode` y el tope de ticks de SCRUM-448. Faltaban **dos piezas
concretas**, y ninguna era del producto.

---

## 🔴 LO PRIMERO: MEDIR POR QUÉ, UNA POR UNA — y ninguna era de la vista

| vista | por qué no se montaba | se monta con |
|---|---|---|
| `renderQuoteRequestsView` | `requests.forEach is not a function` | `[]` |
| `renderTeamView` | `members.filter is not a function` | `[]` |
| `renderTemplatesView` | `templates.forEach is not a function` | `[]` |
| `renderPlansView` | `plans[0]` sobre `undefined` | `{plans: []}` |
| `renderAlbaranDetailView` | `cubos[undefined].push` | `{estado: 'borrador'}` |
| **`renderSettingsView`** | **`insertAdjacentHTML` no existe en el banco** | — |

**Las cinco primeras fallan porque el `fetch` del banco devuelve `{}` cuando nadie le pasa
datos**, y `{}.filter` no existe. La sexta falla por una **API del DOM que el banco no tenía**
(cero menciones en el fichero): la vista pone la nota del IBAN con
`fIban.wrapper.querySelector('label').insertAdjacentHTML('afterend', …)`, que es DOM de manual
perfectamente legítimo. Mismo hueco que `prepend` (SCRUM-460) y `parentNode` (SCRUM-609).

**Por eso no se ha tocado una sola línea de `public/`.**

---

## 🔴 LO CARO: un rechazo huérfano mataba el proceso, y eso es SCRUM-672 con otra cara

`reportsView` dispara su carga **sin esperarla** (`load()`, `loadVat()`), así que su promesa **no
pasa por `pintarVista`**: cuando rechazaba, no había nadie que la manejara y **el proceso entero
se caía**. En una tanda eso significa que **el fichero muere y se lleva sus tests con él**, sin un
`fail` que diga quién fue: el total baja y el porcentaje de verdes puede incluso **mejorar**. El
suelo del total lo cazaría después; esto lo cierra antes.

No se puede resolver envolviendo la vista —la promesa huérfana no vuelve por ningún sitio—, así
que `pintarVista` **aparta los oyentes de rechazo mientras dura el montaje** y los devuelve en un
`finally`.

> 🔴 **Y esto no es tragarse nada:** los rechazos **se devuelven** en `rechazos`, con la vista
> delante. Hoy `renderReportsView` devuelve dos, con nombre y motivo, donde antes había un
> proceso muerto. Lo que se aparta es el veredicto automático del runner, no la medición.

---

## El fixture se OFRECE, no se impone

`datosDeMuestra(url)` da **la forma mínima que cada vista pide para llegar a pintarse**, derivada
de lo que cada una solicita. **No es el contrato del backend** y no sirve para afirmar nada sobre
el CONTENIDO de una pantalla: quien quiera medir contenido sigue pasando los suyos.

Y **no se pone como valor por defecto de `cargarDashboard`** a propósito: cambiar lo que reciben
las vistas que hoy se montan movería mediciones ajenas sin que nadie lo pidiera. Hay un control
negativo que lo fija.

---

## 🔴 EL SUELO, que es la trampa entera de este ticket

Un censo que dijera «26 de 26 se montan» **no probaría que se ha arreglado nada: probaría que se
ha dejado de mirar.** Por eso se miden **dos poblaciones**:

| | |
|---|---|
| vistas publicadas (derivadas, sin lista a mano) | **26** |
| se montan **con** la forma mínima | **26 de 26** |
| se montan **desnudas**, sin datos | **21** — las otras cinco están listadas por nombre |

La segunda es la que vigila de verdad: si aparece una **nueva** en la lista de las que necesitan
datos, alguien ha roto una pantalla que se montaba sola. Y si la lista se quedara **vacía** sin
que nadie lo haya hecho, también falla — un cero ahí es una noticia que hay que escribir, no un
verde.

---

## El rojo, probado por el mecanismo — cinco mutaciones con post-condición

Cada una comprueba que ha cambiado **ese** fichero y a **esa** línea antes de creerse el rojo.

| se rompe a propósito | cae |
|---|---|
| se quita la recogida de rechazos (el banco de antes de 698) | cinco tests, entre ellos «EL MECANISMO» y «NOMBRA la vista» |
| los oyentes **no** se devuelven | «los oyentes de rechazo SE DEVUELVEN» |
| se quita `insertAdjacentHTML` | «CUATRO posiciones», «`settings` se monta POR ESO» y las dos poblaciones |
| `beforebegin` sin padre se inventa un sitio | el control negativo |
| el fixture vuelve a devolver `{}` | «TODAS las vistas del panel se montan» |

### 🔴 Y una mutación encontró un defecto EN MI PROPIO TEST — otra vez

Quitar la línea que devuelve los oyentes **no tumbaba nada**. El motivo: el test comparaba
`process.listeners(…).length` **antes y después**, una diferencia RELATIVA que no cae si el daño
ya se hizo en una llamada anterior — y para cuando llega ese test ya se han montado vistas de
sobra, así que antes y después valían cero. **Una regla que pasa siempre.** Ahora el test pone un
oyente **propio** y exige que siga ahí: absoluto, y no depende de quién haya corrido antes.

---

## El fan-out, medido y no supuesto

TAP entero de `main` solo contra TAP entero de `main` + esta rama, test a test:

| | |
|---|---|
| cambiados de estado | **0** |
| perdidos | **0** |
| nuevos | **11** (los de este ticket) |

`main` 4928 → rama 4939, **+11 exactos**.

> El fan-out se midió contra `main` = `4e9e114d`, que era la base al empezar. Main se movió 3
> commits mientras se cerraba esto; se mergearon dentro y la tanda final (4.941) es la de
> DESPUÉS. Lo que el fan-out demuestra —que tocar el banco no movió ningún test ajeno— no lo
> cambia que entren tests nuevos por otro carril.

> ⚠️ **El límite del instrumento, declarado otra vez:** la comparación es **por NOMBRE**, y hay
> **16 homónimos** entre ficheros — los mismos 16 en los dos lados. Dos tests con el mismo nombre
> que se compensaran no se verían; con 0 cambiados y 0 perdidos es muy improbable, pero es una
> limitación de la herramienta, no de la medida.

---

## El suelo de la tanda: NO se toca

Esta rama **añade** tests, así que el total sube solo y el suelo de `main` sigue siendo cierto.
No se sube desde aquí: anoche se midió que **se declara en una máquina y se evalúa en el runner**,
con nueve de diferencia sobre el mismo árbol. Eso está abierto en otro ticket.

## Ficheros

`tests/_banco-vistas.mjs` (`insertAdjacentHTML`, la recogida de rechazos y `datosDeMuestra`) ·
`tests/scrum698-vistas-que-no-se-miden.test.mjs` (**nuevo**, 11 tests) · esta entrada.

**No se ha tocado:** ni una línea de `public/` —ninguna de las seis era fallo de producto— ·
`prisma/schema.prisma` · `scripts/_suelo-de-la-tanda.mjs` · ningún test existente se ha
«ajustado» · sin dependencias nuevas (regla 36).

## Estado del árbol

* Rama nacida de `origin/main`, con `main` mergeado dentro —no rebase, nunca `--force`—.
* **Cliente de Prisma regenerado desde ESTE worktree antes de la tanda**, y hacía falta: sin él,
  `main` solo daba **3 fallos**; con él, **1** (y ese uno era ajeno, ver hallazgos). Los dos que
  desaparecieron eran del cliente desfasado, no del código — sin regenerar habría acusado a main
  de dos roturas que no tenía.
* `npm run guards:entrada` en verde. Cero CR en disco (medido por BYTES).

## Los huecos que declaro

1. **Los rechazos que lleguen DESPUÉS de que `pintarVista` retorne no se recogen.** El montaje
   espera diez ticks (SCRUM-448); una promesa que rechace más tarde vuelve a caer fuera. No lo he
   medido ni sé si ocurre hoy.
2. **`pintarVista` aparta oyentes del proceso**, así que **dos montajes concurrentes se pisarían**
   (`Promise.all` de dos vistas). Hoy todos los usos son secuenciales; no lo he forzado.
3. **`datosDeMuestra` no está contrastado contra los endpoints reales.** Sirve para que la vista
   se monte, no para afirmar que el backend devuelve eso. Un guard que mida CONTENIDO sobre él
   estaría midiendo mi fixture.
4. **De las 26 vistas sólo compruebo que se MONTAN**, no que pinten lo correcto. Que una pantalla
   sea alcanzable es la condición para poder medirla, no la medida.
5. **No he mirado si otras vistas dejan promesas huérfanas** además de `reportsView`: el canal las
   recogería, pero no he censado quiénes son.

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* `main` traía un fallo ajeno (`SCRUM-652d · CONTROL POSITIVO: NO se estrena una entrada de nav para el parte`) cuando la base era `4e9e114d`; los 3 commits que entraron después lo arreglaron y en `9ba054a9` ya no está — se deja escrito porque me costó una vuelta separarlo de lo mío.
* `destinoEfectivo` devuelve `undefined` para un estado que el registro no contempla, y tanto `albaranDetailView` como `invoiceDetailView` hacen `cubos[destino].push(...)` sin defensa: un estado nuevo rompe la pantalla de detalle entera.
* `plansView` hace `plans[0]` sin comprobar que `plans` exista, así que una respuesta sin esa clave revienta la pantalla de planes en vez de enseñar su estado vacío, que ya está escrito justo debajo.
