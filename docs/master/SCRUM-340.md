# SCRUM-340 · Lo MEDIDO al intentar traer su rama a `main` (8-sep-2026)

**Medido contra:** `origin/main` = `1bbf60afb9eae547e083e1c716fa97c88306d791` · 2026-09-08T07:41:43Z
**Estado de este apéndice: SÓLO DOCUMENTO.** No trae ni una línea de código —`git diff origin/main
-- src/ tests/ public/` sale vacío—, así que se puede mergear solo y no depende de ninguna decisión.

> **⚠️ LA REGLA DE ESTA RAMA NO ESTÁ EN `main`.** `main` sigue con
> `PLAZA_OCUPADA = { plan: 'founding', subscriptionStatus: 'active' }`
> (`src/modules/billing/domain/founding.ts:34`, último cambio `0255673d`, SCRUM-330).
> **`main` HOY no publica ninguna mentira nueva**, así que esto no corre prisa.

## 0 · Cómo nació este apéndice

Decisión del fundador (8-sep-2026), literal:

> «la plaza de fundador se queda con él; si se retrasa en un pago tiene un tiempo para pagarla,
> y si no, esa plaza desaparece con el merchant».

⇒ `past_due` OCUPA plaza; el primer pago sin estado, también. Con esa firma se intentó traer la
rama. **El hallazgo de abajo lo destapó la instrucción del asesor de REESCRIBIR el guard de
SCRUM-330 en vez de retirarlo** — «se reescribe lo que el guard PROTEGE, nunca lo que MIRA». Al ir
a reescribir lo que protege («el estado NO se deduce del plan: son dos columnas») se vio que la
implementación nueva **no mira el plan en absoluto**.

## 1 · 🔴 LO MEDIDO, ejecutando `plazaOcupada` de la rama

| entrada | veredicto |
| --- | --- |
| suscriptor **PRO** que paga (`plan: pro`, `active`) | **OCUPA** |
| fundador que paga (`plan: founding`, `active`) | **OCUPA** |
| fundador que canceló (`plan` vuelve a `trial`, marcador `firstPayment`) | **OCUPA** |
| trial puro, sin nada | no ocupa |

**Las dos primeras filas son literalmente la misma entrada.** `plazaOcupada` no recibe el plan.

## 2 · Por qué, con ruta y línea

- `plazaOcupada(m: FilaDePlaza)` — `src/modules/billing/domain/founding.ts:67` en la rama. Su
  parámetro es `{ subscriptionStatus, lifecycleEmailsSent }` (`:57-61`): **el plan no entra**.
- `getFoundingStatus()` — mismo fichero, `:100`. Consulta:
  `prisma.merchant.findMany({ select: { subscriptionStatus: true, lifecycleEmailsSent: true } })`
  — **sin `where` y sin leer `plan`**. Y su propio test lo FIJA: *«la consulta del contador NO
  filtra por `plan` (derivado del AST)»*, así que **es deliberado, no un descuido**.

**Y el webhook escribe el mismo estado para los dos planes:**

- `src/modules/billing/app/routes/stripe.routes.ts:77` →
  `data: { stripeCustomerId, plan: planId, subscriptionStatus: 'active' }`, donde `planId` es
  `'pro'` **o** `'founding'`.
- Y `plan` vuelve a `trial` al cancelar: `:138` y `:151` →
  `data: { plan: 'trial', subscriptionStatus: 'canceled', … }`.

## 3 · Las dos mitades del problema, y por qué ninguna sola vale

| criterio | falla en |
| --- | --- |
| **`plan: 'founding'`** (lo de `main`) | se resetea a `trial` al cancelar → **libera la plaza**, y eso contradice la firma del fundador |
| **sólo el estado** (lo de esta rama) | `active` lo tiene también el suscriptor **PRO** → **cada PRO activo cuenta como plaza founding ocupada** |

