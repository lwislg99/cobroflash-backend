# SCRUM-327 · F0 BLOQUE 1 (preguntas 1-10): medición de `public/index.html`

**Fecha:** 4-ago-2026 · **Carril:** B (QA/medición) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `be3a2012ceaa389f9d9466be5a20499bfd1e9c99` · 2026-08-04T23:31:23+01:00

> ⚠️ Committer date del commit de esta medición (R14). **Solo lee y cuenta** — cero construcción,
> no se toca la landing. Medido sobre main POST-SCRUM-299 (los 4 textos y el guion H2 ya mergeados).

**SUELO (control positivo):** `presupuesto` = **35** en `index.html` (583 líneas) → la búsqueda LEE el
fichero. (Eran 34 antes del merge de 299; la FAQ del export sumó una.)

---

## 🔴 DEFECTOS VIVOS

### Q10 · RGPD/ePrivacy — almacenamiento no esencial SIN consentimiento, y NO se puede rechazar
- **NO hay banner de cookies/consentimiento** en `index.html` (0 `cookie`/`consent`/`rechazar`).
- Pero se escribe `localStorage` de **atribución de marketing** (UTM + `ref`) de forma
  **INCONDICIONAL** al aterrizar: `index.html:565-577` → `localStorage.setItem('yaqu_ref', …)` y
  `localStorage.setItem('yaqu_src', …)`. No hay tracking de terceros (0 GA/pixel/plausible), pero
  esto es almacenamiento en el dispositivo para un fin **no estrictamente necesario**.
- **Consecuencia medida:** la pregunta del ticket —«¿rechazar es tan fácil como aceptar?»— **no
  tiene respuesta posible: no hay dónde rechazar.** El almacenamiento ocurre igual.
- **Base legal (ePrivacy Art. 5.3 / RGPD):** el almacenamiento/acceso a información en el equipo del
  usuario que NO sea imprescindible para el servicio pedido exige **consentimiento previo**. La
  atribución de marketing no es imprescindible para que la landing funcione.
- **Mido los hechos, no dicto la calificación legal** — pero los hechos apuntan a un defecto vivo de
  los que «muerden». Es de los que el ticket esperaba en Q10.

### Q17 · El contador «quedan 18 de 20» cuenta un CAMPO, no ventas — prueba social FALSA
- El endpoint `/public/founding-status` deriva `seatsLeft` de
  `prisma.merchant.count({ where: { plan: 'founding' } })` (`src/modules/billing/domain/founding.ts:9`):
  cuenta **merchants con el CAMPO `plan='founding'`**, NO pagos confirmados ni suscripciones activas.
- `taken = 2` → «quedan 18 de 20» le dice al visitante que **2 profesionales ya compraron**. Pero
  `plan='founding'` no equivale a «pagó»: un merchant puede tener ese campo sin cobro confirmado
  (y el fundador ha declarado que las cuentas de producción de hoy son falsas y que **hoy hay CERO
  clientes pagando**). El propio fichero dice «contador REAL … prohibido fake» (`founding.ts:2`) — y
  aun así la métrica que eligió (el campo `plan`) NO distingue pagado de asignado.
- **Es la diferencia entre un dato y una afirmación falsa en material público:** una prueba social
  («2 ya compraron») que hoy no es cierta. Defecto vivo.

---

## Las diez, medidas ([MEDIDO], fichero:línea)

1. **Contador de plazas — [MEDIDO], NO es defecto.** Hace `fetch('/public/founding-status')`
   (`:555`), lee `s.seatsLeft` (`:556`), y **solo muestra** el anuncio (`:295`, `hidden` por
   defecto) y el banner founding (`:480`, `hidden`) si `seatsLeft>0` (`:560`); en fallo (`.catch`,
   `:562`) o `0`, quedan **ocultos**. El «quedan – plazas» con guion (`:298`, `:480`) es el
   *placeholder* del fuente DENTRO de un elemento oculto — **no se renderiza**. (No verifico el
   render en producción — sin acceso — pero el código está bien guardado.)
2. **Demo animada del héroe — [MEDIDO].** Mockup de móvil `.phone` (`:140`) con escena animada por
   CSS (`.stage`, `.beat-label`). Presente.
