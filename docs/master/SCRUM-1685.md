## SCRUM-1685b · S0 · cruce de carril de `public/register.html` declarado en §3.4 — 11-nov-2026 ~10:40Z (reloj de GitHub)

> Apéndice de la S0. Si este fichero ya existe en `main` con el registro de S1 (tramo a, PR #3055,
> que lo crea), esta sección va **al final** del suyo: se concatena, no se elige lado.

**Base:** `origin/main` = `bb59d558e`. **Pedido por:** S1, por el orquestador de Luis.

**Qué:** fila nueva en `docs/equipo/dos-equipos.md` §3.4:
`public/register.html` | S1 | campos provincia + domicilio foral/Canarias del alta con invitación | SCRUM-1685.
**Respaldo:** la reasignación del fundador, SCRUM-1685 c.21436 («hagamos nosotros lo de javier», 11-nov,
sesión del orquestador `ed676fd1-…`). Leída en Jira antes de escribir la fila. El dueño sigue siendo
J3 (§3.2, fila de `register.html`): es una excepción, no un cambio de dueño.

**Control positivo** (`node scripts/carriles.mjs de public/register.html` y `excepcionPara` de
`scripts/_carriles.mjs`, que es lo que consulta la cerradura `.claude/hooks/carril.mjs`):

| | `de public/register.html` | `excepcionPara(…, 'S1')` |
|---|---|---|
| mapa de `main` (`bb59d558e`) | J3, sin excepción | `false` |
| con la fila | J3 + «excepción para S1» (`dos-equipos.md:259`) | `true` (S2/J3/S0: `false`) |

`node scripts/carriles.mjs generar` → escritos: 1 (`.claude/carriles.json`). `comprobar` → IGUAL a la tabla.
5 excepciones en §3.4.

**④ · Hallazgo, sin tocar:** §3.4 no tiene fila para `src/modules/auth/**`, así que nada contradice el
cruce. Pero §3.1 (`dos-equipos.md:126`) da `src/modules/auth/**` a **J3**, y el tramo a de S1
(rama `scrum-1685-alta-con-invitacion` @ `2cee6b730`, PR #3055) modifica
`src/modules/auth/app/routes/auth.routes.ts` (+106/−21) **sin excepción declarada**:
`excepcionPara('src/modules/auth/app/routes/auth.routes.ts', 'S1')` = `false`. c.21436 nombra
expresamente el «gate REGISTRATION_INVITED_EMAILS en POST /auth/register», así que el respaldo existe;
falta la fila. No la pongo porque el encargo la reserva al orquestador. Queda propuesta, lista para
pegarla:
`src/modules/auth/app/routes/auth.routes.ts` | S1 | la puerta REGISTRATION_INVITED_EMAILS de POST /auth/register; reasignado por el fundador (SCRUM-1685 c.21436); el resto del fichero sigue siendo de J3 | SCRUM-1685.

El ticket lleva `area-j3`, `equipo-javier` y `aviso-a-javier`: el cambio en un fichero de J3 se avisa al
otro equipo por Jira (§5). Esa nota va en el ticket con esta entrega.
