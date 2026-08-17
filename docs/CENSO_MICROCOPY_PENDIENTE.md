# Censo de microcopy PENDIENTE — para aprobar (regla 30)

**Qué se midió:** todos los `[PENDIENTE …]` que hoy llegan a los ojos de alguien.
**Dónde:** `public/` (panel, landing, HTML) y `src/` (mensajes de API, correos, exportaciones).
**Rama:** `censo-marcadores-microcopy` · **Base:** `origin/main` = `a241b6e48c6553e453375bf705ca76ac3045ac0d` · **Fecha:** 17-ago-2026
**Instrumento:** `scripts/censo-marcadores.mjs` (AST, derivado del árbol) · **314 ficheros leídos**

> **Aquí no hay ni un texto propuesto.** Este documento dice **qué es** cada rótulo y **qué tiene que
> entender el profesional**. Escribirlo es tuyo (regla 30).

---

## El número, y por qué no es el que ya conocías

| | |
|---|---|
| Marcas **escritas** en el código | **47** |
| Superficies **pintadas** (lo que se ve) | **113** |
| Lo que declara el guard de SCRUM-402 | **38** |

> ⚠️ **CORREGIDO el 17-ago-2026, y el error era mío.** La primera versión de este documento decía
> **109** superficies y **«23 controles no dicen nada»**, y las categorías **no sumaban su total** —
> la tabla de debajo daba 35. Un censo cuyas partes no suman no es un censo, así que se recontó
> pieza a pieza. Tres huecos:
>
> * el modal de «Nueva factura» tiene **22** superficies, no 20: faltaban el **título del modal** y
>   la **etiqueta del botón de cerrar**, que salen los dos de la misma línea (`l.53`);
> * la ficha de **Clientes** tiene **4**, no 2: el selector de recargo son **tres opciones** dentro
>   de un solo literal, y el barrido contaba el literal, no las opciones;
> * los **«a ciegas» son 40**, no 23 — más 2 que llevan una pista dentro del corchete.
>
> Producto pasa de 71 a **75** y el total de 109 a **113**. El número de marcas escritas (47) no
> cambia: lo que estaba mal contado era lo que se VE, que es justo lo que hay que aprobar.

**Cuadra con SCRUM-402 en lo que él mide, y por eso el suyo no está mal:** su censo declara 38 marcas
en 17 ficheros del panel, y mi barrido ve exactamente 38 ahí. Su trinquete es correcto.

**La diferencia son dos cosas, y las dos ya se sospechaban:**

1. **Cuenta marcas escritas, no superficies pintadas.** Un bloque que guarda la marca en una constante
   y la concatena N veces cuenta **1** y pinta **N**. El caso extremo es el Libro de emitidas: **1**
   marca escrita, **23** rótulos en pantalla.
2. **Solo mira `public/dashboard/js`.** Hay **9 marcas más** en `src/` —mensajes de error de API,
   avisos fiscales, el LÉEME de la descarga de datos— que su censo no vigila.

> ⚠️ **Y hay un tercer nivel que no vi al primer intento**, y lo destapó tu propia observación sobre el
> Libro: la marca puede estar envuelta en una **fábrica de rótulos** (`function rotulo(t)`), así que
> hay que seguirla dos saltos, no uno. Sin eso contaba 1 donde hay 23.

**Suelo:** si el barrido devolviera cero marcadores o menos de 100 ficheros, el script **falla
declarándose ciego** en vez de decir «está todo aprobado». Tu control positivo son los que has visto
con tus propios ojos: el formulario de presupuesto, los botones del justificante y el Libro. Los tres
salen abajo.

---

## 🔴 Lo primero, si solo vas a mirar una cosa

**40 controles no dicen absolutamente nada.** Su texto es la marca **y nada más**: el profesional ve
un botón que pone `[PENDIENTE microcopy oficial]` y no puede deducir qué hace. En el resto, la marca
va **delante** de un texto legible, así que al menos se entiende y se puede juzgar.

