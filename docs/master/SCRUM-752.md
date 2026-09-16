# SCRUM-752 · MEDIDO Y PARADO: la premisa del encargo va contra una decisión del fundador, y además es patrón

**Fecha:** 15-sep-2026 · **Carril:** catálogo · **Gate:** sin gate
**Medido contra:** `origin/main` = `428027d336b9a8daefda766baf297fbeb717052e` · 2026-09-15T14:05:29Z
**Rama:** `scrum-752-censo-include-sin-select`

⛔ **NO SE HA ARREGLADO NADA, y es a propósito.** Dos frenos independientes saltaron antes de tocar
código; los dos están en el propio encargo y en el propio ticket. `src/` intacto.

---

## 0 · Obligación 0

`git ls-remote` no devuelve `scrum-752*` y `git log origin/main --grep` no devuelve rastro:
**causa (a) — nunca se empujó rama.** Y la prueba directa, que es la que vale: `listProducts` sigue
en `main` sin `select` de primer nivel (`src/modules/products/domain/products.service.ts:67`).

---

## 1 · 🔴 FRENO UNO: lo que el encargo pide como arreglo va CONTRA una decisión del fundador

El encargo fija el control que decide así:

> «🔴 EL QUE DECIDE: un técnico sin rol de admin pide la ruta abierta → HOY recibe el coste.
> Ejecutado, no razonado. **Después: no lo recibe.**»

**Ese «después» no se puede construir.** El propio ticket lo retira, y el código lo declara dos
veces:

* **El ticket, §«Por qué es un ticket AHORA y no antes»:** «P3 se respondió el 5-sep-2026 y la
  decisión del fundador es que **cualquier empleado puede ver coste y margen** (ver SCRUM-609). […]
  Que `listProducts` sirva `cost` **es correcto** y está alineado con P3. […] **No es un agujero:
  es una asimetría.**»
* **El ticket, §«Lo que NO se hace»:** «⛔ **No se añade** `requireRole` a `listProducts`.»
* **Y el código, `src/core/http/adminRouteDeclarations.ts:205`:**

  > «⚠️ **LA LECTURA SE QUEDA ABIERTA A PROPÓSITO.** El fundador decidió el mismo día que coste y
  > margen los ven TODOS los roles, así que los `GET` de aquí abajo NO son un resto de la lista
  > vieja: son la otra mitad de la decisión. **Cerrarlos sería ir contra ella.**»

  …con la entrada: `{ GET /admin/products, why: '…y coste/margen los ve todo rol (fundador 24-ago-2026)' }`

El encargo la describe como «hermana exacta de SCRUM-849: uno protege y el otro no». **La forma se
parece; el veredicto es el contrario.** En la 849 la ruta abierta filtraba de menos y había que
subirla. Aquí la ruta abierta enseña **lo que se decidió que enseñe**, y quitarle el coste rompería
el producto por el lado bueno — que es, con las palabras del propio encargo, «la razón por la que el
catálogo existe».

---

## 2 · 🔴 FRENO DOS: es PATRÓN, no caso — y el encargo manda parar si lo es

> «② … ¿es el único, o hay más consultas que sirven campos que su hermana equivalente sí excluye?
> […] **Si sale patrón, PARA y dímelo antes de arreglar.**»

Censado por AST sobre `src/` (`docs/master/evidencias/scrum752/censo-lecturas-sin-select.mjs`,
salida en `salida-censo.txt`):

| | |
|---|---|
| lecturas de Prisma en `src/` | **430** |
| · con `select` de primer nivel | 284 |
| · 🔴 **SIN** `select` de primer nivel | **146** |
| de ellas, con `include` | 57 |
| modelos distintos afectados | **20** |

**`listProducts` es 1 de 146.** En su propio fichero hay **tres** (`:68`, `:263`, `:292`).
Los modelos más expuestos: `quote` (27), `invoice` (25), `charge` (19), `job` (12), `merchant` (11).

El censo lleva **suelo**: si no reconociera ninguna lectura, o ninguna **con** `select`, se declara
CIEGO y sale con 3 — un cero suyo significaría «no sé clasificar», no «no hay».

---

## 3 · Medido y ejecutado: qué pide hoy cada ruta

Con un doble que registra los argumentos (ejecutado, no razonado):

```
listProducts      → select de primer nivel: NINGUNO ⇒ Prisma devuelve TODAS las escalares
                    include: {"provider":{"select":{"id":true,"name":true}}}
                    where  : {"merchantId":42}        ← regla 2 ✅
exportProductsCsv → select: name, description, price, vat, isActive
                    ¿lleva cost? NO
```

### 🔴 Y el ticket pedía medir POR QUÉ el CSV excluye `cost`. Está medido, y cambia el caso

> «1. **Medir** por qué `exportProductsCsv` excluye `cost`. Puede haber un motivo […] **Si lo hay,
> no se toca: se DECLARA por escrito** y este ticket se cierra con esa frase dentro.»

**El motivo está a la vista, en la línea siguiente del propio fichero:**

```
rows.push('name;description;price;vat;isActive');
```

Su `select` **es la cabecera del CSV**, columna por columna. No excluye `cost`: excluye **ocho**
columnas —`id`, `merchantId`, `nameSearch`, `cost`, `providerId`, `itemKind`, `createdAt`,
`updatedAt`—, que son todas las que no salen en el fichero. La asimetría no es una decisión sobre
privacidad: **es la forma del formato de exportación.**

Con eso, la frase que el ticket pide dejar por escrito es ésta:

> 🔒 **`exportProductsCsv` no oculta el coste: enumera las cinco columnas de su CSV.** El `select`
> es la cabecera del fichero, y `cost` queda fuera por no estar en el formato, igual que `id` o
> `createdAt`. Si algún día el CSV debe llevar coste, lo que se cambia es el formato —cabecera y
> `select` a la vez—, no el mecanismo.

---

## 4 · La medida correcta del defecto de forma, que SÍ existe

El ticket §3 y el encargo coinciden en lo único que aquí es un defecto real, y hay que enunciarlo
como es:

> ⚠️ **`include` sin `select` no es «le falta un select»: es que cada columna nueva del modelo entra
> sola en la respuesta sin que nadie lo decida.** El agujero crece con el esquema.

`Product` tiene hoy 13 escalares; `listProducts` sirve las 13. Cuando alguien añada la 14ª, se
servirá también, y nadie habrá decidido nada. **Eso pasa en 146 sitios, en 20 modelos.** Es un
ticket de patrón —del tamaño de `Completo<>` en SCRUM-734— y no cabe en éste.

---

## 5 · Lo que propongo, y decide el fundador (regla 9)

1. **Cerrar SCRUM-752 con la frase del §3 dentro**, que es literalmente lo que su §1 pide: hay
   motivo, está medido, se declara y no se toca.
2. **Abrir ticket de patrón** para los 146 sin `select`, priorizando por lo que sirven (`quote`,
   `invoice`, `charge` son los tres primeros) — no por fichero.
3. **No tocar `listProducts`.** Su apertura y su `cost` son la decisión del 24-ago/5-sep.

## 6 · Lo NO tocado

`src/` entero · `listProducts` · `exportProductsCsv` · `prisma/schema.prisma` · los permisos ·
ningún estado ni flag (27) · ninguna dependencia (36). Ninguna base, ninguna clave. **Nada ejecutado
contra producción ni contra staging.**
