# SCRUM-480 (fase 1) · El censo de CRLF, y por qué el plan era desproporcionado

**POBLACIÓN MEDIDA** · host `DESKTOP-T5MONF5` · `2026-08-12T07:44:38Z` · repo
`D:/MILLONARIO/cobroFlash/wt-421` · HEAD `75b2b01820f71bdb1bf2b3244b19f801d69e24f6` ·
`core.autocrlf=true` (efectivo, del **nivel system**: `D:/Program files D/Git/etc/gitconfig`)

**Medido contra:** `origin/main` = `2794f7415669548b3de4acfe13211ac22773eea3` · 2026-08-12T07:43:22Z

> **Esta fase no normaliza ni un fichero.** El `.gitattributes` propuesto va **escrito y no
> aplicado**, dentro de este documento — no como fichero, porque escribirlo ES aplicarlo.

## 1 · El censo · **son 12, no 57**

Sobre los **blobs**, no sobre el árbol de trabajo: con `core.autocrlf=true` el árbol tiene CRLF para
todo fichero de texto lo pida el repo o no, así que contar ahí devuelve «casi todos» y no es un dato.

```
ficheros seguidos: 1618 · blobs leídos: 1618 · binarios saltados: 210
FICHEROS CON CR EN EL BLOB: 12     (.js 10 · .properties 1 · .ts 1)
```

| | |
| --- | --- |
| dentro de `public/dashboard/js/` | **10** |
| fuera | **2** — `docs/legal/fuentes/aeat-errores.properties` y `src/modules/products/domain/products.service.ts` |

**Sí hay ficheros fuera de esa carpeta**, que era la pregunta.

### De dónde salía el 57

`public/dashboard/js/` tiene **58 ficheros `.js`**. Y `git ls-files --eol` dice que **1.378 de 1.618**
ficheros están `i/lf w/crlf`: LF guardado, CRLF en el disco. Un censo hecho sobre el **árbol de
trabajo** y acotado a esa carpeta devuelve ~57–58 — la población entera, no los afectados.

> **El 57 no era un recuento de ficheros con CRLF: era el tamaño de la carpeta.** Es exactamente el
> canon nuevo —un recuento sin población no es un dato— aplicado al número que abrió el ticket.
> Contraste hecho con **dos instrumentos independientes**: uno propio sobre los blobs y
> `git ls-files --eol`, que es de git.

## 2 · Qué dice hoy `.gitattributes` — **existe**

```
*.sh text eol=lf                                    # hooks: con CRLF bash falla
scripts/db-push-prod text eol=lf                    # SCRUM-40, mismo motivo
docs/legal/fuentes/aeat-errores.properties -text    # SCRUM-201b: BYTE A BYTE
```

🔴 La tercera es la delicada: ese fichero se guarda **byte a byte porque su SHA-256 está citado en
un documento**. Si git le normaliza los saltos, el sello deja de casar.

## 3 · 🔴 Qué renormaliza `* text=auto` — MEDIDO ANTES DE QUE PASE

No razonado sobre la heurística de git: **preguntado a git**, en un clon desechable del scratchpad
(el repo de trabajo no se tocó — ni un fichero, ni el índice).

```
* text=auto  →  añadido DELANTE de las reglas existentes
git add --renormalize .  →  git diff --cached --numstat

FICHEROS QUE REESCRIBIRÍA: 2
   +1    -0     .gitattributes
   +2576 -2576  public/dashboard/js/jobDetailView.js
```

**Uno.** No hay renormalización sorpresa del repo: `core.autocrlf=true` lleva mucho tiempo
normalizando en silencio en cada commit, y por eso 1.378 blobs ya están en LF.

**El control que importaba:** `aeat-errores.properties` **NO se toca** — su regla `-text` sigue
mandando porque va DESPUÉS. SHA-256 idéntico en el repo y en el clon
(`152fec33…adc6feb3`). ⚠️ **El orden dentro del fichero decide**: `* text=auto` al final habría
anulado las tres reglas y roto el sello.

### Por qué solo uno: **10 ficheros llevan un CR SUELTO**

| | CR | CRLF | sueltos | git dice |
| --- | --- | --- | --- | --- |
| `quotesView.js` | 2989 | 2987 | **2** | `i/-text` |
| `teamView.js` · `aiQuoteAssistant.js` | | | **2** | `i/-text` |
| `customerDetailView.js` · `plansView.js` · `productsView.js` · `providersView.js` · `settingsView.js` · `templatesView.js` · `products.service.ts` | | | **1** | `i/-text` |
| `jobDetailView.js` · `aeat-errores.properties` | | | **0** | `i/crlf` |

