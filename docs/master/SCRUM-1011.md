# SCRUM-1011 · `lanzar` decía LANZADA sobre una sesión sin proceso ni un turno

**Sesión:** s3-22a (refuerzo) · **Carril:** scripts/equipo/** · **Medido contra:** `origin/main` =
`067601b809b9601d8182bb9e3f84c6ca6b874d1b` · 2026-09-22T10:25:59Z (hora de GitHub)

## El defecto

`lanzar` (y el tramo de lanzamiento de `relevar`) se conformaban con que `claude` imprimiera la línea
«backgrounded» y con encontrar el id en `claude agents --json` UNA vez, sin comprobar `pid`. El ticket
midió 4 de 4 sesiones nuevas registradas con `pid=NINGUNO`, sin `status` y sin un solo turno, mientras
`lanzar` contestaba LANZADA con exit 0.

## El arreglo

`comprobarQueArranco(agente)` (pura): solo un `pid` numérico > 0 cuenta como arrancada — el mismo tell
de SCRUM-954. `confirmarArranque` (CLI) sondea hasta `ESPERA_ARRANQUE_MS` (8 s, pasos de 1 s) antes de
rendirse. Si nunca aparece el `pid`: `NO-ARRANCO` (exit 2), con el motivo y una nota — SIN CONFIRMAR —
de que puede ser un límite de sesiones de fondo concurrentes (la hipótesis que el propio ticket deja
en pie, sin medir). Aplicado en `lanzar` Y en el tramo de lanzamiento de `relevar` (mismo patrón, mismo
defecto, no descrito en el ticket pero medible con el mismo mecanismo).

## Lo que NO se ha hecho (declarado, no silenciado)

1. **Punto 2 del ticket — averiguar el límite de sesiones concurrentes, si existe.** Exige parar una
   sesión viva y relanzar en una máquina sin nada a medias, algo que esta sesión no puede hacer con
   seguridad desde aquí (no hay verificación de qué sesiones del equipo de Javier están a mitad de
   entrega en su máquina). Queda como el control pendiente que el propio ticket ya declaraba.
2. El aviso NO distingue «límite de sesiones» de otras causas de un arranque fallido (memoria, un
   `claude` roto, etc.): el motivo dice lo que se sabe (no llegó a tener `pid`) y NO inventa un
   diagnóstico más fino.

## Evidencia (PASO 0 corriendo, no leyendo)

`tests/scrum1007-1011-1026-relevo-lanzar-bloqueo.test.mjs`:
- `comprobarQueArranco`, pura: pid>0 → ok; sin pid, pid 0, o sin entrada → no ok.
- CLI por EFECTO, con un `claude` falso que NUNCA da pid: `lanzar` → `NO-ARRANCO`, exit 2, y se
  comprueba que sondeó MÁS de una vez (no fue un fallo a la primera).
- Control positivo: el pid aparece en el SEGUNDO sondeo (no en el primero) → `LANZADA`, en menos de
  8 s — prueba que el bucle re-sondea de verdad, no solo el caso trivial.
- Rojo confirmado contra `origin/main` sin el arreglo (`git stash`): los dos tests de EFECTO fallan
  (el control positivo daba `NO-PUDE-MIRAR` con el código viejo — leía el `sessionId` de la primera
  respuesta sin `pid`, exactamente el defecto del ticket).
