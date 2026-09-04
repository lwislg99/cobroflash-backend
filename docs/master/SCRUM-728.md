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
---

# SCRUM-728 · FASE B · Un candidato medido: la reserva en UN viaje

**Medido contra:** `origin/main` = `0cc1376eb2a1f5fb12001bf9d596eab85786d981` · 2026-09-04T22:57:00+02:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

> 📎 Esta entrada es de la **fase B**. La **fase A** (el censo, el guard y la medición del cerrojo
> actual) es la que abre este fichero: se mezcló a `main` mientras la fase B estaba en vuelo, y al
> integrar hubo conflicto `add/add` resuelto **componiendo A + B + C en ese orden** — el mismo que
> esta nota anunciaba cuando aún estaba pendiente.

**Alcance: MEDIR UN CANDIDATO, NO SUSTITUIR.** No se toca `allocateAlbaranNumber`, no se toca el
cerrojo actual, no se toca `invoiceNumber.service.ts` ni nada del camino de emisión. **Cero
ficheros de `src/` modificados.** El candidato se mide como SQL, desde un script de medición.

---

## 0 · Lo primero: verificar MI PROPIA descomposición, porque la hipótesis se apoya en ella

En la fase A dije «5 viajes: `BEGIN` + cerrojo + `findUnique` + `update` + `COMMIT`». **Eso fue
una inferencia aritmética** (5 × 175,1 ms ≈ 878 ms), no una medición. El fundador construyó su
hipótesis sobre ella, así que **lo primero es medirla directamente**, con el log de consultas de
Prisma. Si hubieran salido otros, todo lo demás sobraba.

```
── HOY · allocateAlbaranNumber (en $transaction, con ROLLBACK) ──
   VIAJES: 5
     1. BEGIN
     2. SELECT pg_advisory_xact_lock($1::int, $2::int)
     3. SELECT "public"."merchants"."id", "next_albaran_number", "albaran_series_year" …
     4. UPDATE "public"."merchants" SET "albaran_series_year" = $1, "next_albaran_number" = $2, "updated_at" = $3 …
     5. ROLLBACK        ← en producción sería COMMIT
```

✅ **Son exactamente cinco, y exactamente los que dije.** La descomposición queda **medida**, no
inferida. La hipótesis se sostiene y se sigue.

## 1 · ✅ ① EL CANDIDATO HACE **UN** VIAJE

| | Viajes | Medido cómo |
|---|---|---|
| **Hoy** | **5** | log de consultas de Prisma |
| **Candidato A** (`UPDATE … RETURNING`) | **1** | ídem |
| **Candidato B** (CTE con `FOR UPDATE`) | **1** | ídem |

El CTE **no cuesta un viaje extra**: sigue siendo una sola sentencia.

### Y cuesta exactamente un RTT — el trabajo del servidor no se distingue de cero

n=30, en serie, con el RTT desnudo al lado:

| | min | mediana | p90 | max |
|---|---|---|---|---|
| **candidato** | 186,6 | **205,7** | 219,8 | 242,3 |
| RTT desnudo (`SELECT 1`) | 185,8 | **205,9** | 233,9 | 413,0 |

**Diferencia sobre la red: −0,2 ms.** La reserva cuesta lo que cuesta *hablar* con la base.

### ⚠️ Y por eso la comparación honesta NO es en milisegundos

**El RTT de esta sesión (205,9 ms) no es el de la fase A (175,1 ms)**: dev es compartida y la red
cambió entre una medición y otra. Comparar «878 ms antes» con «205 ms ahora» mezclaría dos redes
distintas y exageraría la mejora.

**La comparación robusta es en múltiplos de RTT, y ésa no depende de la red:**

| | Coste |
|---|---|
| Hoy | **5 × RTT** |
| Candidato | **1 × RTT** |

## 2 · ✅ ② EL UMBRAL: no lo he encontrado hasta 200

Simultáneas del mismo merchant, **con el timeout de 5 s SIN TOCAR**:

| n | pared | completadas | fallos | duplicados |
|---|---|---|---|---|
| 10 | 2.078 ms | 10 | **0** | 0 |
| 25 | 2.040 ms | 25 | **0** | 0 |
| 50 | 988 ms | 50 | **0** | 0 |
| 100 | 1.847 ms | 100 | **0** | 0 |
| 200 | 4.004 ms | 200 | **0** | 0 |

