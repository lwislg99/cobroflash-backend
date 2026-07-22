# Investigación exhaustiva y propuesta técnica: el módulo de albaranes/partes de trabajo definitivo para YaQu

> **Nota de método.** Se distingue en todo el documento entre **[DATO VERIFICADO]** (norma, consulta DGT, jurisprudencia o documentación oficial de producto contrastada en la investigación) e **[INTERPRETACIÓN]** (deducción del autor para diseño de producto). El BLOQUE 4 (propuesta) es mayoritariamente [INTERPRETACIÓN] construida sobre datos verificados. Al final hay un apartado de **Advertencias para asesor fiscal** con los puntos que NO deben implementarse sin validación profesional.

---

## TL;DR
1. **El valor del módulo no está en "hacer albaranes bonitos", sino en la máquina de conversión albarán→factura con validaciones fiscales.** El albarán no tiene validez fiscal ni es obligatorio, pero el albarán **firmado** es prueba de entrega/ejecución con relevancia probatoria en un monitorio, y la agrupación en **factura recapitulativa** (art. 13 RD 1619/2012) obliga a respetar el **mes natural** y el **mismo destinatario**. Tratar el "mes natural" como **campo de rotura automático** que parte facturas es la pieza técnica diferencial y la que evita sanciones (art. 201 LGT).
2. **Hay un hueco real de mercado.** El software español clásico (Factusol, Sage, Holded, Odoo) domina la conversión masiva por rangos/roturas pero es de escritorio/oficina y con firma pobre; el field service internacional (Jobber, Housecall Pro, ServiceM8) domina la UX móvil, firma y fotos, pero **no cumple la fiscalidad española de recapitulativas ni el concepto de albarán sin importes**. **Nadie combina firma remota por WhatsApp con valor probatorio + distinción automática "operaciones sueltas (recapitulativa)" vs "trabajo largo (factura al concluir)" + conversión con validaciones legales de mes natural/IVA/cliente.**
3. **Prioriza así:** Fase 1 (paridad, "acerca a clientes pagando"): conversión individual/múltiple/parcial + estados + PDF legalmente impecable + firma WhatsApp. Fase 2 (diferenciación): motor de recapitulativa con rotura por mes natural + asistente "un trabajo vs varios trabajos". Fase 3 (lujo): IA de partes por voz/foto y OCR de albaranes de proveedor.

---

## Hallazgos clave

**Marco legal (todos [DATO VERIFICADO]):**
- **Albarán:** no regulado en la legislación mercantil; es un "uso de comercio". No obligatorio, sin validez fiscal ni siquiera valorado. Su firma por el receptor es su principal valor probatorio.
- **Recapitulativa — art. 13.2 RD 1619/2012 (texto literal, BOE-A-2012-14696):** *"Estas facturas deberán ser expedidas como máximo el último día del mes natural en el que se hayan efectuado las operaciones... cuando el destinatario de éstas sea un empresario o profesional que actúe como tal, la expedición deberá realizarse antes del día 16 del mes siguiente a aquél en el curso del cual se hayan realizado las operaciones."* Art. 13.1: *"Podrán incluirse en una sola factura distintas operaciones realizadas en distintas fechas para un mismo destinatario, siempre que las mismas se hayan efectuado dentro de un mismo mes natural."* La DGT recuerda que **la excepción del día 16 NO aplica a particulares** (deben facturarse dentro del mes natural).
- **Sanciones — art. 201 Ley 58/2003 (LGT), texto literal:** multa proporcional del **1%** del conjunto de operaciones (incumplimiento de requisitos), **2%** por falta de expedición/conservación (**300 € por operación** si no se conoce el importe), **75%** por facturas con datos falsos/falseados, e incremento de la cuantía en un **100%** si hay **"incumplimiento sustancial"** (definido en art. 187.1.c LGT como el que afecta a **más del 20%** de las operaciones). En la práctica, esto convierte el 1%/2% en 2%/4%.
- **Devengo:** servicios de tracto único → al concluir la prestación; ejecución de obra con aportación de materiales → puesta a disposición del dueño de la obra; anticipos → al cobro (art. 75 LIVA). La DGT (V1659-25, 16/09/2025) confirma que servicios de asesoría/abogacía **no** son tracto sucesivo: devengo al finalizar o al cobrar anticipos, y **la fecha de la factura no determina el devengo**.
- **Firma electrónica:** eIDAS (Reglamento UE 910/2014) + Ley 6/2020. Art. 25.1 eIDAS: *"No se denegarán efectos jurídicos ni admisibilidad como prueba... a una firma electrónica por el mero hecho de ser una firma electrónica o porque no cumpla los requisitos de la firma electrónica cualificada."* La firma en canvas es firma simple/avanzada según las evidencias que se capturen.
- **VeriFactu:** obligatorio el **1 de enero de 2027** para contribuyentes de Sociedades y el **1 de julio de 2027** para el resto (autónomos IRPF, IRNR con EP, entidades en atribución), tras el aplazamiento del **Real Decreto-ley 15/2025, de 2 de diciembre** (BOE 3-dic-2025, convalidado el 11-dic-2025); los **desarrolladores de software debían estar adaptados desde el 29 de julio de 2025** y 2026 es periodo de pruebas voluntario.
- **Factura electrónica B2B:** Ley 18/2022 (Crea y Crece), desarrollada por el **RD 238/2026, de 25 de marzo** (BOE 31-mar-2026); según el proyecto de Orden ministerial en audiencia pública, la obligación apunta al **1 de octubre de 2027** para empresas con facturación >8 M€ y al **1 de octubre de 2028** para el resto.
- **Morosidad:** Ley 3/2004; monitorio (arts. 812 ss LEC), sin límite de cuantía, admite albaranes de entrega como principio de prueba. Contexto de mercado: **España es el país europeo con mayor índice de pagos fuera de plazo entre empresas, con una media de 95 días en 2024 según el INE** (dato citado en análisis de la Ley Crea y Crece). Esto hace del albarán firmado un activo comercial, no solo administrativo.

