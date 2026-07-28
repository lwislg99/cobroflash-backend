# RUNBOOKS — YaQu

> Derivado de `docs/YAQU_MASTER.md` Parte O (única fuente de verdad). Formato fijo:
> **Síntoma → Dónde mirar → Acción → Qué decir al merchant → Prevención.**
> Si un incidente no encaja en ningún runbook: registrarlo en `docs/BUGS.md` y proponer
> el runbook nuevo como cambio de master.

---

## R1 · WhatsApp no llega

- **Síntoma:** el merchant dice que su cliente no recibió el presupuesto/factura por WhatsApp.
- **Dónde mirar:** logs de Railway (errores `[WhatsApp]`); en F2, `WhatsAppMessage.status`.
- **Acción:** código `131026` → el destinatario no tiene WhatsApp: no reintentar.
  `#132000`/`#132001` → bug de variables o de plantilla: **NO reintentar**, abrir issue en
  `docs/BUGS.md` (el guard J7 debería haberlo impedido). Mientras tanto: botón **Copiar enlace**.
- **Qué decir al merchant:** "Ese número no tiene WhatsApp (o el mensaje no salió). Copia el
  enlace del presupuesto y mándaselo por SMS o llámale."
- **Prevención:** validación J7 de variables antes de llamar a Meta; test
  `tests/whatsappTemplates.test.mjs` en verde antes de cada deploy.

## R2 · Plantilla rechazada o pausada por Meta

- **Síntoma:** los envíos de una plantilla empiezan a fallar; Meta la marca rechazada/pausada.
- **Dónde mirar:** WhatsApp Manager (estado de la plantilla) + logs de Railway.
- **Acción:** activar el fallback manual: mensaje completo prearmado para que el pro lo envíe
  desde su WhatsApp personal. Corregir y re-someter la plantilla en Meta (**acción del
  usuario/fundador**, ver `docs/WHATSAPP_TEMPLATES.md`). **No tocar nombres de plantilla en código.**
- **Qué decir al merchant:** "WhatsApp está revisando nuestra plantilla; mientras tanto te
  preparamos el mensaje para que lo mandes tú con un toque."
- **Prevención:** categoría Utility, cero marketing (J6); cambios de plantilla solo vía spec.

## R3 · Pago cobrado pero webhook perdido

- **Síntoma:** el cliente pagó con tarjeta pero el cobro sigue `pending` y la factura impagada.
- **Dónde mirar:** Dashboard de Stripe → buscar la Checkout Session por importe + fecha.
- **Acción:** si en Stripe está `paid`: marcar manualmente cobro + factura como pagados
  (auditado, `paid_via='card'`, anotar el event id de Stripe en la nota).
- **Qué decir al merchant:** "El pago está confirmado en la pasarela; ya lo hemos reflejado.
  No se cobró dos veces."
- **Prevención:** `scripts/reconcile-stripe.mjs` (F2) + idempotencia por `event.id`.

## R4 · Stripe Connect en estado `restricted`

- **Síntoma:** merchant con Connect activo deja de poder cobrar con tarjeta.
- **Dónde mirar:** webhook `account.updated` / Dashboard Stripe del conectado (`connectStatus`).
- **Acción:** banner "Stripe necesita un dato más" + link al onboarding de Connect; la opción
  tarjeta se desactiva sola y la landing vuelve a transferencia/Bizum. Avisar al merchant.
- **Qué decir al merchant:** "Stripe te pide un dato más para seguir procesando tarjetas
  (2 min). Mientras, tus clientes pueden pagarte por Bizum o transferencia."
- **Prevención:** monitorizar `account.updated`; checklist de readiness en Configuración.

## R5 · Bizum confirmado por error

- **Síntoma:** el pro confirmó "Bizum recibido" sin haberlo recibido.
- **Dónde mirar:** charge (`paid_via='bizum_manual'`) y si la factura asociada fue remitida al SIF.
- **Acción:** factura **NO remitida** al SIF → "Deshacer pago" (acción admin, auditada).
  Factura **remitida** → rectificativa **R1** + nueva factura si procede. **Nunca editar la emitida.**
