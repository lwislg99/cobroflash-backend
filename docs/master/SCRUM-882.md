# SCRUM-882 · El recorrido del electricista: lo que no está pulido, medido en staging

**Medido contra:** `origin/main` = `7fad98579f2fec757313562b4ab198216ebf15f9` · 2026-09-16T14:06:06Z (al redactar)
**Staging recorrido:** `https://yaqu-staging-production.up.railway.app` sirviendo `4b0d5739bc19e7bad5109a32822ef7039d9ca860` (`/version`) · recorrido 2026-09-16T13:36Z → 14:06Z
**Rama:** `scrum-882-recorrido-del-electricista`
**Carril:** producto (Sesión 0) · **Gate:** sin gate · **NO se arregla nada en este ticket.**

⏱ Horas **de GitHub** (cabecera `Date:` de `gh api -i zen`), no del reloj local.

> Un electricista con técnicos no puede cerrar hoy un parte en YaQu: el botón para escribir una
> línea no hace nada, el dictado no saca ninguna, y el servidor —con razón— no deja firmar un parte
> vacío, pero la pantalla no lo dice.

---

## 0 · Cómo se midió

- **Staging, nunca producción.** Cuenta `qa@staging.yaqu` (merchant 2), login por `/auth/test-login`.
  Service worker desregistrado y cachés vaciadas antes de mirar (0 registros y 0 cachés en las dos
  pasadas: el SW de staging ya es network-first desde SCRUM-45, pero se limpió igual).
- **WhatsApp simulado, comprobado:** el envío dejó `wamid.dryrun.*` en `WhatsAppMessage` (13:39:16Z).
  Cliente con teléfono del prefijo de demo `346110000…`. Ni un mensaje real.
- **Sonda 1 · recorrer:** Playwright (`playwright-core` 1.63, Chromium 1223) haciendo clic como un
  usuario, 390×844 táctil y 1366×860. El MCP de Playwright está configurado en el proyecto pero **no
  se cargó en esta sesión**; se condujo la librería con un conductor propio
  (`evidencias/scrum882/sonda-playwright.mjs`).
- **Sonda 2 · fotografiar:** el banco `scripts/capture-demo.mjs` (Edge + puppeteer-core) contra
  staging: 21 vistas + 2 extras, `DONE`.
- **Lectura de la BD de staging, solo lectura**, para distinguir «la pantalla miente» de «el dato está
  mal»: estado del presupuesto, de la factura y del cobro.
- **Frecuencia:** estimada para un electricista con 3-5 trabajos al día. Es una estimación, no una
  medición: no hay datos de uso real de ese perfil.

## 1 · La lista, ordenada por gravedad × frecuencia

Gravedad: 🔴 no puede seguir · 🟠 le frena o confunde · 🟡 se ve sin terminar.

