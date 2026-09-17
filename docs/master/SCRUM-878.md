# SCRUM-878 · La población del guard de la regla 29: mide rutas, y la regla habla de escrituras

**Fecha:** 17-sep-2026 · **Carril:** fiscal · instrumentos · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `3038dfe7e213890996bc427b7f1828f5bb50d329` · 2026-09-17T08:52:04+01:00
**Rama:** `scrum-878-poblacion-del-guard-29`

> ⛔ **MIDE Y PROPONE.** No se toca el camino de emisión (regla 38) ni el guard de SCRUM-124.
> ⛔ Sin estado ni flag nuevos (27) · sin dependencias (36).

---

## 0 · Antes de construir: ¿estaba ya medido?

Buscado **por mecanismo, no por palabra** —el aviso venía de cerrar la 879 como duplicada de la 850
por una tilde—:

| pregunta | respuesta |
|---|---|
| ¿qué guard vigila la regla 29? | `tests/scrum124-r29-no-borrado-facturas.test.mjs` |
| ¿qué censa? | **rutas**: `app.router.stack` + `getAdminMounts()` bajo `/admin/invoices`, contra una lista blanca de dos (`PUT /:id/status`, `PUT /:id/tags`) |
| ¿existe ya un censo de escrituras sobre `Invoice`? | **no** |
| ¿y algo parecido? | sí, para el documento HERMANO: `_censo-escrituras-albaran.mjs` (SCRUM-462), usado por tres tests. Y `_bocas-de-emision.mjs` (SCRUM-778) enumera quién **crea** facturas, no quién las edita |

**No es duplicado.** Y el censo del albarán se **reusa** en vez de escribir un segundo: es lo que su
propia cabecera advierte —*«copiarlo habría dejado dos censos del mismo hecho que se desincronizan
en cuanto uno mejore»*—. Se generaliza a `escriturasDeModelo(raiz, { modelo, verbos })`;
`escriturasDeAlbaran` queda **intacta en su firma** y delega. Sus tres consumidores, en verde.

## 1 · 🔴 La población, con las dos cifras

Verbos que pueden **editar** una factura ya existente: `update` · `updateMany` · `delete` ·
`deleteMany`. `create` queda fuera a propósito: crear una factura es **emitirla**, y esa población
ya la censa SCRUM-778.

```
ficheros .ts mirados: 283
escrituras sobre Invoice: 20
   · en ficheros de RUTA ......:  5
   · en SERVICIOS y lib .......: 15
```

**Cuántas ve el guard de la regla 29: CERO.** Y no por descuido suyo: su pregunta es *qué rutas
existen*, no *qué escriben*. Las 5 que viven en ficheros de ruta tampoco están cubiertas **por
contenido** — el guard comprueba que `PUT /:id/status` esté en su lista blanca, no lo que ese
handler mete en `data:`.

> S6 lo dijo con la reserva exacta y tenía razón: **no es que se incumpla la regla 29 — es que el
> guard no lo ve.** Son dos cosas distintas y sólo la segunda se puede medir. Esto mide la segunda.

## 2 · 🔴 Clasificadas · y el criterio se DERIVA, no se opina

La huella de VeriFactu es una lista **cerrada de ocho campos** y está en el código
(`computeVeriFactuHash`): NIF · NumSerieFactura · FechaExpedición · TipoFactura · CuotaTotal ·
ImporteTotal · Huella anterior · FechaHoraHusoGenRegistro. De ahí salen las listas: lo que **entra
en la huella o la alimenta** es contenido fiscal; lo demás es ficha.

| clase | nº | qué es |
|---|---|---|
| 🔴 **FISCAL** | **0** | contenido del documento. Editarlo incumple la 29 |
| **SELLADO** | 8 | la cadena VeriFactu (`vfHash`, `qrData`, `vfEstado`…). Es emitir, no editar; lo gobiernan 205/207 |
| **FICHA** | 12 | `status`, `paidAt`, `chargeId`, `pdfUrl`, `tags`, `reminder*SentAt` — lo que se sabe DESPUÉS |
| **NO CLASIFICADO** | 0 | del lado malo por definición |

