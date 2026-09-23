# Contabilidad · el apartado para un autónomo de oficio — diseño y backlog (SCRUM-1012)

> **BORRADOR v0.10 · S0 · 22-sep-2026 (CON-03/SCRUM-1039, sobre v0.9 de `sd-21` del 21-sep).** PASO 0 de código HECHO; 26 citas oficiales
> comprobadas por script (16 del 21-sep + 10 nuevas: RIRPF art. 95.4-6 retención 1/2 %, LIVA arts. 7 y 20 exento/no sujeto, plazo trimestral
> del modelo 303). Q-C5 y Q-C9 quedan RESPONDIDAS por cita (§4); Q-C8 solo para el 303 — 130/131/111/115/347/390 siguen NO VERIFICADO.
> backlog DISEÑADO pero **los tickets NO están creados en Jira** (§6). **Spec interna: cero claims fiscales en texto de producto** (regla 7,
> `verifactu`). Todo texto de pantalla que aparezca aquí es propuesta **sin firma** (regla 39). Este documento no dice qué debe hacer el
> profesional: dice qué dice la norma y qué hace hoy el código. CRM: `docs/producto/CRM.md`.
>
> **v0.11 · J4 · 23-sep-2026 (SCRUM-1104).** Q-C8 pasa de parcial a **RESPONDIDA** por el asesor
> fiscal — mapa completo de modelos en §4. **Ninguna cita nueva entra en §3**: todo lo que el asesor
> citó de memoria (marcado ⚠ por él mismo) queda NO VERIFICADO hasta que alguien lo coteje contra el
> BOE consolidado — no se ha bajado ninguna fuente nueva en esta pasada (ni RGAT, ni los artículos
> nuevos de RIVA/RIRPF/LIVA). **Cuatro cambios de alcance:** el 131 se retira (nunca aplica a este
> perfil) · el 390 no está exonerado (con enlace AEAT, no ⚠) · se añaden el 100 y el 349, que
> faltaban del mapa · el 347 NO desaparece con VeriFactu (sólo con SII, incompatible con VeriFactu).
> REDEME→SII (SCRUM-1102) y la retención en facturas recibidas para 111/115 (SCRUM-1103) ya tienen
> ticket propio: no se duplican aquí.
>
> **v0.12 · J4 · 23-sep-2026 (SCRUM-1106).** Q-C1, Q-C2, Q-C3, Q-C4, Q-C5 y Q-C7 quedan RESPONDIDAS
> (Q-C5 sustituye su parcial del 22-sep). Afectan al alcance de **SCRUM-1051, 1052, 1053, 1054 y
> 1073** — revisarlos con esto antes de construir. Dos hallazgos grandes: 🔴🔴 para este perfil
> (estimación directa) **la retención en factura EMITIDA es CERO en todos los casos**, sin decisión
> del fundador sobre si construirla igual para un segmento que hoy no existe; y el **ISP se
> estrecha mucho** — una reforma de baño nunca es "rehabilitación", así que casi nunca aplica
> aunque el cliente sea empresa. El art. 6.1.m/6.2.b ROF y las páginas AEAT de reformas los dio el
> asesor como verificados hoy por él (se citan como fuente); mi propio cotejo del ROF por WebFetch
> salió ambiguo en la letra exacta y **no se promueve a §3** — el resto de citas nuevas, todas ⚠ del
> asesor, quedan NO VERIFICADO igual que en v0.11.

## 0 · La regla de oro y cómo se cumple

Cada regla fiscal lleva **fuente oficial (BOE) + cita literal comprobada por script** (§3), o va marcada **NO VERIFICADO → pregunta al asesor** (§4).
El método es el de `docs/legal/REGISTRO_JORNADA_ES.md`: comprobador con control negativo en `docs/verificacion/comprobar-citas-contabilidad.mjs`.
Lo que NO prueba el comprobador: que la norma diga lo que yo entiendo, ni que el texto consolidado esté al día en la fecha de aplicación. Los
comentarios de este documento no son norma; las «citas» sí (y solo ellas llevan esas comillas).

## 1 · Qué existe HOY (PASO 0, `origin/main` = `6db52e16`, solo lectura, deducido = (D))

