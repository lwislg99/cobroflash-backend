# SCRUM-1388 · «Facturas recibidas»: los cuatro literales firmados, y el cartel de carga sin la tripa debajo

**Medido contra:** `origin/main` = `d2ed6c8a2c4d2b3487c4557094d12915e9dfb83c` · 2026-10-02T02:30:51Z

2-oct-2026 · **J4a** (equipo de Javier), por encargo del orquestador (`cobroflash-backend-5b`).
Rama `scrum-1388-facturas-recibidas-literales-firmados`.

A9: aviso → A10 «Un prefijo no es un nombre, y una subcadena tampoco.» — no se pudo comprobar: el recuento de carteles por subcadena estaba en la primera versión de mi sonda de navegador, que es un fichero de evidencias y no un guard de la tanda; lo cazó leer mi propia salida (dos carteles donde la captura enseñaba uno) y nada impide que la próxima sonda nazca igual.

**Fecha:** 2-oct-2026
**Skill UI:** cargada (`yaqu-premium-ui`). No entra ningún componente, token, color ni clase nueva:
cambian cuatro textos y se RETIRA un párrafo con su regla CSS (`.fr-alert-detail`). El cartel sigue
siendo el `.alert.error` del inventario AB3. Checklist AB6, casilla a casilla, en ⑦.

## Ficheros

`public/dashboard/js/facturasRecibidasView.js` · `public/dashboard/css/styles.css` ·
`tests/scrum1388-facturas-recibidas-literales-firmados.test.mjs` ·
`docs/microcopy/2026-10-01-SCRUM-1388-facturas-recibidas.md` · `docs/evidencias/scrum1388/` ·
`docs/equipo/cicatrices/J4.md` · y los cuatro trinquetes de ④.

## ① Qué había, medido por efecto antes de tocar nada

Sonda `docs/evidencias/scrum1388/sonda-cartel.mjs.txt`: Edge, la pantalla y el `apiRequest` reales,
y delante de la ruta la puerta `requireRole('admin')` y el router de libros de `dist/`. La sesión y
Prisma son dobles, y lo dice la cabecera de la sonda. No mide producción.

Población: 8 casos × 2 anchos (390 y 1280 px), 16 de 16 pintados. Salida entera en
`sonda-cartel.ANTES-d2ed6c8a.txt`. A 390 px:

| caso | qué contestó el servidor | qué leía el profesional |
|---|---|---|
| 403 (puerta real) | `403 {"error":"forbidden","required_role":"admin"}` | cartel «[PENDIENTE microcopy oficial] No se ha podido cargar el libro. Vuelve a intentarlo.» y debajo «API 403: forbidden» |
| sin red (conexión cortada) | nada | el mismo cartel y debajo «Failed to fetch» |
| 500 (fabricado) | `500 {"error":"internal_error"}` | el mismo cartel y debajo «API 500: internal_error» |
| 200 sin `miradas` (fabricado) | `200 {"filas":[]}` | el mismo cartel y debajo «respuesta_incompleta» |

**El ticket decía que el cartel no usaba `COPY.error`. Lo usaba.** El texto crudo iba en un SEGUNDO
nodo, un párrafo gris debajo (`p.fr-alert-detail`, `err.message` tal cual). Así que el arreglo no es
sustituir el cartel: es quitar ese párrafo. Y el control que podía tumbarlo —que un fallo siga
viéndose— ya se cumplía antes: pasa a ser la comprobación de que no se rompe.

El cuarto caso no estaba en el ticket. «respuesta_incompleta» no viene del servidor: lo fabrica la
propia vista (`new Error('respuesta_incompleta')`) cuando la respuesta llega sin `miradas`.

## ② Qué cambia

1. `titulo`, `error`, `vacioDeVerdad` y `descuadre` llevan el texto firmado, copiado de la
   descripción del ticket, y pierden la marca de pendiente. La constante `MARCADOR` y `rotulo()`
   se retiran: en el fichero no queda ninguna marca.
2. `pintarError` deja de pintar el párrafo de detalle y deja de recibir el error. El cartel se
   queda, con `COPY.error`. La regla `.fr-alert-detail` sale de `styles.css`: se quedaba huérfana.
3. Ficha de la firma en `docs/microcopy/`.

