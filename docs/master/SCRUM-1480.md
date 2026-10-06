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

---

# SCRUM-1480b · Los scripts de workflow, contados: dos filas más y una fila general sin cerradura

**Medido contra:** `origin/main` = `f8da1ec83777c4110228e82093047e69a671dfe1` · 2026-10-06T17:18:24Z

A9: aviso → cicatriz S0 «Una frase que resume una lista se comprueba contra la lista antes de escribirla: la fila decía que sus ayudantes sólo los importaban sus scripts, y dos tenían más importadores.» — no se pudo comprobar: es prosa de una celda de la tabla de dueños, y ningún test lee qué afirma una nota

Carril S0 (`docs/equipo/dos-equipos.md` y `docs/equipo/cicatrices/S0.md` son suyos). `docs/equipo/orquestador.md`
es del orquestador de Luis: se le quita UNA palabra con su autorización escrita (abajo).

## La pregunta, y lo que resultó ser

La primera entrega dejó dos preguntas al orquestador: `vigia-silencio-de-main.mjs` y «los scripts de los
workflows que viven en `scripts/`… no los he contado todos». Su encargo de la tarde: contarlos antes de decidir.

Contados sobre 296 ficheros rastreados en `scripts/` y 8 workflows (3.304 líneas de yml; 1.567 son comentario
y no cuentan como ejecución):

| qué | cuántos | con fila propia | sin fila |
|---|---|---|---|
| A · los ejecuta un workflow: su ruta, o un `npm run` que resuelve a ella, en una línea no comentada | 24 | 3 | 21 |
| B · sólo llegan por `import` desde los de A (leído con el compilador de TypeScript, no por texto) | 20 | 1 | 19 |
| A + B | 44 | 4 | 40 |

El orquestador había nombrado tres «y otros». Eran 21 directos y 40 con sus imports.
`vigia-silencio-de-main.mjs` no lo ejecuta ningún workflow: es el número 41 y va aparte.

Y debajo hay un hueco mayor que la pregunta: **273 de los 296 ficheros de `scripts/` sólo los cubre la fila
general.** Esos no se clasifican aquí.

El censo lleva un control positivo (ve `vigia-pasada.mjs`, que `vigia-atascados.yml` corre) y uno negativo
(deja fuera `_evidencia-tanda.mjs`, que `ci.yml` sólo nombra en un comentario). Se repite con:

    node docs/master/evidencias/SCRUM-1480/censo-scripts-de-workflow.mjs <raíz del árbol>
    node docs/master/evidencias/SCRUM-1480/importadores.mjs <raíz del árbol> docs/master/evidencias/SCRUM-1480/lista-de-los-45.txt

Las salidas de ese día están al lado (`salida-*.txt`). La función `fila()` del censo lleva escritas las filas
que había ANTES de este cambio: su «sin fila» es la foto de partida, no la de después.

## Lo que se firmó y lo que no

Propuse 17 ficheros a S5, 23 a S3 y uno que se queda en S0. El orquestador de Luis firmó con recortes
(mensaje a la S0 del 6-oct-2026, tarde):

| fichero o grupo | propuesto | firmado | motivo del orquestador |
|---|---|---|---|
| 16 del bucle PR → CI → merge → aviso | S5 | **S5** | lo dicen §3.3 (`.github/workflows/**`) y `orquestador.md` §11bis |
| `vigia-silencio-de-main.mjs` | S5 | **sin fila** | lo escribió J6 y SCRUM-1324 sigue En curso con `area-j6`; pregunta a los dos orquestadores |
| ocho ayudantes compartidos (de 5 a 51 importadores) | S3 | **sin fila** | no se clasifica un ayudante antes que quienes lo usan |
| `guards-visuales.mjs`, `senal-de-nombres.mjs` | S3 | **sin fila** | ticket vivo del equipo de Javier (SCRUM-1313, 1320, 1339) |
| `trinquete-de-zona.mjs`, `_trinquete-de-zona.mjs` | S3 | **sin fila; excepción** | S3 los toca por SCRUM-1335, comentario 18387; el ticket lleva `area-j6` |
| `meta-guard-mutaciones.mjs` | S3 (dos textos se contradecían) | **S3** | §3.3 da «mutación» a S3 y la medición de hoy es suya |
| el resto de instrumentos del CI | S3 | **S3** | |
| `censo-regla-42.mjs` | S0 | S0 (fila general) | es un censo de consulta |

**Desviación mía, declarada:** el orquestador contó 13 en la fila de S3 y la fila lleva 9. Dos salen porque él
mismo los pasa a excepción (el trinquete de zona). Los otros dos son `_solape-de-guards.mjs` y
`_senal-de-nombres.mjs`: son los ayudantes de `guards-visuales.mjs` y de `senal-de-nombres.mjs`, que él dejó
fuera, y un ayudante no se queda en un carril mientras su script espera a otro equipo. Es su misma regla
aplicada a dos ficheros que no nombró; si no la quiere así, se devuelven a la fila.

## El cambio

- `docs/equipo/dos-equipos.md` §3.3: fila nueva de 16 rutas → S5; fila nueva de 9 rutas → S3; y la fila general
  de `scripts/` deja de llevar el dueño como un puesto a secas. Esto último es la decisión (a) del orquestador
  para el PR #2001: su cerradura lee esa celda, y con «**S0**» a secas cerraba con llave 275 ficheros a nombre
  de S0. Corrido el hook de #2001 con siete casos: bloqueaba a una sesión de S5 en `vigia-atascados.mjs` y a una
  de S3 en `meta-guard-mutaciones.mjs`, y dejaba pasar a una de S0 en el vigía, que la propia fila dice que no
  es suyo. Donde nadie ha decidido no hay cerradura.
- `docs/equipo/orquestador.md` §11bis, fila de S5: sale «meta-guard» de la lista del bucle. Autorización escrita
  del orquestador de Luis, dueño del fichero, en ese mismo mensaje: «te AUTORIZO por escrito a quitar
  "meta-guard" de la fila de S5 en el mismo PR».
- `docs/equipo/cicatrices/S0.md`: dos líneas.

No toca §3.1 ni §3.2, que son las que lee `tests/scrum514-aprobado-y-aplicado.test.mjs`.

## Lo que sigue sin fila, dicho

- `vigia-silencio-de-main.mjs`, `guards-visuales.mjs` y `senal-de-nombres.mjs` (con sus dos ayudantes): esperan a
  que lo hablen los dos orquestadores, y el canal entre ellos es un jefe.
- Los ocho ayudantes compartidos y el resto de los 273 de la fila general. Clasificarlos es una tanda entera y
  no está encargada.

## Para #2001

Al traer `main` con estas filas: `node scripts/carriles.mjs generar` después del commit de la fusión, y volver a
correr la sonda de la cerradura. Se marca listo al EMPEZAR una tanda, no al final (decisión del orquestador).
