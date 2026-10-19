# SCRUM-1300 · El modelo de trabajo nuevo: que un fallo se convierta en comprobación y no en nota

Registro de máster del ticket. Un fichero por número (A8); cada tramo nuevo se ANEXA debajo.

## SCRUM-1300 · «no se ha podido verificar» exige el dato recibido (14-oct-2026)

**Medido contra:** `origin/main` = `db28dc0a6a8f0520d82991d5a11d76589f582c66` · 2026-10-14T17:31:58Z

Puesto S0 (3ª tanda del 14-oct). Encargo del orquestador: escribir en las normas el fallo que midió la
S3 ese día, con su cifra dentro, y decir si se puede sostener con un guard. No abre ticket: va colgado de
éste porque es justo lo que 1300 pide, un fallo convertido en norma en el camino por defecto.

**Qué entra**

| fichero | qué |
|---|---|
| `docs/equipo/00-normas-comunes.md` A3 | la norma entera: el dato recibido (ruta, cuenta, código, cuerpo, hora) o «no lo he intentado»; la cifra (0 de 7); el alcance real del paywall y del tope de usuarios |
| `docs/equipo/00-normas-siempre.md` A10 | la frase corta. Este fichero lo importa `CLAUDE.md` con `@`: llega sola a toda sesión |
| `docs/equipo/trampas-del-entorno.md` §PowerShell | de paso: `[IO.File]` con ruta relativa también ESCRIBE en otro árbol, no sólo lee |
| `docs/equipo/cicatrices/S0.md` | dos cicatrices de esta tanda |

**De dónde sale la cifra.** De la auditoría de la S3 del 14-oct, transcrita por el orquestador en
SCRUM-1367 c.19747: 7 comentarios culpaban a la cuenta QA caducada; 0 ciertos, 2 falsos por ruta, 4
deducidos del código y 1 dudoso. No la he recontado: la cito con su origen.

**Los datos de la norma, medidos aquí** (sobre el código, no contra producción):

- `requireActivePlan` está montado en 4 sitios: `src/app.ts:355` (`POST /quote/create`), `src/app.ts:570`
  (`POST /admin/quotes/:id/send-whatsapp`), `src/modules/jobs/app/routes/albaranes.routes.ts:1238` y
  `:1255`. Dos instrumentos: `git grep` y el censo por AST de `tests/_censo-aviso-vs-bloqueo.mjs`
  (`censarEjecucionDelVencimiento`: 4 montajes sobre 127 rutas de escritura). Ningún `app.use` lo monta.
- `POST /admin/quotes/:id/accept` (`quotesAdmin.routes.ts:137`) no lo lleva.
- `trial` admite 1 usuario (`src/core/entitlements.ts:18`); al tope, invitar da 409 `user_limit`
  (`src/modules/team/app/routes/team.routes.ts:78-81`), y esa comprobación no mira la caducidad.

**¿Se puede sostener con un guard? En parte.**

- **El DATO, sí, y el guard ya existe:** `tests/scrum337-aviso-atado-al-bloqueo.test.mjs` compara por
  identidad los montajes del censo con su lista declarada. Control, en el worktree:
  - BASE: 10 de 10.
  - MUTANTE (un quinto `requireActivePlan` en `POST /:id/accept`): 9 de 10. Cae «si cambia lo que el
    producto HACE al vencer…» y nombra `quotesAdmin.routes.ts::POST /:id/accept`.
  - Restaurado: 4 montajes otra vez.
  Así, si el paywall cambia, la norma no se queda diciendo cuatro rutas sin que nadie lo vea. No ata el
  TEXTO de la norma a la lista: quien amplíe el paywall tiene que tocar las dos cosas, y el guard sólo le
  obliga a mirar los avisos.
- **La CONDUCTA, no.** Lo que un comentario afirma de producción vive en Jira, fuera del repositorio, y
  ningún test lo lee. Un guard de texto sobre `docs/master/` buscando «403» o «no se pudo» casaría por
  la forma de la frase, que es el defecto de la A10 de SCRUM-1372. No lo he construido.

**Error propio (A9).** Dos, y el primero es el fallo que esta norma describe:

1. En mi tabla de la criba (`criba-14oct.md` §3) puse 1476 como BLOQUEADO citando «`POST /quote/create`
   da 403 `trial_expired`» de `docs/master/SCRUM-1367.md`, que lo había deducido del código. Era cierto
   para CREAR, pero no lo había recibido nadie, y 1476 no necesita crear: le basta aceptar un borrador.
   El orquestador lo devolvió a «Por hacer».
