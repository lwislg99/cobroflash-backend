# SCRUM-917 · la lista de Trabajos

> Las primeras entregas de SCRUM-917 (prototipo y botones, #1475 y #1477) no dejaron expediente
> aquí. Este fichero empieza con la parte de servidor que pidió la lista nueva (917c, Sesión 2b).

## SCRUM-917d · GET /admin/jobs trae el nombre PROPIO del Trabajo, a secas

**Fecha:** 18-sep-2026 · **Carril:** S1 (servidor) · **Pedido por:** el orquestador, para la S2b (917c)
**Medido contra:** `origin/main` = `27a7fb8b3755b9f00f5bcc74bc48b42ff0ed2037` · 2026-09-18T07:36:42Z
**Tanda:** pendiente de turno (se anota aquí al correrla)

### El defecto, medido antes de escribir (PASO 0, staging, solo lectura)

La lista pinta el cliente en su propia columna. La fila de `GET /admin/jobs` sólo traía `titulo`, que
ya llega DERIVADO por `tituloDeTrabajo`: sin nombre puesto, «Presupuesto #N · cliente». La pantalla
no podía distinguir un nombre escrito de uno fabricado, y repetía el cliente.

```
población: trabajos devueltos = 15   (merchant QA de staging, servido por 27a7fb8b)
claves de la fila: albaranes, asignados, assignedUserId, createdAt, customer, direccion, …, titulo, …
con Job.titulo = 3 · sin Job.titulo = 12
  SIN titulo crudo → la API dice titulo = "Presupuesto #5 · María López" (job 3099)
```

Ninguna clave de la fila llevaba el crudo.

### Lo que se hace

- `tituloPropioDeTrabajo(job)` en `src/modules/jobs/domain/trabajoDirecto.ts`, al lado de
  `tituloDeTrabajo`: `Job.titulo` tal cual, o `null`. **El criterio de «tiene nombre» es el mismo**
  que la primera línea de `tituloDeTrabajo` (`if (entrada.titulo)`): si hay nombre propio, es el título.
- `serializeJob` añade `tituloPropio: tituloPropioDeTrabajo(job)`. **Aditivo**: `titulo` no cambia. Lo
  sirve la lista y también el detalle (`serializeJobDetail` delega en `serializeJob`).
- Sin schema, sin textos nuevos (es un campo de la API, no copy).

### Verificado en rojo

`tests/scrum917d-titulo-propio-en-la-lista.test.mjs`, 3 tests. Cuatro mutaciones sobre el código
arreglado, compilando cada vez:

| mutación | cae |
|---|---|
| `return job.titulo ?? null` (la cadena vacía viajaría como nombre) | 1 (qué devuelve) y 2 (mismo criterio) |
| quitar `tituloPropio` de `serializeJob` | solo 3 |
| `tituloPropio` con el título DERIVADO | solo 3 |
| control: `titulo` deja de salir de `tituloDeTrabajo` | solo 3, **por su control positivo** («el AST no ve…») |

El test 3 lee `serializeJob` por AST (no por texto): la función no se exporta y lee la base, y
exportarla solo para mirarla sería cambiar el código para poder medirlo.

### Lo que NO cubre

- 🔴 **El crudo no siempre lo escribió alguien.** En staging, 3 de los 15 trabajos llevan en
  `Job.titulo` el texto que se autogeneraba antes de SCRUM-317 («Presupuesto #3 · Cliente QA»). Para
  esos, `tituloPropio` devuelve ese texto y la lista repetiría el cliente igual que antes. No se
  limpia aquí: cambiar un dato guardado es otra decisión (y el título entra en el albarán como
  `referenciaTrabajo`, SCRUM-431). Queda dicho para la S2b y el orquestador.
- La pantalla es de la S2b (917c).

### Ficheros

- `src/modules/jobs/domain/trabajoDirecto.ts` — `tituloPropioDeTrabajo`.
- `src/modules/jobs/app/routes/jobs.routes.ts` — el campo en `serializeJob`.
- `tests/scrum917d-titulo-propio-en-la-lista.test.mjs` — los tres, sin base y sin gate.
