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

## Fuera de alcance (no medido / no tocado)
- **B2 (11-14) analítica/visitas:** no hay instrumentación de analítica de terceros en la landing
  (solo `localStorage` de atribución). Medir visitas/origen del tráfico **[NO SE PUEDE MEDIR HOY]**
  sin un panel de analítica, que no existe. No se construye (fuera de alcance).
- **B3 (15-18) precio real / cobros:** **[NO SE PUEDE MEDIR HOY]** — exige Stripe y cobros REALES de
  producción, que no se tocan ni en lectura.
- **B4 (19):** pregunta de producto, no de código.
- No se cambió nada de la landing (ni una palabra, ni el contador, ni el precio).
