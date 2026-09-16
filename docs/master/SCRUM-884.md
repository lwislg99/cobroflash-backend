# SCRUM-884 · El importador CSV de clientes guarda y deduplica el teléfono con la regla del alta

**Medido contra:** `origin/main` = `4b0d5739bc19e7bad5109a32822ef7039d9ca860` · 2026-09-16T13:45:37Z
**Rama:** `scrum-884-importador-normaliza-telefono` · **Carril:** Sesión 4 · **Gate:** sin gate

> `normalizePhone` sola no arreglaba el caso del ticket. La regla del alta son DOS piezas que ya
> existían, y hacía falta usar las dos.

⏱ Hora **de GitHub** (cabecera `Date:` de `gh api -i zen`), no la del reloj local.

---

## 0 · PASO 0 — el defecto, corriendo

Script de scratchpad contra `dist/` de `origin/main`, con una tabla falsa con la semántica de Prisma
que importa aquí (`findFirst` con `OR` de igualdades exactas; lo creado se ve en la búsqueda
siguiente). CSV `nombre;telefono` con `Pepe;612 345 678` y `Pepe;+34 612345678`:

| | creados | omitidos | guardados |
|---|---|---|---|
| antes | **2** | 0 | `"612 345 678"`, `"+34 612345678"` |
| después | **1** | 1 | `"612345678"` |

## 1 · Lo que el enunciado no sabía

El encargo decía «el importador usa la MISMA `normalizePhone` que el alta, para guardar y para
detectar duplicados». Medido: **eso no arregla el caso**. `normalizePhone('612 345 678')` da
`612345678` y `normalizePhone('+34 612345678')` da `34612345678`: no resuelve el prefijo de país,
y está fijado así a propósito (`identificadoresDuplicados.ts`, SCRUM-578).

El alta usa DOS piezas, y el importador ahora usa las mismas dos. No se escribe ninguna nueva:

- **Guardar:** `normalizarIdentificadores` de `customerAdmin.ts`, la función del alta
  (`normalizePhone(x) || x`). Se **exporta**: una palabra, el mismo comportamiento. No se movió
  de fichero porque el guard ② de SCRUM-579 vigila los normalizadores **de ese fichero**: moverla
  la habría sacado de su población.
- **Buscar duplicados:** `formasBuscables`, la del aviso de duplicado del alta (con y sin `34`,
  con `+`, y el texto tal cual). El filtro sigue siendo por igualdad, dentro del merchant.

## 2 · Mi error, cazado por el test

Mi primera versión le pasaba a `formasBuscables` el teléfono **ya normalizado**. Su «texto tal
cual» dejaba de ser la celda, y una fila vieja guardada sin normalizar (`+34 000 000 001`, de antes
de SCRUM-578) **dejaba de encontrarse con el mismo texto**, cuando hoy sí se encuentra. Añadí ese
positivo, cayó en rojo contra mi versión (10 tests, 9 pass, 1 fail) y la corrección busca por las
formas de la celda cruda.

## 3 · El test y sus controles

`tests/scrum884-importador-normaliza-telefono.test.mjs`, 10 tests. Números en el rango imposible
de SCRUM-262 (`tramoNacionalDePrueba`), no el móvil del enunciado.

| pasada | tests | pass | fail |
|---|---|---|---|
| código de `origin/main` | 10 | 5 | 5: los tres del caso (dos órdenes y contra la base), el normalizador del alta y el extranjero guardado crudo |
| con el arreglo | 10 | 10 | 0 |
| suelo inyectado (toda fila rechazada) | 10 | 0 | 10, todos con «NO PUDE MIRAR» |

Los cinco verdes contra el código original son los positivos y el negativo: duplicado exacto, fila
vieja sin normalizar, texto que no es teléfono, dentro del merchant, y las filas existentes no se
reescriben. Estaban verdes antes y siguen verdes: miden regresiones, no el cambio.

## 4 · Lo que no se tocó

Schema, textos visibles, exportación, validación del formulario (`schemas.ts`), filas ya guardadas
(el importador sólo busca y crea). El alta sigue llamando a la misma función: el único cambio en
`customerAdmin.ts` es el `export`.

⚠️ **Riesgo heredado, no nuevo:** un móvil extranjero de 9 dígitos guardado sin prefijo se compara
como español. Ya estaba declarado en `canonParaComparar` (SCRUM-578). El importador lo hereda al
usar la misma regla.
