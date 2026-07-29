# Expediente fiscal — Facturas de anticipo (P1-P5) y factura recapitulativa (P6-P10)

> **BORRADOR para revisión profesional. No es asesoramiento fiscal.** Preparado por Claude
> Code a partir de las 10 preguntas ya formuladas y agendadas en
> [`docs/Srpint Scrum/SESION_ACTUAL_SCRUM-16.md`](../Srpint%20Scrum/SESION_ACTUAL_SCRUM-16.md)
> (P1-P5, "Agenda fiscal", 17-jul-2026) y
> [`SESION_ACTUAL_SCRUM-17.md`](../Srpint%20Scrum/SESION_ACTUAL_SCRUM-17.md) (P6-P10,
> "Agenda fiscal pendiente", 17-jul-2026) — que a su vez recogen los comentarios de Jira
> SCRUM-16 (16-jul-2026) y SCRUM-17 (16-jul-2026), regla 32 del master (dictamen archivado
> ANTES de activar nada a reales). Objetivo: para cada pregunta, dar el articulado aplicable,
> las consultas DGT localizadas y las interpretaciones posibles con sus consecuencias, **para
> que el asesor CONFIRME o CORRIJA — no para que investigue desde cero.**
>
> **Nada de esto se activa a merchants reales sin el dictamen firmado (regla 32) + SIF-1 8/8.**
> Todo el código asociado nace LATENTE tras `INVOICING_ES_ENABLED=OFF` (ver los briefs de
> SCRUM-16/17 para el detalle técnico — este documento es su complemento legal, no lo repite).
>
> **Dónde falté a una fuente primaria:** cuando no localicé una consulta DGT específica sobre
> el punto exacto, lo digo explícitamente y doy los términos de búsqueda para que el asesor
> (con acceso a bases de datos fiscales completas) la localice más rápido que yo con búsqueda
> web abierta.

---

## Parte A — Factura de anticipo (art. 75.Dos Ley 37/1992)

### Marco común a P1-P5

**Art. 75.Uno.1º LIVA** (regla general): el devengo se produce cuando los bienes se ponen a
disposición del adquirente o, en servicios, cuando se prestan, ejecutan o efectúan.
**Art. 75.Dos LIVA** (regla especial, la que activa este expediente): *"No obstante lo
dispuesto en el apartado anterior, en las operaciones sujetas a gravamen que originen pagos
anticipados anteriores a la realización del hecho imponible el impuesto se devengará en el
momento del cobro total o parcial del precio por los importes efectivamente percibidos."*

Consecuencia estructural que condiciona P1-P5: **el devengo va ligado al cobro efectivo, no a
la emisión del documento ni a la firma del presupuesto.** Cualquier diseño que fecha/declara
el anticipo por un momento distinto al cobro real está, en principio, mal alineado con la
norma — este es el hilo conductor de las 5 preguntas.

### P1 · Momento de emisión de la factura de anticipo

> *¿Al generar el cobro del tramo (hoy la Invoice nace `pending` antes de cobrar) o SOLO al
> confirmarse el cobro? Si es al cobro: ¿qué documento viaja antes con el enlace de pago? ¿Y
> qué fecha manda para el 303: emisión, cobro (`paidAt`) o un `devengoAt` congelado?*

**Articulado:** art. 75.Dos LIVA (devengo = cobro) + **art. 11 del Reglamento de facturación
(RD 1619/2012)**, que fija el plazo de expedición de la factura *a partir de* que se produce
el devengo conforme al art. 75 LIVA — es decir, el reglamento asume que la factura se expide
**después de** (o en el momento de) producirse el devengo, no antes.

