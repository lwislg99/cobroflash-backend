# SCRUM-996 · bajar el suelo de arranque de cada sesión: `norma.mjs`, traspaso con tope y regla de lectura

**Medido contra:** `origin/main` = `320c7f2035067bf845e582373b63aba8c4fd6fa9` · 2026-09-21T14:19:36Z

21-sep-2026 14:19Z · `origin/main = 320c7f2035067bf845e582373b63aba8c4fd6fa9` · rama
`scrum-996-suelo-de-arranque` · escrito por la **Sesión 5** (puesto de automatización y eficiencia).

## El defecto, medido antes de escribir nada (PASO 0)

El fundador avisó de que el gasto no es sostenible. Sobre **44-46 sesiones con ≥ 40 turnos en 24 h**
(herramienta: `node scripts/equipo/gasto-arranque.mjs sesiones`, línea base de más abajo):

- **SUELO** (contexto del primer mensaje, antes de tocar nada): 54-59k tokens. Lo que se puede controlar dentro:
  `CLAUDE.md` del checkout, `MEMORY.md` (20,4 KB al medir) y la lista de skills; unos 35k son sistema de Claude Code.
- **LECTURA DEL ARRANQUE** (turno 8 menos turno 1): 43-67k en las sesiones de hoy. La de esta sesión, por herramienta:
  traspaso 9,4k · `CLAUDE.md` + ficha + normas 33,6k (normas ≈ 25k) · `orquestador-autonomo.md` 8,3k · fila §11bis 3,7k.
- **Peso**: suelo 23,8 % + lectura 16,9 % = **40,7 %** de todo el contexto procesado; con pesos de precio SUPUESTOS
  (escritura 1,25 · lectura 0,1 · salida 5) es el 34,5 % del coste, y la caché LEÍDA el 76 %. Contraste
  independiente: los `Read` de ≥ 6 KB son el 14,8 % del coste y la lectura de arranque salió el 14,5 %.
- **Los resultados de herramienta de ≥ 6 KB**: 582 de 7.455 (7,8 %) = 21,0 % del coste.

**Línea base con el instrumento ya entregado** (43 sesiones reales de hoy, antes de que ningún relevo use el arranque
nuevo): U8 mediano **102.405** (objetivo ≤ 90.000) · lectura/contexto **16,8 %** (objetivo ≤ 10 %) → `NO CUMPLE`, salida 1.

## Qué se entrega

| fichero | qué es |
|---|---|
| `scripts/equipo/norma.mjs` | imprime las normas por **secciones**. `--arranque`: las 13 de aplicación proactiva (A1-A4, A7-A9, A13, A14, A16, A19 hasta «Cuarta versión», A20, A24) + el índice de las otras 11. `norma.mjs A23` trae una al vuelo. Lee de `origin/main` y declara origen y sha256 en su primera línea; sin poder leer, sale 2 (nunca un subconjunto en verde). No copia las normas: la dueña sigue siendo la S0. |
| `scripts/equipo/gasto-arranque.mjs` | el instrumento de medida (antes vivía en el tmp del job, A8): `sesiones`, `arranque <nombre>`, `resultados` y `traspaso <sN>` (tope de 5 KB). Declara población y su `EXIT=` sale del mismo valor que `process.exit`. |
| `tests/scrum996-suelo-de-arranque.test.mjs` | 22 casos: el fichero real, secciones que faltan o cambian de título, A19 sin marcador, CRLF, jsonl FABRICADOS, el borde exacto de 5.120 B, bytes de control y BOM. |
| `tests/scrum723-guard-contra-su-base.test.mjs` | UNA entrada nueva en `INDIRECTAS_DECLARADAS` para `norma.mjs`, con su motivo (ver abajo). |
| `docs/equipo/orquestador-autonomo.md` | §5bis.2 (topes de traspaso y línea) y **§5bis.3bis**, con el bloque 2 del prompt para pegar. |

