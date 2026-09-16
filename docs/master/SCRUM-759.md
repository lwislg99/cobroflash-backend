# SCRUM-759 · El guard ciego fuera de su fichero — la población decide, no el rótulo

**Fecha:** 7-sep-2026 · **Carril:** instrumentos · **Gate:** sin gate — corre en `npm test`
**Medido contra:** `origin/main` = `64b5d80ae3b11dcc34d736de21670eb6b5ce6dda` · 2026-09-07T07:01:07+01:00
**Tanda:** **5850 pruebas · 5748 en verde · 0 rojas · 102 saltadas** · 251,9 s · salida 0.
**Mutaciones de este ticket:** **4 vivas · 0 mudas · 0 ciegas**, árbol restaurado byte a byte.

> Un guard por AST anclado a un fichero es **fuerte donde mira y ciego donde no**, y su verde no
> distingue las dos cosas: su población es UN FICHERO, su afirmación es SOBRE EL PRODUCTO ENTERO,
> y el rótulo no dice cuál de las dos mide.

---

## OBLIGACIÓN 0 · comprobado que no estaba hecho

`git ls-remote --heads origin` (542 ramas) → **ninguna rama** de 759 ·
`git log origin/main --grep=759` → sólo `Merge pull request #759` de otro ticket ·
`docs/master/SCRUM-759.md` **no existe** en `main` · ningún test de 759 en el árbol.

## 🔴 EL ROJO, PRIMERO · corriendo sobre el ÁRBOL REAL, no contándolo

Se repite la mutación **M5 de SCRUM-606** —una segunda alta de albarán escrita FUERA de
`jobDetailView.js`— con la maquinaria de la casa (`aplicarUna` de `meta-guard-mutaciones.mjs`:
aplica, corre, restaura y verifica bytes). Y su control positivo, la misma alta escrita DENTRO.

| la segunda alta está… | SCRUM-303 | SCRUM-606 (d) |
|---|---|---|
| **FUERA** de `jobDetailView.js` (`albaranDesdePresupuestoModal.js`) | 🟢 **VERDE — ciego** | 🔴 ROJO |
| **DENTRO** de `jobDetailView.js` | 🔴 ROJO | 🔴 ROJO |

`sha256` de los dos ficheros idéntico antes y después: **árbol restaurado byte a byte**.

Las dos filas juntas son el ticket entero. La primera es el defecto: el guard que existe para
impedir la segunda alta **no la ve** si se escribe en otro fichero. La segunda es el control
positivo: no es que el guard esté roto — es que su población no llega adonde llega su frase.

## OBLIGACIÓN 1 · EL CENSO · población declarada, por AST, nunca por texto

`tests/_censo-poblacion-de-guards.mjs`. Deriva del AST de cada guard **de dónde lee**: resuelve la
ruta siguiendo las `const` encadenadas, `import.meta.url` / `dirname` / `filename`,
`new URL('..', import.meta.url)`, `path.join/resolve` y el acceso por índice a la propia
declaración. Un `grep` de `readFileSync` casa el comentario que lo explica y no sabe qué fichero
se abre cuando la ruta viene de tres constantes, que es como está escrita en casi todo el árbol.

**Población declarada: los 710 ficheros `tests/*.test.mjs` del árbol** (711 con el de este
ticket). Medido el 7-sep-2026:

| | |
|---|---|
| usan el AST de TypeScript | **162** |
| población **ANCLADA** a ficheros concretos (lectura propia) | 49 |
| población **BARRIDO** (`readdirSync` o ruta variable) | 110 |
| **CIEGA** — usa el AST y no se supo de dónde lee | 3 |
| con **alguna lectura sin resolver** (se declaran, con el nombre de lo que no se supo) | **22** |
| **CIEGOS en total** (los 22 anteriores + el que usa el AST sin leer nada resoluble) | **23** |
| 🔴 **ANCLADOS QUE ADEMÁS AFIRMAN UN TOTAL** — los que tienen la forma del defecto | **14** |

**La forma se detecta por ESTRUCTURA, no por prosa:** una función que recorre el AST y va
`push`eando en un array —eso es un censo— y un `assert` que compara lo censado contra `[]` o
contra un número —eso es una afirmación sobre TODA la población—. Un guard que sólo comprueba «en
este fichero, tal función hace tal cosa» no sale aquí, y hace bien: afirma sobre lo que lee.

### ⚠️ Dos poblaciones por guard, y se guardan las dos

La **PROPIA** (lo que el guard abre él mismo) y la **EFECTIVA** (sumando lo que leen los helpers
que importa). Clasificar sólo por la efectiva escondería candidatos —casi todos los helpers de la
casa reciben la ruta por parámetro y parecen barridos—; clasificar sólo por la propia acusaría a
quien delega de verdad. **El caso que lo obligó: SCRUM-627b** salía anclado a un único fichero
cuando su censo real barre `src/` a través de `_censo-aritmetica-iva.mjs`.

