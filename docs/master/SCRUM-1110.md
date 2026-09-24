# SCRUM-1110 · S1-0 hecho, y un sobre SOAP para preguntarle a la AEAT antes de construir S1-D

**Medido contra:** `origin/main` = `158a37908b5647a3006cd21cd85ac8abaec38e8d` · 2026-09-23T19:24:26Z

24-sep-2026 · Lo construye **el orquestador** (A13) por instrucción expresa del fundador
(*«No, no, dale caña tú»*), con **las seis sesiones cerradas** y el lanzador incapaz de
arrancar ninguna.

## 🟢 S1-0 está HECHO — lo que bloqueaba tres de las ocho desde junio

El fundador **tiene certificado FNMT válido y ha entrado** en `preportal.aeat.es` →
VERI\*FACTU → «Cliente de servicio web».

**Y se descubrió que no hacía falta ningún alta:** ese portal **no tiene formulario de
registro**. Se entra con certificado, y los candados de sus enlaces son exactamente eso. El
máster lo describía como *«alta entorno pruebas AEAT»*, lo que hacía pensar en un trámite
que no existe.

## Por qué este script existe, y por qué ANTES de S1-D

Esa pantalla es un **invocador manual de servicios web**: fichero, endpoint, enviar.

🔴 **Hasta hoy, la única forma de saber si la AEAT ACEPTA nuestros registros era construir
S1-D entero** —cliente, cola `VfSubmission`, reintentos, backoff— y probar al final.

**El XSD dice que la FORMA es correcta. No dice que la AEAT lo acepte.** Son dos preguntas
distintas, y **la segunda no se la habíamos hecho nunca**. Con este fichero se responde por
un registro suelto, a mano, antes de invertir una semana.

## 🔴 La precondición que decide si la prueba mide algo

La AEAT autentica por **mTLS con el certificado del navegador**. Si el registro declara un
`ObligadoEmision` **distinto del titular del certificado**, rechaza **por autorización** — y
**ese rechazo no dice nada sobre nuestro XML**.

**Medido:** `gen-registros-sample.mjs` usa `B12345678`, un NIF inventado, y
`PRODUCTOR DEMO SL` como productor. Sirve para validar contra el XSD; **no para enviar.**

Por eso el script **exige `--nif` y `--nombre` y falla cerrado sin ellos**. Un valor por
defecto sería la forma más fácil de acabar enviando el NIF de muestra y **no entender el
rechazo**.

## 🔴 El hallazgo que justifica haber validado antes de subir

**La primera versión no envolvía el registro en `<sum:RegistroFactura>`.** El validador
oficial (.NET contra los XSD vendorizados) contestó:

> *«El elemento 'RegFactuSistemaFacturacion' … tiene un elemento secundario 'RegistroAlta' …
> **no válido**. Lista esperada de elementos posibles: **'RegistroFactura'**»*

**Si eso llega a subirse, el rechazo de la AEAT habría parecido un problema del registro y
era del sobre** — y habríamos ido a revisar el builder, que estaba bien.

Corregido **copiando la forma de `gen-registros-sample.mjs`** —la que ya valida— en vez de
deducirla, y con un control propio (`registroEnvuelto`) para que no se pierda otra vez.

**Después:** `VALIDO … conforme a SuministroLR.xsd + SuministroInformacion.xsd`.

## Los diez controles, que abortan sin escribir un byte

| control | qué impide |
|---|---|
| `nifEnObligado` · `nifEnEmisor` | que el NIF no sea el del certificado |
| 🔴 `sinNifDeMuestra` | que se cuele `B12345678` y el rechazo sea de autorización |
| `productorReal` | que viaje `PRODUCTOR DEMO SL` en vez del de SCRUM-870 |
| `unSoloRegistro` · `sinAnulacion` | que el sobre traiga más de lo que se quiere preguntar |
| `registroEnvuelto` | el defecto de arriba, que el XSD ya cazó una vez |
| `sinFirma` | meter XAdES, que en modalidad VERI\*FACTU **no se exige** (S1-0b) |
| `sobreCerrado` · `cuerpoDentro` | un sobre mal formado |

## ⛔ Lo que NO hace, a propósito

- ⛔ **No toca `src/`.** Importa los builders ya auditados en S1-A. Leer el camino de emisión
  no es STOP (regla 38); **modificarlo sí lo es** (regla 40).
- ⛔ **No firma.**
- ⛔ **No envía, no toca la red, no lee ni pide certificados.** El envío lo hace una persona
  desde su navegador. El certificado **no pasa por ninguna sesión ni por el repositorio**.
- ⛔ **Un solo registro.** Cuanto menos haya en el sobre, más claro será de qué se queja.

## Suelo

**Validado contra el XSD. NO probado contra la AEAT** — este script no envía. **La respuesta
del servidor es el dato que falta**, y es lo único que puede contestar la pregunta que este
ticket viene a hacer.

⚠️ **Sobre SOAP 1.1.** Si la AEAT respondiera con un fallo de **versión**, el primer sitio
donde mirar es el WSDL citado en `SIF_SPEC_NOTES.md` §Fuentes — **no el contenido del
registro**.

## Y el techo, para que nadie invierta de más

Con el **certificado personal** se llega a **S1-D entero**. **No más allá**: la producción
(S1-G) necesita el Convenio 017, que exige **sociedad mercantil** — la SL, en marcha
(SCRUM-143).

## Dos cosas del proceso que se apuntan porque salieron mal

1. **La rama se nombró `scrum-1110-…` ANTES de crear el ticket.** Salió 1110 **por suerte**.
   La norma —crear primero y citar el número que devuelve la herramienta— existe precisamente
   porque este Jira lo comparten dos equipos y el siguiente número no es predecible.