**El umbral pasa de 6 a más de 200.** Y se dice así a propósito: **no encontré el techo**, no
«aguanta siempre». A 200 la pared ya son 4.004 ms y el siguiente escalón podría rozar los 5 s.

> Los tiempos de pared **no son monótonos** (50 tarda menos que 25). Es ruido de red sobre una
> base compartida. Lo que sí es estable en las cinco filas: **cero fallos y cero duplicados**.

## 3 · 🔴 ③ LA PREGUNTA QUE MANDA: ¿sigue garantizado que no se duplica?

**Sí — y con un control positivo delante que demuestra que el experimento discrimina.**

| Carrera (10 simultáneas, mismo merchant) | pared | ok | fallos | números | duplicados |
|---|---|---|---|---|---|
| **CONTROL POSITIVO** · sin protección | 2.148 ms | 10 | 0 | `[1,1,1,1,1,1,1,1,1,1]` | 🔴 **9** |
| **Hoy** · advisory lock | 5.386 ms | 6 | **4** (P2028) | `[1,2,3,4,5,6]` | 0 |
| **Candidato A** | 381 ms | **10** | 0 | `[1…10]` | **0** |
| **Candidato B** | 384 ms | **10** | 0 | `[1…10]` | **0** |

**La fila de arriba es la que da valor a las de abajo.** La versión sin protección duplica 9 de
10 —los diez se llevan el número 1—, así que la carrera aprieta de verdad y un «no duplica» de
los candidatos significa algo.

**Por qué es seguro, y no es suerte:** un `UPDATE` de una sola sentencia toma el *row lock* de la
fila y, en `READ COMMITTED`, el segundo escritor **reevalúa la fila ya actualizada** antes de
aplicar su `CASE`. La serialización sigue existiendo — sólo que ocurre **dentro del servidor**, y
no a través de cinco idas y vueltas de red.

### 🔴 Y ahí está la explicación del ticket entero

**El problema nunca fue serializar. Fue serializar con la latencia de red DENTRO de la sección
crítica.** Hoy el cerrojo se sostiene durante 5 viajes de ida y vuelta; el candidato lo sostiene
durante microsegundos de CPU. Por eso no es «de 6 a 7»: es otro orden.

## 4 · ✅ EQUIVALENCIA FUNCIONAL: 4 de 4, guard de SCRUM-306 incluido

Un candidato más rápido que se comporta distinto no es el mismo candidato.

| Caso de `resolveAlbaranSeq` | Hoy | Candidato C | |
|---|---|---|---|
| ① mismo año, contador 7 | `7` | `7` | ✔ |
| ② otro año → reinicio anual | `1` | `1` | ✔ |
| ③ **año NULO + contador 5 → debe FALLAR** | `AlbaranSerieSinAnioError` | 0 filas → error | ✔ |
| ④ año NULO + contador 1 (serie sin estrenar) | `1` | `1` | ✔ |

El **candidato C** es el B con el guard de SCRUM-306 **dentro del `WHERE`**:

```sql
WITH viejo AS (
  SELECT id, albaran_series_year AS ay, next_albaran_number AS nn
    FROM merchants WHERE id = $2 FOR UPDATE
)
UPDATE merchants m
   SET albaran_series_year = $1,
       next_albaran_number = CASE WHEN viejo.ay = $1 THEN viejo.nn + 1 ELSE 2 END
  FROM viejo
 WHERE m.id = viejo.id
   AND NOT (viejo.ay IS NULL AND viejo.nn > 1)   -- ← el guard de SCRUM-306
RETURNING m.next_albaran_number - 1 AS seq;
```

`seq = nuevo − 1` vale en los dos casos: mismo año (`viejo+1` → `viejo`) y año nuevo (`2` → `1`).

## 5 · ✅ ④ QUÉ SE PIERDE — mi criterio, y es un PRECIO, no un problema

El fundador pregunta si perder el cerrojo explícito es un precio o un problema. **Mi criterio:
es un precio, y se paga con un comentario — pero hay tres cosas que NO son opinión y van antes.**

### a) 🔴 «0 filas» pierde una distinción que hoy existe

