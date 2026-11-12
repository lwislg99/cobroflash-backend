# SCRUM-1238 · El vigía llama MUERTA a una sesión que sólo esperaba

**Medido contra:** `origin/main` = `7ddab7d83ed9cc6c7c4b18e9d780f641c56fe1a6` · 2026-09-28T20:13:51Z (hora de la máquina, UTC)

Sesión J6 (`jv-j6`), 28-sep-2026 por la noche, por encargo del orquestador de Javier. **Este registro solo recoge
la medición; el arreglo espera una decisión.** No se toca `scripts/equipo/sesion.mjs` ni el vigía
(`scripts/vigia-sesiones-jv.mjs`), ni `.claude/`, ni la copia instalada. El orquestador lleva el arreglo
a Luis, porque `sesion.mjs` es el lanzador de los dos equipos (lo decidió el 28-sep por la noche, en su respuesta a J6).

## ① El defecto, reproducido

`node <instalación>/sesion.mjs estado`, a las 20:10Z, con la copia instalada (idéntica a `main` por su
`puertaDeIntegridad`). Estas 5 sesiones salen con `clasificacion: "MUERTA"` y el motivo «sin pid, y su
state.json dice que terminó». En realidad **esperan una decisión**: su `state.json` dice `state: "blocked"`
y lleva `needs` con las preguntas.

| id | nombre | `firstTerminalAt` | `needs` (resumido) |
|---|---|---|---|
| `6fcd298c` | `jv-j3` | 17:07:06Z | autorizar el push de SCRUM-1130 y SCRUM-1246; una variable de entorno de Windows |
| `094dbfef` | `jv-j5` | 16:51:08Z | 1. GO de SCRUM-1240 · 2. decisión sobre la clave 18 |
| `74b55567` | `jv-j4` | 18:43:26Z | 1. firmar L1–L6 de SCRUM-1196 · 2–4. panel de Cloudflare, facturación de Gemini, buzón |
| `4d9f556d` | `cobroflash-jv-j2 orchestrator` | 13:50:10Z | 1) aprobar el mensaje genérico por corte de red · 2) si las otras seis rutas llevan ticket |
| `70aed900` | `jv-orquestador bash read` | 13:38:46Z | aprobar el texto de privacidad; confirmar la configuración de Cloudflare |

`4d9f556d` es la J2 que a mediodía se dio por muerta y se sustituyó. Su `state.json` guarda incluso la
respuesta sugerida («el genérico por corte de red me vale, déjalo así»). Las tres `jv-*` de la tabla salen
**a la vez** en `bloqueadas` y en `restos` como MUERTA. Por eso el vigía (`sesionesQueAvisan`) las cuenta
dos veces, una como BLOQUEADA y otra como MUERTA.

## ② La causa: una línea de `estadoDeJob`

`scripts/equipo/sesion.mjs`, línea 691 de `origin/main`:

```js
return { leido: true, terminal: cuando !== null || ESTADOS_TERMINALES.includes(j.state), cuando, estado: j.state ?? null };
```

con `cuando = j.firstTerminalAt`. Claude Code rellena `firstTerminalAt` al terminar el **primer turno**,
no al morir. Por eso, en cuanto una sesión de fondo acaba un turno, `terminal` vale `true` diga lo que diga
su `state`, y `clasificarAgente` la declara MUERTA si además no tiene `pid`.

Una sesión que termina su turno esperando respuesta se queda sin `pid` igual que una muerta. Es lo mismo que
advertía el comentario de SCRUM-954: «una sesión viva también escribe `done` entre turno y turno».

## ③ La señal que sí las separa: el `state` del `state.json`

Recuento de los 74 `~/.claude/jobs/*/state.json` de la máquina (28-sep, ~20:10Z):

| `state` | nº | `needs` | `firstTerminalAt` | `lastTerminalAt` |
|---|---|---|---|---|
| `blocked` | 7 | 5 sí, 2 no | 5 sí, 2 no | **ninguno** |
| `done` | 42 | ninguno | todos | todos |
| `stopped` | 20 | ninguno | todos | todos |
| `failed` | 1 | no | sí | sí |
| `working` | 5 | no | no | no (las vivas de ahora, con `pid`) |

