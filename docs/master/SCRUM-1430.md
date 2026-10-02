# SCRUM-1430 · La sesión QA dice si está viva antes de gastar una sonda

**Medido contra:** `origin/main` = `643e9a65a5756b9729c9f8d4b911ea0c536988b3` · 2026-10-02T13:28Z

A9: comprobación → `tests/scrum1430-sesion-qa-estado.test.mjs`

Carril S3 (bancos e instrumentos). Por encargo del orquestador (relevo del 2-oct, s3-2octd).

## El hueco

La cookie de `C:/Users/Admin/.yaqu-qa-sesion.txt` se escribió el 1-oct-2026 a las 13:18:30Z y murió
el 2-oct a las 13:18Z. Todas las verificaciones en producción se cayeron a la misma hora y se supo
por un 401 a mitad de una medición.

Leído en `origin/main`, no ejecutado:

- `src/modules/auth/app/routes/auth.routes.ts`, handler de `POST /auth/test-login`: la sesión nace
  con `expiresAt = ahora + 24 h`.
- El mismo handler pone la cookie con `setCookie` de `src/core/http/authMiddleware.ts`, que declara
  `Max-Age` de 30 días. **La cookie declara una vida que no tiene:** manda la fila de la base. De la
  cookie no se puede deducir cuándo muere, y por eso hace falta un fichero al lado.

## Qué entra

| Pieza | Qué hace |
|---|---|
| `scripts/qa/sesion-panel.mjs` · `login` | Deja `<sesión>.caducidad.json` con la apertura (cabecera `Date` del SERVIDOR; el reloj de esta máquina va adelantado), la caducidad (apertura + 24 h) y una huella de la cookie. Borra antes la caducidad de la sesión anterior. |
| `scripts/qa/sesion-panel.mjs` · `estado [--sin-red]` | Primera línea: VIVA (exit 0) · MUERTA (exit 1) · NO SE PUEDE SABER (exit 2). Un `GET /admin/me`; con `--sin-red`, sólo el fichero. |
| `scripts/qa/sesion-panel.mjs` · `get` | Ante un 401 añade lo que el fichero sabe de la caducidad. |
| `tests/scrum1430-sesion-qa-estado.test.mjs` | 11 tests sin red. |
| `docs/RUNBOOKS.md` R23 | El comando, las tres respuestas y la norma del logout. |

No escribe en producción: la única salida nueva a la red es un GET, por el mismo `peticion` que ya
rechaza todo lo que no sea GET antes de salir.

## Verificación

- `node --test tests/scrum1430-sesion-qa-estado.test.mjs tests/scrum1222-sesion-panel.test.mjs`:
  20 tests, 20 pass, 0 fail, 0 skip (11 nuevos y los 9 de SCRUM-1222).
- Mutación (base sin mutar verde primero): 8 de 8 mutaciones aplicadas tumban al menos un test;
  árbol restaurado byte a byte y vuelto a correr en verde. Las ocho: vida de 25 h · el instante
  exacto cuenta como viva · no se comprueba la huella · cualquier 4xx/5xx es MUERTA · `login` no
  borra la caducidad anterior · la hora es la local · red caída es MUERTA · sin fichero dice VIVA.
- Contra la cookie de verdad (dos lecturas, ninguna escritura), 2026-10-02 ~13:35Z:
  `estado --sin-red` → `NO SE PUEDE SABER — no hay fichero de caducidad` (exit 2);
  `estado` → `MUERTA — GET /admin/me → 401; caducidad no conocida` (exit 1).

## Aceptación del ticket → dónde se ve

| aceptación | dónde se ve |
|---|---|
| 1. `estado --sin-red` dice VIVA y hasta cuándo sin tocar la red; pasada la hora, MUERTA y desde cuándo. Sale 0 / 1 | test «estado --sin-red: VIVA antes de su hora y MUERTA después, sin tocar la red» |
| 2. Fail-closed: sin fichero, fichero de otra cookie, ilegible, o sonda que no da 2xx ni 401 → NO SE PUEDE SABER, exit 2 | tests «fail-closed: sin sesión, sin fichero…» y «fail-closed de la sonda…» |
| 3. La sonda manda: 401 antes de la hora dice MUERTA y nombra el logout | test «la sonda MANDA: 401 es MUERTA…» |
| 4. Las 24 h del instrumento y las del servidor no pueden divergir sin que un test caiga | test «las 24 h del instrumento son las del servidor…» |
| 5. `estado` no escribe en producción ni imprime la cookie | test «estado con sonda: un GET a /admin/me…»; el rechazo de todo POST que no sea el login sigue en `tests/scrum1222-sesion-panel.test.mjs` |
| 6. RUNBOOKS R23 dice el comando, las tres respuestas y la norma del logout | `docs/RUNBOOKS.md` R23 |

## Lo que queda fuera, dicho

- **La cookie de hoy sigue muerta.** Esto no la renueva: se renueva con `login`. El secreto que
  `login` lee está en `C:/Users/Admin/.yaqu-qa-secret.txt` (43 bytes, del 28-sep-2026): no se ha
  probado si sigue valiendo, porque entrar es un POST a producción y no es de este ticket.
- La cookie que haya hoy en disco no tiene fichero de caducidad: hasta el próximo `login`,
  `--sin-red` dirá «no se puede saber» y sólo la sonda contesta.
- `estado --sin-red` compara con el reloj de esta máquina y lo dice en su salida. No se ha medido
  cuánto adelanta hoy.
- Que la cookie declare 30 días y la sesión dure 24 h es del servidor (`auth.routes.ts`): no se toca.
