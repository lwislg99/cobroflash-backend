# SCRUM-915 · Inventario de HOY del editor de presupuesto y documento suelto

Leído del código sobre `origin/main` = `0888df9e` (17-sep-2026). NO abierto en el navegador. Base del
«antes → después» que exige el ticket: ninguna fila puede quedarse sin sitio en el diseño nuevo.

- Editor único: `public/dashboard/js/quotesView.js` (QV), `renderQuotesView(container, template, documentoSuelto)` (QV:24).
  El documento suelto es `renderDocumentoSueltoView` → `renderQuotesView(c, null, true)` (QV:594).
- Rutas: `quotes-new` (app.js:289) e `invoices-new` (app.js:365). `window.appDocumentoSuelto` ('factura' | 'justificante' | 'no', app.js:38).
- Rótulos del suelto en `rotulosDelDocumento.js`: tituloModal «Nuevo justificante»/«Nueva factura»; accionPrimaria «Emitir justificante»/«Emitir factura»; avisoEmitido «Justificante emitido»/«Factura emitida»; errorAlEmitir «No hemos podido emitir el justificante/la factura. Inténtalo otra vez.»
- Maqueta: tarjeta izquierda 1,7fr + derecha (vista previa) 1,1fr; ≤1100 px una columna; KPI total sticky <768 px.
- Entradas: lista de presupuestos (botón + tecla N), ficha de cliente (sin preseleccionar), solicitudes («+ Crear presupuesto», sin rellenar), estado vacío de Facturas, Plantillas («usar plantilla» con argumento), ficha de presupuesto, tareas del Inicio. Suelto: botón en Facturas si `appDocumentoSuelto !== 'no'` + tecla N; `invoices-new` abre por URL aunque no haya botón.

P = sólo presupuesto · Ambos = también en el documento suelto.

## A. Cabecera
| Control | Texto | Condición | Sitio |
|---|---|---|---|
| título app | «Nuevo presupuesto» / tituloModal() | Ambos | app.js:290/366 |
| h2 | «Crear presupuesto» / tituloModal() | Ambos | QV:80 |
| p | «Genera un presupuesto con varias líneas, calcula los totales y envía el link de pago por WhatsApp.» | P | QV:86 |
| datos de empresa | «Cargando datos de empresa…» → «nombre · razón social · NIF · dirección · WhatsApp»; error «Error cargando datos de empresa.» | Ambos | QV:95, 4119 |
| aviso global | mensajes (§Flujos) | Ambos | QV:102 |

## B. 1. Cliente
| Control | Texto | Qué hace | Condición | Sitio |
|---|---|---|---|---|
| buscador | «Buscar por nombre, teléfono, email o referencia…» | filtra en local, sin acentos | Ambos | QV:466; buscadorDeClientes.js |
| select Cliente | «Selecciona un cliente…», «+ Nuevo cliente» (2.ª siempre), «nombre (teléfono)»; deshabilitadas «Primero necesitas un cliente.» / «Sin resultados para tu búsqueda» | recalcula propuestas de descuento y pago, pista dirección, vista previa, borrador | Ambos | QV:439, 1741, 4164 |
| select Dirección de la obra | «No mostrar» (defecto) / «Utilizar dirección de facturación» / «Personalizada» | `shippingAddressMode` | P | QV:503; quoteDireccionObra.js |
| input dirección | placeholder = dirección de facturación (nunca como valor), max 300 | `shippingAddress` sólo con Personalizada | P | QV:525 |