**Correlación 10 de 10**: un solo `\r` sin `\n` detrás hace que git clasifique el fichero como
`-text`, y `text=auto` no toca lo que no considera texto. Ésos se quedarían como están.

## 4 · El `.gitattributes` propuesto — **ESCRITO Y NO APLICADO**

```gitattributes
# `* text=auto` VA PRIMERO. Las reglas específicas de abajo tienen que poder ganarle: en
# .gitattributes manda la ÚLTIMA línea que casa, y ponerlo al final anularía las tres —
# incluido el `-text` del fichero sellado, cuyo SHA-256 está citado en un documento.
* text=auto

# Los scripts de shell (hooks de Claude Code) deben mantener LF: con CRLF bash falla.
*.sh text eol=lf
# SCRUM-40: helper de db push sin extensión .sh → misma regla (LF, o bash falla con \r).
scripts/db-push-prod text eol=lf
# SCRUM-201b: la fuente oficial AEAT se guarda BYTE A BYTE (es ISO-8859-1 con CRLF).
# Si git normaliza saltos, su SHA-256 cambia y deja de casar con el que cita el documento.
docs/legal/fuentes/aeat-errores.properties -text
```

Efecto medido: **1 fichero reescrito** (`jobDetailView.js`). Los 10 con CR suelto **no se arreglan
solos**: harían falta `git add --renormalize` con el CR suelto quitado antes, y eso es otra decisión.

## 5 · 🔴 El daño de hoy — **medido, y es MENOR de lo que yo mismo esperaba**

Un cambio de UNA línea, en el clon, sobre los tres casos:

| Fichero | Clase | `git diff --numstat` | ¿diff por líneas? |
| --- | --- | --- | --- |
| `quotesView.js` | CR suelto, git lo llama `-text` | `1  1` | **sí** |
| `jobDetailView.js` | CRLF limpio | `1  1` | **sí** |
| `app.js` | control, LF en el blob | `1  1` | **sí** |

**No hay daño diario.** Yo había inferido que `i/-text` implicaba «git no puede diferenciar por
líneas» y **es falso**: `--eol` clasifica para la conversión de saltos, no para el diff, que usa otra
heurística. Un cambio de una línea produce una línea de diff en los tres.

> Mi inferencia era razonable y estaba mal. La mató medirla — que es el único motivo por el que este
> informe no dice lo contrario.

## 6 · Recomendación

**Esto no necesita una ventana con nada en vuelo.** El plan grande se dimensionó sobre 57 ficheros y
un daño diario que no existe. Lo real:

1. `* text=auto` **primero** en `.gitattributes` → toca **1 fichero**. Cabe en cualquier PR pequeña.
2. Los **10 con CR suelto** son un arreglo aparte y con su propio riesgo: quitar el `\r` es cambiar
   el contenido, y `quotesView.js` (2.989 CR) es la vista más grande del dashboard.
3. `aeat-errores.properties` **no se toca nunca** — su `-text` es la regla que lo protege.

## 7 · Lo que NO se ha hecho

Ni un fichero normalizado · `.gitattributes` sin cambiar · el experimento entero en un **clon
desechable** del scratchpad · ninguna redirección sobre ficheros del repo.

---

# SCRUM-480 (fase 2) · El mecanismo, y por qué renormalizar no bastaba

**Fecha:** 13-ago-2026 · **Carril:** higiene · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `1237240417ffa623c0def283d8c4603db4b02e96` · 2026-08-13T11:09:57+02:00

> La fase 1 midió y **no tocó nada**. Ésta pone el mecanismo. Y trae dos correcciones a lo que la
> propia fase 1 dejó dicho — las dos salieron de medir, no de repensarlo.

## 1 · El censo, un día después: **12 → 11**, y el que falta lo dice todo

Mismo instrumento (blobs, no árbol de trabajo), población declarada: **1.700 ficheros rastreados**.

| | ayer (fase 1) | hoy |
| --- | --- | --- |
| `public/dashboard/js/` | 10 | **9** |
| `src/modules/products/domain/products.service.ts` | 1 | **1** |
| `docs/legal/fuentes/aeat-errores.properties` (declarado `-text`) | 1 | 1 |

**El que falta es `settingsView.js`**, y desapareció **hoy**: la sesión 1 se lo encontró
conflictuando entero al mergear `main` y lo resolvió tomando la versión de `main` y reaplicando sus
cuatro cambios encima. Al hacerlo, el blob quedó en LF.

