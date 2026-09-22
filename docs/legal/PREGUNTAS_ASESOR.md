# ONE-PAGER — Preguntas para la cita con el asesor fiscal/legal

> Para llevar a la cita (bundle Y3 del master + decisiones nuevas de S1-C y S1-D).
> Objetivo: desbloquear SIF-1 y cerrar el alcance legal de la beta. Marca la respuesta
> al lado de cada punto; yo implemento según lo que traigas.
>
> 🔴🔴 **LA MÁS URGENTE ESTÁ AL FINAL DEL DOCUMENTO: `P14 · ¿YaQu, HOY, «fabrica o
> comercializa» un sistema informático de facturación?`** (art. 201 bis LGT + plazo del
> productor). Llegó la última —7-ago-2026— y por eso está abajo, pero **se lee la primera**.
> *(Puntero añadido por SCRUM-328; el contenido de P14 no se ha tocado.)*

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

---

# 🔴🔴 P14 · PRIORITARIA — ¿YaQu, HOY, «fabrica o comercializa» un sistema informático de facturación?

> **La más urgente del documento.** Va al final por orden de llegada, pero **se lee la primera.**
> Todo lo de abajo son HECHOS MEDIDOS de nuestro producto el 7-ago-2026, con fichero y línea.
> **Ninguna de estas líneas es una interpretación legal**: quien esto escribe no es abogado, y el
> fundador tampoco. Por eso la consulta.

## La pregunta, formulada para contestarse sin conocer nuestro código

**Contexto normativo que la motiva** (fuentes oficiales, medido por el fundador):

* El **RDL 15/2025** aplazó la obligación **de los contribuyentes** (sociedades 1-ene-2027,
  autónomos 1-jul-2027), pero **no la de los productores**: desde el **29 de julio de 2025**
  debían tener en el mercado sistemas de facturación plenamente adaptados, y ese calendario
  **no se modifica**.
* El **art. 201 bis LGT** sanciona con hasta **150.000 €/ejercicio** *fabricar o comercializar*
  sistemas que no cumplan.

**LO QUE NECESITAMOS QUE NOS DIGAS:**

> **¿La situación descrita en los hechos (A) a (E) constituye «fabricar o comercializar un sistema
> informático de facturación» a efectos del art. 201 bis LGT y del RD 1007/2023?**
>
> Y si la respuesta es «sí» o «depende»: **¿qué de lo descrito habría que cambiar, retirar o
> completar para no estar en el supuesto**, mientras el producto siga sin emitir facturas a
> contribuyentes españoles reales?

Tres matices que no sabemos leer y en los que nos interesa especialmente tu criterio:

1. **¿«Comercializar» exige que el módulo esté operativo para el cliente**, o basta con
   ofrecerlo o anunciarlo aunque esté apagado por bandera?
2. **¿«Fabricar» se refiere al software que existe**, o al software **puesto en el mercado**?
   El nuestro existe y está probado; **no está activo para ningún contribuyente español**.
3. **¿Cambia algo que hoy sí se emitan facturas a merchants NO españoles** con el mismo código?

## (A) ¿Emite hoy facturas algún merchant real?

El modo de documento se decide en **`src/modules/invoicing/domain/emission.service.ts:37-42`**:

```ts
export function getEmissionMode(m: MerchantLike): EmissionMode {
  const country = (m.country ?? '').trim().toUpperCase();
  if (country && country !== 'ES') return 'fiscal';   // ← factura real
  if (isDemoMerchant(m)) return 'demo';               // ← factura con marca de agua
  return isFlagEnabled('INVOICING_ES_ENABLED', { merchant: m }) ? 'fiscal' : 'receipt';
}
```

| Caso | Qué documento sale | ¿Es factura? |
| --- | --- | --- |
| Merchant **español real** (bandera OFF) | **Justificante de cobro**, serie `J-…`, sin numeración de factura y sin QR VeriFactu | **NO** |
| Merchant **demo** (`id=1` / `demo@yaqu.app`) | Factura **completa** con marca de agua `DEMO — no válida fiscalmente` | Sí, marcada como no válida |
| Merchant **NO español** (`country` explícito y distinto de `ES`) | **Factura real** | **SÍ** |
| Merchant español con la bandera ON individualmente | Factura real | Sí — **hoy no hay ninguno** |

* La bandera **`INVOICING_ES_ENABLED` está en `false`** globalmente (`src/core/flags.ts:16`).
* **Dato que aporta el fundador y esta sesión NO puede verificar**: no hay merchants reales en
  producción; las 55 facturas de esa base son pruebas internas. Esta sesión **no tiene
  credenciales de producción** y no ha podido contarlo por sí misma.
* ⚠️ **Matiz medido**: un merchant con `country` **vacío** cae en la rama española (justificante).
  Solo un país **explícito y distinto de `ES`** produce factura real.

## (B) Qué dice la web pública, hoy, sobre facturación

Citas literales de **`public/index.html`**. En `public/precios.html` **no hay ninguna mención**.

| Línea | Texto literal |
| --- | --- |
| `:377` | «Facturación **VeriFactu en certificación**» *(insignia de la barra de confianza)* |
| `:510` | «**Te contesto como fabricante**: la facturación VeriFactu **está construida y en certificación** — **con declaración responsable del productor**, que es lo que tu gestor te pedirá. Por ley no puedo activarla hasta cerrarla; por eso la beta es de presupuestos y cobros. Los primeros usuarios la estrenarán al cerrarse, sin cambio de precio.» |
| `:7`, `:17`, `:37`, `:329`, `:507`, `:511` | «clientes, gastos y **facturas** en el mismo sitio» *(metadatos, descripción y FAQ)* |

**Hecho relevante para el matiz 1:** la web **se autodenomina «fabricante»**, afirma que el módulo
**está construido y en certificación**, y menciona una **declaración responsable del productor**.

**Estado real de ese documento:** `docs/legal/DECLARACION_RESPONSABLE.md` es una **PLANTILLA** con
placeholders `[…]`, y su cabecera dice: *«**NO publicar ni entregar a merchants hasta:** (1) SIF-1
8/8, (2) revisión del asesor fiscal, (3) datos reales del productor rellenados»*. Es decir: **la
web la menciona y el documento todavía no está emitido.**

## (C) Qué produce hoy el módulo VeriFactu

* **Genera** el XML de los registros de facturación, con builders puros en
  `src/modules/fiscal/verifactu/registro.builder.ts`, declarados conformes a `SuministroLR.xsd` y
  `SuministroInformacion.xsd` (`:1-3`).
* **Contra qué XSD**: seis esquemas **vendorizados** en `src/modules/fiscal/verifactu/xsd/` —
  `SuministroLR.xsd`, `SuministroInformacion.xsd`, `ConsultaLR.xsd`, `RespuestaConsultaLR.xsd`,
  `RespuestaSuministro.xsd`, `xmldsig-core-schema.xsd`. Hay validador:
  `scripts/validate-registros-xsd.ps1`.
* **Incluye** el bloque obligatorio `SistemaInformatico` —productor, NIF, nombre del sistema,
  `idSistema`, versión, nº de instalación, `soloVerifactu = 'S'`— en `registro.builder.ts:19-30`,
  ligado explícitamente a la declaración responsable.
* **NO hace**, con estas palabras, en `src/modules/invoicing/domain/modoVisible.ts:21-24`:

  > «**"se envía" NO EXISTE.** Cero clientes SOAP/mTLS contra la AEAT, `VfSubmission` no está en el
  > schema, no hay cola de remisión; `applyVeriFactu` calcula la cadena de huellas y la URL del QR
  > —o sea **SELLA EN LOCAL**— y los XSD están vendorizados pero **nadie los manda a ningún
  > sitio**. Hoy todo es "se guarda".»

* La bandera **`SIF_ENABLED` está en `false`** (`src/core/flags.ts:17`).

## (D) La huella encadenada: para quién es verdad hoy

Condición única, en **`src/modules/invoicing/domain/portonDocumento.ts:84`**:

```ts
return merchant?.country === 'ES' && !!merchant?.taxId && !isReceiptNumber(numero);
```

