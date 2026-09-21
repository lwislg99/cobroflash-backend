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
| Tradify | pide código al correo del fundador (segundo intento armado; el primero caducó por un error mío) | pendiente |
| Fergus | solo se entra por enlace mágico al correo del fundador | pendiente |

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
| SCRUM-913 (comentario) | Contasimple: registro de jornada con «Mi equipo» y «Registros sin cerrar» | no hay fichaje | `contasimple/contasimple-jornada-*.png` |

## Lo que YA tenemos y a ellos no les da ventaja (medido, sin ticket)

Duplicar presupuesto (`quotesDetailView.js:79-96`, `duplicateQuote` en `:1226`), etiquetas del documento (`etiquetasDelDocumento.js`), asignados por documento (`documentoAsignados.js`), revisiones del presupuesto (`quoteRevisiones.js`), notas internas y texto de cabecera/pie (`Quote.internal_notes`, `docHeaderText/docFooterText`), importación CSV (`csvImport.js`), descuento por defecto y etiquetas del cliente (`Customer.dtoPorDefecto`, `tags`). Existen ficheros de albarán ligado a presupuestos (`presupuestosParaAlbaran.ts`) y de atajos de caducidad (SCRUM-968; los atajos de Contasimple son 30/60/90 días): **no leí su contenido**, solo comprobé que existen. Vista móvil: la de Contasimple es una tabla con scroll horizontal (`contasimple-movil-presupuestos-tabla-con-scroll.png`).

## Dato de mercado, NO propuesta (fiscal)

Contasimple «Validado por la AEAT» del NIF y «Registro mercantil» en la ficha; calendario fiscal; remesas SEPA. Se anotan, no se validan ni se proponen (regla 17).

## Errores míos (A9)

1. Sobrescribí la pestaña de Tradify con la de Fergus: el código que pasó el fundador llegó a una pantalla que ya no existía. Corregido en `pw.mjs`: la pestaña activa se guarda por `targetId`.
2. Escribí «~14:30 GMT» en tickets que se abrieron sobre las 14:12; la hora sale de GitHub, no de mi estimación.
3. Dije que la rama no estaba en el remoto porque `ls-remote` salía vacío: la rama estaba mergeada (#1587) y borrada, justo la trampa que trae `sesion-0.md`.
4. En SCRUM-1009 escribí de memoria una frase sobre ServiceM8/Jobber/Housecall Pro; la marqué como pregunta con un comentario.
5. `snap` imprimió el valor de un campo de contraseña inventada (de un solo uso): no se vuelve a hacer `snap` con el formulario relleno.
