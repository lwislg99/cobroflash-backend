# SCRUM-1127 · SIF-1 · S1-D fase 1: el cliente de envío a la AEAT y su cola, sin certificado y sin tocar la emisión

**Medido contra:** `origin/main` = `bf4d82c68cc74c390af36f92c90cdb915e8c31e8` · 2026-09-25T17:46:51Z

Sesión J1 (`jv-j1`), encargo del orquestador de Javier (`jv-orquestador`), 25-sep-2026. Rama
`scrum-1127-cliente-envio-aeat`.

> ⚠️ **SUELO OBLIGATORIO. Esto prueba la FORMA del envío y el MANEJO de cada respuesta. NO prueba
> que la AEAT acepte nada.** Todo se ha probado contra un servidor falso local (`node:http`), nunca
> contra la AEAT y nunca con un certificado. Lo único que demuestra una aceptación es un CSV
> devuelto por la AEAT, y el único que tenemos es el de SCRUM-1110 (`A-KR84MFNPTPDHMN`), obtenido
> a mano por el fundador y no por este código.

## ⛔ Lo que esta entrega NO es

- **NO cierra S1-D.** Su criterio de cierre son ≥10 registros consecutivos aceptados de alta,
  anulación y R1. Hoy hay uno, solo de alta, y lo envió una persona.
- **NO está cableado.** Nada en `src/` llama al cliente. El test
  `nadie en src/ llama al cliente` lo comprueba sobre todos los `.ts` de `src/`. Cablearlo a
  facturas reales y persistir `vf_timestamp` es el camino de emisión (regla 40): es la fase 2 y
  necesita GO.
- **NO toca** `INVOICING_ES_ENABLED` ni `SIF_ENABLED`. Siguen en OFF.
- **NO habilita ningún claim fiscal.** Que exista un cliente no es que YaQu «cumpla con Hacienda».
- **NO toca `prisma/schema.prisma`.** `VfSubmission` queda como DDL PROPUESTO (§④), por A5 y por
  el hallazgo de §①.

## PASO 0 — medido por palabra, no por número

Sobre `origin/main` `9f6887236257bd7a3ce382bd6223a7edb8eed2c7` (17:31Z):

- `git grep` de `sif\.client|VfSubmission|TiempoEsperaEnvio|VerifactuSOAP|RegFactuSistemaFacturacion|EstadoEnvio`
  en `src/ scripts/ tests/ prisma/` da 18 ficheros. Ninguno es un cliente ni una cola: son el
  builder, los XSD, el guard de afirmaciones, el script manual de SCRUM-1110 y sus tests.
- `src/modules/fiscal/verifactu/` contiene `productor.ts`, `registro.builder.ts` y `xsd/`. Nada más.
- Ninguna rama `scrum-0*1127` en el remoto (control positivo: la rama `scrum-1063b-…` sí aparece),
  y ningún commit en `main` con `SCRUM-1127`.

El defecto («no hay cliente de envío») existe hoy y el alcance medido coincide con el encargo.

## ① 🔴 El hallazgo: un guard se desbloquea porque exista una TABLA

**La decisión está en manos del fundador (regla 39). Mientras no llegue, `model VfSubmission` NO
entra en el esquema.** Así lo ordenó el orquestador (17:40Z, confirmando la propuesta de J1).

`scripts/_guard-afirmacion-fiscal.mjs::envioConstruido()` (línea 199) decide si «el envío a la AEAT
existe». Basta con **una** de dos señales:

| señal | dónde | cuándo se enciende |
|---|---|---|
| ① `host-aeat` | líneas 158 y 179 | un `.ts` de `src/` nombra `aeat.es` o `agenciatributaria.gob.es` (y no es el QR, un espacio de nombres ni un comentario) **y** ese mismo fichero tiene una primitiva de red (`https.request(`, `new https.Agent`, `fetch(`…) |
| ② `cola` | línea 221 | `prisma/schema.prisma` contiene `model VfSubmission` |

Cuando `construido` es `true` pasan dos cosas:

1. **La familia B deja de bloquear** (líneas 127 y 138): frases como «ya está construida», «cumple»,
   «conforme», «validado por» o «registrado ante» la AEAT pasan a poder publicarse en la landing.
   La propia salida del guard lo dice (línea 264): `SI (familia B deja de bloquear)`.
2. **`tests/scrum537-afirmacion-falsa.test.mjs` se pone en ROJO** (línea 134:
   `assert.equal(h.construido, false`, «hoy el envio NO existe»). Por la regla 41, un guard en rojo
   se arregla en el código y nunca en el guard. Aquí eso no tiene salida, porque el código que lo
   dispara es justo lo que pide el ticket.

**Medido, no razonado.** Se llamó al guard en SOLO LECTURA, sin modificarlo, sobre dos raíces:

| raíz | `construido` | señales | «Nuestra facturación es conforme a la AEAT y ya está construida.» |
|---|---|---|---|
| el árbol de esta rama (con `sif.client.ts`) | `false` | `[]` | **bloqueada** |
| la misma `src/` + el esquema propuesto de §④ | **`true`** | `[{tipo:'cola', donde:'prisma/schema.prisma'}]` | **PASA** |

(`vistosAeat` = 5 en las dos: el detector ve la URL del QR y los espacios de nombres, así que no
está ciego.)

**El criterio confunde «las piezas existen» con «el envío funciona».** Con el PR ③ de A5 (esquema +
código + tests) la landing habría podido afirmar conformidad con la AEAT sin certificado, sin
cableado y con los flags en OFF. Eso choca con las reglas 7, 17, 24 y 26 a la vez, y entra por un
diff de esquema en el que nadie habría mirado la landing.

**Por qué la señal ① no salta hoy.** No se ha esquivado el guard. El ticket exige que los
endpoints salgan de la configuración y no se escriban a mano, así que el cliente no lleva ningún
host. Hay un efecto que quien decida tiene que saber: **la señal ① queda ciega para este cliente**.
El día que se cablee, el guard no lo verá por el host, porque el host vive en una variable de
Railway y no en `src/`. El criterio nuevo tendrá que medir otra cosa. Dos ejemplos para decidir
(ninguno se ha implementado):

- que haya un **llamante del cliente** en el camino de emisión;
- que ese llamante **y** `SIF_ENABLED` en ON coincidan.

## ② Qué se construye

| fichero | qué es |
|---|---|
| `src/modules/fiscal/verifactu/sif.client.ts` | envía UN sobre SOAP 1.1 y devuelve un resultado tipado. Sin dependencias nuevas. No lanza excepciones. |
| `src/modules/fiscal/verifactu/sif.cola.ts` | lo que decide la cola, en funciones puras: trocear, esperar, backoff y qué pasa con cada registro. Sin base y sin red. |
| `tests/scrum1127-sif-client.test.mjs` | 23 casos contra un servidor falso `node:http` en `127.0.0.1` |
| `tests/scrum1127-sif-cola.test.mjs` | 7 casos de la lógica pura |
| `docs/SIF_SPEC_NOTES.md` §6 | la cabecera «`sif.client.ts` NO EXISTE» ya era falsa: ahora dice «existe, no está cableado» |

### Cuatro resultados, no tres, y no se mezclan

El encargo pedía separar «no pude enviar», «enviado y rechazado» y «enviado y aceptado». Al medir,
**«no pude enviar» son dos cosas distintas**, y confundirlas es el mismo error:

| `tipo` | significa | la AEAT… | qué hace la cola |
|---|---|---|---|
| `no_enviado` | el sobre no llegó entero: configuración, DNS, conexión, TLS o escritura cortada | **no lo tiene** | reintenta con backoff |
| `sin_respuesta` | el sobre salió entero y no sabemos qué pasó: timeout esperando o leyendo, conexión cortada, respuesta que no es XML o que no se reconoce | **puede tenerlo** | reenvía los mismos registros (FAQ de la AEAT). El duplicado lo detecta ella. |
| `rechazado` | `SOAP Fault` o `EstadoEnvio` `Incorrecto` | no lo registró | `rejected`, para una persona |
| `respondido` | `Correcto` o `ParcialmenteCorrecto` | se lee **línea a línea** | según cada línea |

