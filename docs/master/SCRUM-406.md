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


---

> **Apéndice.** Esto vivía en un `docs/master/SCRUM-406-canal.md` suelto, que rompe
> SCRUM-273 (`docs/master/SCRUM-<n>.md`, sin excepción). Se pliega aquí **sin borrar nada** de lo
> anterior, igual que hizo SCRUM-244.md. Tercera vez en tres días con tres sesiones distintas: el
> arreglo de fondo va en el mensaje del guard, no en la regla.

# SCRUM-406 (parte 2) · un canal prometido existe, y un «escríbenos» tiene destino

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

---

# SCRUM-406 (parte 3) · «Escríbenos»: el otro extremo

**Fecha:** 11-ago-2026 · **Carril:** B · **Tipo:** CONSTRUCCIÓN · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `b8b8afd9b572cd72c531ad335eb42dfe0948ca43` · 2026-08-11T18:15:40Z

> TERCERA entrada en el MISMO fichero (SCRUM-273): la medición del 10-ago, el canal prometido, y esto.
> Es lo que se construye tras el reencuadre del fundador: **el botón ya no falta —desde SCRUM-416
> el «?» está en las 25 cabeceras de modal—; faltaba dónde aterrizar.**

## 1 · Lo que cambió esta tarde, y lo que no

| | 10-ago | Hoy |
| --- | --- | --- |
| Puerta con modal abierta | **ninguna** (el FAB se oculta) | «?» en la cabecera de modal (**25 llamadas / 17 ficheros**) |
| Panel de la guía | `z-index:360`, **detrás** de la modal | `600`, encima (lo subió SCRUM-416) |
| Qué hay al final del panel | `mailto:` | **formulario** que llega a un buzón, con contexto |
| Quién lo recibe | **nadie** | `POST /admin/soporte` → Resend |

