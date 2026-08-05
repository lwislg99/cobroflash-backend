# SCRUM-301 · C1 — Albaranes como sección propia: tres estados del enum y un eje derivado, no cinco casillas

**Fecha:** 5-ago-2026 · **Carril:** A (producto — la pregunta del lunes) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `d5ac9761da139bf9b6de3c808d7c990aa6b82157` · 2026-08-05T17:06:21+01:00

> **Dos vueltas, dos anclas.** El listado se midió y se construyó contra `56874623` (16:38) y entró
> en `main` por el PR #469. Las **cinco ranuras de microcopy firmadas después** se midieron contra
> el `main` RESULTANTE, `d5ac9761`, que ya lleva ese listado dentro. El ancla de arriba es la
> segunda, que es la que sigue viva.

**Tanda:** 1762 tests, 1695 pass, 0 fail, 67 skipped (los 67 son los gateados de staging)

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

Veintitrés sabotajes, cada uno aplicado, compilado, corrido y revertido con verificación byte a byte:

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
| **La vista deja de cargarse en `index.html`** | **nada — y ése fue el hallazgo** |
| La ruta pierde su `requireRole` | SCRUM-55 (fail-closed de roles) |
| El filtro vuelve a decir «todas» | la copy aprobada, ranura a ranura |
| La regla de plural deja de dar «Borradores» | la copy aprobada |
| Se reescribe una columna aprobada | la copy aprobada |
| El menú vuelve a llevar marcador sobre texto aprobado | la copy aprobada |
| **Una letra en CADA una de las cinco ranuras firmadas** (seis cadenas) | la ranura tocada, **nombrándola** |
| El texto DESCARTADO de ⑤ en su ranura | ⑤ `vacioConFiltros` |
| **Los dos vacíos INTERCAMBIADOS** (las dos frases siguen en el fichero) | ④ `vacioSinAlbaranes` |

🔴 **El de «la vista deja de cargarse» encontró un guard incapaz de fallar.** Comprobaba `assert.match(index,
/albaranesView\.js/)`, así que **comentar la etiqueta `<script>` lo dejaba en verde**: el texto
seguía en el fichero. Un guard que no distingue una etiqueta viva de una comentada no vigila el
cableado, vigila la ortografía. Ahora lee los `src` de verdad, con los comentarios HTML fuera, y el
mismo sabotaje sale rojo.

## Tres guards de la casa cazaron el cambio, y los tres tenían razón

La tanda completa —no la del ticket— salió roja tres veces. Ninguna era ruido:

1. **SCRUM-55 (fail-closed de roles).** `GET /admin/albaranes` nació sin declarar rol, que es
   exactamente lo que ese guard existe para impedir. Declarada en `TECNICO_ALLOWED` con el mismo
   criterio que `consolidables` —«es la misma información, agrupada»— y con el motivo escrito para
   que un humano lo revise: **es una decisión de permisos, no un trámite**. Si el criterio fuese que
   el operario solo vea los partes de SUS obras, eso no se arregla en esa lista sino con un filtro
   por operario en la consulta, y es otro ticket.
2. **SCRUM-274 (shell del service worker).** El script nuevo no estaba en la lista del SW: sin eso,
   la sección existiría en el navegador con red y no sin ella. Añadido.
3. **SCRUM-302 (el derivado de tres valores).** Su guard leía el TEXTO de la unión
   (`EstadoCobro = 'sin_facturar' | …`), y al pasar el eje a una constante en runtime dejó de
   coincidir. **La premisa que protege no cambió**: se reescribió para leer el valor COMPILADO.

   Y el guard salió reforzado, medido en rojo por los dos lados: **quitar un valor ya no llega ni al
   test —`tsc` lo caza antes**, porque `estadoCobroAlbaran` devuelve `'parcial'` y el tipo dejaría de
   admitirlo—; y **reordenarlos, que sí compila, pone rojo el assert**. Antes, un comentario movido
   podía tumbarlo y un cambio real de tipo no lo tocaba.

## 🔴 Permisos: admin-only, y el motivo es una fuga

La primera versión declaró la ruta en `TECNICO_ALLOWED` con el criterio de `consolidables` —«es la
misma información, agrupada»—. **El asesor lo rechazó y tenía razón:** ese criterio vale cuando la
información YA era visible, y aquí no lo era.

**SCRUM-147 midió y cerró que un técnico solo ve SUS Trabajos** (`seesOnlyOwnJobs`: allowlist de
`admin`, rol desconocido restringido). Los albaranes cuelgan de Trabajos, así que un listado global
le enseñaría **de qué obras ajenas hay partes, de qué clientes y con qué fechas**: justo lo que la
puerta principal le niega, servido por la puerta de atrás. Y no es aplazable — **cerrar de más es un
incordio; abrir de más no se deshace**, porque arreglarlo después obliga a saber quién lo usó
mientras tanto.

Así que `requireRole('admin')`, fuera de `TECNICO_ALLOWED`, y **dentro de `ADMIN_ONLY_ROUTES`**: ahí
su 403 con sesión de técnico queda **exigido por la tanda gateada**, no solo declarado en un
comentario. Es la diferencia entre una decisión de permisos y una intención.

