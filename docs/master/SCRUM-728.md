# SCRUM-728 · El cerrojo de serie serializa, y diez creaciones no caben en 5 s

**Medido contra:** `origin/main` = `ac282d5553f17072ab2281244e5a3d853fdd176a` · 2026-09-04T22:01:00+02:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Alcance: MEDIR Y PARAR.** No se quita el cerrojo, no se sube el timeout, no se toca una línea
de producción. Lo único que se construye es un guard que **congela** las propiedades medidas.

---

## 0 · 🔴 EL LÍMITE DE ESTA MEDICIÓN, arriba del todo porque condiciona el resto

**Dos de las tres mediciones que pedía el encargo no se han podido hacer, y no por criterio: por
entorno.** Este worktree (`cobroflash-b4`) **no tiene ninguna cadena de conexión**. Acreditado
con la herramienta de la casa **antes de intentar nada**:

```
node scripts/comprobar-claves-bd.mjs
  🔴 DATABASE_URL_STAGING / _DEV / _TESTS: AUSENTES del entorno de este árbol
  🔴 SUELO: no se leyó ni una sola cadena de conexión. Esto NO es un verde
❌ 4 problema(s) de claves en «cobroflash-b4». No se sigue.
```

No hay `.env` en `cobroflash-b4` ni en `cobroflash-b5`; **sí** lo hay en los cuatro árboles
originales. Encaja con el registro de CLAUDE.md, que midió **cuatro** worktrees en SCRUM-418:
los que nacieron después nacieron sin él.

Tampoco hay salida por el banco desechable: **no hay Postgres local ni Docker** — nada
escuchando en 5432 ni en 55432, y `docker` no está instalado.

**No se ha copiado ningún `.env` de otro worktree, ni se ha inventado ninguna cadena, ni se ha
tocado staging o producción.** Lo que sigue es lo que **sí** se puede medir sin base: la
**forma** del coste. Los puntos ① y ② quedan **declarados y sin cubrir**.

## 1 · PASO 0 — entrada y mecanismo

**El mecanismo existe y está construido.** `pg_advisory_xact_lock(SERIE_LOCK_NS, merchantId)`,
namespace `1749`, tomado como primera sentencia de la transacción y liberado al commit.
**Serializa por merchant, que es exactamente lo que tiene que hacer**: es lo único que impide
que dos documentos cojan el mismo número (SCRUM-234).

**Entrada del usuario:** las rutas de alta de albarán (`POST /admin/jobs/:id/albaranes`),
factura y presupuesto. Todas pasan por una `$transaction` que reserva número.

## 2 · ✅ PUNTO ③ RESPONDIDO: el timeout es el DEFECTO de Prisma, no está configurado

Censo por AST (no `grep`: las opciones van en el **segundo** argumento, que queda a decenas de
líneas del `$transaction(` cuando el callback es largo — SCRUM-203).

**SUELO primero:** sobre un cebo con tres llamadas, el detector ve **2 de 2** que sí fijan
opciones. Sin ese verde, un «ninguna las fija» no significaría nada.

| | |
|---|---|
| Población | **266** ficheros de `src/` |
| Llamadas a `$transaction` | **23** (22 con callback, 1 con array) |
| Que fijan `timeout`, `maxWait` o `isolationLevel` | **0** |

Y los valores por defecto, leídos **del paquete instalado**, no de memoria
(`@prisma/client` 6.18): `maxWait ?= 2000`, `timeout ?= 5000`, y en el runtime
`maxWait: a.transactionOptions?.maxWait ?? 2e3`.

### 🔴 Y aparece un segundo límite que el encargo no nombra: `maxWait` = 2 s

Conviene no mezclarlos, porque **son dos modos de fallo con mensajes distintos**:

* el cerrojo se espera **dentro** de la transacción, así que esa espera corre contra el
  **`timeout` de 5 s**;
* pero diez transacciones simultáneas también compiten por el **pool de conexiones**, y esa
  espera corre contra el **`maxWait` de 2 s**.

Un diagnóstico que sólo mire el de 5 s puede estar mirando el límite equivocado.

## 3 · El coste estructural de la sección crítica — medido por forma, sin base

| Función | Viajes a la base dentro del cerrojo |
|---|---|
| `allocateInvoiceNumber` | cerrojo + `merchant.findUnique` + `merchant.update` = **3** |
| `allocateAlbaranNumber` | **3** (misma forma) |
| `allocateQuoteNumber` | **3** (misma forma) |
| `emitInvoice` | los 3 anteriores + `invoice.create` = **4** |

### ⚠️ Y aquí va una INFERENCIA, marcada como tal porque no la he cronometrado

Con un RTT de ~100 ms contra base remota, 4 viajes ≈ **400–500 ms por creación**, y diez en
serie ≈ **4–5 s** — que es donde caen los **~5.200 ms** que midió S2. Eso **apunta** a la
hipótesis «~520 cada una», no a «una lenta y nueve rápidas».