Con el guard en el `WHERE`, un resultado vacío significa **dos cosas distintas**: *el merchant no
existe* y *la serie está en el estado prohibido de SCRUM-306*. Hoy son dos caminos separados
(`merchant_not_found` y `AlbaranSerieSinAnioError`). **Esto es lo único que encontré que empeora
de verdad**, y tiene arreglo —devolver la razón en el `RETURNING`— pero **hay que escribirlo, no
darlo por hecho**.

### b) ⚠️ `updated_at` deja de moverse — medido, no supuesto

El `UPDATE` de Prisma escribe `updated_at` (se ve en el viaje 4 del log). **El candidato no**:
medido, `updated_at` no cambia. Se arregla añadiendo `updated_at = NOW()` al `SET`, pero **si
nadie lo mira, es un cambio silencioso de comportamiento**. No decido si importa: lo señalo.

### c) La legibilidad

`pg_advisory_xact_lock(SERIE_LOCK_NS, merchantId)` **dice lo que protege**. Un `UPDATE` que
serializa por bloqueo de fila lo hace **en silencio**, y quien lo lea dentro de un año puede
«simplificarlo» en dos sentencias sin saber que ahí vivía la garantía.

**Por eso es un precio y no un problema: es exactamente el tipo de cosa que un guard convierte en
barrera.** Igual que en la fase A convertí «no subas el timeout» en un test, aquí la garantía
debería quedar atada a un test de carrera con su control positivo — el mismo que está en §3. **Un
comentario solo no basta; el comentario más el test, sí.**

## 6 · Lo que NO se ha hecho

* **No se ha tocado `allocateAlbaranNumber`, ni el cerrojo, ni una línea de `src/`.** Esto era
  medir un candidato.
* **No se ha tocado `invoicing`.** Si el candidato se adopta, llevarlo a la factura es decisión
  del fundador y va aparte — y allí hay un viaje más (`invoice.create`) y el camino de emisión
  de por medio.
* **No se han creado filas.** Todas las mediciones mueven el contador del merchant 1 y lo
  restauran; post-condición verificada en los tres scripts: contador restaurado y
  **0 albaranes creados**. La regla 29 no se roza: **nada se renumeró porque nada se numeró.**
* **No se ha añadido ningún test.** Un test que necesita base no corre en `npm test`, y meterlo
  como gateado sin que nadie lo pida sería ruido. El SQL del candidato queda escrito **aquí**
  para que quien lo implemente no tenga que reinventarlo.

## 7 · Huecos declarados

* **Sólo `albaranes`.** No he medido `allocateInvoiceNumber` ni `allocateQuoteNumber`. Tienen la
  misma forma, pero **no lo he comprobado en ejecución**.
* **No he encontrado el techo del candidato** (200 es lo más alto que probé, no un límite).
* **No sé qué hacían las otras cinco sesiones** mientras medía. La dispersión estrecha de ① es la
  única evidencia de que no hay contaminación, igual que en la fase A.
* **El RTT de dev cambió entre fases** (175,1 → 205,9 ms). Por eso las conclusiones se dan en
  múltiplos de RTT y no en milisegundos absolutos.
* **`FOR UPDATE` dentro de un CTE**: medido correcto en 10, 25, 50, 100 y 200 concurrentes contra
  este Postgres. **No he leído la garantía en la documentación de Postgres**, así que lo sostengo
  por medición, no por especificación.

---

# FASE C · ① y ② resueltos · y un TERCER bloqueo que obliga a parar

**Medido contra:** `origin/main` = `cc786ab34df118e6a44ae25ae523709f3cb4e11c` · 2026-09-04T23:10:00+02:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Alcance: NO SE ADOPTA EL CANDIDATO.** `allocateAlbaranNumber` queda **intacto**. Cero ficheros
de `src/` modificados. Las dos condiciones de bloqueo del fundador están resueltas y escritas,
pero apareció **una tercera** que no estaba en la lista y que toca una barrera puesta a
propósito en SCRUM-306.

---

## C0 · 🔴 PRIMERO, UNA CORRECCIÓN DE MI PROPIA MEDICIÓN DE LA FASE B

**La fase B midió el candidato en AUTOCOMMIT. En producción se llama DENTRO de la transacción
que crea el albarán** (`jobs.routes.ts`), y eso importa: dentro de una transacción, el *row lock*
del `UPDATE` **se sostiene hasta el `COMMIT`**, exactamente igual que el advisory lock. El «>200»
de la fase B **no se obtiene en el contexto real**.

