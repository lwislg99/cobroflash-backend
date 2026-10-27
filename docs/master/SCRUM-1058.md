# SCRUM-1058 · Fusionar clientes que YA TIENEN facturas emitidas — diseño, sin código

**Medido contra:** `origin/main` = `62176956c35ea69eca18ba38567656965907bcf0` · 2026-09-23T08:05:31Z

**Gate:** diseño puro. Cero líneas de `src/`. **No se construye sin el GO de J1** (el ticket lo
pide literal: «diseño con J1»). Leer el camino de emisión no es STOP (regla 38); este expediente
no lo modifica, solo lo lee.

---

## PASO 0 — qué existía ya antes de diseñar nada

Barrido por PALABRA (`fusion`, `congela`), no por número de ticket. `fusionClientes.ts`
(SCRUM-1057, PR #1674, mergeado ayer) ya existe y **ya decide** el caso de este ticket: si
`principalId` o `fusionadoId` tiene alguna fila en `Invoice`, `decidirRechazoFusion` devuelve
`'factura_emitida'` y la fusión **no toca la base en absoluto** — ni reasigna, ni deja huérfano,
lo **impide** antes de abrir la transacción. Este ticket es exactamente el que SCRUM-1057 declaró
fuera («el ticket de J1 sobre clientes CON facturas emitidas: sigue bloqueado, tal como pide el
ticket»). El alcance del encargo es el que dice el orquestador: no hay nada que rehacer, hay que
diseñar el caso que falta.

---

## 1 · Qué congela el emisor congelado, del lado del CLIENTE

`src/modules/invoicing/domain/clienteCongelado.ts` (SCRUM-729) + el escritor único
`crearFacturaEmitida.ts` (el único `invoice.create` del árbol, vigilado por el censo del embudo,
`tests/_embudo-factura.mjs`, cero excepciones).

- **Viajan a la factura, en el MISMO `INSERT`, cinco columnas** (`Invoice.customerName`,
  `customerLegalName`, `customerTaxId`, `customerEmail`, `customerPhone`), leídas de la ficha
  **antes** de abrir la `$transaction` de numeración. `Invoice.customerId` (la FK) **no es una de
  las cinco**: sigue siendo el enlace vivo a `Customer`.
- **Regla de lectura, en `clienteDelDocumento` — el único lector, usado por los 4 sitios que
  reconstruyen un documento emitido (2 PDF, regeneración de admin, XML AEAT):**
  - `customerName` presente (no NULL) → se usan las cinco columnas de la factura. La ficha viva
    de `Customer` **no se toca ni se lee** para ese documento.
  - `customerName` a NULL → factura **anterior al escritor** (emitida antes del 8-sep-2026,
    fecha del ALTER aplicado y verificado en las tres bases) → cae al **fallback**: lee la ficha
    viva vía la relación `customer` (o sea, exactamente lo que apunte `customerId` HOY).
- Ese fallback es un **conjunto cerrado y declarado que no crece** («son exactamente los
  documentos que ya existían el día del despliegue» — comentario del propio fichero). Es la pieza
  que importa para el diseño de abajo: no es un caso raro, es la mitad del contrato de lectura.
- La huella VeriFactu (`computeVeriFactuHash`, `verifactu.service.ts:92`) es una lista **cerrada
  de 8 campos** — `nif` (del **emisor**, no del cliente), `serie`, `fecha`, `tipoFactura`,
  `cuotaTotal`, `importeTotal`, `prevHash`, `timestamp`. **Ninguno depende del cliente ni de
  `customerId`.** Confirmado por grep: `customerId` no aparece ni una vez en
  `verifactu.service.ts`. El sello no se rompe nunca por tocar el lado cliente.
- El número de factura es único **por merchant** (`@@unique([merchantId, number])`,
  `schema.prisma:925`), no por cliente. La serie no puede colisionar al fusionar dos clientes del
  mismo merchant.

## 1bis · Censo campo por campo: TODO lo que referencia al cliente, con ruta:línea

Pedido explícito de la ficha del ticket en Jira («lista de TODOS los campos de una factura
emitida y de su registro que referencian al cliente, con ruta:línea»). Censo, no memoria:

**En `prisma/schema.prisma`, modelo `Invoice`:**

| campo | línea | qué es |
|---|---|---|
| `customerId` | 723 | FK viva a `Customer`. El ÚNICO que un merge llegaría a tocar. |
| `customerName` | 726 | congelado |
| `customerLegalName` | 727 | congelado |
| `customerTaxId` | 728 | congelado — decide si la factura lleva `<Destinatarios>` en el XML |
| `customerEmail` | 729 | congelado |
| `customerPhone` | 730 | congelado |
| `customer` (relación) | 912 | el JOIN que resuelve `customerId` a una ficha viva |
| `rectifiesId`/`rectifies`/`rectifiedBy` | 863, 916-917 | no referencia al cliente directamente, pero encadena la identidad de una R1 a la de su original (ver rectificativas, §5) |

**El escritor — un único sitio, al emitir:**

- `src/modules/invoicing/domain/crearFacturaEmitida.ts` — `cliente: ClienteCongelado` es
  parámetro obligatorio del `create`, no un campo del `data` que se pueda olvidar (el tipo lo
  excluye).
- `src/modules/invoicing/domain/clienteCongelado.ts::congelarCliente`/`congelarDesdeFicha` — lee
  la ficha **antes** de abrir la `$transaction` de numeración.
- `clienteCongelado.ts::congelarParaRectificativa` — caso especial de R1, ver §5.

**Los lectores — los 4 sitios que reconstruyen un documento YA EMITIDO, los 4 vía
`clienteDelDocumento` (censados por grep, cero más en `src/`):**

1. `src/lib/invoicing.ts:131` — generador de PDF, camino de sellado inline.
2. `src/lib/invoicing.ts:249` (el `findUnique` por `customerId`) y `:277` (el consumo) —
   segundo generador de PDF, camino de sellado diferido (SCRUM-206).
3. `src/modules/system/app/routes/invoicesAdmin.routes.ts:1185` — regeneración desde el panel
   de administración.
4. `src/modules/invoicing/domain/verifactu.service.ts:891` — construcción del bloque
   `<sum1:Destinatarios>` del XML que se remite a la AEAT («su registro», en el sentido fiscal
   del término).

Los 4 comparten la MISMA regla: `customerName` no-NULL → usan las 5 columnas de la factura y
JAMÁS miran `customerId` ni la ficha viva; `customerName` a NULL → sí leen `customerId` (vía
`inv.customer` o el `findUnique` explícito) — éste es el único hilo por el que un merge podría
llegar a cambiar lo que muestra un documento ya emitido, y solo en ese caso.

**Sitios con `customerId` de `Invoice` que NO reconstruyen el documento (no pasan por
`clienteDelDocumento`, son metadatos administrativos, no contenido fiscal):**

- `src/modules/invoicing/domain/libroRegistro.repo.ts:82` — `select` del libro de registro
  (agrupa/filtra, no reescribe destinatario).
- Los 28 ficheros del §3 (`reports.routes.ts`, `invoiceReminder.service.ts`,
  `customerPortal.routes.ts`, `cobros.service.ts`, `exportData.ts`, `metrics.service.ts`,
  `search.routes.ts`…) — todos filtran u ordenan POR `customerId`; ninguno reconstruye el
  contenido legal del documento, así que todos se BENEFICIAN de que el merge reasigne el enlace
  (es la única forma de que «qué debe cada cliente» quede correcto tras fusionar).

## 2 · Qué hace HOY la fusión de SCRUM-1057 con los documentos del absorbido

Medido en el código real (`fusionClientes.ts`, `decidirRechazoFusion` + `fusionarClientes`), no
razonado:

- `previsualizarFusion` y `fusionarClientes` calculan **el mismo** `facturasEmitidas =
  prisma.invoice.count({ where: { customerId: { in: [principalId, fusionadoId] } } })` antes de
  tocar nada.
- Si `facturasEmitidas > 0`, `decidirRechazoFusion` devuelve `'factura_emitida'`:
  `previsualizarFusion` responde `bloqueada: 'factura_emitida'` sin contar nada más;
  `fusionarClientes` **lanza** antes de abrir la `$transaction`. Cero escrituras.
- Si `facturasEmitidas === 0`, fusiona 9 tablas (`Quote`, `Job`, `CustomerEvent`, `Charge`,
  `QuoteRequest`, `ParteTrabajo`, `WhatsAppMessage`, `EmailMessage` vía
  `reasignarClienteEnFusion`, `MaintenancePlan`) y borra el fusionado con `desvincularYBorrar`.
  **`Invoice` no está en esa lista**: hoy no existe código que reasigne ni que deje huérfano un
  `Invoice.customerId`, porque el camino que llegaría ahí está cortado antes.
- Consecuencia estructural, no del ticket: `deleteCustomer` (borrado individual, no fusión)
  **tampoco comprueba facturas** — si se llamara sobre un cliente con `Invoice`, Postgres
  rechazaría el `DELETE` por la FK real (`Invoice.customerId → customers`, sin `onDelete`
  declarado). Es una asimetría con `fusionarClientes` (que SÍ comprueba antes), no un defecto de
  este ticket — se deja **declarada**, no se toca (fuera de mi carril tocar `deleteCustomer` sin
  encargo).

## 3 · Qué rompería si se fusionan dos clientes con facturas — medido, no cada punto por igual

- **La serie**: nada. No es un recurso por cliente (§1). Descartado como riesgo.
- **El nombre que ya viajó en un PDF sellado**: depende de si esa factura tiene las cinco
  columnas rellenas o a NULL — no es uniforme:
  - Factura **con congelado** (emitida desde el 8-sep-2026): **nada**. `clienteDelDocumento`
    nunca mira `customerId` para estas; da igual a qué `Customer` apunte la FK, el PDF y el XML
    siguen leyendo las cinco columnas propias de la fila `Invoice`.
  - Factura **sin congelar** (anterior al 8-sep-2026, `customerName` a NULL): **si se reasigna
    `Invoice.customerId` al principal sin más** (el mismo patrón que usa hoy `fusionarClientes`
    para `Quote`/`Job`), la próxima regeneración (el disco de Railway es efímero — medido y
    demostrado corriendo en SCRUM-729 §1, es la vía real por la que esto muerde) leería la ficha
    del **principal**, que es una persona distinta de quien de verdad recibió esa factura. No es
    una hipótesis: es la misma lectura `!doc.customerName → usa viva` de `clienteDelDocumento`,
    aplicada a un `customerId` que ya no apunta a quien fue facturado. Esto es el defecto que
    SCRUM-729 declaró como «deuda vieja» hecho **inevitable** en vez de «posible si alguien edita
    la ficha»: un merge cambia la identidad detrás de la FK con certeza, una edición de ficha solo
    la cambiaba si alguien tocaba ese cliente concreto.
  - No puedo contar cuántas facturas de qué entorno caen en el bucket sin congelar (esta máquina
    no tiene Postgres, `TRAMOS_PG_URL`/`LIBRO_PG_URL` no corren aquí — declarado como SUELO, no
    silenciado). Lo que sí está medido es el borde: **todo lo emitido antes del 8-sep-2026** es
    candidato, por fecha del ALTER de SCRUM-729.
- **El enlace desde la factura a la ficha** (`Invoice.customerId`): hoy NO se toca porque la
  fusión con facturas está bloqueada entera. Si se desbloquea, este enlace **tiene que**
  reasignarse al principal — no es opcional: 28 ficheros leen `Invoice` por `customerId` para
  cosas que SÍ tienen que reflejar la fusión («qué debe cada cliente», recordatorios, el portal,
  exports, métricas, búsqueda — `reports.routes.ts`, `invoiceReminder.service.ts`,
  `customerPortal.routes.ts`, `cobros.service.ts`, `exportData.ts`, `metrics.service.ts`,
  `search.routes.ts`, entre otros). Y además: si el fusionado se borra (como hace
  `desvincularYBorrar` hoy con el resto de tablas) SIN reasignar antes su `Invoice.customerId`,
  Postgres **rechaza el propio `DELETE`** por la FK real — la transacción entera falla, no un
  huérfano silencioso. O se reasigna, o no se puede borrar al fusionado con sus facturas debajo.

## 4 · Diseño propuesto

### Opción A (recomendada) — permitir la fusión SOLO cuando ninguna factura del par está «sin congelar»

Cambiar el motivo de bloqueo de «tiene alguna factura» a «tiene alguna factura **sin las cinco
columnas rellenas**»:

```
facturasSinCongelar = prisma.invoice.count({
  where: { merchantId, customerId: { in: [principalId, fusionadoId] }, customerName: null },
})
```

- `facturasSinCongelar > 0` → nuevo motivo `'factura_sin_congelar'` (o nombre que decida J1),
  mismo patrón que `'factura_emitida'` hoy: corta antes de abrir la transacción, cero
  escrituras.
- `facturasSinCongelar === 0` (todas las facturas del par ya tienen las cinco columnas, aunque
  `facturasEmitidas > 0`) → se permite. `fusionarClientes` añade una décima reasignación,
  simétrica a las otras nueve: `tx.invoice.updateMany({ where: { merchantId, customerId:
  fusionadoId }, data: { customerId: principalId } })`. No escribe ninguna de las cinco columnas
  congeladas — esas no cambian nunca, es exactamente lo que las hace seguras de reasignar.
- **Por qué esta y no una comprobación más simple**: no toca `crearFacturaEmitida.ts` ni el
  escritor del sello, no añade una escritura nueva a un documento emitido (regla 29 intacta: el
  `UPDATE` de `customerId` no es uno de los 8 campos de la huella ni de las 5 congeladas), y usa
  el mismo mecanismo de rechazo que SCRUM-1057 ya dejó armado. El coste es que dos clientes con
  facturas viejas (pre-8-sep-2026) siguen sin poder fusionarse — un límite **declarado**, no un
  agujero.

### Opción B — igual que A, pero además backfillea las facturas sin congelar antes de reasignar

Dentro de la misma transacción de `fusionarClientes`, para cada `Invoice` del fusionado con
`customerName IS NULL`: llamar a `congelarDesdeFicha(fichaDelFusionado)` (función que **ya
existe**, `clienteCongelado.ts`, hoy solo se llama al emitir) y escribir las cinco columnas con la
ficha del fusionado **tal como estaba justo antes del borrado** — no con la ficha del principal,
no con «la de hoy» de nadie ajeno a esa factura. Eso convierte el bucket "sin congelar" del §3 en
población que SÍ se puede fusionar, en vez de dejarla bloqueada para siempre.

- Preserva regla 29 en el mismo sentido que SCRUM-729: la factura sigue mostrando a quien de
  verdad se facturó, ahora fijado en vez de leído en vivo — es *terminar* el backfill que
  `clienteCongelado.ts` declaró explícitamente que NO hace («NO rellena hacia atrás»), pero ahí la
  prohibición es sobre rellenar con la ficha de HOY de un cliente cualquiera para que «case»; aquí
  el dato que se escribe es el mismo que ya estaba en la fila `Customer` que se va a borrar,
  leído en el instante exacto antes de perderse — no se inventa nada nuevo, se salva lo que ya
  existía y que la fusión iba a hacer irrecuperable.
- Es la opción que de verdad **cierra** el ticket (fusiona cualquier par, no solo el que ya tenía
  suerte de nacer después del 8-sep). El coste es que SÍ escribe en filas `Invoice` ya emitidas
  (aunque solo las que hoy están a NULL, nunca las que ya tienen congelado) — por eso es la que
  más necesita el ojo de J1: es el módulo fiscal decidiendo si «backfill con el dato correcto,
  solo en el instante del borrado» cruza o no la línea de regla 29 tal como la interpreta el
  carril fiscal, no una lectura mía.

### Opción C — no borrar al fusionado, "fusión blanda" con puntero (`mergedIntoId`)

En vez de `desvincularYBorrar`, marcar `Customer.mergedIntoId = principalId` (columna nueva,
ALTER) y dejar la fila del fusionado viva pero oculta de las listas activas. `Invoice.customerId`
nunca se toca — el fallback de `clienteDelDocumento` sigue leyendo la ficha del fusionado, intacta
para siempre, sin backfill ni reasignación.

- Es la más conservadora con el camino de emisión: cero escrituras a `Invoice`, ninguna.
- Pero es la de mayor alcance de ingeniería para el tamaño real del problema: ALTER nuevo (ciclo
  de la regla 3: decisión → ALTER aditivo en las tres bases → PR), y **todo** lector de `Customer`
  que hoy asume "una fila = un cliente activo" (los 53 ficheros del grep de §1, no solo
  invoicing) necesitaría saber resolver el puntero o filtrar `mergedIntoId IS NULL` — el portal,
  las búsquedas, "qué debe cada cliente", los recordatorios. Convierte un ticket de fusión en un
  rediseño del modelo de `Customer`. La descarto como recomendación por desproporción coste/
  población, no por incorrecta.

### Recomendación

**Opción A ahora** (desbloquea el caso común — cualquier duplicado con solo facturas posteriores
al 8-sep-2026 — sin tocar el módulo fiscal más que con una lectura de `count`), **Opción B como
seguimiento explícito** una vez J1 confirme si el backfill-en-el-borrado descrito arriba es
aceptable bajo regla 29. Opción C solo si J1 considera que A/B no son suficientes por algún motivo
fiscal que no vea desde este carril — no la construiría sin que ese motivo se diga primero.

## 5 · Casos límite pedidos por el ticket, resueltos por escrito

### Cliente con facturas rectificativas (R1)

`congelarParaRectificativa` (§1bis) hereda la identidad de la factura ORIGINAL —lee
`original.customerName` si no es NULL— y **nunca** de `customerId`. Bajo la Opción A/B, una R1
solo puede existir si su original ya está congelada (si no lo estuviera, la fusión ya estaría
bloqueada por el propio `customerName IS NULL` del original). Y como el `updateMany` de la
reasignación mueve **todas** las facturas del fusionado a la vez —no una por una—, F1 y su R1
siempre viajan juntas al mismo `customerId` nuevo dentro de una misma fusión: no hay forma de que
se separen. El único escenario en el que podrían acabar en `customerId` distintos —una fusión que
mueve F1 y, MÁS TARDE, otra fusión distinta que mueve solo la R1— no es alcanzable: una R1 nueva no
puede emitirse contra un `customerId` que ya fue borrado por la primera fusión, así que esa
secuencia no existe.

### Cliente con «series» distintas

No existe tal cosa en este esquema, y por eso no hay nada que resolver: `number` es único **por
MERCHANT** (`@@unique([merchantId, number])`, `schema.prisma:925`), no por cliente, y
`invoiceNumber.service.ts` no referencia `customerId` en ningún punto (grep: 0 resultados).
Fusionar dos clientes no puede tocar ni colisionar ninguna numeración, tengan sus facturas la
serie/año que tengan.

### NIF distinto entre los dos

Ya lo resuelve SCRUM-1057: `nifDistintos` es un AVISO en la previsualización, nunca un bloqueo, y
queda apuntado en el `CustomerEvent` tipo `fusion`. Para las facturas YA EMITIDAS no hay riesgo
adicional al ya descrito en §3 («el nombre que ya viajó»): bajo la Opción A solo se fusiona si
TODAS están congeladas, así que el NIF impreso en cada una sigue siendo el que tenía al emitirse,
pase lo que pase con las fichas después. Las facturas FUTURAS del cliente fusionado usan el NIF
que tenga el principal en ese momento — es el mismo comportamiento que ya existe hoy para
cualquier corrección de NIF en una ficha viva, no uno nuevo de este ticket.

## 6 · Si la respuesta es SÍ — construcción propuesta (no construida aquí)

Con la Opción A recomendada:

1. **Ticket de construcción único** (rama propia, tests en Postgres real igual que
   `scrum1057b-fusion-clientes-postgres.test.mjs`): cambiar `decidirRechazoFusion` para distinguir
   `factura_sin_congelar` (bloquea) de «tiene facturas pero todas congeladas» (permite), y añadir
   la décima reasignación (`tx.invoice.updateMany`) en `fusionarClientes`. Sin tocar
   `crearFacturaEmitida.ts` ni `clienteCongelado.ts`.
2. **Seguimiento aparte, solo si J1 aprueba la Opción B**: el backfill de facturas sin congelar
   dentro de la transacción de fusión, reusando `congelarDesdeFicha` — éste sí toca el módulo
   fiscal y necesita su propio expediente con el mismo nivel de detalle que SCRUM-729.
3. **Pantalla (S2)**: el aviso/mensaje que ve el profesional cuando la fusión se bloquea por
   `factura_sin_congelar` — depende de qué opción se apruebe y necesita firma (regla 30/39); no se
   propone texto aquí.

Si la respuesta fuera NO (no se permite nunca fusionar clientes con facturas), el mensaje que
vería el profesional ya EXISTE: es el mismo 409 con motivo `factura_emitida` que devuelve
`fusionarClientes` hoy — no haría falta construir nada nuevo, solo no tocar `fusionClientes.ts`.

## Declarado, sin arreglar aquí

- `deleteCustomer` (borrado individual) no comprueba facturas antes de intentar el `DELETE` — hoy
  lo salva la FK real de Postgres lanzando error sin caso especial; no es defecto de este ticket,
  se reporta aparte si J2 lo retoma.
- El texto de la pantalla (aviso de "no se puede fusionar: facturas sin congelar", o el nuevo
  motivo en el selector de S2) no se propone aquí — depende de qué opción apruebe J1.
- Recuento real de facturas "sin congelar" en cualquier entorno: no medible desde esta máquina
  (sin Postgres). Quien lo mida, que lo haga contra staging con el turno, no a ojo.

---

## 1058 · visto bueno de J1

**Medido contra:** `origin/main` = `cf25030c8e94560725075313227e70177868e0f2` · 2026-10-21T13:51:47Z

Revisión de J1 (sesión `jv-j1o`), carril de facturas: el diseño de arriba leído contra el código
de HOY. Sólo LECTURA del camino de emisión (regla 38): cero líneas de `src/` en esta rama.
**Jira no se pudo leer**: el MCP de Atlassian dio `CONNECT_TIMEOUT` al arrancar (~13:45Z), así que
c.16565 y c.16596 NO se han leído; esta revisión se apoya sólo en el registro del repo.

### Veredicto

**Opción A: NO OK tal como está escrita.** Su premisa —«para una factura congelada, ningún
lector que reconstruya el documento mira `customerId`»— es FALSA hoy: hay un quinto lector que
el censo de §1bis no vio, **el libro de facturas expedidas para la AEAT**, y ése resuelve el
destinatario (NIF y nombre) desde la ficha VIVA a través de `customerId`, para TODAS las
facturas, congeladas o no. Reasignar `Invoice.customerId` cambia el destinatario que ese libro
declara. **Corrido, no razonado** (abajo). Pasa a OK sólo si se cumplen las DOS condiciones de
«Qué haría falta», y las dos son de un jefe.

**Opción B: NO OK.** **Opción C: OK en lo fiscal**; su coste (ALTER + todos los lectores de
`Customer`) es decisión de producto, no de este carril.

### El hallazgo, corrido

- `src/modules/fiscal/librosAeat/librosAeat.repo.ts:51-65` — junta los `clienteId` del libro y
  hace `customer.findMany({ id in ids })`: `nifDestinatario = c.taxId`, `nombreDestinatario =
  nombreParaDocumento(c, …)`. Ficha viva.
- `src/modules/invoicing/domain/libroRegistro.repo.ts:100-117` (`CAMPOS_FACTURA`) — el libro ni
  siquiera SELECCIONA las cinco columnas congeladas; `libroRegistro.ts:213` las cambia por
  `clienteId: f.customerId`. Por eso §1bis lo dio por «agrupa/filtra, no reescribe destinatario»:
  el destinatario se reescribe un fichero más abajo, y con otro nombre de campo (`clienteId`).
- Montado: `src/app.ts:600` → `GET /admin/libros/expedidas.csv` (`librosAeat.routes.ts:45`).
- **Sonda:** `docs/master/evidencias/SCRUM-1058/sonda-libro.cjs`, código real de
  `leerLibroExpedidasDelTrimestre` compilado con `tsc --noCheck` a una carpeta temporal, base en
  memoria. La MISMA factura, con sus cinco columnas congeladas a `Fusionado SL` / `B11111111`:
  con `customerId=10` el libro da `B11111111` (control positivo: el instrumento ve el valor
  bueno); con `customerId=20` —lo que haría el `updateMany` de la Opción A— da `B22222222` /
  `Principal SA`. Salida entera en `sonda-libro.salida.txt` (2 vueltas, 1 fila cada una).
- **No es sólo de la fusión: es un defecto de HOY**, el de SCRUM-729 en un quinto lector.
  Corregir el NIF de la ficha de un cliente reescribe ya, sin fusión ninguna, el libro de
  expedidas de sus facturas pasadas, mientras el PDF y el XML (que sí pasan por
  `clienteDelDocumento`) siguen con el congelado: libro y registro pueden declarar a la AEAT dos
  destinatarios distintos para la misma factura. NO medido: si algún merchant ha descargado ese
  libro en algún entorno.

### Caso por caso

| caso | veredicto | por qué, con fichero:línea de hoy |
|---|---|---|
| Regla 29 (A) | **NO OK sin decisión** | El `UPDATE` de `customerId` cambia lo que declara el libro (arriba). Y el propio código dice que reasignarla «sería tocar un documento YA EMITIDO — regla 29, prohibido siempre» (`src/modules/system/domain/fusionClientes.ts:11-15`): diseño y código se contradicen, y elegir entre los dos es interpretar la regla 29 → fundador. |
| Regla 29 (B) | **NO OK** | Escribe las cinco columnas en facturas emitidas. Lo escrito es la ficha del día de la FUSIÓN, no la del día de la EMISIÓN: es justo el backfill que prohíbe `clienteCongelado.ts:32-35` («escribiría un NIF que el día de la emisión no constaba»), y el NIF decide si la factura lleva `Destinatarios` (`verifactu.service.ts:1074-1077`, `MODO_SIN_DESTINATARIO`). |
| Huella encadenada | **OK** | `computeVeriFactuHash` (`verifactu.service.ts:136-155`): 8 campos, ninguno del cliente. Anulación igual (`:165-180`). La cadena no se toca. |
| `IDEmisorFactura` / NIF del emisor | **OK** | Es el del merchant, congelado al emitir (SCRUM-665 B, `schema.prisma:776-796`); la fusión no toca `Merchant`. |
| XML a la AEAT (`Destinatarios`) | **OK** para congeladas | `clienteDelDocumento(inv, inv.customer)` (`verifactu.service.ts:1074`): con `customerName` presente manda la columna (`clienteCongelado.ts:222-231`). |
| Cola de remisión (`VfSubmission`) | **OK** — nuevo desde el 23-sep | SCRUM-1296 (30-sep) guarda el `registroXml` YA CONSTRUIDO al emitir (`encolarRemision.ts:42-69`) con FK a `Invoice` (`schema.prisma:1829`), no a `Customer`: la fusión no lo alcanza. |
| PDF (dos generadores) y regeneración de admin | **OK** para congeladas | `src/lib/invoicing.ts:133` y `:292`, `invoicesAdmin.routes.ts:1237`, todos por `clienteDelDocumento`. |
| Libro de expedidas AEAT | **NO OK** | El hallazgo de arriba. |
| Rectificativas (R1) | **OK**, con el libro como en A | La R1 nace con `customerId: original.customerId` (`invoicesAdmin.routes.ts:1103`) y hereda el congelado del original (`clienteCongelado.ts:197-204`); el `updateMany` mueve las dos juntas. Si el original está a NULL, A ya bloquea. La R1 arrastra el mismo defecto del libro que su original. |
| Series / numeración | **OK** | `@@unique([merchantId, number])` (`schema.prisma:974`); `invoiceNumber.service.ts` no nombra `customerId` (0 apariciones). |
| NIF distinto entre los dos | **NO OK** | §5 dice «el NIF impreso en cada una sigue siendo el que tenía». Cierto en PDF y XML; FALSO en el libro: tras la fusión, las facturas del fusionado salen en el libro con el NIF del principal (la sonda es exactamente este caso). 1057 sólo AVISA de NIF distintos (`fusionClientes.ts:131-132`), no bloquea. |
| Facturas sin congelar (bloqueo de A) | **OK** | Bloquear con `customerName: null` es la frontera correcta (`clienteCongelado.ts:15-28`). Bloquea también por las del PRINCIPAL, que no se mueven: conservador, no incorrecto. |

### Lo que ha cambiado desde el 23-sep (comparado por contenido)

- `clienteCongelado.ts` y `crearFacturaEmitida.ts`: sin cambios (`git diff 62176956c..cf25030c8`
  vacío para los dos).
- `fusionClientes.ts`: SCRUM-1291 (`c785afe13`) añadió `CustomerSite`. Hoy reasigna **diez**
  tablas (`:177-191`), así que la de `Invoice` sería la undécima, no «la décima» de §4.
- `VfSubmission` existe (SCRUM-1296): ver la tabla. Juega a favor de A.
- Las líneas que cita §1bis se han movido; el contenido es el mismo: `schema.prisma` 723-730 →
  768-775, 912 → 957, 925 → 974 · `invoicing.ts` 131 → 133, 277 → 292 · `invoicesAdmin.routes.ts`
  1185 → 1237 · `verifactu.service.ts` 891 → 1074. Lo que §1bis daba por completo era el censo,
  y no lo era (el libro).

### Qué haría falta para que A pase a OK (las dos son de un jefe)

1. **El libro de expedidas lee el destinatario por `clienteDelDocumento`** (columna primero,
   ficha viva sólo si `customerName` es NULL), igual que los otros cuatro lectores. Es modificar
   `src/modules/fiscal/librosAeat/` y el `select` de `libroRegistro.repo.ts`: camino fiscal,
   **STOP del fundador** (regla 38; SCRUM-1151 ya trató `librosAeat` como «regla 38, no se
   modifica»). Arregla además el defecto de HOY de arriba, con fusión o sin ella. Va ANTES que
   cualquier construcción de A.
2. **El fundador decide si reasignar `Invoice.customerId` de una emitida es «editar»** en el
   sentido de la regla 29. Con (1) hecho, ningún documento fiscal cambiaría; la opinión de J1 es
   que entonces no lo es (es un enlace administrativo, como `quoteId` o `chargeId`), pero la
   regla es suya y hoy el código dice lo contrario (`fusionClientes.ts:11-15`).

Hasta entonces, el bloqueo `factura_emitida` de SCRUM-1057 se queda como está.

### Avisos de otros carriles (no son del veredicto)

- `src/modules/exports/domain/exportData.ts:215` — el CSV de facturas pone «Cliente» y «Email
  cliente» de la ficha viva. Tras una fusión saldría el principal. Sin NIF; no es el libro.
- Admin, WhatsApp de la factura y recordatorios (`invoiceAdmin.ts:151`,
  `invoiceWhatsApp.service.ts:112`, `invoiceReminder.service.ts:133`) leen la ficha viva: ahí
  reflejar la fusión es lo que se quiere.

A9: aviso → A10 «Cero resultados con tu vocabulario no es silencio del documento.» — no se pudo comprobar: el censo de §1bis buscó `customerId` y `clienteDelDocumento`, y el libro reescribe el destinatario con `clienteId`; ningún guard puede saber qué nombre lleva un campo un fichero más abajo, y el que vigilaría «todo destinatario sale de `clienteDelDocumento`» toca el camino fiscal (condición 1, STOP).

---

## 1058c · el ROJO del libro de expedidas, y el arreglo preparado sin aplicar

**Medido contra:** `origin/main` = `f53289026390853176eb2d8ba4ad2bbd51bc9d6d` · 2026-10-21T14:39:02Z

Sesión `jv-j1p`, carril J1. **Cero líneas de `src/` en esta rama** (regla 38): un test que sólo LEE
el camino y un diff guardado como evidencia. Jira no se pudo leer (caído desde ~13:40Z).

### El test, por la ruta montada

`tests/scrum1058c-libro-expedidas-lee-el-congelado.test.mjs` arranca `dist/app.js` con el banco de
SCRUM-597 y pide `GET /admin/libros/expedidas.csv?año=2026&trimestre=3` como propietario (pasa por
`requireAuth`, `requireRole('admin')` y el montaje de `app.ts:600`). El doble **respeta el `select`**:
si el lector no pide las columnas congeladas, no le llegan. Las columnas las escribe
`congelarDesdeFicha`, no el test.

Población: 2 facturas del merchant (F-CONG congelada a `Fusionado SL` / `B11111111`; F-ANTIGUA con
las cinco columnas a NULL) + 1 de otro merchant que no debe salir → 2 filas. 5 casos.

| caso | sin arreglo (`aa68b01af`) | con el arreglo |
|---|---|---|
| suelo: 200 y las 2 facturas, nada ajeno | ✔ | ✔ |
| control: ficha sin cambiar → `B11111111` / `Fusionado SL` | ✔ | ✔ |
| 🔴 ficha corregida a `B22222222` / `Principal SA` → la congelada sigue con `B11111111` | **✖** (sale `B22222222`) | ✔ |
| la anterior al escritor sale con la ficha viva | ✔ | ✔ |
| ninguna escritura en el banco | ✔ | ✔ |

Sin arreglo: 5 tests, 4 pass + 1 fail. **Por eso esta rama no se empuja**: tumbaría el obligatorio.

### El arreglo: `docs/master/evidencias/SCRUM-1058/arreglo-1058c.diff` — NO aplicado

Probado en un worktree temporal (`j1p-1058c-arreglo-tmp`, ya retirado con `git worktree remove`): 42
ficheros de test del libro, del 303, de las evidencias, del lector A6 y los guards de suite (scrum237,
scrum976, scrum622) → **365 casos: 359 pass, 6 skip, 0 fail**. Los 6 skip son por `LIBRO_PG_URL`: los
de Postgres NO se han corrido. `tsc --noEmit`: los mismos 17 errores que sobre `main` sin tocar (todos
de `archivedAt`, cliente de Prisma compartido viejo), ninguno nuevo. `git apply --check` limpio.

⚠️ **El arreglo es MÁS que «cambiar de dónde se lee»**, y es lo que hay que enseñarle al fundador:

1. **Toca A6** (`libroRegistro.repo.ts` + `libroRegistro.ts`): tres columnas más en `CAMPOS_FACTURA`
   y un campo nuevo en `AsientoLibro`, `clienteCongelado`. Consecuencia: `GET /admin/libro-registro`
   (que hace `res.json(libro)`) empieza a servir el nombre, la razón social y el NIF congelados de
   cada factura. Hoy sirve sólo `clienteId`.
2. **Cambia una firma**: `filasLibroExpedidas` acepta, además del mapa por `clienteId`, una función
   del asiento. Hace falta porque dos facturas del mismo cliente pueden llevar dos NIF congelados
   distintos, y un mapa por cliente no puede decir eso.
3. **Por qué no la vía corta.** La primera versión leía las columnas con un `invoice.findMany` dentro
   de `librosAeat.repo.ts` y sólo tocaba ese módulo. La tumbó el R5 de
   `tests/scrum325-libros-por-periodo.test.mjs` («este módulo está leyendo facturas por su cuenta»).
   El guard no se relaja (regla 41), así que el congelado tiene que llegar por A6.

### Otros lectores con el mismo patrón (sólo lista: no se tocan)

| lector | qué lee de la ficha viva | ¿mismo defecto? |
|---|---|---|
| `GET /admin/libros/recibidas.csv` y `.json` (`librosAeat.repo.ts:85-110`) | NIF y nombre del PROVEEDOR desde `Provider` | **leído en el esquema, no corrido**: `model Expense` no tiene columnas congeladas de proveedor (sólo `providerId`, `providerInvoiceNumber`, `providerInvoiceDate`), así que no hay congelado que perder; corregir un proveedor reescribe el libro de recibidas pasado. Es otro defecto (falta el dato), no este |
| `GET /admin/exports/invoices.csv` (`exportData.ts:203-216`) | «Cliente» y «Email cliente» | sí en el patrón, sin NIF; carril de exportaciones, no J1 |
| paquete de evidencias (`paquete.repo.ts:85-95`) | nombre del cliente del Trabajo para recalcular el sobre del albarán | conocido y declarado: SCRUM-431/438 (`atestiguamiento.ts:8-12`) |
| XML VeriFactu, registro para la cola, PDF, regeneración de admin | — | no: pasan por `clienteDelDocumento` (tramo «1058 · visto bueno de J1») |

Error propio de esta tanda: escribí la primera versión del arreglo sin leer antes los guards del
módulo, y el R5 de scrum325 la tumbó en el banco. Lo hará igual con quien lo intente.

A9: comprobación → `tests/scrum325-libros-por-periodo.test.mjs`

---

## 1058c (aplicado) · GO del fundador, c.20207

**Medido contra:** `origin/main` = `75884928b170ec0ec02e35921426e5bd711cbb0f` · 2026-10-22T09:01:07Z

Sesión `jv-j1q`, carril J1. GO del fundador por la regla 40 en SCRUM-1058 c.20207 («1-Go para A» y
«1-GO»): aplicar `arreglo-1058c.diff` **tal cual** — libro de expedidas + libro de registro A6 + la firma
de `filasLibroExpedidas`. Nada más del camino de emisión: recibidas.csv, exports/invoices.csv y
`paquete.repo.ts` siguen sin tocar.

- El diff, antes de aplicarlo: 0 CR y 134 LF, `git apply --check` rc=0; ninguno de los 4 ficheros de
  `src/` cambió en `main` entre `8a8b51d96` y `75884928b`. Aplicado con `git apply`: 4 ficheros, +45/−12.
- Población: 46 ficheros de test (los que nombran `librosAeat`/`libroRegistro`/`filasLibroExpedidas`/
  `construirLibroRegistro`, los del libro, el 303, scrum325, scrum729, los guards 237/976 y scrum622),
  contra `dist/` de `tsc --noCheck`:

| | casos | pass | fail | skip |
|---|---|---|---|---|
| sin arreglo | 455 | 448 | 1 (el 🔴 de scrum1058c) | 6 |
| con el arreglo | 455 | 449 | 0 | 6 |
| con el arreglo, tras `git merge origin/main` | 455 | 449 | 0 | 6 |

  Los tres con el MISMO conjunto de 455 nombres (`diff` de las listas ordenadas: vacío). Los 6 skip son de
  `LIBRO_PG_URL`: los de Postgres **no se han corrido**. `tsc --noEmit`: 17 errores, todos fuera de los 4
  ficheros (16 de `archivedAt`/`activityKind` y uno en cascada en `quotesAdmin.routes.ts:1005`): el cliente
  de Prisma compartido va por detrás del esquema; no se regeneró (árbol anidado). El tipado real lo da CI.

A9: comprobación → `tests/scrum1058c-libro-expedidas-lee-el-congelado.test.mjs`
