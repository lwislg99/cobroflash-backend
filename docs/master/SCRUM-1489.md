# SCRUM-1489 · El buscador de arriba pasa por las dos puertas: un Técnico encuentra sus presupuestos y sus facturas, no los de sus compañeros

**Medido contra:** `origin/main` = `bafb07340557298cd5bfde943d81ade8823d4a78` · 2026-10-06T19:33:14Z

A9: sin fallo que generalice — lo torcido de la tanda (una línea del test con un `.catch` de relleno, y la receta de transpilar tragándose el `.d.ts`) se vio antes de la primera pasada y no llegó a ningún sitio que otro lea

Sesión S1 (`s1-6octh`) · rama `scrum-1489-la-busqueda-recorta-al-tecnico`. Lo abrió S1 el 6-oct al leer
la ruta para SCRUM-1483. Es la fila 9 del censo de `docs/master/SCRUM-1390.md`.

## El defecto

`GET /admin/search` (`src/modules/search/app/routes/search.routes.ts`) filtraba por negocio y por nada
más. A un Técnico le devolvía, de cada presupuesto y de cada factura del negocio, el cliente, el total
y el estado. La regla estaba decidida desde el 1-oct-2026 (SCRUM-1346 c.17952, SCRUM-1390 c.17962,
citadas desde la cabecera de `accesoAlPresupuesto.ts`): un Técnico ve un documento si es su autor, si
lo tiene asignado o si el Trabajo es suyo. SCRUM-1403 y SCRUM-1397 la aplicaron a las listas y a las
fichas; el buscador se quedó fuera.

## El arreglo

| Qué | Dónde |
|---|---|
| La ruta pide el recorte a `wherePresupuestosVisibles` y a `whereFacturasVisibles` y lo pone en `AND` en sus dos consultas. `null` (el admin) = la consulta sale como salía | `search.routes.ts` |
| El motivo con que la ruta está abierta al Técnico decía «todo ello ya es visible para él». Dice ahora lo que la ruta hace | `src/core/http/adminRouteDeclarations.ts` |

No se ha escrito ningún criterio nuevo: «suyo» lo deciden las dos puertas que ya existían. El rol de
la ruta no cambia.

## Los clientes: no se recortan, y de dónde sale

No es una decisión de este ticket. El Técnico ya ve la cartera entera por `GET /admin/customers`
(declarada «Ver la cartera de clientes es trabajo de campo»; SCRUM-979 en `customersAdmin.routes.ts`:
«el técnico ve la cartera entera»), con la misma búsqueda por nombre, teléfono y email
(`customerAdmin.ts`). SCRUM-1403 dejó además la ficha del cliente abierta entera y recortó sólo sus
documentos. El buscador manda de un cliente `id`, `name`, `phone` y `email`: lo mismo que esa lista,
sin dinero. Recortarlo le quitaría al Técnico encontrar al cliente del trabajo que está haciendo.

## Cómo se ha medido

`tests/scrum1489-la-busqueda-recorta-al-tecnico.test.mjs`, 10 casos:

- **9 sin base** (corren siempre): la ruta real de `dist/` y las dos puertas reales, con Prisma doblado
  por tablas en memoria que evalúan cada `where` y lanzan con lo que no conocen. 8 presupuestos (5 de
  la Técnica, por autora, asignada, Trabajo, adicional y revisión; 3 ajenos) y 8 facturas (6 suyas, 2
  ajenas). Para el caso de la aceptación 4, las puertas se sustituyen por dos testigos y se comprueba
  que lo que contestan es lo que la consulta lleva.
- **1 con base** (`LIBRO_PG_URL`, declarado en `tests/scrum419-…`): la app real por HTTP contra Prisma
  de verdad, con una Técnica, su compañero y una administradora.

Seis mutantes sobre `search.routes.ts`, de uno en uno, con el `git diff --numstat` al lado; commit
`f9f0f80e819615c0fde30d80d767fcefd755bd70` antes de inyectar; base 9 de 9 (1 salta) antes y después;
árbol restaurado:

| Mutante | Casos que caen |
|---|---|
| M1 · la consulta de presupuestos pierde el recorte (es el código de antes) | 2, 6, 7 |
| M2 · la consulta de facturas pierde el recorte (el código de antes) | 3, 6, 7 |
| M3 · el criterio se copia en la ruta en vez de pedirlo a la puerta | 4, 7 |
| M4 · la ruta pregunta a las puertas como si fuera el admin | 2, 3, 6, 7, 8 |
| M5 · los clientes también se recortan | 2, 3, 4, 5, 8, 9 |
| M6 · las dos puertas cruzadas | 2, 3, 4, 5, 7, 8, 9 |

## Lo que NO se ha hecho o no se ha podido medir

- **El caso con base no ha corrido en local.** Esta máquina no tiene Postgres levantado y la memoria
  libre era de 1.2-1.4 GB. Su primera ejecución es la del check obligatorio.
- **El evaluador de la mitad sin base es mío, no es Postgres.** Dice que el filtro llega a la consulta y
  con qué forma. Qué filas deja fuera ese filtro en el motor lo dice el caso con base, y el criterio de
  cada puerta, sus tests (`scrum1403-…`, `scrum1397-…`).
- **`npm run build` y la tanda entera no se han corrido en local** (memoria por debajo del umbral de
  2.200 MB). Los tests corren contra un `dist/` hecho transpilando los 317 `.ts` de `src/` sin comprobar
  tipos; los tipos se han comprobado sólo de lo tocado y lo que importa (ver la entrega en Jira).
- **No visto en yaqu.app.** La cuenta QA es de propietario: hace falta una sesión de Técnico con un
  compañero que tenga documentos, que es lo que espera a SCRUM-1367.
- **Las cifras y los eventos de la ficha de cliente** (lo que SCRUM-1403 dejó pedido al fundador) no son
  de esta ruta y no se tocan.
- **La fila 10 del censo** (`GET /admin/albaranes/presupuestos`) y la 1 y la 4 no se han mirado aquí.