**Producto:** el patrón universal del sector es documento-base → conversión → factura, con estados **pendiente/parcial/facturado**. El diferencial competitivo está vacío en la intersección WhatsApp-first + fiscalidad española correcta + IA.

---

## Detalles

## BLOQUE 1 — Marco legal y fiscal completo del albarán

### 1.1 Naturaleza jurídica y valor probatorio [DATO VERIFICADO]
El albarán (nota de entrega / parte de trabajo) **no aparece regulado en la legislación mercantil**; constituye un "uso de comercio" que agiliza el tráfico. No existe normativa que le exija un contenido mínimo (a diferencia de la factura). En consecuencia:

- **No tiene validez fiscal** (tampoco el valorado) y **su emisión no es obligatoria**. Sirve como justificante de la entrega o de la prestación.
- **Valor en juicio:** la jurisprudencia menor es constante. Como documento privado emitido unilateralmente, **no tiene fuerza probatoria plena si el deudor lo niega**, pero **no se le priva de toda eficacia**: se valora conjuntamente con el resto de prueba (testifical, pericial, reconocimiento de la relación comercial). Referencias localizadas:
  - **AP León, Sentencia 19/12/2005:** reconoce que es "práctica mercantil ordinaria" que el albarán lo firmen empleados o dependientes del receptor, y que la simple negación de firma no basta para eludir el pago.
  - **AP Madrid, 14/06/2005:** "la falta de reconocimiento de los albaranes y facturas aportados no les priva radicalmente de eficacia si existen en autos elementos de juicio…".
  - **AP Huelva, 12/04/2019** y **AP Zaragoza, 10/02/2015:** doctrina de eficacia probatoria aunque no sean reconocidos, dentro de la valoración conjunta.
  - Caso contrario (advertencia): existe jurisprudencia que **niega valor a un albarán cuando se acredita que la firma es falsa** (recogido en repertorios de vLex). Es decir: la fortaleza probatoria depende de la **autenticidad e integridad de la firma**.

**[INTERPRETACIÓN]** Para YaQu esto es capital: el objetivo del producto no es que el albarán "valga como factura" (no puede), sino **maximizar su valor probatorio** capturando evidencias que resistan la negación de firma: sellado de tiempo, identificador del firmante, trazabilidad del token, geolocalización opcional, fotos con metadatos y hash del PDF.

### 1.2 Contenido recomendado para que tenga valor probatorio [DATO VERIFICADO + INTERPRETACIÓN]
Aunque no hay contenido mínimo legal, la práctica y las guías profesionales recomiendan: rótulo visible "ALBARÁN / NOTA DE ENTREGA" (no "factura"), número de serie propia, fecha de emisión, identificación de emisor y receptor (nombre/razón social, NIF, domicilio), descripción de bienes/servicios con cantidades, lugar y fecha de entrega, y **firma del receptor**. Es recomendable indicar el precio (sin impuestos) "para evitar equívocos", pero **con rótulo claro de que no es factura**.

### 1.3 Albarán valorado vs. sin valorar [DATO VERIFICADO + INTERPRETACIÓN]
- **Sin valorar** (el modelo actual de YaQu, líneas {concepto, cantidad, unidad} sin precios): elimina el riesgo de que el cliente lo confunda con factura y de que se use como justificante de gasto indebido. Ideal para partes de trabajo donde el precio se pacta aparte.
- **Valorado** (con precios, normalmente sin IVA): más informativo, pero **riesgo de confusión con factura**. Buenas prácticas de rotulación: marca de agua o encabezado "ALBARÁN – DOCUMENTO SIN VALIDEZ FISCAL. NO ES FACTURA", y omitir desglose de cuota de IVA para no simular una factura.

**[INTERPRETACIÓN]** YaQu debería soportar **ambos modos con un flag por documento y por serie**, y que el PDF cambie automáticamente el rótulo y los descargos legales según el modo.

### 1.4 Relación albarán ↔ factura recapitulativa [DATO VERIFICADO]
- **Requisitos (art. 13):** (a) **mismo destinatario**; (b) operaciones dentro del **mismo mes natural**; (c) plazo de expedición: **último día del mes natural** si el destinatario es **particular**; **antes del día 16 del mes siguiente** si es **empresario/profesional**.
- **Doctrina DGT que valida la agrupación de albaranes:**
  - **V2832-09 (28/12/2009):** reconoce expresamente que "la facturación limitada al período del mes natural, se sustenta en la emisión de otros documentos (**albaranes**, etc.)".
  - **V0851-23 (12/04/2023):** una estación de servicio puede emitir una única recapitulativa a fin de mes desglosando por fechas cada operación; el sumatorio puede superar el límite de la factura simplificada aunque cada operación individual deba respetarlo.
  - **V1409-17 (05/06/2017):** distingue la **recapitulativa genuina** (varias operaciones de un mes, plazos arts. 11/13) del mero **canje/sustitución** de tiques o simplificadas ya emitidas (que no es recapitulativa y sigue la ventana de 4 años). Relevante para la lógica de producto.
