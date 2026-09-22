# Literales de la web que prometen cobro por YaQu — lote único para firmar

**Fecha:** 22-sep-2026 · **Autor:** J4 (SCRUM-1086) · **Medido contra:** `origin/main` = `763d37e5225ea4897827b1a997e34cf5e117c5c3`

> Javier va a firmar una vez, no seis. Este documento junta TODO lo que hoy queda en la web
> prometiendo un cobro que YaQu no puede prestar — para que se firme (o se decida) de un tirón.
>
> **Por qué es falso, en una frase:** con `INVOICING_ES_ENABLED` en OFF para España (regla 24,
> SCRUM-612), **YaQu no cobra a los clientes del profesional, de ningún tipo** — ni tarjeta, ni
> Bizum, ni transferencia. Esto es independiente de VeriFactu: no es una promesa fiscal, es una
> promesa de PAGO, y hoy es falsa para cualquier merchant español real. Nada de lo que sigue
> menciona VeriFactu ni lo activa.
>
> **Qué NO cubre esto:** el H1, el subtítulo del hero y `<title>`/`og:title`/`twitter:title` de
> `index.html` — bloqueados aparte, dependen de V0-6 (ver `docs/master/SCRUM-1016.md`, entrada
> SCRUM-1016c). **No se aplica nada** de lo que sigue a `public/` ni a `docs/YAQU_MASTER.md`: es
> propuesta para que Javier firme y J3 (código) o un jefe (máster) lo apliquen después. Copy
> fiscal/de producto — la delegación de J4 excluye lo legal.

---

## A · Las 13 líneas de SCRUM-1016c, revalidadas hoy — sin cambios, se traen tal cual