> **Estos ficheros no se están arreglando: se están cobrando.** Cada uno sale de la lista el día que
> le cuesta media hora a alguien. Van 12 → 11 a ese precio.

### El criterio de «texto», y por qué no hace falta lista de binarios

El guard no clasifica por extensión: **un blob es texto si no contiene ningún byte NUL**. Medido
sobre los 1.700: ese criterio deja fuera los 213 PNG/PDF/iconos que contienen CR por casualidad **y
también** `estructura.txt` y `estructura-completa.txt`, que son **UTF-16LE** (BOM `FF FE`, salida de
PowerShell) y por eso están llenos de NUL. Cero acusaciones en falso, sin enumerar nada.

## 2 · 🔴 CORRECCIÓN A LA FASE 1: el daño no es el diff, es el MERGE

La fase 1 midió que un cambio de una línea produce un diff de una línea incluso en estos ficheros, y
concluyó **«no hay daño diario»**. El diff estaba bien medido; **la conclusión estaba mal**, porque
midió la operación equivocada. El daño aparece cuando **dos ramas tocan el mismo fichero desde
editores distintos**, que es lo que pasó hoy:

| | rama A (editor guarda LF) | rama B (editor guarda CRLF) | al mergear |
| --- | --- | --- | --- |
| **hoy** (blob CRLF, sin reglas) | 168 ↔ 168 | 208 ↔ 208 | 🔴 **CONFLICTO** |
| solo renormalizado | **1 ↔ 1** | 376 ↔ 376 | 🔴 **CONFLICTO** |
| renormalizado **+ `.gitattributes`** | **1 ↔ 1** | **1 ↔ 1** | ✅ limpio |

Medido en repos desechables del scratchpad con el contenido REAL de `templatesView.js` y ediciones
**por número de línea** — no por búsqueda de texto: el primer intento usaba `replace('use strict')`,
que **no casaba con el fichero**, y producía «un cambio» que era solo la conversión de saltos. Un
vector que no cambia nada mide otra cosa.

**El conflicto de la fila 1 cubre el 89 % del fichero** (337 líneas de 377). Eso es «conflictuando
entero», con número.

## 3 · 🔴 LA FILA 2 ES EL HALLAZGO: renormalizar SOLO no arregla nada

Con el blob ya en LF pero sin reglas en el repo, **el primer commit desde un editor de Windows lo
devuelve a CRLF entero** (376 ↔ 376) y el conflicto vuelve. La renormalización sin `.gitattributes`
es un arreglo de una vez que se deshace solo — exactamente lo que el encargo excluía.

## 4 · Y `* text=auto` NO basta, por un `\r\r\n`

La fase 1 ya vio que 10 ficheros llevan un CR suelto y que git los clasifica `-text`. Lo que faltaba
era **qué son esos CR** y **qué le hacen al arreglo**:

```
  <div class="modal" style="max-width:480px">\r\r\n        <div class="modal-body">\r\n
                                             ↑↑
                            CR CR LF: el fichero se convirtió DOS VECES
```

Es la firma de una doble conversión, y tiene una consecuencia que decide el ticket: **el filtro de
git no es idempotente sobre `\r\r\n`**. Cada pasada se come un CR — `\r\r\n` → `\r\n` → `\n` — así
que un fichero normalizado una vez **vuelve a cambiar en el commit siguiente**. Medido en el
laboratorio, con el contenido real:

| `.gitattributes` | fichero con `\r\r\n` | el mismo, con los CR ya quitados |
| --- | --- | --- |
| `* text=auto` | 🔴 no lo toca (lo ve binario) | ✅ converge e idempotente |
| `*.js text eol=lf` | 🔴 converge **no**, idempotente **no** | ✅ converge e idempotente |

**Por eso la renormalización quita TODOS los CR**, no solo los que forman pareja. Son 1-2 bytes por
fichero, dentro de una plantilla HTML, invisibles al render — y `git diff --ignore-all-space` sigue
saliendo vacío, que es el control negativo que exigía el ticket.

## 5 · El mecanismo, y el orden importa

```gitattributes
* text=auto          ← PRIMERO: en .gitattributes manda la ÚLTIMA línea que casa
*.js text            ← EXPLÍCITO: `text=auto` se rinde ante un CR suelto, y en silencio
…
docs/legal/fuentes/aeat-errores.properties -text   ← al final, para que gane
```