**Pero es una inferencia a partir de un RTT supuesto, no una medición.** El punto ① del encargo
—cronometrar UNA reserva sola— sigue **sin responder**, y es el que decide el arreglo. No lo doy
por contestado.

## 4 · 🔴 EL HALLAZGO: una sección crítica que escala con los datos

`src/modules/jobs/domain/recapitulativa.service.ts:72` es **la única de las 23** que reserva
número **dentro de un bucle**:

```ts
const facturas = await prisma.$transaction(async (tx) => {
  for (const g of grupos) {
    const invoice = await emitInvoice(tx, { … });   // ← toma el cerrojo, 4 viajes
    await tx.albaran.updateMany({ … });             // ← uno más
  }
});
```

Una sola transacción recorre los grupos y **cada vuelta toma el cerrojo**. La sección crítica no
es constante: es **proporcional a los datos** (N grupos × ~5 viajes) — y **el timeout de 5 s no
depende de N**. Un cliente con albaranes de varios meses naturales produce varios grupos, porque
el art. 13 obliga a una factura por mes.

El comentario del propio fichero dice *«una sola `$transaction` para todos los grupos: si algo
falla, no consolida a medias»*, y esa razón **es buena**. No se propone romperla aquí: se deja
medida, porque cualquier arreglo del timeout tiene que saber que hay un camino cuyo coste no
está acotado.

## 5 · ⛔ Lo que NO se ha podido medir, y qué haría falta

| Punto del encargo | Estado |
|---|---|
| ① ¿Cuánto tarda UNA reserva sola? | **Bloqueado.** Necesita una base. |
| ② ¿Cuántas creaciones simultáneas del mismo merchant se dan hoy? | **Bloqueado.** Necesita `DATABASE_URL_DEV`. |
| ③ ¿El timeout está configurado? | ✅ **Respondido**: no, es el defecto de Prisma. |

Para desbloquear basta **una** de estas dos, y ninguna la puede tomar una sesión por su cuenta:

1. `DATABASE_URL_DEV` presente en el entorno de este worktree, **puesta por el fundador** — nunca
   copiada de otro árbol ni pegada en el chat.
2. Un Postgres desechable en loopback con base terminada en `_test`, que es lo que ya exigen los
   guards de `LIBRO_PG_URL` (receta en `docs/RUNBOOKS.md`).

**Y cuando se mida ②, el límite va escrito antes de mirar el número:** un cero contra dev **no
autoriza a decir nada de producción** — dev no recibe la carga real.

## 6 · Lo que se construye, y es todo

`tests/scrum728-seccion-critica-de-la-serie.test.mjs` — **5 tests, 5 verdes.** No arregla nada:
congela lo medido.

| | Qué ata |
|---|---|
| ① | el cerrojo es la **primera** sentencia de las tres reservas — si baja, lo que se lea antes queda fuera de la sección crítica y el read-then-write vuelve a ser carrera |
| ② | el censo de «reserva dentro de un bucle» = **exactamente 1**, nombrada |
| ③ | **ninguna** `$transaction` fija opciones |

**③ convierte la prohibición del encargo en mecanismo.** Subir el `timeout` es lo primero que se
le ocurre a cualquiera y es la peor salida a solas: cambia un fallo rápido por una espera larga,
y el usuario acaba esperando más para ver el mismo error. Si alguien lo sube, el test cae y le
pide el número medido y qué pasa al llegar al nuevo límite.

### Probado en ROJO, por el mecanismo

| Mutación | Qué cae |
|---|---|
| el cerrojo deja de ser la primera sentencia | **sólo** ① |
| una segunda reserva dentro de un bucle | **sólo** ② |
| `{ timeout: 20000, maxWait: 10000 }` en una transacción | **sólo** ③ |

Los dos ficheros mutados quedaron **idénticos byte a byte** al original leído de disco antes de
tocar nada (no al blob — lección de SCRUM-570).

**Control negativo:** una transacción sin cerrojo, un bucle que sólo hace `update`, y el
`updateMany` en bucle **de la propia recapitulativa** no saltan — ese marca albaranes, **no
consume número de serie**. Un guard que acusara a esos sería ruido.

## 7 · Lo que NO se hace

* **No se quita el cerrojo.** Es lo único que garantiza que no se duplique un número, y S2 probó
  que sin él la carrera vuelve.
* **No se sube el timeout.** Sin el número del punto ① no hay con qué justificarlo.
* **No se toca `emitInvoice` ni el camino de emisión.** Se ha leído, no modificado (regla 38).
* **No se renumera nada.** La regla 29 sigue intacta: este PR no cambia cómo se asigna un número,
  sólo congela la forma que ya tenía.
* **Cero microcopy.** El censo de marcadores de SCRUM-402 no sube.
