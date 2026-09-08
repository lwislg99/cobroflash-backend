# Las cuatro ramas paradas con el ticket abierto — ¿sirve hoy lo que hay dentro?

**Medido contra:** `origin/main` = `f2d1589041d04e5f465cc4deba010f5563ffea72` · `HEAD..origin/main` = 0
**Fecha:** 2026-09-07 · **Carril:** verificación (solo veredicto, sin arreglo)

## El hecho que las salva a las cuatro

Main ha avanzado entre **871 y 1.612 commits** desde el merge-base de cada rama, y aun así
**no ha tocado NI UNO de los ficheros que las cuatro modifican**. Comprobado fichero a fichero
con `git log <merge-base>..origin/main -- <fichero>`, y las cuatro mergean limpio
(`git merge-tree`, que no toca el árbol).

> 🔒 «Main se ha movido mucho» y «main se ha movido DONDE yo toco» son cosas distintas, y solo la
> segunda invalida una rama. La primera asusta y no significa nada.

| rama | parada | qué trae | veredicto |
| --- | --- | --- | --- |
| `scrum-242-backup-verificado` | 26 d | 1 commit · `scripts/backup-bd.mjs` + su test | ✅ SIRVE — **10/10 en verde** sobre main de hoy |
| `scrum-482-contador-offline` | 26 d | solo `docs/master/SCRUM-482.md` · «cero código» | ✅ SIRVE — sus tres hechos siguen ciertos |
| `scrum-626-arranque-en-frio` | 6 d | solo `docs/master/SCRUM-626.md` · medición | ✅ SIRVE — refuta la evidencia, no la corrige |
| `scrum-626-calentar-el-navegador` | 5 d | código + guard + test de 221 líneas | ✅ SIRVE — **12/12 en verde** sobre main de hoy |

## Detalle

**SCRUM-242** — main tiene 9 tests en ese fichero y **NO** tiene «producción no se vuelca»: el
trabajo de la rama está genuinamente ausente. Las otras tres ramas del 242 ya mergeadas tocaron
otros ficheros. Mergeada sobre main y corrida: 10/10.

**SCRUM-482** — es un PASO 0 que decide «no hace falta columna» y termina en una pregunta para el
asesor. Sus tres hechos de apoyo se comprobaron contra main de hoy: `AuditLog.meta Json?` ✅,
`@@index([merchantId, action, createdAt])` ✅, y `albaran_editado` sigue escribiéndose (el doc cita
la línea 552; hoy es la 719 — el hecho aguanta, la línea no). Su valor es ahorrarle a la siguiente
sesión volver a medir si hace falta columna.

**SCRUM-626 — las DOS ramas.** No es el caso 706: no son dos asuntos bajo un número, son
**dos trabajos distintos sobre el mismo problema**, hechos por dos carriles que no se vieron.

* `arranque-en-frio` (carril **B**, 1-sep): medición que concluye que *«el experimento NO se puede
  decidir aquí — y el 30,0 s del log no es una medición»*. Cero código.
* `calentar-el-navegador` (carril **S3**, 2-sep): mitigación — calienta el navegador antes de los
  nueve guards. `scripts/_navegador.mjs`, `scripts/guards-visuales.mjs` y 221 líneas de test.

Ninguna es ancestro de la otra. **Chocan entre sí** (las dos crean `docs/master/SCRUM-626.md`),
pero ninguna choca con main. El problema sigue vivo: main **no tiene calentamiento** y conserva
`TOPE_ARRANQUE_POR_DEFECTO = 30_000`. Son complementarias —una explica, la otra tapa— y quien las
entre tiene que fundir el fichero de máster a mano.