Cruzada con (A), hoy la cadena de huellas se aplica **exclusivamente** a:

* el **merchant demo**, cuyas facturas llevan la marca de agua «no válida fiscalmente»;
* y a un merchant español con la bandera encendida individualmente — **hoy no existe ninguno**.

**Un merchant español real NO entra en la cadena**: su documento es un justificante (`J-…`) y
`isReceiptNumber` lo excluye. **Un merchant no español tampoco**, porque la condición exige
`country === 'ES'`.

## (E) ¿Hay especificación oficial en el repo contra la que contrastar?

**Parcialmente, y conviene saberlo con precisión:**

* **SÍ están** los seis XSD oficiales vendorizados (ver C) y el catálogo de errores de la AEAT:
  `docs/legal/fuentes/aeat-errores.properties` (25 KB).
* **NO están los textos normativos.** `docs/legal/fuentes/` contiene **un solo fichero**, el de
  errores. **No hay copia del RD 1007/2023, ni de la Orden HAC/1177/2024, ni del RDL 15/2025.** Se
  citan en documentos internos (`docs/AUDITORIA_RRSIF.md`, `docs/SIF_SPEC_NOTES.md`,
  `DECLARACION_RESPONSABLE.md`), pero el articulado **no está en el repositorio**.

**Lo que eso significa, sin adornos:** la conformidad se ha contrastado contra los **XSD** —que son
estructura— y contra **notas internas**. **Nadie ha contrastado el producto contra el articulado**,
y eso forma parte de la respuesta que buscamos.

## Lo que esta sesión NO ha hecho

Censo de solo lectura. No se ha modificado el camino de emisión, ni la web, ni las banderas, ni se
ha escrito copy sobre VeriFactu (regla 26: solo del guion H2).

---

# SCRUM-324 (E3) · El aviso del justificante simplificado — 10-ago-2026

Estas dos preguntas **bloquean la microcopy**, no el código. El dominio ya está construido y
devuelve **códigos, no frases** (`src/modules/expenses/domain/justificante.ts`): mientras no haya
respuesta aprobada, el producto **no dice nada**, que es mejor que decir algo falso.

**El contexto, para que la respuesta sea útil:** el usuario es un profesional de oficio, de pie en
un almacén, con el móvil. Acaba de registrar un gasto en diez segundos y el sistema ha detectado
que a ese justificante le falta algo para deducir el IVA.

## Pregunta 1 — ¿Qué convierte exactamente un simplificado en CUALIFICADO y deducible?

Lo que el producto asume hoy, y que hay que confirmar o corregir:

1. **NIF del DESTINATARIO** (el del profesional) en el propio documento.
2. **Cuota de IVA desglosada**.
3. Y, para el asiento de compra, **número y serie de la factura del proveedor** más el **NIF del
   proveedor**.

Concretamente: **¿basta con 1 y 2, o el punto 3 también condiciona la deducibilidad** (y no solo el
libro de recibidas)? Hoy el código exige los cuatro antes de dar por bueno nada, que es lo
conservador; si con 1 y 2 bastara, estaríamos pidiendo de más y molestando sin motivo.

## Pregunta 2 — ¿Cómo se dice eso en UNA línea sin decir nada falso?

El aviso aparece justo después de guardar. Tiene que caber en una línea de móvil, decir **qué
pedir** y **dónde**, y no prometer un ahorro que depende de cosas que no controlamos.

**Tres versiones a elegir o corregir** (ninguna está escrita en el producto):

- **A, la más corta:** «Este ticket no permite deducir el IVA. Pide factura con tu NIF.»
- **B, con el porqué:** «Un ticket no deduce IVA. Pide en el almacén una factura a tu nombre, con tu
  NIF y el IVA desglosado.»
- **C, sin la palabra "deducir":** «Para que tu asesor pueda usar este gasto, pide factura con tu
  NIF y el IVA desglosado.»

**Y una pregunta dentro de la pregunta:** ¿podemos decir «no permite deducir el IVA» tal cual, o hay
que acotarlo? Un ticket **sí** puede ser gasto deducible en IRPF en estimación directa — que es otra
cosa y otro importe—, y una frase que diga «no te lo puedes deducir» a secas sería **falsa por
exceso**. La C evita el término a propósito; queremos saber si hace falta.

## Lo que NO se pregunta aquí

Las cinco clasificaciones del gremio —inversión del sujeto pasivo, IVA 10 % en obra de vivienda,
retenciones 1 %/15 %, recargo de equivalencia en compras y bienes de inversión— están reportadas en
SCRUM-280 punto 6 y **no son de este ticket**.

---

# P15. Los Libros Registro: el formato, y dos campos que no sabemos si existen (bloquea E4 / SCRUM-325 y SCRUM-426)

> **Por qué esta pregunta importa más de lo que parece.** El bloque E se ancla en el libro de
> registro **precisamente porque «cualquier despacho sabe leerlo» y no depende del plan contable de
> nadie**. Es la pieza que sostiene la decisión de entregar LIBRO y no asiento. Y al medirla
> aparece que la parte que la hace fiable —el formato— es la única que no está verificada.

**Lo que ya está medido, para no preguntar lo que se puede leer.** Se ha barrido `docs/` y `src/`
el 10-ago-2026:

* **NO hay ninguna especificación del formato de Libros Registro** en el repositorio: ni diseño de
  registro, ni orden ministerial, ni cita del articulado. Las únicas coincidencias son entradas
  internas del máster citándose entre ellas.
* Los **seis XSD oficiales** que sí están (`src/modules/fiscal/verifactu/xsd/`) son de **VeriFactu**
  —`RegFactuSistemaFacturacion`, alta y anulación de registros de facturación—. Comprobado con
  control positivo: reconocen `RegistroAlta`/`Anulacion`/`Desglose`, y tienen **cero** apariciones
  de «recibida», «compra», «proveedor» o «soportado». La «LR» de `SuministroLR.xsd` es el suministro
  de VeriFactu, **no los libros registro de IVA**.
* El propio código lo declara desde el 7-ago y por eso **evita el nombre**: el libro que hoy
  entregamos **no se llama «Libro Registro de la AEAT» en ninguna parte** del código ni de la UI,
  porque *«ese nombre es una PROMESA y no hay documento oficial contra el que se haya contrastado el
  formato»*.

Lo que sí hace falta:

**P15.1 · El formato de EMITIDAS.** Hoy entregamos un CSV por trimestre con once columnas: fecha de
expedición, serie y número, tipo de factura, NIF y nombre del destinatario, base imponible, tipo de
IVA, cuota, total, cobro y anulada (una fila por tipo de IVA, no por factura). **Están construidas
por criterio propio, no contra un documento.** ¿Es ése el contenido y el orden que un despacho
espera de un libro de facturas expedidas? ¿Falta alguna columna obligatoria — clave de operación,
fecha de operación distinta de la de expedición, contraparte no establecida? ¿Y podemos llamarlo
«Libro Registro» sin más, o el nombre exige algo que hoy no cumplimos?

**P15.2 · La cuota deducible: ¿importe o sí/no?** El campo que acaba de entrar en producción es
`vatDeducible`, un **booleano**: solo puede decir «toda» o «nada». Un libro de recibidas registra la
**cuota deducible como importe**, y hay casos de deducción **parcial** —el habitual, los vehículos—
que un booleano no puede expresar. ¿Necesitamos guardar la cuota deducible como **importe** en vez
de (o además de) el sí/no? De la respuesta depende **una columna de schema**, no una línea de
código.

**P15.3 · ¿Hay número de recepción propio?** Lo que guardamos es
`Expense.providerInvoiceNumber`: el número **del proveedor**. Tenemos entendido que un libro de
recibidas numera además **sus propios asientos**, en orden de recepción, con un contador del
receptor. ¿Es así? Si lo es, ese contador es **nuestro** y hoy no existe: hay que decidir su serie
y su reinicio (¿anual, como la de emitidas?) antes de construirlo, no después.