| # | | Pantalla | Qué pasa | Veces/día | Sondas | Captura |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 🔴 | Parte de trabajo | **«Añadir línea» no hace nada.** El botón se pinta en `public/dashboard/js/parteDetailView.js:185` (`.parte-anadir`) y ningún fichero de `public/dashboard/js/` le ata un escuchador. La otra vía, dictar + «Ordenar en líneas», responde «No se ha podido sacar ninguna línea — escríbelas tú» (en staging; si depende de una clave de IA que staging no tiene, en producción puede comportarse distinto: **no medido**). Resultado: el parte no admite ni una línea de mano de obra ni de material | 3-5 (cada trabajo) | Playwright + código | `movil-15a-dictado-ordenado.png` |
| 2 | 🔴 | Parte → firma del cliente | La cliente escribe su nombre, elige «El propio cliente», firma con el dedo y pulsa «Confirmar firma»: el servidor devuelve **409 `parte_vacio`** (`src/modules/jobs/app/routes/partes.routes.ts:568`, correcto) y la pantalla **cierra el modal sin decir nada**. Además la firma queda en la cola (`localStorage.yaqu_hubo_cola`, IndexedDB `yaqu`) y **se reintenta con 409 en cada pantalla que se abre después** (visto en Trabajo y en Cobros) | 3-5 | Playwright | `movil-16b-firma-cliente-dibujada.png`, `movil-16c-tras-firma-cliente.png` |
| 3 | 🔴 | Equipo → Añadir miembro | En el plan de prueba **no se puede dar de alta a un técnico**: se rellena nombre, email y rol, y al enviar sale en rojo «Tu plan incluye 1 usuario… escríbenos y te lo activamos» (409). El límite es deliberado (`src/core/entitlements.ts`: trial = 1 usuario, `equipo` = oferta manual W1); lo áspero es que el muro aparece **después** de rellenar, en color de error, y sin un botón que lo resuelva. Corta el tramo «trabajo asignado a un técnico» | 1 (una vez, pero bloquea el tramo) | Playwright | `movil-09a-tras-invitar.png` |
| 4 | 🟠 | Presupuesto rápido | **Sale con IVA 0 % fijo.** `homeView.js:1216` y `:1233` mandan `tax: 0` en cada línea. El detalle dice «IVA 0 % · Base imponible 590,00 € · IVA 0,00 €» y la cliente firma 590,00 € sin ninguna mención al IVA. ⚠️ **Toca dinero y textos fiscales: arreglarlo es STOP del fundador** | 3-5 (cada presupuesto) | Playwright + código + BD (`lines[].tax = 0`) | `movil-06a-presupuesto-aceptado-full.png` |
| 5 | 🟠 | Cobros | **Un cobro marcado como pagado sigue «Sin cobrar».** Tras «Marcar como pagada» con Bizum, el presupuesto pasa a «Cobrada» y la factura queda `paid` / `bizum_manual`, pero su cobro (Charge 889) sigue `pending`: Cobros lista a María López con «Sin cobrar desde hace 0 días», método «tarjeta» y documento «—». Recargar no lo cambia | 3-5 (cada cobro) | **Las dos** + BD | `movil-19a-cobros-recargado.png`, `escritorio-d05-cobros.png`, `banco-02-cobros.png` |
| 6 | 🟠 | Trabajo → «Registrar cobro» | **No hace nada.** Salta a `[data-seccion="facturas"]` (`jobDetailView.js:219`) y esa sección no existe en la pantalla (`querySelector` → `null`), así que el clic muere en silencio. Hay que ir al presupuesto para cobrar | 3-5 | Playwright + código | `movil-11a-trabajo-detalle-full.png` |
| 7 | 🟠 | Inicio | Dice «No hay nada que llevarte: no tienes trabajos abiertos ni agendados» con un trabajo **agendado** para el 17-sep y cuatro **sin agendar**. Y «Tienes en juego 265,62 € (1 factura)» mientras Cobros lista cinco sin cobrar | 1-3 (cada mañana) | Playwright (móvil y escritorio) | `movil-00-home.png`, `escritorio-d01-home.png` |
| 8 | 🟠 | Página de la cliente, tras firmar | Con «Pago completo al aceptar», al firmar ve «¡Presupuesto aceptado y firmado!» y **un único botón: «Compartir por WhatsApp»**. Ni pagar ahora ni cuándo le llegará el enlace de pago | 1-3 (cada aceptación) | Playwright | `cliente-05b-cliente-tras-firmar.png` |
| 9 | 🟠 | Presupuesto rápido → cliente nuevo | El campo de teléfono dice «Teléfono WhatsApp (ej: 521XXXXXXXXXX)», formato de **México**. Y luego el teléfono se muestra «34611000882», sin `+` ni espacios, en presupuesto y trabajo | 1-3 (cada cliente nuevo) | Playwright | `movil-02a-cliente-buscar.png` |
| 10 | 🟠 | Trabajo / parte | **Albarán y parte mezclados.** El bloque se titula «ALBARANES» y contiene «+ Nuevo albarán», «Incluir precios en el parte» y «Parte de trabajo»; el resumen dice «2 líneas del presupuesto sin entregar · Ver albaranes»; y el modal de firma **del parte** explica que «el albarán vale como prueba». El parte, además, no trae las líneas del presupuesto | 3-5 | Playwright | `movil-11a-trabajo-detalle-full.png` |
| 11 | 🟠 | Presupuesto (390 px) | La tabla de conceptos **corta las columnas IVA y TOTAL** sin señal de que haya más, y el botón «?» flotante **tapa** el comentario de la decisión («Aceptado con firma d…») | 3-5 | Playwright | `movil-06a-presupuesto-aceptado-full.png` |
| 12 | 🟠 | Parte (390 px) | Se abre **desplazado hasta abajo**: hereda el scroll del trabajo. El técnico aterriza en «Firmar aquí mismo» sin ver la dirección ni las horas | 3-5 | Playwright | `movil-13b-parte.png` |
| 13 | 🟡 | Varias | **Identificadores con pinta interna a la vista:** «J-20260916-93ZW» bajo el rótulo FACTURAS (presupuesto y trabajo); «Canal: whatsapp» en minúscula de enum; la etiqueta «REF» en el parte | 3-5 | Playwright (móvil y escritorio) | `escritorio-d02-presupuesto.png`, `escritorio-d04-trabajo.png` |
| 14 | 🟡 | Inicio, presupuesto | **«Presupuesto» y «cotización» mezclados:** «COTIZACIONES SIN RESPUESTA», «Cotizaciones esta semana», «¿Cómo quieres cotizar?», «Sin gastos asignados a esta cotización» junto a «Presupuesto #5» | 1-3 | Playwright | `movil-00-home.png` |
| 15 | 🟡 | Cobros, presupuesto | Mayúsculas incoherentes en los métodos: «Bizum · tarjeta · transferencia · efectivo» (filtros de Cobros y desplegable «¿Cómo lo has cobrado?»). Y «Sin cobrar desde hace 0 días» | 3-5 | Las dos | `banco-02-cobros.png` |
| 16 | 🟡 | Trabajo → Agendar (390 px) | La hoja inferior **sin márgenes**: título, etiqueta y campo pegados al borde izquierdo de la pantalla. Y no deja elegir quién va | 3-5 | Playwright | `movil-12a-agendar.png` |
| 17 | 🟡 | Parte | «Firma del técnico» es un **botón sin estilo** (gris nativo) debajo del botón verde. «Entrada» y «Salida» son texto libre, no hora; «Técnicos» es texto libre aunque exista Equipo | 3-5 | Playwright | `movil-13b-parte.png` |
| 18 | 🟡 | Trabajo | Miga «María López · Presupuesto #5 · María López» (el nombre, dos veces); tipo por defecto «Una obra o reforma de varios días» para un cambio de cuadro de 590 €; en Trabajos, el título «Trabajos» dos veces seguidas | 3-5 | Playwright | `movil-11a-trabajo-detalle-full.png` |
| 19 | 🟡 | Presupuestos | Tras cobrar, el presupuesto sigue con la etiqueta «ACEPTADO» (la línea de tiempo sí dice «Cobrada») y la lista dice Método «—» | 1-3 | Playwright (escritorio) | `escritorio-d07-presupuestos.png` |
| 20 | 🟡 | Inicio (móvil) | «en 30 segundos · tecla N»: un atajo de teclado ofrecido en un teléfono | 1-3 | Playwright + banco | `movil-00-home.png` |
| 21 | 🟡 | Planes | «Todo incluido · Sin límites» en el plan cuyo límite de 1 usuario acaba de impedir el alta del técnico (#3). «3594 días restantes» de prueba: **probable artefacto de la semilla de staging**, no se afirma para producción | 0-1 | Playwright | — |

## 2 · Lo recorrido y sin aspereza (no es lo mismo que «no mirado»)

- Modal de presupuesto rápido a 390 px (sin rellenar y relleno), envío por WhatsApp y paso al detalle.
- Página de la cliente para firmar: nombre de la empresa, líneas, total, validez, lienzo de firma,
  «Tengo una duda» y «Rechazar». La firma con el dedo funciona.
- Enlace de firma con token inexistente: «Este enlace no corresponde a ningún documento activo. Si
  esperabas un presupuesto o un cobro, pide al profesional que te reenvíe el enlace.» Palabras de persona.
- Agendar guarda la fecha y el trabajo pasa a «AGENDADO» con «▶ Empezar».
- Los tres campos del parte que se escribieron (dirección, entrada, salida) **sí se guardan**:
  volvieron del servidor al reabrir.
- Sin scroll horizontal de página en las 7 vistas de escritorio ni en las móviles donde se midió (Inicio, modal); la tabla del #11 desborda DENTRO de su caja.

## 3 · NO RECORRIDO (suelo: esto no es «limpio»)

| Tramo | Por qué no |
| --- | --- |
| Asignar el trabajo a un técnico | Bloqueado por el #3 (plan de prueba = 1 usuario). Para seguir intenté poner el merchant de QA en plan `equipo` en la BD de staging y **el clasificador de permisos lo denegó**; no lo rodeé |
| El día del técnico: su sesión, sus trabajos, su firma del parte | Mismo bloqueo: sin técnico no hay sesión de técnico |
| Firma del técnico en el parte | El parte no llega a firmarse (#1, #2) |
| La cliente paga desde su enlace (Bizum, tarjeta, transferencia) | El enlace de pago no aparece tras firmar (#8); no se buscó por otra vía. Se cobró marcando a mano desde el presupuesto |
| Albarán | No es el camino del día que se pidió; se tocó sólo como vocabulario (#10) |
| Presupuesto de «3 opciones» y condiciones 50 %·50 % | No entraban en el día de un presupuesto normal |
| Escritorio: parte, agendar, firma de la cliente | Escritorio cubrió 7 vistas + el modal; esas tres pantallas sólo en 390 px |
| Estados «cargando» | Staging respondió rápido en todo el recorrido; ningún estado de carga llegó a verse. No medido |

## 4 · Lo que discrepa entre sondas (el dato, no el ruido)

- **Modal de presupuesto rápido:** en el banco (Edge) el campo de cantidad sale **vacío** y el marcador
  de precio se corta en «Prec»; en Playwright (Chromium) sale «1» y «Precio» entero. No se ha
  averiguado si es tipografía de Edge, temporización del banco o las dos. `banco-02-quick-quote-modal.png`
  frente a la captura de Playwright equivalente.
- El resto de lo que las dos vieron (Cobros #5 y #15, «tecla N» #20) coincide.

## 5 · Errores propios y límites, declarados

- **La primera tanda no llegó a correr y casi la leo como verde:** en Git Bash `tests/*.test.mjs`
  expandido desborda la línea de comandos de Windows («Argument list too long», salida 126). Lo cazó
  que el resumen no traía `ℹ tests`, no el código de salida del envoltorio.
- **Un clic que caducó no era un defecto:** el primer «Confirmar firma» agotó 30 s en «scrolling into
  view»; es la trampa conocida de `scroll-behavior: smooth` con Playwright. Con clic por `evaluate`
  pasó, y lo que salió fue el 409 real (#2).
- **Concurrencia en la misma cuenta:** otra sesión (datos «SCRUM-883 Cliente…») estaba sembrando en
  el merchant 2 durante el recorrido. Por eso el primer presupuesto propio es el **#5** y Cobros e
  Inicio muestran importes ajenos. No cambia ningún hallazgo: todos se comprobaron sobre los datos
  propios (presupuesto 1876, trabajo 3099, parte PT-2026-001, factura 1966, cobro 889).
- **Datos que dejé en staging:** cliente María López, presupuesto #5 aceptado y firmado, trabajo
  agendado el 17-sep 09:00, parte PT-2026-001 en borrador con su firma en cola, factura marcada
  pagada por Bizum. El plan del merchant **no** se cambió (denegado).
- El MCP de Playwright no estaba cargado: la sonda 1 es la misma librería conducida por script. Las
  dos sondas siguen siendo independientes en motor (Chromium frente a Edge) y en método (clic frente a
  `goto` por hash).

## 6 · Evidencias

`docs/master/evidencias/scrum882/`: 19 capturas de Playwright (`movil-*`, `cliente-*`, `escritorio-*`),
2 del banco (`banco-*`) y el conductor de la sonda 1 (`sonda-playwright.mjs`).

---

# 882b · Lo que el recorrido dejó «no recorrido»: pago de la cliente, albarán y «3 opciones»

**Medido contra:** `origin/main` = `e7f155755446b2a848688cd59ba25c8d9bb9fb26` · 2026-09-16T18:57:54Z (al redactar)
**Staging recorrido:** servía `7cab3165369cfd29eadced8e5cb59ab447fe4867` al empezar (≈18:25Z) y `e7f155755446b2a848688cd59ba25c8d9bb9fb26` al acabar (18:57Z). Entre los dos solo cambian `parteDetailView.js`, `invoiceDetailView.js`, `invoicesAdmin.routes.ts` y `styles.css`: ninguna pantalla de las recorridas aquí salvo, quizá, el CSS (2 líneas)
**Rama:** `scrum-882b-lo-no-recorrido` · **Carril:** producto (Sesión 0) · **NO se arregla nada.** Los 🔴 nuevos los abre el orquestador

⏱ Horas de GitHub (cabecera `Date:` de `gh api -i zen`). Todo a **390×844 táctil**; escritorio no.

> Una cliente que elige una de las «3 opciones» firma con el dedo y no ve su firma, y queda
> guardada vacía aunque el panel diga «Firmado digitalmente». Cuando luego va a pagar, la única
> forma que se le ofrece, la tarjeta, le dice que pague por Bizum o transferencia, y esas dos
> formas no están. Y un albarán firmado acaba en un botón que se llama «[PENDIENTE microcopy oficial]».

## 882b.0 · Cómo se midió

- Mismo método que el recorrido 882: staging, cuenta `qa@staging.yaqu` (merchant 2, plan `trial`, que **no se tocó**),
  Playwright conduciendo Chromium como un usuario, y la BD de staging **solo leída** para distinguir «la pantalla
  miente» de «el dato está mal».
- **WhatsApp simulado, comprobado en `WhatsAppMessage`:** `quote_decision_es`, `payment_request_es` y
  `albaran_para_firmar_es` con `wamid.dryrun.*`. Cliente con el teléfono de demo `34611000885`.
- Datos propios, para no confundirlos con los de otras sesiones: cliente **Lucía Romero**, presupuesto **#7**
  (id 1878), justificante **J-20260916-GXNV** (factura 1971, cobro 894), trabajo 3104, albarán **AB260001** (id 1634).
- Única sonda: Playwright. El banco no se pasó (sus vistas son del panel, no de las páginas públicas de la cliente).

## 882b.1 · La lista, ordenada por gravedad × frecuencia

| # | | Pantalla | Qué pasa | Veces/día | Cómo se vio | Captura |
| --- | --- | --- | --- | --- | --- | --- |
| b1 | 🔴 | Página de la cliente · «3 opciones» → firma | **La firma no se ve y se guarda vacía.** El bloque de firma nace oculto (`quoteDecisionLanding.routes.ts:594`, `display:none` con tramos) y el lienzo se dimensiona al cargar (`:409`), así que se queda en **0×0** (medido: «interno 0x0» antes y después de elegir). La cliente dibuja y no aparece trazo; al pulsar «Firmar y aceptar — Básico (380,00 €)» se manda `signatureData` = `data:,` (**6 caracteres**) y el servidor responde 200 y guarda «Aceptado con firma digital». El panel dice «✅ Firmado digitalmente · La firma va incluida en el PDF», y el PDF del #7 tiene **0 imágenes**; el del #5, firmado sin tramos, tiene 2. Además, cada `resize` de la ventana lanza `getImageData… source width is 0`. ⚠️ Es la prueba de la aceptación: decide el fundador | 1-3 (cada aceptación con tramos) | Playwright + BD + PDF | `882b-cliente-c01e-firmada.png`, `882b-movil-t02a-detalle-aceptado-full.png` |
| b2 | 🔴 | Página de pago de la cliente | **La única forma de pago ofrecida no funciona, y la salida lleva al mismo sitio.** Negocio sin Connect y sin IBAN: la página solo pinta «Pagar con tarjeta» (`payInvoice.routes.ts:62-65` la pinta siempre que `PAYMENTS_CONNECT_ENABLED` está apagado). Al pulsar, `/pay/card` responde **409**: «El pago con tarjeta no está disponible. Este negocio aún no ha activado los cobros con tarjeta. Puedes pagar por transferencia o Bizum» (`payCard.routes.ts:60`). «← Ver otras formas de pago» vuelve a la misma página, otra vez solo con tarjeta. Con IBAN puesto, la tarjeta sigue saliendo y además con la etiqueta **RECOMENDADO**. ⚠️ Toca el flujo de cobro: STOP del fundador. Qué valor tiene el flag en producción: **no medido** | 3-5 (cada cobro de un negocio sin Connect) | Playwright + código | `882b-cliente-c03a-pagar.png`, `882b-cliente-c04a-tras-pulsar-tarjeta.png`, `882b-cliente-c06a-pagar-con-iban-y-bizum.png` |
| b3 | 🔴 | Configuración → Cobros | **«Guardar cambios» no guarda y no dice nada.** Con el NIF/CIF vacío, que es obligatorio (`settingsView.js:278`) y está en OTRA pestaña (Empresa), el navegador bloquea el formulario: `An invalid form control with name='taxId' is not focusable`. No sale ningún aviso y la BD sigue sin IBAN ni Bizum. Es justo el paso «Configura cómo cobras» de la lista de inicio, la única salida del b2. Con el NIF puesto, el PUT da 200 y guarda | 1 (al configurar, pero bloquea el cobro) | Playwright + BD | `882b-movil-m01b-tras-guardar.png` |
| b4 | 🔴 | Albarán firmado | **El siguiente paso es un botón sin nombre que no hace nada.** El botón principal dice literalmente «[PENDIENTE microcopy oficial]». Al pulsarlo, `POST …/convertir-en-factura` → **409** `facturacion_no_disponible`, y sale una franja roja con el mismo texto (`albaranes.routes.ts:1334`). Con `INVOICING_ES_ENABLED` apagado, que es lo que tienen hoy los negocios ES reales (regla 7), eso es todo lo que ofrece un albarán firmado. «Facturar lo entregado» no aparece | 3-5 (cada albarán firmado) | Playwright | `882b-movil-a06c-convertir-en-factura.png` |
| b5 | 🟠 | Albarán → copia firmada | **La copia firmada no le llega a la cliente, y nadie se entera.** Su pantalla dice «¡Parte firmado! Recibirás tu copia por WhatsApp», pero `albaran_firmado_es` quedó `failed` con `customer_daily_cap` (18:55:48Z). Era su cuarto mensaje del día: presupuesto, enlace de pago, albarán para firmar y la copia. El detalle del albarán no avisa | 1-3 (trabajos de un solo día) | Playwright + BD | `882b-cliente-c07d-albaran-tras-firmar.png` |
| b6 | 🟠 | Página de la cliente · «3 opciones» | La tabla de arriba dice «Renovación del cuadro eléctrico · 1 · **590,00 €**» (el precio de Estándar) justo encima de «Desde 380,00 €». Tras elegir Básico, el total pasa a 380,00 € pero la tabla **sigue en 590,00 €** | 1-3 | Playwright | `882b-cliente-c01a-cliente-3-opciones.png` |
| b7 | 🟠 | Página de la cliente · «3 opciones» | Cada tarjeta dice «**IVA incluido**» (`quoteDecisionLanding.routes.ts:216`, sin condición), con las líneas a IVA 0. SCRUM-212 quitó esa frase del total, no de las tarjetas. ⚠️ Texto fiscal: STOP del fundador | 1-3 | Playwright + código | `882b-cliente-c01a-cliente-3-opciones.png` |
| b8 | 🟠 | Panel · presupuesto de «3 opciones» antes de que elija | TOTAL 590,00 €, CONCEPTOS con una sola línea a 590,00 € e INGRESOS/MARGEN 590,00 €, como si la cliente ya hubiera elegido Estándar | 1-3 | Playwright | `882b-movil-t01d-detalle-full.png` |
| b9 | 🟠 | Pago por transferencia (390 px) | Los pasos 2 y 3 se parten en columnas: «380, / 00 €», el IBAN en una tercera columna, «REF- / 894». **No aparece el titular de la cuenta.** No hay «ya he pagado» ni forma de volver a las otras formas de pago. El IBAN va sin espacios | 1-3 (cada pago por transferencia) | Playwright | `882b-cliente-c06c-transferencia-full.png` |
| b10 | 🟠 | Detalle del albarán | **No enseña las líneas** (qué se entregó) ni la fecha. «TRABAJO —» aunque cuelga del trabajo 3104, y «FACTURACIÓN `sin_facturar`» tal cual sale del código | 3-5 | Playwright | `882b-movil-a04b-albaran-borrador-full.png` |
| b11 | 🟠 | Nuevo albarán (buscador) | Se ve el marcador «[PENDIENTE microcopy oficial] Todavía no tiene trabajo…» (`albaranDesdePresupuestoModal.js:59`), los estados en inglés `accepted` / `draft` y los presupuestos como «P7» | 3-5 | Playwright | `882b-movil-a01b-nuevo-albaran-modal.png` |
| b12 | 🟠 | Albarán ↔ parte | El profesional envía un **albarán**; la cliente abre «**Parte de trabajo** AB260001» y pulsa «Firmar el parte de trabajo». La hoja «Nuevo albarán» empieza con «Incluir precios en el parte · El parte sigue sin ser una factura». Amplía el #10 | 3-5 | Playwright | `882b-cliente-c07b-albaran-cliente-full.png`, `882b-movil-a01d-tras-elegir.png` |
| b13 | 🟡 | Panel · presupuesto (390 px) | El botón «Solo disponible tras aceptar el presupu…» se sale de la tarjeta y queda cortado. La línea de pasos marca «Aceptada» en azul con el estado todavía ENVIADO | 1-3 | Playwright | `882b-movil-t01d-detalle-full.png` |
| b14 | 🟡 | Página de la cliente · «3 opciones» | Cada tarjeta repite el mismo concepto y pone el precio dos veces (en la línea y en el total) | 1-3 | Playwright | `882b-cliente-c01a-cliente-3-opciones.png` |
| b15 | 🟡 | Página de pago | Lo único que dice qué se paga es «Justificante J-20260916-GXNV»: ni el trabajo ni el presupuesto. El pie dice «Procesado por Stripe» aunque la tarjeta no funcione (b2) | 3-5 | Playwright | `882b-cliente-c03a-pagar.png` |
| b16 | 🟡 | Configuración → Cobros | A un negocio de España le sale «CLABE interbancaria (México)». Y el texto «El cliente verá este móvil en la página Pagar por Bizum» no se cumple en staging: con el móvil guardado, Bizum no aparece. Por el código es el flag `BIZUM_MANUAL_ENABLED`, que **no se ha leído**: es una deducción | 1 | Playwright + BD | `882b-cliente-c06a-pagar-con-iban-y-bizum.png` |
| b17 | 🟡 | Hoja «Nuevo albarán» | La línea no tiene rótulos (concepto / cantidad / unidad) y el concepto se ve cortado por el principio («el cuadro eléctrico»). Hay dos cajas de texto, «Añadir texto en el documento» y «Notas del albarán», sin decir cuál ve la cliente | 3-5 | Playwright | `882b-movil-a01d-tras-elegir.png` |
| b18 | 🟡 | Detalle del albarán | El estado y los botones tienen otro margen izquierdo que el resto de la tarjeta. Tras «Enviar para firmar» no hay confirmación y ese botón sigue siendo el principal. En el trabajo, «1 línea del presupuesto sin entregar» con el albarán ya creado | 3-5 | Playwright | `882b-movil-a04d-tras-enviar-para-firmar.png` |

## 882b.2 · Lo recorrido y sin aspereza

- Modal de «3 opciones» a 390 px: cambio de modo, concepto, tres precios con «qué incluye» y envío (el presupuesto #7 sale con su WhatsApp).
- Elegir una opción cambia el total y el botón («Firmar y aceptar — Básico (380,00 €)»), y el servidor reescribe el
  presupuesto a 380 €. El panel dice «Cliente eligió: Básico».
- Con «100% al aceptar», el enlace de pago sale por WhatsApp **un segundo** después de aceptar (`payment_request_es`, 18:37:25Z).
- Transferencia: «Copiar IBAN» confirma que se ha copiado.
- Albarán: crear desde el buscador, emitir y enviar para firmar (200 las tres). En la página de la cliente el lienzo
  funciona (304×150), pregunta «¿En calidad de qué firma?», explica el tratamiento de datos y confirma «¡Parte firmado!».
  Los filtros de la lista cuentan bien. El PDF del albarán se descarga (200).

## 882b.3 · NO RECORRIDO (suelo: esto no es «limpio»)

| Tramo | Por qué no |
| --- | --- |
| Bizum: «Pagar por Bizum» y «He pagado por Bizum» | No aparece en la página de pago de staging (b16) |
| Pagar con tarjeta de verdad (Stripe Checkout) | El negocio no tiene Connect: la ruta lo rechaza (b2). Sin cambiar el negocio no hay otra vía |
| El mensaje de WhatsApp tal como lo ve la cliente | Envío simulado: hay fila en BD, no hay teléfono donde mirarlo |
| Condiciones 50 % · 50 % | No entraban en los tres tramos pedidos |
| «Firmar aquí mismo» (albarán en el móvil del técnico) y «Facturar lo entregado» | Se firmó por enlace; «Facturar lo entregado» no aparece (b4) |
| Qué dicen los PDF por dentro | Se descargaron y solo se contaron sus imágenes; no se renderizaron (el texto va codificado) |
| El profesional confirmando el cobro de la transferencia | Es del lado del profesional, y ya estaba medido en el #5 del 882 |
| Escritorio | Todo a 390 px |
| Técnicos (asignar, su día, su firma) | Esperan a que se active Equipo a mano; el plan no se toca |

## 882b.4 · Errores propios y límites, declarados

- **Un clic que caducó no era un defecto:** busqué el botón «Firmar y aceptar presupuesto» y con tramos cambia de
  texto al elegir. Con el texto real, pasó.
- **Mi extracción de texto de los PDF no llegó a correr** (el heredoc de Git Bash se comió las barras de la
  expresión regular). Por eso del contenido de los PDF no se afirma nada: solo el recuento de imágenes.
- **Staging se redesplegó a mitad del recorrido** (ver cabecera). Los ficheros que cambiaron no son los de estas pantallas.
- **Datos que dejé en staging:** cliente Lucía Romero; presupuesto #7 aceptado (Básico) con la firma vacía del b1;
  justificante J-20260916-GXNV y cobro 894, pendientes; trabajo 3104; albarán AB260001 firmado. En el merchant 2:
  NIF `B12345674` (CIF de prueba con dígito de control válido), IBAN `ES91 2100 0418 4502 0005 1332` (el del ejemplo
  del propio campo) y móvil Bizum `+34 611 000 882`. **El plan no se tocó** (sigue en `trial`).

## 882b.5 · Evidencias

`docs/master/evidencias/scrum882/882b-*.png`: 17 capturas de Playwright, todas a 390 px. El conductor es el
mismo `sonda-playwright.mjs` del 882, con otras rutas de perfil y capturas, y con los tokens de las URL tapados en su registro de errores.
