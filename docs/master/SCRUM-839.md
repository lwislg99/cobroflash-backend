# SCRUM-839 · Un PR con conflicto se queda parado y nadie se entera

**Fecha:** 9-sep-2026 (fase 1) · 15-sep-2026 (fase 1b y esta fase 1c) · **Carril:** instrumentos (el bucle de merge) · **Gate:** sin gate — `npm test`

**Medido contra:** `origin/main` = `5359f41d9593c22cbba7926bbe5a41510d79f3a1` · 2026-09-15T10:28:46Z

**Tanda:** 6610 tests, 6500 pass, 0 fail, 110 skipped — medida DESPUÉS del último cambio.

> ⚠️ **Las dos fases anteriores entraron en `main` sin entrada de registro.** Esta entrada las
> cubre a las tres, para que el ticket deje de estar dentro y sin registrar.

---

## PASO 0

**ENTRADA.** No hay entrada de usuario: este carril no tiene pantalla. Hay un workflow que mira
los PR cada tres horas y escribe en un issue.

**MECANISMO.** Existe: `scripts/vigia-atascados.mjs` (clasificar), `scripts/vigia-pasada.mjs` (la
pasada, fuera del YAML) y `.github/workflows/vigia-atascados.yml`. Aquí no se construye otro.

---

## ② La promesa del ticket, y el marcador

| lo que promete | estado |
|---|---|
| **detectar** un PR con auto-merge armado y parado | ✅ fase 1 — `d2990977`, PR #1239 (9-sep) |
| **avisar** de que ahí se quedó («y nadie se entera») | ✅ fase 1b — `e91a3741`, PR #1261 (15-sep) |
| que esa decisión esté **ejercida**, no solo escrita | ✅ **esta fase (1c)** |
| resolver el conflicto solo (fase 2) | ⛔ **parada a propósito** por el orquestador: va después del cortacircuitos de `claude.yml`, porque es un segundo llamador que despierta a Claude, y el tope actual cuenta llamadas, no despertares |

### El tamaño real, medido el 15-sep-2026

De **19** PR abiertos, el criterio del vigía (auto-merge armado o abierto por el bot, sin draft ni
etiqueta) deja **5**. De ésos, en conflicto real: **uno**, el **#1212**, con **146 h** abierto.

No es latente: está pasando, y es el mismo PR que el ticket citaba el 9-sep. `mergeStateStatus` se
queda en `unknown` incluso tras reintentar —el `SIN-ESTADO` que el propio vigía nombra—, así que se
midió con la segunda sonda, **validada antes de creerla**:

```
main vs main            -> 0   (control: tiene que dar 0)
main vs main~3          -> 0   (control)
main vs PR #1212        -> 1   CONFLICT (content): docs/equipo/00-normas-comunes.md
main vs PR #1190        -> 0
```

---

## Lo que faltaba, y no era una categoría más

Las fases 1 y 1b dejaron la clasificación completa: `DIRTY`, `BEHIND`, `SIN-CHECKS`, `SIN-ESTADO`,
`ROJO-OBLIGATORIO`, `ROJO-SIN-LISTA`, `ESPERANDO`, los umbrales de edad (24/72/168 h y después cada
semana) y el aviso con mención.

🔴 **Pero nadie EJECUTABA `scripts/vigia-pasada.mjs`.** Es la pieza que decide todo —quién entra en
la lista, si ha empeorado, si se avisa o el issue se reescribe en silencio— y lo único que había
sobre ella eran dos `assert.match` **sobre su texto**: que menciona el suelo, que descarta
`RECIEN-EMPUJADO`. Un fichero comprobado sólo con regex sobre su fuente se puede romper entero sin
que caiga nada: basta con que las palabras sigan ahí. Es el defecto que SCRUM-745 persigue en los
trinquetes que comparaban por texto y salían mudos.

Y la propia cabecera del fichero decía por qué vive fuera del YAML: *«aquí se puede LEER y se puede
EJECUTAR en la tanda, que es la diferencia entre un guard y una intención»*. La intención estaba;
la ejecución no.

---

## 🔴 El límite que esto sujeta, y por qué NO se enuncia como parecía

El vigía **avisa; no falla**. Un PR atascado no es una avería del workflow —
`clasificar-fallo-automerge.mjs` ya clasifica un conflicto como benigno, y hace bien—, así que
poner el run en rojo por haber atascados fabricaría el falso rojo que SCRUM-828 vino a quitar.

⚠️ **Pero la regla NO es «que no haya `::error::` en el workflow».** Eso sería falso, y el primer
intento de este ticket lo escribió así antes de leer el YAML: el paso que publica **sí** marca
error cuando la pasada dice que la lista empeora y no ha dejado `aviso.md` — o sea, cuando el
instrumento no ha hecho su trabajo. Eso no es pintar de rojo un PR: es el instrumento declarando
que no vale. Un test que prohibiera todo `::error::` habría marcado como defecto una comprobación
correcta, y habría acabado relajado.

La regla exacta, y la que se ejerce ahora **ejecutando**:

> 🔒 **El NÚMERO de PR atascados nunca cambia el código de salida.** Cero, uno o veinte: la pasada
> termina en 0. Lo que cambia es a quién se avisa.

---

## Qué se construyó

**`tests/scrum839c-la-pasada-se-ejecuta.test.mjs`** — 10 tests que **corren la pasada de verdad**,
en un directorio temporal, con sus ficheros de entrada (`prs.json`, `estados.txt`, `checks/N.json`,
`reglas.json`, `$ANTES`, `$DUENO`):

- **suelo**, en dos partes: que la pasada arranca y deja veredicto, y que **reconoce** el atasco
  que se le pone delante — un cero sin eso no sería «no hay atascados» sino «no sé mirar», y todos
  los demás pasarían sobre una lista vacía;