`firstTerminalAt` aparece en las dos poblaciones, así que no las separa. `state` sí las separa:
`blocked` es la clasificación que hace el propio Claude Code de «espera una respuesta».

## ④ El arreglo propuesto, medido y **no aplicado**

Una línea: que `terminal` salga solo del `state`.

```js
return { leido: true, terminal: ESTADOS_TERMINALES.includes(j.state), cuando, estado: j.state ?? null };
```

Medido en una copia de `sesion.mjs` de `origin/main` **fuera del árbol**. Se pasó `clasificarAgente`, que
está exportado, con la sonda de hoy y con la propuesta:

- **Contra la lista real** (`claude agents --json`, 13 de fondo): las 5 `blocked` con `needs` pasan de MUERTA
  a `NO-PUDE-MIRAR`. Las 2 `blocked` sin `firstTerminalAt` ya eran `NO-PUDE-MIRAR` y siguen igual. Las 6 con
  `pid` siguen VIVA.
- **Control positivo, contra los 74 `state.json`** (cada uno tratado como si no tuviera `pid`): las **63**
  `done`/`stopped`/`failed` siguen saliendo **MUERTA** (42 + 20 + 1). Las 7 `blocked` y las 5 `working`
  salen `NO-PUDE-MIRAR`.

El arreglo solo quita veredictos de MUERTA, nunca añade uno. Falla más cerrado que hoy, y un vigía con el
arreglo sigue diciendo muerta cuando lo está.

## ⑤ Hallazgo: `done` no garantiza que nadie espere

De las 42 `done`, **10** terminaron con un resumen que dice que esperaban algo, por ejemplo `406fdc1a`
(`jv-j4`, «awaiting signature») y `f43caf30` (`jv-j1`, «awaiting queue resolution»). Esa etiqueta la pone
Claude Code, que no siempre ve la pregunta como pregunta. Con el arreglo de ④ esas sesiones **siguen
saliendo MUERTA**.

Las únicas muertes sin ambigüedad son `stopped`, `failed` y `cancelled`. Pasar al fallo cerrado estricto
(MUERTA solo para esos tres estados) **tiene un coste**: toda sesión que acabe su turno con normalidad
(`done`) bloquearía `lanzar`, `relevar` y `olvidar` de su nombre hasta que alguien la pare a mano.
**Es una decisión de Javier y Luis sabiendo lo que cuesta, no un arreglo.**

## ⑥ Por qué no basta con tocar el vigía

`lanzar`, `relevar` y `olvidar` se reparten con el mismo `repartirPorNombre` → `clasificarAgente`. Fue
`lanzar` quien, a mediodía, dejó arrancar una sesión encima de la J2 que esperaba. Si solo se filtra en el
vigía, se calla la alarma y el daño sigue. El orquestador rechazó ese plan B por eso: un vigía que deja de
avisar mientras `lanzar` puede pisar a una sesión viva es peor que el defecto.

## ⑦ Qué NO hace falta para arreglarlo (corrección de J6)

En su primer informe J6 escribió que cambiar `sesion.mjs` «exige reinstalar la copia de AppData y tocar
la regla de permiso que apunta a ella». **Es falso.** Lo corrigió el orquestador y está comprobado en el
encabezado del propio `sesion.mjs` (líneas 42-43 de `origin/main`): «`arranque.cmd` la reescribe desde
`origin/main` en cada tanda, y `puertaDeIntegridad` se niega (ALTERADO) si difiere de main».

El arreglo entra por PR como cualquier otro, y la copia instalada se refresca sola en la tanda siguiente.
Nadie toca AppData ni ninguna regla de permiso. Lo que sí decide quién lo hace es que el fichero está en
`scripts/equipo/`, compartido entre los dos equipos.

## Estado

- Medición: entregada aquí.
- Arreglo de ④: sin aplicar. Lo lleva a Luis el orquestador de Javier.
- Decisión de ⑤: abierta, de Javier y Luis.

