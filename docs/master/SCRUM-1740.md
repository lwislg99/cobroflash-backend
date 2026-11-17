# SCRUM-1740 · tras firmar el parte, el albarán nace con sus líneas (y «+ Nuevo albarán» sale una vez)

**Medido contra:** `origin/main` = `b8fc4077c24a4338d73836b9918f51b31b17e1d8` · 2026-11-17T16:53:25Z

Ticket repartido (c.21982, forma decidida por la delegación general, SCRUM-1656 c.21978): **S1** el POST
de crear albarán precarga desde el último parte firmado (#3194, que trae su propio registro con este
mismo nombre); **S2** la pantalla, aquí. Quien mergee segundo junta los dos ficheros: el de S1 entero y
este apartado S2 debajo, sin reescribir el otro.

## 17-nov (S2) · la ficha del Trabajo: un solo «+ Nuevo albarán» y el alta que usa la precarga

**Fecha:** 17-nov-2026 · **Puesto:** S2 · **Skill UI:** cargada (`yaqu-premium-ui`; cero tokens, cero
estilos en línea, cero componentes, cero textos nuevos).

- **Qué había (S4, recorrido H6, fila 20, 16-nov):** con el parte firmado y sin albaranes, la ficha
  ofrecía «+ Nuevo albarán» DOS veces —la primaria de la cabecera (la escalera devuelve `kind: 'nuevo'`
  siempre que no hay albaranes) y el botón de la barra de Albaranes—, y el alta prellenaba desde el
  PRESUPUESTO (o nada): ninguna línea del parte viajaba.
- **Contrato con S1** (el de arriba, confirmado por mensaje de la sesión 1 el 17-nov): POST SIN la clave
  `lineas` + último parte (id MAYOR) en `firmado` → borrador con sus líneas y `precargaDelParte`.
- **Arreglo (`public/dashboard/js/jobDetailView.js`):**
  - `ultimoParteFirmado(job.partes)`: el de id mayor, sólo si está firmado (mismo criterio que la ruta).
  - `abrirAltaAlbaran`: con ese parte, la hoja de alta se abre SIN prellenar desde el presupuesto (no
    se pide `GET /admin/quotes/:id`), para que «Crear albarán» mande el POST sin `lineas`.
  - Tras el POST, si la respuesta trae `precargaDelParte` y líneas, el flujo ATERRIZA en el borrador:
    se abre su editor de siempre (`openAlbEditorSheet`, «Editar albarán <número>»), donde el operario
    quita o cambia lo que no aplique antes de emitir. El aviso es el toast que ya existía, con el
    número de líneas de la respuesta.
  - «+ Nuevo albarán» de la barra no se monta cuando la primaria de la cabecera ya es `nuevo` (mismo
    rótulo, misma alta). Con otra primaria (p. ej. «Emitir albarán»), la barra lo sigue ofreciendo.
- **SCRUM-303 sigue en pie:** abrir no crea nada ni quema número; el único POST de alta sigue dentro de
  `openAlbCrearSheet` (el censo por AST de `scrum303` sigue en verde). Consecuencia declarada: con parte
  firmado, la hoja de alta se ve VACÍA hasta pulsar «Crear albarán» —las líneas las pone el servidor al
  crear y se ven en el borrador—. Enseñarlas antes exigiría leer el parte en el navegador y mandarlas
  en el cuerpo, que es justo lo que anula la precarga del servidor (y una segunda copia del mapeo).
- **Test** `tests/scrum1740-albaran-desde-parte-firmado.test.mjs` (banco de vistas, por rol admin y
  técnico, desenrollado). 🔴 **La respuesta del POST está SIMULADA** con la forma del contrato: la ruta va
  en #3194; el acople real se mide en yaqu.app (regla 42). Contra main: **6 rojos / 3 verdes (los
  controles)**; con el arreglo **9/9**. Mutaciones, una a una: barra sin condición → 4 rojos; sin
  detectar el parte → 3; sin aterrizar en el borrador → 3; «cualquier parte firmado» en vez del último
  → 2.
- **`tests/scrum817-orden-del-detalle-del-trabajo`**: su inventario contaba los DOS «+ Nuevo albarán».
  Se DECLARA la retirada en su `RETIRADAS_A_PROPOSITO` (motivo y dónde vive ahora), el mecanismo que el
  propio test trae para esto; la comprobación no se toca. `tests/_veredicto-mudez.json` regenerado con
  `npm run censo:mudez -- --escribir` (el fichero de 817 cambió).
- **Medido:** los 47 ficheros que montan la ficha o nombran el alta, 445 tests: 0 rojos tras regenerar
  la mudez. `guard:detalle-trabajo-917` 244/244 · `guard:escalera-por-estado` verde · `guards:entrada`
  15/15. Tanda entera (`tests/*.test.mjs`): 13 534 pass, 7 fallos, 180 saltados. Los 7, re-medidos
  sueltos y ya arreglado el registro: los 3 de `scrum267` (el ancla de este registro, añadida con la
  tanda ya corriendo), `scrum976` ④ (`guards:entrada`, rojo entonces por la línea A9) y `scrum1244c`
  (tope de tramo con la máquina cargada) salen en verde; quedan los 2 de `scrum1726` D1, el ICU de esta
  máquina (cambia el separador de la fecha; la rama no toca esos ficheros).
- **Error propio:** escribí el presupuesto del banco con campos que no son los suyos (`description`/
  `quantity` en vez de `concept`/`qty`): el prellenado salía vacío y el caso de precarga pasaba su primer
  assert por la razón equivocada. Lo delataron los CONTROLES, que cayeron contra main: un control que
  sale rojo donde debía salir verde es la señal de que el banco no mide lo que dice.

A9: comprobación → `tests/scrum1740-albaran-desde-parte-firmado.test.mjs`

- **No medido aún (regla 42):** el acople real con la ruta de #3194 y las capturas 390/1280 con el banco
  H6 se hacen en yaqu.app cuando estén los dos PR en main: crear un albarán tras un parte firmado →
  líneas heredadas, sin precios, un solo botón.
