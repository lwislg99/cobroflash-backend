# SCRUM-920 · Textos NUEVOS, propuestos y SIN firmar

> ✅ **FIRMADOS el 20-sep-2026 por el orquestador (firma delegada): SCRUM-920 comentario 15992** (creado en Jira el
> 2026-09-20T15:22:54+02:00, es decir 13:22:54 Z; el propio comentario dice «~13:50Z», que no es la hora de Jira). Con tres
> cambios que ya están aplicados abajo: ① fuera «justificante» («La foto del ticket», «Ver la foto»); ② fuera el
> triángulo («Sin foto»); ③ singular «<Mes> de <año> · 1 gasto» y plural «· N gastos». Además «Ver el trabajo» pasa a
> **«Ver trabajo»**, literal ya firmado (SCRUM-302). Los dos textos de la lectura del ticket (912) NO entran en esa firma.
> La ficha de registro es `ficha-microcopy-DRAFT.md`; la mueve la S2 a `docs/microcopy/` en el PR que los pinta.

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
| «🔎 Hemos leído la foto y rellenado lo que se veía. Revísalo: lo que se guarda es lo que pongas tú.» | aviso encima de los campos leídos. **Reformulado el 21-sep (920h):** decía «el importe y la fecha», y con un dato descartado eso deja de ser verdad (la fecha no se rellenó y el aviso decía que sí) |
| «leído de la foto» | marca junto a cada campo relleno por la lectura |

Estos dos son de 912 más que de 920: se proponen aquí sólo para que el hueco tenga forma. Los firma quien firme 912.

### 🆕 920h · Por qué un campo de la lectura quedó sin rellenar (PROPUESTOS, SIN FIRMAR)

Nace del comentario 16152 de SCRUM-920 (orquestador/S0, 21-sep-2026) y del 16007. `POST /admin/expenses/leer-ticket` ya
devuelve `descartados: [{campo, motivo}]` y **ninguna pantalla lo pinta**: un campo que el modelo leyó y no valía queda en
blanco sin decirlo. La regla que decide qué se dice: **«no se leyó» (`null`) y «se leyó y no vale» (descartado) son dos
hechos distintos, y sólo el segundo lleva línea.** La línea va **debajo del campo**, en ámbar (el aviso de DESIGN.md, no el
rojo: no es un fallo de quien apunta el gasto) y enlazada al campo con `aria-describedby`.

Hay **nueve motivos** (`MotivoDescarte` en `lecturaTicket.ts`) y el prototipo tiene uno por cada uno (grupo H del inventario
y `MOTIVOS` en `gastos.html`); el medidor lee el tipo del servidor y cae si un motivo se queda sin texto.

| motivo | campos donde sale | texto propuesto | nota |
|---|---|---|---|
| `no_es_numero` | Importe, Base, Cuota, Tipo de IVA | «No hemos podido leer esta cifra. Escríbela tú.» | el modelo devolvió algo que no es una cifra |
| `fuera_de_rango` | Importe, Base, Cuota | «La cifra que hemos leído no tiene sentido. Escríbela tú.» | negativa, de más de 1.000.000 o (sólo el Importe) cero |
| `tipo_iva_no_admitido` | Tipo de IVA | «El tipo de IVA que hemos leído no es uno de los que se pueden guardar. Elígelo tú.» | no es de los que admite el servidor o no es entero |
| `no_cuadra_con_el_total` | **Base** | «La base, la cuota y el total no sumaban. Hemos dejado la base vacía: revisa las tres cifras en el ticket.» | ver ⚠️ 1 |
| `fecha_invalida` | Fecha | «La fecha que hemos leído no existe. Hemos dejado la de hoy: cámbiala si hace falta.» | ver ⚠️ 2 |
| `fecha_futura` | Fecha | «La fecha que hemos leído es posterior a hoy. Hemos dejado la de hoy: cámbiala si hace falta.» | ver ⚠️ 2 |
| `nif_invalido` | NIF del proveedor | «El NIF que hemos leído no es válido. Compruébalo en el ticket.» | ver ⚠️ 3 |
| `demasiado_largo` | Concepto, Nº de factura, Proveedor, NIF | «Lo que hemos leído es demasiado largo para este campo. Escríbelo tú.» | supera el máximo del campo |
| `no_es_texto` | Concepto, Nº de factura, NIF | «No hemos podido leer este dato. Escríbelo tú.» | el modelo devolvió algo que no es texto |