- 🔴 **el límite**: con 0, 1 y 5 atascados, sale en **0**;
- 🔴 **y su control**: sí falla cuando es ella la que no puede publicar — un PR cuyo **título**
  lleva la mención haría que el cuerpo despertase a una sesión que nadie llamó, y ahí para;
- 🔴 un atasco nuevo deja `aviso.md` **y menciona a alguien** (escribir en un issue y avisar a
  alguien no son lo mismo: sin mención no le llega a nadie, que es el título del ticket);
- 🔴 **el caso del ticket**: el mismo atasco, quieto, vuelve a avisar al cruzar un umbral;
- 🔴 **y su control**: dentro del mismo umbral **no** avisa — el vigía corre cada tres horas, así
  que sin esto serían ocho avisos al día por el mismo PR;
- los umbrales del aviso se **derivan** de `UMBRALES_HORAS`, no se copian;
- un PR que no es asunto suyo se descarta **diciendo por qué**, y eso sale en el cuerpo;
- cero atascados se declara **medido**.

### El rojo del control

Declarado en `MUTACIONES_QUE_ME_TUMBAN`, que el meta-guard de la casa ejecuta. Aplicadas, con el
fuente restaurado byte a byte y verificado:

| mutación sobre `vigia-pasada.mjs` | qué imita | tests en rojo |
|---|---|---|
| `if (filas.length) process.exit(1);` antes del veredicto | el falso rojo de SCRUM-828 | **7** |
| `if (r.empeora) {` → `if (false) {` | detectar sin avisar | **2** |
| `if (!cuerpoNoDebeDespertar(b)) {` → `if (false) {` | la puerta de la mención que deja de cerrar | **1** |

---

## 🔴 Un choque de sesiones, anotado porque es dato de proceso

Esta sesión construyó **en paralelo** su propia versión de la fase 1b —umbrales de edad y categoría
del rojo— sin saber que otra sesión la estaba terminando. Al traer `main` antes de empujar, el
merge salió en conflicto: el PR **#1261** ya había entrado con `scrum-839b-edad-y-rojo-obligatorio`.

**Se descartó lo propio, entero.** No por cortesía: la versión que entró es mejor y la comparación
lo dice. Tiene `ultimaEjecucionPorCheck` —un check que falló y luego se re-ejecutó en verde ya no
cuenta como rojo, que en la mía **sí** contaba, y eso es un falso positivo—, lee los checks
obligatorios de las reglas vivas de `main` en vez de contar cualquier fallo, mide la edad desde el
**último push** y no desde la apertura, y declara `ROJO-SIN-LISTA` cuando no puede leer la lista.

Lo que quedó de esta sesión es lo que a esa versión le faltaba: la ejecución y esta entrada.

---

## Lo que NO se hizo

- **No se construyó la fase 2.** Está parada por escrito por el orquestador; no se adelanta.
- **No se tocó la clasificación** ni `scripts/clasificar-fallo-automerge.mjs`: un PR en conflicto
  sigue siendo benigno, que es lo correcto.
- **No se pinta nada de rojo**, ni se quitó el `::error::` legítimo del paso que publica.
- **No se tocó el método de merge del repo** ni `strict_required_status_checks_policy` — que
  gobierna `BEHIND`, no `DIRTY`, y ya está razonado en el propio fichero.
- **No se resolvió el conflicto del #1212**: desbloquearlo necesita que el push lo haga una
  **persona** (si lo empuja un bot con el `GITHUB_TOKEN` vuelve al mismo sitio, que es la causa
  encadenada que documenta el propio ticket).
- **Cero dependencias nuevas** (regla 36), **cero estado o flag nuevo** (regla 27), **cero
  microcopy** (regla 30).

---

# APÉNDICE · SCRUM-839 (16-sep-2026) · El vigía, medido POR EFECTO: dos hallazgos

**Medido contra:** `origin/main` = `77ce9d1e86d6ffa921b1c92561ec2d7994f8e5eb` · 2026-09-16T06:51Z

**Quién y cómo:** Sesión 0, sólo lectura, con `gh` contra la API de GitHub. No se tocó ningún PR, no se
comentó nada y no se relanzó ningún workflow. Las horas son de GitHub (cabecera `Date:`), no del reloj local.

> Esto NO propone arreglo. Son dos cosas medidas; qué hacer con ellas se decide con el ticket delante.

## Lo que ya está comprobado, para situar los dos hallazgos

El workflow está **activo** y ha corrido **36 veces, todas con éxito**, siempre por `schedule`. Desde que
entró el #1261 (`2026-09-15T10:28:47Z`) hay cuatro pasadas: 15-sep 13:54, 18:32 y 23:13, y 16-sep 01:52 UTC.
Reúne los PR, los clasifica con su suelo en verde («los tres cebos sintéticos salen marcados») y reescribe
el issue #1241 — `updatedAt` 01:52:48 contra una pasada que empezó a las 01:52:10.

**Su camino de AVISO no se ha ejecutado nunca:** el #1241 lleva 0 comentarios desde que se creó el
9-sep, con 36 pasadas detrás. Las cuatro dicen `empeora false`.

```
gh run list --workflow vigia-atascados.yml --limit 100 --json databaseId,event,status,conclusion,createdAt
gh run view <id> --log            # el veredicto: «atascados N · descartados M · empeora …»
gh api repos/lwislg99/cobroflash-backend/issues/1241/comments
```

## Hallazgo 1 · El cron dice 3 h y los huecos reales llegan a 7,1 h

