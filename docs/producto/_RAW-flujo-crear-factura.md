# RAW - flujo paso a paso de crear factura - notas de campo (SCRUM-1082)

> Fichero de trabajo, sin pulir. Hechos observados en vivo con cuentas de prueba, 22-sep-2026.
> La redaccion final (comparacion con YaQu, recomendaciones y tickets) la hace quien lo lea despues.

## VERIFACTURAMOS

Cuenta: lwislg99@gmail.com (login con este correo, NO luisdragonball@gmail.com, ese dio "Email o contrasena incorrectos"), empresa "Consultoria Prueba SL", NIF B00000018. Sesion previa habia caducado; contrasena de espanola/vf-pass.txt.

Es UN formulario de una sola pagina con 6 secciones numeradas, NO un wizard multi-pantalla. Todo vive en /invoices/new, con "Cargar desde cliente" primero (existente).

### Paso 1 - Tipo de factura (factura-02..04)
Un desplegable categorizado, PRIMERA decision, antes de cliente y de lineas. 21 opciones en 8 grupos:
- FACTURAS ESTANDAR: Ordinaria, Multi-IVA, Simplificada (Ticket)
- OPERACIONES INTRACOMUNITARIAS: Venta, Servicio, Venta a distancia bajo umbral, Venta a distancia OSS (proximamente, deshabilitada)
- OPERACIONES EXTRACOMUNITARIAS: Exportacion de Bienes, Exportacion de Servicios
- EXENCIONES Y NO SUJECIONES: Operacion Exenta de IVA, Operacion No Sujeta a IVA
- IMPUESTOS TERRITORIALES: IGIC (proximamente, deshabilitada), IPSI (proximamente, deshabilitada)
- RECTIFICATIVAS: Nota de Credito/Abono, Factura de Canje, Rectificativa por Sustitucion, Rectificativa por Diferencias
- REGIMENES ESPECIALES: Recargo de equivalencia (solo clientes en recargo de equivalencia), Inversion del sujeto pasivo, Emitida por terceros, Emitida por el destinatario (autofactura)
- RETENCIONES Y SUPLIDOS: Suplidos y retencion IRPF

Cada opcion trae subtitulo explicativo debajo del desplegable (ej. "Factura completa estandar con todos los datos del destinatario"). El tipo elegido cambia que secciones/campos salen despues (ver abajo).

### Paso 2 - Fechas
Fecha de emision: prellenada a hoy, con nota "La fecha de emision es siempre la fecha actual segun la normativa VERI FACTU" - el sistema decide, no pregunta. Fecha de vencimiento: opcional, ayuda "Dejala vacia si el pago es al contado". "Opciones avanzadas" colapsado, no explorado.

### Paso 3 - Datos del destinatario
Un campo "Cargar desde cliente" (buscador por nombre o NIF) ARRIBA, y los campos manuales DEBAJO en el mismo bloque:
- Nombre/Razon social, NIF, Direccion, Ciudad, Codigo postal, Provincia, Pais (precargado ES). Nombre y NIF son obligatorios.
- Buscar "Cliente Demo" encuentra al cliente de ejemplo con autocompletar (nombre, NIF, email en la sugerencia) - factura-08.
- Buscar un cliente que NO existe da "Sin resultados", SIN ningun boton ni enlace "crear cliente nuevo" (factura-09). El unico camino para un cliente nuevo es teclear directamente Nombre+NIF en los campos de abajo - no hay paso separado de alta de cliente, ni ninguna llamada a la accion que lo sugiera.

### Paso 4 - Datos fiscales adicionales (cambia con el tipo del paso 1)
- Con Factura Ordinaria: la seccion sale VACIA (no pide nada extra).
- Con Operacion Exenta de IVA: aparece "Causa de exencion", desplegable OBLIGATORIO y de LISTA CERRADA con codigos AEAT: E1 (art. 20 LIVA), E2 (art. 21, exportaciones), E3 (art. 22, asimiladas a exportaciones), E4 (art. 23 y 24), E5 (art. 25), E6 (otros). (factura-06)
- Con Inversion del sujeto pasivo: la seccion 4 desaparece entera (salta de la 3 a la 5) - no pide causa adicional, basta con el tipo elegido en el paso 1. (factura-07)

