# SCRUM-1266 · el dato que la máquina se inventó llega al parte MARCADO, y se corrige antes de entrar

GO del orquestador (29-sep, por mensaje), con este orden: primero que la marca **sobreviva**, después que la
descripción se pueda **editar en la propuesta**. Sin texto nuevo. El saneador (`parteDictado.ts`) no se toca:
que marque y no limpie es una decisión de SCRUM-725.

## El defecto (medido sobre `ba1b0966`)

El saneador señala en `datosRetirados` los tokens que el dictado no respalda y la propuesta los avisa
(SCRUM-725). Pero `lineasConfirmadas` mandaba `{bloque, unds, descripcion}`: **al añadir, la marca se
perdía**, el dato inventado entraba en el parte como si lo hubiera escrito el profesional, y con la
firma se congelaba (`puedeEditarContenido`). Además, en la propuesta la descripción era un `<span>` de
solo lectura: para corregir el dato había que meterlo antes en el parte.

## Mitad 1 · la marca sobrevive (dato guardado, sin pintar nada nuevo)

- `LineaParte.datosNoRespaldados?: string[]`: vive en el JSON `ParteTrabajo.lineas`, así que **no es
  schema ni necesita ALTER**. **No entra en el sello:** `lineasCanonicasParte` escribe sus tres campos a
  mano (probado: el hash es el mismo con marca y sin ella).
- `marcaQueSigue` (privada, en `parteTrabajo.ts`): de los tokens marcados, deja **solo los que siguen
  escritos** en la descripción, con el mismo corte que el saneador. Si se corrige el dato, la marca se
  va; si se deja, se queda.
- `casarLineasPorIdentidad`: guarda la marca que traiga la línea o, **si no trae ninguna** (una pantalla
  que no la conoce), la que tenía guardada, filtrada contra la descripción nueva.
- `validarLineasDelTecnico` (PATCH) la deja pasar; `lineasParaElTecnico` la devuelve **solo si la
  hay**, así que una línea sin marca sale con sus cuatro campos de siempre (los tests de «ni un
  importe» siguen intactos).
- Front: la fila de la propuesta lleva `data-datos-no-respaldados`; `lineasConfirmadas` manda la marca
  con la línea; `lineaQueSeGuarda` la devuelve al guardar desde la tabla.

## Mitad 2 · la descripción se corrige en la propuesta

- El `<span>` pasa a ser `input[data-propuesta-desc]`, con el mismo rótulo accesible que el campo de
  descripción de la tabla (`TEXTOS.descripcion`). Ni un texto nuevo.
- `sincronizarAvisosDeDatos`: el aviso ya aprobado de SCRUM-725 sigue a lo que queda escrito (se oculta
  al quitar el dato y vuelve si se escribe otra vez), igual que el de cantidad de SCRUM-1230.
- Una descripción vaciada **no** se descarta en el cliente: el servidor la rechaza con su motivo, que es
  mejor que perder la línea en silencio.

## Verificación

- `tests/scrum1266-marca-dato-inventado.test.mjs` recorre el **viaje**, en el panel entero (banco) y en
  el dominio (dist): dictar → propuesta marcada → añadir → **el PATCH lleva la marca** (y la línea de al
  lado no) → el servidor la guarda y la devuelve → una edición desde una pantalla que no la conoce
  conserva solo lo que sigue escrito → corregir en la propuesta quita el aviso y la marca → el sello no
  cambia. **Rojo por mutación, uno de uno:** sin la marca en `lineasConfirmadas` → 4 pass · 1 fail; sin
  ella en `casarLineasPorIdentidad` → 4 pass · 1 fail.
- `scrum1230`: el localizador `filaDe` buscaba un `<span>` y ahora busca el campo. Es la consecuencia del
  cambio de DOM, no una relajación: las aserciones son las mismas.
- `scrum818` se puso rojo en la primera versión (el aviso se perdía si `datosRetirados` llegaba sin
  `tokens`). **Se arregló el código**, no el test.
- Tanda de la zona + trinquetes 1185, 1157 y 411 (41 ficheros): **361 · 355 pass · 0 fail · 6 skip**. Los
  6 skip son de BD (`QA_DB_TEST`).
- **No se ha visto en pantalla:** en producción hay 0 partes, y conducir el navegador contra
  producción lo deniega el clasificador ([Production Reads]). Espera al modo `sembrar` de sesion-panel
  (encargado a S3).

**Lo que NO entra:** pintar la marca en la tabla del parte o en el PDF. Eso sería texto nuevo y necesita
firma: se decide después.

**Medido contra:** `origin/main` = `61a975bb10fee30aad45fdbbc80eb07d6c808908` · 2026-09-29T09:17:27Z
