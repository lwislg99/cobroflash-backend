# SCRUM-1450 · Lista de albaranes: la facturación con las palabras de la ficha

**Medido contra:** `origin/main` = `0dbf8eae7e47b8fd272aa644b810041c6ec3f9c0` · 2026-10-02T18:22:56Z
A9: aviso → cicatriz S2 «Medí si dos cosas se pisaban comparando CAJAS, y un texto que no envuelve se sale de su caja: el solape lo vio la captura, no mi medición.» — no se pudo comprobar: la sonda de navegador vive fuera del repo (`sondas-s2/alb-cabe.mjs`); se le añadió la comparación contra el texto pintado y un control positivo

Carril S2 (`public/dashboard/js/albaranesView.js` y `public/dashboard/css/styles.css`; fila general de `orquestador.md` §11bis, comprobado) · rama `scrum-1450-lista-albaranes-facturacion-firmada` · sesión del 6-oct-2026.

**Skill UI:** cargada (`yaqu-premium-ui`) en esta sesión, antes de editar. Un componente (la lista de albaranes). Sin color, sombra, fuente ni componente nuevos. Capturas antes/después a 1280, 390 y 320 hechas y miradas; no se guardan en el repo.

## El defecto

Desde SCRUM-1375 (2-oct-2026) la ficha del albarán dice «Sin facturar» / «Facturado en parte» / «Facturado». La lista seguía con el dato: «parcial» / «facturado» en la marca de la fila y «sin facturar · parcial · facturado» en el filtro. Dos vocabularios para un hecho.

## Firma

Los tres literales son los de **SCRUM-1375 comentario 18203** («Aprobado por el orquestador por delegación del fundador»), aplicados a un tercer sitio. Que la lista también cambie lo decidió el orquestador (descripción de SCRUM-1450 y encargo del 6-oct-2026). No hay texto nuevo.

🔴 **Esto SUSTITUYE una aprobación anterior, y se dice.** Las tres opciones del filtro («sin facturar», «parcial», «facturado») estaban aprobadas desde el 5-ago-2026 y las fijaba `tests/scrum301-albaranes-seccion.test.mjs` (`COPY_APROBADA.cobro`). Esa ranura del test cambia lo que AFIRMA porque cambió la decisión, no para que pase el código: queda escrito en el propio test, con las dos fechas. Si el orquestador no quería tocar esa aprobación, se revierte en ese renglón y en `etiquetaCobro`.

## El arreglo

- **Un solo mapa.** `albaranesView.js` no escribe los literales: `etiquetaCobro` pide el texto a `textoDeFacturacion` (`albaranDetailView.js`, de S4, **sin tocar**). `index.html` carga la ficha antes que la lista (líneas 329 y 335); el test lo fija.
- **Marca de la fila:** el texto de la ficha. Un albarán sin facturar sigue sin marca.
- **Filtro:** «Sin facturar (n)», «Facturado en parte (n)», «Facturado (n)». «Facturación: todos (n)» no se toca.
- **Lo desconocido no se pinta crudo:** un valor que el mapa no conoce no tiene marca ni opción en el filtro (sus albaranes siguen en «todos»). Lo mismo si el mapa no estuviera cargado: la lista se pinta y calla.
- La píldora de ESTADO (`firmado`, `emitido`, `borrador`) sigue imprimiendo el dato. No es de este ticket.

## ¿Cabe «Facturado en parte»? Medido: tal cual, NO. Con maquetación, sí

Banco local en navegador real (Chromium sin cabeza): el `index.html`, los CSS y los scripts del árbol servidos desde disco, `app.js` vacío, `GET /admin/albaranes` de mentira con cuatro filas (una con cliente de 59 letras). Ninguna petición a la red. Inter cargada.

Con sólo el cambio de texto:

