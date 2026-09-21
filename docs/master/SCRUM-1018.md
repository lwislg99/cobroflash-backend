# SCRUM-1018 · CLIENTES Y COBRO · el portal del cliente no dice quién va ni en qué franja — PASO 0 confirmado, tres huecos antes de construir

**Medido contra:** `origin/main` = `27fd224133b4de5451155fc3b23800b536c6a162` · 2026-09-21T16:49:02Z

21-sep-2026 16:49Z · `origin/main = 27fd224133b4de5451155fc3b23800b536c6a162` · rama
`scrum-1018-portal-quien-va-y-franja` · escrito por **J2** (puesto de Clientes y cobro del equipo de
Javier), sobre la propuesta abierta por J5 el 21-sep-2026 15:14Z (`origin/main =
92100e4fc018e59a948a0e9fccd898ae2d613963`), que a su vez convierte `docs/competencia/matriz.md`
§12.3.2 en ticket.

## Encargo

El ticket pide un PASO 0 corriendo (no citado) y declara un STOP sobre la foto del técnico: *"esa
decisión no la toma esta sesión — la franja horaria y el nombre, sin foto, son la parte que se
puede construir sin esperar a esa decisión"*. El encargo de esta sesión añade: medir qué haría
falta para la franja y el nombre, proponerlo, y **separar** los tres asuntos en vez de tratarlos
como un bloque. Esta tanda **solo mide y propone**: no construye pantalla, no toca el esquema, no
publica ningún texto nuevo.

## 1 · PASO 0 — confirmado CORRIENDO, no solo citado de la matriz

`git show origin/main:src/modules/system/app/routes/customerPortal.routes.ts` (511 líneas, las dos
rutas del portal: `GET /:token` y `POST /:token/quote-request`) y
`git show origin/main:src/modules/quotes/domain/sendQuote.service.ts`, buscando
`asignad|teamMember|franja|\bslot\b` con límite de palabra (⚠️ un primer intento con `hora` suelto
dio 3 falsos positivos: la subcadena de «Pagar **ahora**» — «un prefijo no es un nombre, y una
subcadena tampoco», `00-normas-comunes.md` A3):

    EXIT=1 (grep sin coincidencias) en los dos ficheros

Y leído el `GET /:token` entero: pinta cabecera del negocio, presupuestos (con líneas, PDF y botón
de aceptar), facturas (con líneas, PDF y botón de pagar) y el formulario de «solicitar
presupuesto». **Cero referencias a `Job`, a técnico asignado, a fecha de visita o a franja
horaria.** Confirma el hallazgo de J5 y va un paso más allá: no es solo que no aparezca la palabra,
es que la consulta a Prisma de esa ruta (`customer.findUnique` con `quotes`/`invoices`) **ni
siquiera pide** la tabla `Job`.

## 2 · Qué existe hoy para construirlo — y lo que NO existe (medido, no en la matriz de J5)

- `Job.scheduledAt` (`prisma/schema.prisma:1211`) es `DateTime?`: **un único instante**, no un
  rango. No hay `scheduledFrom`/`scheduledTo` ni nada parecido en el modelo.
- La asignación de técnico vive en DOS sitios a la vez, y el propio schema lo dice: `Job.assignedUserId`
  (escalar, columna real) y `JobAssignee` (tabla N:M con `TeamMember`, SCRUM-650, «virtual, sin
  columna» — el comentario del modelo dice explícitamente que es el **destino final** y que
  `assignedUserId` **desaparece** cuando se complete esa migración, que hoy no está completa).
  Cualquier lectura para el portal tiene que decidir CUÁL de las dos fuentes lee (o las dos, y
  resolver el desacuerdo si difieren) — no es una elección neutra, es leer un dato que el propio
  producto todavía tiene partido en dos.
- **No existe el concepto de «franja horaria» en NINGÚN punto del producto hoy, ni siquiera en el
  lado del profesional.** Medido en `public/dashboard/js/jobAgendar.js:90-108`: el propio profesional
  agenda un Trabajo con un único `datetime-local` (`scheduledAt: new Date(dt.value).toISOString()`),
  no con un inicio y un fin. `jobsView.js` lo pinta igual, como una hora puntual
  (`toLocaleString(...,{hour:'2-digit',minute:'2-digit'})`). El ticket pide mostrarle al cliente
  «una franja, no una hora exacta» — eso no es «tomar un dato que ya existe y enseñarlo»: es
  **inventar una franja que hoy no se guarda en ningún sitio**, ni para el profesional.

## 3 · STOP 1 — la foto (heredado de J5, aquí solo se detalla)

Ya declarado en el ticket y no se repite el argumento (RGPD de un dato personal de un empleado
mostrado a un tercero). Lo que añade esta sesión, medido: hoy `TeamMember` no tiene ninguna columna
de foto ni de consentimiento (`prisma/schema.prisma:1111-1131`, campos: `name`, `email`, `role`,
`status`). Construirlo exigiría, como mínimo, decisión de un jefe sobre TRES preguntas encadenadas,
no una: (a) ¿se ofrece la foto?, (b) ¿el consentimiento es por técnico (`TeamMember.photoConsent`,
opt-in) o por negocio (un ajuste en `settingsView.js`)?, (c) ¿dónde se guarda la foto (URL externa,
como ya hace `Merchant.logoUrl`, o subida propia)? Cualquiera de las tres respuestas necesita un
ALTER aditivo (A5) que hoy no existe (`prisma/schema.prisma:1111-1132`, el modelo `TeamMember`
completo, sin ninguna columna de foto ni de consentimiento). **No se construye nada de esto en
esta tanda.**

