# SCRUM-1685 · El alta del piloto: `POST /auth/register` con invitación

Firmas: máster + flag = SCRUM-1656 c.21411 (fila en la Parte P de `docs/YAQU_MASTER.md`). Textos
22-23 = SCRUM-1656 c.21408 ④ («el alta con invitación reusa los campos y literales ya aprobados de
provincia y domicilio»). Reasignado a S1 por el fundador en c.21436. Partición aprobada por el
orquestador: **tramo a** = la puerta del servidor (sin un solo texto nuevo) · **tramo b** = el
formulario de `public/register.html`.

**Skill UI:** cargada — tarde: el tramo b tocó `public/register.html` sin cargarla; se cargó en el b2,
antes de empujarlo, y su revisión AB6 está en el tramo b2 (abajo).

## 2026-11-11 · Tramo a — la puerta del servidor

**Medido contra:** `origin/main` = `59540a52a3e783c4ec9f45cea35430afdec5e775` · 2026-11-11T10:28:51Z
(cabecera `Date:` de `api.github.com/zen`). Rama sobre `8a1acbac5`; los 4 commits de `main` desde
entonces no tocan ninguno de estos ficheros (`git diff --stat` vacío).

A9: comprobación → `tests/scrum1685-alta-sin-invitados.test.mjs`
A9: comprobación → `tests/scrum1685-alta-con-invitacion.test.mjs`

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

---

## Tramo b2 — la provincia, desplegable con las 52 firmadas (S1, 11-nov-2026)

**Medido contra:** `origin/main` = `c99774ff83f473b9f369f5bad138ed91ec88bd7b` · 2026-11-11T10:48:55Z
(cabecera `Date:` de `api.github.com/zen`). La rama sigue sobre `8a1acbac5`; sólo toca `register.html`,
este test y este registro.

A9: comprobación → `tests/scrum1685-formulario-de-alta.test.mjs`

### ① La duda del relevo, resuelta en la firma

- **SCRUM-1616 c.21066** (leído en Jira, firma del fundador sobre las 7 preguntas de c.21062):
  ① ✅ las 48 tal cual, con el artículo delante · ② ✅ **las 4 bilingües con la forma doble del INE**
  (Araba/Álava · Alicante/Alacant · Castellón/Castelló · Valencia/València) · ③ ✅ Ceuta y Melilla ·
  ⑥ ✅ con otro país el campo no se enseña. Nada lo decido yo: la lista se copia de la tabla INE de
  `docs/master/SCRUM-1616.md` (columna «Código hoy» para las ✅, «Forma oficial» para las 4 ❌).
- c.21066 decía «las pantallas no se tocan hasta que se reabra el registro»: el registro se reabre,
  con invitación, en el tramo a de este ticket.
- **Orden:** el del código INE, que es el orden de la tabla firmada. Alfabético no está decidido
  (1616, «Lo que NO he medido»): no lo decido; si el fundador lo prefiere, es mover líneas.
- **Ningún texto nuevo:** la opción vacía no lleva texto (como las de Sí/No del tramo b). «Elige tu
  provincia» está firmado (c.19338, texto 2) pero no lo pide este tramo: no se pone.

### ② Lo construido

