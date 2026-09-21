# SCRUM-1070 · CEREBRO v1: dónde se van los tokens, y la primera palanca

**Medido contra:** `origin/main` = `b6cde0517649d991a1b08eabb50017a81a03acfb` · 2026-09-21T17:39:00Z

Hora de GitHub (`gh api -i zen`). S5 (`s5-21h`); contexto medido al escribir: 195.000, tope 250.000.

## Lo medido (población declarada)

Instrumento: `gasto-arranque.mjs` (`sesiones`, `resultados`, `arranque`) y dos scripts sueltos sobre los mismos jsonl. Ventana 30 h, 63 sesiones con actividad, 55 con ≥ 40 turnos: 7.583 turnos, Σcontexto 1.839 M, 0 jsonl ilegibles, 0 líneas rotas.

* **El coste es contexto × turnos.** La caché leída es ~78 % del coste ponderado (pesos SUPUESTOS: input 1 · cache-write 1,25 · cache-read 0,1 · output 5), así que una sesión cuesta como el CUADRADO de su longitud. **La mediana de sesión ACABA en 337k (máx 656k); 38 de 55 pasan de 300k y 52 de 55 de 200k.** A las 17:5xZ, de 13 sesiones vivas, 9 pasaban de 200k y 6 llevaban más de 2 h paradas (caché fría).
* Reparto ponderado (30 h, 54 sesiones ≥ 40 turnos): suelo fijo 19,9 % · lectura del arranque 14,2 % · lo que devuelven las herramientas 35,2 % (Read 18,8 %, PowerShell 12,1 %, Grep 2,0 %, Jira 0,7 %) · resultados ≥ 6 KB = 20 %.
* **La norma «ningún Read entero > 6 KB» (SCRUM-996) funciona:** Reads enteros > 6 KB, 211 en 27 h antes de las 14:47Z (3,57 MB) → 5 en 2,7 h después (123 KB), unas 65 % menos por hora. Antes, 48 % de los bytes de Read eran lecturas enteras (439).
* **Subagentes:** 14 llamadas en 30 h; a ~700k tokens cada una son ~0,5 % del Σcontexto. Un contrato de subagentes no compensa código.
* **SCRUM-996 (U8):** sesiones nacidas desde las 14:47Z (7, ≥ 8 turnos): U8 mediano 94.871, lectura 16,5 % → **sigue sin cumplir** (objetivo 90.000 y 10 %). Qué explica que unas lean el doble: **todas leen lo mismo del arranque (`norma.mjs`, 24,6 KB ≈ 11,4k tokens)**; la diferencia es la TAREA. `s4-21f` (81,5k) no leyó ni Jira ni docs grandes en sus 8 primeros turnos; `sd-21b` (104k) leyó dos veces `CRM.md` + `CONTA.md` (14 KB + 10 KB) y un JQL de 22,8 KB; `s2-21h` (97k) dos `getJiraIssue` (15,7 KB); `s0-21h` (89k) un doc de 15 KB.

## Palancas, por ahorro/coste (payback en relevos de sesión)

| # | palanca | ahorro (medido o simulado) | coste | payback |
| --- | --- | --- | --- | --- |
| 1 | **Relevo a 200k tras una entrega, vigilado** | Σcontexto **−43 %** simulado (64 sesiones: 1.870 M → 1.064 M, +97 relevos; sobre las 13 vivas, −44,7 %) | HECHO: `gasto-arranque.mjs vivas` (~90 líneas, 7 tests, 4/4 mutaciones) | < 1 relevo |
| 2 | Arranque por puesto (A19 son 6,4 KB de 22 KB y es del lanzador) | ~4,5k tokens por relevo ≈ 1,6 % de una sesión; vale más con más relevos | bajo (perfil en `norma.mjs`) | ~3 |
| 3 | Adelgazar `MEMORY.md` (16,7 KB; 41 líneas > 220 B; ~10 «histórico») | 0,5-2 % (va en el suelo de TODAS las sesiones) | ~0, pero es memoria compartida: lo decide el orquestador | inmediato |
| 4 | `estado.mjs` (40 líneas) | ~3k tokens por arranque ≈ 1 % | medio | ~8 |
| 5 | `cerebro.mjs dónde` (índice `ruta:línea`) | techo 3-4 % (Grep es el 2 % del coste; lecturas parciales de ficheros gigantes: `quotesView.js`, 86 lecturas, 432 KB) | el mayor (índice + mantenimiento) | > 15 |
| 6 | Contrato de subagentes | ~0,5 % | solo regla (A25), sin código | — |
| 7 | Tareas mecánicas a un modelo barato | **no medible**: no hay coste por modelo en los jsonl | — | — |

**Construido: la 1.** `node scripts/equipo/gasto-arranque.mjs vivas [--horas 2] [--umbral 200000] [--simular 200000]` → una línea por sesión viva (contexto, turnos, minutos parada, RELEVAR / caché fría), EXIT 1 si alguien pasa del umbral, EXIT 2 si no pudo mirar (cero sesiones no es «nadie pasa»).

## Lo que NO se ha medido, y el guardarraíl

* La simulación es de **Σcontexto**, no del coste ni de la **eficiencia**: el arranque tras relevo (85k) es un SUPUESTO y el relevo real solo ocurre en un punto seguro (A19), así que el efecto real está entre el simulado a 200k (−44 %) y a 250k (−35 %).
* **Un recorte que empeore los guardarraíles no vale (A18).** A medir a los 3 días de aplicar el relevo a 200k, con las mismas definiciones de antes: rojos de CI por PR mergeado y correcciones tras entregar (`gh`), y entregas visibles por millón de tokens. Si suben, se deshace.
* El relevo NO lo hace este código: lo hace el orquestador con `vivas` cada turno. Que `sesion.mjs contexto` avise al pasar de 200k vive en `AppData\Local\yaqu-equipo` (pide sí escrito): no se toca aquí.

## Errores propios

1. Mi primer censo agrupó los comandos de PowerShell por su prefijo y salió basura (`FORCE_COLOR` ocupa los 754 primeros): no lo uso para nada.
2. Esta sesión ya estaba en 191k a mitad del encargo, es decir, en el umbral que propone: la norma se la ha aplicado a sí misma.

## Ficheros

`scripts/equipo/gasto-arranque.mjs` (subcomando `vivas`, USO), `tests/scrum1070-vivas-relevo.test.mjs`, este apartado. Commit del código: `7d98023bc9c8ad763203e20ff5062e73c84224df`.
