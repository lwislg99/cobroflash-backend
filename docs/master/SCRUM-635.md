# SCRUM-635 · MEDIDO Y PARADO: sigue bloqueado por su propia condición, y el IVA no está muerto

**Fecha:** 15-sep-2026 · **Carril:** catálogo · **Gate:** sin gate
**Medido contra:** `origin/main` = `3e5f58db7325058ededc7ba2381140d0be291abc` · 2026-09-15T15:27:37Z
**Rama:** `scrum-635-medido-y-parado`

⛔ **No se ha tocado ni una línea de `src/`.** Tres frenos independientes, y el primero es del propio
ticket. Lo que hay aquí es la medición y la propuesta escrita, que es lo que el encargo pide dejar.

---

## 0 · Obligación 0

Ni rama `scrum-635*` ni rastro en `main`: **causa (a), nunca se empujó**. Y la prueba directa —la
cabecera del CSV en `products.service.ts:86`— sigue llevando `vat` y no `cost`: **el ticket está
vivo**. No aplica el «segundo plato»: 635 no está en main, así que no paso a SCRUM-669. Tampoco hay
rama `scrum-669*` en el remoto.

---

## 1 · 🔴 FRENO UNO: el ticket sigue BLOQUEADO por su propia condición

Su §«Lo que se pide» empieza así:

> **BLOQUEADO hasta que CAT-01 (SCRUM-609) esté mergeado.** Hacerlo antes fijaría un formato contra
> un producto que aún se está moviendo.

Medido hoy: **hay DOS ramas de SCRUM-609 vivas y sin mergear.**

| rama | estado |
|---|---|
| `scrum-609-medir-el-catalogo` | 🔴 SIN MERGEAR |
| `scrum-609-switch-y-margen` | 🔴 SIN MERGEAR |

La segunda se llama **`switch-y-margen`**. El margen es literalmente la mitad (b) de este ticket. Es
el aviso del propio encargo —«dos manos en el mismo sitio es el PR #1214»— y aquí se cumple con
nombre y apellidos: tocar el CSV del margen mientras otra sesión tiene viva una rama del margen es
el PR #1214 otra vez.

---

## 2 · 🔴 FRENO DOS: el `vat` NO es una columna muerta

El encargo dice: «si el producto dejó de pedirlo, exportarlo es exportar un dato muerto. Mídelo:
¿se sigue escribiendo en algún sitio? Si nadie lo escribe, la columna miente.»

**Medido: se escribe.** El alta de producto lo acepta y lo persiste:

```
src/modules/products/app/routes/products.routes.ts:303
    vat: vat == null ? null : Number(vat),        ← la ruta POST lo recoge

src/modules/products/domain/products.service.ts:55
    prisma.product.create({ data: { … vat: input.vat ?? null … } })   ← y lo escribe
```

Y el ticket ya lo había medido en producción el 01-sep, con nombre de víctima:

> **58 productos · 9 en NULL · 46 con 0,21 · 3 tecleados a mano (merchant 22, tipo reducido del 10 %
> con la mano de obra separada del material).** […] **Cualquier salida que retire `vat` del CSV toca
> el trabajo real del merchant 22. No es una columna muerta.**

Y el propio ticket se reserva la elección: «**Tres salidas** y hay que elegir una a la vista del
número: se mantiene, se retira, o se mantiene con la columna documentada. **No la elijo yo aquí.**»

> 🔒 Así que (a) tampoco es mía. No es «el dato está muerto, retíralo»: es «el dato tiene 49 filas y
> un usuario que lo teclea a mano», y eso lo decide el fundador igual que (b).

### 🔴 Y una advertencia sobre cómo casi lo mido mal

Mi primer barrido automático dijo **«apariciones de `vat:` … en contexto de ESCRITURA: 0»**. Era
falso. El heurístico miraba seis líneas hacia atrás buscando `create(`/`data:`, y en
`products.service.ts` el `vat` está **ocho** líneas por debajo del `data: {`. Si me llego a fiar del
número, habría concluido «columna muerta» y cerrado (a) — que es exactamente la decisión contraria.