**Consultas DGT localizadas:** el patrón se repite en varias vinculantes sobre pagos
anticipados (p. ej. **V1746-19**, 09-07-2019; **V0946-17**, 17-04-2017; **V0815-22**,
19-04-2022 — todas vía [Iberley](https://www.iberley.es); no cito el texto completo porque no
lo he verificado línea a línea, solo el patrón doctrinal que resumen fuentes secundarias
fiables). El patrón constante: *"producido el devengo del impuesto conforme al artículo 75,
deberá expedirse la correspondiente factura en los plazos previstos en el artículo 11 del
Reglamento de facturación"* — el devengo antecede a la factura, no al revés.

**Interpretaciones posibles:**

1. **(Recomendada) El documento que "viaja antes" del cobro (el enlace de pago del tramo) NO
   es fiscalmente una factura** — es un presupuesto/solicitud de pago sin efectos de IVA. La
   **factura de anticipo real** (con huella VeriFactu, serie fiscal, leyenda 75.Dos) solo se
   genera/fecha **al confirmarse el cobro** (`paidAt`), que es también la fecha que manda para
   el modelo 303 (el trimestre de `paidAt`, no el de creación del tramo). Consecuencia técnica
   directa: en `emission.service.ts`/el `Invoice` que hoy nace `pending` *antes* de cobrar,
   para el modo `fiscal` habría que separar "solicitud de cobro" (sin serie fiscal, sin
   VeriFactu) de "factura de anticipo" (creada/fechada en el webhook de confirmación de pago),
   en vez de mutar un mismo documento `pending→paid`. Si se añade `devengoAt`, debe ser
   **igual a `paidAt`**, no a la fecha de creación del registro.
2. **(Alternativa más laxa, mayor riesgo)** Se mantiene la factura desde `pending`, y se
   entiende que la fecha de emisión puede preceder ligeramente al cobro si el cobro es
   inminente/cierto (práctica tolerada por algunos gestores en operaciones con cobro casi
   simultáneo). Riesgo: si el cobro se retrasa o no llega (tarjeta rechazada, Bizum caducado),
   queda una "factura" fiscal por un devengo que nunca ocurrió — habría que anularla (R1),
   generando ruido. Dado que YaQu ya modela `pending`/`paid`/`expired` como estados de cobro,
   esta alternativa choca con la regla 29 (inmutabilidad) si el estado cambia tras `paid`.

**Consecuencia práctica:** la interpretación 1 es la más defendible y además es la que menos
fricción tiene con el código ya existente (que YA distingue el vehículo de cobro `pending` del
hecho `paid`) — pero cambia el diseño: la factura fiscal de anticipo nace en el evento de
cobro, no antes.

### P2 · Serie propia o compartida con F1

> *¿Anticipos en la MISMA serie anual que las F1, o serie propia (tipo `2026-CF-A-…`)?*

**Articulado:** **art. 6.1.a) RD 1619/2012** permite series separadas cuando estén
"justificadas por criterios objetivos" (RRSIF no define un `TipoFactura` específico de
"anticipo": una factura de anticipo se remite como **F1 ordinaria**, igual que cualquier otra
factura completa — el catálogo de `TipoFactura` de VeriFactu distingue F1/F2/F3 y R1-R5, pero
no "anticipo").

**Consultas DGT:** no localicé una vinculante que fije una regla específica sobre la serie de
los anticipos (es coherente con que sea, precisamente, una elección de política interna y no
una obligación legal). Términos para que el asesor busque directamente: *"numeración series
distintas facturas anticipo criterios objetivos art 6 RD 1619/2012"*.

**Interpretaciones y consecuencias:**
1. **Serie propia** (p. ej. `2026-CF-A-001`, igual que ya se hace con `2026-CF-R-…` para
   rectificativas): sin obligación legal de hacerlo así, pero con la misma justificación
   objetiva que ya se usó para separar las R — mejora la trazabilidad y el filtro en
   inspección (`PACK_GESTORIA.md` runbook R13). **Coste:** una nueva serie que gestionar en
   `invoiceNumber.service.ts`.
2. **Misma serie que F1:** legalmente correcto también (un anticipo es una F1 más); más simple
   de implementar (reutiliza `allocateInvoiceNumber` sin rama nueva). El **inconveniente** es
   de negocio, no legal: mezclar anticipos con facturas ordinarias/finales en la misma serie
   dificulta auditar visualmente "cuántos anticipos pendientes de deducir hay".

No hay una respuesta legalmente correcta única — es una decisión de diseño con un mínimo legal
(ambas cumplen), a decidir por preferencia operativa.

### P3 · Factura final a 0 € — ¿obligatoria si el 100 % ya se anticipó?

> *Si el 100 % se anticipó en tramos, ¿es obligatoria una factura final consolidada a 0 € con
> las deducciones, o basta con los anticipos ya emitidos?*

**Articulado:** no hay un artículo que imponga expresamente una "factura final a 0 €". La
lógica del art. 75 es que **cada devengo se factura una vez**: si el 100 % del precio ya se
devengó (y facturó) vía anticipos sucesivos, en el momento de completarse el servicio **no
queda ningún importe adicional que devengue** (art. 75.Uno solo activa un devengo nuevo por el
importe que *no* haya sido ya objeto de pago anticipado). Formalmente, no habría un nuevo
hecho imponible que facturar.

**Consultas DGT:** no localicé una vinculante que resuelva este punto exacto (factura final a
0 € cuando el 100 % ya se anticipó). Términos de búsqueda sugeridos para el asesor:
*"factura final importe cero anticipos totales devengo consulta DGT"* / *"cierre operación
100% anticipada factura recapitulativa cero euros"*.

