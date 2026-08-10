# SCRUM-406 · dónde está hoy el contacto y a qué llega de verdad

**Fecha:** 10-ago-2026 · **Carril:** B · **Tipo:** MEDICIÓN (no toca código)
**Medido contra:** `origin/main` = `ff5698f723cac97fdd8e3f83baeeaf4e02f2933f` · 2026-08-10T13:02:08+02:00

> Entrada: *«un profesional en mitad de una obra no tiene desde dónde avisarnos: el único contacto
> vive en las páginas legales».* Tres mediciones pedidas: **dónde** está · **a qué** apunta · **si
> lo atiende alguien**.

---

## 🔴 LA ENTREGA, EN LA PRIMERA LÍNEA

**El canal que el producto PROMETE no existe, y del que existe el producto no sabe nada.**

1. **«Soporte por email y WhatsApp» se promete DOS veces** —en `precios.html` y **dentro del
   producto**, en la pantalla de Planes— y **el WhatsApp de soporte no existe en ninguna parte del
   código.** Cero. El dashboard no enseña jamás un número de YaQu.
2. **Ninguna fila, ningún modelo, ninguna ruta registra que llegue un mensaje.** 24 modelos en el
   schema, ni uno de soporte/contacto/incidencia. Ningún destinatario interno (`ADMIN_EMAIL`,
   `SUPPORT_EMAIL`, `hola@` como destino) en todo `src/`. **El producto no puede saber si alguien
   escribió, ni si se le contestó, ni cuánto esperó.**
3. Y hay una pantalla que dice **«escríbenos»** sin dar dónde: ver ⑤.

No afirmo «no lo lee nadie» —eso no lo puedo medir desde aquí y digo abajo quién sí puede—. Lo que
sí está medido es peor de lo que parece: **aunque alguien lo lea, no queda rastro en el producto.**

---

## ① DÓNDE está el contacto hoy

Una sola dirección en toda la superficie: **`hola@yaqu.app`**, en **5 sitios**.

| Sitio | Alcance |
| --- | --- |
| `public/privacidad.html` ×3 (L50, L89, L99) | página legal |
| `public/terminos.html` (L97) | página legal |
| `public/dashboard/js/tutorial.js:232` | **dentro del producto** |

**La premisa tiene un matiz, y a la vez es peor de lo que dice:**

* **Matiz:** sí hay una puerta dentro del producto. `app.js:394` monta un **botón flotante «?»**
  (48 px, abajo a la derecha) en **todas** las pantallas del dashboard → abre el cajón «Guía de
  inicio» → tras 3 acordeones, al final del panel, el `mailto:`.
* **Pero desde el dashboard NO se enlaza a las legales.** Medido: cero enlaces a `/privacidad` o
  `/terminos` en todo `public/dashboard`. Para el profesional logueado esas páginas **no existen**.
* **Y la puerta desaparece justo cuando hace falta.** `styles.css:2173`:

  ```css
  body:has(.modal-overlay) #tut-help-btn { display: none !important; }
  ```

  **Con cualquier modal abierto, el botón de ayuda no está.** Firmando, editando el albarán,
  cobrando: exactamente los momentos en los que uno se atasca, y exactamente cuando el único
  contacto del producto se oculta.

**Coste real desde una obra:** cerrar lo que tenga abierto → «?» → cajón → bajar → tocar el
`mailto:` → **se abre su cliente de correo**, que en un móvil de trabajo puede no estar configurado.
Y entonces el hilo se va a su bandeja personal, fuera del producto para siempre.

## ② A QUÉ dirección apunta

* **`mailto:hola@yaqu.app`** — es todo. No hay formulario de contacto, ni ruta que lo reciba, ni
  `wa.me` de YaQu, ni teléfono.
* Los `wa.me` que sí hay en el producto (`homeView`, `jobRailBlocks`, perfil público, landing de
  decisión) apuntan **al cliente final o al PRO** — son del profesional para SU cliente, **nunca a
  nosotros**.
* `WHATSAPP_BOT_PHONE` existe, pero es para *«pedir presupuesto»* desde el perfil público, y
  **`BOT_INBOUND_ENABLED` está en `false`** (Parte P). No es soporte ni pretende serlo.

## ③ ¿Tiene alguien detrás?

**Lo que está medido:**

| Pregunta | Medición | Resultado |
| --- | --- | --- |
| ¿El dominio puede recibir correo? | DNS `MX` de `yaqu.app` | **Sí** — `route1/2/3.mx.cloudflare.net` (Cloudflare Email Routing = **reenvío** a otro buzón) |
| ¿El producto registra que llegó algo? | 24 modelos del schema | **No.** Ni uno de soporte/contacto/ticket/incidencia |
| ¿Hay ruta que reciba correo? | rutas de `src/` | **No.** El único webhook entrante es `/webhooks/whatsapp`, y es el bot del PRO |
| ¿Se avisa a alguien de YaQu? | `ADMIN_EMAIL`/`SUPPORT_EMAIL`/`hola@` en `src/` | **Ningún destinatario interno en todo el código** |
| ¿Desde dónde sale el correo? | `env.ts:39` | `EMAIL_FROM`, por defecto `no-reply@yaqu.local` — **«no-reply», o sea: responder no es el camino** |

**Lo que NO puedo medir desde aquí, y quién puede en 30 segundos:** que `hola@` esté dado de alta
como ruta en Cloudflare Email Routing. Cloudflare **rechaza** las direcciones no enrutadas: si
`hola@` no está en la lista, los correos **rebotan** y el profesional recibe un fallo de entrega.
Comprobarlo exige el panel de Cloudflare — lo mira el fundador. **No lo verifico enviando un correo
de prueba a un buzón real: eso es una acción hacia fuera y no se hace sin permiso.**

> Y ojo con el falso alivio: **que el MX exista no dice que alguien lo lea.** Reenviar a una bandeja
> personal no es atender un canal; es que el canal dependa de que una persona concreta mire el
> móvil. El producto, hoy, **no puede distinguir «contestado en 2 h» de «nunca leído»**.

## ⑤ Hallazgo extra: una pantalla dice «escríbenos» sin decir dónde

`libroRegistroView.js:51` — Libro registro, aviso de importes ilegibles:

> «Hay importes que no se han podido leer (…). No los tomes por cero: **escríbenos** y los
> revisamos.»

**Sin dirección y sin enlace.** Manda avisar en la pantalla de más riesgo del producto —la fiscal—
y no dice por dónde. Un «escríbenos» sin destino enseña lo mismo que un canal que no contesta.

---

## Lo que propongo (NO escrito: es microcopy y decisión de producto — regla 30)

1. **Primero, la promesa.** O existe el WhatsApp de soporte, o **la frase «Soporte por email y
   WhatsApp» sale de `precios.html` y de `plansView.js`**. Prometer un canal inexistente es lo
   único de aquí que ya está haciendo daño hoy.
2. **Que el botón «?» no se oculte con un modal abierto** — es el único cambio de código de todo
   esto y es de una línea de CSS; va en su ticket, con su rojo.
3. **Que «escríbenos» del Libro registro lleve el destino** (el mismo que use el producto).
4. **Que quede rastro:** si el canal sigue siendo email, lo mínimo es que el producto sepa que
   existió el mensaje. Eso ya es diseño y va en un ticket aparte, no en esta medición.

**Textos concretos: los propongo cuando el fundador diga qué canal queda.** Escribirlos ahora sería
inventar microcopy antes de saber si hay WhatsApp.