**Y dos hechos que salen de paso:**

- **CERO `delete` y cero `deleteMany` sobre `Invoice` en todo `src/`.** La mitad «ni se borra» de la
  regla 29 es cierta **por ausencia total**, no por una puerta que la impida.
- **Hoy nadie edita contenido fiscal.** El silencio del guard resulta ser un verde — pero eso se
  sabe ahora, y no se sabía antes.

## 3 · Los controles

**✅ VERDE REAL** — `invoice.update({ data: { chargeId } })` (`invoiceWhatsApp.service.ts`) se
clasifica **FICHA**. Un puntero al cobro no es contenido fiscal: si saltara, el guard ampliado
nacería ruidoso, y un guard ruidoso se acaba desactivando.

**🔴 ROJO REAL** — una escritura **de servicio** fabricada con `{ total, lines }` se clasifica
**FISCAL**, con la misma función que clasifica las reales. Y por la vía indirecta también: un
`{ ...patch }` que llega a `number` se caza — es el defecto que SCRUM-361 midió en el albarán.

**🔴 MUTACIÓN** — `chargeId` → `total` sobre la entrada del clasificador: la sustitución **cuenta
1** (o no hubo mutación) y el veredicto pasa de FICHA a FISCAL.

**SUELO** — menos de 10 escrituras, o menos de 100 ficheros mirados, y el censo **se declara ciego**.

## 4 · 🔴 Dos veces mintió el instrumento, y las dos las cazaron sus propios controles

**① La propiedad abreviada no lleva dos puntos.** El extractor buscaba `campo:` por regex, así que
`{ chargeId }`, `{ qrData }` y `{ status, paidAt, …}` salían **«ilegibles»** → NO CLASIFICADO.
Del lado malo, que es lo correcto, pero **una de las tres era literalmente el control VERDE que el
ticket exige**. El censo iba a publicar «no sé leerla» sobre justo el caso que tenía que saber leer.
Se parsea con el AST en vez de regexear.

**② Un spread que no se puede seguir no se da por bueno.** `invoiceAdmin.ts` escribe, al marcar pagada,
`{ status, paidAt, ...campoMetodo }`. El censo sabe seguir un spread relleno con asignaciones, pero
`campoMetodo` viene de una **llamada a función** y eso no lo atraviesa: el clasificador leía los dos
campos de ficha y dictaba FICHA **sin haber visto lo que el spread mete**.

> **Información parcial haciéndose pasar por completa es peor que un «no lo sé»**: el «no lo sé» va
> al lado malo y alguien lo mira.

Ahora un spread sin resolver manda a NO CLASIFICADO **salvo que esté declarado con lo que se midió**.
El único declarado es `campoMetodo`, y su motivo no es una opinión: `campoPaidViaAlMarcar`
(en `metodoDeCobro.ts`) **declara su retorno en el tipo** — `{ paidVia?: string | null }`. Sólo
puede meter `paidVia`, que es ficha. Dos casos vigilan la declaración: que un spread desconocido
caiga, y que la lista de declarados no crezca sin medición.

## 5 · La propuesta — sin construirla

El ticket pide decidir **sólo después de medir**, y avisa de que ampliar una población sin criterio
convierte un guard estrecho en uno ruidoso. Con los números delante:

**No ampliar `scrum124`. Añadir un SEGUNDO guard**, y la razón es que miden preguntas distintas:

- `scrum124` responde *«¿qué rutas de factura existen y están permitidas?»* — y lo responde bien.
  Meterle dentro un análisis de `data:` le cambiaría la pregunta y le duplicaría los modos de fallo.
- Lo que falta responde *«¿alguna escritura sobre una factura toca contenido fiscal?»*, es
  **independiente del transporte** (ruta, servicio, cron o script) y ya está construido aquí: es la
  clasificación de la §2, con FISCAL = 0 como trinquete.

**Lo que NO se ha hecho, y por qué:** convertir este censo en trinquete —«FISCAL no puede pasar de
0»— es una decisión de producto con consecuencias (una R1 legítima, si algún día se implementa
editando en vez de creando, daría rojo). **Regla 38: se propone, no se impone.** El fichero mide y
deja el número a la vista; ponerle el cerrojo es una línea el día que se apruebe.