## J6 · SCRUM-1238b · la clase de una sesión, con su fuente: función pura en un fichero sin cerradura

**Medido contra:** `origin/main` = `0e86dada4887f1ac54ce0ed5cad3c53c99c72c1c` · 2026-10-24T10:14:00Z (hora de GitHub; sesión J6 `jv-j6bk` en su árbol `jv-j6bk`, por encargo del orquestador `cobroflash-backend-95`. La rama sale de `25ad5d43b`; entre los dos, 20 ficheros cambiados y ninguno de `scripts/equipo/`, de los dos guards que toqué al pasar ni de este registro)

A9: comprobación → `tests/scrum1238b-clase-de-sesion.test.mjs`

**El fallo mío que lleva esa línea.** La primera pasada real del instrumento la hice con una lista de procesos
(`claude agents --json`) bajada a fichero unos minutos antes, y declaró MUERTA-SIN-PROCESO a `jv-j1bh`
(`cc050e83`), que se había lanzado entre medias y tenía proceso. Con la lista leída en el momento salió
VIVA-BLOQUEADA. El arreglo: `clasificarTrabajos` lee la lista DESPUÉS de los `state.json`, y el caso «la lista
se lee después» lo ata el test (su mutación M3, abajo, lo tumba).

### ① Qué hace hoy de vigía, y de quién es

| fichero | qué decide | dueño (`node scripts/carriles.mjs de`) |
|---|---|---|
| `scripts/equipo/sesion.mjs` · `clasificarAgente` + `estadoDeJob` | VIVA / MUERTA / NO-PUDE-MIRAR para `lanzar`, `relevar`, `olvidar` | S5 |
| `scripts/equipo/latido.mjs` · `seccionSesiones` + `espera` | la línea «BLOQUEADA hace N min · espera: …» | S5 |
| `scripts/vigia-sesiones-jv.mjs` | retransmite la clasificación de `sesion.mjs estado` | S5 (desde SCRUM-1480; el ticket lo daba a J6) |

Los tres son de S5. Por eso no se toca ninguno: lo construido va en `scripts/clase-de-sesion.mjs`, que nace sin
cerradura y queda declarado en `scripts/_sin-fila-declarados.json` (contenedor de S0, bloque de J6) hasta que
la S0 le dé fila.

### ② Los dos defectos, reproducidos hoy con el código de `main`

Dos `state.json` fabricados en un temporal, pasados por el código real (sonda fuera del árbol):

| forma | `latido.seccionSesiones` | `sesion.clasificarAgente` | `clase-de-sesion` |
|---|---|---|---|
| J2 `4d9f556d` del 28-sep: `blocked`, `firstTerminalAt` relleno, `needs`, sin proceso | BLOQUEADA hace 10 min | **MUERTA** | TERMINADA-ESPERANDO |
| jv-j1bb tras el reinicio del 24-oct: `blocked`, `needs`, SIN `firstTerminalAt`, sin proceso | **BLOQUEADA** hace 10 min | NO-PUDE-MIRAR | MUERTA-SIN-PROCESO |

`estadoDeJob` no está exportado: su línea 1005 de `main` (`terminal: cuando !== null || …`) se replicó literal en
la sonda. El latido sí se pasó entero (`leerTrabajos` + `seccionSesiones`, los dos exportados). El defecto del
latido es el contrario del que nombra el ticket: **no mira el proceso**, así que una sesión que perdió el suyo
sigue saliendo BLOQUEADA hasta que alguien la para. Eso es lo de las 710/674 min de esta mañana.

Los `state.json` de la máquina NO llevan `pid` (medido sobre los 570: ninguna clave `pid`). El proceso sólo lo
da `claude agents --json`, que hoy lista únicamente las sesiones con proceso (11 entradas, las 11 con `pid`).
jv-j1bb y jv-j6bg ya no se pueden medir: el orquestador las paró a las 10:00Z y su `state.json` dice `stopped`
sin `needs`.

### ③ Las clases, cada una con su fuente

`claseDeSesion(s, proceso)` · `s` es la forma de `leerTrabajos` del latido más `primerFin` (= `firstTerminalAt`);
`proceso` es lo que devuelve `procesoDe(agentes, id)`: el pid, `0` si la lista se leyó y no le da proceso, `null`
si no hay lista.

