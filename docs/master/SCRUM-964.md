# SCRUM-964 · la lista de Gastos se traía las FOTOS de todos los gastos

**Fecha:** 20-sep-2026 · **Carril:** S1 (servidor de producto) · **Pedido por:** el orquestador
**Medido contra:** `origin/main` = `8fcfd13fc7e14069bef9ce2b9c3f94fe969f2506` · 2026-09-20T19:19:51Z
**Rama:** `scrum-964-lista-sin-fotos`

## La víctima

El profesional en la furgoneta, con datos móviles, abriendo Gastos. `GET /admin/expenses` le
mandaba la FOTO DEL TICKET de cada gasto del mes para pintar una tabla que no enseña ninguna foto.

## PASO 0 · medido antes de escribir una línea

No hizo falta instrumento nuevo: la sonda de solo lectura ya estaba en main
(`docs/prototipos/SCRUM-920/sonda-peso-lista-gastos.mjs`, de la S2). Corre sobre la RUTA y el
SERVICIO reales de `dist/`, con la base doblada, sin red.

```
 20 gastos x foto 0.00 MiB -> respuesta 0.00 MiB
 20 gastos x foto 0.49 MiB -> respuesta 9.77 MiB
 20 gastos x foto 1.50 MiB -> respuesta 30.00 MiB
 60 gastos x foto 0.49 MiB -> respuesta 29.31 MiB
 60 gastos x foto 1.50 MiB -> respuesta 90.01 MiB
200 gastos x foto 1.50 MiB -> respuesta 300.03 MiB
findMany con select?: NO (include sin select: trae TODAS las columnas, receipt_data incluida)
take: 200
```

El tope de la página es `take: 200` y el tope de la foto es `FOTO_TECHO_DATAURI` = 1,5 MiB
(`expensesView.js`). O sea que **300 MiB es el techo real de una sola petición**, no una hipótesis.

## Lo que se hace · SERVIDOR

1. **`listExpenses` pide `select` explícito** con los 19 escalares de `Expense` menos
   `receiptData`, en vez de `include` sin `select` (que trae todas las columnas).
2. **`tieneFoto`** se añade a cada item. Sale de UNA consulta por página que solo devuelve `id`,
   acotada a los ids de la página y filtrada por `merchantId` (regla 2): coste constante, el que
   fijó SCRUM-135 — nunca una consulta por gasto.
3. **`GET /admin/expenses/:id/foto`** sirve la foto **en binario**, con su `Content-Type`,
   `Content-Length`, `X-Content-Type-Options: nosniff` y `Cache-Control: no-store`.
   - Usa `parsearImagen`, **el parser que ya existía** para leer el ticket: un solo sitio decide
     qué es una foto admitida, así que no se puede servir por aquí algo que allí se rechazaría.
     No se extrajo ni se cambió ninguna firma para poder probarlo.
   - Mismo permiso que la lista (`admin`). El gasto de otro negocio da **404**, el mismo que un id
     que no existe: distinguirlos convertiría la ruta en un oráculo de ids ajenos.
   - Contenido que no es una imagen admitida → **415 `foto_no_legible`**, código propio. `tieneFoto`
     dijo la verdad (la columna no es `null`); lo que no hay es algo que sepamos servir.
4. **Se cierra también la OTRA puerta.** `GET /admin/jobs/:id/gastos` llama al MISMO
   `listExpenses`, así que servía las fotos igual — y ésa **no** es admin-only: la abre el técnico
   desde la obra. No se dedujo: se mide en el test, invocando ese router.

### Por qué `select` y no `omit`

`omit: { receiptData: true }` es GA en Prisma 6 y sería aditivo (una columna nueva pasaría sola).
Se descarta porque su corrección depende de que Prisma traduzca el `omit` a SQL y eso, desde un
doble, **no se puede medir**: el test tendría que creérselo. Con `select`, «receiptData no está en
la lista que se pide» es una afirmación completa sobre lo que sale hacia la base. La pega del
`select` —lista cerrada— se cierra con el guard de la columna nueva (abajo), que es mejor que
elegir entre las dos.

## Lo que se hace · PANTALLA, y por qué va en el MISMO commit

🔴 **Esto no es «la otra mitad, cuando se pueda»: sin ella el servidor solo BORRA DATOS.**

El modal de edición hacía `let receiptData = expense?.receiptData || null` y metía esa clave en el
`PUT`. En cuanto la lista deja de traer la foto, ese atajo manda `receiptData: null`, y el servidor
lo entiende como «bórrala» (SCRUM-324: `null` borra, `undefined` no toca). O sea que **con solo la
mitad del servidor desplegada, editar el importe de un gasto le BORRA al profesional la foto de su
justificante**. Por eso las dos mitades van juntas, y por eso este ticket no se podía partir.

- La vista previa pide la foto por `GET /admin/expenses/<id>/foto`. Mismo sitio, mismo tamaño,
  mismos estilos: **cero delta visual**. `onerror` la quita en vez de dejar el icono de imagen
  rota; sin texto nuevo, que tendría que ir firmado (regla 30).
- El guardado **omite la clave** si no se ha elegido foto nueva.

