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

## 🔴 El guard de navegador salió ROJO, y el defecto era del INSTRUMENTO (20-sep, 20:24Z)

**Medido contra:** `origin/main` = `c5d642fe889af753ef6d6de27aabc84bdc3fc79b` · rama `scrum-964-lista-sin-fotos`
**Quién lo dijo, y en cuánto:** `guard:foto-del-gasto` (SCRUM-947), **9,6 s**, sin turno de staging.

### Lo que decía, y la atribución por diferencial

| dónde | `guard:foto-del-gasto` |
|---|---|
| `main` `c5d642fe` (run 35533496437) | ✔ **verde**, 9,6 s |
| `#1544` (este PR, run 35533279614) | 🔴 **rojo**, «C · al reabrir no hay `<img>` de la foto» en A, B y F |

O sea: lo traía este PR. No se dedujo leyendo el diff — se leyó **el mismo guard a los dos lados**.

### El primer número era engañoso, y por qué

El informe decía «3 DE 5 CASOS», y con los pesos al lado (`0,03 MiB` se ve, `0,72 MiB` no) parecía un defecto **dependiente del tamaño**. No lo era: **el caso D no ejecuta el control C**, porque C vive dentro del `else` de `if (caso.espera === 'intacta')`, y E es el negativo. Los casos que corren C son tres, y **cayeron los tres**. 100 %, no 60 %.

🔒 **Un denominador que incluye a quien no se midió convierte un fallo total en uno parcial, y un fallo parcial invita a buscar una causa que no existe.** Diez minutos de hipótesis sobre límites de tamaño, por no mirar primero a quién se le aplica el control.

### La causa: el control C reabría con una forma de fila QUE ESTE TICKET RETIRÓ

C hacía `openExpenseModal(recibidos[0])` — **el cuerpo del POST**, que lleva `receiptData` dentro. Eso valía cuando la fila de la lista también lo llevaba: el cuerpo servía de doble fiel. Desde 964 la fila manda `tieneFoto` y la imagen la sirve su ruta, así que el modal —que pinta la `<img>` sólo con `expense?.tieneFoto`— no tenía de dónde.

**No es un defecto del producto, y se comprobó en vez de suponerlo:** tras guardar, `expensesView.js` llama a `loadExpenses()`, o sea **recarga la lista**; el objeto con el que el panel reabre siempre es una fila con `id` y `tieneFoto`. El camino real nunca pasa por el cuerpo del POST.

### Lo que se hizo, que NO es «ajustar el guard para que pase»

La regla 41 dice: guard en rojo → se arregla el código. Aquí la premisa del control —«lo que devuelve el POST es la fila»— **dejó de ser cierta por el ticket mismo**, que es la excepción que este repositorio ya tiene escrita (804f). Y aun así **el control no se relaja: se le sube la exigencia.** C ahora:

1. pide **la LISTA**, que es lo que el panel recarga al guardar;
2. **afirma que la fila NO trae `receiptData`** — el defecto de los 300 MiB, ahora vigilado desde el navegador y no sólo desde el banco;
3. afirma que la fila dice `tieneFoto: true`;
4. reabre con **esa fila** y exige el píxel: `naturalWidth > 0`, visible y con alto.

Antes C probaba que el modal sabe pintar un data-URI que le dan. Ahora prueba que **la foto guardada vuelve por la red y se pinta**. El servidor del banco reproduce el contrato entero (lista sin foto + ruta binaria con `no-store` y `nosniff`, espejo de `expenses.routes.ts`); lo que **no** reproduce, y queda dicho, es el permiso `admin` y el filtro por `merchantId` — eso lo miden los tests del servidor, aquí no hay sesión.

### Los dos rojos del control nuevo, inyectados en el PRODUCTO

Un control que se estrena en verde no es un control. Los dos fallos se inyectaron en `expensesView.js`, no en el banco, y **dan mensajes distintos** — que es lo que prueba que no es el mismo verde dos veces:

| inyección en `expensesView.js` | lo que dijo C |
|---|---|
| que el modal no pinte la `<img>` (`tieneFoto` → `false`) | «al reabrir no hay `<img>` de la foto» |
| que el `src` apunte a `/foto` **X** (ruta que no existe) | «al reabrir, la foto no se ve (naturalWidth 0, alto 2)» |

El segundo es el que importa: sin él, C podría estar comprobando sólo que existe un elemento.

### Y la lección que se lleva la sesión

🔒 **El guard de navegador encontró esto en 9,6 segundos y sin turno de staging.** El recorrido manual sigue haciendo falta —está abajo, pendiente—, pero **ya no es donde se descubre**: es donde se confirma. Los tres casos habrían llegado a staging para que una persona viera lo mismo media hora después.
## ANEXO (rama `scrum-964c-parsea-antes-de-empujar`) · `public-js-parsea` entra en `guards:entrada`

