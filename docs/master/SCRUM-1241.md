# SCRUM-1241 · La fila F4 de SCRUM-1129 decía «texto consolidado» y era el texto PUBLICADO

**Medido contra:** `origin/main` = `d49787292b06b2bca8dfee765f401ca5cd39b6f7` · 2026-09-28T16:55:26Z (hora de GitHub)

Sesión J5 (`jv-j5`), 28-sep-2026, por orden del orquestador de Javier (`cobroflash-backend-3c`), que salió
del censo de citas del BOE hecho para él. Solo documentación: no toca código.

## Qué estaba mal

`docs/master/SCRUM-1129.md`, fuente **F4** (RD 1007/2023, art. 10). Se descargó con
`https://www.boe.es/buscar/xml.php?id=BOE-A-2023-24840`, y esa URL da **el texto tal como se publicó**,
no el consolidado. La fila decía *«texto consolidado a 28-sep-2026»*. **El veredicto era correcto y el
motivo mentía.**

## Por qué la cita sigue siendo correcta

El art. 10 tiene **una sola versión**. Lo confirman dos sondas independientes:

1. **API de legislación consolidada** (`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/BOE-A-2023-24840/texto`,
   sha256 `20d704afa2d24e91cf97e8ec83c41038f1eef964a1ba724ff6f0958425a8ca38`): el bloque del art. 10 (`a1-2`)
   tiene 1 versión, vigente desde el 7-dic-2023. Hay 3 bloques con más de una versión: art. 4, art. 6 y la
   disposición final 4.ª.
2. **Referencias posteriores** del análisis del BOE (`diario_boe/xml.php?id=BOE-A-2023-24840`): *«SE MODIFICA
   los arts. 4 y 6 del Reglamento y, con cambio de efectos, la disposición final 4»* (RD 254/2025) y *«SE
   MODIFICA la disposición final 4»* (RDL 15/2025). El art. 10 no aparece.

Las dos coinciden. Que la cita coincida con el vigente es **suerte**, y la etiqueta no lo decía.

## El cambio

La celda pasa a *«texto publicado, idéntico al vigente (una sola versión)»*, y en la misma celda queda
escrito lo que decía antes, para que nadie pierda la historia. No cambia nada más del expediente de 1129.

## El censo del que sale (resumen; la propuesta de norma es SCRUM-1242)

38 apariciones de URL de boe.es en el repo: 27 `buscar/act.php` (consolidado), 6 de texto publicado, 4 de
imágenes de formularios y 1 de la API de sumarios. Las 6 de texto publicado apuntan a 3 normas; en las tres
**lo citado no se ha reformado**. La única falsedad era esta etiqueta.
