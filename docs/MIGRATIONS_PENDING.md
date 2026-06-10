# Migraciones de schema pendientes de aplicar a producción

> El deploy de Railway **NO** aplica el schema automáticamente (start = `node dist/index.js`).
> Hay que correr `prisma db push` manualmente contra la BD de producción **antes** (o justo
> al desplegar) de que el código use la nueva tabla/columna.

## SPAIN-1 · Serie anual de facturación — ✅ APLICADO en prod (2026-06-10)

`prisma db push` aplicado contra `autorack.proxy.rlwy.net` (Railway), autorizado por el usuario.
Diff previsualizado con `migrate diff` y confirmado seguro (3 operaciones, sin pérdida de datos):
- `ALTER TABLE merchants ADD COLUMN invoice_series_year INTEGER` (nullable, aditivo)
- `DROP INDEX invoices_number_key` (unique global de `number` — colisionaba entre merchants con el mismo prefijo)
- `CREATE UNIQUE INDEX invoices_merchantId_number_key ON invoices(merchantId, number)` (la serie es del emisor)

El create del índice compuesto no podía fallar: no existían duplicados `(merchantId, number)`
(el unique global previo lo garantizaba). Nadie consulta facturas por `number` solo (verificado por grep).

---

## ENT-3 · `CustomerEvent` (historial de comunicaciones) — ✅ APLICADO en prod (2026-06-05)

`prisma db push` aplicado contra `autorack.proxy.rlwy.net` (Railway). Diff confirmado
solo aditivo (CREATE TABLE customer_events + 2 índices + 2 FKs, sin DROP/ALTER).
Verificado: `customerEvent.count()` = 0. Instrucciones abajo conservadas como referencia.

---

### (Referencia) ENT-3 · `CustomerEvent`

**Commit del código:** ver feat(enterprise) ENT-3.
**Tabla nueva:** `customer_events` (modelo `CustomerEvent` en `prisma/schema.prisma`).
**Solo aditivo** (no toca tablas existentes): seguro con `db push`.

El código es tolerante: si la tabla aún no existe, `recordCustomerEvent` y
`listCustomerEvents` capturan el error y la app sigue funcionando (no se registra
ni se muestra historial hasta aplicar el push).

### Cómo aplicar (con la DATABASE_URL de PRODUCCIÓN)

```bash
# 1) Apuntar a la BD de prod (NO usar la de dev). Por ejemplo, temporalmente:
#    set DATABASE_URL=postgresql://...autorack.proxy.rlwy.net.../railway   (la real de Railway)
# 2) Aplicar el schema (sin TTY, como exige este entorno):
npx prisma db push --accept-data-loss
# 3) En Windows, si el DLL queda bloqueado tras el push: matar node y:
npx prisma generate
```

> Nota: `--accept-data-loss` aquí es seguro porque el cambio es **solo añadir** la tabla
> `customer_events`; no elimina ni altera columnas existentes. Verificar el diff antes si hay dudas.

### Verificación post-push
- En el dashboard, abrir la ficha 360 de un cliente con actividad (envía un presupuesto,
  acéptalo, etc.) → debe aparecer la sección "Actividad reciente".
- `GET /admin/customers/:id/detail` debe devolver `events: [...]`.
