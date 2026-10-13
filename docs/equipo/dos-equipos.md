# Dos equipos, dos jefes

18-sep-2026 · SCRUM-951b · escrito por la Sesión 0 sobre `origin/main` = `972b51b384e0b21e0265787392eb5c865b98cc4a`

> **Dueña de este fichero: la Sesión 0 del equipo de Luis**, igual que `00-normas-comunes.md`. El equipo
> de Javier propone cambios por Jira (§5). Una mano por fichero: cuatro manos en un fichero son un
> conflicto garantizado (`00-normas-comunes.md`, cabecera).

Desde el 18-sep-2026 YaQu tiene **dos equipos**, cada uno con su jefe, su orquestador y sus puestos, y **los
dos trabajan igual**: las mismas normas (`00-normas-comunes.md`), el mismo método de orquestador
(`orquestador.md`), la misma automatización (`scripts/equipo/`) y la misma máquina tipo (Windows, mismo plan
de Claude, mismas herramientas; trampas en `trampas-del-entorno.md`).

**Lo que NO comparten, y lo cambia todo:** los dos orquestadores **no pueden hablarse**. Están en máquinas
distintas y con cuentas de Claude distintas, así que el canal directo (`ListAgents` + `SendMessage`) no llega
de un equipo al otro, y **la memoria de una máquina no la ve nunca la otra**. Lo único que ven los dos es
**Jira y el repositorio**. Todo este fichero sale de ahí.

## 1 · Los dos jefes

**Decisión del fundador (18-sep-2026 ~11:50Z, en el chat del orquestador):** Luis y Javier son **los dos
JEFES**.

- Cualquiera de los dos da el **«sí» (GO)** de dinero, de lo fiscal y de la base de datos.
- Sigue valiendo que **el GO de un despliegue que toca el cobro se escribe en el chat de la sesión que
  despliega** (`orquestador-autonomo.md` §7). Un GO reenviado por otra sesión no vale, lo dé quien lo dé.
- Las autorizaciones **no se heredan** entre sesiones (A19), sea cual sea el jefe que las dio.
- Donde las normas dicen «el fundador» para pedir un sí, vale **un jefe**. Cada jefe habla con **su**
  orquestador.
- ⚠️ **PENDIENTE de un jefe, y no se supone:** si un jefe puede cambiar una decisión que el otro dejó escrita
  en `limites-del-fundador.md` (por ejemplo, «la credencial de staging no se rota»). Hasta que se escriba,
  una decisión escrita **solo la cambia quien la tomó**.

## 2 · Los puestos

Cada puesto es **un empleado con un ÁREA grande que da valor, no una tarea** (regla del fundador,
18-sep-2026). Un ticket va al puesto dueño de su área; que otro esté libre no lo hace dueño (§11bis de
`orquestador.md`, A20).

**Nombres de sesión.** Salen de la configuración de cada instalación (`scripts/equipo/`, SCRUM-951a de la
S5): **prefijo del equipo + puesto**. El equipo de Luis va sin prefijo (`orquestador`, `sesion-0` …
`sesion-5`); el de Javier, con el prefijo que declare su configuración. **Para el equipo de Javier se
declaran así** (SCRUM-951c, casado con el código de 951a por la S5 el 18-sep): prefijo `jv-` y puestos
`orquestador,j1,j2,j3,j4,j5,j6`, así que sus sesiones son `jv-orquestador` y `jv-j1` … `jv-j6`, y sus
traspasos, en la memoria de SU máquina, `project_orquestador_traspaso.md` y `project_j1_traspaso.md` … (el
lanzador quita el prefijo). Si su configuración declara otros, **manda la configuración** y se corrige aquí.

### 2.1 · Equipo de Luis

La tabla con carril, ficheros y lo que no se le manda está en `orquestador.md` §11bis. En una línea:

| puesto | área | cambio del 18-sep |
|---|---|---|
| **S0** | consultoría y auditoría: «¿esto existe hoy?», filtro de las afirmaciones de SU orquestador, dueña de `00-normas-comunes.md`, `dos-equipos.md` y `trampas-del-entorno.md` | deja la **competencia** (pasa a J5). Termina la firma de Holded en su máquina y deja el resultado en `docs/competencia/` para que J5 lo herede |
| **S1** | servidor: importes, presupuestos, gastos, mantenimientos, y el servidor de todo lo que no sea de J1-J3 | deja **lo fiscal** (J1) y **los medios de pago** (J2) |
| **S2** | pantallas del panel y los contenedores comunes del front | deja las pantallas de **facturas, clientes, pagos, alta y configuración** |
| **S3** | bancos, sondas e instrumentos de medida | hoy en pausa; su carril se queda con ella |
| **S4** | producto: microcopy firmada, parte, albarán, lista de Trabajos, **prototipos** | — |
| **S5** | automatización y eficiencia: CI, vigías, relevo de sesiones, gasto de tokens | — |

### 2.2 · Equipo de Javier (aprobado por el fundador el 18-sep-2026 ~12:30Z)

Los tres primeros **CONSTRUYEN** servidor y pantallas de su área. Los tres últimos no construyen producto.

