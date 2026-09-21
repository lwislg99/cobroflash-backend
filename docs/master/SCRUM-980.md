# SCRUM-980 · El historial de trabajo en la ficha del cliente (v1 sin fotos)

Partido en dos PR, decisión de S1 comunicada al orquestador: **primero la ruta con su rojo**
(esta), **después la pestaña** (apéndice más abajo cuando entre).

## Mitad 1 · la ruta `GET /admin/customers/:id/historial`

**Medido contra:** `origin/main` = `6b0d92e425157ff3a8c1512bccd224f7e000e03d` · 2026-09-21T08:02:48Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-980-historial-ruta`

### Medido antes de construir

- `GET /admin/jobs` trae 200 filas y solo filtra por operario; `GET /admin/partes` **no recorta por
  rol** (el técnico ve los partes de todo el negocio). No había forma de pedir «los trabajos de este
  cliente».
- `Job` no tiene relación declarada con `Quote` (solo `quoteId`), `Albaran` no lleva `customerId` y
  `ParteTrabajo.customerId` es opcional y **no guarda autor**.

### Lo que hace (`src/modules/system/domain/historialDelCliente.ts`, ruta fina en `customersAdmin.routes.ts`)

- Cliente por `(id, merchantId)` → si no es suyo, `null` y la ruta da **404**.
- Sus trabajos por `(merchantId, customerId)`, **20 por página** con cursor (`?despuesDe=<jobId>`),
  y `siguiente` solo si hay más.
- Título de cada trabajo por **`tituloDeTrabajo()`** (SCRUM-944b), nunca `Job.titulo` crudo: el
  presupuesto se trae aparte, por sus ids y con `merchantId`.
- Partes de esos trabajos y, **sin recorte**, los **sueltos** del cliente (`jobId` nulo).
- Albaranes de esos trabajos con **cuántas fotos** tiene cada uno (`attachment.groupBy`,
  `entityType 'albaran'`, con `merchantId`). v1 no manda ninguna foto.
- **Próxima visita:** el trabajo `agendado` con `scheduledAt` más cercano **a partir de ahora**, entre
  todos los que quien mira puede ver. Sin ninguna, la clave **no viaja** (ausente no es cero).
- **`merchantId` en cada consulta**, también en las que van por ids ya acotados.
- **Técnico** (`seesOnlyOwnJobs`): sus trabajos por los tres ejes de SCRUM-650, los partes de ESOS
  trabajos y **ningún parte suelto** (sin autor en el esquema, no se le puede atribuir).
- Declarada en `adminRouteDeclarations.ts` (`TECNICO_ALLOWED`). Sin índice nuevo.

### El juez: `tests/scrum980-historial-del-cliente.test.mjs`

Gateado (banco desechable o staging), declarado en `GATEADOS_DECLARADOS` de 419. Rojo contra main:
el módulo no existía (`ERR_MODULE_NOT_FOUND`). Verde contra un Postgres 16 propio: **1 pass · 0 fail · 0 skipped**.
El peso lo llevan las mutaciones sobre el `dist`, con la base en verde antes y después:

| mutación | cae con |
|---|---|
| M1 · sin el recorte del técnico | «el técnico ve trabajos que no son suyos» |
| M2 · la consulta de trabajos sin `merchantId` | el suelo: «debía ver 4 trabajos y ve 5: INTRUSO…» |
| M3 · partes sueltos también al técnico | «al técnico le sale un parte suelto, que no tiene autor» |
| M4 · «próxima» admite fechas pasadas | «la próxima visita no es el agendado futuro más cercano» |

### Declarado, sin arreglar aquí

- **`GET /admin/partes` no recorta por rol**: un técnico ve en esa lista los partes de todos. Aquí
  no se replica; es un hallazgo de otro alcance y se reporta.
- Los partes sueltos no se paginan (son del cliente, no de la página de trabajos).