**Cifras del arranque nuevo.** El texto de las 13 secciones son 22.021 B de 51.780 B (43 %); la salida completa, con
cabecera, punteros, índice y aviso de corte, 23.626 B (45 %). Ahorro ≈ 28 KB ≈ **−12,8k tokens** por sesión nueva
(a 2,2 B/token, estimación calibrada con cuatro lecturas).

## Lo que NO se tocó, y por qué

`sesion.mjs`, `uso.mjs`, `orquestador-arranque.mjs` y `docs/equipo/prompt-tanda-orquestador.md` tienen una copia en
`%LOCALAPPDATA%\yaqu-equipo`, y la puerta de integridad de `sesion.mjs` exige que sea IDÉNTICA a `origin/main`: tocar
cualquiera obliga a reinstalar, y eso pide el sí escrito del orquestador. Por eso el tope de 5 KB del traspaso lo comprueba
**quien lo escribe** (`gasto-arranque.mjs traspaso sN`) y no `relevar`. Avisar también desde `relevar` queda para la
próxima instalación.

## La entrada de SCRUM-723 (dicho al jefe, A23 nº 14)

`tests/scrum723-…` se puso en ROJO al añadir `norma.mjs` («quién compara contra una referencia MÓVIL»): la línea
`ORIGEN_POR_DEFECTO = 'origin/main'` la nombra fuera de los argumentos de git. **No se esquivó el literal** y **no se
relajó el guard**: `norma.mjs` se DECLARA en la lista visible, con su motivo, como ya están `instalar.mjs` y
`comprobar-instalacion.mjs`. El motivo es real: la pregunta es «¿qué dicen las normas AHORA?», y el checkout compartido
llegó a ir 4.740 commits por detrás. **NO compara ni emite veredicto sobre ninguna rama**: solo lee un fichero.

## Lo que se comprobó

- **Nuevo test**: 22/22 en verde; con el de SCRUM-723, **30/30, EXIT 0**.
- **Rojo visto** (A23 nº 8): el subagente inyectó tres violaciones de 1 línea (`git diff --numstat` = `1 1`) — quitar el
  corte de A19 (3 casos rojos), que `--arranque` imprima todo (4 casos) y `>` por `>=` en el tope (2 casos; solo lo cazó el
  caso del borde exacto de 5.120 B, que se añadió) — y las revirtió con `git restore --source=HEAD`. Esta sesión repitió
  la primera POR SU CUENTA: numstat `1 1`, `EXIT=1`, 22 tests con 3 caídos, revertida, árbol limpio y `EXIT=0` con 22/22.
- **Barrido**: 193 ficheros de test que recorren `scripts/`, `tests/` o el árbol (tras `npm run build`): 1.827 tests,
  1.815 pasan, 4 fallan: el 723 (arreglado arriba) y **3 de SCRUM-939b («la ruta de gh sale CIERTA y esa ruta no
  existe»), que NO son de esta rama**: se corrieron en el checkout limpio de `main` (`320c7f20`) y dan los mismos 3.
- **La mecánica del prompt**: `cmd /c "git show origin/main:<ruta> > %TEMP%\x.mjs"` con un fichero real de `origin/main`
  copia 17.848 B exactos (los del fichero), con la ruta escrita como va en el bloque del prompt.

## Fuera del repo: `MEMORY.md` (memoria de la máquina)

Con el sí del orquestador, que es el dueño del índice: **8 líneas de más de 400 B** recortadas a ≤ 342 B, comprobando por
programa que cada cifra/identificador recortado sigue en el fichero al que apunta la línea (uno no estaba, `enlace:ticket-rama
--controles`, y se dejó en la línea). **19.590 → 15.547 B (−4.043 B ≈ −1,8k tokens en cada sesión y cada turno)**,
0 líneas > 400 B, copia previa en `D:\MILLONARIO\cobroFlash\backup-MEMORY-antes-de-996.md` (19.590 B). Quedan 34 líneas
entre 220 y 400 B sin tocar.

## Propuesta a la Sesión 0 (dueña de `00-normas-comunes.md`), texto exacto