Medido, con el `albaran.create` simulado por un viaje equivalente y todo con `ROLLBACK`
(RTT mediano de esta sesión: **192,2 ms**):

| | mediana | ×RTT | 10 simultáneas |
|---|---|---|---|
| **Hoy**, dentro de tx | 1.107,7 ms | **5,8** | 4 ok · **6 fallos** P2028 |
| **Candidato dentro de tx** (contexto real) | 746,0 ms | **3,9** | **10 ok · 0 fallos** |
| Candidato suelto (lo que midió la fase B) | 184,5 ms | **1,0** | 10 ok · 0 fallos |

### El umbral real del candidato, buscado hasta romperlo

| n | resultado |
|---|---|
| 10 | 10 ok · 0 fallos |
| 15 | 15 ok · 0 fallos |
| **20** | 17 ok · **3 fallos** P2028 |
| 30 | 17 ok · 13 fallos |

**El umbral pasa de 6 a entre 15 y 19 — no a «más de 200».** Sigue siendo **~3×**, y a las 10
simultáneas del ticket pasa de **6 fallos a cero**, que es el caso que lo abrió. Pero **la cifra
grande de la fase B era del contexto equivocado, y se corrige aquí en vez de dejarla correr.**

> Y el hueco que esto deja abierto: **sacar la reserva fuera de la transacción** sí daría el otro
> orden — pero rompería la garantía «sin huecos en la serie si el `create` falla», que es
> justamente por lo que hoy vive dentro. **Eso es decisión del fundador y no se toca aquí.**

## C1 · ✅ CONDICIÓN ① RESUELTA: las dos causas dejan de colapsar en «0 filas»

El SQL devuelve **siempre una fila** y distingue los dos casos, sin dejar de ser **un solo viaje**:

```sql
WITH viejo AS (
  SELECT id, albaran_series_year AS ay, next_albaran_number AS nn
    FROM merchants WHERE id = $1 FOR UPDATE
), actualizado AS (
  UPDATE merchants m
     SET albaran_series_year = $2,
         next_albaran_number = CASE WHEN viejo.ay = $2 THEN viejo.nn + 1 ELSE 2 END
    FROM viejo
   WHERE m.id = viejo.id
     AND NOT (viejo.ay IS NULL AND viejo.nn > 1)   -- ← el guard de SCRUM-306
  RETURNING m.next_albaran_number - 1 AS seq
)
SELECT (SELECT seq FROM actualizado)      AS seq,
       (SELECT nn  FROM viejo)            AS contador_previo,
       (SELECT COUNT(*) FROM viejo)::int  AS existe;
```

| Lectura del resultado | Causa | Error que emite |
|---|---|---|
| `existe = 0` | el merchant no existe | `merchant_not_found` |
| `existe = 1` y `seq IS NULL` | serie con año nulo y contador avanzado | `AlbaranSerieSinAnioError(contador_previo)` |
| `seq` no nulo | caso normal | — |

`contador_previo` viaja precisamente para que el mensaje del error pueda decir **qué contador**
estaba puesto, igual que hoy.

## C2 · ✅ CONDICIÓN ② RESUELTA Y DECIDIDA: nadie lee `merchants.updated_at`

Censo por AST —un `grep updatedAt | grep merchant` no vale, porque un
`select: { updatedAt: true }` vive en otra línea que la palabra «merchant»—, con **suelo** que
prueba que el detector ve 2 de 2 consultas de merchant y distingue la que pide `updatedAt`:

| Pregunta | Resultado |
|---|---|
| Consultas a `merchant` en `src/` | **118** |
| …que mencionan `updatedAt` | **0** |
| Accesos sueltos `merchant.updatedAt` | **0** |
| SQL crudo con `updated_at` sobre `merchants` | **0** |
| `updatedAt` junto a merchant/perfil/ajustes en `public/` | **0** |

**LA DECISIÓN: la reserva de número NO debe tocar `updated_at`, y el candidato hace lo correcto
al no escribirlo.**

**Por qué**, que es lo que el fundador pide que quede escrito: `merchants.updated_at` significa
**«los datos del comercio cambiaron»** — su nombre, su NIF, sus ajustes. Emitir un albarán **no
cambia el comercio**: mueve un contador. Que hoy se moviera era **un efecto colateral del ORM**
(Prisma lo escribe en todo `update`), no una decisión de nadie. Al pasar a SQL explícito, el
efecto colateral desaparece y el campo pasa a significar lo que dice.

