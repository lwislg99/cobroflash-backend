# SCRUM-942 · el mecanismo de la A22 — bytes de control literales en el árbol

**Fecha:** 22-sep-2026 10:22Z · **Carril:** S5 · instrumentos
**Medido contra:** `origin/main` = `b5b229d7b6f7b78b24366696f6f84c25748ee27f` · 2026-09-22T08:22Z
**Rama:** `scrum-942-bytes-de-control` · **Worktree:** `wt-s5-942`

## ① El defecto, medido HOY (no reciclado del ticket)

Censo por extensión sobre `git ls-files` (nunca `git grep -I`: un NUL marca el fichero como
binario para git y `-I` lo salta — justo el caso que motiva el ticket): **3231 ficheros de texto
de 3720 rastreados, 12 con bytes de control** (el ticket citaba 11 el 18-sep; `main` se movió).

| fichero | bytes | qué es |
|---|---|---|
| `tests/scrum806-el-pdf-del-portal.test.mjs` | 1× NUL | `const MARCA = '<NUL>'` — el marcador del ticket |
| `tests/scrum807-esquemas-del-href.test.mjs` | 4× NUL | mismo patrón, otro fichero |
| `tests/_censo-tickets.mjs` | 4× US (0x1F) | separador de campo en un `--format` de `git log` |
| `docs/master/evidencias/SCRUM-955/censo-sif1.mjs` | 1× NUL | **no estaba en el ticket** — mismo patrón MARCA, en un script vivo de evidencias (con instrucciones de uso, no un volcado congelado); se arregla igual |
| `docs/evidencias/scrum883/{C1,C3}-pdf-{justificante,presupuesto}.txt` | 1× FF (0x0C) c/u | volcado de texto de un PDF real — legítimo, EXENTO |
| `estructura.txt` / `estructura-completa.txt` | ~580K× NUL c/u | UTF-16LE (BOM FF FE, salida de PowerShell) — ya declarado en SCRUM-480/`_censo-eol.mjs`; EXENTO |
| `docs/master/SCRUM-428.md` | 3× BS (0x08) | el documento CUENTA el incidente de un `\b` que entró como retroceso — el byte es la prueba del relato; EXENTO |
| `docs/master/SCRUM-484.md` | 2× BS (0x08) | mismo tipo de incidente narrado (heredoc que se comió barras invertidas); EXENTO |

## ② El arreglo — los cuatro ficheros vivos

`\x00` / `\x1f` en vez del byte literal, con un script de sustitución byte a byte (no reescritura
de texto: evita el mismo problema que causó el defecto — `\uXXXX` tecleado por una sesión aterriza
como el carácter, no como el escape). Comportamiento verificado IDÉNTICO antes/después:

- `scrum806` + `scrum807`: **9 pass · 0 fail** antes y después.
- `_censo-tickets.mjs`: **1 pass · 0 fail** antes y después.
- `censo-sif1.mjs`: `node --check` limpio (no tiene test propio; es una evidencia ejecutable).

⚠️ **Sobre «`git diff --numstat` da números, no guiones»**: es cierto para diffs FUTUROS del
fichero ya arreglado. El diff de ESTE commit (viejo blob con NUL → nuevo blob sin él) sigue
saliendo `Binary files … differ`, porque git decide binario si CUALQUIERA de los dos lados lo es.
Es inevitable en la transición y no invalida el arreglo: lo que importa es que el blob NUEVO,
desde ahora, ya no lleva NUL.

## ③ El guard — `scripts/_censo-bytes-control.mjs` + `tests/scrum942-bytes-de-control-en-el-arbol.test.mjs`

- Filtra por **extensión** (lista cerrada), nunca por `git grep -I`.
- Falla si un fichero de texto lleva bytes **0-8, 11, 12, 14-31 o 127** (TAB/LF/CR fuera).
- **EXENTOS declarados y fechados** (8 hoy, ver tabla arriba) — nunca silenciosos.
- **12 tests**: el clasificador puro (cubre exactamente lo que dice, y SOLO eso: negativo en
  32-126) · SUELO (población > 500 ficheros, referencia 3231) · **EL ROJO que decide**: un `.mjs`
  sembrado con ESC cae, y uno sembrado con NUL también — este último con la TRAMPA medida en el
  ticket ejercida de verdad: `git init` + `git add` en un directorio temporal, confirmar que
  `git diff --cached --numstat` da `- -` (control: la trampa está sembrada) y que `git grep -Il .`
  **no encuentra nada** (la vía prohibida, mudo) mientras el detector propio SÍ ve el byte ·
  POSITIVO (el árbol de hoy da cero hallazgos) · la lista de EXENTOS no crece sola (compara contra
  las 8 exactas) · las cuatro víctimas ya no necesitan exención · NEGATIVO (TAB/LF/CR no caen,
  PNG no entra en la población por extensión, con control de que el detector SÍ vería el mismo
  byte si un PNG lo trajera — lo excluye el filtro, no la incapacidad).

## Medido

`npm run guards:entrada`: 11 guards, verde. `node -e censarBytesDeControl('.')`: 3231 vistos, 0
hallazgos.

## Lo que NO se ha hecho

- ⛔ No se ensancha a TAB/LF/CR ni a binarios de verdad.
- ⛔ `docs/master/SCRUM-428.md` y `SCRUM-484.md` no se tocan: el byte que llevan es la evidencia
  del incidente que narran, no un descuido nuevo.
- ⛔ El guard no se conecta todavía a ningún workflow de CI aparte de `npm test` (que ya lo corre
  por el glob `tests/*.test.mjs`): no hacía falta tocar `.github/workflows/`.
