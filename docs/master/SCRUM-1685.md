# SCRUM-1685 · El alta del piloto: `POST /auth/register` con invitación

Firmas: máster + flag = SCRUM-1656 c.21411 (fila en la Parte P de `docs/YAQU_MASTER.md`). Textos
22-23 = SCRUM-1656 c.21408 ④ («el alta con invitación reusa los campos y literales ya aprobados de
provincia y domicilio»). Reasignado a S1 por el fundador en c.21436. Partición aprobada por el
orquestador: **tramo a** = la puerta del servidor (sin un solo texto nuevo) · **tramo b** = el
formulario de `public/register.html`.

## 2026-11-11 · Tramo a — la puerta del servidor

**Medido contra:** `origin/main` = `59540a52a3e783c4ec9f45cea35430afdec5e775` · 2026-11-11T10:28:51Z
(cabecera `Date:` de `api.github.com/zen`). Rama sobre `8a1acbac5`; los 4 commits de `main` desde
entonces no tocan ninguno de estos ficheros (`git diff --stat` vacío).

A9: comprobación → `tests/scrum1685-alta-sin-invitados.test.mjs` + `tests/scrum1685-alta-con-invitacion.test.mjs`

### ① Qué se ha construido

| pieza | qué hace |
|---|---|
| `src/core/config/env.ts` | `REGISTRATION_INVITED_EMAILS` (junto a `OWNER_EMAILS`, mismo criterio: comas, `trim`, minúsculas, sin huecos) vía `listaDeCorreos`, y `isInvitedEmail(email)`: comparación EXACTA tras normalizar. No va en `FLAG_DEFAULTS`. |
| `auth.routes.ts` · `POST /auth/register` | La PUERTA, dentro del manejador y delante de todo (también del limitador): correo no invitado — o lista vacía/ausente — → el 409 `registration_closed` de SCRUM-1515 **byte a byte**, sin tocar base ni mandar correo. Invitado → limitador (el de antes de 1515: 5/15 min por IP+correo) → `altaDelInvitado`. |
| `altaDelInvitado` (mismo fichero, arriba) | Limpia los campos como `altaDeMerchant.ts` (`camposDeAlta`): nombre, correo, país (`ES` por defecto), ref, source (200), `provincia`, y `domicilio-foral` / `domicilio-canarias` («si»/«sí»/«no»; otra cosa = sin contestar). Llama a `registerMerchant`, que exige provincia y domicilio con ES y deja fuera forales y Canarias. |
| `publicAccessDeclarations.ts` | El `reason` de `/auth/register` describe la puerta (lo vigila `scrum1528` por AST). |
| `tests/scrum334-correo-sin-consentimiento.test.mjs` | `/auth/register` vuelve a `LECTORES_DECLARADOS` con su base (6.1.b), como pide el propio ratchet al añadir un lector. |

Respuestas del invitado: `200 {ok, message:'Cuenta creada. Revisa tu email para acceder.'}` (el de
antes de 1515, `68e33c716^`) · `409 email_belongs_to_team` (SCRUM-94, sin cambios) ·
`409 territorio_excluido` con el texto FIRMADO que trae el rechazo (`territorioDeAlta.ts`,
SCRUM-1536 c.20225) · `400 provincia_required | provincia_desconocida | domicilio_fiscal_required |
domicilio_fiscal_desconocido` · `400 name_required | invalid_email` · `500 internal_error`.

**Sin texto nuevo (regla 39).** `scrum275` no deja subir las respuestas públicas sin `message`, y
regla 41: se arregla el código. Las que no tenían texto llevan el literal que `register.html` YA
pinta hoy para ese mismo código (`msgs`: «Escribe el nombre de tu negocio.», «Email inválido.») o su
texto por defecto («Error al crear la cuenta.»). La pantalla dice lo mismo que diría sin ellos.

**Con la variable vacía no cambia nada en producción.** El fundador no la pone hasta que entre el tramo b.

### ② Medido

- **Rojo primero** (código de `main`, tests nuevos): 4 casos caen — el invitado se queda en la
  puerta (recibe la ruta cerrada) y `config`/`listaDeCorreos` no existen.
- **Verde** con banco desechable propio (Postgres 16 portable, `127.0.0.1:55685`, base
  `yaqu_s1685_test`, esquema por `migrate diff --from-empty`): los 7 casos de 1685 + los ficheros
  que leen la ruta o la configuración (scrum1515 —corrió, no saltó—, 334, 264, 275, 1528, 1536d, 98,
  94, 514, 1430, 1317, 687, 1202, 55, owner, 475×2, 477, 245×2, 217, 163, 1325b): 0 fallos, 0 saltados.
- **Mutaciones** sobre `dist/core/config/env.js`, cada una tumba su test: «lista vacía = todos pasan»
  → cae `sin-invitados`; «coincidencia por subcadena» → cae `con-invitacion` (el correo recortado).
