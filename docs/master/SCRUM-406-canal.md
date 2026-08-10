# SCRUM-406 (arreglos) · un canal prometido existe, y un «escríbenos» tiene destino

**Fecha:** 10-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `08f0445315cbbee52aa6cb878a5b9fef5a9d6bc1`
**Viene de:** la medición de [SCRUM-406](SCRUM-406.md) y las decisiones ①②③④ del fundador.

## ① Se retira la promesa del WhatsApp — HECHO

`precios.html:86` y `plansView.js:106` decían **«Soporte por email y WhatsApp»**. Ese WhatsApp no
existe en el código: ningún `wa.me` del producto apunta a YaQu. **Se retira la mención, no se
reescribe la frase** — retirar no es escribir microcopy, así que no espera aprobación.

Estaba en la página de **precios**: formaba parte de lo que alguien paga.

## ③ El «escríbenos» del Libro registro lleva destino — HECHO

`libroRegistroView.js` avisaba *«No los tomes por cero: escríbenos y los revisamos»* **sin dirección
y sin enlace**, en la pantalla fiscal. Ahora el aviso lleva `hola@yaqu.app` como enlace `mailto:`.

Dos decisiones de implementación que no son de gusto:

* **El enlace es un NODO aparte, no va cosido dentro del texto.** El copy de esa pantalla sigue
  siendo `[PENDIENTE microcopy oficial]`: el día que se apruebe puede no llevar la palabra
  «escríbenos», y un enlace enganchado a una palabra concreta se rompería **en silencio**.
* **El enlace enseña la dirección, no solo la lleva en el `href`.** Si el `mailto:` no abre nada
  —móvil de trabajo sin correo configurado— al menos queda la dirección a la vista. Hay una
  aserción para esto.

## ② El «?» que se oculta con un modal — NO SE HA HECHO, y el motivo está medido

**No es una línea.** `styles.css:2173` viene de **feedback tuyo del 6-jul** («el botón flotante "?"
no debe pisar las modales») y hace **dos** cosas: sube `.modal-overlay` a `z-index: 500` y oculta el
FAB (que vive en 350).

| Lo medido | Consecuencia |
| --- | --- |
| overlay `z-index: 500` > FAB `350` | **Borrar solo la línea del `display:none` deja el botón DETRÁS del backdrop**: sigue sin poder pulsarse. Arreglo hueco. |
| `@media (max-width: 639px)`: el modal es **hoja inferior, full-width, hasta `90vh`** | Subir el FAB por encima del overlay lo pone **encima del botón primario de la hoja** — el mismo «Firmar» que SCRUM-412 acaba de agrandar. |
| Sitio libre en móvil con hoja al `90vh` | 10 vh: **64 px** en 360×640, **56,8 px** en 320×568. Un FAB de 48 px arriba a la derecha cabe con 8 px… o con 0,8 px. |
| `signaturePad.js` **no usa `.modal-overlay`** | Se monta su propio overlay inline a **`z-index: 1200`**. Ahí la regla del CSS **ni interviene**: el FAB queda detrás igual. Un arreglo en esa regla **no toca la pantalla de firma**. |

**Por qué paro:** el arreglo literal es hueco, y el que sí se ve tapa el botón de firmar en el móvil
—que es justo el usuario del ticket, «un profesional en mitad de una obra»—. Enviar eso sería
deshacer con CSS lo que 412 acaba de proteger.

**Lo que propongo** (es colocación de UI, o sea decisión de producto): que la ayuda **viva dentro
del modal**, un «?» en la cabecera junto a la «×», en vez de un botón flotante peleándose con la
hoja. Cubre también el caso de la firma, que por su `z-index` propio ningún arreglo del CSS alcanza.
Va con su rojo, en su ticket, cuando lo decidas.

## ④ Rastro de que el mensaje existió — NO construido, como pediste

## El guard

`tests/scrum406-canal-prometido-existe.test.mjs` — 5 tests. La regla **no es «prohibido decir
WhatsApp»**: es que **lo prometido y lo que existe no se separen**. `CANALES_QUE_EXISTEN` declara
qué canales hay; el día que exista un WhatsApp de soporte se pone a `true` y la promesa vuelve a ser
legítima sin tocar la regla.

Y el `whatsapp: false` **está medido, no declarado de memoria**: un test recorre los `wa.me` del
dashboard y exige que cada uno diga **de quién es el número**. Si aparece uno sin declarar, el rojo
pregunta si es el de YaQu — porque si lo fuera, el canal existiría.

Rojos probados, **confirmando primero que la mutación llegó a aplicarse**:

| Inyección | Cae |
| --- | --- |
| se vuelve a prometer el WhatsApp en `precios.html` | `🔴 el producto no promete un canal que no existe` |
| se le quita el `mailto` al aviso del libro | `🔴 «escríbenos» del Libro registro lleva destino` |
| aparece un `wa.me` nuevo sin declarar | `🔴 whatsapp: false está MEDIDO, no declarado de memoria` |

### Dos veces se acusó el instrumento a sí mismo

1. **Auto-referencia.** El buscador de `wa.me` marcó `plansView.js`… y lo que había allí era **mi
   propio comentario diciendo que NO hay `wa.me`**. Se lee el código **sin comentarios**.
2. **CRLF.** El recorte de comentarios `^\s*//.*$` **no casaba nada**: el repo tiene finales de
   línea de Windows y en JS **`.` no casa `\r`**, así que `.*$` no llega al final y la línea queda
   intacta. Con eso, el guard volvía a citarse a sí mismo. Se parte por `\r?\n`.

Las dos las cazó el propio rojo, no una revisión: **un rojo que no se pone rojo es indistinguible de
uno que pasa.**
