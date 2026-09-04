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

---

# ENMIENDA 2 (§10) · el censo miraba UN SOLO SENTIDO, y por eso firmó un cero

**Enmendado el 2026-09-01.** El censo de §7 se ejecutó contra PRODUCCIÓN (130 presupuestos) y dio
**cero con la firma del defecto**. Pero dio también **16 con 31 días**, todos dentro de 17 días de
julio, que cayeron en el cajón de «no encaja con la firma» junto a los atajos legítimos.

## 10.1 · El fallo, sin adornos

La consulta de §7 preguntó por **29 días** —un día de MENOS— porque **asumía al pro en
`Europe/Madrid`**. Bajo esa asunción un 31 es aritméticamente **imposible**: la península sólo
puede dar 29 o 30. No es que se me olvidara mirar el otro sentido: es que **mi modelo no permitía
que existiera**. El aviso que dejé escrito en §7 —«asume que el pro estaba en Europe/Madrid»—
señalaba justo este agujero, y aun así firmé un cero.

**Un censo que sólo mira un sentido del desplazamiento no puede afirmar un cero.**

## 10.2 · Qué produce un 31, medido

Barrido de julio de 2026 con las zonas explícitas, en `main` y en la rama 630 (dan lo mismo):

| Zona del pro | Hora UTC guardada | Días medidos en MADRID | Días en SU zona |
|---|---|---|---|
| Europe/Madrid 10:00 | `21:59:59` | 30 | 30 |
| Europe/Madrid 00:30 (la franja) | `21:59:59` | **29** | 29 |
| Atlantic/Canary · Europe/London | `22:59:59` | **31** | **30** |
| America/Mexico_City | `05:59:59` | **31** | **30** |
| America/Lima | `04:59:59` | **31** | **30** |
| America/Argentina | `02:59:59` | **31** | **30** |
| Asia/Tokyo | `14:59:59` | 30 | 30 |

**31 días medidos en Madrid = el pro está al OESTE de Madrid, y en su propia zona vio 30.** Son
inocentes: el 31 es un artefacto de medir en Madrid un documento hecho en otra zona.

La hipótesis de que «julio es verano, UTC+2, la ventana de desfase máximo» **no se sostiene**: un
desfase constante no produce un 31. Lo que lo produce es la **diferencia** de zona.

## 10.3 · 🔴 La huella que lo separa todo: la HORA UTC de `valid_until`

El front manda siempre `T23:59:59` **en la zona del navegador** (`quotesView.js:3056`). Luego la
hora UTC guardada **revela el desfase del pro**: `desfase = 23:59:59 − hora_utc (mod 24 h)`.

* `21:59:59` → **+2** · península en verano
* `22:59:59` → **+1** · Canarias/UK en verano, o península en invierno
* `23:59:59` → **0** · Canarias/UK en invierno
* `05:59:59` / `04:59:59` / `02:59:59` → **−6 / −5 / −3** · México / Perú / Argentina
* **no acaba en `:59:59`** → la fecha **no la mandó el front**: la puso el `??` del servidor, que
  arrastra la hora de creación.

Con el desfase se reconstruye la cuenta **en la zona del pro**, que es la única que dice si vio
29, si vio 30, o si eligió otra cosa.

## 10.4 · 🔴 Un fallo que cazó el propio control, antes de entregar

La primera versión del clasificador miraba la zona **antes** que el defecto. Con ese orden, un pro
de otra zona que **además** sufriera el defecto salía como «otra zona, sin defecto»: **el veredicto
lo TAPABA**. Se ve en el caso 5 del control —Canarias a las 00:30— que medido en Madrid da **30**,
o sea que la consulta de §7 lo habría dado por normal **siendo un defecto**. El defecto se mira
**primero**, y por eso el `CASE` lleva ese orden escrito con su motivo.

## 10.5 · Las consultas

Ejecutadas contra Postgres real (base de DEV, sólo `SELECT`). Los **ocho** casos del control
coinciden con su veredicto esperado.

### 10.5.1 · Control positivo — pegar primero