- **Incumplimiento de plazo / de contenido:** entra en el régimen sancionador del **art. 201 LGT** (ver Hallazgos clave). Advertencia TEAC: se han impugnado recapitulativas que "no hacen mención alguna a los albaranes"; conviene **referenciar los albaranes/operaciones subyacentes** para cumplir el contenido del art. 6 del Reglamento.

### 1.5 Distinción crítica: varias operaciones sueltas vs. un trabajo largo [DATO VERIFICADO]
Este es el punto fiscal más delicado para un fontanero/reformista:

- **Varias operaciones independientes** (p. ej., 4 avisos de fontanería en el mes al mismo cliente) → cada una devenga al completarse; pueden **agruparse en una recapitulativa mensual**.
- **Una sola operación/trabajo prolongado** (p. ej., una reforma de baño de 3 semanas) → **NO son varias operaciones**: es una única prestación (o ejecución de obra) que **devenga al concluir** (puesta a disposición), y se factura al finalizar, **no** por agrupación mensual.
- **Base doctrinal:** la DGT y el TEAC diferencian **tracto único / ejecución de obra de duración prolongada** (devengo al finalizar) de **tracto sucesivo** (devengo cuando cada parte del precio es exigible, art. 75.Uno.7º LIVA). El TEAC (res. 23/03/2010): *"un contrato de ejecución de obra… entraña una serie de actos de ejecución, pero no se trata de obligaciones de tracto sucesivo consistentes en la repetición en el tiempo de actos idénticos"*. Consultas de apoyo: **V2023-18** (obra como "única operación compleja"), **V2583-12** (devengo en ejecuciones de obra ligado a la "recepción de la obra"/"puesta a disposición"), **V1659-25** y **V0077-25** (tracto único; la fecha de factura no fija el devengo).

**Riesgo fiscal:** tratar un trabajo largo como "operaciones sueltas" agrupadas puede adelantar o retrasar mal el devengo del IVA; tratar operaciones sueltas como un solo trabajo puede incumplir plazos de facturación. Ambos caen en el art. 201 LGT.

### 1.6 Certificaciones de obra [DATO VERIFICADO]
- La **certificación de obra es un documento distinto e independiente de la factura** y **nunca la sustituye**.
- **Retención de garantía del 5%:** práctica habitual (obra pública y privada); el promotor retiene un 5% que se libera con la recepción definitiva / fin del periodo de garantía.
- **Devengo/IVA:** en **certificaciones parciales** que constituyen pagos anticipados, el IVA se devenga sobre **los importes efectivamente percibidos, sin incluir la retención** (DGT **V0053-13**, 09/01/2013). Al finalizar la obra se regulariza y se factura el total, aplicando IVA a la base.
- **Cuándo procede certificación en vez de albarán:** [INTERPRETACIÓN] en obra con promotor/contrata y pagos por avance; para el nicho de oficios de YaQu (reformas domésticas, mantenimientos), lo habitual será **albarán/parte de trabajo + factura**, reservando "certificación" como modo avanzado opcional.

### 1.7 Albaranes ante VeriFactu y factura electrónica B2B [DATO VERIFICADO + INTERPRETACIÓN]
- **VeriFactu (RD 1007/2023) y factura electrónica B2B (Ley Crea y Crece / RD 238/2026)** regulan **facturas**, no albaranes. Los albaranes, al no ser documentos fiscales, **quedan fuera del SIF (Sistema Informático de Facturación)** y de la obligación de registro/QR/hash.
- **¿Trazabilidad albarán→factura obligatoria en algún sistema?** [DATO VERIFICADO] No con carácter general para el albarán en sí. Pero **la factura que agrupa albaranes sí debe permitir identificar las operaciones** (contenido art. 6 Reglamento; advertencia TEAC de referenciar los albaranes). [INTERPRETACIÓN] Conviene que la factura generada por YaQu **liste los albaranes/partes origen** (número y fecha) en el cuerpo o anexo.
- **[INTERPRETACIÓN]** El módulo de albaranes es "terreno libre" fiscalmente, pero **la frontera con la factura debe ser un muro**: en cuanto se convierte a factura, entra el régimen VeriFactu/SIF y las validaciones deben ser estrictas.

### 1.8 Albarán y morosidad [DATO VERIFICADO]
- El **monitorio** (arts. 812 ss LEC) admite como principio de prueba facturas, **albaranes de entrega firmados**, contratos y presupuestos aceptados. Sin límite de cuantía; no requiere abogado/procurador para la petición inicial (sí en oposición si supera 2.000 €).
- **Ley 3/2004** de morosidad: intereses de demora y 40 € de costes de cobro en operaciones entre empresas.
- Modelos de demanda monitoria citan expresamente "los albaranes de entrega firmados en conformidad" como Documento nº 2.

---

## BLOQUE 2 — Benchmark de software (función por función)

> Fuentes: documentación oficial de ayuda de cada producto y análisis contrastados. Donde no hay documentación pública clara se marca **[no documentado]**.

### 2.1 Tabla maestra — Software español clásico / ERP

