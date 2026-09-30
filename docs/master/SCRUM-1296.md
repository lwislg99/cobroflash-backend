# SCRUM-1296 · SIF-1 fase 2: cablear el envío a la AEAT con la emisión — el GO del fundador

**Medido contra:** `origin/main` = `f662a15e6ecab8d360b7b1acd625bbdb9a70c4ce` · 2026-09-29T17:57:55Z
(orquestador del equipo de Javier, `cobroflash-backend-47`)

## 0 · Por qué este fichero entra ANTES que el código

Este registro no documenta un cambio de código: **existe para que el permiso del fundador esté en un
sitio que una sesión de fondo pueda leer.**

Hoy, 29-sep-2026, tres sesiones del equipo (J1, J2 y J5) **no han podido abrir Jira**: el conector de
Atlassian pide una autenticación interactiva que una sesión en segundo plano no completa. Y cuando le
pedí a J1 que copiara ella misma el literal del GO a `docs/master/`, **su clasificador de seguridad lo
bloqueó**, con razón: un permiso que le llega por un mensaje entre sesiones es, para ella, una
instrucción de fuera que no puede verificar de primera mano.

Las dos cosas son correctas y juntas dejaban el ticket sin camino. La salida es ésta: **lo escribe
quien puede abrir el comentario** —el orquestador o el fundador— y la sesión lo lee del repositorio,
versionado y con historial, que es la misma base sobre la que ya se fía de `CLAUDE.md` y del máster.

🔴 **Regla que queda, y que no es de este ticket:** la copia literal de un GO en `docs/master/` **no la
hace nunca la sesión que lo recibe por mensaje**. La hace el orquestador o el fundador.

## 1 · El GO del fundador, literal

**Se le presentó con la medición delante** (la tabla del §2: todo construido menos el cableado).

> **Pregunta que se le hizo:**
> «SCRUM-1296 (cablear VeriFactu a la emisión) tiene tu GO y ninguna sesión asignada. ¿Lo arranco?»
> — y antes, al presentarle el hueco: si daba GO para cablear el envío con la emisión.
>
> **Javier, 29-sep-2026, respuesta literal: «GO sí».**
> Y al preguntarle si lo arrancaba: **«4-Arranca».**

⚠️ **Corrección que va con el GO, para que nadie lo lea mal:** este GO se escribió primero en
**SCRUM-1127, comentario 17585**, que es **el ticket equivocado** — su título dice literalmente «SIN
tocar el camino de emisión». El GO es válido; el sitio era éste. Ya está corregido en los dos
tickets. **Si alguien presenta SCRUM-1127 como autorización para cablear, está mal.**

## 2 · Qué autoriza

✅ **Que emitir una factura ENCOLE un envío a la AEAT.**

El estado medido, que es lo que se le puso delante:

| Pieza | Estado |
| --- | --- |
| Construir el registro con formato AEAT (huella + QR) | ✅ |
| Hablar con la AEAT | ✅ dos sondas aceptadas, CSV `A-SAQQXM7MXBDX3L` (27-sep) y `A-ALQ5VMP5QV7QLQ` (28-sep) |
| Sobres de alta, anulación y R1 | ✅ SCRUM-1140 |
| Cliente y cola (`sif.client.ts`, `sif.cola.ts`) | ✅ SCRUM-1127 |
| El 302 «sin certificado», ejecutado contra la AEAT real | ✅ SCRUM-1228 |
| 🔴 **Que emitir ENCOLE** | ❌ **nada** |

`git grep` de `sif.client` / `enviarAlaAEAT` sobre `src/modules/invoicing/**` → **cero**. El registro de
la fase 1 lo dice con sus palabras: «**NO está cableado.** Nada en `src/` llama al cliente».

## 3 · Qué NO cubre este GO

- ⛔ **El SELLADO no se toca.** La huella encadenada y el QR no cambian. Emitir sigue emitiendo lo
  mismo; lo que se añade es que **además se encole**.
