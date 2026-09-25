# SCRUM-1014 · «Sitios» del cliente: agenda de direcciones de obra (servidor + esquema)

**Medido contra:** `origin/main` = `639a276ffbd6e4ce8ef89b7f8e81c72fad31c111` · 2026-09-25T11:45:01Z (cabecera `Date:` de `gh api -i zen`) · **Rama:** `scrum-1014-customer-site` · **Carril:** S1 · CRM.

## Alcance: tabla + servidor, SIN precarga y SIN el selector visible del documento

Condición del com. 16921 de Jira (delegación del fundador, mantiene P2/DOC-12 firmado): la
tabla `CustomerSite` es sólo una agenda de direcciones — nada la copia sola a
`Quote`/`Invoice.shippingAddress`. Esta rama construye la tabla y el CRUD del servidor. **Lo que
queda fuera, a propósito:**

- **El selector visible en presupuesto/trabajo** y cualquier rótulo nuevo de UI (botón «elegir
  sitio», textos de la agenda en la ficha del cliente): necesitan firma del fundador (regla 39).
  Propuesta dejada en el comentario de Jira; no se construye sin firma.
- **La agenda en la ficha del cliente** (pantalla): igual, pendiente de firma + carril de front.

## Lo que cambia

- `prisma/schema.prisma` · modelo `CustomerSite` nuevo (`@@map("customer_sites")`): `id`,
  `merchantId`, `customerId`, `name` (único obligatorio), `address/city/postalCode/province/country`
  (mismos cinco campos que `Customer.billingAddress`, todos nullable sin default), `contactName`,
  `phone`, `createdAt`/`updatedAt`. FK a `merchants`/`customers`, `ON DELETE RESTRICT` (mismo
  patrón que `CustomerEvent`). Back-relations `Customer.sites` / `Merchant.CustomerSite`.
- `docs/sql/scrum-1014-customer-site.sql` · `CREATE TABLE IF NOT EXISTS` + 2 índices + 2 FK,
  generado con `node scripts/preview-migracion.mjs --desde <schema sin el modelo>` (control
  positivo dentro). Aditiva, cero sentencias destructivas.
- `docs/MIGRATIONS_PENDING.md` · entrada nueva, **las tres bases sin marcar** (ver abajo).
- `src/core/validation/schemas.ts` · `customerSiteCreateSchema`/`customerSiteUpdateSchema` (Zod):
  mismos topes que los campos de dirección de `Customer`.
- `src/modules/system/domain/sitiosDelCliente.ts` · `listarSitios`/`crearSitio`/`actualizarSitio`/
  `borrarSitio`, todas con TENENCIA (merchant + cliente) — `null`/`false` si el cliente o el sitio
  no son de quien pregunta, nunca un 500 ni un dato ajeno.
- `src/modules/system/app/routes/customersAdmin.routes.ts` · `GET/POST /admin/customers/:id/sites`,
  `PUT/DELETE /admin/customers/:id/sites/:siteId`. Sólo códigos de error (regla 30: los textos
  los pone el front cuando tenga firma).
- `src/core/http/adminRouteDeclarations.ts` · las 4 rutas nuevas en `TECNICO_ALLOWED` (mismo
  criterio que `PUT /admin/customers/:id`: corregir una dirección desde la obra es trabajo de
  campo) — si no, `tests/scrum55-admin-fail-closed.test.mjs` las nombra en rojo.
- `tests/_merchant-fixture.mjs` · `customerSite` añadido a `MODELOS_POR_MERCHANT` (FK-RESTRICT,
  como `customerEvent`): sin esto, un test que deje un sitio vivo tumba `merchant.delete` con un
  error ruidoso en vez de limpiar.

## 🔴 NINGUNA base tocada — el PR NO ES MERGEABLE hasta aplicar el SQL en las tres

Esta sesión NO tenía `DATABASE_URL_DEV` en el entorno de su worktree (sólo `DATABASE_URL`, la BD
local de `npm run dev`, otro destino) y `yaqu_dev_javier` es del carril B — no se toca sin
pedirlo. Staging y producción, como siempre, las aplica el fundador. Regla de la casa (7-sep-2026):
el PR lleva el esquema, el SQL y `docs/MIGRATIONS_PENDING.md` sin marcar, todo junto.

## El juez: `tests/scrum1014-sitios-del-cliente.test.mjs` (GATEADO, patrón SCRUM-876)

Contra Postgres de verdad (cluster desechable propio, puerto 55433, fuera de cualquier base del
proyecto): tenencia en las cuatro funciones (merchant ajeno, cliente ajeno del MISMO merchant, id
de sitio que no existe), CRUD completo, orden estable, y un control explícito de que crear/editar
sitios **no** escribe `Quote.shippingAddress`/`shippingAddressMode` (P2/DOC-12 intacto).
**Verificado en rojo**: quitar el filtro `merchantId` de `crearSitio` tumba la aserción de tenencia
exacta (no otra puerta) — restaurado y confirmado verde otra vez.

`npm run build` limpio. Suite completa (`node --test tests/*.test.mjs`) corrida sobre esta rama;
resultado en el traspaso de la sesión (evita duplicar aquí un número que puede quedar viejo si
alguien vuelve a correrla).

## Para quien retome el selector del documento (front, con firma)

Diseño ya pensado, no construido: en presupuesto/trabajo, junto al campo de dirección de obra
(modo `personalizada`), una lista de los sitios del cliente (`GET .../sites`). Elegir uno rellena
el textarea con su dirección — **acción explícita del profesional**, el mismo botón que hoy no
existe para nada: no se dispara solo al cargar la pantalla ni al elegir el cliente. Eso es lo que
la condición de 16921 permite sin reabrir P2. El texto del botón, el de la lista vacía y el de
«nuevo sitio» necesitan la firma antes de escribirse.
