# SCRUM-1026 · Una sesión BLOQUEADA parece viva y nadie se entera

**Sesión:** s3-22a (refuerzo) · **Carril:** scripts/equipo/** · **Medido contra:** `origin/main` =
`067601b809b9601d8182bb9e3f84c6ca6b874d1b` · 2026-09-22T10:25:59Z (hora de GitHub)

## El defecto

`estado` listaba todas las sesiones igual; una bloqueada (`state: 'blocked'` o `waitingFor` presente,
con proceso VIVO) solo se distinguía leyendo `waitingFor` fila a fila. El ticket midió dos casos reales
(~30 min y un bloqueo justo al entregar) que solo se detectaron por casualidad.

## El arreglo (punto 1 del ticket; únicamente el punto 1)

`sesionesBloqueadas` (pura): separa las entradas de fondo con `state==='blocked'` o `waitingFor`, con
su motivo y `sinActividadMs` — el proxy de «cuánto lleva así» (no hay una marca de cuándo EMPEZÓ el
bloqueo; nadie la escribe), calculado como el tiempo desde el último turno CON USO de su `jsonl` — es
literalmente el proxy que el propio ticket describe («detecté porque su contexto llevaba 20 min sin
moverse»). `avisar: true` cuando supera `UMBRAL_AVISO_BLOQUEO_MS` (10 min). `estado` ahora trae
`bloqueadas` como un array aparte, sin tocar el contrato de `sesiones`/`restos`/`otras`.

## Lo que NO se ha hecho (declarado)

1. **Punto 2 — un aviso ACTIVO al orquestador.** Este script es PULL: solo contesta cuando se le
   pregunta (`estado`), no tiene un proceso que vigile en segundo plano y empuje un aviso solo. Eso
   sería una pieza nueva (un poller), no una corrección de `sesion.mjs`; se deja para que el
   orquestador decida si la quiere y de qué tamaño. Lo que sí se ha hecho es que la próxima vez que
   alguien llame a `estado`, la respuesta lo GRITA en vez de exigir leer `waitingFor` fila a fila.
2. **Punto 3 — investigar por qué aparece el prompt con `--permission-mode auto`.** Requiere reproducir
   el bloqueo real (una acción concreta que `auto` no cubre) en una sesión de fondo, algo que esta
   sesión no puede provocar de forma segura ni útil desde aquí sin arriesgar una sesión ajena. Queda
   abierto; el propio `docs/equipo/00-normas-comunes.md` ya avisa de `EnterWorktree` como la trampa
   documentada, y esta sesión trabajó explícitamente SIN esa herramienta por esa misma razón.

## Evidencia

`tests/scrum1007-1011-1026-relevo-lanzar-bloqueo.test.mjs`: `sesionesBloqueadas` pura (separa
bloqueadas de trabajando, filtra `interactive`, no revienta sin `sinActividadMs`) y un test de EFECTO
sobre `estado` con un `claude` falso (una bloqueada + una trabajando → solo la bloqueada sale en
`bloqueadas`, la que trabaja sigue en `sesiones` como siempre). Rojo confirmado contra `origin/main`
sin el arreglo: `estado` no trae la clave `bloqueadas`.

## Cierre común de la tanda (1007 + 1011 + 1026)

Un solo fichero de test por tocar el mismo fichero, mismo día, misma sesión de refuerzo (afinidad).
Suite completa del worktree tras el merge de `origin/main` (12 commits, sin conflictos,
`merge-base --is-ancestor origin/main HEAD` = true) y `npm run guards:entrada`: resultado en el commit
de esta rama.
