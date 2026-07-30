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

**El TURNO de una de esas bases (SCRUM-188).** Que dos sesiones no la usen a la vez ya no
depende de que nos acordemos: `npm run test:staging:gated` **toma el turno** al arrancar, lo
escribe en el propio marcador de la base (`YAQU_STAGING lock:<dueño>@<ISO>`) y lo suelta al
acabar. Si lo encuentra tomado **no arranca** (exit 5) y dice quién lo tiene y desde cuándo.
Caduca solo a los 45 min, así que una sesión muerta no bloquea a nadie. Para liberarlo a mano
—**solo si sabes que la otra sesión está muerta**—:
`DATABASE_URL="<url de esa base>" node scripts/marcar-staging.mjs`. Detalle en
`docs/QA/SUITE_REGRESION.md` § «El TURNO de staging».

**CONSULTAR y TOMAR el turno sin lanzar una tanda (SCRUM-232).** Hasta aquí solo estaba escrito
cómo LIBERARLO: tomarlo lo hacía únicamente el runner gateado, así que sostenerlo durante
cualquier otra operación contra staging —un `npm install` en el árbol compartido, una semilla,
una conciliación— obligaba a improvisar un script cada vez. Ya no:

```bash
npm run turno:estado     # quién lo tiene, QUÉ está corriendo y cuánto le queda. Solo lectura.
npm run turno:tomar      # lo toma para lo que vayas a hacer (--ref <rama> --minutos <N>)
npm run turno:soltar     # lo suelta (recuerda tu marca; --marca "<marca>" si se perdió la nota)
```

`turno:estado` es el que evita la conducta peligrosa: quien llega y lo ve ocupado puede **saber
si le compensa esperar** en vez de elegir entre esperar a ciegas o romper el lock. Desde
SCRUM-232 el rechazo del runner dice también qué está corriendo y cuánto le queda de verdad —
que **no es el TTL**: el TTL dice cuándo caduca el turno (1h 10min), no cuánto tarda la tanda
(~27 min). Si la otra sesión corre código anterior a SCRUM-232, sale «NO CONSTA» y el mensaje
degrada al de siempre.

> Estos comandos leen `DATABASE_URL_STAGING` del `.env`, y `.env` está en `.gitignore`: **solo
> existe en el checkout principal, no en los worktrees**. Desde un worktree, ejecútalos con el
> cwd del checkout principal (`cd <principal> && node ../<worktree>/scripts/turno-staging.mjs
> estado`). Nunca pases la URL por línea de órdenes (regla 9).

**Ninguno de los tres rompe un lock ajeno**, a propósito: para eso está `marcar-staging.mjs`, y
solo sabiendo que la otra sesión está muerta.

> **Si MATAS la tanda, el turno se queda TOMADO (SCRUM-207, 29-jul-2026).** Lo suelta al
> *acabar*, no al morir: un `kill` se salta ese paso. Síntoma: la siguiente tanda no arranca
> (exit 5) y nombra a un dueño que ya no existe. Se comprueba leyendo el marcador
> (`shobj_description(oid,'pg_database')` → `YAQU_STAGING lock:…`) y se suelta con
> `marcar-staging.mjs`, que lo reescribe limpio. O se esperan los 45 min. **No es un fallo
> del lock:** caducar solo es justo lo que impide que una sesión muerta bloquee al equipo.
>
> **CÓMO SABER SI SIGUE VIVA, que es de donde salió todo lo anterior.** Dos trampas, y las dos
> hacen que una tanda SANA parezca colgada:
>
> · **`| tail` no muestra nada hasta el final.** `tail` buferea la tubería entera, así que
>   ~11 min de silencio son indistinguibles de un cuelgue. **Escribe a fichero y lee el
>   fichero:** `npm run test:staging > /tmp/tanda.log 2>&1`, y sigues con `tail -f`.
>
> · **`ps -ef` en Git Bash NO VE los procesos de la tanda.** Solo muestra su propio árbol de
>   sesión, así que da 0 procesos mientras el runner y sus hijos corren tan tranquilos. Es la
>   trampa peor de las dos, porque la respuesta parece un dato objetivo. **Míralo con lo que sí
>   ve todo Windows:**
>   `powershell -c "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ft ProcessId,CommandLine"`
>   o `tasklist //FI "PID eq <pid>"`. El PID del runner es además el dueño del turno
>   (`lock:<host>.<pid>@…`): si ese PID vive, la tanda vive y **el turno no se toca**.
>
> Aprendido ejecutando, y en este orden: se leyó mal el silencio del `tail`, se confirmó el
> «cuelgue» con un `ps -ef` que era ciego, se mató una tanda que iba perfectamente — y ese
> `kill` fue lo que dejó el turno tomado. Los tres párrafos de este aviso son **el mismo
> incidente**, y el error de fondo no fue esperar poco: fue tratar «no veo nada» como «no hay
> nada».

Nomenclatura fijada por carril B el 27-jul-2026 con la regla de desempate del fundador. El
criterio para asignar el papel ha sido la AUTORIZACIÓN, no la ubicación ni el uso: las dos
primeras están en el mismo servidor y las dos las ejercitan tandas gateadas; lo que las
distingue es quién puede tocarlas. Se descarta llamar a `yaqu_dev_javier` "segunda BD de
staging" (SCRUM-84) porque implicaría el régimen de `railway` y no lo tiene. Si el fundador lo
ve de otra forma, es una línea.

**EL DIFF PUEDE PEDIR UN `DROP`, Y ENTONCES EL QUE VA ATRASADO ERES TÚ (SCRUM-207, 29-jul-2026).**
`migrate diff` compara la BD contra **tu** `schema.prisma`, no contra `main`. Si tu árbol es
viejo y la BD ya tiene el cambio, el preview propone **borrarlo** — y `db push` **no pide
`--accept-data-loss` para tirar un índice**, así que ahí el guard no te frena. Antes de aplicar
nada: `git pull` y repetir el preview. **Un `DROP` inesperado en un preview casi nunca significa
«sobra en la BD»; significa «falta en mi árbol».**

> **Medido el día que apareció:** el índice `audit_log_merchant_id_entity_type_entity_id_idx` se
> aplicó a staging **antes** de que su PR se mergeara, así que durante esa ventana la BD iba por
> DELANTE de todos los árboles. Censo de entonces: **78 de 79 worktrees** no lo declaraban —
> incluido el checkout principal, 15 commits por detrás— y cualquiera de ellos veía
> `DROP INDEX` en su preview. **La ventana la abre aplicar schema a una BD compartida mientras
> la declaración vive solo en una rama sin mergear:** mergea primero, o dilo en voz alta.
>
> ⚠️ **Y al censar, mira DENTRO del bloque `model`.** El primer censo dio los 79 en verde y era
> falso: `@@index([merchantId, entityType, entityId])` existe **también en `Attachment`**, así que
> un grep sobre el fichero casa siempre. Mismo patrón que la trampa de autorreferencia — el
> literal que buscas vive en otro sitio del mismo fichero.

**Prevención:** cada entrada de `docs/MIGRATIONS_PENDING.md` lleva las tres como checkbox; una
sin marcar = migración NO aplicada.