> **Nota de estado.** El **libro de recibidas** (SCRUM-426) se está construyendo **sin esperar a
> estas respuestas**, y a propósito: el libro es **dato de dominio** y el formato es **otra capa**.
> Encadenar los dos bloqueos retrasaría los dos sin que uno dependa del otro. Lo que P15 decide es
> **cómo sale** y **si faltan campos**, no si se puede construir. Y mientras P15.1 no tenga
> respuesta, el producto **sigue sin llamarlo «Libro Registro de la AEAT»** en ninguna parte.
>
> Pendiente de schema y ya aprobado en principio: `Provider.legalName` — hoy `Provider` solo tiene
> `name` (nombre comercial) y `taxId`, mientras que `Customer` sí distingue `name` de `legalName`.
> Un libro de recibidas identifica al proveedor por su **razón social**. No se hace una migración
> de una sola columna: se acumula con la siguiente.

---

# P16. El tipo de factura: qué se le declara hoy a la AEAT, y qué debería (bloquea SCRUM-413)

> **Esto no es una duda de diseño: es un hecho medido POR EJECUCIÓN el 10-ago-2026.**

**Lo que ya está medido, para no preguntar lo que se puede leer.** `Invoice.type` es
`String @default("F1")` **sin enum, sin unión y sin ningún guard** en los 211 ficheros de `src/`.
El mapeo al catálogo de la AEAT está en **dos sitios** y es literalmente esto:

```ts
verifactu.service.ts:286   tipoFactura: invoice.type === 'R1' ? 'R1' : 'F1'
verifactu.service.ts:703   const tipoBase: 'F1' | 'R1' = inv.type === 'R1' ? 'R1' : 'F1'
```

**Todo lo que no sea `R1` se declara F1.** Alimentando el constructor de XML con una factura de
cada tipo (sin base de datos, cliente Prisma falso, con la forma real de producción):

| tipo interno | `TipoFactura` que se declara HOY |
|---|---|
| `F1` | F1 ✅ |
| `R1` | R1 ✅ |
| **`JUST`** (justificante de cobro, `J-…`) | **F1** 🔴 |
| **`ANT`** (anticipo, reservado desde SCRUM-17) | **F1** 🔴 |
| **cualquier cadena inventada** | **F1** 🔴 |

Y en **producción** (censo de solo lectura, 10-ago-2026): **44 documentos `JUST`** y **5 `F1` con
número `J-`** — tipo y número ya se contradicen en 5 filas reales. Ninguno está sellado: el sellado
se salva porque `applyVeriFactu` corta con `isReceiptNumber(number)`, **por el NÚMERO, no por el
tipo**. El **export XML no lleva esa guarda** (medido por AST sobre toda su cadena de funciones).

Lo que sí hace falta:

**P16.1 · El justificante.** Un `J-…` se emite a merchants ES reales con `INVOICING_ES_ENABLED`
apagado, vive **fuera de toda serie fiscal** (Parte M) y nuestro propio código se niega a sellarlo.
¿Confirmas que **no debe aparecer en el registro de facturación en ninguna forma** —ni como F1, ni
como F2, ni con marcador alguno—? Es decir: la corrección es **excluirlo**, no reclasificarlo.

**P16.2 · El anticipo.** `'ANT'` está reservado en un comentario desde SCRUM-17 (22-jul-2026) para
FISCAL-1. Cuando exista, ¿con qué `TipoFactura` se sella una factura de anticipo? Nuestra lectura es
que **es una factura completa y por tanto F1** —el anticipo devenga IVA y se factura—, pero hoy
saldría F1 **por el `else`, no por una decisión**, y queremos que sea lo segundo.

**P16.3 · La factura final que compensa anticipos** (SCRUM-16/142). Lleva líneas negativas que
descuentan los anticipos ya facturados. ¿Sigue siendo **F1**, o deducir documentos previos la
convierte en otra cosa del catálogo? No es una R1 —no rectifica un error, regla 29— pero queremos
oírlo, no deducirlo.

**P16.4 · ¿Falta algún tipo del catálogo que debamos poder emitir?** El código solo conoce `F1` y
`R1`; el XSD admite además `F2` (simplificada) y las `R2`–`R5`. ¿Alguno aplica a un profesional de
oficios en nuestro flujo, o F1/R1 cubren todo lo que emitimos?

> **Nota de estado.** SCRUM-413 entrega **el censo, el guard y la divergencia ejecutada**; la
> corrección del mapeo **NO se ha aplicado**: toca el camino de emisión (regla 38) y el diff está
> escrito esperando GO en `docs/master/SCRUM-413.md`. El guard que sí entró impide que un tipo
> **nuevo** se cuele sin decidir su mapeo — no arregla los que ya existen.
>
> Y no se ha tocado ninguna factura ya emitida (regla 29): las 5 filas de producción con tipo y
> número contradictorios **se quedan como están**; qué hacer con ellas es parte de P16.1.

---

## 21 · Los cinco avisos del Libro registro que afirman algo sobre la INTEGRIDAD del libro

**Planteado el 19-ago-2026.** El fundador aprobó 16 de las 21 ranuras de la pantalla del Libro
registro (`public/dashboard/js/libroRegistroView.js`). **Estas cinco no**, y no por olvido: las
cinco **afirman algo sobre si el libro está completo**, que es dictamen fiscal y no producto.

Las cinco siguen hoy con `[PENDIENTE microcopy oficial]` delante de su texto, así que **se leen en
pantalla pero se ven marcadas**. No se han reescrito: lo que hay abajo es lo que se pinta hoy.

> ⚠️ **Las cinco solo aparecen en condiciones de EXCEPCIÓN — medido, no supuesto.** Ninguna se
> pinta en un libro que cuadra. La condición exacta va en cada pregunta, porque **sin ella no se
> puede decidir el texto**: un aviso de descuadre no se aprueba igual si salta por un céntimo de
> redondeo que si salta porque falta una factura entera.

### 21.1 · `descuadre` — 🔴 la que más importa, y no es un rótulo

**(a) Qué la dispara.** `libroRegistroView.js:231`, dentro de `if (asientos.length === 0)` (`:229`):

```js
if (libro.miradas > 0) avisar(COPY.descuadre(libro.miradas), 'warning');
```

Es decir: **se examinaron N facturas y no salió NI UN asiento**. `miradas` está definido en
`libroRegistro.ts:105` como «cuántas facturas se examinaron», y su comentario (`:18-20`) dice que
existe justamente para separar «no había» de «algo está roto». Cero asientos con `miradas: 0` es un
negocio que no ha facturado; cero asientos con `miradas: 40` es **un libro que no cuadra**.

**(b) Qué se pinta hoy** (`libroRegistroView.js:53-55`):

> `[PENDIENTE microcopy oficial] El libro no cuadra: se han revisado 40 facturas y no ha salido
> ningún asiento. No lo tomes como que no has facturado.`

**(c) Qué hay que decidir.**

🔴 **Lo que se aprueba aquí NO es una etiqueta: es un CONSEJO.** La segunda frase —«no lo tomes
como que no has facturado»— le dice al profesional **cómo interpretar un libro fiscal incompleto**.
Es una instrucción, y por eso no la aprueba el fundador.

Tres preguntas concretas:

1. ¿Debe el producto **afirmar** que el libro no cuadra, o limitarse a decir que no se ha podido
   construir y remitir al asesor?
2. La frase «no lo tomes como que no has facturado» ¿se queda, se reformula o se retira?
3. ¿Debe este aviso **impedir** algo (descargar el libro, presentarlo) o solo avisar?

### 21.2 · `avisoIlegibles` — importes que no se pudieron leer

**(a) Qué la dispara.** `libroRegistroView.js:223-225`:

```js
if (Array.isArray(libro.importesIlegibles) && libro.importesIlegibles.length > 0) { … }
```

`importesIlegibles` (`libroRegistro.ts:120`) son **los números de las facturas cuyo importe no se
pudo leer**. La fila sale en el libro, pero su total va vacío y se marca en gris
(`libroRegistroView.js`, `tdTotal.dataset.ilegible`).

**(b) Qué se pinta hoy** (`:56-58`):

