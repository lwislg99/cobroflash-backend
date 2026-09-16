# SCRUM-544 · la barra de anuncio guarda su sitio — y el arbitraje del contador de plazas

**Medido contra:** `origin/main` = `2956da329def11c68bacb140333fa18bfe9e5db8` · 2026-08-20T02:59:44+01:00

**20-ago-2026** · **Carril:** landing · **Gate:** el test corre en `npm test`; el guard de navegador va aparte

---

# TAREA 1 · el arbitraje: dos sesiones dijeron cosas opuestas sobre el contador

| | Lo que dijo |
|---|---|
| **S1** (SCRUM-327 · Q17) | *«el contador “quedan 18 de 20” deriva de `plan='founding'`, que NO es un pago confirmado — prueba social falsa»* |
| **Esta sesión** (informe de F4) | *«SCRUM-330 ya lo dejó bien: cuenta suscripción activa, y con cero vendidas no pinta escasez»* |

**Medido sobre `main` de hoy, y ejecutado, no deducido.**

### ① ¿Qué consulta alimenta `/public/founding-status`?

`src/app.ts:271` → `getFoundingStatus()` en **`src/modules/billing/domain/founding.ts`**, y la
consulta es:

```js
export const PLAZA_OCUPADA = { plan: 'founding', subscriptionStatus: 'active' } as const;
const taken = await prisma.merchant.count({ where: { ...PLAZA_OCUPADA } });
```

**Dos condiciones, no una.** La descripción de S1 —`plan='founding'` a secas— es la del código
**anterior a SCRUM-330**; hoy no es la que corre.

### ② ¿Qué se ve con CERO pagos confirmados? — ejecutado en el navegador

Se sirvió `/public/founding-status` con las tres respuestas posibles y se leyó el DOM (Edge, 4G
emulada, 360 y 390 px):

| respuesta | barra de anuncio | escasez «quedan N plazas» |
|---|---|---|
| `taken: 2, seatsLeft: 18` | visible | **visible** («quedan 18») |
| **`taken: 0, seatsLeft: 20`** | visible (la OFERTA) | 🟢 **OCULTA — no se pinta ningún número** |
| 500 (fuente rota) | oculta | no se pinta nada |

El gate está en `public/index.html`: `pintarPlazas = taken>0 && seatsLeft>0`; si no, se ocultan
`#ann-plazas` y `#founding-plazas`, y la oferta se enseña igual. **Con cero pagos confirmados el
visitante NO lee ninguna cifra de plazas.**

### ③ ¿`plan='founding'` se pone al pagar, o antes? — leído en el webhook

`src/modules/billing/app/routes/stripe.routes.ts`:

* `:77` `checkout.session.completed` → `plan: planId` **y** `subscriptionStatus: 'active'`, juntos.
* `:120-131` `customer.subscription.*` → `active|trialing` → `'active'` · **`past_due|unpaid` →
  conserva `plan` y pone `'past_due'`** · `canceled` → vuelve a `trial`.

**Así que S1 tenía razón en el HECHO que denunciaba:** `plan='founding'` puede existir **sin** pago
confirmado (cobro fallido, o una fila puesta a mano o por un seed, que ni siquiera tiene estado).
**Y por eso SCRUM-330 añadió la segunda condición.**

### 🔴 EL VEREDICTO, y no lo gana nadie por antigüedad

**Las dos afirmaciones son ciertas en momentos distintos, y la de hoy es la mía — pero el mérito es
de S1**: describió el defecto real, SCRUM-330 lo arregló, y la descripción de S1 se quedó
apuntando al código de antes. **No hay escasez engañosa publicada hoy** (art. 5 LCD): con cero
ventas no se pinta ninguna cifra.

**El residuo, que no es de nadie y conviene que no se pierda:** `subscriptionStatus:'active'`
también se escribe para `trialing` (`stripe.routes.ts:120`). Hoy no es alcanzable porque el
checkout founding **omite `trial_period_days`** — pero eso es **configuración de Stripe, no
código**. El propio `founding.ts` lo deja declarado. Si algún día se configura un trial en ese
precio, el contador volvería a incluir a quien no ha pagado, y **el sitio de distinguirlo es
`founding.ts`**. No se toca aquí: es de SCRUM-330 y del fundador.

---

# TAREA 2 · el salto (CLS)

## El defecto

La barra nace `hidden` y se despliega cuando responde `/public/founding-status`. Al desplegarse
**empuja la página entera hacia abajo**, y el visitante ya está leyendo. En un móvil, con el pulgar
en camino a un botón, ese salto es un toque en el sitio equivocado.

## El arreglo, y son ocho palabras de CSS

```css
.announce[hidden]{display:block;visibility:hidden}
```

`hidden` deja de valer `display:none` y pasa a `visibility:hidden`: **la caja sigue ocupando su
sitio desde la primera pintura**, así que al hacerse visible no mueve nada. `visibility` la saca
igual del árbol de accesibilidad y del orden de tabulación.

**Las dos trampas, esquivadas y por qué:**

* **No se retrasa el fetch.** Eso mueve el salto más tarde, que es peor: cuanto más lleva leyendo,
  más caro sale el desplazamiento.
