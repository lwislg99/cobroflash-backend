# SCRUM-930 — Guardar plantilla con descripción y descuento

**Medido contra:** `origin/main` = `c4ea45bb2a106516fb8a250fa76b5c4febb6becc` · 2026-09-26T13:15:47Z

## PASO 0 (Sesión 1, 26-sep-2026): la premisa del ticket era medio falsa

| Pieza | Estado medido en el repo | Quién |
|---|---|---|
| Descripción | El presupuesto NO tiene descripción de documento: es la descripción **por línea**. Ya viaja en `lines` (JSONB) y `templates.routes.ts` la guarda sin mirarla. Se pierde en dos puntos del front: al guardar (`quotesView.js`, `saveTemplateBtn` arma cada línea sin `description`) y al cargar (`cargarPlantilla` llama a `addLine` solo con concept/qty/price/tax). `addLine` ya la sabe pintar. | S2, sin servidor ni esquema |
| Descuento | `QuoteTemplate` no tiene columna. La mitad de carga YA está construida (`quotesView.js`, SCRUM-926, lee `template.discountGlobalAmount`), pero solo le llega al duplicar. | ② ALTER → ③ S1 + S2 |
| Suplido | Fuera por decisión del ticket. | — |

**Decisión (orquestador, 26-sep-2026): IMPORTE, no porcentaje.** Mismo nombre, tipo y semántica que `quotes.discount_global_amount`. Los tres motivos están en la cabecera del `.sql`.

## Entregado en esta rama: el ② preparado

- `docs/sql/scrum-930-descuento-de-plantilla.sql`: `ALTER TABLE "quote_templates" ADD COLUMN IF NOT EXISTS "discount_global_amount" DECIMAL(12,2);`
- Generado offline con `node scripts/preview-migracion.mjs --desde`. Control positivo de 31 tablas. Veredicto ADITIVA. `prisma/schema.prisma` NO se toca en esta rama (regla 40).

## Lo que falta, en orden

1. **②** El equipo de Javier aplica el `.sql` en staging → `yaqu_dev_javier` → producción (con GO aparte).
2. **③ S1**: la columna en `schema.prisma`; `templates.routes.ts` la acepta en POST/PUT y la devuelve en GET; tests (una plantilla vieja sin columna se sigue cargando).
3. **S2**: enviar `discountGlobalAmount` y `description` por línea al guardar. Y en `cargarPlantilla`, pasar `description` y aplicar el descuento. ⚠️ La lectura de SCRUM-926 vive en `loadInitialData`, que es el camino del argumento `template` (el de duplicar), NO en `cargarPlantilla`, que es el de «📋 Usar plantilla» y el de las fichas. Hay que reutilizar ese gesto también allí.