| puesto | área: lo que se le manda | lo que NO se le manda |
|---|---|---|
| **J1** · Facturación y VeriFactu | facturas, VeriFactu, rectificativas (R1) y anulación, libros, y la entrega a la gestoría (SCRUM-280, 322, 323; con revisión de J4 porque salen datos de clientes a un tercero: propuesta de la S0, sin decidir). **Prioridad nº 1 del máster** (SIF-1). Revisa todo lo que borre o anonimice datos (regla 29: una factura emitida no se borra NUNCA) | presupuestos, medios de pago |
| **J2** · Clientes y cobro (el CRM) | ficha de cliente completa; historial de presupuestos, trabajos y facturas; seguimiento y recordatorios; qué debe cada cliente; los medios de pago (Stripe Connect, Bizum, webhooks) hasta encender el cobro; la supresión y la portabilidad de los datos del CLIENTE FINAL | la emisión de la factura (J1) |
| **J3** · Alta y crecimiento | registro, prueba, suscripción a YaQu, configuración, del alta al primer presupuesto enviado, y retención; el borrado y la anonimización de la cuenta del MERCHANT; construye las páginas legales (los textos los propone J4) | lo fiscal, el cobro al cliente final |
| **J4** · Legal y cumplimiento | privacidad, RGPD, textos legales, preguntas al asesor. **Propone; firma un jefe.** Primer caso: SCRUM-950 | construir código |
| **J5** · Competencia y producto | recorre la competencia y la convierte en propuestas priorizadas en Jira; **hace los PROTOTIPOS** de su equipo (paso 4 de `orquestador.md` §4bis). Hereda `docs/competencia/` | construir código |
| **J6** · Calidad y seguridad | sus guards nuevos, la seguridad, y **el filtro de su equipo**: el PASO 0 «¿esto existe hoy?» (paso 3 de `orquestador.md` §4bis) y las afirmaciones de SU orquestador, que apunta en `afirmaciones-verificadas-javier.md` con las mismas tres columnas que `afirmaciones-verificadas.md` | `ci.yml` y los vigías (S5); los bancos e instrumentos (S3) |

**La ficha de cada puesto** (`docs/equipo/puesto-j1.md` … `puesto-j6.md`) y la de su orquestador
(`docs/equipo/orquestador-javier.md`) las escribió la Sesión 0 en SCRUM-951c, para que el equipo de Javier
arranque sin haber visto nada: la pregunta del puesto, su área, sus ficheros, lo que no toca, sus STOP y sus
primeros tickets medidos en Jira. **Desde ahí, cada ficha es de su puesto**, que le añade su canon como en las
`sesion-N.md`. Si una ficha y esta tabla discrepan, **manda esta tabla**.

⚠️ **Los puestos J1 … J6 no son las secciones J1 … J7 del máster.** La **Parte J** del máster es la
especificación de WhatsApp (plantillas, opt-in, estados…), y **«J6» en el máster y en `CLAUDE.md` es la
política anti-spam** (regla 28), que pertenece al canal de J2. Coincidencia de nombre, no de puesto.

⚠️ **Etiquetas viejas que NO se reutilizan:** en Jira ya existen `sesion-J1`, `sesion-J2` y `sesion-L1` …
`sesion-L4`, con otro significado (22 tickets de agosto de 2026, contados en Jira el 18-sep; 10 de ellos
con `sesion-J1`). Los puestos nuevos se
etiquetan con `area-j1` … `area-j6` (§4). Que J1 se llame igual que una etiqueta vieja es una coincidencia de
nombre, no de puesto.

## 3 · 🔴 Quién es dueño de qué fichero — sin ningún puesto repetido

**Regla general:** cada ruta tiene **UN** dueño. Si un ticket necesita tocar una ruta ajena, se le pide al
dueño por Jira (§5); **no se construye en su terreno** (`orquestador.md` §4bis, paso 5).

**Regla de los CONTENEDORES comunes** (ficheros que toca toda pantalla o toda ruta nueva): tienen un dueño,
y **el otro equipo añade SOLO su bloque o su línea, marcada con su puesto** (`/* J1: … */`, `// J2: …`),
**en un PR suyo**. No hace falta aviso en Jira: basta el PR. Nunca reescribe lo que no es suyo.

Medido el 18-sep-2026 sobre 405 ficheros de producto (294 de `src/`, 111 de `public/` sin imágenes),
clasificados por carpeta y nombre, y **por contenido** donde el nombre engañaba (se dice en cada caso).

> 🔴 **Las tablas §3.1 y §3.2 las LEE UN GUARD DEL OTRO EQUIPO, y su formato no se cambia sin avisar.**
> `tests/scrum514-aprobado-y-aplicado.test.mjs` (equipo de Javier, SCRUM-1334) las parsea en cada pasada
> para saber de qué puesto es un fichero. Si el formato cambia, el rojo le sale a quien las tocó, en el
> check obligatorio. Lo que lee, y por tanto lo que no se mueve sin un aviso por Jira a su orquestador (§5):
> los títulos de §3.1 y §3.3 tal como empiezan hoy (corta entre los dos, así que §3.2 va en medio) · cada
> fila en UNA línea que empieza por la barra · la ruta en la primera celda, entre comillas invertidas · el
> dueño en la segunda, en negrita y con la forma letra + cifra · la fila del resto, escrita «todo lo demás
> de» y su ruta · y un suelo de 25 filas con dueño (medidas el 2-oct-2026 con su misma función: 29).
> Añadir, quitar o cambiar de dueño una fila con este formato NO necesita aviso: es para lo que las lee.
> (SCRUM-1411)

### 3.1 · Servidor (`src/`)

