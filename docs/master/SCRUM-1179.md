# SCRUM-1179 · Los 25 instrumentos «que no corren en ningún sitio», uno a uno — y las citas que mentían

**Medido contra:** `origin/main` = `a59dc1e692bae683d2d035fe52534b5589d0c7b3` · 2026-09-28T14:57:39Z

28-sep-2026 · **S3**. La propuesta completa está en Jira, SCRUM-1179, comentario 17339. La decisión
del orquestador (por delegación del fundador) está en el comentario 17340.

## Lo medido, en una línea por grupo
La premisa del ticket se corrigió midiendo: al npm script no lo llama nadie, pero **21 de los 25 los
importa algún `tests/*.test.mjs`**, y **7 ya bloquean** lo que vigilan. La pregunta útil no era
«¿corre?», sino **«¿el test lo comprueba sobre el árbol REAL y bloquea algo NUEVO?»**.

| Grupo | Cuántos | Decisión |
|---|---|---|
| A · ya bloquean | 7 | nada (`guards:entrada` es redundante: se escribe) |
| B · el test existe, falta la mitad que cierra | 4 (~9 s) | al check obligatorio, uno por PR |
| C · no caben o no son deterministas en CI | 7 | job informativo; `tactil-panel` primero |
| D · herramientas manuales | 6 | se quedan; PROHIBIDO citarlas como red |
| E · vigila algo que ya no existe | 1 | se borra `censo:escalera-por-estado` |

## Este PR — las citas que presentaban como red algo que no corre
| Fichero | Antes | Ahora |
|---|---|---|
| `scripts/guard-objetivo-tactil.mjs` (cabecera) | «las otras quince siguen medidas por `censo:tactil-panel`» | no las vigila nada que corra; censo MANUAL; no se cite como red. La corrección de SCRUM-1172 arregló el cuerpo y el mensaje final, **no la cabecera** |
| `tests/scrum719-el-suelo-de-los-doce.test.mjs` (mensaje) | «comprobación completa: `censo:mudez`» | `censo:mudez` es manual; la única red que bloquea es esa lista |
| `scripts/meta-guard-mutaciones.mjs` | `censo:mudez` «que ya existe» | existe, pero es manual: no es una red |
| `tests/scrum711-guards-sin-sitio.test.mjs` (cabecera) | «sus cuatro comprobaciones» | todas las de su lista `GUARDS`: un atajo, no una red más |
| `docs/master/README.md` | «No es un guard, son CUATRO» | son los de la lista `GUARDS` (sin cifra, que caducó una vez); atajo, no red |
| `scripts/guards-entrada.mjs` (cabecera) | — | ATAJO, NO RED: todo lo que corre ya está en la tanda |

**Sin cifra a propósito:** «cuatro» caducó cuando la lista creció a 12. Escribir «doce» caducaría igual.

## No tocado, y por qué
- `docs/master/SCRUM-641.md:216` (`npm run cr:censo --limpiar`: sin `--`, npm se come el flag),
  `SCRUM-791.md:29` y `SCRUM-917.md:874` («medida por `censo:tactil-panel`»): son **registros
  históricos**. Cuentan lo que se hizo, no instruyen, y no se reescriben. Quedan señalados aquí.
  **Corregido por decisión del orquestador (28-sep):** `SCRUM-641.md:216` no es narración, es un
  comando que se puede copiar. No se reescribe, pero lleva al lado un apéndice que dice que no
  limpia nada y cuál sí. Medido: `npm run <script> --limpiar` avisa `Unknown cli config` y el
  script recibe `argv` vacío. 791 y 917 se quedan como están.
- Las 3 promesas de la landing congeladas en `SIN_ANCLA_HOY` (`censo:anclas-f`): la landing es STOP
  del fundador; las sube el orquestador.
- B, C, D (cabeceras y guard) y E: PR aparte, uno por instrumento.

Tests afectados (42 ficheros): 364 verdes y 4 saltos ajenos (`QA_DB_TEST`, SCRUM-781).