| clase | proceso (`claude agents`) | `state.json` | el vigía dice |
|---|---|---|---|
| VIVA-TRABAJANDO | pid | sin `blocked` ni `needs` | nada |
| VIVA-BLOQUEADA | pid | `blocked` en `state` o `tempo`, o `needs` (el `espera` del latido) | «BLOQUEADA con proceso, en el arranque / a mitad de un turno: <needs>» |
| TERMINADA-ESPERANDO | sin proceso | espera **y** `firstTerminalAt` (terminó un turno preguntando) | «te está esperando: <needs>» |
| TERMINADA | sin proceso | `done` sin pregunta | nada |
| MUERTA-SIN-PROCESO | sin proceso | `stopped`/`failed`/`cancelled`, o `working`/`blocked` sin turno que lo explique | «SIN PROCESO: contestarle ahí no la despierta; su pregunta era: <needs>» (si la había) |
| NO-PUDE-MIRAR | sin lista | o `state.json` ilegible | «NO SE PUDO MIRAR: <motivo>» |

`done` NO es un final (lo escribe también un fin de turno): `ESTADOS_DE_FIN` son los terminales de `sesion.mjs`
menos `done`, y el test lo ata a esa constante. **Lo que NO decide:** si TERMINADA cuenta como resto para
`lanzar`/`relevar`/`olvidar`. Es la decisión ⑤ de arriba, abierta, de Javier y Luis. La «bloqueada en el arranque»
que pedía el ticket (`aa4c32ac`) no es una clase aparte: con proceso es VIVA-BLOQUEADA y el motivo dice «en el
arranque (aún no ha terminado ningún turno)»; sin proceso es MUERTA-SIN-PROCESO.

**SIN MEDIR:** que una TERMINADA-ESPERANDO se despierte de verdad al contestarle (no se mandó ningún mensaje a
ninguna sesión), y que una `blocked` CON `firstTerminalAt` que pierde el proceso a mitad de su SEGUNDO turno se
distinga de la J2 del 28-sep: las dos tienen la misma forma y salen TERMINADA-ESPERANDO, que es el lado que no
declara muerto a nadie.

### ④ Lo que se ve, y cómo se comprobó

- `tests/scrum1238b-clase-de-sesion.test.mjs` · 8 casos, 8 en verde. Siembra un `state.json` de cada clase en
  un temporal y exige que el censo cubra las seis; quitando CUALQUIERA de los seis sembrados, la clase que falta
  es exactamente la suya (el censo dice CIEGO, no verde).
- Mutaciones sobre el commit `ea3cd2f8bac9a82c4c577fed287d8f5f92668551`, cada una con `git diff --numstat` = 1/1 y
  restaurada con `git restore --source=HEAD` (árbol limpio después):
  - **M1** — `firstTerminalAt` vuelve a ser muerte (el defecto de `sesion.mjs`): caen 3, entre ellos el de la J2.
  - **M2** — `blocked` sin mirar el proceso (el defecto del latido): caen 5, entre ellos el del reinicio.
  - **M3** — la lista se lee ANTES de los `state.json`: cae 1, el del orden.
- En la máquina, a las ~10:10Z: `node scripts/clase-de-sesion.mjs` → 126 trabajos tocados en 24 h · 9
  VIVA-TRABAJANDO · 1 VIVA-BLOQUEADA (jv-j1bh, en el arranque) · 31 TERMINADA · 85 MUERTA-SIN-PROCESO · 0
  TERMINADA-ESPERANDO · 0 NO-PUDE-MIRAR. Suman 126.
- Guards de suite, uno por uno: 237, 976, 824, 419, 702, 700, 719, 1415, 1480f, 1185, 411, 850 en verde. **836
  en rojo, ajeno:** sus tres anclas viven en `dist/` y este árbol anidado no tiene `dist/`; en CI sí lo hay. 824 y
  702 salieron rojos POR MÍ en la primera pasada (una escritura en un temporal que el censo no veía de dónde
  colgaba, y un `process.platform`): se arregló el código, no el guard. Suite entera local: NO CORRIDA.

