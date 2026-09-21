# SCRUM-958 · La norma A22 era ciega al BOM

**Medido contra:** `origin/main` = `c5d642fe889af753ef6d6de27aabc84bdc3fc79b` · 2026-09-20T19:56:03Z
**Rama:** `scrum-958-norma-ciega-al-bom` · **Carril:** consultoría (Sesión 0) · **Encargo:** orquestador, 20-sep-2026
**Alcance:** solo docs. `docs/equipo/00-normas-comunes.md` (A22.1 y A22.2 nuevos) y este expediente.

⏱ Horas de GitHub (cabecera `Date:` de `gh api -i zen`).

## Qué pedía el ticket, y qué se ha hecho

Dos cosas: que la norma **diga qué bytes cubre y cuáles no**, y que su **control positivo use
`[char]27` y no `` `e ``**. Las dos están. Y como A23 nº 1 manda **barrer antes de escribir una
prohibición**, se ha barrido el árbol: no estaba limpio.

**Es un cambio de documentación de una norma, sin dinero, sin fiscal y sin esquema**, así que va con
el rigor que pide el cambio (norma de la tanda): un rojo que falla hoy, el arreglo, su control
positivo, y este expediente corto. No lleva método largo ni mutantes, y eso es deliberado.

## 1 · El rojo, medido hoy

### 1.1 · El recuento de A22 no ve el BOM

    Set-Content -Path $f -Value '{"a":1}' -Encoding utf8       # PowerShell 5.1
    [IO.File]::ReadAllBytes($f) | Select-Object -First 3       → 239 187 191
    recuento de A22 sobre ese fichero                          → 0        🔴 CIEGO

El filtro de A22 acepta los bytes `< 32` salvo 9/10/13, más el 127. **Los tres del BOM son
239, 187 y 191: los tres ≥ 32.** Pasan enteros.

**SUELO —y esto es lo que separa «ciego» de «roto»—:** el **mismo** recuento sobre el **mismo**
fichero con un ESC añadido devuelve **1**. El instrumento funciona; lo que no ve es *eso*.

**Y hace daño de verdad**, no es cosmética:

    node -e "JSON.parse(fs.readFileSync(f,'utf8'))"   con BOM → revienta: Unexpected token
                                                      sin BOM → OK          ← control

### 1.2 · El control positivo de la propia norma no sembraba nada

    PowerShell 5.1:   "`e"      → la LETRA «e», código 101.   (el escape `e llegó en PowerShell 6)
                      [char]27  → ESC, código 27.   ✅

    fichero sembrado con  `e        → el recuento dice 0     🔴 indistinguible de «está ciego»
    fichero sembrado con [char]27   → el recuento dice 1     ✅

Éste es el hallazgo que más vale del ticket, porque **su síntoma es un verde**:

    🔒 Un control positivo que no llega a sembrar nada da el MISMO número que el fallo que busca.

## 2 · El barrido del árbol: 14 ficheros con BOM, y uno es el máster

**Población declarada:** `git ls-files` → **3.415** ficheros · **3.415 leídos** · **0 ilegibles**.
Se leen los 3 primeros bytes de cada uno.

**Resultado: 14 empiezan con `EF BB BF`.**

- 🔴 **`docs/YAQU_MASTER.md`** — la única fuente de verdad.
- 13 ficheros de evidencias: `docs/master/evidencias/scrum907b/` (2),
  `docs/master/evidencias/scrum935/` (8), `docs/master/evidencias/scrum954/` (3).

**Que el máster lo lleve NO es cosmético, y está medido:**

    primera línea de YAQU_MASTER.md, primer codepoint → 65279 (BOM)
    /^# /.test(primera línea)                         → false      🔴
    cabeceras de nivel 1 que sí casan ^# en el resto  → 30
    SUELO: la primera línea de un .md sin BOM         → true

O sea: **cualquier guard anclado a la primera cabecera del máster está ciego a ella**, y los otros 30
anclajes funcionan, que es lo que hace el fallo difícil de ver.

⚠️ **Limpiar esos 14 no entra en este ticket y no se ha hecho.** Son ficheros de evidencias de otros
tickets y el máster; tocarlos lo reparte quien coordina. Queda **reportado**, que es lo que pedía la
norma de la tanda: no se abre ticket por cada hallazgo.

## 3 · El arreglo

En `docs/equipo/00-normas-comunes.md`, dos apartados nuevos colgando de A22:

- **A22.1 · Qué cubre ese recuento y qué NO.** La tabla de lo que no ve (BOM y ≥ 128), la medición de
  arriba con su suelo, la línea que comprueba el BOM, la orden de escribir con
  `[IO.File]::WriteAllText` y nunca con `Set-Content -Encoding utf8`, y el estado real del árbol.
- **A22.2 · El control positivo se siembra con `[char]27`, NUNCA con `` `e ``.**