2. La primera pasada del mutante escribió en el checkout COMPARTIDO (`[IO.File]::WriteAllText` con ruta
   relativa tras un `cd`). El test del worktree salió 10/10 y casi declaro el guard ciego. Lo vi porque el
   censo, leído directamente, sí contaba el quinto montaje. Estuvo cambiado en el compartido unos 25 min.
   Al verlo: `git diff --numstat` daba `1 1` (sólo mi línea), lo deshice con el reemplazo inverso y
   `git status` del fichero quedó vacío.

A9: aviso → cicatriz S0 «Copié a mi tabla de la criba que `POST /quote/create` daba 403 `trial_expired`, sacado de un registro ajeno que lo había deducido del código, y con eso marqué 1476 como bloqueado: el orquestador tuvo que revertirlo. Lo que un registro dice de producción se copia con su «leído» o su «recibido», nunca sin él.» — no se pudo comprobar: lo que un comentario afirma de producción vive en Jira, y ningún test del repositorio lo lee

## SCRUM-1300b · las nueve piezas y los cinco cabos, medidos uno a uno (16-oct-2026, Sesión 0)

**Medido contra:** `origin/main` = `48fc00f6a90089b0f172b58c49413d889288bec0` · 2026-10-16T11:05:37Z (`gh api -i zen`)

A9: aviso → cicatriz S0 «Copié a mi traspaso del 15-oct «cerrados hoy por el orquestador: 1367 · 1476 · 1302 · 1144 · 1295 · 1092 · 1070 · 1493 · 899» sin mirar Jira, y al día siguiente el orquestador me lo devolvió como premisa. Medido con una sola consulta (`key in (…)`, campos `status` y `resolutiondate`): 1295 está En curso, 1092 y 1070 en Tareas por hacer, ninguno de los tres tocado desde septiembre o el 6-oct, y 1493 se cerró el 7-oct, no ese día. Un «cerrado» se copia de Jira, no del mensaje que lo dice.» — no se pudo comprobar: el estado vive en Jira, y ningún test del repositorio lo lee (es la pieza 8 en pequeño)

Encargo del orquestador (16-oct): `ya-esta` da 1300 🟢 desde el 14-oct; contar cuántas de sus piezas están, cuáles
faltan y de quién son. **Son NUEVE, no ocho:** de la 0 a la 7 en la descripción, y la 8 en el comentario c.17878
(1-oct). Más los 5 cabos. Leído el ticket entero en Jira (descripción + su único comentario).

**El dato que ordena la tabla.** `claude agents --json`, 16-oct ~11:20Z: **las 7 sesiones vivas** (`s0…s5-16oct` y
`cobroflash-backend-f3`) tienen `cwd` = `D:\MILLONARIO\cobroFlash\cobroflash-backend`, el compartido (rama
`scrum-1082-…`, 3185 commits por detrás). De ahí se cargan `CLAUDE.md`, `.claude/settings.json` y `.claude/rules`, y
medido en ese disco: sus hooks son **sólo** `guard-dangerous.sh`; **no existe** `.claude/rules` ni
`.claude/carriles.json` (en un árbol al día, sí: control); su `CLAUDE.md` no tiene ninguna línea `@` y sigue diciendo
«matar node» (el de `main`: 0 veces). `%LOCALAPPDATA%\yaqu-equipo\config.json` **no tiene la clave `mesas`**. Y los
logs de los hooks de latido acaban el **1-oct 13:25Z**: sus últimas filas son controles de la S0 de aquel día, y no hay
ninguna después.

