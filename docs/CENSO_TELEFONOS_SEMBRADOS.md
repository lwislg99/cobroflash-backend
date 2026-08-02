# Censo de teléfonos fuera del rango de prueba · SCRUM-262

> **Para qué existe.** SCRUM-262 movió los teléfonos de los datos de prueba a un rango que no
> puede pertenecer a nadie (`34` + `0` + 8 dígitos). Eso arregla **el repositorio**, no las
> **bases de datos**: las filas que sembró la versión anterior siguen guardadas con números de
> rango real. Y tres crons envían WhatsApp a teléfonos guardados —`sendPendingReminders` (cada
> hora), `sendInvoicePaymentReminders` y `runMaintenanceProposals` (diarios)—, **ninguno filtra
> al merchant demo**. Hasta que esas filas se limpien, el freno `demoSendBlocked` sigue siendo lo
> único que las protege.

---

## 0 · LA PREGUNTA QUE HAY QUE RESPONDER PRIMERO, y su respuesta es incómoda

**¿Se puede distinguir en la BD un cliente REAL de un merchant REAL de un dato de prueba
sembrado?**

**A nivel de fila, NO. No existe ninguna marca.** Medido sobre `prisma/schema.prisma`: ni
`Merchant` ni `Customer` tienen columna alguna de tipo `isDemo`, `seeded`, `source` o
equivalente. Un cliente sembrado y un cliente real son, columna a columna, indistinguibles.

**A nivel de MERCHANT, sí — y solo para el demo.** Es la única distinción que el propio código
usa (`isDemoMerchant`, `emission.service.ts`):

```
merchant.id = 1   OR   lower(merchant.email) = 'demo@yaqu.app'
```

**Consecuencia, y es la regla que gobierna todo lo de abajo:**

> Solo se limpian las filas **del merchant demo**. Cualquier teléfono fuera de rango que pertenezca
> a otro merchant es **un cliente real de un profesional real**: no se toca, no es un hallazgo, y
> que aparezca en el censo es lo ESPERADO — es el producto funcionando.

**Y lo que esto significa a largo plazo, que es más grande que este ticket:** no hay forma
mecánica de comprobar que una base de staging esté libre de números reales, porque cualquiera pudo
crear un merchant a mano con datos de verdad. Lo único verificable es que **el repo** no vuelva a
sembrar números reales, y de eso se encarga `tests/scrum262-telefonos-de-prueba.test.mjs`. Si algún
día hiciera falta la garantía sobre la BD, la respuesta honesta es una **columna de origen** en
`Merchant` (`origen: 'seed' | 'real'`), que es cambio de schema y decisión del fundador.

---

## 1 · CENSO · SOLO LECTURA, se puede correr contra producción

Cinco columnas de teléfono en cuatro tablas (nombres físicos verificados contra el schema).
**No hay ningún `UPDATE`, `DELETE` ni `CREATE` en toda la consulta.**

```sql
-- SCRUM-262 · Teléfonos fuera del rango de prueba (34 + 0 + 8 dígitos).
-- SOLO LECTURA. Agrupa por tabla y por merchant, y marca cuál es el demo.
WITH tel AS (
  SELECT 'customers'    AS tabla, 'phone'          AS columna, c.merchant_id, c.phone          AS valor
    FROM customers c     WHERE c.phone IS NOT NULL
  UNION ALL
  SELECT 'merchants',           'whatsapp_phone',  m.id,        m.whatsapp_phone
    FROM merchants m     WHERE m.whatsapp_phone IS NOT NULL
  UNION ALL
  SELECT 'merchants',           'bizum_phone',     m.id,        m.bizum_phone
    FROM merchants m     WHERE m.bizum_phone IS NOT NULL
  UNION ALL
  SELECT 'providers',           'phone',           p.merchant_id, p.phone
    FROM providers p     WHERE p.phone IS NOT NULL
  UNION ALL
  SELECT 'bot_sessions',        'phone',           b.merchant_id, b.phone
    FROM bot_sessions b  WHERE b.phone IS NOT NULL
)
SELECT
  t.tabla,
  t.columna,
  t.merchant_id,
  m.email                                                     AS merchant_email,
  (t.merchant_id = 1 OR lower(m.email) = 'demo@yaqu.app')     AS es_demo,
  count(*)                                                    AS filas_fuera_de_rango
FROM tel t
LEFT JOIN merchants m ON m.id = t.merchant_id
-- «fuera de rango» = el número normalizado NO empieza por 340
WHERE regexp_replace(t.valor, '[^0-9]', '', 'g') NOT LIKE '340%'
GROUP BY t.tabla, t.columna, t.merchant_id, m.email
ORDER BY es_demo DESC, filas_fuera_de_rango DESC;
```

