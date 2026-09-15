# SCRUM-856 · El canje del mes gratis se gasta una vez, y lo garantiza la base

**Fecha:** 15-sep-2026 · **Carril:** dinero · referidos · **Gate:** sin gate — corre en `npm test`
**Medido contra:** `origin/main` = `9e2d7299113e47a60de34880e972b8f19c02607e` · 2026-09-15T11:12:42Z
**Rama:** `scrum-856-canje-una-sola-vez`

**Nace de** el censo de rebote de SCRUM-815, donde se midió y **no se tocó** (regla 9). Misma
familia, misma forma y mismo arreglo de una línea que la carrera del referido.

---

## 1 · El defecto, con sus DOS caras — y una corrige al ticket

`redeemFreeMonth` leía `freeMonthsEarned`, comprobaba `< 1` en JavaScript y **después** descontaba.
Entre el `if` y el `update` no hay nada.

### 🔴 LOS ROJOS, EJECUTADOS ANTES DEL ARREGLO

```
not ok 3 - dos canjes SIMULTÁNEOS con UN crédito → el saldo NUNCA queda negativo
  🔴 EL SALDO HA QUEDADO EN -1. Los dos canjes leyeron el mismo crédito, los dos pasaron
     la guarda y los dos descontaron.

not ok 4 - dos canjes SIMULTÁNEOS con DOS créditos dan 60 días, no 30
  🔴 se han gastado DOS créditos y la cuenta sólo se ha extendido 30 días.
  30 !== 60
```

### ⚠️ CORRECCIÓN AL ENUNCIADO, medida

El ticket dice «estiran `planExpiresAt` **dos veces**» y «un mes gratis **regalado** por cada
carrera ganada». **Medido, va al revés.** Los dos canjes calculan la fecha nueva sobre la MISMA
lectura y escriben el **mismo valor absoluto**, así que la segunda extensión no suma: pisa.

| escenario | créditos gastados | días ganados |
|---|---|---|
| 2 canjes simultáneos, 1 crédito | 2 (saldo **−1**) | 30 |
| 2 canjes simultáneos, 2 créditos | 2 | **30**, no 60 |

O sea: **no se regala nada — se cobra de más al merchant.** Paga dos créditos y se lleva un mes.
La dirección importa porque cambia a quién perjudica: no es la casa perdiendo dinero, es el
profesional perdiendo un mes que se había ganado, y en silencio. El defecto es igual de real y el
arreglo es el mismo; lo que no es correcto es el relato.

---

## 2 · El arreglo: la condición DENTRO del UPDATE, y el `count` decide

```ts
const reclamo = await tx.merchant.updateMany({
  where: { id: merchantId, freeMonthsEarned: { gte: 1 } },
  data: { freeMonthsEarned: { decrement: 1 } },
});
if (reclamo.count !== 1) return null;   // no existe, no hay crédito, o alguien se adelantó
```

Tres piezas, y ninguna es decorativa:

1. **la guarda viaja dentro del `UPDATE`** — la base comprueba y escribe de una pieza; es el patrón
   de `recapitulativa.service.ts:118`, «lo que hace segura la concurrencia»;
2. **el código mira el `count`** — lo único que distingue «he reclamado yo» de «se me adelantaron»;
3. **la extensión se calcula DENTRO de la misma transacción y DESPUÉS de reclamar**, para que el
   cerrojo de fila impida que otro canje se cuele entre el descuento y la fecha. Sin esto, la
   segunda cara (30 en vez de 60) seguiría viva aunque el saldo ya fuese correcto.

> 🔴 **MUTACIÓN CORRIDA, no razonada.** Con `if (reclamo.count !== 1)` sustituido por `if (false)`
> caen **cuatro** controles y vuelve el defecto entero: dos canjes dados por buenos con un solo
> crédito y el saldo otra vez en negativo. Fuente restaurada byte a byte — sha256
> `1ed37322690dcede` antes y después.

### El comentario: CORREGIDO, no borrado

Decía **«Idempotente por crédito»** mientras la carrera lo desmentía.

> 🔒 Un comentario que afirma una propiedad que el código no tiene es peor que no tenerlo: el
> siguiente que lo lea no va a comprobarlo, ya se lo han dicho.

No se borra —el lector siguiente necesita saber que la propiedad **se busca a propósito**— sino que
pasa a decir **qué la garantiza**, para que quien quiera «simplificar» el `updateMany` a un `update`
normal sepa qué está quitando. Hay un control que lo vigila: la cabecera no puede volver a la frase
suelta, y tiene que seguir nombrando el mecanismo.

### Lo que NO cambia: el contrato de la ruta

`count: 0` no distingue «no existe» de «sin crédito», y `app.ts:638` **sí** los distingue
(`no_credit` → 409, el resto → 400). Se resuelve con una lectura barata **sólo en el camino de
fallo**, que no es el que corre a diario. El contrato queda igual.

---

## 3 · El banco: `tests/scrum856-canje-una-sola-vez.test.mjs`

| control | qué fija |
|---|---|
| 🔴 SUELO | un canje con crédito descuenta y extiende 30 días; sin crédito no canja y dice `no_credit`. Si el detector no ve ningún canje, se declara CIEGO |
| 🔴 LA CARRERA | dos canjes simultáneos con **un** crédito → el saldo **nunca** queda negativo, y gana exactamente uno |
| 🔴 LA SEGUNDA CARA | dos simultáneos con **dos** créditos → **60** días, no 30 |
| ✅ LA BASE DECIDE | la segunda llamada devuelve `no_credit` y no mueve el saldo |
| ✅ POSITIVO | dos créditos en serie se canjean **los dos** — comerse el segundo sería romper el producto por el lado bueno |
| ✅ POSITIVO | con suscripción vigente, extiende **desde su fin** (40 días, no 30): la regla de negocio que ya existía |
| 🔴 ESTRUCTURAL | la guarda está en el `where`, el código mira el `count`, y el comentario no promete de más |

### 🔴 La trampa del banco, esquivada a propósito

`tests/_envio-doblado.mjs:66` hace `if (nombre.startsWith('$')) return async () => undefined;`, o
sea que **`$transaction(cb)` devuelve `undefined` sin llamar a `cb`**. El arreglo mete el trabajo
dentro de una transacción: con ese doble, este fichero habría pasado **en verde sin ejecutar una
sola línea del arreglo**. Por eso lleva doble propio. *(Ese defecto es SCRUM-855 y aquí no se
toca.)*

El doble modela dos cosas y sólo dos: que un UPDATE condicional es atómico y devuelve `count`, y
que **dos transacciones sobre la misma fila se serializan** —el cerrojo de fila de Postgres—.

> ⚠️ **LÍMITE DECLARADO:** es un MODELO, no Postgres. Por eso el banco lleva además el control
> ESTRUCTURAL, que no depende de él, y la mutación, que lo pone a prueba.

## 4 · Lo NO tocado

`ensureReferralCode` y `generateUniqueReferralCode` (los otros dos del censo de SCRUM-815, otro
tamaño) · el doble de `_envio-doblado.mjs` (es SCRUM-855) · `prisma/schema.prisma` · el contrato de
`/admin/referral/redeem` · ningún estado ni flag (27) · ninguna dependencia (36). Ninguna base,
ninguna clave. **Nada ejecutado contra producción ni contra staging.**