* **No hay ninguna altura a ojo.** El hueco lo calcula el navegador con el contenido REAL a cada
  anchura. Medido en once anchuras con la barra desplegada: **112 px** a 320 y 360 · **91** de 390 a
  600 · **95** a 601 y 700 · **73** a 900 · **44** a 1200. Cinco alturas distintas, y además cambian
  con lo que devuelva el fetch. Corta habría vuelto a desplazar; larga habría dejado hueco en
  blanco en la parte más cara. **Hay un test que impide que alguien le ponga un número.**

## Los cuatro números que se pedían, y son doce

Edge, 4G emulada (9 Mbps / 170 ms), tres casos × dos anchuras, **antes y después**:

| caso | ancho | CLS antes | CLS después |
|---|---|---|---|
| `vendidas` (taken=2) | 360 px | 🔴 **0,386** | 🟢 **0,025** |
| `vendidas` (taken=2) | 390 px | 🔴 0,108 | 🟢 **0,001** |
| `cero` (taken=0) | 360 px | 🔴 0,133 | 🟢 **0,023** |
| `cero` (taken=0) | 390 px | 🔴 0,108 | 🟢 **0,001** |
| `roto` (500) | 360 px | 0,001 | 0,023 |
| `roto` (500) | 390 px | 0,001 | 0,001 |

**Los seis por debajo del límite de 0,1.** Los tres casos porque **un arreglo que solo funciona
cuando el fetch responde no es un arreglo, es suerte** — y porque la barra mide distinto en cada
uno.

**Y el LCP no empeora:** FCP 500-684 ms y **LCP = FCP** en las seis medidas, igual que antes. El
héroe no espera a ningún fetch.

**El residuo, con su número en vez de redondeado a cero:** aparece un **0,023 a 360 px en los tres
casos**, incluido `roto`, que antes era 0,001. Con la barra ya reservada, el que desplaza pasa a ser
otro elemento. Queda cuatro veces por debajo del límite y se deja medido.

## 🔴 El coste, y la decisión que NO es mía

Cuando la barra **no llega a aparecer** —el fetch falla, o no quedan plazas— su sitio queda vacío
arriba: **91-112 px de espacio en blanco** (no una banda verde: con `visibility` no se pinta el
fondo).

| | CLS con la fuente rota | hueco cuando la barra no viene |
|---|---|---|
| **Lo entregado** (reserva permanente) | **0,023 / 0,001** | 91-112 px en blanco |
| Alternativa (soltar la reserva) | vuelve a desplazar | ninguno |

**Se entrega la primera porque la verificación exigía que funcione también con la fuente rota.**
Elegir entre las dos es del fundador: la barra es suya (regla 30 + A22) y el caso «no quedan
plazas» es de SCRUM-330.

## Verificación

* **`tests/scrum544-reserva-barra-anuncio.test.mjs`** (5, sin gate) — vigila el mecanismo: que la
  reserva exista, que oculte con `visibility` **y no** con `display`, que **no lleve altura a mano**,
  que el interruptor siga siendo `hidden` (si el JS pasara a `display` o a una clase, la regla CSS
  seguiría ahí **sin gobernar nada** y el salto volvería en silencio) y que `#ann-plazas` /
  `#ann-left` sigan separados como los dejó SCRUM-330.
* **SUELO, en los dos sitios.** En el test: si no encuentra las reglas de `.announce`, se declara
  ciego. En el guard de navegador: si no consigue **leer** el CLS —sin observador, sin entradas—
  sale por **«NO SUPE MIRAR» con código 2**, porque un 0 de un medidor roto se lee exactamente igual
  que una página perfecta.
* **`npm run guard:cls-barra-anuncio`** — el árbitro real, fuera de la suite (misma decisión que
  `guard:contraste` y `guard:caja-avisos`). Levanta su propio servidor con el `http` de Node: **sin
  dependencias nuevas** (regla 36).

### 🔴 El rojo por el mecanismo, con su SHA

Con la rama **ya commiteada** en `e8809e88` y el árbol limpio, se desactivó la regla de la reserva.
**Cayeron las dos redes**, y el guard **nombrando el CLS medido**:

```
🔴 vendidas  360 px · CLS 0.386   🔴 cero  360 px · CLS 0.133
🔴 vendidas  390 px · CLS 0.108   🔴 cero  390 px · CLS 0.108
🔴 4 medición(es) por encima del límite          (código de salida 1)

✖ SCRUM-544 · 🔴 la barra RESERVA su sitio: `hidden` no la saca del flujo
  🔴 NO ESTÁ LA RESERVA … CLS 0,386 a 360 px y 0,108 a 390, contra un límite de 0,1.
```

Restaurada con la edición inversa —**no con `git checkout --`**—, verde otra vez.

## Ficheros

`public/index.html` (la regla + su porqué) · `scripts/guard-cls-barra-anuncio.mjs` (nuevo) ·
`tests/scrum544-reserva-barra-anuncio.test.mjs` (nuevo, 5) · `package.json` (el script, con su `//`).

**Lo que NO se toca:** el texto de la barra (regla 30 + A22) · la lógica de qué cuenta como plaza
(`founding.ts` **intacto**, SCRUM-330) · el JS del contador · `public/precios.html`, que tiene su
propio banner y su propio `pintarPlazas` — **no se ha medido su CLS y queda declarado como no
medido** · el héroe en propuesta de F4 (SCRUM-331, en revisión).

## Tanda

**3.727 tests · 3.650 pass · 0 fail · 77 skipped.**
