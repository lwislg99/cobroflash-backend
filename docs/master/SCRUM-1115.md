# SCRUM-1115 · El remite «PresuFácil <noreply@presufacil.online>» sale de CONFIGURACIÓN, no de código

**Medido contra:** `origin/main` = `e2be1c9fda3b5ceac853b4d376f5664ac8e4df67` · 2026-10-14T07:48:19Z

A9: aviso → A10 «Una tilde entre corchetes no casa en `git grep -E` ni en `grep -E`: el patrón da cero sin avisar. Se busca la raíz sin tilde y con un fichero que la tenga al lado.» — no se pudo comprobar: el patrón de una búsqueda que se escribe en la consola no pasa por ningún guard del repositorio

Sesión `jv-j1l`, puesto J1, lanzada por el orquestador del equipo de Javier (`cobroflash-backend-2e`).
Etiquetas leídas en Jira: `equipo-javier`, `infraestructura`, `marca`, `stop-fundador`. El ticket se
leyó entero, con sus cuatro comentarios (16977, 17373, 17374 y 17376).

El hook de inicio dijo SIN IDENTIDAD. El orquestador escribió la mesa del puesto (J1) durante la
tanda. Esta entrega es solo medición y registro: no cambia código.

## En corto

- **Es configuración, y solo configuración.** Ningún fichero del repositorio lleva el nombre ni el
  dominio viejos. El remite sale entero de la variable de entorno `EMAIL_FROM` de cada servicio de
  Railway.
- **No es el «caso peor» de las dos fuentes.** Hay un valor por defecto en código, pero es
  `YaQu <no-reply@yaqu.local>`: no lleva la marca vieja y la variable lo tapa. Cambiar la variable
  basta, y no queda ningún valor en código que vuelva a sacar «PresuFácil».
- **Tres programas leen `EMAIL_FROM`, y cada servicio de Railway tiene la suya.** Hay que cambiarla en
  todos los servicios que existan, no solo en el backend.
- **Ningún llamador pasa un remite propio.** El comentario 16977 lo dejaba sin medir: el campo
  `from` opcional de `enviarCorreo` no lo usa nadie. Todo correo cae en `EMAIL_FROM`.
- **Ya estaba medido casi todo.** Que el valor viene de Railway lo dijeron el propio ticket (25-sep) y
  SCRUM-1196 (28-sep). El valor del backend lo leyó el fundador en Railway el 28-sep (c.17376):
  `PresuFácil <noreply@presufacil.online>`. Lo nuevo de este registro: los llamadores, los tres
  lectores y el recuento sobre el árbol entero.

## 1 · El literal, en el árbol entero

`git grep -i -I 'presuf'` (la raíz, sin tilde: ver la A9) sobre los 6.452 ficheros versionados:

| Dónde | Ficheros con «presuf» |
|---|---|
| fuera de `docs/` (`src/`, `public/`, `scripts/`, `prisma/`, `tests/`, configuración) | **0** |
| `docs/` (histórico, registros y evidencias que hablan de este mismo fallo) | 6 |

- Control positivo: el mismo patrón encuentra `docs/master/evidencias/SCRUM-1550/sondas.json`, que
  contiene «PresuFácil» con tilde.
- Ficheros de configuración (`*.toml`, `*.json`, `*.yml`, `Dockerfile*`, `.env*`, `Procfile`):
  ninguno contiene `EMAIL_FROM` ni «presuf». No hay ningún fichero de Railway ni `.env` versionado.
- También con `-a` (binarios incluidos), fuera de `docs/`: **0**.

## 2 · Quién manda correo, y de dónde saca el remite

Se buscó por el NOMBRE DEL CAMPO (`from`, `replyTo`, `EMAIL_FROM`), por los transportes
(`nodemailer`, `api.resend.com`) y por otros proveedores (sendgrid, mailgun, postmark, SES, brevo,
mailersend). Otros proveedores: **0** en `src/` y `scripts/`. Solo aparecen en
`scripts/_credenciales-en-texto.mjs`, que es un detector y no envía nada.

**Tres programas, tres lecturas de `EMAIL_FROM`:**

| Programa (servicio de Railway) | Dónde lee el remite | Por defecto |
|---|---|---|
| backend | `src/core/config/env.ts:68` → `config.EMAIL_FROM` | `YaQu <no-reply@yaqu.local>` |
| aviso de acreditación (cron, SCRUM-1109) | `scripts/aviso-programado-acreditacion-invoicing-es.mjs:333` | `YaQu <no-reply@yaqu.local>` |
| respaldo programado (tarea, SCRUM-1525) | `scripts/respaldo-programado.mjs:345` | `YaQu <no-reply@yaqu.local>` |

**Dentro del backend**, todos los envíos llegan a `config.EMAIL_FROM`:

- `src/integrations/enviarCorreo.ts:115` (Resend) y `:182` (SMTP): `from: c.from || config.EMAIL_FROM`.
- `c.from` no lo pasa **ningún** llamador. Se leyó el objeto de cada llamada:
  `auth.service.ts:43`, `lifecycle.service.ts:44`, `merchantNotifications.ts:29`,
  `weeklyDigest.service.ts:34`, `soporteAdmin.routes.ts:60` (el objeto lo construye
  `soporte.ts:construirCorreoSoporte`, que devuelve `to`, `replyTo`, `subject` y `html`, sin `from`),
  y `email.service.ts:249` (presupuesto).
- Factura y justificante: `email.service.ts:92` (`const from = config.EMAIL_FROM`), usado en `:119`
  (Resend) y en `:145` (SMTP).