> 🔒 Es la cuarta vez hoy que un instrumento mío contesta con seguridad sobre algo que no midió. Lo
> que lo cazó fue **abrir el fichero**, no otro instrumento.

---

## 3 · 🔴 FRENO TRES: (b) cambia lo que el fichero contiene

Lo dice el encargo y lo confirma el carril: **añadir `cost` al CSV cambia lo que el profesional se
lleva a Excel y lo que le pasa a su gestor.** Y las cabeceras del CSV son **texto que ve el cliente**
(regla 30): cualquier cambio de columnas es microcopy del fundador.

---

## 4 · ③ El control que decide: el CSV de HOY, exportado

Datos **fabricados** —ni producción ni staging—, incluyendo a propósito el caso del merchant 22 (IVA
reducido del 10 % tecleado a mano):

```
🔴 SUELO: 3 filas + cabecera  ✅  (si no exportara ninguna, CIEGO)

name;description;price;vat;isActive
Mano de obra fontaneria;Hora de trabajo;35.00;0.1000;true
Codo cobre 22mm;Material;4.20;0.2100;true
Desplazamiento;;20.00;;true

columnas: 5 → name · description · price · vat · isActive
¿lleva `vat`?  SÍ
¿lleva `cost`? NO   ← la víctima del ticket
```

**No hay «después»**: no se ha cambiado nada, y ése es el resultado de esta tanda.

Fíjese en la fila 3: `vat` vacío. Es exactamente lo que el ticket describe — *«un CSV con la columna
vacía en las filas nuevas y rellena en las viejas parece un dato corrupto cuando en realidad es la
migración de criterio. Nadie que abra ese Excel puede saber eso.»* El fichero de arriba lo enseña.

---

## 5 · La propuesta, por escrito, para que el fundador decida

### (b) el coste — **recomiendo añadirlo**

`cost` ya existe en el modelo (`Decimal?`), así que **no hace falta ninguna columna nueva ni ningún
ALTER**: es ampliar el `select` y la cabecera. El caso de uso del ticket —revisar márgenes en
Excel— hoy es el único que el CSV no permite.

⚠️ Con dos cautelas que no son mías de resolver:

1. **El margen** — si es derivado y no almacenado, hay que decidir si el CSV lo trae calculado o no
   lo trae. El ticket lo dice: «decisión, no improvisación».
2. **Quién ve el coste** — `SCRUM-597` dejó escrito que «quien no ve el coste no lo fija»
   (`veEconomiaDelNegocio(req.userRole)` en el alta). El CSV es admin-only, así que encaja; pero si
   mañana se abriera, el coste viajaría con él.

### (a) el IVA — **las tres salidas, con lo que cuesta cada una**

| salida | qué pasa con el merchant 22 | qué pasa con el Excel |
|---|---|---|
| **se mantiene** | su 10 % sigue viajando ✅ | las filas nuevas siguen saliendo vacías y pareciendo corruptas |
| **se retira** | 🔴 sus 3 filas dejan de viajar, y es el único que hoy usa el dato | deja de haber columna confusa |
| **se mantiene documentada** | su 10 % sigue viajando ✅ | hace falta decir DÓNDE se documenta: un CSV no lleva notas |

🔒 **Recomiendo la tercera sólo si hay sitio donde documentarla** —y hoy no lo hay dentro del
fichero—. Si no lo hay, la elección real es entre las dos primeras, y la primera no rompe a nadie.

**No construyo ninguna.** Las tres cambian lo que el cliente ve.

---

## 6 · Lo NO tocado

`src/` entero · `exportProductsCsv` · **`listProducts`** (su apertura está decidida en SCRUM-609 y no
es de este carril) · las cabeceras del CSV (regla 30) · `prisma/schema.prisma` · ningún estado ni
flag (27) · ninguna dependencia (36). Ninguna base real: los datos del §4 están **fabricados**.
**Nada ejecutado contra producción ni contra staging.**

