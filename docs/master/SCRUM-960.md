# SCRUM-960 · El NIF del proveedor se pone y se corrige desde SU FICHA

**Fecha:** 20-sep-2026 · **Carril:** S1 (servidor). La pantalla de proveedores es de S2 y **no se toca aquí**.
**Medido contra:** `origin/main` = `c0be103fe10f17759069aaac893b9a81b1610811` · rama `scrum-960-taxid-del-proveedor`.
**Lo encontró** la Sesión 2 recorriendo SCRUM-937 en staging. Lo que sigue es la medición **local, corriendo**.

---

## PASO 0 · el defecto existe hoy, y se midió CORRIENDO

`docs/master/evidencias/SCRUM-960/paso0.mjs` monta el router REAL de `dist/` en un express de verdad
y le hace peticiones HTTP, con la base doblada por `global.prisma`. **No se tocó una línea de `src/`
para medir.** Población declarada: 4 casos.

| caso | ANTES | DESPUÉS del arreglo |
|---|---|---|
| `POST /admin/providers` con `taxId` | **HTTP 201**, y a la base van solo `merchantId, name, phone, email, notes, isActive` | 201 y `taxId` entre los campos escritos |
| `PUT /admin/providers/7` con solo `taxId` | **HTTP 400 `empty_update`**, ninguna escritura | 200, `update` con el NIF |
| `PUT` con `phone` *(control positivo)* | 200, escribe `phone` | igual |
| `GET /admin/providers` | **SÍ devuelve `taxId`** | igual |

**El matiz que el enunciado no traía:** la API **leía** el NIF y no podía **escribirlo**, y el alta
contestaba **201 «creado»** tirando el campo en silencio. Para el profesional eso es peor que un
error: la ficha le dice que sí y el dato no está.

    🔒 Si parece un campo y no se puede escribir, la pantalla ha mentido.

La **misma sonda**, sin tocarla, invierte su veredicto después del arreglo: de «DEFECTO CONFIRMADO
HOY» (exit 0) a «EL DEFECTO NO SE REPRODUCE» (exit 1), con los dos controles positivos intactos.

### Dos defectos MÍOS del instrumento, contados porque casi cuelan

1. **La sonda se declaró CIEGA en la primera pasada** — y para eso estaba el control. Mi doble
   devolvía `null` en `findFirst`, así que el `PUT` daba 404 y el control positivo no ejercitaba
   nada. Sin esa casilla, un «el NIF no llegó» sobre una sonda que no veía nada se habría leído
   como el hallazgo.
2. **`process.exit()` con el servidor recién cerrado aborta node en Windows** (`0xC0000409`) y
   devuelve ese número en vez del veredicto. Se fija `process.exitCode` y se deja salir a node.

---

## Lo que se cambia (aditivo, dos ficheros de `src/`)

* `src/modules/providers/app/routes/providers.routes.ts` — `POST` y `PUT` aceptan `taxId`, por un
  único ayudante `nifParaGuardar`.
* `src/modules/providers/domain/providers.service.ts` — `taxId` en los tipos de alta y edición, y
  `taxId: input.taxId ?? null` en el `create`.

**La validación es LA QUE YA HABÍA.** `validarNifEspanol`, la misma de `schemas.ts:583` (la ficha de
cliente) y la misma con la que `lecturaTicket.ts:243` descarta un NIF mal leído. No se estrena una
segunda regla sobre el mismo dato: dos validaciones del mismo campo divergen, y entonces el mismo NIF
es válido en una pantalla e inválido en otra. El código de error es el literal que ya existe,
**`taxId_invalido`** — un código estable, no prosa (regla 30).

**Vacío sigue siendo válido** (`null`, `""` o espacios → `NULL`), por el motivo que ya razonaba el
esquema del cliente: *validar no es obligar*. Un proveedor sin NIF es un estado legítimo —los que ya
están dados de alta no lo tienen— y **borrar un NIF puesto por error también es corregirlo**.

**Un NIF que no cuadra corta ANTES de escribir nada**, y ésa es la mitad que se olvida: el alta no
crea el proveedor «sin el NIF», y la edición no guarda ni el `name` que sí era válido. Quedarse a
medias dejaría una ficha que el profesional cree que tiene NIF y no lo tiene.

---

## Cómo se ha probado