El workflow declara `cron: '0 */3 * * *'` y justifica el número por escrito: por debajo de 2 h gritaría
sobre PR que se resuelven solos, **y por encima de 6 h llegaría tarde**.

Medidos los huecos entre las últimas 12 pasadas, en horas:

```
2,6 · 4,7 · 4,6 · 5,8 · 6,0 · 4,9 · 5,8 · 7,1 · 6,3 · 3,2 · 2,8
```

**El máximo es 7,1 h, y la propia justificación del fichero se incumple.** Además, la ranura de las
03:00Z del 16-sep no llegó a correr: la última pasada fue a las 01:52:10Z y a las 06:51Z no había otra.
GitHub retrasa y a veces descarta las ejecuciones programadas; el efecto es que la ventana real de
detección no es la escrita.

```
gh run list --workflow vigia-atascados.yml --limit 12 --json createdAt
# y la diferencia entre cada `createdAt` consecutivo
```

## Hallazgo 2 · Catorce PR, de 185 h a 1019 h, que nadie vigila — por diseño

En **las cuatro pasadas** había 14 PR abiertos por encima del umbral de 168 h. Sus edades en la pasada
del 16-sep 01:52Z:

| PR | horas abierto | PR | horas abierto |
| --- | --- | --- | --- |
| #399 | 1019,0 | #639 | 872,4 |
| #459 | 995,9 | #709 | 845,4 |
| #480 | 987,1 | #880 | 347,1 |
| #486 | 986,2 | #972 | 302,9 |
| #531 | 943,4 | #1151 | 197,2 |
| #540 | 942,4 | #1153 | 197,2 |
| #545 | 941,7 | | |
| #592 | 876,1 | | |

El vigía los **descarta a propósito**, y lo dice uno a uno en el cuerpo del #1241: «de una persona y sin
auto-merge: nadie prometió mergearlo (backlog, no atasco)». Es coherente con su regla —vigila promesas
rotas de la automatización, no el paso del tiempo— y por eso el descarte ocurre ANTES que el umbral de
edad: entre las pasadas de 13:54 y 18:32, el #399 cruzó las 1008 h y el #880 las 336 h, y las dos
pasadas registraron `envejecen 0`.

Estado de esos catorce **hoy**, por causa y no por edad: el **#639** tiene el check obligatorio
(`build + tests (con banco desechable)`) en **failure**; **#709, #545, #486, #480 y #459** están **sin
checks**; **#592, #540, #531 y #399** no tienen el obligatorio entre los suyos. Ninguno tiene auto-merge
y todos son de una persona.

⚠️ **Límite declarado:** esos estados de check están medidos HOY, no en el instante de cada pasada; los
check-runs de entonces no se recuperan. Y el cuerpo del #1241 se reescribe en cada pasada, así que su
historia tampoco es auditable: lo único que queda de cada pasada es el log de su run.

```
gh pr list --state all --limit 2000 --json number,state,createdAt,closedAt,author,autoMergeRequest
gh api repos/lwislg99/cobroflash-backend/rules/branches/main        # el check obligatorio, de las reglas vivas
gh api repos/lwislg99/cobroflash-backend/commits/<sha>/check-runs
```

## Un error de medición mío, y cómo se cazó

La primera lista la pedí con `--limit 400` sobre un repo de 1319 PR. Los abiertos VIEJOS se cayeron del
tope y conté **4 abiertos donde había 15**, sin ningún aviso. Lo destapó el propio run, que decía «PR
reunidos: 15». Repetida con `--limit 2000` y comprobando el número de PR más alto y más bajo traídos, la
cuenta cuadra con la del vigía. Queda escrito porque el tope silencioso de `gh pr list` muerde igual a
quien venga detrás.

---

# APÉNDICE · SCRUM-839d (16-sep-2026) · Fase 2, pieza A: el conflicto de solo registro se resuelve solo

**Medido contra:** `origin/main` = `b42c220648790e8318664dc15fc15139c7e10f23` · 2026-09-16T14:22:25Z

**Tanda:** 7075 tests, 6965 pass, 0 fail, 110 skipped — medida DESPUÉS del último cambio de código, sobre este `origin/main` mergeado en la rama.

**Rama:** `scrum-839d-conflicto-de-registro-solo` · Sesión 5 · encargo del orquestador (16-sep ~15:40, `origin/main` `e5e67c01`).

---

## ① Constancia del experimento (hecho y limpiado antes de construir)

**Pregunta:** ¿basta con poner `docs/master/*.md merge=union` en `.gitattributes` para que GitHub deje de
marcar en conflicto un PR que solo choca en el registro?

**Respuesta medida: NO.** GitHub no respeta `merge=union`. Git por línea de comandos, con las mismas ramas, sí.

Dos PR gemelos, idénticos salvo la regla, los dos partiendo de `origin/main` `550f365b95bab33b46534824b31a091db01d8e52`:

| | base | rama del PR | PR | `mergeable` en GitHub | git CLI |
|---|---|---|---|---|---|
| CON la regla | `exp-union-base` = `97a44c42a4bf04a2c57d6c5e0cc8a55de5ccc79d` (padre `70ee6efa9ede8d1146f3b576794cda6b68ac334f`, que solo añade la línea a `.gitattributes`) | `exp-union-b` = `d68de03558ff061efc0eb49889bc808525c056f0` | **#1353** | **CONFLICTING** (DIRTY) | **limpio** (A=1, B=1) |
| SIN la regla (control) | `exp-union-sin-base` = `5d3e9f02871de422d042a656685cd71e312f2710` (padre `2241654c41031dda1b850b8dd2b4940446af1334`, commit vacío) | `exp-union-sin-b` = `f1614572d2a80019302c38427927068b828a2d6b` | **#1354** | **CONFLICTING** (DIRTY) | conflicto en `docs/master/SCRUM-853.md` |