**Ya hecho (Jira Finalizada) pero con costuras:** A2 293 retención/suplidos: **parcial, sin cable a la emisión** (`docs/master/SCRUM-293.md:7-11`) ·
A3 294 recargo/caja: % sin confirmar por el asesor, RECC no liquida (`294.md:114-122`) · A5 295 modelo 303: **solo devengado, sin pantalla** (`295.md:136-147`) ·
A6 296/426 libros: emitidas con pantalla; **recibidas solo servidor** (`librosAeat.routes.ts:89`) · E4 325: no es formato AEAT (`325.md:20-37`).
La matriz decía "IRPF y recargo sin cablear" (M L1771, L1903): lo medido lo confirma en la emisión.

| pieza | estado hoy |
|---|---|
| IVA que se puede emitir | 0/2/4/5/7,5/10/21, lista cerrada en servidor (`core/validation/fiscalInput.ts:35`, `tiposIvaEmitibles.ts:74`); selector de línea 21/10/4/0 (`tiposDeIva.js:40`); gasto, los mismos 4 (`expensesView.js:397`) |
| Retención IRPF | 15/7/2/1 cerrada (`retencionIrpf.ts:54`); **no llega al total ni al XML sellado** (`:6-11`); el selector del perfil manda `retencionIrpfDeclarada/Tipo` (`settingsView.js:1047-1051`) pero `merchantProfileUpdateSchema` no las declara (`schemas.ts:423-506`) → (D) **no se guarda** |
| Recargo de equivalencia | 21→5,2 · 10→1,4 · 4→0,5 "pendiente de confirmación del asesor" (`recargoEquivalencia.ts:51-64`); del cliente solo se GUARDA el dato (`schema:333`) |
| Exento · no sujeto · ISP · REBU · intracomunitario · IGIC/IPSI | **no existen** (`tiposDeIva.js:11-13`); una línea al 0 % no se puede sellar (`registro.builder.ts:298-310`) |
| Suplidos | casilla que fuerza IVA 0 (`schemas.ts:175-190`) pero sigue en la base (`vat.service.ts:51-61`) |
| Libros | Emitidas con pantalla + menú (`libroRegistroView.js`); Recibidas solo CSV; incluye JUST sin filtro (`libroRegistro.repo.ts:112-121`); textos [PENDIENTE] visibles (`exportView.js:87-100`) |
| Modelo 303 | solo devengado 4/10/21 + casilla 27 (`casillas.ts:41-48`); `GET /admin/modelo-303`, **sin pantalla** |
| 130 · 111 · 115 · 347 · 349 · 390 · 100 | **no existen** (solo 2 comentarios, `retencionIrpf.ts:110,129`) |
| Resumen del trimestre | **no existe**: hay rentabilidad mensual/anual e IVA repercutido por trimestre (`reportsView.js:18,175-177,339`); faltan soportado, retenciones y resultado |
| Gastos | alta con desglose, proveedor+NIF y foto (`expensesView.js:370-465`); `vatDeducible` nadie lo escribe (`expenses.service.ts:339-358`); **leer ticket con Gemini existe en servidor, 0 apariciones en pantalla** (`expenses.routes.ts:237`, 5/día); sin recurrentes ni banco |
| Flags | `INVOICING_ES_ENABLED`, `SIF_ENABLED` OFF (`flags.ts:16-17,44`): ES real = recibo `J-` sin sello; `verifactu.xml` 404 aunque su botón se ve (`reportsView.js:63`). Libro, Informes, Gastos y exports NO leen el flag |
| Beneficio del panel | mezcla `total` con IVA y `amount` ambiguo (`reports.routes.ts:72,78`) |

**Defectos deducidos — confirmar en staging ANTES de arreglar (A2):** (a) retención del perfil no se guarda · (b) JUST entra en libro e IVA repercutido ·
(c) criterio de caja usa `paidAt`, que no siempre es fecha real (`criterioCaja.ts:29-34`) · (d) gastos antiguos sin base quedan fuera del libro (`libroRecibidas.ts:28-50`).

## 2 · Competencia (digest de la matriz; `[D]` dentro, `[F]` fuera)