| ruta | dueño | nota |
|---|---|---|
| `src/modules/invoicing/**`, `src/modules/fiscal/**`, `src/lib/invoicing.ts` | **J1** | |
| `src/modules/system/invoiceAdmin.ts`, `system/app/routes/invoicesAdmin.routes.ts`, `system/domain/flagFiscal.service.ts` | **J1** | viven en `system/`, pero son facturas |
| `billing/domain/invoiceWhatsApp.service.ts`, `correoDeFacturaEnviado.ts`, `envioDelDocumento.ts` | **J1** | el ENVÍO de la factura. `envioDelDocumento` se comprobó por contenido: lo importan cobros, trabajos y facturas, **no** presupuestos, así que no es de S1 |
| `src/modules/billing/**` (el resto: pagos, cobros, recibos, Bizum, tarjeta, métodos de cobro, `invoiceReminder`) | **J2** | `invoiceReminder` es el recordatorio de COBRO |
| `billing/app/routes/stripe.routes.ts` | **J2** (contenedor) | ⚠️ por contenido: UN webhook que atiende pagos del cliente (`mode === 'payment'`) y la suscripción a YaQu (`mode === 'subscription'`). J3 mantiene su bloque marcado (decidido por el orquestador, 18-sep) |
| `billing/app/routes/subscriptions.routes.ts`, `billing/domain/stripePrices.ts`, `billing/domain/founding.ts` | **J3** | la suscripción a YaQu |
| `src/modules/payments/**`, `src/integrations/stripe.ts`, `src/integrations/mercadopago.ts` | **J2** | |
| **el canal de WhatsApp:** `src/integrations/whatsapp.ts`, `whatsappTemplates.ts`, `whatsappPolicy.ts`, `whatsappNotifications.ts`, `messaging/domain/whatsappLog.service.ts`, `src/modules/whatsappBot/**` | **J2** | decisión del orquestador (18-sep): es la comunicación con el cliente. Sigue la regla 1 (todo WhatsApp por `whatsapp.ts`) y las **plantillas de Meta son STOP de un jefe**. Presupuestos (S1) y facturas (J1) lo USAN, no lo cambian |
| `system/customerAdmin.ts`, `customerEvents.service.ts`, `tagsDelCliente.ts`, `system/app/routes/customersAdmin.routes.ts`, `customerPortal.routes.ts`, `system/domain/importarClientes.service.ts`, `identificadoresDuplicados.ts` | **J2** | |
| `src/modules/auth/**`, `messaging/domain/lifecycle.service.ts`, `weeklyDigest.service.ts`, `system/domain/soporte.ts` | **J3** | |
| `system/merchantAdmin.ts` | **J3** (contenedor) | ajustes del negocio; la parte de la serie fiscal es un bloque de J1 |
| `system/app/routes/supresion.routes.ts`, `system/domain/supresionMerchant.service.ts`, `anonimizarMerchant.ts`, `borradoMerchant.ts`, `exports/domain/portabilidadCompleta.ts`, `portabilidadRegistro.ts` | **J3** | ⚠️ por contenido: **todos son del MERCHANT** (SCRUM-244, art. 17 y 20 de SU cuenta), no del cliente final. La supresión del cliente final (J2) **no existe hoy**. Todo lo que borre o anonimice pasa por la revisión de J1, y exportar o borrar datos de clientes sigue siendo STOP de un jefe |
| `system/app/routes/legalPages.routes.ts` | **J3** | los textos los propone J4 y los firma un jefe |
| `exports/app/routes/exports.routes.ts` | **S1** (contenedor) | exportes de actividad; `/verifactu.xml` es un bloque de J1 y `/portabilidad.zip` de J3 |
| `system/app/routes/quoteDecisionLanding.routes.ts`, `quotes/domain/billingPlan.ts` | **S1** | la página donde el cliente acepta y firma; J2 entra solo en el paso de pago |
| `src/app.ts`, `src/api/routes.ts` | **S1** (contenedor) | una línea por ruta nueva |
| `src/core/documentos/**` | **S1** | los usan presupuesto y factura |
| `src/core/flags.ts` | **S1** | Parte P cerrada: **un flag nuevo es un cambio de máster, y lo decide un jefe** |
| `src/modules/reports/**` | **S1** | |
| todo lo demás de `src/` (quotes, jobs, expenses, maintenance, products, providers, metrics, search, team, templates, quoteRequests, ai, el resto de messaging y system, `core/`, `claude`, `gemini`, `mailer`) | **S1** | |
| `prisma/schema.prisma` | **nadie** | A5 igual para los dos equipos: decisión → ALTER aditivo en las TRES bases, **que aplica Javier también para el equipo de Luis** → un PR. El sí lo da cualquier jefe. En un ticket que espera un ALTER, **esa parte es de Javier como jefe**, no de un puesto |

### 3.2 · Pantallas (`public/`)

| ruta | dueño | nota |
|---|---|---|
| `dashboard/js/invoicesView.js`, `invoiceDetailView.js`, `invoiceAccion.js`, `invoiceActionsRegistry.js`, `libroRegistroView.js`, `facturaPreEmision.js`, `semaforoFiscal.js`, `puertaSerie.js` | **J1** | |
| `dashboard/js/customersView.js`, `customerDetailView.js`, `buscadorDeClientes.js`, `filtroClientes.js`, `csvImport.js`, `switchFormaJuridica.js`, `cobrosView.js`, `paidViaEtiquetas.js`, `selectorMetodoCobro.js`, `formaDePagoPorDefecto.js` | **J2** | `switchFormaJuridica` se comprobó por contenido: es «este CONTACTO es empresa o persona», no un ajuste fiscal. `buscadorDeClientes` lo usa el editor de presupuestos: S2 lo consume, no lo cambia |
| `dashboard/js/onboardingView.js`, `plansView.js`, `tutorial.js`, `teamView.js` | **J3** | |
| `dashboard/js/settingsView.js`, `settingsSubmenus.js` | **J3** (contenedor) | cada PESTAÑA va a su área: datos fiscales J1, formas de cobro J2, lo general J3 |
| `index.html` (landing), `login.html`, `register.html`, `precios.html`, `auth.css`, `js/atribucion.js`, `sitemap.xml`, `robots.txt` | **J3** | |
| `privacidad.html`, `terminos.html` | **J3** construye | el texto lo propone J4 y lo firma un jefe |
| `dashboard/js/jobsView.js`, `parteDetailView.js`, `albaranDetailView.js` | **S4** | |
| `dashboard/css/styles.css`, `dashboard/js/app.js`, `dashboard/js/api.js`, `dashboard/index.html`, `sw.js`, `tokens.css` | **S2** (contenedor) | toda vista nueva toca los cinco primeros: el otro equipo añade SU bloque marcado |
| `dashboard/js/quoteRevisiones.js` | **S2** | fila propia para que no haya que deducirlo de la fila general: el 7-oct-2026 un puesto tuvo que preguntarlo. Confirma al dueño que ya tenía. Decisión del orquestador de Luis, 9-oct-2026 (SCRUM-1480). Los otros 64 ficheros del panel que sólo cubre la fila de abajo siguen igual, y el dueño de cualquiera se pregunta con el comando de carriles, no se deduce |
| `dashboard/js/homeView.js` y todo lo demás de `public/` | **S2** | |

