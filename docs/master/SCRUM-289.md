# SCRUM-289 · A0.3 — la factura suelta (incremento 2: el entrypoint)

**Fecha:** 5-ago-2026 · **Carril:** A (núcleo fiscal) · **Gate:** modo de emisión, no flag

**Medido contra:** `origin/main` = `64b42807353c8336107a245234cf77af2a0dc846` · 2026-08-05T04:48:02+01:00

**Suite en esa base:** 1362 tests · 1295 pass · **0 fail** · 67 skip
**Suite con este cambio:** 1383 tests · 1316 pass · **0 fail** · 67 skip · exit **0** (+21)

> Incremento 2 de A0.3. El 1 (censo AST de los sitios que asumen origen) ya está en `main`.
> `prisma/schema.prisma` intacto.

## El gate NO es el flag, y ese es el cambio de fondo

El botón se llama «Nueva factura», así que **solo debe existir cuando lo que se va a crear ES una
factura**. Gatear por `INVOICING_ES_ENABLED` y explicar luego en un aviso que a veces sale un
justificante es resolver con copy una contradicción que se puede quitar.

Y hay un segundo motivo, que es el que decide: **`INVOICING_ES_ENABLED` es ES-only**. Un merchant
no-ES emite factura fiscal SIEMPRE (`getEmissionMode` devuelve `'fiscal'` antes de mirar ningún
flag), así que `isFlagEnabled` le habría quitado el botón teniendo derecho a él — dos casos que el
código ya trata igual, separados por un gate escrito a mano.

El gate es **`getEmissionMode(m) !== 'receipt'`**, que cubre los tres modos sin excepciones:
`fiscal` sí · `demo` sí (también es factura, con marca de agua) · `receipt` no.

**Una sola función, dos consumidores:** `puedeCrearFacturaSuelta` gatea `POST /admin/invoices` y su
veredicto viaja al front en `GET /admin/me`. El navegador no reimplementa la regla, la recibe — que
es lo que evita que el back acepte lo que el front esconde.

**Consecuencia asumida:** hoy ningún merchant ES real lo ve (regla 24). Es lo esperado, no un fallo
de alcance, y no se compensa enseñándolo. El justificante suelto es **SCRUM-346**, que reutilizará
ESTA ruta: el tipo y el rótulo salen del MODO, no del camino.

## Qué entra

- `src/modules/invoicing/domain/facturaSuelta.ts` — gate + validación, **puros** (sin BD ni red).
- `POST /admin/invoices` — 409 nombrado si el modo no emite factura · tenencia contra
  `req.merchantId` · `exigirLineasFacturables` ANTES de pedir número (SCRUM-246) · `emitInvoice`
  con `quoteId: null` · sellado por el punto único tras el commit (SCRUM-205). **Solo alta.**
- `GET /admin/me` — expone el veredicto.
- `public/dashboard/js/nuevaFacturaModal.js` — **fichero nuevo** (regla 4): de `invoicesView.js`
  solo entran las 15 líneas del botón.
- `tests/scrum289b-factura-suelta.test.mjs` — 12 guards.

## Verificación

| qué | cómo |
|---|---|
| Gate cerrado → **4xx nombrado** | AST: el handler gatea con `puedeCrearFacturaSuelta`, responde **409** y con el error nombrado. Un 500 no distingue «aquí no toca» de «se ha roto algo» |
| **Las dos caras** | los dos emisores del ciclo (albarán parcial y recapitulativa) siguen emitiendo **con SU propio gate**, y el emisor compartido no ha cambiado de firma |
| **Regla 29** | AST: el entrypoint no llama a `invoice.update/delete/upsert`, y no existe `patch`/`put`/`delete` sobre `/` |
| **Tenencia** (regla 2) | AST: toda lectura de `customer` en el handler lleva `merchantId: req.merchantId`. **Probado en rojo**: quitando el filtro, cae |
| **Microcopy** (regla 30) | AST: todo literal visible es exactamente `[PENDIENTE microcopy oficial]`. **Probado en rojo** con un rótulo que «suena bien» |
| **Controles negativos** | el guard de microcopy no salta con clases, estilos, endpoints ni con el NOMBRE del cliente (dato del merchant); la validación acepta un cuerpo correcto |
| Auditoría | el entrypoint **no** escribe `recordAudit`: `factura_emitida` ya se escribe en `allocateInvoiceNumber`, dentro de la tx y como acción BLOQUEANTE |