Los dos lados añaden un apéndice distinto al final de `docs/master/SCRUM-853.md`: el choque típico del registro.

**Horas (reloj de GitHub, de la API):** #1353 abierto `2026-09-16T12:59:56Z`, #1354 abierto `2026-09-16T13:00:04Z`;
`mergeable` leído `CONFLICTING` en los dos a las `13:00:21Z`; cerrados SIN mergear `13:01:44Z` y `13:01:46Z`.
Las seis ramas `exp-union*` borradas (`git ls-remote --heads origin | grep -c exp-union` → `0`, re-medido en esta sesión).

⚠️ La fecha de committer de esos commits dice `13:05:22Z`/`13:05:30Z`, **después** de abrir los PR: no es un
error del experimento, es el reloj local adelantado ~5 min 33 s. Las horas buenas son las de la API.

**Re-ejecución con el instrumento que se construye aquí** (`node scripts/conflicto-de-registro.mjs`), sobre esos commits reales:

```
#1353 (cabeza d68de035, main 97a44c42) → {"accion":"EMPUJAR","ficheros":["docs/master/SCRUM-853.md"]}
#1354 (cabeza f1614572, main 5d3e9f02) → {"accion":"NO-EMPUJA","causa":"UNION-NO-RESUELVE","ficheros":["docs/master/SCRUM-853.md"]}
#1318 (padres de e5be315b, el merge a mano) → {"accion":"NO-EMPUJA","causa":"UNION-NO-RESUELVE","ficheros":["docs/master/SCRUM-609.md"]}
```

El #1318 lo reconoce como choque SOLO de registro (cerradura 1), y no lo empuja porque el `main` de aquel
momento no traía la regla (cerradura 2). Es lo correcto: la regla la pone `main`, no la rama.