**Interpretaciones y consecuencias:**
1. **(Interpretación legal estricta) No es obligatoria.** Si cada anticipo ya fue facturado
   correctamente (base + cuota al cobro), la obra terminada no genera un devengo nuevo por
   importe cero — no hay "operación" que facturar. Consecuencia: el cierre del Job podría
   documentarse con un **albarán firmado** (documento no fiscal, ya existente en el producto)
   sin necesidad de una Invoice adicional.
2. **(Práctica recomendada, no obligatoria)** Emitir igualmente una factura F1 a 0 € que
   **referencie** número, fecha, base y cuota de cada anticipo — por claridad documental y
   para dar al cliente un cierre único y trazable, tal y como ya se apunta como alcance V1 en
   `SESION_ACTUAL_SCRUM-16.md` §3.3 ("factura final… también la final a 0 €, según P3"). El
   **riesgo de NO hacerlo** no es de incumplimiento legal, sino de trazabilidad ante una
   inspección: sin un documento de cierre, reconstruir "estos 3 anticipos + este albarán =
   esta obra completa" depende de que los anticipos referencien bien el Job/presupuesto.

**Recomendación de producto (a confirmar):** dado que el coste de emitir la F1 a 0 € es bajo y
el beneficio de trazabilidad es alto, mantener el plan V1 (factura final, a 0 € cuando
proceda) salvo que el asesor prefiera evitar emitir documentos con importe cero por otras
razones (p. ej. práctica de su software de gestoría).

### P4 · Rectificación cruzada — anticipo ya deducido en una final emitida

> *Si se rectifica (R1) un anticipo YA deducido en una final emitida, ¿cómo se refleja?*

**Articulado:** **art. 15 RD 1619/2012** (facturas rectificativas): toda rectificativa debe
identificar la factura que rectifica (número/serie) y consignar la rectificación de las bases/
cuotas. **Regla 29 del master** (inmutabilidad: una factura emitida no se edita ni borra, solo
R1) ya adopta el mismo principio.