```sql
WITH casos("createdAt", valid_until, caso, veredicto_esperado) AS (VALUES
  (TIMESTAMP '2026-07-15 08:00:00', TIMESTAMP '2026-08-14 21:59:59',
   'peninsula 10:00, default normal',                        'NORMAL · 30 dias en su zona'),
  (TIMESTAMP '2026-07-14 22:30:00', TIMESTAMP '2026-08-13 21:59:59',
   'peninsula 00:30 (la franja): EL DEFECTO, un dia de MENOS','*** DEFECTO · 29 dias en su zona ***'),
  (TIMESTAMP '2026-07-15 09:00:00', TIMESTAMP '2026-08-14 22:59:59',
   'Canarias/UK en verano: EL ESPEJO, un dia de MAS',        'OTRA ZONA · sin defecto'),
  (TIMESTAMP '2026-07-15 16:00:00', TIMESTAMP '2026-08-15 05:59:59',
   'Mexico (-6): tambien espejo',                            'OTRA ZONA · sin defecto'),
  (TIMESTAMP '2026-07-14 23:30:00', TIMESTAMP '2026-08-13 22:59:59',
   'Canarias 00:30: OTRA ZONA *Y ADEMAS* EL DEFECTO',        '*** DEFECTO · 29 dias en su zona ***'),
  (TIMESTAMP '2026-07-15 08:00:00', TIMESTAMP '2026-08-15 21:59:59',
   'peninsula, fecha ELEGIDA A MANO a 31 dias',              'ELEGIDA A MANO'),
  (TIMESTAMP '2026-07-15 09:00:00', TIMESTAMP '2026-08-29 22:59:59',
   'otra zona, y ademas fecha ELEGIDA A MANO',               'ELEGIDA A MANO'),
  (TIMESTAMP '2026-07-15 08:00:00', TIMESTAMP '2026-08-14 08:00:00',
   'el front NO mando fecha: default del SERVIDOR',          'DEFAULT DEL SERVIDOR')
), calc AS (
  SELECT *,
    -- El front SIEMPRE manda `T23:59:59` en la zona del navegador. Si la hora UTC no acaba en
    -- :59:59, la fecha no la mando el front: la puso el `??` de quotes.routes.ts:166.
    (EXTRACT(MINUTE FROM valid_until)::int = 59
     AND FLOOR(EXTRACT(SECOND FROM valid_until))::int = 59)                        AS la_mando_el_front,
    -- 23:59:59 menos la hora UTC = el DESFASE del navegador del pro (mod 24 h).
    CASE WHEN (86399 - EXTRACT(EPOCH FROM valid_until::time))::int > 50400
         THEN (86399 - EXTRACT(EPOCH FROM valid_until::time))::int - 86400
         ELSE (86399 - EXTRACT(EPOCH FROM valid_until::time))::int END             AS desfase_pro_seg,
    -- El desfase que le tocaria a la PENINSULA ese dia (+1 invierno, +2 verano).
    EXTRACT(EPOCH FROM (("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Madrid') - "createdAt"))::int
                                                                                   AS desfase_peninsula_seg
  FROM casos
), zonas AS (
  SELECT *,
    (valid_until + make_interval(secs => desfase_pro_seg))::date
      - ("createdAt" + make_interval(secs => desfase_pro_seg))::date               AS dias_en_la_zona_del_pro,
    (valid_until + make_interval(secs => desfase_peninsula_seg))::date
      - ("createdAt" + make_interval(secs => desfase_peninsula_seg))::date         AS dias_medidos_en_madrid
  FROM calc
)
SELECT caso,
  valid_until::time                    AS hora_utc,
  ROUND(desfase_pro_seg / 3600.0, 1)   AS desfase_pro_h,
  dias_medidos_en_madrid,
  dias_en_la_zona_del_pro,
  veredicto_esperado,
  -- 🔴 EL ORDEN IMPORTA: el defecto se mira ANTES que la zona. Al reves, un pro de otra zona que
  -- ADEMAS sufriera el defecto saldria como «otra zona, sin defecto» y el veredicto lo TAPARIA.
  CASE
    WHEN NOT la_mando_el_front                    THEN 'DEFAULT DEL SERVIDOR'
    WHEN dias_en_la_zona_del_pro = 29             THEN '*** DEFECTO · 29 dias en su zona ***'
    WHEN dias_en_la_zona_del_pro <> 30            THEN 'ELEGIDA A MANO'
    WHEN desfase_pro_seg <> desfase_peninsula_seg THEN 'OTRA ZONA · sin defecto'
    ELSE 'NORMAL · 30 dias en su zona'
  END                                  AS veredicto_obtenido
FROM zonas;
```

