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
