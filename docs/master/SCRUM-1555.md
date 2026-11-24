# SCRUM-1555 · El Técnico deja de abrir, aceptar, rechazar y reescribir el presupuesto de otro

**Medido contra:** `origin/main` = `0e8c20aff315bbd19d2d71aa54d94855eb90b816` · 2026-10-14T09:08:19Z
A9: comprobación → `tests/scrum1346-el-tecnico-ve-documentos-ajenos.test.mjs`

Carril S1 · rama `scrum-1555-el-tecnico-solo-lo-suyo`, montada sobre la de SCRUM-1346
(`scrum-1346-el-tecnico-solo-lo-suyo`, PR #2437, abierto al empezar) porque el trinquete vive ahí y
todavía no estaba en `main`. Medición y sitios: los del equipo de Javier (SCRUM-1555 y su c.19622).
Decisión: SCRUM-1346 c.17952, «1-Para los dos» (presupuestos y facturas: autor o asignado); para
Inicio, la tabla «Qué VE el Técnico en Inicio» de la Parte S1 del máster (la decisión de la tarde del
1-oct sustituye a la de la mañana).

## Reproducido antes de tocar nada

Banco desechable propio (Postgres 16 en 127.0.0.1:55555, base `yaqu_1555_test`, esquema por
`migrate diff --from-empty`), `dist/app.js` real y sesión de verdad, con el trinquete de 1346. Con el
código de `main` y `SCRUM1346_SIN_TRINQUETE=1`, Ana (Técnico) sobre los documentos de Blas (Técnico):

| clave | ruta | `main` |
|---|---|---|
| pdf-presupuesto | `GET /admin/quotes/:id/pdf` | 200 con el PDF |
| inicio | `GET /admin/metrics/inicio` | lo enseña en la actividad reciente |
| albaran-buscador | `GET /admin/albaranes/presupuestos` | lo lista |
| notas | `PUT /admin/quotes/:id/notes` | **200: reescribe la nota** |
| aceptar | `POST /admin/quotes/:id/accept` | **200: lo acepta** |
| rechazar | `POST /admin/quotes/:id/reject` | **200: lo rechaza** |
| enviar-whatsapp | `POST /admin/quotes/:id/send-whatsapp` | 400 `customer_missing_phone` |
| enviar-correo | `POST /admin/quotes/:id/send-email` | 400 «falta correo» |

Las de escritura se reprodujeron por el código de respuesta: `acceptQuoteAdmin` y `rejectQuoteAdmin`
devuelven la fila ya escrita. La fila no se releyó por otra vía: el banco borra sus datos al acabar.

## El arreglo: las dos puertas que ya existían

- Las seis rutas por id (`quotesAdmin.routes.ts`): `puedeVerElPresupuesto(quienPideDe(req), id)`, el
  mismo gesto que la ficha. El ajeno recibe **el 404 que cada ruta ya daba al que no existe**, con su
  forma (`{ error: 'not_found' }` o `{ ok: false, error: 'not_found' }`). Ningún texto nuevo.
- `PUT /:id/notes`, además: con 0 filas contestaba `ok: true`. Ahora 404, como `/tags`. Si no, el
  inexistente (200) y el ajeno (404) volverían a distinguirse.
- Inicio (`metrics.routes.ts` → `getInicioOperario`): la actividad reciente lleva el recorte de
  `wherePresupuestosVisibles`. **Los recuentos de los globos NO** (no son documentos y la decisión
  no los nombra; c.19622 lo deja sin decidir a propósito). El comentario del servicio decía que el
  Técnico ve la actividad de sus compañeros: era la decisión de la mañana, ya sustituida; corregido.
- El buscador del albarán (`albaranes.routes.ts`): `listQuotesAdmin` con su 7.º parámetro, el recorte.

**Ni esquema ni camino de emisión.** Ninguna de las ocho rutas emite: `POST /:id/invoice` y
`/invoice-manual` no se tocan, y la puerta va antes de cualquier lectura o escritura de la ruta.

## El 400 frente al 404, aparte

`send-whatsapp` y `send-email` no dejaban ver el documento, pero contestaban **400 «falta teléfono» /
«falta correo»** al ajeno y **404** al que no existe. Distinguir las dos respuestas basta para saber
qué ids existen en el negocio, aunque no se pueda abrir ninguno. Ahora las dos dan el mismo 404.

## Verificado, ejecutando

| caso del trinquete | `main` | con el arreglo |
|---|---|---|
| ① las ocho, con la lista LLENA | 8 VE, verde | **8 NO-VE: cae** (el control de que se cerraron las ocho) |
| ① con la lista VACÍA | — | verde |
| ② el Técnico sigue con lo suyo | verde | verde |
| ③ la admin lo ve todo | verde | verde |
| ④ el Técnico acepta y rechaza lo SUYO | verde | verde |

`FUGAS_CONOCIDAS` queda vacía.

**NO medido:** en yaqu.app (haría falta una cuenta de Técnico en la cuenta QA).

# SCRUM-1555b · El login de pruebas abre sesión también como miembro de equipo

**Medido contra:** `origin/main` = `6fbcde28651d2eed9190ced9efbc7663d8cdac7a` · 2026-11-24T11:51:37Z
A9: aviso → cicatriz J3 «Llegué a 122.860 tras leer Jira con un tope de 160k y no dije que el encargo no cabía; lo dije a 142k, con nada escrito.» — no se pudo comprobar: cuándo se mide y se avisa una sesión no deja rastro en el árbol

Decisión del fundador: SCRUM-1555 c.22569 («Login de pruebas con rol»). Puesto J3 (`jv-j3cu`), carril J3 (`src/modules/auth/**`).

**Qué.** `POST /auth/test-login` (`src/modules/auth/app/routes/auth.routes.ts`) admite un campo OPCIONAL `miembro`: el correo de un miembro de equipo YA EXISTENTE del comercio de la propietaria de la allowlist. La sesión se escribe con su `teamMemberId`, y `requireAuth` saca el rol de esa fila (`session.teamMember.role`). Sin `miembro`, todo igual que antes. Las tres cerraduras (flag, secreto y allowlist del correo de la propietaria) no cambian y van ANTES; fuera de staging la ruta sigue sin existir. No crea usuarios, no activa invitados, no manda correos. Miembro inexistente, de otro comercio o suspendido: `404 {"error":"team_member_not_found"}` y no se escribe ninguna sesión. `src/core/http/publicAccessDeclarations.ts` NO se toca: su motivo («triple cerradura») sigue siendo verdad.

**Esperado · visto** (`tests/scrum1555b-test-login-con-rol.test.mjs`, la app real de `dist/app.js` con el doble de Prisma de SCRUM-597):

| caso | esperado | visto ANTES del arreglo | visto DESPUÉS |
|---|---|---|---|
| con `miembro` = Técnico | sesión con su `teamMemberId`; `GET /admin/team` → 403 `forbidden` | ROJO: la sesión sale sin `teamMemberId` (propietaria) | verde |
| cuerpo de hoy | propietaria; `/admin/team` sin 401/403 | verde | verde |
| `miembro` que no es del comercio | 404 `team_member_not_found`, 0 sesiones | ROJO: 200 y sesión de propietaria | verde |
| gate apagado | 404, 0 sesiones | verde | verde |

Tanda dirigida (este test, `scrum1430`, `scrum334`, `scrum1555*`, `scrum1185*`, `scrum1294*`, `scrum267*`, `scrum854*`, `scrum719*`): 91 casos; antes de este registro, 90 verdes y `scrum854 ②` rojo por falta del registro. Build con tipos (`tsc -p .`): salida 0.

**NO HECHO** (el contexto no daba, se dice aquí y en la entrega): la mutación del catálogo (`MUTACIONES_QUE_ME_TUMBAN`), la suite entera y `censo:mudez`. El rojo de arriba es una pasada a mano sobre el código sin arreglo, no una mutación repetible.

**Cómo lo usa la sesión de QA en staging** (sin valores: el secreto lo tiene el entorno):

1. Con la propietaria QA, ver en el equipo (`GET /admin/team`) que exista un miembro con rol `tecnico`. Si no hay, crearlo NO es de este cambio: hace falta que lo dé de alta alguien (la invitación manda correo).
2. `POST /auth/test-login` con `{ "email": <propietaria de la allowlist>, "secret": <el de staging>, "miembro": <correo del Técnico> }` → 200 y la cookie `pf_session` es la del Técnico.
3. Con esa cookie, las 8 rutas de SCRUM-1555 sobre un presupuesto de la PROPIETARIA (o de otro miembro): PDF, aceptar, rechazar, enviar por WhatsApp, enviar por correo y notas → 404; Inicio y el buscador del albarán no lo listan. Y `GET /admin/team` → 403 como control de que la sesión es de Técnico.