🔴 **Por qué `no_enviado` y `sin_respuesta` NO se pueden fundir en uno**, aunque la cola reintente
los dos. Es la decisión de este diseño que alguien querrá «simplificar», así que va explícita:

- En `no_enviado` la AEAT **no tiene** el registro. Reintentarlo es enviarlo por primera vez.
- En `sin_respuesta` la AEAT **puede tenerlo ya**. Lo que se reenvía tiene que ser **el mismo
  registro, byte a byte**: el `registroXml` guardado, nunca uno regenerado (§④). La respuesta a ese
  reenvío puede ser un `RegistroDuplicado`, y la cola lo lee por el estado del que la AEAT ya tiene:
  `Correcta` es aceptado, no un error.
- Si las dos cosas fueran una, una de dos. O se trataría el reenvío como un envío nuevo (se
  regenera el registro, cambia la huella o la hora de generación, y **la AEAT recibe dos registros
  distintos de la misma factura**). O se trataría el duplicado como un rechazo, y un registro ya
  aceptado acabaría en manos de una persona como si hubiera fallado.
- Y en la traza no sabrías si Hacienda tiene el registro o no, que es lo primero que hay que poder
  contestar ante una incidencia.

Nada sale como «aceptado» por defecto. Todo lo que no encaja con el XSD `RespuestaSuministro` cae en
`sin_respuesta`: un `EstadoEnvio` desconocido, un `TiempoEsperaEnvio` ausente, una línea sin
estado, un `Correcto` global con una línea `Incorrecto` o un XML válido con HTTP de error.

### Timeout por etapa, y el error nombra la etapa

Etapas: `preparar → conectar → tls → enviar → esperar_respuesta → leer_respuesta → interpretar`.
Cada una tiene su reloj (`TIMEOUTS_POR_DEFECTO`: 10 s / 10 s / 30 s / 60 s / 30 s). El motivo sale
como `timeout_<n>ms` **con la etapa al lado**. Así, «no conecta», «se cuelga en el TLS», «no
contesta» y «empieza a contestar y no acaba» se leen distinto, y los cuatro tienen su test.

### La traza se escribe YA

Hay un evento por etapa **al entrar en ella**, una línea JSON a `stderr` (inyectable). Nada se
acumula para el final. El test `NO RESPONDE` lo mide: con un límite de 400 ms, el evento
`esperar_respuesta` tiene que haber llegado antes de esos 400 ms.

Lo que **nunca** va en la traza:

- las opciones TLS (llegan opacas);
- la URL con usuario, clave o query (esos endpoints se rechazan antes de usarse);
- el mensaje de un error de carga de clave (solo su código).

Hay un test que pasa una clave y una contraseña y busca las dos en toda la traza.

### Dos defectos que salieron al medir, ya corregidos

- **Una clave TLS que no se puede cargar hacía lanzar a `https.request` de forma síncrona.** La
  promesa se rechazaba y se saltaba los cuatro resultados, justo el `catch` perezoso que había que
  evitar. Ahora sale como `no_enviado · tls · opciones_tls_invalidas:<código>`.
- **Al cortar por tamaño, el `end` de la respuesta llegaba igual** y la etapa acababa en
  `interpretar · no_es_xml`. Ahora el corte cierra en el acto con su propio motivo.

## ③ Decisiones tomadas aquí (se declaran para que se puedan revisar)

- **Un registro `rejected` NO se reintenta solo.** La FSM de `SIF_SPEC_NOTES` §6 dice
  `rejected → pending(retry)`. Reenviar el mismo contenido da el mismo rechazo, y corregirlo es una
  subsanación: un registro nuevo, que es camino de emisión (fase 2), o una persona. Solo se
  reintenta lo que no sabemos si llegó. **Los estados son los cinco de la FSM, ninguno nuevo.**
- `AceptadoConErrores` → `accepted` con el código en `lastError`, `subsanar: true` y
  `requierePersona: true`.
- **Duplicado:** manda el estado del que la AEAT ya tiene. `Correcta` → `accepted`;
  `AceptadaConErrores` → `accepted` + subsanar; `Anulada` → `manual_review`.