### 10.5.2 · El censo

```sql
WITH calc AS (
  SELECT q.id, q."createdAt", q.valid_until,
    (EXTRACT(MINUTE FROM q.valid_until)::int = 59
     AND FLOOR(EXTRACT(SECOND FROM q.valid_until))::int = 59)                      AS la_mando_el_front,
    CASE WHEN (86399 - EXTRACT(EPOCH FROM q.valid_until::time))::int > 50400
         THEN (86399 - EXTRACT(EPOCH FROM q.valid_until::time))::int - 86400
         ELSE (86399 - EXTRACT(EPOCH FROM q.valid_until::time))::int END           AS desfase_pro_seg,
    EXTRACT(EPOCH FROM ((q."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Madrid') - q."createdAt"))::int
                                                                                   AS desfase_peninsula_seg
  FROM quotes q
  WHERE q.valid_until IS NOT NULL
), zonas AS (
  SELECT *,
    (valid_until + make_interval(secs => desfase_pro_seg))::date
      - ("createdAt" + make_interval(secs => desfase_pro_seg))::date               AS dias_en_la_zona_del_pro,
    (valid_until + make_interval(secs => desfase_peninsula_seg))::date
      - ("createdAt" + make_interval(secs => desfase_peninsula_seg))::date         AS dias_medidos_en_madrid
  FROM calc
), veredictos AS (
  SELECT
    -- 🔴 EL ORDEN IMPORTA: el defecto se mira ANTES que la zona. Al reves, un pro de otra zona
    -- que ADEMAS sufriera el defecto saldria como «otra zona, sin defecto» y quedaria TAPADO.
    CASE
      WHEN NOT la_mando_el_front                    THEN 'DEFAULT DEL SERVIDOR (el front no mando fecha)'
      WHEN dias_en_la_zona_del_pro = 29             THEN '*** DEFECTO · 29 dias en la zona del pro ***'
      WHEN dias_en_la_zona_del_pro <> 30            THEN 'ELEGIDA A MANO'
      WHEN desfase_pro_seg <> desfase_peninsula_seg THEN 'OTRA ZONA · sin defecto (el pro no estaba en la peninsula)'
      ELSE 'NORMAL (30 dias en la zona del pro)'
    END                                                                            AS veredicto,
    dias_medidos_en_madrid, dias_en_la_zona_del_pro,
    ROUND(desfase_pro_seg / 3600.0, 1) AS desfase_pro_h, "createdAt"
  FROM zonas
)
SELECT veredicto, dias_medidos_en_madrid, dias_en_la_zona_del_pro, desfase_pro_h,
       COUNT(*) AS cuantos, MIN("createdAt")::date AS desde, MAX("createdAt")::date AS hasta
FROM veredictos
GROUP BY 1, 2, 3, 4
UNION ALL
SELECT 'SIN FECHA (no se puede juzgar)', NULL, NULL, NULL,
       COUNT(*), MIN(q."createdAt")::date, MAX(q."createdAt")::date
FROM quotes q WHERE q.valid_until IS NULL
ORDER BY 1, 5 DESC;
```

### 10.5.3 · El detalle de los que dan 31, para ver de qué zona salieron

```sql
SELECT q.id,
       q."createdAt"                                          AS creado_utc,
       q.valid_until                                          AS vence_utc,
       q.valid_until::time                                    AS hora_utc,
       ROUND((CASE WHEN (86399 - EXTRACT(EPOCH FROM q.valid_until::time))::int > 50400
                   THEN (86399 - EXTRACT(EPOCH FROM q.valid_until::time))::int - 86400
                   ELSE (86399 - EXTRACT(EPOCH FROM q.valid_until::time))::int END) / 3600.0, 1)
                                                              AS desfase_pro_h,
       q."merchantId"
FROM quotes q
WHERE q.valid_until IS NOT NULL
  AND ((q.valid_until AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Madrid')::date
       - (q."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Madrid')::date) = 31
ORDER BY q."createdAt";
```

## 10.6 · Lo que NO cambia

El cero de la firma de 29 **sigue siendo cierto para pros peninsulares**: no hay presupuestos
emitidos con el defecto. La decisión del fundador sobre presupuestos ya emitidos sigue **sin
objeto** — y sigue siendo suya (regla 29).

