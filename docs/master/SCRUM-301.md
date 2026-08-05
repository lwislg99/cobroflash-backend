# SCRUM-301 · C1 — Albaranes como sección propia: tres estados del enum y un eje derivado, no cinco casillas

**Fecha:** 5-ago-2026 · **Carril:** A (producto — la pregunta del lunes) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `56874623baa406a0e8e38b93c236f7a4740b1e6a` · 2026-08-05T16:38:08+01:00

**Tanda:** 1745 tests, 1678 pass, 0 fail, 67 skipped (los 67 son los gateados de staging)

## El defecto

Los albaranes **no existían como sitio**: vivían dentro de cada Trabajo. Consecuencia práctica —
«¿qué albaranes tengo sin firmar?» solo se contestaba entrando obra por obra. Para un reformista con
seis obras abiertas ésa es *la pregunta del lunes*, y el producto no la podía responder.

## Las dos premisas del ticket que NO se sostienen, y una tercera

El ticket describía cinco pestañas planas (`Todos · Borrador · Entregado · Firmado · Facturado`).
El asesor corrigió dos cosas en su comentario y **medirlas confirma las dos**:

1. **No existe «Enviado»/«Entregado».** El estado del modelo se llama `emitido`:
   `canTransitionAlbaran` va `borrador → emitido → firmado` y nada más. «Enviado» es un nombre de
   pantalla; confundirlo con el del modelo es el error que tuvo B2 con «Borrador».
2. **«Facturado» no es un estado ni un marcador: es un DERIVADO con tres valores.** Se calcula
   contra el libro `AlbaranLineaFacturada` (SCRUM-170) y da `sin_facturar · parcial · facturado`.
   Medido además: **anular una factura devuelve la cantidad a pendiente** porque la anulación
   **borra las filas del libro** (`invoicesAdmin.routes.ts:767`, dentro de la misma transacción que
   pone `Albaran.invoiceId = null`). Por eso el listado lee el libro sin exclusiones, igual que el
   detalle C2.

   **Consecuencia:** son **tres estados del enum MÁS un eje derivado**, no cinco casillas.
   Aplanarlos obligaría a inventar un estado que no existe y **perdería el `parcial`** — que en una
   obra por fases no es el caso raro, es el normal.

Y una tercera, medida aquí:

3. 🔴 **B1 no había creado la entrada de menú.** SCRUM-284 es *«censo derivado de los campos de
   Configuración»* y su propia entrada del registro dice **«ALCANCE: solo el censo. No toca la
   sidebar»**. En `main` no había ningún `data-view="albaranes"` ni el rótulo en ningún sitio de
   `public/`. Así que **esta tarea la crea y lo declara**, que es justo lo que el ticket previó
   («si B1 no ha entrado, esta tarea la crea provisionalmente y lo declara»).

   Lo que sí estaba en `main` era **C2** (`albaranDetailView.js`, `case 'albaran-detail'`), aunque
   su rama `scrum-302-detalle-albaran` no sea ancestro de `main`: entró por una `-rebasada`, con
   otro sha. Medir el **contenido** y no el puntero de la rama es lo que evitó darla por ausente.

## La decisión, y por qué

### ① Los ejes viajan derivados desde el servidor; el navegador no los sabe de memoria

`GET /admin/albaranes` devuelve `ejes: { estado, cobro }` derivados de `ALBARAN_ESTADOS` y de
`ESTADOS_COBRO`. En `albaranesView.js` **no hay ni un `'borrador'` ni un `'firmado'` escritos a
mano**, y un guard AST lo vigila: una lista escrita a mano no avisa de lo que le falta, y el día que
la Parte L gane un estado esta pantalla lo escondería en silencio.

Para que el eje de cobro se pudiera derivar hubo que **hacerlo existir en runtime**: `EstadoCobro`
era solo una unión de TypeScript, que desaparece al compilar. Ahora es
`export const ESTADOS_COBRO = [...] as const` y el tipo se deriva de la constante — dos líneas, cero
cambio de comportamiento, y `tsc` prueba que la unión es la misma.

### ② El estado se pinta con el VALOR del modelo, no con un rótulo inventado

La píldora de cada fila imprime `emitido` / `parcial` tal cual. Es dato, no copy — y es lo que
impide que alguien vuelva a escribir «Enviado» en una pantalla cuyo modelo dice `emitido`.

### ③ 🔴 Si la consulta falla, no hay ceros que enseñar

El riesgo del ticket es el que manda: *si el contador de «sin firmar» dice 0 porque la consulta
falló, el profesional se va a casa tranquilo con tres albaranes sin firmar*. Tres cierres, en tres
capas:

* `contarAlbaranes` **lanza** si no recibe una lista (no devuelve ceros por defecto);
* `listarAlbaranesDelMerchant` **no captura** los errores del lector, y la ruta responde 500;
* la vista pinta el error **sin dibujar pestañas ni contadores** — está capturado en
  `docs/capturas/scrum-301/scrum301-error-1280.png`, y hay un guard AST que impide que el camino de
  error vuelva a dibujarlas.

«Cero albaranes» sigue siendo una respuesta legítima y tiene su propio estado vacío: las dos
situaciones se distinguen **en pantalla**, que es donde importaba.

