# SCRUM-1171 · La ficha del Trabajo recibe el número de WhatsApp resuelto (mitad de servidor)

**Medido contra:** `origin/main` = `95cd703f7bd502e62679d0c1a63209ae581ffd57` · 2026-09-27T17:45:17Z

**Escribe:** Sesión 1 (S1) · **Rama:** `scrum-1171-trabajo-numero-whatsapp` · **Carril:** S1
(servidor). La mitad de front (`jobRailBlocks.js`) es de S2 y va después.

## El defecto

El bloque Cliente del Trabajo pinta «📞» y «💬 WhatsApp» sólo desde `customer.phone`
(`jobRailBlocks.js`, `bloqueCliente`): un cliente con sólo móvil se queda sin los dos.

## PASO 0 y decisión (Jira com. 17268, 17269, 17270 y mensaje del orquestador)

- 📞 y 💬 son dos necesidades distintas: `canalDeWhatsApp` es el criterio de a quién se ESCRIBE;
  a quién se LLAMA no lo decide ninguna función del servidor.
- Barrido de `tel:`/`callto:` en `src` y `public` (6 aciertos): en servidor, PDF, correo, portal
  y bot, ninguno. Pero en el front ya existe `contactoDelCliente` (`public/dashboard/js/api.js`,
  SCRUM-1032, lista y ficha de Clientes), que ofrece DOS `tel:` (fijo y móvil).
- **Decisión del orquestador:** el servidor manda sólo `numeroWhatsApp`, porque tiene que
  coincidir con el envío real. Para llamar NO se añade campo: la ficha del Trabajo reutiliza
  `contactoDelCliente` con dos botones, como en Clientes (S2). Si se centralizara aquí «fijo
  primero», la ficha del Trabajo tendría una tercera conducta que nadie ha decidido.
- ⚠️ Hallazgo aparte: `contactoDelCliente` también resuelve WhatsApp (`movil || fijo`, con su
  propia normalización): es una segunda copia del criterio de `canalDeWhatsApp`, hoy igual y con
  riesgo de divergir. Es de J2; lo reporta el orquestador. No se toca.

## El cambio

`GET /admin/jobs/:id` (`serializeJobDetail`, `jobs.routes.ts`) devuelve, de forma aditiva,
`customer.numeroWhatsApp = canalDeWhatsApp(customer) || null`. `phone` y `mobile` siguen
saliendo igual. Sólo en el DETALLE: la lista no pinta botones. No se toca `whatsapp.ts`, ni ningún
envío (regla 28: es un enlace que el profesional pulsa a mano), ni ningún texto.

**Para S2:** el campo es `job.customer.numeroWhatsApp` (`null` = sin número → sin botón 💬).

## Prueba

`tests/scrum1171-trabajo-numero-whatsapp.test.mjs`: el manejador REAL de `GET /admin/jobs/:id`
con la base doblada (`_envio-doblado.mjs`).
- **Rojo antes** (medido, sin el cambio): `🔴 (soloMovil) el detalle no trae customer.numeroWhatsApp`,
  con el suelo en verde (200 y el cliente del Trabajo).
- **Verde después:** solo móvil → móvil · solo fijo → fijo · ninguno → `null` · los dos → móvil.
  Cada caso se compara con un literal y con `canalDeWhatsApp` del propio `dist/`.
- **Regla 2:** pedido desde otro merchant da 404, el móvil no sale en la respuesta y la consulta
  lleva el `merchantId` de quien pregunta.
- Tests que miran `jobs.routes`, `jobRailBlocks` o `canalDeWhatsApp`: 519 pasan, 0 fallan, 3 saltados (ya existían).