- **Qué decir al merchant:** "Lo hemos deshecho/rectificado; la numeración queda correcta de
  cara a Hacienda. Confirma solo cuando veas el Bizum en tu banco."
- **Prevención:** doble confirmación en UI ("¿Has recibido X € de Y en tu Bizum?").

## R6 · Transferencia que no llega

- **Síntoma:** cobro por transferencia lleva días en `pending`.
- **Dónde mirar:** nada que arreglar en sistema: `pending` es el estado correcto por diseño.
- **Acción:** los recordatorios 7/14d actúan solos (J6). Botón para reenviar los datos
  (IBAN + referencia) con un toque. **No marcar pagado "por confianza".**
- **Qué decir al merchant:** "El cobro sigue pendiente; le hemos recordado al cliente los
  datos. Márcalo pagado solo cuando lo veas en tu cuenta."
- **Prevención:** referencia única por cobro (`CF-YYYYMMDD-XXXX`) para casarlo en el banco.

## R7 · SIF (AEAT) rechaza registros

- **Síntoma:** `VfSubmission` en `rejected`; la cola acumula intentos.
- **Dónde mirar:** `VfSubmission.lastError` + logs del módulo `fiscal/verifactu`.
- **Acción:** error de **dato de factura** → corregir vía R1 si está emitida. Error
  **estructural** (XSD/firma) → `SIF_ENABLED=false` + avisar al asesor; la emisión local
  sigue y la cola remite al reanudar. Documentar en `docs/VERIFACTU_EVIDENCIAS.md`.
- **Qué decir al merchant:** "Tus facturas siguen emitiéndose con normalidad; la remisión a
  la AEAT se reanuda en cuanto cerremos la incidencia técnica. No tienes que hacer nada."
- **Prevención:** validación contra XSD antes de enviar; retry con backoff; `manual_review`
  a partir de 5 intentos (Parte L).

## R8 · "Abrir PDF" falla

- **Síntoma:** el botón/enlace de PDF devuelve error o un documento vacío.
- **Dónde mirar:** la ruta on-demand regenera el PDF; si re-falla → log de `pdf.service`.
- **Acción:** reintentar por la ruta on-demand (regenera). Si persiste, issue con el id del
  documento. **Nunca enlazar `pdfUrl` crudo** (siempre la ruta que regenera).
- **Qué decir al merchant:** "Vuelve a abrirlo desde el botón del detalle; se regenera al
  momento. Si sigue fallando ya lo tenemos localizado."
- **Prevención:** QA de PDFs por release (quote firmado, factura, R1 negativa, watermark demo).

## R9 · Email no llega

- **Síntoma:** el cliente/merchant no recibe el email (PDF, confirmación...).
- **Dónde mirar:** dashboard de Resend → estado del envío (bounce/spam/etc.).
- **Acción:** bounce → verificar la dirección y reenviar. Problema de dominio → revisar DNS
  de `yaqu.app` (SPF/DKIM).
- **Qué decir al merchant:** "Revisa que el email del cliente esté bien escrito y mira su
  carpeta de spam; te lo reenviamos ya."
- **Prevención:** dominio verificado en Resend; emails transaccionales únicamente.

## R10 · Anular o rectificar una factura

- **Síntoma:** el merchant pide cambiar/borrar una factura emitida.
- **Dónde mirar:** la factura y su estado de remisión al SIF.
- **Acción:** importe/datos erróneos → **rectificativa R1** (serie propia). Duplicado total →
  **anulación** (post-SIF, con su registro de anulación). **Flujo único, sin ediciones ni
  borrados** (regla 29).
- **Qué decir al merchant:** "Una factura emitida no se puede editar (es lo que exige la
  normativa): hacemos una rectificativa que la corrige y queda todo trazado."
- **Prevención:** UI no ofrece editar/borrar emitidas; solo "Rectificar" / "Anular".

## R11 · El merchant pide sus datos o se da de baja

- **Síntoma:** solicitud RGPD de export o baja.
- **Dónde mirar:** módulo `exports`; Parte S4 del master (plazos y anonimización).
- **Acción:** entregar export en CSVs (+ zip de PDFs en F2) + XML RRSIF (post-SIF). Baja:
  clientes con facturas NO se borran → anonimizar según S4.
