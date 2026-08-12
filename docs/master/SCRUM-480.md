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