### 3.3 · Repositorio, documentos y automatización

| ruta | dueño | nota |
|---|---|---|
| `docs/equipo/00-normas-comunes.md`, `00-normas-siempre.md`, `dos-equipos.md`, `trampas-del-entorno.md`, `afirmaciones-verificadas.md` | **S0** | el equipo de Javier propone por Jira (§5) |
| `docs/equipo/afirmaciones-verificadas-javier.md` | **J6** | lo crea J6 en su primera tanda |
| `docs/equipo/orquestador.md` | **orquestador de Luis** | método común. Mientras no haya otro dueño, cada cambio se avisa al otro equipo con un comentario en Jira |
| `docs/equipo/traspaso.md` / `traspaso-javier.md` | orquestador de Luis / **orquestador de Javier** | el ESTADO va por equipo; el de Javier lo crea su orquestador |
| `docs/equipo/limites-del-fundador.md` | **orquestador de Luis** | pasa a «límites de los jefes»: cada decisión lleva quién la tomó y la fecha. El de Javier propone por Jira |
| `docs/equipo/sesion-*.md` / `docs/equipo/puesto-j*.md` | cada puesto, la suya | las `puesto-jN.md` las escribió la S0 (SCRUM-951c); el canon lo añade el puesto |
| `docs/equipo/orquestador-javier.md` | **orquestador de Javier** | solo lo que cambia para su equipo: el método es `orquestador.md` |
| `docs/equipo/prompt-tanda-orquestador.md` | contenido **S0**; el cableado, **S5** | UN solo prompt para los dos equipos |
| `docs/equipo/orquestador-autonomo.md`, `instalacion-*.md`, `scripts/equipo/**` | **S5** | |
| `.github/workflows/**` (ci, vigías, avisador, PR automático) | **S5** | J6 es dueño de SUS workflows nuevos de seguridad, si los hay |
| **infraestructura y despliegue** (Railway, región, secretos de producción, tareas sobre la base de producción: p. ej. SCRUM-863 y el fondo de SCRUM-789) | **S5** prepara y mide | decisión del orquestador (18-sep). **Lo EJECUTA un jefe**: infraestructura de producción y secretos no se delegan |
| `tests/`: bancos e instrumentos (`_banco-*`, `_suelo-*`, mutación) | **S3** | |
| `tests/`: guards nuevos de J6 | **J6** | |
| `tests/`: el test de un ticket | el puesto que trabaja el ticket | |
| `scripts/` (verificación, censos de consulta) | **S0**, sólo lo que sea verificación o censo de consulta | salvo `scripts/equipo/` (S5), `scripts/_suelo-*` (S3), `scripts/qa/` (S3), `scripts/vigia-sesiones-jv.mjs` (S5) y las demás filas de abajo. **Esta fila no recoge lo que nadie clasificó:** un fichero de `scripts/` que no sea verificación ni censo de consulta y no tenga fila propia NO es de S0; le falta una fila, y se le pide a la S0 (SCRUM-1480). Por eso el dueño de esta fila no va escrito como un puesto a secas: donde nadie ha decidido no hay cerradura (decisión del orquestador de Luis, 6-oct-2026; medido ese día ANTES de añadir las dos filas de scripts de workflow de abajo: 273 de los 296 ficheros de `scripts/` sólo los cubría esta fila; con esas dos filas dentro, y ya con 298 ficheros, son 250, contados con `node docs/master/evidencias/SCRUM-1480/recuento-de-la-fila-general.mjs <raíz>`; el 9-oct-2026, con 302 ficheros y las ocho filas por área del ticket creador de más abajo, son 225, y cómo nace la fila de uno nuevo está escrito bajo esta tabla) |
| `scripts/qa/**` (la sesión del panel y los sembradores de la cuenta QA) | **S3** | son sondas e instrumentos (§2.1), y los sembradores ESCRIBEN en la cuenta QA de producción: no son «censos de consulta». Decisión del orquestador de Luis, 6-oct-2026 (SCRUM-1480) |
| `scripts/vigia-sesiones-jv.mjs` (el vigía de sesiones) | **S5** | los vigías son de S5 (§2.1; a J6 no se le mandan, §2.2). ⚠️ Lo escribió el equipo de Javier para una tarea programada de SU máquina (SCRUM-1000): quien lo cambie avisa antes a su orquestador por Jira (§5). Decisión del orquestador de Luis, 6-oct-2026 (SCRUM-1480) |
| `scripts/vigia-atascados.mjs`, `scripts/vigia-pasada.mjs`, `scripts/vigia-despliegue-aviso.mjs`, `scripts/vigilante-de-despliegue.mjs`, `scripts/_vigilante-de-despliegue.mjs`, `scripts/_ritmo-de-despliegue.mjs`, `scripts/puerta-avisador-rojo.mjs`, `scripts/puerta-claude.mjs`, `scripts/puerta-claude-empuje.mjs`, `scripts/clasificar-fallo-automerge.mjs`, `scripts/conflicto-de-registro.mjs`, `scripts/tanda-con-veredicto.mjs`, `scripts/_huella-de-la-caida.mjs`, `scripts/_reporters-de-node-options.mjs`, `scripts/zona-roja.mjs`, `scripts/constancia-del-alter.mjs` (los 16 scripts del bucle PR → CI → merge → aviso que ejecuta un workflow, con lo que importan sólo ellos) | **S5** | son «los workflows y sus scripts» (`orquestador.md` §11bis) y los vigías (§2.1). Tres avisos: la lista `ZONA_ROJA` de `zona-roja.mjs` la decide el fundador (lo dice `.github/CODEOWNERS`); lo que exige `constancia-del-alter.mjs` es A5 y no se relaja sin un jefe; y `vigia-silencio-de-main.mjs` NO está aquí: lo escribió J6 y SCRUM-1324 sigue En curso con `area-j6`, así que sigue sin fila hasta que lo hablen los dos orquestadores. Decisión del orquestador de Luis, 6-oct-2026 (SCRUM-1480) |
| `scripts/censo-objetivo-tactil-panel.mjs`, `scripts/censo-clics-del-80.mjs`, `scripts/censo-accion-del-80.mjs`, `scripts/meta-guard-mutaciones.mjs`, `scripts/_arbol-quieto.mjs`, `scripts/frontera-dist.mjs`, `scripts/suelo-de-la-tanda.mjs` (los 7 instrumentos que corre el CI: los censos del panel, el meta-guard de mutaciones y el suelo de la tanda, con los dos ficheros que, de entre los scripts, sólo importa el meta-guard) | **S3** | son instrumentos de medida y mutación (§2.1 y la fila de `tests/` de arriba). Lo que NO está aquí, a propósito: `guards-visuales.mjs` y `senal-de-nombres.mjs` (con sus ayudantes `_solape-de-guards.mjs` y `_senal-de-nombres.mjs`), que tienen ticket vivo del equipo de Javier (SCRUM-1313, 1320 y 1339); los diez ayudantes compartidos (`_navegador.mjs`, con 51 importadores medidos ese día, `_hallazgos-y-ciegos.mjs`, `_servidor.mjs`, `_puerta-de-entrada.mjs`, `_banco-lista.mjs`, `_trabajos-de-muestra.mjs`, `_prisma-client-guard.mjs`, `_marca-de-arbol.mjs`, y los dos del censo táctil: `_medidor-de-toque.mjs`, que también importan `guard-objetivo-tactil.mjs` y `guard-a11y-landing.mjs`, y `_pagina-panel.mjs`, que también importa `guard-objetivo-tactil.mjs`; esos dos guards no tienen fila), que no se clasifican antes que quienes los usan; y `trinquete-de-zona.mjs` con `_trinquete-de-zona.mjs`, que S3 toca sólo por la excepción escrita en SCRUM-1335 (comentario 18387): es un permiso para un trabajo, no un carril, y ese ticket lleva `area-j6`, así que es un cruce que se coordina. Los dos ayudantes del censo táctil entraron en esta fila y salieron el mismo día (SCRUM-1480c): el censo es de S3 y sus dos ayudantes siguen en la fila general, sin cerradura. Decisión del orquestador de Luis, 6-oct-2026 (SCRUM-1480) |
| `scripts/carriles.mjs`, `scripts/_carriles.mjs`, `scripts/_censo-sin-consumir.mjs`, `scripts/auditoria-cierres.mjs`, `scripts/claves-bd-de-todos-los-arboles.mjs`, `scripts/espera-del-equipo.mjs`, `scripts/sesiones-que-no-volvieron.mjs`, `scripts/traspaso-derivado.mjs` (ocho scripts nacidos en tickets del área de S0) | **S0** | fila por el área del ticket que creó cada fichero (el criterio, bajo esta tabla): SCRUM-1295, 1185, 1372, 1423, 1414, 1418 y 1427, todos con `area-s0`. Ya no dependen de que alguien los lea como «verificación o censo de consulta». Decisión del orquestador de Luis, 9-oct-2026 (SCRUM-1480) |
| `scripts/_sin-consumir-declarados.json` (la lista de piezas declaradas sin consumir) | **S0** (contenedor) | nació en SCRUM-1185, de `area-s0`, y es una lista donde cada puesto declara o retira SU pieza: 44 commits de los dos equipos hasta el 9-oct-2026. Por eso es contenedor: tiene dueño y no le cierra el paso a nadie. El criterio da el dueño; lo de contenedor lo añade la S0 y lo dice (SCRUM-1480) |
| `scripts/_sin-fila-declarados.json` (el suelo del trinquete de scripts sin fila y la lista de los declarados) | **S0** (contenedor) | nació en SCRUM-1480, de `area-s0`. Contenedor porque en ella escriben otros: quien le da fila a un script viejo baja `quedan`, y el equipo de Javier apunta ahí el script nuevo al que la S0 todavía no ha podido dar fila («Cómo nace la fila», bajo esta tabla). Lo de contenedor lo añade la S0, como en la fila de arriba (SCRUM-1480) |
| `scripts/_censo-rango-del-parte.mjs` | **S1** | por el área del ticket que lo creó: SCRUM-1488, con `area-s1`. Decisión del orquestador de Luis, 9-oct-2026 (SCRUM-1480) |
| `scripts/guard-965-un-solo-presupuesto.mjs`, `scripts/guard-duplicar-926.mjs` | **S2** | por el área del ticket que creó cada uno: SCRUM-965 y SCRUM-926, con `area-s2`. Decisión del orquestador de Luis, 9-oct-2026 (SCRUM-1480) |
| `scripts/_censo-entorno-prestado.mjs`, `scripts/_censo-gemelo-crudo.mjs`, `scripts/_tanda-por-tramos.mjs`, `scripts/_tests-que-cubren.mjs`, `scripts/tests-que-cubren.mjs` (dos censos y la tanda dirigida con sus dos ayudantes, que de entre los scripts sólo importa ella) | **S3** | por el área del ticket que creó cada uno: SCRUM-1153, 1452, 1412 y 1363, con `area-s3`. La tanda dirigida la CORRE todo el mundo; cambiarla es de S3. Decisión del orquestador de Luis, 9-oct-2026 (SCRUM-1480) |
| `scripts/_ciegos-por-entorno-declarados.json`, `scripts/_entorno-prestado-declarados.json`, `scripts/_version-de-fila-dudosa-declaradas.json` (tres listas de declarados de instrumentos de S3) | **S3** (contenedor) | nacieron en SCRUM-1412, 1349 y 1381, con `area-s3`. Son listas donde un puesto apunta o retira lo suyo: medido en una de las tres (en SCRUM-1359 la S5 retiró sus cuatro entradas de la del entorno prestado); las otras dos sólo llevan el commit que las creó. Contenedor por lo mismo que la de arriba, y también lo añade la S0 (SCRUM-1480) |
| `scripts/_detalle-917.mjs`, `scripts/_trabajos-917.mjs`, `scripts/capturas-lista-trabajos-917.mjs`, `scripts/guard-detalle-trabajo-917.mjs`, `scripts/guard-lista-trabajos-917.mjs` (los guards de navegador de la lista y del detalle del Trabajo, con sus dos ayudantes, que sólo importan ellos) | **S4** | por el área del ticket que los creó: SCRUM-917, con `area-s4`. Decisión del orquestador de Luis, 9-oct-2026 (SCRUM-1480) |
| `scripts/_censo-bytes-control.mjs`, `scripts/arbol-mio.mjs`, `scripts/estado-antes-del-go.mjs` | **S5** | por el área del ticket que creó cada uno: SCRUM-942, 774 y 568, con `area-s5`. Decisión del orquestador de Luis, 9-oct-2026 (SCRUM-1480) |
| `scripts/_suelo-*` | **S3** | |
| `docs/equipo/cicatrices/*.md` | cada puesto, la suya | A9 (SCRUM-1294): en qué se equivoca ese puesto, con su comprobación al lado |
| `docs/master/SCRUM-*.md` | quien trabaja el ticket | un fichero por ticket; si ya existe, se ANEXA una sección (A8) |
| `docs/microcopy/` | **S4** el README; cada registro, el puesto que usa el texto | la firma es de un jefe o de la delegación de SU orquestador |
| `docs/prototipos/` | S4 / **J5**, por ticket | |
| `docs/competencia/` | **J5** | la S0 deja ahí el resultado de Holded (§2.1) |
| `docs/legal/` | **J4** propone | firma un jefe |
| `CLAUDE.md`, `.claude/**`, `docs/YAQU_MASTER.md` | **un jefe** | derivados del máster (regla 35); la S0 prepara la propuesta |
| `DESIGN.md` | **S2** propone | firma un jefe |
| `package.json` | cada uno SU línea de script | **una dependencia nueva la decide un jefe** |