**Medido, por si se decide abrirlo con criterio:** aplicar el filtro de Trabajos sería barato —
`seesOnlyOwnJobs(req.userRole)` + prefiltrar los `jobId` con `operarioId = req.teamMemberId`, como
hace `GET /admin/jobs` — pero **qué debe ver exactamente el técnico es una decisión de producto**
(¿los partes de sus obras? ¿solo los que él firmó?), y esa se toma en su ticket, no aquí.

## Microcopy (regla 30): aprobada, y el guard cambia de trabajo

Se entregó con `[PENDIENTE microcopy oficial]` en cada rótulo (patrón SCRUM-286) y el asesor aprobó
las cuatro ranuras el 5-ago-2026: **tres tal cual y el filtro con retoque** — `Facturación: todos`,
no «todas», porque concuerda con «albaranes», que es lo que se cuenta; «todas» arrastra a pensar en
facturas, el objeto que este filtro NO cuenta.

El rótulo `Albaranes` se aprobó **reutilizando un precedente escrito** en vez de pedir criterio
nuevo: C2 ya fijó en `main` que «el rótulo del título es el nombre del documento, no microcopy de
acción».

Y el guard **cambia de trabajo**: dejó de exigir el marcador y ahora compara **ranura a ranura**
contra el texto aprobado, porque retocar copy aprobada es decisión del asesor. Con un detalle que
importa: los rótulos de las pestañas **no se escriben, se derivan** del valor con la regla de plural
del español (vocal → +s, consonante → +es), que produce exactamente `Borradores · Emitidos ·
Firmados`. Un mapa `{ borrador: 'Borradores', … }` habría reintroducido la lista a mano que el resto
del fichero evita.

**Las cinco ranuras restantes se firmaron justo después** (aviso de error, recuento del subtítulo,
buscador —sus DOS cadenas— y los dos estados vacíos), así que en esta pantalla **ya no queda ni un
marcador**. Dos decisiones del asesor sobre esas cinco merecen quedar escritas:

* **El aviso de error se acortó.** Yo propuse «No se han podido cargar los albaranes. No hay ningún
  número que enseñar: vuelve a intentarlo.» y quedó en **«No se han podido cargar los albaranes.
  Vuelve a intentarlo.»** Mi preocupación era buena —que el error no se lea como «no tienes
  albaranes»— pero **«no se han podido cargar» ya nombra la carga, no el inventario**: la coletilla
  añadía una explicación que un fontanero con el móvil en la mano no necesita leer.
* **El vacío-con-filtros se eligió LEYENDO LA RAMA**, no por gusto. La condición es
  `filas.length === 0 ? ④ : ⑤` y ⑤ se alcanza cuando `visibles()` no devuelve nada, que descarta por
  **tres vías independientes**: la pestaña de estado, el filtro de facturación y el buscador
  ([albaranesView.js:245-253](../../public/dashboard/js/albaranesView.js#L245-L253)). Por eso el
  texto firmado es **«Ningún albarán coincide con los filtros»** y no «…con esa búsqueda»: quien
  llega ahí desde un desplegable, sin haber escrito nada, leería una frase que le miente.

### El guard de las cinco está atado a la RANURA, no al fichero

Lee el texto **del AST, en el sitio exacto donde se usa** (`aviso.textContent`, el sufijo del
`subtitle`, `buscador.placeholder`, el `setAttribute('aria-label', …)` y cada rama del ternario de
los vacíos). Buscar la cadena por el fuente habría dado verde con **los dos vacíos intercambiados**
—las dos frases siguen escritas, palabra por palabra—, y eso no es una errata: le diría «todavía no
hay albaranes» a quien tiene doce y filtró mal.

Y el propio guard se cazó a sí mismo al escribirlo: la primera versión del assert «ya no queda
marcador» miró el fichero entero y salió roja sola, porque **la cabecera de la vista cuenta que se
entregó con el marcador**. Es el clásico de la casa (SCRUM-176/168/3/193); ahora mira solo los
literales, que son los que llegan a una pantalla.

Efecto medido de la aprobación, visible en las capturas: con el marcador, el prefijo empujaba
`Cliente`, `Trabajo` y `Estado` fuera del ancho visible — incluida la columna que es la ventaja del
ticket. Con el texto aprobado, **las seis caben**.

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
* `src/core/http/adminRouteDeclarations.ts` — por qué esta ruta NO está en TECNICO_ALLOWED.
* `src/core/http/adminOnlyRoutes.ts` — su 403 con sesión de técnico, exigido en la tanda gateada.
* `public/sw.js` — el script nuevo en el shell del service worker.
* `tests/scrum301-albaranes-seccion.test.mjs` — **nuevo**, 18 tests.
* `tests/scrum302-patron-albaran.test.mjs` — su guard del derivado, ahora contra el valor compilado.
* `docs/capturas/scrum-301/` — seis capturas AB6 (las de error y vacío también a 390 px) y su README.