No se toca `menu`, «Cargando…», `recuento`, las cabeceras de columna, «Total», «Año», «Trimestre»
ni «Consultar». No se toca `src/`, ni el esquema, ni el camino de emisión: la pantalla sólo lee.

**Por qué no `mensajeParaPersona`** (el camino de SCRUM-1233): esa función enseña la frase del
servidor cuando la hay. La ruta `GET /admin/libros/recibidas.json` no manda nunca `message` (su
400 lleva `detalle`), así que no hay frase que rescatar, y el ticket pide que el cartel diga sólo
las palabras firmadas.

## ③ Qué hay ahora, con la misma sonda

`sonda-cartel.DESPUES-82255e6c.txt`, 16 de 16. En los cuatro fallos: UN cartel, visible (63 px de
alto a 390, 42 a 1280), con «No hemos podido cargar tus facturas recibidas. Vuelve a intentarlo.»,
cero tablas y nada debajo. Marcas de pendiente a la vista, sumando los ocho casos: 15 antes, 0
después. Ningún nodo desborda a ninguno de los dos anchos.

El caso que el orquestador pidió dejar escrito, con las dos frases tal como se midieron:

- **antes:** cartel «[PENDIENTE microcopy oficial] No se ha podido cargar el libro. Vuelve a
  intentarlo.» y debajo «respuesta_incompleta».
- **después:** sólo «No hemos podido cargar tus facturas recibidas. Vuelve a intentarlo.»

No hay texto nuevo para ese caso: sale el `error` firmado, que ya salía encima. Consecuencia que
se sube al fundador y que aquí no se decide: **el rechazo del servidor, la red caída y la respuesta
que no se entiende dicen ahora exactamente la misma frase.**

Los tres estados que no se pueden confundir, a 390 px:

| estado | qué se lee |
|---|---|
| vacío de verdad (`miradas` 0) | «0 facturas recibidas» · el aviso de formato provisional · «Todavía no tienes facturas recibidas en este periodo.» |
| descuadre (`miradas` 3, 0 filas) | «0 facturas recibidas» · el aviso de formato provisional · «3 gastos sin datos de IVA no figuran en este libro. Importe total: 363.» · «Hemos revisado 3 gastos y no ha salido ninguna factura. No lo tomes como que no compraste: puede que no hayamos sabido leer alguno.» |
| error de carga | sólo el cartel rojo |

Con `miradas` 1 sale «Hemos revisado 1 gasto y…»: el singular se conserva.

## ④ Los trinquetes que bajan — y `PENDIENTE_MAX` no es uno de ellos

El ticket pedía bajar `PENDIENTE_MAX`. Esa constante es el tope de rutas `/admin` sin clasificar
(`adminRouteDeclarations`, vale 0, la vigilan `scrum55` y `scrum1341`) y no tiene que ver con las
marcas. **No se toca.** Lo que baja son cuatro censos distintos, todos a entrada BORRADA y no a 0:

| trinquete | antes | ahora |
|---|---|---|
| `scripts/_marcadores-pendientes-declarados.json`, sección `panel` (lo vigila `scrum402`) | `facturasRecibidasView.js: 1` | sin entrada; quedan 9 ficheros |
| `tests/scrum755…` `CENSO_DE_SITIOS` y `PINTAN_Y_NO_CUENTAN` | 1 sitio, y en la lista | fuera de las dos |
| `scripts/guard-marcadores-en-pantalla.mjs` `CENSO` (DOM renderizado) | `facturas-recibidas: 6` | sin entrada: el censo queda vacío |
| `tests/scrum1233…` `TECHO` (el `.message` crudo) | `facturasRecibidasView.js: 1`, total 15 | sin entrada, total 14, y en la lista de «lo arreglado se queda en cero» |

Ninguno sube. Cada uno lo comprueba su propio test contra el árbol, no una resta a mano.
`tests/scrum1040…` gana las cuatro ranuras en su lista de firmadas, con el texto; `descuadre` es una
función y se firma lo que pinta con 40 y con 1.

## ⑤ El test y su banco de mutaciones

`tests/scrum1388-facturas-recibidas-literales-firmados.test.mjs`, 11 casos. Monta la pantalla con el
`apiRequest` real. La visibilidad del cartel la decide leyendo de `styles.css` las dos reglas que
ocultan un `.alert` (vacío, o sin tono): el matcher del banco no resuelve `:not()` y contesta
«ciego», medido.

