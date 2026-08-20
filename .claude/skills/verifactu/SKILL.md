---
name: verifactu
description: Conocimiento verificado de VeriFactu/SIF para YaQu. Úsala SIEMPRE que la tarea toque facturación española, registros de facturación, huella encadenada, remisión a la AEAT, declaración responsable, esquemas XSD de VeriFactu, códigos de error de la AEAT, o cualquier texto de producto que mencione Hacienda. También antes de responder a una pregunta sobre plazos u obligaciones de VeriFactu.
---

# VeriFactu en YaQu

Todo lo que hay aquí se verificó contra fuente oficial (BOE, sede de la AEAT, esquemas XSD
publicados) o contra el código, con fecha. **Lo que no está verificado se dice con esas
palabras.** Si esta skill contradice al máster: **para y dilo, no elijas.** Para hechos medibles (qué
existe, qué está construido) gana el CÓDIGO, y la auditoría
`docs/legal/AUDITORIA_CAMINO_EMISION.md` es su lectura escrita. Para decisiones y textos de
usuario gana el máster. Si no está claro en cuál de los dos casos estás, es que estás en el
primero: **pregunta.**

Última actualización: **19-ago-2026**.

---

## 0 · LAS CINCO COSAS QUE MÁS SE DICEN MAL

Antes que nada, porque son las que se repiten:

| Se dice | La verdad |
|---|---|
| «Está construido y apagado, hay que activarlo» | 🔴 **No está construido.** No hay envío a la AEAT ni lo ha habido nunca (auditoría SCRUM-525, 19-ago-2026) |
| «YaQu genera y firma los registros» | 🔴 **En VeriFactu NO se firma.** Art. 16.3 RRSIF dispensa de firma electrónica: basta la huella encadenada |
| «Estamos certificados» | 🔴 **No existe la certificación de VeriFactu.** El régimen se basa en una **declaración responsable** del productor (art. 13 RRSIF) |
| «Somos colaboradores sociales de Hacienda» | 🔴 **No lo somos.** Es un régimen al que hay que adherirse formalmente; no se es por escribir código |
| «La obligación entra el 1 de enero de 2027» | 🔴 **Sólo para sociedades.** Nuestro cliente autónomo tiene hasta el **1 de julio de 2027** |

---

## 1 · ESTADO REAL DEL CÓDIGO (auditoría 19-ago-2026, SCRUM-525)

El camino de una factura tiene **nueve pasos. Siete existen y funcionan:**

1. Decide qué documento corresponde (factura / justificante / ninguno)
2. Numeración de serie correlativa
3. Cálculo de la **huella** criptográfica
4. **Encadenado** con la huella de la factura anterior
5. **Sellado** temporal en el momento de emitir
6. **QR de cotejo**
7. **XML del registro con el formato oficial de la AEAT**

**Los dos que NO existen:**

8. ⛔ La **cola de envío**
9. ⛔ El **envío** y la lectura de la respuesta de la AEAT

**Hoy ese XML se descarga. No se transmite.** No hay ni una sola llamada del código hacia la
Agencia Tributaria. La auditoría lo midió con dos instrumentos y con un control de ceguera.

**Consecuencia para cualquier estimación:** entre hoy y el envío no hay «encender», hay
**construir**. *«Apagado» y «no construido» se parecen en una conversación y no se parecen en
nada en un calendario.*

### Los carriles de representación: no existe ninguno

El obligado ante Hacienda es **cada profesional**, no YaQu. Hay dos formas legales de remitir en
nombre de otro:

- **Carril A · colaborador social** — YaQu se adhiere al régimen y remite con **su** certificado
  en nombre de todos, con apoderamiento.
- **Carril B · certificado de cada profesional** — cada uno aporta el suyo; YaQu remite como
  representante y custodia los certificados.

**El código no contempla ninguno de los dos**, porque no remite. **Elegir carril es una decisión
de los fundadores y el asesor fiscal, y es hoy el camino crítico:** nada de VeriFactu se
construye hasta que se tome.

⚠️ **Dato que pesa en esa decisión** (validación oficial **4112**): el titular del certificado con
el que se remite debe ser **Obligado a la Emisión, Colaborador Social, Apoderado o Sucesor**. No
vale cualquier certificado.

🟡 **Y un matiz que se suele dar por supuesto y no es cierto: A y B NO son excluyentes.** La
validación 4112 admite **cuatro títulos distintos** y los valida **por envío**, no por plataforma.
Nada en los esquemas ni en las validaciones dice «una plataforma, un carril». **Que puedan
convivir en la práctica —y qué obligaciones arrastra cada uno— es pregunta para el asesor
fiscal, no para una sesión.**

