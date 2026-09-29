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

---

## Mitad 3 · los dos textos firmados, en la tabla del parte (rama `scrum-1266b-aviso-y-es-correcto`)

Firmados en SCRUM-1266 c.17498 sobre la propuesta de c.17497. Lo que afirman se comprobó antes de pintarlo:
la marca sí llega a la tabla (`lineasParaElTecnico`) y una lista vacía explícita sí la limpia
(`casarLineasPorIdentidad`: `[] ?? antes` no cae al valor guardado). **No se toca el servidor.**

- **Aviso** bajo la descripción de la línea marcada: `TEXTOS.noSalioEnLoDictado` + los datos separados por
  coma y espacio → «No salía en lo dictado: Honeywell, Galaxy». Se acorta solo al corregir la descripción
  (se repinta con la marca que devuelve el servidor, sin releer el parte).
- **Botón** «Es correcto» (`TEXTOS.esCorrecto`, `[data-es-correcto]`): manda la lista entera con esa línea
  en `datosNoRespaldados: []` y la descripción tal cual está en pantalla. Si falla, el aviso se queda y se
  dice con `noSeGuardo`, ya aprobado.
- **Condiciones de la firma:** (1) sólo en `filaDeLinea` editable: con el parte firmado no se pinta nada;
  (2) **el sello no se mueve** (hash igual con marca, sin marca y con `[]`), y **el parte no tiene PDF**
  (medido: ningún fichero de PDF lee la marca; el test lo fija por si nace uno); (3) el botón no toca la
  descripción; (4) una lista larga no deforma la línea: `flex-wrap`, `min-width:0` y
  `overflow-wrap:anywhere`, y el servidor la corta en 20 datos. Botón con el estilo y los 44 px de los
  demás botones del parte (selector de atributo añadido a sus reglas: ni clase ni token nuevos).

### Defecto medido de paso, registrado en `docs/BUGS.md` (P1-PARTE-1266)

Cada guardado de la tabla armaba la lista desde `parte.lineas` tal y como vino al abrir: **corregir una
descripción y después una cantidad devolvía la descripción vieja a la base**. «Es correcto» lo habría
sufrido igual (limpiar la marca = deshacer la corrección). Ahora la lista sale de la pantalla, lo guardado
se apunta con la respuesta y los guardados van en orden (el `blur` y el clic salen a la vez).

### Verificación

- `tests/scrum1266b-aviso-no-salia-en-lo-dictado.test.mjs`: la **vista de verdad** hablando con la **ruta
  de verdad**; lo que se mira es lo que queda guardado. 12/12. **Rojo contra la vista de `main`: 4 pass ·
  8 fail**, incluido el defecto de arriba sin ningún botón de por medio.
- Tanda de los ficheros que mencionan el parte (506 ficheros): 4616 · 4551 pass · 64 skip (BD) · 1 fail,
  el de SCRUM-854 por faltar este registro, que es lo que se añade aquí.
- **No se ha visto en pantalla de producción**: hay 0 partes, y sembrar es escribir (espera la regla del
  fundador para `scripts/qa/sembrar-qa.mjs`).

### Segundo commit: los otros tres guardados de la tabla (pregunta del orquestador, 29-sep)

Medido con el guardado LENTO (como un móvil en obra) y la vista contra la ruta real: «×» en otra línea,
«Añadir línea» y «Añadir estas líneas» del dictado, justo después de corregir una descripción, **la
devolvían a la de antes**. Los cinco guardados de líneas pasan por `enOrdenDelParte` y arman su lista en
su turno. Tests: 15/15; **contra `main` 4 pass · 11 fail; contra el primer commit de esta rama 12 · 3**.
Tanda de los ficheros que mencionan el parte (507): 4631 · 4567 pass · 64 skip (BD) · 0 fail.

Otras tablas editables (**leído, no ejecutado**): el editor de líneas del albarán, el plan de cobro del
presupuesto y los precios de la oficina leen el DOM al pulsar «Guardar» y releen después; no guardan
casilla a casilla desde una copia, que es la forma del defecto.
**Medido contra:** `origin/main` = `8eaee4ac18dc8096cedc8a603aa99b372d0861bb` · 2026-09-29T10:38:21Z