## 4 · STOP 2 — la franja horaria no es un dato que exista: hay que decidir CÓMO se fabrica

Dos caminos, con coste distinto, y esta sesión no elige por su cuenta (`00-normas-comunes.md` A7:
«prohibido inventar»; `puesto-j2.md`: «ningún texto de usuario sin firma»):

- **Camino A — computada, sin tocar el esquema.** A partir de `Job.scheduledAt` se calcula una
  ventana (p. ej. «entre las 9:00 y las 11:00» = `scheduledAt` ± 1 hora). No requiere ALTER, pero
  **la anchura de la ventana es una decisión de producto**, no un detalle de implementación: una
  ventana de 1h no es la de Jobber (su captura de referencia, `docs/competencia/capturas/jobber/
  client-hub-quien-va-a-ir.png`, no se ha mirado en esta sesión — lo cita el ticket original de J5,
  no esta). Elegirla sin que la apruebe un jefe es inventar un texto que el cliente va a leer como
  una promesa horaria.
- **Camino B — real, con inicio y fin guardados.** Añadir `scheduledFrom`/`scheduledTo` (o
  similar) a `Job`. Correcto a largo plazo, pero es un ALTER (① decisión → ② ALTER en las tres
  bases → ③ un PR), y **el fichero es de S1** (`dos-equipos.md` §3.1: todo lo demás de `jobs` es de
  **S1**, no de J2) — así que ni siquiera la ejecución del ALTER es de este puesto, aunque J2 sea
  quien consume el dato desde `customerPortal.routes.ts` (que sí es mío).

**Propuesta de esta sesión:** el camino A (computada, sin ALTER, sin esperar a S1) es el que se
puede construir antes, **si un jefe fija la anchura de la ventana** (esta sesión no propone un
número: no hay dato de qué franja cumple hoy un profesional en España con este producto, y
inventarlo es el mismo error que el STOP de la foto, a menor escala).

## 5 · STOP 3 — nombre y franja, SIN foto, siguen siendo texto nuevo visible al cliente

El ticket separa la foto como «la parte que se puede construir sin esperar». Es cierto para el
RGPD, pero no agota los STOP: mostrar «Tu técnico: Juan · entre las 9:00 y las 11:00» en el portal
es **copy nueva visible al cliente**, y `puesto-j2.md` y `00-normas-comunes.md` (A7) exigen firma
de un jefe para cualquier texto de usuario nuevo, no solo para lo que toca datos personales
sensibles. Propuesta de literal, a firmar antes de construir NADA de esta parte:

    Tu visita
    {nombreTecnico} · entre las {horaInicio} y las {horaFin}

(sin foto; el nombre puede omitirse si el Job no tiene técnico asignado por ninguna de las dos
fuentes del §2, y toda la sección puede omitirse si el Job no tiene `scheduledAt`).

## 6 · Nota RGPD menor, no bloqueante, para el radar de J4

Enseñar el NOMBRE de un empleado a un cliente es un dato personal de menor sensibilidad que su
foto, y el propio ticket no lo trata como bloqueante (lo separa explícitamente de la foto). Esta
sesión no lo bloquea, pero lo deja anotado: si J4 está inventariando qué datos de empleados salen
hacia terceros (ya lo hace para P17, `SCRUM-1023`), el nombre del técnico en el portal es un caso
más de la misma familia.

## 7 · Qué NO se ha hecho en esta tanda

No se ha tocado `prisma/schema.prisma`, ni `src/modules/jobs/**` (es de S1), ni se ha escrito ni
publicado ningún texto de usuario, ni se ha creado ningún flag nuevo. Ninguna pantalla del portal
cambia con este PR: es solo este expediente.

## 8 · Suelo declarado

- No se ha mirado la captura de Jobber (`docs/competencia/capturas/jobber/client-hub-quien-va-a-ir.png`)
  para calibrar una anchura de franja de referencia: la cita el ticket de J5, no esta sesión.
- No se ha medido si `Job.assignedUserId` y `JobAssignee` **discrepan hoy** en algún Job real de
  staging/producción (dato que decidiría si hay que resolver un desacuerdo real o es solo un
  riesgo teórico): exigiría consultar una base de datos y no es necesario para esta medición.
- No se ha preguntado a un asesor por la pregunta RGPD del nombre (§6): queda anotada, no resuelta.

## Siguiente paso

Ninguno de construcción hasta que un jefe conteste: (1) sí/no a la foto y, si es sí, las tres
preguntas del §3; (2) camino A o B para la franja y, si es A, su anchura; (3) firma del literal del
§5. Con esas tres respuestas, la construcción del camino A (sin ALTER) cabe en un ticket nuevo de
tamaño pequeño sobre `customerPortal.routes.ts` — el único fichero de mi área que hace falta tocar.
