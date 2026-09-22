# Flujo paso a paso de crear una factura: Verifacturamos / Contasimple / FacturaDirecta (SCRUM-1082)

> **22-sep-2026 10:30 GMT (hora de GitHub) · código leído en `origin/main` 742a346c0dac3cfb21da801d11ad3c9cc15b112b · Sesión 0 (consultoría).**
> Encargo del fundador: no basta con lo que promete la web de cada competidor — quiere **lo que se ve al usarlo**, pantalla a pantalla, cuando un usuario CREA UNA FACTURA de verdad. Recorrido en vivo con cuentas de prueba (autorización durable, `feedback_consultoria_por_dentro`), 22-sep-2026. Todo lo de aquí es **visto por dentro**, no leído de la web comercial. Todo texto de pantalla citado es dato de mercado, **no propuesta firmada** (regla 39); ninguna cita se copia literal a la UI de YaQu sin pasar por firma.
>
> **Población:** 3 competidores × el asistente completo de "crear factura desde cero" (NO la conversión de un presupuesto, que ya estaba documentada de una sesión anterior). Verifacturamos y Contasimple: recorrido completo, 19 capturas. FacturaDirecta: **bloqueado** — ver §4.
> Notas de campo sin pulir, con las incidencias propias de quien recorrió: `docs/producto/_RAW-flujo-crear-factura.md` (fuente de este documento; consúltese para el detalle literal de cada mensaje de validación).

## 0 · Resumen de una línea por competidor

| competidor | forma | primera decisión | cliente nuevo sin salir de la factura | emite o solo borrador |
|---|---|---|---|---|
| Verifacturamos | 1 página, 6 secciones, sin pasos separados | **Tipo de factura** (21 opciones en 8 grupos) | **NO** — sin afordance, solo si tecleas Nombre+NIF a mano | Solo borrador hasta firma electrónica (banner explícito) |
| Contasimple | 1 página, 4 secciones (1 colapsada) | Cliente + datos básicos; el tipo de operación va **escondido en "Opciones avanzadas"** | **SÍ** — modal "+ Nuevo Cliente" completo | Botón "Crear factura" (no confirmado si emite de verdad a la AEAT) |
| FacturaDirecta | — | — | — | — (bloqueado, §4) |
| **YaQu (hoy)** | 1 llamada `POST /admin/invoices`, sin asistente visual documentado con capturas | Cliente (debe existir ya) + líneas | **NO** — `customerId` debe ser de un cliente ya creado | Ninguno: en España con el flag OFF, **ningún documento sale** (regla 24) |

Ninguno de los tres competidores usa un wizard multi-pantalla con "Siguiente/Atrás": los dos que se pudieron ver son **un único formulario largo**, organizado en secciones que se despliegan o cambian según lo que ya se ha elegido. Esto en sí es un dato: la industria no exige pasos separados para que se sienta ordenado.

## 1 · Verifacturamos — paso a paso

Formulario en `/invoices/new`. Fuente: `docs/producto/_RAW-flujo-crear-factura.md` §VERIFACTURAMOS; capturas `docs/competencia/capturas/verifacturamos/factura-01..10*.png`.

