# SCRUM-584 · CONT-11 · El selector de columnas de la lista de clientes

**Fecha:** 2-sep-2026 · **Carril:** contactos (lista de clientes) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `80db312b10b79292485ff99070648657f4dacca7` · 2026-09-02T22:47:13+01:00

> La base se volvió a medir AL CERRAR, y había caducado: main se movió **8 commits** desde el
> `f803ec1e` con el que se empezó, y entre ellos venía **SCRUM-672**, que toca a este ticket de
> lleno. Se mergeó dentro —no rebase— y se volvió a medir todo contra la base nueva.

**Tanda:** **4.798 pruebas · 4.714 en verde · 0 fallos · 84 saltadas** — con `main` ya mergeado
dentro y medida DESPUÉS del último cambio de código. Lo único posterior es esta cifra y el SHA
de arriba, que no son código y no pueden medirse antes de existir.

---

## 🔴 LO PRIMERO: EL SELECTOR ES PARA AÑADIR, NO PARA QUITAR

El encargo original decía que a 360 px había «scroll horizontal permanente». **Se midió y era al
revés**, y esa medición reescribió el ticket:

| medido a 360 px, en navegador | |
|---|---|
| `scrollWidth` vs `clientWidth` | **343 = 343** → no hay scroll horizontal |
| la tabla | `display:block`, `thead` en `display:none` — **es una pila de tarjetas** |
| celdas visibles | **4** de 8 |

Lo que pasa es lo contrario: **el CSS oculta cuatro columnas con `col-hide-mobile` y nadie podía
encenderlas.** El profesional que vive del email o de las notas **no los veía en el móvil y no
tenía forma de pedirlos**. Ésa es la víctima real.

---

## PASO 0

**ENTRADA.** `public/dashboard/js/customersView.js` → `renderCustomersView()`: la cabecera y las
filas de la tabla, y la toolbar donde ya viven los otros cuatro controles.

**MECANISMO — existía casi entero, y el trabajo fue darle superficie.** `filtroClientes.js` ya era
el módulo de decisión **sin DOM**: pestañas, órdenes, filtro de etiqueta, `aplicar()`, los textos
en un solo sitio y el contador `SIN_APROBAR`. Las columnas se han añadido **ahí**, con el mismo
patrón. La vista sólo cablea.

### Lo que había que volver a medir, y había cambiado

**Hoy son OCHO columnas, no siete.** Entró «Etiquetas» (SCRUM-580):

`ID` · `Nombre` · **`Teléfono`** · `Email`* · `Notas`* · `Etiquetas`* · `Alta`* · *(acciones)*
— las marcadas con `*` llevan `col-hide-mobile`.

Y **SCRUM-588 (referencia interna) NO añade columna**: es un campo del modal
(`createField("Referencia interna", …)`). La toolbar tiene ya **cuatro** controles, incluido el
filtro de etiqueta.

---

## Lo construido

### Un solo mecanismo para móvil y escritorio

No hay dos listas. Hay **una preferencia** —qué columnas ha encendido el profesional— y **una
regla**: una columna encendida pierde `col-hide-mobile`, así que aparece también en la tarjeta. En
escritorio se seguían viendo todas y se siguen viendo.

**Por defecto, lo de hoy.** Con la preferencia vacía, `claseDeColumna` devuelve exactamente las
clases actuales — hay un caso que las fija una a una. Nadie se encuentra la pantalla cambiada sin
pedirlo.

### 🔴 Sin salida muerta, POR CONSTRUCCIÓN

`Nombre` y las acciones son **fijas**: no salen en el control y no se pueden apagar. Así que
apagarlo todo **es imposible**, y no hace falta un mínimo artificial que alguien tenga que
recordar. Un mínimo se olvida; una fija, no.

### 🔴 El `colSpan` deja de ser una constante — y era la mitad del ticket

Había **dos `colSpan = 8`** escritos a mano, y otra sesión los tuvo que recalcular al entrar
«Etiquetas». Ahora **cabecera, celdas y `colSpan` salen de la misma lista**, así que no pueden
descuadrarse. Y se vigila que no vuelva un número a mano: **un vacío descuadrado no lo ve ninguna
tanda**, porque el estado vacío sólo se pinta cuando no hay clientes.

### La preferencia, en el navegador

`localStorage`, por dispositivo. Es preferencia de **vista**, no dato de negocio: no justifica una
columna ni una ida al servidor en la pantalla que tiene que ir rápida en móvil. **Consecuencia
asumida: no viaja entre dispositivos.** Lectura y escritura van dentro de `try` — un navegador con
el almacenamiento bloqueado no puede dejar la lista sin pintar—, y la basura guardada cae al mismo
sitio que la ausencia: **la preferencia vacía, que es «lo de hoy»**.

---

## Medición en navegador real, a 360 px, con cuatro combinaciones

| encendidas | celdas visibles | alto de fila | scroll horizontal |
|---|---|---|---|
| ninguna (lo de hoy) | 4 | **153 px** | **no** |
| + Email | 5 | 153 px | no |
| + Email + Notas | 6 | 199 px | no |
| las cuatro | **8** | **222 px** | **no** |