Verifacturamos `[F]` M L118/133: 23 tipos (IGIC, IPSI, recargo, inversión del sujeto pasivo, suplidos, autofacturas) y una regla del 40 % de materiales — **es afirmación del competidor, no verificada aquí; la norma sí se cita en §3**.
Billin `[F]` L1730/1903 y Contasimple `[F]` L1743 (captura muestra IVA por línea y Retención): varios IVA, suplidos, retención, recargo. Holded `[D]` L327 IVA 21 % por defecto; escáner de gastos en todos los planes `[D]` L895-941
(capturas `holded/escaner-*`). Verifacturamos `[F]` L122: libro registro XLSX, 303 solo informe, carpeta Drive para el gestor. Quipu `[F]` L270: conciliación y SEPA. Ningún competidor citado trae 130/111/115/347/390 ni resumen trimestral (**no confirmado**).
Plan contable y asientos: solo Holded (cuenta por línea `[D]` L334); la matriz los tacha de «choca con el máster» (L500, L1783), veto **retirado por el fundador el 17-sep**.

## 3 · Reglas con cita oficial comprobada

Fuentes en §8 (LIVA · RIVA · LIRPF · RIRPF · RFACT · ORDEN303, BOE consolidado). Los números de apartado que no se ven en el texto extraído van marcados «(por confirmar)».

| regla | dónde | cita literal |
|---|---|---|
| Tipo general | LIVA art. 90.Uno | «El Impuesto se exigirá al tipo del 21 por ciento, salvo lo dispuesto en el artículo siguiente.» |
| Momento del tipo | LIVA art. 90.Dos | «El tipo impositivo aplicable a cada operación será el vigente en el momento del devengo.» |
| Tipo del 10 % | LIVA art. 91.Uno | «Se aplicará el tipo del 10 por ciento a las operaciones siguientes:» |
| Tipo del 4 % | LIVA art. 91.Dos | «Se aplicará el tipo del 4 por ciento a las operaciones siguientes:» |
| Reforma de vivienda: antigüedad | LIVA art. 91.Uno.2, 10.º letra b (nº 10.º por confirmar) | «Que la construcción o rehabilitación de la vivienda a que se refieren las obras haya concluido al menos dos años antes del inicio de estas últimas.» |
| Reforma de vivienda: 40 % de materiales | ídem, letra c | «Que la persona que realice las obras no aporte materiales para su ejecución o, en el caso de que los aporte, su coste no exceda del 40 por ciento de la base imponible de la operación.» |
| Inversión del sujeto pasivo en obra | LIVA art. 84, letra f (apartado por confirmar) | «Cuando se trate de ejecuciones de obra, con o sin aportación de materiales, así como las cesiones de personal para su realización, consecuencia de contratos directamente formalizados entre el promotor y el contratista que tengan por objeto la urbanización de terrenos o la construcción o rehabilitación de edificaciones.» |
| Suplidos (fuera de la base) | LIVA art. 78.Tres.3.º (encabezado de «Tres» por confirmar) | «Las sumas pagadas en nombre y por cuenta del cliente en virtud de mandato expreso del mismo.» |
| Suplidos: justificar y no deducir | ídem | «El sujeto pasivo vendrá obligado a justificar la cuantía efectiva de tales gastos y no podrá proceder a la deducción del impuesto que eventualmente los hubiera gravado.» |
| Recargo, general | LIVA art. 161.1.º | «Los tipos del recargo de equivalencia serán los siguientes: 1.º Con carácter general, el 5,2 por ciento.» |
| Recargo, sobre el tipo del art. 91.Uno | art. 161.2.º | «Para las entregas de bienes a las que resulte aplicable el tipo impositivo establecido en el artículo 91, apartado uno de esta Ley, el 1,4 por ciento.» |
| Recargo, sobre el tipo del art. 91.Dos | art. 161.3.º | «Para las entregas de bienes a las que sea aplicable el tipo impositivo previsto en el artículo 91, apartado dos de esta Ley, el 0,50 por ciento.» |
| Retención de profesionales | RIRPF art. 95.1 | «Cuando los rendimientos sean contraprestación de una actividad profesional, se aplicará el tipo de retención del 15 por ciento sobre los ingresos íntegros satisfechos.» |
| Retención: inicio de actividad | RIRPF art. 95.1 | «el tipo de retención será del 7 por ciento en el período impositivo de inicio de actividades y en los dos siguientes» |
| Factura simplificada | RFACT art. 4.1.a | «Cuando su importe no exceda de 400 euros, Impuesto sobre el Valor Añadido incluido» |
| Simplificada, casos de 3.000 € | RFACT art. 4.2 | «podrán igualmente expedir factura simplificada y copia de ésta cuando su importe no exceda de 3.000 euros, Impuesto sobre el Valor Añadido incluido» |
| Retención del 1 %: módulos, y para QUÉ epígrafes IAE | RIRPF art. 95.6.1º y 2º | «Cuando los rendimientos sean contraprestación de una de las actividades económicas previstas en el número 2.º de este apartado y se determine el rendimiento neto de la misma con arreglo al método de estimación objetiva, se aplicará el tipo de retención del 1 por ciento sobre los ingresos íntegros satisfechos.» — el 2.º lista los epígrafes IAE, e incluye literalmente «504.2 y 3 Instalaciones de fontanería, frío, calor y acondicionamiento de aire», «501.3 Albañilería y pequeños trabajos de construcción en general», «505.5 Carpintería y cerrajería» y «505.6 Pintura de cualquier tipo y clase y revestimientos con papel, tejido o plásticos y terminación y decoración de edificios y locales» |
| Retención del 2 %: NO es la de los oficios | RIRPF art. 95.4 y 95.5 | «Cuando los rendimientos sean contraprestación de una actividad agrícola o ganadera, se aplicarán los siguientes porcentajes de retención: 1.º Actividades ganaderas de engorde de porcino y avicultura: 1 por ciento. 2.º Restantes casos: 2 por ciento.» y «Cuando los rendimientos sean contraprestación de una actividad forestal, se aplicará el tipo de retención del 2 por ciento» — agrícola/ganadera/forestal, no construcción/instalaciones |
| Operaciones no sujetas (art. 7): ninguna encaja en un oficio | LIVA art. 7, encabezado y 1.º | «Artículo 7. Operaciones no sujetas al impuesto. No estarán sujetas al impuesto: 1.º La transmisión de un conjunto de elementos corporales y, en su caso, incorporales que, formando parte del patrimonio empresarial o profesional del sujeto pasivo, constituyan o sean susceptibles de constituir una unidad económica autónoma en el transmitente» — el resto de la lista (2.º a 12.º) son muestras gratuitas, relación laboral, Administraciones Públicas, cesiones de dinero: ninguna es la venta ordinaria de un servicio de reforma/instalación |
| Exenciones interiores (art. 20): tampoco | LIVA art. 20.Uno, encabezado y 1.º-5.º | «Artículo 20. Exenciones en operaciones interiores. Uno. Estarán exentas de este impuesto las siguientes operaciones: 1.º Las prestaciones de servicios y las entregas de bienes accesorias a ellas que constituyan el servicio postal universal» — seguido de sanidad (2.º-4.º) y profesiones médicas/sanitarias (5.º): tampoco hay una exención para reformas/instalaciones en la parte revisada |
| Plazo trimestral del modelo 303 | Orden EHA/3786/2008, art. 7.2 | «la presentación de las autoliquidaciones del modelo 303, así como, en su caso, el ingreso o la solicitud de devolución, si corresponde, de la cantidad resultante, se efectuará en los veinte primeros días naturales del mes siguiente a la finalización del correspondiente período de liquidación trimestral, excepto la correspondiente al último período de liquidación del año, que deberá presentarse durante los treinta primeros días naturales del mes de enero siguiente» |

