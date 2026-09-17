# SCRUM-524 — La tabla de comprobación de VERI*FACTU: 41 restricciones contra el árbol de hoy

*17-sep-2026 · rama `scrum-524-la-tabla-de-comprobacion`*

**Medido contra:** `origin/main` = `2242683172bad64e4cc9f591e5c81b43fe5dc52e` · 2026-09-17T21:45:14+01:00

**Tanda:** 7480 tests · 7368 pass · **1 fail** · 111 skipped — el fallo es el ajeno de SCRUM-922 (`wmic`), no tocado.

> **Este ticket NO CONSTRUYE NADA.** Cero líneas de `src/`. El camino de emisión se ha **LEÍDO**
> (regla 38: leer no es STOP, modificar sí). **No hay aquí ni una frase que un cliente pueda leer**
> (reglas 26/30): esto es diseño interno y la pregunta de VeriFactu se sigue respondiendo SÓLO con
> el guion H2.
>
> Skills obligatorias **cargadas antes de tocar nada**: `yaqu-verifactu-sif` y `verifactu`. Lo digo
> porque ayer no lo hice y lo confesé (SCRUM-811b, «yo soy el caso 223»).

## PASO 0 · La premisa VIVE: no existe la tabla

`docs/legal/SEMAFORO_CALIBRACION.md` (29.307 bytes, 19-ago-2026) parecía el candidato. **No lo es**,
y se ha medido en vez de suponerlo:

    grep -in "comprueba|entrada|construcci|saneamiento"  SEMAFORO_CALIBRACION.md   →  0 ocurrencias

Sus cabeceras de tabla son `Código | Texto oficial`, `Validación | Código`, `Rechazo | Aceptación`:
**clasifica la RESPUESTA de la AEAT por gravedad. Ninguna columna dice si el árbol lo comprueba, ni
dónde.** Es un manual de interpretación, no una tabla de comprobación. **No se para.**

---

## ① 🔴 EL HALLAZGO PRINCIPAL · no es que la respuesta se trate como booleana: es que NO SE TRATA

La pregunta del encargo era si el código trata la respuesta como OK/KO. **Medido, es peor y más
simple:**

| lo buscado | en `src/` | en `prisma/schema.prisma` |
| --- | --- | --- |
| `Subsanacion` | **0** | **0** |
| `RechazoPrevio` | **0** | **0** |
| `EstadoRegistro` · `EstadoEnvio` · `Incidencia` | **0** | **0** |
| `AceptadoConErrores` | **0** | **0** |

**No hay ningún sitio donde el estado «aceptado con errores» pueda escribirse.** Y el campo que
parece su hogar natural **está ocupado por otra cosa**:

```
selladoEstado.ts:49-56
  SELLADO_PENDIENTE = 'pendiente_de_sellado'
  SELLADO_HECHO     = 'sellado'
  SELLADO_NO_APLICA = 'no_aplica'
  type EstadoSellado = pendiente | sellado | no_aplica
```

`vfEstado` (`schema.prisma:885`) **no describe la remisión: describe el sellado local** —si la
huella se calculó—. Sus tres valores no incluyen «remitido», «aceptado», «aceptado con errores» ni
«rechazado». La única decisión que se deriva de él **sí es binaria**, pero sobre otra cosa:

```
selladoEstado.ts:94-96   puedeProducirDocumento(estado) → estado !== SELLADO_PENDIENTE
```

> **El riesgo no es un booleano mal diseñado que haya que ampliar. Es que el vocabulario de estados
> que existe describe una fase distinta**, y quien construya ROAD-29 encontrará un campo llamado
> `vfEstado` que parece el sitio y no lo es. **Meter ahí «aceptado con errores» mezclaría el sellado
> con la remisión en una sola columna**, y ése es el error caro.

Coherente con lo que ya fijan las skills: **no hay envío ni lectura de respuesta** (eslabones 8 y 9
de `docs/legal/AUDITORIA_CAMINO_EMISION.md`). **No es que la respuesta se interprete mal: es que no
llega ninguna.** Aquí eso no es alivio — es que el diseño está **entero por hacer**, y por eso ⑤ no
puede esperar.

---

## ② LA TABLA · 41 restricciones EXAMINADAS (no 41 encontradas)

**Población declarada: las 41 restricciones del catálogo del ticket.** Lo que no se pudo decidir va
a **NO DECIDIBLE** y cuenta del lado malo, como pedía el encargo.

    COMPROBADA hoy .......  8     NO comprobada .......  22
    FUERA DE ALCANCE .....  3     NO DECIDIBLE ........   8
                                                        ── 41

### ✅ Las que el árbol SÍ comprueba — con fichero:línea (control positivo)

