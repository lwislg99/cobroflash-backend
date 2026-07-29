# CONTRATO DEL AUDITLOG FISCAL — SCRUM-207 (AUDIT-FISCAL-1)

> **PROPUESTA PARA APROBAR. Cero código, cero schema, cero staging.** Este documento define
> **qué se registra, quién lo escribe, con qué campos, y cómo se consulta** cuando alguien
> pregunta. Nada de esto está implementado; el ticket que lo implemente se apoyará en este
> contrato, no al revés.
>
> **Escrito el 29-jul-2026** sobre `origin/main` en **`485ff72`**. Worktree propio
> (`wt-scrum-207`, rama `scrum-207-contrato-auditlog`).
>
> **Nace de:** SCRUM-200 §7 («AuditLog no cubre lo fiscal»). **Se apoya en:** SCRUM-201
> (`SEMAFORO_CALIBRACION.md`, de dónde salen los ÁMBAR y los ROJO) y SCRUM-203 (el embudo de
> numeración, de dónde sale el punto donde colgar el registro). **Bloquea a:** los tickets de
> ámbar del front.
>
> **Regla 30 respetada en todo el documento:** ningún texto de aviso está redactado aquí. El
> catálogo (§6) define **identificadores, estructura y versionado**; el texto de cada entrada
> figura como `PENDIENTE DE APROBACIÓN (fundador)`.

---

## 0. La afirmación del ticket, comprobada

El ticket dice: *«Hoy `AuditLog` no tiene ninguna acción fiscal»*.

**Es cierto, y se queda corto.** El problema medido no es solo que falten acciones fiscales:
es que **el AuditLog entero no tiene ningún lector**. Nadie lo consulta desde el producto. Se
escribe en 10 sitios y no se lee en ninguno.

Un registro que solo se escribe no es una prueba: es un fichero que nadie ha abierto nunca y
del que nadie sabe si dice la verdad. Por eso este contrato tiene una §7 (cómo se consulta) del
mismo tamaño que la §4 (qué se escribe): sin la mitad de lectura, el ámbar seguiría valiendo
cero aunque se registrase.

---

# PARTE I — LO QUE HAY HOY, MEDIDO

Todo lo de esta parte está leído en el árbol, fichero:línea comprobado uno a uno. Nada se
deduce del nombre.

## 1.1 El modelo: 9 columnas, ninguna FK, ningún enum