**Cómo nace la fila de un fichero de `scripts/`** (SCRUM-1480, 9-oct-2026: propuesta medida de la S0, aceptada
por el orquestador de Luis). Obliga al equipo de Luis; al de Javier se le propone por su orquestador (§5).

- **Un fichero nuevo de `scripts/` nace con fila, en el PR que lo crea.** Su dueño es el puesto del **área
  del ticket que lo crea**: la etiqueta `area-…` de ese ticket en Jira (§4). Quien lo crea añade la ruta a la
  fila de ese puesto en la tabla de arriba, o se lo pide a la S0, y regenera
  (`node scripts/carriles.mjs generar`). Es el único criterio de los cuatro medidos que da PUESTO y no sólo
  equipo, y sale de un dato que ya está escrito, no de una opinión.
- **Si ese ticket no lleva UNA etiqueta de área** (ninguna, o dos), el criterio calla: el fichero se queda en
  la fila general, sin cerradura, y se DICE que está sin puesto. No se reparte por el nombre (cada clase,
  `guard-` o `censo-`, la han escrito los dos equipos), ni por quién lo tocó (el autor de git da el equipo,
  no el puesto: los seis puestos de Luis firman igual), ni por quién lo usa (179 de 253 los usa un test).
- **Un ayudante (`_*.mjs`) espera a quienes lo importan:** no tiene fila propia mientras lo importe un script
  de otro dueño o sin fila. Y **una lista de declarados**, donde cada puesto apunta lo suyo, va como
  contenedor.