| Producto | Crear albarán desde | Precios/líneas | Estados y trazabilidad | Conversión a factura | Firma cliente | Movilidad |
|---|---|---|---|---|---|---|
| **Factusol / Software DELSOL** | Cero, presupuesto, pedido | Precios, descuentos, impuestos, series, almacenes | Pendiente/Facturado (editable) | Individual (icono Factura); **múltiple hasta 30**; **entre nº de albarán (agrupando)**; **entre fechas (agrupando)**; agrupar por artículo; una factura por cliente/por albarán | [no documentado nativo] | TS con apps; EDI |
| **Sage 50 / 200** | **Albarán es documento base** (mueve stock); factura directa genera albarán interno | Precios, series, almacenes, coste/beneficio/comisión | Pendiente/Facturado; ficha con Agrupar albaranes Sí/No | **Facturación general de albaranes** con filtros (fechas, series, cliente, vendedor); **agrupar por obra**; **facturar solo obras terminadas**; **botón "Roturas"** (campos que fuerzan facturas distintas: cliente, cadena, divisa, IVA incluido…) | Módulos de terceros | — |
| **Holded** | Cero, importación Excel/PDF, albaranes de compra | Precios, stock (ajuste manual) | Pendiente/Facturado | Agrupa varios albaranes en una factura | [limitado] | Cloud |
| **STEL Order** | **Cero, cliente, producto, presupuesto, pedido** (SAT); app móvil | Precios, líneas SAT, partes | Trazabilidad documental completa | **Factura de múltiples albaranes** (filtro por cliente); electrónica desde varios albaranes | **Firma en móvil/tablet in situ y firma online remota** | **App completa, offline, firma, envío WhatsApp/email** |
| **FacturaScripts** | Cero, presupuesto, pedido, **parte de trabajo (partedetrabajo.com)** | Precios, series, almacenes | Pendiente/Servido/Facturado; **columna "servido"** | **Agrupar** (mismo cliente/almacén/serie) y **partir** albaranes; **facturación parcial por cantidad seleccionada** | [no documentado nativo] | App de partes |
| **Odoo (localización ES)** | Pedido de venta; albarán = picking; módulos ES para albarán-documento | Precios, lotes, nº serie, entregas parciales | **Cantidades entregadas/facturadas/pendientes** por línea | **Facturar cantidades entregadas** (parcial); agrupar por empresa; **módulo "picking to invoice"**: masiva por cliente con filtros de **periodicidad, plazo de pago, series** y rectificativas por albaranes negativos | Portal | App |
| **Gabilos / ContaSol / Contasimple / Cloud Gestion / Gestión 360** | Cero, presupuesto/pedido | Precios, series | Pendiente/Facturado | Conversión y agrupación básicas | Variable | Variable |
| **A3 / Wolters Kluwer** | ERP contable-fiscal | Completo | Completo | Recapitulación por cliente/periodo | — | — |
| **Qfacwin (referencia)** | — | — | Pendiente/Facturado | **Facturación automática de todos los clientes con albaranes pendientes ≤ fecha**; toma forma de pago/tarifa/vendedor del 1er albarán | — | — |

**Patrón español clave [DATO VERIFICADO]:** el concepto de **"campos de rotura"** (Sage 200) que fuerzan a partir facturas (cliente, cadena, divisa, IVA incluido, obra) es exactamente el mecanismo técnico que YaQu necesita, **añadiendo "mes natural" y "tipo de IVA" como roturas fiscales.**

### 2.2 Tabla — Facturación cloud autónomos/pymes

| Producto | Albaranes | Conversión | OCR/extras | Notas |
|---|---|---|---|---|
| **Billin (TeamSystem)** | Crea albarán con moneda, suplidos, impuestos, cantidades pagadas, adjuntos; app iOS/Android | **Convertir a factura en 2 clics**; estados pendiente/entregado/facturado | **OCR de tickets/facturas**; VeriFactu (QR/hash) | Freemium |
| **Quipu** | Presupuestos, albaranes, rectificativas | Conversión directa | **OCR**, conciliación bancaria; VeriFactu | Desde ~14 €/mes |
| **Anfix** | Albaranes, conversión | Sí | VeriFactu | — |
| **Fube** | Albaranes **con o sin precios**; etiquetas | Convertir a factura/presupuesto/proforma; estados pendiente/entregado/facturado | — | Freemium |
| **Declarando / FacturaDirecta / Debitoor-SumUp / Zoho Books ES / Contasimple** | Documentos comerciales básicos | Conversión estándar | Variable | Orientados a autónomo simple |

### 2.3 Tabla — Field service internacional (patrones de UX a "robar")

| Producto | Job/work order | Firma | Líneas/materiales/fotos | Facturación | Movilidad |
|---|---|---|---|---|---|
| **Jobber** | Job con hasta 100 líneas; one-off y recurrente; time tracking | **Signature pad** (guarda PDF firmado en notas internas); línea de firma en PDF | Líneas producto/servicio, coste, descripción | **Generate Invoice** desde job; **batch invoicing**; **progress invoicing** (hitos/depósitos); "requires invoicing" status; visit-based billing | App, cliente hub |
| **Housecall Pro** | Work order; multi-día; job splits | **Custom job signatures** (hasta 3 campos, términos); firma en invoice y job | **Material detail tracking** (origen, proveedor), fotos antes/después, photo report | Auto-invoicing; envío por email/SMS; QuickBooks | App; "On my way/Start/Finish" con timestamps |
| **ServiceM8** | Job card; checklists | **Firma sign-off** de quote y de trabajo completado | Fotos/vídeo al diary, **bundles** de mano de obra+materiales, escaneo de códigos | Invoice en segundos on-site; pago Apple/Google Pay | Mobile-first, GPS |
| **Tradify / Commusoft / Simpro / Joblogic / BigChange / Fergus / ServiceTitan / WorkWave** | Job management, PPM, activos, certificados | Firma + fotos + GPS timestamps | Materiales, POs a proveedor, partes | Progress/staged, POs, contratos | App, offline, rutas |