En A19, «Qué lleva el traspaso», una línea más: *«7. **Tope: 5 KB.** Lo que pase de eso —la historia y las trampas ya
sabidas— va a `project_sN_historial.md`, que la sesión nueva NO lee salvo que el traspaso la mande a él. Se comprueba con
`node scripts/equipo/gasto-arranque.mjs traspaso sN`.»* Y en A1, tras «Cada tanda, antes de nada»: que el arranque de las
normas es `node scripts/equipo/norma.mjs --arranque`. Yo no edito ese fichero.

## No comprobado, y errores propios (A9)

- **No corrí la suite completa** (`npm test`, con su `pretest`): solo los 12 ficheros que mencionan `scripts/equipo`, los
  193 que recorren el árbol y `guards:entrada`. La suite entera la corre el CI.
- **El efecto real** (turno 8 ≤ 90.000 en los próximos relevos) **no está medido**: hace falta un relevo con el bloque nuevo.
  Todas las cifras de ahorro son estimaciones por bytes; los pesos de precio son un supuesto; la cuota real puede ponderar distinto.
- La ruta por defecto de `traspaso` (`~/.claude/projects/<slug>/memory/…`) se probó con `home` inyectado, no con el `home`
  real en un subproceso.
- **Errores míos**: dije «~40k estimados» de mi contexto y eran 129k; prometí −2,8k en `MEMORY.md` extrapolando un tope
  de 220 B a todas las líneas y solo entregué −1,8k (recorté las 8 mayores); y **construir esto costó**: el subagente que
  escribió el código y el test gastó 278k tokens de contexto acumulado en 73 llamadas, para un ahorro que se cobra en los
  relevos siguientes. **Contexto de esta sesión al entregar: 344.365 medido** (por encima de 300k: pido el relevo, A19).

## SCRUM-996b · el efecto medido, con N=11, sigue en rojo (24-sep-2026)

**Medido contra:** `origin/main` = `09f8ba99` · 2026-09-24, ~16:2xZ · escrito por la **Sesión 5**.

`node scripts/equipo/gasto-arranque.mjs sesiones --desde 2026-09-22T16:35:00Z --min-turnos 8`, repetido con N
creciente hasta ser CONCLUYENTE (antes N=1, sin valor): **N=11 sesiones**, todas ya nacidas con el bloque
`--arranque` de este ticket en su prompt de relevo.

- **U8 mediano: 105.351** (objetivo ≤ 90.000) → **NO CUMPLE**.
- **Lectura/contexto: 21,2 %** (objetivo ≤ 10 %) → **NO CUMPLE**, y por encima del 16,8 % de la línea base SIN
  el instrumento (línea 23 de este fichero).
- Ninguna de las 11 sesiones bajó de U8=90k.

**Sin causa confirmada** (A3: no se afirma lo que no se ha medido). Candidatos a mirar la próxima vez, SIN
verificar todavía — no tratar como diagnóstico:
1. El `--arranque` de `norma.mjs` es el suelo de NORMAS; no cubre lo que cada sesión lee además (su
   `sesion-N.md`, su fila §11bis, su `project_sN_traspaso.md`, `orquestador-autonomo.md` §5bis) — la línea 22
   base ya incluía eso y seguía en 102k, así que el ahorro de ~13k de `norma.mjs` puede estar compensado por
   crecimiento en otro punto que nadie ha medido por separado.
2. Traspasos por encima del tope de 5 KB (la comprobación es de quien escribe, `gasto-arranque.mjs traspaso
   sN`; no hay guard que lo fuerce antes de guardar en memoria).
3. `MEMORY.md` ha seguido creciendo desde el recorte de la línea 68-74 (más entradas nuevas desde el 21-sep):
   no remedido desde entonces.

