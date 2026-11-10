# SCRUM-1650 · Lectores que pintaban el cliente VIVO donde el documento lo lleva congelado

Partición de SCRUM-1595 (los 5 sitios LIBRES de la medida de S1 en SCRUM-1595 c.21337). Este tramo
construye **2 de los 5**; los otros 3 se paran por el matiz del propio ticket (abajo).

## 2026-11-03 · Listado de albaranes y buscador leen lo congelado

**Medido contra:** `origin/main` = `70eefc40cba2eb9636992b733223bf1555c1755f` · 2026-11-03T07:43:06Z (hora de GitHub, `api.github.com/zen`)

A9: comprobación → `tests/scrum1650-listado-y-buscador-leen-el-cliente-congelado.test.mjs`

### ① Qué se ha construido

| # (c.21337) | sitio | qué cambia |
|---|---|---|
| 1 | `albaranesListado.ts` (columna «cliente») + los dos `select` de `albaranes.routes.ts` (admin y técnico) | pide `customerName`/`customerLegalName` y pinta con `clienteDelDocumento`; borrador (columnas a NULL) → ficha de hoy, como antes |
| 7 | `search.routes.ts` (facturas) | pide `customerName` y pinta `customer.name` con `clienteDelDocumento`; la columna cruda no viaja, la forma de la respuesta no cambia. Se sigue BUSCANDO por la ficha viva (eso es encontrar, no pintar: clase c de 1576) |

- Sin esquema, sin ALTER, sin texto nuevo. Nada del camino de emisión: en `albaranes.routes.ts` sólo
  se tocan los `select` del listado (`GET /`), y en la MISMA línea que ya existía, para no mover los
  números de línea del resto del fichero.
- El tipo `LectorListado` exige las dos columnas: un lector que no las pida no compila.

### ② Lo que NO se ha construido, y por qué (los 3 restantes alimentan al FIRMANTE)

El ticket dice: «Si el arreglo cambia de dónde sale el nombre PRECARGADO del firmante, eso toca lo
que se sella: se para y se pregunta antes de construir esa línea». Medido hoy, eso no le pasa sólo
al #3:

| # | sitio | por qué se para |
|---|---|---|
| 2 | `albaranes.routes.ts` `GET /:id` → `customer.name` | la pantalla de firma presencial lo usa como sugerencia del firmante: `albaranDetailView.js:780` (`firmante: { sugerencia: alb.customer.name }`) → `signaturePad.js:120` lo escribe en el campo del nombre |
| 3 | `albaranPublic.routes.ts` `loadContext` | `firmanteCamposHtml(customerName)` (:291) precarga el firmante; y sólo cambiar el saludo haría que la página dijera un nombre y su PDF (#4 de 1595, STOP, lee la ficha viva) otro |
| 4 | `precarga.service.ts` (`clienteNombre`) | su propio comentario: «es la sugerencia de un toque del firmante (SCRUM-300)» |

La medida de c.21337 sólo vio el matiz en el #3. **Los tres esperan la misma respuesta:** ¿el nombre
sugerido al firmante sale del albarán congelado o de la ficha de hoy?

### ③ Pruebas

- Test nuevo, por las rutas reales de `dist/` con el `select` proyectado como Prisma (lo que no se
  pide no viaja): listado como admin y como técnico (los dos lectores) y buscador.
- **Control positivo:** sin el arreglo en `src/` (stash + build), **3/3 rojos** con su mensaje;
  con el arreglo, 3/3 verdes.
- **Mutante** en `dist` (`delDocumento?.legalName || customer?.legalName || …`: la razón social de
  hoy colándose por el hueco de un congelado sin ella): cae el caso del albarán A-2 en los dos roles.
- Vecinos: scrum301, 1483, 1489, 1576, 1576b, 729, 577 → 79 tests, 78 ok, 0 fallos, 1 salto
  declarado (scrum1489 «CON BASE», sin `LIBRO_PG_URL`: corre en el obligatorio del CI).

## 2026-11-10 · Tramo b — la sugerencia del firmante sale de lo congelado (#2, #3, #4)

**Medido contra:** `origin/main` = `d7fb55ea19b825a26f89bf5b4765c2557eeb3a71` · 2026-11-10T16:55Z (hora de GitHub, cabecera `Date:` de `api.github.com/zen`)

A9: comprobación → `tests/scrum1650b-la-sugerencia-del-firmante-sale-de-lo-congelado.test.mjs`

**El GO.** Los tres sitios de este tramo estaban parados (§② de arriba) porque alimentan el nombre
que se le PROPONE al firmante, y ese nombre acaba sellado en «Firmado por». El fundador lo autorizó
el 10-nov-2026 en la sesión del orquestador: a la pregunta «El arreglo: que ese nombre salga de lo
que quedó CONGELADO en el albarán al emitirlo. Como toca lo que acaba sellado en un documento
firmado, la norma de la casa exige tu OK explícito. ¿Lo doy?» eligió «Sí, adelante (Recomendado)».
Localizador: respuesta a AskUserQuestion («OK albarán»), turno `type:user` de la transcripción
`ed676fd1-feb4-4658-bda2-01f4bf9fb3fc.jsonl` del orquestador, sello local 2026-11-10T16:55:24Z;
S1 lo leyó en la transcripción antes de construir. **Alcance del GO:** ese cambio y nada más del
camino de sellado.

### ① Qué se ha construido

| # (c.21337) | sitio | qué cambia |
|---|---|---|
| 2 | `albaranes.routes.ts` `GET /:id` | `customer.name` sale de `clienteDelDocumento(albaran, ficha)`. `id` y `puedeRecibirWhatsApp` siguen saliendo de la ficha: son a QUIÉN se escribe hoy, no lo que el documento lleva escrito. El fichero **no cambia de número de líneas** (el import se amplía en su misma línea): hay anclas por línea hacia él |
| 3 | `albaranPublic.routes.ts` `GET /:token` | `customerName` (saludo, «Gracias, …» y el valor precargado de `firmanteCamposHtml`) sale de `clienteDelDocumento`. Saludo y sugerencia siguen siendo LA MISMA variable: separarlos haría que la página dijera dos nombres |
| 4 | `precarga.service.ts` `construirPaquetePrecarga` | el `select` pide `customerName`/`customerLegalName`; `clienteNombre` sale de `clienteDelDocumento`. Sin columna ni ficha, la cadena vacía de antes |

- Un albarán anterior al escritor (columnas a NULL) cae a la ficha de hoy: es la excepción DECLARADA
  de `clienteCongelado.ts`, y la regla se llama, no se copia. Un borrador lleva las columnas a NULL
  y en la ficha (`GET /:id`) sigue enseñando la ficha de hoy, como antes; la página pública y la
  precarga sólo atienden albaranes `emitido`.
- No se toca el POST de la firma: el nombre sellado es el que MANDA el firmante. Sin esquema, sin
  ALTER, sin texto nuevo, sin nada del camino de emisión (`emitInvoice` de `albaranes.routes.ts`
  no se toca, y la línea del import cambia sólo para añadir un nombre).

### ② Lo que queda leyendo la ficha viva (NO tocado, y por qué)

| sitio | por qué no |
|---|---|
| PDF del albarán, `albaran.service.ts:642` y `:801` | #4 de SCRUM-1595 (STOP): entrada de lo sellado. **Consecuencia que hay que saber:** si se renombra la ficha entre la emisión y la firma, ahora la página dice el nombre del albarán y el PDF dice el de hoy. Antes decían los dos el de hoy (los dos mal, pero iguales). Se cierra con ese #4, no aquí |
| WhatsApp del albarán, `albaranWhatsApp.service.ts:51` y `:122` (variable `customerName` de la plantilla) | fuera de los 5 de este ticket; carril S1, pero toca un envío a Meta (plantillas = STOP AA1.4). Se anota, no se arregla de paso |

### ③ Pruebas

- Test nuevo: las rutas y el servicio REALES de `dist/` con la base doblada, y el `select`
  proyectado como Prisma. Cinco casos: #3 congelado y anterior, #2 congelado y anterior, #4 los dos.
- **Control positivo:** con los tres ficheros de `src/` como en `origin/main` (build), **3 rojos**
  (los tres congelados), cada uno con su mensaje; los 2 controles «anterior al escritor», verdes.
  Con el arreglo, 5/5.
- **Mutante** en `dist` (quitar `customerName` del `select` de la precarga, que es justo el olvido
  que el doble proyectado tiene que cazar): cae el #4.
- Vecinos (77 ficheros que nombran estos tres ficheros, `clienteCongelado` o 1650): 638 tests,
  636 ok, 0 fallos, 2 saltos declarados (scrum127 y scrum49, sin `QA_DB_TEST` ni `LIBRO_PG_URL`:
  corren en el obligatorio del CI; scrum49 es la firma remota de punta a punta).