**Lo que el field service hace mejor [DATO VERIFICADO]:** firma in situ con fotos y timestamp, "requires invoicing" como bandeja de trabajo, progress invoicing por hitos, bundles/kits, seguimiento GPS y control horario del operario. **Lo que NO hacen:** albarán sin importes como documento español, recapitulativa mensual con mes natural, series fiscales españolas, retención de obra.

### 2.4 Nicho español de oficios [DATO VERIFICADO parcial]
- **STEL Order** es el competidor directo más fuerte: "albaranes de trabajo", SAT, firma móvil y remota, factura de múltiples albaranes, envío WhatsApp. Es el rival a batir en fiscalidad + movilidad.
- **Labory, Cloud Albaranes, Soltic ERP, Programación Integral, Doceo (BioSign):** apps de partes de trabajo/albaranes con firma digital, fotos, horas y materiales, sincronización oficina-campo, control horario. Confirman la demanda del patrón "parte firmado en campo".
- **PresuNow, PresupuestAPP, Presupuesta, Alobra, Habitissimo Pro:** orientados a presupuestos de oficios; el albarán/parte firmable no está documentado como núcleo fuerte (oportunidad).

### 2.5 Precios y plan del módulo [DATO VERIFICADO parcial / INTERPRETACIÓN]
- Quipu desde ~14 €/mes; Billin y Fube con planes freemium; STEL Order y ERPs por módulos (Sage desde ~51 €/mes según comparadores). En el software español el módulo de albaranes suele estar **incluido en planes de gestión/ERP**, no como add-on aislado. En field service internacional va en planes intermedios/altos (progress invoicing, batch). **[INTERPRETACIÓN]** El mercado no cobra el albarán por separado; YaQu debe incluirlo en el plan base y monetizar los **automatismos** (recapitulativa automática, IA, OCR) en planes superiores.

---

## BLOQUE 3 — Huecos y oportunidades

### 3.1 Funciones que solo tienen uno o dos (diferenciación por completitud) [DATO VERIFICADO]
- **Facturación parcial por cantidad servida** con columna "servido" (FacturaScripts, Odoo). Poco común en cloud simple.
- **Campos de rotura configurables** (Sage 200): raro fuera de ERP grande.
- **Facturación masiva por periodicidad/plazo de pago/serie del cliente** (Odoo picking-to-invoice, Qfacwin): potente, casi nadie lo tiene en móvil.
- **Progress invoicing por hitos** (Jobber, field service): raro en software español de oficios.
- **Firma remota online del documento** (STEL Order): pocos la tienen; **firma remota por WhatsApp: prácticamente nadie**.

### 3.2 Lo que NO tiene NADIE (hueco real) [INTERPRETACIÓN sobre DATO VERIFICADO]
1. **Distinción automática y guiada "varias operaciones sueltas (recapitulativa mensual)" vs "un trabajo largo (factura al concluir)"** con UI para no expertos. Ningún producto la modela; todos dejan la decisión fiscal al usuario.
2. **"Mes natural" como campo de rotura automático** que auto-divide una selección de albaranes en varias facturas (una por mes) para no incumplir art. 13.
3. **Firma remota por WhatsApp con captura de evidencias probatorias** (token, timestamp, IP, hash del PDF) pensada para resistir la negación de firma en monitorio.
4. **Bandeja "pendientes de facturar" con alerta de plazo legal** (día 16 / fin de mes) según tipo de destinatario.

### 3.3 Quejas recurrentes de usuarios [DATO VERIFICADO parcial]
- **"Albaranes facturados que siguen apareciendo como pendientes"** (Factusol/DELSOL tiene artículo específico para arreglarlo manualmente): el estado se desincroniza → **oportunidad: estado derivado, nunca manual**.
- **Odoo v11:** usuarios españoles se quejan de que "la facturación desde albaranes ya no existe", que factura el pedido entero aunque haya entregas parciales, y que "junta pedidos del mismo cliente por que sí". Refleja frustración con **agrupaciones no controladas por el usuario**.
- **Sage 50:** al agrupar albaranes en factura, **no imprime nº+fecha+detalle de cada albarán** como el antiguo FacturaPlus → los clientes quieren **ver el desglose por albarán en el PDF**.
- Patrón general del field service (fuentes de comparativas): "perder fotos en el móvil" y "olvidar facturar pequeños extras" son las mayores causas de pérdida de ingresos → refuerza la bandeja "requires invoicing".

### 3.4 Tendencias [DATO VERIFICADO parcial / INTERPRETACIÓN]
- **OCR de albaranes/tickets de proveedor** ya es estándar en Billin/Quipu (entrada de gastos).
- **IA aplicada a partes de trabajo, dictado por voz en obra y automatización de la facturación de albaranes:** emergente; nadie lo tiene consolidado en el nicho de oficios español → **ventana de diferenciación**.
- **Firma biométrica/digital con validez legal** (Doceo BioSign, Soltic, Programación Integral con certificado clase-2): el mercado ya educa al cliente en firmar en tablet/móvil.

---

## BLOQUE 4 — Propuesta de módulo completo para YaQu

> Todo el BLOQUE 4 es **[INTERPRETACIÓN]** de diseño, salvo las reglas fiscales citadas (verificadas). Pensado para generar tickets directamente.

