# SCRUM-1428 · La decisión del 6-oct, a Javier: §26 de `para-javier.md` (con `scrum1405c ④` medido sobre dos días de CI)

**Medido contra:** `origin/main` = `fc4186483266ae85cc744d020bcfd6db76d8c5d3` · 2026-10-19T06:55:25Z

A9: aviso → cicatriz S3 «Le pasé al orquestador «17 líneas» de SCRUM-1428 copiando la decisión del ticket sin contar las acusadas, y contadas eran 15: dos ya llevaban su marca y un comentario posterior del mismo ticket lo decía.» — no se pudo comprobar: es una cifra que copié de un comentario de Jira a un mensaje, y ningún test lee mis mensajes

19-oct-2026 · **S3** (equipo de Luis), por encargo de su orquestador (`cobroflash-backend-f3`, mensaje del 19-oct). Sólo `docs/`: la §26 de `docs/equipo/para-javier.md`, este registro, una línea de `docs/equipo/cicatrices/S3.md` y `docs/master/evidencias/SCRUM-1428/`. Ni una línea de `src/`, `public/`, `tests/` ni `scripts/`. Ninguna base tocada.

**Por qué este número.** La §26 lleva dos puntos: el 26.2 es este ticket, y el 26.1 (`scrum1405c ④`) es de J6 y no tiene ticket del equipo de Luis. El orquestador pidió UNA rama y UNA sección para los dos, porque ese fichero choca cada vez que dos ramas le añaden al final.

## ① Lo que faltaba: la decisión nunca salió de Jira

La decisión de SCRUM-1428 es del 6-oct (c.18325). Medido hoy sobre `main`:
- `libroRegistroView.js` (J1) sin tocar desde el 28-sep (`f597ee6a`).
- Las 22 claves del fichero, todavía en `acusadas` de `scripts/_censo-convenio-microcopy-declarados.json`.
- «1428» aparecía 0 veces en `docs/equipo/`, o sea que nunca llegó a `para-javier.md`, que es el único canal entre los dos equipos además de Jira.

## ② 15, no 17

La decisión (c.18325) habla de un lote de 17 líneas: las 10 de la descripción más 7 de c.18319. Dos de esas 7, `colTrazas` y `sinTrazas`, **ya llevan su marca** (`libroRegistroView.js:75` y `:86`), y el censo las da por APROBADO. Lo vio el propio ticket 50 minutos después (c.18379), pero la cifra 17 no se corrigió (c.18382 la repite). Contadas hoy, las 22 acusadas son:

| grupo | cuántas |
|---|---|
| firmadas el 19-ago y sin marca | **15** |
| esperan al asesor (§21 de `PREGUNTAS_ASESOR.md`) | 5 |
| `cargando` (se queda, por decisión de c.18325) | 1 |
| `menu` (muerta, sin decidir) | 1 |
| **total** | **22** |

Las referencias de la firma en `docs/MICROCOPY_APROBADA_SIN_APLICAR.md` (`:355-372`, `:402-403`, `:432`, `:433`, `:435`) están leídas hoy, línea por línea, en el fichero de `main`.

## ③ `scrum1405c ④`, medido (§26.1)

**Población:** los 150 últimos runs completados de `ci.yml`, del 2026-10-16T13:15:03Z al 2026-10-18T19:37:33Z. 106 tienen el job obligatorio; los otros 44 no lo tienen, y por qué no lo he mirado. De los 106: 72 verdes, 17 rojos y 17 cancelados. **Se bajaron los 17 logs rojos y se leyeron los 17** (ninguno se quedó sin bajar).

| | con veredicto | rojos | rojos con `scrum1405c ④` |
|---|---|---|---|
| push a `main` | 20 | 7 | 7 (lo único que cae en los 7) |
| pull request | 69 | 10 | 3 |

- `salida-ci-rojos.txt` (de `ci-rojos.mjs`): cada rojo con sus `✖` y su `ℹ fail`. `salida-denominador.txt` (de `denominador.mjs`): el reparto entre `main` y los PR.
- **El mensaje del caso, en los 10 logs que lo traen:** «con el módulo la cobaya SIGUE perdiendo casos: la salida C no basta». Extraído con un `Select-String` sobre los logs (patrón `error: '(🔴 [^:]+:[^.]+)\..*?con el módulo: (\[[^\]]*\])`): 10 de 10 casan, y en los 10 el vector «con el módulo» tiene exactamente una pasada de cuatro con `faltan` > 0 (de 3 a 13 sobre 320).
- **Lo que no se sabe:** por qué `main` cae 7 de 20 y los PR 3 de 69. Queda como diferencia medida, sin explicación.
- **El arreglo siguiente de J6:** no hay PR abierto que toque `scrum1405c`; en el remoto están las ramas `exp-1405-force-exit` y `exp-1405-testigo-en-fichero-real`.

## Lo que NO está hecho

- Marcar las 15 en el código: es J1. Aquí sólo se le escribe.
- La decisión sobre `menu`: no la tomo yo.
- No he tocado nada de `scrum1405c` ni de su módulo.

## Mis errores

- **La cifra 17.** Se la pasé al orquestador por mensaje copiándola de c.18325, sin contar. Al escribir esta sección conté las acusadas en el JSON de declarados y salieron 15. Es la cicatriz de la línea A9.
- **Bajé los logs con `gh api` sin `--allow-escape-sequences`.** La trampa ya está escrita en `docs/equipo/trampas-del-entorno.md` y caí en ella igual. No llegó a dar una cifra falsa: la primera pasada dejó 0 logs bajados y lo vi antes de leer ningún resultado. La paré y la repetí con el flag.
- **El primer control positivo del sufijo** (una rama de 231) no vio nada, porque #2568 se había mergeado y su rama ya no existía. Lo cambié por las ramas `exp-1405-*`, que sí existen hoy.