Y el bloque plegado «3 · Datos de la factura del proveedor», cuando la lectura descartó algo **dentro de él**, se abre solo y
su resumen dice (en vez de «Opcional»):

| texto | qué es |
|---|---|
| «Revisa 1 dato» · «Revisa N datos» | resumen del bloque plegado con descartes dentro (singular y plural, como «1 gasto») |

**Tres cosas que el ejemplo del comentario 16152 no decía y que cambian el texto** (medidas leyendo `sanearLectura`, no de
memoria):

1. ⚠️ **`no_cuadra_con_el_total` vacía la BASE, no el IVA.** El código descarta `baseAmount` cuando base + cuota ≠ total; la
   cuota se queda rellena y **puede ser ella la mal leída**. Por eso el texto no dice «el IVA no cuadraba» (dejaría creer
   que el IVA es lo que hay que corregir): dice qué se ha dejado vacío y manda revisar las tres cifras.
2. ⚠️ **La fecha NO queda vacía.** El formulario nace con la fecha de hoy (`exp-date`), así que «campo en blanco» no vale:
   el texto dice lo que hay («Hemos dejado la de hoy»). Un texto que dijera «escríbela» mentiría sobre lo que se ve.
3. ⚠️ **`nif_invalido` convive con la ayuda firmada del NIF.** Sin proveedor el campo está bloqueado y ya dice «Elige antes
   el proveedor: el NIF se guarda en su ficha.» (SCRUM-937). La línea nueva va debajo, y **se queda cuando se elige
   proveedor** (lo leído sigue sin ser válido). Es «no es válido… Compruébalo» como la ficha del cliente («Ese NIF/CIF no es
   válido. Compruébalo.»), para no tener dos formas de decir lo mismo. Es un hecho sobre el texto leído, no una afirmación
   fiscal; no dice nada de deducibilidad.

**Lo que NO se propone, a propósito:** ninguna línea para un campo `null` (no se leyó: sin dato del servidor no hay porqué
que dar; el hueco en blanco de siempre); ningún texto para los errores de la ruta (`lecturas_agotadas`, `ai_cuota_*`,
`ai_not_configured`, `imagen_*`…) ni para «no se leyó nada de esta foto»: son de 912 y de 920f, y se firman con la lectura.
Tampoco se enseña ningún veredicto del justificante (`medir.mjs` lo vigila también en este estado).

## La lista

| texto | qué es |
|---|---|
| «Todos · 9» · «Sin foto · 3» | los dos chips de la foto, con su cuenta |
| «Foto guardada» (con la miniatura) · «Sin foto» | la foto en cada fila (sin triángulo: 20-sep, cambio 2 del orquestador) |
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
| «La foto del ticket» | título de la tarjeta de la foto (era «El justificante»: 20-sep, cambio 1 del orquestador, «justificante» es un término fiscal) |
| «Ver a tamaño completo» · «Cambiar la foto» | acciones sobre la foto |
| «De este gasto no guardaste ninguna foto.» · «📷 Añadir la foto ahora» | el gasto sin foto |
| «Datos de la factura del proveedor» | título de la tarjeta; **sólo se pinta si hay alguno apuntado** |
| «Editar» · «Ver trabajo» | acciones de la cabecera. «Ver trabajo» **ya está firmado** (`btnVerTrabajo`, SCRUM-302): se reutiliza el literal exacto en vez de «Ver el trabajo». «Editar gasto» existe hoy como título del modal |
| «Sin trabajo» · «Este gasto no cuenta para el margen de ningún trabajo.» · «Vincular a un trabajo» | el gasto suelto |

## El «⋯» de la fila

| texto | qué es |
|---|---|
| «Editar» · «Ver la foto» / «📷 Añadir la foto» · «Ver trabajo» / «Vincular a un trabajo» | las opciones («Ver la foto» era «Ver el justificante»); «🗑 Eliminar» y su confirmación «¿Eliminar este gasto?» **ya existen** |

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