- **Qué decir al merchant:** "Te llevas todos tus datos en formatos estándar. Las facturas
  emitidas debemos conservarlas el plazo legal, anonimizando lo demás."
- **Prevención:** exports siempre disponibles (RGPD, incluido en todos los planes).

## R12 · Rollback de flags

- **Síntoma:** una feature recién activada causa un incidente.
- **Dónde mirar:** tabla de flags (Parte P) — cada flag tiene rollback seguro documentado.
- **Acción:** orden fijo: **apagar flag → verificar flujo legacy → comunicar**.
  `WHATSAPP_TEMPLATES_ENABLED` global solo se toca en incidente grave con Meta.
- **Qué decir al merchant:** "Hemos desactivado temporalmente esa función; todo lo demás
  sigue funcionando con normalidad."
- **Prevención:** cambios de flag global = stop condition (OK del fundador) + auditados.

## R13 · "Mi cliente tiene una inspección"

- **Síntoma:** un merchant (o su gestoría) pide documentación para una inspección de Hacienda.
- **Dónde mirar:** módulo exports (XML RRSIF) + facturas PDF + declaración responsable vigente.
- **Acción:** entregar: export XML RRSIF + facturas en PDF + declaración responsable +
  guía de 1 página del pack gestoría (S1-H).
- **Qué decir al merchant:** "Aquí tienes el paquete completo que entiende cualquier gestoría:
  registros oficiales, facturas y nuestra declaración responsable."
- **Prevención:** pack gestoría preparado y versionado por release (S1-E/S1-H).

## R16 · Fijar `INTERNAL_API_SECRET` a mano (más de una réplica)

- **Síntoma:** hay más de una réplica de la API detrás del balanceador — un self-call
  interno (webhooks de pago → `/webhooks/psp`, `invoiceWhatsApp` → `/charges`) podría
  aterrizar en una réplica con un secreto aleatorio distinto (`internalAuth.ts`
  genera uno **por proceso** si la env var no está puesta) y fallar con 404.
- **Dónde mirar:** `src/core/http/internalAuth.ts` — el guard solo exige
  `.length >= 16` **caracteres** si se fija a mano, no entropía real. El fallback
  automático sin la env var sí genera 256 bits reales (`crypto.randomBytes(32)`).
- **Acción:** fijar `INTERNAL_API_SECRET` en Railway (mismo valor en TODAS las
  réplicas) generándolo así, nunca a mano con una frase:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  Una frase legible de 16-20 caracteres pasa el check de longitud pero tiene
  muchísima menos entropía que el fallback automático — no la uses.
- **Prevención:** mientras haya una sola réplica, no fijar esta variable — el
  fallback aleatorio por-proceso ya es más fuerte que cualquier valor manual.

## R14 · Disputa de tarjeta (chargeback)

- **Síntoma:** webhook `charge.dispute.created` (Connect; los direct charges caen en la
  cuenta del MERCHANT).
- **Dónde mirar:** Dashboard Stripe de la cuenta conectada + el documento asociado al charge.
- **Acción:** aviso al pro por WA/BO + **paquete de evidencia en 1 clic**: presupuesto firmado,
  evidencia de aceptación (timestamp/IP/user-agent), factura y mensajes de entrega.
- **Qué decir al merchant:** "Tienes la firma digital del cliente y toda la traza: adjuntamos
  el paquete de evidencia a la disputa. Las firmas ganan disputas."
- **Prevención:** firma/aceptación con evidencia SIEMPRE antes de cobrar — y úsese como
  argumento de venta.

## R15 · Pago parcial o sobrepago (V4/V5 — A21.2, nada automático en F1)
**Señal:** al marcar una factura como pagada, el importe recibido NO coincide con el total
(el BO lo pregunta siempre); o el banco muestra un abono distinto al esperado.
1. NO la marques pagada. Al meter el importe real, el BO la deja **pendiente** y anota el
   evento en la ficha del cliente (⚠️ importe distinto — parcial o sobrepago).
