# SCRUM-1141 · Campo NIF en la pantalla de proveedores

**Medido contra:** `origin/main` = `942e90d1f84dd6d7fcf5fa92aad48f36758c2d87` · 2026-09-26T11:45:00Z
**Rama:** `scrum-1141-nif-proveedor-pantalla`.
**Sesión:** S2 (front). **Skill UI:** cargada (`yaqu-premium-ui`).
**Hermano de:** SCRUM-960 (servidor, en main desde PR #1533).

## PASO 0 (26-sep-2026, contra `origin/main` 942e90d1)

- `public/dashboard/js/providersView.js` no tenía ningún campo `taxId`.
- El servidor sí: `POST`/`PUT /admin/providers` aceptan `taxId`; `null` o `""` = sin constar
  (en el `PUT`, BORRA el guardado); NIF que no cuadra → 400 `taxId_invalido`. El `GET` ya lo devuelve.
- **Esquema:** `taxId` ya existe en `model Provider` (`@map("tax_id")`, nullable, E4/SCRUM-441).
  Este cambio **no toca `prisma/schema.prisma`**: no hay ALTER pendiente.

## Qué se construyó

`public/dashboard/js/providersView.js`:
- Campo NIF en el alta («Nuevo proveedor») y en el modal «Editar proveedor»; al editar se
  rellena con el NIF guardado.
- `taxId` viaja en el `POST` y en el `PUT`; vacío → `null`.
- `taxId_invalido` se traduce en `mensajeDeErrorProveedor` (nunca el código crudo).
- No se valida en el navegador: valida el servidor (negativo del ticket). `guardarNifDelProveedor`
  y el alta de gasto no se tocan.

## Textos

Firmados por el orquestador (cobroflash-backend-06) por delegación del fundador, regla 39,
26-sep-2026. Los tres son literales que ya estaban en pantalla en otro sitio:

| Sitio | Texto | Origen |
|---|---|---|
| Etiqueta (alta y edición) | `NIF/CIF (opcional)` | ficha del cliente, `customerDetailView.js` |
| Ejemplo del campo | `B12345678` | NIF del proveedor en Gastos, `expensesView.js` |
| Error del servidor | `Ese NIF/CIF no es válido. Compruébalo.` | ficha del cliente, SCRUM-575 |

## Verificado

- `tests/scrum1141-nif-en-la-ficha-del-proveedor.test.mjs`, sobre la pantalla MONTADA en el
  banco de vistas: 3/3 verde; **3/3 rojo** contra `providersView.js` de main sin el cambio.
- Suelo: los 8 ficheros de test existentes que nombran `providersView` → 83/83.
- **Límite declarado:** el modal de EDITAR no se ejercita en el banco (su mini-DOM no resuelve
  `[name=…]` dentro del modal, ya documentado en SCRUM-785). Se mide en `yaqu.app` tras el despliegue.