- ⛔ **Una factura emitida no se edita ni se reintenta a mano** (regla 29). Los reintentos son de la cola.
- ⛔ **Esto NO enciende la emisión en España.** `INVOICING_ES_ENABLED` sigue en **OFF** y el GO no lo
  toca (regla 24). Se construye el camino, **no se abre la puerta**.
- ⛔ **El certificado no entra en ninguna sesión.** Lo que no se pueda probar sin él **se declara como
  no probado** (SCRUM-1225 midió cómo).
- ⛔ **Ningún texto de usuario nuevo sin firma** (regla 39).
- ⛔ **`db push` no**, contra ninguna base. El esquema va por ALTER previo en las tres (orden A5).

## 4 · Las tres condiciones de aceptación

🔴 **① Si el envío falla, la factura queda emitida igual.** El sellado no puede depender de que la
AEAT responda. **Con un test:** envío que revienta → factura sellada igual.

🔴 **② El aprendizaje de SCRUM-1228 no se pierde al cablear.** Allí se midió que un 302 «sin
certificado» se trataba como «sin respuesta» y **se reintentaba 4 veces como si fuera la red**. La cola
no puede reintentar lo que no se debe reintentar.

🔴 **③ El rojo primero.** Que hoy emitir **no** encola nada se prueba **antes** de arreglarlo. Sin eso
no hay forma de saber que el cambio hizo algo.

## 5 · Estado al escribir este fichero

| Paso | Quién | Estado |
| --- | --- | --- |
| ① El rojo visto | J1 | ✅ pero **NO en el árbol**: 4 pass y 1 fail («0 escrituras en `vfSubmission` tras sellar»), en un commit que vive sólo en el árbol de trabajo de J1. Sin empujar a propósito, porque el check obligatorio saldría rojo. **Su ruta no se escribe aquí** — ver §7 |
| ② El DDL de la cola | J1 | ✅ sacado **offline**, 0 DROP · 0 RENAME · 0 destructivas. sha256 del SQL `289f2a13c564f09b7e490483179068c7b58b600296990b2c0d0c54a51871242f` |
| ② El ALTER aplicado en las tres bases | **Javier** | ⏳ pendiente |
| ③ El cableado | J1 | ⏳ bloqueado por ② y por este fichero |

⚠️ **`vf_timestamp` NO lleva ALTER**: la columna `invoices.vf_timestamp` ya está en el esquema desde
SCRUM-145. Lo que falta es **escribirla** al cablear, no crearla. (Medido por J1; corrige lo que este
ticket daba por pendiente.)

## 6 · Lo que no hay que repetir

- **SCRUM-1110 está HECHO** (script `sobre-soap-prueba-aeat.mjs`, y la AEAT respondió «Correcto»),
  aunque su estado en Jira dijera otra cosa.
- `docs/SIF_SPEC_NOTES.md` §6 dice hoy «existe, no está cableado». **Al cablear, esa frase cambia.**

## 7 · Por qué no se escribe la ruta del test del rojo

El guard `scrum391` tumbó la primera versión de este fichero, y con razón: declaraba la ruta de
un test que **no está en el árbol**. Su mensaje es la regla:

> «UNA CONSTANCIA NO ESCRIBE LA RUTA DE UN FICHERO QUE NO EXISTE, ni siquiera para explicar por qué
> no existe. El motivo se escribe NOMBRANDO LO QUE SÍ EXISTE —el test que hoy cubre aquello—, no la
> ruta del que se fue.»

Y el motivo que da es el bueno: **la ausencia de un guard y su verde son indistinguibles desde
fuera**, y encima retiran la desconfianza que los habría sustituido. Un fichero que declara una ruta
que no existe hace creer vigilado algo que nadie vigila.

🔴 **Aquí no hay nada que nombre en su lugar: hoy NADIE comprueba que emitir encole.** Ése es el
hueco entero de este ticket. La comprobación se declarará en este mismo fichero **cuando el test
entre en el árbol**, en el PR del cableado, y no antes.