**Cruce con el código (los números coinciden, la aplicación no está cableada):** recargo 5,2 / 1,4 / 0,5 (`recargoEquivalencia.ts:51-64`) ↔ art. 161 · retención 15 y 7 (`retencionIrpf.ts:54`) ↔ art. 95.1 · retención 1 y 2 (`retencionIrpf.ts:54`) ↔ art. 95.4-6, y el 1 % SÍ encaja con los oficios de YaQu (fontanería, albañilería, carpintería/cerrajería, pintura); el 2 % es agrícola/forestal, no un oficio de YaQu · el 40 % de materiales **no existe** en el código.
⚠️ Trampa medida: la primera cita de «15 por ciento» que salió del RIRPF era del **art. 101 (propiedad intelectual)**, no de profesionales; el script no distingue, lo distingue leer el artículo. El art. 95.1 es el correcto para oficios.
⚠️ Las citas de art. 7 y art. 20 son PARCIALES a propósito: se revisó el encabezado completo de cada lista cerrada y los primeros apartados (7.º completo — los 12 apartados —, 20.Uno los 5 primeros de una lista que sigue); ninguno de los revisados aplica a un oficio, y no se transcribió el resto de 20.Uno (sanidad, educación, finanzas, seguros, alquileres de vivienda…) por no ser candidatos plausibles para reformas/instalaciones. Si alguien necesita el 20.Uno completo, se vuelve a bajar la fuente.