> `[PENDIENTE microcopy oficial] Hay importes que no se han podido leer (F-2026-1, F-2026-7). No los
> tomes por cero: escríbenos y los revisamos.`

**(c) Qué hay que decidir.** Otra vez hay una instrucción dentro («no los tomes por cero») y además
**una promesa de canal** («escríbenos y los revisamos»). ¿Se mantiene la promesa? ¿Y qué debe
entender el profesional sobre la validez del libro mientras haya importes ilegibles?

### 21.3 · `avisoAjenas` — filas descartadas por no ser de este negocio

**(a) Qué la dispara.** `libroRegistroView.js:226`:

```js
if (libro.ajenas > 0) avisar(COPY.avisoAjenas, 'warning');
```

`ajenas` (`libroRegistro.ts:107`) son **filas descartadas por no pertenecer a este merchant**. Su
comentario dice: «se cuentan, nunca se tiran en silencio».

**(b) Qué se pinta hoy** (`:59`):

> `[PENDIENTE microcopy oficial] Se han descartado facturas que no son de este negocio.`

**(c) Qué hay que decidir.** Que esto aparezca **debería ser imposible** —significa que la consulta
trajo datos de otro obligado tributario—. ¿Debe el profesional ver este aviso, o es un fallo interno
que tiene que avisarnos a nosotros y no a él? Y si lo ve, ¿qué se le pide que haga?

### 21.4 · `avisoSinNumero` — facturas sin número, que no son asiento

**(a) Qué la dispara.** `libroRegistroView.js:227`:

```js
if (libro.sinNumero > 0) avisar(COPY.avisoSinNumero(libro.sinNumero), 'warning');
```

`sinNumero` (`libroRegistro.ts:109`) son **filas sin número de factura**. Su comentario lo razona:
«no son asiento (el número ES la identidad fiscal), pero se declaran». Existe además su importe
agregado, `sinNumeroImporte` (`:118`), que **hoy esta pantalla no enseña**.

**(b) Qué se pinta hoy** (`:60`):

> `[PENDIENTE microcopy oficial] 3 facturas sin número no aparecen como asiento.`
> (en singular: `1 factura sin número no aparece como asiento.`)

**(c) Qué hay que decidir.** ¿Basta con decir cuántas son, o **hay que decir también cuánto dinero
suman**? El dato existe (`sinNumeroImporte`) y el propio código anota que un «hay 3 facturas fuera»
sin decir cuánto es **no se puede revisar a mano**. Y la pregunta de fondo: ¿es correcto que una
factura sin número quede fuera del libro y solo se avise?

### 21.5 · `trazaNoSellado` — albaranes posteriores al sello

**(a) Qué la dispara.** `libroRegistroView.js:332-334`, por cada fila de la tabla:

```js
if (e.albaranesNoSellados > 0) { … COPY.trazaNoSellado + ' ×' + e.albaranesNoSellados … }
```

Es decir: esa factura tiene **albaranes firmados DESPUÉS de que la factura se sellara**.

**(b) Qué se pinta hoy** (`:73`), como chip ámbar dentro de la fila:

> `[PENDIENTE microcopy oficial] Albarán posterior al sello ×2`

**(c) Qué hay que decidir.** ¿Qué significa fiscalmente que aparezca trabajo firmado después del
sello de la factura? ¿Es una anomalía que hay que nombrar como tal, o una situación normal (una
segunda visita) que solo se informa? El texto de hoy no dice ninguna de las dos cosas: solo constata.

---

> **Nota de procedencia.** Estas cinco salen del inventario de SCRUM-514 (tanda del 19-ago-2026),
> donde se derivaron por AST las 21 ranuras de la pantalla y se separaron las que aprueba el
> fundador de las que necesitan dictamen fiscal. **No se han reescrito ni aprobado**: siguen con su
> marcador hasta que haya respuesta.

---

# P17. El cliente final frente a sus propios datos ya congelados en una factura emitida — mismo precedente que E/13, sujeto distinto

> **Formulada por J4 (SCRUM-1023), a partir del hallazgo de J2 en SCRUM-1015: no existe ninguna
> ruta para que un CLIENTE FINAL (no el merchant) ejerza su derecho de supresión sobre sus propios
> datos.**

Para el MERCHANT que pide borrar su cuenta (pregunta **E/13** de este mismo documento), el código
ya aplica el art. 17.3.b RGPD: se anonimizan sus datos identificativos vivos, pero los campos ya
sellados dentro de una factura emitida (nombre/NIF/email/teléfono del CLIENTE, congelados en
`Invoice` al emitir — SCRUM-729/665) se conservan siempre, porque forman parte del registro de
facturación con obligación legal de conservación
(`src/modules/system/domain/anonimizarMerchant.ts:5-16,36-38`).

**1)** ¿Aplica el mismo criterio, con la misma base legal, cuando quien pide el olvido es el
CLIENTE FINAL del profesional pidiendo sobre SUS PROPIOS datos, y no el profesional pidiendo sobre
datos de un tercero? ¿O el hecho de que sea el propio titular quien lo pide (no un tercero) cambia
el análisis?

**2)** Si la respuesta es "se aplica igual, se anonimiza la ficha viva y la factura se queda",
¿hace falta decírselo al cliente en algún texto oficial (K1/N5, regla 30) — por ejemplo al pie de
la factura, o cuando pida su borrado?

**Bloquea:** cualquier construcción futura de un flujo de supresión/portabilidad por cliente final
(hoy no existe ninguno) y la revisión de J4 sobre la entrega a la gestoría (decisión pendiente,
`dos-equipos.md` §7, datos de clientes salen a un tercero).

---

# P18. Los datos del EMISOR en una factura rectificativa, cuando han cambiado desde la original

> **Formulada por J4 (SCRUM-1085), a partir de la instrucción explícita de Javier: «lo llevamos al
> asesor» (22-sep-2026), sobre el PENDIENTE marcado a propósito en el comentario 16468 de Jira
> SCRUM-665.**

Un autónomo emite en enero; en marzo cambia su domicilio fiscal (o constituye una sociedad, o
cambia de denominación); en octubre emite una rectificativa sobre la de enero.

**1)** ¿Qué datos del expedidor deben figurar en la rectificativa: los de la fecha original o los
vigentes al rectificar?

**2)** ¿Cambia la respuesta si lo que cambió fue el **NIF** (p. ej. constituyó una SL) frente a
domicilio o denominación? Si la rectificativa lleva un NIF distinto al de la factura que rectifica,
¿sigue siendo válida como rectificativa de aquella?

**3)** Al reimprimir una copia de la factura original años después, ¿debe salir con los datos de
expedidor de entonces?

**4)** ¿Hay obligación de conservar el historial de datos identificativos del expedidor, más allá
del dato que figuró en cada factura?

Hoy el programa ya congela los datos del emisor al emitir (`src/modules/invoicing/domain/emisorCongelado.ts`,
SCRUM-665). El camino de la rectificativa se dejó **SIN DECIDIR a propósito**: en
`src/modules/system/app/routes/invoicesAdmin.routes.ts` (ruta de rectificación), una R1 congela el
emisor con la ficha VIVA del merchant al rectificar — igual que las otras siete bocas —, **no** con
la del emisor de la factura original, y el código lo marca literalmente como «PENDIENTE, marcado a
propósito y sin resolver por omisión», a la espera de esta pregunta. El cliente (destinatario) sí
tiene resuelto el caso simétrico: hereda el de la factura que rectifica
(`congelarParaRectificativa`, SCRUM-729).

**Bloquea:** SCRUM-665 (qué criterio usa `congelarEmisorDesdeFicha` en la ruta de rectificación).

---

# P19. El PRODUCTOR del SIF, ¿puede ser DOS personas físicas?

> **Formulada por J4 (SCRUM-1087), a partir de una decisión de Javier dicha hoy (23-sep-2026),
> literal: «De momento nadie, pero seremos los dos, más bien la empresa que conformemos dentro de
> poco» — refiriéndose a él mismo y a Luis Lara Granado. Y sobre las pruebas: «si hace falta uno
> para pruebas me pongo yo, pero el día que haya algo real será como empresa».**

