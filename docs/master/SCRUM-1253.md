# SCRUM-1253 · ¿Se puede quitar el «justificante de cobro» del producto? Lo que dice la norma

**Medido contra:** `origin/main` = `ee0687fd91c09561a46953f309f8c44310340c58` · 2026-09-28T21:26:39Z (hora de GitHub, `gh api -i zen`)

Sesión J5 (`jv-j5`), 28-sep-2026 por la noche, por encargo del orquestador de Javier. El encargo sale
de dos frases de Javier: «Todos deberían ser facturas, dijimos de quitar el tema de justificantes» y
«revisa con el agente legal y de verifactu que esto está bien […] con la factura sobra». Después
añadió: «yo quiero que en cuanto tengamos verifactu, trabajamos en verifactu y cuando esté ok
activamos para emitir facturas» (descripción del ticket).

**Aquí sólo se lee y se cita.** No toco `src/`, ni el camino de emisión, ni los flags (reglas 38/40).
No escribo texto de pantalla (regla 39) y no cambio el máster. **No es una afirmación fiscal de
producto** (regla 7). Lo que no puedo sostener con fuente queda **SIN DETERMINAR** o **→ ASESOR**. La
competencia no se ha mirado.

## Veredicto

**SE PUEDE QUITAR, CON CONDICIONES.** Ninguna norma de las leídas obliga a entregar un «justificante
de cobro». La que obliga a algo, obliga a una **factura**, y la factura también cubre la señal (ROF
2.1, párrafo segundo). El justificante nunca cumplió esa obligación: dice «No constituye una factura»,
y aun así desglosaba el IVA, que la ley sólo deja repercutir «mediante factura» (LIVA 88.Dos). Quitarlo
**no abre ningún hueco que hoy esté cubierto**.

🔴 **Lo que NO significa.** Quitar el justificante **no le da una factura al profesional español.**
Hoy, en modo `receipt`, no sale **ningún** documento, y así lo he medido ejecutando el código (Ⓐ). Le
deja con lo que ya tiene, que es nada, y con **una promesa menos**. Es lo mismo que hizo SCRUM-1220.
«Con la factura sobra» se sostiene **con el plan que Javier escribió**: un solo documento, la factura,
que se enciende cuando VeriFactu esté listo. **No se sostiene** si se lee como «démosle la factura ya»,
porque eso choca con la regla 24 y con «cero claims hasta SIF-1 8/8».

**Las condiciones:**

1. **Lo que se quita es la FIGURA, no el modo `receipt`.** Hoy `receipt` ya no significa
   «justificante». Significa «ni documento ni cobro» (regla 24), y es la puerta de al menos quince sitios
   (Ⓐ.3). Quitar o renombrar ese modo es tocar el camino de emisión y los flags: **STOP**, y no forma
   parte de esta decisión.
2. **Lo ya emitido no se toca** (regla 29). El censo del 10-ago-2026 contó 44 `JUST` y 5 `F1` con
   número `J-` (dato de otra sesión, en `PREGUNTAS_ASESOR.md`). Cuántos hay hoy: **SIN DETERMINAR**, porque no
   mido producción. Su sitio en el libro y en el 303 sigue en SCRUM-1232 y 1252, y lo que se haga con
   ellos va → ASESOR (SCRUM-1232 §Ⓗ).
3. **El día que se encienda la factura**, cada cobro de señal por YaQu tiene que producir **en el
   momento** la factura del anticipo (ROF 2.1, 11.1 y 6.1.i). Por lo que leo, ya es así, porque el
   pago confirmado llama a `ensureInvoiceForCharge`, pero **no lo he medido** (Ⓐ.4). Si no fuera así,
   quitar el justificante sí dejaría un cobro sin documento.
4. **El máster ya lo dice, y quedan restos.** La regla 24 ya dice «ni factura, ni justificante, ni
   ningún otro documento de cobro» y «El profesional cobra por fuera de YaQu hasta que exista la
   factura». Siguen hablando del justificante como algo vivo las líneas 296, 300, 721, 981 y 1106 de
   `docs/YAQU_MASTER.md`, y el paso 1 de la skill `verifactu`. **Limpiarlos es un cambio de máster y
   lo decide Javier.** Aquí sólo se señalan.

## Ⓐ Lo medido en el código: a quién alcanza hoy el modo justificante

