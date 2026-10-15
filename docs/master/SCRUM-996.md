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