**El problema concreto, medido en el código, no supuesto:** el bloque `SistemaInformatico` del
registro tiene un solo campo de productor — `nombreRazonProductor: string` y `nifProductor: string`
(`src/modules/fiscal/verifactu/registro.builder.ts:19-21`), que se vuelcan tal cual a
`<sum1:NombreRazon>`/`<sum1:NIF>` del XML (`:377-378`). Un nombre, un NIF. «Los dos» no cabe ahí, y
tampoco en `docs/legal/DECLARACION_RESPONSABLE.md` §1 ("Productor del sistema"), que hoy es un único
placeholder de razón social + NIF.

**1)** ¿Puede una **declaración responsable** del art. 13 RRSIF nombrar a **dos personas físicas** como
productor conjunto, o el propio formato (un NIF por declaración) obliga a elegir una sola?

**2)** ¿Puede el productor ser una **comunidad de bienes** en vez de una persona física o una SL,
mientras la sociedad no esté constituida?

**3)** Mientras se decide y si hace falta un productor solo para las **pruebas** del entorno de la
AEAT (Javier: «me pongo yo»): si UNA sola persona física firma como productor, ¿qué responsabilidad
asume esa persona **frente a la otra** (que participa en YaQu pero no queda nombrada en la
declaración)?

**4)** Cuando se constituya la sociedad, ¿hay que **reemitir** la declaración responsable con el
nuevo productor (persona jurídica), conservando la anterior? (art. 13 RRSIF: "el productor conserva
todas las versiones").

**Bloquea:** rellenar `docs/legal/DECLARACION_RESPONSABLE.md` §1 y los valores reales de
`nombreRazonProductor`/`nifProductor` — hoy los dos son placeholders sin rellenar.

---

# P20. 🔴 La huella sella el REGISTRO — ¿también tiene que ser inmutable el PDF entregado?

> **Formulada por J4 (SCRUM-1087). Del enunciado de SCRUM-665, sin preguntar desde el 2-sep-2026 —
> hoy bloquea una decisión de diseño, y por eso es la más urgente de las dos preguntas de esta
> entrada.**

**Medido hoy, no supuesto:** el PDF de una factura emitida se **regenera** con el código actual cada
vez que falta en disco. `ensureInvoicePdf` (`src/lib/invoicing.ts`) comprueba
`!fs.existsSync(diskPath)` entre las condiciones de `needs`, y si el fichero no está, vuelve a llamar
a `generateInvoicePdf` (`src/modules/invoicing/infra/pdf/pdf.service.ts`) — y `storage/invoices` vive
en el disco de Railway, que es **efímero** entre despliegues. Los **DATOS** que entran en esa
regeneración ya están congelados (el emisor sale de la columna congelada de la factura, no de la
ficha viva del merchant — `emisorDelDocumento`, SCRUM-665/729, ver P18 arriba); el **DISEÑO**
(plantilla, maquetación, qué campos se imprimen y cómo) sale del código de `generateInvoicePdf` **tal
como está hoy**, no como estaba el día de la emisión. Si la plantilla cambia en marzo, una factura de
enero que se regenere en abril sale con el diseño de marzo.

**1)** La huella encadenada sella el **registro de facturación** (los datos: base, cuota, NIF,
fecha...). ¿Exige la norma que el **documento** entregado al cliente (el PDF) sea también el mismo
bit a bit que el generado el día de la emisión, o basta con que los DATOS que contiene coincidan con
el registro sellado?

**2)** La copia que el expedidor debe conservar (art. 19 ROF: conservar "las copias o matrices de las
facturas expedidas") — ¿es una copia del **documento** tal como se entregó, o basta con poder
**reconstruirlo** a partir de los datos conservados?

**3)** Si la respuesta exige el documento inmutable: ¿basta con archivar el PDF generado en el
momento de la emisión (aunque el disco donde vive hoy sea efímero), o hace falta además versionar la
**plantilla/el motor de generación** para poder reproducirlo bit a bit más adelante?

🔴 **De esta respuesta depende elegir entre CUATRO salidas** — sin ella no se construye ninguna:
- (a) archivar el PDF generado en el momento de emitir (en almacenamiento persistente, no en disco
  efímero) y servir SIEMPRE ese archivo, nunca regenerar;
- (b) no archivar el PDF pero congelar/versionar la plantilla de generación, de forma que una
  regeneración futura reproduzca el mismo documento;
- (c) las dos cosas;
- (d) asumir que solo el registro necesita ser inmutable, y dejar el PDF como está hoy (se regenera
  con el diseño vigente).

**Bloquea:** decisión de diseño sobre `ensureInvoicePdf` (`src/lib/invoicing.ts`) y
`generateInvoicePdf` (`src/modules/invoicing/infra/pdf/pdf.service.ts`).

---

## RESPUESTAS · 22-sep-2026 (asesor, contra FAQ AEAT 21-jul-2026 y ROF consolidado 31-mar-2026)

> **Quien preparó estas respuestas:** una sesión de IA de este equipo, consultando la FAQ de la AEAT y el BOE, el 22-sep-2026. **No las ha revisado un asesor humano.** Javier decidió ese mismo día mantener la cabecera «asesor» (SCRUM-1079, comentario 16403). Las **14 marcas ⚠** señalan lo que su propio autor no pudo releer en fuente oficial: **ninguna de ellas se convierte en microcopy ni en guard sin cotejarla antes.**

Todo lo verificado hoy sale de la FAQ oficial de la AEAT (actualizada a 21-jul-2026), del texto consolidado del ROF (RD 1619/2012, últ. act. 31-mar-2026) y del ticket SCRUM-143. Lo que no se ha podido releer en fuente oficial en esta sesión va marcado ⚠.

---

## P14 🔴 · ¿YaQu ya es «productor» de un SIF (art. 3.2 RRSIF / 201 bis LGT)?

**Hoy, tal como está desplegado para merchants reales, no.** Pero la frontera es estrecha y depende de un hecho medible, no de una intención.

Lo que dice la AEAT, literal:
- El RRSIF se aplica «solo a aquellos que se utilicen para expedir facturas (incluyendo las facturas simplificadas)» y «no se aplicará a otros sistemas informáticos que se utilicen para emitir otro tipo de documentos justificativos» (FAQ *Cuestiones generales: objeto*; arts. 1.1 y 1.2 RRSIF).
- «Un SIF […] es, en esencia, un sistema informático utilizado para expedir FACTURAS. Así que el RRSIF no aplica a sistemas informáticos que no expidan facturas» (FAQ *Ámbitos de aplicación*, NOTA 1).
- El productor/comercializador entra en el reglamento «en las cuestiones relativas a sus respectivas actividades de producción y comercialización de los sistemas informáticos destinados a ser utilizados» por los obligados (art. 3.2 RRSIF).

Consecuencia: mientras `INVOICING_ES_ENABLED` esté en OFF para todo merchant real y lo que se entrega sea un documento no fiscal, YaQu comercializa un sistema que **no expide facturas** y por tanto no es SIF ni YaQu productor de SIF. El plazo del productor (29-jul-2025, DF 4.ª) es real, pero se activa **el día en que el producto expida la primera factura a un obligado real**.

Tres riesgos que sí hay que tener delante:

1. **Capacidad frente a uso.** En la FAQ sobre tenencia, la AEAT admite un programa no adaptado «si y solo si se puede acreditar que con él YA NO se pueden expedir facturas». Trasladado al productor: un flag en OFF es defendible sólo si es demostrable que ningún merchant real puede emitir factura por ninguna vía (guards, tests, sin camino de código). Eso ya existe (regla 24); lo que hay que poder es **acreditarlo**.
2. **El documento «que debería ser factura».** En la FAQ del comerciante con balanza, la AEAT considera SIF a la caja que imprime «lo que debería ser una factura simplificada». Un fontanero en estimación directa está obligado a expedir factura por cada servicio (art. 26.1 ROF). Si el documento que YaQu entrega al cobrar es, en la práctica, el único que recibe el cliente y sustituye a la factura, existe riesgo de recalificación. Lo que lo neutraliza: que el documento diga expresamente que no es factura y que la factura la expide el profesional por sus medios (como ya recoge `ALCANCE_BETA.md`). Es una cuestión interpretativa; se señala, no se resuelve aquí.
3. **Art. 201 bis.1, letras a)–d)** (contabilidades distintas, no reflejar transacciones, registrar transacciones distintas, alterar registros) son sancionables **desde el 11-10-2021** para cualquier software que soporte facturación o gestión, con RRSIF o sin él. La regla 29 (lo emitido no se edita ni se borra) es la que protege aquí; conviene que alcance también a los documentos no fiscales.