- Presupuesto, respaldo SMTP: `email.service.ts:275`.

⚠️ **Suelo de este barrido:** es textual, no AST. Un remite montado con otro nombre de campo o leído
de la base de datos no se vería. Pero `from` es el nombre que exigen Resend y nodemailer, y los
cuatro sitios que crean un transporte están arriba.

## 3 · Lo que hay que cambiar: variable y valor

**Variable:** `EMAIL_FROM`, en **cada** servicio de Railway que ejecute uno de los tres programas:
el backend, el cron de acreditación y la tarea de respaldo si ya existe. Si se cambia solo en el
backend, el aviso de acreditación seguirá saliendo como «PresuFácil», y ese es justo el correo con el
que se vio el fallo el 25-sep.

**Valor propuesto, que tiene que firmar el fundador (regla 39):**

    YaQu <no-reply@yaqu.app>

No es una redacción nueva. Es el literal que ya figura en `docs/DEMO_READY_CHECKLIST_FUNDADOR.md:49` y
en `docs/PENDIENTES_FUNDADOR.md:129`. El nombre «YaQu» es el del valor por defecto de los tres
programas y el de la cabecera de `emailLayout.ts:66`. ⚠️ El máster v4 histórico
(`docs/historico/YAQU_MASTER_V4_viejo.md:1441`) decía `noreply@` sin guion, así que el buzón no está
cerrado en el máster vigente (`docs/YAQU_MASTER.md` no tiene ni `EMAIL_FROM` ni un remite). Lo decide
el fundador.

🔴 **El orden no admite adelantos** (c.17374 y c.17376; SCRUM-1196 lo midió con DNS):
① verificar `yaqu.app` en Resend (SPF y DKIM en el DNS) → ② que el panel lo dé por verificado →
③ un envío de prueba desde `@yaqu.app` que llegue a la bandeja → ④ solo entonces cambiar
`EMAIL_FROM` en los servicios. Hoy `yaqu.app` **no consta** verificado (SCRUM-1196, 28-sep), y Resend
rechaza el envío desde un dominio sin verificar. Cambiar la variable antes de ① deja de mandar
facturas.

## 4 · Visto de paso, sin tocarlo

- El pie del correo de la factura (`email.service.ts:102`) dice «Si tienes cualquier duda, responde a
  este correo», y el remite es un `no-reply`. SCRUM-406 ya lo anotó. Contestar llega al buzón
  `no-reply@`, y ningún llamador del cliente final pasa `replyTo`. Es texto que ve el usuario y una
  decisión del fundador, así que aquí solo se nombra.

## 5 · Después del cambio del fundador (14-oct): qué consta y qué no se puede verificar desde aquí

**Observación del fundador**, transmitida por el orquestador, no medida aquí: «Llega el email de
yaqu ya, no presufacil, está cambiado.» Lo que vio llegar sale del **backend**.

- **Resend (SCRUM-1196):** según esa observación, el correo llega. Resend rechaza el envío desde un
  dominio sin verificar, así que el dominio del remite nuevo está verificado. ⚠️ «de yaqu» puede ser
  solo el NOMBRE visible (`YaQu <noreply@presufacil.online>` también «llega de yaqu»). Que el
  dominio sea `yaqu.app` lo dice la dirección entre `<…>`, no el nombre.
- **¿Hay algún sitio del repo que registre qué remite usó un envío? No hay ninguno.** Se leyeron los
  tres:
  - backend: el log `[correo]` (`src/integrations/enviarCorreo.ts:133`, `:146`, `:192`, `:204`) lleva
    `evento`, `via`, `id`, `origen`, `to` enmascarado y `asunto`, pero **no `from`**. La fila de
    `registrarEnvio` (`registroDeEnvios.ts`) tampoco lo guarda: su `error` incluso enmascara toda
    dirección.
  - cron de acreditación: su `rastro` (`scripts/aviso-programado-acreditacion-invoicing-es.mjs:266`)
    lleva el asunto y si se entregó, **no el remitente**.
  - respaldo programado: igual, `remitente` entra en `sendMail` (`scripts/respaldo-programado.mjs:250`)
    y no se escribe en ningún log.
- **Dónde SÍ consta, fuera del repo:** en el registro de envíos de Resend, que guarda el `From` de
  cada correo. Se puede mirar desde el panel o con `GET /emails/{id}` (el `id` es el `provider_id`
  de la fila). Esto sale de lo que sé de la API de Resend: aquí no se ha llamado ni se ha releído su
  documentación. Con eso, quien tenga la cuenta puede mirar el último envío de **cada** servicio. Para
  los dos cron, si ya han corrido después del cambio. Si no han corrido, lo único es leer la
  variable en cada servicio de Railway.

| Servicio | `EMAIL_FROM` cambiado |
|---|---|
| backend | **consta** (observación del fundador: el correo llega como YaQu) |
| cron de acreditación | **no se puede verificar desde aquí**: solo el fundador, en Railway o en el panel de Resend |
| respaldo programado | **no se puede verificar desde aquí**: ídem, si el servicio existe |

## Qué NO se ha hecho

- No se ha tocado código: no hay nada que cambiar en él.
- No se ha leído ni tocado ninguna variable de Railway, ninguna clave ni ninguna base de datos.
- No se ha vuelto a medir el DNS: lo que se dice de `yaqu.app` y `presufacil.online` es de SCRUM-1196,
  medido el 28-sep.
- No se ha comprobado qué servicios de Railway existen hoy. Los tres de la tabla salen del código y
  de sus registros; el panel lo sabe el fundador.