- **Un registro enviado que no aparece en la respuesta NO está aceptado**, aunque el global diga
  `Correcto`: vuelve a `pending`. El alta y la anulación de la misma factura son registros distintos
  (la clave incluye `TipoOperacion`).
- **Un registro que se quedó en `sent`** (el proceso murió con el sobre en vuelo) vuelve a `pending`
  como `sin_respuesta`. Nunca se da por aceptado.
- **Backoff:** 60 · 120 · 240 · 480…, con techo de 30 min. `manual_review` al 5º intento.
  **Espera entre envíos:** `max(60, TiempoEsperaEnvio)`.
- **Troceo:** ≤ `MAX_REGISTROS_POR_ENVIO` (1.000), importado del builder. No hay una segunda copia
  del número.
- **Sin `fast-xml-parser`.** `SIF_SPEC_NOTES` §6 lo preveía como la única dependencia nueva, y una
  dependencia nueva la decide el fundador (A7). La respuesta se lee con un lector propio acotado a
  los elementos del XSD.
- **`http:` solo hacia loopback.** Hacia fuera, solo `https:`. Sin endpoint, no se envía.
- **[VALIDAR]** `SOAPAction: ""`. SOAP 1.1 lo exige presente. El envío de SCRUM-1110 se hizo desde
  el formulario web de la AEAT, no desde este cliente, así que el valor no está probado contra ella.

## ④ DDL de `VfSubmission`, con las tres decisiones del fundador: NO aplicado, NO en el esquema

> **Actualizado el 25-sep-2026 (SCRUM-1127b).** El fundador contestó las tres preguntas que dejaba
> abiertas la primera versión («las tres como recomiendas», transmitido por el orquestador de
> Javier). Este apartado **sustituye** al DDL anterior; ese ya no vale.
>
> ⛔ `model VfSubmission` **no entra en `prisma/schema.prisma`** hasta que se cumplan las DOS cosas:
> SCRUM-1128 mergeado Y el ALTER aplicado por Javier en las tres bases (A5).

### Las tres decisiones

1. **`TiempoEsperaEnvio` → POR OBLIGADO.** La AEAT lo impone a quien envía. Uno global acabaría
   siendo el máximo de todos, y se esperaría de más para todos por culpa de uno. Vive en una tabla
   propia, `vf_flujo_obligado`, con clave el **NIF del obligado**, que es la unidad con la que
   cuenta la AEAT (`ObligadoEmision`), y no el `merchantId`:
   - si YaQu remite como colaborador social o con el certificado de cada comercio, la AEAT sigue
     contando por NIF;
   - dos comercios con el mismo NIF comparten la espera, porque la AEAT también se la aplica a los dos.

   `vf_submissions` lleva también `obligado_nif`, para que la cola elija lo siguiente por obligado
   (índice `obligado_nif, status`).
2. **El estado → `enum` `VfSubmissionStatus`.** Tiene exactamente los cinco estados de la FSM:
   `pending`, `sent`, `accepted`, `rejected` y `manual_review`. Son los mismos, y en el mismo orden,
   que `ESTADOS_VF_SUBMISSION` de `sif.cola.ts`, y hay un test que los fija. Un estado nuevo costará
   un ALTER, y ese coste se paga a gusto: con registros fiscales, un estado mal escrito es peor.
   `tipo_operacion` y `estado_registro` siguen en `TEXT`: son valores que **escribe la AEAT**
   (`Alta`/`Anulacion`, `Correcto`/…), y si no se reconocen el cliente ya los rechaza antes
   (`interpretarRespuesta`).
3. **Borrar un comercio con envíos → IMPEDIRLO** (`ON DELETE RESTRICT`), igual hacia `invoices`.
   Son registros presentados ante la AEAT: borrar al titular dejaría envíos huérfanos de los que
   nadie responde (regla 29).

### El modelo

Además, dos campos de vuelta, `vfSubmissions VfSubmission[]`, en `Invoice` y `Merchant`. Solo son de
Prisma y no producen DDL en esas tablas.