## 4 · NO VERIFICADO → pregunta al asesor (propuestas Q-C para `docs/legal/PREGUNTAS_ASESOR.md`, dueño J4)

Cada una: por qué está aquí = el texto no se ha localizado o no basta para decidir. **Nada de esto se implementa hasta responderse.**

| id | pregunta | hoy en el código |
|---|---|---|
| Q-C1 | ~~Reforma de vivienda al 10 %~~ **RESPONDIDA (23-sep-2026) → SCRUM-1052, detalle en `PREGUNTAS_ASESOR.md`.** El 40 % se mide sobre la operación entera, nunca por línea (cita AEAT con enlace, no ⚠). Falta una declaración firmada del cliente para los "2 años" (encaja con la firma que ya existe). **Hallazgo:** mantenimiento de instalaciones (calderas, revisiones) NO es ejecución de obra → 21 % siempre | no existe |
| Q-C2 | ~~ISP en obra~~ **RESPONDIDA (23-sep-2026) → SCRUM-1051, alcance MUY estrechado.** Leyenda exacta «inversión del sujeto pasivo» (art. 6.1.m ROF, dado como verificado por el asesor; mi propio cotejo por WebFetch fue ambiguo en la letra exacta, no se promueve a §3). Sólo aplica si la obra GLOBAL es construcción/rehabilitación (no una reforma de baño) y el destinatario lo comunica expresamente — si no, no hay ISP aunque el cliente sea empresa | no existe |
| Q-C3 | ~~Suplidos~~ **RESPONDIDA (23-sep-2026) → SCRUM-1054.** Tres condiciones acumulativas: factura del tercero A NOMBRE DEL CLIENTE (nunca del profesional), mandato expreso identificando el gasto concreto (una línea genérica "suplidos" no vale), cuantía exacta con justificante | casilla que fuerza IVA 0 |
| Q-C4 | ~~Recargo de equivalencia~~ **RESPONDIDA (23-sep-2026) → SCRUM-1054.** Sólo en entregas de BIENES a un minorista para su tienda; un oficio presta servicios, así que casi nunca aplica — "basta con tener el campo, no un flujo" | dato guardado, no calculado |
| Q-C5 | ~~Retenciones 2 y 1 %~~ **RESPONDIDA por completo (23-sep-2026) → SCRUM-1053/1073, sustituye la parcial del 22-sep.** 🔴🔴 Para este perfil (estimación directa) **la retención en factura EMITIDA es CERO en todos los casos** — el 1 % sólo aplica a módulos. El "5 % en obra" no es retención fiscal: es garantía contractual de pago, no de impuestos. **Necesita decisión del fundador:** ¿se construye el campo igual para un segmento (módulos) que hoy no existe? | 15/7/2/1 cerrada |
| Q-C6 | Criterio de caja: qué fecha cuenta como cobro (`paidAt` vs. fecha real) | usa `paidAt` |
| Q-C7 | ~~Los tipos 2, 5 y 7,5 %~~ **RESUELTA (23-sep-2026).** Son los tipos temporales de alimentos del RDL 4/2024 (oct-dic 2024), ya caducados desde ene-2025. Siguen en el anexo de VeriFactu por facturas históricas. A un oficio no le aplican nunca: admitidos en código pero NO ofrecidos | admitidos |
| Q-C8 | ~~Plazos y modelos trimestrales~~ **RESPONDIDA por el asesor fiscal (23-sep-2026), detalle completo en `PREGUNTAS_ASESOR.md`.** Mapa: **habitual** 303/390/130/100/347 · **excepción** 111+190 (si retiene)/115+180 (si paga alquiler)/349 (si hay UE) · **NUNCA** 131 (es de módulos, excluyente con el 130). El 390 **no** está exonerado (fuente AEAT con enlace); el 347 **no** desaparece con VeriFactu (sólo con SII, incompatible con VeriFactu). Todas las citas de artículo que trae el asesor (RIVA, RIRPF, LIRPF, RGAT) las marcó él mismo ⚠ (de memoria): **NO VERIFICADO** en §3, ninguna se promueve a cita comprobada en esta pasada | 303: solo devengado. 130/111/115/347/390/100/349: no existen |
| Q-C9 | ~~Exento y no sujeto~~ **RESPONDIDA por cita (§3, 22-sep-2026):** se revisó LIVA art. 7 completo (los 12 apartados de no sujeción: transmisión de negocio, muestras gratuitas, relación laboral, Administraciones Públicas…) y art. 20.Uno, encabezado + los 5 primeros apartados (postal, sanidad, profesiones médicas). **Ninguno de los revisados aplica** a la venta ordinaria de un servicio de reforma/instalación. No se transcribió el resto de 20.Uno (~30 apartados más: educación, finanzas, seguros, alquiler de vivienda…) por no ser candidatos plausibles — si el asesor conoce un supuesto concreto de un oficio que SÍ pueda caer en el resto de la lista, se revisa ese apartado puntual | no existen |