### 4.1 Modelo de datos

**Entidad `Trabajo` (contenedor, ya existe):**
- `id`, `comerciante_id`, `cliente_id`, `presupuesto_id` (origen), `tipo_operacion` (**enum: `OPERACIONES_SUELTAS` | `TRABAJO_UNICO`** ← campo fiscal crítico), `estado`, `direccion_servicio`, `obra_id?`, fechas.

**Entidad `Albaran` (parte de trabajo):**
- `id`, `serie` (p. ej. `ALB-2026`), `numero` (correlativo por serie/comerciante), `trabajo_id`, `cliente_id` (snapshot de NIF/nombre/domicilio en el momento), `fecha_emision`, `fecha_entrega/ejecucion` (**la que cuenta para el mes natural y el devengo**), `modo_valoracion` (**`SIN_VALORAR` | `VALORADO`**), `estado` (máquina 4.2), `tipo_iva_previsto` (para rotura), `destinatario_tipo` (**`PARTICULAR` | `EMPRESARIO`** ← determina plazo art. 13), `token_firma`, `firma` (objeto de evidencias, 4.6), `pdf_hash`, `factura_id?`, `cantidad_facturada_por_linea`, `bloqueado_facturacion` (bool), `notas`, `geoloc?`.
- **Restricción:** un albarán **VALORADO** no desglosa cuota de IVA; el PDF fuerza rótulo "no es factura".

**Entidad `LineaAlbaran`:**
- `id`, `albaran_id`, `concepto`, `cantidad`, `unidad`, `precio_unitario?` (null si sin valorar), `descuento?`, `tipo_iva?`, `cantidad_servida`, `cantidad_facturada`, `producto_id?`, `lote?`, `num_serie?`, `es_material|es_mano_obra|es_desplazamiento`.

**Entidad `AdjuntoAlbaran`:** fotos antes/después con metadatos (timestamp, geoloc, hash), documentos.

**Entidad `Factura` (destino):** `serie_fiscal`, `numero`, `tipo` (**`NORMAL` | `RECAPITULATIVA` | `ANTICIPO` | `RECTIFICATIVA`**), `albaranes_origen[]` (lista con nº y fecha — para el PDF y trazabilidad), `anticipos_deducidos[]`, campos VeriFactu (QR/hash/encadenamiento).

**Entidad `Anticipo`:** `trabajo_id`, `importe`, `fecha_cobro`, `iva_devengado`, `factura_anticipo_id`, `deducido_en_factura_id?`.

**Entidad `Certificacion` (modo avanzado):** `obra_id`, `importe_ejecutado`, `retencion_garantia_pct` (default 5), `es_parcial`, `base_devengada`, `fecha_recepcion?`.

### 4.2 Máquina de estados del albarán

```
BORRADOR ──emitir──▶ EMITIDO ──enviar/firmar──▶ FIRMADO
   │                    │                          │
   │                    └──(sin firma)─────────────┤
   ▼                                               ▼
ANULADO                                    ┌─ PENDIENTE_FACTURAR
                                           │        │
                                           │        ├──facturación parcial──▶ PARCIALMENTE_FACTURADO
                                           │        │
                                           │        └──facturación total────▶ FACTURADO
                                           └─(bloqueado_facturacion=true) ──▶ EXCLUIDO_FACTURACION
```

**Reglas de transición [INTERPRETACIÓN]:**
- Un albarán solo pasa a `PENDIENTE_FACTURAR` cuando está `EMITIDO` o `FIRMADO` (configurable: exigir firma para facturar, sí/no).
- **El estado de facturación es DERIVADO, nunca manual** (soluciona la queja de DELSOL): se calcula desde `cantidad_facturada` vs `cantidad`/`cantidad_servida` de las líneas.
- `PARCIALMENTE_FACTURADO` cuando 0 < facturado < total (patrón Odoo/FacturaScripts columna "servido").
- No se puede editar un albarán `FIRMADO` (integridad probatoria): se anula y se reemite, dejando traza.

### 4.3 Rutas de conversión albarán→factura y sus validaciones

**Rutas soportadas [INTERPRETACIÓN, patrones verificados del benchmark]:**
1. **Individual:** un albarán → una factura.
2. **Múltiple manual:** selección de albaranes de un cliente → una factura (con validaciones).
3. **Por rango de fechas / por rango de números** (patrón Factusol/DELSOL).
4. **Masiva por cliente / programada** (patrón Odoo picking-to-invoice, Qfacwin): "facturar todos los albaranes pendientes ≤ fecha X".
5. **Parcial:** facturar solo parte de un albarán por **cantidad servida** (patrón FacturaScripts/Odoo).
6. **Recurrente/periódica:** según periodicidad del cliente (diaria/semanal/mensual).

**Validaciones legales obligatorias antes de emitir factura (bloqueantes):**
- ✅ **Mismo cliente/NIF** (destinatario único por factura recapitulativa).
- ✅ **Mismo mes natural** → si la selección abarca varios meses, **rotura automática**: el sistema propone *N* facturas, una por mes (ver 4.3.1).
- ✅ **Mismo tipo de IVA / régimen** (rotura por IVA, como Sage).
- ✅ **Albaranes no facturados** (excluir `FACTURADO`; en parcial, solo cantidad no facturada).
- ✅ **Firmados** (si la política lo exige).
- ✅ **Misma serie fiscal / divisa / dirección de facturación** (roturas configurables).
- ⚠️ **Alerta de plazo:** si destinatario `EMPRESARIO` y estamos pasado el **día 15 del mes siguiente**, avisar "plazo de recapitulativa a punto de vencer"; si `PARTICULAR`, avisar antes de fin de mes.

