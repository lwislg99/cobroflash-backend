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

## 1070b · Norma A25 y relevo a 200k (21-sep-2026)

Añade la sección A25 «Eficiencia y gasto» a docs/equipo/00-normas-comunes.md, la incluye en 
orma.mjs --arranque (ahora 14 secciones + índice de 11), baja el relevo de A19 de 300k a 200k (decisión del orquestador; también en orquestador.md, orquestador-autonomo.md, 	raspaso.md) y UMBRAL_CONTEXTO de sesion.mjs (autorización escrita del fundador; la copia de AppData la refresca el orquestador). Tests: scrum996-suelo-de-arranque (14) y scrum899c-relevar-y-contexto (200_001/199_999).
Base medida: origin/main tras el merge de #1618, 0252a54dd0f7495aec24de6d8cb41691c5520a62 (antes del commit de registro).

## 1070c · La palanca 7, medida de verdad: `yaqu-ruta` funciona y casi nadie lo usa (19-oct-2026)

Pedido DIRECTO del fundador (por el orquestador): ¿el mod que manda tareas fáciles a un modelo más
barato «está funcionando de verdad»? La palanca 7 de arriba decía «no medible: no hay coste por
modelo en los jsonl» — eso seguía siendo cierto, pero SÍ se puede medir si el mod se usa y si sabe
hacer su trabajo cuando se le pide. S5, sin tocar `.claude/`, sin modelos de sesiones vivas, sin
construir el arreglo (lo pidió así el orquestador: medir primero, cambiar el mecanismo después).

### Qué copia carga
`mods-yaqu/yaqu-ruta/hooks/register.js` (marketplace `directory`), confirmado por evidencia directa
y no por analogía con el caso de `yaqu-sala` (SCRUM-1357h): el formato de
`C:\Users\Admin\.claude\yaqu-ruta-bitacora.txt` (campos `turno=`, `enFirme=`, `claves=…`) sólo existe
en ese fichero (12.865 B); la copia de `…\plugins\cache\yaqu\yaqu-ruta\0.1.0\…` (6.145 B) no tiene
ni `BITACORA` ni `apuntarDecision` — es imposible que haya escrito esas líneas.

### Control positivo: el mod SABE registrar un `pedido` no nulo
`claude plugin test .` en `mods-yaqu/yaqu-ruta` → **8/8 verde**. Y, aparte de los tests del propio
plugin, llamada directa a la función exportada:
```
leerRuta("ERES LA SESION 1. Arregla esto.")       → {"modelo":null, "motivo":"el encargo no lleva línea RUTA:"}
leerRuta("RUTA: haiku\n\nCuenta ficheros.")        → {"modelo":"claude-haiku-4-5-20251001", "corto":"haiku", ...}
leerRuta("RUTA: sonnet\n\nAlgo mediano.")          → {"modelo":"claude-sonnet-5", "corto":"sonnet", ...}
leerRuta("RUTA: opus\n\nAlgo dificil.")            → {"modelo":"claude-opus-5-5", "corto":"opus", ...}
```
**Nunca null cuando la línea existe.** Los `null` de la bitácora son por NO USO del mod, no por un
fallo de escritura: el diagnóstico del fundador se sostiene.

### Por qué «1066 líneas, todas null» no es la foto de hoy
`yaqu-ruta-bitacora.txt` ROTA por diseño (el propio código: pasa 200.000 caracteres → se recorta a
los últimos 100.000). Medido a las ~13:00Z del 19-oct: 577 líneas, y **333 (58 %) llevan
`pedido="claude-sonnet-5"`**, concentradas en 16 de 33 encargos distintos (por `turno=0`), todas
entre las 11:26Z y las 12:03Z de hoy — una ráfaga de `RUTA: sonnet` escrita HOY, no la foto
histórica. Un fichero que se recorta solo no sirve para medir un histórico.

### La fuente que SÍ persiste, y la cifra pedida
`~/.claude/jobs/*/state.json`, campo `intent` (el encargo literal de cada sesión lanzada, con
`createdAt`). 506 carpetas, 502 con `intent` legible, del 17-sep-2026 a hoy:

| medida | cifra |
| --- | --- |
| encargos reales con línea `RUTA:` | **8 de 502 (1,6 %)** — 7 pedían `sonnet`, 1 `haiku`, 0 `opus` |
| encargos con `RUTA-AGENTES:` | 0 |

**1,6 % es el SUELO del ahorro si "aplicarla por defecto" significara automatizar exactamente esto
(que el modelo pedido se use sin que nadie escriba la línea): es el mínimo seguro, porque son los
únicos casos con una señal explícita y verificada de que ese encargo cabía en un modelo más barato.**
No es la cifra de cuántos PODRÍAN haberlo hecho: eso exige clasificar el texto de los otros 494
encargos, y no hay ninguna señal de dificultad grabada hoy fuera de la propia línea `RUTA:` — `effort`
no se guarda en ningún `state.json` (comprobado sobre los 506). Clasificar por contenido es diseñar
un clasificador nuevo, que es cambiar el mecanismo: queda para la sesión que lo construya, con esta
cifra ya en la mano.

### El dato que de verdad manda sobre el gasto hoy: el lanzador, no el mod
Aparte de `yaqu-ruta`, el `--model` con el que se LANZA cada job (`respawnFlags`, mecanismo DISTINTO,
decidido por quien lanza antes de que la sesión arranque) ya reparte los 506 jobs así:

| modelo de lanzamiento | encargos | % |
| --- | --- | --- |
| opus | 322 | 63,6 % |
| sonnet | 117 | 23,1 % |
| sin `--model` (hereda el de por defecto) | 61 | 12,1 % |
| `opus[1m]` | 4 | 0,8 % |
| haiku | 2 | 0,4 % |

El 23,1 % que ya corre en sonnet **no es un ahorro que arreglar `yaqu-ruta` pueda sumar**: ya está
pasando, por el lanzador. La palanca real sobre el gasto está en el 63,6 % que se lanza en opus, y
saber cuántos de ésos eran mecánicos exige la misma lectura de intención que el párrafo de arriba
— no hecha aquí.

### Lo que NO se ha hecho (a propósito)
No se tocó `.claude/hooks/`, `.claude/settings.json`, ningún modelo de sesión viva, ni la bitácora.
No se clasificó ningún encargo por dificultad. No se cambió el camino por defecto de `yaqu-ruta`.
Eso queda para la próxima sesión de S5, con esta cifra ya medida.