[`prisma/schema.prisma:700-713`](../../prisma/schema.prisma#L700-L713)

| Columna | Tipo | Nota medida |
|---|---|---|
| `id` | `Int @id @default(autoincrement())` | — |
| `merchantId` | `Int @map("merchant_id")` | **No es FK.** No hay `@relation` ni a `Merchant` ni a nada (`grep "AuditLog"` en el schema devuelve solo `:700` y `:712`, la definición y el `@@map`) |
| `teamMemberId` | `Int?` | Comentario en el propio schema (`:703`): *«null = owner/admin»*. **Ver §2.3: esto ya es ambiguo hoy** |
| `action` | `String` | **String libre en la BD.** El tipado vive solo en TypeScript ([`audit.service.ts:8-25`](../../src/modules/system/audit.service.ts#L8-L25)); la BD acepta cualquier cadena |
| `entityType` | `String?` | Libre. Valores observados: `invoice`, `albaran`, `job`, `export` |
| `entityId` | `Int?` | Libre, sin FK. **Puede quedar nulo** (2 de los 10 call-sites no lo pasan) |
| `meta` | `Json?` | Sin forma declarada. Cada call-site mete lo que quiere |
| `ip` | `String?` | **3 de los 10 call-sites no la pasan** |
| `createdAt` | `DateTime @default(now())` | — |

Un único índice: `@@index([merchantId, action, createdAt])` (`:711`). No hay índice por
`entityType`+`entityId`, que es justo el eje de la pregunta *«qué pasó con la factura X»* (§7).

## 1.2 El escritor: uno solo, y es fire-and-forget

[`audit.service.ts:33-55`](../../src/modules/system/audit.service.ts#L33-L55) — `recordAudit()`.

Dos propiedades medidas que **deciden el diseño de este contrato**:

1. **No se espera.** La función devuelve `void`, no `Promise`. El `create` sale sin `await`.
2. **Se traga los fallos.** [`:54`](../../src/modules/system/audit.service.ts#L54):
   `.catch((e) => console.error('[audit] no se pudo registrar:', e?.message))`.

Es deliberado y está razonado en la cabecera ([`:3`](../../src/modules/system/audit.service.ts#L3)):
*«Fire-safe: un fallo del log JAMÁS tumba la acción de negocio»*. **Para las 8 acciones
actuales es la decisión correcta.** Para una acción fiscal no lo es, y ese es el conflicto
central de este contrato (§5.1).

Además, el escritor **usa el cliente global**
([`:42`](../../src/modules/system/audit.service.ts#L42): `prisma.auditLog`), no un cliente
inyectable. **No se puede escribir dentro de una `$transaction` ajena tal cual está.** Es un
cambio de firma, no una reescritura — igual que el hallazgo de SCRUM-200 sobre
`allocateInvoiceNumber`.

## 1.3 Los 10 sitios que escriben, y las 8 acciones declaradas

**10 call-sites en `src/`** (`grep -rn "recordAudit(" src`, excluido el propio servicio):

| # | Fichero:línea | Acción | `entityId` | `ip` | `teamMemberId` |
|---|---|---|---|---|---|
| 1 | [`exports.routes.ts:36`](../../src/modules/exports/app/routes/exports.routes.ts#L36) | `datos_exportados` | ❌ no | ✅ | ✅ |
| 2 | [`albaranes.routes.ts:369`](../../src/modules/jobs/app/routes/albaranes.routes.ts#L369) | `albaran_editado` | ✅ | ✅ | ✅ |
| 3 | [`jobs.routes.ts:414`](../../src/modules/jobs/app/routes/jobs.routes.ts#L414) | `tipo_operacion_elegido` | ✅ | ❌ **no** | ✅ |
| 4 | [`job.service.ts:76`](../../src/modules/jobs/domain/job.service.ts#L76) | `operario_asignado` | ✅ | ❌ **no** | ✅ |
| 5 | [`invoicesAdmin.routes.ts:244`](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L244) | `marcar_pagado_manual` (bulk) | ❌ no (van en `meta.ids`) | ✅ | ✅ |
| 6 | [`invoicesAdmin.routes.ts:281`](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L281) | `marcar_pagado_manual` / `deshacer_pago` | ✅ | ✅ | ✅ |
| 7 | [`invoicesAdmin.routes.ts:311`](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L311) | `marcar_pagado_manual` (legacy `/pay`) | ✅ | ✅ | ✅ |
| 8 | [`invoicesAdmin.routes.ts:332`](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L332) | `deshacer_pago` (legacy `/unpay`) | ✅ | ✅ | ✅ |
| 9 | [`invoicesAdmin.routes.ts:650`](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L650) | `anular_factura` (**anulación**, SCRUM-153) | ✅ | ✅ | ❌ **no** |
| 10 | [`invoicesAdmin.routes.ts:754`](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L754) | `anular_factura` (**rectificativa R1**) | ✅ | ✅ | ✅ |

**8 acciones declaradas** en el union type ([`audit.service.ts:8-25`](../../src/modules/system/audit.service.ts#L8-L25)):
`marcar_pagado_manual` · `deshacer_pago` · `anular_factura` · `cambio_flag` · `albaran_editado` ·
`operario_asignado` · `tipo_operacion_elegido` · `datos_exportados`.

**Tres hallazgos de esta tabla:**

- **`cambio_flag` está declarada y NO se escribe en ningún sitio.** Verificado:
  `grep -rn "cambio_flag" src tests` devuelve exactamente 2 líneas, y las dos están en
  `audit.service.ts` (el comentario `:3` y la declaración `:12`). Cero call-sites. **Y el
  máster promete lo contrario** en dos sitios: Parte P (`YAQU_MASTER.md:370`, *«cambios
  auditados»*) y `CLAUDE.md` AA1.4. Es una promesa escrita sin mecanismo — el patrón de la casa
  que SCRUM-203 vino a atacar. Y el flag que más importa aquí es `INVOICING_ES_ENABLED`, que es
  literalmente el interruptor entre *justificante* y *factura fiscal*.
- **`anular_factura` cubre DOS hechos fiscales distintos.** El call-site 9 es la anulación
  (SCRUM-153) y el 10 es la rectificativa R1. **Por el campo `action` no se distinguen**; hay que
  abrir el `meta` y mirar si trae `rectification`. Para una inspección, «anular» y «rectificar»
  no son lo mismo (regla 29 / R10).
- **La cobertura de `ip` y `teamMemberId` es desigual**, y no por criterio: los call-sites 3 y 4
  no pasan IP, el 9 no pasa `teamMemberId`. No hay nada que lo exija, así que se olvida.

## 1.4 Los lectores: **cero en el producto**

Barrido completo sobre `src/`, `public/`, `tests/`, `scripts/` y `prisma/`:

| Consumidor | Fichero:línea | Qué hace |
|---|---|---|
| **Rutas de la API** | — | 🔴 **Ninguna.** `grep -i "audit" src/app.ts` = 0 resultados |
| **Dashboard / front** | — | 🔴 **Ninguno.** `grep -rni "audit" public/` devuelve **1** línea y no es esto: [`jobDetailView.js:380`](../../public/dashboard/js/jobDetailView.js#L380), la palabra *«auditoría»* en un comentario sobre la fusión de la vista (SCRUM-31 F5) |
| **Export de datos (ZIP/CSV)** | — | 🔴 **No incluido.** El paquete son 6 CSVs ([`exportData.ts:650-658`](../../src/modules/exports/domain/exportData.ts#L650-L658)): clientes, facturas, cobros, trabajos, presupuestos, gastos. `grep -ni "audit"` en ese fichero = 0 |
| **Borrado de merchant** | [`borradoMerchant.ts:47`](../../src/modules/system/domain/borradoMerchant.ts#L47) | 🟠 **Lo BORRA** — y es el primero de la lista |
| **Backup** | [`scripts/backup-dump.mjs:69`](../../scripts/backup-dump.mjs#L69) | 🟢 `audit_log` sí entra en el volcado |
| **Limpieza de staging** | [`clean-staging-tests.mjs:78`](../../scripts/clean-staging-tests.mjs#L78), [`e2e-critico.mjs:305`](../../scripts/e2e-critico.mjs#L305) | Lo borra (mantenimiento) |
| **Tests** | `scrum25-exports.test.mjs:171`, `scrum25-export-zip.test.mjs:213`, `scrum52-operario.test.mjs:23,47,87`, `scrum66-tipo-operacion.test.mjs:48,73`, `merchant-fixture.test.mjs:78-85` | Lo leen para comprobar que se escribió |

> **En una frase:** el único software que ha leído alguna vez el AuditLog de YaQu son sus
> propios tests. En una inspección, hoy, la respuesta operativa sería *«te lo saco por SQL a
> mano contra la BD de producción»*.

## 1.5 El borrado: el AuditLog cae con el merchant, y se le llama «rastro»

[`borradoMerchant.ts:42-54`](../../src/modules/system/domain/borradoMerchant.ts#L42-L54).
`auditLog` es **el segundo elemento** del orden de borrado, bajo el comentario
([`:46`](../../src/modules/system/domain/borradoMerchant.ts#L46)):

> *«Rastros y adjuntos: no los referencia nadie, así que caen pronto y sin ruido.»*

**Hoy ese comentario es verdad. El día que el AuditLog registre lo fiscal, deja de serlo** — y
lo hace en silencio, porque nada en el borrado sabrá que el contenido cambió de naturaleza. Ver
decisión **D-4** (§9).

## 1.6 El precedente de la casa: `LegalAcceptance` ya versiona un texto

Esto no lo pedía el ticket y es lo más útil que ha salido de medir: **el patrón
"identificador + versión del texto" ya existe en YaQu, funcionando, desde A10.1.**

[`prisma/schema.prisma:622-634`](../../prisma/schema.prisma#L622-L634):

```prisma
model LegalAcceptance {
  merchantId   Int
  teamMemberId Int?
  docKey       String   @map("doc_key")   // 'alcance-beta'      ← IDENTIFICADOR
  version      String                     // hash sha256 (12 hex) ← VERSIÓN DEL TEXTO
  ip           String?
  userAgent    String?
  createdAt    DateTime @default(now())
}
```

Y el mecanismo:

- La versión **se calcula del contenido**:
  [`legalPages.routes.ts:53`](../../src/modules/system/app/routes/legalPages.routes.ts#L53) →
  `sha256(html).slice(0,12)`.
- La versión **la resuelve el SERVIDOR, no la manda el front**:
  [`subscriptions.routes.ts:48,56`](../../src/modules/billing/app/routes/subscriptions.routes.ts#L48-L56)
  → el endpoint llama a `readLegalDoc('ALCANCE_BETA.md')` y guarda `doc.version`. El cliente
  solo dice *«acepto»*.
- Si el asesor toca el texto, el hash cambia y las aceptaciones viejas dejan de valer
  ([`:44-45`](../../src/modules/billing/app/routes/subscriptions.routes.ts#L44-L45)).

**Lo que este precedente resuelve:** detectar que el texto cambió.
**Lo que NO resuelve, y es exactamente el requisito de SCRUM-207:** un hash es de una sola
dirección. Con `version = 'a1b2c3d4e5f6'` y el fichero ya editado, **no se puede reconstruir lo
que el usuario leyó**. Sirve para invalidar; no sirve para reproducir. Ver §5.

## 1.7 Dos ausencias más que salieron al medir

- **El pack de inspección no se audita.** `exports.routes.ts` monta **10 rutas**. Siete llaman a
  `auditExport(…)` ([`:240,324,339,478,504,537,573`](../../src/modules/exports/app/routes/exports.routes.ts#L240)).
  De las tres restantes, dos no auditan **con motivo**:
  [`/datos.zip/info`](../../src/modules/exports/app/routes/exports.routes.ts#L80) solo **cuenta**
  facturas (no sale ningún dato) y
  [`/fees.csv`](../../src/modules/exports/app/routes/exports.routes.ts#L356) es contabilidad de
  **plataforma**, restringida al owner (`:362`), no datos de un merchant. **La tercera es
  [`GET /admin/exports/verifactu.xml`](../../src/modules/exports/app/routes/exports.routes.ts#L432)
  (`:432-459`), y esa sí saca datos del merchant: es el XML RRSIF que se entrega en una
  inspección (R13).** Sale por `res.send(xml)` (`:454`) sin una sola llamada a `auditExport`.
  El mismo XML **dentro** del ZIP sí queda registrado (`meta.verifactu_anios`,
  [`:245`](../../src/modules/exports/app/routes/exports.routes.ts#L245)); por la ruta suelta, no.
  > ⚖️ **Sin exagerarlo (R4):** la ruta exige `INVOICING_ES_ENABLED`
  > ([`:438`](../../src/modules/exports/app/routes/exports.routes.ts#L438)) y devuelve `404` si
  > está apagado — que es hoy el caso de todos los merchants (regla 24). **El hueco es latente,
  > no vivo:** nadie ha descargado nada sin dejar rastro. Se arregla ahora justamente porque
  > todavía no ha pasado.
- **El RGPD publicado no contempla el audit log.** `RGPD_TRATAMIENTO_DATOS.md` (SCRUM-93,
  23-jul-2026) no lo menciona en la tabla de tratamientos del §2 ni en el ROPA del §6
  (`grep -ni "audit"` sobre ese fichero devuelve un único resultado, `:222`, y es la palabra
  *«auditar»* en otro sentido). Relevante porque el texto resuelto de un aviso **puede
  contener datos personales** del cliente final (§5.4).

---

# PARTE II — LOS HUECOS QUE ESTO DEJA

## 2.1 Ninguna acción fiscal (el hueco del ticket)

No existe registro de: emisión, sellado, fallo de sellado, aviso mostrado, decisión del
usuario, ni bloqueo. El único hecho fiscal registrado hoy es la anulación/rectificación, y
comparte nombre de acción (§1.3).

## 2.2 Fire-and-forget: se puede consumir número sin dejar registro

`recordAudit` no se espera y se traga los errores
([`audit.service.ts:42,54`](../../src/modules/system/audit.service.ts#L42-L54)). Si la escritura
falla —BD saturada, `meta` inválido, lo que sea— **la acción de negocio sale adelante igual y lo
único que queda es una línea en el log del servidor**.

Es el mismo modo de fallo mudo que SCRUM-200 §6.1 documentó para el sellado
([`lib/invoicing.ts:58,152`](../../src/lib/invoicing.ts#L58)). Aplicado a lo fiscal significa:
**número de serie consumido, factura existente, y cero constancia de que el sistema avisó**.
El escudo legal desaparece justo en el caso raro, que es el único caso en que hará falta.

## 2.3 El actor está mal modelado para lo fiscal

`teamMemberId = null` significa hoy **«el propietario»** (`schema.prisma:703`). Pero
SCRUM-200 §2.1 midió que **el camino de emisión más transitado (C1) lo dispara el CLIENTE
FINAL**, sin login, desde WhatsApp
([`quotes.routes.ts:537`](../../src/modules/quotes/app/routes/quotes.routes.ts#L537)). Y hay
tres bocas más sin persona delante: dos webhooks de PSP y la API interna (SCRUM-200 §2.2).

Con el modelo actual, **una factura emitida por el cliente al aceptar un presupuesto quedaría
registrada como emitida por el propietario**. No es un matiz de UX: es atribución falsa en un
registro que existe para atribuir.

## 2.4 No hay forma de saber si falta un registro

Sin FK, sin lector y con escritura fire-and-forget, la pregunta *«¿todas las facturas de este
merchant tienen su registro?»* no tiene respuesta hoy. Y es la pregunta que abre una
inspección.

## 2.5 El registro no sobrevive al borrado del merchant

§1.5. Un profesional que se da de baja se lleva por delante la prueba de que YaQu le avisó.
Esa prueba **protege al fundador como productor del SIF**, no al merchant: es la parte que no
debería poder borrar el interesado.

---

# PARTE III — LA PROPUESTA

## 3. Las acciones fiscales

**Convenio de nombres:** se mantiene el estilo existente (español, `snake_case`,
sujeto+participio). **Prefijo `fiscal_` NO** — el `action` ya es único y añadir prefijo rompería
la simetría con las 8 que hay.

### 3.1 Las cuatro que pide el ticket

| # | `action` | Cuándo se escribe | `entityType` |
|---|---|---|---|
| **A1** | `factura_emitida` | Se consume número de serie (punto A de no retorno) | `invoice` |
| **A2** | `aviso_ambar_mostrado` | El front pinta un aviso ámbar al usuario | `invoice` \| `quote` \| `albaran` |
| **A3** | `aviso_ambar_decidido` | El usuario elige ante ese ámbar (continuar / corregir / cancelar) | ídem A2 |
| **A4** | `bloqueo_rojo_mostrado` | El sistema impide la emisión y se lo dice al usuario | ídem A2 |

**Por qué A2 y A3 son dos acciones y no una con un campo:** un usuario puede ver el ámbar y
**abandonar sin decidir**. Ese caso —el aviso funcionó y frenó la emisión— es evidencia de
primera calidad y con una sola acción sería indistinguible de *«nunca se le avisó»*. Con dos, un
`aviso_ambar_mostrado` sin su `aviso_ambar_decidido` **es** el registro del abandono.

### 3.2 Las que faltan, y por qué (propuesta)

Cada una sale de algo **medido**, no de simetría.

| # | `action` | Por qué falta hoy | Evidencia |
|---|---|---|---|
| **A5** | `factura_sellada` | **Hay DOS puntos de no retorno, no uno.** Consumir número (A) y sellar la huella (B) están separados en el tiempo, y en C1/C2 el punto B **lo dispara el cliente final descargando su PDF**. Un solo `factura_emitida` afirmaría que la factura entró en la cadena cuando puede tardar días — o no ocurrir | SCRUM-200 §5; [`verifactu.service.ts:280`](../../src/modules/invoicing/domain/verifactu.service.ts#L280); [`receipt.routes.ts:418`](../../src/modules/billing/app/routes/receipt.routes.ts#L418) |
| **A6** | `sellado_fallido` | El `catch` del sellado **es fail-open y no deja rastro consultable**. Hoy una factura puede existir, tener número, tener PDF entregado y no tener huella, y lo único que queda es un `console.error`. SCRUM-200 lo dijo con estas palabras: *«El problema no es que capture: es que capturar no deja rastro consultable. Falta el registro, no el `try`»* | [`lib/invoicing.ts:58`](../../src/lib/invoicing.ts#L58), [`:152`](../../src/lib/invoicing.ts#L152) |
| **A7** | `factura_anulada` | **`anular_factura` ya cubre dos hechos distintos** con el mismo nombre (§1.3). Una anulación y una R1 no son lo mismo ni fiscal ni operativamente (R10, regla 29) | [`invoicesAdmin.routes.ts:650`](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L650) |
| **A8** | `factura_rectificada` | ídem, la otra mitad | [`invoicesAdmin.routes.ts:754`](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L754) |
| **A9** | `exportacion_fiscal` | El único export **de datos del merchant** sin auditar es el XML RRSIF de inspección (§1.7). Entregar el registro fiscal a un tercero sin constancia de quién y cuándo es lo contrario de lo que hace este contrato. Hoy el hueco es **latente** (la ruta 404 con el flag apagado) | [`exports.routes.ts:432`](../../src/modules/exports/app/routes/exports.routes.ts#L432) vs. los 7 `auditExport` |
| **A10** | `cambio_flag` (**activar la que ya existe**) | Está declarada y **jamás se escribe** (§1.3), y el máster promete que los cambios de flag se auditan. Alcance mínimo de este contrato: los dos flags fiscales, `INVOICING_ES_ENABLED` y `SIF_ENABLED` — el interruptor entre justificante y factura | [`audit.service.ts:12`](../../src/modules/system/audit.service.ts#L12) (declarada) · `YAQU_MASTER.md:370` (prometida) · [`flags.ts`](../../src/core/flags.ts) |

**Sobre A7/A8 — cómo se hace sin romper el historial.** `anular_factura` **no se borra ni se
renombra**: las filas ya escritas conservan su valor y una consulta de inspección tiene que
unir las tres (`anular_factura` ∪ `factura_anulada` ∪ `factura_rectificada`). Se documenta como
**corte por fecha** en la §7.4. Reescribir filas viejas para «limpiar» sería falsificar un
registro de auditoría: exactamente lo que este documento existe para impedir.

**Lo que NO se propone, a propósito:** una acción por cada código AEAT. Los 2xxx son
**respuestas de la AEAT**, y la remisión no existe (`SIF_ENABLED=false`, sin `VfSubmission` en el
schema — SCRUM-200 §7). Registrar el resultado del envío es otro contrato, el día que haya
envío. Aquí solo se registra **lo que YaQu decide y lo que YaQu muestra**.

### 3.3 Resumen: 10 acciones, 3 niveles de durabilidad

El nivel decide **qué pasa si la escritura del registro falla**, y sale de la §2.2.

| Nivel | Qué significa | Acciones |
|---|---|---|
| **T1 · Transaccional** | Se escribe **dentro de la misma `$transaction`** que el hecho. Si el registro falla, **el hecho no ocurre** (rollback) | **A1** `factura_emitida` |
| **T2 · Bloqueante** | Se escribe **con `await`, antes** de dejar continuar. Si falla → error al usuario y **la acción no procede** | **A3** `aviso_ambar_decidido` |
| **T3 · Fire-safe** | Como hoy: no se espera, los fallos se tragan | **A2, A4, A5, A6, A7, A8, A9, A10** |

**Por qué A1 es T1 y no T3.** El hecho irreversible es *consumir número de serie*, y ocurre
dentro de la transacción de `allocateInvoiceNumber`
([`invoiceNumber.service.ts:115`](../../src/modules/invoicing/domain/invoiceNumber.service.ts#L115)).
Escribir el registro en esa misma transacción convierte *«factura con número y sin registro»* en
**imposible por construcción**, que es exactamente la garantía que SCRUM-203 construyó para el
embudo. Con T3, esa combinación es posible y silenciosa.

> ⚠️ **Consecuencia técnica, dicha aquí para que no aparezca como sorpresa en la
> implementación:** `recordAudit` usa el cliente global
> ([`audit.service.ts:42`](../../src/modules/system/audit.service.ts#L42)) y por tanto **no
> puede participar en una transacción ajena**. T1 exige una variante que reciba el `tx`. Es un
> parámetro nuevo, no un rediseño.

**Por qué A3 es T2.** El compromiso del ámbar es literalmente *«consta que el sistema informó y
que el usuario decidió»*. Si no consta, no hay compromiso. **Si no se puede registrar la
decisión, no se emite.** Es la única regla de este contrato que puede hacer fallar una petición
del usuario, y es deliberado.

**Por qué A4 es T3 y no T2.** En un ROJO la emisión ya está impedida por otro mecanismo; no
registrarlo no crea ningún hecho fiscal. El registro es defensivo (*«consta que bloqueamos»*),
no constitutivo.

---

## 4. Los campos de cada acción

### 4.1 El sobre común (todas las acciones fiscales)

Columnas existentes, **con reglas obligatorias donde hoy hay hueco** (§1.3):

| Columna | Regla para acciones fiscales |
|---|---|
| `merchantId` | Obligatorio (ya lo es) |
| `teamMemberId` | Obligatorio **cuando el actor es una persona del merchant**. `null` deja de ser suficiente por sí solo → ver `meta.actor` |
| `action` | Una de las 10 de la §3 |
| `entityType` | **Obligatorio** (hoy es opcional). `invoice` \| `quote` \| `albaran` \| `merchant` \| `export` |
| `entityId` | **Obligatorio** salvo A9/A10 y A2/A4 previos a que exista la entidad → entonces `entityType='quote'` + `entityId` del presupuesto |
| `ip` | **Obligatoria si hay petición HTTP.** `null` solo cuando el disparador es un proceso (cron, webhook interno) — y entonces `meta.actor.tipo` lo dice |
| `createdAt` | Automático |
| `meta` | **Obligatorio y con forma declarada** → §4.2 |

### 4.2 `meta`: el sobre versionado

**No se propone ninguna columna nueva.** El razonamiento está en la decisión **D-1** (§9): en una
tabla polimórfica cualquier columna nueva tendría que ser *nullable*, y una columna nullable no
aporta ninguna integridad que un sobre declarado + guard no aporte ya. El ticket anticipaba un
STOP de schema; **medido, no hace falta**.

```jsonc
{
  "v": 1,                          // versión del SOBRE (no del texto del aviso)
  "actor": {
    "tipo": "pro_propietario",     // pro_propietario | pro_equipo | cliente_final | sistema | psp
    "teamMemberId": null,          // espejo de la columna, para que el sobre se lea solo
    "ref": null                    // 'quote_token' | 'webhook:mp' | 'cron:x' — NUNCA el token en claro
  },
  "flagsFiscales": {               // el modo fiscal EN EL MOMENTO del hecho, congelado
    "INVOICING_ES_ENABLED": false,
    "SIF_ENABLED": false
  }
  // + payload propio de la acción (§4.3)
}
```

**`flagsFiscales` congelado y no derivado** por la misma razón que `vfPrevHash` se guarda como
dato y no se infiere (SCRUM-200 §7): dentro de un año, mirar el flag actual para explicar por
qué aquella factura salió justificante `J-` es reconstruir, no probar.

**`actor.ref` nunca lleva el token del presupuesto en claro.** El token es la credencial de
acceso público de C1; un registro de auditoría que lo guarde convierte el log en un llavero.

### 4.3 Payload por acción

**A1 · `factura_emitida`** — `entityType: 'invoice'`

| Campo | Por qué |
|---|---|
| `numero` | El número consumido, congelado (la fila `Invoice` puede anularse; el número no se reutiliza) |
| `serie` | Serie fiscal, `R` o `J` |
| `esJustificante` | `true` si degradó por `INVOICING_ES_ENABLED=false`. Es **la** distinción fiscal del producto hoy |
| `camino` | `C1`…`C7` según el mapa de SCRUM-200 §2.1. Sin esto no se puede responder *«¿quién lo disparó?»* para las emisiones sin persona |
| `tipoFactura` | `F1` \| `F2` \| `R1` — determina qué validaciones aplican (SEMAFORO §4.2/§4.4) |
| `totalCent`, `divisa` | Importe congelado |
| `avisosPrevios[]` | **Ids de los `aviso_ambar_decidido` que preceden a esta emisión.** El eslabón que convierte dos filas sueltas en una historia |

**A2 · `aviso_ambar_mostrado`** y **A4 · `bloqueo_rojo_mostrado`**

| Campo | Por qué |
|---|---|
| `aviso{}` | El bloque de reproducibilidad completo → §5.2. **Es el corazón del ticket** |
| `contexto` | `emision` \| `edicion_lineas` \| `consolidacion` \| … — dónde se mostró |
| `pantalla` | Vista del dashboard. Permite reproducir el recorrido |

**A3 · `aviso_ambar_decidido`**

| Campo | Por qué |
|---|---|
| `aviso{}` | **Repetido, no referenciado por id de fila.** Ver §5.3 |
| `decision` | `continuar` \| `corregir` \| `cancelar` — **lista cerrada** |
| `mostradoEn` | Timestamp del A2 correspondiente. La distancia mostrado→decidido es un dato: 400 ms es un clic reflejo, 30 s es haber leído |
| `avisoLogId` | Id de la fila A2, **si existe**. Enlace de conveniencia, nunca la única fuente |

**A5 · `factura_sellada`** — `numero` · `vfHash` · `vfPrevHash` · `esPrimerRegistro` · `disparadoPor` (`pdf_cliente` \| `pdf_pro` \| `export` \| `email` \| `emision`).
El último campo es el que hace visible el hallazgo de SCRUM-200 §5: **quién eligió el momento
de entrar en la cadena.**

**A6 · `sellado_fallido`** — `numero` · `errorClase` · `errorMensaje` (truncado) · `puntoDeFallo` (`ensureInvoicePdf` \| `ensureInvoiceForCharge` \| …) · `pdfEntregadoIgual` (bool).
El último campo dice si el cliente se llevó un PDF de una factura sin huella. Es el dato que
convierte el fallo mudo en un hecho consultable.

**A7 · `factura_anulada`** — `numero` · `motivo` · `estabaSellada` · `liberados{}` (albaranes/líneas devueltos al pool, P10).
**A8 · `factura_rectificada`** — `numeroOriginal` · `numeroRectificativa` · `rectificationId` · `tipoRectificativa` (`S`\|`I`, SEMAFORO §8.4) · `estabaSellada`.

**A9 · `exportacion_fiscal`** — `fichero` · `rango{from,to}` · `nRegistros` · `cadenaVerificada` (bool: si `verifactu_cadena_rota` no saltó) · `destinatarioDeclarado` (opcional, texto libre: *para quién se pidió*).

**A10 · `cambio_flag`** — `flag` · `de` · `a` · `alcance` (`global`\|`pais`\|`merchant`) · `motivo`.

---

## 5. EL REQUISITO QUE MANDA: reproducir lo que el usuario vio

### 5.1 El problema, dicho exacto

Guardar `decision: "continuar"` responde *qué hizo el usuario*. **No responde *ante qué*.**

El día que cambie el microcopy —y cambiará: el propio máster registra un cambio de N5 aprobado
con su motivo, `YAQU_MASTER.md:1097`— el registro pasa a decir que el usuario aceptó un texto
que **no es el que se le mostró**. En ese momento el registro deja de ser una prueba y pasa a
ser una afirmación falsa **con sello de tiempo**, que es peor que no tener registro: un registro
ausente se explica; un registro que miente hunde la credibilidad de todos los demás.

El precedente de `LegalAcceptance` (§1.6) resuelve la mitad: el hash detecta que el texto cambió
e invalida la aceptación. **Pero un hash no se puede leer.** Con el fichero ya editado, nadie
puede reconstruir qué decía. Para el checkout founding invalidar basta. Para una inspección
fiscal, no: hay que **poder enseñar el texto**.

### 5.2 El bloque `aviso{}` — tres datos, cada uno con su trabajo

```jsonc
"aviso": {
  "id": "AV-DESTINATARIO-NIF-NO-CENSADO",   // (1) IDENTIFICADOR — del catálogo, §6
  "version": "v2",                           // (2) VERSIÓN DECLARADA del texto
  "hash": "9f2c1a7b0e44",                    // (3) sha256(texto).slice(0,12) — patrón de la casa
  "texto": "…",                              // (4) TEXTO RESUELTO, literal, como se mostró
  "plantilla": "…",                          // (5) el mismo texto SIN interpolar (§5.4)
  "variables": { "nif": "B12345678" },       // (6) lo que se interpoló
  "catalogoVersion": "2026-07-29",           // (7) versión del CATÁLOGO entero
  "color": "ambar",                          // (8) ambar | rojo — NO va en el id (§6.2)
  "codigosAeat": ["2001"],                   // (9) trazabilidad a SEMAFORO_CALIBRACION
  "origen": "servidor"                       // (10) servidor | cliente_desajuste (§5.3)
}
```

**Por qué hacen falta los tres primeros y no bastan uno ni dos:**

| Solo… | Qué falla |
|---|---|
| **id** | No dice qué versión del texto era. Es lo que hay hoy: nada |
| **id + versión** | Un texto editado **sin subir la versión** pasa desapercibido. La versión es una declaración humana y los humanos se olvidan |
| **id + hash** (el patrón `LegalAcceptance`) | Detecta el cambio pero **no se puede leer ni buscar en el catálogo**. Un hash no se enseña a un inspector |
| **id + versión + hash** | Ya es consistente… hasta que la entrada del catálogo se retira o el repo se reescribe. Entonces el hash apunta a nada |

**Por eso también va el texto resuelto (4).** La fila tiene que ser **autosuficiente**: legible
sin acceso al repositorio, sin la versión concreta del catálogo, y sin confiar en que la
historia de git siga intacta dentro de seis años. El hash no se vuelve redundante — pasa a ser
la **comprobación cruzada** entre el texto guardado y el catálogo, y un guard que los compare
detecta manipulación de la propia fila.

### 5.3 Quién resuelve: el servidor. Qué manda el front: el eco.

El ticket dice que *«el front devuelve el identificador del aviso y la versión de su texto»*. El
precedente medido de la casa hace lo contrario: en `accept-alcance` **el servidor resuelve la
versión y el cliente no la manda**
([`subscriptions.routes.ts:48,56`](../../src/modules/billing/app/routes/subscriptions.routes.ts#L48-L56)).

**Se concilian así, y la conciliación es mejor que cualquiera de las dos por separado:**

1. Al pedir la operación, el servidor resuelve el aviso del catálogo y **sirve** `{id, version, hash, texto}`.
2. El front pinta **ese** texto (no uno propio) y, al decidir el usuario, **devuelve como eco** el
   `{id, version, hash}` que recibió.
3. El servidor **vuelve a resolver** desde el catálogo y compara con el eco:
   - **Coinciden** → se registra una vez, `origen: "servidor"`.
   - **No coinciden** → se registran **los dos**: el eco bajo `aviso{}` (*lo que el usuario vio de
     verdad*) y la resolución actual bajo `aviso_servidor{}`, con `origen: "cliente_desajuste"`.

**Un desajuste no es un error que se corrige: es el hallazgo.** Significa que se desplegó un
texto nuevo con clientes cargados con el viejo. Silenciarlo —quedándose solo con la versión del
servidor— produciría exactamente la mentira que este ticket combate, y encima con aspecto de
normalidad.

**No es hipotético:** el dashboard es una PWA con service worker
([`public/sw.js`](../../public/sw.js)). Desde SCRUM-45(B) es *network-first* con caché de
respaldo (`sw.js:2-5`), así que un bundle viejo solo se sirve **sin red** — más raro que antes,
pero no imposible. Y hay un motivo más simple e imposible de eliminar: una pestaña abierta
durante un deploy.

**El eco nunca es autoridad.** El cliente no puede inventar un `id` que no esté en el catálogo:
un `id` desconocido → **400 y no se emite**. El eco sirve para registrar discrepancias, no para
definir qué se avisó.

### 5.4 El texto resuelto lleva datos personales — y eso tiene consecuencias

Un aviso como *«el NIF del cliente no está en el censo»* solo es reproducible si guarda **el
NIF**. Eso mete un dato personal del cliente final en el AuditLog, y:

- El RGPD publicado **no contempla el audit log** en su tabla de tratamientos ni en el ROPA
  (§1.7). Habría que añadirlo.
- Ahí YaQu es **encargado**, no responsable (`RGPD_TRATAMIENTO_DATOS.md:49`): son datos del
  cliente final tratados por cuenta del profesional.

**Por eso el bloque guarda `texto` (5.2.4) y `plantilla` (5.2.5) por separado.** Permite, pasado
el plazo de conservación, **redactar `texto` y `variables` conservando `plantilla` + `version` +
`hash`**: se sigue pudiendo probar *qué clase de aviso se mostró y con qué redacción*, sin
retener el dato personal. Minimización sin perder la prueba. Ver decisión **D-4**.

---

## 6. El catálogo versionado de avisos

### 6.1 Dónde vive: una fuente ejecutable + un documento que se comprueba contra ella

| Opción | Problema |
|---|---|
| Solo `docs/legal/AVISOS_FISCALES.md` | El fundador lo aprueba, pero **el código no lo lee** → el texto mostrado y el aprobado divergen sin que nada avise |
| Solo un módulo TS | Ejecutable, pero el fundador aprueba microcopy leyendo un `.ts` — y la regla 30 se cumple de boquilla |

**Propuesta: las dos, con un guard que las ata** — el patrón de `HIJOS_SPEC` (SCRUM-199, *fuente
ÚNICA + guard de texto*) y de SCRUM-203.

- **Fuente de verdad en ejecución:** `src/modules/fiscal/avisos/catalogo.ts`.
- **Documento de aprobación:** `docs/legal/AVISOS_FISCALES.md`, **derivado** del módulo.
- **Guard en `npm test`:** falla si divergen, si un `id` se repite, si una entrada cambia de
  texto **sin subir `version`** (hash declarado vs. hash calculado), o si una `version` publicada
  se **reescribe** (las versiones son inmutables: se añaden, no se editan).

Precedente de que servir texto legal desde `docs/` en ejecución ya funciona:
[`legalPages.routes.ts:46-58`](../../src/modules/system/app/routes/legalPages.routes.ts#L46-L58).

**Y el guard se prueba en rojo antes de darlo por bueno** (inyectar un texto editado sin subir
versión, confirmar el fallo, revertir): un guard que nunca se ha visto fallar es decoración.

### 6.2 Estructura de una entrada

```jsonc
{
  "id": "AV-DESTINATARIO-NIF-NO-CENSADO",
  "color": "ambar",
  "codigosAeat": ["2001"],
  "fuente": "SEMAFORO_CALIBRACION.md §6 / §8.3",
  "deteccion": "pre_emision",
  "decisionesPermitidas": ["continuar", "corregir", "cancelar"],
  "versiones": [
    { "version": "v1", "desde": "PENDIENTE", "texto": "PENDIENTE DE APROBACIÓN (fundador)",
      "hash": "PENDIENTE", "variables": ["nif"], "vigente": true }
  ]
}
```

**Tres decisiones de diseño, cada una con su motivo:**

1. **El color NO va en el identificador.** Tentador escribir `AV-AMB-…`; sería un error. La §8 de
   `SEMAFORO_CALIBRACION` deja **cuatro colores sin decidir** por el fundador, y tres son
   literalmente *«¿ámbar o rojo?»*. Si el color va en el `id`, esa decisión **huérfana los
   identificadores ya registrados** y obliga a reescribir el historial. Con el color como campo,
   una entrada cambia de color subiendo versión y las filas viejas siguen siendo verdad.
2. **Las versiones se acumulan, no se sustituyen.** Una fila de 2027 debe poder resolver la `v1`
   de 2026. Retirar una versión rompe el catálogo como fuente de reproducción.
3. **`decisionesPermitidas` vive en el catálogo, no en el front.** Es lo que permite al guard
   rechazar una `decision` que esa entrada nunca ofreció.

### 6.3 Roster inicial propuesto — identificadores, **sin textos**

Derivado de `SEMAFORO_CALIBRACION.md` §4/§6/§8 y de `SEMAFORO_MAPA_EMISION.md` §4/§6. **Ninguna
entrada lleva texto: regla 30.** El fundador aprueba altas, bajas y redacción.

| `id` | Color propuesto | Códigos AEAT | Detección | Nota |
|---|---|---|---|---|
| `AV-EMISION-SIN-FLAG` | ámbar | — | pre-emisión | `INVOICING_ES_ENABLED=false` → sale justificante `J-`, no factura. **Hoy ocurre siempre y no se avisa** ([`invoiceNumber.service.ts:106`](../../src/modules/invoicing/domain/invoiceNumber.service.ts#L106)) |
| `AV-DESTINATARIO-AUSENTE-F1` | **rojo** | `1189` | pre-emisión | El generador ya lo produce hoy (SEMAFORO §7.1) |
| `AV-DESTINATARIO-NIF-NO-CENSADO` | ámbar | `2001` | pre-emisión (solo formato) | SEMAFORO §8.3: **decisión abierta** ámbar vs. gate |
| `AV-IMPORTE-DESCUADRE` | **abierto** | `1210`/`2005`, `1216`/`2006` | pre-emisión | SEMAFORO §8.1: el mismo error tiene código rojo y ámbar |
| `AV-HUELLA-CADENA` | **abierto** | `2000`,`2002`,`2003`,`2007`,`2008` | pre-sellado | SEMAFORO §8.2: la AEAT los acepta, la cadena dice rojo |
| `AV-SIMPLIFICADA-TECHO-3000` | **rojo** | `1150` | pre-emisión | Solo si se emite F2. En oficios se alcanza |
| `AV-FECHA-EXPEDICION-INVALIDA` | **rojo** | `1112`, `1152` | pre-emisión | Futuro, o anterior al 28-10-2024 |
| `AV-TIPO-IVA-NO-ADMITIDO` | **rojo** | `1124`,`1132`,`1194`,`1235`,`1236` | pre-emisión | El IVA lo teclea el merchant |
| `AV-CLAVE-REGIMEN-AUSENTE` | **rojo** | `1245` | pre-emisión | Latente en el builder (SEMAFORO §7.2) |
| `AV-CALIFICACION-OPERACION-AUSENTE` | **rojo** | `1195` | pre-emisión | ídem |
| `AV-SERIE-CARACTER-INVALIDO` | **rojo** | `1130`, `1287` | pre-emisión | La serie la compone YaQu |
| `AV-RELOJ-DESFASE` | ámbar | `2004` | pre-emisión | **Umbral no publicado** (SEMAFORO §6): no se puede calibrar desde la documentación |
| `AV-RECTIFICATIVA-TIPO-SIN-DECIDIR` | ámbar | `1118`, `1119` | pre-emisión R1 | SEMAFORO §8.4: `S` vs `I`, decisión del asesor |
| `AV-SELLADO-FALLIDO` | ámbar | — | post-sellado | El fail-open de [`lib/invoicing.ts:58`](../../src/lib/invoicing.ts#L58) hecho visible |

**Cuatro entradas nacen con el color abierto o pendiente y así se quedan hasta que el fundador
decida** (SEMAFORO §8). El catálogo las admite porque el color es un campo versionado, no parte
del identificador (§6.2.1).

**Lo que este roster NO es:** una lista cerrada. Es el conjunto derivable hoy de la calibración.
Altas y bajas = decisión del fundador, con su motivo escrito.

---

## 7. Cómo se consulta esto — R13

Hoy no hay lector (§1.4). Esta sección es **la mitad que hace que el registro valga algo**.

### 7.1 Las cinco preguntas de una inspección

| # | Pregunta | Cómo se responde |
|---|---|---|
| **Q1** | *«¿Qué pasó con la factura 2026-001?»* | Todas las filas con `entityType='invoice'` y `entityId=<id>`, por `createdAt` ascendente. Devuelve la historia: avisos → decisión → emisión → sellado |
| **Q2** | *«¿Se avisó al usuario y qué eligió?»* | Filas `aviso_ambar_decidido` del merchant, con `meta.aviso.texto` **legible directamente** — sin abrir el repo ni resolver ningún hash |
| **Q3** | *«¿Ese texto es el que estaba vigente ese día?»* | `meta.aviso.hash` vs. `sha256(catálogo[id][version].texto)`. **Si la entrada ya no existe, el `texto` de la fila ES la respuesta** (§5.2) |
| **Q4** | *«¿Alguna factura se emitió sin dejar registro?»* | **Conciliación** — ver §7.3. La pregunta que hoy no tiene respuesta |
| **Q5** | *«¿Quién descargó el registro fiscal, cuándo y para quién?»* | Filas `exportacion_fiscal` (A9). Hoy: nadie lo sabe (§1.7) |

### 7.2 La superficie de lectura

Tres piezas, de menor a mayor coste:

1. **`GET /admin/invoices/:id/auditoria`** — la historia de **una** factura (Q1). Es lo que se
   necesita en el 90 % de los casos y lo más barato. `requireRole('admin')`, filtrado por
   `req.merchantId` (regla 2).
2. **`GET /admin/exports/auditoria-fiscal.csv`** — el registro completo del merchant, con rango
   de fechas, para adjuntar al pack de gestoría (S1-H). **Se audita a sí mismo** con A9: el
   registro de auditoría es un dato que sale de la plataforma, igual que los 7 exports que ya
   dejan traza.
3. **`scripts/conciliar-auditoria-fiscal.mjs`** — la conciliación de Q4 (§7.3). Herramienta de
   operación, no ruta pública.

**Y una decisión de alcance: `entityId` necesita índice.** El índice actual es
`[merchantId, action, createdAt]` (`schema.prisma:711`) y Q1 pregunta por
`[merchantId, entityType, entityId]`. Es un índice aditivo — la única modificación de schema que
este contrato llega a proponer, y es de rendimiento, no de forma. Ver **D-1**.

### 7.3 La conciliación (Q4) — la consulta que descubre lo que falta

```
Para un merchant y un rango:
  facturas   := Invoice   WHERE merchantId, createdAt IN rango
  emisiones  := AuditLog  WHERE action='factura_emitida', entityType='invoice'
  sellados   := AuditLog  WHERE action='factura_sellada'

  HUECO 1 · factura sin `factura_emitida`      → registro perdido (T1 debería hacerlo imposible)
  HUECO 2 · `vfHash` != null sin `factura_sellada` → sellado sin registrar
  HUECO 3 · `vfHash` == null en factura fiscal, sin `sellado_fallido` → fallo mudo (SCRUM-200 §6.1)
  HUECO 4 · `factura_emitida` sin fila Invoice → rollback que dejó registro (T1 lo previene)
  HUECO 5 · `aviso_ambar_decidido` con `decision='continuar'` y sin emisión posterior → abandono
```

**El HUECO 3 es el que más vale** y es medible **hoy**, antes de implementar nada: cuenta las
facturas fiscales sin `vfHash`. Si el número es > 0 en producción, hay facturas entregadas sin
huella y nadie se ha enterado.

**HUECO 5 no es un fallo:** es la prueba de que el ámbar frenó a alguien. Se cuenta aparte, y es
el indicador de si el aviso sirve o si se pulsa sin leer.

### 7.4 El corte de `anular_factura`

Toda consulta de anulaciones/rectificaciones tiene que unir tres valores de `action`
(§3.2). Regla escrita, no confiada a la memoria:

> Anulaciones = `factura_anulada` ∪ (`anular_factura` **sin** `meta.rectification`)
> Rectificativas = `factura_rectificada` ∪ (`anular_factura` **con** `meta.rectification`)

El discriminador `meta.rectification` está medido:
[`invoicesAdmin.routes.ts:757`](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L757)
lo escribe; [`:652`](../../src/modules/system/app/routes/invoicesAdmin.routes.ts#L652) no.

### 7.5 R13 · el añadido al runbook

`docs/RUNBOOKS.md:136-144` (R13) hoy entrega XML RRSIF + PDFs + declaración responsable + guía.
**Le falta la traza de decisiones.** Añadido propuesto, en el formato de la casa:

- **Dónde mirar (añadir):** `GET /admin/exports/auditoria-fiscal.csv` del merchant y del período;
  y `GET /admin/invoices/:id/auditoria` para cualquier factura concreta que pregunten.
- **Acción (añadir):** antes de entregar, correr `conciliar-auditoria-fiscal.mjs` sobre el
  período. **Si hay HUECOS, se dicen; no se entrega un pack que aparenta completo.**
- **Qué decir al merchant (pendiente de aprobación, regla 30):** el guion lo aprueba el fundador.
- **Prevención (añadir):** el registro de emisión es transaccional (T1); si falta una fila,
  faltó la factura.

---

## 8. Qué test cierra el DoD

El DoD pide *«test que falla si se registra una elección sin identificador+versión del aviso»*.
Eso es **necesario y no suficiente** — pasaría con un `id` inventado y una `version` que no
existe. Cinco tests, cada uno contra un modo de fallo real:

| # | Falla cuando… | Modo de fallo que ataca |
|---|---|---|
| **T-1** | se escribe `aviso_ambar_decidido` sin `meta.aviso.id` o sin `meta.aviso.version` | El DoD literal |
| **T-2** | el `id` no está en el catálogo, o la `version` no existe para ese `id` | Un identificador inventado pasaría T-1 |
| **T-3** | `meta.aviso.hash` ≠ `sha256(meta.aviso.texto)` | La fila se manipuló, o el texto guardado no es el que se hasheó |
| **T-4** | una entrada del catálogo cambia de texto **sin** subir `version` (guard del §6.1) | El escenario exacto del ticket: el microcopy cambia y el registro empieza a mentir |
| **T-5** | existe una `Invoice` sin su `factura_emitida` en el fixture | La garantía T1, probada — no afirmada |

**Los cinco se prueban en rojo primero** (inyectar el fallo, confirmar el fallo, revertir,
confirmar el verde). T-4 es el que justifica el ticket entero: si no cae, el resto es
contabilidad.

---

## 9. DECISIONES DEL FUNDADOR — lo que este contrato NO decide

| # | Decisión | Lectura de este documento (no vinculante) |
|---|---|---|
| **D-1** | **¿Columnas nuevas en `AuditLog`, o todo en `meta`?** | **Todo en `meta`.** Cualquier columna nueva en una tabla polimórfica sería *nullable*, y una columna nullable no da más integridad que un sobre declarado + guard; `action` ya es `String` libre sin enum, así que la BD no valida nada hoy tampoco. **Único cambio de schema propuesto: el índice `[merchantId, entityType, entityId]` para Q1** — aditivo, de rendimiento. **Esto elimina el STOP de schema que el ticket anticipaba.** |
| **D-2** | **¿A3 (`aviso_ambar_decidido`) puede tumbar una emisión si el log falla?** | **Sí (T2).** Si no consta que el usuario decidió, no hay escudo; emitir igual es quedarse con el riesgo y sin la prueba. Es la única regla que puede devolver un 500 al usuario |
| **D-3** | **¿Se parte `anular_factura` en A7/A8?** | **Sí**, sin tocar las filas existentes, con la regla de unión de §7.4 escrita en el código que consulta |
| **D-4** | **¿El registro fiscal sobrevive al borrado del merchant?** (`borradoMerchant.ts:47`) | **Colisión real.** El registro protege al **fundador como productor del SIF**, no al merchant: es interés legítimo propio, no un dato del interesado. Pero contiene datos personales (§5.4). *Lectura:* conservar las filas fiscales con `texto`/`variables` **redactados** y `plantilla`+`version`+`hash` intactos. **Requiere entrada nueva en el RGPD/ROPA (§1.7) y plazo — hoy [VALIDAR ASESOR] en `RGPD_TRATAMIENTO_DATOS.md:201`** |
| **D-5** | **El color de las 4 entradas abiertas del roster** (§6.3) | Es SEMAFORO §8 y sigue abierto. El catálogo está diseñado para no bloquearse por ello (§6.2.1) |
| **D-6** | **Los textos del catálogo** | **Regla 30: los aprueba el fundador.** Este documento no redacta ninguno |
| **D-7** | **¿Entra `cambio_flag` (A10) en este alcance o va aparte?** | *Lectura:* entra, limitado a `INVOICING_ES_ENABLED` y `SIF_ENABLED`. Es el interruptor fiscal y el máster ya promete que se audita |

---

## 10. Lo que este contrato NO ha medido

Para que nadie lo dé por cubierto:

- **No se ha ejecutado nada.** Todo es lectura estática sobre `485ff72`. No se levantó el
  servidor, no se tocó staging, no se tocó el schema.
- **No se ha contado el HUECO 3 en producción** (facturas fiscales sin `vfHash`). La consulta
  está escrita en §7.3 y **se puede correr hoy**; hacerlo es otra tarea, con su gate.
- **No se ha auditado el front.** Dónde cabe cada aviso en el dashboard, y con qué componente
  de la Parte AB, es trabajo de los tickets de ámbar que este contrato desbloquea.
- **No se han medido los caminos de SCRUM-16, 18 y 20** — no existen en `main`.
- **La remisión a la AEAT no existe** (`SIF_ENABLED=false`, sin `VfSubmission` en el schema), así
  que **no se registra ninguna respuesta de la AEAT**. Ese es otro contrato, el día que haya
  envío.

---

## 11. Resumen en seis líneas

- **Medido:** el `AuditLog` tiene 9 columnas sin FK, un escritor *fire-and-forget*, 10 call-sites,
  8 acciones (una **declarada y nunca escrita**), **cero lectores en el producto** y se **borra**
  con el merchant.
- **`anular_factura` cubre dos hechos fiscales distintos** con el mismo nombre; y el único export
  de datos del merchant sin auditar es justo el XML de inspección (hueco **latente**: hoy 404).
- **10 acciones propuestas:** las 4 del ticket + `factura_sellada`, `sellado_fallido`,
  `factura_anulada`, `factura_rectificada`, `exportacion_fiscal` y activar `cambio_flag` — cada
  una nace de algo medido, no de simetría.
- **La reproducibilidad se resuelve con cuatro datos, no uno:** `id` + `version` declarada +
  `hash` del contenido + **texto resuelto**. Los tres primeros ya existen en la casa
  (`LegalAcceptance`); el cuarto es lo que este ticket añade, porque **un hash no se enseña a un
  inspector**.
- **El servidor resuelve, el front hace eco, y un desajuste se registra en vez de silenciarse:**
  el desajuste **es** el hallazgo.
- **Sin schema nuevo:** todo cabe en `meta` con un sobre declarado. Lo único aditivo es un índice.
  El STOP que el ticket anticipaba **no hace falta**.
