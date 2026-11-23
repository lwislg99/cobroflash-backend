# SCRUM-1781

## SCRUM-1781 · Prefijo de WhatsApp aparte (+34) en el alta y al crear clientes, y «Tipo de cliente» (SCRUM-1782): medición, solo lectura

**Puesto:** J2 (jv-j2dm) · **Rama:** `scrum-1781-prefijo-y-tipo-de-cliente` · 21-nov-2026
**Medido contra:** `origin/main` = `fea1c00078654d8d617af055de94f2b627df07ce` · 2026-11-21T03:40:58Z (cabecera `Date:` de `gh api -i zen`)
A9: aviso → cicatriz J2 «llamé a Jira con el cloudId `lwislg99.atlassian.net`, sacado del nombre del repositorio y no del sitio; la herramienta contestó `No cloud ID found` y lo corregí con `yaqu.atlassian.net`, que estaba en la memoria del orquestador» — no se pudo comprobar: el cloudId se teclea en cada llamada a la herramienta de Jira, que ningún guard del repositorio ve

Solo docs. `src/`, `public/` y `prisma/schema.prisma` se LEEN. Nada contra staging ni producción.
`yaqu.app/health` daba el mismo sha que `origin/main`, así que lo leído es lo desplegado. **NO medido:**
no he abierto ninguna pantalla en yaqu.app (no lo he intentado: no tenía sesión de comercio); todo lo de
abajo es «leído en el código», no «visto».

### ① SCRUM-1781 · el prefijo, pantalla por pantalla

| superficie | fichero:línea | carril | ¿prefijo aparte con +34? |
|---|---|---|---|
| Clientes → «Nuevo cliente», Teléfono | `public/dashboard/js/customersView.js:1348` | J2 | SÍ (SCRUM-578); España al abrir en `:1745` |
| Clientes → «Nuevo cliente», Móvil (WhatsApp) | `public/dashboard/js/customersView.js:1378` | J2 | SÍ (SCRUM-590); España al abrir en `:1749` |
| Ficha → «Editar cliente» | `public/dashboard/js/customerDetailView.js:1481` | J2 | NO, decisión escrita en `customerDetailView.js:1554` (SCRUM-590). Es editar, no crear |
| Alta del comercio (onboarding), «Tu WhatsApp» | `public/dashboard/js/onboardingView.js:160` | J3 | NO |
| Onboarding, primer cliente | `public/dashboard/js/onboardingView.js:389` | J3 | NO |
| Presupuesto rápido de Inicio (crea cliente) | `public/dashboard/js/homeView.js:1018` | S2 (Luis) | NO; su ejemplo es un prefijo mexicano («521…») |
| Configuración, WhatsApp del comercio | `public/dashboard/js/settingsView.js:347` | J3 | NO (no medido a fondo) |
| Admin de plataforma | `public/admin.html:435` | S2 (Luis) | NO (superadmin, no es el alta) |

Carril medido con `node scripts/carriles.mjs de <ruta>` en cada fila. **Lo de J2 que pide el literal
(«cuando crees clientes») ya está construido;** lo que falta es de J3 y de S2. No he escrito nada fuera
de mi carril.

**Formato guardado (no cambia):** una cadena de dígitos con el prefijo delante y sin «+». Comercio:
`src/core/validation/schemas.ts:468` (`whatsappPhone`, 6-20 caracteres) y `normalizePhone` en
`src/core/utils/utils.ts:32` al usarlo. El formulario de Clientes compone prefijo + número sin
duplicarlo (`customersView.js:1195`). Las pantallas de J3/S2 pueden reutilizar
`prefijosPais.selectorDePrefijo` (`public/dashboard/js/prefijosPais.js:117`), que ya pinta bandera,
nombre (de `Intl.DisplayNames`) y «+34»: no hace falta texto nuevo para el selector.

### ② SCRUM-1782 · «Tipo de cliente»: STOP

El selector de arriba guarda `Customer.contactKind` (forma jurídica); «Tipo de cliente» guarda
`Customer.tipoDestinatario` (capacidad fiscal). `prisma/schema.prisma:228` deja escrita la decisión
del fundador del 24-ago-2026 de no mezclarlos ni deducir uno del otro (un autónomo es PERSONA y
EMPRESARIO). Lectores:

| lector | fichero:línea |
|---|---|
| Portón de la factura con inversión del sujeto pasivo (camino de emisión) | `src/modules/invoicing/domain/destinatarioIsp.ts:81` |
| Plazo legal de facturación | `src/modules/jobs/domain/pendientesFacturar.service.ts:24` |
| Ruta de facturas | `src/modules/system/app/routes/invoicesAdmin.routes.ts:157` |
| Aviso en la bandeja | `public/dashboard/js/tipoDestinatarioPendiente.js` |

Quitarlo de los dos formularios deja a un cliente nuevo sin forma de declararse empresario desde la
ficha, y con eso el portón ISP rechazaría su factura. Algo fiscal lo lee → **paro** y no se quita.
Preguntas ✅/❌ para el fundador en Jira, SCRUM-1782 c.22260; las de SCRUM-1781, en c.22259.

