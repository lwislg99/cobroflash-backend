# SCRUM-728 · El cerrojo de serie serializa, y diez creaciones no caben en 5 s

**Medido contra:** `origin/main` = `ac282d5553f17072ab2281244e5a3d853fdd176a` · 2026-09-04T22:01:00+02:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Alcance: MEDIR Y PARAR.** No se quita el cerrojo, no se sube el timeout, no se toca una línea
de producción. Lo único que se construye es un guard que **congela** las propiedades medidas.

---

## 0 · Cómo empezó esta medición: sin base, y desbloqueada después

> ✅ **RESUELTO — ver el APÉNDICE al final: ①, ② y ③ están medidos contra dev.** Esta sección se
> conserva porque explica por qué la primera mitad del trabajo se hizo sin base, y porque el
> bloqueo puede repetirle a cualquier sesión que nazca en `b4`/`b5`.

**Al arrancar, dos de las tres mediciones no se podían hacer, y no por criterio: por entorno.**
Este worktree (`cobroflash-b4`) **no tenía ninguna cadena de conexión**. Acreditado con la
herramienta de la casa **antes de intentar nada**:

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
—cronometrar UNA reserva sola— sigue **sin responder** en este punto del trabajo, y es el que
decide el arreglo. No lo doy por contestado.

> ### 🔴 VEREDICTO POSTERIOR: esta inferencia acertó la FORMA y falló el NÚMERO
>
> Medido después (apéndice A2): el RTT real es **175 ms**, no los ~100 que supuse, y una reserva
> tarda **~880 ms**, no 400–500. **Me quedé corto casi a la mitad.**
>
> Y el error tiene una causa concreta que conviene no perder: conté **3 viajes** (cerrojo +
> `findUnique` + `update`) y **son 5** — me olvidé del `BEGIN` y el `COMMIT` de la propia
> transacción, que también son viajes de red. Con 5 × 175 = 875 ms, el número cuadra al 0,3 %.
>
> **La conclusión cualitativa sí resistió** («~520 cada una», no «una lenta»): son estables, sólo
> que a 880. **Se deja escrito el fallo en vez de corregir el párrafo**, porque una inferencia que
> se edita después de ver el resultado deja de poder evaluarse.

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
| ① ¿Cuánto tarda UNA reserva sola? | ⏳ bloqueado entonces → ✅ **medido**, ver apéndice |
| ② ¿Cuántas creaciones simultáneas del mismo merchant se dan hoy? | ⏳ bloqueado entonces → ✅ **medido**, ver apéndice |
| ③ ¿El timeout está configurado? | ✅ **Respondido**: no, es el defecto de Prisma. |

Para desbloquear basta **una** de estas dos, y ninguna la puede tomar una sesión por su cuenta:

1. `DATABASE_URL_DEV` presente en el entorno de este worktree, **puesta por el fundador** — nunca
   copiada de otro árbol ni pegada en el chat.
2. Un Postgres desechable en loopback con base terminada en `_test`, que es lo que ya exigen los
   guards de `LIBRO_PG_URL` (receta en `docs/RUNBOOKS.md`).

**Y cuando se mida ②, el límite va escrito antes de mirar el número:** un cero contra dev **no
autoriza a decir nada de producción** — dev no recibe la carga real.

### 5 bis · El diseño de esa medición, escrito ya para no volver a pensarlo

**Decidido con el fundador (4-sep-2026): la salida es (1) — `DATABASE_URL_DEV` en el entorno de
este worktree, puesta por él.** Cuando esté, la medición es ésta, y se deja escrita **antes** de
tener el número para que el número no la moldee:

* **Lo primero, el destino.** `parseBDSegura` de `scripts/_db-guard.mjs` — **nunca** parseo a
  mano (regla R7; el guard de SCRUM-226 lo hace cumplir). Y el guard por **destino** de
  SCRUM-418: si la cadena no apunta a dev, el script **para**. Un script de medición que se
  equivoque de base escribe donde no debe.
* **①, y en este orden**, porque las tres preguntas no son la misma:
  1. una reserva **sola**, sin competencia — N repeticiones en serie, y se reporta la
     **mediana y el máximo**, no la media: una media esconde justo el caso «una lenta»;
  2. el **RTT desnudo** (un `SELECT 1`), para poder restarlo y saber cuánto es red y cuánto es
     el trabajo — sin esto, «520 ms» no dice si sobran viajes o si la red es lenta;
  3. **diez simultáneas**, y se guarda **el tiempo de CADA una**, no la suma. Ahí es donde se
     ve si son diez de ~520 o una de 4.000 y nueve de 130 — que es literalmente la pregunta
     del encargo, y **la suma no la puede responder**.
* **⚠️ Y ① ESCRIBE: consume números de serie en dev.** No es una lectura. Va dicho aquí porque
  quien lo ejecute debe saberlo antes, y porque deja huecos en la serie de dev —inocuos ahí,
  pero no invisibles—.