⚠️ **Y un riesgo que queda dicho:** ese commit vive sólo en un árbol de trabajo local. Si el árbol se
poda, se pierde. Quien retome el ticket lo mira **antes** de escribir el test de cero.

## 8 · Tanda 1 — la cola entra en el esquema (J1, 30-sep-2026)

**Medido contra:** `origin/main` = `21c7163d04c8a117df995f3f945cf6f04c53bc99` · 2026-09-30T21:22:00Z
A9: comprobación → `tests/scrum1296-esquema-cola.test.mjs`

El fallo que esa línea convierte en comprobación: SCRUM-1127b dejó escrito que los cinco estados
del enum eran «los mismos, y en el mismo orden, que `ESTADOS_VF_SUBMISSION`, y hay un test que los
fija». El test fijaba sólo la mitad TS; el enum no estaba en el esquema y nadie lo comparaba. Ahora
se comparan, y también los nombres de tabla y columna y el `onDelete: Restrict`.

**Qué entra.** `enum VfSubmissionStatus`, `model VfSubmission` y `model VfFlujoObligado` en
`prisma/schema.prisma`, más los dos campos de vuelta (`vfSubmissions`) en `Invoice` y `Merchant`,
que no producen DDL. Es el modelo de SCRUM-1127 §④ sin cambiar nada.

**El DDL, medido.** `node scripts/preview-migracion.mjs --desde <esquema de origin/main>`: control
positivo `ok` (33 tablas), **aditiva**, y el SQL es **idéntico línea a línea** al de SCRUM-1127 §④
(diff vacío salvo líneas en blanco). El ALTER ya estaba aplicado en staging y producción: lo midió
el fundador con una consulta de solo lectura en las dos (17 + 5 columnas, el enum con sus 5
etiquetas en orden, 2 claves ajenas, 5 + 1 índices, huellas iguales entre las dos bases), y el
orquestador con un preview de solo lectura contra staging que proponía `DROP` de esos objetos con
el esquema de `main`: un `DROP` sólo se propone de lo que existe. Esta sesión **no** corrió el
preview contra staging: su árbol no tiene la clave, y no se buscó en otro. **Dev no está medido**;
no bloquea, porque el CI monta su banco desde el esquema.

⚠️ **Lo que no está verificado:** el TIPO de cada columna una a una en las bases. Las huellas prueban
que staging y producción coinciden entre sí y los recuentos cuadran con el DDL.

**La landing no se desbloquea (regla 26), medido.** `envioConstruido()` sobre este árbol con el
modelo dentro: `construido: false`, `señales: [cola]` (ve la tabla), `llamantes: []`,
`SIF_ENABLED` leído y en OFF. El criterio de SCRUM-1128 exige llamante del envío **y** el flag en
ON. `scrum537` y `scrum1128` en verde. El último caso del test nuevo lo deja fijado.

**El test, interrogado.** Base: 5 de 5 en verde. Tres mutaciones del esquema, las tres en rojo:
orden del enum cambiado, `onDelete: Cascade` en una relación y un `@map` de columna mal escrito.
Restauración comprobada por sha256 del esquema, no por un `finally`.

**Texto que cambia porque dejó de ser cierto:** la cabecera de `sif.cola.ts` («NO HAY TABLA») y dos
frases de `docs/SIF_SPEC_NOTES.md` («no está en el esquema»). Lo que queda en §6 («existe, no está
cableado») sigue siendo cierto hasta la tanda 2 y se cambia allí.

⚠️ **Quedan diciendo «no está en el esquema», y no se tocan aquí:** la skill `yaqu-verifactu-sif`
(derivada del máster, regla 35) y `docs/legal/AUDITORIA_CAMINO_EMISION.md` (eslabón 8). Los dos los
decide su dueño; se entregan como aviso al orquestador.