## C. 2. Líneas
| Control | Texto | Qué hace | Condición | Sitio |
|---|---|---|---|---|
| select IVA por defecto | 21/10/4/0 (+ valor ajeno) | IVA de líneas NUEVAS | Ambos | QV:581; tiposDeIva.js |
| select IVA del presupuesto | «Sumar el IVA al final» (defecto) / «IVA no incluido» | `ivaModo`; sin oyente | P | QV:598 |
| ayuda | «Añade los conceptos que vas a presupuestar.» | — | P | QV:1243 |
| botón IA | «✨ Sugerir con IA» (tooltip «Describe el trabajo y Claude sugiere las líneas del presupuesto») | modal IA | Ambos (tooltip P) | QV:1265 |
| botón plantillas | «📋 Usar plantilla» / «📋 Ver las N» (>3); oculto con 1–3 | modal plantillas | Ambos | QV:1277 |
| fichas plantilla (máx 3) | «Empieza con una plantilla» / «Añadir una plantilla»; nombre + «N línea(s)» | carga plantilla | Ambos | QV:1320, 3809 |
| fichas conceptos | «Tus conceptos más usados»; concepto + «en N presupuestos» | añade línea, foco en Precio | Ambos, si hay señal | QV:1339, 3869 |
| líneas | 3 en blanco al abrir | — | Ambos | QV:1344 |
| + Añadir línea | «+ Añadir línea» | añade, foco en Concepto | Ambos | QV:1354 |

### C.1 Cada línea (`.quote-line`)
Concepto («Concepto / servicio», autocompletado) · Cantidad (defecto 1) · Precio · ficha de ajustes (texto vivo «IVA 21 %», «Suplido · sin IVA», «· Dto. N %»; tooltip obsoleto «(margen e IVA)») · Total («—» si vacía) · asa «⠿» (sólo ratón) · menú «⋯»: «↑ Subir», «↓ Bajar» (deshabilitadas en extremos), «🗑️ Eliminar línea» (si es la única, la vacía; no guarda borrador). QV:3141–3680.

### C.2 Hoja «Ajustes de la línea»
«?» (guía), «×», concepto o «Línea sin concepto todavía» · checkbox «Suplido (pagado por cuenta del cliente)» + aviso largo (P) · «IVA %» (Ambos) · «Coste» (P, sólo admin, `data-microcopy=PENDIENTE_FUNDADOR`) · textarea «[PENDIENTE microcopy oficial] descripción» (P) · «Dto. %» (P, sin oyente) · «Listo» · clic fuera/Esc. QV:3066–3129.

## D. 3. Condiciones (sólo P)
«Condiciones de pago»: «Sin condiciones específicas» / «Pago 100% al aceptar» (defecto) / «50% al aceptar, 50% al finalizar» / «Solo presupuesto (facturación manual)» / «Plan personalizado (por tramos)» · con tramos: «Tramos de cobro», «+ Añadir tramo», etiqueta («Etiqueta (p. ej. Anticipo)»), «%», «🗑️», «Suman X % ✓» / «Suman X % — deben sumar 100 %» · «Válido hasta» (hoy+30, mínimo hoy+1, zona del negocio) · fichas «7 días», «14 días», «30 días» · nota «Pasada esta fecha el presupuesto caduca solo y el cliente verá "pide uno actualizado".» QV:645–880.

## E. 4. Envío (sólo P)
«Incluir descripción en el PDF» · «Formas de pago que verá el cliente»: «💳 Tarjeta», «📲 Bizum», «🏦 Transferencia» (sin IBAN: deshabilitada, «(añade tu IBAN en Configuración)») · notas «Solo se muestran las que tengas configuradas (IBAN, Bizum o tarjeta).» y «💳 La tarjeta lleva una comisión del 0,9 % por cobro. Bizum y transferencia, gratis.» · tira «Formas de pago pactadas · …» + botón «[PENDIENTE microcopy oficial]» (si el cliente tiene pactadas) · «Datos del cliente en el documento»: «Nombre», «Teléfono», «NIF», «Email» · radios «Razón social» / «Nombre comercial» · nota «Solo aparecen los que el cliente tenga rellenos. Elige con qué nombre sale este cliente en el documento.» QV:626–1209.

