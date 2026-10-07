# Preguntas para el asesor — el bloque de envío (28-sep-2026)

> **Para Javier, antes de copiar.** Este fichero tiene tres partes y **sólo la PARTE 2 se envía**.
> La 1 es para ti: qué hay dentro, de dónde sale cada pregunta y qué clase de respuesta tiene ya. La 3
> son las que he dejado **fuera**, cada una con su motivo. Montado por J5 (`jv-j5`), que es una sesión
> de IA: esto es **una lista de preguntas, no una respuesta**, y no le sugiere al asesor qué contestar.
> Expediente del método en `docs/master/` (ticket de esta entrega).

---

# PARTE 1 · Para Javier (no se envía)

## Qué hay aquí

**28 preguntas** en la parte 2, en siete bloques y ordenadas por lo que **bloquean**. Primero van
las que impiden emitir la primera factura real y al final las de protección de datos. Salen de
`docs/legal/PREGUNTAS_ASESOR.md`, de su versión «por especialista» (SCRUM-1023), de las D5 de
SCRUM-825 (comentario 17446), de SCRUM-1232 §Ⓗ y 1253 §Ⓖ, y de **13 fuentes más** que un censo de solo
lectura encontró en `docs/master/` y `docs/legal/`. Se han fusionado las repetidas: la misma
cuestión aparecía hasta en cuatro sitios con redacciones distintas (la factura sin NIF, por ejemplo).

## 🔴 Las respuestas que ya tenemos, y de qué clase son

Cada pregunta de la parte 2 lleva una línea **«Lo que ya tenemos»** con una de estas marcas. Van
**sin el contenido** de la respuesta, para no sugerírsela al asesor. Esa línea se puede quitar al
enviar; aquí sirve para que tú veas el estado.

| Marca | Qué significa | Cuántas |
|---|---|---|
| **SIN RESPUESTA** | Nadie la ha contestado | 14 |
| **IA · 22-sep** | Respuesta preparada por **una sesión de IA** contra la FAQ de la AEAT y el BOE (`PREGUNTAS_ASESOR.md`, sección «RESPUESTAS · 22-sep», que lo dice en su primera línea). **Ningún asesor humano la ha revisado.** El cotejo del 23-sep (SCRUM-1088) comprobó que las citas existen, no que la aplicación a nuestro caso sea correcta | 11 |
| **IA · 23-sep** | Respuestas rotuladas «el asesor fiscal», de SCRUM-1104 y 1106, volcadas en `docs/legal/PREGUNTAS_ASESOR.md:848` (`Q-C1.`) y `:978` (`Q-C8.`). **Las escribió una herramienta, no una persona** (decisión 1, 30-sep). **Ningún profesional las ha revisado.** La propia respuesta marca con ⚠ lo que cita «de memoria». | 2 |
| **AEAT** | Respuesta oficial de la Agencia (correo de julio en SCRUM-143) | 1 |

**Ninguna de las 28 tiene hoy la revisión de un profesional.** 13 tienen respuesta de IA (11 del
22-sep y 2 del 23-sep), 14 no tienen ninguna, y la A3 tiene la de la AEAT, que es la Agencia y no un
asesor nuestro.

**Por qué importa, con un caso.** El mapa de SCRUM-1023 marca 17 preguntas como «NO necesita
asesor», y **la mayoría se apoya en respuestas de la clase IA · 22-sep** (el resto, en la FAQ de la AEAT o en
las respuestas del 23-sep, que también son de IA). La P11 (factura a un
particular sin NIF) es el ejemplo. Está «respondida» en la sección B3 por una sesión de IA, el código
la sigue marcando `SIN_DICTAMEN`, y ahora mismo **nada de D5 se construye hasta que conteste un
asesor** (17446). Una respuesta de IA con cita tiene aspecto de fuente, y no lo es.

## Qué citas he comprobado hoy, y cuáles no

**Comprobadas hoy, en el texto CONSOLIDADO del BOE y con la versión vigente:** Ley 37/1992 (LIVA),
RD 1624/1992 (RIVA), RD 1619/2012 (ROF), Ley 58/2003 (LGT), Código Civil, Código de Comercio y RDLeg
1/2007 (consumidores). He comprobado que cada artículo existe y trata lo que se dice. Los sha256 están
en el expediente de esta entrega. **No las he vuelto a comprobar hoy**, y se citan tal como aparecen
en nuestros expedientes: RD 1007/2023, Orden HAC/1177/2024, RD-ley 15/2025, RGPD, LOPDGDD, Reglamento
eIDAS, los decretos de la Comunidad de Madrid, la Orden HAC/773/2019 y las FAQ de la AEAT.

## Las cuatro decisiones, tomadas (Javier, 30-sep-2026; literales en SCRUM-1261, comentario 17638)

1. **Las respuestas del 23-sep (Q-C1 a Q-C8, modelos y contabilidad) las escribió una herramienta**,
   no una persona. Su marca pasa a **IA · 23-sep** (B6 y E4), y la **E4** deja de ser condicional: se
   envía entera.
2. **Se envían las 28**, también las que tienen respuesta de IA. Las revisarás a mano y las llevarás
   a un profesional real.
3. **A3 (Convenio 017) se queda dentro.** La AEAT ya lo contestó por correo en julio, y hay
   conversaciones abiertas con ella.