* **SUELO obligatorio:** si el instrumento no distingue una reserva de un `SELECT 1`, sus
  milisegundos no miden lo que dice el nombre. Y si las diez simultáneas **no** se estorban
  entre sí, es que no están compitiendo por el mismo merchant y la medición no vale.
* **②** se cuenta sobre lo que la base ya guarda (`createdAt` de albaranes, facturas y
  presupuestos por merchant, agrupado por ventanas cortas). **Es sólo lectura.**

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

---

# APÉNDICE · ①, ② y ③ MEDIDOS CONTRA DEV — el defecto reproducido

**Medido contra:** `origin/main` = `8303db7524d3e0e90659c49f840d47adefaf6d5f` · 2026-09-04T22:40:00+02:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Cómo se desbloqueó:** el fundador autorizó copiar **`DATABASE_URL_DEV`, y sólo esa variable**,
desde el `.env` de un worktree hermano. Se comprobó primero que **ninguna** de las 8 claves de
ese fichero parecía de producción (`_DEV`, `_STAGING`, `_TESTS` y cinco `VERIFACTU_*` de
metadatos; **no existe `DATABASE_URL`**). **No se copió el fichero entero**, no se ha impreso el
valor en ningún momento, y `.env` está ignorado (`.gitignore:69`) y **sin trackear**.

**Destino verificado con el mecanismo de la casa**, que lo dice sin enseñar la cadena:

```
[destino] DATABASE_URL_DEV → acela.proxy.rlwy.net/yaqu_dev_javier (DESARROLLO) ✅
```

Es **remota** (Railway), que es justo lo que ① necesita: un loopback habría contestado con un
número correcto a una pregunta que nadie hizo.

## A1 · 🔴 NO SE HA CREADO NI UNA FILA, y así está probado

Cada reserva se ejecuta dentro de una transacción que termina en **ROLLBACK deliberado**: mide el
coste real de la sección crítica y no persiste nada. El advisory lock es de transacción, así que
el rollback también lo suelta.

```
POST-CONDICIÓN · nextAlbaranNumber 1 -> 1  ✔ nada persistido
                 albaranes del merchant 1: 0
```

**Cero documentos creados, cero números consumidos, cero huecos en la serie.** No hizo falta
borrar nada porque no se creó nada — ni teléfonos de prueba, así que el defecto de
`telefonoDePrueba` (SCRUM-629, de S5) no toca aquí.

## A2 · ✅ ① UNA RESERVA SOLA — **no es un número, es una dispersión**

n=30, en serie, sin competencia. **Dos corridas independientes**, para que el número no sea de
una vez:

| | min | mediana | p90 | max |
|---|---|---|---|---|
| **una reserva** (corrida 1) | 882,9 | **885,7** | 889,7 | 1060,7 |
| **una reserva** (corrida 2) | 876,0 | **878,0** | 883,0 | 1054,0 |
| RTT desnudo (`SELECT 1`) | 174,7 | **175,1** | 176,4 | 183,5 |

**SUELO:** la reserva cuesta 5× un `SELECT 1`. Si no se hubiera distinguido, los milisegundos no
medirían lo que dice el nombre y el script aborta.

### 🔴 LA RESPUESTA A ①: son ~880 ms CADA UNA, y la dispersión es ESTRECHA

**No es «una lenta y nueve rápidas».** Entre el mínimo y el p90 hay **7 ms** sobre 880. La
reserva es **estable**, y las dos corridas coinciden en un 0,9 %. **Eso decide el arreglo**: no
hay un caso patológico que cazar — el coste es estructural y lo paga cada una.

### Y el coste es RED, casi entero

**5 viajes × 175,1 ms = 875,5 ms**, contra **878,0 medidos**. Cuadra al **0,3 %**. Los cinco son
`BEGIN` + `pg_advisory_xact_lock` + `findUnique` + `update` + `COMMIT`.

**No hay trabajo de CPU que optimizar: hay viajes que ahorrar.** Y eso apunta a un arreglo
concreto —fundir `findUnique`+`update` en un solo `UPDATE … RETURNING`— que quitaría **1 de 5
viajes (−20 %)**. **No se construye aquí**, y además no basta por sí solo: ver A5.

## A3 · 🔴 ① bis · DIEZ SIMULTÁNEAS — el defecto, reproducido

```
completadas 6 · fallidas 4
tiempos OK : 1395, 2626, 3500, 4389, 5273, 6163   ← una escalera de ~880 ms
tiempos KO : 6648, 6660, 6679, 6699
```

**El cerrojo hace exactamente su trabajo**: cada una espera a la anterior ~880 ms. La escalera es
la prueba de que la serialización es correcta.

### El error que ve el usuario, capturado