🔧 **La consecuencia de ingeniería, ésta sí es nuestra:** mientras la decisión no esté tomada,
el diseño debe dejar **UN SOLO punto que resuelva «con qué credencial remito el registro de este
merchant»**. Con un único punto de resolución, soportar el segundo carril después es barato; con
la credencial resuelta en cinco sitios, es una reescritura. *(Es el patrón de `quotesDelJob` en
SCRUM-195: un solo sitio decide la pertenencia y el resto del fichero ni se entera.)*

### Los «semáforos»: son tres y ninguno mira antes de enviar

- `docs/legal/SEMAFORO_CALIBRACION.md` — clasifica los **códigos de error de la AEAT**. Es un
  manual de qué significa cada respuesta, **no** una comprobación previa.
- `SEMAFORO_MAPA_EMISION.md` — mapa del camino. *(Tuvo coordenadas desfasadas; SCRUM-513 las
  sustituyó por símbolos. Hoy no tiene ni un ancla a número de línea, y así debe seguir.)*
- `semaforoFiscal` en el frontend — con marcador `PENDIENTE_ASESOR`.

**Ninguno comprueba nada antes de enviar.** Todos interpretan una respuesta que hoy no puede llegar.

---

## 2 · NORMATIVA · las referencias, con su BOE

| Norma | Identificador | Qué contiene |
|---|---|---|
| **RD 1007/2023** (RRSIF) | BOE-A-2023-24840 | El reglamento de los sistemas informáticos de facturación |
| **Orden HAC/1177/2024** | BOE-A-2024-22138 | Especificaciones técnicas, formato de los registros, declaración responsable |
| **RD 1619/2012** (ROF) | — | Reglamento de facturación. Art. 15.5: rectificativas |
| **RD-ley 15/2025** | BOE-A-2025-24446 | El aplazamiento de plazos a 2027 |
| **Art. 29.2.j) y 201 bis LGT** | — | La obligación y su régimen sancionador |
| **Consulta DGT V2484-24** (09-12-2024) | — | Confirma el plazo del **productor** |

### Fechas — las tres, y no se mezclan

| Quién | Cuándo |
|---|---|
| **Obligados del Impuesto sobre Sociedades** | antes del **1 de enero de 2027** |
| **El resto de obligados** (autónomos, IRPF) — **nuestro cliente** | antes del **1 de julio de 2027** |
| 🔴 **Productores / fabricantes de software** | **el plazo venció el 29 de julio de 2025** |

Las dos primeras salen literales de la [nota informativa de la
AEAT](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/nota-informativa-ampliacion-plazo-adaptacion-facturacion.html).
La tercera, de la consulta vinculante **DGT V2484-24**, literal: *«como máximo hasta el 29 de
julio de 2025»*.

⚠️ **La fecha del productor y la del obligado son cosas distintas.** Mezclarlas produce frases
falsas en las dos direcciones.

### Sanciones (art. 201 bis LGT · importes de la FAQ oficial de la AEAT)

- **150.000 €** por ejercicio, por cada tipo distinto de sistema, para el productor que incumple
- **1.000 €** por cada sistema comercializado sin certificar *(la letra f) del apartado 1 sanciona
  «no se certifiquen, estando obligado a ello por disposición reglamentaria»)*
- **50.000 €** por ejercicio para la **tenencia** de sistemas que no cumplen

📌 El apartado 2 dice literalmente: *«La misma persona o entidad que haya sido sancionada conforme
al apartado anterior no podrá ser sancionada por lo dispuesto en este apartado»* — productor y
tenedor no acumulan. Las infracciones son **graves**.

---

## 3 · LA MODALIDAD ELEGIDA: VeriFactu · decisión de los fundadores, 19-ago-2026

**SIF ⊃ VeriFactu.** VeriFactu **es una modalidad** del SIF, no un sistema distinto. Se opta por
ella **por el hecho de iniciar la remisión** (art. 16.5 RRSIF / art. 17.2 de la Orden), y **la
opción dura al menos hasta el 31 de diciembre** de ese año.

**Los fundadores descartaron el sistema dual. Sólo VeriFactu.** Lo que eso hace caer:

- ⛔ La **firma electrónica XAdES** — art. 16.3 RRSIF: dispensa, basta la huella
- ⛔ El **registro de eventos entero** (11 tipos de evento, 16 anomalías)
- ⛔ Los procesos de detección de anomalías
- ⛔ La verificación presencial reforzada
- ⛔ Los arts. 6.b)–f), 7.f), h), i), j), 8 y 9 de la Orden — **art. 3 de la Orden**: no aplican en VeriFactu