4. **Las cuatro de SCRUM-1232 §Ⓗ (justificantes antiguos en el libro y el 303) quedan fuera
   definitivamente.** Los 44 justificantes del censo de producción del 10-ago eran todos de prueba,
   de ningún profesional real.

## De dónde sale cada pregunta

| Parte 2 | Origen (para buscarla en el repositorio) | Lo que ya tenemos | Bloquea |
|---|---|---|---|
| A1 | F1 · P14 | IA · 22-sep | el riesgo del productor (art. 201 bis LGT) |
| A2 | F2 · RESPUESTAS·A · AUDITORIA_CAMINO_EMISION:189 | IA · 22-sep | conectar el envío a la AEAT |
| A3 | F3 · SCRUM-143 | AEAT (correo de julio) + se repite (decisión 3) | A2 y constituir la SL |
| A4 | F10 · F17 · P19 · DECLARACION_RESPONSABLE:59 y :72 | IA · 22-sep (B2), parcial | la declaración responsable |
| B1 | F6 · P11 · D5.1 · D5.2 y D5.3 (confirmaciones) · D5.5 · 1253 Ⓖ.3 · F9/P16.4 · semaforoFiscal.js:37 | IA · 22-sep (B3) | todo D5; el aviso «cliente sin NIF» |
| B2 | F9 · P16.2 · P16.3 · anticipos P9 | SIN RESPUESTA | SCRUM-413 |
| B3 | F4 · QC1 · QC2 · QC9 | IA · 22-sep (tabla F) | SCRUM-212 |
| B4 | F7 · QC3 | IA · 22-sep (P12) | SCRUM-293 |
| B5 | F5 · QC4 · SCRUM-1129 (:99, :268, :351) | IA · 22-sep (P13), parcial | SCRUM-294 |
| B6 | F5.4 · QC6 · SCRUM-1055 · SCRUM-1240 (:212, :238) | IA · 23-sep (SCRUM-1104 §6); SCRUM-1055 dice que sigue sin respuesta | el criterio de caja |
| C1 | 1253 Ⓖ.1 · anticipos P1 y P6 | SIN RESPUESTA | cobrar la señal con la factura encendida |
| C2 | EXPEDIENTE_FISCAL_ANTICIPOS_RECAPITULATIVA P2-P8 y P10 | SIN RESPUESTA (P10: DECIDIDO POR TI el 27-jul) | la facturación de anticipos y la recapitulativa |
| D1 | F18 · P20 · SCRUM-665 (:161, :364) | SIN RESPUESTA | el diseño de SCRUM-665 |
| D2 | F16 · P18 · SCRUM-665 (:1606) | SIN RESPUESTA | la rectificativa |
| D3 | SCRUM-523:326 | SIN RESPUESTA | el formato de exportación |
| E1 | F8 · P15.2 · P15.3 | SIN RESPUESTA (P15.1: IA · 22-sep) | SCRUM-325/426 |
| E2 | F14 · bloque 21 | SIN RESPUESTA | 5 avisos del libro |
| E3 | F13 · SCRUM-324 | SIN RESPUESTA | el aviso del ticket no deducible |
| E4 | Q-C1 a Q-C8 | IA · 23-sep | CONTABILIDAD §4; **se envía entera** (decisión 1) |
| E5 | QC7 | SIN RESPUESTA | los tipos del selector |
| F1 | M1 · C6 · DECLARACION_RESPONSABLE:72 | IA · 22-sep (C6) | los Términos |
| F2 | M2 · C7 | SIN RESPUESTA | los Términos |
| F3 | M3 · SCRUM-612:558 | SIN RESPUESTA | cobrar a los Founding con alcance escrito |
| F4 | M4 · M5 · SCRUM-1088:64 | IA · 22-sep (G, sólo Madrid); eIDAS sin respuesta | SCRUM-290 y el Anexo I |
| F5 | 1253 Ⓖ.4 · Ⓖ.2 | SIN RESPUESTA | — (dato de producto) |
| G1 | P1 · E | IA · 22-sep | SCRUM-244 |
| G2 | P2 · P17 | IA · 22-sep | la supresión del cliente final |
| G3 | P3 · RGPD_TRATAMIENTO_DATOS:306-328 · SCRUM-1196:442 · SCRUM-1018:107 | SIN RESPUESTA | validar la privacidad publicada |

Recuento, contado por script sobre la parte 2: 14 SIN RESPUESTA · 11 IA · 22-sep · 2 IA · 23-sep · 1 AEAT = **28**. La C2 cuenta como SIN RESPUESTA aunque su punto (7) lo hayas decidido tú (27-jul). La B6 cuenta como IA · 23-sep, aunque dos documentos discrepan sobre si la contestó.

---

# PARTE 2 · Lo que se envía

## Contexto, para leer una vez

YaQu es una aplicación para profesionales de oficios en España (fontanería, electricidad, reformas,
mantenimiento): hacen el presupuesto, el cliente lo firma en el móvil y, más adelante, se factura y
se cobra desde la aplicación. **Cómo está hoy (28-sep-2026), dicho con exactitud:**