- **Lo medido el 9-oct-2026**, sobre 302 ficheros: 49 ya tenían fila. De los otros 253 el criterio decide 41:
  28 del equipo de Luis (las ocho filas de arriba, y en ninguno un ayudante con importadores de otro dueño)
  y 13 del de Javier, que van a su orquestador y no se han escrito. Quedan 225 con sólo la fila general: esos
  13, 138 donde el autor da el equipo pero no el puesto (55 de Luis, 83 de Javier) y 74 que han tocado los
  dos equipos. **Esos 225 están SIN PUESTO, no repartidos.** Los instrumentos, en
  `docs/master/evidencias/SCRUM-1480/`.
- **Lo hace cumplir un trinquete, desde el 9-oct-2026:**
  `tests/scrum1480f-un-script-nuevo-no-entra-sin-fila.test.mjs`, que corre en el check obligatorio. Un fichero
  de `scripts/` que sólo cubre la fila general y no estaba entre esos 225 (la foto,
  `docs/master/evidencias/SCRUM-1480/sin-fila-9oct.txt`) lo pone en rojo. El número, **225 el 9-oct-2026**, vive
  en `scripts/_sin-fila-declarados.json` y sólo baja: quien le da fila a uno de la foto, o lo borra, lo baja en
  ese mismo PR. Se cuenta con `node scripts/carriles.mjs sin-fila`.
