# SCRUM-472 · Un script no fabrica firmas

**Fecha:** 11-ago-2026 · **Carril:** fiscal/evidencias · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `68ea282b32031c36547ab668ac4138db584636e4` · 2026-08-11T17:27:30Z

**Paso 0:** `docs/master/SCRUM-472.md` no existía en `main` ni en ninguna rama remota (listado
COMPLETO de las 214 ramas, filtrado después — no un filtro pedido al servidor), y ningún worktree
la tenía.

## 1 · 🔴 PASO 0 (a) · POR QUÉ ESTABA EN EL MERCHANT 22 — y la premisa se cae

El encargo decía: *«`seed-video.mjs` aborta si no encuentra el merchant demo, así que esa fila no
debería estar donde está»*. **Leído el código, el seed nunca escribe en el demo.** De las tres
explicaciones posibles, es la primera —**el guard no hace lo que se cree**— y en su forma más
completa: no es que fallara, es que **nunca hubo tal guard de destino**.

```js
// scripts/seed-video.mjs — preflight
const demo = await prisma.merchant.findFirst({ where: { OR: [{ id: 1 }, { email: 'demo@yaqu.app' }] } });
if (!demo) abort('No encuentro el merchant demo … aborto por seguridad.');
```

Eso **reconoce el entorno**, no acota el destino: solo dice «esta BD se parece a la nuestra». El
destino sale de otro sitio, ~240 líneas más abajo:

```js
const merchant = await tx.merchant.create({ data: { name: 'Fontanería Torres', email: OWNER_EMAIL, … } });
if (merchant.id === 1) throw new Error('El merchant creado tomó id=1 (reservado al demo). Aborto.');
const mid = merchant.id;
```

**El seed CREA su propio merchant y tiene prohibido tomar el id=1.** Es decir: no solo no escribe en
el demo — **tiene prohibido** hacerlo. El merchant **22 es suyo**, y la fila 5 está exactamente
donde el seed la pone. Las 19 escrituras con `merchantId` del fichero usan `mid`, sin excepción.

> **Lo que queda en pie del ticket es lo otro, y es lo grave:** que ese albarán se escribiera
> **`estado: 'firmado'`** con una firma inventada, sin pasar por ninguna de las dos rutas de firma.

## 2 · PASO 0 (b) · la consulta que lo confirma — NO EJECUTADA

El prefijo no distingue (`data:image/png;base64,iVBORw0K` es la cabecera PNG y sale igual en las
cuatro). Lo que decide es la **cadena completa**:

```sql
-- SOLO LECTURA. No imprime la firma: solo longitud, y si es EXACTAMENTE la de la semilla.
SELECT a."id", a."merchant_id", a."numero", a."firmado_at",
       length(a."signature_url") AS bytes,
       (a."signature_url" = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')
         AS es_la_semilla,
       (a."evidencia_firma" IS NULL) AS sin_sobre
FROM "albaranes" a
WHERE a."estado" = 'firmado'
ORDER BY bytes ASC;

-- Y lo que cierra el (a): que el merchant 22 sea el que crea el propio seed.
SELECT m."id", m."name",
       m."email" = 'lwislg99@gmail.com'  AS es_el_email_del_seed,
       m."acquisition_source" = 'video-demo' AS lo_marco_el_seed
FROM "merchants" m WHERE m."id" IN (18, 22);
```

* `es_la_semilla = true` → confirmado, y el arreglo es éste.
* `es_la_semilla = false` → **el hallazgo es otro y mayor**: alguien firmó con un lienzo vacío por
  una ruta que valida, y entonces lo que falla es la validación, no el seed.

⚠️ Los nombres salen de `prisma/schema.prisma`, verificados uno a uno: tablas `albaranes` y
`merchants`; `signature_url`, `merchant_id`, `firmado_at`, `evidencia_firma`, `acquisition_source`.
Al escribirla puse `m."acquisitionSource"` de memoria y **está mapeada a `acquisition_source`**:
exactamente el fallo del §8, a diez minutos de haberlo corregido en otro fichero. Comprobar el
schema no es un trámite.

## 3 · 🔴 Y un tercer discriminador que el encargo no tenía: el sobre

`evidencia_firma IS NULL`. Las dos rutas de firma construyen el sobre **en el mismo `data`** que
marca `firmado` (SCRUM-462 lo midió y lo guarda). Una firma fabricada por un script no lo trae.

**Y esto reencuadra SCRUM-462.** Aquel ticket vio *«de 4 firmados, 3 sin sobre»* y concluyó que eran
anteriores al mecanismo (22-jul-2026) — cierto por las fechas. Pero **la del merchant 22 del
16-jun no es una firma vieja: es una firma que nunca existió**. Su tabla §3 la lista como
«antes del mecanismo»; con lo medido hoy, esa fila tiene otra explicación.

## 4 · Lo que se arregla

| Antes | Ahora |
| --- | --- |
| `Albaran` con `estado: 'firmado'`, `firmadoAt` y `signatureUrl` de 1×1 px | **`estado: 'emitido'`**, sin firma ni fecha de firma |
| `Quote.signatureUrl = SAMPLE_SIGNATURE` + `evidence.method: 'signature'` | **sin trazo** + `method: 'checkbox'` |
| `SAMPLE_SIGNATURE` (118 car., PNG 1×1) | **eliminada** |

`emitido` es el estado real de un albarán que espera firma, así que el vídeo conserva su pantalla de
albaranes con contenido. Y `checkbox` es un camino real del producto —«Acepto sin firmar»—, que el
expediente ya sabe pintar (`invoicesAdmin.routes.ts:317` → *«Aceptación expresa sin trazo»*).