## 10.7 · Anotado, sin tocar

**67 de 130 presupuestos NO tienen `validUntil`** — más de la mitad. Es otro ticket, y lo abre el
asesor. Se deja escrito aquí porque cambia cómo se lee el resto del censo: el campo que se lleva
una semana afinando **no lo tiene la mayoría de los documentos reales**.

---

# FASE ② · La caducidad, en el calendario del NEGOCIO

> Apéndice de `docs/master/SCRUM-633.md`, que fue **medición** y ya está en `main`. Esta entrada
> es la **construcción**, y va en fichero propio para no reescribir la del ticket original ni sus
> dos enmiendas.

**Fecha:** 4-sep-2026 · **Carril:** documentos / fechas · **Gate:** todo en `npm test`; sin BD

**Medido contra:** `origin/main` = `b74f523910fdb371c098a7f265a5a60e0eae3425` · 2026-09-04T21:55:00Z

**Tanda:** 5396 tests, **5308 pass, 0 fail**, 88 skipped — corrida DESPUES del ultimo cambio,
entrada incluida. Es la primera tanda del dia sin rojos:  —que llevaba toda la sesion
rojo en cualquier checkout cuya ruta lleve un espacio— ya esta arreglado en .

---

## La víctima

El profesional abre el editor **a las 00:30** y el formulario le ofrece una caducidad **un día
antes** de la que le tocaría. La guarda, se la manda al cliente, y el papel del cliente dice ese
mismo día equivocado. Nadie lo nota porque **todos los sitios se equivocan igual**.

---

## PASO 0

### El defecto es `toISOString()`, NO el cambio de hora

Formatea en **UTC**. Medido sobre 2026 con **dos métodos independientes y coincidentes**, para un
profesional en Madrid:

| hora local | días de 365 en que el día sale mal |
|---|---|
| 09:00 · 12:00 | **0** |
| 23:30 | **30** |
| 01:00 | **210** |
| 00:30 | **335** |

🔴 **Decirlo bien importa**: quien lea «cambio de hora» buscará dos días al año. Es que UTC y la
hora local son **dos calendarios distintos casi todas las noches**.

⚠️ Y el **23:30 sí es cambio de hora**, que es el matiz contrario: los `+30 días` son 24 h fijas, así
que en la ventana previa a cada cambio la hora local se desplaza. Son los 30.

*(El encargo traía `210` atribuido a las 00:30 y `0` a las 23:30. Los dos números existen; están en
otra hora. Corregido con la medición delante.)*

### MECANISMO — existía entero

`src/core/zonaDelMerchant.ts` (SCRUM-643, **el mismo día**) ya trae `zonaDelMerchant`,
`diaNaturalEn`, `finDelDiaEn` y `ZONA_POR_DEFECTO`. **El trabajo era darle superficie.**

---

## No eran cuatro sitios: son SIETE

| | sitio | estado |
|---|---|---|
| ① | `quotesView.js` — el default del formulario | 🔧 |
| ② | `quotesView.js` — el `min` del selector | 🔧 |
| ③ | `quotesView.js` — lo que se guarda | ✔ **ya era correcto** |
| ④ | landing — «Válido hasta el…» | 🔧 |
| ⑤ | landing — la página de «caducado» | 🔧 (lo contaba nadie) |
| **⑥** | **landing — la fecha de ACEPTACIÓN** | 🔧 **lo encontró el censo** |
| **⑦** | **landing — la fecha de RECHAZO** | 🔧 **lo encontró el censo** |
| — | el cron `expire.service.ts` | ✔ **FUERA** |

**⑥ y ⑦ entran por el mismo motivo por el que los demás entran juntos**: están en la **misma
página** que ④ y ⑤. Dejarlas fuera habría impreso unas fechas en el calendario del negocio y otras
en el de la máquina que las sirve — creando dentro de una sola pantalla justo lo que el ticket
viene a cerrar.

### El cron queda fuera, y por escrito

`isQuoteExpired` compara **instantes** (`getTime() < Date.now()`), y **un instante no tiene zona**.
Y sigue siendo correcto **precisamente porque ③ guarda el instante bueno**: si ③ estuviera mal, el
cron caducaría a deshora. Hay un test que lo fija — si algún día compara **días**, entra en el
grupo y hay que decidir en qué zona.

---