- **El rojo tiene dos salidas, y la segunda no es para todos.** La primera es la fila. La segunda es declararlo
  en `scripts/_sin-fila-declarados.json`, con su ticket y su motivo, y vale en dos casos: lo crea el **equipo de
  Javier**, que no edita esta tabla y al que este criterio se le ha propuesto y no impuesto (la S0 le da fila
  cuando su orquestador diga el puesto); o lo crea el equipo de Luis en un ticket sin UNA etiqueta de área, que
  es el caso en que el criterio calla. Un declarado es un fichero sin puesto que se ha DICHO: el trinquete no
  deja que entre callado, no impide que entre. *Esta segunda salida la añade la S0 y lo dice: el encargo del
  orquestador de Luis era «que no suba de 225», a secas, y así un PR del otro equipo se quedaría en rojo sin
  poder arreglarlo él.*

### 3.4 · Excepciones declaradas — el cruce de carril legítimo, a la vista

Esta tabla y la de §3.1–3.3 se convierten solas en `.claude/carriles.json` y `.claude/rules/carril-*.md`
(`node scripts/carriles.mjs generar`, SCRUM-1295), y la cerradura `.claude/hooks/carril.mjs` **bloquea**
editar un fichero de otro puesto. Un cruce legítimo **no se hace con un permiso silencioso: se declara
aquí**, con quién, por qué y el ticket, y se regenera. Si la tabla y lo generado no coinciden, el check
obligatorio sale rojo (`tests/scrum1295-carriles.test.mjs`). «quién» es `todos` o una lista de puestos.

| ruta | quién | motivo | ticket |
|---|---|---|---|
| `docs/equipo/00-normas-siempre.md` | todos | A9: el aviso que no se pudo convertir en comprobación va a A10, donde lo leen todas. Cada puesto añade SU línea, en su PR; el resto del fichero es de la S0 | SCRUM-1294 |

## 4 · Jira: las etiquetas y el ciclo del ticket

El ciclo entero (abrir, coger, soltar, cerrar, limpiar) es **A13 de `00-normas-comunes.md`**, y vale igual
para los dos equipos. Aquí solo va lo que es propio de dos equipos:

- **Dos etiquetas en todo ticket:** equipo (`equipo-luis` / `equipo-javier`) y área (`area-s0` … `area-s5`,
  `area-j1` … `area-j6`, según §3). Medido el 18-sep en Jira: **0 tickets** llevan ninguna de las 14; la
  misma consulta con `sesion-J1` devuelve 10, así que la consulta ve etiquetas.
- La etiqueta de equipo es la del **dueño del área**, no la del equipo que tuvo la idea.
- **Asignado al JEFE del equipo que lo trabaja** (Luis o Javier): las sesiones no tienen cuenta de Jira.
- Un ticket **En curso o con la etiqueta del otro equipo no se toca**: se avisa al orquestador propio, que
  deja un comentario en el ticket.

## 5 · Cómo se coordinan dos orquestadores que NO pueden hablarse

Los dos canales son **Jira** y **el repositorio**. La lista, para los dos orquestadores y todas las sesiones:

1. **Pedir algo al otro equipo:** un ticket con las etiquetas del equipo y del área DUEÑOS, el literal de lo
   que se pide, y quién lo pide. Nunca se construye en su terreno mientras tanto.
2. **Proponer una norma** (el equipo de Javier a la S0): un ticket `equipo-javier` + `area-s0` con el texto
   exacto propuesto y el caso que lo motivó. La S0 lo mete en `00-normas-comunes.md` o contesta por qué no,
   en el mismo ticket.
3. **Tocar un contenedor común** (§3): el PR del que añade su bloque ES el aviso. Un merge sin conflictos no
   es un merge correcto: quien entra segundo comprueba que no se ha perdido el bloque del otro (A4).
4. **Cambiar `orquestador.md`**: comentario en Jira al otro equipo con qué cambió y por qué.
5. **Estado:** cada orquestador escribe el suyo (`traspaso.md` / `traspaso-javier.md`) y **lee el del otro**
   al arrancar, desde `origin/main`. Lo que el otro equipo tenga que saber **va al repo o a Jira**: la memoria
   de una máquina no la ve la otra.
6. **Sufijos de rama:** los dos equipos crean ramas `scrum-N-…` sobre el mismo Jira. El control del sufijo en
   su propio comando, justo antes del primer push (A4), deja de ser prudencia y pasa a ser el único candado.
7. **Si dos orquestadores chocan** en algo que ninguno de estos pasos resuelve, lo decide **un jefe**. Hasta
   entonces, el ticket se queda con el equipo que lo tenía **En curso primero**, según Jira.

### 5.1 · Recursos compartidos

