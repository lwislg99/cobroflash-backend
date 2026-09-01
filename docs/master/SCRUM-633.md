# SCRUM-633 · ¿Diverge la fecha que ve el pro de la que lee el cliente?

**Medido contra:** `origin/main` = `775bf7e04e4c0f55ca23ad4c9bfe58a0b365c3dc` · 2026-09-01T16:40:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.
> `origin/main` **no se movió** durante la medición: se comprobó al empezar y al terminar.

**Alcance: MEDICIÓN. No se construye nada.** Ni se toca la rama de SCRUM-630, ni los otros
tres sitios con la misma aritmética, ni `pdf.service.ts` / `formatters` (S3), ni
`productsView` / catálogo (S1). Este documento es el único fichero que la rama añade.

---

## 1 · Las cuatro piezas de la ruta, con su zona horaria

Antes de medir hay que saber **quién interpreta cada fecha y en qué zona**, porque la respuesta
entera depende de eso:

| # | Pieza | Dónde | Zona en que se evalúa |
|---|---|---|---|
| 1 | el pro **VE** `YYYY-MM-DD` | `quotesView.js:571-572` (main) / `:588` (630) | navegador del pro |
| 2 | el front **ENVÍA** | `quotesView.js:3056` — `new Date(valor + "T23:59:59").toISOString()` | navegador del pro |
| 3 | el servidor **GUARDA** | `quotes.routes.ts:166` — `body.validUntil ?? new Date(Date.now() + 30 * 86_400_000)` | irrelevante (instante) |
| 4 | el cliente **LEE** | `quoteDecisionLanding.routes.ts:345` — `toLocaleDateString('es-ES', …)` | **la del proceso de Railway** |

La pieza 4 es la que nadie había escrito: **`toLocaleDateString` se llama SIN `timeZone`**, así
que el día que el cliente lee sale de la zona horaria con que arranque el contenedor. Se buscó
en todo el repo quién la fija (`railway.json`, `Dockerfile`, `package.json`, YAML): **nadie**.

## 2 · 1a y 1b · ¿Envía el front la fecha, o la recalcula el servidor?

**El front la envía, y el servidor sólo recalcula cuando NO le llega.** El riesgo real no era
el `??` —que se lee— sino que `CreateQuoteSchema` se comiera la clave en silencio, como pasó
con `suplido` en SCRUM-619. Se ejecutó:

```
claves que SOBREVIVEN al esquema: currency, customer_id, lines, merchant_id, validUntil
  validUntil sobrevive? true -> 2026-04-30T22:59:59.000Z
SIN fecha · parse ok = true · validUntil = undefined
```

`validUntil` **sobrevive** (`schemas.ts:73`, `z.coerce.date().optional()`). El `??` de
`quotes.routes.ts:166` sólo entra en el caso `undefined`.

## 3 · 🔴 1c · ¿Pueden diferir el día mostrado y el guardado? **NO por mi rama**

Se ejecutó la ruta ENTERA —campo, envío, esquema real compilado, línea del servidor y
formateo de la landing— sobre **1.460 instantes de 2026** (365 días × 00:30, 09:00, 12:00,
23:30), con las **dos zonas explícitas**. Fue necesario hacerlas explícitas: `TZ=` **no surte
efecto en este Node/Windows** (las tres tandas seguían diciendo `Europe/London`), y una tanda
que dice simular Madrid sin simularlo es un número inventado.

| Rama | Navegador del pro | Servidor | Divergencias |
|---|---|---|---|
| main | Europe/Madrid | UTC | 0 / 1460 |
| main | Europe/Madrid | Europe/Madrid | 0 / 1460 |
| main | Atlantic/Canary | UTC | 0 / 1460 |
| main | Atlantic/Canary | Europe/Madrid | **1460 / 1460** |
| **630** | Europe/Madrid | UTC | 0 / 1460 |
| **630** | Europe/Madrid | Europe/Madrid | 0 / 1460 |
| **630** | Atlantic/Canary | UTC | 0 / 1460 |
| **630** | Atlantic/Canary | Europe/Madrid | **1460 / 1460** |

