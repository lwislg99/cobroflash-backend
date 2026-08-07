# ONE-PAGER — Preguntas para la cita con el asesor fiscal/legal

> Para llevar a la cita (bundle Y3 del master + decisiones nuevas de S1-C y S1-D).
> Objetivo: desbloquear SIF-1 y cerrar el alcance legal de la beta. Marca la respuesta
> al lado de cada punto; yo implemento según lo que traigas.

## A. Decisión que BLOQUEA S1-D (la más urgente para programar el envío a la AEAT)

1. **Modelo de representación ante la AEAT.** YaQu es un SaaS multi-tenant: cada
   profesional (merchant) es el obligado tributario. ¿Cómo remitimos sus registros?
   - (a) **Colaborador social**: YaQu remite con SU certificado en nombre de todos los
     merchants (apoderamiento). → Un solo certificado, gestión centralizada.
   - (b) **Certificado por merchant**: cada profesional aporta su certificado y YaQu
     remite "como representante". → Custodia de N certificados.
   - **Impacto técnico:** define cómo se autentica el cliente SOAP (mTLS) y dónde/cómo
     custodiamos el/los certificado(s). **Sin esta respuesta no se construye S1-D.**

## B. Las 3 nuevas de S1-C (estructura de los registros)

2. **Datos del PRODUCTOR del SIF** (van en cada registro y en la declaración responsable):
   nombre/razón social y NIF de quien "produce" YaQu. ¿Lo declaramos como
   **[tú autónomo]** o como **[una SL]**? (Hoy el código lleva placeholders.)
3. **NIF del cliente final.** El registro de factura completa (F1) exige identificar al
   destinatario con NIF. Nuestros clientes (particulares de oficios) muchas veces no lo
   dan. ¿Qué hacemos?
   - (a) Pedir y guardar el NIF del cliente al facturar (factura F1 siempre).
   - (b) Emitir **factura simplificada (F2)** cuando no hay NIF — recordar que el límite
     legal de la simplificada es **400 €** (¿suficiente para el ticket medio de obra?).
4. **Tipo de rectificativa.** Nuestras R1 (devoluciones/correcciones) llevan las líneas en
   negativo. ¿Confirmas **`TipoRectificativa = I` (por diferencias/incremental)** frente a
   `S` (sustitutiva, que exige declarar base+cuota rectificadas)?

## C. Bundle legal Y3 (lo que el master pide encargarte)

5. **Declaración responsable** del SIF (art. 13 RRSIF): nombre del SIF, versión,
   componentes, productor + NIF, fecha, conformidad. **Borrador ya redactado en
   `docs/legal/DECLARACION_RESPONSABLE.md`** — solo falta validar la cláusula de
   conformidad (C6), rellenar datos del productor (B2) y tu visto bueno. Es la S1-E,
   **versionada por release**.
6. **Términos del SaaS** con límites de responsabilidad: el merchant responde de la
   veracidad de los datos de sus facturas; YaQu, de la conformidad técnica del SIF.
7. **Condiciones económicas en los ToS**: suscripción, take rate 0,9 % en tarjeta,
   relación con Stripe Connect, figura de merchant-of-record del profesional.
8. **Anticipos / IVA (V3 del master)**: ¿la señal cobrada antes de empezar es
   **factura de anticipo con IVA**? ¿la factura final descuenta el anticipo? (Define el
   comportamiento fiscal de los cobros parciales.) **Expediente completo (10 preguntas P1-P10,
   anticipos + factura recapitulativa, con articulado y consultas DGT localizadas) en
   `docs/legal/EXPEDIENTE_FISCAL_ANTICIPOS_RECAPITULATIVA.md`** — la de mayor impacto es P6:
   si el vertical de oficios a domicilio de YaQu encaja en el umbral de factura simplificada
   de 3.000 € (art. 4.1 RD 1619/2012) en vez del general de 400 €, cambia mucho la fricción
   de pedir NIF al cliente final.
9. **Privacidad + DPA + cookies**: ¿el modelo actual (solo cookies técnicas first-party,
   banner mínimo) es suficiente? + plazos de conservación de datos (S4). **Análisis detallado
   y 6 preguntas concretas ya en `docs/legal/RGPD_TRATAMIENTO_DATOS.md`** (reparto
   responsable/encargado YaQu↔profesional, base jurídica por tratamiento, DPA con cada
   profesional, aviso de firma para el cliente final, y si hace falta Registro de
   Actividades de Tratamiento — sí, según ese análisis). **Urgente:** la política publicada
   hoy en `yaqu.app/privacidad` no cubre IBAN/NIF/teléfono del profesional, dirección del
   cliente final, ni la evidencia de firma — nunca fue validada por ti pese a estar live.