| Dónde | A ciegas | Líneas |
|---|---|---|
| Nueva factura (modal) — el formulario entero | **22** | 44 · 53 (×2) · 77 · 78 · 85 · 97 · 108 · 134 · 135 · 140 · 141 · 146 · 147 · 152 · 153 · 159 · 169 · 179 · 212 · 216 · 221 |
| Detalle de factura / justificante — botones de acción | **8** | 273 · 282 · 363 · 448 · 472 · 513 · 550 · 640 |
| Trabajo → revisión inicial | **4** | 2432 · 2439 · 2461 · 2472 |
| Exportar → botón del libro, estado vacío y error | **3** | 314 · 331 · 334 |
| Configuración → modo de emisión (solo el respaldo) | **2** | 213 · 219 |
| Facturas (lista) → botón de nueva factura | **1** | 172 |
| **Suma** | **40** | |

Y **2 más** que no llevan rótulo pero sí una **pista dentro del corchete**, así que se leen a medias:
`customersView.js:192` (recargo de equivalencia) y `settingsView.js:291` (criterio de caja).

---

# PARTE 1 · PRODUCTO — 75 superficies (las apruebas tú)

## A · Nueva factura (modal) — 22 · `nuevaFacturaModal.js`

**Toda la pantalla está sin rotular.** Es el caso más grave: no hay ni un texto legible en el modal
entero. La constante es `NF_PENDIENTE` (l.20).

⚠️ El botón principal **sí** tiene texto aprobado —`Emitir factura` (`NF_ACCION_PRIMARIA`, l.30)— y
por eso no sale aquí. Lo que falta de él es solo lo que pone **mientras** emite (l.212).

| Línea | Qué es | Qué hace / qué se escribe ahí |
|---|---|---|
| 53 | **Título del modal** | Anuncia que se va a crear una factura nueva desde cero |
| 53 | Etiqueta del botón **✕** de cerrar | Cierra el modal sin emitir nada |
| 77 | Placeholder del buscador de cliente | Se teclea el nombre para filtrar entre sus clientes |
| 97 | Opción vacía del desplegable de cliente | «Ninguno elegido todavía» |
| 108 | Mensaje de error | La **lista de clientes** no se ha podido cargar |
| 134 | Placeholder de «concepto» | Qué se factura en esa línea |
| 140 | Placeholder de «cantidad» | Cuántas unidades. Viene con `1` puesto |
| 146 | Placeholder de «precio» | Precio por unidad, **sin IVA** |
| 152 | Placeholder de «IVA» | El tipo **en porcentaje** (viene con `21`) |
| 169 | Botón | Añade otra línea a la factura |
| 179 | Botón secundario | Cierra sin emitir. No se cierra al tocar el fondo: solo con esto o Escape |
| 212 | Estado **transitorio** del botón principal | Lo que pone mientras se está emitiendo |
| 216 | Aviso emergente tras emitir | Confirma que la factura ya está emitida |
| 221 | Mensaje de error al emitir — **solo el respaldo** | Que la factura **no** se ha emitido. Si el servidor manda motivo propio, se muestra ése |
| 44 | `aria-label` del diálogo | Lo que oye un lector de pantalla al abrirse |
| 78 · 85 · 135 · 141 · 147 · 153 · 159 | `aria-label` de buscador, desplegable, concepto, cantidad, precio, IVA y botón ✕ de la línea | Lo mismo que su campo visible, en voz. El ✕ de quitar línea **solo** tiene esto |

## B · Detalle de factura / justificante — 8 botones · `invoiceDetailView.js`

Los que viste. **Ninguno dice qué hace.** El registro de acciones decide dónde va cada botón; el
rótulo es lo único que falta.

| Línea | Qué es | Qué tiene que entender el profesional |
|---|---|---|
| 273 | Botón | Que descarga el documento en PDF |
| 282 | Botón | Que se lo manda al cliente por WhatsApp |
| 363 | Botón (acción primaria en `pending`) | Que marca la factura como cobrada |
| 448 | Botón | Que abre la incidencia de un pago reclamado por el cliente |
| 472 | Botón | Que pide el cobro por Bizum |
| 513 | Botón | Que manda un recordatorio de pago |
| 550 | Botón | Que emite una **rectificativa** — no edita ni borra la original (regla 29) |
| 640 | Botón | Que vuelve a generar el documento |

## C · Presupuesto, formulario — 4 títulos · `quotesView.js`

Los que viste: «1. Cliente», «2. Líneas», «3. Condiciones», «4. Envío». **Aquí la marca va delante y
el texto se lee**, así que lo que falta es bendecir el texto o cambiarlo.

| Línea | Qué es | Texto que ya está detrás de la marca |
|---|---|---|
| 352 | Título de bloque del formulario | `1. Cliente` |
| 360 | Título de bloque | `2. Líneas` |
| 368 | Título de bloque | `3. Condiciones` |
| 376 | Título de bloque | `4. Envío` |

