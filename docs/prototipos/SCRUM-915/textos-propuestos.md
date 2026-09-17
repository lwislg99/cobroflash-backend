# SCRUM-915 · Textos NUEVOS del prototipo, propuestos y SIN firmar

En `editor-presupuesto.html` salen subrayados (interruptor «Resaltar textos nuevos»). Todo lo que NO está en
esta lista es un texto que ya existe hoy en el producto y se reutiliza literal. Pendientes de firma
(regla 30): nada se construye con ellos hasta que se firmen. `N`, `M` y `«…»` son valores que se rellenan.

## Los pasos
| Paso | Nombre | Debajo, en el riel |
|---|---|---|
| ① | «Para quién» | «Elige el cliente» |
| ② | «Qué trabajo es» | «Describe el trabajo» |
| ③ | «Repasa los importes» | «Comprueba el total» |
| ④ (presupuesto) | «Condiciones» | «Cobro y validez» |
| ⑤ (presupuesto) | «Enviar» | «Genera y envía» |
| ④ (justificante) | «Emitir» | «Emite el justificante» |

- «Paso N de M» (móvil) · «Continuar» (móvil) · «Después de «…»» (pista en un paso aún por hacer)
- «Así lo verá el cliente. Genera el presupuesto y elige cómo mandárselo.» (último paso, móvil)
- «Revisa el justificante antes de emitirlo.» (último paso del justificante, móvil)

## La hoja
- «Nº al generar» (cabecera, antes de generar)
- «Cambiar» (cliente elegido)
- «Descríbelo con tus propias palabras y te proponemos las líneas del presupuesto usando tu catálogo de productos.» — sustituye a «Describe el trabajo con tus propias palabras y Claude sugerirá…», que nombra un proveedor que no es el que se usa
- «O escríbelo a mano»
- «Propuesto por la IA: precio / cantidad / cantidad y precio. Revísalo antes de enviar.» + botón «Revisado» (el aviso que hoy se pierde al insertar)
- «Este cliente tiene pactado un descuento del N %» + «Aplicar a las líneas» — sustituyen DOS marcadores de hoy
- «Aplicar» (formas de pago pactadas) — sustituye un marcador de hoy

## El riel y las acciones
- «Opciones del documento»
- «Falta elegir el cliente» / «Falta al menos una línea con concepto, cantidad y precio» (bajo el botón gris)

## Hojas y avisos
- Opciones: «Lo que casi nunca cambia. Empieza con lo habitual; tócalo sólo si este documento es distinto.»
- Menú de la línea: título «Línea N» y «Ajustes (IVA, descuento, descripción…)»
- Ajustes de la línea: «Descripción» (sustituye «[PENDIENTE microcopy oficial] descripción») y «Sale bajo el concepto si en Opciones marcas «Incluir descripción en el PDF».»
- Guardar plantilla: «Con su descripción, descuento y suplido.» ⚠️ exige cambio de servidor (hoy la plantilla los pierde): decide el fundador
- Nuevo cliente: «El mismo formulario de Clientes, sin salir del documento.»
- Limpiar: «¿Vaciar este documento?», «Se quitan el cliente, las líneas y los cambios de este documento. Tus plantillas y tus opciones de siempre no se tocan.», «No, seguir» (el botón de confirmar reutiliza «Limpiar formulario»)
- Generar dos veces: «Este presupuesto ya está generado», «Generarlo otra vez crearía un segundo presupuesto. ¿Quieres ver el que ya tienes?», «Ver el presupuesto #N»

## Los cuatro marcadores visibles de hoy, y qué los sustituye
| Hoy | Propuesto |
|---|---|
| «[PENDIENTE microcopy oficial] descripción» | «Descripción» |
| botón de formas de pago pactadas | «Aplicar» |
| «[PENDIENTE microcopy oficial] · N %» | «Este cliente tiene pactado un descuento del N %» |
| botón del descuento pactado | «Aplicar a las líneas» |