3. **Demo «Pruébalo tú» — [MEDIDO].** `:373` «Haz el recorrido completo, paso a paso», con **13**
   `try-step` (recorrido presupuesto→pago). Presente.
4. **«Seis herramientas» — [MEDIDO].** `<section id="todo">` (`:462`), `<h2>Seis herramientas. Una
   sola app.</h2>` (`:464`), eyebrow «Todo en uno». La sección existe (no conté las 6 tarjetas una a
   una).
5. **FAQ — [MEDIDO]: 5 items** (`<details>`): (1) «Ya mando presupuestos por WhatsApp gratis. ¿Para
   qué esto?» · (2) «¿Mis clientes tienen que instalar algo? Muchos son mayores.» · (3) «¿Sirve para
   llevar todo mi negocio o solo presupuestos?» · (4) «¿Me vale para VeriFactu?» (guion H2, `:498`) ·
   (5) «¿Y si un día lo dejo?».
6. **Meta OG/Twitter — [MEDIDO], completas.** OG `:13-18` (type/site_name/locale/title/description/
   url) + Twitter card `:22-25` (`summary_large_image`, title, description, image). Sin defecto.
7. **Vídeo de 60 s — [MEDIDO]: NO existe elemento de vídeo** (0 `<video>`/youtube/vimeo/`.mp4`). El
   «hueco del vídeo» es real: el héroe usa la **demo animada** (Q2) en su lugar. Que sea hueco o
   decisión de diseño es de producto; lo medido es que no hay vídeo.
8. **«factura» / «VeriFactu» — [MEDIDO].** «factura*» aparece 8 veces (`:7`, `:17`, `:37`, `:317`,
   `:365`, `:495`, `:498`, `:499`), **todas mención de categoría** — **0 promesas** (la limpieza de
   299 aguanta; **no hay una cuarta promesa**). «VeriFactu»: **2** — el guion H2 (`:498`) y un
   **badge de confianza** «Facturación VeriFactu en certificación» (`:365`). ⚠️ **Lo señalo:** el
   `:365` es una afirmación de VeriFactu FUERA del guion H2 (repite la frase «en certificación» que
   el guion sí aprueba, pero como badge autónomo). No lo declaro defecto —repite lo aprobado— pero
   es un claim de VeriFactu no gobernado por la pregunta H2; ojo del fundador (regla 26).
9. **Botón de WhatsApp — [MEDIDO]: NO hay deep-link** (`wa.me`/`api.whatsapp.com` = **0**). Los CTA
   van a `/register.html` («Empieza gratis», `:307`, `:318`). Los botones con estilo WhatsApp
   (`:398`, `ibtn--wa`) son de la **demo** (`type="button" data-go`). Signup-first es un patrón de
   producto, no necesariamente defecto; lo medido es que el «botón de WhatsApp» de la landing no
   abre WhatsApp.
10. **Legal / cookies — ver DEFECTOS VIVOS (Q10).** Footer con enlaces a `/privacidad` y `/terminos`
    (`:506`). Sin banner de cookies.