## 4 · El control positivo del arreglo, y una tercera trampa que salió sola

El fichero que se acaba de editar, medido con la norma que acaba de escribir:

    POBLACION: 48.990 bytes
    primeros 3 bytes: 35 32 78          ← «# N», no hay BOM
    recuento A22: 0
    SUELO: esos mismos bytes + un ESC → 1
    CR presentes: 0                      ← LF puro

🔴 **Y al primer intento ese recuento dio 0 sin haber leído nada.** `[IO.File]::ReadAllBytes` usa el
directorio del **proceso**, no el `$PWD` de PowerShell: tras un `cd`, la ruta relativa lanzó, `$b`
quedó vacío y `(@() | Where-Object {…}).Count` devolvió **0** — que se lee exactamente igual que
«fichero limpio». Es el mismo fallo del ticket una capa más arriba, y por eso el recuento va ahora
con **`POBLACION` al lado** y con **ruta absoluta** en la propia norma.

    🔒 Un recuento sin población no dice que no haya nada: dice que no se contó nada.

## 5 · SCRUM-958b · El BOM del máster, quitado (20-sep-2026)

Decisión del orquestador tras verificarlo él mismo, y la asume por escrito: **no es un cambio de
contenido, es una reparación de tres bytes.** No toca una palabra, no borra nada —regla 35 intacta— y
devuelve la vista a un ancla que hoy no ve la fuente de verdad del proyecto. **Los trece de evidencias
NO se tocan**: son de tickets de otras sesiones, son inertes, y limpiarlos de paso abriría un frente
que nadie ha pedido.

**Cómo se hizo, que es la mitad del asunto:** se reescribieron los **bytes** tal cual
(`[IO.File]::WriteAllBytes` sobre `$b[3..fin]`), **sin reinterpretar el texto**. Así no hay
reencodado, ni normalización de finales de línea, ni ninguna otra cosa capaz de cambiar algo por el
camino.

**Antes y después, medido:**

| | antes | después |
|---|---|---|
| bytes | **494.324** | **494.321** (exactamente **−3**) |
| primeros 6 bytes | `239 187 191 35 32 89` | `35 32 89 65 81 85` |
| sha256 del contenido **desde el byte 4** | `87B5CD1F…67431D` | *(del fichero entero)* `87B5CD1F…67431D` |

**Los dos hashes son idénticos**, así que el contenido a partir del cuarto byte es el mismo bit a bit.
Y lo corrobora git por otro camino, que es una segunda sonda independiente:

    git diff --numstat  →  1  1  docs/YAQU_MASTER.md      ← UNA línea, la primera. Nada más.

**El arreglo funciona, con su control negativo:**

    docs/YAQU_MASTER.md             primer codepoint 35     casa el ancla de cabecera: TRUE
                                    primera línea: «# YAQU — DOCUMENTO MAESTRO v5.3 UNIFICADO»
    CONTROL NEGATIVO, un fichero
    de evidencias que SIGUE con BOM  primer codepoint 65279  casa: FALSE

El control negativo importa más que el positivo: demuestra que la comprobación **sabe decir que no**,
y por tanto que su `TRUE` de arriba significa algo.

## 6 · Lo que NO se ha hecho, y por qué

- **No se ha extendido el guard de A22** (SCRUM-942) para que cace BOMs. El ticket pedía la norma, y
  extender el guard exige decidir antes qué se hace con los que ya están — si no, nacería rojo,
  que es justo lo que prohíbe A23 nº 1.
- **No se han limpiado los 13 ficheros de evidencias** (§2), por decisión del orquestador: son de
  otros tickets e inertes. El guard va **detrás** de ese barrido, no delante.
- **No se han buscado los bytes ≥ 128 mal codificados**, que es el otro borde que A22.1 declara y que
  nadie ha medido todavía.
