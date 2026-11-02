# SCRUM-1629 · la tarjeta «Paquete del trimestre» dice de dónde sale el periodo

**Medido contra:** `origin/main` = `8dcf269130bab35d42a9fa4ba3d026d0efb98152` · 2026-10-29T18:55:03Z

A9: comprobación → `tests/scrum1294-a9-leccion-en-a10.test.mjs`

**Skill UI:** cargada (yaqu-premium-ui) antes de tocar `public/`. Sin token, sin CSS y sin componente nuevos:
una línea con la clase que ya tiene la tarjeta (`paquete-trimestre__texto`). Puesto S2; `exportView.js` es S2
(`node scripts/carriles.mjs de …` → `dos-equipos.md:152`). Etiquetas del ticket: `area-s2`, `equipo-luis`,
`microcopy` (sin `stop-fundador`).

## El hueco (sale de SCRUM-1602)

La tarjeta no tiene selector propio: descarga el AÑO y el TRIMESTRE de «Facturas emitidas», la tarjeta de encima
(decisión de 1602, SCRUM-1251 c.20672). Nada lo decía: un profesional podía llevarle al asesor el trimestre que
hubiera quedado puesto arriba.

## El literal y su procedencia

**«Usa el año y el trimestre seleccionados arriba.»** — texto elegido por el orquestador por delegación del
fundador, **SCRUM-1629 c.21194**. El fundador delegó la elección, no firmó el literal (c.21194 lo pide citado
así, y NUNCA como «aprobado por el fundador»). Queda abierto a que el fundador lo cambie sin discusión.

No me lo he elegido yo: lo trae c.21194, y lo copio tal cual.

## Decisiones declaradas

- **Dónde va:** entre la descripción (T2) y la ayuda (T3), es decir, ANTES del botón «Descargar ZIP»: se lee
  antes de pulsar. c.21194 dice que «cabe debajo del botón» como argumento de tamaño, no como sitio; debajo del
  botón está `#paquete-trimestre-info` (`aria-live`), que es donde la tarjeta dice el resultado de la descarga, y
  mezclar ahí el periodo lo haría leerse DESPUÉS de haber pulsado.
- **Cómo se ve:** misma clase que T2 (`paquete-trimestre__texto`: 13 px, `--muted`). Ninguna regla nueva en
  `styles.css`.
- **Dónde vive la cita:** en el bloque de comentario que hay justo encima de `TARJETA_PAQUETE_TRIMESTRE`, que es
  donde T1–T7 citan la suya (c.20675). Primero la puse en una constante con la cita en la misma línea, interpolada
  en la plantilla: **eso tumbó `scrum601`** (veredicto `flag` 8 → 7), porque una plantilla con `${…}` deja de ser un
  literal y el censo deja de ver que la tarjeta ENTERA sólo existe en `fiscal`. El guard tenía razón: se arregló el
  código (literal dentro de la plantilla), no el guard (regla 41). Con eso, 601 vuelve a `{ flag: 8, tipo: 11, aPelo: 162 }`
  sin re-anclar nada.
- **El flujo no cambia:** la tarjeta descarga lo mismo que antes; sólo dice de dónde lo saca.

## Rojo primero y mutación

`tests/scrum1629-paquete-dice-de-donde-sale-el-periodo.test.mjs`, 3 casos en el banco de vistas (como 1602):

| caso | sin el cambio | con el cambio |
|---|---|---|
| en `fiscal` la tarjeta dice el periodo, antes del botón, con su cita como delegación | 🔴 cae | verde |
| «arriba» es verdad: «Facturas emitidas» va antes que la tarjeta en el marcado | verde | verde |
| CONTROL: fuera de `fiscal` (receipt, demo, desconocido) la línea no existe | verde | verde |

Mutación de `MUTACIONES_QUE_ME_TUMBAN` (quitar la línea): tumba el primer caso (2 verdes · 1 rojo), árbol restaurado.

## Vecinos

Los 33 ficheros que nombran `exportView` más los censos de literales y firma (1602, 1157, 1502, 601, 1257, 709,
237, 1560, 836, 1590, 553, 719, 1340): 335 tests, 335 verdes, 0 saltados. `scrum553`: 20 (tope 20).
`censo:mudez --escribir`: sin cambios en `tests/_veredicto-mudez.json`.

## Aceptación → dónde se ve

| aceptación (c.21194) | dónde se ve |
|---|---|
| 1 · la tarjeta dice de dónde sale el periodo, con ESTE literal, citado como delegación | caso 1 del test; comentario encima de la plantilla |
| 2 · rojo primero | tabla de arriba |
| 3 · ninguna palabra vetada; el test de 1602 no se toca | `scrum1602` verde entre los vecinos, sin tocar; la frase no lleva ninguna de las vetadas |
| 4 · ¿se puede ver en yaqu.app? | **NO, y es lo correcto:** la tarjeta sólo se pinta en modo `fiscal`, y en España nadie lo está antes de SIF-1 (regla 24). Llegar exigiría un flag, y eso es STOP. Se mide en el banco |