Banco `banco-rojos.mjs.txt`, salida en `banco-rojos.salida-82255e6c.txt`: base sin mutar verde, y
11 mutaciones, 11 cazadas, 0 mudas, 0 ciegas. La primera es la vista entera de `d2ed6c8a`: caen 8
de los 11 casos. Las otras: el cartel que no se añade, el cartel sin tono, el descuadre fundido con
el vacío, el párrafo que vuelve, una palabra cambiada, el singular perdido, el descuadre acortado,
la marca que vuelve, la ficha sin la firma del fundador y una ranura prohibida tocada.

## ⑥ Aceptación → dónde se ve

| aceptación (control del ticket) | dónde se ve |
|---|---|
| ① el rojo primero: con el 403 provocado sale el detalle crudo | `docs/evidencias/scrum1388/sonda-cartel.ANTES-d2ed6c8a.txt` y la fila M1 de `banco-rojos.salida-82255e6c.txt` |
| ② un fallo de verdad sigue siendo distinguible: el cartel aparece | `tests/scrum1388-facturas-recibidas-literales-firmados.test.mjs` (los cuatro casos «se VE el cartel») y `sonda-cartel.DESPUES-82255e6c.txt` |
| ③ vacío, descuadre y error salen distintos | el mismo test, caso «NO se confunden» |
| ④ el trinquete de marcas baja y no sube | la tabla de ④; `PENDIENTE_MAX` no era ese trinquete |
| ⑤ la línea que sale siempre, también con cero | el diagnóstico «marcas de pendiente en facturasRecibidasView.js: 0» del test, y la última línea del resumen de la sonda |
| los cuatro textos, carácter a carácter | el mismo test, caso «los CUATRO literales» |
| verlo en yaqu.app | NO HECHO → hace falta que el PR entre, y una sesión de admin: lo pide el orquestador |

## ⑦ Checklist AB6

- Contraste, foco, objetivos táctiles: no entra color ni control nuevo. Los 37 guards de
  navegador, corridos sobre este árbol con `censo:guards-navegador`: 37 verdes, 0 no verdes.
- Capturas antes y después: `docs/evidencias/scrum1388/capturas-antes/` y `capturas-despues/`
  (403, vacío y descuadre, a 390 px).
- Matriz de dispositivos: medido en Edge a 390 y 1280 px. Android, iPhone y tablet reales, NO.
- Estados: vacío, descuadre, error y con datos, medidos. «Cargando…» no cambia.
- Textos largos: el descuadre firmado ocupa 83 px de alto a 390 px, sin desbordar.
- Importes, logo, cliente sin WhatsApp, modo demo: no aplican a este cambio.

## Lo que NO se hizo, y lo que queda sin medir

- La tanda completa local: no es alcanzable en esta máquina (medido dos veces por el orquestador).
  Va la dirigida de `tests-que-cubren`; el obligatorio del CI es la tanda.
- Nada visto en yaqu.app.
- El 500 real del gestor de errores de `src/app.ts` no se provocó: el de la sonda es fabricado.
- Hallazgos de otro carril, sin tocar: la barra del periodo de esta pantalla lleva cuatro `style=`
  en línea que su cabecera dice no tener; el aviso del servidor dice «Importe total: 363.» sin
  moneda; y en el descuadre se leen dos avisos seguidos que cuentan lo mismo con palabras distintas.

## Mis errores

1. La primera versión de la sonda contaba los carteles buscando «alert» como subcadena de la
   clase, y `fr-alert-detail` casaba: dijo 2 carteles donde había 1. Corregido antes de guardar el
   ANTES (ahora mira la clase), y es la línea A9 de arriba.
2. Encadené una orden que falló con la lectura de un fichero de salida: lo que leí después era la
   salida de la pasada anterior. Lo vi porque el error estaba impreso encima; borré la salida y
   repetí la pasada en un comando solo.
3. Lancé `censo:guards-navegador` para saber cuántos guards de navegador había, sin leer que para
   medirlos los ejecuta: 513 s de máquina con el turno cogido. Sirvió como pasada de los guards,
   pero no lo decidí yo. Va a las cicatrices de J4.
