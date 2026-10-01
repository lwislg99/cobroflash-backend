# SCRUM-1380 · El suelo de la tanda distingue «corrió y no reportó» de «no tiene tests»

**Rama:** `scrum-1380-suelo-corrio-y-no-reporto` · **Carril:** S5 (s5-1octd) · **Fecha:** 1-oct-2026
**Medido contra:** `origin/main` = `6ce9bf9a0f583063072d05dcac22f26cd6b419cc` · 2026-10-01T13:40:00Z

A9: comprobación → `tests/scrum1380-suelo-corrio-y-no-reporto.test.mjs`

Hijo de SCRUM-1366. Carril S5: `scripts/_suelo-de-la-tanda.mjs` y un test nuevo.

## Qué pasaba

Cuando `tests/scrum237-negacion-respaldada.test.mjs` pierde su informe en el CI, el suelo cae (bien)
y manda a mirar un `import` roto, una guarda que dejó de cumplirse o un fichero vaciado. Nada de eso
es: el fichero corrió entero. Quien lo lee busca en su rama un defecto que no está en su rama.

## El dato que los separa

La entrada de fichero del TAP trae `duration_ms`.

| Caso | `duration_ms` |
|---|---|
| scrum237 sin informe · run 36863578275, intento 1 (#2090) · leído del TAP descargado | 2242,9 |
| scrum237 sin informe · run 36860171227, intento 1 (#2084) · dato del ticket, no releído | 3682 |
| Fichero que carga y no registra nada · laboratorio local, 3 tiradas, Node 24.8 | 55,9 – 57,7 |

## El cambio

- El veredicto es el mismo rojo, con la misma salida. No se afloja nada.
- Si la entrada de fichero dura 1000 ms o más, el título añade «N de ellos CORRIÓ Y NO REPORTÓ (no es
  la rama: SCRUM-1366)» y el detalle nombra el fichero, dice cuánto corrió, que la causa está sin
  diagnosticar y que relanzar repite la tirada.
- Por debajo, el mensaje de siempre.
- Sin `duration_ms` legible no se clasifica: «NO SUPE cuánto corrió».
- El aviso de siempre (import, guarda, fichero vaciado) se sigue imprimiendo debajo en todos los casos.

## Comprobado

| Qué | Resultado |
|---|---|
| Dirigida: el test nuevo + `scrum672`, `scrum702`, `scrum736`, `scrum1289b` (los que ya fijaban el suelo) | 44 tests, 44 pasan, 0 saltados |
| `node scripts/suelo-de-la-tanda.mjs` contra el TAP real de #2090 (intento 1) | salida 1, «corrió 2,2 s y el runner no registró ninguno de sus tests» |
| Mutación: el corte a `Infinity` | caen 3 de los 6 tests nuevos |
| Tanda completa en local | NO corrida (la máquina no la aguanta hoy); la da el CI |

## Lo que NO es, y lo que encontré de paso

**No es un diagnóstico de SCRUM-1366.** El mensaje lo dice con esas palabras.

**El umbral sale de dos puntos contra tres.** Un fichero sin tests con imports pesados podría pasar de
un segundo y saldría como «corrió y no reportó». No lo he medido. Por eso el mensaje imprime la
duración y deja debajo el aviso de siempre.

**Hallazgo nuevo, medido y SIN explicar.** Comparé nombre a nombre los dos TAP del mismo commit
(`d6440609`, run 36863578275): el intento 1 (rojo, scrum237 sin informe, 9.763 entradas) y el intento
2 (verde, 9.755).

| | Intento 1 (rojo) | Intento 2 (verde) |
|---|---|---|
| Los 8 de scrum237 | faltan | están |
| `tests/scrum312-importador-clientes.test.mjs`: sus 5 ÚLTIMOS tests (líneas 279-312) | están | **faltan** |
| `SCRUM-1323 …` (⑪, ⑫, ⑫, ⑬) | 28 | **24** |
| `SCRUM-524b …` | 41 | **35** |

El intento verde perdió 15 tests en tres ficheros y no dejó ninguna entrada de fichero: el fichero
registra parte y pierde el resto. En `scrum312` son los cinco últimos del fichero, declarados sin
condición. Esa pérdida pasa el suelo (rige el 97 % del censo del árbol: caben ~290 tests) y nadie la
ve. Lo que esto dice: la pérdida de informe **no es sólo de scrum237**; scrum237 es el caso que deja
firma porque lo pierde entero. Lo que NO sé: si en los otros dos ficheros también es la cola, ni por
qué pasa. Un par de corridas, un commit. Apuntado en SCRUM-1366.

Este cambio no caza esa pérdida parcial. No tiene firma en el TAP: haría falta contar por fichero, y
el TAP plano no dice de qué fichero es cada test.

## Mis errores

1. La hora de «Medido contra» del primer commit de este registro (13:55Z) la puse a ojo desde el reloj
   local, que va adelantado; la real era ~13:40Z (cabecera `Date:` de GitHub). Corregida en el
   segundo commit. Estaba avisado en el traspaso.
2. El primer TAP que bajé con `gh run download` era el del intento 2 (el bueno) y busqué en él una
   firma que no podía estar. `gh run download` da el artefacto del ÚLTIMO intento; el del primero se
   baja por su id (`actions/runs/<id>/artifacts` → `actions/artifacts/<id>/zip`). De ese tropiezo salió
   la comparación de arriba.