**Consultas DGT:** relevante aquí **V0706-19** (28-03-2019, vía
[SuperContable](https://www.supercontable.com/informacion/IVA_Impuesto_valor_a%C3%B1adido/Consulta_DGT_no_V0706-19.Consideracion_de_factura_.html) /
[Iberley](https://www.iberley.es/resoluciones/resolucion-vinculante-dgt-v0706-19-28-03-2019-1523540)):
confirma que una rectificación mediante **dos facturas** — una con signo negativo que anula
el importe original (considerada factura *ordinaria*, no rectificativa) y otra con el importe
correcto (esa sí, la rectificativa) — es una práctica válida y coherente con la doctrina de la
DGT. Esto es exactamente el patrón que YaQu ya usa (líneas negativas + `calcVatBreakdown`
soporta negativos, según el recon de SCRUM-16).

**Interpretaciones y consecuencias:**
1. **(Recomendada) Rectificación en cascada obligatoria, bloqueada si no es atómica.** Si el
   anticipo A ya fue deducido (línea negativa) en la final F, y hay que corregir A: (a) se
   emite R1 de A con el importe correcto: (b) **la final F también debe rectificarse** (su
   línea de deducción del anticipo A referenciaba un importe que ya no es el vigente) — es
   decir, **una operación de rectificación de A que ya está deducida en F debe forzar
   también una R1 de F**, no permitirse suelta. Esto no es una opción de diseño: si no se
   encadena, la final F queda con una deducción incorrecta y la base declarada en el 303 de
   ese trimestre sería errónea.
2. **Alternativa (bloqueo total):** prohibir directamente rectificar un anticipo que ya conste
   deducido en una final emitida — obligar a rectificar primero la final (liberando/anulando
   la deducción) y solo entonces permitir la R1 del anticipo. Operativamente más simple de
   implementar como guarda (un solo camino en vez de una transacción de dos rectificativas
   encadenadas), aunque más restrictivo para el usuario.

**Para el asesor:** confirmar si la cascada debe ser automática/atómica (interpretación 1,
mejor UX pero más código) o si basta con bloquear y pedir al usuario que rectifique la final
primero (interpretación 2, más simple). Es una decisión de producto una vez confirmado que
**alguna** de las dos rectificativas es obligatoria (eso sí es innegociable: no puede quedar
una factura con una deducción a un importe que ya no existe).

### P5 · Leyenda y menciones mínimas

> *Texto legal exacto de la leyenda "factura de anticipo — art. 75.Dos LIVA" y referencias
> obligatorias en la final.*

**Articulado:** **art. 6.1.b) RD 1619/2012** exige, entre el contenido obligatorio de toda
factura completa, *"la fecha en que se hayan efectuado las operaciones... o en la que, en su
caso, se haya recibido el pago anticipado, **siempre que se trate de una fecha distinta a la
de expedición de la factura**"*. Es decir: la ley exige un **dato** (la fecha del cobro
anticipado si difiere de la fecha de expedición), **no una leyenda con redacción concreta**.
No hay, en LIVA ni en RD 1619/2012, un texto legal obligatorio equivalente a la leyenda
VeriFactu ("Factura verificable en la sede electrónica de la AEAT...", esa sí mandatada
literalmente por el RRSIF) para las facturas de anticipo.

**Consultas DGT:** no localicé una vinculante que fije una redacción obligatoria de leyenda
para anticipos (coherente con que la ley solo pide el dato, no una frase). Términos para el
asesor: *"mención obligatoria factura anticipo fecha pago anticipado artículo 6.1.b RD
1619/2012"*.

**Interpretaciones y consecuencias:**
1. **(Recomendada) No hay leyenda obligatoria** — lo obligatorio es el **contenido**: fecha del
   cobro (si distinta de la de expedición) + descripción que dé a entender que es un pago a
   cuenta de una operación mayor (para que el destinatario y un inspector entiendan qué
   documenta). Una leyenda tipo *"Anticipo a cuenta de [descripción], conforme al art. 75.Dos
   de la Ley 37/1992"* es **buena práctica recomendable**, no un requisito legal — YaQu puede
   incluirla libremente sin que su ausencia sea, por sí sola, un defecto legal si el resto del
   contenido es correcto.
2. **Referencias en la final:** identificar cada anticipo descontado (número, fecha, base,
   cuota) en la factura final **no es, técnicamente, una "rectificación"** en el sentido del
   art. 15 (el anticipo sigue siendo válido, solo se está compensando), así que no le aplican
   literalmente los requisitos de identificación de facturas rectificativas — pero es la única
   forma práctica de que la final sea auditable (y de defender ante una inspección que el
   importe total no se ha duplicado). Recomendación: tratarlo como contenido mínimo de facto
   aunque no esté impuesto letra por letra.

---

## Parte B — Factura recapitulativa (art. 13 RD 1619/2012)

### Marco común a P6-P10

**Art. 13 RD 1619/2012:** permite incluir en una única factura operaciones realizadas en
distintas fechas para un mismo destinatario, **siempre que todas caigan dentro del mismo mes
natural**. El plazo de expedición depende de quién sea el destinatario — este dato es
justamente el núcleo de P6.

### P6 · Plazo de expedición y NIF del destinatario

> *¿Fecha límite de expedición? ¿Exige NIF completo del destinatario?*

**Articulado:** **art. 13 RD 1619/2012** (plazo) + **art. 11 RD 1619/2012** (plazo general,
aplicable por remisión quien sea empresario/profesional) + **art. 6 y 7 RD 1619/2012**
(contenido de factura completa vs. simplificada).

**Plazo — dos regímenes distintos según destinatario** (coherente entre varias fuentes
secundarias consultadas):
- **Destinatario particular (consumidor final):** plazo = **último día del mes natural** en
  que se realizaron las operaciones documentadas.
- **Destinatario empresario/profesional:** plazo = **antes del día 16 del mes siguiente** a
  aquel en que se hayan realizado las operaciones (mismo criterio que el art. 11 general).

Dado que los clientes finales de los profesionales de YaQu son mayoritariamente
**particulares** (SCRUM-17: "el pro selecciona varios partes... para el cliente"), el plazo
aplicable con más frecuencia es previsiblemente el **más corto** (fin del mes natural, no
día 16 del siguiente) — esto es más estricto de lo que el diseño actual (`SESION_ACTUAL_SCRUM-17.md`,
sin gate de plazo explícito en el endpoint `consolidar-albaranes`) contempla hoy. **Punto para
el asesor: confirmar el plazo aplicable a particulares y si el producto necesita un aviso/gate
cuando el profesional intenta consolidar operaciones de un mes ya cerrado.**

**NIF del destinatario:** para una **factura completa (F1)** — que es lo que es una
recapitulativa por defecto, ya que RRSIF no tiene un `TipoFactura` de "recapitulativa" propia
— el **art. 6.1.e) RD 1619/2012** exige el NIF del destinatario. Para una **factura
simplificada (F2)**, el NIF **no es obligatorio salvo que el destinatario lo exija** para
ejercer un derecho de naturaleza tributaria (deducción, etc.) — consistente con lo que ya
recoge `PACK_GESTORIA.md` (F1 exige NIF; sin NIF → F2, límite 400 €).