- Tropiezos de este tramo (A9): (1) un comentario mío con el texto de una declaración de ruta casó
  con el escáner de `scrum334` (trampa de auto-referencia): reescrito; (2) la puerta como middleware
  dejaba `registration_closed` fuera del manejador que lee `scrum1528`: movida dentro; (3) un
  `Get-Content -Raw` de PowerShell 5.1 re-codificó `auth.routes.ts` (mojibake): revertido
  byte a byte, comprobado sin `Ã` y con la frase firmada intacta.

### ③ Lo que queda — tramo b

`public/register.html`: `<select required>` de provincia (lista de `zonaDeLaProvincia.ts`, rótulo
de la ficha del cliente) + las dos preguntas sí/no del domicilio con los literales firmados en
SCRUM-1536 c.20225 (Q1b, hoy en `APARCADOS` de `tests/scrum514-aprobado-y-aplicado.test.mjs`).
El cuerpo que espera la ruta: `provincia`, `domicilio-foral`, `domicilio-canarias` («si»/«no»).

---

## Tramo b — el formulario (S1, 11-nov-2026 ~10:40Z GitHub; base `origin/main` `bb59d558e63fde930b5075db9593c963f8b1fd6e`)

### ① El OK y los textos

- **OK del orquestador** (mensaje a S1 del 11-nov, por la mañana): las entradas 22-23 de la firma del
  fundador (**SCRUM-1656 c.21408 ④**, alcance en c.21411) aprueban REUSAR los literales ya aprobados.
- **Literales, copiados del REGISTRO del repo** (`docs/microcopy/2026-10-22-SCRUM-1536-exclusion-territorial.md`,
  que los toma de SCRUM-1536 c.20223 §⑤ con la firma c.20225; orígenes SCRUM-1102 c.17709 y scrum514), y
  comprobados contra ese fichero antes de pegarlos:
  «¿Tienes el domicilio fiscal en el País Vasco o en Navarra?» · «¿Tienes el domicilio fiscal en Canarias?».
- «Provincia»: el rótulo de la ficha del cliente (SCRUM-1145 c.20592; entrada 22). «Sí»/«No»: las
  opciones de la ficha de Configuración (`settingsView.js`, select si/no). **Ningún texto nuevo.** La
  exclusión la contesta la ruta con la frase firmada de `territorioDeAlta.ts`, que la página ya pinta
  (`data.message`).
- **Cruce de carril:** `public/register.html` es de J3. El fundador reasignó el ticket al equipo de
  Luis (c.21436, «hagamos nosotros lo de javier»); la fila de §3.4 de `dos-equipos.md` la pone S0 en
  su propio PR, a petición de S1 (el orquestador lo confirmó: la fila documenta el cruce, no lo permite).

### ② Lo construido

- `public/register.html`: con España, `Provincia` (texto obligatorio, como en la ficha) y las dos
  preguntas como `<select required>` con una opción vacía (sin texto) + «Sí»/«No». Con otro país, el
  bloque se oculta y sus campos se desactivan (el navegador no exige lo que no se ve) y no viajan.
- `tests/scrum514-aprobado-y-aplicado.test.mjs`: «¿Tienes el domicilio fiscal en Canarias?» sale de
  `APARCADOS`, como mandaba su propio motivo, porque ya está pintado.
- **Provincia como texto y no como lista:** los 52 nombres están firmados (SCRUM-1616 c.21066), pero
  el OK de este tramo es «nada más de texto». El servidor compara sin tildes ni mayúsculas y acepta el
  código INE y las formas dobles; una errata da 400 con «Error al crear la cuenta.». **Propuesta**
  (no puesta): un `<select>` con los 52 nombres firmados, si el fundador lo quiere.

### ③ Medido

- Test nuevo `tests/scrum1685-formulario-de-alta.test.mjs`: ejecuta el script REAL de la página sobre
  un DOM mínimo y su `fetch` va a la ruta REAL. **Rojo primero:** 5 de 5 caen con el `register.html` de
  `main` (falta #provincia). **Verde**, con banco desechable propio (`127.0.0.1:55685`, base
  `yaqu_s1685_test`): no invitado → ve la frase cerrada, sin correo ni cuenta; invitado foral → ve la
  exclusión firmada, sin cuenta; invitado con Madrid → «cuenta creada», fila con `Europe/Madrid` y
  `domicilioFiscalForal=false`, 2 correos en el buzón de laboratorio (bienvenida + enlace).
- Junto con los que leen `register.html` o la ruta (1685×2, 514, 1515, 264, 334, 336, 94, 329, 333,
  701, 846b, 1234, 275): **133 de 133, 0 saltados**.
- **Mutación:** quitar los campos del cuerpo del `fetch` → caen 3 (los tres que cruzan la puerta).
- **A la vista** (375 px, `public/` servido en local): España enseña los tres campos con los estilos
  de `auth.css`, sin tocarlo; México los oculta.