**Nunca aparece scroll horizontal.** El coste es **vertical** y lo asume quien enciende, que es
por lo que tiene que poder deshacerse.

**El control:** `85 × 44 px` — objetivo táctil de AB6 cumplido.

---

## Microcopy: una sola palabra nueva

> ### `Columnas`

Y es la **única** ranura nueva: los nombres de las columnas —ID, Nombre, Teléfono, Email, Notas,
Etiquetas, Alta— **ya están en pantalla hoy**, en la cabecera de la tabla. No son microcopy nuevo,
así que no se vuelven a aprobar.

**`SIN_APROBAR` sube de 4 a 5**: aprobada por el asesor, **a la espera del fundador**. Va **sin
marcador**, como el resto del fichero — el censo llegó a cero hoy y no se rompe. Fijada con `===`.

**Caja medida:** el control ocupa 85 px de los 343 disponibles a 360 px y no empuja la tabla al
abrirse (el desplegable va absoluto).

---

## Lo que NO se puede perder, comprobado

| | cómo se comprueba |
|---|---|
| **F1** · el teléfono nace visible | `ocultaEnMovil: false` **y** `claseDeColumna('telefono', []) === ''`. Y sigue siendo **ocultable** (`fija: false`): puede apagarlo el profesional, nunca el producto |
| **F3** · acciones no ocultables | `fija: true`, fuera del control, y las tres acciones siguen en la vista |
| los **cinco** controles conviven | buscador · pestañas · filtro de etiqueta · orden · columnas, sobre la pantalla **ejecutada** |

### El suelo con control positivo

Encender una columna la enseña **y las demás no se mueven** — se comprueban las dos cosas a la vez.
Una tabla vacía pasaría cualquier test de «esa columna está»; y si el mecanismo apagara lo no
elegido, el segundo aserto lo diría.

### El rojo, probado por el mecanismo — cinco mutaciones con post-condición

| se rompe a propósito | cae |
|---|---|
| el teléfono nace oculto | F1 (aquí **y** en `scrum580`) y «la pantalla es la de hoy» |
| `Nombre` deja de ser fija | SIN SALIDA MUERTA |
| las acciones se vuelven ocultables | F3 y SIN SALIDA MUERTA |
| un `colSpan` vuelve a un número a mano | el `colSpan` derivado (aquí **y** en `scrum580`) |
| el control deja de montarse | «el control SE MONTA» y «los cinco conviven» |

> Y una post-condición **me paró**: intenté mutar el `colSpan` y avisó de que aparecía **2 veces**,
> no una. Hizo exactamente su trabajo — muté uno solo y entonces sí.

---

## Los guards vecinos, REANCLADOS (no relajados)

Cinco casos de `scrum580` y uno de `scrum581` medían la **forma vieja**: la lista literal de `<th>`
en el fuente y el `colSpan` a mano. Se han reanclado a la forma nueva **leyendo la lista
ejecutada**, que es más fuerte que parsear el fuente con un regex:

* «F1 y F3» ahora lee `FC.COLUMNAS` ejecutado — y **comprueba algo más que antes**: con columnas
  ocultables, «estar en la lista» ya no basta, así que exige además que el teléfono **nazca
  visible**.
* «los vacíos abarcan todas» ya no compara dos números copiados: exige que **no quede ninguno a
  mano** y que el derivado coincida con la lista.
* «la vista no repite los textos» pasa a exigir que la vista **ya ni mencione** el rótulo de la
  columna: la invariante se cumple más que antes.

---

## Los huecos que declaro

1. **No he probado el ciclo completo de `localStorage` en navegador real.** El guard comprueba que
   se lee, que se guarda y que la basura no rompe; que el navegador conserve la elección **entre
   recargas** no está ejercitado de punta a punta.
2. **No he medido con 300 clientes.** Con 4 filas el scroll horizontal no depende del número, pero
   el **vertical** sí: 222 px × 300 son ~66 000 px, y eso no está medido.
3. **No he probado con teclado ni con lector de pantalla.** El `<details>` es nativo y va con
   teclado por defecto, pero no lo he verificado.
4. **La preferencia no viaja entre dispositivos** — es la consecuencia asumida de la decisión, no
   un defecto, y queda escrita aquí para que nadie la descubra como sorpresa.

---

## 🔴 UN TRINQUETE SALTÓ, Y PEDÍA UNA DECISIÓN: ¿el logout se lleva esta preferencia?

Al escribir la preferencia, **SCRUM-457 se puso en rojo**. No dijo «esto está mal»: dijo que **no
sabía leer la clave** —vive en una constante y su censo solo resolvía literales— y que por tanto
**no podía decir si se purga o no**. Se declaró CIEGO, que es justo lo que tenía que hacer:
«no hay problema» y «no supe mirar» son el mismo verde con significados opuestos.

**La decisión: SOBREVIVE al cierre de sesión.** Queda escrita en `CLAVES_LOCALES` con su motivo,
al lado de la que ya sentaba el precedente:

| | |
|---|---|
| **qué es** | qué columnas ha encendido el profesional. Preferencia **de vista** y **del aparato** |
| **qué NO lleva** | ni merchant, ni dato de cliente, ni un solo precio |
| **de quién la protegeríamos** | de nadie: quien coja el móvil después ve **la misma tabla** que vería igualmente |
| **qué costaría purgarla** | volver a encender «Email» y «Notas» en cada logout — la molestia que el selector venía a quitar |
| **precedente** | `yaqu_tips_shown`, misma naturaleza y misma decisión |

Y la decisión **no se queda en el registro**: se prueba en este carril, con su control positivo
(que el censo VE la escritura y RESUELVE la clave hasta el literal). Sin él, el primer test pasaría
igual mirando un registro que no gobierna nada.

### Lo que hubo que enseñarle al censo — y por qué NO es relajarlo

`resolverClave` sabía leer literal, plantilla, `'x_' + id` y llamada a función del mismo fichero.
Se le añade **un salto más, con el mismo límite**: identificador → su declaración en **ese** fichero.
Es la misma razón por la que en su día se le añadió el `+`, y está escrita allí: *«una forma
corriente que nadie había previsto dejaba ciego al censo»*. **El censo ve MÁS que antes, no menos.**

Dos cautelas, y las dos devuelven `null` —o sea, **rojo**— en vez de adivinar:

* si el nombre está declarado **más de una vez** en el fichero, no se elige uno;
* un ciclo `const A = B; const B = A;` **se corta**. Sin eso el censo no daría rojo: se colgaría,
  y una tanda que no termina no la lee nadie como un fallo.

### El rojo, probado — seis preguntas que el censo tiene que saber contestar

| se rompe a propósito | cae |
|---|---|
| la clave se compone con algo que no se sabe leer | «CLAVE NO SE SABE LEER» (457) **y** «el censo SABE LEER esta clave» (584) |
| el mismo nombre, declarado dos veces | «CLAVE NO SE SABE LEER» — no se adivina |
| la clave se resuelve pero **no** está registrada | «NO están en `CLAVES_LOCALES`» |
| la excepción sobrevive a la clave que la justificaba | «no casa con NINGUNA escritura del panel» |
| **la decisión se invierte** (`purga: false` → `true`) | «la preferencia SOBREVIVE al logout» |
| `const A = B; const B = A;` | **no cuelga**: 24 ms y `claveResuelta = null` (medido aparte) |

> Y el suelo del propio 457 sube solo: pasa de **cuatro** escrituras del panel a **cinco**.

### Y el suelo de la tanda sube, porque la tanda ha crecido

Al mergear `main` entró **SCRUM-672**: un suelo que impide que la tanda PIERDA tests sin que
nadie se entere. Su fichero dice cuándo se sube y quién puede hacerlo —*«SUBIRLO ES UNA LÍNEA y lo
puede hacer cualquier sesión: si la tanda crece, se sube y ya»*—, así que se sube **con lo medido,
no con un margen**: `SUELO_TESTS` **4766 → 4798**, y `MEDIDO_CONTRA` pasa a decir contra qué se
midió de verdad (`80db312b`), que es lo que evita que el número quede sin procedencia.

> Comprobado con su propia herramienta sobre el TAP de esta tanda:
> `[suelo de la tanda] ✅ suelo 4798 · total actual 4798 · margen 0`.

## Ficheros

`public/dashboard/js/filtroClientes.js` (la decisión: `COLUMNAS`, `claseDeColumna`,
`colSpanDeLaTabla`, `TEXTOS_COLUMNAS`, `SIN_APROBAR` 4→5) ·
`public/dashboard/js/customersView.js` (el cableado y el control) ·
`public/dashboard/css/styles.css` (el `<details>`, con tokens existentes) ·
`tests/scrum584-selector-de-columnas.test.mjs` (**nuevo**) ·
`tests/scrum580-…` y `tests/scrum581-…` (reanclados) ·
`public/dashboard/js/almacenLocal.js` (la decisión de purga, con su motivo) ·
`tests/_censo-almacenamiento-publico.mjs` (el censo aprende un salto más) ·
`scripts/_suelo-de-la-tanda.mjs` (el suelo, 4766 → 4798) · esta entrada.

**No se ha tocado:** `prisma/schema.prisma` —este ticket **no toca esquema**— · el modal de cliente
· `tests/_banco-vistas.mjs` · ninguna dependencia nueva (regla 36).

## Estado del arbol

* `origin/main` MERGEADO DENTRO —no rebase, nunca `--force`— sin conflicto.
* Cliente de Prisma regenerado desde ESTE worktree y `dist/` reconstruido DESPUÉS de mezclar main.
* `npm run guards:entrada` en verde. Cero CR en disco (medido por BYTES).

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* El banco de vistas pinta la vista de clientes DOS veces en una sola llamada (16 `<th>` para 8 columnas): no afecta a lo que se mide aquí, pero cualquier recuento sobre esa vista dará el doble.
* `col-hide-mobile` es una clase compartida con otras tablas (`table--cards-mobile`): el mecanismo de columnas de este ticket sólo gobierna la de clientes, y otra pantalla que la use sigue sin poder encenderlas.