**Decisiones del orquestador para la tanda 2, que constan aquí para no parecer un olvido:**
- **D2 = X.** El procesador de la cola recibe el envío INYECTADO: no importa `enviarSobre` ni se
  engancha a un cron, y aplica `decidirTrasEnvio` tal cual, sin segunda política de reintentos.
  El guard de SCRUM-1128 queda intacto, y el día que se enganche de verdad lo verá.
- **D1 al fundador.** El único constructor del `RegistroAlta` es un closure dentro de
  `buildVerifactuRegistrosXml`: sacarlo para reutilizarlo es modificar el camino de emisión
  (regla 38), y eso no lo cubre el GO de §1. La recomendación es extraerlo sin cambiar ni un
  byte de la exportación (sha256 antes y después sobre los 7 casos de SCRUM-240).
- **Una factura que la exportación EXCLUYE** (p. ej. cliente sin NIF, con
  `MODO_SIN_DESTINATARIO = SIN_DICTAMEN`) no tiene registro que encolar: queda sellada igual y
  deja constancia en la auditoría.

**Borrar un comercio y «Eliminar datos de ejemplo» con la cola dentro (D3 y D3b del orquestador).**
`vfSubmission` tiene `merchantId`, así que los guards de cobertura (SCRUM-172/192/314) exigen
decidir qué hace con ella el borrado. Lo decidió el orquestador, porque cumple la decisión 3 de
1127b en vez de tomar una nueva:
- **D3 = F.** `vfSubmission` va en `FUERA_DEL_BARRIDO_GENERICO` (`borradoMerchant.ts`), con el
  motivo dentro de la lista: RESTRICT, registros presentados ante la AEAT, un comercio con envíos
  no se borra y el borrado falla ruidoso en `invoice`.
- **D3b = F1.** `barridoDemo` NO consulta `FUERA_DEL_BARRIDO_GENERICO`: recorre
  `COLGADOS_DE_CHARGE`, `ORDEN_BORRADO_MERCHANT` y `botSession`. Esa asimetría entre las dos
  listas es la que obligó a un paso propio, acotado al demo (`where: { merchantId: demoId }`),
  antes de las facturas. Quien añada otro modelo «fuera» tropezará con lo mismo; va como aviso
  al orquestador, no se arregla en este ticket.
- ⚠️ **Consecuencia declarada:** ese paso **hoy no borra nada** (la tabla está vacía en todas
  partes) y, si la tanda 2 cierra que el demo no encola, no borrará nunca: sólo protege el
  botón. Si algún día cuenta filas, es que el demo empezó a encolar.
- **Efecto, no forma.** El control de `scrum314` mira la FORMA del `where` sobre un espía que no
  filtra. El test nuevo mira el EFECTO sobre una cola con filas de dos comercios: las del demo
  caen, las del otro no. Mutación del `where` a `{}` en `dist/`: caen los dos casos nuevos y el
  control de `scrum314`; restaurado por sha256.

**GO de D1 leído en origen:** SCRUM-1296, comentario 17641 (Javier, 30-sep-2026: «5-Go»), abierto
por esta sesión en Jira. Autoriza extraer `construirRegistro` con sha256 antes y después sobre los
7 casos de SCRUM-240; si uno difiere, se para. Es para la tanda 2.

**La tanda completa**, antes de añadir el paso F1: 9.234 tests · 9.098 pass · 2 fail · 134
skipped. Los 2 eran los de `scrum314`, que F1 cierra.
Tras F1, rebasada sobre `d65cfaa9`: **9.239 tests · 9.105 pass · 0 fail · 134 skipped**.
Rebasada después sobre el `origin/main` del ancla, que sólo trajo SCRUM-1106 (docs y su test, disjuntos de esta rama): se corrieron ese test, los de esta rama y los guards de registro, no la tanda entera.

## 9 · Tanda 2 — emitir encola (J1, 30-sep-2026)