Sin fuente descargada todavía: órdenes ministeriales de los modelos 130, 111, 115, 347 y 390 (solo se
localizó y citó la del 303: Orden EHA/3786/2008) — **el 131 se retira de esta lista, no aplica a este
perfil**. Tampoco están descargadas las fuentes de las citas ⚠ del asesor que responden Q-C8: RGAT
(RD 1065/2007, arts. 31-35), ni los artículos nuevos de RIVA (30, 61 *decies*, 71.3, 62.6), RIRPF
(74-76, 100, 107, 109) y LIRPF (99) — LIVA/RIVA/RIRPF/LIRPF ya son fuente en §8 para OTROS artículos,
pero cotejar estos concretos es trabajo aparte, no asumido por tenerlos ya descargados una vez.
Igual para las que responden Q-C1 a Q-C5 y Q-C7 (SCRUM-1106): arts. 170.Dos.2º, 87.Uno, 91.Uno.3.1º,
20.Uno.22º.B, 148-149, 163.Uno y 170.Dos.3º LIVA · art. 24 *quater* y 61 RIVA · art. 76 RIRPF ·
art. 107 LCSP — todas **NO VERIFICADO**. El art. 6.1.m/6.2.b ROF y las páginas de la AEAT sobre
reformas de vivienda las dio el asesor como verificadas hoy por él (se citan como fuente en
`PREGUNTAS_ASESOR.md`), pero **no se promueven aquí**: mi propio cotejo del art. 6 ROF por WebFetch
salió ambiguo en la letra exacta, así que no alcanza el nivel de "comprobada por script" que exige
esta tabla. **Pendiente CON-03** para todo lo anterior.

## 5 · Principios del bloque

1. **Sin claims.** Nada de «cumple», «conforme» ni «Hacienda» en pantalla (regla 7). Lo que YaQu enseña son números de SU base, marcados como tales.
2. **Recibo primero.** Mientras `INVOICING_ES_ENABLED` esté OFF (SIF-1 8/8 pendiente), todo se diseña y prueba en modo recibo sin sello.
3. **Camino de emisión: se LEE** (reglas 38/40). Lo que obligue a modificarlo (CON-08, 09) es STOP y va a J1 con decisión.
4. **Una factura emitida jamás se edita** (regla 29): las correcciones de cifras van por cálculo nuevo, no por reescribir.

## 6 · Backlog (candidatos a ticket; tamaño S = una sesión)

Dueños por `dos-equipos.md` §3: facturas, libros y entrega a la gestoría = **J1**; gastos, Informes = S1 (servidor) / S2 (pantalla); banco y pagos = J2. Ver decisión D6.

### Ola 1 — se empieza YA, sin decisión, sin tocar emisión