**Las filas de `main` y las de `630` son idénticas, una a una.** Mi rama no introduce ninguna
divergencia: el front manda lo que enseña, y el servidor lo respeta. El 1460/1460 de la última
fila es un defecto **preexistente** de la pieza 4, igual de presente en `main` (§6).

**Por tanto NO se para, y NO se toca la rama de 630.**

### El control positivo, que es lo que hace que ese «0» valga algo

Un «0 divergencias» sólo es un dato si el montaje sabe ver un «1». Se repitió el barrido
sumando **un día a mano** al cuerpo enviado, y en las cuatro combinaciones cazó **1460 / 1460**.
El montaje ve las divergencias; los ceros de arriba son ceros de verdad.

## 4 · Lo que mi rama SÍ cambia, medido hora a hora

Sobre los **8.760 instantes** de 2026, la diferencia entre lo que calcula 630 y lo que calcula
`main` es **sólo 0 o +1 día — nunca −1 ni +2**:

```
   0 dia(s): 8185
  +1 dia(s):  575     <- 00:xx -> 365 de 365 dias · 01:xx -> 210 de 365 (solo horario de verano)
```

Ese 210 es el mismo número que midió SCRUM-630. Que el techo sea **+1** es lo que convierte el
defecto en una **firma exacta de 29 días**, y es lo que hace posible el SQL de §7.

## 5 · ⚠️ El único camino nuevo que abre 630: el campo vacío

`validInput.value = atajosVencDefecto ? atajosVencDefecto.fechaDeAtajo(30) : '';` — si la
primitiva no cargara, el campo queda **vacío**, el front envía `undefined` y **el servidor
recalcula con la aritmética VIEJA**. Es decir: el defecto que 630 arregla volvería por la
puerta de atrás, y encima con el campo en blanco.

Hoy eso está sujeto por el orden del índice (`index.html:245` antes de `:246`) y por el banco
de vistas, que monta el dashboard como lo monta el navegador. **No es un fallo abierto: es una
dependencia que conviene que quede escrita**, porque es la única forma de que 630 divergiera.

## 6 · 🔴 HALLAZGOS FUERA DE ALCANCE

1. **La landing formatea sin `timeZone` (PREEXISTENTE, no de 630).**
   `quoteDecisionLanding.routes.ts:345` y `:470` llaman `toLocaleDateString('es-ES', …)` sin
   `timeZone`, y nadie fija `TZ` en el repo. Si el proceso de Railway arranca en `Europe/Madrid`
   y el pro está en **Canarias**, el cliente lee **un día más** — 1460/1460 en la tabla de §3.
   No se arregla aquí: no es de este ticket y toca copy que ve el cliente.
2. **`quotes` mezcla `snake_case` y `camelCase`.** `valid_until` sí es snake, pero `"createdAt"`
   y `"merchantId"` **no**: van en camelCase y **exigen comillas dobles** en Postgres. Sin ellas
   se pliegan a `createdat` y la consulta **falla**. Verificado con el DDL que emite el propio
   Prisma (`migrate diff --from-empty`, sin tocar ninguna base).
3. **El tipo es `TIMESTAMP(3)` SIN zona.** Por eso el SQL de §7 necesita el doble
   `AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Madrid'`: el primero declara que el dato guardado es
   UTC, el segundo lo lleva al reloj de pared español. Con un solo `AT TIME ZONE` la cuenta sale
   **al revés** y el número sería basura creíble.

## 7 · La consulta para PRODUCCIÓN (la ejecuta el fundador; yo no tengo acceso)

Va **en dos trozos, y el primero es un control positivo** que no toca ninguna tabla: demuestra
en el motor de Railway que la aritmética caza el caso malo y **deja pasar el bueno**, incluido
un atajo de 7 días elegido a mano —que no debe contarse—. Si el control no sale como dice la
columna `veredicto_esperado`, **el censo de abajo no vale y no hay que creérselo**.