### Aceptación → dónde se ve

| aceptación (literal) | dónde se ve |
|---|---|
| «cuando se une un nuevo merchant … el prefijo a parte … preseleccionado +34» | NO HECHO → `onboardingView.js` es de J3; al orquestador (c.22259) |
| «También cuando crees clientes» | `public/dashboard/js/customersView.js:1348` y `:1745` (ya en main, SCRUM-578/590); presupuesto rápido de Inicio NO HECHO → S2 (Luis), c.22259 |
| «El tipo de cliente quitalo» (SCRUM-1782) | NO HECHO → STOP fiscal, decisión del fundador en c.22260 |

# SCRUM-1781b · El prefijo aparte, con +34 preseleccionado, en el alta del comercio, su primer cliente y Configuración (J3)

**Medido contra:** `origin/main` = `fea1c00078654d8d617af055de94f2b627df07ce` · 2026-11-21T03:58:13Z (cabecera `Date:` de `gh api -i zen`)
A9: aviso → cicatriz J3 «Edité la interfaz antes de cargar la skill `yaqu-premium-ui`, que CLAUDE.md y el encargo piden ANTES; la cargué a mitad y revisé el cambio contra ella.» — no se pudo comprobar: cargar una skill no deja rastro en el árbol que un test pueda leer
**Skill UI:** cargada · después de la primera edición de `onboardingView.js`, no antes (ver la A9). `scrum811c` exige que se DECLARE, no el orden: por eso es aviso y no comprobación.

**Puesto:** J3 (jv-j3cn) · **Rama:** `scrum-1781b-prefijo-en-alta-y-ajustes` (lleva dentro el merge de `scrum-1781-prefijo-y-tipo-de-cliente` @ `c8d5545aa9f3dff4cee641267975db849df13286`, por orden del orquestador, para que este tramo se AÑADA al fichero de J2 y no lo cree otra vez).

**Qué cambia.** Las tres pantallas de J3 que piden un WhatsApp montan el selector de `prefijosPais.selectorDePrefijo` (el de Clientes, SCRUM-578/590) en la fila `.campo-telefono` que ya existe, con +34 por defecto:

- alta, paso 1, «Tu WhatsApp» (`#ob-phone`) — `public/dashboard/js/onboardingView.js`, `montar` del paso 1;
- alta, último paso, «Su WhatsApp» del primer cliente (`#ob-cust-phone`) — `montar` del paso WOW; lo compuesto es lo que recibe `openQuickQuoteModal`;
- Configuración, `whatsappPhone` — `public/dashboard/js/settingsView.js` (bloque `[J3] SCRUM-1781b`): reparte lo guardado al abrir y compone al guardar.

La composición y el reparto viven en `telefonoConPrefijo` (nivel superior de `onboardingView.js`, que carga antes que `settingsView.js`) y siguen la regla de `numeroCompleto`/`repartirNumero` de `customersView.js`, que es de J2 y no se ha tocado. **El valor guardado no cambia de formato** (dígitos con el prefijo delante; si ya viene escrito, no se duplica). Sin servidor, sin texto nuevo, sin CSS nuevo, sin `style=` ni `on*=` en cadenas de `innerHTML`.

**Cómo se mide.** `tests/scrum1781b-prefijo-en-alta-y-ajustes.test.mjs` monta las pantallas reales en el banco de vistas y compara lo que guardan con lo que guarda «Nuevo cliente» en Clientes para el mismo prefijo y lo mismo tecleado (3 casos: +34 con el número nacional, +34 con el número ya prefijado, +52), más el reparto al abrir Configuración y al volver atrás en el alta. Rojo antes del cambio (5/5, por «el teléfono no va en una fila .campo-telefono con su prefijo»); verde después (5/5). Una mutación a mano («componer» que siempre antepone el prefijo) tumbó 3 casos; se hizo una vez, sin guion en git, así que por la A3 **no cuenta como evidencia**.

**Dirigida:** 69 ficheros (los diez del encargo —1773, 836, 700, 710b, 719, 1294, 267, 273, 525d, 854— y todo test que nombra `onboardingView`, `settingsView`, `prefijosPais` o `campo-telefono`): 668 casos, 667 verdes, 1 rojo (`scrum854`, por faltar este registro; se repite tras escribirlo). Suite entera: NO corrida (sólo el tramo 1/15, 814 casos, 0 fallos): el orquestador la quitó del encargo por contexto.

**NO medido:** no he visto las pantallas en yaqu.app ni en un navegador (no lo he intentado: sin sesión de comercio), ni capturas antes/después de la checklist AB6. La fila `.campo-telefono` mide 44 px por el CSS que ya existía; el ancho en móvil no lo he comprobado.

**Para el fundador (✅/❌), sin tocar nada hasta que conteste:** los textos de ayuda que dicen que el prefijo va dentro siguen igual porque cambiarlos es texto que ve el usuario (regla 39): el marcador «Ej: 34XXXXXXXXX (con código de país)» de `#ob-phone`, «(con código de país)» y «Ej: 34XXXXXXXXX» del primer cliente, y el rótulo «Teléfono WhatsApp (E.164 sin +)» de Configuración. Con el prefijo aparte dicen algo que ya no hace falta (si alguien teclea el 34, no se duplica). ¿Se quitan? ✅/❌. Y la parte de Inicio (`homeView.js:1018`) es de S2 (Luis): aviso, no tocada.