**Qué desbloquea:** el plan SIF-1 no se cae. Lo que cambia es la formulación: la premisa correcta no es «ya somos productor», sino «seremos productor en el instante en que se encienda el flag para un real, y en ese instante hay que estar plenamente adaptado (DF 4.ª) y con declaración responsable emitida (art. 13 RRSIF)».

---

## SCRUM-143 🔴 · ¿El Convenio con la AEAT exige ser sociedad?

**Sí, y está contestado desde julio.** Los correos de la AEAT en el ticket dicen literal que los acuerdos de colaboración social «se suscriben con entidades con personalidad jurídica y carácter mercantil (sociedades anónimas, sociedades de responsabilidad limitada, cooperativas, etc)», y piden copia de los estatutos con el objeto social como desarrolladora de software.

Lo que el ticket ya deja cerrado y los comentarios del 21-sep confirman contra la FAQ:
- Sin convenio 017 **no se puede actuar como colaborador social en el entorno de pruebas remitiendo registros de terceros** (punto 5 de la respuesta AEAT).
- Remitir **registros propios** con certificado propio no exige convenio ni sociedad (FAQ *Colaboración social*: «el envío podrá ser efectuado por el propio obligado tributario o por un tercero que actúe en su representación»).
- La propia AEAT avisa (punto 6) de que hasta la orden ministerial de la solución pública de facturación electrónica no puede afirmar que los acuerdos de colaboración social «sirvan para su aplicación efectiva». Ese riesgo sigue vivo y no depende de YaQu.

Decisión del fundador (24-jul): SL + Convenio 017 (Modelo A) y mientras tanto construir con Modelo C. No hay nada nuevo que reabrir.

---

## A · Cómo se envía a la AEAT (modelo de representación)

Las tres vías, con lo que exige cada una (todo verificado en la FAQ *Cumplimiento y delegación* y *Colaboración social*):

| Vía | Quién remite | Requisitos | Cómo se otorga |
|---|---|---|---|
| **Colaborador social (017)** | YaQu con su certificado, por todos | Sociedad mercantil + convenio firmado (≈1 mes, no garantizado) | Modelo **Anexo I** de la Resolución de 18-dic-2024. Se firma y **lo custodia YaQu**, no se presenta a la AEAT salvo requerimiento |
| **Apoderamiento** | YaQu como apoderado | Poder inscrito en el Registro de apoderamientos, general o específico VERI*FACTU | El cliente lo da de alta él (comparecencia, documento notarial, o por internet con Cl@ve/certificado) |
| **Obligado con su certificado** | Cada merchant | Su certificado electrónico | Nada |

Dos cosas que la FAQ dice y que tocan directamente al producto:
- Para otorgar la representación al colaborador social **«no se admitirán modalidades de aceptación de condiciones del servicio»**. El Anexo I tiene que firmarse de forma manuscrita (con copia del DNI) o con firma electrónica cualificada / avanzada del art. 26 eIDAS. ⚠ Si la firma con el dedo + foto del DNI cumple el art. 26 eIDAS (vinculación única al firmante, control exclusivo, detección de cambios) es cuestión que debe validar el asesor legal; el ticket asume que sí sin haberlo contrastado.
- La delegación en un tercero «no exime al obligado a expedir facturas de la responsabilidad sobre dicho cumplimiento» (art. 6 RRSIF; art. 5 ROF). El merchant sigue siendo el responsable; eso es lo que deben decir los ToS.

**Qué desbloquea:** el cliente mTLS y el sobre SOAP se pueden construir y probar con certificado propio de YaQu sobre registros propios (Modelo C). La custodia de N certificados de merchants (opción b del one-pager) no aparece en ninguna FAQ como vía prevista; la vía prevista para «YaQu remite por otros» es el 017 o el apoderamiento.

---

## B · Estructura de los registros

**B2 · Datos del productor.** Los que figuren en la declaración responsable y en el bloque `SistemaInformatico` de cada registro. Con la SL decidida, el productor será la SL (NIF de persona jurídica); mientras no exista, el único productor posible es la persona física. Si se emite alguna factura real antes de constituirla, la declaración responsable y los registros llevarían al autónomo como productor, y habría que reemitirla al cambiar de productor (art. 13 RRSIF: versionada, se conservan todas).

**B3 · NIF del cliente final.** Esto cambia respecto a lo que decía el one-pager, y a mejor:
- Art. 6.1.d) ROF, párrafo 3.º: en una **factura completa** el NIF del destinatario es **obligatorio** en «operaciones que se entiendan realizadas en el territorio de aplicación del Impuesto y el empresario […] haya de considerarse establecido en dicho territorio». Es decir, en el caso de YaQu siempre. No hay F1 legal a un particular sin NIF.
- La FAQ *Procedimientos de facturación* lo cierra: se anotan como F2 «las facturas completas para las que no sea obligatoria la consignación del NIF del destinatario en virtud del 6.1.d)». Como aquí sí es obligatoria, el indicador `FacturaSinIdentifDestinatarioArt61d` **no es la salida**.
- La salida es la **factura simplificada (F2)**, y el umbral no es 400 €: el art. 4.2.c) ROF permite simplificada hasta **3.000 € IVA incluido** en «ventas o servicios a domicilio del consumidor». Los oficios a domicilio están literalmente ahí.
- Por encima de 3.000 € (o si el cliente es empresario/profesional, art. 2.2.a ROF): factura completa con NIF, sin alternativa.
- Matiz importante para el nicho: si el particular pide factura «para el ejercicio de cualquier derecho de naturaleza tributaria» (p. ej. deducciones por obras de eficiencia energética en IRPF), la simplificada debe llevar NIF y domicilio del destinatario (art. 7.3 ROF) y se registra como **F1** (simplificada cualificada, FAQ *Tipo de facturas*).

**B4 · TipoRectificativa.** Confirmado **I**. La FAQ dice literal: con clave «I» «no se deben rellenar los campos adicionales “Base rectificada” y “Cuota rectificada”», y la identificación de las facturas rectificadas es opcional. Coincide con lo que ya emite `registro.builder.ts` y con la guía del 19-ago. Cerrado.

---

## C · Paquete legal

- **C5 · Declaración responsable:** art. 13 RRSIF y art. 15 de la Orden HAC/1177/2024 (título fijo, contenido mínimo, orden). La AEAT publica ejemplos en sede como modelo. Se emite **antes** de la primera factura real y se versiona por release. El borrador de `DECLARACION_RESPONSABLE.md` ya apunta a esos artículos; lo que le falta son los datos del productor (B2).
- **C6 · ToS:** el punto jurídico que sostiene el reparto es el art. 5.1 ROF y art. 6 RRSIF: el obligado a expedir «será el responsable del cumplimiento de todas las obligaciones». YaQu responde de la conformidad técnica del SIF frente a la AEAT (art. 201 bis.1); el merchant, del contenido y de su obligación de facturar.
- **C8 · Anticipos:** art. 75.Dos LIVA (devengo al cobro del anticipo) y art. 2.1, párrafo 2.º ROF (obligación de expedir factura «por los pagos recibidos con anterioridad»). La final descuenta los anticipos. Ya está en el expediente P1-P10; nada lo contradice.
- **C9 · RGPD:** ver E y P17. Un apunte que la FAQ deja claro y afecta a la política: el RRSIF exige disociar el acceso a datos con trascendencia tributaria del resto (art. 8.4 RRSIF). Eso es también un argumento RGPD de minimización.

