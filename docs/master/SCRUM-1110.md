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