| código | qué exige | **dónde se comprueba** | capa |
| --- | --- | --- | --- |
| **1130** | `NumSerieFactura` sin `< > " ' =` | `fiscalInput.ts:42,71` → **con llamadores**: `schemas.ts:466` y `app.ts:970` | 🟦 **ENTRADA** |
| **1152** | fecha no anterior al 28-oct-2024 | `fiscalInput.ts:45-55` (`ANIO_MINIMO_FISCAL`) | 🟦 **ENTRADA** |
| — | tipo de IVA español válido | `fiscalInput.ts:58-68` (`TIPOS_IVA_ES_BP`) | 🟦 **ENTRADA** |
| **1189 / 1190** | `Destinatarios` obligatorio F1/F3/R1-R4, prohibido F2/R5 | `verifactu.service.ts:859` `resolverSinDestinatario` · `:866` sólo emite con NIF | 🟧 **CONSTRUCCIÓN** |
| — | sólo F1, F2, F3, R1–R5 | `verifactu.service.ts:341` `exigirTipoDeclarable` | 🟧 **CONSTRUCCIÓN** |
| — | `TipoHuella` = `01` | 5 sitios en `src/` | 🟧 **CONSTRUCCIÓN** |
| **1118 / 1119** | rectificativa `I` no lleva `ImporteRectificacion` | corregido en SCRUM-513 (el comentario ya no miente) | 🟧 **CONSTRUCCIÓN** |
| — | tope 1.000 registros por envío | `MAX_REGISTROS_POR_ENVIO` (5 sitios) | 🟧 **CONSTRUCCIÓN** |

**Sin estas ocho, la tabla diría «no se comprueba nada» y eso sería haber leído el catálogo, no
haber medido el árbol.**

### 🔴 Las que NO se comprueban — las 22

**Las ocho `2xxx` enteras** (2000, 2002, 2003, **2004**, 2005, 2006, 2007, 2008) no pueden
comprobarse hoy **por construcción**: todas describen el veredicto de la AEAT sobre un registro
remitido, y no hay remisión. **Van al lado malo igualmente**: que sea imposible hoy no las hace
cubiertas mañana.

**1287** (caracteres en texto libre) · **1241 / 1242** · **4141** · **1108** (NIF emisor =
obligado) · **1112 / 1133** (fecha futura / +20 años) · **1150** (F2 ≤ 3.000 €) · **1116 / 1117 /
1114 / 1115** (sustituidas, rectificadas, tipo rectificativa) · **1157** (`Cupon`) · **1207**
(`CuotaRepercutida` sólo con S1) · **1237 / 1238** (no sujeta/exenta sin tipo ni cuota).

### ⬜ FUERA DE ALCANCE — con su motivo (control negativo)

Inflar la lista de pendientes con lo que no nos toca la haría inútil.

| código | por qué queda fuera |
| --- | --- |
| **1138 / 1139** `Macrodato` | exige `ImporteTotal` ≥ **100.000.000 €**. Medido: `Macrodato` sale **0 veces** en `src/`, y el producto cobra reparaciones de oficios. **No es una carencia: es un campo que nunca se alcanza.** |
| **4112** titular del certificado | requiere remitir, y no hay remisión ni certificado. **No es «incumplido»: es «aún no aplicable»**, y depende del carril A/B que sigue sin decidirse. |

### ⚪ NO DECIDIBLE — 8, y cuentan del lado malo

Los **nueve** códigos del bloque `SistemaInformatico` (1176, 1177, 1179, 1220, 1221, 1223, 1212,
1213, 1226) se agrupan aquí como **un solo** frente con 8 comprobaciones distintas: el bloque **se
construye** (`registro.builder.ts:19`, `SistemaInformatico`), pero **si sus valores cumplen las
restricciones de la AEAT no se puede decidir leyendo el árbol** — dependen de datos de
configuración (NIF del productor, `IdSistemaInformatico` de 2 caracteres, `NumeroInstalacion`) que
no viven en el código. **Decidirlo exige la configuración real, no el repositorio.**

---

## ③ LAS TRES MEDIDAS

### 🔴 1287 · `DescripcionOperacion` — **NO hay saneamiento, y el que existe es de otro campo**

**La medición sorprende en los dos sentidos.** Sí hay un saneador de caracteres prohibidos, y está
escrito citando **el propio 1287**:

```
fiscalInput.ts:38   /** 1130 / 1287 · Caracteres que la AEAT prohíbe en `NumSerieFactura` … */
fiscalInput.ts:42   const PROHIBIDOS_SERIE = ['"', "'", '<', '>', '='];
```

