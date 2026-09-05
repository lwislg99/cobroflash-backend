# SCRUM-586 · Forma de pago por defecto por cliente — MEDICIÓN Y PROPUESTA

**Fecha:** 5-sep-2026 · **Carril:** producto / contactos · **Gate:** sin gate — no hay código aún

**Medido contra:** `origin/main` = `cb41ede81ea1c072a99d5ec4a4a1aec7c3253481` · 2026-09-05T17:23:51Z

> ⛔ **NO HAY CÓDIGO EN ESTA ENTRADA, Y ES DELIBERADO.** El ticket necesita una columna en
> `Customer`; el diff está preparado y **no aplicado**. El fundador cerró la jornada antes del GO:
> *«un ALTER a estas horas es como se pierde una columna»*. Esto es el registro de lo medido, para
> que mañana el trabajo empiece con el terreno hecho y no se vuelva a medir.

---

## PASO −1.2 · EL FILTRO

**NO está hecho.** Ningún fichero del árbol nombra `SCRUM-586` ni `CONT-13`, y ningún commit de
`origin/main` lo toca. Es el primero de ocho asignados hoy que sí está por hacer.

---

## 🔴 LA PREGUNTA QUE DECIDÍA EL TAMAÑO: EL CATÁLOGO YA EXISTE

No hay que crear nada, así que **no es STOP de fundador por catálogo**:

- `z.enum(['card', 'bizum', 'transfer'])` — en `core/validation/schemas.ts`, dos veces (el schema
  del presupuesto y el del cobro).
- El documento ya tiene su selector: **«Formas de pago que verá el cliente»**, tres casillas
  (`💳 Tarjeta`, `📲 Bizum`, `🏦 Transferencia`), **todas marcadas** por defecto.
- `Quote.payMethods` es `Json?`; `null` = todas las que el merchant tenga activas.

**El ticket es DERIVAR el valor por defecto desde el cliente**, no inventar un catálogo.

### Tres datos que se parecen y no son lo mismo

| dato | qué es | ¿lo toca este ticket? |
|---|---|---|
| `Quote.payMethods` | métodos habilitados del documento | **sí — de aquí deriva** |
| `Quote.paymentTerms` | condiciones (`FULL_UPFRONT`/`FIFTY_FIFTY`/`MANUAL`) | no |
| `Invoice.paidVia` | **cómo entró el dinero**, hecho consumado | **no — camino de emisión** |

`paidVia` es terreno fiscal y además ya lleva su propia regla escrita (SCRUM-441: nunca rellenado
por copia desde `Charge.method`). Se lee, no se toca.

**`payMethods` NO viaja al PDF** — medido en `pdf.service.ts` y `presupuestoParaPdf.ts`. Los
documentos emitidos no se ven afectados por este ticket.

---

## LA DECISIÓN DEL FUNDADOR (5-sep-2026): **SE PROPONE, NO SE APLICA**

El precedente `dtoPorDefecto` (SCRUM-587) ya proponía en vez de aplicar, pero **aquí la razón es
más fuerte y conviene dejarla escrita**, porque el caso no es el mismo:

- Allí el estado por defecto era **vacío**. Aquí el estado por defecto del documento son **las
  tres marcadas**, así que aplicar un default del cliente **RESTA opciones de cobro**.
- Si un cliente tiene sólo «transferencia» y el profesional no se fija, **el cobro se retrasa
  entero**. En un autónomo, cobrar tarde duele más que cobrar un poco menos.
- Y al revés: marcar tarjeta mete la comisión del **0,9 %**.

> 🔴 **CUANDO APLICAR CUESTA EN AMBOS SENTIDOS, SE PROPONE.** Ésa es la regla que sale de aquí, y
> es la que hace que este caso no dependa de recordar el precedente del descuento.

La tira del documento **se deriva de la de SCRUM-587**, no se escribe de cero.

---

## EL DIFF · PREPARADO Y NO APLICADO

```sql
ALTER TABLE "customers" ADD COLUMN "pay_methods_por_defecto" JSONB;
```

Generado con `node scripts/preview-migracion.mjs --desde <schema previo>`: **control positivo de
la herramienta respondiendo (27 tablas)** y **veredicto aditiva** — ni DROP, ni RENAME, ni
TRUNCATE, ni DELETE, ni SET NOT NULL. El SQL, con su consulta de verificación y su suelo, vive en
[docs/sql/scrum-586-forma-de-pago-por-cliente.sql](../sql/scrum-586-forma-de-pago-por-cliente.sql).

El campo propuesto copia el patrón de la columna de al lado:

```prisma
payMethodsPorDefecto Json? @map("pay_methods_por_defecto")
```