### Aceptación → dónde se ve (1781b)

| aceptación (literal) | dónde se ve |
|---|---|
| «Cuando se une un nuevo merchant y le puda poner número de whatsapp tiene que salir el prefijo a parte para seleccionar y preseleccionado e +34 español» | `tests/scrum1781b-prefijo-en-alta-y-ajustes.test.mjs` ① y ⑤ (alta) y ③ ④ (Configuración); en yaqu.app: NO visto |
| «También cuando crees clientes» | ② (primer cliente del alta) en el mismo test; Clientes ya en main (fila de arriba); Inicio NO HECHO → S2 (Luis) |

# SCRUM-1781c · Fuera los textos de ayuda que dicen que el prefijo va dentro del número (J3)

**Medido contra:** `origin/main` = `db789fd0fb7d604b718529ca1d861e351fc2e756` · 2026-11-21T04:13:22Z (cabecera `Date:` de `gh api -i zen`)
A9: comprobación → `tests/scrum1781c-sin-ayuda-de-prefijo.test.mjs`
**Skill UI:** cargada · antes de la primera edición de `onboardingView.js` y `settingsView.js`.

**Puesto:** J3 (jv-j3co) · **Rama:** `scrum-1781c-sin-ayuda-de-prefijo`, nacida de `scrum-1781b-prefijo-en-alta-y-ajustes` @ `28b7a0d71aa9d40903dd6569feac3f6c9a9e919b` (PR #3287, abierto al empezar), con `origin/main` ya dentro.

**Firma (regla 39):** SCRUM-1781 c.22275, respuesta literal del fundador «1-Sí quitalo» a la pregunta de c.22274. Solo QUITAR, ningún texto nuevo.

**Qué cambia (solo se quita):**

- alta, paso 1, «Tu WhatsApp» (`#ob-phone`, `public/dashboard/js/onboardingView.js`): fuera el marcador «Ej: 34XXXXXXXXX (con código de país)». El campo queda sin marcador; el rótulo y su aclaración «(te avisamos ahí cuando te acepten o paguen)» no se tocan.
- alta, primer cliente, «Su WhatsApp» (`#ob-cust-phone`, mismo fichero): fuera «(con código de país)» del rótulo y el marcador «Ej: 34XXXXXXXXX». El rótulo queda «Su WhatsApp».
- Configuración (`public/dashboard/js/settingsView.js`): el rótulo «Teléfono WhatsApp (E.164 sin +)» queda «Teléfono WhatsApp».

Ningún hueco pide texto: los dos campos sin marcador llevan al lado el desplegable con «🇪🇸 España +34» (SCRUM-1781b). Ningún censo de microcopy exigía esos literales (barrido de `tests/`, `scripts/` y `docs/microcopy/` por «34XXXXXXXXX», «con código de país» y «E.164 sin +»: solo comentarios en `scrum402`, `scrum575b` y `scrum578` sobre el rótulo VIEJO de Clientes, y un `scrum578` que exige que NO esté; ninguno tocado).

**Cómo se mide.** `tests/scrum1781c-sin-ayuda-de-prefijo.test.mjs` monta las tres pantallas en el banco de vistas y busca los tres literales en el texto, el `placeholder` y el `title` de cada nodo, declarando cuántos nodos miró (263 paso 1 · 252 primer cliente · 411 Configuración). Control positivo SEMBRADO: el mismo buscador, sobre nodos fabricados con cada literal, lo caza. Control positivo de la pantalla: el rótulo sigue y el desplegable de prefijo sigue con +34. Rojo antes del cambio 3/4 (el sembrado pasa; los tres de pantalla caen por «quedan textos de ayuda del prefijo», no por CIEGO); verde después 4/4.

**Dirigida:** 290 ficheros (los del encargo —1773, 836, 700, 710b, 719, 1294, 267, 273, 525d, 854—, 1781b, 402, 575b, 578, los censos 1157/1215/1415 que existan y todo test que nombra `onboardingView`, `settingsView` o `microcopy`): 2.794 casos, 2.785 pass · 0 fail · 9 skipped (suman). Suite entera: ver la entrega.

**NO medido:** no he visto las pantallas en yaqu.app ni en un navegador (no lo he intentado: sin sesión de comercio); sin capturas AB6.

### Aceptación → dónde se ve (1781c)

| aceptación (literal, c.22275) | dónde se ve |
|---|---|
| «fuera el marcador «Ej: 34XXXXXXXXX (con código de país)» del alta» | `tests/scrum1781c-sin-ayuda-de-prefijo.test.mjs` ①; en yaqu.app: NO visto |
| «(con código de país)» y «Ej: 34XXXXXXXXX» del primer cliente del alta | ② del mismo test |
| «(E.164 sin +)» del rótulo de Configuración, que queda «Teléfono WhatsApp» | ③ del mismo test |