| id | título (lenguaje del profesional) | por qué / semilla de aceptación | tam. | depende | dueño | STOP |
|---|---|---|---|---|---|---|
| CON-01 | Confirmar en staging los cuatro fallos de cifras (retención que no se guarda, JUST en el libro, fecha de cobro, gastos sin base) | §1. Aceptación: cada uno «ocurre / no ocurre» corrido con captura; los que ocurren abren su ticket y su línea en `docs/BUGS.md` | S | — | S0 | — |
| CON-02 | Al añadir un gasto, «leer el ticket» de la foto y rellenar los campos | existe en servidor y 0 pantallas lo llaman; Holded `[D]` lo tiene. Aceptación: botón en el alta; el resultado se REVISA antes de guardar; respeta el tope de 5/día | M | — | S2 + S1 | coste IA (ya existe); microcopy: firma |
| CON-03 | Completar las citas de §4 y llevar Q-C1…Q-C9 al asesor | descargar las órdenes de modelos y los artículos que faltan; comprobador a 100 %; una entrada por pregunta en `PREGUNTAS_ASESOR.md` | S | — | S0 + J4 | fiscal (solo lectura) |
| CON-04 | Ver en pantalla las facturas recibidas (hoy solo se descargan) | 426 Finalizada pero solo servidor. Aceptación: tabla con periodo y total, misma pantalla que las emitidas | M | — | J1 | fiscal (libro): pedir a J1 |
| CON-05 | Quitar los textos «[PENDIENTE]» visibles en el libro y el export | `exportView.js:87,90,94,100`. Aceptación: 0 «[PENDIENTE]» en pantalla; textos con firma | S | — | S4 (microcopy) | microcopy con firma |

### Ola 2 — esperan decisión o citas de CON-03

| id | título | nota | tam. | depende | dueño | STOP |
|---|---|---|---|---|---|---|
| CON-06 | Beneficio y gastos del panel separados «con IVA» y «sin IVA» | `reports.routes.ts:72,78`; hoy mezcla | M | CON-01 | S1 | — |
| CON-07 | Resumen del trimestre: IVA repercutido, IVA soportado y diferencia, más retenciones | borrador de trabajo para el asesor, **sin decir «lo que debes»** | M → partir | CON-06, Q-C4/Q-C5 | S1 + S2 | fiscal: solo cálculo interno |
| CON-08 | Tipos de IVA que faltan para el oficio: exento, no sujeto, inversión del sujeto pasivo y el 10 % de reforma de vivienda con aviso del 40 % de materiales | citas §3; una línea al 0 % no se sella hoy | L → partir en 3 | CON-03 (Q-C1, C2, C9) | J1 | **fiscal · camino de emisión** |
| CON-09 | Que la retención, el recargo y los suplidos lleguen al total y al XML | hoy solo se guardan (§1) | L → partir | CON-08, D5 | J1 | **fiscal · camino de emisión** |
| CON-10 | El criterio de caja usa la fecha real del cobro | Q-C6 | S | Q-C6 | J1 | fiscal |

### Ola 3 — grande; solo tras las anteriores

| id | título | nota | tam. |
|---|---|---|---|
| CON-11 | Modelo 303 completo con IVA soportado y resultado, con pantalla | 295 solo devengado y sin pantalla | L → partir |
| CON-12 | Modelos 130 y 111/115 como borrador para el asesor (no se presenta nada) | no existen; primero Q-C8 | L → partir |
| CON-13 | Modelo 347 (operaciones con terceros) | no existe; primero Q-C8 | M |
| CON-14 | Bandeja de gastos con estados (recibido · pendiente · error) | P L104 GRANDE; Holded `escaner-estados-del-documento` | L → partir |
| CON-15 | Lo ya abierto: 322 (E1 envío al asesor) · 323 (E2 plan contable) · 326 (E5 banco) · 276/280 (bloques) | se enlazan, no se duplican | — |

**Descartado por falta de evidencia:** gasto recurrente (ningún competidor citado; solo «no existe» en nuestro código) · contabilidad completa con asientos (D4).

## 7 · Decisiones del fundador (sí/no, con recomendación)

1. **D1 — ¿La v1 de «Contabilidad» es un resumen trimestral de números de SU base (IVA repercutido, soportado, retenciones) como borrador para su asesor, sin presentar nada ante la AEAT?** Recomiendo **sí**.
2. **D2 — ¿Los modelos 130/111/115/347 salen solo como borrador pre-rellenado para el asesor y solo tras CON-03?** Recomiendo **sí**.
3. **D3 — ¿Se lleva Q-C1…Q-C9 a la próxima cita con el asesor?** Recomiendo **sí**: sin esas respuestas CON-08/09 no se pueden construir.
4. **D4 — ¿La contabilidad completa (plan contable, asientos) queda fuera de la v1?** Recomiendo **sí, fuera**; el puente es E2 (323). El veto «no es ERP» está retirado, pero el trabajo no cabe en esta v1.
5. **D5 — ¿Los tickets que tocan el camino de emisión (CON-08, 09) avanzan solo en modo recibo, sin sello y sin claims, hasta SIF-1 8/8?** Recomiendo **sí**.
6. **D6 — ¿El equipo de Luis construye en ficheros de J1 (libros, facturas) con revisión de J1 para lo que no toque emisión?** Recomiendo **sí** (mismo criterio que D1 del CRM).