Y dos **suelos**: si el extractor no encuentra el handler, falla; si el guard de microcopy ve menos
de 8 literales, falla (un cero de «no hay» y uno de «no supe mirar» son el mismo número).

## Dos defectos reales que cazó la casa, no una revisión

1. **Iba a duplicar un hecho fiscal y a degradarlo.** Inventé la acción `factura_suelta_emitida`;
   `tsc` la rechazó por no estar en la unión. Al mirar por qué: la correcta ya existe
   (`factura_emitida`), **es BLOQUEANTE**, y la escribe `allocateInvoiceNumber` DENTRO de la
   transacción (SCRUM-207). Mi `recordAudit` habría escrito el hecho dos veces y la segunda en
   variante **fire-safe**: un registro fiscal que se puede perder sin que nadie se entere.
2. **El guard de SCRUM-274** cazó que el script nuevo faltaba en el shell del service worker.

Y un tercero, del propio guard de microcopy: su **suelo** cazó que, al subir el marcador a un
`const`, el analizador veía 2 literales de 20 —casi todas las asignaciones son un identificador, no
un literal— y habría dado verde sobre una pantalla entera. Se resuelven identificadores, igual que
los spread en el censo del incremento 1.

## 🔴 Hallazgo: SCRUM-348 — el límite nº 2 de SCRUM-243 se está volviendo caro

SCRUM-243 afirma cero lecturas sin comprobación de merchant. **No cubre esta ruta**, y está medido:

| `where` de `customer.findFirst` | `cubo` | `sinRed` |
|---|---|---|
| con `merchantId: req.merchantId` | `filtra` | `false` |
| **sin** `merchantId` | **`sin-filtro`** | **`false`** |

Su analizador **sí ve** que el filtro desaparece, pero el test asierta sobre `sinRed`, y ese se
queda en `false` porque el handler menciona `req.merchantId` en OTRO sitio: la carga del merchant
para resolver el modo. Quitar la tenencia de esta ruta deja la suite entera en verde.

Es el límite nº 2 que 243 **declara honestamente en su cabecera**. Lo que lo vuelve caro es que el
patrón «cargar el merchant al principio del handler para decidir un gate» es justo lo que hace
`getEmissionMode`, y va a estar en toda ruta que dependa de si el merchant emite factura o
justificante: **cada handler que lo adopte le regala la red a sus lecturas posteriores**. El guard
no se rompe — se vuelve más permisivo *a medida que el código mejora en otra dimensión*.

No se arregla aquí (otro carril, regla 9). Por eso este incremento lleva guard de tenencia propio
con el motivo medido dentro.

## Deuda y huecos declarados

- **DEUDA · dos selectores de cliente.** A partir de aquí el dashboard tiene dos: el de
  presupuestos (`quotesView.js:338`, `createFieldSelect` **dentro del cierre de la vista**, no
  exportado, sin consumidores fuera de su fichero) y el de este modal. **No se unifica aquí**:
  extraer el primero obligaría a tocar carril A y otra pantalla, que es exactamente lo que este
  incremento no hace (regla 4). **Se resuelve en SCRUM-286 (B3)**, el ticket de formularios. Queda
  escrito para que quien arregle uno sepa que existe el otro — es la clase de segunda población que
  más ha mordido esta semana (el mapa 11↔10 de Configuración, las dos cabeceras de `gastos.csv`).
- **HALLAZGO con ticket · SCRUM-347.** El camino se audita como **C7**, igual que la recapitulativa
  y el albarán parcial, porque `emitInvoice` lo fija. Distinguir la suelta exige cambiar la firma
  del emisor compartido = tocar el camino de emisión (**STOP**, regla 38). Dicho, no hecho.
- **HUECO · test real de BD con cliente de OTRO merchant.** Pendiente en `test:staging`. El guard
  AST está en la tanda **rápida** a propósito: una prueba de tenencia que solo corre cuando alguien
  toma el turno de staging es «verde porque nadie lo ejecuta».
- **HUECO · AB6.** Las capturas antes/después en harness aislado con el modo forzado **no están
  hechas todavía**. La **matriz de dispositivos es humana, del fundador y por bloque**: se declara
  como hueco, no se finge ni se da por hecha.

## Avisos de dominio

**Carril A firmado por carril B** (ASESOR.md §6: fiscal/invoicing es de Luis). La regla §4.2 pide
**avisar**, no abstenerse — queda avisado aquí y en el PR. `/tests/` es **zona roja** y
`invoicesAdmin.routes.ts` es **zona fiscal**.