2. **Parcial (V4):** habla con el cliente — o llega el resto (la factura sigue pendiente y
   los recordatorios siguen su curso) o pactáis ajustar: rectificativa R1 + factura nueva
   por el importe real (R10). JAMÁS "pagada" sin estar completa: el justificante miente.
3. **Sobrepago (V5):** devuelve la diferencia por el MISMO canal por el que llegó
   (transferencia/Bizum), guarda el resguardo, anota la devolución en las notas del
   cliente y ENTONCES márcala pagada con el importe exacto del total.
4. Entidad Refund automática = F2: no existe a propósito. Todo movimiento de vuelta es
   manual y con resguardo.


---

## R17 · El CI bloquea un merge (y cuándo es legítimo saltárselo)

- **Síntoma:** el check **CI / build + tests (sin gate)** sale en rojo en un PR y GitHub no
  deja pulsar "Merge". El fundador es el único que mergea, así que un CI atascado por causa
  ajena lo deja sin poder entregar NADA — de ahí este runbook.
- **Dónde mirar:** pestaña **Checks** del PR → job `build + tests (sin gate)`. El paso que
  falla ya dice de qué se trata: **`Compilar (tsc)`** = error de compilación;
  **`Tests sin gate`** = un test en rojo; **`npm ci`** = lockfile/registro.

### Primero: clasificar el rojo. Solo hay dos casos.

| | 🔴 **Rojo REAL** (el código está mal) | 🟠 **Rojo AJENO** (la infraestructura está mal) |
|---|---|---|
| **Cómo se ve** | Un assert con su mensaje, un `error TS`, un guard nombrando el fichero que lo rompe | `npm ci` con `ETIMEDOUT`/`ENOTFOUND`/503 del registro, el runner sin arrancar, timeout de 10 min sin salida de tests, incidencia abierta en githubstatus.com |
| **Se reproduce en local** | **SÍ** — `npm ci && npm run build && npm test` falla igual | **NO** — en local pasa entero y en verde |
| **Qué hacer** | **Arreglarlo.** Nunca se salta | Bypass, con las condiciones de abajo |

**La prueba que decide es siempre la misma: correr `npm ci && npm run build && npm test`
en local, sobre la rama del PR.** Si falla, es rojo real, y da igual lo rara que parezca la
causa. Si pasa entero, es rojo ajeno.

### Acción — bypass como admin del repo

Solo si el rojo es **AJENO** y verificado con la prueba de arriba:

1. En el PR, abajo del todo, GitHub ofrece al admin **"Merge without waiting for
   requirements to be met (bypass branch protections)"**. Ese es el escape. No hace falta
   desactivar la protección de rama: **jamás se toca la configuración para desatascar un
   merge** — se apaga para todos y se queda apagada.
2. **Escribe el motivo en el PR antes de mergear**, en un comentario: qué falló, por qué es
   ajeno, y que `npm test` pasa en local. Sin esa línea, dentro de dos semanas nadie sabe si
   aquel bypass fue legítimo.
3. **Vuelve a lanzar el CI después** (Checks → *Re-run all jobs*) cuando la causa externa se
   haya resuelto, para confirmar que `main` está de verdad en verde.

### Qué NO es motivo legítimo de bypass

- **"Es un test que no tiene que ver con mi cambio."** Es exactamente el caso de SCRUM-51 que
  originó todo esto: un guard cazando algo real que venía de otra rama. Que no sea *tuyo* no
  lo hace ajeno — hay que arreglarlo (o pedir que lo arreglen) antes de mergear encima.
- **"Corre con prisa."** El coste de `main` en rojo lo pagan todas las sesiones a la vez, y
  cada merge posterior hereda el fallo.
- **"Ya lo arreglo en el siguiente PR."** El siguiente PR se mergea sobre una `main` rota, y
  a partir de ahí ningún CI vuelve a dar información útil hasta que alguien lo limpie.
- **"El test está mal escrito."** Puede que sí — pero entonces se arregla el test en su PR,
  con su motivo. Saltárselo deja el test malo Y el hueco abierto.

### Qué decir al merchant

Nada: esto es interno, no afecta a producción. Un CI rojo impide desplegar código nuevo;
lo que ya está desplegado sigue funcionando.