### ⑤ Para Luis (S5): la llamada exacta

**`scripts/equipo/latido.mjs`** — que una bloqueada sin proceso deje de salir BLOQUEADA:

```js
import { claseDeSesion, procesoDe, avisoDe } from '../clase-de-sesion.mjs';
// leerTrabajos: añadir al objeto de cada sesión
primerFin: typeof s.firstTerminalAt === 'string' && s.firstTerminalAt ? s.firstTerminalAt : null,
// seccionSesiones recibe `agentes` (la lista de `claude agents --json`, leída DESPUÉS de leerTrabajos)
// y en el bucle, en lugar de `if (espera(s)) { … alertas.push(… BLOQUEADA …) }`:
const c = claseDeSesion(s, procesoDe(agentes, s.id));
const linea = avisoDe(s.nombre, s.id, c);
if (linea) alertas.push({ sesion: s.nombre, linea });
```

**`scripts/equipo/sesion.mjs`** — la línea de ④ de arriba (`terminal: ESTADOS_TERMINALES.includes(j.state)`) sigue
siendo el arreglo mínimo. Si se prefiere una sola regla para los dos, `clasificarAgente` puede devolver MUERTA
sólo cuando `claseDeSesion(desdeStateJson(j), agente.pid ?? 0).clase === 'MUERTA-SIN-PROCESO'`. Que TERMINADA
cuente o no como resto es la decisión ⑤.

### Estado

- `scripts/clase-de-sesion.mjs` y su test: en esta rama, `scrum-1238b-sin-pid-no-es-muerta`.
- Latido y `sesion.mjs`: sin tocar; la llamada, arriba, para S5.
- Decisión ⑤: sigue abierta.

## J6 · SCRUM-1238b (relevo) · el temporal del test, por `temporal()`