**Medido contra:** `origin/main` = `8084f273fe0bc30bfe5b7e893605eb34b56d9bae` · 2026-09-30T21:34:53Z
A9: comprobación → `tests/scrum1296-procesador-cola.test.mjs`

El fallo que esa línea convierte en comprobación es el de SCRUM-1228: un 302 «sin certificado» se
trataba como «sin respuesta» y se reintentaba como si fuera la red. El test cuenta las llamadas al
envío a lo largo de seis vueltas y exige UNA; la mutación que reintroduce aquel defecto lo tumba.

### Las firmas que cubren esta tanda, leídas en su origen por esta sesión

- **§1 de este fichero**: el GO de cablear («que emitir ENCOLE»).
- **SCRUM-1296, comentario 17641** (Javier, 30-sep-2026: «5-Go»): D1, extraer `construirRegistro`
  con sha256 antes y después sobre los 7 casos de SCRUM-240.
- **SCRUM-1296, comentario 17642** (Javier, 30-sep-2026: «1-Firmo»): D4, la acción de auditoría
  `encolado_fallido` con `meta { numero, motivo: 'excluida' | 'error', errorMensaje,
  tipoOperacion: 'Alta' }`. Levanta la regla 5 para esa acción y ninguna más.
- **D2 = X**, del orquestador: el procesador recibe el envío inyectado; no se importa `enviarSobre`.

### Qué se construye

| pieza | dónde |
|---|---|
| El constructor del registro, fuera del closure (D1) | `construirRegistro` en `verifactu.service.ts`, con el MISMO nombre que tenía de closure |
| El registro de alta de UNA factura sellada | `registroParaRemision` (mismo fichero) |
| Encolar tras sellar, sin lanzar nunca | `src/modules/invoicing/domain/encolarRemision.ts` |
| La llamada, DESPUÉS del `try` del sellado | `sellarTrasEmision` (`selladoEstado.ts`) |
| El procesador de un obligado | `src/modules/fiscal/verifactu/sif.procesador.ts` |
| La acción firmada | `encolado_fallido` en `audit.service.ts` |

**D1, medido.** El cuerpo del closure se MOVIÓ: sha256 del texto igual antes y después, con su
sangría original porque las plantillas la llevan dentro del XML. Salida de
`buildVerifactuRegistrosXml` sobre los 7 casos (una, dos, anulación, exclusión, todo excluido,
rectificativa, sin destinatario): **idéntica en los 7**. Control: `TipoHuella` 01→02 en `dist/`
cambia 5 de 7; los 2 que devuelven `xml: ''` no llegan al registro, igual que en el control de
SCRUM-240. El arnés no se queda en el repo; lo permanente son los tests del XML, en verde.

**`registroParaRemision` no tiene el tope de 1.000.** Lee sólo el eslabón anterior de ESA factura,
no el ejercicio: el constructor sólo consulta `porHuella` por `vfPrevHash`, y `registrosOrdenados`
sólo lo usa la anulación, que al emitir no existe.

**Las tres condiciones de aceptación:**
- **① El sellado no depende de la cola.** Encolar va fuera del `try` del sellado: la factura ya es
  `sellado` antes de esa línea. Test: la escritura en la cola revienta → `sellado`, huella escrita,
  sin `sellado_fallido` y con UNA constancia `encolado_fallido` (motivo `error`). Y en el
  procesador: un envío que revienta no toca ningún otro modelo; las filas se quedan `sent` y, pasados
  `SENT_INTERRUMPIDO_TRAS_MS`, `recuperarEnviadoSinCierre` las devuelve a `pending` con el intento
  contado.
- **② Una sola política de reintentos.** El procesador llama a `decidirTrasEnvio` tal cual y aplica
  lo que devuelve. Test: 302 → `manual_review` con UNA llamada en seis vueltas; control: «sin
  respuesta» se reintenta exactamente `MAX_INTENTOS` veces.
