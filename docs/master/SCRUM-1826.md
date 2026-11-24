# SCRUM-1826 · El guard de la lista de facturas espera la cabecera «Acciones» (decisión del fundador)

**Medido contra:** `origin/main` = `8e0d408168865aab0c7862d7c004cf864450aa71` · 2026-11-24T11:43:10Z (cabecera `Date:` de GitHub)

A9: aviso → A10 «Un detector que acierta y publica donde nadie lee produce el mismo resultado que uno ciego.» — no se pudo comprobar: el desajuste (1787n cambió la cabecera y su test obligatorio, pero no la pieza que declara el guard de navegador) solo lo ve el job «guards de navegador», que no está en el check obligatorio; meterlo ahí es tocar un workflow (S5 y fundador)

Carril J1 (área del ticket, etiqueta `area-j1`). El único fichero de código que cambia es `scripts/guard-lista-trabajos.mjs`: `node scripts/carriles.mjs de` → «SIN CERRADURA», sólo lo cubre la fila general de `scripts/`. Nada en `src/`, `public/` ni `prisma/`. Encargo del orquestador J (`cobroflash-backend-2d`), sesión `jv-j1jr`, rama `scrum-1826b-guard-espera-acciones`.

## 1826b — la pieza declarada de la columna de acción pasa a `<th>Acciones</th>`

### La medición (jv-j1jq, SCRUM-1826 c.22572, resumida)

- `node scripts/guard-lista-trabajos.mjs` sobre `main` daba 1 hallazgo: «Facturas NO trae lo declarado por SCRUM-1562g · … el `<th>` sin texto de la columna «Ver detalle»: 0 de 1».
- 1562g había declarado en `PIEZAS_1562g` un `<th></th>` VACÍO (commit `2f7adc4d5`). 1787n lo cambió a `<th>Acciones</th>` (commit `b4c2cb610`) por la orden de SCRUM-1787 «facturas iguales que presupuestos», y su test obligatorio `tests/scrum1787n-lista-de-facturas-como-presupuestos.test.mjs` ① exige «Acciones». 1787n puso al día el test de 1562g, pero no la pieza del guard de navegador.
- Volver la pantalla a `<th></th>` choca con 1787n ① y con la orden de 1787; el otro arreglo es cambiar la pieza declarada del guard (regla 41 → decisión del fundador).

### La decisión (SCRUM-1826 c.22585)

Elección del fundador: «El guard pasa a esperar «Acciones»». La pieza declarada de esa columna pasa de `<th></th>` a `<th>Acciones</th>`, citando ese comentario; la pantalla no cambia. Mismo precedente que SCRUM-1562 c.21143.

### El cambio

En `scripts/guard-lista-trabajos.mjs`, `PIEZAS_1562g`, sólo la segunda pieza: el nombre pasa a «el `<th>Acciones</th>` de la columna «Ver detalle»», la expresión de `\n[ \t]*<th([^>]*)><\/th>` a `\n[ \t]*<th([^>]*)>Acciones<\/th>`, y una línea de comentario con «SCRUM-1826 · decisión del fundador (c.22585…)». Recuento esperado (1), sustituto (sin atributos → se quita), la pieza del `colspan` y el resto del guard: sin tocar.

### Corrido (local, Edge de Windows, sobre la base `8e0d408168865aab0c7862d7c004cf864450aa71`, 127 ficheros de `public/`)

| pasada | Facturas | veredicto |
|---|---|---|
| pieza vieja `<th></th>` (el fichero de `main`, antes del cambio) | «colspan … 1 de 1 · el `<th>` sin texto … 0 de 1» | 1 hallazgo · 0 ciegos → salida 1 (19 s) |
| pieza nueva `<th>Acciones</th>` | «✅ Facturas · a659ec4c7a7f8e0e · idéntico a la base (que ya trae SCRUM-1562g)» | salida 0 · 20 comprobaciones ✅ y ninguna 🔴 (Trabajos ①–⑤, Presupuestos, calibraciones Ⓐ y Ⓑ, Albaranes, Clientes, Facturas) |

El control se repite con `git checkout 8e0d40816 -- scripts/guard-lista-trabajos.mjs`, el guard, y `git checkout HEAD -- scripts/guard-lista-trabajos.mjs` para volver. El guard no tiene test propio que nombre la pieza (buscado `PIEZAS_1562g`, `<th>` y `1562g` en los tests que citan `guard-lista-trabajos`: ninguno).

**No medido:** el job «guards de navegador» de CI (sólo local); yaqu.app (la pantalla no cambia); la suite entera (el encargo la excluye). La línea de comentario de cabecera de la sección (la que habla del «`<th>` sin texto de la columna nueva») se ha dejado como está, porque el encargo pide no tocar nada más del guard: la explicación vigente está en la línea de la pieza.
