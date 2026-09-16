# SCRUM-867 · El modal muerto que el panel seguía sirviendo en cada visita

**Medido contra:** `origin/main` = `77ce9d1e86d6ffa921b1c92561ec2d7994f8e5eb` · 2026-09-16T09:26:04+02:00
**Rama:** `scrum-867-el-modal-muerto`, partida de ese `main`.
**Encargo:** demostrar por mecanismo que `public/dashboard/js/nuevaFacturaModal.js` está muerto,
retirarlo sólo entonces, y dejar un guard que lo fije, probado en rojo con una referencia fabricada.

---

## 1 · PASO 0 · ¿está muerto? **Por uso sí; por carga no**

Instrumento: `docs/master/evidencias/SCRUM-867/censo-modal-muerto.mjs`. Tres vías, porque un fichero
del panel puede seguir vivo por cualquiera de ellas, y tapar una sola dejaría las otras dos abiertas.

| vía | medido sobre `77ce9d1e` |
| --- | --- |
| ① el índice | **lo carga**: `<script src="./js/nuevaFacturaModal.js">` en `index.html:301` |
| ② el service worker | **lo precachea**: `/dashboard/js/nuevaFacturaModal.js` en el `SHELL` de `sw.js:85` |
| ③ el código del panel | **CERO** referencias ejecutables (AST sobre todos los `.js` del panel) |
| ④ la pantalla montada | «Nueva factura» → `renderAppView(["invoices-new"])`; el modal se abrió **0 veces**, con el espía probado por llamada directa |

**Verdicto:** 266 líneas que el navegador descargaba y ejecutaba en cada visita —y precacheaba para
la siguiente— para una pantalla a la que nadie llegaba desde SCRUM-600b.

### 🔴 El suelo me cazó a mí, y por eso vale

La primera versión del censo exigía «veo **exactamente una** referencia fabricada». Con el árbol de
entonces —que todavía cargaba el fichero— el censo veía **dos**: la de verdad y la fabricada. Se
declaró **CIEGO estando sano**. El suelo correcto es **diferencial**: fabricar una referencia tiene
que **subir el recuento en uno**, y así vale igual antes de retirar el fichero que después.

---

## 2 · La retirada

| fichero | cambio |
| --- | --- |
| `public/dashboard/js/nuevaFacturaModal.js` | **borrado** (266 líneas) |
| `public/dashboard/index.html` | fuera su `<script>`; y los dos comentarios que lo nombraban como consumidor, corregidos |
| `public/sw.js` | fuera su entrada del `SHELL`. **A la vez que el fichero, no después:** `cache.addAll` es ATÓMICO y una ruta que ya no resuelve tumba el precache entero, dejando sin cobertura la primera visita (SCRUM-274) |
| `public/dashboard/index.html` | **`rotulosDelDocumento.js` SUBE** por delante de `quotesView.js` |
| `tests/_banco-vistas.mjs` | fuera de `SCRIPTS_DEL_DASHBOARD`: el panel ya no lo carga, el banco tampoco puede esperarlo |

**Por qué sube la fuente de rótulos, y no es de paso:** `scrum776` exige que se cargue ANTES que
quien la consume. Su segundo consumidor pasa a ser la página, que hasta ahora se cargaba **antes**
que ella —funcionaba porque lee al pintar, pero el invariante sólo se cumplía para uno de los dos—.
Subirla lo cumple para los dos.

---

## 3 · El guard que lo fija · `tests/scrum867-el-modal-muerto.test.mjs`

Ocho tests: las tres vías (①②③), que **ningún instrumento lo monte** (④⑤) y que **la pantalla
montada no lo abra** (⑥), más dos suelos.

* **Por AST, no por texto.** Un guard que busca el nombre en el fuente crudo se caza a sí mismo en el
  comentario que lo explica —ha mordido cuatro veces en esta casa— y contaría como «vivo» un fichero
  al que sólo nombra la prosa. Este fichero lo nombra en cada párrafo, y su propio suelo comprueba
  que **un comentario NO cuenta**, con control positivo al lado.
* **Nombrarlo sigue permitido; ejecutarlo no.** Lo nombran 600, 600b, 601, 713 y 776, que guardan su
  historia. Un guard que prohíbe hablar de lo que vigila se borra a sí mismo de la memoria del equipo.
* **Los suelos van en memoria:** las referencias fabricadas se le pasan al censo como fuentes, sin
  escribir un byte en disco. No hay nada que restaurar ni nada que se pueda quedar puesto.

---

## 4 · Los seis rojos, vistos caer

Instrumento: `docs/master/evidencias/SCRUM-867/rojos-867.mjs`, sobre la feature ya comiteada
(`8933c31d`). Cada ancla se comprueba **única** antes de mutar y el árbol se restaura **byte a byte**
después de cada una.

| rojo | se devuelve la vida por… | qué cayó |
| --- | --- | --- |
| a | el fichero vuelve al árbol | **①** · ④ *(correcto: el fichero se nombra a sí mismo en código)* |
| b | el índice vuelve a cargarlo con un `<script>` | **②** |
| c | el `SHELL` vuelve a precachearlo | **③** |
| d | un script del panel vuelve a llamarlo | **④** |
| e | un instrumento vuelve a **montarlo** | **⑤** |
| f | el botón de la lista vuelve a abrirlo en vez de navegar | **⑥** · ④ |

Tras los seis: árbol restaurado byte a byte y `scrum867` en verde.

---

## 5 · Los dependientes, uno a uno y con su motivo