**Sonda:** `evidencias/SCRUM-1253/sonda-modos.mjs`, con su salida en `sonda-modos.salida.txt`. Usa las
funciones **reales** de `dist/`, compilado desde `ee0687fd` (`prisma generate` y `npm run build`, los
dos con código 0). El cliente Prisma es **falso** y **no hay ninguna base**: la sonda se lanza sin las
variables `DATABASE_URL*` en el entorno. `INVOICING_ES_ENABLED` se borra, así que manda el valor por
defecto del código (`flags.ts:16`, `false`).

| merchant | `getEmissionMode` | `allocateInvoiceNumber` | escrituras |
|---|---|---|---|
| ES real, sin override | `receipt` | **lanza `invoicing_es_disabled`** | ninguna |
| ES real, `country` vacío | `receipt` | **lanza `invoicing_es_disabled`** | ninguna |
| ES real, `country` null | `receipt` | **lanza `invoicing_es_disabled`** | ninguna |
| ES real, override ON | `fiscal` | `F260001` | `merchant.update`, `auditLog.create` |
| demo (id 1) | `demo` | `F260001` | `merchant.update`, `auditLog.create` |
| PT · MX · AR | `fiscal` | `F260001` | `merchant.update`, `auditLog.create` |

Población: 8 merchants. Caen en modo `receipt` **3**, y los **3 lanzan** sin escribir nada. **Control
positivo:** los 5 que no son `receipt` pasan la puerta y sacan número. El instrumento no está ciego:
ve el camino que sí emite.

1. **El modo `receipt` sólo se alcanza en España,** o con el país vacío o nulo, que el código trata
   como España (`emission.service.ts:37-40`), y sólo con el interruptor en OFF. Fuera de España el
   modo es siempre `fiscal`, y el flag es sólo para España (`flags.ts:72-75`).
2. **En ese modo no sale ningún documento.** La puerta única lanza (`invoiceNumber.service.ts:545-547`,
   SCRUM-1027). El generador de números `J-` (`makeReceiptNumber`) sólo lo llama
   `reservarReferenciaJustificante`, y ésta **no tiene ningún llamador** en `src/`. La única fila de
   factura que se crea es `crearFacturaEmitida.ts:65`, y los seis ficheros que la llaman también piden
   número a `allocateInvoiceNumber`. **La figura está muerta en la emisión desde el 21-sep-2026.**
   Lo que sigue vivo: las filas antiguas, el PDF que las pinta y los rótulos «Justificante» de
   `receipt.routes.ts`, `payInvoice.routes.ts`, `psp.routes.ts`, `mpWebhook.routes.ts`,
   `invoiceReminder.service.ts` e `invoiceWhatsApp.service.ts`, que se deciden por `isReceiptNumber`.
   Eso último está **leído, no medido**.
3. **`receipt` es hoy una puerta de la regla 24,** no un documento. Cuento **15 líneas** fuera de
   `emission.service.ts` que comparan `getEmissionMode(…)` con `'receipt'`, con `grep` de las dos
   palabras en la misma línea. Una comparación partida en dos líneas no entraría: es una **cota por
   abajo**. Están en `facturaSuelta.ts:88`, `invoiceNumber.service.ts:545`, `albaranes.routes.ts`
   (465, 1250, 1450), `jobs.routes.ts` (1396, 1614), `lifecycle.service.ts` (141, 164, 205),
   `weeklyDigest.service.ts:115`, `quotes.routes.ts:506`, `quoteDecisionLanding.routes.ts:653` y
   `quotesAdmin.routes.ts` (208, 515). Por eso la condición 1.
4. **En modo `fiscal`, el cobro produce la factura** (**leído, no medido**). Los webhooks de pago
   (`psp.routes.ts:51` y `:191`, `mpWebhook.routes.ts:139`) llaman a `ensureInvoiceForCharge`, que exige
   `charge.status === 'paid'` (`lib/invoicing.ts:187`). Es decir, la factura sale **al cobrar**.
5. **La factura simplificada no es un tipo del producto.** `TipoDocumento = 'F1' | 'R1' | 'JUST'`
   (`tipoDocumento.ts:52`). La `F2` sólo aparece como **una de las dos salidas pendientes del dictamen
   P11**, para facturas sin NIF del cliente (`registro.builder.ts`, `resolverSinDestinatario`).

## Ⓑ Las fuentes