2. **`npm run build` es sólo `tsc`, sin `prisma generate`.** En un worktree que reutiliza
   `node_modules` de otro árbol, el cliente de Prisma puede ser **anterior al último ALTER** y
   la compilación falla por campos que sí existen en el esquema (aquí,
   `retencionPracticadaTipo` de SCRUM-1103). No es un defecto de `main` —`npm ci` regenera—
   pero **sí una trampa de esa forma de montar el árbol**.

---

# APÉNDICE · 24-sep-2026 · La AEAT ACEPTA el registro — `Correcto`, sin errores

**Medido contra:** `origin/main` = `902d11e6c546cdb4ce9bc8cce8b780acaab3b1f6` · 2026-09-24T13:42:02Z

🟢 **`EstadoEnvio: Correcto` · `EstadoRegistro: Correcto` · sin `CodigoErrorRegistro`.**
**CSV `A-KR84MFNPTPDHMN`**, 15:49:07+02:00. Factura `PRUEBA-AEAT-700841`, obligado
`05292751Z`, operación **Alta**.

**Es el primer registro VeriFactu de YaQu aceptado por la AEAT.**

## Los siete envíos — y ninguno falló por un defecto del código

Cada respuesta quitó un error **y no trajo otro del mismo tipo**. Eso es lo que separa una
cadena de progreso de dar palos de ciego:

| # | respuesta de la AEAT | qué era de verdad |
|---|---|---|
| 1-2 | `4138` petición vacía | 🔴 **el fichero no se estaba adjuntando.** Las dos primeras pruebas **no midieron nada** |
| 3 | `1207` error interno (`Id. 131766580`) | el formulario espera el **sobre SOAP**, no el registro pelado |
| 4 | `1239` NIF no identificado en el censo | **NIF de destinatario inventado** (`12345678Z`) |
| 5 | `2004` la fecha debe ser la actual ±**240 s** | **sello escrito a mano** (junio) |
| 6 | `2007` no debe informarse como primer registro | 🔴 **la cadena funcionando**: los envíos anteriores ya existían |
| **7** | **`Correcto`** | — |

🔴 **Lo de los dos primeros envíos lo destapó el fundador**, no una comprobación nuestra:
*«lo que no sé es si estoy abriendo el fichero como toca»*. Sin esa frase habríamos seguido
buscando el defecto en el XML. **La señal estaba en su duda, no en los datos.**

## Lo que queda demostrado CONTRA LA AEAT, no contra un XSD

**Ésta era la pregunta del ticket.** El XSD decía que la forma era correcta; **no decía que la
AEAT lo aceptara**. Ahora lo dice la AEAT:

el **sobre SOAP** · la **huella SHA-256** · el **encadenamiento** · el bloque
`SistemaInformatico` con el productor de SCRUM-870 · el **desglose** y los **importes** · el
tipo de factura **F1**.

## Cierra un `[VALIDAR]` abierto desde junio

`SIF_SPEC_NOTES.md` §4 tenía el flujo de control de **240 s** marcado `[VALIDAR]`, tomado de
una fuente **secundaria**. Lo confirma la **fuente primaria**, literal del código 2004:

> *«El valor del campo FechaHoraHusoGenRegistro debe ser la fecha actual del sistema de la
> AEAT, admitiéndose un margen de error de: **240 segundos**.»*

## Los dos defectos propios, corregidos por el camino

1. 🔴 **El huso calculado a mano daba `+00:00`** en septiembre — **dos horas en el futuro** para
   la AEAT. Habría repetido el 2004 y nos habría hecho pensar que el arreglo no servía, cuando
   el error habría sido otro. Ahora sale de `Intl` con `longOffset`, que ya trae el DST.
2. **El registro sin envolver en `<sum:RegistroFactura>`**, cazado por el validador XSD **antes**
   de enviarlo. Si llega a subirse, el rechazo habría parecido del registro y era del sobre.

## El encadenamiento, ahora automático

El script guarda el último registro en `tmp/ultimo-registro.json` **después** de que pasen los
controles —si el sobre no sale, la cadena no avanza— y el siguiente envío apunta a él. Sin
fichero previo se declara primer registro; con él, encadena.

## ⛔ Lo que esto NO cierra

- ⛔ **NO cierra S1-D.** Su criterio son **≥10 registros consecutivos aceptados**, de **alta,
  anulación y R1**. Esto es **uno, y sólo de alta**. Falta además el cliente automatizado con su
  cola `VfSubmission`. **Lo que se cierra es la incógnita**: construir S1-D ya no es apostar.
- ⛔ **NO cierra S1-G.** Eso es **producción**, y necesita el Convenio 017 → la **SL**
  (SCRUM-143).
- ⛔ Sigue sin haber ninguna «certificación» que ofrecer, y **siguen prohibidos los claims**
  (reglas 7, 17, 24, 26). Que la AEAT acepte un registro de pruebas **no es** que YaQu
  «cumpla con Hacienda».

## Evidencia — los CSV no se pueden reconstruir

| envío | CSV | estado |
|---|---|---|
| 5 | `A-RRC3W7HBRRATXM` | AceptadoConErrores (2004) |
| 6 | `A-RWSKNNRGRBNNS9` | AceptadoConErrores (2007) |
| **7** | **`A-KR84MFNPTPDHMN`** | **Correcto** |

## Y una tercera cosa del proceso que salió mal

**Este PR entró en rojo por el guard de SCRUM-854** — *«esta rama, si toca código, trae su
entrada de registro»*. Tenía razón: el expediente se fue a `main` con el **primer** empujón, y
el segundo llevaba **sólo código**. El guard no se relajó (A7): **se escribió este apéndice**,
que además hacía falta igualmente porque el documento describía el estado **anterior** a la
prueba.