| pieza | estado | dónde se ve | lo que falta · de quién |
|---|---|---|---|
| 0 · mesa fija por puesto | CONSTRUIDA, **APAGADA** | `scripts/equipo/sesion.mjs` (SCRUM-1298) · `tests/scrum1298-mesa-por-puesto.test.mjs` · `mesa-s5` y `mesa-control-s5` en disco | dar el interruptor (`mesas` en el config instalado), con el equipo parado — orquestador; su propia cabecera lo dice |
| 1 · la A9 cierra el círculo | **HECHA y llega** | A9 de `00-normas-comunes.md` · `tests/scrum1294-a9-leccion-en-a10.test.mjs` | — |
| 2 · `CLAUDE.md` importa las normas | HECHA en `main`, **NO LLEGA** | `@docs/equipo/00-normas-siempre.md` en `origin/main:CLAUDE.md` | depende de la 0 |
| 3 · `.claude/rules` generadas | HECHA en `main`, **NO LLEGA** | 11 reglas · `scripts/carriles.mjs comprobar` · `tests/scrum1295-carriles.test.mjs` | depende de la 0 |
| 4 · identidad + cerradura | HECHA en `main`, **NO CORRE** | `.claude/hooks/identidad.mjs` (SessionStart) · `.claude/hooks/carril.mjs` (PreToolUse: «SIN IDENTIDAD … no trabajas») | depende de la 0; ⚠️ al encenderla, toda sesión sin mesa queda bloqueada (es su diseño) |
| 5 · cicatrices por puesto | ESCRITAS, **NO SE ENTREGAN** | `docs/equipo/cicatrices/` (12 ficheros) · las inyecta `identidad.mjs` | depende de la 0 |
| 6 · latido del orquestador | **HECHA** como script | `scripts/equipo/latido.mjs` (fail-closed: 10 líneas `NO-PUDE-MIRAR`) · 13 tests con «latido» | los hooks `latido-arranque`/`latido-cierre` no corren desde el 1-oct: depende de la 0 |
| 7 · agentes definidos | **NO HECHA** | no hay `.claude/agents/`; la regla «leer mucho para concluir poco → agente» no está en las normas (sólo A25: «subagentes … salida ≤ 2 KB») | sin dueño (así lo dice el ticket) |
| 8 · la memoria del orquestador se comprueba contra el árbol | **NO HECHA** | ningún script ni test (búsqueda en `scripts/ tests/ .claude/` con 0; la misma, en `docs/`, ve 3 ficheros: no está ciega) | S0 o S5, sin decidir (c.17878) |

| cabo | estado | dónde se ve |
|---|---|---|
| 1 · auditoría rutinaria de cierres | instrumento HECHO, **no es rutina** | `scripts/auditoria-cierres.mjs` (SCRUM-1372) · `docs/equipo/auditoria-de-cierres.md`, sin cadencia escrita y sin cambios desde el 2-oct · S0 |
| 2 · ¿existe el traspaso y está al día? | HECHO (leído, no corrido) | `latido.mjs` (17 líneas «traspaso») · `scripts/traspaso-derivado.mjs` (SCRUM-1427) |
| 3 · libro de repartos | HECHO (leído, no corrido) | `node scripts/equipo/latido.mjs repartos` |
| 4 · ficheros sin fila en `dos-equipos.md` | HECHO para `scripts/` | `node scripts/carriles.mjs sin-fila` (SCRUM-1480f) |
| 5 · el fundador, único canal | sin solución, declarado así | — |

**Recuento.** De 9 piezas: **2 hechas y llegan** (1 y 6) · **4 hechas en `main` que no llegan a nadie** (2, 3, 4 y 5)
· **1 construida y apagada** (0), que es la que bloquea a esas cuatro · **2 sin hacer** (7 y 8). **No está completo.**
El cuello es uno solo: la pieza 0 es la que se definió como «sin esto, ninguna de las demás llega a nadie», y hoy no
llegan.

**Una pregunta, no un hecho:** hoy las sesiones se llaman `sN-16oct`, y `sesion.mjs` sólo admite los puestos del
config (`sesion-N`). No he medido cómo se lanzaron. Si fue sin `sesion.mjs`, encender `mesas` no basta.

## SCRUM-1300c · PIEZA 8 construida: la memoria del orquestador contra el árbol (18-oct-2026, Sesión 5)

**Medido contra:** `origin/main` = `fa1633398d1057e88c2af30a4f1a6572c0934556` · 2026-10-18T18:19:31Z

A9: comprobación → `tests/scrum1300c-memoria-contra-el-arbol.test.mjs`

**Dueño:** el «S0 o S5, sin decidir» de c.17878 lo resolvió el orquestador el 18-oct: **S5** (un instrumento
con su control es del carril de S5; S0 es normas y auditoría).

**Por qué hoy.** El 18-oct la memoria del orquestador le atribuyó a un guion suyo (`quien-me-espera.mjs`) un
acierto que era de `sala.mjs`, y con eso pidió llevarlo a `main`; medido, el guion salía 0 sin mirar a nadie.
Su índice ya tenía «mi memoria cuenta como ENTREGADO lo que vive en un PR ABIERTO (2x en 2 días)»: la única
defensa era acordarse de acordarse.

### Lo que entra
`node scripts/equipo/memoria-contra-el-arbol.mjs <carpeta de memoria> [--todo] [--json]`. Sólo LEE. La
carpeta llega por argumento: la memoria vive fuera del repo y el guion no sabe dónde.