| recurso | cómo se comparte |
|---|---|
| **producción** | nadie hace `db push` (regla 3); ALTER por A5; desplegar = merge a `main` |
| **staging (turno)** | el turno es un advisory lock de Postgres en la propia base de staging (`scripts/_staging-lock.mjs`), así que **vale entre máquinas**: los dos equipos lo respetan igual |
| **staging (merchant QA)** | ⚠️ **COMPARTIDO HOY: las siembras de un equipo salen en las mediciones del otro.** **DECISIÓN PENDIENTE de un jefe.** Propuesta: un merchant QA propio para el equipo de Javier; darlo de alta necesita su «sí» |
| **base de desarrollo de Javier** | la aplica **su** carril; otro que la necesite al día **la pide**, no la toca |
| **turno de suite completa** | es por MÁQUINA (memoria libre): cada orquestador da el suyo |
| **CI de GitHub** | común: un rojo del check obligatorio tapona los PR de los dos equipos, y lo arregla el dueño de lo que lo rompió |

## 6 · Cómo entra una idea de un jefe

La lista está en **`orquestador.md` §4bis** (es método común de los dos orquestadores): el jefe se lo dice a
su orquestador → ticket con su literal y el área dueña → PASO 0 medido (S0 o J6) → prototipo si cambia lo
que ve el usuario (S4 o J5) → lo construye el dueño del área, **nunca en terreno ajeno** → se cierra por
efecto y se le cuenta al jefe en plano.

## 7 · Decisiones pendientes (de un jefe)

1. Merchant QA propio para el equipo de Javier (§5.1).
2. Si un jefe puede cambiar una decisión escrita por el otro (§1).
3. La entrega a la gestoría (SCRUM-280, 322, 323): J1, con revisión de J4 por el RGPD del envío (§2.2).
4. **Los huecos de carril** (`node scripts/carriles.mjs huecos`, SCRUM-1295). Un fichero que solo cubre la
   fila general («todo lo demás de `src/`» o «de `public/`») y cuyo nombre se parece a los de OTRO puesto
   es un viaje esperando: alguien deducirá el dueño por el dominio y la tabla dirá otra cosa. Medido el
   1-oct-2026 sobre `36f1eee3`: 432 ficheros de producto, 241 solo por la fila general, **32 con pariente
   en otro puesto**. El censo no decide. Para cada uno, la pregunta es de los dos jefes: **¿es un hueco de
   la tabla, o es de ese puesto a propósito?** Se cierra escribiendo su fila en §3 (aunque sea para
   confirmar al dueño actual: con fila propia deja de salir). Las preguntas se hacen por FAMILIA, no por
   fichero: una pregunta sobre un grupo se contesta una vez; siete sobre ficheros se quedan sin contestar.
   - **¿De quién es la familia «cliente» del servidor?** Hoy **S1**, solo por la fila general; por el
     nombre, de J2 (que tiene `customerAdmin.ts`, `tagsDelCliente.ts`, `importarClientes.service.ts`). Son
     ocho ficheros: seis en `src/modules/system/domain/` (`fusionClientes.ts`, que costó un viaje el
     29-sep, `historialDelCliente.ts`, `historialWhatsAppDelCliente.ts`, `notasDelCliente.ts`,
     `sitiosDelCliente.ts`, `puertaClienteReal.ts`), más `jobs/domain/consolidacionCliente.service.ts` y
     `quotes/domain/decisionDelCliente.ts`.
   - **¿De quién son las pantallas de parte y albarán que no son la ficha?** Hoy **S2**, solo por la fila
     general; por el nombre, de S4 (que tiene `parteDetailView.js` y `albaranDetailView.js`). Son cuatro:
     `parteOficinaView.js` (costó un viaje el 29-sep), `albaranAccion.js`, `albaranActionsRegistry.js` y
     `albaranDesdePresupuestoModal.js`.
   - El resto de la lista (20 ficheros sueltos) la da el censo; ninguno ha costado un viaje todavía.
   - **Y un tipo distinto: el nombre contradice a la tabla** (lo encontró S3 el 1-oct). `scripts/verificacion-s5/`
     (9 ficheros): la carpeta dice S5 y la fila «`scripts/` → S0» dice S0. Tiene fila y manda la tabla, pero
     quien lee la carpeta y quien lee la tabla llegan a conclusiones opuestas. Es el único caso entre las 47
     rutas del repo que llevan un puesto en el nombre. **¿Se le da la carpeta a S5 con una fila, o se renombra?**
5. **`.claude/**` es «de un jefe», y hoy entra sin que un jefe lo firme** (lo destapó SCRUM-1356, 1-oct-2026).
   La fila de §3.3 dice que `.claude/**` lo firma un jefe y que la S0 prepara la propuesta. El encargo de
   SCRUM-1356 le dio a la S0 «hooks y `settings.json`» como carril propio, y su PR (#2097: dos hooks y su
   registro en `.claude/settings.json`) se abrió, se armó y se mergeó SOLO a los 18 minutos, con el check en
   verde y sin firma de nadie. No hubo daño: los dos hooks avisan y dejan pasar. Pero la tabla y lo que pasó
   no dicen lo mismo, y un hook que SÍ bloquee entraría por la misma puerta. **¿`.claude/hooks/` y
   `.claude/settings.json` pasan a ser de la S0 con una fila, o un PR que los toca no se arma solo?** La
   segunda es un cambio en `pr-automatico.yml` (S5). No lo decide la S0.

**Comprobado contra casos reales:** el censo de los 80 tickets abiertos del orquestador (18-sep ~11:58Z, sobre
`e76580b1`) casa cada ticket con un área de esta tabla. Salieron cuatro huecos: infraestructura (→ S5) y el
canal de WhatsApp (→ J2), decididos y escritos arriba; el ALTER (→ Javier como jefe, §3.1) y la gestoría (3,
pendiente).