- **No tenemos ningún profesional real usando la aplicación**, ni en España ni fuera.
- **En España, la aplicación no emite hoy ningún documento de cobro ni cobra.** Emitir facturas está
  apagado, a propósito, hasta que el sistema cumpla VeriFactu. Hasta el 21-sep-2026 entregaba al
  cobrar un «justificante de cobro» que no era factura. **Ya no se emite y se va a retirar.**
- El programa **ya genera** el registro de facturación con el formato de la AEAT (huella encadenada y
  QR). **El cliente que envía a la AEAT está escrito, pero no está conectado a la emisión.** No hemos
  remitido ningún registro de un profesional.
- **El plan:** activar la emisión de facturas cuando el sistema esté completo, con un solo documento
  en el catálogo, **la factura**.
- Fuera de España el programa no tiene ese interruptor: si hubiera usuarios, emitiría facturas. Hoy no
  hay ninguno.

Cada pregunta lleva **por qué la hacemos**, **las normas que ya hemos localizado** (con artículo) y **qué
haremos según la respuesta**. Lo que citamos es texto de la norma, **no una conclusión**: la
conclusión es lo que le preguntamos.

La última línea de cada pregunta dice **qué respuesta tenemos ya**, sin dar su contenido:
**SIN RESPUESTA**; **IA · 22-sep**, que es una respuesta preparada con una herramienta de
inteligencia artificial y que **no ha revisado ningún profesional**; **IA · 23-sep**, otras
respuestas preparadas también con una herramienta de inteligencia artificial, que tampoco ha revisado
ningún profesional; o **AEAT**, cuando contestó la propia Agencia. **Ninguna de estas preguntas tiene
hoy la respuesta de un profesional.** Lo que tenga respuesta de IA le pedimos que lo conteste igual,
como si no la hubiera.

---

## A · Antes de emitir la primera factura real

### A1 · ¿Somos ya «productor» de un sistema informático de facturación?

**La pregunta.** Con la situación descrita arriba (el programa genera el registro con formato AEAT,
no lo envía, y no emite ningún documento en España), **¿somos hoy productores o comercializadores de
un sistema informático de facturación** a efectos del art. 201 bis LGT y del Reglamento de sistemas
de facturación (RD 1007/2023)? Y si depende: **¿de qué hecho depende**, y qué tendríamos que poder
**acreditar**?
**Por qué.** El plazo del productor venció el 29-jul-2025 y la sanción es por ejercicio. Es el
riesgo más grande que tenemos abierto.
**Normas que ya hemos localizado.** Art. 201 bis LGT; RD 1007/2023, arts. 1 y 3; RD-ley 15/2025; FAQ de la AEAT
«Cuestiones generales: objeto» y «Ámbitos de aplicación».
**Qué haremos.** Si lo somos o podemos serlo, adaptar lo que diga antes de nada más. Si no lo somos
mientras no se emita, dejar escrito qué hecho nos convierte en productores y controlarlo.
**Lo que ya tenemos:** IA · 22-sep.

### A2 · ¿Cómo remitimos los registros de los profesionales a la AEAT?

**La pregunta.** Cada profesional es el obligado. Para remitir sus registros, ¿es viable que lo
hagamos como **colaborador social** con un certificado nuestro (Convenio 017), y **cómo se tramita
paso a paso**, incluida la firma del documento de representación por el profesional? ¿Qué cambia si
en su lugar usamos el **apoderamiento** o el **certificado de cada profesional**? ¿Pueden convivir
dos de estas vías en la misma aplicación?
**Por qué.** El envío se programa contra una forma de identificarse concreta. La preferencia de la
empresa es la del colaborador social (16-sep-2026), y lo que pedimos es confirmar que es viable y
cómo se hace.
**Normas que ya hemos localizado.** FAQ de la AEAT «Cumplimiento y delegación» y «Colaboración social»; art. 6 del RD
1007/2023; art. 5 del RD 1619/2012 (ROF).
**Qué haremos.** Construir la conexión y los trámites de alta de cada profesional sobre la vía que
confirme.
**Lo que ya tenemos:** IA · 22-sep.

### A3 · ¿El Convenio 017 exige que la empresa sea una sociedad mercantil?

**La pregunta.** Para ser colaborador social (A2), ¿hace falta ser sociedad mercantil, o vale un
empresario individual?
**Por qué.** Condiciona si hay que constituir la sociedad antes de poder cerrar A2. La AEAT contestó
por correo en julio. La volvemos a preguntar a propósito, para no dar esa respuesta por buena sin su
opinión.
**Qué haremos.** Si hace falta sociedad, constituirla antes de conectar el envío.
**Lo que ya tenemos:** AEAT (correo de julio de 2026).

### A4 · ¿A nombre de quién va la declaración responsable del sistema?