## F. Totales y descuento (va DESPUÉS de Condiciones y Envío)
«Suma de líneas», «Descuento», «Descuento global», «Base imponible», «IVA (N%)» · «+ Añadir descuento» → «Descuento global» (€) (P) · tira «[PENDIENTE microcopy oficial] · N %» + botón «[PENDIENTE microcopy oficial]» (descuento pactado del cliente, P). QV:1408–1570.

## G. KPI
«Total presupuesto» / «Total» + importe; sticky <768 px. QV:2202.

## H. Acciones
«Generar presupuesto» / accionPrimaria() («Generando…» / «Emitiendo…») · «Limpiar formulario» (sin confirmación; NO resetea IVA del presupuesto, validez, formas de pago, datos del cliente, radios, incluir descripción, descuento global, buscador) · «💾 Guardar como plantilla» · «✓ Guardado automáticamente» (P). QV:1595–1643, 3757.

## I. Tarjeta derecha
«Vista previa del documento» (NO interactiva, máx 440 px, no refleja validez, IVA no incluido, formas de pago, datos del cliente, dirección de obra, NIF/email del cliente, suplido, nº de documento, Dto. por línea; pie fijo «Presupuesto válido durante 30 días salvo indicación en contrario.» que ignora «Válido hasta») · «Estado del presupuesto» (P): «📄 Genera el presupuesto y aquí verás su número, el estado y si se ha enviado.» → «Presupuesto #N», estado, «Enviado por WhatsApp: sí/no». QV:1646–1711, 2214–2518.

## J. Modal tras generar (P)
«Presupuesto #N generado» · «Revisa el PDF del presupuesto antes de enviarlo por WhatsApp al cliente.» · «Abrir PDF en nueva pestaña →» · iframe PDF · sin PDF: «No se ha encontrado la URL del PDF todavía. Puede tardar unos segundos en generarse.» · pendiente: «📋 Enviado a un administrador para aprobación. Podrás mandarlo al cliente cuando lo apruebe.» · «Enviar al cliente»/«Documento» · «Enviar por WhatsApp» → «✓ Enviado por WhatsApp» · «✉ Enviar por email» · «⬇ Descargar PDF» · «Seguir editando» → «Hecho ✓». Código muerto: «Has desmarcado "Enviar por WhatsApp automáticamente"…». No navega ni limpia: pulsar Generar otra vez crea OTRO presupuesto. QV:119–331.

## Documento suelto: qué cambia
Se quita: subtítulo, ayuda de líneas, tooltip IA, dirección de obra, IVA del presupuesto, bloques 3 y 4, descuento global y pactado, en ajustes todo salvo «IVA %», borrador, panel de estado, en vista previa condiciones y validez. Se mantiene: cliente con alta, IVA por defecto, IA, plantillas, conceptos, autocompletado, líneas, + Añadir línea, Base/IVA, KPI («Total»), Limpiar, Guardar plantilla. Emitir: valida sólo cliente → POST `/admin/invoices` `{customerId, lines:[{concept,qty,price,tax}]}` («1,5» con coma → NaN) → toast avisoEmitido() y navega a `invoice-detail`.