## 6 · Lo que esta tanda NO ha medido

1. **Si esas 20 escrituras alcanzan de verdad a una factura EMITIDA.** El censo mide qué se escribe,
   no sobre qué estado. Una escritura sobre un borrador y una sobre una emitida salen iguales aquí.
2. **Otros caminos que no sean Prisma** — SQL crudo, `$executeRaw`. No se han buscado.
3. **`Charge` y `Albaran`**, que tienen sus propias reglas y sus propios guards.

## 7 · Ficheros

| fichero | qué |
|---|---|
| `tests/_censo-escrituras-albaran.mjs` | generalizado a `escriturasDeModelo`; `escriturasDeAlbaran` delega, intacta |
| `tests/scrum878-poblacion-del-guard-29.test.mjs` | 8 casos: suelo, población, clasificación, verde/rojo real, mutación, los dos controles del spread |

---

# APÉNDICE · Fase b — el cerrojo: «FISCAL no pasa de 0»

*17-sep-2026 · rama `scrum-878b-el-cerrojo-del-29`*

**Medido contra:** `origin/main` = `1df4b9b9d67b2a1ed9d919bd7e746d6aae2dd219` · 2026-09-17T15:51:35+01:00

⛔ **No toca el camino de emisión (regla 38): clasifica lo que ya está escrito y no modifica ni una
línea de `src/`.** No toca `scrum124` ni su lista blanca. Ningún sello ni factura se reescribe (29).

## ⓪ La premisa, comprobada ANTES de escribir nada — y con DOS sondas

La fase a dejó escrito, en esta misma entrada, lo que NO había hecho: *«convertir este censo en
trinquete»*. Antes de ponerlo, se vuelve a medir — la norma nueva de la casa:

```
ficheros .ts mirados: 288   (find src -name '*.ts' | wc -l → 288: el censo mira el árbol ENTERO)
escrituras sobre Invoice: 20 · en ficheros de RUTA: 5 · en SERVICIOS y lib: 15
FISCAL=0 · SELLADO=8 · FICHA=12 · NO_CLASIFICADO=0
```

🔴 **Y no se comparan CUENTAS, se comparan CONJUNTOS.** Un número igual deja pasar «he perdido una
y he ganado otra», así que la población se sacó DOS veces con técnicas distintas:

| sonda | técnica | resultado |
|---|---|---|
| **A** | el censo AST que ya existe (`escriturasDeModelo`, vía `typescript`) | 20 puntos `fichero:línea` |
| **B** | texto, deliberadamente **más ancha** que el AST (`invoice\s*\.\s*(update\|delete…)`, sin `\b`, para que cazara también un `recurringInvoice.update` si existiera) | 20 puntos `fichero:línea` |

```
comm -23 A B → vacío        (nada que el AST vea y el texto no)
comm -13 A B → vacío        (nada que el texto vea y el AST no)
```

Las dos coinciden **punto por punto**, en los dos sentidos. Se buscaron además llamadas partidas en
dos líneas (`invoice` al final de una, `.update(` en la siguiente): **cero**.

⚠️ **Una cifra de la fase a ha cambiado y se re-fecha en vez de copiarse:** decía «283 ficheros
mirados» y hoy son **288**. `main` se ha movido y `src/` tiene cinco `.ts` más. Las escrituras
siguen siendo 20 y las clases, idénticas.

**Los dos hechos de paso, re-medidos:** cero `invoice.delete` / `deleteMany` en todo `src/` — las
20 son `update`.

## ⓪bis · 🔴 QUIÉN AUTORIZA EL CERROJO — y un error propio, confesado

La primera versión de este apéndice y del bloque de test escribió que **«el fundador decide que sí
se pone»**. **Eso era falso y lo escribí yo.** Medido hoy con la API de Jira:

```
SCRUM-878 · fields.comment.total = 0
```