**La pregunta.** La declaración responsable (art. 13 RD 1007/2023 y art. 15 de la Orden HAC/1177/2024)
pide el nombre y el NIF del productor. Somos **dos fundadores y todavía no hay sociedad.**
(1) ¿Puede declararse a nombre de **dos personas físicas**, o de una **comunidad de bienes**? (2) Si
firma **una sola persona física** para poder hacer pruebas, ¿qué responsabilidad asume ella, y cuál
tiene el otro socio? (3) Al constituir la sociedad, ¿hay que **emitir una declaración nueva**
conservando la anterior? (4) En un servicio en la nube, **¿qué se pone como «descripción de la
instalación»?** (5) La **cláusula de conformidad**: ¿qué redacción, y qué limitaciones de
responsabilidad, son coherentes con los Términos del servicio (ver F1)?
**Por qué.** Sin esto no se puede rellenar la declaración, y hace falta antes de la primera factura
real.
**Normas que ya hemos localizado.** Art. 13 RD 1007/2023; art. 15 Orden HAC/1177/2024.
**Qué haremos.** Rellenar la declaración con lo que indique, y fijar cuándo hay que emitir una nueva.
**Lo que ya tenemos:** IA · 22-sep, sólo sobre (1) en parte. El resto, sin respuesta.

---

## B · Qué factura se emite, y cómo se declara

### B1 · Un cliente particular que no nos da su NIF: ¿qué factura corresponde?

**La pregunta.** Un fontanero hace una reparación **en casa de un particular** (40 €, o 1.200 €) y el
cliente no le da su NIF. (1) ¿Corresponde una **factura simplificada**, o una **factura completa sin
identificar al destinatario**? (2) ¿Cambia según el **importe** o según que el trabajo sea **en el
domicilio del cliente** o en el taller? (3) ¿Y si el cliente resulta ser un **autónomo o una
empresa** y no lo sabíamos al emitir? (4) Si corresponde la simplificada, ¿qué nos obliga a
**cambiar**, en la numeración y en la **rectificación** de una simplificada?
**Por qué.** De esto depende qué documento emitimos a la mayoría de nuestros clientes finales, y
**no vamos a construir nada de esta parte hasta que conteste**. La decisión de negocio ya está
tomada: el NIF se pide al dar de alta el cliente, y si falta se avisa antes de emitir y se puede
añadir en ese momento. **Lo que no sabemos es qué factura exige la norma cuando el cliente no lo da.**
**Normas que ya hemos localizado.** ROF, texto consolidado: art. 6.1.d) 3.º (NIF del destinatario en la factura
completa) · art. 6.1.e) (domicilio del destinatario) · art. 4.1 (simplificada hasta 400 €) · art.
4.2.c) («ventas o servicios a domicilio del consumidor», hasta 3.000 €) · art. 7.1 (contenido de la
simplificada; **series separadas** si se emiten los dos tipos en el mismo año) · arts. 7.2 y 7.3
(cuándo la simplificada lleva NIF y domicilio) · art. 2.2.a) (a un empresario, factura en todo caso).
FAQ de la AEAT «Procedimientos de facturación».
**Qué haremos.** Construir el tipo de factura que indique, con su serie y su rectificativa, y el
aviso que ve el profesional cuando falta el NIF.
**Dos confirmaciones, de una línea.** No son preguntas abiertas: basta un «correcto» o la corrección.
Detrás de las dos hay un cambio en nuestra base de datos y en el alta de clientes, y preferimos
confirmarlo antes de hacerlo.
- **D5.2 · NIF.** Entendemos que la factura **completa** lleva siempre el NIF del destinatario, porque
  la operación se realiza en España y el profesional está establecido aquí (ROF 6.1.d), párrafo
  segundo, 3.º). ¿Correcto?
- **D5.3 · Domicilio.** Entendemos que la factura completa lleva también el **domicilio** del
  destinatario (ROF 6.1.e): «Domicilio, tanto del obligado a expedir factura como del destinatario»).
  ¿Correcto?

**Lo que ya tenemos:** IA · 22-sep. **Ningún asesor la ha revisado, y por eso esperamos la suya.**

### B2 · ¿Con qué «tipo de factura» se declara cada documento en VeriFactu?

**La pregunta.** Hoy sólo emitimos **factura completa** y **rectificativa**. (1) Una **factura de
anticipo** (la señal cobrada antes de empezar), ¿se declara como factura completa normal? (2) La
**factura final**, que descuenta los anticipos ya facturados con líneas en negativo, ¿sigue siendo una
factura completa, o descontar documentos anteriores la convierte en otra cosa del catálogo? (3) Aparte
de B1, ¿necesita un profesional de oficios alguno de los **otros tipos del catálogo** (rectificativas
de otras clases, por ejemplo)?
**Por qué.** Hay un cambio en la forma de declarar que está escrito y parado hasta esta respuesta.
**Normas que ya hemos localizado.** Orden HAC/1177/2024 y esquemas oficiales de la AEAT (lista de tipos F1, F2, F3,
R1-R5); ROF, arts. 2.1 párrafo segundo y 6.1.i).
**Qué haremos.** Declarar cada documento con el tipo que indique, decidiéndolo al emitirlo.
**Lo que ya tenemos:** SIN RESPUESTA.

### B3 · Operaciones exentas, no sujetas y con inversión del sujeto pasivo, en este sector