## La zona del MERCHANT, no la del navegador

`zonaDelMerchant.ts` lo dejó escrito para el mes fiscal y vale igual aquí:

> *«el error no fue elegir la hora local: fue suponer que "local" sería un solo sitio»*

La zona del **navegador** repite ese defecto un piso más abajo: un empleado que viaja vería una
caducidad distinta de la que rige el presupuesto. **La fecha de validez es del NEGOCIO.**

### Tres eslabones para que la zona LLEGUE

`timezone` **no llegaba al front por ningún camino**. Se añade a tres `select` explícitos —de esos
en los que *«lo que no esté aquí NO SALE, aunque esté en la columna»*, la advertencia de SCRUM-579:

1. `getMerchantProfile` — el perfil que consume el editor.
2. **La lista REDUCIDA del técnico** (`app.ts`). Decisión del asesor: es dato de **calendario**, no
   fiscal ni bancario, y **un técnico crea presupuestos** — negársela sería crear el defecto para
   un rol.
3. El `merchant` de la landing, para las cuatro impresiones.

Un test ata los tres, porque **ningún guard fijaba esas listas**: lo medí antes de tocarlas.

### El NULO

`ZONA_POR_DEFECTO = 'UTC'`, decisión A del fundador (2-sep-2026). **En dev: 5 de 6 merchants tienen
`Europe/Madrid`, 1 tiene NULL.**

🔴 **El matiz que un lector rápido invertiría:** el valor **coincide** con la zona del contenedor
pero **no se deriva** de ella — es una constante declarada. Consecuencia práctica: **para ese
merchant el arreglo no cambia nada**, y eso es la decisión funcionando, no un hueco. Hay un control
negativo que lo fija.

---

## 🔴 La copia declarada entre TypeScript y vanilla

El escalón bueno es: **hacerlo imposible → derivar → duplicar con guard → duplicar con comentario.**

Aquí **el 1 y el 2 no existen**: el sitio único es TypeScript compilado a `dist/` para Node, y esta
pantalla es JavaScript de navegador servido tal cual, **sin bundler** — regla dura de la casa. No
hay forma de que el navegador ejecute aquel módulo ni de derivar esta salida de aquella llamada.

**Se cae al escalón 3 por IMPOSIBILIDAD MEDIDA, no por comodidad.** Sin esta frase, dentro de un mes
parecería pereza.

Y el guard que las ata es **por COMPORTAMIENTO, no por texto**: **54 comparaciones** —6 zonas × 9
instantes, con **los dos cambios de hora dentro**— más la tabla del nulo. Un guard de texto habría
nacido mudo, que es como han nacido tres trinquetes esta semana.

---

## El rojo: la CADENA, no un sitio

Un test de «① da el día correcto» no prueba nada: los siete podrían quedar desincronizados y seguiría
verde. El que decide **ejecuta la cadena entera** —lo que el pro VE → lo que se GUARDA → lo que el
cliente LEE— **a las 00:30 con `Europe/Madrid`**, que es donde coincidían **en el día equivocado**, y
exige que los tres digan el mismo día **y que sea el bueno**.

Con sus dos controles negativos: **a las 10:00** (donde nunca falló) nada cambia, y **un merchant sin
zona** ve exactamente lo de antes.

Y con el **rojo demostrado**: se ejercita la forma vieja al lado y se comprueba que a las 00:30
**difiere** — si dejara de reproducir el defecto, el verde no significaría nada.

---

## 🔴 Hueco declarado: ③ y el empleado que viaja

③ construye `23:59:59` con `new Date(dia + "T23:59:59")`, que se interpreta en la zona del
**dispositivo**. Con el profesional en la zona de su negocio —el caso normal— es correcto. **Con un
empleado viajando, el día que lee el cliente se va uno adelante:**

| navegador | ① el pro ve | ④ el cliente lee | |
|---|---|---|---|
| Europe/Madrid | `2026-08-14` | `2026-08-14` | ✔ |
| America/Mexico_City | `2026-08-14` | **`2026-08-15`** | 🔴 |

El asesor dijo explícitamente que **③ no se toca** en este ticket. Se fija el comportamiento REAL en
un test para que sea visible y no derive en silencio: si alguien lo arregla, ese test cae y le dice
que ya no es un hueco. **El arreglo sería una línea**: `finDelDiaEn(dia, zonaDelMerchant(merchant))`,
que ya existe en el sitio único.