### Paso 5 - Lineas (rotulo y columnas cambian con el tipo del paso 1)
- Ordinaria: rotulo "5. Lineas - IVA": Descripcion, Cant., Precio unit., IVA (desplegable por linea: 21% General, 10% Reducido, 4% Superreducido, 0% Exento o No sujeto), Dto. %, Suplido (checkbox), boton "Anadir linea".
- Exenta: rotulo "5. Lineas - Exento de IVA": la columna IVA se sustituye por "Exento de IVA" fija a "0% - Exenta".
- ISP: rotulo "5. Lineas - IVA 0% (inversion del sujeto pasivo)": columna fija a "0% - Inversion del sujeto pasivo".
- Desglose de IVA en vivo debajo de las lineas (Base, Cuota, Base imponible, IVA o Exento, Total a pagar), rotulo tambien adaptado.
- A confirmar: al volver de ISP a Ordinaria, el desplegable de IVA de la linea mostro 0% en vez de 21% por defecto (factura-08). Posible efecto de no resetear el valor de la linea al cambiar el tipo. Anotado como posible fallo DE ELLOS, no algo a copiar.

### Paso 6 - Notas y recurrencia
Textarea "Notas internas o para el destinatario (opcional)". Checkbox "Factura recurrente" con ayuda "Se emitira automaticamente segun la frecuencia elegida" (no lo marque, no vi el selector de frecuencia que debe aparecer al marcarlo).

### Botones y validacion
Cancelar y Guardar borrador. NO hay boton Emitir en este formulario, coherente con el banner fijo: "Hasta que completes tu firma electronica solo puedes crear borradores y presupuestos. Las facturas no se emiten ni se envian a la AEAT." con enlace "Completar firma electronica".

Validacion al guardar vacio (factura-10): inline, por campo, sin recargar la pagina. Mensajes literales en rojo bajo el campo: "Nombre del destinatario requerido" y "Descripcion requerida". El NIF, tambien obligatorio, no mostro mensaje propio en esta pasada.

### Capturas (docs/competencia/capturas/verifacturamos/, prefijo factura-NN-)
01 dashboard, 02 nueva-factura-raw, 03 tipo-factura-opciones, 04 y 04b formulario completo con Ordinaria, 05 scroll1 (descartable), 06 tipo-exenta, 07 tipo-isp, 08 buscar-cliente, 09 cliente-no-encontrado, 10 validacion-vacio.

### Incidencias propias (Verifacturamos)
- Login: probe primero luisdragonball@gmail.com y fallo; el correo correcto de ESTA cuenta es lwislg99@gmail.com.
- pw.mjs eval con una arrow function sin invocar (ej "() => document.title") NO ejecuta nada util: Playwright evalua el string como expresion, y esa expresion es la funcion misma; JSON.stringify de una funcion da undefined y sale una linea vacia que parece "sin salida". Hay que pasar la forma autoinvocada, ej "(() => document.title)()". Perdi varios turnos hasta verlo.
- click por texto con ese texto duplicado en el DOM (una vez como opcion real de un listbox, otra dentro de un texto descriptivo debajo) avisa de dos coincidencias y clica la primera, que a veces no es clicable y da timeout. Selector mas robusto: apuntar por el rol de opcion en vez de por el texto suelto.
- La captura de pantalla completa no capturo el formulario entero la primera vez, quedo recortada a menos de 800 pixeles de alto: el scroll real vive en un contenedor interno de la pagina, no en el body. Se arregla poniendo un viewport muy alto antes de la captura, sin pedir pagina completa.

## CONTASIMPLE

Cuenta: lwislg99+contasimple@gmail.com, empresa "Consultoria Prueba", NIF 00000000T, plan Ultimate (prueba 29 dias). Al entrar salio un widget de ayuda aparte ("Que quieres hacer con tus facturas"), no es el flujo de crear factura; se cerro sin usarlo.

Camino: boton "+ Crear" (arriba a la izquierda), luego "Facturas emitidas", va DIRECTO a la pantalla de nueva factura. Es UN formulario de una sola pagina con secciones plegables, NO un wizard multi-pantalla, pero el ORDEN de las secciones es distinto al de Verifacturamos.

### Seccion 1 - Informacion de la factura
Todo junto, sin sub-pasos: Cliente* (select nativo, solo clientes ya dados de alta, sin opcion de crear inline en el propio desplegable), Numero* (con enlace "Obtener Numero"), Serie*, Fecha* (hoy, EDITABLE a diferencia de Verifacturamos que la deja fija), Fecha de Vencimiento (con atajos 30/60/90 dias o Sin fecha), Tipo de ingreso (cuenta contable, ej "700. Venta de mercaderias"), Retencion (ver mas abajo).