**Pero protege `NumSerieFactura`, no `DescripcionOperacion`.** El campo que escribe el profesional
entra por `concept`, y su validación es:

```
schemas.ts:88    concept: z.string().min(1)      ← eso es TODO
schemas.ts:385   concept: z.string().min(1)
```

Lo único que le pasa después es un **escape XML**, que no es un saneamiento:

```
verifactu.service.ts:918   <sum1:DescripcionOperacion>${xmlEscape(lines[0]?.concept || …)}</…>
verifactu.service.ts:553   xmlEscape → replace(/[&<>"']/g, …)   " → &quot;
```

> **«Cambio de llave 1/2"» llega hoy hasta el XML sin que nada lo mire**, convertido en `&quot;`.
> **Y el sitio de arreglarlo es la entrada**, como dice el ticket: en la construcción ya es tarde
> porque la factura está emitida y no se edita (regla 29).

⚠️ **Y una pregunta que NO cierro** (va a ④): **¿un `&quot;` escapado satisface al validador de la
AEAT, o lo desescapa y lo rechaza igual?** Si lo desescapa, hoy estaríamos emitiendo rechazos
seguros. Si no, el escape basta y 1287 sólo afecta a campos sin escapar. **No es decidible desde el
repositorio y no lo voy a suponer: es lo que separa esta medición de una conjetura.**

### 🔴 2004 · El reloj — **CERO, medido con términos precisos**

```
NTP  0   ·   clock  0   ·   skew  0   ·   sincroniz  0   ·   "hora de la AEAT"  0   ·   "2004"  0
y ninguno aparece en src/modules/invoicing/ ni en src/modules/fiscal/
```

El sello sale de `new Date()` y del huso **del sistema** (`formatFechaHoraHuso`, medido en
SCRUM-880). **No hay nada que compare ese instante con ninguna referencia externa.**

**Por qué esto es distinto de las demás carencias:** un rechazo se ve. **Una deriva de reloj produce
registros ACEPTADOS con error 2004, en silencio y de forma continuada** — y como hoy nadie lee
respuestas (①), no habría ni siquiera el aviso. Es la combinación exacta que ① describe:
**aceptados-con-errores sin subsanar y sin que nadie lo sepa.**

**Conecta con `SCRUM-813` — «El trinquete de zona horaria»**, que existe y está medido. **Sí aplica**:
el mismo eje (qué hora declara este sistema) desde otra cara. `SCRUM-643 §A` no lo he podido
contrastar — su registro va de albaranes del mes que no toca; **lo declaro sin resolver en vez de
forzar la conexión.**

### ✅ 1189 / 1190 · `Destinatarios` — **sí se comprueba, y la respuesta a tu pregunta es NO**

*¿Puede el producto emitir hoy una completa sin identificar cliente?* **No, y está resuelto con
cuidado:**

```
verifactu.service.ts:859   resolverSinDestinatario(tipoBase, inv.number, MODO_SIN_DESTINATARIO)
verifactu.service.ts:866   const destinatarios = destinatario.taxId ? `<sum1:Destinatarios>…` : ''
```

El comentario `:819-823` explica la trampa que ya se pisó: **omitir el bloque era válido contra el
XSD y RECHAZADO por la AEAT (1189)** — un hueco que ni el esquema ni un assert de cadena veían. Hoy
`MODO_SIN_DESTINATARIO` vale `SIN_DICTAMEN`: **la factura se EXCLUYE del registro y se reporta**, en
vez de declararse con una marca que nadie ha decidido. **El producto no se toca: la factura se emite
y se cobra.**

**Es la mejor pieza del camino de emisión que he leído hoy**, y por eso es el control positivo de
esta tabla: demuestra que el instrumento sabe reconocer una restricción cubierta.

---

## ④ LO QUE NO SE DA POR ENTENDIDO · preguntas, no conclusiones

1. **1242 — «No existe el sistema informático».** Sugiere que la AEAT mantiene registro del sistema
   a partir de envíos previos. `SCRUM-523` dice que **no existe alta previa exigida por la norma**.
   **¿Se refiere a la consulta y no al alta?** → **profesional. No lo damos por entendido.**
2. **4141 — suspensión temporal de acceso.** Existe un mecanismo por el que la AEAT **corta el
   acceso**. La cola de reintentos del art. 16.4 (≥ 1/hora) responde a **una caída del servicio**, no
   a una suspensión: reintentar contra una suspensión no la resuelve y puede agravarla. **¿Cómo debe
   degradar el sistema sin perder registros, y cuánto tiempo puede acumular?** → **profesional.**
3. **1287 y el escape.** ¿`&quot;` satisface al validador o lo desescapa? → **profesional** (o una
   prueba contra el entorno de pruebas de la AEAT, que hoy no existe).