### ④ La tenencia se EJERCITA, no se deduce

El lector es inyectable y el test mete albaranes de **dos merchants** en una tienda falsa que aplica
el filtro tal y como se lo pasen —igual que Postgres— y pregunta como uno de ellos. Si el código
perdiera el `merchantId`, la tienda devolvería los del otro y el rojo sale solo.

No se confía en el analizador de SCRUM-243: da por cubierta cualquier lectura dentro de un handler
que mencione `merchantId` por el motivo que sea (medido en SCRUM-348). Aquí se prueba el camino.

## Lo que se midió

| Medición | Resultado |
| --- | --- |
| Entrada de menú `Albaranes` en `main` | **no existía** — 17 `nav-item`, ninguno de albaranes |
| C2 (detalle) en `main` | **sí**, por contenido (`albaranDetailView.js` + `case 'albaran-detail'`) |
| Estados del modelo | `borrador · emitido · firmado` — no hay «Enviado» |
| Eje de facturación | derivado del libro; `parcial` es un valor de pleno derecho |
| Componente de pestañas | ya existía (`data-card-tabs` / `data-card-tab`, `invoicesView.js`) → **sin CSS nuevo** |
| Tenencia de las lecturas nuevas | las 4 con `merchantId` en `where` literal |

## Verificado en rojo

Once sabotajes, cada uno aplicado, compilado, corrido y revertido con verificación byte a byte:

| Se quita la cosa vigilada | Sale rojo |
| --- | --- |
| Los contadores dejan de cuadrar con las filas | ① y 4 más |
| Un estado desconocido se descarta en silencio | ③ el estado nuevo |
| Sin población se devuelven ceros en vez de lanzar | ② el suelo |
| El listado se traga el fallo de lectura | ② el suelo de lectura |
| La consulta de albaranes pierde el `merchantId` | ④ tenencia, y 4 más |
| El eje de cobro se aplana a `sin_facturar` | ⑥ el parcial, y 2 más |
| La vista enumera un estado a mano | ③ la vista no enumera |
| El camino de error dibuja pestañas | el guard del error |
| El aviso de error pierde el tono (invisible por CSS) | el guard del error |
| El rótulo del menú pierde el marcador | microcopy |
| **La vista deja de cargarse en `index.html`** | **nada — y ése fue el hallazgo** |

🔴 **El último sabotaje encontró un guard incapaz de fallar.** Comprobaba `assert.match(index,
/albaranesView\.js/)`, así que **comentar la etiqueta `<script>` lo dejaba en verde**: el texto
seguía en el fichero. Un guard que no distingue una etiqueta viva de una comentada no vigila el
cableado, vigila la ortografía. Ahora lee los `src` de verdad, con los comentarios HTML fuera, y el
mismo sabotaje sale rojo.

## Microcopy (regla 30) — y una propuesta

Todo rótulo nuevo va con `[PENDIENTE microcopy oficial]` (patrón SCRUM-286) y su guard. **Se nota, y
está fotografiado**: el prefijo empuja `Cliente`, `Trabajo` y `Estado` fuera del ancho visible en
escritorio — incluida la columna que es la ventaja del ticket. No es un defecto de maquetación, es
el coste del marcador, y con los textos aprobados las seis columnas caben de sobra.

## Lo que NO cubre

* **La matriz AB6 de dispositivos es un hueco declarado**: solo 390 px en Edge de escritorio. Ni
  Android real, ni iPhone, ni tablet.
* **No hay «antes/después»**: la sección no existía.
* **No hay acciones por fila** (el ticket las citaba en «lo que tienen ellos»): el listado es de
  lectura y navegación. Las acciones viven en el detalle (C2).
* **Sin paginación ni orden configurable**: se traen todos los albaranes del merchant y se filtran
  en el navegador. A volumen actual sobra; con miles de filas habrá que paginar en el servidor —y
  entonces los contadores tendrán que venir de una consulta agregada, no de las filas traídas.
* **`Albaran.estado` no tiene índice**: la consulta filtra por `merchantId` (que sí lo tiene por
  `@@index([merchantId, jobId])`). Añadir uno es cambio de esquema, o sea turno del fundador.
* **No se ha probado contra Postgres**: la tenencia y los contadores se ejercitan con lector falso.
  Lo que falta demostrar es la consulta, no la lógica.

## Ficheros

* `src/modules/jobs/domain/albaranesListado.ts` — **nuevo**. Ejes derivados, contadores con suelo,
  buscador y el listado con lector inyectable.
* `src/modules/jobs/domain/albaranFacturacion.ts` — `ESTADOS_COBRO` en runtime; el tipo se deriva.
* `src/modules/jobs/app/routes/albaranes.routes.ts` — `GET /admin/albaranes` + su lector Prisma.
* `public/dashboard/js/albaranesView.js` — **nuevo**. La vista vanilla, sin CSS nuevo.
* `public/dashboard/index.html` · `public/dashboard/js/app.js` — entrada de menú, script y ruta.
* `tests/scrum301-albaranes-seccion.test.mjs` — **nuevo**, 15 tests.
* `docs/capturas/scrum-301/` — cuatro capturas AB6 y su README.