`tests/scrum960-nif-del-proveedor.test.mjs`: **8 tests, sin red, sin socket y sin base.** Se invoca el
router REAL de `dist/` en proceso y la base va doblada por `global.prisma`.

**Los dos rojos, inyectados de verdad en `src/`, con el `git diff --numstat` al lado de la afirmación
y `npm run build` entre uno y otro:**

| rojo | numstat | qué cae | pass |
|---|---|---|---|
| **R1** · se quita `taxId: nif.valor` del `create` | `1 1` | **solo** «el ALTA guarda el NIF» | 7 |
| **R2** · la validación no rechaza nunca | `1 1` | los **dos** de NIF inválido **y** «el MISMO validador», y **no** el del alta | 5 |

Que cada rojo tumbe **cosas distintas** es lo que prueba que los tests miden cosas distintas. Sin esa
discriminación, ocho verdes pueden ser el mismo verde ocho veces. Verde restaurado: 8/8, árbol limpio.

### 🔴 El arnés salía ROJO con sus ocho tests en VERDE

La primera versión levantaba un express real **por test**. La tanda daba:

    not ok 1 - tests\scrum960-nif-del-proveedor.test.mjs   exitCode 3221226505 (0xC0000409)
    # tests 9 · # pass 8 · # fail 1

El aborto de node dice qué pasa: `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` —
`--test-force-exit` mata el proceso con un handle de socket vivo o a medio cerrar. Medido, en orden:

    un servidor por test, cerrando con await ......  1 de 5 y 2 de 8 pasadas en rojo
    + closeAllConnections() y `Connection: close` ..  2 de 8   (luego no era el keep-alive)
    un solo servidor, sin cerrar ................... 10 de 10  (peor, pero DETERMINISTA)
    sin socket, router en proceso ..................  0 de 10  ✅

Lo que lo acotó fue un **contraste**: `scrum912`, con el arnés de servidor pero menos ciclos de
cierre, dio **0 fallos en 8 pasadas**. No era «el arnés está mal»: era la cantidad de sockets.

    🔒 Un fichero de test puede salir ROJO con todos sus tests en VERDE. Ese rojo no habla del
       código: habla del arnés.

Y lo que lo hace peligroso es cómo empezó: **una carrera cuya primera pasada salió verde.** De
habérmela creído, esto entraba en la tanda de todos los días como un intermitente de nadie, de los que
se miran seis veces y se acaban culpando a «Windows». Lo que lo destapó no fue leer el código: fue
repetir la pasada.

**Lo que este arnés NO cubre, declarado:** el `express.json()` de la aplicación — aquí el cuerpo se le
entrega ya parseado. El camino HTTP completo, con parser y códigos por la red, está medido en
`paso0.mjs`, que sí abre el socket.

---

## NEGATIVO · lo que NO se ha tocado

* **`guardarNifDelProveedor` y todo el camino del gasto**, intactos. Sigue sin pisar un NIF ya
  guardado (`where: { …, taxId: null }`), y hay un test que lo afirma.
* Un alta **sin** `taxId` se comporta exactamente como antes.
* **Ni un texto que vea el usuario.** Solo viaja el código `taxId_invalido`.
* `prisma/schema.prisma`: **sin tocar**. `Provider.taxId` existe desde E4; este ticket no añade
  columna, así que no hay ALTER y no entra en A5.

## Lo que queda, y no es mío

1. 🔴 **La PANTALLA de proveedores no tiene campo de NIF** (`public/dashboard/js/providersView.js`:
   ni el alta ni el modal de edición). El servidor ya lo acepta, pero **el profesional sigue sin
   poder teclearlo desde la ficha hasta que exista el input**. Es de **S2**, y el ticket manda
   proponerlo y parar: **se propone y se para**. Necesita además su microcopy firmada para el error
   `taxId_invalido` (hoy no hay texto aprobado para ese caso).
2. **Observación, sin ticket** (tope de 3 por tanda): `POST /admin/expenses` guarda `nifProveedor`
   con un `.trim()` y **sin validar**, mientras la ficha de cliente, la lectura por IA y ahora la
   ficha de proveedor usan `validarNifEspanol`. Es el outlier de los cuatro. No se toca: el NEGATIVO
   de este ticket lo prohíbe expresamente.