```prisma
enum VfSubmissionStatus {
  pending
  sent
  accepted
  rejected
  manual_review
}

model VfSubmission {
  id              Int                @id @default(autoincrement())
  merchantId      Int                @map("merchant_id")
  invoiceId       Int                @map("invoice_id")
  obligadoNif     String             @map("obligado_nif")
  tipoOperacion   String             @map("tipo_operacion")
  registroXml     String             @map("registro_xml")
  status          VfSubmissionStatus @default(pending)
  attempts        Int                @default(0)
  lastError       String?            @map("last_error")
  nextAttemptAt   DateTime?          @map("next_attempt_at")
  lastSentAt      DateTime?          @map("last_sent_at")
  lastEnvioId     String?            @map("last_envio_id")
  csv             String?
  estadoRegistro  String?            @map("estado_registro")
  subsanar        Boolean            @default(false)
  createdAt       DateTime           @default(now()) @map("created_at")
  updatedAt       DateTime           @updatedAt @map("updated_at")

  merchant Merchant @relation(fields: [merchantId], references: [id], onDelete: Restrict)
  invoice  Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Restrict)

  @@index([status, nextAttemptAt])
  @@index([obligadoNif, status])
  @@index([merchantId])
  @@index([invoiceId])
  @@map("vf_submissions")
}

model VfFlujoObligado {
  obligadoNif         String    @id @map("obligado_nif")
  tiempoEsperaEnvioS  Int?      @map("tiempo_espera_envio_s")
  siguienteEnvioDesde DateTime? @map("siguiente_envio_desde")
  ultimoEnvioId       String?   @map("ultimo_envio_id")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  @@map("vf_flujo_obligado")
}
```

### El SQL

Generado con `previewMigracion({ schema, desde })` del propio `scripts/preview-migracion.mjs`,
sobre una **copia** del esquema fuera del árbol. Resultados:

- control positivo `ok` (33 `CREATE TABLE`), clase `con_cambios`;
- **0 sentencias destructivas**;
- `prisma/schema.prisma` intacto: el mismo sha256 (`b48b89356478c052…`) antes y después.

