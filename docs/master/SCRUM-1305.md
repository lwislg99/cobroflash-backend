# SCRUM-1305 · Las dos listas de borrado: qué es «genérico», qué es «fuera», y un rojo que dice qué hacer

**Medido contra:** `origin/main` = `0e86f5def492e4a7dea3cffaca6704de513db149` · 2026-09-30T23:19:12+01:00
(J6 del equipo de Javier; decisión C aprobada por el orquestador `cobroflash-backend-47`)

A9: comprobación → `tests/scrum314-wipedemo-derivado.test.mjs`

## ① Alcance medido

`FUERA_DEL_BARRIDO_GENERICO` (`src/modules/system/domain/borradoMerchant.ts`) tiene **5 entradas**.
Solo 2 llevan `merchantId`, que son las que ve `scrum314`:

| Modelo | `merchantId` | Qué significa «fuera» | Paso propio en `barridoDemo` |
| --- | --- | --- | --- |
| `botSession` | sí (nullable) | se borra por OTRA VÍA (teléfono) | sí, paso 3 (desde SCRUM-314) |
| `jobAssignee`, `quoteAssignee`, `invoiceAssignee` | no | caen EN CASCADA | no hace falta |
| `vfSubmission` | sí | NO se borra (SCRUM-1127b, decisión 3) | sí, paso 1bis (SCRUM-1296) |

Exclusión por POLÍTICA: una sola (`vfSubmission`). **Deuda, no patrón.**

## Premisa corregida

- **Ningún mecanismo lee `FUERA_DEL_BARRIDO_GENERICO` al ejecutarse** (grep de `src/` y `scripts/`).
  `borrarMerchant` no la «respeta»: como `barridoDemo`, no la recorre.
- La asimetría está en los **guards**: `scrum192` y `scrum244` aceptan la lista como cobertura
  DECLARADA; `scrum314` exige que el demo BORRE.
- El nombre: «genérico» es preciso (el `deleteMany({ merchantId })` del orden). El equívoco está en
  «fuera», que mezclaba «se borra de otra forma» (4) con «no se borra» (1).

## Decisión (C) y lo construido

- **No se deriva** el paso del demo desde la lista. Con una exclusión por política, qué hace el demo
  es una pregunta que hay que hacerse cada vez; derivarla la contestaría sola. La opción B (marcar
  cada entrada con su destino) creaba una categoría para una sola entrada: una excepción con otro
  nombre.
- **Código:** el comentario de `FUERA_DEL_BARRIDO_GENERICO` dice qué es «genérico», los tres
  destinos, que nadie la lee al ejecutarse y que toda entrada con `merchantId` necesita su paso en
  `barridoDemo`. También corrige su primera línea, que decía «Modelos con `merchantId`» y 3 de 5 no
  lo tienen.
- **Guard:** en `scrum314` cambia **sólo el mensaje** del test de cobertura (OK explícito del
  orquestador). La condición (`assert.deepEqual(olvidados, [])`) es la misma. Si el olvidado está
  declarado fuera, el rojo dice que `barridoDemo` no recorre esa lista y que hay que escribirle su
  paso, como `vfSubmission` o `botSession`. Si no lo está, dice que se añada al orden.
- **No tocado:** el paso 1bis de `barridoDemo` y su control negativo, `borrarMerchant`, `scrum192`,
  `scrum244` y el esquema.

## Rojo visto y control de que la condición caza lo mismo

Mutaciones en `dist/`, restauradas por sha256. Cada una se corrió contra el `scrum314` nuevo y
contra el de `origin/main`, copiado temporalmente y borrado después:

| Mutación | `scrum314` de `origin/main` | `scrum314` nuevo |
| --- | --- | --- |
| sin mutar | verde | verde |
| M1 · quitar el paso de `vfSubmission` en `barridoDemo` | rojo: `vfSubmission` | rojo: `vfSubmission` + «está en FUERA_DEL_BARRIDO_GENERICO… escríbele su paso» |
| M2 · quitar `expense` del orden (no declarado fuera) | rojo: `expense` | rojo: `expense` + «Añádelo(s) a ORDEN_BORRADO_MERCHANT» |

Viejo y nuevo caen en los mismos casos: la condición no cambió.

**Controles del encargo:**
- Positivo del botón: `tests/scrum1296-esquema-cola.test.mjs` (la cola del demo cae y la de otro
  comercio no) y el resto de `scrum314`, en verde.
- «Un comercio real con registros sigue fallando»: el RESTRICT de las dos `@relation` lo fija
  `scrum1296-esquema-cola`. El código de `borrarMerchant` no se ha tocado.

**Tanda de alrededor:** `scrum314`, `scrum192`, `scrum244-colgados`, `scrum1296-esquema-cola`,
`scrum525d` y `scrum237`: 63 tests, 63 pass, 0 fail, 0 skipped.

## Hallazgo aparte (NO de este ticket; lo abre el orquestador)

Con envíos dentro, `borrarMerchant` acaba en rojo (`ok=false`; errores: `invoice` y `merchant`),
pero **tarde**. Antes ha borrado 13 modelos, `auditLog` incluido, que desde SCRUM-207 guarda el
registro fiscal. Hoy es inalcanzable: 0 llamadores. Medido con un doble en Jira, comentario 17655.