| Ventana | Qué pasaba |
| --- | --- |
| 1280 | la marca se partía en dos líneas («Facturado en / parte», 108×42 px) |
| 320 | estado y marca en línea pedían 209 px y la celda **pisaba el número del albarán** (celda desde x=71; el número acaba en x=101) |
| 390 | cabía (celda desde x=141) |

Arreglado en `styles.css`, sólo para `.table--albaranes`, sin tocar el texto:

- `.alb-chip-cobro { white-space: nowrap }`: una línea siempre (127×24 px).
- En tarjeta (≤640 px) la marca va **debajo** del estado, y el estado ocupa sólo la línea del número. El cliente pasa a ancho completo y envuelve.

| Ventana | Marca | ¿Pisa algo? | ¿Dentro de la tarjeta? | Filtro con la opción larga |
| --- | --- | --- | --- | --- |
| 1280×900 | 127×24, una línea | no | sí | texto 143 px en hueco de 164 |
| 390×844 | 127×24, una línea | no | sí | 143 en 164 |
| 320×640 | 127×24, una línea | no | sí | 143 en 164 |

«Pisa» = la marca o la píldora de estado se cruzan con el texto pintado del número, el cliente, la fecha, el Trabajo o las acciones. Control positivo: forzando la rejilla mala, el detector lo ve a 390 y a 320.

### Lo que cuesta

- En móvil la tarjeta con marca crece: 135 → 168 px (nombre corto) y 187 → 241 px (nombre de 59 letras, que ahora envuelve en dos líneas). Sin marca, 187 → 193.
- En escritorio la columna «Estado» se ensancha (121 → 188 px) y una fila con cliente muy largo pasa de 88 a 109 px.

### Lo que ya estaba roto y esto arregla de paso (medido en `main`)

A 390 y a 320, con un cliente largo, el nombre no envolvía, se salía de la tarjeta y la marca «parcial» quedaba encima. Con la rejilla nueva ya no.

### Lo que sigue roto y NO se toca

El título del **Trabajo** largo se sale de la tarjeta en móvil (no envuelve), antes y después. Es el mismo `white-space: nowrap` de `.table td` en móvil (`styles.css:2153`), que afecta a todas las listas en tarjeta. No es de este ticket.

## Verificado

- `tests/scrum1450-lista-albaranes-facturacion-con-palabras.test.mjs`: la lista pintada en el banco. Rojo 0/5 con `main` → verde 5/5. Marca, filtro, valor desconocido, mapa ausente, y «un solo mapa» (la lista no contiene los literales; `index.html` carga la ficha antes).
- `tests/scrum301-albaranes-seccion.test.mjs`: la ranura `cobro`, con la firma nueva.
- Navegador: las tablas de arriba.

## Límites

- **No visto en yaqu.app.** La cuenta QA está muerta (cookie caducada el 3-oct-2026 16:37Z) y, aunque viviera, no tiene albaranes `parcial` ni `facturado` (SCRUM-1367). Lo medido es el banco local con el código del árbol.
- Chromium de escritorio con ventana encogida; no un móvil real ni Safari.
- El desplegable ABIERTO del filtro lo pinta el sistema y no se ha medido; cerrado, la opción larga cabe.
- `docs/microcopy/2026-10-02-SCRUM-1375-facturacion-del-albaran.md` (carril S4) sigue diciendo «La lista de albaranes… no está firmado que cambie». Desde este ticket es falso; no lo edito por carril.

## Errores propios de esta tanda

- Mi primer arreglo de maquetación (apilar la marca dejando el estado en dos líneas) tapaba el nombre de un cliente largo, y mi comprobación de solapes dijo «ninguno»: comparaba cajas, y el texto que no envuelve se sale de la suya. Lo vi en la captura. La sonda compara ahora contra el texto pintado y lleva control positivo.
- La primera medida «antes» de la segunda ronda usaba el JS de `main` con el CSS de la rama: no era `main`. Repetida con los dos ficheros de `main`.
