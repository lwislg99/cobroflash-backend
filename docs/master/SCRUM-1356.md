# SCRUM-1356 · El latido, enganchado: escrito no es corriendo

**Medido contra:** `origin/main` = `36071b72e69f04d3b7b39f2942c899f7f27037ae` · 2026-10-01T13:07:45Z

A9: comprobación → `tests/scrum1356-latido-enganchado.test.mjs`

Carril S0 (hooks y `.claude/settings.json`). No toca `scripts/equipo/latido.mjs`, que es de S5: lo
lanza y le importa las funciones que ya exporta. Hijo de SCRUM-1350.

## El argumento, que es una medición del orquestador del 1-oct

Prometió a tres sesiones vigilar sus PR porque el sistema les mataba los vigías. Escribió el vigía y
no lo armó. Durante minutos nadie miraba, ni ellas ni él, y él creía que sí. Lo supo porque una sesión
le dijo que su propio sondeo había muerto.

| La frase | El caso, los tres del mismo día y de la misma mano |
|---|---|
| escrito ≠ **corriendo** | el vigía de los PR, escrito y sin armar |
| escrito ≠ **propagado** | un aviso de cruce de PR en el prompt de UNA sesión → `main` en rojo 40 min (SCRUM-1358) |
| escrito ≠ **entregado** | una norma contada como viva cuando estaba en un PR abierto |