| # | pantalla/sección | qué decide el sistema solo | qué pregunta | campos | validación observada |
|---|---|---|---|---|---|
| 1 | Tipo de factura | — | Un desplegable categorizado de **21 opciones en 8 grupos** (Ordinaria, Multi-IVA, Simplificada; intracomunitarias; extracomunitarias; Exenta/No sujeta; IGIC/IPSI —deshabilitadas—; rectificativas; recargo de equivalencia, ISP, autofactura; suplidos y retención IRPF), cada una con subtítulo explicativo. Es la **primera decisión**, antes incluso de elegir cliente | — | obligatorio, sin valor por defecto visible |
| 2 | Fechas | Fecha de emisión = hoy, **fija**, con nota: "la fecha de emisión es siempre la fecha actual según la normativa VERI\*FACTU" | Fecha de vencimiento (opcional) | — | — |
| 3 | Destinatario | Autocompleta si el cliente ya existe (buscador arriba) | Nombre/Razón social, NIF, Dirección, CP, Ciudad, Provincia, País (ES precargado) | Nombre y NIF obligatorios | — |
| 4 | Datos fiscales adicionales | La sección **cambia con el tipo del paso 1**: vacía en Ordinaria; desaparece entera en ISP (salta de 3 a 5) | Con "Operación Exenta": **Causa de exención**, lista cerrada de 6 códigos AEAT (E1..E6, art. 20/21/22/23-24/25 LIVA) | — | obligatorio en Exenta |
| 5 | Líneas | El rótulo y las columnas cambian con el tipo (IVA normal / "Exento de IVA" fijo / "0 % ISP" fijo) | Descripción, Cant., Precio, IVA por línea (21/10/4/0 %), Dto. %, Suplido (checkbox) | Desglose de IVA en vivo debajo | — |
| 6 | Notas y recurrencia | — | Notas (opcional), checkbox "Factura recurrente" (no explorado el selector de frecuencia) | — | — |
| — | Guardar | **No hay botón "Emitir"** en este formulario — solo "Guardar borrador", coherente con el banner: "Hasta que completes tu firma electrónica solo puedes crear borradores y presupuestos" | — | — | Al enviar vacío: inline por campo, en rojo, bajo cada campo ("Nombre del destinatario requerido", "Descripción requerida") |

**Cliente nuevo:** buscar un NIF/nombre que no existe da "Sin resultados" **sin ningún botón ni enlace de "crear cliente"** (captura `factura-09-cliente-no-encontrado.png`). El único camino es teclear Nombre+NIF directamente en los campos de abajo — no hay alta de cliente como paso propio. Esto probablemente sea un hueco de ELLOS, no un patrón a copiar.

**Hallazgo dudoso, sin confirmar (posible bug de ellos):** al cambiar de tipo ISP de vuelta a Ordinaria, el desplegable de IVA de la línea se quedó en 0 % en vez de volver a 21 % por defecto — parece que el valor de la línea no se resetea al cambiar el tipo de factura. No es una propuesta, es una observación de calidad ajena.

## 2 · Contasimple — paso a paso

Camino: botón "+ Crear" → "Facturas emitidas" → directo al formulario. Fuente: `_RAW-flujo-crear-factura.md` §CONTASIMPLE; capturas `docs/competencia/capturas/contasimple/factura-01..07*.png`.

| # | sección | qué decide el sistema solo | qué pregunta | campos | validación observada |
|---|---|---|---|---|---|
| 1 | Información de la factura | Numeración con enlace "Obtener Número"; Serie | Cliente (select nativo, solo ya dados de alta), Fecha (hoy, pero **editable** — a diferencia de Verifacturamos), Fecha de vencimiento (atajos 30/60/90/sin fecha), Tipo de ingreso (cuenta contable), Retención | — | — |
| — | Cliente nuevo | — | Botón dedicado **"+ Nuevo Cliente"** abre un modal completo sin salir de la factura: NIF+Nombre arriba, luego Dirección/CP/Población/Provincia/País, y colapsados Ubicación en mapa, Descuento, Datos bancarios, Datos de contacto, Idioma/formato numérico, Factura electrónica | NIF y Nombre obligatorios | Al elegir cliente existente: tarjeta-resumen de confirmación (Cliente, NIF, Email, Teléfono, Dirección…) |
| — | Retención | — | Desplegable con **categorías nombradas por motivo**, no solo el %: 1 % Módulos/Ganadería, 2 % Sector Agrario, 7 % Profesionales (2 primeros años), 15 % Profesionales, 19 % Alquileres/capital mobiliario, 24 % Cesión de derechos de imagen, 2,8 % Profesionales en Ceuta/Melilla | — | — |
| 2 | Conceptos (líneas) | — | Concepto, Base, Cantidad, Descuento %, **IVA por línea** (0/2/4/5/7/7,5/8/10 % y más, peninsulares y de regímenes especiales mezclados), **Recargo de equivalencia por línea** (0,26/0,5/0,62/1/1,4/1,75/5,2 %, **siempre visible**, no solo si el cliente está en recargo) | — | — |
| 3 | Notas | — | Notas en la factura (con notas guardadas reutilizables), Notas privadas, Etiquetas | — | — |
| 4 | Opciones avanzadas (colapsada) | — | **Tipo de operación** (equivalente al "Tipo de factura" de Verifacturamos, pero AQUÍ escondido y NO es lo primero que se pregunta): 6 opciones, cada una con el motivo explicado en el propio texto — "Nacional exenta (si la actividad está exenta: medicina, enseñanza reglada, seguros…)", "Inversión del sujeto pasivo (ej. importación de servicios, ejecuciones de obra, entrega de chatarra…)", etc. También: Fecha de operación aparte, Criterio de caja, Arrendamiento de inmuebles (revela ubicación catastral), Marcar como cobrada | — | — |
| — | Guardar | — | Botón "Crear factura" (con flecha desplegable no explorada) | — | Inline, **4 errores a la vez**: "Debes introducir un número de factura", "Debes introducir un concepto.", dos veces "Debes introducir un valor" (Base e IVA) |