**Hallazgo con consecuencias grandes — verificar antes de asumir el límite de 400 €:** el
**art. 4.1 RD 1619/2012** permite factura simplificada hasta **3.000 € IVA incluido** (en vez
del límite general de 400 €) para una **lista cerrada** de actividades — según las fuentes
consultadas incluye ventas al por menor/ambulantes, hostelería y restauración, transporte de
personas, aparcamientos, peluquerías, tintorerías, entre otras. Alguna fuente secundaria
menciona también "servicios prestados a domicilio del consumidor" dentro de esa lista, **pero
no he podido verificar con una fuente primaria (texto del RD 1619/2012 en el BOE) si esa
categoría cubre específicamente servicios de reparación/instalación (fontanería,
electricidad, reformas) a domicilio, o si se refiere a otra cosa (p. ej. reparto de
mercancías).** **Esto es la pregunta de mayor impacto económico de todo el expediente**: si el
vertical de YaQu **sí** entra en la lista del art. 4.1, la mayoría de los trabajos de un
fontanero/electricista podrían facturarse como F2 (simplificada) hasta 3.000 € **sin
necesitar el NIF del cliente final** — eliminando gran parte de la fricción "el cliente no
quiere dar su NIF" que ya preocupaba en `PACK_GESTORIA.md`. Si **no** entra, se mantiene el
límite general de 400 € y el NIF vuelve a ser prácticamente imprescindible para cualquier
recapitulativa de importe medio/alto. **Pedir al asesor que consulte el texto literal del art.
4.1 RD 1619/2012 (BOE-A-2012-14696) y confirme si el vertical de oficios a domicilio de YaQu
encaja en alguna de las 14 categorías de la lista.**

### P7 · Qué fecha define el mes natural, y cuándo se congela

> *¿`Albaran.fecha` (visita/entrega)? ¿Congelada en qué momento? ¿O `firmadoAt`?*

**Articulado:** el mes natural del art. 13 se refiere al mes de las **operaciones**
documentadas — y "operación", a efectos de devengo de servicios, es el momento en que el
servicio **se presta/ejecuta** (art. 75.Uno.2º LIVA), no el momento en que se firma un
documento que la acredita.

**Consultas DGT:** no localicé una vinculante que distinga explícitamente "fecha de
realización" vs. "fecha de firma de aceptación" en el contexto específico de partes de trabajo
firmados electrónicamente — es un punto bastante específico del modelo de YaQu (albarán +
firma remota). Términos para el asesor: *"fecha operación factura recapitulativa mes natural
devengo servicios artículo 75 uno 2"*.

**Interpretación recomendada:** la fecha que debe gobernar la agrupación por mes natural es la
**fecha de realización/entrega del servicio** (`Albaran.fecha`), no `firmadoAt`. La firma es
un acto **probatorio** (acredita la aceptación/conformidad), no el hecho imponible en sí —
mezclar ambas fechas podría llevar a agrupar en el mes equivocado si una firma remota se
produce días después de la visita (SCRUM-49: firma remota por WhatsApp). Esto coincide con la
premisa ya asumida en el recon de SCRUM-17 ("`Albaran.fecha` YA está congelada de facto").
**Congelación:** debe fijarse, como muy tarde, en el momento en que el albarán pasa a
`firmado` (deja de ser editable) — coherente con el candado ya existente
(`albaran_locked`), sin necesitar trabajo adicional.

### P8 · Valoración de los albaranes (precios internos sin validez fiscal)

> *¿Puede el albarán llevar precios/IVA internos y seguir siendo documento no fiscal?*

**Nota del propio brief de SCRUM-17:** *"resuelto por SCRUM-65 en la práctica — el albarán
VALORADO lleva precios y sigue sin validez fiscal; queda confirmar el criterio con el
asesor."* No hay controversia legal aquí: un documento mercantil (albarán/parte de trabajo)
puede mostrar importes informativos sin ser una factura, siempre que no se presente como tal
(no lleve numeración de serie fiscal, ni IVA repercutido formalmente, ni sea el documento que
se declara). **Interpretación:** confirmar simplemente que el diseño actual (precios visibles,
sin serie fiscal, sin remisión a VeriFactu) es correcto — pregunta de confirmación rápida, no
de interpretación abierta.

### P9 · TipoFactura de VeriFactu para la recapitulativa

> *¿F1 con el periodo y las operaciones en `DescripcionOperacion`? ¿Forma exacta de
> referenciar las operaciones agrupadas?*

**Articulado:** RRSIF (RD 1007/2023 + Orden HAC/1177/2024) — el catálogo `TipoFactura` no
tiene un valor específico "recapitulativa"; una recapitulativa se registra como **F1** (o F2
si fuera simplificada), igual que cualquier factura completa que agrupe varias líneas.

