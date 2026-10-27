# SCRUM-1237 · Enviar un presupuesto a un cliente sin correo: el aviso, dentro de la modal

**Puesto:** S2 (pantallas del panel). **Rama:** `scrum-1237-aviso-dentro-de-la-modal`, desde `main` @
`555c65fa91cd12d54d735a40b90e479805b276fa`. **Fecha:** 16-oct-2026, 11:59Z (cabecera `Date:` de GitHub).
**Medido contra:** `origin/main` = `665bcd17ff7fe0f63959b300bda92cdc6bf448c7` · 2026-10-16T12:11:20Z
**Skill UI:** cargada · tarde: la cargué después de la primera versión, y por ella el margen del aviso salió
de un `style.cssText` a la clase `.modal-share-aviso` de `styles.css` (el trinquete de SCRUM-713c lo cazó
también: 336 sobre un techo de 335). AB6: el aviso reutiliza `.alert` del inventario (mismos colores y
contraste), lleva `role="status"`; capturas antes/después a 1280 y a 390 px.
**Autorización:** orquestador de Luis, 16-oct-2026, mensaje punto a punto a S2: (1) aviso dentro de la
modal, cero frases nuevas; (2) «✉ Enviar por email» desactivado de entrada si el cliente no tiene correo,
con la misma conducta y el mismo texto que la ficha.

## La premisa, medida en la pantalla (el ticket sólo había medido el servidor)

