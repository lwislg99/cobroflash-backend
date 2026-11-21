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
