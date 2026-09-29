# SCRUM-1263 — Si lo despertó el avisador, `@claude` solo empuja con el guard que cayó en VERDE

**Medido contra:** `origin/main` = `61a975bb10fee30aad45fdbbc80eb07d6c808908` · 2026-09-29T09:15:43Z

Sesión 3 (instrumentos), rama `scrum-1263-claude-empuja-solo-en-verde`. Decisión del fundador: **opción C**
(descripción del ticket). Añadido del com. 17458: comprobar que el push disparó CI.

## Lo medido antes de construir

| Qué | Medido | Cómo |
| --- | --- | --- |
| ¿Se acuñó el token de la App en los runs de la noche? | **Sí**, en los dos: `36493867580` (22:41Z, #1943) y `36496035994` (23:04Z, #1944). Paso «Acuñar token» = `success`, paso «CIEGO» = `skipped` | `gh run view --json jobs` |
| ¿El push del bot dispara CI? | **Sí**: `6787a7f0` (bot, #1944, sin conflicto) tiene **8** check-runs, los mismos que `c80b2f84` y `65996e85` (J5) | `commits/<sha>/check-runs` |
| ¿Y el PR mudo #1943? | `008fbd51` tiene **1** check-run. La causa medida es el **conflicto con main** (com. 17460, J3), no el token | idem |
| ¿Por qué empujaba a ciegas? | Dentro de `claude-code-action@v1` Claude solo tiene `git add/commit/rm` y el envoltorio `scripts/git-push.sh` (`origin <ref>`, sin flags). **No puede correr `node`** | fuente de la acción, `src/create-prompt/index.ts`, `scripts/git-push.sh` |
| ¿Qué guard cayó? | El avisador solo nombra el CHECK y el run. El test sale del resumen `✖ failing tests:` del log del job: `test at tests/scrum525d-anclas-que-apuntan.test.mjs:180:1` | log del job `109171242769` |
| ¿El arreglo del bot dejaba el guard rojo? | **Sí**, reproducido: sobre el árbol de `6787a7f0` el test `SCRUM-525d · 🔴 TRINQUETE…` sale `not ok`; sobre `65996e85` sale `ok` | `node --test` con TAP sobre cada árbol |

⚠️ **La premisa del encargo «su push NO disparó CI» no se sostiene**: el token se acuña y el push del bot a un PR
sin conflicto tiene sus 8 check-runs. Aun así se añade la comprobación del com. 17458, porque un PR mudo por
conflicto es igual de invisible.

## Lo construido

- `scripts/puerta-claude-empuje.mjs` — lee quién despertó (marca del avisador + run), qué cayó (log), el
  veredicto POR NOMBRE sobre el árbol de Claude (TAP: `ok` sin SKIP = verde; saltado o ausente = **no**
  verde), la decisión, y los dos comentarios (sin la mención; se comprueban con `cuerpoNoDebeDespertar`).
- `claude.yml`:
  · paso `origen` (antes de la acción): si lo despertó el avisador, `pre-push` por `core.hooksPath` GLOBAL;
  · paso `empuje` (después): copia sin credenciales, `npm ci` + build, corre los ficheros que cayeron, y
    empuja con la llave de la App **solo** con `EMPUJA-GUARD-VERDE`; si no, comenta con el parche
    (y artefacto `parche-claude`);
  · paso «¿Disparó CI el push?»: hasta 4 min esperando el check obligatorio sobre el sha; si no aparece,
    `PR-MUDO` en el PR, nombrando el conflicto cuando `mergeable_state = dirty`.
- Si lo despierta una **persona**, nada cambia (el control lo mide).

## Aceptación

| # | Criterio | Dónde |
| --- | --- | --- |
| 1 | Caso nuevo en `scrum834` visto ROJO antes del arreglo | 13 tests nuevos en rojo con el árbol quieto (módulo ausente); 41 previos verdes |
| 2 | Control positivo: un arreglo que pone el guard en verde sigue empujando | `CONTROL POSITIVO` con el TAP real de `65996e85` (que además trae OTRO `not ok` ajeno: se mide por nombre) |
| 3 | Caso real: guard rojo tras el arreglo → no push, comentario | `CASO REAL` con el log y el TAP reales de `6787a7f0` |
| 4 | El TOPE POR PR sigue: 10 ciclos → 3 avisos y `TOPE-ALCANZADO` | tests de `scrum834` sin tocar, verdes |

Mutaciones declaradas (`MUTACIONES_QUE_ME_TUMBAN`) y probadas a mano, 4/4 caen: quitar el `core.hooksPath` del
paso real · gancho que deja pasar · empujar con el guard rojo · contar un SKIP como verde.

Además: `tests/scrum1263-gancho-pre-push.test.mjs` ejecuta el paso `origen` REAL del YAML con bash y el
comentario del avisador renderizado desde `avisador-rojo.yml`, contra un remoto git de verdad.

## Límites, dichos

- **No se ha ejecutado la acción de Anthropic.** Se mide que `git push origin <ref>` —lo que su envoltorio
  ejecuta— se para con el gancho. Si la acción cambia de envoltorio o añade `--no-verify`, esto no lo ve.
- Los tests que necesitan el banco (`LIBRO_PG_URL`…) se SALTAN en el job de Claude → `SIN-CORRER` → **no se
  empuja**. Falla cerrado a propósito: si el guard que cayó es de BD, el parche queda en el PR.
- La pasada local ejecuta código del PR (npm ci, tests) en un job con `contents: write`. Mitigado: copia
  sin `.git/config` de la acción y `env -i` sin tokens. El avisador solo despierta sobre PR propios, no forks.
- ② del ticket (escribir en la rama de una sesión viva) sigue fuera de alcance, como dice el ticket. Lo que sí
  cambia: si la sesión empuja mientras Claude trabaja, la rama se ha movido debajo → no se empuja y se comenta.
- Lo que no se puede probar hasta que corra en GitHub: el poll de check-runs y la subida del artefacto.