`yaqu.app`, build `37c52e17d62319300469075474d99399eafd2af1`, cuenta QA, sonda
`sondas-s2/sin-correo-1237.mjs`. **Cero escrituras:** `POST /quote/create` lo contesta la sonda con el
#205 ya existente (borrador, cliente «QA 1198…» sin correo); sólo sale a producción
`POST /admin/quotes/205/send-email`, después de leer por GET que su cliente no tiene correo. La puerta
pasa el control positivo (otro POST y el `send-whatsapp` del mismo #205, cortados). El #205 sigue `draft`.

| síntoma del ticket | medido en prod |
|---|---|
| «parece que se envía» | el botón pasa a «Enviando…» y vuelve a «✉ Enviar por email»; dentro de la modal no aparece nada |
| «no pasa a hecho» | ningún botón pasa a «✓ Enviado» ni el cierre a «Hecho ✓» (correcto: no se envió) |
| «el error aparece al salir» | el servidor contesta `400 customer_missing_email`; la pantalla lo traduce bien («Este cliente no tiene email; añádelo en su ficha.») pero lo escribe con `setAlert` en el aviso del FORMULARIO, que la modal tapa: `elementFromPoint` sobre ese aviso devuelve el velo, no el aviso. Al cerrar la modal, el aviso es alcanzable |

La superficie es `openQuoteModal` de `quotesView.js` («Presupuesto #N generado», tras «Generar
presupuesto»). La ficha (`quotesDetailView.js`) pinta en su propio aviso y desactiva el botón: por eso una
lo cuenta y la otra no. **Los dos errores de WhatsApp de la misma modal caían en el mismo aviso tapado.**

## Lo que cambia (`public/dashboard/js/quotesView.js`)

1. Un aviso (`.alert`, `role="status"`) DENTRO de la modal, bajo los botones de envío. Tras cada uno de
   los cinco `setAlert` de la modal (correo y WhatsApp, éxito y error), `copiarAvisoALaModal()` copia el
   aviso tal cual: mismo texto, misma clase. **Cero frases nuevas.** Las llamadas a `setAlert` no se
   tocan: siguen a la vista del censo de mensajes crudos de SCRUM-644 (`quotesView.js: 5`), que no
   cambia. Se desplaza a la vista con `scrollIntoView({ block: "nearest" })`: a 390 px la modal se
   desplaza y el aviso nacía bajo el borde (medido, fuera de la vista).
2. «✉ Enviar por email» nace desactivado si el cliente no tiene correo, con el título
   «El cliente no tiene email configurado.» — el que ya usa la ficha (`quotesDetailView.js:542`). El dato
   sale del `GET /admin/quotes/:id` que ya se hacía para el PDF, y **sólo se da por «sin correo» si ese
   detalle llegó**: si no se pudo leer, el botón se ofrece y contesta el servidor (y su aviso ya se ve).

## Verificación

| fila | resultado |
|---|---|
| prod sin el arreglo (control de la sonda) | ROJO: el aviso no está en la modal |
| rama, escritorio 1280: botón al abrir | desactivado, título de la ficha |
| rama, escritorio: botón reactivado a mano y pulsado | servidor 400; aviso DENTRO de la modal, alcanzable y en la vista |
| rama, móvil 390 | igual, en la vista tras el desplazamiento |
| #205 después de las cuatro pasadas | `draft`, sin cambios |

Capturas en `sondas-s2/cap1237/`. Test `tests/scrum1237-aviso-dentro-de-la-modal.test.mjs` (AST de
`openQuoteModal`): cae con 10 faltas contra el fuente de `main` y con cada uno de sus cinco mutantes.

**No medido:** los dos errores de WhatsApp en navegador (pasan por la misma `copiarAvisoALaModal()` que el
de correo; el test los exige, la sonda no los dispara porque mandar WhatsApp no es una escritura que se
pueda dejar salir).

A9: comprobación → `tests/scrum811c-skill-ui-declarada.test.mjs`
(Toqué `quotesView.js` antes de cargar `yaqu-premium-ui`, y metí un `style.cssText` que la skill prohíbe.
Me cazaron este guard y el de 713c; la primera versión del registro tampoco llevaba esta línea A9 y la
cazó el obligatorio de #2521, `scrum1294`.)

## 1237b — VISTO en yaqu.app después del merge (S2, s2-18oct)

**Medido contra:** `origin/main` = `b40c2121de7ccf4db2850b8c1970e6a20933dd31` · 2026-10-18T19:05:07Z

**Skill UI:** no cargada · no se toca ninguna pantalla: sólo se mira, en producción.

El registro de arriba se verificó **sirviendo la rama**; tras el merge (#2521, `a1afb7e74`) nadie lo había mirado
en producción (lo cazó S0). Producción servía `214283d7958a13b0280e2b64ac041856ad275cf2` (leído en la meta
`yaqu-build`), que CONTIENE `a1afb7e74` (`git merge-base --is-ancestor`, 0). Misma sonda, sin servir nada local y
EXIGIENDO la aceptación: `sondas-s2/sin-correo-1237.mjs prod [movil]`. Mismas cero escrituras: `POST /quote/create`
lo contesta la sonda con el #205; sólo sale `POST /admin/quotes/205/send-email`, y el servidor contesta 400 antes de
enviar. Control de la puerta en las dos pasadas: otro POST y el `send-whatsapp` del #205, cortados. El #205 sigue `draft`.

| aceptación (orquestador, c.19870) | 1280 | 390 |
|---|---|---|
| ② «✉ Enviar por email» desactivado de entrada, con el título de la ficha | ✅ `disabled`, «El cliente no tiene email configurado.» | ✅ igual |
| ① el aviso del envío, DENTRO de la modal y a la vista (reactivado a mano: el camino de cuando el detalle no se pudo leer) | ✅ «Este cliente no tiene email; añádelo en su ficha.»; `elementFromPoint` lo alcanza; en la vista | ✅ igual, en la vista tras el desplazamiento |
| no se da por hecho | ✅ ningún «Enviado»/«Hecho» | ✅ |
| CONTROL: el aviso de la PÁGINA sigue tapado por la modal (la sonda distingue «se ve» de «está escrito») | `alcanzable: false` | `alcanzable: false` |

Capturas fuera del repo: `sondas-s2/cap1237/prod-18oct{,-movil}-{al-abrir,tras-enviar}.png`. El PDF de la modal sale
en blanco en las capturas: es `chrome-headless-shell`, que no pinta PDF, igual que en las del 16-oct.
**No medido, igual que entonces:** los dos errores de WhatsApp de la modal en navegador (mandar un WhatsApp no es una
escritura que se pueda dejar salir; pasan por la misma `copiarAvisoALaModal()` y el test los exige).
A9: comprobación → `tests/scrum1237-aviso-dentro-de-la-modal.test.mjs`