```sql
-- CreateEnum
CREATE TYPE "VfSubmissionStatus" AS ENUM ('pending', 'sent', 'accepted', 'rejected', 'manual_review');

-- CreateTable
CREATE TABLE "vf_submissions" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "obligado_nif" TEXT NOT NULL,
    "tipo_operacion" TEXT NOT NULL,
    "registro_xml" TEXT NOT NULL,
    "status" "VfSubmissionStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "next_attempt_at" TIMESTAMP(3),
    "last_sent_at" TIMESTAMP(3),
    "last_envio_id" TEXT,
    "csv" TEXT,
    "estado_registro" TEXT,
    "subsanar" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vf_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vf_flujo_obligado" (
    "obligado_nif" TEXT NOT NULL,
    "tiempo_espera_envio_s" INTEGER,
    "siguiente_envio_desde" TIMESTAMP(3),
    "ultimo_envio_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vf_flujo_obligado_pkey" PRIMARY KEY ("obligado_nif")
);

-- CreateIndex
CREATE INDEX "vf_submissions_status_next_attempt_at_idx" ON "vf_submissions"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "vf_submissions_obligado_nif_status_idx" ON "vf_submissions"("obligado_nif", "status");

-- CreateIndex
CREATE INDEX "vf_submissions_merchant_id_idx" ON "vf_submissions"("merchant_id");

-- CreateIndex
CREATE INDEX "vf_submissions_invoice_id_idx" ON "vf_submissions"("invoice_id");

-- AddForeignKey
ALTER TABLE "vf_submissions" ADD CONSTRAINT "vf_submissions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vf_submissions" ADD CONSTRAINT "vf_submissions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

### Por qué cada campo que no estaba en `{invoiceId, status, attempts, lastError}`

- **`merchantId`**: regla dura 2 (multi-tenant). La cola se consulta por comercio.
- **`obligadoNif`**: el flujo de control es por obligado (decisión 1). Se copia en la fila **al
  encolar**, del registro ya sellado. Así, si después cambia el NIF del comercio, un registro ya
  presentado no cambia de obligado.
- **`tipoOperacion`**: el alta y la anulación de la misma factura son dos registros.
- 🔴 **`registroXml`**: el registro **tal como se selló**. Reenviar «los mismos registros» (FAQ de la
  AEAT) obliga a guardarlos. Si se regeneraran al reenviar, se recalcularía algo ya sellado, que es
  la trampa de `puesto-j1.md`: «un documento firmado cuyo contenido se recalcula al exportarlo no
  está firmado».
- **`nextAttemptAt`, `lastSentAt`, `lastEnvioId`**: el backoff, y enlazar una fila con su línea de
  traza.
- **`csv`, `estadoRegistro`, `subsanar`**: lo que contestó la AEAT.
- **Sin `UNIQUE (invoice_id, tipo_operacion)`**: una subsanación es otra alta de la misma factura.
- **`vf_flujo_obligado` sin clave ajena a `merchants`**: la clave es el NIF, que la AEAT reconoce.
  Varios comercios pueden compartirlo, y una fila de espera no es un registro fiscal que haya que
  retener.

## ⑤ Verificado en rojo: 4 mutaciones sobre `dist/`, las 4 caen

Base sin mutar: `exit 0`, `fail 0`. Cada mutación se aplicó al JS compilado y se restauró después.

| mutación | fallos |
|---|---|
| M1 · todo fallo de red cuenta como `no_enviado` (se pierde `sin_respuesta`) | 5 |
| M2 · un `EstadoEnvio` desconocido se da por bueno | 1 |
| M3 · un registro sin línea en la respuesta cuenta como `accepted` | 1 |
| M4 · se quita la coherencia «`Correcto` global con una línea `Incorrecto`» | 1 |

Después de la pasada, `git status` solo mostraba los ficheros nuevos, y el sha256 de los dos `.js`
coincidía con el del build.

## ⑥ Tests

- Los dos ficheros nuevos, sueltos: **30 casos · 30 pass · 0 fail** (23 + 7).
- `npm test` entero: **8.369 tests · 8.233 pass · 2 fail · 134 skipped** (sobre la rama ya fusionada con `bf4d82c6`). Los dos rojos:
  - `804b` es ajeno: el estado de 1107, ya declarado en el traspaso de J1.
  - `835` («ninguna credencial en el historial») era mío. La clave inventada del test llevaba una cabecera PEM y el escáner la cazó en el commit LOCAL. Ese commit no llegó a empujarse: se cambió la clave por `CLAVE-FALSA-DE-PRUEBA-…` y se rehízo el commit. `scrum835` + los dos tests nuevos, sueltos después del arreglo: **49 tests · 49 pass · 0 fail** (`scrum835`, `scrum267` y los dos nuevos, sobre el commit ya rehecho).
  - En la primera pasada cayeron además `237` (una negación sin respaldo en mi test) y `694` (un filtro de comentarios hecho a mano en mi test). Los dos se arreglaron con lo que ya existe (`tests/_solo-codigo.mjs` y un hermano del token), y el control de URL se comprobó en rojo con `soloCodigo`. `910d` (libuv) cayó en la primera pasada y no en la segunda: es intermitente y ajeno.

## ⑦ Lo que queda (fase 2 y lo que no es de J1)

- **La decisión de §①.** Hasta que llegue, el esquema no lleva `VfSubmission`.
- **El ALTER de §④.** Lo aplica Javier en las tres bases. Después va el PR de esquema + persistencia.
- **Cablear** el cliente y la cola a la emisión, y persistir `vf_timestamp`: **STOP**, regla 40,
  con GO expreso.
- **La custodia del certificado** y el `https.Agent`/`pfx` reales: no son de ninguna sesión.
- **Probar contra la AEAT** los ≥10 registros de alta, anulación y R1 que cierran S1-D: los hace
  una persona con el certificado.
- La skill `yaqu-verifactu-sif` y la Parte L del máster siguen diciendo «NO CONSTRUIDO» sobre el
  envío. Hoy sigue siendo cierto, porque no hay envío que funcione. Cuando se cablee habrá que
  revisarlas, y son derivados del máster (regla 35): esa revisión no es de esta rama.