Propuestas por esta misma sesión el 22-sep-2026 por la mañana (`docs/master/SCRUM-1016.md`,
entrada SCRUM-1016c, PR #1653 ya mergeado). **Comprobado HOY, letra por letra, contra
`origin/main` = `763d37e5...`: las 13 siguen exactamente en el mismo fichero y la misma línea,
con el mismo texto.** No se redactan de nuevo — es el mismo trabajo, solo reconfirmado.

### `public/index.html`

| # | fichero:línea | texto de hoy | por qué es falso hoy | literal propuesto |
|---|---|---|---|---|
| 1 | `:7` meta description | *"...tu cliente los firma desde el móvil y te paga con tarjeta, Bizum o transferencia. Clientes, gastos, facturas y bot..."* | promete cobro activo por YaQu | *"...tu cliente los firma desde el móvil. Clientes, gastos, facturas y bot — todo en un sitio."* |
| 2 | `:17` `og:description` | *"...firma desde el móvil y cobro con tarjeta, Bizum o transferencia. Clientes, gastos y facturas..."* | ídem | *"...presupuesto en 30 s y firma desde el móvil. Clientes, gastos y facturas en el mismo sitio."* |
| 3 | `:24` `twitter:description` | *"...presupuesto, firma y cobro desde el móvil..."* | ídem | *"...presupuesto y firma desde el móvil. Y toda la gestión en un sitio."* |
| 4 | `:37` JSON-LD `description` | *"...firma digital del cliente, cobro con tarjeta/Bizum/transferencia y gestión..."* | ídem | *"...firma digital del cliente y gestión de clientes, gastos y facturas."* |
| 5 | `:434` demo animada (beat final, `.ph`/`.l4`) | *"Cobrado, sin perseguir a nadie"* | el beat final del loop muestra un cobro que no ocurre | *"Firmado. Presupuesto cerrado."* |
| 6 | `:609` paso **"3 · Cobra"** | título *"3 · Cobra"* + *"Tarjeta, Bizum o transferencia — él elige, tú cobras. Los pendientes se reclaman solos."* | el tercer paso del "cómo funciona" es un cobro que hoy no existe por YaQu | título *"3 · Organiza"* + *"Clientes, gastos y trabajos en un mismo sitio — sin post-its ni Excel."* |
| 7 | `:759` FAQ, resp. 1 | *"...el tuyo no firma, no cobra y no persigue al que no contesta..."* | ídem | *"...el tuyo no firma ni lleva el seguimiento solo..."* |
| 8 | `:761` FAQ, resp. 3 | *"Todo: presupuestos, firma y cobro, más clientes, proveedores..."* | ídem | *"Todo: presupuestos y firma, más clientes, proveedores, productos, gastos, informes y equipo."* |
| 9 | `:767` CTA final | *"...cierran más trabajos y cobran sin perseguir pagos."* | ídem | *"...cierran más trabajos sin perseguir presupuestos."* |

### `public/precios.html`

| # | fichero:línea | texto de hoy | por qué es falso hoy | literal propuesto |
|---|---|---|---|---|
| 10 | `:7` meta description | *"...+ 0,9 % solo cuando cobras con tarjeta. Todo incluido."* | comisión sobre un cobro con tarjeta que hoy no existe por YaQu | *"YaQu Pro — 19,90 €/mes (o 199 €/año, sale a 16,58 €/mes). Todo incluido."* |
| 11 | `:62` subtítulo | *"Presupuesta en 30 segundos, envíalo por WhatsApp y cobra antes de empezar."* | ídem | *"Presupuesta en 30 segundos y envíalo por WhatsApp — tu cliente firma desde el móvil."* |
| 12 | `:79` nota de tarifa | *"+ 0,9 % solo cuando cobras con tarjeta. Bizum y transferencia, gratis."* | tarifa sobre un cobro que no existe hoy | **se retira la línea entera**, sin sustituto |
| 13 | `:83` — dentro de lo que el plan INCLUYE | *"Cobro integrado: el cliente paga desde el móvil"* | función enumerada en lo que se está a punto de pagar, y no se puede prestar hoy en España | *"Gestión de trabajos: de presupuesto a albarán, en el mismo sitio"* |

---

## B · 🔴 El demo interactivo completo de `#probar` — no es un literal, es una decisión

**Dónde vive:** `public/index.html:523-601` (sección `<section id="probar">`). Encontrado por J3;
ninguna propuesta anterior lo cubre.

**Qué es:** un iPhone interactivo donde el visitante pulsa un botón verde y recorre 5 pasos: crea
el presupuesto → le llega por WhatsApp → lo firma con el dedo → **elige método de pago (Tarjeta /
Bizum / Transferencia)** → pulsa **"Pagar 961,95 €"** → pantalla final **"¡Cobrado!" / "Ya tienes
tu dinero — sin perseguir a nadie." / toast "Recibido · 961,95 €"** (`:591-595`).

**Por qué es lo más grave de la página:** no es una frase que se lee — es una SIMULACIÓN que el
propio visitante ejecuta con su dedo, paso a paso, hasta ver el dinero "recibido". Ningún literal
de la sección A pesa lo que pesa dejar que alguien viva la demo de un cobro que hoy no puede
prestarse a un merchant español real.

**Opciones, con su pro y su contra — decisión de Javier:**

1. **Retirar la sección entera.**
   - Pro: elimina el riesgo del todo; no queda nada que reinterpretar ni que vigilar si el flujo
     cambia.
   - Contra: se pierde la pieza más persuasiva de toda la landing, y el bloque "Cómo funciona"
     (3 pasos) se queda sin su demo interactivo — pierde peso de conversión.

2. **Marcarla explícitamente como demostración** (p. ej. una etiqueta visible tipo "Vista previa
   del producto — el cobro se activa con Stripe Connect").
   - Pro: conserva el efecto de producto pulido sin afirmar que la función está activa hoy.
   - Contra: un aviso pequeño puede no bastar para neutralizar una simulación de 5 pasos que
     termina en "dinero recibido"; sigue enseñando un flujo de pago que no se puede prestar, solo
     que ahora con una etiqueta al lado.

3. **Condicionarla — recortar el recorrido para que pare en la firma** (pasos 1-3: presupuesto →
   WhatsApp → firma) **y retirar los pasos 4 y 5** (elegir método de pago, "Pagar", "¡Cobrado!").
   - Pro: conserva casi toda la experiencia interactiva, y esa parte SÍ es verdad hoy; es el mismo
     criterio que ya se aplicó en el ítem 6 de la tabla A (sustituir el tercer paso "Cobra" por
     algo real). Deja intacto el paso que el propio guion H2 sí puede prometer: firma por WhatsApp.
   - Contra: exige tocar código (el HTML de los pasos 4-5 y el JS que numera `data-s`/`data-go`),
     no es un cambio de texto; según cómo esté enganchado el contador de pasos, puede ser trivial
     o no — no medido aquí, es trabajo de J3 si Javier elige esta opción.

No hay recomendación de J4 más allá de señalar que la opción 3 es la que sigue el mismo criterio
ya aplicado en el resto del documento (quitar la promesa de cobro, conservar lo que sí es cierto).
La decisión es de Javier.

---

## C · Tres literales nuevos, no cubiertos por SCRUM-1016c

### C1 · El toast del demo animado del hero — "✓ Cobrado · 961,95 €"

**Dónde:** `public/index.html:466`, dentro de la MISMA animación autoplay que el ítem 5 de la
tabla A (`<section class="stage">`, líneas 433-470), pero es un elemento de texto DISTINTO (el
`.paid-toast`, no el `.beat-label`).

**Texto de hoy:** `<div class="paid"><div class="paid-check">✓</div><div class="paid-toast">Cobrado · <span class="amt tnum">961,95 €</span></div></div>`

**Por qué es falso:** aunque el ítem 5 ya corrige la ETIQUETA que rota arriba del todo
("Cobrado, sin perseguir a nadie" → "Firmado. Presupuesto cerrado."), este segundo elemento — el
"toast" verde que aparece sobre el móvil al final de la animación — seguiría diciendo "Cobrado"
con un importe, dejando la animación contradictoria consigo misma si solo se aplica el ítem 5.

**Literal propuesto:** *"✓ Firmado · 961,95 €"* — mismo formato visual (check + importe), coherente
con `.sign-ok` que ya dice "Firmado · Acepto" dos líneas más arriba (`:464`).

### C2 · La tarjeta de precios propia de `index.html` (no la de `precios.html`)

**Dónde:** `public/index.html:747` (lista de lo que incluye el plan) y `:748` (nota de tarifa),
dentro de `<section id="precios">` — una tarjeta de precios PROPIA de la landing, distinta y
paralela a la que ya cubren los ítems 10-13 en `precios.html`. SCRUM-1016c no llegó a mirarla.

| línea | texto de hoy | por qué es falso hoy | literal propuesto |
|---|---|---|---|
| `:747` (un `<li>` de la lista) | *"Cobro con tarjeta, Bizum y transferencia"* | función del plan que hoy no se presta | *"Recordatorios automáticos de firma"* — sustituye por una función real y ya viva (el envío por WhatsApp con recordatorio, ya citado en `precios.html:82`), y no repite ningún otro `<li>` de la misma lista |
| `:748` nota de tarifa | *"Solo si cobras con tarjeta: 0,9 %. Bizum y transferencia: 0 €."* | tarifa sobre un cobro que no existe hoy | **se retira la línea entera**, mismo criterio que el ítem 12 de la tabla A |

### C3 · La respuesta del FAQ sobre "dos botones — Firmar y Pagar"

**Dónde:** `public/index.html:760` (tercera pregunta del FAQ — la tabla A ya cubrió la 1ª en `:759`
y la 3ª en `:761`, pero esta, la 2ª, quedó fuera).

**Texto de hoy:** *"¿Mis clientes tienen que instalar algo? Muchos son mayores."* → *"Nada. Les
llega un WhatsApp normal con un enlace: lo abren, ven el presupuesto y tienen dos botones —
Firmar y Pagar. Y si prefieren transferencia de toda la vida, también vale."*

**Por qué es falso:** promete un botón "Pagar" activo y nombra la transferencia como vía de cobro
alternativa — las dos cosas son cobro que no existe hoy.

**Literal propuesto:** *"Nada. Les llega un WhatsApp normal con un enlace: lo abren, ven el
presupuesto y lo firman con el dedo."*

---

## D · La categoría de la Parte H2 del máster — cambio de máster, no de `public/`

**Dónde:** `docs/YAQU_MASTER.md:215`, Parte H2 ("Mensaje en dos etapas"). Reportado por la sesión
anterior de J4 (ver traspaso de esa tanda) y sin tocar desde entonces.

**Texto de hoy:** *"Etapa 1 (pre-SIF): categoría = "herramienta para presupuestar, firmar y
cobrar señales por WhatsApp"."*

**Por qué es falso:** la misma línea 215 lleva, justo a continuación, el guion único ante "¿me
vale para VeriFactu?" — reescrito y aplicado esta misma tanda (SCRUM-1016, comentario 16432) —
que dice literalmente *"no emitimos ningún documento de facturación ni cobramos por la app — la
señal la gestionas tú por fuera"*. La categoría de la propia Etapa 1, tres frases antes, sigue
prometiendo justo lo que el guion de al lado acaba de negar. Es la misma familia de contradicción
que motivó la reescritura del guion H2 (SCRUM-534), sin resolver todavía en esta línea concreta.

**Literal propuesto:** *"categoría = "herramienta para presupuestar y firmar por WhatsApp""* — se
retira "y cobrar señales", sin sustituir por nada (no hay una función de cobro que hoy sea verdad
para ponerle nombre).

🔴 **Esto es un cambio de `docs/YAQU_MASTER.md` (Parte H2) — regla 35: no se aplica sin la firma de
Javier, y la aplicación (si se firma) la hace un jefe, no esta sesión.**