10. **Alcance Founding** (`docs/legal/ALCANCE_BETA.md`): revisa el borrador, sobre todo la
    cláusula de "VERI*FACTU se activa al cerrar la certificación, sin cambio de precio" y
    que cobrar la beta antes de tener facturación fiscal sea correcto.

## D. Calendario / coste

11. Revisión fiscal externa (S1-F): coste estimado y plazo (el master presupuesta 300-600 €).
12. ¿Algún requisito previo para darnos de alta en el **entorno de pruebas de la AEAT**
    (además del certificado FNMT)?

## E. Baja de un profesional: qué se borra y qué se conserva (bloquea SCRUM-244)

> Añadido el 3-ago-2026. **Es la pregunta más cerrada de esta hoja: basta con marcar (a), (b) o
> (c) y el plazo.** Todo lo demás es contexto para que no tengas que reconstruirlo.

13. **Cuando un profesional ejerce el derecho de supresión (RGPD art. 17) y hemos emitido
    facturas suyas, ¿qué hacemos con esas facturas, con sus registros VeriFactu y con el
    registro de auditoría?**

    - **(a) Conservar íntegro el rastro fiscal** —facturas emitidas, sus registros VeriFactu y
      el `AuditLog`— durante el plazo legal de conservación, y borrar **todo lo demás** (cuenta,
      clientes, presupuestos, trabajos, mensajes, adjuntos). Amparo: **art. 17.3.b RGPD**, que
      excluye del derecho de supresión los datos necesarios para cumplir una obligación legal.
    - **(b) Anonimizar los datos identificativos dentro de esos documentos** conservando el
      asiento. ⚠️ **Necesitamos que valores esto sabiendo lo que cuesta técnicamente**, porque no
      es un `UPDATE` inocuo: ver el recuadro de abajo.
    - **(c) Borrado total**, incluidas facturas y registros fiscales.

    **Y la pregunta de plazo, que es la que hace ejecutable la respuesta:** ¿**4 años**
    (prescripción tributaria, art. 66 LGT) o **6 años** (art. 30 Código de Comercio)? La política
    de privacidad ya publicada dice **6 años**; si es otro, hay que corregirla.

    > **⚠️ Por qué (b) no es "simplemente anonimizar": rompería la prueba.** Nuestras facturas
    > llevan una **huella encadenada** (VeriFactu): cada registro incorpora la huella del
    > anterior, y esa huella se calcula **sobre el contenido de la factura**. Cambiar un dato
    > dentro de una factura ya emitida deja la huella almacenada sin corresponder con el
    > contenido, y **recalcularla rompe la cadena de todas las posteriores**. Es también lo que
    > prohíbe nuestra regla interna nº 29 (*una factura emitida jamás se edita ni se borra*:
    > corrección = rectificativa R1, nunca edición). O sea que (b), aplicada **dentro** de la
    > factura, destruiría justo el valor probatorio que la conservación busca. Si aun así (b) es
    > tu criterio, necesitamos que nos digas **sobre qué datos exactamente** se puede aplicar
    > (¿solo los de la ficha de cliente fuera de la factura? ¿los de contacto?) y **cuáles no se
    > tocan nunca**.

    **Contexto de por qué preguntamos y no decidimos:** las dos obligaciones apuntan en
    direcciones opuestas —suprimir datos personales frente a conservar el registro de
    facturación— y el software ya sabe borrar un merchant entero (está construido y probado). Lo
    que **no** vamos a hacer es exponer ese borrado antes de tener tu respuesta: hoy la lista de
    borrado incluye facturas y `AuditLog`, así que darle un botón sería incumplir por el otro
    lado. **Sin esta respuesta, SCRUM-244 no se construye.**

    **Un apunte que quizá cambie tu respuesta:** el profesional **no es un tercero** en sus
    facturas — su nombre y su NIF son parte del documento fiscal como emisor. Conservar la
    factura implica conservar su identidad; no hay versión de la factura sin él.

## F. Calificación de la operación: exentas, no sujetas e inversión del sujeto pasivo (bloquea SCRUM-212)

