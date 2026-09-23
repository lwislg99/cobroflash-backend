# SCRUM-1007 · `relevar` no podía dar RELEVAR por el camino que su propio protocolo manda

**Sesión:** s3-22a (refuerzo) · **Carril:** scripts/equipo/** (encargo explícito del orquestador)
**Medido contra:** `origin/main` = `067601b809b9601d8182bb9e3f84c6ca6b874d1b` · 2026-09-22T10:25:59Z (hora de GitHub)

## PASO 0 · el defecto, leído en el propio ticket y confirmado corriendo

`decidirRelevar` exigía `traspasoMtime > ultimoTurno` para dar `RELEVAR`. El protocolo que el propio
fichero documenta es: *la sesión ESCRIBE el traspaso y LUEGO contesta «traspaso listo»* — y esa
respuesta es un turno, posterior al fichero por diseño. Con la comparación estricta, el camino feliz
nunca podía dar verde. El ticket lo midió en un relevo real: 14,4 s de diferencia, en el sentido que
bloquea.

Reproducido con los números exactos del ticket (`tests/scrum1007-1011-1026-relevo-lanzar-bloqueo.test.mjs`,
primer test): contra el código de `origin/main` (con `git stash`), el caso da `NO-PUDE-MIRAR`/no-RELEVAR
(rojo); con el arreglo, `RELEVAR` (verde).

## El arreglo

`traspasoMtime > ultimoTurno` (orden estricto) → `ultimoTurno - traspasoMtime < esperaMs` (ventana
simétrica, reusando `ESPERA_TRASPASO_MS`). Un traspaso escrito un poco antes de la respuesta de
confirmación (el caso normal) o reescrito después (si la sesión lo actualiza) cuentan igual como
fresco. Un traspaso REALMENTE viejo (fuera de la ventana, con actividad posterior) sigue dando
`ESPERANDO` y luego `SIN-TRASPASO` — no se ha relajado el guard, se ha corregido qué compara.

De las cuatro opciones que proponía el ticket, esta es la tercera («comprobar el traspaso por
contenido…») simplificada a una ventana de tiempo: no hace falta parsear la cabecera del traspaso
(fecha+SHA) cuando el propio `ESPERA_TRASPASO_MS` ya define «cuánto se tarda en escribir y
contestar» — reusar esa misma constante como ventana evita una constante nueva.

## Qué NO cambia

- El estado (`working`/`busy` → OCUPADA; `blocked`/`waitingFor` → BLOQUEADA) sigue mandando DESPUÉS
  de que el traspaso pase la ventana: no se para a nadie a mitad de una entrega.
- `SIN-TRASPASO` sigue siendo el veredicto por defecto ante la duda (falla cerrado).
- No se ha tocado `ESPERA_TRASPASO_MS` (200k, SCRUM-1070b) ni ningún otro umbral.

## Evidencia

`tests/scrum1007-1011-1026-relevo-lanzar-bloqueo.test.mjs` (compartido con SCRUM-1011 y SCRUM-1026 por
tocar el mismo fichero, mismo día, misma sesión — afinidad). Suite completa del worktree y guards de
entrada: ver el cierre común en `docs/master/SCRUM-1026.md`.