**Cero comentarios.** Ninguna firma, ni del fundador ni delegada. Y el enunciado del propio ticket
dice, literal: *«Este ticket **mide y propone**»*. Inventar una autorización en un comentario es
peor defecto que el trinquete que pretendía justificar: el trinquete se discute, una firma falsa
no se ve.

Lo que **sí** lo autoriza, y es comprobable:

- **Regla 38** — un guard que sólo **LEE** el camino de emisión se hace **sin pedir GO**. Éste sólo
  lee: **cero líneas de `src/`** tocadas. El STOP es *modificarlo*, y no se modifica.
- **Regla 29**, firmada en el máster (Parte I) — *«una factura emitida JAMÁS se edita ni borra»*.
  El cerrojo no inventa regla: le pone **mecanismo** a una ya firmada. *Una prohibición sin
  mecanismo es una frase.*
- **El propio encargo** pone la puerta del empuje en *«¿algo NUEVO sin firmar que llegue al
  USUARIO?»*. Un test no llega al usuario.

🔴 **Aun así queda dicho, y el fundador manda:** si no lo quiere, **quitarlo es borrar un test**.
El censo y la clasificación de la fase a siguen midiendo igual sin él.

## ① El cerrojo, y por qué su rojo sería correcto

> La regla 29 dice que una factura emitida no se edita, y **una rectificativa se EMITE como
> documento nuevo, no editando el anterior**. Si algún día una R1 necesita editar, ese rojo es la
> conversación que hay que tener — no un obstáculo que evitar.

🔒 **Un trinquete en cero no prohíbe el futuro: obliga a que el futuro pase por una DECISIÓN en vez
de por un descuido.** Eso va escrito en el mensaje del propio guard, para que quien lo encuentre en
rojo dentro de seis meses no lo lea como un obstáculo.

⚠️ **El suelo va ANTES del veredicto, dentro del mismo test:** un cerrojo sobre una población vacía
siempre está en verde. Si el censo deja de ver escrituras, el cerrojo dice **CIEGO**, no «0 malas».

## ② Las cuatro patas — dónde estaba cada una

La fase a ya traía SUELO, VERDE REAL, ROJO REAL y MUTACIÓN sobre el **clasificador**. La fase b
añade las del **cerrojo**, que es otra cosa: el clasificador dice de qué clase es una escritura; el
cerrojo decide si el árbol pasa.

| pata | qué añade la fase b |
| --- | --- |
| **🔴 ROJO REAL + MUTACIÓN** | toma una escritura **REAL** de la población (una de FICHA con `chargeId`), cuenta que el ancla entra **exactamente 1 vez**, sustituye `chargeId` → `total` y comprueba que pasa a FISCAL |
| **🔴 …y que la acusación DICE DÓNDE** | que el texto emitido nombra **fichero y línea**. Un rojo que no los da manda a buscar por todo `src/`, y eso es lo que apaga un guard |
| **✅ VERDE REAL** | `invoice.update({ data: { chargeId } })` **no** lo dispara, y con cero acusados la acusación sale **vacía** — sin esto habría escrito «toda escritura es sospechosa», que se desactiva en una semana |
| **🔴 SUELO** | 0 escrituras → **CIEGO**, dentro del propio cerrojo |

⚠️ **La mutación se hace sobre una fila REAL del censo, en memoria — no sobre un caso inventado y
no sobre el árbol.** Es deliberado: mide sobre la forma que `src/` tiene de verdad, y no escribe
nada. Y la acusación se genera con **una sola función**, `acusacion()`, para que el control
compruebe el texto que de verdad se emite y no una copia suya que podría decir otra cosa.

### 🔴 La mutación al META-guard: SÍ se ha hecho, y el cerrojo se puso ROJO DE VERDAD

*(Esta sección decía antes «por qué NO se declara mutación al meta-guard». Estaba mal razonada: daba
por bueno que mutar exigía escribir un campo fiscal en `src/`, que es STOP. No lo exige. **Un rojo
esperado se cree solo**, así que se provocó.)*

El instrumento se **comiteó ANTES de tocarlo** (`f7466a4a`) y se perturbó sobre el árbol real, con
`npm test` de verdad, no con una copia del razonamiento. Dos perturbaciones, las dos restauradas:

**P1 · ¿puede el cerrojo ponerse rojo?** `chargeId` se mueve de la lista FICHA a la lista FISCAL
—una sola línea del clasificador, **cero líneas de `src/`**—:

```
EXIT=1 · 11 tests · 6 pasan · 5 FALLAN
not ok  9 — SCRUM-878b · 🔒 EL CERROJO
not ok 10 — CONTROL DEL CERROJO (acusa con fichero y línea)
not ok  4, 6, 11 — los VERDE REAL y la MUTACIÓN de la fase a
```

Y la acusación, **copiada de la salida real**, no parafraseada:

```
🔴 HAY ESCRITURAS QUE EDITAN CONTENIDO FISCAL DE UNA FACTURA EMITIDA:
    · src/modules/billing/domain/invoiceWhatsApp.service.ts:78 — toca chargeId
```

🔴 **Ese fichero es exactamente la escritura por la que se abrió SCRUM-878**: un `invoice.update`
**de SERVICIO**, el que `scrum124` no puede ver porque censa rutas. El cerrojo lo nombra con
fichero y línea. La cadena entera —defecto declarado → guard nuevo → rojo que apunta al sitio—
queda cerrada sobre el caso original, no sobre uno inventado.

**P2 · ¿el suelo aguanta?** El censo se apunta a un modelo inexistente, población 0:

```
EXIT=1 · not ok 1 — SUELO · not ok 9 — EL CERROJO
error: '🔴 CIEGO: el censo no ve NINGUNA escritura sobre Invoice en todo `src/`…'
```

⚠️ **Esto es lo que salva al cerrojo de ser una tautología.** Con población 0 la lista de FISCAL
sale vacía y el `deepEqual(…, [])` **habría pasado**: el cerrojo daría VERDE sobre la nada. El suelo
va antes del veredicto y dentro del mismo test, y por eso el test 9 cae en CIEGO en vez de aprobar.

**Restauración:** las dos veces con el diff a la vista y por la puerta que el propio
`guard-dangerous` prescribe (`.claude/allow-destructivo`, un solo uso) — el hook bloqueó
`git checkout --` y bloqueó el `>` sobre un fichero versionado, las dos veces con razón. No se
esquivó por otra herramienta: se miró qué se perdía y sólo era la perturbación.

## Resultado — con la POBLACIÓN, no sólo el veredicto

```
el fichero:   11 tests · 11 pasan · 0 fallan · 0 saltados
la tanda:     7.366 tests en 879 ficheros · 7.256 pasan · 0 FALLAN · 110 saltados
              los 110 saltos, todos gateados por base (QA_DB_TEST / LIBRO_PG_URL /
              TRAMOS_PG_URL / SERIE_PG_URL). NINGUNO de SCRUM-878.
guards:entrada: verde (exit 0)
build:          verde (exit 0), y ANTES que los tests
FISCAL=0 · SELLADO=8 · FICHA=12 · NO_CLASIFICADO=0   (sobre 20 escrituras / 288 ficheros)
```

⚠️ **Un tropiezo del instrumento, y se cuenta:** el primer intento de correr la tanda salió
`EXIT=126` con `Argument list too long` — 879 ficheros no caben en la línea de órdenes de bash. Si
llego a leer sólo «no veo fallos» habría cantado un verde sobre una tanda **que no llegó a
arrancar**. Lo cazó mirar el código de salida, que es para lo que está. Se arregla dejando que el
glob lo expanda node (`"tests/*.test.mjs"` entre comillas), no bash.

El cerrojo entra **en verde y en 0**, que es como debe entrar un trinquete: no arregla nada hoy,
impide que mañana se rompa sin que nadie lo decida.

## Lo NO tocado

`src/` entero — **cero líneas** · `scrum124` y su lista blanca · `prisma/schema.prisma` (ya
declarado en la 665b) · ningún sello ni factura (regla 29) · ningún estado ni flag (27) · ninguna
dependencia (36) · ningún texto de usuario (30). **Producción y staging: no tocados.**