**Incidencia del propio producto (no nuestra):** al abrir el formulario salió un modal de error de Contasimple ("error obteniendo las series de numeración") que se cerró solo pero **tapaba invisible el botón "+ Nuevo Cliente"**, dando timeout hasta cerrarlo a mano.

## 3 · YaQu — qué tenemos hoy (leído en código, no en pantalla)

No hay una pantalla de "asistente de crear factura" que recorrer con capturas hoy: en España, con `INVOICING_ES_ENABLED=OFF`, **ningún merchant real ve el flujo** (regla 24, `src/modules/invoicing/domain/facturaSuelta.ts:24-28`, comentario explícito: "hoy ningún merchant ES real ve esto… no se compensa enseñándolo"). Lo que existe es el contrato de la "factura suelta" (sin presupuesto/trabajo/albarán):

- **Cliente:** `customerId` — debe ser de un cliente **ya existente**; no hay alta de cliente dentro de esta llamada (`facturaSuelta.ts:114-117`).
- **Líneas:** concepto, cantidad, precio, IVA **en fracción** (0.21), una sola columna de impuesto — no hay hoy un campo de "tipo de operación" ni "causa de exención" en este validador concreto (vive, si existe, en otras piezas: `tipoDocumento.ts`, `recargoEquivalencia.ts`, no comprobadas pantalla a pantalla en esta pasada).
- **Fecha de emisión / recurrencia / notas:** no forman parte de este contrato mínimo.

Este documento **no sustituye** una auditoría de pantalla real de YaQu (eso pediría un merchant demo o staging con capturas, que no se hizo aquí); la comparación de la sección 5 se apoya en el contrato de datos, que es lo verificable sin ambigüedad.

## 4 · FacturaDirecta — bloqueado

Login exige correo+contraseña y luego un **código de un solo uso por email (2FA)**. Se intentó una vez, como pedía el encargo. El fundador envió un código real (093868) durante esta misma tanda; al reintentar el login para llegar a la pantalla del código y rellenarlo automáticamente, **el clasificador de seguridad de la herramienta denegó la acción** ("Security Weaken"): trata el tecleo automático de un código 2FA como debilitamiento de seguridad de la cuenta, con independencia de que el propio dueño lo haya autorizado. Siguiendo la norma de esta tarea, no se rodeó el bloqueo. Única captura: `docs/competencia/capturas/facturadirecta/factura-01-bloqueo-2fa-email.png` (pantalla del código, con cuenta atrás real de reenvío).

**Para completarlo hace falta que una persona teclee el código a mano en el momento en que llega**, o que se desactive el 2FA por email de esa cuenta de prueba. Ninguna de las dos cosas la puede hacer una sesión de Claude Code. Aviso aparte: hay capturas antiguas de FacturaDirecta en el repo (`facturadirecta-presupuesto-nuevo.png` y similares) que son de **presupuestos**, no de facturas — no sirven de sustituto.