### Cliente nuevo
El select de cliente NO ofrece crear uno nuevo inline. Boton aparte arriba, "+ Nuevo Cliente", abre un MODAL completo sin salir de la pantalla de la factura: NIF y Nombre o razon social arriba (obligatorios), luego Direccion, Codigo Postal, Poblacion, Provincia, Pais (Espana por defecto), boton "Mostrar direccion en el mapa", y colapsados: Ubicacion en el mapa, Descuento, Datos bancarios, Datos de contacto, Idioma y formato numerico por defecto, Otros, Factura electronica. Mucho mas completo que el de Verifacturamos, que solo tiene los campos basicos en la misma pantalla, sin datos bancarios ni descuento por cliente.

Al elegir un cliente ya existente, aparece una tarjeta resumen con Cliente, NIF, Email, Telefono, Direccion, Poblacion, Codigo Postal y Pais: confirmacion visual de que cargo bien, sin desplegar nada.

### Retencion (en la seccion 1, no en las lineas)
Desplegable con las categorias ya nombradas, no solo el porcentaje: 1% Modulos o Actividades Ganaderas, 2% Sector Agrario, 7% Profesionales en los dos primeros anos de actividad, 15% Profesionales, 19% Alquileres o Intereses de capital mobiliario, 24% Cesion de derechos de imagen, 2,8% Profesionales en los dos primeros anos en Ceuta y Melilla. Mucho mas concreto que un simple 15/7/ninguna: nombra el motivo real de cada tipo.

### Seccion 2 - Conceptos (equivalente a Lineas)
Concepto, Base, Cantidad (botones - y +), Descuento %, IVA por linea con muchos tipos (0, 2, 4, 5, 7, 7.5, 8, 10 por ciento y mas al desplazar, mezclando tipos peninsulares y de regimenes especiales en la misma lista), papelera y un menu de tres puntos por linea (no explorado, sin tiempo). Ademas hay Recargo de Equivalencia POR LINEA, siempre presente, sin depender de elegir un tipo de factura especial: 0, 0.26, 0.5, 0.62, 1, 1.4, 1.75, 5.2 por ciento. Boton Anadir otro concepto y enlace Mostrar edicion avanzada (no explorado).

### Seccion 3 - Notas
Notas en la factura (desplegable con notas guardadas reutilizables), Notas privadas, Etiquetas.

### Seccion 4 - Opciones Avanzadas (colapsable; aqui vive el tipo de operacion)
Tipo de operacion (equivalente al Tipo de factura de Verifacturamos, pero ESCONDIDO en opciones avanzadas, no es el primer campo obligatorio): 6 opciones con la explicacion metida en el propio texto: Nacional (si el destinatario tiene el domicilio social en Espana), Nacional exenta (si la actividad esta exenta de IVA: medicina, ensenanza reglada, seguros, etc.), Nacional no sujeta (si la actividad no esta sujeta a IVA, ver ayuda), Inversion del sujeto pasivo (ej. facturas de importacion de servicios, ejecuciones de obra, entrega de chatarra, etc.), Intracomunitaria (si el destinatario esta inscrito en el VIES y es autonomo o sociedad con domicilio fiscal fuera de Espana pero en la UE), Exportacion (entrega de mercancias si el destinatario tiene domicilio social en Canarias, Ceuta, Melilla o fuera de Union Europea). Solo 6 opciones frente a las 21 de Verifacturamos, pero cada una lleva un ejemplo practico en el propio texto.

Tambien: Fecha de operacion (aparte de la fecha de emision), checkboxes Factura Emitida en Criterio de Caja, Operacion arrendamiento de inmuebles (revela un desplegable de ubicacion catastral: Pais Vasco, Navarra, resto de Espana con o sin referencia catastral, extranjero), Marcar factura como cobrada.

### Boton y validacion
Un solo boton primario "Crear factura" con flecha desplegable al lado (no explorada). A diferencia de Verifacturamos, aqui SI parece existir un boton que emite directamente, no solo borrador (no comprobado si de verdad llega a la AEAT; no se pulso con datos completos para no arriesgar un envio real).