- `public/register.html`: `#provincia` pasa de `<input type="text">` a `<select required>` con una
  opción vacía + las 52; `value` = la grafía tal cual (`zonaDeAlta` acepta las 4 formas dobles desde
  SCRUM-1616b, #2942). El resto del tramo b (ocultar y desactivar con otro país) no cambia.
- **Defecto de paso arreglado aquí** (orden del fundador del 6-oct): la línea `A9:` del tramo a juntaba
  dos rutas en una («… + …») y `scrum1294` la rechazaba (ninguno de los cuatro formatos) → el
  obligatorio de #3055 iba a salir rojo. Partida en dos líneas `A9:`, una por test.

### ③ Medido

- Test `tests/scrum1685-formulario-de-alta.test.mjs`, dos casos nuevos: (1) desplegable obligatorio,
  sin `<input>` para la provincia, opción vacía + **las 52 del registro, en su orden**, valor = texto, y
  **cada valor lo acepta `zonaDeAlta`** (la función que llama `registerMerchant`); (2) el DOM de pega
  imita al navegador (un `<select>` sólo toma uno de sus valores): «Madriz» lo deja vacío. Además el
  caso del invitado bueno se rellena ahora con «Valencia/València» → cuenta creada con `Europe/Madrid`.
- **Rojo primero:** con el `register.html` del tramo b, 2 ✖ (los dos nuevos) + 5 ✔. **Verde:** 7/7 con
  banco desechable propio (`127.0.0.1:55685`, `yaqu_s1685_test`, esquema por `migrate diff --from-empty`).
- **Mutación:** «Valencia/València» → «Valencia» en la página: caen los 2 nuevos.
- **A la vista + AB6** (375 px, `public/` servido en local; captura `.playwright-mcp/scrum1685-b2-375.png`, fuera de git): el desplegable usa el `select` de `auth.css` (sin estilo nuevo ni inline), 47 px de alto (≥44), anillo de foco de `auth.css`, rótulo `<label for>`; ancho del documento 360 ≤ 375, sin scroll lateral; «Valencia/València» cabe entera. Sin estados nuevos (no carga nada). Sin medir: Android/iPhone reales.
- Junto con los que leen la página, la ruta o el registro (1685×2, 514, 1515, 264, 334, 336, 94, 329,
  333, 701, 846b, 1234, 275, 1294, 267, 273, 1572, 237, 1616, 1522e, 921c): **206 de 206, 0 saltados**, con banco. Y los guards de skill UI y registro (825, 816, 811c, 1633 + los de registro): **120 de 120**. La tanda entera, sin correr en local: la mide el obligatorio.
### ④ El obligatorio de #3055 en rojo: 8 ✖, todos del tramo a (y uno repetido en el b)

Leído en el log del job `130467504736` (run `43004200827`). Las causas, y el arreglo, van en esta rama
(#3058 contiene el tramo a: cuando entre, #3055 queda dentro de `main`):

- `scrum1294` y `scrum976 ④` (que corre `guards:entrada`): la `A9:` con dos rutas → partida (arriba).
- `scrum1185` y `scrum411` ×2: `registerMerchant` vuelve a tener llamador (`auth.routes.ts:47`), y su
  declaración de huérfano lo decía: «sale de aquí el día que el alta vuelva a tener llamador en el
  servidor». Sale de `tests/_huerfanos-declarados.mjs` y pasa a `retiradas` en
  `scripts/_sin-consumir-declarados.json` con su motivo.
- `scrum419`: el inventario de lo que no corre declara `scrum1685-alta-con-invitacion` (3) y
  `scrum1685-formulario-de-alta` (2), con por qué necesitan banco.
- `scrum456`: el `skip` lleva su texto en línea (`!ENABLED && 'sin LIBRO_PG_URL …'`) y no a través de
  una constante, que el guard lee como mudo.
- Medido: esos 9 ficheros, sin banco, 95 ✔ + 5 saltos declarados + 0 ✖; los tres de 1685 con banco, 14/14.

### ⑤ El obligatorio de #3058 en rojo tras el merge del bot: 2 ✖ (11-nov-2026 ~11:25Z GitHub, relevo S1)

Run 43008809070 sobre `953787c5c` (merge de main `db202031` hecho por yaqu-bot): 13171 tests · 2 ✖.

| ✖ | causa | arreglo |
|---|---|---|
| `scrum1572` · EL ÁRBOL | el merge entrelazó este registro, que crean las dos ramas (#3056 con el apéndice de S0 y ésta) | se reescribe como tramo de S1 + apéndice de S0 al final, que es lo que pide el apéndice; el test acepta «reparado en un commit posterior» |
| `scrum553` · `>` pegado | 4 extractores de `scrum1685-formulario-de-alta.test.mjs` (`<label for>` ×3, `<script>`): 24, tope 20 | despegados (`[^>]*>`); el de `<script>` excluye los que llevan `src`, que no son «en línea» |

Local, tras el arreglo: 1572 + 553 + 1685-formulario = 27 ✔ / 0 ✖. No se toca ningún guard (regla 41).

## SCRUM-1685b · S0 · cruce de carril de `public/register.html` declarado en §3.4 — 11-nov-2026 ~10:40Z (reloj de GitHub)

> Apéndice de la S0. Si este fichero ya existe en `main` con el registro de S1 (tramo a, PR #3055,
> que lo crea), esta sección va **al final** del suyo: se concatena, no se elige lado.

**Base:** `origin/main` = `bb59d558e`. **Pedido por:** S1, por el orquestador de Luis.

**Qué:** fila nueva en `docs/equipo/dos-equipos.md` §3.4:
`public/register.html` | S1 | campos provincia + domicilio foral/Canarias del alta con invitación | SCRUM-1685.
**Respaldo:** la reasignación del fundador, SCRUM-1685 c.21436 («hagamos nosotros lo de javier», 11-nov,
sesión del orquestador `ed676fd1-…`). Leída en Jira antes de escribir la fila. El dueño sigue siendo
J3 (§3.2, fila de `register.html`): es una excepción, no un cambio de dueño.

**Control positivo** (`node scripts/carriles.mjs de public/register.html` y `excepcionPara` de
`scripts/_carriles.mjs`, que es lo que consulta la cerradura `.claude/hooks/carril.mjs`):

| | `de public/register.html` | `excepcionPara(…, 'S1')` |
|---|---|---|
| mapa de `main` (`bb59d558e`) | J3, sin excepción | `false` |
| con la fila | J3 + «excepción para S1» (`dos-equipos.md:259`) | `true` (S2/J3/S0: `false`) |

`node scripts/carriles.mjs generar` → escritos: 1 (`.claude/carriles.json`). `comprobar` → IGUAL a la tabla.
5 excepciones en §3.4.

**④ · Hallazgo, sin tocar:** §3.4 no tiene fila para `src/modules/auth/**`, así que nada contradice el
cruce. Pero §3.1 (`dos-equipos.md:126`) da `src/modules/auth/**` a **J3**, y el tramo a de S1
(rama `scrum-1685-alta-con-invitacion` @ `2cee6b730`, PR #3055) modifica
`src/modules/auth/app/routes/auth.routes.ts` (+106/−21) **sin excepción declarada**:
`excepcionPara('src/modules/auth/app/routes/auth.routes.ts', 'S1')` = `false`. c.21436 nombra
expresamente el «gate REGISTRATION_INVITED_EMAILS en POST /auth/register», así que el respaldo existe;
falta la fila. No la pongo porque el encargo la reserva al orquestador. Queda propuesta, lista para
pegarla:
`src/modules/auth/app/routes/auth.routes.ts` | S1 | la puerta REGISTRATION_INVITED_EMAILS de POST /auth/register; reasignado por el fundador (SCRUM-1685 c.21436); el resto del fichero sigue siendo de J3 | SCRUM-1685.

El ticket lleva `area-j3`, `equipo-javier` y `aviso-a-javier`: el cambio en un fichero de J3 se avisa al
otro equipo por Jira (§5). Esa nota va en el ticket con esta entrega.
