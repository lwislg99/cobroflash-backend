# SCRUM-1480 · Dos filas que faltaban en la tabla de dueños: `scripts/qa/` y el vigía de sesiones

**Medido contra:** `origin/main` = `8dcc6d2ad6cab55e9b550220868b12adc82eb40e` · 2026-10-06T13:19:06Z

A9: sin fallo que generalice — el hueco lo destapó etiquetar dos tickets con la tabla delante, y lo que lo impide es la propia fila; una tabla no se puede probar contra los ficheros que aún no existen.

Carril S0 (`docs/equipo/dos-equipos.md` es suyo). Sólo cambia §3.3. No toca §3.1 ni §3.2, que son las que
lee `tests/scrum514-aprobado-y-aplicado.test.mjs`.

## Qué pasaba

§3.3 dice de quién es cada fichero. Su fila de `scripts/` recogía todo lo demás: «`scripts/` (verificación,
censos de consulta) → S0, salvo `scripts/equipo/` (S5) y `scripts/_suelo-*` (S3)». El 6-oct, al etiquetar
SCRUM-1466 y SCRUM-1467, los dos ficheros caían ahí y cada uno tenía dos lecturas:

| ticket | fichero | por área (§2.1 y `orquestador.md` §11bis) | a la letra de §3.3 |
|---|---|---|---|
| SCRUM-1466 | `scripts/qa/sembrar-qa.mjs` | S3: sondas e instrumentos | S0 |
| SCRUM-1467 | `scripts/vigia-sesiones-jv.mjs` | S5: vigías | S0 |

El orquestador de Luis decidió por el área, y el motivo es suyo: un hueco en la tabla no significa «es de
S0», significa que falta una fila.

## El cambio

Tres líneas de §3.3:

- La fila de `scripts/` nombra las excepciones nuevas y dice que no recoge lo que nadie clasificó.
- Fila nueva: `scripts/qa/**` → S3.
- Fila nueva: `scripts/vigia-sesiones-jv.mjs` → S5, con el aviso de que lo escribió el equipo de Javier
  para su máquina y de que un cambio se le avisa antes a su orquestador.

## Lo que medí para escribirlas (6-oct-2026, sobre `origin/main`)

| fichero | quién lo escribió, según su registro |
|---|---|
| `scripts/qa/sembrar-qa.mjs` | S3 (`docs/master/SCRUM-1268.md`, «Carril: S3», tres entregas) |
| `scripts/qa/sembrar-casos.mjs`, `sembrar-albaranes.mjs` | S3 (`docs/master/SCRUM-1367.md`, «Carril S3») |
| `scripts/qa/sesion-panel.mjs` | **no lo dice** (`docs/master/SCRUM-1222.md` no nombra carril). Entra en la fila por la carpeta, por decisión del orquestador |
| `scripts/vigia-sesiones-jv.mjs` | J6 del equipo de Javier (`docs/master/SCRUM-1000.md`, sesión `jv-j6`) |

## La aceptación → dónde se ve

| aceptación (literal) | dónde se ve |
|---|---|
| §3.3 tiene una fila `scripts/qa/**` → **S3**, con su motivo. | `docs/equipo/dos-equipos.md`, §3.3 |
| §3.3 tiene una fila para el vigía de sesiones (`scripts/vigia-sesiones-jv.mjs`) → **S5**, y dice que lo escribió el equipo de Javier para su máquina (SCRUM-1000) y que un cambio se le avisa a su orquestador. | `docs/equipo/dos-equipos.md`, §3.3 |
| La fila de `scripts/` nombra las dos excepciones nuevas, para que nadie vuelva a leerla a la letra. | `docs/equipo/dos-equipos.md`, §3.3 |
| El formato que lee `tests/scrum514-aprobado-y-aplicado.test.mjs` (§3.1 y §3.2) no se toca: ese test sigue verde. | `tests/scrum514-aprobado-y-aplicado.test.mjs` |
| Dicho en el registro qué queda SIN fila después de esto. | «Lo que sigue sin fila», abajo |

## Lo que sigue sin fila, dicho

No lo clasifico yo: una decisión tomada para un caso no se estira a otro parecido.

- **`scripts/vigia-silencio-de-main.mjs`.** Lo escribió J6 del equipo de Javier (`docs/master/SCRUM-1324.md`).
  Es un vigía, pero no «de sesiones», y ningún workflow de `.github/` lo nombra. No tiene fila.
- **Los scripts de los workflows que viven en `scripts/`** (`vigia-atascados.mjs`, `vigia-pasada.mjs`,
  `vigia-despliegue-aviso.mjs` y otros). `orquestador.md` §11bis se los da a S5 («`.github/workflows/` y sus
  scripts»), pero §3.3 sólo nombra `.github/workflows/**`. No los he contado todos.

Los dos van al orquestador como pregunta.

## Para #2001

El PR #2001 (en borrador) genera ficheros con el número de línea de cada fila de este documento y con su
huella. Al traer `main` con estas tres líneas hay que volver a correr `node scripts/carriles.mjs generar`
después del commit de la fusión.