#### 4.3.1 "Mes natural" como campo de rotura (feature diferencial)
**[INTERPRETACIÓN sobre art. 13 verificado]** Cuando el usuario selecciona albaranes que cruzan meses, el motor de rotura los **agrupa por (cliente, mes natural de `fecha_entrega`, tipo_iva, serie)** y genera **una factura recapitulativa por grupo**, cada una fechada dentro de su ventana legal. UI: "Has seleccionado 7 albaranes de 2 meses distintos. Para cumplir la normativa, se crearán **2 facturas** (marzo y abril). [Ver detalle]". Esto convierte una obligación fiscal invisible en un automatismo a prueba de fontaneros.

### 4.4 UI que distingue "varias operaciones" de "un trabajo largo"
**[INTERPRETACIÓN]** Al crear el `Trabajo`, un **selector de dos tarjetas con lenguaje de oficio, sin jerga fiscal**:

- 🔧 **"Varios avisos/visitas sueltas"** → *"Cada visita es un trabajo independiente. Al final del mes juntamos todos los partes de este cliente en una sola factura."* → `tipo_operacion = OPERACIONES_SUELTAS`, habilita recapitulativa mensual.
- 🏗️ **"Una obra o reforma de varios días"** → *"Es un solo trabajo que factura al terminar (o por adelantos pactados). No se juntan con otros por mes."* → `tipo_operacion = TRABAJO_UNICO`, deshabilita agrupación mensual, habilita anticipos/certificaciones y factura final al concluir.

El motor de facturación **respeta esta bandera**: nunca ofrece agrupar en recapitulativa un `TRABAJO_UNICO`, y para `OPERACIONES_SUELTAS` sugiere la recapitulativa a fin de mes.

### 4.5 Tratamiento de anticipos [DATO VERIFICADO → diseño]
- Cobro de anticipo (Stripe/Bizum/transferencia) → **genera factura de anticipo** (devengo al cobro, art. 75.Dos LIVA).
- La **factura final descuenta los anticipos** ya facturados (línea negativa o bloque "anticipos deducidos"), tomando importes de `Anticipo`.
- Para `TRABAJO_UNICO` de obra: los adelantos pueden modelarse como certificaciones parciales con retención 5% (modo avanzado; ver advertencias).

### 4.6 Firma del cliente y valor probatorio (núcleo WhatsApp-first)
**[INTERPRETACIÓN sobre eIDAS/Ley 6/2020 verificados]**
- **Firma remota por WhatsApp** con token opaco (ya existe) → al firmar, capturar y sellar: `timestamp`, `IP/dispositivo`, `identificador del token`, `nombre declarado`, **hash SHA-256 del PDF firmado**, y opcionalmente geoloc y foto. Guardar un **"certificado de evidencias"** anexo al PDF.
- **Firma in situ en canvas** (ya existe) con los mismos metadatos.
- Objetivo explícito: que el paquete de evidencias eleve la firma de "simple" hacia "avanzada" (vinculada al firmante, detección de alteración) para **resistir la negación de firma** en monitorio (recuérdese la jurisprudencia que anula albaranes con firma falsa: aquí la evidencia técnica es la defensa).
- **Portal/enlace del cliente** para ver histórico de partes firmados y facturas.

### 4.7 Movilidad y partes de trabajo
**[INTERPRETACIÓN, patrones verificados de field service]**
- App móvil offline; sincronización al recuperar cobertura.
- Parte de trabajo con **tiempos (control horario del operario, Start/Finish con timestamp)**, **materiales** y **desplazamiento** como tipos de línea.
- **Fotos antes/después** con metadatos; nunca se pierden (van al trabajo, no al carrete).
- Geolocalización opcional del punto de firma.

### 4.8 Reporting sobre albaranes
- **Bandeja "Pendientes de facturar"** con importe potencial y **semáforo de plazo legal** (día 16 / fin de mes).
- Rentabilidad por trabajo (mano de obra + materiales vs. cobrado).
- Productividad por operario (horas, partes firmados).
- Albaranes sin firmar > X días (riesgo probatorio).

### 4.9 Qué debe llevar el PDF del albarán (impecable legalmente)
**[INTERPRETACIÓN sobre práctica verificada]**

**Común (valorado y sin valorar):**
- Rótulo destacado **"ALBARÁN / PARTE DE TRABAJO"** + leyenda **"Documento sin validez fiscal. No es una factura (art. 13 RD 1619/2012 y normativa de facturación)."**
- Serie y número correlativo; fecha de emisión y **fecha de entrega/ejecución**.
- Emisor (nombre/razón social, NIF, domicilio) y receptor (ídem) — snapshot.
- Descripción de líneas con cantidad y unidad; referencia al trabajo/presupuesto origen.
- Espacio de **firma del receptor** + bloque de evidencias (fecha/hora, canal WhatsApp/in situ, hash).

**Solo valorado (adicional):**
- Precios unitarios **sin desglose de cuota de IVA**; leyenda "Importes orientativos; el IVA y la factura se emitirán conforme a la normativa vigente".

**En la factura que agrupa albaranes:** listar **nº + fecha + detalle de cada albarán** (resuelve la queja de Sage 50) y, para recapitulativas, la mención de periodo.