**Medido contra:** `origin/main` = `35d25d1c58954930b529ad9f736878018c0f9870` · 2026-09-20T19:45:07Z
**Aprobado por el orquestador por el canal**, 20-sep-2026, con excepción de carril declarada
(`scripts/guards-entrada.mjs` no es de S1; el hallazgo es mío y el arreglo es de cinco líneas).

### El hueco, medido antes y después con EL MISMO fallo inyectado

Se añade al final de `expensesView.js` una función con un literal de plantilla sin cerrar — el
mismo mecanismo que me mordió arriba:

```
ANTES  npm run guards:entrada  ->  «✓ 4 guards de entrada en verde (26 tests).
                                     La entrada puede empujarse.»   EXITCODE=0
       node --test tests/public-js-parsea.test.mjs
                               ->  1 pass, 1 FAIL
                                   public/dashboard/js/expensesView.js:? — SyntaxError: Unexpected end of input
```

O sea: **el guard que caza el defecto existía y lo cazaba; el comando que se corre antes de empujar
no lo llamaba.** El fallo pasaba la puerta con un «puede empujarse» explícito.

```
DESPUÉS  árbol limpio      ->  «✓ 5 guards de entrada en verde (28 tests).»  EXITCODE=0  (5,1 s)
         mismo fallo       ->  «🔴 Algún guard de entrada está en rojo.»      EXITCODE=1
```

Sin falsos positivos en el árbol de hoy, y el comando sigue tardando segundos (3,2 s → 5,1 s), que
es la condición que el propio script se puso: *uno que tarde un minuto no se ejecuta*.

### Lo que se cambia, y lo que NO

- Entra `tests/public-js-parsea.test.mjs` en `GUARDS` y **`MINIMO` sube de 4 a 5**: sin eso, el
  suelo nº1 del script dejaría borrar la línea nueva sin que nada parase.
- **Se reescribe el criterio de la cabecera, y no es cosmético.** Hasta hoy la lista se explicaba
  como «los guards de la ENTRADA DE REGISTRO». El quinto no es de la entrada: mira el código del
  front. Añadirlo sin reescribir el criterio dejaría un fichero que dice una cosa y hace otra, y el
  sexto se decidiría a ojo. El criterio pasa a ser el que de verdad los unía: **lo que puede poner
  un PR en rojo, se comprueba leyendo ficheros sin compilar ni base, y se mira en segundos.**
- No se toca `public-js-parsea` ni ningún otro guard. No se quita nada de la lista.

### Por qué un comentario no bastaba (y esto es lo que hay que leer dentro de un mes)

Es la **cuarta** vez que el mismo mecanismo muerde (`plansView` en SCRUM-345, `exportView` en el
ticket del guard, un tercero la misma mañana, y `expensesView` aquí). La cuarta la cometió una
sesión que **tenía el aviso escrito en el propio fichero, en su línea 113**, puesto ahí por la
segunda. No lo leyó porque editó por búsqueda en la línea 399.

🔒 **Un comentario solo avisa a quien pasa por delante.** El mecanismo que sí funcionó fue el
guard; lo que fallaba era **cuándo** se corría — después de empujar, no antes. El arreglo no es
escribir el aviso más grande: es mover el guard a la puerta por la que se pasa siempre.

Guards vecinos en verde tras el cambio: `scrum711-guards-sin-sitio`, `scrum928`, `scrum928b`,
`scrum522-guards-fuera-de-la-tanda`, `scrum548-peaje-package-json` (52 tests).

## Lo que NO se ha mirado

- **No se ha verificado en staging ni en yaqu.app.** Lo medido es el mecanismo, con la ruta y el
  servicio reales pero con la base doblada. Un recorrido real —abrir Gastos, abrir el modal, ver la
  foto, guardar sin tocarla y comprobar que sigue ahí— **sigue pendiente** y es lo que confirmaría
  la mitad de la pantalla.
- **El permiso y el filtro por `merchantId` de la ruta de la foto NO los mide el guard de
  navegador**: su servidor no tiene sesión. Los miden los tests del servidor (R3).
- **El tamaño REAL de una foto guardada no está medido**: el tope (1,5 MiB) sí. Las cifras del
  PASO 0 son el techo del mecanismo, no la media de un profesional real.
- **La caché de la foto.** Va `no-store` a propósito, por no tener `ETag`. Con `ETag` la vista
  previa se abriría sin volver a bajarla; queda dicho, no hecho.