---

## D · Calendario y coste

(Ampliado en la addenda del final.) No hay fuente oficial sobre el coste de la revisión externa. Lo que la AEAT sí dice: sin condición de colaborador social no se puede probar el envío en nombre de terceros en el entorno de pruebas; el plazo del 017 «en condiciones normales podría ser de un mes», sin compromiso.

---

## E · Baja de un profesional: qué se borra y qué se conserva

**Opción (a), y con la mayor de las cifras de conservación que aplique.**

- **Base para conservar:** art. 17.3.b) RGPD (excepción a la supresión por obligación legal); art. 19 ROF («conservar, durante el plazo previsto en la LGT», las copias de las facturas expedidas); art. 8.2.c) RRSIF (conservación de los registros de facturación durante el plazo de la LGT); art. 30 Código de Comercio (seis años).
- **Plazo:** la LGT fija la prescripción en 4 años (art. 66), pero el art. 30 CCom exige **6 años** desde el último asiento a todo empresario, y ese es el que ya publica la política de privacidad. Mantener 6. ⚠ Art. 30 CCom y art. 66 LGT citados de memoria: son literales estables, pero no releídos hoy.
- **Cómo conservar sin usar:** el mecanismo del RGPD español para esto es el **bloqueo** (art. 32 LOPDGDD): los datos se conservan sólo a disposición de Administraciones y jueces durante la prescripción y se destruyen después. ⚠ Artículo citado de memoria.
- **(b) queda descartada por la propia norma fiscal**, no sólo por la huella: una factura anonimizada deja de cumplir el art. 6.1.c)-e) ROF y la FAQ prohíbe alterar un registro ya generado («no hay acciones permitidas sobre los registros de facturación una vez producidos»). Anonimizar sí procede en lo que **no** está dentro de la factura ni del registro (ficha de contacto, presupuestos no facturados, mensajes).
- **(c) borrado total** contravendría el art. 19 ROF y el 8.2.c) RRSIF.

**Qué desbloquea SCRUM-244:** lista de borrado = todo menos facturas, registros VeriFactu, `AuditLog` fiscal y los datos identificativos del emisor que van dentro de ellos; bloqueo 6 años; destrucción después.

---

## F · Exentas, no sujetas e inversión del sujeto pasivo

| Caso | Norma | En la factura (ROF) | En el registro VeriFactu |
|---|---|---|---|
| Ejecución de obra de **construcción o rehabilitación** de edificación, entre empresarios, contrato promotor-contratista o subcontrata | Art. 84.Uno.2.º.f) LIVA ⚠ | Sin IVA + mención «inversión del sujeto pasivo» (art. 6.1.m ROF) | `CalificacionOperacion = S2` ⚠ |
| Renovación/reparación en **vivienda** para particular (o comunidad), edificio ≥ 2 años, materiales ≤ 40 % de la base | Art. 91.Uno.2.10.º LIVA ⚠ | Tipo 10 % | `S1`, tipo 10 |
| Operación **exenta** (art. 20 LIVA; rara en oficios) | Art. 20 LIVA | Referencia al precepto o «operación exenta» (art. 6.1.j ROF) | `OperacionExenta = E1` ⚠ |
| **No sujeta** | Art. 7 LIVA | Sin cuota | `N1` ⚠ |
| Mezcla de casos en una factura | Art. 6.2 ROF | Base **separada** por cada bloque | Una línea de desglose por bloque |

⚠ Los artículos 84 y 91 LIVA se citan de memoria (el consolidado del BOE no devolvió esos artículos hoy); las claves S1/S2/N1/E1 son de las listas del anexo de la Orden HAC/1177/2024 y conviene cotejarlas visualmente. Lo que no depende de YaQu: si una obra concreta es ISP o 10 % lo decide el hecho (quién es el destinatario, qué edificio, cuánto material). Encaja con `HITOS-producto.md`: el sistema pregunta, no decide.

---

## G · El presupuesto adicional cuando aparece trabajo extra

(Sustituido por la addenda del final, que tiene la respuesta completa de consumo.) Fiscalmente no hay figura nueva: el adicional es o **parte de la misma obra** (una única prestación que devenga al concluir; si se cobra antes, anticipo del art. 75.Dos) o **una operación distinta** (devenga al completarse). Lo único que exige el ROF es que la factura describa las operaciones con los datos para determinar la base (art. 6.1.f).

---

## P11-P13 · Tres tipos de factura

- **P11 · Sin identificar al cliente:** resuelto en B3. Particular sin NIF → **F2 simplificada** hasta 3.000 € (art. 4.2.c ROF); si pide factura con NIF → simplificada cualificada, registrada como F1; > 3.000 € o empresario → completa con NIF obligatorio. El caso `FacturaSinIdentifDestinatarioArt61d` no procede para un emisor establecido en TAI.
- **P12 · Suplidos:** art. 78.Tres.3.º LIVA ⚠ (no forman parte de la base si son en nombre y por cuenta del cliente, con factura a nombre del cliente). La FAQ *Registros de facturación: alta* lo cierra para VeriFactu: los suplidos «no son importes “propios” del registro de facturación y no tienen que incluirse»; si se incluyen en el importe total, «deberán consignarse como importe no sujeto al IVA o cantidades a tipo cero». Pueden ir en la factura impresa sin problema.
- **P13 · Recargo de equivalencia:** sólo aplica si el merchant **vende bienes a un comerciante minorista en RE** para reventa (art. 16.4 ROF: factura separada con tipo y cuota del recargo). Para un oficio que presta servicios a particulares, no se da. Y la FAQ confirma que quien está en RE no está obligado a expedir factura salvo excepciones (art. 3.1.b ROF), lo que reduce aún más el caso.

---

## P15-P16 · Libros Registro

- **Formato:** el contenido lo fija el art. 63 RIVA (facturas expedidas) y, para IRPF en estimación directa, la Orden HAC/773/2019. La AEAT publica un **diseño normalizado** (XLSX, actualizado 01-01-2026) que sirve para atender requerimientos, importar en Renta WEB, Pre303 y modelo 130. No es obligatorio como formato de llevanza, pero es el que la AEAT acepta sin subsanación. Si YaQu exporta un libro, ese es el diseño a seguir.
- **Qué factura se declara:** se anotan **todas** las expedidas (completas, simplificadas y rectificativas, con su serie), sea quien sea quien las expida materialmente (FAQ *Cumplimiento y delegación*). Las rectificativas se anotan con su importe (negativo si «I»). Y un aviso de la FAQ de la Excel: si YaQu procesa la información de facturación para «generar directamente los libros registros de IVA, los libros registro de IRPF […] o cualquier otro resultado que se utilice para el cumplimiento voluntario de obligaciones tributarias», eso lo cualifica como SIF. El módulo de resumen 303 entra en esa descripción: irrelevante mientras no expida facturas, decisivo cuando las expida.

---

## P17 · El cliente final frente a sus datos ya congelados en una factura

El derecho de rectificación (art. 16 RGPD) recae sobre datos **inexactos**. Dos casos:
- **Error en la factura** (nombre mal escrito, NIF equivocado): la vía es fiscal y es obligatoria: **factura rectificativa** (art. 15.1 ROF: cuando «la factura original no cumpla alguno de los requisitos de los artículos 6 ó 7»; tipo R4 en VeriFactu si es dato no monetario, según la FAQ). Con eso se cumple el art. 16 RGPD sin tocar el documento original.
- **Cambio posterior** (se mudó, cambió de nombre): la factura no era inexacta en su fecha; no hay nada que rectificar en ella. El dato se actualiza en la ficha de contacto y la factura se conserva bajo el art. 17.3.b) RGPD.

En ambos casos la factura original y su registro no se editan (FAQ: «no podrá alterarse o manipularse el primer registro»). La política de privacidad debe decirlo con esas palabras.

---

## Lo que no se ha verificado hoy (⚠ resumen)

