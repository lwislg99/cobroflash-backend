# SCRUM-920 · Textos NUEVOS, propuestos y SIN firmar

En `gastos.html` salen subrayados (interruptor «Resaltar textos nuevos» de la barra negra). Todo lo que NO está aquí
ya existe hoy en el producto y se reutiliza **literal**. Pendientes de firma (regla 30). Las opciones de un `<select>`
no se pueden subrayar: las nuevas van marcadas aquí con **(select)**.

## 🔴 Uno que toca un texto FIRMADO: una sola palabra

| hoy (`expensesView.js:392`, SCRUM-324 E3) | propuesto |
|---|---|
| «Guardamos la foto como tu copia. Los datos fiscales salen de los campos **de arriba**.» | «Guardamos la foto como tu copia. Los datos fiscales salen de los campos **de abajo**.» |

**Por qué:** con la foto PRIMERO, los campos pasan a estar debajo y «de arriba» deja de ser verdad. Es una
descripción de la pantalla, no una afirmación fiscal; **el resto de la frase no se toca** (orden del orquestador,
18-sep). La frase va **entera y en un solo sitio** (el bloque de la foto, antes de hacerla): el borrador de anoche
reutilizaba su primera mitad suelta en tres sitios más, y eso separaba la salvedad fiscal de lo que salva. Quitado.

## El alta

| texto | qué es |
|---|---|
| «1 · La foto del ticket» | título del primer bloque |
| «Hazla ahora, que el papel lo tienes delante. Lo demás lo puedes rellenar luego.» | por qué la foto va primero |
| «Haz la foto del ticket» | el hueco vacío de la foto |
| «📷 Hacer foto» | abre la cámara |
| «Elegir foto o archivo» | galería o archivo; el ticket dice «foto o archivo» (aceptar PDF es propuesta: `medicion.md`) |
| «Ahora no tengo el ticket» | la salida: la foto va primero pero no es obligatoria |
| «Foto guardada» · «Si no se lee bien, repítela.» | con la foto hecha |
| «Verla» · «Quitarla» | acciones sobre la foto recién hecha |
| «2 · Qué es y cuánto» | título del bloque de lo imprescindible |
| «✓ Con esto ya se guarda. Lo de abajo es opcional.» | dice cuándo se puede parar; hoy nada lo dice |
| «3 · Datos de la factura del proveedor» · «Opcional» | el bloque plegado de los siete datos |
| «Opcional» (junto a «Notas») | — |

### El hueco de SCRUM-912 (sólo con el andamio encendido; la lectura no existe)

| texto | qué es |
|---|---|
| «🔎 Hemos leído el importe y la fecha de la foto. Revísalos: lo que se guarda es lo que pongas tú.» | aviso encima de los campos leídos |
| «leído de la foto» | marca junto a cada campo relleno por la lectura |

Estos dos son de 912 más que de 920: se proponen aquí sólo para que el hueco tenga forma. Los firma quien firme 912.

## La lista

| texto | qué es |
|---|---|
| «Todos · 9» · «Sin foto · 3» | los dos chips del justificante, con su cuenta |
| «Foto guardada» (con la miniatura) · «⚠︎ Sin foto» | el justificante en cada fila |
| «Sin trabajo» | sustituye al «—» de la celda Trabajo: un guion no dice si no hay trabajo o si no se pudo cargar |
| «Todos los trabajos» · «Sin trabajo» **(select)** | el filtro por trabajo, que hoy no existe |
| «Es la suma de lo que estás viendo, no la del mes.» | la salvedad de la suma filtrada; **no repite el total del mes**, que ya está en el KPI |
| «Ningún gasto con esos filtros» · «Prueba con otro mes, otra categoría u otro trabajo.» · «Quitar los filtros» | el vacío de los filtros (el vacío del mes es el de hoy, literal) |
| «Septiembre de 2026 · 9 gastos» | cabecera del mes: el nombre del mes y la cuenta (el nombre del mes ya existe en el selector) |

**El nombre del trabajo no es un texto nuevo:** es el que ya da `tituloDeTrabajo()` en la pantalla de Trabajos
(«Presupuesto #5 · María López»). Que Gastos lo use es SCRUM-944.

## El detalle (hoy no existe)

| texto | qué es |
|---|---|
| «El justificante» | título de la tarjeta de la foto |
| «Ver a tamaño completo» · «Cambiar la foto» | acciones sobre la foto |
| «De este gasto no guardaste ninguna foto.» · «📷 Añadir la foto ahora» | el gasto sin foto |
| «Datos de la factura del proveedor» | título de la tarjeta; **sólo se pinta si hay alguno apuntado** |
| «Editar» · «Ver el trabajo» | acciones de la cabecera («Editar gasto» existe hoy como título del modal) |
| «Sin trabajo» · «Este gasto no cuenta para el margen de ningún trabajo.» · «Vincular a un trabajo» | el gasto suelto |

## El «⋯» de la fila

| texto | qué es |
|---|---|
| «Editar» · «Ver el justificante» / «📷 Añadir la foto» · «Ver el trabajo» / «Vincular a un trabajo» | las opciones; «🗑 Eliminar» y su confirmación «¿Eliminar este gasto?» **ya existen** |

## Lo que se queda EXACTAMENTE como está

Ni una coma: «Gastos», «Controla tus costes y vincúlalos a trabajos para ver el margen real.», «Gasto del mes»,
«N categorías», «Sin asignar a trabajo», «no vinculados a un trabajo», «Mayor categoría», «Todas las categorías»,
«Materiales», «Desplazamiento», «Herramientas», «Subcontrata», «Otros», «Nuevo gasto» (firmado, SCRUM-769), «⬇ CSV»,
«Sin gastos este mes», «Registra materiales, desplazamientos y subcontratas para conocer el margen real de cada
trabajo.», «+ Añadir mi primer gasto», «Concepto *», «Importe *», «Base imponible», «Tipo de IVA», «Cuota de IVA»,
«Nº de factura del proveedor», «Fecha de la factura», «Fecha», «Categoría», «Trabajo (opcional)», «Proveedor
(opcional)», «NIF del proveedor», «Notas», «— Sin trabajo —», «— Sin proveedor —», «Vincula este gasto a un trabajo
para calcular el margen.», «Añadir gasto», «Guardar cambios», «Guardando…», «Cancelar», «El concepto es
obligatorio.», «El importe debe ser mayor que 0.», «Presupuesto sin trabajo», «Vinculación actual (trabajo cerrado o
sin trabajo abierto)», «— sin presupuesto, no se puede vincular».

## Lo que NO se escribe en ninguna parte

Ningún veredicto del justificante (`deducible`, `no_deducible`, `falta_confirmar`) ni ninguna lista de lo que le
falta al documento, **tampoco como la «cuarta vía»** que proponía el inventario (SCRUM-324 E3, espera al asesor;
decisión del orquestador del 18-sep). El instrumento lo vigila: `medir.mjs` busca esas palabras en las tres pantallas
y su control positivo demuestra que las vería.