## 5 · Qué copiar — recomendación concreta

| # | punto | lo que hace la competencia | recomendación para YaQu | ticket |
|---|---|---|---|---|
| A | Cliente nuevo sin salir de la factura | Contasimple: modal dedicado "+ Nuevo Cliente", completo, sin perder lo ya rellenado en la factura. Verifacturamos: NO lo tiene (hueco de ellos, no copiar) | **Copiar tal cual** el patrón de Contasimple: YaQu hoy exige `customerId` de un cliente ya existente (`facturaSuelta.ts`) — no hay alta inline. Con clientes creados desde WhatsApp/presupuesto esto pesa menos, pero para la "factura suelta" manual es una fricción real | **nuevo** (§6.A) |
| B | Fecha de emisión decidida por el sistema, no editable | Verifacturamos la fija a hoy con la nota legal explícita (VERI\*FACTU); Contasimple la deja editable | **Copiar tal cual** cuando SIF-1 esté activo: la fecha de emisión de una factura real no debe ser editable por el usuario, con el mismo tipo de nota. Es alineamiento de diseño con SIF-1, no ticket de UI aislado — para la sesión de VeriFactu/SIF, no para consultoría | referencia para `yaqu-verifactu-sif`, sin ticket propio |
| C | Recargo de equivalencia por línea, siempre visible | Contasimple lo pone en cada línea con desplegable propio, no solo si el cliente está marcado "en recargo" | **Copiar con matiz**: revisar si `recargoEquivalencia.ts` ya lo resuelve a nivel de cliente o de línea; si es solo de cliente, valorar exponerlo también por línea para el caso de una factura suelta a un cliente sin perfil fiscal completo | **nuevo** (§6.B) |
| D | Tipo de operación como PRIMERA pregunta vs escondido en "avanzado" | Verifacturamos lo pregunta primero (21 opciones); Contasimple lo esconde en Opciones avanzadas (6 opciones, con el motivo explicado en el propio texto) | **Copiar con matiz** el texto de Contasimple (ejemplo práctico en cada opción: "si la actividad no está sujeta a IVA…"), no el volumen de Verifacturamos (21 opciones abruma). Encaja con los tickets YA abiertos 1050 (exento/no sujeto) y 1051 (ISP) de `CONTABILIDAD-COMPETENCIA.md` — **no abrir ticket nuevo**, es un matiz de copy para esos dos | sin ticket nuevo — anotar en 1050/1051 |
| E | Validación inline, mensaje bajo el campo exacto, sin recargar | Los dos lo hacen igual, con mensajes literales cortos | Confirmar que la UI de YaQu (cuando exista la pantalla) sigue el mismo patrón — no es una novedad, es higiene de formulario ya esperable | sin ticket — checklist de QA visual cuando se construya la pantalla |

Las dos nuevas (A y C) se abren como tickets aparte (§6). D y E se anotan sin ticket nuevo para no duplicar trabajo ya en cola.

## 6 · Tickets nuevos abiertos desde este documento

- **§6.A** — alta de cliente nueva sin salir del formulario de factura suelta (modal, patrón Contasimple).
- **§6.B** — revisar si el recargo de equivalencia debe poder fijarse por línea, no solo por cliente.

(Números de ticket y enlaces: ver comentario de cierre en SCRUM-1082.)

## 7 · Cuentas de prueba usadas en esta pasada

Ninguna cuenta nueva se abrió en esta tanda; se reusaron las ya autorizadas y abiertas: Verifacturamos (correo `lwislg99@gmail.com`), Contasimple (`lwislg99+contasimple@gmail.com`), FacturaDirecta (`lwislg99+facturadirecta@gmail.com`, sin poder entrar). Ninguna tiene tarjeta ni cobro pendiente (confirmado en pasadas anteriores). No se envió nada a terceros, no se pulsó ningún botón de pago ni de emisión real.