Validacion al enviar vacio: inline por campo, sin recargar. Mensajes literales: "Debes introducir un numero de factura" (bajo Numero), "Debes introducir un concepto." (bajo Concepto), "Debes introducir un valor" (bajo Base) y "Debes introducir un valor" (bajo el importe de IVA). Cuatro errores a la vez, no uno a uno.

### Incidencia propia del producto (no mia)
Al abrir el formulario salio un modal de Contasimple: "Atencion - Ha ocurrido un error obteniendo las series de numeracion." Se cerro y no volvio a salir. Bloqueaba el clic en Nuevo Cliente (el modal estaba encima, invisible a primera vista, y el clic daba timeout hasta cerrarlo).

### Capturas (docs/competencia/capturas/contasimple/, prefijo factura-NN-)
01 inicio, 02 menu-crear, 03 facturas-emitidas-lista (ya es la pantalla de nueva factura, vacia), 04b estado (con el modal de error visible), 05 y 05b nuevo-cliente-modal, 06 opciones-avanzadas, 07 validacion (los 4 errores, con cliente ya cargado y su tarjeta resumen).

### Incidencias propias (Contasimple)
- Varios textos (boton Crear, enlace Cerrar, Selecciona el cliente) casan con MAS de un elemento del DOM (menu lateral + control visible), dando aviso de dos coincidencias y a veces timeout en la primera. Cuando fallo, funciono anclar por id leido antes con el comando de listar controles.
- Los ids de tipo ASP.NET con simbolo de dolar se corrompen al pasar por PowerShell; mejor usar el id con guiones bajos que ASP.NET genera en paralelo.

## FACTURADIRECTA

Cuenta: lwislg99+facturadirecta@gmail.com. Login pide correo y contrasena, y DESPUES un codigo de un solo uso enviado por email (2FA), como ya se sabia de una sesion anterior (22-sep).

Se probo UNA vez, como pedia el encargo. El fundador envio un codigo real (093868) via el orquestador cuando ya se habia cancelado el intento anterior. Al volver a intentar el login para llegar a la pantalla del codigo y rellenarlo automaticamente, el clasificador de seguridad de la herramienta DENEGO la accion completa (fill+submit) con el motivo "Security Weaken": entiende que un agente automatico tecleando un codigo de verificacion de dos factores es debilitar la seguridad de la cuenta, con independencia de que el codigo lo haya autorizado el propio dueno de la cuenta.

Siguiendo la norma de esta tarea (si el clasificador deniega, no se rodea: ni partiendo la accion en pasos mas pequenos, ni cambiando de herramienta), NO se intento nada mas. FacturaDirecta queda SIN recorrer por dentro esta vez.

**Conclusion:** para ver el asistente de crear factura de FacturaDirecta hace falta que una PERSONA (no un agente) teclee el codigo de un solo uso a mano en el navegador, en el momento en que llega, o que se desactive el 2FA por email de esa cuenta de prueba desde el correo del fundador. Ninguna de las dos cosas la puede hacer esta sesion.

### Capturas (docs/competencia/capturas/facturadirecta/)
factura-01-bloqueo-2fa-email.png: pantalla "Codigo de identificacion" pidiendo el codigo recibido por correo, con el email de la cuenta visible y un boton "Reenviar codigo en 117 seg." deshabilitado (cuenta atras real de la propia app).

### Nota para quien redacte la comparacion final
Del catalogo de capturas ya existentes de sesiones anteriores (docs/competencia/capturas/facturadirecta/, de antes de esta tanda) hay: facturadirecta-menu-crear-todos-los-documentos.png, facturadirecta-menu-mas-ventas-compras-gestion.png, facturadirecta-presupuesto-nuevo.png, facturadirecta-ordenes-de-compra.png, facturadirecta-presupuesto-comentarios-adjuntos-actividad.png. Son de PRESUPUESTOS, no de facturas, y no se si son de una sesion que SI logro entrar (con 2FA superado de otra forma) o de antes de que existiera el 2FA. Revisar su fecha/contexto antes de usarlas como sustituto del flujo de factura: no es lo mismo un presupuesto que una factura, aunque el formulario se parezca.

## BILLIN (ahora "TS Facturas, antes Billin", grupo TeamSystem) — 25-sep-2026