Arts. 84.Uno.2.º.f), 91.Uno.2.10.º y 78.Tres.3.º LIVA; art. 30 CCom; art. 66 LGT; art. 32 LOPDGDD; claves S1/S2/N1/E1 del anexo de la Orden. Todo son textos estables citados de memoria, pero conviene cotejarlos antes de convertirlos en microcopy o en un guard.

---

## ADDENDA 09:40 · D y G desarrolladas

### D · Calendario y coste

**D12 · Requisito previo para el entorno de pruebas de la AEAT — RESPONDIDO.**
- El Portal de Pruebas Externas dice literal que sirve «de forma totalmente libre, con la única condición de autenticarse mediante un certificado electrónico», y que lo presentado «se guarda en una Base de Datos del entorno de pruebas de la AEAT, sin que en ningún caso tengan trascendencia tributaria». **No hay alta previa.** El menú VERI*FACTU del portal ofrece «Cliente de servicio web — con certificado», la app gratuita y la consulta de registros.
- Endpoints de preproducción: `prewww1.aeat.es` (certificado estándar), `prewww10.aeat.es` (certificado de sello), `prewww2.aeat.es` (cotejo QR). Coinciden con `SIF_SPEC_NOTES.md`.
- La única restricción real es la de la AEAT en julio (SCRUM-143, punto 5): sin condición de colaborador social **no se puede remitir en pruebas registros de terceros**. Con certificado propio sobre NIF propio, sí: el fundador (persona física, autónomo) o la SL cuando exista entran como «Obligado a la Emisión» de sus propios registros.
- Segunda vía ya en el ticket: el PDF «Aclaraciones a dudas de los desarrolladores» (04-dic-2025) contempla facturas de prueba en **producción**, en serie propia (`PRU…`), descritas como prueba y siempre anuladas después. Esas son facturas reales del obligado; en el portal de pruebas no hay trascendencia tributaria.

Consecuencia: **S1-D puede arrancar hoy** con un certificado FNMT de persona física (o de representante cuando exista la SL). Lo que sigue bloqueado por la SL es probar en nombre de un merchant.

**D11 · Coste y plazo de la revisión fiscal externa — SIN FUENTE, decisión del fundador.** Lo que la revisión debe cubrir: (1) visto bueno a la declaración responsable con los datos de la SL; (2) los ToS con el reparto art. 5 ROF / art. 6 RRSIF; (3) el Anexo I de representación y si la firma con el dedo + DNI cumple el art. 26 eIDAS; (4) los ⚠ abiertos: arts. 84/91 LIVA y art. 32 LOPDGDD. Los 300-600 € del máster son estimación sin fuente. El único plazo oficial es el del 017: «en condiciones normales podría ser de un mes», sin compromiso (correo AEAT).

### G · El adicional en obra — RESPONDIDO (consumo, normativa autonómica)

Para Madrid la Comunidad lo tiene escrito (página *Reformas del hogar*, actualizada 16-sep-2026; base: Decreto 35/1995 de servicios a domicilio y Decreto 1/2010, reglamento de la Ley 11/1998 de Protección de los Consumidores de la CM):

> «La empresa o profesional debe comunicarle inmediatamente las averías o defectos ocultos que puedan aparecer después del presupuesto, por escrito e indicando el incremento del importe que suponen esos nuevos trabajos. Este nuevo documento tiene que estar firmado por ambas partes, antes de iniciar la reparación.»
> «Si no está conforme, debe indicar “no aceptado”, lo cual dejaría el presupuesto como al inicio y no se realizarían las reparaciones surgidas posteriormente.»

Y en la factura, al dorso: «La cuantía de la factura deberá corresponderse con la cuantía presupuestada, incluyéndose cualquier modificación realizada al presupuesto inicial».

| Regla | Qué implica |
|---|---|
| El adicional es un **documento nuevo, escrito, con el incremento**, firmado por ambas partes **antes** de ejecutar | No vale un mensaje de WhatsApp ni una línea añadida al presupuesto ya firmado: es un presupuesto adicional con su propia aceptación registrada (firma + evidencia), igual que el original |
| Rechazo explícito «no aceptado» | El adicional necesita estado rechazado, y el rechazo deja el presupuesto original intacto |
| La factura tiene que **cuadrar con presupuesto + adicionales aceptados** | La factura final referencia el presupuesto y cada adicional; nada facturado sin documento aceptado detrás |
| Fiscalmente | Si el adicional es parte de la misma obra, devenga con ella (o como anticipo si se cobra antes, art. 75.Dos LIVA); si es una prestación distinta, devenga sola. La factura describe cada bloque (art. 6.1.f ROF) |

Otras exigencias de la misma norma madrileña que afectan a presupuesto y factura de un oficio (contenido y microcopy, no fiscal):
- Presupuesto: identificación completa del prestador con **número del registro empresarial** de Industria CM; nombre y domicilio del cliente; descripción y dirección de la obra; cantidad, calidad y precio de materiales; precio de mano de obra y total con impuestos; fechas aproximadas de inicio y fin; validez del presupuesto y garantía; fecha y firma del prestador y espacio para la firma del cliente con la frase «**Presupuesto recibido antes de la realización de los trabajos**»; si hay materiales usados, espacio con «**autorizo la utilización de materiales usados**».
- Renuncia al presupuesto: orden de trabajo con «**Renuncio al presupuesto previo y autorizo la reparación**» escrita de puño y letra del cliente y firmada, más la leyenda en mayúsculas «La renuncia al presupuesto se efectúa conociendo el derecho a solicitar presupuesto previo y conociendo las posibles consecuencias jurídicas y económicas de la renuncia».
- Factura: número; datos del prestador incluido teléfono y registro empresarial; nombre y domicilio del cliente; descripción; **precio total con desglose materiales / mano de obra / IVA**; **periodo de garantía**; **fecha y firma del prestador y del cliente**; leyendas al dorso citadas arriba.
- Garantía: la del servicio la fija la empresa por escrito; piezas y materiales nuevos 3 años, usados mínimo 1.

⚠ Es normativa **autonómica**: Madrid lo regula así; otras CCAA tienen decretos propios de servicios a domicilio con el mismo esquema pero literales distintos. Fuera de Madrid hay que cotejar cada una. **Corrección:** el RD 58/1988 citado en la primera versión es de reparación de electrodomésticos, no de obras; queda retirado.

---

## Fuentes consultadas

- FAQ AEAT · Cuestiones generales: objeto — https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes.html
- FAQ AEAT · Ámbitos de aplicación — https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/cuestiones-generales-ambitos-aplicacion.html
- FAQ AEAT · Cumplimiento y delegación — https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/cuestiones-generales-cumplimiento-delegacion.html
- FAQ AEAT · Colaboración social — https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/colaboracion-social.html
- FAQ AEAT · Registros de facturación: alta — https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/registros-facturacion-alta.html
- FAQ AEAT · Procedimientos de facturación — https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/procedimientos-facturacion.html
- FAQ AEAT · Capacidad de remisión, certificados — https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/caracteristicas-requisitos-sif-capacidad-remision-etc_.html
- RD 1619/2012 (ROF) consolidado — https://www.boe.es/buscar/act.php?id=BOE-A-2012-14696
- Libros registro de IVA e IRPF, diseño normalizado — https://sede.agenciatributaria.gob.es/Sede/iva/libros-registro.html
- Orden HAC/773/2019 — https://www.boe.es/buscar/act.php?id=BOE-A-2019-10487
- Portal de Pruebas Externas AEAT — https://preportal.aeat.es/
- Menú VERI*FACTU del portal de pruebas — https://preportal.aeat.es/PRE-Exteriores/Inicio/_menu_/VERI_FACTU___Sistemas_Informaticos_de_Facturacion/VERI_FACTU___Sistemas_Informaticos_de_Facturacion.html
- Comunidad de Madrid · Reformas del hogar — https://www.comunidad.madrid/consumo/reformas-hogar
- Comunidad de Madrid · Normativa reformas del hogar — https://www.comunidad.madrid/consumo/normativa-reformas-hogar
- SCRUM-143 (Jira, correos AEAT jul-2026 y comentarios 21-sep-2026)
