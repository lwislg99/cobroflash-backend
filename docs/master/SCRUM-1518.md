# SCRUM-1518 · lo que escribe el cliente sale en su ficha como un envío nuestro

## 22-oct-2026 · S4 · reproducido de punta a punta (sólo medir; no se ha tocado código)

**Medido contra:** `origin/main` = `0077bd1d51a7cb64b1c18d85781117b71936fd38` · 2026-10-22T10:08:31Z

Ancla de `node scripts/equipo/ancla.mjs` · rama `scrum-1518-reproducir-punta-a-punta`. Encargo del
orquestador del equipo de Luis: el primer paso del propio ticket, reproducir antes de arreglar.

A9: comprobación → `docs/master/evidencias/SCRUM-1518/sonda-1518-punta-a-punta.mjs`

**Cómo.** `node docs/master/evidencias/SCRUM-1518/sonda-1518-punta-a-punta.mjs` (necesita `dist/`).
- **Real:** el router del webhook (`dist/.../whatsappIncoming.routes.js`) montado como en `app.ts`, con
  su firma HMAC; `recordInboundWaMessage` y `updateWaMessageStatus`; la consulta de la ficha
  `historialWhatsAppDelCliente`; y la ficha `renderCustomer360View` con el chip `waDeliveryChip`, en el
  banco de vistas.
- **Doble:** la base, en memoria y por `require.cache`, y Meta (`WHATSAPP_DRY_RUN=1`). Es la técnica de
  `tests/scrum1262-la-baja-corta-todas-las-vias.test.mjs`. El secreto de la firma es aleatorio y se
  genera en cada pasada (ninguna clave escrita, A7), y el teléfono es del rango imposible: no sale nada
  hacia Meta y no se toca ninguna base.

**Resultado, salida 0 = reproducido:**

| paso | lo que pasa |
|---|---|
| ① webhook | `delivered` del envío → 200 · `warning` (estado desconocido) → 200 · el cliente escribe «hola» → 200 · **control:** con firma mala, 401 y 0 filas |
| ② qué se guarda | el envío: `type template · status delivered · relatedType quote`. El entrante: **`type inbound · status received · customerId` del cliente · `relatedType null` · `toPhone null`** |
| ③ qué devuelve la ruta | **las DOS filas**, la entrante primero: `where: { merchantId, customerId }`, sin `type` |
| ④ qué pinta la ficha | pestaña **«WhatsApp (2)»** · fila del entrante: Documento «—» · Estado **«✓ WhatsApp: Enviado»** · fila del envío: «Presupuesto» · «✓✓ WhatsApp: Entregado» |

**Control positivo:** el envío real sale «✓✓ WhatsApp: Entregado». Si no saliera, la sonda acaba en 2
(«no supe mirar»).
**Mutación:** con `type: 'template'` en el `where` de `historialWhatsAppDelCliente.js`, cambiado SÓLO en
`dist/` y restaurado después con `tsc`, la pestaña da «WhatsApp (1)» y la sonda sale con **1**, «NO
REPRODUCIDO». La sonda distingue el arreglo.

**¿Con qué estados llega el webhook? Lo que se puede decir sin la base:**
- **Leído en el código.** Los escritores dejan `queued`, `sent` y `failed` en los envíos, y `received` en
  los entrantes. El webhook sólo AVANZA a `delivered` y `read`, o pone `failed`: `shouldApplyStatus`
  (`whatsappLog.service.ts:259-271`) da rango −1 a un estado que no conoce y no lo aplica.
- **Ejecutado:** el `warning` del paso ① no cambió la fila, que siguió en `delivered`.
- **Así que el único estado alcanzable que el chip no conoce es `received`.**
- **Y sólo llega a la ficha del cliente.** Los entrantes llevan `relatedType null`, y los chips de
  presupuestos y facturas leen por `relatedType`/`relatedId` (`getDeliveryStatus` `:321`,
  `getDeliveryStatusMany` `:355`): nunca ven un entrante. El `|| map.sent` de `api.js:1448` está en las
  tres superficies, pero con el código de hoy sólo se dispara en la pestaña del cliente.
- **Lo que NO he podido medir:** qué estados hay DE VERDAD en la base de producción (filas antiguas,
  escritas con código anterior) y qué manda Meta en la práctica. Producción lleva congelada desde el
  21-oct, la base sólo la ve el fundador, y en staging no lo he intentado (pide el turno).

**Quién arregla qué (autorizado por el orquestador como arreglo de defecto, opción (A)):** el filtro de
entrantes en `historialWhatsAppDelCliente.ts` → S1; que el chip no diga «Enviado» de lo que no conoce
(`api.js`) → S2. Mostrar los entrantes con su propio rótulo es otra cosa: cambia lo que la pestaña firmó
en SCRUM-1133 («los WhatsApp que se le han ENVIADO»), y eso va al fundador como decisión de alcance.