## 8 · Fuentes y población

Bajadas con GET público el 21-sep-2026 ~15:05 (LIVA/RIVA/LIRPF/RIRPF/RFACT) y el 22-sep-2026 ~11:15 (las cinco anteriores, re-bajadas para esta pasada, + ORDEN303 nueva); reloj local, ≈5 min por delante de GitHub. Texto consolidado del BOE; **fecha de última actualización del consolidado: no anotada**. SHA-256 (16 primeros) del HTML tal cual se guardó — **cambia en cada descarga** (la página de BOE incluye contenido dinámico ajeno al articulado: los SHA de abajo son de la descarga del 22-sep, no comparables con una tirada anterior).

| fuente | dirección | SHA-256 (16, descarga 22-sep-2026) |
|---|---|---|
| LIVA · Ley 37/1992 | https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740 | `585B54E95E3091AC` |
| RIVA · RD 1624/1992 | https://www.boe.es/buscar/act.php?id=BOE-A-1992-28925 | `5D6FEBDA72A74C15` |
| LIRPF · Ley 35/2006 | https://www.boe.es/buscar/act.php?id=BOE-A-2006-20764 | `06D66CEF8305A4B7` |
| RIRPF · RD 439/2007 | https://www.boe.es/buscar/act.php?id=BOE-A-2007-6820 | `64D429A3E3810C42` |
| RFACT · RD 1619/2012 | https://www.boe.es/buscar/act.php?id=BOE-A-2012-14696 | `DCB4D501BF9F0355` |
| ORDEN303 · Orden EHA/3786/2008 | https://www.boe.es/buscar/act.php?id=BOE-A-2008-20953 | `0ECC0332CC06D7B6` |

**Nota de método.** Las **26 citas** de la §3 (todo lo que va entre comillas angulares) se comprobaron contra los ficheros bajados: **26 de 26 aparecen literales** (salvo espacios, saltos de línea y comillas tipográficas) — 16 verificadas el 21-sep, 10 nuevas el 22-sep (SCRUM-1039). Población de texto por fuente, en caracteres: LIVA 748.965 · RIVA 445.672 · LIRPF 832.142 · RIRPF 481.395 · RFACT 106.999 · ORDEN303 48.793. El comprobador lleva **control negativo**: una cita alterada a propósito (21 → 1021 por ciento) sale como no encontrada y la original sí; código de salida 0 (22-sep-2026). Uso: `node docs/verificacion/comprobar-citas-contabilidad.mjs docs/producto/CONTABILIDAD.md <carpeta con LIVA.html RIVA.html LIRPF.html RIRPF.html RFACT.html ORDEN303.html>`.
Los ficheros no están en git; se bajan de las direcciones de arriba con el nombre indicado.
⚠️ Trampa medida (22-sep-2026): el ellipsis de cita **solo puede usarse cuando el hueco es tipográfico**, no para elidir texto legal real — el comprobador borra la marca y exige que el resto sea una subcadena CONTINUA del original. Las primeras 5 citas nuevas usaban «(…)» para saltarse frases enteras de la ley y el comprobador las marcó `NO ENCONTRADA`, correctamente: se rehicieron citando el tramo contiguo completo.

## 9 · Lo que falta para cerrar este entregable

1. Crear los tickets de §6 (5 + 5 + 5) con `listo-para-construir` + `equipo-luis` + `area-*`, enlazar 276/280/322/323/326/293-296/325 y colgar de 276 (fiscal) y 280 (gestoría).
2. Una sola lista D1-D6 como comentario en SCRUM-1012 (junto a la del CRM).
3. Ejecutar CON-03 (citas pendientes) antes de tocar CON-07 en adelante.
4. Empujar la rama `scrum-1012-diseno-crm-contabilidad` (hoy solo commit local).