Y dos más del mismo día, que son por qué el latido tiene que llegar sin pedirlo: tres sesiones
estuvieron once minutos bloqueadas con «Login expired» y quien reparte no lo supo hasta mirar el
registro a mano; y la primera vez que corrió el latido, traía un despliegue fallido bajo una etiqueta
verde y lo leyó por encima (eso lo arregla S5 en #2093: son las dos mitades, que corra y que grite).

## Lo que entra

| Fichero | Evento | Qué hace |
|---|---|---|
| `.claude/hooks/latido-arranque.mjs` | `SessionStart` | a quien NO es un puesto, le pone el latido entero en el contexto |
| `.claude/hooks/latido-cierre.mjs` | `Stop` | a toda sesión, el obligatorio de cada rama que ELLA ha empujado |
| `.claude/settings.json` | — | registra los dos, con `timeout` 120 y 60 s |
| `docs/equipo/00-normas-comunes.md` A8 | — | la norma, en un párrafo |
| `docs/equipo/00-normas-siempre.md` A10 | — | la frase |

### Arranque

- **A quién:** sesión sin nombre, o con un nombre que no es de puesto (`s3-…`, `sesion-2`, `j4-…`,
  `puesto-j1` son puestos y no reciben nada). Se apaga con `YAQU_LATIDO=no`.
- **Plazo:** la pasada completa es un hijo síncrono con 90 s. Si no cabe, se le mata y el contexto dice
  «PR, MAIN y DESPLIEGUE: NO PUDE MIRAR», y debajo van SESIONES y CEMENTERIO leídas del registro local
  (0,4 s). Nunca un silencio, nunca nada de fondo. Se acorta con `YAQU_LATIDO_SEGUNDOS`; no se alarga.
- **Rastro:** cada pasada apunta una línea en `%LOCALAPPDATA%\yaqu-equipo\latido-arranque.log`, y
  `node .claude/hooks/latido-arranque.mjs corrio` la lee: 0 = corrió en 24 h · 1 = rastro viejo ·
  2 = no hay rastro. Es la comprobación de «escrito no es corriendo» aplicada a este mismo ticket.
- Dice cuántos commits va el árbol por detrás de `origin/main`.

### Cierre

- **Qué ramas:** las de los `git push` que hay en los `tool_use` del transcript de la propia sesión,
  por su destino (`origin HEAD:<rama>`, `origin <rama>`, con o sin `git -C`).
- **Veredicto por rama:** VERDE · ROJO · TODAVÍA-NO (no arrancó, o en curso) · SIN-EMPUJAR (la rama
  local no es lo empujado) · FUERA (ya no está en origin; no se mide) · CIEGO.
- **Qué hace si algo no está verde:** `decision: block` con la lista y su población, UNA vez por estado
  (ramas + commits + veredictos, guardado por sesión en el temporal del sistema). Si la sesión vuelve a
  parar sin que nada cambie, pasa. Con `stop_hook_active`, pasa siempre.
- **Si no pudo mirar:** lo dice una vez («no pude mirar no es verde») y pasa. Si falla el propio hook:
  sale 0 con un `systemMessage`.
- **Sin empujones en el transcript:** calla y no gasta un turno.

## Medido

| Qué | Resultado |
|---|---|
| Cuánto tarda una pasada del latido | **245 s, 62 s y 30 s** (13:07Z, 13:13Z y 13:22Z, con 11, 9 y 12 PR abiertos). El ticket decía «decenas de segundos». Una llamada suelta a `gh` tarda 0,6-1,1 s: el resto no lo he localizado |
| Leer el registro de trabajos (247) | 0,35 s |
| El hook de cierre contra un transcript real de 3 MB (`s4-1octb`) | 1,4 s · 3 ramas halladas · 2 FUERA · 1 `in_progress` → avisó; segunda vez, calló |
| El hook de cierre contra `s0-1oct` | 3 ramas, las tres en verde o fuera → calló |
| El hook de arranque, entero | 30 s, 5.632 caracteres, parte completo |
| El hook de arranque con plazo de 3 s | «NO PUDE MIRAR» + las tres bloqueadas del registro · sin procesos huérfanos |
| **Canario dentro de una sesión de verdad** (`claude -p` lanzado desde este árbol) | el modelo copió literal la primera línea del contexto del hook · el rastro de arranque ganó una línea (`source: startup`) · el de cierre ganó otra con el id de esa sesión: **el arnés lanza los dos** |
| De dónde NO se pueden sacar los PR de una sesión | de `children` del `state.json`: trae los PR que la sesión CITA. #1681 sale en cuatro sesiones |

## Lo que NO hace, y hay que saberlo

1. **No corre para el orquestador de Luis hasta que su carpeta de arranque tenga este `settings.json`.**
   El checkout compartido va más de 1.400 commits por detrás y su `settings.json` solo tiene el guard de
   comandos. Es la misma espera que SCRUM-1295 (mesas). Hasta entonces esto es, literalmente, «escrito»:
   se mide con `latido-arranque.mjs corrio`, no se supone.
2. **Sí corre desde el merge para cualquier sesión lanzada desde un árbol al día** (el equipo de Javier
   si sus carpetas lo están). Lo que les cambia: una sesión sin nombre espera hasta 90 s su primera
   respuesta; y al parar con algo empujado y sin verde, un turno más, una vez.
3. **Un `git push` sin nombre de rama, o con la rama en una variable, no lo ve.** No se inventa la rama.
4. **Un «todavía no» que sale rojo con la sesión ya parada no lo ve este hook.** Lo ve la sección
   SESIONES del latido, desde el lado de quien reparte. Las dos piezas se necesitan.
5. **La entrega del `decision: block` de Stop al modelo no la he medido yo**: el canario no empujó nada,
   así que el hook calló, como debe. Está medido que el arnés lo LANZA y que su salida es la que pide la
   documentación; que el modelo la reciba, sale de la documentación.
6. **Chocará con #2001** en `.claude/settings.json` (los dos añaden `SessionStart`). Se resuelve
   conservando los dos hooks.

## Mis errores

1. **Mi banco de pruebas le metía un BOM al hook y el hook lo pagaba acusando a la sesión.** PowerShell
   5.1 canaliza con BOM; el hook no entendía su entrada, decía «no encuentro el transcript» de un
   transcript que estaba ahí, y la tercera prueba «calló» por el motivo equivocado: tres resultados que
   parecían tres mediciones y eran el mismo fallo. → comprobación: el hook quita el BOM y hay un caso con
   BOM en el test.
2. **La primera expresión para sacar la rama capturaba `HEAD`** en `origin HEAD:rama` y la descartaba:
   cero ramas para la forma de empujar que manda la norma. Lo vi leyendo, antes de correr nada. →
   comprobación: el caso «por su DESTINO» del test.
3. **Di por buena la cifra del ticket («decenas de segundos») para diseñar**, y la primera pasada tardó
   245 s. Medí antes de engancharlo, que es lo que el ticket pedía; pero el diseño que traía en la
   cabeza (pasada síncrona sin plazo) habría colgado el arranque cuatro minutos. → comprobación: el plazo
   interno y el test que exige que sea menor que el `timeout` del arnés.