---

# APÉNDICE · 16-sep-2026 · SCRUM-635b · El fundador decidió: el IVA sale, el coste entra

**Medido contra:** `origin/main` = `1331d5d45d029ebccb328f008935a2d63ec8df43` · 2026-09-16T05:44:56Z
**Rama:** `scrum-635-el-csv-sin-iva-y-con-coste` · **Carril:** producto · exportaciones
**Gate:** sin gate — corre en `npm test`

> **DECISIÓN DEL FUNDADOR (16-sep-2026).** Ya no hay nada que medir: el IVA **se retira** del CSV,
> el coste **se añade**, y el margen **no se exporta calculado**. La cabecera queda
> `name;description;price;cost;isActive`.

---

## 0 · Obligación 0, y los dos frenos que el trabajo previo dejó puestos

El ticket **no es (a)**: su entrada existe y hay trabajo suyo en `main` (`0e0c6406`, «MEDIDO Y
PARADO»). Lo que faltaba era la decisión, y ya está.

**① El bloqueo formal, comprobado por mi cuenta** y no heredado: las dos ramas de SCRUM-609 siguen
**vivas en el remoto** —`scrum-609-medir-el-catalogo` (+1) y `scrum-609-switch-y-margen` (+5)—,
pero el apéndice de S5 que está **en `main`** las declara **(a) restos**, con su contenido ya
dentro. El bloqueo no aplica.

**② `cost` YA EXISTE** en el modelo: `prisma/schema.prisma` → `model Product` →
`cost Decimal? @db.Decimal(12, 2)`. **Ni ALTER ni columna nueva**, que era la condición de parada.

## 1 · 🔴 EL CONTROL QUE DECIDE: el tarifario entero, antes y después

Catálogo de prueba **fabricado** (ni producción ni staging), con las tres formas que importan: IVA
al 0,21, un IVA tecleado a mano (0,10), y **un `vat` vacío**.

**ANTES** — `name;description;price;vat;isActive`

```
name;description;price;vat;isActive
Mano de obra;Hora de fontaneria;35.00;0.2100;true
Desplazamiento;Zona 1;20.00;0.2100;true
Grifo monomando;"Serie basica; con instalacion";89.90;0.2100;true
Revision caldera;Anual;75.00;0.1000;true
Material vario;;12.00;;false
```

**DESPUÉS** — `name;description;price;cost;isActive`

```
name;description;price;cost;isActive
Mano de obra;Hora de fontaneria;35.00;18.00;true
Desplazamiento;Zona 1;20.00;12.50;true
Grifo monomando;"Serie basica; con instalacion";89.90;54.00;true
Revision caldera;Anual;75.00;;true
Material vario;;12.00;7.20;false
```

> **La fila que parecía dato corrupto desaparece con la columna:** `Material vario;;12.00;;false`
> pasa a `Material vario;;12.00;7.20;false`. El hueco doble no era un fallo del exportador — era
> un IVA que nadie había rellenado.

Y el hueco que queda ahora está en `Revision caldera`, que **no tiene coste**: sale **vacío, no
cero**. Un coste inexistente puesto a 0,00 € daría un margen del 100 % inventado.

## 2 · Los controles

| control | resultado |
|---|---|
| 🔴 **SUELO** | se exporta un tarifario de verdad —5 filas y el BOM— o CIEGO |
| 🔴 **EL QUE DECIDE** | la cabecera es la nueva, y `vat` ya no está |
| 🔴 **la fila del `vat` vacío** | el `;;` desaparece |
| ✅ **POSITIVO** | `name`, `description`, `price` e `isActive` **idénticas** fila a fila, y el entrecomillado del `;` dentro de una descripción (SCRUM-339) sigue en pie |
| ✅ **NEGATIVO** | `listProducts` **no se toca**: sigue trayendo su `provider` y no se le ha colado nada del CSV |
| ⛔ **el margen** | cinco columnas, ni una más: no viaja calculado |
| 🔴 **MUTACIÓN** | devolver la columna vieja reproduce el defecto **exacto** (`Material vario;;12.00;;false`), **entró en `dist/`** comprobado, y fuente y `dist/` restaurados `IDÉNTICO` |