> Añadido el 5-ago-2026. Las once preguntas se midieron el 29-jul-2026 y vivían solo en un
> comentario de Jira; se traen aquí porque **son lo único que bloquea SCRUM-212** y no estaban en
> la hoja que va a la cita. **No hay ninguna decisión técnica que tomar hasta que existan estas
> respuestas**, y así lo dejó dicho el fundador el 29-jul: construir hoy sería inventar el
> criterio fiscal.

> **⚠️ LÉASE ANTES QUE LAS PREGUNTAS — el enunciado del ticket llevaba un error y lo hemos
> corregido.** Decía que `S2` era «exenta». **No lo es.** Verificado palabra por palabra contra el
> XSD oficial que tenemos vendorizado (`xsd/SuministroInformacion.xsd`):
>
> | Valor | Literal oficial (`xsd:1238-1260`) |
> | --- | --- |
> | **S1** | «OPERACIÓN SUJETA Y NO EXENTA — **SIN** INVERSIÓN DEL SUJETO PASIVO» |
> | **S2** | «OPERACIÓN SUJETA Y NO EXENTA — **CON** INVERSIÓN DEL SUJETO PASIVO» |
> | **N1** | «OPERACIÓN NO SUJETA ARTÍCULO 7, 14, OTROS» |
> | **N2** | «OPERACIÓN NO SUJETA POR REGLAS DE LOCALIZACIÓN» |
>
> O sea: **S1 y S2 son las dos sujetas y no exentas**, y se diferencian por la inversión del
> sujeto pasivo. **La exención no es un valor de `CalificacionOperacion`**: vive en un elemento
> hermano, `OperacionExenta`, con causa obligatoria **E1..E6** (`xsd:679-711` — E1 art. 20 ·
> E2 art. 21 · E3 art. 22 · E4 art. 24 · E5 art. 25 · E6 otros). Y los dos están en un `<choice>`
> **sin** `minOccurs="0"` (`xsd:293-296`): en cada línea hay que informar **exactamente uno de los
> dos**, nunca ambos ni ninguno.
>
> Lo decimos porque cambia lo que te preguntamos: no es «añadir tres códigos más», son **dos cosas
> distintas** —la calificación y, en su caso, la causa de exención—, y sin la causa no se puede
> emitir una exenta aunque supiéramos que lo es.

**Por qué preguntamos y no lo decidimos nosotros:** hoy el producto captura del profesional **un
solo dato fiscal, un número: el tipo de IVA**. No hay ninguna casilla de exención, de no sujeción
ni de inversión del sujeto pasivo, ni en la línea, ni en la factura, ni en el cliente, ni en el
producto (medido el 29-jul sobre las 813 líneas del schema y todo el front). Por eso **un 0 % es
hoy indistinguible de una exenta y de una no sujeta**, y el exportador se niega a elegir entre las
tres: adivinarlo sería declarar en falso ante la AEAT. Qué operación es exenta y cuál no sujeta es
criterio fiscal, no técnico.

**Consecuencia práctica, ya medida:** un solo tramo al 0 % **excluye la factura entera** del
registro VeriFactu. Hoy no se nota porque la facturación fiscal está apagada para negocios reales
(`INVOICING_ES_ENABLED` OFF, regla 24); saltará el día que se encienda.

14. En oficios en España (fontanería, electricidad, reformas, mantenimientos), **¿se dan
    operaciones exentas?** Si sí, ¿bajo qué causa **E1..E6**?
15. **¿Se dan supuestos de inversión del sujeto pasivo (S2)?** ¿En qué casos y **con qué dato
    observable** se detectan?
16. **¿Se dan operaciones no sujetas (N1 / N2)?** ¿Qué dato del cliente o del servicio permitiría
    identificarlas?
17. **¿Existe algún supuesto legítimo de 0 % en estos oficios?** Si no, ¿debe el sistema
    **prohibir el 0 % en la entrada** en vez de aceptarlo y bloquear después?
18. **Granularidad:** ¿puede una misma factura mezclar calificaciones distintas (el XSD admite
    hasta 12 `DetalleDesglose`), o la calificación es de la factura entera?
19. **¿Quién declara la calificación?** ¿El profesional bajo su responsabilidad, o se deriva de
    datos objetivos que YaQu capture?
20. **Suplidos** (tasas, licencias, permisos adelantados por cuenta del cliente): ¿son línea de
    factura? ¿con qué calificación?
21. **Recargo de equivalencia:** ¿aplica a algún cliente típico de YaQu?
22. **Retención de IRPF** en facturas a empresarios: ¿aplica en este perfil?
23. **¿Qué datos del destinatario son imprescindibles** para decidir localización o ISP? (hoy
    **no hay país**).
