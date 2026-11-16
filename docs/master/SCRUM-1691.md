# SCRUM-1691 — PILOTO-1 · «Partes por valorar»: la fila trae el cliente

**Medido contra:** `origin/main` = `358e2a1bbd5a5d8c0868ae6db01a11fe44615604` · 2026-11-11T11:27:39Z (cabecera `Date:` de `gh api -i zen`) · **Rama:** `scrum-1691-cliente-en-partes-por-valorar` · **Carril:** S1 · partes.

A9: comprobación → `tests/scrum1691-cliente-en-partes-por-valorar.test.mjs`

> Puesto S1 (servidor). Origen: SCRUM-1686 c.21459 (X2, anomalía a). **Es el mismo arreglo que 1680-C**
> (pedido por S2 en SCRUM-1680 c.21460): este PR cierra los dos. El registro de 1680 es de S2 y no se toca
> desde aquí; se dice en los dos tickets.

## El defecto

`GET /admin/partes/oficina/pendientes` (`src/modules/jobs/app/routes/partes.routes.ts`) serializaba los partes
firmados sin resolver el cliente: `serializeParteParaLaOficina` lee `parte.clienteNombre`, que en la fila de la
base no existe, y la columna llegaba siempre `null` (en pantalla, «—»). Al abrir el MISMO parte, `findParte` sí
lo resuelve con `nombreDelCliente` (id + merchantId).

## El arreglo (sin texto nuevo)

- `nombresDeClientes(merchantId, customerIds)`: el criterio de `nombreDelCliente` (id + `merchantId`, `null` si
  no hay o si no es de este merchant), en **una** consulta para toda la lista, no una por fila (hasta 200).
- La ruta lo llama y pasa `clienteNombre` a `serializeParteParaLaOficina`, como `findParte`.

## Rojo primero

`tests/scrum1691-cliente-en-partes-por-valorar.test.mjs`: la ruta de verdad desde `dist/`, con la base doblada
(`_envio-doblado.mjs`) y un doble que evalúa el `where` (tenencia incluida). **Sin** el arreglo: **3 ✖ / 2 ✔**
(nombre, regla 2 con su control positivo y coste constante; el SUELO y «sin cliente → null» en verde).
Con el arreglo: 5/5. Junto a los otros bancos de esta ruta (`tecnosel-precios-tras-firmar`, `scrum1560`, `scrum1226`): 30 ✔ / 0 ✖.

## Pendiente de verificar

- En yaqu.app, después del merge: la fila de «Partes por valorar» de un parte firmado con cliente enseña su nombre.
