# SCRUM-302 · C2: el patrón de detalle aplicado al albarán — la ley, la tabla y las tres premisas

**Fecha:** 5-ago-2026 · **Carril:** A (UI) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `fbe050592594569b967100114bf41724eede6ff0` · 2026-08-05T11:29:24+02:00
**Tanda:** 1571 tests, 1503 pass, 0 fail (el resto, gateados a staging)

> **Entregado en dos pasos:** primero la ley compartida, la tabla y sus guards —sin los cuales la
> página se habría escrito sobre tres premisas de las que **dos son falsas**—; después la página.

## Una sola ley, que era el riesgo que el encargo nombró

La maquinaria del patrón (destinos, reglas, resolutor, marcador de microcopy) vivía dentro de
`invoiceActionsRegistry.js`. Se ha extraído a **`patronDetalleAcciones.js`**, y ahora la usan
**los dos** documentos: la factura sigue con sus guards de B2 en verde (20/20 sin tocarlos) y el
albarán declara **solo su tabla**.

Si el albarán se hubiera llevado su copia, hoy habría dos registros del mismo hecho — el defecto de
las dos listas que esta casa lleva toda la semana pagando. Hay un **suelo** que lo vigila: si algún
registro vuelve a definir su propio `destinoEfectivo`, rojo.

*(El resolutor conserva la semántica de B2 —`con-chargeId`/`sin-chargeId`— **y** admite la forma
genérica `ctx[cuando]` que necesita el albarán. Y una condición que nadie sabe responder se
**oculta**: el patrón entero se apoya en que la primaria sea de fiar.)*

## Las tres premisas, medidas — y dos desmienten al enunciado

**1 · El estado NO se llama «Enviado».** Son `borrador | emitido | firmado`, derivado del schema
(`estado String @default("borrador")`) y de `ALBARAN_ESTADOS`. El test **deriva los estados del
modelo** y los compara con la tabla: una columna inventada haría que ninguna transición cuadre.
Y «enviado para firmar» **existe, pero es un derivado** (`enviadoParaFirmaAt != null && estado ===
'emitido'`), no un estado — lo dice el propio schema.

**2 · «Facturado» no es un estado.** Es un derivado de **tres** valores —`sin_facturar`,
`parcial`, `facturado`— calculado contra `AlbaranLineaFacturada`. **Aplanarlo pierde el
parcial, que en una obra por fases es el caso normal.** Por eso no es columna de la tabla sino
**contexto**: la acción de facturar solo ocupa la primaria si queda algo pendiente. Con el albarán
ya facturado del todo —o sin contexto— se oculta, en vez de ofrecer un botón que no hace nada.

**3 · Las líneas del albarán no se pueden casar con las del presupuesto.** `AlbaranLineaFacturada`
referencia `lineaIndex` (el índice dentro del Json del **albarán**) e `invoiceId`; del
presupuesto, **nada**. Así que **no se construye ninguna vista de «albarán vs presupuesto»**, y hay
un test que se pone rojo si mañana aparece esa referencia — no para prohibirla, sino para que la
decisión se rehaga en vez de seguir asumiéndose.

## Verificado en rojo

- **Segunda primaria** en `emitido` → caen 2 tests, nombrando el estado.
- **«Enviado» metido como estado** → caen 4, con «la tabla usa estados que el modelo no tiene».
- **El guard de SCRUM-237 me cazó a mí**: mi `doesNotMatch` sobre `function destinoEfectivo` no
  tenía hermano positivo, así que habría sido verde para siempre aunque la regex estuviera rota. Se
  añadió el respaldo —el patrón **sí** casa en la ley compartida— en vez de silenciarlo.

## La página

`albaranDetailView.js` + vista `albaran-detail`. Pinta **desde el registro**: crea los botones con
su handler y los coloca donde la tabla diga — una primaria, hasta dos secundarias, el resto al «⋮».
La vista no decide nada del patrón.

**Endpoint nuevo, porque no existía:** `GET /admin/albaranes/:id`. El albarán solo se leía dentro
del detalle del Trabajo, y una página propia tiene que poder cargarse sola (enlace directo,
recarga, «atrás»). Devuelve el albarán, lo que el rail enseña, y el estado de facturación
**derivado con sus tres valores**, calculado con las mismas piezas que `facturar-parcial`.

**Rol declarado (S1):** va a `TECNICO_ALLOWED` con su motivo. Negarle al operario **leer** el parte
mientras puede rellenarlo, emitirlo y firmarlo sería incoherente: es la misma pantalla de su
trabajo de campo, solo que ahora tiene página.

