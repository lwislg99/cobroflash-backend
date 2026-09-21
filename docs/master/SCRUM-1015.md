# SCRUM-1015 · CLIENTES Y COBRO · la supresión/portabilidad del CLIENTE FINAL no existe: PASO 0 medido y el choque con la regla 29

**Medido contra:** `origin/main` = `678d9c069c7d9cfa244ac577b31f7a9ab4342e9e` · 2026-09-21T15:31:17Z

21-sep-2026 15:31Z · `origin/main = 678d9c069c7d9cfa244ac577b31f7a9ab4342e9e` · rama
`scrum-1015-supresion-cliente-final` · escrito por **J2** (puesto de Clientes y cobro del equipo de
Javier), sobre el censo entregado a la descripción de SCRUM-1015 por la sesión anterior del mismo
puesto (medido contra `origin/main = 92100e4fc018e59a948a0e9fccd898ae2d613963` · 21-sep-2026
15:07:06Z). Esta tanda no vuelve a medir: transcribe el censo ya hecho al expediente.

## Encargo

`docs/equipo/puesto-j2.md` §"Tu área" lo declara como hueco propio: *"La supresión y la portabilidad
de los datos del **CLIENTE FINAL**. ⚠️ Hoy no existe: lo que hay de supresión y portabilidad es de la
cuenta del MERCHANT, y es de J3."* `dos-equipos.md` §3.1 lo dice igual. Esta tanda **solo MIDE**: no
construye nada, no borra ni anonimiza ningún dato, no toca el esquema.

## El hallazgo, dicho de una vez

**No es** «no existe la supresión del cliente final» — eso ya estaba declarado. **Es por qué no se
puede construir sin decidir antes**:

- `Invoice.customerName` / `customerLegalName` / `customerTaxId` / `customerEmail` / `customerPhone`
  quedan **congelados para siempre** en cada factura emitida, por la **regla 29** del máster (*"Una
  factura emitida JAMÁS se edita ni borra: solo R1 o anulación con su registro"*).
- Y **`anonimizarMerchant.ts` YA EXCLUYE `invoice`** de lo que redacta al anonimizar un merchant,
  amparándose explícitamente en el **art. 17.3.b del RGPD** (obligación legal), según decisión del
  fundador del 10-ago-2026 documentada en ese mismo fichero.

Es decir: **alguien ya tomó esa decisión para el MERCHANT, y nadie la ha tomado todavía para el
CLIENTE FINAL.** Eso convierte esta medición en una pregunta concreta que un asesor puede contestar
en un minuto (§3 más abajo), no en un ticket de construcción. J4 ya la ha formulado como **P17** en
SCRUM-1023; se cita ahí.

## 1 · Qué existe hoy para borrar/exportar datos del CLIENTE FINAL (no del merchant)

Confirmado por CONTENIDO, no por nombre de fichero: todo lo que hay hoy de "derecho de supresión" y
"portabilidad" es de la **CUENTA DEL MERCHANT** (art. 17/20 de SU cuenta):

- `system/app/routes/supresion.routes.ts` + `supresionMerchant.service.ts` + `anonimizarMerchant.ts`
  (SCRUM-244): anonimiza al MERCHANT y, como efecto lateral, redacta los campos
  `name/phone/email/legalName/taxId/notes` de TODOS sus `customer` (constante `CAMPOS_PERSONALES`).
  Detrás de `MERCHANT_DELETE_ENABLED` (OFF por defecto, verificado en `src/core/flags.ts`). No hay
  forma de pedir esto para UN solo cliente sin borrar la cuenta entera del profesional.
- `exports/app/routes/exports.routes.ts` → `GET /admin/exports/portabilidad.zip` (SCRUM-244): lo dice
  el propio comentario del fichero — "el titular del derecho sobre los datos del NEGOCIO es el
  negocio, no cada miembro del equipo". Es portabilidad DEL MERCHANT.
- `borradoMerchant.ts` (SCRUM-192): borrado duro del merchant y su árbol. Su propio comentario dice
  "hoy no duele porque ninguna ruta borra merchants".

**Sí existe, y es la pieza más cercana a algo por-cliente:** `DELETE /admin/customers/:id`
(`customersAdmin.routes.ts`, con el comentario "SCRUM-55, D2 del fundador: borrado DURO e
irreversible... AA1.4 lo lista como stop condition") → `deleteCustomer` (`customerAdmin.ts`) hace
`customer.deleteMany({ where: { id, merchantId } })`. Es un borrado DURO de la fila, sin flag de
protección, sin confirmación reforzada (a diferencia del merchant, que exige escribir el nombre del
negocio), y **no está enganchado a ningún botón del dashboard** (grep de `public/`: `api.js` solo
define `createCustomer`/`updateCustomer`, ningún `deleteCustomer`). Hoy solo es alcanzable llamando a
la API directamente con rol admin.

⚠️ **Declarado, no verificado corriendo** (borrar datos es STOP de un jefe — `puesto-j2.md`, "Tus
STOP: exportar o borrar datos de clientes"): `Quote.customerId`, `Invoice.customerId`,
`QuoteRequest.customerId` y `CustomerEvent.customerId` son relaciones OBLIGATORIAS a `Customer` sin
`onDelete` declarado en `prisma/schema.prisma` — el comportamiento por defecto de Prisma/Postgres para
una relación obligatoria es `RESTRICT`. Si eso es lo que hay realmente en la base (no comprobado
contra `information_schema`: verificarlo de verdad exigiría insertar y borrar filas de prueba, y esta
tanda tiene prohibido tocar datos en cualquier base), ese `DELETE` **probablemente** solo podría
completar hoy para un cliente CON CERO historial — exactamente el cliente que nadie pediría borrar.
Se queda como pregunta técnica, no como afirmación: un hueco declarado vale más que una medición que
destruye lo que mide.

No hay ninguna ruta de EXPORTACIÓN de los datos de UN cliente individual (ni CSV ni ZIP) — solo
`GET /admin/customers/:id/detail`, una vista interna para el panel del profesional, no un paquete
art. 15/20 para el interesado.

## 2 · Qué datos del cliente final guarda YaQu, y dónde

`prisma/schema.prisma` de `origin/main`, 29 modelos; inspeccionados a fondo 9, el resto por grep:

- `Customer` (24 columnas): `name, phone, mobile, email, notes, legalName, taxId, billingAddress/City/
  PostalCode/Province/Country, tags, internalRef, portalToken, contactKind, companyId…`
- `Invoice`: `customerName/customerLegalName/customerTaxId/customerEmail/customerPhone` — **copia
  CONGELADA al emitir** (SCRUM-729/665), independiente de la fila `Customer` y de su ciclo de vida.
- `Quote.evidenciaFirma` (Json: ip, ua, firmante, tokenId…) y `Quote.signatureUrl`;
  `Albaran.signatureUrl/firmadoPorNombre/firmadoPorCalidad/evidenciaFirma`;
  `ParteTrabajo.signatureUrl/firmadoPorNombre/firmadoPorCalidad` — la FIRMA de quien recibe, que puede
  no ser el propio cliente ("un familiar o conviviente", "portero o conserje", por
  `albaranFirmante.ts`).
- `WhatsAppMessage`, `CustomerEvent`, `QuoteRequest`, `Charge`: todos enlazados a `customerId`.
- `BotSession.phone`: número crudo, sin ligar a `Customer.id`, compartido entre merchants hasta que el
  bot lo resuelve (TTL 24h).
- `EmailMessage.toEmail`: éste sí está cubierto por `CAMPOS_PERSONALES`.

⚠️ Ninguno de los campos de firma (`Quote.evidenciaFirma`, `Albaran.*`, `ParteTrabajo.*`) está en
`CAMPOS_PERSONALES` — ni siquiera la anonimización del MERCHANT los toca hoy.

## 3 · El choque — pregunta para J4 y el asesor, NO resuelta aquí

Regla 29 del máster (Parte I): *"Una factura emitida JAMÁS se edita ni borra; solo R1 o anulación con
su registro."* `anonimizarMerchant.ts` ya declara una lista de "intocables" (`vfHash`, `vfPrevHash`,
`number`, `total`, `qrData`, `lines`) citando la regla 29, y `tocaIntocables()` para la redacción del
merchant. `CAMPOS_PERSONALES` NO incluye `invoice` — por diseño: el rastro fiscal se ANONIMIZA a nivel
de `AuditLog`, pero el documento sellado —con nombre/NIF/email/teléfono del cliente CONGELADOS en
columnas propias de `Invoice`— no se toca nunca, amparado en el art. 17.3.b RGPD (obligación legal),
según la decisión del fundador del 10-ago-2026 documentada en el propio fichero.

**La pregunta que haría falta responder, y que no es de este puesto resolver:** ¿un CLIENTE FINAL (no
el merchant) que pide que se le olvide, y que YA tiene una factura emitida con su nombre/NIF/email/
teléfono sellados en la huella VeriFactu, puede ejercer ese derecho alguna vez sobre esos campos? El
precedente ya escrito en el código (SCRUM-244) dice que no para el merchant que pide borrar su PROPIA
cuenta — ¿aplica igual, con la misma base legal (art. 17.3.b), cuando quien lo pide es el CLIENTE del
merchant y no el merchant? Y si la respuesta es "se anonimiza igual que `CAMPOS_PERSONALES.customer`
pero `Invoice.customerName/...` se queda", ¿hay que decírselo al cliente en algún texto oficial
(K1/N5, regla 30)?

Citada en **SCRUM-1023** (P17, J4) como la misma pregunta vista desde el asesor.

## 4 · Suelo — qué NO se ha mirado, o no se ha verificado corriendo

- No se ha ejecutado nada: ni `deleteCustomer`, ni ninguna migración, ni consulta a ninguna base
  (dev/staging/producción). El comportamiento `RESTRICT` del punto 1 es una LECTURA de
  `schema.prisma`, no una medición contra `information_schema` — verificarlo de verdad implicaría
  insertar y borrar filas de prueba, y esta tanda tiene prohibido borrar o anonimizar datos en
  cualquier base.
- No se ha mirado el contenido completo de 20 de los 29 modelos del esquema — los que a simple vista
  son de equipo/producto (`TeamMember`, `AuditLog`, `Product`, `Provider`, `Expense`,
  `MaintenancePlan`, `JobAssignee`, `QuoteAssignee`, `InvoiceAssignee`, `GatewayEvent`, `AuthSession`,
  `Job`, `LegalAcceptance`, `Reconciliation`, `Event`, `AlbaranLineaFacturada`, `QuoteTemplate`,
  `Merchant`…). Alguno, como `Attachment` (fotos adjuntas a un trabajo), podría llevar imágenes del
  domicilio del cliente y no se ha revisado.
- No se ha mirado `docs/legal/` ni ninguna correspondencia con el asesor (terreno de J4).
- El censo de "qué llama a `deleteCustomer`" es un solo `git grep` sobre `origin/main`; no cubre un
  posible endpoint equivalente con otro nombre que no contenga la palabra "delete/borrar".

## No comprobado y errores propios (A9)

- Esta tanda no repite ninguna de las mediciones de arriba: las hereda literalmente de la sesión
  anterior del mismo puesto, que las dejó en la descripción de SCRUM-1015 antes de quedarse bloqueada
  escribiendo este mismo fichero (esperando un permiso interactivo que nadie podía contestar en una
  sesión de fondo). No se perdió ninguna medición; lo único que faltaba era este expediente.
- No se ha vuelto a correr el `git grep` de `deleteCustomer` ni el recorrido del esquema: se confía en
  el censo ya hecho porque `origin/main` no ha tocado ninguno de los ficheros citados entre el sha
  medido (`92100e4f…`) y el de este expediente (`678d9c06…`) — comprobado con
  `git diff --stat 92100e4f..678d9c06 -- prisma/schema.prisma system/ exports/ src/core/flags.ts`
  antes de transcribir.
- No se ha ejecutado `npm test` completo en esta tanda: solo `npm run guards:entrada` (documentado en
  el informe de entrega). La suite entera la corre el CI sobre el PR.