**No se toca esta tanda** (cuota semanal a punto de resetear, A25: cerrar antes que empezar). Sigue el hilo
abierto: la próxima sesión que mida, antes de tocar nada, remide con N mayor y, si el rojo persiste, corre el
candidato 1 aislado del 2 y el 3 (medir `norma.mjs --arranque` a secas frente a un arranque real completo, en
dos sesiones de control) en vez de tocar los tres a la vez.

## SCRUM-996d · la A1 deja de mandar `prisma generate` cada tanda (Sesión 0)

**Medido contra:** `origin/main` = `73e41ab00f727fae5c6c8f1715d6eb6749133502` · 2026-10-15T16:06:31Z

Del apartado 5 de 996c (de la S5, PR #2477 al escribir esto): la A1 abría con `./node_modules/.bin/prisma
generate` «cada tanda, antes de nada», y §10 de `trampas-del-entorno.md` dice que el cliente compartido lo
regenera sólo el orquestador, con el equipo parado. Las dos cosas se muerden: el 14-oct se lanzó 9 veces, una
desde `s2-14oct` (junction al compartido) con la salida a `$null`.

- **La A1 nueva abre con `node scripts/_prisma-client-guard.mjs`**, que MIRA: `✔` → nada; rojo → se lee entero.
  Causa A (tu rama añade columnas) es correcta; cliente viejo con árbol al día → se regenera sólo con un
  `node_modules` propio (`npm run topologia`) y leyendo la salida; si cuelga del compartido, al orquestador (§10).
- Lleva el porqué con la cifra (9 veces el 14-oct, una con la salida a `$null`), para que no se pode.
- §10 no se repite: se enlaza. Lo que pasó al ejecutarlo lo apunta la S5 en SCRUM-429c (PR #2476).
- **Control positivo del guard antes de escribirlo en la norma:** `✔` EXIT 0 desde `wt-s0-15oct` (junction al
  compartido, en `origin/main`); desde el árbol compartido (`scrum-1082…`) rojo con `Merchant.invoiceStartSeq`,
  EXIT 1. Las dos cosas que la A1 nueva dice que pasan.
- Test: `tests/scrum996d-a1-no-regenera-a-ciegas.test.mjs` (el bloque de órdenes de la A1 no lleva `generate`
  y sí el guard). Rojo comprobado aplicando su mutación declarada: cae, exit 1, y el fichero queda restaurado.
  Con los otros 5 ficheros de tests que leen las normas: 53 de 53, EXIT 0.

**Visto de paso, de otros carriles (se reporta, no se toca):**
- `scripts/_prisma-client-guard.mjs:332` sigue diciendo «Arreglo, en los dos casos: `npm run prisma:generate`
  (desde ESTE worktree)». En la causa (B) eso es justo lo que §10 prohíbe. Es de la S5.
- `CLAUDE.md` (Comandos) dice «en Windows, matar node antes si el DLL queda bloqueado»; §10 dice «NO matar
  todos los `node`: Claude Code también corre en `node`». `CLAUDE.md` es de un jefe; la S0 propone el cambio.

### Las dos propuestas de 996c §4 que son de la S0: decididas, y HECHAS las dos

**1 · Arrancar con `norma.mjs --arranque`: SÍ.** Con la condición que la S5 ponía: el índice tiene que decir
CUÁNDO hace falta cada sección de fuera. No se toca `norma.mjs` (es de la S5): la tabla «antes de… | traes» va
al final de la A1, que el arranque SÍ imprime, y la cabecera del fichero dice «no se leen enteras». El test
cae si una sección queda fuera del arranque sin su fila, o si la tabla manda traer una que no existe.
- ⚠️ **Esto no basta para que se use.** Lo que hace que las sesiones lean el fichero entero es el arranque que
  les manda leerlo: `CLAUDE.md` («LECTURA OBLIGATORIA, cada tanda: `00-normas-comunes.md`»), la skill
  `cerebro-yaqu` y el prompt de lanzamiento. `CLAUDE.md` y `.claude/**` son de un jefe; la S0 propone el cambio
  (en la entrega de este ticket, con el literal).

**2 · Sacar de la A19 el porqué del 300k: SÍ, pero sin fichero nuevo.** Se mueve DENTRO de la A19, detrás del
marcador «Cuarta versión», que `norma.mjs` ya corta: no lo lee el arranque y `norma.mjs A19 --entera` lo trae. En
su sitio queda un párrafo que dice dónde está y que lo autorizó el fundador. El texto movido es el mismo:
comprobado sobre el diff, de las 49 líneas no vacías quitadas no falta ninguna entre las añadidas. Son 55
líneas, **4.811 B**, no los ~6,5 KB estimados en 996c.
- Los cuatro tests que atan la A19 no atan ese bloque: `scrum1484c` ata los dos números y las dos frases (se
  quedan arriba), `scrum996` el marcador y una línea de la historia, `scrum899c` y `scrum1070` el código.

**Cifras, de `norma.mjs` sobre este árbol:** el arranque pasa de 39.498 B a **38.205 B** (lo que añade la A1, la
tabla y el `generate` reescrito, se come parte de lo que sale de la A19). Frente a leer el fichero entero, que
ahora pesa 71.167 B, el arranque es el **54 %**: ~33 KB menos, ~15k tokens por sesión a 2,2 B/token. Es un
cálculo por bytes, no un relevo medido.

**Mi rojo en el primer CI (job 116532845442, 16:24Z):** las dos `MUTACIONES_QUE_ME_TUMBAN` del test llevaban
`fichero: NORMAS` (una constante) y el meta-guard sólo evalúa literales: 3 fallos (`scrum745`, `scrum757`,
`scrum765`), 11.483 pass. Arreglado con el literal; esos tres más el mío, 31 de 31, y `--solo-censo` EXIT 0. Lo
cazó el guard que existe para eso: no hace falta norma nueva.

A9: comprobación → `tests/scrum996d-a1-no-regenera-a-ciegas.test.mjs`
## SCRUM-996c · el arranque medido el 15-oct, y qué se puede quitar (Sesión 5)

**Medido contra:** `origin/main` = `73e41ab00f727fae5c6c8f1715d6eb6749133502` · 2026-10-15T15:42:24Z

Encargo del orquestador: medir cuánto pesa hoy el arranque, con cifras, y proponer qué quitar o partir sin perder
lo que impide un fallo, declarando el riesgo. **Aquí sólo se mide y se propone: no se ha cambiado nada.**

Instrumentos: `gasto-arranque.mjs sesiones` y `arranque <nombre>` (los de este ticket) y dos sondas sueltas de
sólo lectura sobre los mismos jsonl (adjuntos del turno 1 por tipo y modelo; `tool_use` con `prisma generate`).
Población: 33 sesiones con ≥ 8 turnos en 48 h; las de hoy son 6 (`s0`…`s5-15oct`).

### 1 · El suelo (U1) se mueve ~11k de un día a otro, y no por nada nuestro

| día | sesiones | U1 (turno 1) |
|---|---|---|
| 13-oct | 32 | 69.114 – 75.209 |
| 14-oct | 27 | 58.433 – 61.307 |
| 15-oct | 6 | 69.755 – 71.408 |

Mismo modelo (`claude-opus-5-5`) y misma versión (`2.1.299`) el 14 y el 15. Y del 14 al 15 los adjuntos que el
jsonl registra antes del turno 1 pesan lo mismo, byte a byte (`skill_listing` 63.274 B de JSON, agentes 7.773 B,
`session_context` 7.393 B, `prompt_snapshot` 11.241 B, instrucciones 66-69 KB, prompt 6,4-8,4 mil caracteres).
**Así que la diferencia no está en nada que el jsonl registre. La causa NO la sé.** Hipótesis sin verificar: el
system prompt o las herramientas que se cargan en línea, que no quedan en el jsonl. Los adjuntos del 13-oct no
los he desglosado. Consecuencia práctica: comparar U8 entre días mezcla nuestro efecto con ~11k que no son nuestros.

### 2 · Lo que SÍ controlamos dentro del suelo (turno 1 de `s5-15oct`, bytes de contenido)

| pieza | bytes | dueño |
|---|---|---|
| `MEMORY.md` (índice de la memoria) | 18.912 | orquestador |
| `CLAUDE.md` del árbol compartido (va en `scrum-1082`, es el del 17-sep) | 13.304 | — |
| lista de skills, total | 30.044 | — |
| · de ella, `unity:*` (plugin de otro proyecto) | 14.683 | fundador |
| · de ella, `badcops-team:*` (plugin de otro proyecto) | 1.103 | fundador |
| lista de agentes (incluye 2 de `badcops-team`) | 3.726 | fundador |

Esto va en el contexto de CADA turno de CADA sesión, no sólo en el primero.

### 3 · La lectura del arranque: las normas se leen ENTERAS

U8 mediano de hoy **117.261** y lectura **21,2 %** del contexto (N=6). Contra el objetivo recalibrado por el
orquestador el 25-sep (comentario 16922: U8 ≤ 120.000, lectura ≤ 15 %): **U8 cumple por poco, la lectura no.**
*(`gasto-arranque.mjs` sigue imprimiendo el objetivo viejo, 90.000 / 10 %: nadie le cambió la constante.)*

`arranque s0-15oct`, `s1-15oct` y `s4-15oct`: **las tres leen `00-normas-comunes.md` entero**, en dos `Read`
(47.869 B + 23.287 B de resultado). En `s4-15oct` eso son Δ 22.045 + 10.840 = **32.885 tokens, el 71 % de toda
su lectura de arranque** (2,16 B/token: cuadra con el 2,2 de arriba). **Ninguna usa `norma.mjs --arranque`.**

| | 21-sep (este ticket) | 15-oct |
|---|---|---|
| `00-normas-comunes.md` | 51.780 B | 67.208 B (+30 %) |
| `norma.mjs --arranque` | 23.626 B | 41.329 B (+75 %) |
| A19 sola | 6,4 KB (SCRUM-1070) | 16.614 B (el 25 % del fichero) |

De la A19, las líneas 610-672 (~6,5 KB) son **el porqué** del umbral de 300k: la medición del 6-oct, el coste
simulado, quién lo autorizó y el gemelo de código. La norma en sí (tres casos, tres casillas, 300k/500k) cabe en
unas 40 líneas.

### 4 · Propuesta, de más a menos ahorro. Lo que se quita es lo que la siguiente sesión NO va a saber

| # | qué | ahorro por sesión | riesgo (lo que se pierde) | quién decide |
|---|---|---|---|---|
| 1 | El arranque lee `norma.mjs --arranque`, no el fichero entero (A1 y la línea de `CLAUDE.md`) | −25,9 KB ≈ **−12k tokens** de lectura | Las 11 secciones de fuera (A5, A6, A10-A12, A15, A17, A18, A21, A22, A23) sólo llegan si la sesión las pide. El índice da título y tamaño, **no cuándo hace falta cada una**: quien escriba un guard sin leer A23, o un carácter de control sin A22, repite esos fallos. Para mitigarlo, cada línea del índice diría su disparador («antes de escribir un guard»). | S0 (normas), orquestador |
| 2 | Sacar de A19 el porqué del 300k a un fichero propio que A19 enlace | ≈ −6,5 KB ≈ **−3k tokens** (dentro del arranque) | Quien quiera mover el número no ve las cifras sin abrir el enlace. Y hay cuatro tests que atan texto de A19 (`scrum1484c`, `scrum899c`, `scrum1070`, `scrum996`): se tocan en el mismo PR. | S0 |
| 3 | Desactivar `unity` y `badcops-team` (y el MCP `blender`) **sólo para este proyecto**, en su `.claude/settings.json` (`enabledPlugins` a `false`) | 15,8 KB de skills en inglés, más 2 agentes y el bloque de reglas de Bad Cops ≈ **−4k tokens en CADA turno** (es suelo, no lectura) | Ninguno para YaQu. Y quita una instrucción equivocada: hoy el system prompt de cada sesión de YaQu manda usar `badcops-team:revision-antes-de-push` antes de cada push. **No he probado que el `false` del proyecto gane al `true` del usuario**: es `.claude/*` (regla 36) y no lo toco. | fundador |
| 4 | Podar `MEMORY.md` | recortar las líneas largas da poco: sólo 25 de 102 pasan de 220 B, con 1.351 B de exceso (≈ −0,6k) | Lo que sale del índice no se recuerda. La palanca real es quitar líneas superadas, y eso es criterio, no tijera. | orquestador |

**Lo que corrige esto de lo que había escrito:** el comentario 16988 (25-sep) dice que «desde el repo no hay
palanca» sobre la lista de skills. Era cierto para las skills de Anthropic. **No lo es para `unity` ni para
`badcops-team`**, que están en `enabledPlugins` del usuario desde el 6 y el 9-oct.

### 5 · Hallazgo de paso: la A1 manda regenerar Prisma, y §10 dice lo contrario

La A1 abre con `./node_modules/.bin/prisma generate` «cada tanda, antes de nada». `trampas-del-entorno.md` §10
(SCRUM-429b) dice que el cliente compartido lo regenera sólo el orquestador, con el equipo parado. **Se ejecuta:**
la sonda contó 9 `generate` lanzados el 14-oct por `s1` (7, en árboles con `node_modules` privado, `s1-zona`),
`s4` (1, `node_modules` propio) y `s2-14octa` (1, desde `s2-14oct`, que **cuelga del compartido por junction**,
con la salida a `$null`). **Si ese último cambió el cliente compartido no lo he medido.** Hoy (15-oct) ninguna
sesión lo ha ejecutado. Propuesta a la S0: quitar el `generate` de la A1 y poner en su lugar
`node scripts/_prisma-client-guard.mjs` y un enlace a §10.

### 6 · ¿996 y 1070 son el mismo ticket?

**No del todo.** 1070 es el estudio general del gasto: el relevo (hecho, y superado por los 300k de SCRUM-1479),
más el índice del código y `estado.mjs`, que su propia tabla deja con payback de > 15 y ~8 relevos y que nadie ha
construido. Lo que se solapa, el arranque y `MEMORY.md` (sus palancas 2 y 3), es justo lo que lleva 996. Mi
propuesta: 996 sigue siendo el hilo del arranque, y 1070 se cierra con su resto declarado como «no se construye».
Lo decide el orquestador.

### No comprobado, y lo mío (A9)

- La causa del vaivén de ~11k en U1 (apartado 1).
- El ahorro de las propuestas 1-3 está calculado por bytes, no medido con un relevo que las aplique.
- **Esta sesión no ha leído `00-normas-comunes.md` entero en esta tanda**: sólo la A1 y la A19, al medirlas.
- Contexto de esta sesión al escribir esto: ~200k.

A9: sin fallo que generalice — ticket de sólo medición y propuesta (un único .md, sin código ni camino de emisión tocado); lo no comprobado queda declarado arriba, y la corrección al comentario 16988 va en el texto del apartado 4.

## SCRUM-996e · la lectura de arranque MEDIDA con `--arranque` en uso: 18,5 %, y el 6-7 % de dos sesiones es del instrumento (16-oct-2026, Sesión 0)

**Medido contra:** `origin/main` = `48fc00f6a90089b0f172b58c49413d889288bec0` · 2026-10-16T11:05:37Z (`gh api -i zen`)

A9: sin fallo que generalice — tramo de sólo medición; el defecto del instrumento es de S5 (`scripts/equipo/**`) y se reporta, no se arregla aquí.

Encargo del orquestador (16-oct): 996 se cierra si la LECTURA de arranque baja del 15 %, medida (no calculada) con
`gasto-arranque` sobre las sesiones de hoy, que ya arrancan con `norma.mjs --arranque` (#2502). Y comprobar antes que
el instrumento no imprime cifras fijas.

**1 · La cifra.** `node scripts/equipo/gasto-arranque.mjs sesiones --desde 2026-10-16T10:00:00Z --min-turnos 8`
(antes de las 11:19:35Z, hora de GitHub leída después), sobre una población de 455 `state.json`, 22 con actividad y **6 con ≥ 8 turnos** (`s0…s5-16oct`):

| sesión | turnos | U1 | U8 | lectura | % |
|---|---|---|---|---|---|
| s1 | 54 | 68.439 | 101.626 | 33.187 | 19,6 |
| s0 | 58 | 66.872 | 104.354 | 37.482 | 24,4 |
| s2 | 51 | 67.862 | 104.210 | 36.348 | 24,5 |
| s4 | 48 | 67.807 | 103.386 | 35.579 | 22,9 |
| s5 | 44 | 69.594 | 78.343 | 8.749 | 6,1 |
| s3 | 43 | 67.613 | 76.642 | 9.029 | 6,8 |

**TOTAL: lectura 18,5 %** (objetivo del ticket ≤ 10 %; el del orquestador, < 15 %) · U8 mediano **102.506**
(≤ 90.000) · `NO CUMPLE` · EXIT 1. Ayer (996c): 21,2 % y U8 117.261, también con N=6.

**2 · El instrumento, comprobado con una sonda independiente** (un script de 20 líneas que no reutiliza nada de
`gasto-arranque`: dedup por `message.id`, `input + cache_read + cache_creation`). Sobre mi propio jsonl da U1=66.872,
U8=104.354, lectura=37.482 y 24,3 %: **los mismos números**. La cifra por sesión cambia de una sesión a otra, así que no
imprime nada fijo. Los «90k/10 %» que vio la S5 son los OBJETIVOS, que salen en la línea del criterio. Y el «% del
contexto» es `lectura × (turnos − 8) / Σcontexto`: la lectura que se vuelve a pagar en cada turno posterior. Por eso
baja a medida que la sesión crece, y sólo se compara entre poblaciones con un número de turnos parecido.

**3 · 🔴 Defecto del instrumento: la lectura que se hace DESPUÉS del turno 8 no la cuenta.** El bloque de
`norma.mjs --arranque` (40.954 B) es un salto de **~19,7k tokens en un solo turno**, y ese salto se ve en las seis:

| sesión | turno del salto | Δ |
|---|---|---|
| s0 | 5 | 19.678 |
| s1 | 6 | 21.430 |
| s2 | 5 | 19.781 |
| s4 | 5 | 19.730 |
| s3 | **24** | 19.730 |
| s5 | **21** | 19.735 |

s3 y s5 leyeron las normas después del turno 8, así que su 6-7 % es U8 cortando antes de la lectura, no un arranque
más barato. Si se les suma el salto, quedan en ~21,6 % y ~19,3 %: **las seis por encima del 15 %**. Una sesión que lee
tarde parece más barata: es la forma de «un instrumento que acierta por suerte». Es de S5 (`scripts/equipo/**`):
queda nombrado aquí y no se toca.

**4 · Lo que sí bajó, medido y no calculado.** La lectura de las normas pasó de **32.885 tokens** (996c, s4-15oct,
el fichero entero más su resultado) a **~19,7k** hoy, en un solo turno: unos **13k menos por sesión**. El total no baja
del 15 % porque la lectura de hoy, ~33-37k en las cuatro que leyeron antes del turno 8, lleva además el traspaso, la
ficha del puesto, `ya-esta` y el propio encargo.

**5 · Y algo que el instrumento no ve.** El suelo (U1, ~67-70k, el 53,5 % del contexto) lleva el `CLAUDE.md` FÓSIL del
árbol compartido: las seis sesiones de hoy arrancan con `cwd` en él (1300b). No he medido cuánto pesa ese fichero
frente al de `main`.

**Veredicto: 996 sigue ABIERTO.** 18,5 % medido, 6 de 6 por encima del 15 % al corregir el corte de U8.