> 🟢 **Hermanas ya aprobadas:** los nueve rótulos de los submenús de Configuración —`Empresa`,
> `Facturación`, `Cobros`, `Avisos`, `Tu página pública`, `Marca`, `Tus datos`, `Cumplimiento`,
> `Equipo`— los aprobaste el 5-ago-2026. Son el mismo tipo de pieza: nombre corto de sección.

## D · Presupuesto, acciones — 12 rótulos · `quoteActionsRegistry.js` (l.64-75)

Todos con texto legible detrás de la marca. **Se pueden aprobar en bloque.**

`Enviar a aprobación` · `Enviar al cliente` · `Aprobar` · `Recordar al cliente` · `Crear trabajo` ·
`Duplicar` · `PDF` · `Editar líneas` · `WhatsApp` · `Ver cliente` · `Marcar como rechazado` · `Borrar`

## E · Trabajo → revisión inicial — 4 · `jobDetailView.js`

| Línea | Qué es | Qué tiene que entender el profesional |
|---|---|---|
| 2432 | Línea de estado | Si la revisión inicial ya se puede decidir o falta algo |
| 2439 | Etiqueta de campo | Qué se le pide rellenar |
| 2461 · 2472 | Mensajes de error | Que la revisión **no** se ha guardado, y por qué |

## F · Configuración — 10 · `settingsView.js`

| Línea | Qué es | Qué tiene que entender el profesional |
|---|---|---|
| 291 | Etiqueta de campo (**a ciegas**) | Que ahí declara si factura por criterio de caja |
| 299 · 300 · 301 | Tres opciones del selector | «no lo ha dicho» · «sí» · «no» — hoy llevan pista entre corchetes |
| 372 → l.387, 388, 405 | Etiqueta + 2 opciones del selector de **retención de IRPF** | Que declara su tipo de retención; y que «no lo he dicho» y «no retengo» son cosas distintas |
| 560/561 | Aviso | Que sin móvil de Bizum su cliente no ve esa forma de pago |
| 213 · 219 | Píldora y detalle del modo de emisión (**solo el respaldo**) | Solo se pinta si el modo no está en la lista conocida |

> ⚠️ Los rótulos de los **tipos** de retención (`15 %`, `7 %`…) **no** llevan marca y no la llevarán:
> salen del dominio, y ahí un porcentaje es el dato, no microcopy.

## G · Clientes — 4 · `customersView.js`
| 192 | Etiqueta de campo (**a ciegas**) | Que ahí declara si el cliente está en recargo de equivalencia |
| 196 | Opción del selector | Que no consta el régimen de ese cliente |

## H · Exportar / descargas — 4 · `exportView.js`
| 31 | Texto dentro de la tarjeta | Qué se descarga y en qué formato |
| 314 | Botón (**a ciegas**) | Qué descarga |
| 330/331 | Estado vacío | Que no hay facturas en ese periodo — **no** que no haya facturado nunca |
| 334 | Aviso de error | Que la descarga ha fallado y puede reintentar |

## I · Facturas (lista) — 2 · `invoicesView.js`
| 18 | Aviso | Ya trae texto: que se marcaron como pagadas pero la lista puede tardar en reflejarlo |
| 172 | Estado / rótulo corto | Distinguir «no hay facturas» de «no se han podido cargar» |

## J · Productos — 1 · `productsView.js:611`
Fragmento dentro de una línea de detalle del producto.

## K · Albarán — firma — 2
| `albaranDetailView.js:27` | Mensaje de error | Que el servidor **rechazó** la firma — la firma no ha quedado guardada |
| `signaturePad.js:402` | Mensaje de error | Que la firma no se ha enviado |

## L · Suplido (editor de líneas) — 2 · `quoteSuplido.js`
| l.92 | Rótulo de la línea | Ya trae texto: `Suplido · sin IVA` |
| l.46 | Aviso | Que marcar como suplido un material propio es un **error fiscal**: un suplido se paga en nombre del cliente y no lleva IVA |

---

# PARTE 2 · 🔴 FISCAL Y LEGAL — 38 superficies (NO son microcopy de producto)

> **Estos afirman un hecho fiscal o legal.** Varios los dictamina el asesor, no tú: decirle a un
> profesional qué régimen le toca o qué significa un asiento **es asesorar**. Van aparte a propósito.