**La pregunta.** Hoy el profesional sólo elige el tipo de IVA por línea (21, 10, 4 o 0 %). Un 0 %
puede ser una exención, una operación no sujeta o una inversión del sujeto pasivo. En fontanería,
electricidad, reformas y mantenimiento: (1) ¿qué casos de **inversión del sujeto pasivo** se dan, y
con qué dato se reconocen (tipo de cliente, tipo de obra, contrato)? (2) ¿Se da alguna **exención** o
alguna operación **no sujeta**? (3) ¿Qué condiciones del **10 % en vivienda** tiene que comprobar el
profesional? (4) Si alguna factura se emite con la calificación equivocada, ¿qué se hace, sabiendo
que no se puede editar y sólo se puede rectificar?
**Por qué.** Hoy una factura con un tramo al 0 % queda fuera del registro, entera. Lo notaremos el día que
se active la emisión.
**Normas que ya hemos localizado.** Ley 37/1992 (LIVA): arts. 7, 20, 84.Uno.2.º.f) y 91.Uno.2.10.º; ROF, art. 6.1.j) y
m) y art. 6.2. El texto de los arts. 84 y 91 se cotejó en una base de datos jurídica, no directamente
en el BOE. *(Nota del 7-oct-2026, SCRUM-1316: ese día se cotejaron los dos contra el BOE consolidado y coinciden. El 91.Uno.2.10.º tiene publicada una redacción nueva con efectos de 1-dic-2026 —Real Decreto-ley 29/2026, BOE-A-2026-20823, sin convalidar— que no es la que se cita aquí.)*
**Qué haremos.** Preguntar al profesional los datos que decidan la calificación, y declararla así.
**Lo que ya tenemos:** IA · 22-sep.

### B4 · Los suplidos

**La pregunta.** Una tasa o un permiso que el profesional paga en nombre del cliente: (1) ¿va en la
factura, y cómo se identifica? (2) ¿Entra en el **importe total** que se declara en el registro? (3)
¿Qué hay que conservar del justificante del gasto, que está a nombre del cliente?
**Normas que ya hemos localizado.** LIVA, art. 78.Tres.3.º (cotejado en una base de datos jurídica, no directamente
en el BOE); FAQ de la AEAT «Registros de facturación: alta».
**Qué haremos.** Construir el suplido como indique; hoy la aplicación no lo tiene.
**Lo que ya tenemos:** IA · 22-sep.

### B5 · El recargo de equivalencia

**La pregunta.** (1) Los tipos de recargo con los que calculamos (5,2 %, 1,4 % y 0,5 %), ¿son los
vigentes, y falta o sobra alguno? (2) Cuando se aplica, ¿el **importe total** que se declara en el
registro incluye el recargo? (3) Si un profesional **vende e instala** una caldera a un comerciante
en recargo, ¿cuenta eso como transformación del bien? (4) En el registro VeriFactu, ¿la clave del
régimen especial del recargo la pone **quien vende** o **quien compra**?
**Por qué.** El cálculo está hecho, pero no se aplica al total hasta tener esta respuesta.
**Normas que ya hemos localizado.** LIVA, arts. 148, 149 y 154-163 (régimen del recargo); ROF, art. 16.4.
**Qué haremos.** Conectar el cálculo al total y al registro como indique, o quitarlo si en este
sector no se da.
**Lo que ya tenemos:** IA · 22-sep, sólo sobre si se da en servicios. El resto, sin respuesta.

### B6 · El criterio de caja

**La pregunta.** Para un profesional acogido al régimen especial del criterio de caja: (1) ¿vale como
fecha de cobro **la fecha en que el profesional marca la factura como cobrada** en la aplicación, o
hace falta la **fecha real del movimiento en el banco**? (2) Si una factura es correcta pero en el
registro se declara con la clave de régimen equivocada, ¿es una infracción y de qué cuantía? (3) ¿La
AEAT cruza la autoliquidación del IVA con los registros remitidos?
**Por qué.** Decide qué dato tenemos que guardar, y cuánto importa un error en la clave del régimen.
**Normas que ya hemos localizado.** LIVA, arts. 163 decies a 163 terdecies; ROF, art. 6.1.p) (la mención «régimen
especial del criterio de caja»); RIVA, art. 61 decies.
**Qué haremos.** Guardar la fecha que indique y declarar la clave del régimen como indique.
**Lo que ya tenemos:** IA · 23-sep, sólo sobre (1). Nuestros propios
documentos no coinciden en si esa respuesta la contesta.

---

## C · Cobros y anticipos

### C1 · ¿Cuándo tiene que estar emitida la factura de la señal?

**La pregunta.** Un particular paga hoy una **señal** por una obra en su casa. (1) ¿La factura del
anticipo tiene que emitirse **en el mismo momento del cobro**, o hay margen, y cuánto? (2) Si el
cliente es **empresario**, ¿basta con emitirla antes del día 16 del mes siguiente al cobro? (3) ¿Qué
consecuencia tiene emitirla **tarde pero emitirla**?
**Por qué.** Cuando se active la emisión, cada cobro de señal por la aplicación debe llevar su
factura, y necesitamos saber cuándo.
**Normas que ya hemos localizado.** ROF: art. 2.1, párrafo segundo (factura por los pagos recibidos antes de la
operación), art. 11.1 (plazo de expedición), art. 18 (remisión) y art. 6.1.i) (fecha del pago
anticipado); LIVA, art. 75.Dos (devengo del anticipo); LGT, art. 201.1. Texto consolidado del BOE.
**Qué haremos.** Emitir y enviar la factura del anticipo en el plazo que indique.
**Lo que ya tenemos:** SIN RESPUESTA.

### C2 · Revisión del expediente de anticipos y factura recapitulativa (adjunto)

