# SCRUM-915 · Textos NUEVOS del prototipo v3, propuestos y SIN firmar

En `editor-presupuesto.html` salen subrayados (interruptor «Resaltar textos nuevos»). Todo lo que NO está aquí
ya existe hoy en el producto y se reutiliza literal. Pendientes de firma (regla 30). `N`, `M` y `«…»` se rellenan.

## Los pasos (título · frase guía)
| Presupuesto | Justificante |
|---|---|
| «Cliente» · «¿Para quién es el presupuesto?» | «Cliente» · «¿Para quién es el justificante?» |
| «Conceptos» · «Añade lo que vas a hacer, con su cantidad y su precio.» | «Conceptos» · «Añade lo que has hecho, con su cantidad y su precio.» |
| «Condiciones» · «Ya van puestas las de siempre. Cámbialas sólo si este cliente es distinto.» | — |
| «Revisar y enviar» · «Revisa el documento y, si está bien, envíaselo al cliente por WhatsApp.» | «Revisar y emitir» · «Revisa el documento y, si está bien, emítelo.» |

- Paso cerrado: «Cambiar» · resumen «N conceptos · total» y «… · válido hasta dd/mm/aaaa»
- «Continuar» · «Atrás» · «Paso N de M» (móvil) · «Ver documento» (móvil) · «Volver al editor»
- Bajo «Continuar» desactivado: «Elige un cliente para seguir» / «Falta al menos una línea con concepto, cantidad y precio» (el de los tramos ya existe)
- Condiciones: «Cambiar» / «Listo» en cada fila

## El documento de la derecha
- «Así lo verá el cliente» · «Se actualiza mientras escribes»
- «Nº al generar» · «Aquí aparecerán los conceptos que añadas.» · «Presupuesto válido hasta el dd/mm/aaaa.» (sustituye al fijo «…válido durante 30 días…»)

## Líneas
- «Propuesto por la IA: precio / cantidad / cantidad y precio. Revísalo antes de enviar.» + «Revisado»
- «Este cliente tiene pactado un descuento del N %» + «Aplicar a las líneas» — sustituyen DOS marcadores
- «Aplicar» (formas de pago pactadas) — sustituye un marcador
- Modal de IA: «Descríbelo con tus propias palabras y te proponemos las líneas usando tu catálogo de productos.» (el de hoy nombra a «Claude», que no es el proveedor que se usa)

## v3 · Ajustes del documento (bloque plegable en Condiciones; en el justificante, en Revisar)
- «Ajustes del documento» · resumen «IVA sumado» / «IVA no incluido» (ya existe) · «sin dirección de obra» / «con dirección de obra» · en el justificante «IVA por defecto N %»
- El galón ▸/▾ no es texto: es señal de que el bloque se abre y se cierra. No necesita firma.

## v3 + ajuste · Enviar (la HOJA DE ENVÍO)
**El botón del último paso** ya no puede llamarse «Enviar por WhatsApp», porque con la hoja delante **ese botón no
envía: abre la hoja**. Un botón que dice lo que no hace es el mismo defecto que teníamos en la v2 escondiendo el envío
detrás de «Generar», sólo que al revés.
- «Guardar y enviar» (NUEVO) — el botón del último paso, y el mismo en la barra de abajo en móvil. Guarda el
  presupuesto (le da su número) y abre la hoja.

**Dentro de la hoja:**
| texto | estado |
|---|---|
| «Enviar el presupuesto» (título de la hoja) | **NUEVO** |
| «Presupuesto #N guardado. Elige cómo se lo mandas.» | **NUEVO** |
| «Así le llega a \<cliente\> por WhatsApp» (rótulo sobre el mensaje) | **NUEVO** |
| el cuerpo del mensaje (Hola… / te ha preparado un presupuesto / Presupuesto #N / Total / Tócalo para verlo y responder / Enviado con Yaqu / «Ver presupuesto») | **NO es nuevo, y NO se toca**: es la plantilla `quote_decision_es` de `docs/WHATSAPP_TEMPLATES.md` §1 con sus 4 variables. Las plantillas de Meta son STOP |
| el total dentro del mensaje: «419.87 EUR», no «419,87 €» | **no es elección de estilo**: es lo que `sendQuote.service.ts:89` envía hoy. Que el documento de al lado diga «419,87 €» y el mensaje diga «419.87 EUR» es un hallazgo del prototipo, con ticket propio (SCRUM-931) |
| «📲 Enviar por WhatsApp» | ya existe |
| «O mándaselo de otra forma» (rótulo de los canales) | **NUEVO** |
| «✉ Enviar por email» · «⬇ Descargar PDF» | ya existen |
| «🔗 Copiar enlace» | **NUEVO** — idea tomada de PresupuestAPP; el enlace existe ya (`/pay/quote/:token`, el mismo del botón de la plantilla) |
| «Lo envío luego» (cerrar la hoja sin enviar) | **NUEVO** — sustituye a «Solo guardar» de la v3, que ya no hace falta: al abrir la hoja el presupuesto YA está guardado, así que lo único que queda por decir es que el envío se deja para después |

**Fuera de la hoja, después:**
- Confirmación en la misma pantalla, sin modal: «✓ Enviado por WhatsApp a \<cliente\> · pendiente de firma» ·
  «✓ Enviado por email a \<email\>» · «Presupuesto #N guardado · sin enviar» (este último sale en cuanto se abre la
  hoja, porque en ese momento ya es verdad).
- «Enviar de otra forma» (NUEVO) — reabre la hoja después de haber enviado.

**Lo que NO se copia de PresupuestAPP, y por qué:** «Ya se lo he entregado en mano» no se propone porque hoy el
producto no tiene ese estado, y un rótulo que promete un estado que no existe es peor que el hueco (canon de la S4).

## Cabecera, menús y hojas
- «Más acciones» (menú ⋯ de arriba) · «Línea N» · «Ajustes (IVA, descuento, descripción…)»
- «Descripción» (sustituye «[PENDIENTE microcopy oficial] descripción») · «Sale bajo el concepto si en Opciones marcas «Incluir descripción en el PDF».»
- «Con su descripción, descuento y suplido.» ⚠️ exige cambio de servidor: decide el fundador
- «El mismo formulario de Clientes, sin salir del documento.»
- «¿Vaciar este documento?» · «Se quitan el cliente, las líneas y los cambios de este documento. Tus plantillas y tus opciones de siempre no se tocan.» · «No, seguir»

## Los cuatro marcadores visibles de hoy
| Hoy | Propuesto |
|---|---|
| «[PENDIENTE microcopy oficial] descripción» | «Descripción» |
| botón de formas de pago pactadas | «Aplicar» |
| «[PENDIENTE microcopy oficial] · N %» | «Este cliente tiene pactado un descuento del N %» |
| botón del descuento pactado | «Aplicar a las líneas» |
