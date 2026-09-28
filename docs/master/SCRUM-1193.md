# SCRUM-1193 · El «⋯» de acciones secundarias medía 30 px: sube a 44 × 44 en el componente

**Medido contra:** `origin/main` = `15ccc41e94948b2851161789eb17ee1dcc30afd9` · 2026-09-28T14:53:08Z

## Inventario (antes de tocar nada)

`overflowMenu()` (`public/dashboard/js/api.js`) crea el disparador con `overflow-trigger btn-ghost btn-sm`.
`.btn-sm` fija `min-height: 30px`. Nueve llamadas en siete pantallas:

| Pantalla | Llamada | Antes |
|---|---|---|
| Editor de presupuesto · líneas | `quotesView.js` (acciones de la línea) | 44: `.quote-line__actions .overflow-trigger` |
| Editor de presupuesto · cabecera | `quotesView.js` (guardar plantilla / limpiar) | 44: `.quotes-header-row .overflow-trigger` |
| Lista de Trabajos | `jobsView.js` | 44: `.jobs-pantalla .btn-ghost` + `min-width` |
| Gastos | `expensesView.js` | 44: `.gastos-pantalla .overflow-trigger` |
| **Ficha del Trabajo** (cabecera y filas de documentos) | `jobDetailView.js` ×2 | **30** (S3 midió 30,7 a 929 y 31,0 a 390) |
| **Detalle del albarán** | `albaranDetailView.js` | **30** |
| **Detalle de la factura** | `invoiceDetailView.js` | **30** |

## El patrón decidido

**En el componente, no pantalla a pantalla.** El «⋯» es el mismo control en todas partes y AB6 no tiene
excepciones por pantalla: cuatro pantallas ya lo subían a mano, y cada pantalla nueva que lo usara
nacería en 30. En `styles.css`:

```css
.overflow-trigger.btn-ghost.btn-sm,
.overflow-trigger { min-width: 44px; min-height: 44px; }
```

`(0,3,0)`: las clases exactas del componente ganan a `.btn-sm` y a `.btn.btn-sm` sin `!important`, igual que
`.accion-irreversible-btn-44` (SCRUM-1167). Nada rebaja el «⋯» (comprobado: ninguna regla, con
descendiente o en `@media`, le pone menos de 44). Las cuatro reglas por pantalla quedan redundantes pero
no estorban; no se tocan (sus tests las leen, p. ej. `scrum139`).

⚠️ **Toca una pantalla de Javier** (detalle de la factura): el «⋯» pasa de 30 a 44 px allí también. Es el
componente compartido, no su fichero; lo digo para que lo sepa.

## Cómo se prueba

- `tests/scrum1193-mas-acciones-44.test.mjs` (check obligatorio): resuelve la cascada para las clases que
  `overflowMenu` pone, **leídas de `api.js`**; `min-height` y `min-width` ≥ 44 sin `!important`; control:
  sin `overflow-trigger` se queda en 30; ninguna regla lo baja; la excepción del guard está retirada.
  En rojo: sin la regla caen 2.
- **En navegador** (`npm run guard:objetivo-tactil`, Edge): la ficha del Trabajo cumple a 929 y a 390 con
  la lista de excepciones VACÍA. El «⋯» mide **44 × 44** en los dos anchos (`getBoundingClientRect`).
- Captura a 390 px (página completa): el «⋯» junto a «Confirmar Bizum recibido» en la fila de la factura,
  círculo de 44 px (en el tmp del job, no en el árbol).

## Guard táctil

- `EXCEPCIONES_791.renderJobDetailView`: la excepción del «⋯» **se retira** (ya no tiene causa).
- `distintosEsperados` de la ficha: **1 → 0, RETIRADA A PROPÓSITO porque el código mejoró** (la excepción
  medida de la regla 41). El cero no es ceguera: siguen `conocidos` (los botones de cobro, con nombre) y
  las sondas del umbral.

El commit `WIP SCRUM-1193 …` de esta rama es el mismo trabajo, aparcado un rato por cambio de prioridad;
se completó con este registro.