Descargadas con `curl` el 28-sep-2026 a las 21:21Z, **todas de la API de legislación CONSOLIDADA**
(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/<ID>/texto`). Cada cita lleva la
vigencia de la última `<version>` con fecha anterior o igual a hoy. Los extractos literales, con los
mismos sha256, están en `evidencias/SCRUM-1253/extractos.txt`, y el extractor es el de SCRUM-1232b.

| # | norma | ID | sha256 |
|---|---|---|---|
| C2 | Ley 37/1992 (LIVA) | BOE-A-1992-28740 | `371432fc76f0ae3cb7bac8530cb1e229a8c6c6f2e09ee6fdf3f78fc18a70a202` |
| C3 | RD 1624/1992 (RIVA) | BOE-A-1992-28925 | `a558146bdd95724641edde646cd638840fedcfd2ffb8fa50ecbe85407f024a23` |
| C4 | RD 1619/2012 (ROF) | BOE-A-2012-14696 | `95d8ff283a96a2a74263fd0bc079cbd00a5c5a418ba66ec046ca2aef4d56f586` |
| C11 | Ley 58/2003 (LGT) | BOE-A-2003-23186 | `abc3a2730bef3ee18569dacd58c71bf4e51424b2058087c032d805061c72f4c9` |
| C12 | RDLeg 1/2007 (TRLGDCU, consumidores) | BOE-A-2007-20555 | `d87125d5d52fe84c71af7b32496296b3dedf20d8e002cca84294d09a17230265` |
| C13 | Código Civil | BOE-A-1889-4763 | `11bfe708d8cc5839d4c5bce97092c386a9ced055ea839463f754131ffc787750` |
| C14 | Código de Comercio | BOE-A-1885-6627 | `465ece190e3a3c9c9976627de85487c2b4a7681bb6d5ea6f7045aa736ea08c7e` |

**Control de que las fuentes no han cambiado:** C2, C3 y C4 dan **el mismo sha256** que en SCRUM-1232b
y SCRUM-1240. **Control de que es el consolidado:** el art. 7 del ROF sale vigente desde 2023-12-07,
con el apartado 5 que añadió el RD 1007/2023. El texto publicado en 2012 no podría tenerlo.

**Recuentos sobre el XML completo** (cuentan también versiones derogadas, así que son cotas por
arriba). «justificante de cobro» sale **0** veces en las siete fuentes. «justificante de pago» sale
**0**. «recibo justificante» sale **2** veces, sólo en el TRLGDCU (el art. 63, en sus dos versiones).
«carta de pago» sale **3** veces, sólo en el Código Civil.

## Ⓒ Pregunta 1 — ¿Obliga alguna norma a entregar ALGO al cobrar cuando todavía no hay factura?

**Respuesta: sí, y ese algo es una FACTURA. No hay ninguna figura intermedia que la norma pida en su
lugar.** 🟢 Sostenido para el IVA y la facturación. 🟡 El derecho civil y de consumo, en parte → ASESOR.

1. **La factura del anticipo es obligatoria.** **Art. 2.1, párrafo segundo, del ROF** (vigente desde
   2021-07-01): «También deberá expedirse factura y copia de esta **por los pagos recibidos con
   anterioridad** a la realización de las entregas de bienes o prestaciones de servicios por las que
   deba asimismo cumplirse esta obligación». La ley dice lo mismo en el **art. 164.Uno.3.º LIVA**
   (vigente desde 2024-01-01): «Expedir **y entregar** factura de todas sus operaciones». Y **entregar**
   no es un adorno: el **art. 17 ROF** (vigente desde 2013-01-01) dice que los originales «deberán ser
   remitidos […] a los destinatarios».
2. **La norma fiscal no pide nada además de la factura ni en su lugar.** El **art. 1 ROF** habla de
   «factura u otros justificantes», pero los únicos «justificantes» que regula no son el nuestro:
   el justificante contable de los no establecidos (2.4) y el recibo agrario (16.1). Está medido en
   SCRUM-1232b §Ⓑ. Las excepciones del **art. 3 ROF** no incluyen «cobró sin tener la facturación
   activada».
3. **Por eso el justificante no llenaba el hueco.** Documentaba el cobro de una operación que pedía
   factura, sin serlo. La obligación del 2.1 seguía **sin cumplir** con él y sin él. Quitarlo no la
   incumple más.
4. **En el derecho civil no he encontrado ningún deber general de dar recibo.** He leído los usos
   vigentes de «recibo» y «carta de pago» en el Código Civil y el Código de Comercio. Los artículos
   **regulan qué efectos tiene un recibo** cuando existe. Por ejemplo, el **art. 1110 CC** (vigente
   desde 1889-08-16): «El recibo del capital por el acreedor, sin reserva alguna respecto a los
   intereses, extingue la obligación del deudor en cuanto a éstos». O dicen cuándo se debe «carta de
   pago» en casos concretos, como legados y prenda (arts. 870 y 1872). **Ninguno obliga a un
   profesional a entregar recibo por un cobro corriente.** Que no lo haya en el texto no quiere decir
   que la jurisprudencia o la doctrina no reconozcan al que paga un derecho a pedirlo. **Eso → ASESOR.**
5. **Consumo: lo que se exige es confirmar el CONTRATO, no el pago.** **Art. 63.1 TRLGDCU** (vigente
   desde 2014-03-29): «En los contratos con consumidores y usuarios se entregará **recibo justificante,
   copia o documento acreditativo con las condiciones esenciales de la operación**, incluidas las
   condiciones generales de la contratación, aceptadas y firmadas por el consumidor». Es la única
   aparición de «recibo justificante» en las siete fuentes, y se refiere a las **condiciones del
   contrato**, no al cobro. Nuestro justificante no traía las condiciones generales, así que tampoco
   cumplía esto. Si la **copia del presupuesto firmado** que YaQu ya entrega lo cumple, **→ ASESOR**.
   Y **no depende** de quitar o no el justificante.

**Conclusión 1.** Quitar el justificante **no abre ningún hueco normativo** que hoy esté cubierto. El
hueco que existe es la **factura del anticipo**. Hoy, en España, está fuera de YaQu **por diseño**
(regla 24: «El profesional cobra por fuera de YaQu hasta que exista la factura»), y la factura la
tiene que expedir el profesional con sus propios medios. Eso era igual con justificante que sin él.

## Ⓓ Pregunta 2 — ¿Cuándo hay que emitir la factura de un anticipo?

**Respuesta: el ROF no le da al anticipo un plazo propio. Se aplica el general, y lo que decide es el
devengo, que en un anticipo es el COBRO.** 🟢 Sostenido para el cliente empresario. 🟡 Para el
consumidor, mi lectura es razonable pero no literal → ASESOR.

- **Devengo.** **Art. 75.Dos LIVA** (vigente desde 2021-07-01): en las operaciones con pagos
  anticipados «el impuesto se devengará **en el momento del cobro** total o parcial del precio por los
  importes efectivamente percibidos».
- **Plazo general.** **Art. 11.1 ROF** (vigente desde 2014-01-01): «Las facturas deberán ser expedidas
  **en el momento de realizarse la operación**». Si el cliente es **empresario o profesional**: «antes
  del día 16 del mes siguiente a aquél en que se haya producido **el devengo** del Impuesto». Para una
  señal eso es **antes del 16 del mes siguiente al cobro**. 🟢
- **Si el cliente es un consumidor**, el texto dice «en el momento de realizarse la operación», y no
  aclara qué es «la operación» cuando lo que hay es un anticipo. Yo leo que el momento es el cobro,
  por el 2.1 y el 75.Dos. **Pero no tengo una frase que lo diga así → ASESOR.**
- **Entrega.** **Art. 18 ROF** (vigente desde 2018-01-01): la factura se remite «en el mismo momento de
  su expedición», o antes del día 16 si el cliente es empresario.
- **La norma cuenta con que la fecha del cobro y la de la factura sean distintas.** El **art. 6.1.i)
  ROF** (vigente desde 2023-12-07) pide hacer constar «la fecha […] en la que, en su caso, **se haya
  recibido el pago anticipado**, siempre que se trate de una fecha distinta a la de expedición de la
  factura». Para la simplificada, lo mismo dice el **art. 7.1.c)**.
- **Cobrar hoy y facturar después.** **Dentro del plazo** de arriba, es lo previsto. **Fuera de
  plazo**, es un incumplimiento de facturación. El **art. 201.1 LGT** (vigente desde 2004-07-01)
  tipifica como infracción «el incumplimiento de las obligaciones de facturación, entre otras, la de
  expedición, remisión […] de facturas». Cómo se gradúa y qué pasa si se expide tarde pero se expide,
  **→ ASESOR**. No lo interpreto.
- **La factura final después de una señal** (qué base, cómo se descuenta lo anticipado): **SIN
  DETERMINAR**. No lo he leído en la norma, y no toca a esta decisión.

## Ⓔ Pregunta 3 — ¿Hay en la norma una figura que sea lo que de verdad necesitamos?

**Respuesta: la única figura que sirve es la factura. La simplificada es una FORMA de factura, no un
sustituto del justificante.** 🟢 Sostenido.

| figura | dónde | ¿nos sirve en lugar del justificante? |
|---|---|---|
| «justificante de cobro» | — | **0 apariciones** en las siete fuentes. Es un invento nuestro. |
| justificante contable | ROF 2.4 | No. Es para empresarios **no establecidos en la Comunidad**. |
| recibo agrario | ROF 16.1 | No. Lo expide quien **compra** a un agricultor en régimen especial. |
| documento sustitutivo | — | **Ya no existe.** El ROF de 2012 lo suprimió y desde 2017 el RIVA 63 ya no lo nombra (SCRUM-1232b §Ⓒ). Sólo lo sigue nombrando la LGT (29.2.e y 201), en redacciones de 2004 y 2021. |
| «recibo justificante» | TRLGDCU 63.1 | Es otra cosa: confirma las **condiciones del contrato** con un consumidor, no el cobro (Ⓒ.5). |
| **factura simplificada** | ROF 4 y 7 | **Es una factura.** Mismo gate que la completa (regla 24 y SIF-1). Ver abajo. |

**La factura simplificada, en detalle.** El **art. 4.1 ROF** (vigente desde 2021-07-01) la admite
«cuando su importe no exceda de 400 euros, Impuesto sobre el Valor Añadido incluido». El **4.2** la
admite hasta **3.000 €** en una lista cerrada de operaciones, y una de ellas es la **c) «Ventas o
servicios a domicilio del consumidor»**. **Eso encaja por importe y por tipo con muchos trabajos de
oficios en casa de un particular.** Pero:

1. **Es una factura:** lleva número y serie **separada** de las completas (7.1.a), entra en el libro
   y en el registro de VeriFactu como `F2`. **No resuelve nada antes de SIF-1**: está detrás de la
   misma puerta.
2. **Si el cliente es empresario** y lo exige, hay que añadirle su NIF y domicilio y la cuota por
   separado (7.2). Y el **art. 2.2.a) ROF** obliga «en todo caso» a expedir factura cuando el
   cliente es empresario.
3. **Hoy no es un tipo del producto** (Ⓐ.5). Ya está abierta como salida posible del **dictamen P11**.

**Conclusión 3.** No hay en la norma una figura que haga lo que hacía el justificante, porque lo que
hacía el justificante (documentar un cobro con IVA sin ser factura) **la ley no lo contempla** (LIVA
88.Dos, SCRUM-1232b §Ⓑ). Si algún día se quiere un documento más ligero, la vía legal es la
**simplificada**, y eso es una **decisión de producto** para cuando la factura esté encendida, con su
pregunta al asesor (Ⓖ.3).

## Ⓕ Pregunta 4 — ¿Pierde algo el cliente final si paga y no recibe documento?

**Respuesta: frente a lo que tiene HOY, no pierde nada, porque hoy en España ya no recibe nada desde el
21-sep-2026 (Ⓐ). Frente a una factura, sí pierde, y el justificante no le daba nada de eso.**

- **Si el cliente es empresario, no puede deducir.** **Art. 97.Uno LIVA** (vigente desde
  2011-01-01): «**únicamente** se considerarán documentos justificativos del derecho a la deducción: 1.º
  La factura original […]». Un justificante **nunca** le dejó deducir. 🟢
- **Derecho a la factura.** **Art. 63.3 TRLGDCU**: el consumidor tiene derecho «a recibir la factura en
  papel», y la electrónica requiere «el consentimiento expreso del consumidor». Es un derecho **a la
  factura**, no a un justificante. 🟢 *(Cómo se casa con un envío por WhatsApp es otro asunto, y **→
  ASESOR** cuando se encienda la factura.)*
- **Prueba del pago.** Sin documento, el cliente tiene la **prueba del medio de pago** (el cargo en su
  banco o en el PSP). Qué valor le da un juez frente a un recibo es **SIN DETERMINAR**: no es norma que
  pueda citar.
- **Garantía y conformidad del servicio:** **SIN DETERMINAR.** No he leído los artículos de conformidad
  del TRLGDCU con este fin. No afirmo ni que dependan de la factura ni que no.
- **Deducciones del IRPF por obras en la vivienda** (estatales o autonómicas), que suelen exigir
  factura: **SIN DETERMINAR**. No lo he leído y no lo afirmo.

## Ⓖ Preguntas para la consulta de Javier (texto de trabajo, no firmado)

Van junto a P15, P16.1 y P11 de `PREGUNTAS_ASESOR.md`, y junto a la §Ⓗ de SCRUM-1232. **No las he
añadido allí:** ese fichero lo decide su dueño.

> 1. Un profesional en régimen general cobra una **señal a un particular** por una obra en su casa.
>    ¿La factura del anticipo (art. 2.1 ROF, párrafo segundo) tiene que expedirse **en el mismo momento
>    del cobro** (art. 11.1), o hay algún margen? Si el cliente es empresario, ¿basta con expedirla
>    antes del día 16 del mes siguiente al cobro?
> 2. Mientras no podamos emitir facturas en España, nuestro producto **no cobra y no entrega ningún
>    documento**, y el profesional cobra y factura por su cuenta. ¿Hay alguna obligación, civil, de
>    consumo o fiscal, de entregar al cliente **algo** en el momento del cobro que no sea la factura?
>    ¿El deudor tiene un derecho exigible a recibo, y quién lo tiene que dar?
> 3. Para trabajos en el domicilio de un particular de hasta 3.000 € (art. 4.2.c ROF), ¿nos recomienda
>    emitir **factura simplificada** en lugar de completa? ¿Qué pasa si el cliente resulta ser
>    autónomo y no lo sabíamos al emitirla?
> 4. ¿La copia del **presupuesto firmado** por el cliente, con precio y condiciones, cumple la
>    confirmación documental del art. 63.1 TRLGDCU?

## Ⓗ Lo que me salió mal

1. **El número del ticket.** El encargo me daba la rama `scrum-1253-…`, y al abrir Jira el 1253 **no
   existía** (404; el último era el 1252). Lo avisé y no empujé nada hasta que el orquestador lo creó.
   Luego lo volví a leer en Jira: es este ticket. La referencia se lee, no se reserva.
2. **La primera pasada de la sonda murió.** Le pasé un `URL` al `require` de `createRequire`, que sólo
   acepta cadenas. Salió con código 1 **sin producir la tabla**, así que era un instrumento **CIEGO**,
   no un resultado. Lo arreglé con `fileURLToPath`, la volví a correr y salió con código 0 y la tabla.

---

## Apéndice · re-medición del 1-oct-2026: la LIVA ha cambiado y el veredicto se sostiene

**Medido contra:** `origin/main` = `e9e71cab67574538943cd94392bdecf5f3dcbfa2` · 2026-10-01T00:37:11Z

A9: aviso → A10 «Un dato copiado de un registro lleva la fecha en que se midió, no la de hoy.» — no se pudo comprobar: que la fuente siga igual sólo se sabe volviendo a bajarla del BOE, y la tanda de CI no sale a la red; un guard que comparase el sha256 guardado con el guardado no mediría nada.

Sesión J5, con GO del orquestador de Javier (`cobroflash-backend-5b`). **Sólo se añade este apéndice.**
No se toca nada de lo de arriba, ni `src/`, ni el máster, ni ningún texto de pantalla. No es una
afirmación fiscal de producto (regla 7).

**Por qué existe.** El 1-oct este ticket se volvió a repartir porque en Jira seguía «por hacer». Estaba
hecho, en `main` y decidido por el fundador desde el 28-sep (comentario 17441). En vez de rehacerlo,
repetí el control de las fuentes. **Una de las siete había cambiado dos días después de medirla**, y el
expediente no tenía forma de decirlo: un veredicto legal con su sha256 se queda viejo en silencio.

### Ⓘ Las siete fuentes, bajadas otra vez

Misma API (`legislacion-consolidada/id/<ID>/texto`), `curl`, 2026-10-01 a las 00:30Z. Las siete
respondieron 200.

| # | norma | sha256 el 1-oct-2026 | ¿igual que en §Ⓑ? |
|---|---|---|---|
| C2 | LIVA | `e2386e75b39d9843e15786f72ec32c94cc781b25b4b7c1aa6623392aa7cb26b7` | 🔴 **NO** (era `371432fc…`) |
| C3 | RIVA | `a558146bdd95724641edde646cd638840fedcfd2ffb8fa50ecbe85407f024a23` | sí |
| C4 | ROF | `95d8ff283a96a2a74263fd0bc079cbd00a5c5a418ba66ec046ca2aef4d56f586` | sí |
| C11 | LGT | `abc3a2730bef3ee18569dacd58c71bf4e51424b2058087c032d805061c72f4c9` | sí |
| C12 | TRLGDCU | `d87125d5d52fe84c71af7b32496296b3dedf20d8e002cca84294d09a17230265` | sí |
| C13 | Código Civil | `11bfe708d8cc5839d4c5bce97092c386a9ced055ea839463f754131ffc787750` | sí |
| C14 | Código de Comercio | `465ece190e3a3c9c9976627de85487c2b4a7681bb6d5ea6f7045aa736ea08c7e` | sí |

Población: 7 fuentes. Iguales **6**, distinta **1**.

### Ⓙ Qué movió la LIVA

El **Real Decreto-ley 26/2026, de 29 de septiembre** (`BOE-A-2026-20266`), publicado el 30-sep-2026 y
con efectos el **1 de diciembre de 2026**. En el XML de hoy aparecen **2** bloques con una `<version>`
de esa norma, y son:

- **art. 20**, apartado Uno.23.º, letra e') (arrendamientos de viviendas amuebladas);
- **art. 91**, apartados Uno.2.2.º, Uno.2.10.º y Dos.1.6.º (tipos reducidos).

La nota al pie del propio BOE lo dice así: «Se modifican, con efectos de 1 de diciembre de 2026, los
apartados Uno.2.2º, Uno.2.10º y Dos.1.6º por el art. 7.2 a 4 del Real Decreto-ley 26/2026».

### Ⓚ Por qué el veredicto no cambia

Este expediente cita cuatro artículos de la LIVA: **75, 88, 97 y 164**. Ninguno es el 20 ni el 91.

1. **Por la lista de versiones.** La última `<version>` de cada uno sigue siendo la que se citó: art. 75
   vigente desde 2021-07-01, art. 88 desde 2013-01-01, art. 97 desde 2011-01-01 y art. 164 desde
   2024-01-01. Ninguno tiene versión de 2026.
2. **Por el texto.** Volví a sacar de los XML de hoy, con el mismo extractor de SCRUM-1232b, los **17**
   bloques que guarda `evidencias/SCRUM-1253/extractos.txt` (9 del ROF, 4 de la LIVA, 2 de la LGT, 1 del
   TRLGDCU y 1 del Código Civil) y los comparé con `diff` contra lo guardado: **0 líneas distintas**.
   **Control positivo:** con una sola línea quitada de la extracción de hoy, el mismo `diff` sale con
   código 1. El instrumento ve una diferencia cuando la hay.

**Las citas literales de este expediente siguen siendo texto vigente a 1-oct-2026**, y el veredicto,
«se puede quitar, con condiciones», se sostiene.

**Y de paso queda mejor probado que la API da el consolidado:** devuelve una modificación publicada el
día anterior. El control del 28-sep (art. 7.5 del ROF, de 2023) era bueno; éste es más reciente.

### Ⓛ Los límites de esta re-medición, tal cual

1. **«Sólo cambiaron esos dos bloques» lo digo por la lista de versiones, no por un diff byte a byte.**
   No conservé el XML de la LIVA del 28-sep, sólo su sha256. Lo que sí está comparado byte a byte son
   los 17 bloques citados, contra los extractos guardados.
2. **El extractor del repo corta por vigencia en una fecha fija** (el 28-sep-2026). Para esta comparación
   es justo lo que hace falta, porque la versión nueva del art. 91 no rige hasta diciembre. Quien lo
   reuse después del 1-dic-2026 tiene que mover esa fecha, o seguirá leyendo la redacción anterior.
3. **Los XML de hoy no están en el repo.** Pesan 14 MB. Están en la máquina de Javier, en la carpeta
   `yaqu-censos`, subcarpeta `scrum1253`, con sus sha256 al lado. Otro equipo no los ve: para
   comprobarlo, se vuelven a bajar y se compara el sha256 de la tabla.
4. **Todo lo que no es cita literal en este expediente es una inferencia de una IA** (la sesión J5), y
   ningún asesor ha contestado todavía. Las tres que más pesan, para que nadie las tome por frase de la
   norma: (a) «quitar el justificante no abre ningún hueco» se deduce de ROF 2.1 y LIVA 88.Dos, no lo
   dice un artículo; (b) «para un consumidor, el momento es el cobro» es una lectura, ya marcada
   → ASESOR en §Ⓓ; (c) «no hay deber civil general de dar recibo» es que **no lo encontré en el
   texto**, no que no exista en la jurisprudencia, ya marcado → ASESOR en §Ⓒ.4.

### Ⓜ Lo que salió de aquí y NO es de este ticket

El cambio del **art. 91.Uno.2.10.º LIVA** (el 10 % de las obras de renovación y reparación en
viviendas) no toca al justificante, pero sí al producto, y por eso se entregó aparte al orquestador el
mismo 1-oct. El texto que regirá desde el 1-dic-2026 añade, literal:

> «La aplicación del tipo reducido queda condicionada a que el importe de la contraprestación de las
> ejecuciones de obras haya sido satisfecho mediante tarjeta de crédito o débito, transferencia
> bancaria, cheque nominativo o ingreso en cuentas en entidades de crédito a favor de los sujetos
> pasivos que las realicen.»

y extiende el tipo a las obras en «viviendas destinadas a su arrendamiento como vivienda habitual,
cualquiera que sea la condición del arrendador».

**Lo que no sé y no afirmo:** si el Real Decreto-ley se convalida (puede decaer); qué más trae, porque
no lo he leído entero, sólo lo que la LIVA consolidada refleja de su art. 7; si un pago por Bizum
cuenta como «transferencia bancaria», que el texto no lo dice (→ ASESOR); y si `src/` aplica hoy el
10 % en algún sitio. Aquí sólo queda constancia de dónde salió. El trabajo va en su propio ticket, que
abre el orquestador.

### Ⓝ Lo que me salió mal en esta vuelta

**Mi primer extractor de bloques salió ciego.** Era un script de usar y tirar, y su expresión regular
esperaba `fecha_publicacion` justo detrás de `id_norma`. Las versiones nuevas traen un atributo
`fpub=""` en medio, así que devolvió **0 bloques modificados**. No lo di por bueno porque otro
recuento, por norma, decía **2**. Lo releí por número de línea. El extractor del repo no tiene ese
defecto: busca `fecha_vigencia` en cualquier posición.

## Nota del 7-oct-2026 · el Real Decreto-ley 26/2026 que cita este apéndice fue derogado

**Medido contra:** `origin/main` = `e883e586d11298ca09d58cd3fa89937b7b0549bd` · 2026-10-07T15:52:45Z

A9: aviso → A10 «Un dato copiado de un registro lleva la fecha en que se midió, no la de hoy.» — no se pudo comprobar: que una norma siga viva sólo se sabe volviendo a preguntárselo al BOE, y la tanda de CI no sale a la red.

Sesión J5 (IA), por SCRUM-1316. **No se toca nada de lo de arriba:** era cierto el 1-oct-2026, y forma
parte de por qué se miró esto. Lo que ha cambiado desde entonces, medido el 7-oct-2026 contra el BOE:

1. **El Real Decreto-ley 26/2026 (`BOE-A-2026-20266`) está derogado.** El Congreso acordó derogarlo el
   2-oct-2026 (`BOE-A-2026-20526`), y con ello quedó sin efecto su modificación de los arts. 20 y 91 LIVA
   que cuentan §Ⓙ y §Ⓜ.
2. **El Real Decreto-ley 29/2026, de 6 de octubre (`BOE-A-2026-20823`), publicado el 7-oct-2026, repite
   esa modificación**, con los mismos efectos de 1 de diciembre de 2026 y, en el art. 91.Uno.2.10.º, con
   el mismo texto que se cita en §Ⓜ. **No está convalidado.**
3. **El veredicto de este expediente no se mueve.** Los artículos que cita (75, 88, 97 y 164 LIVA)
   siguen sin versión de 2026: en la LIVA de hoy, los únicos bloques con versiones publicadas desde
   septiembre son el art. 20 y el art. 91, igual que el 1-oct.
4. **La LIVA consolidada ha vuelto a cambiar de sha256** (hoy `5fb06ddd…`; el 1-oct era `e2386e75…`): el
   BOE le ha añadido dos versiones a cada uno de esos dos artículos.
5. 🔴 **El aviso de §Ⓛ.2 se queda corto.** Decía que el extractor habría que moverlo después del 1-dic.
   La versión del 29/2026 trae `fecha_vigencia` del **8-oct-2026**: quien mueva la fecha fija a hoy
   leerá desde mañana la redacción nueva como si ya se aplicara.

Las fuentes, los literales y la medición del extractor: `docs/master/SCRUM-1316.md`, sección
«SCRUM-1316b».