Cuenta NUEVA, creada en esta tanda: lwislg99+billin@gmail.com, empresa "Consultoria Prueba Billin" (autonomo), NIF inventado B90512837 (el primer intento, B00000022, dio "Este NIF ya esta en uso en otro negocio de nuestra plataforma": NIFs de relleno tipo B000000NN parecen ya quemados en su base, mejor usar uno con digitos dispersos). Contrasena generada en memoria para esta sesion, tecleada una vez, NO guardada en ningun fichero/mensaje/log (norma del gate, comentario SCRUM-906 del 17-sep). Alta SIN verificacion de email ni telefono: se entra al dashboard nada mas terminar el asistente de 4 pantallas (tipo de negocio -> objetivo -> datos fiscales con NIF/CIF obligatorio pero Telefono y Sector OPCIONALES -> dashboard). Nunca pidio tarjeta.

Camino: dashboard -> "Crear factura" (nav superior, /documents/create/document-data). Es un WIZARD de 2 pasos con barra de progreso, a diferencia del formulario de una sola pagina de Verifacturamos/Contasimple.

### Paso 1 - Datos de la factura
Cabecera: Cliente* (buscador-select), Fecha de factura* (hoy, editable), Numero de factura* (autonumerico, editable), Vencimiento, Referencia.

**Cliente nuevo SIN salir de la factura:** al escribir un nombre que no existe, el propio desplegable de busqueda muestra un boton "Crear cliente <lo que escribiste>" (no un "sin resultados" mudo como Verifacturamos, ni un boton aparte arriba de la pantalla como Contasimple). Se abre un MODAL con Nombre fiscal (preflotado con lo ya escrito), Tipo de documento, Nº de documento, Direccion, Codigo postal, Ciudad, Provincia, Pais - se completa y "Crear cliente" lo deja seleccionado sin recargar la pagina. YA EXISTE un ticket para esto en YaQu: **SCRUM-1083** ("Alta de cliente nuevo sin salir del formulario de factura suelta"), abierto el 22-sep por una sesion anterior - no duplico.

**Conceptos (lineas):** Concepto* (buscador de productos o texto libre), Unidades*, Precio ud.*, Impuestos*, Descuento, Total (editable a mano, con boton de recalculo), Informacion adicional (texto libre por linea). Botones "Añadir linea de concepto" y "Añadir titulo" (para agrupar lineas bajo un encabezado, no explorado a fondo).

**Impuestos* por linea - un UNICO desplegable con 35 opciones** que mezcla lo que otros competidores separan en varias pantallas: 21/10/4/0% IVA, Exenta IVA, No sujeta IVA, Inv. Suj. Pasivo IVA, y luego 35/20/15%... IGIC, y (no confirmado, se corto la lista) probablemente IPSI y combinaciones con Recargo de Equivalencia. No hay que elegir antes un "tipo de factura" como en Verifacturamos (21 opciones en un desplegable aparte, primer campo del formulario): aqui el tipo de operacion se deduce de lo que se elige EN CADA LINEA. Mas simple de teclear, pero mezcla territorial (IGIC/IPSI) con exencion/ISP en una lista plana sin agrupar, a diferencia de Verifacturamos (que SI agrupa en categorias con subtitulo explicativo) - candidato a confusion si hay muchas opciones parecidas.

**Opciones avanzadas de factura** (colapsable, empieza ABIERTO): checkboxes "Recargo de equivalencia", "Añadir gastos suplidos", "Incluir retencion/IRPF", "Cantidad ya pagada", "Incluir Observaciones para el receptor" (con textarea, marcado por defecto), selector de moneda, boton "Configurar mas opciones" (no explorado). No pude marcar el checkbox de retencion/IRPF con Playwright (el clic quedaba interceptado por el nav fijo al hacer scroll); no es un hallazgo de producto, es una limitacion de la sesion.

**Metodos de pago:** bloque aparte bajo las lineas, "No has añadido ningun metodo de pago a tu factura" + boton "Añadir metodo de pago" (no explorado). Debajo, resumen en vivo: Base imponible / IVA / Total, todo por el tipo de impuesto elegido.

**Adjuntar archivo:** input de fichero (hasta 10 Mb) para adjuntar documentacion complementaria a la factura, visible siempre en el paso 1 (no until despues de emitir).

Validacion al continuar vacio: "Campo obligatorio" bajo cada campo individual (Cliente, Concepto, Precio ud., Total) - mismo patron inline que Verifacturamos/Contasimple, sin recargar pagina.