> ⚠️ **Casi digo que el terreno no había cambiado.** Abrí `SCRUM-416.md`, leí su primera entrega
> —la que **paró** en (a) sin construir— y estuve a punto de reportar que el «?» seguía igual. El
> fichero tiene DOS entregas y la segunda (PR #688) sí construyó. Lo destapó mirar los commits del
> fichero en vez de fiarme de su encabezado.

## 2 · Lo que se construye

**El formulario**, al pie del panel de la guía —la puerta a la que se llega desde el FAB y desde el
«?» de cualquier modal—. Los cuatro textos aprobados van literales, y la confirmación **no promete
plazo** a propósito.

**La ruta**, `POST /admin/soporte`, declarada en las **dos** listas que la casa exige:

* `adminRouteDeclarations.ts` — sin rol por encima del default, y por el mismo motivo que
  `/admin/entorno`: **pedir ayuda no es una capacidad de administración**, y dejarlo admin-only
  callaría justo al operario que está en la obra.
* `sendEndpointDeclarations.ts` — la heurística de nombre (`enviar|send|resend`) **no lo habría
  encontrado**: es el punto ciego nº 2 que ese fichero declara de sí mismo. Se declara a mano.

**El contexto se LEE de donde ya vive.** `AuthSession.instaladaPwa` lo escribe `POST /admin/entorno`
desde SCRUM-360 (H5 fase 2): aquí no se recoge nada nuevo. Lo único que aporta el cliente es la
pantalla, que solo él sabe. Una segunda recogida del mismo dato habría dado dos verdades sobre lo
mismo.

**Y la constante.** `hola@yaqu.app` estaba a mano en seis sitios; el comentario de
`libroRegistroView.js` ya avisaba: *«el día que cambie hay que cambiarlo en todos, y el que se
olvide deja un canal muerto sin que nadie se entere»*. Ahora hay una constante por lado
(`src/core/config/contacto.ts`, `public/dashboard/js/contacto.js`).

> 🔴 **Las dos páginas legales conservan el literal, y es deliberado.** Son HTML estático:
> sustituirlo por algo que rellena JavaScript significaría que **un fallo de JS deja una página
> legal sin la vía de contacto que el RGPD exige**. Cambiar seis literales por cinco más una
> dependencia de JS en la página legal no es una mejora. Lo que impide la divergencia es el guard.

## 3 · 🔴 El suelo: que se entere si no sale

Un formulario que se traga el error y dice «enviado» es **peor que el `mailto:` que sustituye** —
aquel al menos le deja el correo escrito delante. Se cierra en los **tres** sitios donde se rompe:

1. **El envío.** Sin `RESEND_API_KEY` y sin `SMTP_URL`, `createMailer()` cae a `streamTransport`,
   que escribe el correo **en un buffer en memoria y resuelve BIEN**. Un `sendMail` que triunfa
   contra un buffer es la forma que tiene «no configurado» de disfrazarse de «enviado»: se devuelve
   `sin_transporte`, no éxito.
2. **La ruta.** `sent: false` con el texto canónico de `SEND_FAILURE_MESSAGES` (SCRUM-126). El 200
   no es la respuesta a «¿salió?».
3. **La pantalla.** La confirmación aprobada solo se pinta con `r.sent === true`, y en el fallo
   **no se borra lo que escribió** y reaparece el `mailto:` como salida.

### Una decisión sobre el tercer estado, declarada

SCRUM-459 marca la mutación vencida como `incierto` —«no sé si llegó»— y avisa de que decir «no
salió» invita a repetir. **Nadie consume esa marca todavía y no hay copy aprobada para ese estado.**
Aquí se trata como fallo, a propósito: lo que se repetiría es **un correo de soporte**, y recibirlo
dos veces no cuesta nada, mientras que callarse deja al profesional sin saber si alguien le va a
contestar. **En una firma o un cobro la decisión sería la contraria.** Si el fundador quiere un
tercer texto, es una línea.

## 4 · Los ocho rojos, vistos fallar

Control positivo previo: árbol limpio, **3.150 tests, 0 fallos**.

| Se rompe… | El guard dice… |
| --- | --- |
| se quita el destinatario interno | *«NO HAY DIRECCIÓN DE CONTACTO… diría "Lo hemos recibido" sobre un correo que no sale de la máquina»* |
| el destino depende solo de la env | *«SIN `SOPORTE_EMAIL` NO HAY DESTINO… una env que falta se lee igual que una cadena vacía»* |
| la pantalla confirma sin mirar `sent` | *«LA CONFIRMACIÓN SE PINTA SIN COMPROBAR `sent` (condición: «r && r.ok»)»* |
| la ruta responde éxito igualmente | *«LA RUTA NO DEVUELVE UN FALLO CUANDO EL CORREO NO SALE»* |
| «sin transporte» cuenta como enviado | *«…`streamTransport` escribe en un buffer y resuelve BIEN»* |
| el contexto deja de viajar | *«EL CORREO NO LLEVA EL MERCHANT ("22")… no vale más que el `mailto:`»* |
| la dirección diverge en un sitio | *«HAY MÁS DE UNA DIRECCIÓN DE CONTACTO VIVA: soporte@yaqu.app, hola@yaqu.app»* |
| se toca el FAB del 6-jul | *«…es decisión del fundador del 6-jul y no es de este ticket»* |

## 5 · Dos guards de la casa me cazaron, y los dos tenían razón

* **SCRUM-274** — el shell del service worker lleva **todos** los `<script>` del dashboard. Sin
  añadir `contacto.js`, la primera visita **sin cobertura** se queda sin la dirección de contacto, y
  **con red no se nota nada**.
* **SCRUM-406 (canal prometido)** — el banco del libro registro monta su propio contexto y no
  cargaba `contacto.js`. Es literalmente lo que avisa su párrafo de SCRUM-436: *un banco al que le
  falta un `<script>` simula un navegador roto, y su rojo no sería del producto*.

Y un tercero, **SCRUM-348**, marcó la lectura de `AuthSession` como «sin filtro en ruta
autenticada». Clasificarla como PROCEDENCIA habría subido su trinquete de 5 a 6 — **y el trinquete
solo baja**. `AuthSession` sí tiene `merchantId`, así que la lectura pasa a `findFirst` con su
filtro y **la deuda no crece**.

> Y van **siete**: el censo de direcciones salió rojo contra `env.ts:82`, un **comentario** que pone
> «Ej: "luis@yaqu.app,otro@yaqu.app"». Ahora mira solo `mailto:` y la constante, sobre código sin
> comentarios.

## 6 · Lo que NO se ha tocado

El FAB y su `display:none` con modal abierta (decisión del 6-jul) · `prisma/schema.prisma` —
**ningún modelo `SoporteMensaje`: eso es el camino 3** · las dos páginas legales · el panel de la
guía, que sigue con sus acordeones y su `mailto:` · los **dos sitios sin puerta** que declaró
SCRUM-416 (firma con overlay `z-1200` y onboarding con `z-300`), que no son de este ticket.

## 7 · Hallazgo, reportado y no arreglado (regla 37)

**Hay SEIS copias del POST a Resend** en el árbol —`auth.service`, `email.service` ×2,
`lifecycle.service`, `merchantNotifications`, `weeklyDigest`— y **ningún enviador compartido**:
cada una arma su propio documento. No se migran aquí (ni es mi zona, ni me bloquea, ni cabe en este
PR). `src/integrations/enviarCorreo.ts` nace **genérico a propósito** para que la séptima no vuelva
a nacer suelta.

## 8 · Tests que corren

- `tests/scrum406-escribenos.test.mjs` — 11 tests (contexto, destino, suelo ×3, copy, constante,
  control negativo de legales/guía/FAB)
- `tests/scrum406-canal-prometido-existe.test.mjs` — el banco carga ahora `contacto.js`

Suite completa: **3.150 tests, 0 fallos**. `guards:entrada` y `guard:prisma` en verde.