- **`@map` en snake_case**, porque las columnas de `customers` lo están (medido en SCRUM-587:
  24 snake, 0 camel). Sin él, Prisma buscaría una columna que no existe.
- **Nullable y sin `@default`**: `NULL` = «no se ha pactado nada». Un `@default` convertiría a
  todos los clientes que ya existen en «declarados» y ya no habría forma de saber a cuáles se les
  llegó a preguntar.
- **Nombre**: mantiene la raíz `payMethods` del campo del que deriva y el sufijo `PorDefecto` de
  `dtoPorDefecto`. Que se parezca a los dos es el punto.

---

## ⚠️ EL CRUCE DE TERRITORIO, MEDIDO ANTES DE ESCRIBIR

Otra sesión entra en el **bloque de etiquetas** (DOC-05, derivando de CONT-07) en el mismo
fichero. **Nos cruzamos en cuatro sitios** — no en el mismo campo, sí en las mismas regiones:

| sitio | etiquetas | forma de pago |
|---|---|---|
| `customersView.js` · payload del submit | 1386 | junto a 1370 |
| `customersView.js` · rellenado en edición | 1324 | junto a 1305 |
| `schemas.ts` · `customerCreateSchema` | 542 | junto a 578 |
| `prisma/schema.prisma` · modelo `Customer` | `tags` | **columna nueva** |

🔴 **Es la forma exacta de SCRUM-751**: dos tickets tocando el mismo objeto a decenas de líneas de
distancia, sin conflicto de git que obligue a mirar — y hoy eso dejó `main` en rojo toda la tarde.
Además, `body.appendChild(fieldTags.wrapper)` vive hoy **suelto en la línea 947**, fuera del bloque
agrupado (1146-1189): si el ticket de etiquetas lo muda a ese bloque, aterriza justo donde iría el
`appendChild` de este campo, que hoy es la **1178**.

**DECISIÓN DEL FUNDADOR: en serie, y este ticket primero** — porque ya tiene el diff generado con
su control positivo. Dos diffs de esquema sobre `Customer` preparados por separado es como se
pierde uno.

---

## MICROCOPY CANDIDATA · con marcador, SIN APLICAR

```
[PENDIENTE microcopy oficial] Formas de pago por defecto
[PENDIENTE microcopy oficial] Se propondrán al crear un documento para este cliente. Podrás cambiarlas en cada uno.
```

Falta un tercer literal para la tira del documento, derivado del de SCRUM-587.

⚠️ **CAJAS SIN MEDIR, y es el orden correcto**: la medición a 929 y 390 px con texto dentro se
hace cuando el nodo exista. Medir una caja que aún no está devolvería 0 px de alto, que se lee
como «cabe de sobra» y es lo contrario de lo que se quiere saber — la lección que
`guard:caja-semaforo` dejó escrita en SCRUM-648.

---

## LO QUE FALTA, Y EN QUÉ ORDEN

1. **GO del fundador al `ALTER`** (y lo aplica él en staging/producción; aquí sólo dev).
2. Campo en `Customer` + `customerCreateSchema` con el **mismo `z.enum` que ya existe**.
3. Campo en el modal de cliente, junto a `dtoPorDefecto`.
4. La tira de propuesta en el documento, derivada de `descuentoPorDefecto.js`.
5. Los controles: documento que **trae la propuesta**, documento que **la pisa sin alterar al
   cliente**, y cliente **sin** default que no rompe nada.
6. Microcopy firmada y **cajas medidas en navegador**.

---

## ⚠️ LOS NÚMEROS DE LÍNEA SE RE-MIDIERON, Y LOS MOVIÓ ESTE MISMO DÍA

La primera medición del cruce daba 886 / 1117 / 1302 / 1318 / 1237 / 1256. Entre esa medición y
esta entrada, `main` mergeó **SCRUM-756** —el ticket anterior de esta misma sesión, que añade 95
líneas a `customersView.js`— y **todos esos números se desplazaron**. Los de arriba están
re-medidos DESPUÉS de mezclar `main` dentro.

🔴 Es la razón exacta por la que un ancla o un número de línea escrito sin re-fetch inmediato
nace caduco: aquí el que los movió fue el commit anterior del propio autor.

---
## HUECOS DECLARADOS

- **No se ha ejecutado nada del flujo**: no hay código, así que no hay controles que enseñar. Todo
  lo de arriba es lectura del árbol y un diff generado por herramienta.
- **No se abrió navegador** y **no se midió ninguna caja**.
- **El esquema NO quedó tocado**: se añadió el campo temporalmente para generar el diff y se
  restauró desde una copia verificada byte a byte contra `HEAD`.