---

## Tres cosas que cazó el propio trabajo

1. **El banco de vistas.** Leer `currentMerchant` al construir el formulario **revienta la pantalla
   entera** (`Cannot access before initialization`: la variable se declara 550 líneas más abajo). Se
   pinta con la zona por defecto y se **refresca** cuando el merchant llega — y **sólo si nadie ha
   elegido otra fecha**: pisar una elegida a mano sería cambiar el documento por detrás, peor que el
   desfase de un día.
2. **🔴 Mi propio test se volvió tautológico.** Comprobaba
   `diaPorDefecto(currentMerchant, 30)` y **siguió verde** después de sacar esa llamada del
   formulario — porque la misma cadena vive dentro de `refrescarCaducidad`. **Medía el refresco
   creyendo que medía el pintado.** Ahora comprueba los **dos tiempos** por separado, y que alguien
   **llame** al refresco: mencionar no es hacer.
3. **SCRUM-605 fijaba la EXPRESIÓN del default y cayó.** No se relajó: se le devolvió la **pregunta**
   — ahora fija los **días** (+30 y +1), que es lo que ese control quería decir. Que el día sea el
   correcto lo ata este ticket, con su propio control negativo.

---

## Mutación · siete defectos, siete cazados

Post-condición: cambió el fichero que dice, ningún otro se movió, y para TypeScript, que `dist/` se
movió. «No compila» cuenta como cazada.

| # | defecto inyectado | quién lo caza |
|---|---|---|
| ① | el formulario vuelve a calcular en UTC | 5 tests |
| ② | una de las cuatro impresiones pierde su `timeZone` | el censo de la landing |
| ③ | el `select` del perfil deja de traer la zona | **el compilador** + el test de eslabones |
| ④ | la lista del técnico deja de devolverla | **el compilador** + el test de eslabones |
| ⑤ | el nulo cae a Madrid en vez de a UTC | 2 tests |
| ⑥ | el refresco pisa la fecha elegida a mano | el test de los dos tiempos |
| ⑦ | nadie llama al refresco | el test de los dos tiempos |

Control negativo: sin mutar, cero rojos. Tras restaurar, cero rojos y las huellas vuelven.

---

## El censo · cuántos presupuestos habría

Con el clasificador de la **enmienda 2** (la que se rescató hoy), y **sus ocho casos de control
primero — los ocho pasan**, así que distingue defecto de otra zona de elección manual:

```
yaqu_dev_javier · 8 presupuestos
   4 · DEFAULT DEL SERVIDOR (el front no mandó fecha)
   4 · SIN FECHA (no juzgable)
   0 · con fecha mandada por el front
```

🔴 **Cero SOBRE POBLACIÓN VACÍA no es un cero**: no hay ni un presupuesto sobre el que el defecto
pueda manifestarse. La cifra que importa está en producción, y la saca esa misma consulta.

**No se ha tocado ningún presupuesto emitido** (regla 29, decisión del fundador).

---

## La zona del contenedor · por qué NO se abre ticket

Nadie fija `TZ` en el despliegue, y **no se abre ticket a propósito**: fijarla cambiaría de golpe el
comportamiento de todo lo que lee hora local. La casa la está retirando **camino a camino** —
SCRUM-643 con el mes fiscal, éste con la caducidad—. Con los siete sitios derivando de la zona del
merchant, **este camino deja de depender del contenedor**. Lo que quede se retira igual.

---

## Microcopy

**Ninguna.** No se estrena ni un texto: cambia el día que se calcula, no cómo se nombra.

---

## Tests

- `tests/scrum633-caducidad-en-la-zona.test.mjs` — los 13.

---

## Huecos declarados · lo que NO verifiqué

- **③ y el empleado que viaja**: arriba, con su tabla. No se toca por decisión del asesor.
- **No he abierto el editor en un navegador**: se comprueba la función, el montaje en el banco y el
  fuente, no el píxel.
- **No he medido producción**: el censo de dev no tiene sujetos.
- **La zona del contenedor no la he leído del proceso vivo**: la doy por UTC porque la medición
  mergeada dice que nadie la fija.
- **No he corrido `npm run guards:visuales`**: miden la landing pública, que no comparte estos
  ficheros, pero **no lo he ejecutado**.