24. **Histórico:** las facturas ya emitidas se guardaron sin el dato y son **inmutables por regla
    29**. ¿Qué se hace si el dictamen concluye que alguna estaba mal calificada?

> **Las tres que más te agradeceríamos aunque no dé tiempo a más:** la **14**, la **15** y la
> **16**. Si la respuesta a las tres fuera «en este vertical no se dan», el ticket se cierra sin
> construir nada y el 0 % pasa a ser simplemente un dato que no debe admitirse (pregunta **17**).

## G. El presupuesto ADICIONAL cuando aparece trabajo en obra (bloquea SCRUM-290 / A0.4)

> Añadido el 6-ago-2026, y **antes de escribir una sola línea de texto de la pantalla**. Lo pide el
> propio ticket: aquí no basta la regla 30 (la microcopy la aprueba el fundador), porque **un texto
> legal mal escrito no es feo, es peligroso** — le diría a un profesional lo que puede o no puede
> cobrarle a su cliente.

**Qué vamos a construir, para que entiendas la pregunta.** El profesional entrega un albarán
firmado por el cliente. Las **cantidades** salen de ese albarán; los **precios**, del **presupuesto
que el cliente firmó** — casando línea con línea. Entrega 3 de los 10 metros presupuestados, factura
3 al precio que el cliente aceptó.

El caso que nos trae aquí es el otro: **en obra aparece trabajo que no estaba en el presupuesto.**

**Lo que hemos leído (fuentes públicas, NO un dictamen — por eso preguntamos):**

- **Cliente empresa o autónomo:** art. 1593 CC — los adicionales se pueden cobrar si hubo
  **autorización del propietario**, y el Supremo admite que sea **verbal o tácita**. Matiz: reparar
  algo mal ejecutado no genera derecho a cobro adicional.
- **Cliente particular** (el 90 % de la clientela de un gremio): el presupuesto aceptado **es
  vinculante** y la factura debe coincidir con él; los trabajos nuevos exigen que el consumidor
  **acepte el nuevo presupuesto por escrito**, y **puede rechazarlos**.

**Por eso descartamos la solución fácil.** La primera idea fue «las líneas nuevas entran en la
factura a 0 € y se avisa». Es cómoda y **creemos que es incorrecta**: convertiría a YaQu en la
herramienta que produce **la factura mayor que el presupuesto**, que es justo la situación por la
que se abren la mitad de las reclamaciones en OMIC. Le pondríamos fácil al profesional meterse en un
lío.

**Lo que vamos a hacer en su lugar:** las líneas que no estaban en el presupuesto **no se facturan**.
Disparan un **presupuesto adicional** que se manda por WhatsApp y se firma. Si se firma, se
incorpora y la factura sale entera; si no, se factura lo pactado y lo demás queda **pendiente y
visible** — nunca descartado en silencio.

**El dato que sí tenemos:** el cliente lleva un campo `tipoDestinatario`, que puede estar **sin
clasificar** (`null`) porque nunca se preguntó. Mientras no haya respuesta a lo de abajo, esos
clientes se tratarán con el **criterio estricto de consumidor**, porque equivocarse hacia el lado
estricto no le cuesta un procedimiento a nadie.

25. **¿Basta la firma digital que ya usamos** —el cliente firma con el dedo en su móvil, sobre una
    landing a la que llega por un enlace de WhatsApp, y guardamos la imagen de la firma con su
    sello de tiempo y su evidencia— **para acreditar que el consumidor aceptó por escrito el
    presupuesto adicional?** Si no basta, ¿qué le falta?
26. **¿Qué contenido mínimo debe llevar ese presupuesto adicional** para que valga como aceptación
    de trabajos nuevos? En concreto: ¿tiene que referenciar el presupuesto original?, ¿desglosar
    unidades y precio unitario?, ¿decir expresamente que el cliente puede rechazarlo?, ¿llevar
    plazo de validez?
27. **¿Cambia algo de lo anterior si el cliente es empresa o autónomo** en vez de consumidor? Es
    decir: ¿podemos aceptar la autorización verbal o tácita del art. 1593 CC y facturar el
    adicional sin firma, o **conviene exigir firma siempre** por prudencia?
28. **Reparación de lo mal ejecutado:** si la línea nueva es rehacer algo que salió mal, no se puede
    cobrar aparte. **¿Debe el sistema preguntárselo al profesional** cuando añade una línea que no
    estaba en el presupuesto (algo como «¿esto es trabajo nuevo o es rehacer lo anterior?»), o eso
    es responsabilidad suya y basta con dejarlo registrado?

