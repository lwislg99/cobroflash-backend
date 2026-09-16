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
