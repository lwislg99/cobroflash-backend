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
