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
