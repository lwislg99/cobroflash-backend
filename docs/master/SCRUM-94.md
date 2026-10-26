# SCRUM-94b · ¿Qué test ejerce hoy la guarda de SCRUM-94 en el alta?

**Medido contra:** `origin/main` = `81f9c0dc7d100cf05765b2c7708ac2f31f70beb7` · 2026-10-26T15:50:00Z

A9: comprobación → `tests/scrum1515-nuestra-puerta-de-alta.test.mjs`

26-oct-2026 · **J3** (sesión `jv-j3bl`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-8b`).
[Escrito por J3. El hallazgo de partida es de J6 (`jv-j6cd`), SCRUM-1599 c.20874.]
Carril: J3. El código que se vigila es `src/modules/auth/**` (`dos-equipos.md:126`); el test es el de SCRUM-1515,
ticket de J3 (`carriles.mjs de` → «sin fila en §3»). 0 líneas de `src/`.

## Qué guarda es y por dónde se llega a ella

`registerMerchant` (`src/modules/auth/domain/auth.service.ts`): si el correo es de un `TeamMember` que no está
`suspended`, lanza `email_belongs_to_team` y no crea nada. `invited` y `active` se rechazan; `suspended` pasa.

| camino | ¿llega a la guarda? |
| --- | --- |
| `POST /auth/register` | No. Desde SCRUM-1515 contesta 409 `registration_closed` sin llamar al servicio |
| la CLI `altaDeMerchant.ts` | Sí. Llama a `registerMerchant` y traduce el rechazo a salida 4 |
| otros | `registerMerchant` no tiene más llamadores en `src/` que la CLI (los de `app.ts` y `auth.routes.ts` lo nombran en texto, leído con `git grep`) |

## Qué test la ejercía: medido con mutaciones

Tres mutaciones declaradas en `MUTACIONES_CON_BASE` de `tests/scrum1515-nuestra-puerta-de-alta.test.mjs`
y pasadas con `docs/master/evidencias/SCRUM-1599/mutar-1599i.mjs` (el de la casa) y el banco PGlite de 1599h:

| mutación | antes de este PR | después |
| --- | --- | --- |
| M1 · quitar la guarda (`if (false)`) | MUERE, pero sólo porque el operario del test va sin provincia: sale 2 en vez de 4 | MUERE |
| M2 · dejar pasar al invitado (`=== 'active'`) | 🔴 VIVE | MUERE · «el correo de un operario activo o invitado no puede darse de alta» |
| M3 · rechazar al suspendido (`if (teamMember)`) | 🔴 VIVE | MUERE · «un operario suspendido sí puede dar de alta su negocio, y el guion salió 4» |

Salidas: `evidencias/SCRUM-94/mutaciones-94b-antes.salida.txt` y `mutaciones-94b.salida.txt`. Base sin mutar:
1 de 1 pasa en las dos. `dist/` vuelve byte a byte.

**O sea:** el hallazgo de J6 se queda a medias. Quitar la guarda entera sí lo cazaba `scrum1515` por la CLI;
pero las dos ramas que distinguen estados (invitado rechazado, suspendido admitido) no las ejercía nadie desde
que la ruta se cerró: `scrum94` las probaba por la ruta, y ahí todos reciben ya el mismo 409.

## Lo que se ha añadido

En `scrum1515`, detrás de sus aserciones (ninguna tocada): tres operarios de A (activo, invitado y suspendido)
piden el alta por el guion con alta COMPLETA (provincia y domicilio); activo e invitado salen 4 sin merchant,
el suspendido sale 0 con el suyo. Con alta completa, quitar la guarda haría que se crearan de verdad.

## Lo que NO he medido

- **Banco distinto del de 1599h en una cosa:** su URL lleva `&connection_limit=1&pgbouncer=true`, la del banco
  propio de SCRUM-1515 (`evidencias/SCRUM-1515/banco-local.mjs:37`). Sin eso, la pasada limpia salió CIEGA
  (`42P05 prepared statement "s0" already exists`): el proceso hijo del guion abre otra conexión contra el
  mismo PGlite. El banco de 1599h no puede correr tests que lanzan un hijo con Prisma.
- M1 la caza primero la aserción antigua (sin provincia); que la nueva la cace sola no lo he aislado.
- En Postgres de verdad, sólo en el job obligatorio de CI. Las mutaciones allí no las corre nadie.
- `scrum94` no lo he pasado por el banco (en `main` está gateado por staging; su migración es el PR #2876 de J6).
- Suite entera local: NO CORRIDA. Guards dirigidos: 22 ficheros, 193 casos, 191 pasan, 0 caen, 2 saltos.