**Cómo leer el resultado:**

* Filas con **`es_demo = true`** → **datos sembrados que hay que limpiar** re-sembrando. Son las
  que los crons podrían marcar.
* Filas con **`es_demo = false`** → **clientes reales**. Es lo normal y no se toca nada.
* **Cero filas con `es_demo = true`** → la base está lista y el freno deja de proteger nada ahí.

> ⚠️ El `LIKE '340%'` da por bueno un número que *empiece* por 340 aunque tenga otra longitud. Es
> deliberado: aquí interesa **no dar por limpio lo sucio**, y un falso «fuera de rango» solo
> provoca una re-siembra de más. La comprobación estricta vive en el guard del repo.

> ⚠️ **`bot_sessions` se lee distinto que las demás, y esto salió al verificar las columnas.** Su
> `phone` es **el número de quien escribió al bot**, no un dato que hayamos sembrado: por
> definición es una persona real, y aparecerá siempre fuera de rango. **No es algo que limpiar** —
> es una sesión efímera con su `expiresAt`. Además su `merchant_id` es **nullable** (un
> desconocido no tiene merchant), así que esas filas saldrán con `es_demo` en `NULL`. Van en el
> censo porque es un teléfono guardado y conviene verlo, pero se leen como «tráfico real», no como
> deuda. Si molestan, se filtran con `AND t.tabla <> 'bot_sessions'`.

---

## 2 · RE-SIEMBRA

### 2.1 · Staging

```bash
# 1. Tomar el turno (SCRUM-188): la re-siembra pisa datos que otra tanda puede estar usando.
npm run turno:estado          # ¿lo tiene alguien?
npm run turno:tomar

# 2. Censo ANTES, para saber qué se va a limpiar (la consulta de arriba).

# 3. Re-sembrar. Los seeds ya escriben el rango imposible (SCRUM-262).
node scripts/seed-demo.mjs

# 4. Censo DESPUÉS: `es_demo = true` tiene que devolver CERO filas.

# 5. Soltar el turno.
npm run turno:soltar
```

`seed-demo.mjs` lleva su propio guard anti-producción y borra los datos del merchant demo antes de
sembrar, así que es idempotente sobre esa cuenta.

### 2.2 · Producción — **NO la toca nadie sin el fundador**

Aquí no hay «re-sembrar y ya»: el seed **borra** filas del merchant 1, y en producción esa cuenta
puede tener historial que alguien quiera conservar.

1. **Censo primero.** Si `es_demo = true` devuelve cero filas, **no hay nada que hacer** y se
   puede pasar directamente a retirar el freno.
2. Si devuelve filas, **decisión del fundador** entre dos caminos, y ninguno lo ejecuto yo:
   * **Re-sembrar el demo** (`node scripts/seed-demo.mjs` contra producción) — borra y recrea los
     datos de esa cuenta. Rápido y deja el estado limpio, pero **pierde** lo que hubiera.
   * **Actualizar solo los teléfonos** de las filas del merchant 1, conservando el resto. Es la
     opción conservadora; el `UPDATE` **no está escrito en este documento a propósito**, porque
     una sentencia de escritura contra producción se redacta y se revisa en el momento, con su
     preview y su `WHERE merchant_id = 1` delante.
3. Después del cambio, **censo otra vez**, y solo entonces retirar el freno.

> **Orden que no se invierte:** primero las bases limpias, después la retirada del freno
> (`scrum-245-fuera-listas-blancas`, aparcada en `fcdc980`). Al revés, se quita la única
> protección que tienen las filas viejas.

---

## 3 · Qué queda protegido cuando esto termine

| | Antes de 262 | Con 262 en el código | Con las bases limpias |
|---|---|---|---|
| Datos de prueba **nuevos** | rango real | **imposible** | imposible |
| Filas **ya sembradas** en la BD | rango real | rango real | **imposible** |
| Los 3 crons pueden marcar un número de un tercero | sí (lo frena la lista) | sí, en filas viejas | **no** |
| El freno `demoSendBlocked` hace falta | sí | sí | **no** |
| Clientes **reales** de merchants reales | intactos | intactos | **intactos** |