**Naturaleza mixta de esta pregunta:** la parte "¿es F1?" es una cuestión de encaje **legal**
(confirmada arriba). La parte "forma exacta de referenciar las operaciones agrupadas en el XML
del registro de alta" es sobre todo una cuestión **técnica de esquema** (cómo rellenar
`DescripcionOperacion` y el desglose), más propia de `docs/SIF_SPEC_NOTES.md` y de la
especificación técnica de la Orden HAC/1177/2024 que de una consulta DGT — **recomiendo
tratarla en el expediente técnico de SIF-1, no bloquear el dictamen fiscal por este punto.**
Lo único que el asesor necesita confirmar aquí es que **no existe obligación de desglosar cada
albarán como una operación VeriFactu independiente** — basta con una única factura F1 con
`DescripcionOperacion` que identifique las operaciones agrupadas (coherente con el plan de
`Invoice.albaranRefs`).

### P10 · Anulación (R1) de una recapitulativa — ¿libera los albaranes?

> *¿Los albaranes quedan LIBERADOS para re-consolidar, o LIGADOS a la anulación?*

**Articulado:** ninguno directamente — el art. 15 RD 1619/2012 regula cómo se rectifica/anula
una factura, pero **no dice nada** sobre qué debe pasar con los documentos internos (albaranes)
que la originaron; eso es un diseño de producto, no una obligación fiscal.

**Único punto donde SÍ hay una restricción legal:** si se decide liberar los albaranes para
re-consolidarlos en una **nueva** factura, esa nueva factura sigue sujeta a la misma regla del
mes natural (P7) según las fechas **originales** de los albaranes (no la fecha de la
re-consolidación) — no se "resetea" el mes solo por anular y re-emitir.

**Interpretación recomendada:** dado que no hay obligación legal de liberar, y que la decisión
ya tomada para V1 (`SESION_ACTUAL_SCRUM-17.md` §2: *"en V1 no se implementa liberación; si se
anula una recapitulativa, los albaranes quedan ligados y se reporta como pendiente"*) es la
opción más simple y de menor riesgo (evita re-aplicar P7/P6 dos veces), **no hace falta
dictamen del asesor para bloquear esta decisión de producto** — solo confirmar que, el día que
se implemente la liberación (fuera de V1), la nueva factura deberá seguir agrupando por las
fechas originales de los albaranes.

### P11 · Factura completa a cliente SIN NIF: ¿marcarla «sin identificar destinatario» o emitirla como simplificada (F2)?

> *Nuestro cliente-tipo es un particular que muchas veces no da NIF. Hoy toda factura sale
> como **F1**. ¿Se puede emitir F1 sin identificar al destinatario marcándola como tal, o ese
> caso obliga a emitir **F2 simplificada**?*

**Articulado:** art. **6.1.d) RD 1619/2012** (contenido de la factura completa: identificación
del destinatario) frente a los arts. **4 y 7 RD 1619/2012** (supuestos y contenido de la
factura simplificada; art. 7.2 y 7.3 para la simplificada *cualificada*, la que sí identifica
al destinatario). Enlaza con **P6**, que ya dejó abierto el umbral de 3.000 € del art. 4.1.

**Por qué la pregunta es técnica además de fiscal:** el esquema oficial de VeriFactu
(`SuministroInformacion.xsd`) **prevé expresamente las dos salidas**, y sus nombres citan el
articulado:

- `FacturaSinIdentifDestinatarioArt61d` — factura **completa** SIN identificación del
  destinatario, marcada como tal.
- `FacturaSimplificadaArt7273` — factura **simplificada** cualificada.

Es decir: la AEAT contempla en el propio registro que exista una F1 sin destinatario
identificado. Lo que el esquema **no** dice es *cuándo* es lícito usar cada una — eso es el
Reglamento, y es lo que necesitamos confirmado.

**Estado en el producto (verificado, SCRUM-145):** hoy el registro **omite** el bloque
`Destinatarios` cuando el cliente no tiene NIF (es válido contra el esquema: el bloque es
`minOccurs="0"`), y **no** se marca ninguno de los dos indicadores — a propósito, porque
elegirlos es una calificación fiscal que no se inventa en código. El emisor está preparado
para cualquiera de las dos salidas.

**Lo que necesitamos del asesor (decide alcance de producto):**

1. ¿El caso «particular sin NIF» debe emitirse como **F2 simplificada** (y entonces hay que
   comprobar los límites del art. 4: 400 € / 3.000 € según actividad — ver P6), o basta con
   **F1 marcada** `FacturaSinIdentifDestinatarioArt61d`?
2. Si la respuesta es F2: ¿qué pasa cuando el importe **supera** el límite del art. 4? Ahí sí
   habría que **exigir el NIF en el producto** (gap de DATOS: hoy el alta de cliente no lo
   pide obligatoriamente).

**Impacto:** alto en producto. De esta respuesta depende si hay que pedir NIF al cliente final
en el flujo de cobro (fricción en el paso más delicado) o no.

