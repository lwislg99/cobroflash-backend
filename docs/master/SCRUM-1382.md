# SCRUM-1382 · Un PR en borrador no es un «FALLO REAL» del abridor

**Rama:** `scrum-1382-borrador-no-es-fallo-real` · **Carril:** S5 (s5-1octd) · **Fecha:** 1-oct-2026
**Medido contra:** `origin/main` = `bc8acb9c9300b121c9afad5e8fab0239851a3436` · 2026-10-01T13:50:00Z

A9: comprobación → `tests/scrum1382-borrador-no-es-fallo-real.test.mjs`

Carril S5: `scripts/clasificar-fallo-automerge.mjs`, `.github/workflows/pr-automatico.yml` y un test.
Encargado por el orquestador; la medición de origen es de la S0.

## Qué pasaba

GitHub no arma el auto-merge de un borrador. Respuesta literal (run 36862414707, de la S0):
`GraphQL: Pull request Pull request is a draft (enablePullRequestAutoMerge)`. Eso es correcto.

El clasificador sólo conocía dos motivos legítimos (conflicto y CLEAN). Un borrador caía en «FALLO
REAL» y el paso salía rojo mandando a revisar la configuración del repositorio. En #2001, que está en
borrador a propósito, el último verde del abridor fue a las 11:08:18Z y los cuatro empujones
siguientes cayeron así (dato de la S0, no releído por mí).

## El cambio

- `clasificar()` reconoce el borrador como motivo legítimo, por ESTADO: `isDraft === true` o
  `mergeStateStatus === 'DRAFT'`. No mira el «is a draft» del mensaje.
- Va después del escalador de permisos (un borrador con error de permisos sigue siendo rojo) y antes
  del conflicto y de UNKNOWN.
- El workflow pide `isDraft` en la consulta (`--json mergeable,mergeStateStatus,isDraft`) y deja de
  esperar 25 s a que se resuelva un UNKNOWN que en un borrador ya no decide nada.
- El resumen del paso dice «(borrador, conflicto, o nada que esperar)».

## Medido

| Qué | Resultado |
|---|---|
| `gh pr view 2001 --json isDraft,mergeable,mergeStateStatus`, 13:43Z | `isDraft: true`, los otros dos `UNKNOWN` |
| Esa vista contra el clasificador de `origin/main` | `FALLO REAL: GitHub no ha resuelto la mergeabilidad…`, salida 1 |
| Esa vista contra el de esta rama | `NO ES UNA AVERÍA: el PR está en BORRADOR…`, salida 0 |
| Dirigida: el test nuevo + los 5 que leen `pr-automatico.yml` o el clasificador | 102 tests, 102 pasan, 0 saltados |
| Control positivo: BLOCKED y UNKNOWN sin borrador; `isDraft` como `"true"`, `null` o `1`; borrador + permisos | los seis siguen en «fallo real» |

El motivo que daba `main` no era el que decía el encargo («no consta un motivo legítimo»), sino el de
UNKNOWN: en el borrador GitHub ni siquiera resuelve la mergeabilidad. Por eso `mergeStateStatus=DRAFT`
solo no habría bastado y hace falta `isDraft`.

## Lo que NO he comprobado

- **El paso real en Actions.** El `case` del workflow y el `gh pr view` con el campo nuevo no se
  ejecutan en la tanda: se comprueban por texto. El primer empujón a un PR en borrador después de que
  esto entre es la prueba de verdad. #2001 lo dará solo.
- Que el PR se arme «en el primer empujón después de marcarlo como listo», como dice el mensaje: lo
  deduzco de que el workflow se dispara en `push` y no en `ready_for_review`. No lo he visto ocurrir.
  Consecuencia que sí queda dicha: marcar como listo SIN empujar no arma nada.

## Mis errores

1. Para probar el rojo previo le pasé el JSON al clasificador por una tubería de PowerShell y salió
   «JSON ilegible» en los dos, el de `main` y el nuevo. Era mi sonda (PowerShell 5.1 antepone un BOM),
   no el código: con la entrada por fichero dio lo de la tabla. Una sonda que falla igual en el antes
   y en el después no ha medido nada.