| afirmación (por tramo: la línea partida por `·`, `|`, `;`, ` — `) | se comprueba con | si no se sostiene |
|---|---|---|
| `#N` + EN MAIN / MERGED / mergeado | `gh pr list --state all` (una llamada) | 🔴 FALSA |
| `#N` + ABIERTO | lo mismo | 🟡 CADUCADA (foto vieja, no alarma) |
| sha + EN MAIN | `git merge-base --is-ancestor <sha> origin/main` | 🔴 FALSA |
| sha + EMPUJADO / punta | `git branch -r --contains` | 🔴 FALSA |
| `` `ruta/con/carpeta.ext` `` + EN MAIN | `git cat-file -e origin/main:<ruta>` | 🔴 FALSA |

- Se quita antes lo citado entre «…» y "…": ahí la memoria cita lo que alguien dijo, muchas veces el
  error mismo («convertí "empujado" en "mergeado"»).
- No se juzga un tramo con negación (no, sin, falta, nunca) ni uno que diga EN MAIN y ABIERTO a la vez.
  Se cuenta aparte: mejor callar que inventar una falsedad.
- Un sha que no existe es FALSA sólo si el texto dice que es un commit (punta, commit, sha, `` `…` ``). Si
  no, se aparta como «¿id de sesión?». Medido: en la primera pasada salió FALSA `ed676fd1`, que era una
  transcripción y no un commit.
- Por defecto se juzgan `MEMORY.md` y `project_*` (el ESTADO). Con `--todo`, también las lecciones
  (`feedback_*`), que son historia.

**El control va DENTRO, en cada pasada, con las MISMAS consultas de verdad.** El último PR mergeado en
`main`, afirmado ABIERTO, tiene que salir CADUCADA. La punta de `origin/main`, afirmada EN MAIN, tiene
que salir bien. Un commit que no existe, afirmado EN MAIN, tiene que salir FALSA. Si no los clava, sale 2.

**Salida:** 0 = se sostiene (las caducadas se enseñan) · 1 = alguna FALSA · 2 = NO PUDE MIRAR. Sale 2 si
no hay carpeta o ficheros, si no reconoce ninguna afirmación, si el `fetch` falla, si `gh` no contesta o
si el control no caza. El 2 gana al 1.

**Lo que NO cubre, y lo dice en cada salida:** el estado de un ticket en Jira (no hay credencial); **una
afirmación que atribuye un hecho a la pieza EQUIVOCADA** («lo vio X» cuando lo vio Y), que es la que más
ha mordido y no sale de un patrón de texto; ni cifras ni fechas.

### Comprobado
| corrida | resultado |
|---|---|
| contra la memoria REAL (73 ficheros, por defecto) | 175 juzgadas: **0 FALSAS**, 19 CADUCADAS (PR que la memoria daba por ABIERTOS y ya entraron), 1 apartada (`ed676fd1`, id de sesión) · control 3/3 · salida 0 |
| lo mismo con `--todo` | 178 juzgadas, 0 FALSAS, 20 CADUCADAS |
| **una COPIA de la memoria real con dos mentiras plantadas**: un PR que existe y está ABIERTO (#2577) dado por EN MAIN, y un commit empujado pero no mergeado (`c7b65d83`) dado por EN MAIN | **las dos salen FALSAS, con su fichero y su línea · salida 1**. La copia se borró después |
| test nuevo (sin red: consultas dobladas, extractor, juez y control de verdad) | 16/16 |
| mutación: el control no tumba la pasada | cae «EL CONTROL DE DENTRO» |
| mutación: un PR ABIERTO cuenta como EN MAIN | caen «EL CASO QUE LO HIZO NACER» y «sale 1 y la NOMBRA» |
| `scrum723` | declaradas sus tres órdenes y su mención fuera de los argumentos, con motivo y quién las retira (su sujeto es la punta) |
| `scrum824`, `scrum836`, `scrum381` | 824 en verde. 836 y 381 caen sólo por el `dist/` de un árbol nuevo sin compilar (`scrum608`, «el fichero NO EXISTE») |

Una prueba que se buscó y salió al revés: la primera mentira plantada fue «#2552 EN MAIN». No salió FALSA
porque #2552 ya se había mergeado mientras tanto. Era verdad, y el guion acertó.

### Con esto, el recuento de arriba
La pieza 8 pasa a **HECHA como script, sin rutina**. Nadie la corre sola todavía: correrla en cada turno
(o desde el latido) es decisión del orquestador. Queda **sin hacer** la 7.