**La pregunta.** Tenemos un **borrador escrito para su revisión** (lo adjuntamos) con nuestras
preguntas sobre anticipos y facturas recapitulativas de albaranes. Las principales son: (1) si la
factura de anticipo lleva **serie propia**; (2) si hace falta una **factura final a 0 €** cuando se ha
anticipado el 100 %; (3) qué pasa con un anticipo ya descontado si luego hay que **rectificar**; (4)
qué **menciones** mínimas lleva; (5) qué fecha define el **mes** de una recapitulativa y cuándo queda
cerrada; (6) si un **albarán valorado** sin validez fiscal plantea algún problema; (7) si una
rectificativa **libera** los albaranes que incluía, que es lo que la empresa ha decidido.
**Normas que ya hemos localizado.** ROF, arts. 2, 6, 11, 13 (recapitulativa) y 15; LIVA, art. 75. El borrador cita
las consultas de la DGT que localizamos.
**Qué haremos.** Construir la facturación de anticipos y recapitulativas como indique.
**Lo que ya tenemos:** SIN RESPUESTA. La (7) la ha decidido la empresa y pedimos que la confirme.

---

## D · Correcciones y conservación

### D1 · ¿El PDF que se entrega también tiene que ser inmutable?

**La pregunta.** El registro de cada factura queda sellado con su huella. El **PDF**, en cambio, se
vuelve a generar si se pierde, con **los mismos datos** pero con **la plantilla actual**, no con la
del día de emisión. (1) ¿Exige la norma que el documento entregado sea **idéntico** al original, o
basta con que sus datos coincidan con el registro sellado? (2) La copia que debe conservar el
profesional (art. 19 ROF), ¿es la del documento **tal como se entregó**? (3) Si hace falta el
documento idéntico, ¿basta con **archivar el PDF** del día de emisión, o hay que conservar también
la **versión de la plantilla**?
**Por qué.** Condiciona una decisión de diseño que está parada.
**Normas que ya hemos localizado.** ROF, art. 19 (conservación de facturas); RD 1007/2023, art. 8.
**Qué haremos.** Archivar el PDF, versionar la plantilla, las dos cosas o ninguna, según indique.
**Lo que ya tenemos:** SIN RESPUESTA.

### D2 · Los datos del emisor en una rectificativa, si han cambiado

**La pregunta.** Un autónomo factura en enero, en marzo cambia de domicilio fiscal (o de nombre, o
constituye una sociedad) y en octubre rectifica la factura de enero. (1) ¿Qué datos del emisor van en
la rectificativa: los de enero o los de octubre? (2) ¿Cambia si lo que cambió es el **NIF**, y sigue
valiendo como rectificativa de aquella? (3) Una copia de la factura original sacada años después,
¿con qué datos sale? (4) ¿Hay que conservar el historial de los datos del emisor?
**Normas que ya hemos localizado.** ROF, arts. 6 y 15.
**Qué haremos.** Aplicarlo en la rectificativa; hoy usa los datos vigentes al rectificar.
**Lo que ya tenemos:** SIN RESPUESTA.

### D3 · ¿El fichero que exportamos es «el registro de facturación» para una asesoría?

**La pregunta.** Exportamos un ZIP con las facturas, los registros de VeriFactu y sus justificantes.
Para una asesoría o una inspección, ¿es ése **el registro de facturación** que hay que entregar, o se
espera otra cosa?
**Normas que ya hemos localizado.** RD 1007/2023, art. 8; Orden HAC/1177/2024.
**Qué haremos.** Ajustar la exportación.
**Lo que ya tenemos:** SIN RESPUESTA.

---

## E · Libros, modelos y contabilidad

### E1 · Libros registro: dos campos

**La pregunta.** (1) En el libro de **facturas recibidas**, si un gasto es deducible **en parte** (un
vehículo, por ejemplo), ¿hay que guardar el **importe deducible**, o basta con «sí o no»? (2) ¿El libro
de recibidas lleva **numeración propia**, distinta del número de la factura del proveedor?
**Normas que ya hemos localizado.** RIVA, arts. 62 a 64; Orden HAC/773/2019; el diseño normalizado de la AEAT.
**Qué haremos.** Añadir los campos que indique.
**Lo que ya tenemos:** SIN RESPUESTA. El formato general del libro es IA · 22-sep.

### E2 · Cinco avisos del libro registro

**La pregunta.** Cuando la aplicación arma el libro trimestral, puede encontrarse cinco situaciones de
excepción. Para cada una, ¿**debe afirmar** algo sobre si el libro está completo, **sólo avisar**, o
**impedir** descargarlo?
1. El libro **no cuadra**: se revisaron facturas y no salió ningún asiento.
2. Hay **importes que no se pudieron leer**.
3. Salen facturas descartadas **por no ser de este negocio**.
4. Hay **facturas sin número**. ¿Basta con decir cuántas, o también cuánto suman?
5. Hay **albaranes firmados después** de sellada la factura. ¿Es una anomalía, o una situación normal?
**Normas que ya hemos localizado.** RIVA, arts. 62 y 63.
**Qué haremos.** Escribir cada aviso según indique. Hoy están vacíos a propósito.
**Lo que ya tenemos:** SIN RESPUESTA.

### E3 · El ticket de un proveedor, ¿da derecho a deducir el IVA?

