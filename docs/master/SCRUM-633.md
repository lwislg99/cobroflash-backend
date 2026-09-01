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

> ⚠️ **ESA FRASE SOBRE `TZ=` ES IMPRECISA. Ver la ENMIENDA del final (§9).** Lo que no surte
> efecto es el **prefijo de Git Bash** (`TZ=x node …`); pasada como **entorno de un proceso
> hijo**, `TZ` funciona. La conclusión de esta sección no cambia —las zonas explícitas siguen
> siendo lo correcto—, pero la frase no se puede citar como dato.

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

   > 🔴 **ESE «SI» YA NO ES UN SI, Y LA VÍCTIMA NO ES LA QUE DICE. Ver la ENMIENDA (§9).**
   > Railway **no tiene variable `TZ`**, así que el servidor corre en **UTC**, no en Madrid. Con
   > ese dato, **ni el peninsular ni el canario divergen**; quien lee un día de más es el
   > profesional en **desfase NEGATIVO** (LATAM). El hallazgo —que la landing formatea sin
   > `timeZone`— sigue siendo real; a quién le pasa, no.
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

---

# ENMIENDA (§9) · dos afirmaciones de arriba estaban mal, y así queda la versión correcta

**Enmendado el 2026-09-01**, el mismo día, al medir el test de SCRUM-630. Se **añade**: no se
borra nada de lo anterior, se marca en su sitio y se corrige aquí con su procedencia, que es lo
que impide que las frases malas se vuelvan a citar como dato.

## 9.1 · «`TZ=` no surte efecto en este Node/Windows» — IMPRECISO

**Lo que medí:** tres tandas lanzadas con `TZ=Europe/Madrid node …`, `TZ=Atlantic/Canary node …`
y `TZ=UTC node …` desde Git Bash, y las tres siguieron diciendo `Europe/London`.

**De dónde vino el error:** de generalizar un caso a una regla. Probé **una sola** forma de
pasar `TZ` —el prefijo de Git Bash— y escribí la conclusión como si fuera de Node.

**Lo correcto, medido:** `TZ` **sí** funciona pasada como **entorno de un proceso hijo**:

```
TZ=UTC              -> el hijo dice: UTC 0
TZ=America/New_York -> el hijo dice: America/New_York 300
TZ=Asia/Tokyo       -> el hijo dice: Asia/Tokyo -540
```

Lo que falla es el prefijo de Git Bash, que es cosa de cómo MSYS pasa el entorno, no de Node.

**Qué NO cambia:** la decisión de hacer las zonas explícitas con `Intl` sigue siendo la correcta,
y por una razón que el `TZ` funcionando no toca: el proceso tiene **una** zona, y aquí hacen
falta **dos a la vez** —la del navegador del pro y la del servidor—. La tabla de §3 se mantiene.

**Qué SÍ cambia:** que ahora se puede correr una tanda entera con la zona forzada, que es como se
descubrió que el test de SCRUM-630 sólo pasaba en una zona del planeta.

## 9.2 · 🔴 La fila de Canarias — LA VÍCTIMA ERA OTRA

**De dónde vino el error:** en §6 escribí «si el proceso de Railway arranca en `Europe/Madrid`».
Era una **hipótesis** planteada como condicional, y en §7 la dejé como pregunta abierta — pero la
tabla de §3 la había puesto en la misma rejilla que las demás, y una hipótesis dentro de una
tabla de medidas se lee como medida.

**El dato que faltaba, ya en firme:** producción **no tiene variable `TZ`** (27 variables
comprobadas en Railway; ninguna coincide). Un contenedor sin `TZ` corre en **UTC**.

**Rehecho con el servidor FIJADO en UTC** y el navegador en la zona del pro:

| Navegador del pro | Desfase ene/jul | `main` | rama 630 |
|---|---|---|---|
| Europe/Madrid (península) | +1 / +2 | **0 / 1460** | **0 / 1460** |
| Atlantic/Canary | +0 / +1 | **0 / 1460** | **0 / 1460** |
| America/Mexico_City | −6 | **1460 / 1460** | 1460 / 1460 |
| America/Lima (Perú) | −5 | **1460 / 1460** | 1460 / 1460 |
| America/Bogota | −5 | 1460 / 1460 | 1460 / 1460 |
| America/Argentina | −3 | 1460 / 1460 | 1460 / 1460 |

Control positivo: forzando un día de más, caza **1460/1460 en las seis**.

**Con el servidor en UTC no diverge ni el peninsular ni el canario.** Quien lee un día de más es
el profesional en **desfase NEGATIVO** —LATAM, que el producto contempla (MercadoPago, `country`,
`locale.vatName` con IGV)—: su `23:59:59` local cae en el día **siguiente** en UTC. **Idéntico en
`main` y en la rama 630: preexistente, no lo trae el arreglo.**

## 9.3 · Y una que NO estaba mal, pero que ahora tiene respuesta

§1 decía que la zona del proceso de Railway no la fija nadie en el repo. **Sigue siendo cierto**,
y ahora se sabe qué implica: sin `TZ`, **UTC**. Eso convierte la pregunta abierta de §7 en dato,
y de ahí sale la regla que se aplicó en SCRUM-630 (2/2):

> **Cada test fija la zona de la máquina donde ese código corre de verdad.**
> Front (`quotesView.js`) → navegador del pro → **Europe/Madrid**.
> Rutas (`quotes.routes.ts`, `quoteDecisionLanding.routes.ts`) → Railway → **UTC**.

## 9.4 · Lo que NO se toca en esta enmienda

El SQL de §7 se queda como está: sus nombres, su tipo `TIMESTAMP(3)` y su doble `AT TIME ZONE`
son correctos y están ejecutados contra Postgres real. Lo único que conviene leer con el dato
nuevo es su **supuesto**, ya declarado allí: asume al pro en `Europe/Madrid`. Para un pro en
desfase negativo la firma del defecto sería otra, así que un exceso de «no encaja con la firma
del defecto» en el censo puede significar eso y no un error de la consulta.

Y **la decisión sobre los presupuestos ya emitidos sigue sin tomarse**: es del fundador
(regla 29).