⚠️ **Excepción de carril declarada:** `expensesView.js` es de la S2. Se toca porque el encargo daba
esa opción explícitamente («primero que el front pida la foto por su ruta, o deja la ruta lista y
avísame») y porque la medición de arriba dice que la otra rama de esa opción **destruye datos del
cliente** mientras las dos mitades no coincidan. Se pasó por `yaqu-premium-ui`: sin tokens nuevos,
sin componente nuevo, sin copy nuevo, una sola pantalla.

## Tests · `tests/scrum964-la-lista-no-carga-las-fotos.test.mjs` (15, en verde)

**Lo que hace válido el peso como medida:** el doble de la base **OBEDECE al `select`**, como una
base de verdad. Un doble que devuelve las filas tal cual —el de la sonda— contestaría lo mismo con
`select` o sin él: sería CIEGO al arreglo y daría un verde que no mide nada. Su suelo (test 1)
comprueba lo contrario, que el doble **no criba por su cuenta**: con un `select` que sí pide
`receiptData`, la foto vuelve.

**El guard de la columna nueva.** Un `select` explícito es una lista cerrada: la columna que
alguien añada mañana a `Expense` desaparecería de la API sin que nada fallara. El test lee
`prisma/schema.prisma`, saca los escalares del modelo y los compara con **el `select` que sale
hacia la base** (no con una constante). Si no cuadran, rojo. El lector declara CIEGO lo que no sabe
clasificar en vez de dar un verde vacío (SCRUM-413), y tiene su propio suelo y su control negativo
(las relaciones no son columnas).

**Sin `export` para el test.** La primera versión exportaba `CAMPOS_DE_LA_LISTA` para poder mirarla
y **el censo de SCRUM-411 lo cazó**: «su consumidor real ya está dentro del fichero; de fuera solo
entra su test». Tenía razón, y el arreglo no fue declararlo: fue medir donde importa — en los
argumentos que `listExpenses` manda a la base. Un export que solo existe para el test es código que
el test se inventó, y entonces mide lo que él añadió.

### Los CINCO rojos, inyectados de verdad, y qué mató cada uno

| # | fallo inyectado | `numstat` | caen | siguen verdes |
|---|---|---|---|---|
| R1 | `select` → `include` (el defecto entero) | `1 3` | 3: el peso, el contrato con la base, la otra puerta | 12, incluidos los de `tieneFoto` |
| R2 | fuera la consulta de `tieneFoto` | `0 7` | 4: `tieneFoto`, su consulta, el coste constante, la otra puerta | **el peso NO cae** |
| R3 | la ruta de la foto sin `merchantId` | `1 1` | 1: el filtro por merchant | 14 |
| R4 | una columna fuera del `select` (simula la columna nueva) | `1 0` | 1: el guard de columnas | 14 |
| R5 | la pantalla vuelve a reenviar `expense.receiptData` | `1 1` | 1: el guard de la pantalla | 14 |

R1 y R2 son la discriminación que importa: **el peso y `tieneFoto` no son el mismo verde dos
veces**. R2 mata cuatro y deja el peso en pie; R1 mata el peso y deja `tieneFoto` en pie.

### Guards vecinos, en verde

`scrum411-exports-inalcanzables` (25) · `public-js-parsea` (2) · `scrum324-aviso-simplificado-ui`
· `scrum135-gasto-tenencia` · `scrum370-gastos-del-trabajo` · `npm run guards:entrada` (26).

## Las dos trampas que mordieron aquí, medidas

1. **Un comentario HTML con acentos graves DENTRO de una plantilla la CIERRA.** La explicación del
   cambio se escribió como `<!-- … \`tieneFoto\` … -->` dentro del literal de `backdrop.innerHTML`:
   el fichero dejó de parsear (`expensesView.js:401 — SyntaxError: Unexpected identifier
   'tieneFoto'`) y lo cazó `public-js-parsea`. **El propio fichero lo avisa en su línea 113**, por
   el mismo accidente en SCRUM-769, y aun así se repitió. El comentario va FUERA del literal.
2. **Revertir el fuente no revierte `dist/`.** Tras el R4 se hizo `git checkout --` del servicio y
   se corrió el R5 sin reconstruir: el guard de columnas salió rojo midiendo un árbol compilado que
   ya no existía. El rojo era mío, no un defecto — es la trampa que la ficha de la S1 ya describe
   («una tanda larga lee el repositorio»). **Entre dos rojos va un `npm run build`.**

## Lo que NO se ha mirado

- **No se ha verificado en staging ni en yaqu.app.** Lo medido es el mecanismo, con la ruta y el
  servicio reales pero con la base doblada. Un recorrido real —abrir Gastos, abrir el modal, ver la
  foto, guardar sin tocarla y comprobar que sigue ahí— **sigue pendiente** y es lo que confirmaría
  la mitad de la pantalla.
- **El tamaño REAL de una foto guardada no está medido**: el tope (1,5 MiB) sí. Las cifras del
  PASO 0 son el techo del mecanismo, no la media de un profesional real.
- **La caché de la foto.** Va `no-store` a propósito, por no tener `ETag`. Con `ETag` la vista
  previa se abriría sin volver a bajarla; queda dicho, no hecho.
