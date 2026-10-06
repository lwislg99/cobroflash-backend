# SCRUM-1462 · En las listas en tarjeta (móvil), un texto largo ya no se sale de la tarjeta

**Medido contra:** `origin/main` = `dae66d0f6623072e29ecf2dc454da8b8596f30fb` · 2026-10-06T11:54:53Z
A9: comprobación → `tests/scrum1462-cliente-envuelve-en-la-tarjeta.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Dos reglas en `public/dashboard/css/styles.css`: sin marcado, sin clases nuevas, sin tokens nuevos.

6-oct-2026 · **S2** (`s2-6octb`) · rama `scrum-1462-texto-largo-no-se-sale-de-la-tarjeta`. Encargo del orquestador, con una condición: el arreglo va en la regla COMPARTIDA, no en la lista donde se midió.

## La causa

En móvil (≤640 px) las listas marcadas `table--cards-mobile` se pintan como tarjetas. La regla compartida del cliente ya decía `overflow-wrap: anywhere`, pero la tabla hereda `white-space: nowrap` (≤768 px), y con `nowrap` el texto no tiene dónde partir: se sale de la tarjeta y se corta a media palabra.

**Estaba arreglado dos veces, cada una en su lista:** `.table--trabajos td.cell-client` (SCRUM-727b) y `.table--albaranes td.cell-client` (SCRUM-1450). Las demás seguían rotas. Es el patrón de la casa: arreglado en un sitio, su gemelo atrás.

## Qué cambia

- `.table--cards-mobile td.cell-client` añade `white-space: normal`. Es la regla compartida: vale para todas las listas en tarjeta.
- `.table--albaranes td.cell-trabajo` añade `white-space: normal` y `overflow-wrap: anywhere`. Esa celda sólo existe en albaranes.
- Los dos arreglos por lista se quedan donde están: ahora son redundantes, no dañan, y quitarlos no es de este cambio.
- Número, fecha, importe y estado no se tocan: siguen en una línea.

## Medido en yaqu.app, antes y después

Sonda `sondas-s2/tarjetas-cabe.mjs` (fuera del repo). Cuenta QA 46, build servido `dae66d0f`. El JS es el de producción; «antes» usa el CSS de producción y «después» sirve el `styles.css` de esta rama. A los listados reales se les alargan en vuelo el cliente («Construcciones y Reformas Hermanos Fernández de la Vega S.L.») y el título («Reforma integral del baño y la cocina de la calle Mayor»). Nada se escribe: lo que no es GET se corta, y se comprueba antes de mirar.

Se compara el texto pintado (`Range`) contra la caja de contenido de la tarjeta.

| lista | ancho | filas | antes: qué se sale | después: qué se sale | después: algo pisa a algo | después: número, fecha o importe partidos |
| --- | --- | --- | --- | --- | --- | --- |
| Presupuestos | 390 | 4 | **el cliente** | nada | no | no |
| Presupuestos | 320 | 4 | **el cliente** | nada | no | no |
| Albaranes | 390 | 1 | **el Trabajo** | nada | no | no |
| Albaranes | 320 | 1 | **el Trabajo** | nada | no | no |
| Trabajos | 390 y 320 | 1 | nada (ya tenía su arreglo) | nada | no | no |
| las tres, en tabla | 1280 | — | nada | nada | no | igual que antes |

**El control positivo es la columna «antes»:** la misma sonda, en la misma pasada, dice que se sale cuando se sale.

Desborde horizontal de la página: 0 en todas, antes y después.

## Lo que NO se ha podido mirar

- **Cobros y Facturas: la cuenta QA tiene 0 filas en las dos.** La sonda lo dice («sin filas»), no «bien». Usan la misma regla compartida y la misma celda `cell-client`, así que el arreglo les llega; **que queden bien es lectura, no medición.** Sus vistas son de otro carril (J2 y J1).
- La tabla de albaranes dentro de la ficha del Trabajo (`jobDetailView.js`, también `table--cards-mobile`): no medida.
- Las listas que no usan `table--cards-mobile` (clientes, proveedores, plantillas usan `table--stack-mobile`; el libro registro, ninguna): fuera de este cambio y sin medir.
- Un teléfono de verdad: es Chromium de escritorio con la ventana a ese ancho.
- Desplegado: este CSS todavía no está en producción; «después» es el fichero de la rama servido por la sonda.

## Verificado, ejecutando

`tests/scrum1462-cliente-envuelve-en-la-tarjeta.test.mjs`, 5 casos. Lee la hoja y comprueba que la regla compartida declara las dos mitades.

- **Con el `styles.css` de `origin/main`: 2 rojos** (el cliente y el Trabajo) y 3 verdes (suelo y controles).
- **Con el de la rama: 5 de 5.**
- Lleva su control positivo: con la regla de antes, el lector cae; y un `white-space: normal` escrito en un comentario no cuenta.