El `text` explícito por extensión no es cinturón y tirantes: **es lo que impide que el arreglo se
apague solo**. Si mañana alguien vuelve a colar un `\r\r\n`, con `text=auto` a secas git decidiría
que el fichero es binario y dejaría de normalizarlo **sin decir nada**. Con `text` explícito, la
detección no participa.

## 6 · El control que pidió el fundador, y por qué el primero salió hueco

> *un fichero de esa carpeta editado desde Windows y desde Linux produce el MISMO blob*

Se mide con `git hash-object --stdin --path=<ruta>` sobre el mismo contenido en CRLF y en LF.

🔴 **El primer intento dio verde por el motivo equivocado.** Esta máquina tiene
`core.autocrlf=true` a nivel *system*, así que la igualdad la producía **la configuración del
ordenador**, no las reglas del repo — que es justo lo que el ticket quiere quitar de en medio. El
instrumento del guard lleva **`-c core.autocrlf=false`**: así solo `.gitattributes` puede hacer que
los dos blobs coincidan.

Con la config neutralizada, los tres casos ANTES del arreglo:

| ruta de prueba | ¿mismo blob? | qué demuestra |
| --- | --- | --- |
| `public/dashboard/js/x.js` | 🔴 **no** | el defecto, sin la máquina de por medio |
| `scripts/algo.sh` | ✅ **sí** | **control positivo**: el instrumento SABE dar igualdad — un «no» suyo es un dato, no una avería |
| `docs/legal/fuentes/aeat-errores.properties` | 🔴 **no**, y así debe seguir | el fichero sellado byte a byte sigue protegido |

## 7 · Lo que toca este PR — para elegir el momento de mergear

**10 ficheros de contenido**, todos solo en sus finales de línea:

```
public/dashboard/js/   aiQuoteAssistant · customerDetailView · jobDetailView · plansView
                       productsView · providersView · quotesView · teamView · templatesView
src/modules/products/domain/products.service.ts
```

⚠️ **Cualquier rama viva sobre uno de esos diez conflictuará entero al mergear esto.** No hay forma
de evitarlo: es el mismo mecanismo del §2, una vez y en sentido contrario. Lo que sí puede elegirse
es CUÁNDO. Los otros tres ficheros (`.gitattributes`, el guard y esta entrada) no chocan con nada.

## 8 · Lo que NO toca

Ningún fichero generado · el camino de emisión · `prisma/schema.prisma` · `public/index.html` ·
la configuración de git de ninguna máquina — el arreglo vive en el repo, que es el punto entero ·
`aeat-errores.properties`, protegido por su `-text` y con control negativo en el guard.

---

# SCRUM-480 (fase 3) · Lo que renormalizar NO cura: la ceguera

**Fecha:** 13-ago-2026 · **Carril:** higiene → **urgente** · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `d17e54260a953bcb19cd3382a6577d8b312f2d28` · 2026-08-13T11:47:25+02:00

> La fase 2 arregló **los blobs** y el merge. Esta fase ataca lo que la sesión 1 destapó y que la
> fase 2 **no toca**: que el CRLF **ciega guards en silencio**.

## 1 · 🔴 EL AGUJERO DE MI PROPIA FASE 2

Los guards no leen los blobs: leen **el árbol de trabajo**. Y el árbol está en CRLF **entero**, sin
que importe lo que diga el blob, porque `core.autocrlf=true` convierte al hacer checkout:

| fichero (blob en LF desde siempre) | en disco hoy |
| --- | --- |
| `src/app.ts` · `public/dashboard/js/app.js` · `scripts/_db-guard.mjs` · `tests/scrum409-…mjs` | **CRLF** |

**Renormalizar los blobs no quita ni un `\r` de lo que un guard lee.** La fase 2 cerró los
conflictos de merge y dejó la ceguera intacta.

## 2 · La medición que decide, hecha sobre el repo y reversible

`.gitattributes` declaraba `*.ts text`. Se cambió a `*.ts text eol=lf`, se borró `src/app.ts`, se
recuperó con `git checkout --` y se miró el byte:

```
*.ts text eol=lf   →  src/app.ts en disco: LF   ✅  (52.059 bytes)
*.ts text          →  src/app.ts en disco: CRLF 🔴
```

Y se dejó como estaba: `git status` limpio. **`eol=lf` es lo que quita la causa** — `text` a secas
solo arregla lo que se guarda, no lo que se lee.

## 3 · El censo de hermanos: **3.203 regex ejecutadas, 18 sensibles**