```
PrismaClientKnownRequestError · code P2028
Transaction already closed: A query cannot be executed on an expired transaction.
The timeout for this transaction was 5000 ms, however 5184 ms passed since the start
of the transaction.
```

Los **cuatro** fallos son **P2028**, ni uno distinto: **no se mezclan modos de fallo**, y el
`maxWait` de 2 s (el del pool) **no llegó a entrar**. Y el fallo ocurre **dentro de
`$executeRaw`**, o sea **esperando el cerrojo** — no después.

### 🔴 EL UMBRAL REAL NO ES 10: ES 6

5000 ms ÷ 880 ms = **5,7**. **A partir de la sexta creación simultánea empieza a fallar**, y la
medición lo confirma: **6 pasan, 4 caen**. El ticket habla de diez; **el listón está más bajo de
lo que decía**, y eso hace el problema **más** probable, no menos.

## A4 · ✅ ② LA CONCURRENCIA QUE HAY HOY EN DEV — con su suelo y su límite

**Sólo lectura.** Ni un `INSERT`, `UPDATE`, `DELETE` ni DDL.

**SUELO primero, porque un cero hay que ganárselo:** con una ventana de un año, la consulta
encuentra **2 grupos** de más de un documento del mismo merchant. **Sabe agrupar y sabe
encontrar**, así que su cero significa «no hay», no «no supe mirar».

| Tabla | Filas en dev | Ventanas de 5 s con 2+ del mismo merchant | Ráfaga mayor |
|---|---|---|---|
| `albaranes` | 0 | 0 | 0 |
| `invoices` | 0 | 0 | 0 |
| `quotes` | 8 (2 merchants) | **3** | **3** |

**Ráfaga máxima observada: 3.** Tres seguidas tardarían ~2,6 s y **caben** en los 5 s. Hoy, en
dev, esto **no** se está rompiendo.

### ⚠️ El límite, escrito antes de mirar el número

**Dev NO es producción.** Dev tiene 8 presupuestos y cero albaranes y cero facturas: **no recibe
la carga real**, así que este 3 **no autoriza a decir que en producción no pasa**. Mide el dato
que hay, no el riesgo.

## A5 · ✅ ③ EL TIMEOUT — fichero y línea, y confirmado en ejecución

1. **No está configurado en el producto.** Censo por AST sobre **266** ficheros de `src/`: **23**
   llamadas a `$transaction`, **0** fijan `timeout`, `maxWait` o `isolationLevel`. Suelo del
   detector verde (ve 2 de 2 en un cebo).
2. **Es el defecto de Prisma**, leído del paquete instalado:
   `node_modules/@prisma/client/runtime/library.d.ts:2654-2655` → `maxWait ?= 2000`,
   `timeout ?= 5000`.
3. **Y confirmado EN EJECUCIÓN**, que es más fuerte que leerlo: el propio P2028 dice
   *«The timeout for this transaction was 5000 ms»*.

### Por qué subirlo NO es la salida, ahora con el número delante

Con ~880 ms por reserva, subir el timeout a 20 s daría margen para **22** simultáneas. Pero el
coste es **lineal**: la enésima espera **n × 880 ms**. Subirlo **no arregla, aplaza** — y el
usuario número 22 esperaría **19 segundos** mirando una pantalla antes de que le contesten. **Se
cambia un fallo rápido por una espera larga.** Si aun así se sube, tiene que ir con el aviso de
qué pasa al llegar al nuevo límite; el guard ③ de esta rama lo exige.

## A6 · Qué más estaba corriendo, porque una medición sin contexto no es reproducible

**Dev es una base compartida y hay cinco sesiones más vivas.** Al medir, la tanda de tests de
esta sesión **ya había terminado** (se esperó a propósito). **No sé qué estaban haciendo las
otras cinco sesiones**, y lo digo con esas palabras.

Lo que sí se puede afirmar: **la dispersión de ① salió estrechísima** (7 ms de rango entre min y
p90, en 30 repeticiones, y dos corridas que coinciden al 0,9 %). Si hubiera habido ruido
apreciable de otras sesiones sobre el mismo merchant, esa dispersión sería ancha. **La estrechez
es, en sí misma, la evidencia de que la medición no está contaminada.**

## A7 · Lo que sigue SIN hacerse

* **No se toca el cerrojo, no se sube el timeout, no se funde `findUnique`+`update`.** El
  arreglo tiene un candidato con número (−20 % de viajes) pero **no cierra el problema**: seguiría
  siendo lineal, y sólo movería el umbral de 6 a ~7. **Cualquier arreglo real cambia cómo se
  reserva un número, y eso es decisión del fundador.**
* **La regla 29 sigue intacta y demostrada, no afirmada:** la post-condición acredita que
  `nextAlbaranNumber` no se movió y que no se creó ningún documento. **Nada se ha renumerado
  porque nada se ha numerado.**