### Prevención

- El CI corre también en **push a `main`**, no solo en PR: dos ramas verdes por separado
  pueden dar una `main` roja al mezclarse, y esa es justo la rotura que nadie ve venir.
- Si un guard nuevo va a romper ramas vivas (porque prohíbe algo que ya existe en ellas),
  avísalo al mergearlo — o esas ramas se enterarán al aterrizar, que es tarde.
- Un bypass repetido por la misma causa **no es un bypass: es un CI mal montado**. Dos veces
  seguidas por lo mismo → ticket para arreglarlo, no una tercera.

## R18 · Un cambio de schema no está aplicado hasta estar en las TRES BD (SCRUM-169)

**Síntoma:** tests gateados o `npm run dev` en rojo, o `P2022`, tras un cambio de schema que
"ya se aplicó". Costó 16 tests rojos y un lote entero de diagnóstico para acabar en "faltaba
un `db push`".

**Regla:** una columna nueva / `ALTER` NO está aplicada hasta estar en las TRES bases. El MISMO
mapa y el MISMO criterio están, verbatim, en la cabecera de `docs/MIGRATIONS_PENDING.md`; si
divergen en una palabra, el problema no está resuelto, solo movido.

Un cambio de schema NO está aplicado hasta estar en las TRES bases:

```
1. acela.proxy.rlwy.net / railway          — STAGING. Protegida por el máster: no se toca
                                             sin que el fundador lo sepa. Es la base del
                                             worktree cobroflash-b2.
2. acela.proxy.rlwy.net / yaqu_dev_javier  — DESARROLLO. El fundador dijo que NO requiere su
                                             GO para aplicarle schema. Base de cobroflash-b1.
3. autorack.proxy.rlwy.net                 — PRODUCCIÓN.
```

⚠️ Las dos primeras viven en el MISMO servidor (`acela`) y son bases DISTINTAS. Ninguna es
"local". Por eso pueden divergir de esquema sin que nada avise: `scripts/_db-guard.mjs` valida
el HOSTNAME, no la base, y el marcador `YAQU_STAGING` está en las dos. Las salvaguardas
garantizan "NO es producción", no "es la base que crees" — y eso es exactamente lo que produjo
los 16 rojos crípticos de SCRUM-160.

Fuente de los hostnames: `scripts/_db-guard.mjs` (`PROD_HOST` / `STAGING_HOST`), único sitio que
los define en el árbol.

Nomenclatura fijada por carril B el 27-jul-2026 con la regla de desempate del fundador. El
criterio para asignar el papel ha sido la AUTORIZACIÓN, no la ubicación ni el uso: las dos
primeras están en el mismo servidor y las dos las ejercitan tandas gateadas; lo que las
distingue es quién puede tocarlas. Se descarta llamar a `yaqu_dev_javier` "segunda BD de
staging" (SCRUM-84) porque implicaría el régimen de `railway` y no lo tiene. Si el fundador lo
ve de otra forma, es una línea.

**Prevención:** cada entrada de `docs/MIGRATIONS_PENDING.md` lleva las tres como checkbox; una
sin marcar = migración NO aplicada.

## R19 · Rotar la contraseña de la BD de PRODUCCIÓN (Railway)

- **Síntoma / cuándo se usa:** una credencial de producción se ha visto donde no debía (salida de un comando, log, pantallazo, chat, PR), alguien con acceso deja el proyecto, o toca rotación periódica. Nace del incidente **#14** de `ERRORES_ASESOR.md` (27-jul-2026): un script leyó `DATABASE_URL` sin quitarle las comillas del `.env`, `new URL()` lanzó, y el volcado del error publicó la URL de producción con su contraseña.
- **Regla de partida:** ante la duda, **se rota**. Una credencial que *quizá* se ha visto es una credencial comprometida. Rotar cuesta el corte que se describe abajo; no rotar cuesta la BD.

### ⚠️ Antes de nada: lo que este runbook NO puede saber por ti

Todo lo que sigue está verificado **contra el repo**. Hay tres cosas que solo se ven en el panel de Railway y que **cambian el procedimiento**, así que el Paso 0 existe para resolverlas:

1. Si el `DATABASE_URL` del servicio de la API es una **referencia** (`${{Postgres.DATABASE_URL}}`) o un **literal pegado a mano**. Decide si la rotación se propaga sola o hay que tocar N sitios.
2. Si hay **más servicios** (worker, cron, otro entorno) con su propia copia.
3. Si la API conecta por el **dominio privado** (`*.railway.internal`) o por el **proxy público** (`autorack.proxy.rlwy.net`). En el repo TODO apunta al proxy público (`scripts/_db-guard.mjs`), pero el runtime puede usar el privado — y entonces hay **dos** URLs con la misma contraseña.

### Paso 0 · Averiguar en cuál de los dos mundos estás (2 minutos, sin tocar nada)

Railway → proyecto → servicio **API** → pestaña *Variables*. Mira `DATABASE_URL`:

- **Mundo A — referencia** (se ve `${{Postgres.DATABASE_URL}}` o similar): la contraseña vive en **UN** sitio, el servicio Postgres, y todo lo demás se recompone solo. Es el caso bueno.
- **Mundo B — literal** (se ve `postgresql://postgres:…@…`): la contraseña está **copiada** en cada servicio que la tenga. Hay que enumerarlos TODOS antes de empezar; olvidar uno es el estado a medias C.

Haz lo mismo en cada servicio del proyecto. **Apunta la lista antes de tocar nada** — a mitad de rotación no es momento de descubrir un cuarto sitio.

### Inventario · Qué lleva la contraseña embebida

| Sitio | ¿Lleva la contraseña? | Quién lo actualiza |
|---|---|---|
| Servicio **Postgres** → `POSTGRES_PASSWORD` / `PGPASSWORD` | **SÍ** — es el origen | manual, Paso 4 |
| Postgres → `DATABASE_URL` y `DATABASE_PUBLIC_URL` | **SÍ**, pero **compuestas** por referencia | se regeneran solas al cambiar la de arriba |
| Servicio **API** → `DATABASE_URL` | Mundo A: no (referencia) · Mundo B: **SÍ** | Mundo B: manual |
| **`.env` local del fundador** | **SÍ** — CLAUDE.md regla 3: *`.env` apunta a PROD* | manual, Paso 5. **Se olvida siempre.** |
| `.env.local` | NO — es la BD de desarrollo | — |
| `DATABASE_URL_STAGING` | NO — es `acela`, otra BD | — |
| GitHub Actions | **NO** — decisión del fundador en SCRUM-161: no hay URL de BD en Actions | — |
| Backups de `scripts/backup-dump.mjs` | NO (contienen datos, no la URL) | — |

### El procedimiento

**Paso 1 · Genera la contraseña nueva, y que sea segura PARA UNA URL.**

```bash
# Solo [A-Za-z0-9]. A propósito: sin @ / : ? # %
node -e "console.log(require('crypto').randomBytes(24).toString('base64url').replace(/[-_]/g,''))"
```

> **Por qué el alfabeto restringido.** Un `@` o un `/` en la contraseña obliga a `%`-escaparla, y a partir de ahí cada parser (Prisma, libpq, `sed`, el shell) la trocea a su manera. `scripts/db-push-prod` extrae el host con un `sed` glotón: con un `@` en la contraseña **acierta el host por casualidad, no por diseño**. Este runbook nace de un fallo de parseo de URL — no metas otro.

**Paso 2 · Abre una sesión psql a producción y NO la cierres.** Es tu salida de emergencia: si el Paso 4 sale mal, esta sesión sigue autenticada y puede deshacerlo.

```bash
psql "$DATABASE_URL"     # con la URL VIEJA, que aún vale
# alternativas: Railway → Postgres → pestaña Data, o `railway connect Postgres`
```

**Paso 3 · Cambia la contraseña DENTRO de Postgres.**

```
\password postgres
```

> **`\password`, no `ALTER USER … WITH PASSWORD '…'`.** `\password` calcula el hash SCRAM **en el cliente**: la contraseña en claro no viaja por el cable ni puede acabar en `log_statement` ni en `pg_stat_activity`. El `ALTER USER` con literal sí. En un runbook que existe por una fuga, la diferencia importa.