> **El presupuesto no estaba en el encargo y entra igual**, porque lo destapó el guard al nacer: es
> el MISMO constante, en el MISMO fichero, y **de `Quote.signatureUrl` deriva el libro registro su
> «presupuesto firmado»** (`libroRegistro.repo.ts`). Dejarlo fuera habría exigido una excepción
> silenciosa en el guard — justo lo que esta casa no permite.

## 5 · El guard, y por qué es un censo NUEVO

`tests/scrum472-seed-no-fabrica-firmas.test.mjs` — sin gate, sin BD, sin red.

**`scripts/` estaba fuera de todos los censos del árbol.** El de SCRUM-462
(`_censo-escrituras-albaran.mjs`) recorre solo `.ts` y solo ficheros con `albaran.update`: los
`.mjs` y sus `create` le son invisibles. **No se ensancha** — su propia cabecera cuenta que al
ampliarlo «por completitud» cambió el significado del guard de SCRUM-361 y empezó a acusar a quien
hacía lo correcto. Se **consume** para una tercera pregunta.

**Dos invariantes distintas, y las dos hacen falta:**

| Ticket | Exige |
| --- | --- |
| SCRUM-462 | que toda escritura que marque `firmado` **construya su sobre** |
| SCRUM-472 | que **valide la imagen** — y que ningún script escriba ninguna de las dos cosas |

Un sobre impecable alrededor de un lienzo en blanco sigue siendo un albarán que nadie firmó.

### 🔴 El guard salió ROJO contra el árbol SIN TOCAR

No hubo que inyectar nada para el vector: nombró las dos escrituras reales —
`scripts/seed-video.mjs:540` y `:421`— antes de que se arreglara ninguna.

### Los siete rojos

| Se rompe… | El guard dice… |
| --- | --- |
| el seed apunta a otro merchant | *«EL SEED ESCRIBE EN UN MERCHANT QUE NO ES EL SUYO»* + la línea y el valor |
| vuelve `estado:'firmado'` | *«UN SCRIPT ESTÁ FABRICANDO UN DOCUMENTO FIRMADO»* |
| vuelve un trazo inventado | *«UN SCRIPT ESTÁ ESCRIBIENDO UNA FIRMA»* |
| **una firma bajo OTRA clave** (`notasFirma:`) | la misma — se mira el data-URI, no el nombre del campo |
| una ruta de `src/` deja de validar | *«ha dejado de validar la firma… prohibirle al script escribir firmas no protege nada»* |
| el censo deja de ver `scripts/` | *«ESCÁNER CIEGO: cero ficheros recorridos»* |
| el seed deja de sembrar albaranes | *«HAY UN BLOQUE DEL SEED DESACTIVADO CON UNA CONDICIÓN CONSTANTE»* |

### 🔴 Dos veces me cazó mi propio mecanismo

1. **El guard casaba su propio comentario.** Buscaba `signatureUrl` en el TEXTO del `data:`, y
   `getText()` de un objeto **trae sus comentarios dentro**: el comentario que explica la
   prohibición hacía caer el guard. Ahora recorre las **propiedades del AST**. Es la lección de
   `_guard-texto.mjs` un piso más abajo — y van seis.
2. **El control de bloques apagados acusaba a los inocentes.** Buscaba `false|0` por expresión
   regular y señalaba `merchantCount === 0`, `p.cost > 0` y `(i % 2 === 0)`: **rojo con el árbol
   limpio**. Ahora mira el tipo de nodo (`FalseKeyword`, literal `0` a la izquierda de un `&&`).

## 6 · 🔴 El control negativo tiene un límite, y lo digo yo antes que nadie

El rojo nº 7 **salió VERDE la primera vez**. El inventario cuenta llamadas del AST, y desactivar el
bloque con `if (false && …)` no las borra del árbol: *«sigue sembrando»* para el censo, y **cero
filas** en la base. El hueco por donde se cuela de verdad —el bloque apagado— queda tapado con su
assert propio, pero **esto sigue siendo un inventario del código, no una ejecución**.

Lo que faltaría para la prueba entera: correr el seed contra una BD desechable y contar filas. Hace
falta un Postgres local; el portable que había en la máquina **está incompleto** (solo `bin/` y
`lib/`, sin `share/`: `initdb` no arranca). No se ha corrido contra ninguna base — y **no se corre
contra staging**, porque el seed crea un merchant.

## 7 · 🔴 Lo que NO se ha tocado, y lo que hay que decidir

**La fila 5 sigue exactamente donde está.** No se ha borrado ni modificado: un registro fechado y
falso es peor que ninguno, pero retirarlo lo decide el fundador. Está en el merchant 22, con
`firmado_at` 2026-06-16, sin sobre, y ahora se sabe qué es.

Tampoco se han tocado: **las dos rutas de firma** (validan bien, y el guard las usa como suelo),
`prisma/schema.prisma`, el sellado, ni ningún otro script.

## 8 · Añadido · las consultas de SCRUM-445, corregidas

La ① reventó en producción con `column c.customerId does not exist`. **El aviso del propio fichero
era correcto y no se aplicó a sí mismo**: avisaba de que `invoices` va en camelCase, y el error
estaba en `charges`. Dos columnas mal, las dos ahí: `c."customerId"` → `c."customer_id"` y
`c."amount"` → `c."importe"` (ésta no había dado la cara porque la ① revienta antes de llegar).

Corregidas en `docs/master/SCRUM-445.md` con la tabla de columnas verificada una a una contra el
schema. **No ejecutadas.**

## 9 · Tests que corren

- `tests/scrum472-seed-no-fabrica-firmas.test.mjs` — 7 tests (suelo con los tres escritores
  conocidos, dos vectores, alcance del merchant, `src/` valida, dos controles negativos)

Suite completa: **3.119 tests, 0 fallos**. `npm run guards:entrada` y `npm run guard:prisma` en verde.