**La pregunta.** El profesional registra un gasto con un ticket (factura simplificada) de un
proveedor. (1) ¿Qué tiene que llevar ese documento para que el IVA sea deducible? ¿Basta con su NIF y
la cuota desglosada? (2) Sabiendo que un ticket puede ser gasto en el IRPF aunque no deduzca el IVA,
¿qué afirmación sería **incorrecta** en un aviso al profesional?
**Normas que ya hemos localizado.** LIVA, art. 97.Uno; ROF, art. 7.2.
**Qué haremos.** Mostrar el aviso sólo cuando sepamos qué no dice nada falso.
**Lo que ya tenemos:** SIN RESPUESTA.

### E4 · Confirmar el mapa de modelos de un autónomo de oficio

**La pregunta.** Para un autónomo de oficio en estimación directa y régimen general de IVA, con
clientes particulares y empresas: ¿qué **modelos** presenta (303, 390, 130, 111/190, 115/180, 347, 100,
349), cuáles **siempre** y cuáles **según el caso**, y qué cambia si opta al **criterio de caja**?
**Por qué.** Ya tenemos un mapa de modelos, pero lo preparó una herramienta de inteligencia
artificial y ningún profesional lo ha revisado.
**Qué haremos.** Construir la parte de contabilidad sobre ese mapa.
**Lo que ya tenemos:** IA · 23-sep.

### E5 · Tipos de IVA poco comunes

**La pregunta.** Nuestro selector admite también 2 %, 5 % y 7,5 %. ¿Alguno se aplica hoy a operaciones
de este sector?
**Qué haremos.** Mantenerlos o quitarlos del selector.
**Lo que ya tenemos:** SIN RESPUESTA.

---

## F · Contratos y consumo

### F1 · Términos del servicio: quién responde de qué

**La pregunta.** Queremos que los Términos dejen claro que **el profesional responde** de que el
contenido de sus facturas sea veraz y de su obligación de facturar, y que **nosotros respondemos**
de que el sistema sea técnicamente conforme. ¿Es correcta esa separación, y qué cláusulas hacen falta
para que se sostenga? Incluye la cláusula de conformidad de A4.(5).
**Normas que ya hemos localizado.** ROF, art. 5.1; RD 1007/2023, art. 6; LGT, art. 201 bis.
**Lo que ya tenemos:** IA · 22-sep.

### F2 · Condiciones económicas en los Términos

**La pregunta.** ¿Cómo tienen que recoger los Términos la suscripción, la comisión del 0,9 % cuando
el cliente paga con tarjeta, la relación con el procesador de pagos y que el profesional es quien
vende legalmente?
**Lo que ya tenemos:** SIN RESPUESTA.

### F3 · El alcance de la oferta para los primeros clientes

**La pregunta.** Tenemos un borrador que explica a los primeros clientes qué incluye hoy el servicio y
qué llegará después, **incluida la facturación**. ¿Es correcto **cobrar la suscripción antes** de
que la facturación esté operativa, tal como está planteado? ¿Qué **no podemos prometer** sobre cuándo
se activa?
**Aviso al enviarlo.** El borrador tiene una frase («se activa al cerrar la certificación») que
**ya sabemos que hay que corregir**, porque VeriFactu no tiene certificación. Conviene mandarlo
corregido.
**Lo que ya tenemos:** SIN RESPUESTA.

### F4 · Trabajo añadido en obra, y la firma con el dedo

**La pregunta.** Cuando en obra aparece trabajo que no estaba en el presupuesto, el cliente firma un
presupuesto adicional **con el dedo en su móvil**, y queda registrada la fecha, la hora y la IP. (1)
Para un **consumidor**, ¿vale esa firma como aceptación **por escrito**? Si no, ¿qué le falta? (2) ¿Qué
tiene que llevar ese adicional, y cambia **fuera de la Comunidad de Madrid**? (3) Si el cliente es
empresa, ¿basta una aceptación verbal? (4) Aparte: **¿esa misma firma**, con foto del DNI, cumple
el art. 26 del Reglamento eIDAS para firmar la representación de A2?
**Normas que ya hemos localizado.** Reglamento (UE) 910/2014, art. 26; normativa de consumo de la Comunidad de
Madrid (Decreto 35/1995 y Decreto 1/2010).
**Lo que ya tenemos:** IA · 22-sep, sólo para Madrid. El resto de comunidades y la firma eIDAS, sin
respuesta.

### F5 · Lo que recibe el cliente final al pagar

**La pregunta.** (1) Un profesional cobra una señal **fuera de la aplicación** (en efectivo o por
Bizum) y aún no ha emitido la factura. **Aparte de la factura**, ¿tiene alguna obligación civil,
de consumo o fiscal de entregar algo al cliente en ese momento? ¿Tiene el cliente derecho a exigir un
recibo? (2) La copia del **presupuesto firmado** por el cliente, con precio y condiciones, ¿cumple la
confirmación documental del art. 63.1 del texto refundido de consumidores?
**Normas que ya hemos localizado.** Código Civil, art. 1110; RDLeg 1/2007, art. 63; ROF, art. 2.1. Texto consolidado
del BOE.
**Lo que ya tenemos:** SIN RESPUESTA.

---

## G · Protección de datos

