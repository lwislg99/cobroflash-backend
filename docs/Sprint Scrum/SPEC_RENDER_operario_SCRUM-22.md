# SPEC de render — nombre del operario en el Trabajo (SCRUM-22 §7)
Para el carril A (Luis), sobre `jobDetailView.js`. La escribe el asesor/carril B; la ejecuta Luis.
Aditivo, front-only, sin schema. Reglas 4 (vanilla), 30 (textos canónicos), DESIGN.md + skill yaqu-premium-ui.

## Contrato que consume (ya en `main`, PR #19)
`serializeJob` / `serializeJobDetail` (`jobs.routes.ts:36-43,82-83`) exponen:
- `operarioId: number | null`
- `operario: { id, name } | null` — TeamMember resuelto y scopeado al merchant (regla 2). `null` = Trabajo creado por el propietario (owner).

## Qué pintar
1. **Detalle del Trabajo — cabecera:** una línea `Operario: {nombre}`.
   - Si `operario` no es null → `operario.name`.
   - Si `operario` es null (owner) → **el nombre del merchant** (el mismo que ya se usa como marca/propietario en el front).
2. **Timeline de documentos:** en el evento de creación del Trabajo, atribuirlo → `Creado por {nombre}` (misma resolución que arriba, incluido el fallback owner).

## Fuente del nombre del merchant (para el caso owner) — a confirmar por Luis
Verificar si el front ya tiene el nombre del merchant disponible (p. ej. de `GET /admin/me`, junto a `appUserRole`).
- Si SÍ → usarlo directo en el render.
- Si NO → dos opciones aditivas: (a) añadir `merchantName` a `/admin/me` (aditivo), o (b) exponer un `operarioNombre` ya resuelto con fallback en el serializer (aditivo). Recomiendo (a): un dato, reutilizable.

## Restricciones
- 🚨 NO se toca `homeView.js`. Solo `jobDetailView.js` (carril A).
- Digno 390/1280; tokens de `public/tokens.css`; sin copy inventado (el nombre es dato real).