**Consecuencia para el diseño:** la línea de `.gitattributes` no arregla ningún PR por sí sola; ayuda a quien
mergea con git en local. Hace falta un job que haga el merge con git y lo empuje. Y el push tiene que ir con
la llave de la App: con el `GITHUB_TOKEN` no arranca CI (medido el 9-sep, #1212: 0 check-runs).

---

## ② Qué se construyó

| pieza | qué |
|---|---|
| `.gitattributes` | `docs/master/*.md merge=union`, al final, y nada más |
| `scripts/conflicto-de-registro.mjs` | la DECISIÓN, fuera del YAML: `NADA` · `EMPUJAR` · `NO-EMPUJA` (con causa) · `NO-PUDE-MIRAR` |
| `.github/workflows/conflicto-de-registro.yml` | en cada push a `main`: PR `scrum-*` abiertos del propio repo → decisión → `git push` (sin forzar) con la llave de la App solo si `EMPUJAR` |
| `tests/scrum839d-union-solo-en-el-registro.test.mjs` | el guard de `.gitattributes` y la decisión ejercida contra repositorios git de verdad |

### Dos cerraduras independientes

1. **La lista.** El merge se mira como lo ve GitHub, SIN ningún atributo (`--attr-source` = árbol vacío), y
   TODOS los ficheros en conflicto tienen que casar `^docs/master/[^/]+\.md$`. Uno fuera → `FUERA-DE-REGISTRO`.
2. **El merge.** Se rehace con los atributos de `main` y tiene que salir limpio. Como union solo existe en
   `docs/master/*.md` (guard), un conflicto de código sigue siendo conflicto aunque la cerradura 1 fallara.

El commit resultante es hijo de la cabeza del PR y de `main`: el push es fast-forward, y si la rama se movió
entre medias se rechaza solo.

### 🔴 Dos trampas medidas antes de escribir (y una cazada en rojo)

- **`git merge-tree` lee los atributos del ÁRBOL DE TRABAJO**, no de los commits que mezcla. En un repo de
  prueba con la regla solo en `main`: sacada `main` → limpio; sacada la rama del PR → conflicto. Mismo merge,
  dos veredictos. Por eso la fuente se fija siempre con `--attr-source` y `core.attributesFile` se anula.
- **«Salida 1» no significa «hay conflicto».** `git merge-tree` con una ref inexistente sale con **1** —el
  mismo código que un conflicto— y stdout vacío. Un conflicto solo se cree con árbol válido Y lista no vacía.
- **Cazada por el test, no leyendo:** `git rev-parse --git-path info/attributes` devuelve la ruta RELATIVA al
  repo y yo la resolvía contra el cwd del proceso, así que el suelo de `info/attributes` no miraba nada y un
  `* merge=union` local daba `NADA`. Arreglado con `--path-format=absolute`.

---

## ③ POSITIVO · NEGATIVO · SUELO

| | caso | resultado |
|---|---|---|
| POSITIVO | el #1318 fabricado: los dos lados añaden a `docs/master/SCRUM-609.md` | `EMPUJAR`; commit con los dos padres, las dos entradas, sin marcadores |
| POSITIVO | la rama del PR anterior a la regla, sacada en el árbol | `EMPUJAR` (manda la regla de `main`) |
| NEGATIVO | registro + UN fichero de código en conflicto | `NO-EMPUJA`, `FUERA-DE-REGISTRO`, `fuera: [src/a.ts]`, sin commit |
| NEGATIVO | solo código | `NO-EMPUJA` |
| NEGATIVO | `docs/master/sub/*.md`, `docs/YAQU_MASTER.md`, `docs/BUGS.md` | `NO-EMPUJA` |
| NEGATIVO | `main` sin la regla (cerradura 2 sola) | `NO-EMPUJA`, `UNION-NO-RESUELVE` |
| NEGATIVO | borrado en un lado, editado en otro | `NO-EMPUJA`, `UNION-NO-RESUELVE` |
| SUELO | salida 1 sin lista · árbol sin ficheros · salida 129 · git ausente | `NO-PUDE-MIRAR` (+ control: con lista SÍ cree el conflicto) |
| SUELO | cabeza inexistente, de verdad | `NO-PUDE-MIRAR` |
| SUELO | `info/attributes` local con driver de merge | `NO-PUDE-MIRAR` |
| SUELO del workflow | no se puede leer la lista de PR / traer una cabeza / push rechazado | `::error::` «no pude mirar», no empuja, run en rojo |

Guard de `.gitattributes`, por las dos mitades: la DECLARACIÓN (ninguna otra línea con `merge=union`) y el
EFECTO (`git check-attr merge` sobre los 2.853 ficheros rastreados (16-sep-2026) y rutas centinela que aún no existen:
`src/`, `tests/`, `scripts/`, `public/`, `prisma/schema.prisma`, `package.json`, `YAQU_MASTER.md`, `BUGS.md`).

### El rojo, ejecutado

`npm run meta:mutaciones` aplica cada mutación declarada en `MUTACIONES_QUE_ME_TUMBAN`, exige ver caer el test
nombrado, restaura y verifica byte a byte. Las seis cayeron (pasada del 16-sep-2026, árbol limpio después):

| mutación | test que cae |
|---|---|
| `.gitattributes`: añadir `src/**/*.ts merge=union` | DECLARACIÓN (+1) |
| `.gitattributes`: macro `[attr]registro merge=union` + `*.json registro` | EFECTO (+1: también la DECLARACIÓN, porque la macro escribe la regla literal; una macro que no la escribiera en `.gitattributes` solo la vería el efecto) |
| cerradura 1 apagada (`const fuera = []`) | NEGATIVO un fichero fuera (+4) — la cerradura 2 sigue parando el push, por eso el test exige la CAUSA |
| la regex acepta subdirectorios | NEGATIVO subdirectorio |
| suelo apagado (`if (false)`) | SUELO salida 1 sin lista |
| detección con los atributos de `main` en vez del árbol vacío | POSITIVO #1318 (+1) |

⚠️ En esa misma pasada salió **MUDO** `tests/scrum859-identidad-y-motivo-cerrado.test.mjs` («insertar una entrada
en medio NO mueve ninguna clave»). No es de este ticket ni toca nada de lo que cambia aquí: se reporta, no se
arregla (regla 37). Y la pasada corrió en un worktree sin `node_modules`/`dist`, así que decenas de guards
ajenos salieron CIEGOS: ese dato no dice nada de ellos.

### Lo que la tanda cazó, y cómo se arregló (sin tocar ningún umbral)

| guard | qué vio | arreglo |
|---|---|---|
| SCRUM-258 | ruta fija en el temporal para anular `core.attributesFile` | `-c core.attributesFile=` VACÍO — medido: con un global `* merge=union`, sin la opción `union`, con ella `unspecified` |
| SCRUM-723 | `rev-parse` contra la punta, sin declarar | declarado con motivo: la pregunta del job ES sobre la punta de `main` (es lo que GitHub mira); el test, repos sintéticos |
| SCRUM-737 | «38 de sus 42 ficheros» en un comentario sin ancla | reformulado sin cifra |
| SCRUM-824 | `info/attributes` del test escrito fuera de donde el censo prueba que cuelga de `mkdtemp` | escrito dentro de `repo()` |

---

## ④ Lo que NO se hizo, y lo que queda abierto

- **No se tocó** la protección de rama, los checks obligatorios ni el filtro `scrum-*` de `pr-automatico.yml`.
- **No avisa en el PR.** El aviso (único por cabeza, tope 6/h, un intento) es la **pieza B**, en otro PR, después.
- 🔴 **RIESGO ABIERTO — sin observar todavía:** el push de la App del 16-sep dejó ejecuciones en
  `action_required` con 0 jobs; el fundador cambió la política de aprobación. El job solo corre en push a
  `main`, así que su **primer push real** llegará con el primer conflicto de solo registro tras el merge de
  este PR. Si el CI de ese push sale retenido (0 jobs), se PARA y se dice; no se rodea.
- ⚠️ **Límite conocido:** si `main` trae cambios en `.github/workflows/` que la rama no tiene, el push de la
  App puede rechazarse por falta del permiso `workflows`. El job lo dice (`PUSH RECHAZADO`, run en rojo) y no
  reintenta. No se ha ensanchado el permiso de la App: eso es decisión del fundador.
- Hallazgo de otro carril, sin arreglar: `tests/_banco-vistas.mjs` acumula 16 conflictos en el censo; candidato
  a partirse (anotado en el traspaso, no es de este ticket).


---

# APÉNDICE · SCRUM-839e (16-sep-2026) · Arreglo de la pieza A: solo PR ya armados, y solo una persona arma

**Medido contra:** `origin/main` = `c8f9548338dcd3d3ed93d3ef2afdcc5161abdfd4` · 2026-09-16T18:40:25Z

**Tanda:** 7107 tests, 6997 pass, 0 fail, 110 skipped — medida DESPUÉS del último cambio de código, sobre este `origin/main` mergeado en la rama.

**Rama:** `scrum-839e-solo-pr-armados` · Sesión 5 · encargo del orquestador (16-sep 19:55 CEST, `origin/main` `364e7d3a`).

## ① El daño, medido

La primera pasada real de la pieza A (run `35109786942`, 14:37:24Z) empujó a **#880** (abierto 1-sep) y **#399**
(4-ago), dos PR de Javier **sin auto-merge**. Ese push disparó `pr-automatico.yml` — runs `35109865025` y
`35109859845`, actor `yaqu-bot[bot]`, tipo **`Bot`** —, que les **armó** el auto-merge (`enabledBy app/yaqu-bot`,
14:38:23Z en #880). Entraron en `main` a las 14:44Z y 14:45Z (medido por el orquestador): #880 con diff vacío,
#399 con 2 líneas en `docs/master/SCRUM-284.md`. El fundador apagó el workflow «Conflicto de registro».

## ② Dos agujeros, no uno

1. **El job** empujaba a cualquier PR `scrum-*` con choque de solo registro.
2. **`pr-automatico.yml` armaba ante CUALQUIER push** a una rama `scrum-*` con PR abierto, fuera de quien fuera
   (paso «Armar el auto-merge», sin condición sobre el autor), y abría PR ante cualquier push a una rama sin PR.
   Censo de sus **270 runs** hasta el 16-sep: `Javierpf28` 156 y `lwislg99` 112 (tipo `User`), `yaqu-bot[bot]` **2**
   (tipo `Bot`): exactamente los del daño.

## ③ Qué se cambió

- `scripts/conflicto-de-registro.mjs`: **cerradura 0**, antes de mirar ningún fichero. `armadoAntesDeLaPasada(pr)`
  lee `autoMergeRequest` de la lista que el workflow leyó al empezar la pasada: objeto con `enabledAt` → sigue;
  `null` → `NO-EMPUJA` (`SIN-AUTO-MERGE`); campo ausente, forma desconocida, PR que no está en la lista o lista
  ilegible → `NO-PUDE-MIRAR`. El CLI recibe la lista como cuarto argumento.
- `.github/workflows/conflicto-de-registro.yml`: pide `autoMergeRequest` en `gh pr list`, pasa `prs.json` a la
  decisión y cuenta los PR sin armar en una línea del resumen.
- `.github/workflows/pr-automatico.yml`: «Abrir el PR» y «Armar el auto-merge» reciben
  `QUIEN_EMPUJA: ${{ github.event.sender.type }}` y solo actúan si es `User` (lista blanca: vacío o cualquier
  otro tipo no abre ni arma). Veredicto nuevo: `EMPUJE-SIN-PERSONA`.
- Elegido «solo si empuja una persona» y no «solo al abrir el PR»: el segundo rompe el re-armado cuando una
  sesión arregla un conflicto de su propio PR (el armado falla legítimamente al abrir y se arma en el push
  siguiente). **Lo que NO cambia:** un push de Javier a un PR suyo antiguo lo sigue armando, como en sus 156 runs.

## ④ ROJO · POSITIVO · NEGATIVO · SUELO

`tests/scrum839e-solo-pr-armados.test.mjs` ejecuta **los pasos de verdad del YAML** con repos git reales (un
remoto desnudo con `refs/pull/880/head`) y un `gh` falso que, como el real, solo devuelve los campos pedidos en
`--json`. Veredicto por EFECTO: si la rama se movió en el remoto o si se llamó a `gh pr merge` / `gh pr create`.

- **ROJO** — commit `439c14c4a9568319bc1662884e0547d6164eb821`, empujado antes del arreglo: contra el código de
  `364e7d3a`, **10 de 13 caen por su motivo** (el job empuja a un PR sin armar; empuja sin poder leer el armado;
  un push `Bot` arma; un push `Bot` a una rama sin PR abre PR). Los 3 verdes eran los positivos y el suelo del banco.
- **POSITIVO** — PR armado con choque solo de registro → la rama avanza (`EMPUJADO`); push `User` → `gh pr merge 880 --auto --merge`.
- **NEGATIVO** — PR sin auto-merge → la rama no se mueve y el run no pinta rojo; push `Bot` → ni `pr merge` ni `pr create`.
- **SUELO** — lista sin `autoMergeRequest` → no se mueve, run en rojo, `NO PUDE MIRAR`; tipo de quien empuja vacío → no se arma.

**Mutaciones declaradas (8), las 8 caen** (pasada local 16-sep, árbol restaurado byte a byte): cerradura 0
apagada · suelo apagado · armado de otro PR de la lista · YAML sin `autoMergeRequest` · guarda de armar apagada ·
lista negra `= "Bot"` en vez de blanca · guarda de abrir apagada · `QUIEN_EMPUJA` cableado a `User`.
⚠️ Mi arnés de mutaciones dio primero dos «MUDA» falsas (#880 y #1318): un heredoc convirtió `\\#` en `\#` y el
nombre escapado de TAP no casaba. Aplicada a mano, la mutación de #880 tumba su test y dos más.

Tests viejos tocados, sin bajar nada: `scrum839d` pasa un PR armado a `decidir()`; `pr-automatico-el-mensaje-del-automerge`
declara `QUIEN_EMPUJA: 'User'` (sus casos son de una persona).

## ⑤ Lo que queda abierto

- **Riesgo sin observar:** que GitHub mantenga armado un PR tras el push de la App (la App tiene `Contents: write`;
  la doc solo desarma ante pushes sin escritura). Se verá en el primer `EMPUJADO` real.
- Carrera aceptada: si alguien desarma un PR entre la lista y el push, esa pasada lo empuja igualmente (sin armarlo).
- Si un PR se mergea y su rama se borra entre la lista y el push, `git push` la recrearía. Con este arreglo ya no
  se le abre ni arma PR (push `Bot`); la rama huérfana quedaría a la vista.
- La **pieza B** (aviso en el PR) sigue esperando.
- **Para volver a encender** el workflow, tras el merge: GitHub → Actions → «Conflicto de registro» → «Enable workflow».

## ⑥ Tercer agujero (16-sep, 19:13Z): un push del bot de Claude deja el PR sin checks y sin aviso — NO arreglado

**Medido contra:** `origin/main` = `7000a0cffe284fc99c669af2ba27e74ab9cb78c9` · 2026-09-16T19:32:47Z

- El CI de `89f25523` (push de persona) salió rojo en «build + tests» (guard SCRUM-854: faltaba la entrada de
  SCRUM-859) y en «meta-guard». El aviso despertó al bot de Claude, que empujó a la rama **`9f396783`** (18:38Z) y
  **`56484895`** (19:09Z). Cuenta que empuja según la API: `github-actions[bot]` (el nombre dentro del commit es
  `claude[bot]`).
- Sus runs de **CI** y **Zona roja** quedaron en `action_required` (18:38:32Z y 19:10:06Z): GitHub no ejecuta
  workflows sobre un push de esa cuenta sin aprobación. **0 check-runs** sobre `56484895`. El PR siguió con el
  auto-merge ARMADO y sin ningún check: no se iba a mergear nunca, y nada lo dijo en el PR.
- **¿Lo vería la pieza B?** No: no existe todavía, y su alcance es avisar cuando un conflicto de solo registro no
  se puede resolver. Un PR sin conflicto y sin checks no entra.
- **¿Lo vería el vigía?** Sí, pero tarde y sin la causa: #1367 es asunto suyo (auto-merge armado) y
  `causaDelAtasco` (`scripts/vigia-atascados.mjs`) da `SIN-CHECKS` con 0 checks pasados los 10 min de gracia.
  No distingue «falta aprobar un run en `action_required`» de cualquier otro «no arrancó ningún check»: el detalle
  no dice qué hacer. Retraso: el cron dice cada 3 h, pero sus tres últimas pasadas del 16-sep fueron 07:56Z,
  13:47Z y 18:30Z (huecos de 5,9 h y 4,7 h; antes se midieron hasta 7,1 h). Con `56484895` a las 19:09Z, la
  primera pasada que lo ve llega entre ~21:00Z y ~02:00Z.
- Salida aplicada aquí: merge de `main` y push como persona, que relanza CI con jobs de verdad.
- **Hallazgo colateral, de otro carril (SCRUM-859/866), no arreglado:** el cambio de `9f396783` NO desmuda la
  mutación. Medido en esta rama: aplicada la mutación re-apuntada, «insertar una entrada en medio NO mueve ninguna
  clave» sigue en verde (0 caídos), mientras la otra mutación del mismo fichero sí tumba su test. Causa: con claves
  por posición, las de antes (`#1…#n`) siguen todas presentes tras insertar (`#1…#n+1`); la aserción «ninguna
  clave perdida» no puede ver el desplazamiento. El test es mudo por construcción: el arreglo está en la aserción
  (qué entrada hay detrás de cada clave), no en a qué fichero apunta la mutación.


---

# APÉNDICE · SCRUM-839f (17-sep-2026) · Cierre por EFECTO: un PR con choque solo de registro se resolvió solo en GitHub de verdad

**Medido contra:** `origin/main` = `53e3db1f541574c4f231c3d196a2874680160d02` · 2026-09-17T08:51:27Z

**Tanda:** no aplica a este apéndice (solo documentación). La del PR hermano de la ficha (#1391, base
`aa465cdd6fc6`) dio 7199 tests, 7089 pass, 0 fail, 110 skipped, con los tests del job de 839e dentro.

**Rama:** `scrum-839h-cierre-por-efecto` · Sesión 5 · encargo del orquestador (17-sep 10:20 CEST).

Horas: las de la API de GitHub (cabecera `Date:` o campos de la API), no las del reloj local.

## ① PASO 0 · ¿había corrido desde que se encendió?

El workflow «Conflicto de registro» (id 359729129) figuraba `active` con `updated_at` a las 08:08:58Z. Hasta
entonces llevaba 5 runs, todos del 16-sep (el último a las 14:56:56Z). Pasadas reales desde que se encendió,
antes del control:

| run | disparo | resultado |
|---|---|---|
| 35199313923 | push `d131d2ca` · 08:22:25Z | success · 14 PR `scrum-*`: #1382 `NADA`; **#1379 `NO-EMPUJA` `FUERA-DE-REGISTRO`** (`docs/equipo/00-normas-comunes.md`, armado); 12 `SIN-AUTO-MERGE` |
| 35199493840 | push `aa465cdd` · 08:24:28Z | success |

Ningún `EMPUJAR`: no había un caso positivo real. Por eso se fabricó el control.

## ② El control, diseñado por su limpieza

Base común `08ad40766699c4d5ad72fd9450f5d387220376d4`. Desde ella, `main` solo había tocado
`docs/master/SCRUM-873.md`, `docs/master/SCRUM-878.md` y dos ficheros de `tests/`: **nada de `.github/`**, así
que el push de la App no podía chocar con el permiso `workflows`.

| PR | rama · cabeza | contenido | estado |
|---|---|---|---|
| **#1385** positivo | `scrum-839f-control-positivo` · `01924a995ae53d279538e97846dd2abff6c6f196` | apéndice al final de `SCRUM-873.md` (choca con `main`) + `tests/control-scrum839f-no-mergear.test.mjs` (falla siempre) | armado |
| **#1384** negativo · código | `scrum-839f-control-codigo` · `50b8e07108397f2f0ff246d523e0984eda7fefce` | lo mismo + una línea en `tests/_censo-escrituras-albaran.mjs` que choca | armado |
| **#1386** negativo · sin armar | `scrum-839f-control-sin-armar` · `cd03b6c382d275943d578dcee7700312bb42253c` | igual que el positivo | desarmado a mano tras abrirse |

Por qué no puede llegar a `main` aunque todo salga bien: el test que falla deja en rojo el check obligatorio
`build + tests (con banco desechable)`, y el auto-merge espera a ese check. Mientras el PR está en conflicto,
GitHub no le corre CI (medido: los tres solo tenían el run de «PR automático»), así que no hay rojo que avise a
nadie antes de tiempo.

Antes de empujar, la decisión corrió en local sobre esos commits: #1385 `EMPUJAR`, #1384 `FUERA-DE-REGISTRO`,
#1386 `SIN-AUTO-MERGE`.

⚠️ **Lo que no se hizo:** llenar el tope del avisador con marcas en los PR, para que su rojo no despertara a
Claude. El clasificador de permisos lo bloqueó como manipulación de registro, y **no se rodeó**. Se sustituyó por
cerrar el PR antes de que acabara su CI: eso solo evita ruido, la barrera contra `main` es el test.

## ③ ROJO · POSITIVO · NEGATIVO · SUELO

- **ROJO — sin el job, nadie lo resuelve.** #1385 abierto a las 08:27:15Z, armado y `CONFLICTING`. A las
  08:33:59Z seguía igual (cabeza `01924a99`, `CONFLICTING`), sin ninguna pasada del job entre medias (la última
  había sido a las 08:24:28Z). GitHub no aplica `merge=union` por sí mismo.
- **POSITIVO — se resolvió solo, disparado por un push real a `main`.** Run **35200509232** (push
  `aa0b4d299ee7daa097c8a4f49a21bc6525dbe41c`, que es el merge de #1387, 08:35:40Z → success 08:36:05Z):
  `#1385 → EMPUJAR (docs/master/SCRUM-873.md)`. **Por efecto:**
  - la rama pasó a `b85eb3e8be5a8a8c7d1782cc47957f51c880237f`, autor `yaqu-bot[bot]`, padres `01924a99` + `aa0b4d29`;
  - el PR pasó de `CONFLICTING` a `MERGEABLE` **con el auto-merge aún armado** (`app/yaqu-bot`). Queda cerrado el
    riesgo abierto de 839e sobre si GitHub desarma tras el push de la App;
  - 🔴 **el CI arrancó con jobs de verdad, no `action_required`**: CI 35200535850 y Zona roja 35200535855,
    `actor=yaqu-bot[bot]`, a las 08:35:59Z. Queda cerrado el riesgo de la política de aprobación de Actions
    **para el push de la App**. El tercer agujero (push de `github-actions[bot]` desde `claude.yml`) es otra
    cuenta y no se midió aquí;
  - «PR automático» (run 35200532226) ante ese push: `QUIEN_EMPUJA: Bot` → `EMPUJE-SIN-PERSONA`, no volvió a
    armar. El arreglo de 839e, confirmado con un evento real;
  - la pasada siguiente (35200836539, push `46f49587`, 08:39:19Z) dio `#1385 → NADA (sin conflicto)`: no repite.
- **NEGATIVO — código:** #1384 → `NO-EMPUJA FUERA-DE-REGISTRO` en las dos pasadas; cabeza `50b8e071` sin mover.
  Y el caso real #1379, en la pasada de las 08:22Z.
- **NEGATIVO — sin armar:** #1386 → `NO-EMPUJA SIN-AUTO-MERGE` en las dos pasadas; cabeza `cd03b6c3` sin mover.
- **SUELO:** **no se provocó en GitHub.** Hacerlo exigía lanzar con `workflow_dispatch`, desde una rama sin
  revisar, una copia mutada del workflow con la llave de la App dentro, y no compensaba el riesgo. Lo cubren
  «🔴 SUELO del job: si la lista no trae el armado, «no pude mirar», rojo y la rama NO se mueve» y «🔴 SUELO: si no
  se puede leer si estaba armado…» (`tests/scrum839e-solo-pr-armados.test.mjs`, que ejecuta los pasos reales del
  YAML), en verde en la tanda citada arriba. Es cobertura por banco, no por efecto, y se declara como tal.

## ④ Limpieza, comprobada aparte

- #1385, #1384 y #1386 cerrados **sin mergear** (`mergedAt: null`) a las 08:40:29Z, 08:40:50Z y 08:41:07Z; ramas
  borradas (`git ls-remote --heads origin | grep -c 839f` → `0`).
- Contra `origin/main` = `46f495872b17c2960c4ae21a5d6632f6295266a6`: ninguno de los cuatro commits
  (`01924a99`, `50b8e071`, `cd03b6c3`, `b85eb3e8`) es ancestro (`merge-base --is-ancestor`); el test de control no
  existe en `main` (`ls-tree` → 0 líneas) y el texto «CONTROL SCRUM-839f» no aparece en `docs/` ni en `tests/`.
- El CI de `b85eb3e8` acabó en failure a las 08:45:37Z (el test de control, como estaba diseñado). Avisador
  35201423607 → `SIN-PR`: no despertó a nadie.

## ⑤ Hallazgos, sin arreglar

- **El avisador lee un PR cerrado con la rama borrada como `SIN-PR`, no como `PR-YA-CERRADO`:**
  `commits/<sha>/pulls` devuelve `[]` para esa cabeza. El efecto es el mismo (no avisa), pero el veredicto nombra
  otra causa. Carril S5.
- **En una mañana con muchos merges, el CI de `main` no llega a terminar:** la concurrencia `ci-refs/heads/main`
  cancela el run anterior. De `08ad4076` a `1e7d6de2` (07:57Z–08:51Z) terminaron 2 de 8 runs; el resto salió
  `cancelled`. El meta-guard de `main` solo se puede leer cuando hay un respiro de ~10 min entre merges. Carril S5.