### G1 · Un profesional que se da de baja

**La pregunta.** Si un profesional pide que borremos sus datos y ya ha emitido facturas, ¿qué
conservamos, cuánto tiempo (**4 o 6 años**) y cómo, y qué borramos?
**Normas que ya hemos localizado.** RGPD, arts. 17.3.b); LOPDGDD, art. 32; ROF, art. 19; Código de Comercio, art. 30;
LGT, art. 66.
**Lo que ya tenemos:** IA · 22-sep.

### G2 · Un cliente final que pide que se borren sus datos

**La pregunta.** Si quien pide el olvido es el **cliente final**, sobre sus datos que ya están en una
factura emitida por el profesional, ¿se aplica el mismo criterio que en G1? ¿Hay que decírselo en
algún texto?
**Lo que ya tenemos:** IA · 22-sep.

### G3 · Revisión de la privacidad publicada

**La pregunta.** Nuestra política de privacidad está publicada desde el 23-jul-2026 y **nunca la ha
revisado un asesor**. Pedimos: (1) el reparto de papeles entre nosotros y el profesional (responsable
o encargado) en cada tratamiento; (2) los plazos exactos de conservación; (3) si necesitamos un
**delegado de protección de datos**; (4) si bastan los contratos estándar de nuestros proveedores
(mensajería, correo, inteligencia artificial) o hacen falta **cláusulas tipo o una evaluación de
transferencias internacionales**; (5) el uso del **IBAN** del profesional; (6) si podemos mostrar al
cliente **el nombre del técnico** que va a su casa.
**Lo que ya tenemos:** SIN RESPUESTA.

---

# PARTE 3 · Lo que NO se envía, y por qué (no se envía)

| Pregunta | Por qué no | Dónde está resuelto |
|---|---|---|
| **D5.4** · ¿Dónde se pide el NIF? | **Lo decidiste tú** (17446): en el alta y, si falta, antes de emitir, con aviso y guardándolo en la ficha | SCRUM-825, comentario 17446 |
| **D5.5** · ¿Se construye la simplificada? | Es una **decisión de producto**, que se toma cuando llegue la respuesta a **B1**. Dato técnico nuestro, no del asesor: según J1 (SCRUM-1258), la huella de una simplificada saldría calculada como si fuera completa si el tipo se decide al exportar en vez de al emitir | SCRUM-825 §2.5; SCRUM-1258 |
| **F11** · ¿La rectificativa es «por diferencias»? | Lo dice la **AEAT**, literal en su FAQ, y lo confirman sus esquemas y sus validaciones 1118 y 1119 | Skill `verifactu` §4; `PREGUNTAS_ASESOR.md`, RESPUESTAS·B4 |
| **F12** · ¿La señal obliga a factura? | **Lo dice la norma:** ROF 2.1, párrafo segundo, y LIVA 75.Dos. Lo que queda abierto va en **C1 y C2** | SCRUM-1253 §Ⓒ |
| **1253 Ⓖ.3 · ¿Hay otra figura en vez del justificante?** | **Lo dice la norma:** la única figura es la factura (sea completa o simplificada) | SCRUM-1253 §Ⓔ |
| **1232 Ⓗ.1-4** · Justificantes antiguos en el libro y en el 303 | **Fuera definitivamente** (decisión 4 de la parte 1): los 44 justificantes del censo del 10-ago eran todos de prueba, de ningún profesional real | SCRUM-1232 §Ⓗ |
| **F9/P16.1** · ¿El justificante va en el registro? | El justificante **se retira** (lo firmaste, D1 de 17446) y nunca se selló | SCRUM-825, 17446 |
| **F15** · Coste y plazo de la revisión | Es **logística**: se pregunta al pedir la cita | — |
| **D12** · ¿Hay que darse de alta para el entorno de pruebas? | Lo dice la **AEAT** en su Portal de Pruebas Externas: acceso libre con certificado | `PREGUNTAS_ASESOR.md`, ADDENDA·D12 |
| **QC5 · QC8 · QC9 · M5.3** | Son decisiones de producto, o hay que **buscar** órdenes ministeriales: no piden juicio legal | SCRUM-1023, mapa |
| **QC1 · QC2 · QC3 · QC4 · QC6** | **Duplicadas:** están dentro de B3, B4, B5 y B6 | SCRUM-1023, «Duplicadas» |
| **SCRUM-1102** · ¿Sólo el SII elimina el 347? | Es un **cotejo nuestro** contra el BOE, no una pregunta | SCRUM-1102 |
| Las citas **⚠ «de memoria»** de las respuestas del 23-sep | Las **comprobamos nosotros** en el BOE; no son pregunta | SCRUM-1104, SCRUM-1106 |
| Las dos líneas de **plantillas de Meta** (máster :296 y :300) | **No son del asesor:** la cuenta de Meta la tiene Luis | SCRUM-825, 17446 (D3) |

**Una incoherencia para quien lleve `PACK_GESTORIA.md`:** en su línea 51 dice que la simplificada vale
«hasta 400 €». El art. 4.2.c) del ROF la admite **hasta 3.000 €** en servicios a domicilio del
consumidor. **No lo corrijo aquí**, porque ese fichero no es mío y la respuesta de B1 puede cambiar
qué se pone. Lo aviso.