**Lo que se gana:** art. 16.2 RRSIF, **presunción de cumplimiento por diseño**.

🛑 **Esta decisión no se reabre.** Si una tarea parece requerir firma, eventos o detección de
anomalías, **es señal de que la tarea está mal planteada** — se para y se pregunta.

---

## 4 · LOS ESQUEMAS OFICIALES · lo que hay que respetar sí o sí

Ficheros: `SuministroLR.xsd` · `SuministroInformacion.xsd` · `EventosSIF.xsd` · `ConsultaLR.xsd` ·
`RespuestaConsultaLR.xsd` · `RespuestaSuministro.xsd` · `RespuestaValRegistNoVeriFactu.xsd`.

⚠️ **TRAMPA REAL, ya nos pasó:** existe un `SuministroInformacion.xsd` **del SII** con el mismo
nombre y es OTRO. Se distingue por el namespace (`ssii`) y porque tiene facturas recibidas y tipos
F4/F5/F6/LC/AJ. **Si el esquema que tienes delante menciona facturas recibidas, no es el de
VeriFactu.** Descargar siempre de la sede, nunca de un espejo de GitHub.

### Restricciones que hay que cumplir

| Campo | Regla |
|---|---|
| `TipoHuella` | sólo **`01`** (SHA-256) |
| `Huella` | TextMax64 |
| `Desglose` | máximo **12** `DetalleDesglose` |
| Tipos de factura en VeriFactu | sólo **F1, F2, F3, R1–R5** |
| `ds:Signature` | `minOccurs="0"` en facturación · **obligatorio en EventosSIF** (que no usamos) |

### Bloque `SistemaInformatico` — obligatorio en cada alta

`NombreRazon` + `NIF`/`IDOtro` · `NombreSistemaInformatico` (30) · **`IdSistemaInformatico` (máx
2 caracteres)** · `Version` (50) · `NumeroInstalacion` (100) · `TipoUsoPosibleSoloVerifactu` ·
`TipoUsoPosibleMultiOT` · `IndicadorMultiplesOT`.

*(El ejemplo oficial usa `IdSistemaInformatico` = `F1`.)*

### Rectificativas — CERRADO, con cuatro apoyos convergentes

`ClaveTipoRectificativa` en VeriFactu admite sólo **`S` (sustitutiva)** e **`I` (incremental)** —
sin valor vacío, a diferencia del SII. `ImporteRectificacion` es **`minOccurs="0"`**.

🟢 **Con clave `I` NO se rellena `ImporteRectificacion`.** Lo confirman: el art. 15.5 del ROF · la
FAQ oficial de la AEAT (*«no se deben rellenar»*) · el propio XSD · y las **validaciones 1118 y
1119**, verificadas literales. **Hacerlo al revés produce el rechazo de la factura.**

*(Hubo un comentario en `verifactu.service.ts` que afirmaba lo contrario. **SCRUM-513 lo corrigió
y ya no miente.** Y dejó una lección que aplica a esta skill entera: **no cites documentación por
número de línea** — la línea deriva y la cita se convierte en una mentira sin que nadie la toque.
Cita símbolos.)*

---

## 5 · VALIDACIONES DE LA AEAT · las tres categorías

**No todas las respuestas de error son iguales, y confundirlas cuesta caro:**

| Rango | Efecto |
|---|---|
| **4xxx / 35xx** | 🔴 **rechazan el ENVÍO COMPLETO** |
| **1xxx / 30xx** | 🟠 **rechazan LA FACTURA** |
| **2xxx** | 🟡 **ACEPTAN con errores a subsanar** |

Claves que conviene tener a mano:

- **1118 / 1119** — rectificativas, verificadas literales
- **1150** — F2 sólo hasta 3.000 €
- **1189** — `Destinatarios` obligatorio en F1, F3 y R1–R4
- **1152** — la fecha no puede ser anterior al **28-oct-2024**
- **1287** — caracteres prohibidos: `< > " ' =`
- **2004** — `FechaHoraHusoGenRegistro` se compara con **la hora de la AEAT**
- **4112** — el titular del certificado debe ser Obligado, Colaborador Social, Apoderado o Sucesor
- **4141** — suspensión temporal de acceso

---

## 6 · LA DECLARACIÓN RESPONSABLE · es un requisito de INTERFAZ

Art. 13 RRSIF + art. 15 de la Orden. **Esto es lo que más se malinterpreta:**

🔴 **NO se presenta ante la AEAT.** Es un requisito **del propio programa**: debe estar

> *«de modo visible en el propio sistema informático **en cada una de sus versiones**»*
>
> *«accesible por el usuario de forma **rápida, fácil e intuitiva**»*