⚠️ **Cambiar `POSTGRES_PASSWORD` en las variables de Railway NO cambia la contraseña.** La imagen de Postgres solo la lee al **inicializar** el volumen. En una BD que ya existe, esa variable es un rótulo: si la cambias sola, las URLs compuestas dicen una cosa y la BD sigue esperando otra. **Este es el error clásico y es el estado a medias B.**

**Paso 4 · Actualiza las variables de Railway, INMEDIATAMENTE después.** Aquí empieza la ventana.

- **Mundo A:** servicio Postgres → `POSTGRES_PASSWORD` (y `PGPASSWORD` si existe) → la nueva. `DATABASE_URL`/`DATABASE_PUBLIC_URL` se recomponen solas.
- **Mundo B:** además, cada servicio de tu lista del Paso 0, uno por uno.

Guardar una variable **dispara un redeploy** del servicio. Es lo que quieres: reinicia y coge la URL nueva.

**Paso 5 · El `.env` local.** Sustituye la línea `DATABASE_URL=…` por la nueva, **sin comillas alrededor**.

> `scripts/db-push-prod` quita la clave `DATABASE_URL=` con `sed` y **deja las comillas dentro del valor**. Con comillas, Prisma recibe una URL con comillas literales y falla. Y las comillas del `.env` son, literalmente, la causa raíz del incidente #14.

**Paso 6 · Verificación** (sección propia más abajo — no te saltes la parte del arranque en frío).

**Paso 7 · Cierra la sesión psql del Paso 2** solo cuando el Paso 6 esté en verde.

### Si te quedas a medias

**Estado A · Cambiada en Postgres, NO en las variables.** (Te interrumpen entre el Paso 3 y el Paso 4.)

- **Qué ves:** *nada, durante un rato.* Y eso es lo peligroso. Postgres autentica **al abrir la conexión**, no en cada consulta: el pool de Prisma que ya está abierto **sigue funcionando con la contraseña vieja**. La app responde, `/health` da `db: up`, y parece que no ha pasado nada. Revienta cuando el pool recicla una conexión ociosa, o al primer reinicio — o sea, **de madrugada y sin nadie mirando**.
- **Salida:** completa el Paso 4. Si no puedes (no tienes la nueva a mano), vuelve atrás desde la sesión del Paso 2 con `\password postgres` y la vieja.
- **Si ya cerraste la sesión y no tienes ninguna de las dos:** Railway → Postgres → pestaña *Data*. El panel no usa tus variables, así que sigue entrando cuando tú ya no puedes.

**Estado B · Cambiadas las variables, NO en Postgres.** (Cambiaste `POSTGRES_PASSWORD` creyendo que eso rotaba la contraseña.)

- **Qué ves:** fallo **inmediato y total**. El guardado dispara un redeploy, la app arranca con una URL que la BD rechaza, y todo lo que toque BD cae. En los logs de Railway: `P1000` (autenticación fallida) — no `P1001`, que sería no llegar al servidor. **Distinguirlos es el diagnóstico entero.**
- **Salida, por orden de preferencia:** ① revertir la variable al valor viejo (redeploy, servicio arriba, y vuelves a empezar con calma); ② si ya no tienes el valor viejo, entrar por Railway → Postgres → *Data* y hacer `\password postgres` poniendo la **nueva**, para que la BD se alinee con lo que ya dicen las variables.
- **Por eso el Paso 2 dice que no cierres la sesión, y por eso la contraseña vieja no se borra hasta que el Paso 6 está verde.** La salida de este estado necesita una de las dos.

**Estado C · Mundo B con un servicio olvidado.** La API va y el worker cae, o al revés. Mismo síntoma `P1000` pero **solo en un servicio** — de ahí que el Paso 0 pida la lista escrita.

### Cómo verificar que sigue conectando

**`/health` en verde NO demuestra que la credencial nueva funcione.** Está verificado en el código: `src/modules/system/app/routes/health.routes.ts` hace `SELECT 1` sobre el **cliente Prisma compartido** de `src/core/db/prisma.ts`, o sea sobre el pool que ya estaba abierto. Un proceso vivo con conexiones abiertas responde `db: up` con la credencial vieja. **Hay que forzar un arranque en frío.**