### 7.1 · Control positivo — pegar primero

```sql
WITH casos(caso, "createdAt", valid_until, veredicto_esperado) AS (VALUES
  ('INVIERNO · creado 00:30 en Madrid (23:30 UTC del dia anterior) = franja del defecto',
   TIMESTAMP '2026-01-01 23:30:00', TIMESTAMP '2026-01-31 22:59:59', 'DEFECTUOSO'),
  ('VERANO · creado 00:30 en Madrid (22:30 UTC del dia anterior) = franja del defecto',
   TIMESTAMP '2026-07-01 22:30:00', TIMESTAMP '2026-07-31 21:59:59', 'DEFECTUOSO'),
  ('creado a mediodia: la fecha UTC y la de Madrid coinciden',
   TIMESTAMP '2026-01-01 12:00:00', TIMESTAMP '2026-01-31 22:59:59', 'CORRECTO'),
  ('atajo de 7 dias elegido a mano (no es el defecto)',
   TIMESTAMP '2026-01-01 12:00:00', TIMESTAMP '2026-01-08 22:59:59', 'CORRECTO')
)
SELECT
  caso,
  (((valid_until AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid')::date
   - ((("createdAt") AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid')::date) AS dias_de_validez,
  (((("createdAt") AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid')::date
   <> ("createdAt")::date)                                                    AS en_la_franja,
  veredicto_esperado,
  CASE WHEN (((valid_until AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid')::date
             - ((("createdAt") AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid')::date) = 29
        AND ((((("createdAt") AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid')::date
             <> ("createdAt")::date))
       THEN 'DEFECTUOSO' ELSE 'CORRECTO' END                                  AS veredicto_obtenido
FROM casos;
```

**Ejecutado ya contra Postgres real (base de DEV, sólo `SELECT`, ninguna tabla tocada):** los
cuatro `veredicto_obtenido` coinciden con `veredicto_esperado`.

### 7.2 · El censo sobre `quotes`

```sql
SELECT
  CASE
    WHEN q.valid_until IS NULL THEN 'sin fecha (no se puede juzgar)'
    WHEN (((q.valid_until AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid')::date
          - ((q."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid')::date) = 29
     AND (((q."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid')::date
          <> q."createdAt"::date)
      THEN 'DEFECTUOSO (29 dias, creado en la franja)'
    ELSE 'no encaja con la firma del defecto'
  END                                                                          AS veredicto,
  (((q.valid_until AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid')::date
   - ((q."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid')::date)  AS dias_de_validez,
  COUNT(*)                                                                     AS cuantos,
  MIN(q."createdAt")::date                                                     AS desde,
  MAX(q."createdAt")::date                                                     AS hasta
FROM quotes q
GROUP BY 1, 2
ORDER BY 1, 3 DESC;
```

**Ejecutado ya contra la base de DEV** (sólo `SELECT`): corre, los nombres existen y devuelve
filas interpretables. En DEV salieron 4 presupuestos de 30 días y 4 con `valid_until` NULL.

**Cómo se lee, y sus tres límites declarados:**

* **No es «cuántos están mal», es «cuántos llevan la firma del defecto»**: 29 días **y** creado
  en la franja. Un pro que eligió el día a mano no se cuenta — para eso está el cuarto caso del
  control.
* **Los `NULL` salen en su propia fila**, no se descuentan del total en silencio. Un censo que
  no puede juzgar algo lo dice; no devuelve un número más pequeño.
* **Asume que el pro estaba en `Europe/Madrid`.** No se guarda la zona del navegador. Para un
  pro en **Canarias** el reparto sería otro; con España-first es el supuesto correcto, pero es
  un supuesto y queda escrito.

## 8 · La decisión que NO tomo

Qué hacer con los presupuestos ya emitidos que salgan en la fila `DEFECTUOSO` —dejarlos,
corregirlos, o corregir sólo los que sigan vivos— **es decisión del fundador (regla 29)**, y
este documento no la toma ni la insinúa. Aquí sólo está el número y cómo obtenerlo.