- **③ El rojo primero**: el commit del rojo va delante del cableado en esta rama; el doble del test
  pasó a recordar lo que escribe el sellado (la cola lee la factura ya sellada) y sus aserciones
  no cambiaron.

**El demo no encola, medido.** `scripts/seed-demo.mjs:228-230` da al demo `country: 'ES'` y NIF, así
que sin la exclusión SÍ entraría en la cadena y encolaría. Se reconoce con `isDemoMerchant` (el
criterio que ya usan el PDF y `payCard`), por `invoice.merchantId` y el email. No es un fallo: sin
constancia. **Por eso el `deleteMany` de la cola en `barridoDemo` (§8, F1) no borra nunca nada**:
es un conjunto vacío siempre. Si algún día cuenta filas, el demo empezó a encolar.

**Una factura EXCLUIDA** (p. ej. cliente sin NIF con `MODO_SIN_DESTINATARIO = SIN_DICTAMEN`): queda
sellada, sin fila, y con `encolado_fallido` (motivo `excluida`).

**Interrogado.** Seis mutaciones sobre `dist/`, las seis en rojo: no encolar (4 fallos), encolar
relanza (2), el demo encola (1), el 302 como red (1), ignorar el `TiempoEsperaEnvio` (2), sin pausa
por `SIF_ENABLED` (1). Los tres `.js` restaurados, comprobado por sha256.

### Lo que NO está probado, y por qué

- **Que la AEAT acepte nada.** Sin certificado no hay envío; los tests usan un envío inyectado. Sólo
  un CSV devuelto por la AEAT lo demostraría (SCRUM-1225).
- **El enganche**: nadie llama al procesador ni a `enviarSobre`. Cuando se haga, el guard de
  afirmaciones fiscales (SCRUM-1128) verá el llamante, que es su trabajo; con `SIF_ENABLED` en OFF
  seguirá diciendo «no construido».
- **El alcance en producción hoy**: `INVOICING_ES_ENABLED` está en OFF y, según midió el orquestador,
  `AUTO_INVOICE_ON_PAID` no existe en Railway, así que el flag vale `false`. El camino que encola
  existe; en producción hoy no se recorre solo.

### Lo que queda diciendo otra cosa (avisado al orquestador, no se toca aquí)

- `docs/legal/AUDITORIA_CAMINO_EMISION.md` fila 7: «su destino es una DESCARGA». Desde esta tanda, el
  mismo constructor alimenta también la cola. Fila 8: «NO EXISTE». El texto es del dueño del documento.
- La skill `yaqu-verifactu-sif` («NO CONSTRUIDO · FSM `VfSubmission`», «`SIF_ENABLED` no pausa
  ninguna cola»): derivada del máster (reglas 35 y 36).

**Rojos de guard en la primera tanda completa, los seis míos y arreglados en el código:**
- `scrum524b` (34 casos): su catálogo ancla las comprobaciones a `dentroDe: 'construirRegistro'`, el
  nombre del closure. Yo lo había sacado como `construirRegistroFactura` dejando un envoltorio
  `construirRegistro` de una línea, y el guard dejó de ver lo que vigila. Arreglo: la función extraída
  se llama `construirRegistro` y el envoltorio desaparece. Los 7 sha256 se re-midieron DESPUÉS de
  ese cambio: idénticos.
- `scrum860`: cuatro lecturas del procesador sin `select`; ahora nombran sus columnas.
- `scrum411`: `construirRegistro` y la constante del tipo de operación eran exports sin llamador
  fuera de su fichero; dejan de exportarse.
- `scrum1185`: `procesarObligado` se declara SIN CONSUMIR con su motivo (D2 = X), y
  `decidirTrasEnvio` y `recuperarEnviadoSinCierre` pasan a `retiradas`: ya las consume el procesador.
- `scrum409`: el caso del demo usaba el id 1 a mano; ahora importa `DEMO_MERCHANT_ID`.
- Las seis mutaciones se re-pasaron sobre el `dist/` final: las seis siguen en rojo.