> **Límite declarado:** una consulta *sin* `select` devuelve todas las columnas, `updatedAt`
> incluido, así que el dato **puede viajar** en algún payload aunque ninguna vista lo pinte. El
> censo dice que nadie lo *usa*; no que nadie lo *reciba*.

## C3 · 🔴 EL TERCER BLOQUEO, QUE NO ESTABA EN LA LISTA

`tests/scrum306-serie-albaranes.test.mjs` tiene este guard **vivo**:

```js
assert.ok(/const seq = resolveAlbaranSeq\(m, year\);/.test(alloc),
  '🔴 ESCÁNER CIEGO: la reserva ya no usa `resolveAlbaranSeq` — la vista previa y la reserva ' +
  'habrían dejado de compartir mecanismo y este test estaría comparando con nada.');
```

**Y su motivo no es ceremonia.** `vistaPreviaAlbaran` (`albaranSerie.ts`) **le enseña al
profesional el número que va a salir**, y lo calcula con `resolveAlbaranSeq` — la misma función
que hoy usa la reserva. Su comentario lo dice: *«Calcularlo aparte es como se acaba enseñando una
cosa y emitiendo otra»*.

**Adoptar el candidato mueve la regla a SQL y deja la vista previa en JS: dos implementaciones de
la misma regla de negocio, en dos lenguajes.** Es exactamente la divergencia que ese guard existe
para impedir, y el guard **caería** — no por estar mal, sino por tener razón.

### Por qué no lo resuelvo yo

* Arreglarlo por el lado de la vista previa obliga a tocar `albaranSerie.ts`, **que no es este
  carril** (el encargo dice *sólo* `allocateAlbaranNumber`).
* Arreglarlo por el lado del guard significa **cambiar una barrera que el fundador puso a
  propósito** para que dejase de morder. Eso es vaciar un guard por goteo, y no lo hago sola.

### Las dos salidas, para que se decida con ellas delante

1. **La vista previa pregunta al mismo SQL** (en modo «sólo consulta», sin `UPDATE`). Una sola
   fuente de verdad otra vez, pero la vista previa pasa a costar un viaje a la base — hoy es un
   cálculo en memoria sobre un merchant ya cargado.
2. **Se acepta la duplicación y se cambia la FORMA del guard**: de «la reserva usa esta función»
   a «SQL y JS dan lo mismo en los cuatro casos», verificado contra base. **Ya está medido: 4 de
   4** (§ fase B). Es más honesto que el guard textual actual, pero necesita base, así que sería
   un test gateado y **el CI dejaría de vigilarlo en cada push**.

**Mi criterio, ya que se me pide:** la **2** es mejor. El guard actual comprueba una *forma de
escribir el código*; el propuesto comprobaría el *comportamiento*, que es lo que de verdad
importa. Pero pierde cobertura en CI, y ese cambio de trato **no lo decide una sesión**.

## C4 · Lo que NO se ha hecho

* **`allocateAlbaranNumber` sigue exactamente igual.** Cero ficheros de `src/` tocados.
* **No se ha tocado el guard de SCRUM-306**, ni el de la fase A que prohíbe subir el timeout.
* **No se ha tocado `invoicing`** ni nada del camino de emisión.
* **No se han creado filas**: todas las mediciones mueven el contador del merchant 1 y lo
  restauran; post-condición verificada — contador restaurado y **0 albaranes creados**.
* **Regla 29 intacta:** nada se renumeró porque nada se numeró.

## C5 · Huecos declarados

* **No he medido el candidato con el `albaran.create` REAL**, sino con un viaje equivalente
  (`SELECT 1`). Un `INSERT` real puede costar algo más, así que el umbral 15-19 es una **cota
  optimista**.
* **El umbral 15-19 se estrechó con n = 10, 15, 20 y 30**; no busqué el punto exacto.
* **Sólo `albaranes`.** No he medido `allocateInvoiceNumber` ni `allocateQuoteNumber`.
* **No sé qué hacían las otras cinco sesiones** mientras medía contra dev, que es compartida.
* **`FOR UPDATE` dentro de un CTE** lo sostengo por medición contra este Postgres, no por haber
  leído la garantía en la especificación.