**7/7 · `# skipped 0`.**

## 3 · ⚠️ Lo que esto cuesta, con su número

**Los merchants que teclean el IVA a mano pierden ese dato en la exportación.** Medido en el
trabajo previo de este ticket: **58 productos · 46 con 0,21 · 3 a mano**. No es motivo para parar
—está decidido— pero queda escrito con la cifra delante en vez de como una nota al pie.

⛔ **La columna `vat` NO se borra del modelo**: sólo deja de viajar en este CSV. El dato de esos
tres profesionales sigue siendo suyo y sigue en la base.

## 4 · Por qué el margen no se exporta

Decisión del asesor: el margen **se deriva** en el catálogo a partir de precio y coste. Traerlo ya
calculado al CSV crearía un **segundo sitio donde vive el mismo número**, y dos sitios es como uno
de los dos se queda atrás. Quien abra el fichero tiene `price` y `cost`. Hay un test que lo
impide, para que nadie lo «mejore» mañana.

## 5 · Lo que NO se ha tocado

`listProducts` (SCRUM-609, otro carril) · `prisma/schema.prisma` · la columna `vat` del modelo ·
el importador de tarifarios · el camino de emisión · ningún rótulo de pantalla · ningún estado ni
flag nuevo (27) · ninguna dependencia (36). Datos fabricados; ninguna base real.

## 6 · 🔴 Los dos rojos que trajo la tanda, y los DOS eran míos

Medido antes de acusar a nadie: worktree nuevo desde `origin/main` (`1be773a3`), sólo esos dos
ficheros → **22/22**. En mi árbol, **2 fallos**. Míos.

### ① `SCRUM-661` · la mutación miraba el fichero, no la función

```
🔴 DETECTOR TAUTOLÓGICO: sigue diciendo que sí con `cost` quitado del `select`.
```

Su control anti-tautología hacía `fuente.replace(/\n\s*cost: true,/, '')` — **sin `/g`, o sea la
PRIMERA aparición del fichero**. Desde que `exportProductsCsv` también selecciona `cost`, esa
primera es la mía (línea 93) y no la suya (línea 257): la mutación borraba **otra función**,
`searchProducts` conservaba su `cost`, y el control cantaba «detector tautológico» sobre un
detector sano.

> **Es EXACTAMENTE el defecto que ese mismo fichero ya había arreglado una capa más arriba**, y lo
> tiene escrito: *«la primera versión buscaba el primer `select:` DEL FICHERO y cazaba el de
> `listProducts` … estaba midiendo otra función y no lo decía»*. Arreglaron el **escáner** y
> dejaron la **mutación** mirando el fichero entero.

**Arreglado dándole puntería, no relajándolo:** la mutación se acota al texto de `searchProducts`
por AST. Lo que el guard EXIGE no se toca — sigue exigiendo que `searchProducts` devuelva `cost` y
que el detector sepa decir que no. Cae dentro de este PR por la regla 37: misma zona, bloquea la
tarea y cabe.

### ② `SCRUM-237` · mi propia negación sin respaldo

```
negación(es) SIN NINGÚN respaldo (patrón scrum73 — verde permanente)
  tests/scrum635-el-csv-sin-iva-y-con-coste.test.mjs:91 «;;12.00;;»
```

El guard tiene razón y el infractor era **mío**: `assert.ok(!material.includes(';;12.00;;'))` es
una negación sobre un literal **sin nada que demuestre que ese literal puede salir**. El día que
cambie el separador o el formato del precio, esa negación pasaría **por no encontrarlo nunca**, no
por estar arreglada.

**Respaldo añadido, que es lo que pedía:** antes de negar, se exporta un producto **sin descripción
y sin coste** y se exige que salga `;;12.00;;`. Con eso demostrado, su ausencia en la fila real
significa algo. No se subió ningún número ni se tocó el guard.