> **La que más nos urge es la 25.** Si la firma que ya tenemos vale, el mecanismo entero está
> construido y solo falta enchufarlo. Si no vale, hay que rediseñar la aceptación del adicional
> antes de escribir la pantalla, y preferimos saberlo ahora.

---

---
## P11. Factura SIN identificación del destinatario: ¿art. 61.d o simplificada F2? (bloquea SCRUM-292 / A1)

**La plantea el propio código, y hay una rama apagada esperando la respuesta.**

`src/modules/fiscal/verifactu/registro.builder.ts` tiene tres modos declarados
(`ModoSinDestinatario = 'SIN_DICTAMEN' | 'ART_61D' | 'SIMPLIFICADA_F2'`) y el activo hoy es
`SIN_DICTAMEN`. Con él, una factura sin NIF del cliente **no se registra**: lanza
`DestinatarioSinDictamenError` y el documento queda fuera. Su motivo, literal:

> «la factura no tiene NIF del cliente y la AEAT rechaza una F1/R1 sin `Destinatarios`
> (error 1189). El esquema admite dos salidas —`FacturaSinIdentifDestinatarioArt61d`
> (factura completa, art. 61.d RIVA) o `FacturaSimplificadaArt7273` con TipoFactura F2
> (arts. 7.2/7.3)— y son declaraciones distintas: cuál procede lo decide el dictamen
> P11, no el código. Hasta entonces la factura queda FUERA del registro, no se declara
> con un dato inventado. La factura en sí no está bloqueada: se emite, se envía y se
> cobra igual.»

**P11.1** Para un profesional de oficios que factura a un particular sin pedirle el NIF (la
reparación de 40 €), ¿lo que procede es la **factura simplificada** (arts. 7.2/7.3 RD 1619/2012,
`TipoFactura` F2) o la **factura completa sin identificación del destinatario** (art. 61.d RIVA)?

**P11.2** ¿Depende del importe? Si hay umbral, ¿cuál y con qué base legal?

**P11.3** ¿Cambia la respuesta si el cliente es una empresa que no ha facilitado el NIF? (Con una
simplificada el destinatario **no puede deducir el IVA**, así que el coste del error lo paga él.)

**P11.4** Una **rectificativa** de una factura sin destinatario sería una **R5** (rectificativa de
simplificada), tipo que el producto **no modela** y que hoy se excluye en vez de inventarse. ¿Es
correcto excluirla, o hay una salida que sí modelamos?

> **Nota de estado.** SCRUM-292 (A1) elimina el caso más frecuente **pidiendo el NIF antes de
> emitir**, así que la mayoría de facturas dejan de depender de esta respuesta. Lo que NO cubre es
> el cliente que legítimamente no tiene NIF: ahí el producto dice que todavía no puede, en vez de
> emitir algo a medias. La rama `SIMPLIFICADA_F2` sigue **apagada** esperando esta respuesta.

---

*Generado el 13-jun-2026. Cuando vuelvas con respuestas: B y C desbloquean S1-C/S1-E,
A desbloquea S1-D, **E desbloquea SCRUM-244 (supresión + portabilidad)**, **F desbloquea
SCRUM-212 (calificación de la operación)**, **G desbloquea la microcopy de SCRUM-290
(albarán → factura y el presupuesto adicional)**. Estado vivo en `docs/PENDIENTES_FUNDADOR.md`.*

## P12. Suplidos: ¿entran en el ImporteTotal que se sella? (bloquea SCRUM-293 / A2)

**La plantea el código, y con un dato concreto delante.**

Un **suplido** es un gasto pagado **en nombre del cliente** (una tasa, un visado, un permiso): no
lleva IVA y **no forma parte de la base imponible**. Pero **sí altera lo que el cliente paga**, y
ahí está la pregunta.

**El detalle técnico, medido el 7-ago-2026:**

* `src/modules/fiscal/verifactu/registro.builder.ts` construye el registro con
  `calcVatBreakdown` y manda su resultado **literal** al XML: la línea 315 hace
  `baseImponible: entrada.base.toFixed(2)`, que sale como
  `<sum1:BaseImponibleOimporteNoSujeto>`.
* `calcVatBreakdown` mete **TODA** línea en la base (`e.base += qty * price`). No existe hoy
  ninguna marca que saque una línea de la base: una línea al 0 % entra en la base con cuota cero.
