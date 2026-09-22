# SCRUM-1062 · Qué WhatsApp se han enviado al cliente y en qué estado, en su ficha

**Medido contra:** `origin/main` = `5588e3263847bd40ea906d325e4f83c883c24e6e` · 2026-09-22T08:11:48Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-1062-historial-whatsapp-cliente`

## STOP: canal WhatsApp, SOLO LECTURA

No se tocó `src/integrations/whatsapp.ts`, ninguna plantilla ni la tabla anti-spam (J6). No se
manda nada nuevo: la ruta solo LEE `WhatsAppMessage`, que ya existía (WA-0b) y hasta hoy solo se
leía por documento (`relatedType`/`relatedId`), nunca por cliente.

## Lo que hace

- `src/modules/system/domain/historialWhatsAppDelCliente.ts`: cliente por `(id, merchantId)` (404
  si no es suyo); sus mensajes por `(merchantId, customerId)`, 20 por página con cursor (como
  `historialDelCliente`, SCRUM-980); `waOptOut` del CLIENTE, una vez, no por fila.
- Ruta fina `GET /admin/customers/:id/whatsapp` en `customersAdmin.routes.ts`, hermana de
  `/historial`, mismo patrón de cursor `?despuesDe=<id>`. Rol: `requireRole('admin')` — a
  diferencia de `/historial` (trabajos del cliente, campo del Operario, SCRUM-980), esto es el
  registro de ENVÍOS/entregas de WhatsApp, más cerca de facturación/comunicación que de la
  visita en obra; sin un motivo de campo explícito se queda en el default de S1 (Admin-only).
- NO se enseña texto de conversación porque no se guarda — `WhatsAppMessage` solo tiene tipo,
  plantilla, estado y el documento relacionado. No es un recorte de esta pantalla: es lo que hay.
- Un documento borrado no se lleva el mensaje por delante: `WhatsAppMessage` es tabla SUELTA (sin
  FK, patrón ENT-3) a propósito para tolerar el error si aún no existe en prod; borrar la factura
  no borra el mensaje que la citó, y la fila sigue saliendo con su `relatedId` tal cual.
- Estados que la tabla no reconozca se enseñan tal cual — no se inventan etiquetas (STOP del
  ticket): la ruta no traduce ni filtra `status`.
- Sin índice nuevo: `WhatsAppMessage` no tiene `@@index([customerId])`, pero sí tiene
  `merchantId` en el `where` (regla 2) y ya lleva `@@index([merchantId, createdAt])`. Añadir un
  índice por `customerId` sería ALTER — fuera de alcance mientras la tabla siga siendo pequeña; se
  declara, no se arregla aquí.

## El juez: `tests/scrum1062-historial-whatsapp-cliente.test.mjs`

Gateado (banco desechable o staging), declarado en `GATEADOS_DECLARADOS` de 419 (`scrum419-...`).
**No se pudo correr en esta sesión: no hay un Postgres desechable montado en esta máquina/turno.**
El fichero sigue el MISMO patrón probado de `scrum980-historial-del-cliente.test.mjs` (mismo
fixture `withMerchant`, mismo estilo de aserciones) y cubre:

- **Tenencia**: cliente de otro merchant → `null` (404); sus mensajes no aparecen en la ficha de Ana.
- **Sin mensajes**: no lanza, `mensajes: []`.
- **Documento borrado**: se crea una factura, se le manda un WhatsApp, se BORRA la factura — el
  mensaje sigue en la ficha con su `relatedId` intacto.
- **`waOptOut`**: se lee del cliente, no depende de si tiene mensajes.
- **Páginas de 20 con cursor**: 22 mensajes → dos páginas sin huecos ni repetidos.

`npm run build` limpio. `guards:entrada` 95/95 (incluye SCRUM-419, que ya reconoce el nuevo
gateado y sigue diciendo «0 fallos NO incluye estos»). Censos de tenencia 348/737 en verde.

## Declarado, sin arreglar aquí

- `WhatsAppMessage` sin índice por `customerId`: aceptable con el volumen de hoy; si la tabla
  crece, es un ALTER aparte (regla 3, protocolo del máster).
- La pestaña de la ficha (front, S2) y su microcopy firmado quedan fuera de este PR (servidor).

## Errores propios

La ruta se abrió sin `requireRole`: la red fail-closed de SCRUM-55
(`tests/scrum55-admin-fail-closed.test.mjs`) la cazó en el CI del PR («toda ruta /admin declara
rol»), en rojo en el check obligatorio. Corregido añadiendo `requireRole('admin')` — el default
de S1 — con el motivo explicado arriba; no se tocó el guard.

Fuera de eso, ninguno que declarar: se replicó el patrón ya probado de SCRUM-980 sin desviarse,
y el punto de mayor riesgo (que un documento borrado callara el mensaje) se resolvió por diseño
del esquema (tabla sin FK) y se dejó como caso explícito del test, no como suposición.
