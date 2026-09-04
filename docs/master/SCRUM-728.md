# SCRUM-728 · FASE B · Un candidato medido: la reserva en UN viaje

**Medido contra:** `origin/main` = `0cc1376eb2a1f5fb12001bf9d596eab85786d981` · 2026-09-04T22:57:00+02:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

> 📎 Esta entrada es de la **fase B** y vive en su propia rama. La **fase A** (el censo, el guard y
> la medición del cerrojo actual) está en la rama `scrum-728-cerrojo-de-serie`, pendiente de
> merge. Las dos escriben en este mismo fichero; al mezclarlas, **la fase A va primero**.

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