1. **Redeploy explícito** de la API en Railway (aunque el Paso 4 ya disparara uno: quieres uno que arranque *después* de todas las variables).
2. **Con el proceso recién arrancado**, y no antes:
   ```bash
   curl -s https://yaqu.app/health
   # esperado: {"ok":true,"service":"yaqu-backend","version":"…","db":"up"}
   ```
3. **Logs de Railway** durante el arranque: ni `P1000` ni `Authentication failed`.
4. **Una lectura real de extremo a extremo**, no solo el `SELECT 1`: entra al dashboard con `demo@yaqu.app` y abre una lista que consulte BD. `/health` prueba que hay conexión; esto prueba que la app funciona.
5. **La ruta que casi nadie prueba y es la que muerde luego:** el preview de `db push` desde local, que usa el `.env` del Paso 5.
   ```bash
   npx prisma migrate diff \
     --from-schema-datasource prisma/schema.prisma \
     --to-schema-datamodel prisma/schema.prisma --script
   ```
   Es **solo lectura**. Si falla con `P1013`, el `.env` tiene comillas (Paso 5). Si falla con `P1000`, la contraseña del `.env` no es la nueva.

### ¿Se puede sin downtime?

**Rotando la contraseña del MISMO rol, no.** Postgres no admite dos contraseñas simultáneas por rol (no hay equivalente al dual-password de MySQL 8). Entre el Paso 3 y el arranque en frío del Paso 6 hay una ventana en la que **toda conexión NUEVA falla**; las ya abiertas aguantan. En la práctica: **de 1 a 3 minutos**, y el impacto real depende de si algo arranca en frío justo ahí.

Para que la ventana sea lo más corta posible:
- Ten la contraseña generada y la lista de variables **antes** de empezar.
- Paso 3 y Paso 4 **seguidos**, sin pausa para el café.
- **No mergees nada a `main` durante la ventana**: Railway auto-despliega desde `main` y un deploy a mitad de rotación arranca en frío con las variables a medias — que es el estado A convertido en caída.
- Hazlo en hueco de tráfico bajo. No hay ventana de cero.

**Sí hay una vía sin corte, y no la recomiendo aquí:** crear un rol nuevo (`yaqu_app`) con su contraseña, apuntar `DATABASE_URL` a él, verificar, y retirar el viejo. Nunca hay una credencial inválida en uso. **El problema para YaQu:** las tablas las **posee** `postgres`, y `ALTER TABLE` exige propiedad, no `GRANT`. Un rol nuevo con todos los `GRANT` del mundo **haría fallar el siguiente `db push`** salvo que se le dé pertenencia al rol dueño (`GRANT postgres TO yaqu_app`) o se reasigne la propiedad (`REASSIGN OWNED`) — dos operaciones con más superficie de rotura que el corte de dos minutos que evitan. Cambiar el modelo de roles es un cambio de infraestructura por su cuenta, no un paso de un runbook de emergencia. Si algún día la app deja de hacer DDL en producción, esta vía pasa a ser la buena.

### Prevención

- **`parseBDSegura` / `redactarSecretos`** (`scripts/_db-guard.mjs`) y la regla **R7** de `ERRORES_ASESOR.md`: una credencial no se protege redactando mensajes, sino impidiendo que el error salga. Guard: `tests/scrum195-url-bd-sin-fuga.test.mjs`.
- **Un script que toca una BD importa `_db-guard.mjs`.** Nunca `new URL(dbUrl)` suelto, ni «solo para leer el host».
- **El scratchpad sigue siendo superficie descubierta** (fue donde ocurrió #14): ningún test del repo lo cubre. Ahí solo vale la disciplina — y este runbook, para cuando la disciplina falle otra vez.
- **Tras rotar:** borra la contraseña vieja de donde la anotaras. Y si la fuga fue a un log o a un PR, recuerda que **rotar no borra el registro**: la credencial deja de valer, pero el rastro sigue ahí.