Derivado, no enumerado, y **empírico**: cada literal de regex del árbol (`tests`, `scripts`, `src`,
`public` — 908 ficheros) se EJECUTA sobre el mismo texto en LF y en CRLF, y sobre cada línea con y
sin `\r` final. No se juzga el patrón: se mide el comportamiento.

### 🔴 Dos veces me corrigió el instrumento a mí

**① El control positivo cazó que yo tenía mal el diagnóstico.** Metí como caso conocido
`/\/\/.*$/gm` —con `m`, tal cual lo escribí— y el detector dijo que era **sana**. No era un fallo
del detector: **con `m`, `$` SÍ casa antes de un `\r`**, porque CR es un terminador de línea para el
motor de regex. El defecto no es «`$` con CRLF»: es **`$` SIN `m` sobre una línea que arrastra el
`\r`**, que es exactamente lo que produce `split('\n')`. Sin ese control habría censado la forma
equivocada y habría acusado a un montón de guards sanos.

**② El primer criterio marcaba 201 y casi todas eran correctas.** Marcaba «se comporta distinto», y
`/\s+/`, `/\D/g` o `/[^A-Za-z]/g` se comportan distinto porque **`\r` ES un espacio y NO ES un
dígito**: casan MÁS, y no pasa nada. Lo que ciega un guard es lo contrario. Criterio final:
**casar MENOS bajo CRLF**. De 201 a 18.

> Un detector que acusa a los sanos no se corrige: se desactiva. Y entonces no vigila nadie.

## 4 · Los seis del patrón exacto, leídos uno a uno

El recuento se contrasta; **la lista se lee**. De las 18, seis son la forma del defecto (`//.*$` y
compañía sobre una línea). Lo que decide no es la regex: es **de dónde sale la línea**.

| dónde | cómo parte el fichero | veredicto |
| --- | --- | --- |
| `tests/scrum372-un-dato-un-nombre.test.mjs:153` | `split(/\r?\n/)` | protegido **a mano** |
| `tests/_afirmaciones-derivadas.mjs:64` | `split(/\r?\n/)` | protegido **a mano** |
| `src/.../legalPages.routes.ts:21` | `split(/\r?\n/)` | protegido **a mano** |
| `scripts/_pares-del-schema.mjs:66` | `replace(/\r\n/g,'\n')` + `split('\n')` | protegido **a mano** |
| `scripts/_prisma-procedencia-guard.mjs:112` | `replace(/\r\n/g,'\n')` + `split('\n')` | protegido **a mano** |
| **`tests/scrum409-…:77`** | **`split('\n')` desnudo** | 🔴 **el que estuvo ciego** |

**Cinco de seis se acordaron. Uno no.** Eso no es mala suerte: es una **prohibición sin mecanismo**
—la protección vive como costumbre, y una costumbre falla una vez de cada seis—. La familia de
SCRUM-118/124/172/187.

**El 409 ya no está ciego**, y no lo arreglé yo: la sesión 1 (SCRUM-509) lo reescribió **por AST**,
así que los comentarios ya no participan por construcción, en vez de quitarse con una regex que
había que acertar. Comprobado leyendo el fichero mergeado, no supuesto.

## 5 · El mecanismo

**① `eol=lf`** en las extensiones de fuente. Quita la causa: si el disco no tiene `\r`, ninguna
regex puede cegarse por él, ni las 18 de hoy ni las que se escriban mañana.

**② Un guard de COMPORTAMIENTO**: leer ficheros del árbol y exigir que no tengan ni un `\r`. No
comprueba `.gitattributes` —eso es la causa— sino **el efecto**: si el día de mañana alguien cambia
una regla, o clona con otra configuración, el guard cae. Con su suelo: se le da un búfer con `\r`
para comprobar que sabría verlo.

⚠️ **Lo que esto NO arregla, y conviene decirlo**: `eol=lf` gobierna el checkout, no lo que escribe
un editor. Un editor configurado para guardar CRLF seguiría produciendo `\r` en su disco hasta el
siguiente checkout. Lo que sí queda garantizado es lo que el repositorio entrega y lo que se
commitea.

## 6 · Lo que toca esta fase

`.gitattributes` (14 reglas pasan de `text` a `text eol=lf`) · el guard · esta entrada.
**Ningún fichero de contenido**: los blobs ya se renormalizaron en la fase 2, `ca983956`.

⚠️ Al mergear, el primer `git checkout` de cada quien **reescribe su árbol de trabajo a LF**. Los
blobs no cambian y `git status` sigue limpio: lo que cambia es lo que hay en el disco.