4. **Los 9 del bloque `SistemaInformatico`.** Requieren valores de configuración que no están en el
   repositorio. **¿Cuáles son, y quién los fija?**

---

## ⑤ LA DECISIÓN DE DISEÑO · «aceptado con errores», propuesta con costes

⛔ **No invento ningún estado (regla 27).** Lo que sigue son tres formas de representarlo; **cuál se
elige, y con qué nombres, es del fundador.**

**Lo único que la medición SÍ zanja:** el estado nuevo **no cabe en `vfEstado`**, porque ese campo
describe el sellado local (①). Mezclarlos daría una columna que responde a dos preguntas distintas,
y eso en esta casa se llama «dos sitios con el mismo hecho».

| opción | qué implica | coste |
| --- | --- | --- |
| **(a)** un campo **nuevo y aparte** para el resultado de la remisión, junto a los códigos devueltos | separa sellado de remisión; permite listar lo pendiente de subsanar | **cambio de esquema** → ALTER aditivo en las tres bases (regla 3 / A5), y estados nuevos → **decisión del fundador** |
| **(b)** una **entidad propia** de envío que guarde respuesta y códigos | modela que un registro se remite **varias veces** (subsanación) y conserva el historial, que es lo que 2xxx exige | más caro; es la `VfSubmission` que **hoy no existe** (medido: no está en `schema.prisma`) |
| **(c)** no representarlo hasta que haya envío | cero coste hoy | 🔴 **es la opción que el ticket existe para impedir**: quien construya ROAD-29 lo descubrirá al recibir el primer 2xxx |

**Recomendación:** **(b)**, y el motivo es de forma, no de gusto: **la subsanación no es un estado,
es un ciclo** —se remite, se acepta con errores, se corrige, se vuelve a remitir— y un campo
escalar pierde el historial de un registro que ya está sellado para siempre (regla 29). (a) es
más barata y sirve si sólo se quiere **ver** lo pendiente; deja de servir en cuanto haya que
**demostrar** qué se remitió y cuándo.

**Lo que hay que preguntar antes de construir cualquiera de las tres:** los nombres de los estados
(27), y si `Subsanacion` / `RechazoPrevio` se persisten como los declara el XSD o se traducen al
vocabulario de la casa. **Ninguna de las dos la decide una sesión.**

---

## 🔴 Mis errores, esta tanda

1. **Tercera vez hoy que una SUBCADENA me contesta otra pregunta, y van tres.** Busqué `deriva`
   para medir el 2004 y obtuve **224 ocurrencias** que eran casi todas «deriv**ado**», «deriv**adas**».
   Antes me pasó con el banco de SCRUM-773 (`includes` en vez de identidad) y con el censo de
   SCRUM-811b. **Ya no es un descuido: es un patrón mío**, y el antídoto que funciona es el que usé
   aquí después — `grep -w`, términos exactos, y contar por término. La cifra buena era **0**.
2. **Leí un código de salida que no era el que creía.** Escribí
   `grep … | head -10; echo "(exit=$?)"` y ese `$?` **era del `head`**, no del `grep`: imprimí
   `(exit=0)` sobre una salida vacía y estuve a punto de leerlo como «hay saneamiento». Es
   **literalmente la norma A3** —*el código de salida es el del último tramo de la tubería*— que yo
   misma cité esta mañana en dos entregas. Re-medido contando ocurrencias, salieron **27**, y ahí
   apareció `fiscalInput.ts:38`, que es la pieza central de ③.
3. **Casi cuento `1130` como «no se comprueba».** Su propio comentario dice *«y hoy no se valida en
   absoluto»* y lo iba a copiar. Ese *«hoy»* se refiere al **charset del resto del campo**, no al
   prefijo: `invalidPrefijoSerie` **sí tiene dos llamadores** (`schemas.ts:466`, `app.ts:970`).
   **Un comentario no es una medición** — ni siquiera un comentario honesto.

---

## Lo NO tocado

`src/` **entero** — cero líneas · el camino de emisión: **leído, no modificado** (regla 38) ·
`prisma/schema.prisma` — la opción (a)/(b) **se propone, no se prepara** · ningún estado ni flag
nuevo (27): los nombres los decide el fundador · **ningún texto de usuario** (26/30): aquí no hay
copy, y la pregunta del cliente se sigue respondiendo sólo con el guion H2 ·
`docs/legal/SEMAFORO_CALIBRACION.md` — leído y medido, **no editado** · `tests/` · Jira: SCRUM-524
**leído**, no modificado (sigue *En curso*).
**Producción y staging: no tocados, ni para mirar.**