## OBLIGACIÓN 2 · LOS 14, UNO A UNO, CON SU DECISIÓN ESCRITA

De los 14 con la forma, **2 tenían la afirmación por encima de la población**. Los otros 12 ya
nombran en su rótulo la superficie que leen. Y **para separarlos hubo que leer los 14**: eso es
justo el dato que contesta la obligación 3.

| guard | población que lee | decisión |
|---|---|---|
| `scrum302-sin-callejones` | `albaranDetailView.js`, `jobDetailView.js` | 🔴 **ESTRECHAR EL RÓTULO — hecho** |
| `scrum303-albaran-una-pantalla` | `jobDetailView.js`, `styles.css` | 🔴 **ESTRECHAR EL RÓTULO — hecho** |
| `scrum216-tipo-rectificativa-sin-defecto` | `registro.builder.ts` (+ helper XSD) | estrechar → **ya cumplido**: la salida imprime `registro.builder.ts:<línea>` |
| `scrum284-configuracion-submenus` | `settingsView.js` | estrechar → **ya cumplido**: «la vista» ES el fichero que lee |
| `scrum301-albaranes-seccion` | `albaranesView.js`, `app.js`, `index.html`, `styles.css` | estrechar → **ya cumplido**: «esta pantalla» ES su población |
| `scrum369-verificador-sello` | `albaranVerificacion.ts`, `albaran.service.ts` | estrechar → **ya cumplido**: «el verificador» ES el fichero que lee |
| `scrum371-barrido-poblacion` | `albaranBarrido.ts` y 4 más | estrechar → **ya cumplido**: «el barrido» ES el fichero que lee |
| `scrum373-avisos-facturas` | `invoicesView.js` | estrechar → **ya cumplido**: habla de sus tres ranuras |
| `scrum384-min-height-locales` | `exportView.js`, `reportsView.js`, `styles.css` | **ya DERIVADO**: el rótulo dice `${nombre}`, sacado de su propia lista |
| `scrum386-hojas-fuera` | `jobDetailView.js` | estrechar → **ya cumplido**: nombra función y línea |
| `scrum481-metodo-en-castellano` | `cobrosView.js` | **ya DERIVADO**: el rótulo dice `${VISTA}` |
| `scrum501-una-fila-por-envio` | `enviarCorreo.ts`, `registroDeEnvios.ts` | estrechar → **ya cumplido**: nombra las dos funciones |
| `scrum627b-censo-declara-reimplementaciones` | efectiva: **barrido de `src/`** | **rótulo respaldado por la población**: no se toca |
| `scrum712-decimales-de-precio` | `schemas.ts` | estrechar → **ya cumplido**: imprime `schemas.ts:<línea>` |

**Ninguno se AMPLÍA y ninguno se RETIRA**, y las dos cosas están razonadas:

* **Ampliar la población de SCRUM-303 sería escribir un segundo censo del alta.** Ya existe uno
  entero y con su suelo —SCRUM-606 (d), sobre los ~74 ficheros del dashboard—, y el encargo lo
  dice: no se rehace. Dos censos del mismo hecho se desincronizan en cuanto alguien mejora uno.
* **Retirar SCRUM-303 tampoco**: SCRUM-606 (d) cubre *el alta*, no el resto de lo que 303 vigila
  (que el POST no esté en el manejador del clic, que viva en `openAlbCrearSheet`, los siete textos
  firmados, el tono del aviso). Un guard honesto sobre un fichero sigue siendo útil.

### Lo que se ha cambiado en los dos, y cómo

No se ha estrechado el rótulo **a mano**: se ha **derivado** de una población declarada.

```js
export const POBLACION_QUE_VIGILO = [
  'public/dashboard/js/jobDetailView.js',
  'public/dashboard/css/styles.css',
];
const DONDE_MIRO = POBLACION_QUE_VIGILO[0];
const RUTA_FRONT = path.join(RAIZ, DONDE_MIRO);   // la ruta que se LEE sale de la declaración
...
`🔴 hay ${posts.length} altas de albarán en ${DONDE_MIRO}.`   // y el rótulo, también
```

antes decía **«hay N altas de albarán en el front»** leyendo un fichero.

Así la divergencia entre lo que se mira y lo que se dice **no queda vigilada: queda imposible**
(el escalón de arriba). En `scrum302-sin-callejones` lo mismo, y además el nombre del test pasa de
«toda navegación a jobs-detail está declarada» —una frase sobre el dashboard entero— a
«toda navegación a jobs-detail **DE LA PÁGINA DEL ALBARÁN**».

## 🔴 OBLIGACIÓN 3 · ¿PUEDE UN GUARD DECLARAR SU POBLACIÓN? — con la medida, no con la intuición