## Textos del ticket que ya no existen (el ticket se escribió antes del merge de 299)
- Las tres **promesas de «factura»** que el ticket pudiera citar (`:380` «Recibe la factura», `:424`
  «tu factura», `:433` «Factura #F-128`) **ya no están**: 299 las cambió a «Recibe el enlace de
  pago», «Ya puedes pagar cuando quieras» y «Reforma de baño». Medido en main actual.

## Bloque 3 · El precio (Q15-18) — [MEDIDO], salvo Q16
**SUELO:** cifras de precio detectadas — `index.html` 27 · `precios.html` 9. La búsqueda LEE.

**Q15 · ¿Qué precio rige? Las superficies COINCIDEN; el máster A22 DIVERGE.**
- `public/index.html`: Pro **19,90 €/mes** (`:482`) · founding **9,90 €/mes** «para siempre» (`:297`,
  `:480`) · anual 199 €/16,58 (`:486`).
- `public/precios.html`: Pro **19,90** (`:7`, `:73`, `:74`) · founding **9,90** «de por vida» (`:65`)
  · anual 199/16,58 (`:77`).
- **Panel Planes del dashboard** (`public/dashboard/js/plansView.js:7`): `fetch('/admin/billing/plans')`
  → `{ plans, founding }` del backend; la cifra founding **DERIVA de una constante del backend**
  `FOUNDING_PRICE = 9.9` (`src/modules/billing/domain/founding.ts:6`), no del front ni de Stripe.
- **Stripe (solo el árbol, sin llamarlo):** el CARGO usa price ids — Pro por env
  `STRIPE_PRICE_ID_PRO` / `STRIPE_PRICE_ID_PRO_ANNUAL` (`src/core/config/env.ts:18-19`, **solo nombres
  de clave**); founding por `lookup_key` `'yaqu_founding_monthly'` (`stripePrices.ts:14`, o `null →
  501` sin Stripe). **El IMPORTE real (19,90/9,90) NO está en el árbol: vive en Stripe.** Lo que el
  árbol declara es TEXTO (landing) y una constante de DISPLAY.
- **Qué diverge:** `index.html` ↔ `precios.html` ↔ panel **COINCIDEN** (19,90 / 9,90). El **máster
  A22** («29 € / founding 14,50») **DIVERGE** de las tres — stale (y `precios.html:117` aún comenta
  «el 29 tachado»). **NO es un defecto publicado** (A22 es interno; lo que el usuario ve es
  consistente). El riesgo de «lo descubre pagando» real es: importe mostrado (constante/texto) vs el
  de Stripe **no confirmable sin Stripe** (ver Q16).

**Q16 · ¿Se ha cobrado 19,90 alguna vez?** **[NO SE PUEDE MEDIR HOY — exige producción/Stripe, fuera
del carril B].** Hueco declarado para el fundador.

**Q17 · Qué cuenta «quedan 18 de 20» → ver DEFECTOS VIVOS.** Cuenta `merchant.count({plan:'founding'})`
(el campo), no pagos.

**Q18 · «de por vida» y qué pasa en la plaza 20 — [MEDIDO]: SÍ está escrito.**
- «de por vida» definido en `docs/legal/ALCANCE_BETA.md:38`: «9,90 €/mes DE POR VIDA (mitad del precio
  de lista, 19,90) **mientras mantengas la suscripción activa**». Servido en `/legal/alcance-beta`
  (`legalPages.routes.ts:96`) y **aceptado ANTES del checkout founding** (regla 25,
  `subscriptions.routes.ts:43`).
- Plaza 20 (agotado): la oferta se cierra — checkout founding → `409 founding_sold_out`
  (`subscriptions.routes.ts:79`); banner oculto (`precios.html:119`, `plansView.js:40`).
- Matiz (no defecto): la landing dice «para siempre» SIN el matiz «mientras mantengas la suscripción»;
  el término vinculante (con el matiz) está en el doc aceptado en el checkout, no en la landing.

## Bloque 4 · Comprador consumidor vs empresario (Q19) — [MEDIDO]
**Se mide una vez y sirve a SCRUM-287 (A0) y SCRUM-321 (E0). Copiable entero:**
- **El COMPRADOR de YaQu (el merchant/pro) NO se clasifica consumidor-vs-empresa.** No hay campo
  `isConsumer`/`buyerType`/tipo-comprador en el modelo `Merchant`. YaQu es B2B por naturaleza (se
  vende a oficios/profesionales). El valor `plan='empresa'` (`schema.prisma:67`,
  «trial|basic|pro|empresa») es un **TRAMO de plan** (Equipo), NO una clasificación del comprador.
- **El CLIENTE FINAL del pro SÍ se clasifica `PARTICULAR | EMPRESARIO`** (`schema.prisma:157-161`,
  SCRUM-69/FACT-1): determina el plazo legal de la recapitulativa (art. 13 RD 1619/2012); `null` =
  «nunca clasificado» → tratado como PARTICULAR (plazo más corto) en `resolveTipoDestinatario`. Es
  sobre los clientes del pro, NO sobre quién compra YaQu.
- **Consecuencia para A0/E0:** el producto distingue consumidor/empresa AGUAS ABAJO (clientes del
  pro, fin fiscal), pero NO en el COMPRADOR de la suscripción. Si un comprador fuera consumidor (no
  autónomo/empresa), la protección de consumidores (p. ej. derecho de desistimiento) aplicaría a su
  suscripción y **hoy el sistema no puede distinguirlo** — no hay campo. Dato medido, sin juicio.

## Fuera de alcance (no medido / no tocado)
- **Q16 y «cobros reales»:** [NO SE PUEDE MEDIR HOY] — producción/Stripe, no se tocan ni en lectura.
- **B2 (11-14) analítica/visitas:** sin instrumentación de analítica de terceros (solo `localStorage`
  de atribución, ver Q10). Visitas/origen [NO SE PUEDE MEDIR HOY]; no se construye.
- No se cambió NADA de la landing (ni una palabra, ni el contador, ni el precio). Reglas 26/30 vivas.

---

# SCRUM-327 · RE-VERIFICACIÓN Y BLOQUE 2 (sesión 4)

**Fecha:** 5-ago-2026 · **Carril:** B (medición) · **Gate:** sin gate — solo lee
**Medido contra:** `origin/main` = `de6abbd325419a9e85d60cf13b1588596125d66b` · 2026-08-05T09:13:00+02:00

> **Por qué hay una segunda medición y no una segunda entrada.** La de arriba se midió contra
> `be3a201`, cuando `index.html` tenía **583 líneas**; hoy tiene **572** y entre medias entraron
> SCRUM-336 y SCRUM-341 **sobre ese mismo fichero**. Una medición no caduca por vieja, caduca
> porque su objeto se movió — y las tres preguntas urgentes son de cosas **publicadas**. Se
> re-verifican aquí, y lo que ya estaba bien medido **no se reescribe**.
>
> **SUELO:** `presupuesto` = **32** apariciones en `index.html` → la búsqueda lee el fichero.
> (Eran 35 en la medición anterior; bajó con 336/341, que es la prueba de que el objeto se movió.)

## Las tres urgentes, re-medidas hoy

**Q8 · «factura» ×8, «VeriFactu» ×2 — mismos anclajes que la medición anterior. Aguanta.**
Las ocho de «factura*» son **mención de categoría**, no promesa: `:7`, `:17`, `:37` («Clientes,
gastos, facturas y bot…» en meta/OG/JSON-LD), `:317` y `:495` («llevas clientes, gastos y
facturas»), `:499` («se exportan en CSV»). Las dos de VeriFactu: el guion H2 en la FAQ (`:498`) y
**el badge de confianza `:365`**.

> 🔴 **LO QUE DECIDE EL FUNDADOR HOY — el badge `:365`.** Texto exacto:
> **«Facturación VeriFactu en certificación»**, en la fila de credenciales junto a «Firma con
> evidencia…», «Hecho en Madrid» y «Sin permanencia». La medición anterior lo señaló y **no lo
> declaró defecto** porque repite una frase que el guion H2 sí aprueba. Lo re-mido y **añado el
> matiz que lo hace decisión y no detalle**: la regla 26 dice que la pregunta de VeriFactu **se
> responde SOLO con el guion H2** — y un badge no responde a nadie: **ofrece** el claim, sin que
> nadie lo haya preguntado, y en el sitio de la página donde se ponen las credenciales. Es la
> diferencia entre contestar con honestidad y **usarlo como argumento de venta**.
> **No lo califico yo.** Es regla 26 y es del fundador: hoy.

**Q17 · el contador es más flojo de lo que decía la medición anterior, y ahora está derivado.**
`getFoundingStatus` cuenta `merchant.count({ where: { plan: 'founding' } })`
(`src/modules/billing/domain/founding.ts:9`). Rastreando **quién ESCRIBE** ese campo —el webhook de
Stripe, `src/modules/billing/app/routes/stripe.routes.ts:110-124`— el campo queda en `'founding'` en
**tres** situaciones, no una:

| Estado de Stripe | Qué hace el webhook | ¿Ha pagado? |
|---|---|---|
| `active` | `plan: planId`, status `active` | **sí** |
| `trialing` | `plan: planId`, status `active` (`:110`) | **NO — aún no se ha cobrado nada** |
| `past_due` / `unpaid` | `plan: planId` **se CONSERVA**, status `past_due` (`:123`) | **NO — el cobro falló** |

O sea: **«quedan 18 de 20» dice al visitante que 2 profesionales ya compraron, y el dato que hay
debajo es cierto también para una prueba sin cobrar y para un pago fallido.** La medición anterior
decía «cuenta el campo, no pagos»; esto dice **cuáles** son los otros dos casos y con qué línea.
Sigue siendo **defecto vivo**, y el mecanismo para arreglarlo existe al lado: `subscriptionStatus`
distingue `active` de `past_due`, y el contador no lo mira.

**Q16 · ¿se ha cobrado 19,90 alguna vez? [NO SE PUEDE MEDIR HOY]** — y conviene decir **por qué no
es pereza**: el importe **no está en el árbol**. El cargo Pro sale de un price id de Stripe
(`STRIPE_PRICE_ID_PRO`, `src/core/config/env.ts`), así que ni el precio real ni los cobros son
visibles desde el repo. **Quien puede contestarla en dos minutos es el fundador**, en el panel de
Stripe: pagos con importe 19,90 €. Mientras no se conteste, el tachado sigue siendo un precio de
referencia **no verificado**.

## BLOQUE 2 · el embudo — **y el resultado es que no hay embudo que medir**

El ticket avisaba de que este bloque podía devolver «no hay tráfico suficiente». La medición
devuelve algo **más fuerte y más simple**:

**Q11 · [MEDIDO] Instrumentación de analítica: CERO.** Barrido de `public/` entero buscando
`gtag`, `google-analytics`, `googletagmanager`, `plausible`, `matomo`, `fathom`, `posthog`,
`hotjar`, `clarity`, `fbq`, pixel de Facebook, `mixpanel` y `segment`: **ninguna coincidencia**
(los únicos aciertos son un comentario de código y tres binarios de imagen). Y **no hay modelo de
visitas en el schema** (`Visit`/`PageView`/`Analytics`: ninguno).

**Q12 · visitas de yaqu.app — [NO SE PUEDE MEDIR HOY].** No es que sean pocas: **no se cuentan en
ningún sitio**. No hay dato que consultar, ni en el repo ni en la BD.

**Q13 · origen del tráfico — [NO SE PUEDE MEDIR HOY] para las visitas, PARCIAL para los registros.**
`Merchant.acquisitionSource` existe (`prisma/schema.prisma:71`, V0-3) y guarda la atribución
capturada **en el registro**. Así que del que **se registra** sí consta de dónde vino; del que
**visita y se va**, nada.

**Q14 · registros que salen de esas visitas — [NO SE PUEDE MEDIR HOY].** El numerador (registros)
es consultable en producción; el denominador (visitas) **no existe**.

> 🔴 **LA CONSECUENCIA, que es el resultado del bloque.** No estamos ante «hay poco tráfico»:
> estamos ante **no hay instrumento**. La conversión visitas→registro es **estructuralmente
> inmedible hoy**, así que el Bloque F no puede priorizarse con evidencia: exactamente lo que el
> ticket predijo — *«la landing no convierte» y «nadie la ha visto» van a ser el mismo número*.
>
> **Lo que esto implica para el orden de trabajo, y es decisión del fundador:** rehacer secciones
> de la landing **no se puede evaluar** después. Antes de rehacer, o se pone un instrumento (una
> línea de analítica respetuosa, que además arrastra la decisión de consentimiento de Q10), o se
> acepta explícitamente que el Bloque F se hace **a ciegas y por criterio**, no por datos.

## Lo que esta re-verificación NO cubre

- **No se ha tocado nada.** Ni una palabra de la landing, ni el contador, ni el precio.
- **Q16 sigue abierta** y solo la cierra el fundador con Stripe delante.
- **No he verificado el render en producción**, solo el código servido desde el repo.
- **Las preguntas 1-7, 9, 10, 15, 18 y 19 no se re-miden**: están medidas arriba con sus anclas y
  su objeto no se ha movido en lo esencial. Si alguna importa para una decisión concreta, se
  re-verifica esa, no todas.