## Flujos
- **IA** (`aiQuoteAssistant.js`): modal «✨ Sugerir líneas con IA»; «Describe el trabajo con tus propias palabras y Claude sugerirá las líneas del presupuesto usando tu catálogo de productos.»; «Descripción del trabajo» (ejemplo del grifo); «🎤 Dictar» sólo con VOICE_QUOTE_ENABLED + SpeechRecognition + https + no PWA iOS; «✨ Generar sugerencias» → «⏳ Pensando…»; POST `/admin/ai/suggest-quote` → `{lines[{concept,qty,price,tax,supuestos?}], descartadas}`; «Sugerencias (selecciona las que quieras añadir):», checkbox por línea, «Esto lo hemos puesto nosotros: cantidad y precio. Revísalo antes de enviar.», descartadas «Esto no lo hemos añadido porque no sabíamos qué IVA ponerle: …»; «Añadir líneas seleccionadas». Errores: «Escribe una descripción del trabajo.», «La IA no está configurada. Añade GEMINI_API_KEY (gratis) en Railway.», «Error al generar sugerencias. Inténtalo de nuevo.», «La IA no generó líneas. Prueba con una descripción más detallada.», «Selecciona al menos una línea.». Con editor vacío sustituye las 3 en blanco; `supuestos` se PIERDE al insertar; dictado → `created_via='voice'`.
- **Plantillas**: GET/POST `/admin/templates`; modal «📋 Usar plantilla» («Elige una plantilla para cargar sus líneas en el presupuesto actual.», fila nombre + «N línea(s) · EUR» + «Usar →»; vacío «Aún no tienes plantillas guardadas. Crea una con el botón "💾 Guardar como plantilla".»); «Plantilla "X" cargada — N líneas añadidas.»; guardar: «💾 Guardar plantilla», «Nombre de la plantilla» («Ej. Revisión caldera estándar»), «N línea(s) se guardarán.», «Guardar plantilla» (Enter) — PIERDE descripción, Dto., suplido y coste.
- **Alta de cliente** sin salir: `altaClienteModal.abrirNuevo` (mismo formulario de Clientes, POST `/admin/customers`), queda seleccionado; cancelar vuelve al anterior.
- **Borrador** `pf_quote_draft_<merchantId>` (sólo P, 700 ms): guarda cliente, condiciones, tramos, IVA defecto, y por línea concepto/cantidad/precio/IVA/coste/descripción/suplido. NO guarda Dto., descuento global, dirección, IVA del presupuesto, validez, formas de pago, datos del cliente, incluir descripción. Restaura con «📝 Borrador restaurado. Sigue donde lo dejaste o pulsa "Limpiar formulario".»
- **Autocompletado**: ≥2 caracteres, 150 ms, GET `/admin/products/autocomplete`; «Buscando…» / «Sin resultados»; recientes `pf_recent_products_<mid>` (5); al elegir rellena concepto, precio, IVA, coste y descripción vacía, foco a Cantidad y añade línea si era la última. ↑↓ Enter Esc.
- **Generar**: valida merchant («No se ha podido obtener el merchant actual.»), cliente («Selecciona un cliente.»), línea válida («Añade al menos una línea válida con concepto, cantidad y precio.»), tramos («Revisa los tramos: cada uno necesita etiqueta y porcentaje, y deben sumar 100 %.»); POST `/quote/create` (merchant_id, customer_id, currency, lines, paymentTerms, customBillingPlan, payMethods, docFields, discountGlobalAmount, shippingAddressMode, shippingAddress, created_via, validUntil, ivaModo); GET `/admin/quotes/:id` para pdfUrl; aviso «Presupuesto creado en borrador.» o «📋 Presupuesto enviado a un administrador para aprobación.»; mensajes de email/WhatsApp del modal (sin email, sin teléfono, formato, fallo, enviado).
- **Teclado**: N en listas abre el editor; dentro del editor N abre la Cotización rápida encima (defecto); tutorial «💡 Busca un cliente o créalo al vuelo, y añade los servicios de tu catálogo.»

## Marcadores visibles hoy
1. «[PENDIENTE microcopy oficial] descripción» (QV:3271) · 2. botón formas de pago pactadas (QV:1011) · 3. botón descuento pactado (QV:1499) · 4. «[PENDIENTE microcopy oficial] · N %» (QV:1551). Pendientes sin marcador: «Coste», textos de dirección de obra (falta fundador), «7/14/30 días» (falta fundador).

## Recuento
Presupuesto: 32 controles fijos + 9 por línea × 3 = 59 (+ fichas, tramos, líneas extra). Documento suelto: 9 fijos + 27 = 36. Modales: IA 6 + 1/sugerencia · Usar plantilla 2 + 1/plantilla · Guardar plantilla 4 · Tras generar 5 + iframe.