## M · Libro de facturas emitidas — 23 · `libroRegistroView.js`  🔴 FISCAL

El que viste: **título, subtítulo y todas las cabeceras**. Una sola marca escrita, 23 rótulos
pintados, todos por la fábrica `rotulo()` (l.43). Todos llevan texto legible detrás.

| Qué es | Rótulos |
|---|---|
| Título de pantalla | `Libro de facturas emitidas` |
| Entrada de menú | `Libro de registro` |
| Recuento | `N asientos` |
| **Cabeceras de la tabla** (8) | `Número` · `Fecha` · `Tipo` · `Base` · `IVA` · `Total` · `Estado` · `De dónde viene y dónde acabó` |
| **Trazas** (6) | `Presupuesto firmado` · `Presupuesto sin firmar` · `Albarán` · `Cobro` · `Albarán posterior al sello` · `Factura suelta` |
| Error de carga | 1 |
| **Los dos vacíos, que existen para NO decir lo mismo** | `Todavía no has emitido ninguna factura.` **frente a** el aviso de que el libro **no cuadra** — que no debe leerse como «no has facturado» |
| Avisos (3) | importes ilegibles (que no se tomen por cero) · facturas de otro negocio descartadas · facturas sin número que no salen como asiento |

## N-W · El resto del terreno fiscal y legal — 15

| Dónde | Qué es | Qué afirma / qué debe entender |
|---|---|---|
| `semaforoFiscal.js:37` → l.90 | Aviso del semáforo — marcado **`[PENDIENTE ASESOR]`**, no «microcopy oficial» | Ya está declarado como dictamen del asesor. **No es tuyo** |
| `modelo303.ts:92` → l.249 | Aviso obligatorio del resumen | Ya trae texto: que es orientativo y lo consulte con su asesor |
| `librosAeat.ts:52` | Marca `[PENDIENTE]` en los libros para la AEAT | Terreno fiscal — al asesor |
| `criterioCaja.ts:77` | Aviso | Ya trae texto: que el estado de cobro dice que alguien marcó la factura como cobrada |
| `albaranes.routes.ts:1081` → 1114, 1117, 1134, 1171, 1270, 1277 (**6**) | Mensajes de rechazo (409) al facturar un albarán | Seis motivos distintos comparten **un solo mensaje**: albarán sin firmar · ya facturado · facturación no disponible (×3) · fallo al sellar. Hoy el profesional no puede saber cuál le ha tocado |
| `invoicesAdmin.routes.ts:858` → l.894 | Mensaje de rechazo (409) al rectificar o anular | Por qué no se puede, sin sugerir que se edite la original (regla 29) |
| `portabilidadCompleta.ts:201` | **LÉEME** del ZIP de descarga de datos (RGPD) | Qué contiene el paquete y qué puede hacer con él |
| `albaranFirmante.ts:43` → l.269 | Respaldo de la etiqueta de «en calidad de» del firmante | Solo se pinta si la calidad no está en la lista conocida — **una etiqueta falsa aquí es peor que ninguna** |
| `jobDireccion.ts:50` | Mensaje de error | Ya trae propuesta: que no se puede añadir la dirección a ese trabajo |
| `puertaClienteReal.ts:153` | Aviso **interno, para ti** — no lo ve el profesional | Se incluye para que el censo cuadre, no para aprobarlo |

---

## Cómo suman

| Grupo | Superficies |
|---|---|
| Parte 1 · Producto (A–L) | **75** |
| Parte 2 · Fiscal y legal (M–W) | **38** |
| **Total** | **113** |

Y por clase de marca escrita: `constante` 15 + `pintado a ciegas` 11 + `marca sola en un valor` 12 +
`marca con texto` 9 = **47**. Las dos cuentan cosas distintas y **las dos cuadran**: 47 sitios donde
está escrita la marca, 113 sitios donde se lee.

## Lo que este censo NO dice

* **No propone ni un texto.** Es la regla 30 y es tuya.
* **No mide si un rótulo es bueno**, solo si está aprobado. Los que ya llevan texto legible detrás de
  la marca pueden estar bien tal cual — hace falta que lo digas.
* **Los `aria-label`** cuentan como superficie aunque no se vean: quien usa lector de pantalla oye la
  marca en voz alta. Si prefieres tratarlos aparte, son los 8 de la sección A.