**Medido contra:** `origin/main` = `091e4d765ba13083b93fb6c168ffbd70fb1f1563` · 2026-10-24T10:59:08Z (hora de GitHub; sesión J6 `jv-j6bq` en el árbol `jv-j6bk` de la sesión anterior, ya parada, por encargo del orquestador `cobroflash-backend-95`. La rama no se ha mezclado con ese `main`: el PR #2812 no estaba en conflicto)

A9: comprobación → `tests/scrum864c-el-temporal-no-vuelve.test.mjs`

**El fallo.** El obligatorio de #2812 (punta `0f3d80d99c63dff77fbed2ca498a40fb515066d6`) salió rojo por
`scrum864c ③`: `sembrar()` creaba su carpeta con `fs.mkdtempSync` y la borraba quien la llamaba, y el censo lo
da por `[NO_GARANTIZADA] tests/scrum1238b-clase-de-sesion.test.mjs:39 · borra en 50 SIN cobertura`. El
guard ya existía y lo cazó; lo que faltó fue correrlo en local antes de empujar (en la lista de guards de suite
del tramo anterior está 824, pero no 864c).

**El arreglo.** `sembrar()` crea con `temporal('scrum1238b-')` de `tests/_temporal.mjs`, y `borrar` pasa a
ser `borrarTemporal`. El guard no se ha tocado.

**Comprobado**, en este árbol:

- `scrum1238b` + `scrum864c`: 12 casos, 12 en verde (8 + 4).
- Control en rojo: con la versión empujada del test puesta encima, `scrum864c ③` cae y nombra la línea 39;
  con la arreglada, pasa.
- Mutaciones, rehechas sobre `scripts/clase-de-sesion.mjs` (no tenía las del tramo anterior escritas
  literalmente, así que son reconstrucciones), cada una 1/1 por `git diff --numstat` y restaurada desde `HEAD`:
  M1 (`|| s.primerFin` en la condición de MUERTA) tumba 4, entre ellos el de la J2 (el tramo anterior dice 3:
  no es la misma línea); M2 (`proceso > 0 || espera(s)`) tumba 5, entre ellos el del reinicio; M3 (la lista se
  lee antes del bucle) tumba 1, el del orden.
- Suite entera local: NO CORRIDA.

## S5 · SCRUM-1238c · el arreglo ④ aplicado en `sesion.mjs`, y la pregunta se DICE

**Medido contra:** `origin/main` = `5deff8b3b7b0f8a8d3cd037baabbca454ea7aa29` · 2026-10-29T10:03:44Z (hora de GitHub; sesión S5 `4b1ea111`, worktree `wt-s5-1005`, encargo del orquestador del 29-oct, que lo traía como pieza de SCRUM-1621 medida por Javier)

A9: comprobación → `tests/scrum1238c-espera-no-es-fin.test.mjs`

### Lo medido antes de tocar
- **`firstTerminalAt` es «terminó ALGÚN turno», no «está terminada».** Sobre los 44 `state.json` de la máquina
  (29-oct): 31 `done`, 7 `stopped` y 6 `working`. En **16 de los 38** terminales `firstTerminalAt` es anterior a
  `lastTerminalAt`: la sesión volvió a trabajar después de su primer final y el campo siguió puesto.
- Hoy **ninguno** lleva `needs` ni `state: blocked`. La forma que esperaba es la de ③ de arriba (28-sep) y la de
  J2 `4d9f556d` (`blocked` + `firstTerminalAt` + `needs` como cadena).
- `claude agents --json`: 8 entradas, **las 8 con `pid`**. Una sesión que acaba su turno preguntando no sale en
  la lista, así que `estado` sólo la puede ver leyendo la carpeta de trabajos.
- **Las dos copias de `sesion.mjs`:** la del repo y `AppData/Local/yaqu-equipo/sesion.mjs` son DOS ficheros, no
  un enlace. Hoy son idénticas (77.695 B, mismo SHA-256). La de AppData la reescribe `arranque.cmd`, cuya última
  pasada fue el 27-oct a las 12:05Z, y las tres tareas `yaqu-equipo-*` están **deshabilitadas**.
  `puertaDeIntegridad` da **ALTERADO** si difieren, así que cuando esto entre, el lanzador se niega hasta que
  alguien refresque la copia. No se ha tocado AppData.

### Lo que cambia
- `leerJob(j)` (exportada, pura): `terminal` sale del `state` de AHORA y **nunca si espera** (`blocked` en
  `state`/`tempo`, o algo en `needs`, el mismo criterio que `espera()` de `latido.mjs`, copiado porque la copia
  instalada corre sin el resto de `scripts/`). Devuelve también `espera`, `pregunta` y `huella`, y `cuando` es el
  ÚLTIMO final.
- `clasificarAgente`: sin `pid` y esperando → **`ESPERA`**, con la pregunta. Sólo `MUERTA` es un resto, así que
  `lanzar`, `relevar` y `olvidar` la tratan como viva, igual que antes a `NO-PUDE-MIRAR`.
- `sesion.mjs estado` lleva `esperando` (`esperandoEnJobs`): las que preguntan según la CARPETA de trabajos,
  tengan proceso o no, con su población y sus ilegibles. Sin carpeta legible → `leido: false`, nunca una lista vacía.
- **La decisión ⑤ sigue abierta y no se toca:** una `done` sin pregunta sigue siendo terminal.

### Cómo se comprobó
- `tests/scrum1238c-espera-no-es-fin.test.mjs` · 5 casos. El control de la que espera y el de la que acabó van
  juntos: con uno solo, el arreglo podía ser «ninguna termina». Junto a 954, 959b, 1238b y 1000: 44 tests, 44 pass.
- Mutaciones (base en verde, restauradas y árbol limpio): **M1** la línea vieja → caen ①, ③ y ⑤ · **M2** sin el
  `ESPERA` de `clasificarAgente` → cae ② · **M3** `esperandoEnJobs` sin filtrar → cae ④.
- Contra la máquina, sólo leyendo: de 44 `state.json`, 38 terminales con la línea vieja y 38 con la nueva, y 0
  esperando. **Hoy el cambio es neutro en la máquina**, porque no hay ninguna sesión que espere. La diferencia sólo
  la prueban las formas medidas en los fixtures.