Retirar el fichero tocó **nueve instrumentos**. Ninguno se ha aflojado «para que pase»: cada uno
vigila lo mismo, o dice por qué ya no puede.

| instrumento | qué le pasaba | cómo queda |
| --- | --- | --- |
| **`scrum600b`** · el control que decide el ticket | comparaba byte a byte la página contra el MODAL | compara contra **`CUERPO_DEL_MODAL`**, congelado y **MEDIDO**: `evidencias/SCRUM-867/cuerpo-congelado.mjs` restaura el modal desde `77ce9d1e`, emite con las dos pantallas y compara. Las tres medidas dieron `{"customerId":7,"lines":[{"concept":"Mano de obra","qty":2,"price":50,"tax":0.21}]}`. El control negativo sigue: con otro precio, deja de cuadrar |
| **`scrum776`** · una sola voz | el modal era el otro consumidor de los siete rótulos | hereda **`quotesView.js`**, que no mira `appDocumentoSuelto` por su cuenta (medido). El orden de carga ahora vale para los dos |
| **`scrum776`** · el `aria-label` sin firmar | exigía que «Cliente al que facturas» siguiera con su marcador | **la deuda se cierra por desaparición de la pantalla**, no por firma. Ahora se vigila que **no vuelva** al panel sin firmarse |
| **`scrum601`** · el veredicto anclado | el fichero se llevó cinco literales del censo | regenerado: **flag 16 → 12** (los cuatro rótulos que leía del flag) y **a pelo 152 → 151** (su `aria-label`). Regenerado con el censo, no deducido |
| **`scrum601`** · el flujo atado | el flujo vigilado era el modal | pasa a ser **la página**: es donde hoy un rótulo nuevo a pelo diría «factura» a quien emite justificantes. Se declara el único literal con diana que hay allí, con su motivo (no nombra el documento) |
| **`scrum600`** · censo de los dos fronts | el front B ya no existe | su medición —**CERO** de las catorce capacidades— vive en este máster; el test sigue exigiendo que el front que queda no pierda ninguna, y que el retirado **no vuelva** |
| **`scrum289b`** | leía el modal para su suelo y su censo de microcopy | los dos pasan a la vista, que es lo que el guard mira |
| **`scrum350`** | el pie del modal era su víctima, y contaba en el suelo | víctima reanclada a otro pie construido igual; **`SUELO_CREATE` 4 → 3**, regenerado |
| **`scrum713`** | leía el ORIGEN del patrón del buscador | el origen se retiró: ahora exige que el patrón viva en **un solo sitio** (`buscadorDeClientes.js`) y que la pantalla lo **consuma** sin copiar el literal |

---

## 6 · 🔴 Lo que este ticket NO resuelve, dicho y no tapado

* **`guard:caja-documento-suelto` mide ahora DOS cajas, no cinco.** Las otras tres —título, acción
  primaria y error al emitir— las pinta hoy la página del documento suelto, y medirlas en navegador
  exige **montarla de verdad**: reproducirla sería medir mi reproducción, que es lo que ese guard
  lleva prohibiendo desde su primera línea. **Candidato a ticket propio.** Mientras tanto, el
  MECANISMO de los siete rótulos lo sigue vigilando `scrum776` en cada tanda; lo que no se mide es
  su caja.
* **`ariaDialogo()` se quedó sin consumidor**, y su único consumidor era el modal. Una PÁGINA no es
  un diálogo: cablearlo ahí sería inventarle un uso para que un test pase. El texto **sigue firmado
  y sigue en la fuente**, declarado en `SIN_CONSUMIDOR_DESDE_867` con trinquete —si alguien lo
  cablea, el test pide que se borre de la lista—. **Decisión del fundador** (regla 30): retirar el
  texto, o darle sitio.
* **Microcopy que sale del árbol con la pantalla**, para que conste: el `aria-label` **sin firmar**
  «Cliente al que facturas», el placeholder del buscador del modal «Busca por nombre…» y las 22
  ranuras aprobadas que `scrum289b` censaba allí. Ninguna se pierde: están en git y en los registros.

---

## 7 · Lo que NO se ha tocado

* **Ni una ruta ni un servicio de emisión.** `POST /admin/invoices` sigue igual, y el cuerpo que la
  página manda se comprueba **idéntico** al que mandaba el modal (regla 38).
* **`prisma/schema.prisma`**, `src/`, y el resto de `public/` fuera de lo listado.
* **Cero producción y cero staging.**

## Tests que introduce esta entrada

* `tests/scrum867-el-modal-muerto.test.mjs` — las tres vías, los instrumentos, la pantalla y sus dos suelos.
* `tests/_censo-modal-muerto.mjs` — los censores puros (no es un test: lo usan el guard y el instrumento).
* `tests/scrum600b-la-factura-usa-el-front.test.mjs` — **modificado**: el control decide contra el cuerpo congelado.
* `tests/scrum776-una-sola-voz.test.mjs` — **modificado**: consumidor heredero, `SIN_CONSUMIDOR_DESDE_867` y el `aria-label` que no vuelve.
* `tests/scrum601-copy-del-documento-vs-flag.test.mjs` — **modificado**: veredicto regenerado y flujo reapuntado.
* `tests/scrum600-un-solo-front-documento.test.mjs`, `tests/scrum289b-factura-suelta.test.mjs`,
  `tests/scrum350-modal-footer-envuelve.test.mjs`, `tests/scrum713-buscar-al-cliente-donde-ya-se-busca.test.mjs` — **modificados**, cada uno con su motivo en la tabla de arriba.
