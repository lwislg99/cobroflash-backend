# SCRUM-712 · Los decimales de un número de dinero, acotados EN LA PUERTA

**Fecha:** 4-sep-2026 · **Carril:** dinero (validación de entrada) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `2c161c38cfba4ad81479dd302a933412d496f58c` · 2026-09-04T10:15:00+02:00

## 1 · PASO 0 · el defecto vive, y no era una foto vieja

```
git log -S "price: z.number()" -- src/core/validation/schemas.ts  → 87125a3a "Refactor"
🔴 control POSITIVO (otra aguja que sí existe):
   git log -S "nonnegative"  → 2e3e7685 (SCRUM-661), 87125a3a      ✔ el comando ve
🔴 control NEGATIVO (aguja que no existe):
   git log -S "price: z.number().multipleOf"  → 0                  ✔ y no inventa
```

`SCRUM-624` acababa de entrar en `main` y **no tocó** `schemas.ts`. Y ejecutado contra el esquema
real, no leído: `1.23456789` **entraba** y se guardaba tal cual.

## 2 · El censo, por AST — 5 sitios, 0 acotaban

| | |
| --- | :-: |
| campos de dinero validados con zod | **5** |
| de ellos, acotaban decimales | **0** |

`price` y `costeUnitario` (`QuoteLineSchema`), `total` (`QuoteTierSchema`), `amount`
(`CreateChargeSchema`) y `amount` (`PSPWebhookSchema`).

## 3 · 🔴 El hallazgo que cambia el ticket: nadie lo acotaba aguas abajo

| dónde vive el precio | tipo | quién lo acota |
| --- | --- | --- |
| `Product.price` (catálogo) | `Decimal(12, 2)` | la base, a 2 — **en silencio** |
| **`Quote.lines[].price`** | **`Json`** | **NADIE** |

El `price` de una línea **no va a una columna `Decimal`**: va dentro de `Quote.lines`, que es
`Json`. Ahí no hay truncado, y por eso el `30,003` sobrevive: **el desacuerdo nace en el dato**, y
ningún redondeo posterior puede arreglarlo.

## 4 · La decisión del fundador (4-sep-2026)

```
PRECIO UNITARIO  (price, costeUnitario)      → 4 decimales
IMPORTE          (total de tramo, amount ×2) → 2 decimales
```

**Un importe en euros tiene dos decimales y punto.** Un precio unitario no: un electricista compra
cable a **0,4567 €/m**. Acotarlo a 2 destruiría **en silencio** precisión que él escribió — 20
céntimos de su margen sobre 60 metros. Es la misma familia que este árbol lleva días cerrando: un
dato que se pierde sin avisar.

**Por qué 4 exactamente:** porque 4 es la escala que esta casa **ya usa** cuando necesita más de
dos — `Merchant.costEstimate` es `Decimal(8,4)` y `Product.vat` es `Decimal(5,4)`. No es un número
que suene bien: es el que ya está en el esquema. *Esa razón está escrita en el código, no el número
a secas.*

**Descartada la opción de 2 para `price` y 4 para `costeUnitario`:** serían dos reglas para dos
campos que el profesional ve **juntos, en la misma línea de la misma pantalla**, y el margen se
deriva de los dos — con coste a 4 y precio a 2, la resta sale asimétrica.

## 5 · 🔴 Cuatro decimales EN LA PUERTA no son cuatro aguas abajo

El importe de línea, la base, la cuota y el total **siguen a DOS**, con el redondeo **una sola vez
y al final** (SCRUM-293, ya escrito; SCRUM-436 lo vigila al pintar). El defecto viejo nunca fue que
entraran decimales: fue que **se redondeaba en DOS SITIOS con DOS CONVENCIONES**.

## 6 · ⚠️ El caso que decide si el arreglo es bueno o sólo lo parece

Los `number` de coma flotante **mienten**: `1.005` se representa como `1.00499999999999989`. Una
acotación que cuente decimales sobre el bit acepta o rechaza según el valor que toque — y eso es un
arreglo que nace roto **y verde**.

Medido con las dos formas posibles antes de elegir, y **las dos coinciden en los once casos**:

| valor | `String()` | `multipleOf(0.0001)` | contando en texto |
| --- | --- | :-: | :-: |
| `1.005` | `1.005` | ENTRA | ENTRA |
| `8.165` | `8.165` | ENTRA | ENTRA |
| `0.1+0.2` | `0.30000000000000004` | **RECHAZA** | **RECHAZA** |
| `1.0000000000000002` | `1.0000000000000002` | **RECHAZA** | **RECHAZA** |
| `0.4567` (límite) | `0.4567` | ENTRA | ENTRA |
| `1.23456` | `1.23456` | **RECHAZA** | **RECHAZA** |

Se usa **`multipleOf`** —el mecanismo de zod, no uno fabricado aquí— y los tres casos trampa
quedan **fijados en el test**: `1.005` y `8.165` entran (tienen 3 decimales *escritos*, y tres
caben en cuatro) y `0.1+0.2` se queda fuera, que es exactamente la basura **calculada** que esta
puerta existe para parar.

## 7 · Los rojos · commit de resguardo `4f6ae14fd61977b88038103be7818252625a4860`

| # | Qué se rompe | Qué cae |
| :-: | --- | --- |
| 1 | se quita la acotación del precio (el defecto de hoy) | **4**/8 · y el suelo nombra la línea: `schemas.ts:80 price: z.number().nonnegative().optional()` |
| 2 | el IMPORTE se acota a 4 | 2/8 · «un importe no es un precio» |
| 3 | el PRECIO se aprieta a 2 | **4**/8 · `ACOTAR HA RECHAZADO UN PRECIO VÁLIDO: 0.4567 … el cable del electricista` |

El rojo 3 es el control negativo que pediste: **si al apretar se cae un caso real, el arreglo está
mal**. Cae, y lo dice con el caso.

## 8 · Un hallazgo del camino, sobre mi propio instrumento

El censo que escribí para el PASO 0 buscaba cadenas que empezaran por `z.`. Al envolver los cinco
sitios en `conDecimales(…)`, **se declaró ciego él solo**: «cero validaciones de dinero». Fue el
suelo haciendo su trabajo — y también la prueba de que un censo que sólo conoce la forma vieja mide
el árbol de ayer. El del test reconoce **las dos formas**.

## 9 · Lo que NO se ha tocado

Ningún `ALTER` —son campos JSON validados por zod, no columnas— · `Product.price` y `Product.cost`
(su convención ya estaba decidida) · el camino de emisión: **medido**, no usa zod en absoluto y lee
`Number(l?.price ?? 0)` del JSON ya guardado, así que esta puerta está aguas arriba (regla 38, no
es STOP) · **SCRUM-624 no se arregla aquí**: entró en `main` (`2c161c38`) y arregla el impreso-vs-
guardado aguas abajo; esto cierra la puerta por la que el dato nacía torcido.

## 10 · Huecos declarados

1. **No he medido staging ni producción.** No puedo saber si hay ya datos guardados con más de 4
   decimales. Si los hay, **no se corrigen** — y si pertenecen a un documento emitido, regla 29.
2. **Esto acota la PUERTA, no lo ya guardado.** Un `Quote.lines` viejo con 8 decimales sigue como
   está y esta validación no lo toca.
