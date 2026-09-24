# SCRUM-1002 · COMPETENCIA · capturas por dentro (recorrido del 21-sep, S0): un hallazgo, un ticket

**Medido contra:** `origin/main` = `320c7f2035067bf845e582373b63aba8c4fd6fa9` · 2026-09-21T14:45:00Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-1002-capturas-competencia-21sep` · **Carril:** consultoría (Sesión 0), **excepción de carril declarada** (A20): el fundador pidió en persona, el 21-sep, que S0 se dé de alta con navegador y abra un ticket por hallazgo. Abrir tickets y competencia no son carril S0 en §11bis.
**Estado:** EN CURSO. El PR de este ticket lleva solo CAPTURAS (PNG) y este registro; no toca `src/`, `public/` ni `prisma/`.

## Norma del fundador (21-sep)

Por cada diferencia concreta (ellos tienen X, nosotros no): (a) captura en `docs/competencia/capturas/<competidor>/`, (b) ticket de Jira AL MOMENTO con la captura referenciada y una propuesta breve. Sin esperar a un informe final. Recorrido mínimo por competidor: panel · crear presupuesto · pasar a factura o albarán · ficha del cliente · equipos del cliente · empleados/técnicos · móvil.

## Cuentas abiertas (apuntadas fuera de git, en `C:\Users\Admin\s0-906-traspaso\cuentas-21g\CUENTAS.md`)

| competidor | resultado | por dentro |
|---|---|---|
| Contasimple | alta hecha (30 días Ultimate, sin tarjeta; NIF y nombres inventados) | **SÍ** |
| FacturaDirecta | alta hecha; pidió código al correo del fundador y él lo pasó | **SÍ** |
| ServiceM8 | NO se creó: «We were unable to verify your signup request» ×2 (comprobación anti-bot) | no |
| Jobber | muro de Cloudflare («Verificación de seguridad en curso») | no |
| Quipu | el formulario pide teléfono; «Ha ocurrido un error desconocido» al enviar | no |
| Housecall Pro | 5 pasos hechos con teléfono ficticio; el último no avanza ni da error, y el login dice credenciales inválidas | no |
| Tradify | alta hecha con el código que pasó el fundador (país Reino Unido; teléfono de ficción 07700 900123; asistente hasta el panel) | **SÍ** |
| Fergus | solo se entra por enlace mágico; el enlace pedido a las 14:43Z NO llegó al correo del fundador | no |

No se rodeó ningún bloqueo. Sin tarjeta, sin SMS, sin enviar nada a terceros; NIF ficticio y teléfonos de ficción (Ofcom 07700 900xxx, US 555-01xx).

## Hallazgos y su ticket

| ticket | qué tienen ellos (por dentro) | nuestra columna, medida en `320c7f20` | captura |
|---|---|---|---|
| SCRUM-1003 | Contasimple: «Descargar vCard» en la ficha del cliente | `git grep -i vcard` sobre `src/` y `public/` = 0 (suelo: el enlace de Google Maps de `jobRailBlocks.js:94` SÍ sale) | `contasimple/contasimple-ficha-del-cliente-pestanas-mapa-vcard.png` |
| SCRUM-1004 | Contasimple: mapa y ubicación del cliente en su ficha | el enlace «abrir en mapa» solo vive en el carril del Trabajo; `Customer` no guarda lat/lng | idem + `contasimple-cliente-nuevo-secciones.png` |
| SCRUM-1005 | Contasimple: pestaña «Documentos adjuntos» del cliente | `Attachment` = `quote_request \| job`, `photo \| audio` (`schema.prisma:1301`) | idem |
| SCRUM-1008 | Contasimple: SKU, ref. proveedor, unidad y familia en el artículo | `Product` no tiene ninguno de los cuatro; la unidad SÍ está en `Albaran.lineas` | `contasimple/contasimple-producto-nuevo-sku-unidad-familia-stock.png` |
| SCRUM-1009 | Contasimple: control de stock (solo VALORACIÓN) | 0 coincidencias de `stock\|existencias` en el esquema; `matriz.md` §16.2 ya lo dejó «choca con el máster» | idem |
| SCRUM-1010 | FacturaDirecta: «Órdenes de compra» a proveedores (solo VALORACIÓN) | 0 coincidencias; no sale en `matriz.md` | `facturadirecta/facturadirecta-ordenes-de-compra.png` |
| SCRUM-1013 | Tradify: listas de precios de mayorista (Screwfix, CEF) precargadas con margen del 20 % en el propio alta (VALORAR; depende de acuerdos con proveedores) | tarifario PROPIO sí (`products.routes.ts`, `csvImport.js`, `margenCatalogo.js`); ninguna lista de mayorista | `tradify/tradify-listas-de-precios-de-proveedor-en-el-alta.png` |
| SCRUM-1014 | Tradify: pestaña «Sites» del cliente (nombre, dirección y contacto propio por sitio) y «Site» en el presupuesto; **reabre** la propuesta retirada en `matriz.md` (~1520) | `Customer` con una dirección; `Quote.shippingAddress` tecleada; 0 coincidencias de `siteId\|CustomerSite\|otras direcciones` | `tradify/tradify-cliente-pestana-sites-con-contacto-por-sitio.png` |
| SCRUM-1010 (comentario) | Tradify: «Purchase Orders» atadas a un Trabajo, con «Linked Bill» y «SmartRead» | idem 1010 | `tradify/tradify-ordenes-de-compra-atadas-al-trabajo.png` |
| SCRUM-913 (comentario) | Contasimple: registro de jornada con «Mi equipo» y «Registros sin cerrar» | no hay fichaje | `contasimple/contasimple-jornada-*.png` |

## Lo que YA tenemos y a ellos no les da ventaja (medido, sin ticket)

Duplicar presupuesto (`quotesDetailView.js:79-96`, `duplicateQuote` en `:1226`), etiquetas del documento (`etiquetasDelDocumento.js`), asignados por documento (`documentoAsignados.js`), revisiones del presupuesto (`quoteRevisiones.js`), notas internas y texto de cabecera/pie (`Quote.internal_notes`, `docHeaderText/docFooterText`), importación CSV (`csvImport.js`), descuento por defecto y etiquetas del cliente (`Customer.dtoPorDefecto`, `tags`). Existen ficheros de albarán ligado a presupuestos (`presupuestosParaAlbaran.ts`) y de atajos de caducidad (SCRUM-968; los atajos de Contasimple son 30/60/90 días): **no leí su contenido**, solo comprobé que existen. Vista móvil: la de Contasimple es una tabla con scroll horizontal (`contasimple-movil-presupuestos-tabla-con-scroll.png`).

## Visto por dentro en Tradify y YA decidido o ya nuestro (sin ticket)

Formularios/checklists («Forms», con plantillas): ya en `matriz.md` (Jobber, ServiceM8, «Fergus Certificates: no se propone»; «checklists en el parte» nº 9 de FASE 1). Recordatorios automáticos de presupuesto por email/SMS: existen los nuestros (`cron.ts`, por WhatsApp). Lista de «primeros pasos» con anillo de progreso (1/9): existe en `homeView.js`. Vista previa del documento antes de enviar: existe en `quotesView.js`. Servicios recurrentes y recordatorios de servicio por cliente: MANT-1 (`MaintenancePlan`, apagado por bandera). **SmartWrite** (IA que redacta la descripción del presupuesto a partir de las líneas): `git grep` de redactar/describir en `src/modules/ai` = 0; no abro ticket porque no he visto qué escribe ni con qué calidad (pregunta abierta, no hecho).

## Dato de mercado, NO propuesta (fiscal)

Contasimple «Validado por la AEAT» del NIF y «Registro mercantil» en la ficha; calendario fiscal; remesas SEPA. Se anotan, no se validan ni se proponen (regla 17).

## Errores míos (A9)

1. Sobrescribí la pestaña de Tradify con la de Fergus: el código que pasó el fundador llegó a una pantalla que ya no existía. Corregido en `pw.mjs`: la pestaña activa se guarda por `targetId`.
2. Escribí «~14:30 GMT» en tickets que se abrieron sobre las 14:12; la hora sale de GitHub, no de mi estimación.
3. Dije que la rama no estaba en el remoto porque `ls-remote` salía vacío: la rama estaba mergeada (#1587) y borrada, justo la trampa que trae `sesion-0.md`.
4. En SCRUM-1009 escribí de memoria una frase sobre ServiceM8/Jobber/Housecall Pro; la marqué como pregunta con un comentario.
6. En SCRUM-1013 escribí «Tradify lo tiene por acuerdos con Screwfix y CEF»: es una inferencia mía, no la medí.
7. Dos mensajes al orquestador dieron horas inventadas («~14:40», «~14:30»): la hora sale de `gh api -i zen`.
5. `snap` imprimió el valor de un campo de contraseña inventada (de un solo uso): no se vuelve a hacer `snap` con el formulario relleno.