### P12 · Nuestras rectificativas (R1): ¿«por sustitución» (S) o «por diferencias» (I)?

> *El registro de VeriFactu pide `TipoRectificativa` con dos valores posibles. ¿Cuál
> corresponde a cómo rectificamos hoy?*

**Articulado:** art. **15 RD 1619/2012** (facturas rectificativas) y art. **80 LIVA** (supuestos
de modificación de la base imponible). El Reglamento exige que la rectificativa refleje los
datos rectificados, pero la elección entre **sustitución** y **diferencias** determina *qué
importes* se consignan.

**Consecuencia técnica directa (no es cosmética):** el esquema oficial define
`TipoRectificativa` (`S` = por sustitución · `I` = por diferencias) y, ligado a él,
`ImporteRectificacion` — de modo que la elección cambia **qué se remite a la AEAT**, no solo
una etiqueta.

**Estado en el producto (RE-MEDIDO el 29-jul-2026 en SCRUM-216 — corrige lo que este mismo
apartado afirmaba):** hoy la R1 se emite con `FacturasRectificadas` (identificando la factura
original) y **no** emite `TipoRectificativa` ni `ImporteRectificacion`. Los dos son
`minOccurs="0"` en el esquema, así que el registro es estructuralmente válido — y aun así la
AEAT lo rechaza, porque omitir un campo que el esquema permite ausente pero la validación
exige no es abstenerse: es garantizar el rechazo.

> **1114** · *«Si la factura es de tipo rectificativa, el campo TipoRectificativa debe tener
> valor.»* No es una calificación incompleta: es un rechazo seguro **en cada rectificativa**.

> ⚠️ **LA PREMISA DE LA QUE PARTÍA ESTE APARTADO NO SE SOSTIENE.** Decía que nuestras R1
> «consignan el total corregido», lo que apuntaba a **S (por sustitución)**. El código hace lo
> contrario, y nadie lo volvió a comprobar desde que se escribió. Al medirlo aparecen **tres
> fuentes que no dicen lo mismo**:
>
> | Fuente | Qué dice | Apunta a |
> |---|---|---|
> | **El código** · `invoicesAdmin.routes.ts` crea la R1 con `total: (-Number(original.total)).toFixed(2)` y las líneas con el precio negado | El **delta** (la original negada), no el total corregido | **I** |
> | **Este expediente** · P12, redactado el 23-jul-2026: «consignan el total corregido» | El total corregido | **S** |
> | **`registro.builder.ts`** · `tipoRectificativa?: 'S' \| 'I'; // YaQu usa 'I' (incremental: líneas en negativo) [VALIDAR asesor S1-F]` | Incremental — marcado para validar desde S1-C y **nunca validado** | **I** |
>
> Y una cuarta señal, hoy inerte pero cargada: `buildRegistroAlta()` emite
> `${p.tipoRectificativa ?? 'I'}` — un **'I' por defecto cableado**. Hoy no lo llama ningún
> código de producción (solo un test), así que no sale nada a la AEAT; el día que alguien lo
> cablee, saldría una calificación fiscal elegida por un valor por defecto, sin dictamen y sin
> que nadie se entere.

**Lo que necesitamos del asesor** — la pregunta 1 cambia: ya no se pregunta por una premisa,
se pregunta por el hecho medido:

1. Nuestras R1 se crean hoy **negando la original** (total y líneas en negativo), es decir
   consignando **el delta**. ¿Eso es «por diferencias» (**I**), como parece? ¿O el criterio
   correcto para nuestro caso es «por sustitución» (**S**), y entonces lo que hay que cambiar
   no es cómo se declaran sino **cómo se crean**?
2. Si la respuesta es **S**: ¿qué lleva exactamente `ImporteRectificacion` (base y cuota
   **rectificadas**, las de la factura original que se sustituye)? Es **obligatorio** —
   **1118** · *«Si la factura es de tipo rectificativa por sustitución el bloque
   ImporteRectificacion es obligatorio.»*— y hoy no se calcula en ninguna parte.
3. Si la respuesta es **I**: confirmar que `ImporteRectificacion` **no** debe ir —
   **1119** · *«Si la factura no es de tipo rectificativa por sustitución el bloque
   ImporteRectificacion no debe tener valor.»*— y que las R1 de hoy encajan tal cual.
4. ¿Cambia la respuesta según el motivo (error de datos vs. modificación de base imponible del
   art. 80 LIVA — impago, devolución, descuento posterior)?

**Impacto: ALTO — mayor de lo que decía este expediente.** No bloquea la emisión local, pero
(a) **toda** rectificativa que se remitiese hoy sería rechazada con 1114, y (b) si la respuesta
es **S**, no basta con declarar distinto: **hay que cambiar cómo se crean las R1** (pasarían a
consignar el total corregido en vez del negativo). Eso es trabajo de producto, no un flag.

