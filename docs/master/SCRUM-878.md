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