**El rail es de solo lectura** — Trabajo, cliente, dirección, facturación y cuántas líneas quedan
por facturar. Y lo que **no** enseña tampoco es olvido: ninguna comparación con las líneas del
presupuesto, porque no hay campo que las ate.

**El traslado, a medias y con dueño:** la fila del Trabajo gana el enlace a la ficha pero
**conserva sus acciones**. La página no se ha podido validar en un navegador, y quitarlas antes de
eso dejaría al pro sin forma de emitir ni firmar si algo no encaja. La duplicación es
**transitoria y está declarada en el código**: cuando la página se valide, la fila se queda solo
con el enlace.

## Cuatro guards ajenos me cazaron, y los cuatro tenían razón

Ninguno era ruido, y los cuatro apuntaban a defectos que se habrían visto en producción y no en la
suite:

1. **Nombres duplicados en scripts clásicos.** Puenteé la ley con un `const destinoEfectivo` en el
   registro de factura: dos `const` con el mismo nombre comparten ámbito léxico → **SyntaxError en
   parseo**, el segundo fichero no se ejecuta y su pantalla desaparece **sin 500 ni log**. Es el
   caso de `copyRojo` (SCRUM-210). Ahora no se re-declaran: en el navegador ya son globales.
2. **El service worker no precacheaba los tres ficheros nuevos.** La primera visita sin cobertura
   se habría quedado sin esas pantallas, y con red no se nota nada.
3. **SCRUM-55 · ruta sin rol.** El endpoint nuevo no declaraba ninguno; ahora está en
   `TECNICO_ALLOWED` con su motivo escrito, en vez de aparcado en la lista de pendientes.
4. **SCRUM-128 · envío sin comprobar el resultado, dos veces.** Un WhatsApp responde 200 aunque
   Meta lo rechace. Escondí la comprobación primero en un `post` genérico y luego en un `enviar()`,
   y el guard cazó las dos: mide la distancia entre la RUTA y la comprobación. Ahora va **en el
   sitio de la llamada** — y es mejor código, porque quien lee el handler la ve.

## RÓTULOS QUE HACEN FALTA (regla 30) — nueve, y no los escribe esta sesión

Todos se pintan hoy con `[PENDIENTE microcopy oficial]`. Con lo que hace cada uno y dónde sale:

| id | qué hace | dónde sale |
|---|---|---|
| `btnEmitir` | emite el albarán (borrador → emitido) | primaria en **borrador** |
| `btnEnviarFirmar` | manda al cliente el enlace de firma por WhatsApp | primaria en **emitido** |
| `btnFacturar` | factura lo servido (total o parcial) | primaria en **firmado**, solo si queda pendiente |
| `btnFirmarAqui` | firma del cliente en el móvil del operario | secundaria en **emitido** |
| `btnPdf` | abre el PDF | secundaria en los tres |
| `btnWhatsApp` | envía el parte firmado al cliente | secundaria en **firmado** |
| `btnEditarLineas` | edita las líneas | secundaria en **borrador** |
| `btnFoto` | añade una foto del trabajo | «⋮» en los tres |
| `btnVerTrabajo` | vuelve al Trabajo | «⋮» en los tres |

Y **uno más fuera de la tabla**: el enlace desde la fila del Trabajo a esta ficha.

## Lo que NO cubre

- **No se ha visto en un navegador.** Lo verificado es la lógica, el patrón y sus guards.
- **AB6 · matriz de dispositivos: hueco declarado.**
- **El «⋮» degrada**: si `overflowMenu` no estuviera cargado, los botones se pintan sueltos en vez
  de perderse.

## Ficheros

`public/dashboard/js/patronDetalleAcciones.js` (nuevo — la ley) ·
`public/dashboard/js/invoiceActionsRegistry.js` (deja de definirla y delega) ·
`public/dashboard/js/albaranActionsRegistry.js` (nuevo — la tabla) ·
`public/dashboard/js/albaranDetailView.js` (nuevo — la página) ·
`src/modules/jobs/app/routes/albaranes.routes.ts` (`GET /:id`) ·
`src/core/http/adminRouteDeclarations.ts` (el rol, con motivo) ·
`public/dashboard/js/app.js` · `public/dashboard/index.html` · `public/sw.js` ·
`public/dashboard/js/jobDetailView.js` (el enlace) ·
`tests/scrum302-patron-albaran.test.mjs` (8).