⇒ Con la rama tal cual, la landing diría «quedan 18 de 20 plazas» porque dos personas compraron
**PRO**. Que es **el bug original de SCRUM-327/330 —prueba social sobre gente que no compró esa
plaza— reintroducido por la otra puerta.**

**Falta una señal DURADERA de «compró founding» que sobreviva a la cancelación.** `plan` no vale
(se resetea), `subscriptionStatus` no vale (no dice qué plan), `lifecycleEmailsSent.firstPayment`
tampoco (no dice qué plan).

## 4 · Las tres salidas, con coste y riesgo — SIN elegir

| # | salida | coste | riesgo |
| --- | --- | --- | --- |
| **1** | **Marcar el plan comprado al cobrar**, en un campo que NO se resetee | columna nueva → `prisma/schema.prisma` (dominio del fundador) + ALTER en tres bases + escribir el campo en el webhook | toca el camino de cobro; el histórico nace a `NULL` y hay que decidir qué se cuenta mientras tanto |
| **2** | **Derivarlo de Stripe** (el `price`/`lookup_key` de la suscripción) | sin schema; una llamada a Stripe por consulta del contador | mete una dependencia EXTERNA en un contador de superficie pública: si Stripe tarda o falla, el contador entra en su rama `no resoluble` y la landing deja de pintarlo |
| **3** | **No resetear `plan` al cancelar** y separar «qué compró» de «si sigue pagando» | sin schema; cambia el webhook (`stripe.routes.ts:138,151`) | `plan` deja de significar «lo que puede usar hoy»: hay que revisar TODOS sus lectores, y uno es el paywall — es cambiar la semántica de una columna viva |

**No se elige aquí.** Es dinero, superficie pública y probablemente schema: decisión del fundador.

## 5 · ✅ El control rojo, que SÍ pasó

Antes de encontrar lo anterior se ejercitó el trinquete que la rama trae. Inyectada la regla de
`main` (`ESTADOS_QUE_ACREDITAN_COBRO = ['active']`), el test **cayó nombrando el caso**:

```
not ok 2 - SCRUM-340 · ocupa quien COMPRÓ, y la plaza NO se libera al cancelar
   🔴 `past_due` es alguien que PAGÓ y ahora falla un cobro: ocupa
```

Fuente restaurado byte a byte — **sha256 `a0bd015dc74cf2d433e56b8f3328eea7d5f70ac9d8236ea91b97642186eee7c1`
antes y después**— y `dist` recompilado desde el fuente restaurado.

⇒ **Es un trinquete de verdad, no un comentario.** Lo que está en discusión no es su calidad: es
el criterio que vigila.

## 6 · El reparto del test, para cuando se abra el ticket de las superficies

De los 6 casos del fichero de la rama: **5 miden LA REGLA** (se quedan con este ticket) y **1 mide
LAS SUPERFICIES** —«las tres superficies pintan por `mostrar`/`ofertaVigente`, no por su cuenta»—
que espera al ticket de `plansView.js`, `index.html` y `precios.html`. El caso de SUELO es mixto:
su mitad de superficies se va con ellas.

⛔ Cuando se separen: **no se borran ni se bajan a `skip`** —un test saltado se cuenta como pasado
(SCRUM-754)— se llevan enteros, con su nombre, a esperar su ticket.

## 7 · Lo que queda pendiente y de quién es

1. **El fundador elige la señal duradera** (§4). Hasta entonces esta rama no se puede traer.
2. Con esa señal: reescribir los dos casos de `tests/scrum330-contador-solo-activas.test.mjs`
   contra el predicado puro —protegiendo lo mismo: que el criterio siga mirando LAS DOS cosas— y
   con su rojo (inyectar un criterio que deduzca el estado del plan y verlo caer).
3. Y escribir la prueba de que `founding_no_resoluble` **se emite de verdad**: el corte
   fail-closed del checkout es correcto, pero un rastro que nadie ha visto emitir es una promesa.
   Se paró a propósito: sin el criterio final, el arnés puede no valer.