### 4.10 Integraciones
Stock/almacén (baja de material al firmar, opcional), compras/proveedores con **OCR de albaranes de proveedor** (Fase 3), Stripe Connect/Bizum/transferencia, exportación a VeriFactu al convertir a factura, y export contable a gestoría.

---

## Recomendaciones (staged)

### Fase 1 — PARIDAD ("esto acerca a tener clientes pagando") — imprescindible para lanzar
**Objetivo: un fontanero cierra el ciclo presupuesto→parte firmado→factura correcta desde el móvil.**
1. Albarán con `modo_valoracion` (valorado/sin valorar) + PDF con rótulos legales (4.9).
2. Máquina de estados con **estado de facturación derivado** (4.2).
3. Conversión **individual + múltiple por cliente + parcial por cantidad servida** (4.3 rutas 1, 2, 5).
4. Validaciones bloqueantes: mismo cliente, no facturado, mismo IVA (4.3).
5. **Firma WhatsApp/in situ con captura de evidencias + hash** (4.6).
6. Factura que **lista los albaranes origen** (4.9).
7. Bandeja "Pendientes de facturar" básica.

**Benchmark de éxito de fase:** el usuario factura sin salir del móvil y el PDF pasa una revisión de un asesor sin objeciones de rotulación. → *Umbral para pasar a Fase 2: primeros clientes de pago usando conversión semanalmente.*

### Fase 2 — DIFERENCIACIÓN — el foso competitivo
8. **Motor de rotura con "mes natural"** que auto-divide en varias recapitulativas (4.3.1).
9. **Selector "varios avisos" vs "obra larga"** con lenguaje de oficio (4.4) + comportamiento fiscal correcto por rama.
10. **Semáforo de plazo legal** (día 16 / fin de mes) según destinatario particular/empresario.
11. Conversión **por rango de fechas/números y masiva por cliente/periodicidad** (rutas 3, 4, 6).
12. Anticipos con factura de anticipo y deducción en final (4.5).
13. Progress invoicing por hitos (patrón Jobber) para reformas.

**Benchmark:** reducción a cero de facturas recapitulativas fuera de mes natural; NPS por "no me preocupo del IVA".

### Fase 3 — LUJO — cuando haya tracción
14. **IA de partes por voz** ("dicta el material y las horas en obra").
15. **OCR de albaranes de proveedor** (entrada de gastos/materiales).
16. Fotos antes/después con IA de detección; certificaciones de obra con retención 5% (modo avanzado, con validación fiscal).
17. Control horario avanzado, rutas, geolocalización.

**Criterio transversal "clientes pagando":** todo lo que reduzca el tiempo entre "trabajo hecho" y "dinero cobrado" (firma rápida, factura en 1 clic, recordatorio de impago con albarán firmado adjunto) tiene prioridad sobre lo que solo "queda bien".

---

## Caveats y advertencias (requieren validación de asesor fiscal antes de implementar)

1. **Clasificación operación suelta vs. trabajo único (4.4):** la frontera fiscal (tracto único vs. tracto sucesivo vs. ejecución de obra) es casuística. El asistente de YaQu **debe ofrecer una recomendación, no una certeza**, y registrar que la decisión final es del usuario/su asesor. Base: DGT V1659-25, V0077-25, V2583-12, V2023-18; TEAC 23/03/2010.
2. **Plazos de recapitulativa (art. 13):** el sistema debe distinguir **particular** (fin de mes natural) de **empresario/profesional** (día 16 mes siguiente). Confirmar con asesor el tratamiento cuando el destinatario cambia de condición o hay dudas sobre su condición.
3. **Devengo y anticipos:** el IVA de anticipos se devenga al cobro (art. 75.Dos). La automatización de facturas de anticipo y su deducción debe revisarla un asesor para cada régimen (recargo de equivalencia, criterio de caja, etc.).
4. **Certificaciones de obra y retención 5% (4.5, 4.10):** el tratamiento del IVA sobre importes percibidos vs. retenidos (DGT V0053-13) es delicado; NO implementar el modo "certificación" sin validación.
5. **Valor de la firma electrónica (4.6):** eIDAS/Ley 6/2020 dan admisibilidad, pero **la fuerza probatoria concreta la decide el juez** en valoración conjunta. No prometer al usuario "validez plena": prometer "máxima evidencia".
6. **Frontera con VeriFactu / factura electrónica B2B:** los albaranes quedan fuera, pero **en cuanto se convierten a factura** entran RD 1007/2023 (VeriFactu, obligatorio 1-ene-2027 sociedades / 1-jul-2027 resto) y, según tamaño, la factura electrónica B2B del RD 238/2026. El módulo de facturación aguas abajo debe estar homologado; el de albaranes no, pero la **trazabilidad albarán→factura** debe estar lista para cuando la factura sí lo exija.
7. **Sanciones (art. 201 LGT):** los errores de facturación (no de albaranes) exponen al usuario a multas del 1%–2% (hasta 2%–4% con incumplimiento sustancial >20% de operaciones). Todas las validaciones bloqueantes de 4.3 existen precisamente para minimizar este riesgo; su diseño final debe revisarlo un asesor.
8. **Datos de producto de terceros:** las funcionalidades del benchmark provienen de documentación oficial y comparativas vigentes en la investigación; **verificar versión y plan concretos** antes de usarlas como argumento comercial comparativo, porque cambian con frecuencia (p. ej., el límite "30 albaranes" de Factusol o el comportamiento de Odoo por versión).