**Mientras no haya dictamen (mecanismo de SCRUM-216):** ninguna R1 se declara — se excluye del
registro y se reporta con su número y su motivo. Nunca se emite sin `TipoRectificativa` (sería
un 1114 seguro) ni con un valor elegido por el código. La R1 en sí no está bloqueada: se emite,
se entrega y se cobra igual.

> **Por qué esto se corrige ANTES de la cita:** P12 es el documento que va a leer el asesor. Con
> la premisa vieja respondería sobre un sistema que no se comporta así, y el dictamen nacería
> inútil — o peor, engañoso, porque vendría firmado. Una afirmación escrita en pasado que nadie
> volvió a comprobar se había convertido en la fuente, justo antes de usarse.

*Códigos 1114 / 1118 / 1119 verificados literalmente contra el listado oficial vendorizado
(`docs/legal/fuentes/aeat-errores.properties`), no contra un recuerdo.*

---

## Resumen para llevar a la cita — qué confirmar/corregir

| # | Pregunta | Lo que este expediente propone | Confianza |
|---|---|---|---|
| P1 | Momento de emisión | Factura real nace AL cobro (`paidAt`); antes solo hay solicitud de pago no fiscal | Media — patrón doctrinal consistente, sin cita literal verificada |
| P2 | Serie | Ambas opciones son legales; recomendado serie propia por trazabilidad | Alta (no hay obligación legal en ningún sentido) |
| P3 | Final a 0 € | No obligatoria legalmente; recomendable por trazabilidad | Media — sin consulta DGT específica localizada |
| P4 | Rectificación cruzada | Alguna cascada es obligatoria (no puede quedar deducción errónea); atómica vs. bloqueo es decisión de producto | Alta en el "debe encadenarse"; abierta en el mecanismo |
| P5 | Leyenda | No hay texto legal obligatorio, solo contenido mínimo (fecha del cobro) | Alta |
| P6 | Plazo + NIF | Particulares: fin de mes natural. F1 exige NIF; **verificar si el vertical entra en el umbral de 3.000 €** (impacto alto) | Alta en plazo; **baja, a verificar, en el umbral 3.000 €** |
| P7 | Fecha del mes natural | `Albaran.fecha` (realización), no `firmadoAt`; congelar al pasar a `firmado` | Media-alta |
| P8 | Albarán valorado sin validez fiscal | Confirmar el criterio ya aplicado (SCRUM-65) | Alta (sin controversia esperada) |
| P9 | TipoFactura VeriFactu | F1 estándar; el resto es técnico (SIF-1), no fiscal puro | Alta en el encaje legal |
| P10 | Liberación tras R1 | Decisión de producto, no fiscal; solo la re-agrupación por fecha original es obligatoria si se liberase | Alta |
| P11 | F1 sin NIF del destinatario | El esquema prevé AMBAS salidas (`FacturaSinIdentifDestinatarioArt61d` / `FacturaSimplificadaArt7273`); hoy no se marca ninguna. Falta saber cuál procede y si obliga a pedir NIF por encima del límite del art. 4 | **Baja — decide alcance de producto** (ver P6) |
| P12 | `TipoRectificativa` S/I de las R1 | ⚠️ **Premisa corregida el 29-jul-2026 (SCRUM-216):** el código crea las R1 **negando la original** (el delta → **I**), no «consignando el total corregido» (**S**) como afirmaba este expediente. Tres fuentes en conflicto (código · este documento · `registro.builder.ts`). Hasta que se confirme, ninguna R1 se declara | **Baja — hay una contradicción medida, no una forma exacta pendiente** |

**La pregunta con mayor impacto económico/de producto es P6 (umbral de 3.000 € del art. 4.1
RD 1619/2012)** — si el asesor confirma que el vertical de YaQu encaja, cambia
sustancialmente cuánta fricción de NIF hay que resolver en el producto.

**P12 subió de prioridad el 29-jul-2026** (era «Media — el encaje parece claro»): al medirlo
contra el código apareció una contradicción que este mismo expediente había introducido, y su
respuesta puede obligar a cambiar **cómo se crean** las rectificativas, no solo cómo se
declaran. Conviene llevarla a la cita con la misma atención que P6.

---
*Creado el 23-jul-2026. Fuentes secundarias: Iberley, SuperContable, Agencia Tributaria (sede
electrónica), consultadas vía búsqueda web — no sustituyen la verificación del texto
consolidado del BOE ni el criterio del asesor. Complementa el expediente RGPD
(`docs/legal/RGPD_TRATAMIENTO_DATOS.md`) y las preguntas ya recogidas en
`docs/legal/PREGUNTAS_ASESOR.md`.*