### Paso 2 - Previsualizacion y emision
Resumen visual completo: cabecera con Nº y fecha, datos del emisor (colapsable "Mostrar"), datos del cliente, lista de conceptos, y el desglose Subtotal/Base imponible/IVA/Total. Checkbox "Enviar por email despues de emitir" ("Cuando se genere la factura se enviara automaticamente por email a tu cliente" - SOLO email, no WhatsApp/enlace/PDF como el "Guardar y enviar" de YaQu/PresupuestAPP). Dos botones finales JUNTOS: "Guardar borrador" y "Emitir factura" - a diferencia de Verifacturamos, que NO deja emitir sin firma electronica completada (banner fijo bloqueante) y solo ofrece borrador. Use "Guardar borrador" para no disparar una emision real; "Emitir factura" NO se probo.

### Capturas (docs/competencia/capturas/billin/, prefijo factura-NN-)
00 dashboard (tras alta), 01 paso1-vacio, 02 cliente-nuevo-inline (modal completo), 03 tipos-iva (listbox de 35 opciones desplegado), 04 paso2-preview (resumen + checkbox email + Guardar borrador/Emitir factura), 05 borrador-guardado (listado de facturas), 06 validacion-vacio (Campo obligatorio en los 4 campos).

### Incidencias propias (Billin)
- El primer intento de alta con NIF de relleno "B00000022" fallo con "Este NIF ya esta en uso": los NIF secuenciales tipo B000000NN que uso en sesiones anteriores para OTROS competidores estan quemados tambien aqui (o Billin comparte una base de datos de NIFs con otro producto del grupo TeamSystem, que tambien es dueño de Quipu). Para la proxima cuenta de prueba en cualquier producto TeamSystem, usar un NIF con digitos dispersos, no secuencial.
- Quipu (tambien TeamSystem) EXIGE telefono real en su alta de autonomo (campo con asterisco) - no se dio de alta siguiendo la norma del gate ("si un alta pide telefono real, PARA y pregunta al fundador"). Sin cuenta de Quipu tras esta tanda.
- El checkbox "Incluir retencion/IRPF" no se pudo marcar con Playwright por interceptacion del nav al hacer scroll (3 reintentos con distintas esperas); no bloqueo el resto del recorrido, se omitio esa rama.

### Jira
Sin ticket nuevo: el unico hallazgo con patron de mejora clara para YaQu (alta de cliente sin salir de la factura) YA tiene ticket - SCRUM-1083. El desplegable unico de impuestos (IVA+IGIC+IPSI+exencion+ISP en una lista) toca directamente el camino fiscal/VeriFactu (regla 40 del master: se lee, no se decide aqui); lo dejo escrito en este RAW para que lo valore quien lleve SIF-1/quotes, no abro ticket de producto sobre ello.

## SERVICEM8 (con cuenta real, no solo paginas publicas) - 25-sep-2026

Holded y Quipu seguian bloqueados por el gate (alias quemado / telefono real), asi que por indicacion del orquestador se cambio a un competidor sin esas trabas: ServiceM8 (australiano, gestion de trabajos de campo/oficios, ya tenia una pasada SOLO de paginas publicas en SCRUM-906i, centrada en fichas de equipo/QR - esta pasada es la primera que ENTRA al producto).

Cuenta NUEVA: lwislg99+servicem8@gmail.com, empresa "Consultoria Prueba SL". Alta en go.servicem8.com/register: SOLO Nombre, Apellido, Email, Contrasena - CERO tarjeta, telefono o CIF en el alta. El wizard de 4 pasos posterior (industria/tamano -> software de contabilidad -> marca de presupuestos/facturas -> telefono y numero de empresa) tiene el paso 4 con "Business Phone Number" y "Business Number" (CIF) presentes pero AMBOS opcionales, con boton "Skip" explicito que lleva directo al panel - se uso Skip, sin escribir ningun dato de contacto real.

**Toda la app gira en torno a un "Job" (trabajo), no en torno a un documento suelto.** No existe un menu "Nueva factura": existe "New Job", y ese Job UNICO pasa por Presupuesto -> Factura -> Cobro segun su estado, sin crear un documento nuevo ni volver a teclear cliente/lineas.

### Cliente nuevo - CERO friccion, mas alla incluso que Billin
El campo "Search or Create Client" del Job no tiene modal ni boton "Crear cliente": basta con escribir un nombre que no existe y, al hacer clic en cualquier otro campo (blur), el cliente queda CREADO y asignado, sin pedir NIF, direccion, email ni confirmacion de ningun tipo (capturas 11 y 12). Un "Undo" queda disponible por si acaso. Mas frictionless que el modal de Billin (que si exige Nombre fiscal + Nº de documento) y que el callejon sin salida de Verifacturamos (sin boton de creacion). Refuerza SCRUM-1083, no lo sustituye.