**Sí, y con el mismo mecanismo exacto que ya usa para sus mutaciones**: `export const
POBLACION_QUE_VIGILO = [...]`, leído **por AST y sin ejecutar el fichero**, igual que
`MUTACIONES_QUE_ME_TUMBAN`. Adoptado hoy en **2 guards**. Y lo que compra, medido:

1. **El contraste declarada-vs-leída es exacto y automático.** Se caza en los dos sentidos —
   declarar de más (prometer cobertura que no hay: el defecto de este ticket escrito en la
   declaración) y leer sin declarar (cobertura que nadie sabe que existe).
2. **Es aplicable a la mayoría del árbol, y donde no, se dice.** La población se sabe derivar en
   **140 de los 162 guards con AST (86 %)**. Los 23 restantes **se declaran CIEGOS con el nombre
   de lo que no se supo resolver** (`RUTA_SQL`, `ficheroNota()`, `...p`, `r.fichero`…), nunca como
   «no anclado». Una declaración que nadie puede contrastar es un comentario; por debajo de esa
   proporción, mecanizar esto dejaría de significar nada, y ese suelo está puesto.
3. **El rótulo derivado se comprueba por ESTRUCTURA**: por AST, que el mensaje del `assert` salga
   del identificador de la población y no de prosa escrita a mano.

**Y lo que NO se mecaniza, también medido.** Decidir si una afirmación «abarca más» es leer prosa.
De los **14** candidatos con la forma, sólo **2** tenían el rótulo por encima de su población: un
detector que marcara los 14 daría **12 falsos positivos (86 %)**, y un guard que salta con todo se
silencia. Así que el reparto real es:

* **automático** — que la forma exista y no desaparezca en silencio; que lo declarado cuadre con
  lo leído; que el rótulo salga de la declaración;
* **humano, UNA vez por guard** — decidir si esa frase abarca más de lo que se abre. Y una vez
  derivado el rótulo, esa decisión **ya no puede caducar**: no hay dos sitios que se separen.

## CONTROLES

* 🔴 **EL QUE DECIDE, permanente.** `SCRUM-759 · 🔴 EL QUE DECIDE: la violación escrita FUERA del
  fichero vigilado`: sobre banco propio, con el MISMO criterio y la MISMA violación, la población
  anclada **no la ve** y la población entera **sí**. La prueba que se corrió a mano una vez y no
  dejó nada que volviera a correrla ahora corre en cada `npm test`.
* ✅ **POSITIVO.** Medido en el árbol real (tabla de arriba) y permanente en el banco: la
  violación DENTRO sigue cayendo por las dos poblaciones. Estrechar el rótulo de SCRUM-303 **no**
  le ha quitado el caso original.
* 🔴 **SUELO.** Si el censo devuelve **cero** guards con esta forma, falla declarándose CIEGO —
  hay al menos uno medido. Y hay tres suelos más: la población mirada (≥600 ficheros), los guards
  con AST (≥100) y la proporción contrastable (≥75 %). Ninguno es un cero silencioso.
* 🔴 **SUELO DERIVADO, no cableado** (SCRUM-810): los adoptantes de la declaración **no encogen
  contra la base de fusión con `main`**. Crecer es gratis; perder habla a la primera. Un número
  escrito aquí caducaría el día que se escribe.

## MUTACIONES · 4 vivas · 0 mudas · 0 ciegas

Corridas con la maquinaria de la casa, restaurando y verificando bytes (`sha256` idéntico):

| mutación | cae |
|---|---|
| el rótulo de SCRUM-303 vuelve a decir «en el front» | `el rótulo de un adoptante está DERIVADO` |
| SCRUM-303 empieza a leer un fichero que no declara | `lo declarado cuadra con lo leído` |
| el censo se traga en silencio una lectura que no supo resolver | `no confunde «no hay» con «no vi»` |
| el detector de afirmaciones de total deja de ver ninguna | `SUELO del censo` |

⚠️ La cuarta arrastra **1 colateral** (`el rótulo de un adoptante está DERIVADO`), y es correcto:
sin afirmaciones de total no hay rótulos que comprobar, y ese test lo dice en vez de callarse.

## ⛔ SIN TOCAR

* **El censo de SCRUM-606 (d)** y su suelo: prohibición explícita del encargo. Este ticket **no
  vuelve a censar el alta de albarán**; el criterio que usa vive sólo dentro de su banco.
* `scripts/meta-guard-mutaciones.mjs` — ni el lector de declaraciones, ni `SUELO_GUARDS`,
  ni `SUELO_DECLARACIONES`, ni ningún veredicto. Sólo se **usan** sus funciones exportadas.
* `scripts/_suelo-contra-main.mjs` — se usa `poblacionesContraLaBase`/`sueloDerivado` tal cual;
  no se añade nada a su registro `POBLACIONES` (eso es de su guard).
* Los otros 12 guards del censo: su rótulo ya nombra lo que leen.