Título fijo: **«DECLARACIÓN RESPONSABLE DEL SISTEMA INFORMÁTICO DE FACTURACIÓN»**. Doce letras,
a) a l), **en orden fijo**. **Una por versión.**

→ Ficha: SCRUM-523.

---

## 7 · QUÉ SE PUEDE DECIR Y QUÉ NO

**Regla 26 del máster: la pregunta de VeriFactu se contesta SÓLO con el guion oficial H2.**
Ni con esta skill, ni con la auditoría, ni con una versión propia que suene mejor.

**Esta skill no genera copy de usuario. Ni una frase.**

### Nunca

⛔ «YaQu ya envía tus facturas a Hacienda» — falso hoy
⛔ «Está hecho, sólo hay que activarlo» — falso: no está construido
⛔ «Somos colaboradores de Hacienda» — no lo somos
⛔ «Estamos certificados» — **no existe esa certificación**
⛔ Cualquier fecha concreta de disponibilidad — octubre es objetivo interno, no compromiso

### Verdad sostenible

✅ El producto **genera el registro con el formato oficial**, con huella encadenada y QR, hoy
✅ La parte difícil está hecha
✅ La obligación entra el **1-jul-2027** para autónomos y el **1-ene-2027** para sociedades
✅ **Nosotros elegimos cuándo entra cada cliente** — y eso es un argumento comercial cierto

---

## 8 · REGLAS DE TRABAJO · innegociables

- 🔴 **`INVOICING_ES_ENABLED` = off para merchants reales.** Sin excepción.
  ⚠️ Hoy está **AUSENTE** de Railway, no puesta a `false`. **«Ausente» y «false» se comportan
  igual pero no son lo mismo:** una es un hueco, la otra es una decisión.
- 🔴 **MODIFICAR el camino de emisión es STOP.** Leerlo no lo es (regla 38).
- 🔴 **`prisma/schema.prisma` es de los fundadores** — se prepara el diff y se **PARA**.
- 🔴 **Nunca inventar estados, flags ni textos que no estén en el máster.** Si falta algo, **se
  pregunta**; no se improvisa.
- 🔴 **No creer la documentación.** El inventario SCRUM-528 midió **61 afirmaciones sobre
  VeriFactu en este repo: 19 son falsas y 16 ambiguas.** Entre las falsas está **el guion H2 del
  máster**, que la regla 26 declara la única respuesta autorizada ante un cliente. **Si un
  documento y el código discrepan, gana el código**, y la discrepancia se anota.
  La lista completa: `docs/legal/INVENTARIO_AFIRMACIONES_VERIFACTU.md`.
- 🟡 **Hay otra skill de VeriFactu en este repo: `yaqu-verifactu-sif`.** No colisiona con ésta
  —hace otra cosa: impone el proceso y las reglas 7/17/29, mientras ésta aporta el conocimiento
  verificado— pero **su contenido NO se inventarió en SCRUM-528**. Si algo de ella contradice a
  ésta, **no elijas: dilo**.
- 🔴 **Cada afirmación con fichero y línea.** Sin coordenada → **NO MEDIDO**, con esas palabras.
- 🔴 **Suelo de ceguera:** si el instrumento no encuentra lo que busca, **falla declarándose
  ciego**. Un «no existe» por ceguera y uno medido son la misma frase con consecuencias opuestas
  — y aquí la consecuencia es un incumplimiento tributario.

---

## 9 · LO QUE SIGUE ABIERTO · no lo cierres tú

1. 🔴 **Carril A, carril B, o los dos.** Decisión de los fundadores + asesor fiscal. **Bloquea
   todo lo demás.** ⚠️ **No la plantees como excluyente** — ver §1.
2. 🔴 **¿YaQu es «productor» a efectos del art. 13 RRSIF hoy**, con el envío sin construir y la
   bandera apagada? El plazo del productor venció en julio de 2025 — **la pregunta es si nos
   aplica ya o cuando comercialicemos el SIF.** Es interpretación jurídica: **la contesta el
   asesor, no una sesión.**
3. ⬜ La **fecha de disponibilidad** real, una vez elegido carril.

---

*Fuentes primarias: BOE · sede electrónica de la AEAT · esquemas XSD oficiales · consulta
vinculante DGT V2484-24. Estado del código: auditoría SCRUM-525 (19-ago-2026), detalle en
`docs/legal/AUDITORIA_CAMINO_EMISION.md`.*

⚠️ **`www.agenciatributaria.es` falla al descargar** por un certificado TLS con firma débil.
**Usar `sede.agenciatributaria.gob.es`**, que sí funciona.