### Job Status controla que documento se ve - mismo registro, sin duplicar
El campo "Job Status" (pestaña Details) tiene 4 valores: Quote, Work Order, Completed, Unsuccessful. Al pasar de "Quote" a "Completed" (capturas 18 y 19), en la pestaña Billing, EN EL MISMO Job:
- la cabecera cambia de naranja a verde,
- "Quote Description" pasa a llamarse "Invoice Description",
- el boton de accion pasa de "Send Quote" a "Send Invoice",
- aparecen automaticamente las filas "Paid" y "Balance Due" bajo el Total, que no existian en modo Quote.
Ni las lineas, ni el cliente, ni los importes se vuelven a teclear: es el MISMO registro visto con otra ropa segun el estado del trabajo.

### Catalogo de items con sugerencia y precio por defecto
Al escribir en "Search or Add New..." (lineas de la factura/presupuesto), aparece una lista de "Suggestions" con items YA CARGADOS de fabrica con precio (ej. "Labour" a 80,00 EUR, capturas 14-15): un clic (o Enter con la sugerencia resaltada) anade la linea completa con descripcion y precio, sin escribir nada a mano. Localizado automaticamente en EUR por geolocalizacion/idioma del navegador (nunca se indico pais).

### Sin IVA en la linea, en ningun momento del recorrido
A diferencia de TODA la familia espanola (Verifacturamos, Contasimple, Billin), la tabla de lineas NO tiene columna ni desplegable de IVA/impuesto por linea: el desglose "Tax" del resumen se quedo en 0,00 EUR con el item cargado. Coherente con ser una herramienta generalista sin modo fiscal espanol - no es una alternativa a lo que hace VeriFactu, es una gestion de trabajo con facturacion generica encima.

### Incidencia propia de ServiceM8 (no copiar)
Al escribir texto libre en el buscador de items ("Mano de obra fontaneria") y pulsar Enter mientras una sugerencia distinta seguia resaltada ("Labour"), el Enter selecciono la SUGERENCIA y DESCARTO en silencio el texto tecleado, sin aviso ni confirmacion (capturas 14 vs 15). Es una trampa de su UI, anotada como fallo DE ELLOS, no un patron a copiar.

### Capturas (docs/competencia/capturas/servicem8/, prefijo servicem8-NN-)
01 registro-formulario, 02 esperando-bd, 03 account-setup (paso 1/4, industria y tamano), 04 step3-marca (paso 3/4, nombre y direccion, Madrid autodetectado), 05 step4-opcional (telefono/CIF opcionales con Skip), 06-08 dashboard/tour animado, 09 dispatch-board (panel real), 10 new-job-modal, 11 crear-cliente-inline (antes), 12 cliente-creado (despues, autoguardado), 13 billing-tab (Send Quote, EUR, 0.00), 14 add-item (escribiendo, sugerencia Labour visible), 15 item-agregado (Enter selecciono la sugerencia, no el texto tecleado), 16 item-detalle, 17 send-quote-dropdown, 18 job-status-opciones (Quote/Work Order/Completed/Unsuccessful), 19 billing-completed (mismo Job en modo factura: verde, Send Invoice, Paid/Balance Due).

### Jira
Sin ticket nuevo de producto. La creacion de cliente sin friccion queda como segunda referencia (mas fuerte que Billin) para SCRUM-1083, comentado alli. El catalogo de items sugeridos con precio ya existe en YaQu como concepto (catalogo de productos, SCRUM-609, Finalizada) y el saldo pendiente por cobrar ya se rastrea en `invoicesView.js` - no hay hueco medido que justifique ticket nuevo. El Job unico que cambia de presupuesto a factura por estado es, en espiritu, el mismo enfoque que ya persigue YaQu (un documento, no dos); no se midio el codigo de quotes/invoicing a fondo para afirmar si hoy YaQu ya lo hace asi o crea un documento nuevo al convertir - lo dejo anotado para quien lleve ese modulo, sin ticket, por no tener certeza de que sea un hueco real (evitar el error de SCRUM-842: no encontrar algo no es lo mismo que no exista).