* `Invoice.total` es `grossOfLines()` = `base + cuota`. **No hay campo** para un importe que no
  sea ninguna de las dos: cero campos de suplido en `Invoice` y cero en `Merchant`.

**P12.1** Un suplido, ¿debe aparecer en el **ImporteTotal** del registro de facturación
VeriFactu, o queda **fuera** del importe sellado por no ser contraprestación de la operación?

**P12.2** Si entra en el ImporteTotal pero no en la base imponible, ¿bajo qué clave del desglose
se declara — o se declara **solo** en el total, sin línea de desglose propia?

**P12.3** ¿Tiene que ir **identificado como suplido en el documento** (concepto, referencia del
gasto, a nombre de quién se pagó), o basta con separarlo del importe de la operación?

**P12.4** El justificante del gasto está a nombre **del cliente**, no del profesional. ¿Hay que
conservarlo y referenciarlo desde la factura, y con qué exigencia formal?

> **Nota de estado.** El **cálculo de la retención de IRPF** NO depende de esta respuesta y ya
> está construido y probado, aislado y sin llamadores (`retencionIrpf.ts`): el fundador confirmó
> que la retención **no altera el `Invoice.total`** —es un pago a cuenta del pagador— y que el
> «líquido a percibir» se **deriva al pintar**, nunca se guarda. Lo que sigue bloqueado por P12
> es el **suplido**, más los campos de schema, que están congelados aparte por SCRUM-383.

## P13. Recargo de equivalencia: los tipos, y qué pasa con el total sellado (bloquea SCRUM-294 / A3)

**Lo que ya está medido, para no preguntar lo que se puede leer.** El XSD de la AEAT que está en
este repo (`SuministroInformacion.xsd`, `DetalleDesglose`) pone `TipoRecargoEquivalencia` y
`CuotaRecargoEquivalencia` como **hermanos** de `TipoImpositivo` y `CuotaRepercutida`, colgando de
la **misma** `BaseImponibleOimporteNoSujeto`. **No existe ninguna base propia del recargo**, así
que el recargo es un impuesto MÁS sobre la misma base y no cambia ni la base ni la cuota de IVA.
Sobre eso no hace falta preguntar nada.

Lo que sí hace falta:

**P13.1 · Los tipos.** El mecanismo está construido con **21 % → 5,2 %**, **10 % → 1,4 %** y
**4 % → 0,5 %**, y esos números **NO salen de ningún documento del repo**: son los que se han
puesto para poder probar el cálculo, y están en una tabla cerrada y en un solo sitio
(`recargoEquivalencia.ts`). ¿Son los vigentes hoy? ¿Hay algún tipo más aplicable a un profesional
de oficios (por ejemplo para el tabaco, que tiene el suyo), o alguno que no debamos ofrecer nunca?

**P13.2 · El total.** Con recargo, lo que el cliente paga es `base + IVA + recargo`. Hoy
`Invoice.total` es `base + IVA` y **es el número que se sella**. ¿El `ImporteTotal` del registro de
facturación tiene que incluir el recargo? (De la respuesta depende que enchufar esto toque o no el
sellado, que es lo que hoy lo mantiene sin llamadores.)

**P13.3 · A quién se le aplica.** El diseño dice que el recargo es condición de **quién compra**
(va en la ficha del cliente), y que solo puede aplicarse a comerciantes personas físicas o
entidades en atribución de rentas, **nunca a sociedades**. ¿Es correcto tal cual? ¿Y qué obligación
tiene el emisor de comprobarlo, o basta con lo que declare el cliente?

**P13.4 · Criterio de caja (RECC).** El IVA se devenga cuando se cobra. Nosotros tenemos el cobro
dentro, pero hoy **`paidAt` se pone con `new Date()` en tres sitios del código**: sabemos que
alguien marcó la factura como cobrada, **no la fecha en que entró el dinero** (y tres de las cinco
formas de cobro se marcan a mano). ¿Qué exigencia tiene la fecha de cobro para el RECC — vale la
fecha de marca, o hace falta la fecha real del apunte bancario? Mientras no haya respuesta, lo
construido **clasifica y avisa; no liquida**.

> **Nota de estado.** El **cálculo del recargo** y la **clasificación por cobro** están construidos
> y probados, aislados y **sin llamadores** (`recargoEquivalencia.ts`, `criterioCaja.ts`).
> Enchufarlos toca el `Invoice.total` sellado y el XML del desglose —los dos, STOP— y necesita
> campos de schema (congelados aparte).
