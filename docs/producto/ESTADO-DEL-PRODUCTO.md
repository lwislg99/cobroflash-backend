# Estado del producto · YaQu

**Última medida: 19-oct-2026, 06:43Z, retocada a las 06:5xZ** (`Date:` de GitHub) · `origin/main` = `fc4186483266ae85cc744d020bcfd6db76d8c5d3` · producción (`/version`) = el mismo `fc418648`, leído a las 06:5xZ · la escribió S0 (SCRUM-1563c). Las anteriores (18-oct, 17:13Z y 18:46Z) siguen en el historial de git. **Entre las 19:37Z del 18 y las 06:48Z del 19 no entró nada en `main`; a las 06:48:54Z entró #2568 (6.11) mientras se escribía esto.**

**Nota, 19-oct-2026 ~11:17Z (S0): no es una medida nueva completa** (no se ha vuelto a correr el recuento de §5 ni a releer cada fila de §2); sólo estos tres hechos, comprobados en `origin/main` = `ea8dece1d` y en GitHub:

- **1563d (la medida de las 07:5xZ) SIGUE SIN ENTRAR:** su PR, **#2604**, está ABIERTO desde las 07:43:10Z. El check obligatorio «build + tests» cae, pero **no por el contenido de 1563d** (que sólo toca `docs/`): el log muestra el caso ya conocido `scrum1405c④` («con el módulo la cobaya SIGUE perdiendo casos: la salida C no basta»), el mismo que mide la §26.1 de `docs/equipo/para-javier.md` (7 de 7 pushes a `main` caídos por esto el 16-18 oct). No es nuestro carril (J6/S3): no se ha tocado.
- **Desde el snapshot de 1563d (07:52Z) entraron 9 merges más en `main`** sin recontar aquí: #2593 (999), #2594 (1357h), #2595 (1265, ya en §8 según c.20006), #2596 (1428, para-javier §26), #2597 (1236f), #2598 (49d), #2599 (231b), #2602 (1233i), #2603 (1390b).
- **Nuevo, hoy:** `docs/equipo/para-javier.md` §27 (PR **#2606**) censa los 23 tickets de `equipo-javier` con merge sin cerrar que el tramo 1563c de §4 nombraba pero no detallaba uno a uno, y añade SCRUM-1529 (cerrable, carril J3) y SCRUM-1532 (sostiene la fila 4.5: medición pura, sin ticket que la releve si se cierra).

**Qué es:** UN documento que se ACTUALIZA, no un informe nuevo cada vez. Dice qué le falta al producto para estar completo, de quién depende cada cosa, qué la bloquea y cómo va. Lo pidió el fundador el 18-oct-2026: «molaría sacar un informe con todas las tareas que tenemos que cerrar para el producto y ver cómo las vamos cerrando, para tener algo controlado».

**Cómo se lee:**
- Una fila es **una cosa que le falta al producto**, no un ticket.
- **Depende de:** NOSOTROS (equipo de Luis, S0-S5) · JAVIER (equipo de Javier, J1-J6) · FUNDADOR (Luis) · ASESOR.
- **Bloqueo:** lo que hay que conseguir, con su nombre. Si dice «ninguno», la fila sólo espera a que alguien la trabaje.
- **Fuente:** de dónde sale la fila. «c.NNNNN» es el último comentario del ticket que se leyó. Un PR con fecha está comprobado en GitHub.
- **Los números de fila no cambian.** Una fila hecha pasa a §8 con su número; una nueva toma el siguiente libre de su bloque. Así la página del fundador y este fichero siguen hablando de la misma fila.

⚠️ **«Fundador» en los comentarios del equipo de Javier puede ser JAVIER**, no Luis: SCRUM-1525 c.19365 llama «la cuenta del fundador» a la de Javier, y SCRUM-1028 dice «decisión de Javier (jefe)». Aquí FUNDADOR es siempre Luis. Donde la decisión es de Javier, la fila dice JAVIER.

⚠️ **Lo medido por otra sesión va con su nombre.** «Medido por S2» quiere decir que lo midió S2 y que S0 no lo ha repetido. Lo que S0 ha medido él mismo lo dice («medido por S0», con la hora).

---

## 1 · La respuesta corta

1. **Hoy, en España, un profesional puede presupuestar, enviar por WhatsApp y hacer firmar. No puede facturar ni cobrar por YaQu.** La regla 24 lo impide hasta que SIF-1 esté 8/8 con una factura real aceptada por la AEAT (Parte U del máster, fila 3).
2. **El WhatsApp de producción está VIVO, pero el enlace de firma que manda llega ROTO** (2.9). Meta contestó a un envío real con un código suyo (§8, 2.1). El enlace del albarán llegó con el marcador `{{1}}` escrito dentro: lo que mandamos es sólo el token, y la parte fija de la dirección está en Meta. **Otras tres plantillas usan el mismo mecanismo, entre ellas la del presupuesto, y nadie ha mirado cómo están registradas** (2.10). Las dos filas son del fundador. **El cliente que abre ese enlace ve un 404: «Documento no disponible… pide al profesional que te reenvíe el enlace»** (medido por S0 el 19-oct con un token falso: con el prefijo `%7B%7B1%7D%7D` y sin él sale la misma página).
3. **La cuenta DEMO no puede crear presupuestos** (7.8): su prueba venció el 5-jun-2026. Es la cuenta con la que se enseña el producto. Y, según el orquestador, **al fundador no le llega el correo de `demo@yaqu.app`**, así que no puede entrar con ella.
4. **Quien se suscribe no recibe su fecha de fin de periodo** (5.2), así que si cancela pierde el acceso al instante, contra lo que firmó el fundador. Ya tiene ticket propio, **SCRUM-1565 (J2)**, con la autorización del fundador dentro. Está en «Tareas por hacer», sin comentarios y **sin rama en el remoto** (06:4xZ).
5. **La primera pieza de todas sigue siendo la S.L.** (SCRUM-1561). De ella cuelgan el Convenio 017 con la AEAT, el NIF del productor, el certificado del servidor, Stripe en modo real, la suscripción y la cesión del código.
6. **De las 66 cosas que faltan, 44 necesitan al fundador y 29 dependen SÓLO de él.** El detalle, en §3.
7. **Lo que el equipo de Luis puede mover hoy sin esperar a nadie es UNA cosa, y es pequeña:** mirar en producción, con sesión, la cabecera de caché de los CSV (6.11). El arreglo, #2568, **entró en `main` a las 06:48:54Z y producción ya lo sirve**. La otra de ayer (2.2, SCRUM-1237) está hecha. **De las otras 65 filas, 63 esperan al fundador, a Javier o al asesor; las 2 que quedan (2.5 y 6.10) esperan algo que no tiene dueño** (§3).

---

## 2 · Qué le falta, por bloque

### 0 · Antes de todo: la empresa

| # | qué le falta al producto | ticket | depende de | bloqueo | fuente |
|---|---|---|---|---|---|
| 0.1 | Constituir la S.L. (con NIF) | SCRUM-1561 | FUNDADOR | — (es el bloqueo de los demás) | descripción, 17-oct. SCRUM-143 c.19621: «S.L. en trámite, hacia mediados de noviembre», según la hoja de ruta del asesor |
| 0.2 | Ceder a la S.L. los derechos del código | SCRUM-1283 | FUNDADOR | «S.L. sin constituir» | descripción (0 comentarios) |
| 0.3 | Tener asesor fiscal | SCRUM-1264 | FUNDADOR | «no hay asesor fiscal» | c.19623 (14-oct) |

### 1 · Presupuestar (funciona hoy; esto es lo que falta)

| # | qué le falta al producto | ticket | depende de | bloqueo | fuente |
|---|---|---|---|---|---|
| 1.1 | 🔴 **CON FECHA, 1-ene-2027:** la ficha de un presupuesto cuya secuencia se repite da 500 | SCRUM-1490 | FUNDADOR | «consulta de sólo lectura en producción + OK a 2 líneas del camino de emisión» | c.19446 (#2252 ya está en producción; falta la aceptación 6) |
| 1.2 | El presupuesto rápido sale al 0 % de IVA: falta construir «lo tecleado es precio final» | SCRUM-1439 | ASESOR | «desglose hacia atrás al 21 %: dictamen» | c.18224 |
| 1.3 | Qué dice un documento cuando el IVA no está indicado («IVA 0 %») | SCRUM-1438 | ASESOR + FUNDADOR | «claim fiscal» | descripción (0 comentarios) |
| 1.4 | En la página de aceptar, las líneas de cada opción van sin impuesto y el total con impuesto (hoy el panel no lo produce) | SCRUM-1433 | FUNDADOR | «decisión de qué enseña la línea» | c.18156 |
| 1.5 | Una cabecera de apartado dentro de una opción se pinta «NaN EUR» **en el PDF** (sólo por API). La página pública ya está bien | SCRUM-1442 | JAVIER (J1) | ninguno: el aviso a J1 (`pdf.service.ts:909-914`) está en `para-javier.md` §25 (#2576, MERGEADO el 18-oct 18:54:15Z). NO CONSTA que J1 lo haya cogido | página pública: #2559 MERGEADO el 18-oct 00:37Z, y **vista en producción por S2** (opciones A y B sin «NaN», a 390 y 1280). PDF del #210: **sigue con «undefined» y «NaN EUR», medido por S2**. Jira no lo dice: su último comentario es c.18216 (2-oct) |
| 1.6 | El profesional no lee en ningún sitio lo de los 1-2 céntimos entre presupuesto y facturas | SCRUM-1451 | FUNDADOR | «firma de texto (regla 39)» | descripción (0 comentarios) |
| 1.7 | Copiar el enlace entrega el presupuesto, pero su estado sigue en `draft` | SCRUM-1297 | FUNDADOR | «cambio de máster (Parte L)» | descripción (0 comentarios) |
| 1.8 | Un Técnico podía abrir y aceptar presupuestos ajenos: arreglado, y sin verificar con un Técnico de verdad | SCRUM-1555 | FUNDADOR | «test-login sólo abre propietarios; el plan de prueba admite 1 usuario» | c.19743 (#2456 en producción) |
| 1.9 | Guardar como plantilla un presupuesto de 3 opciones | SCRUM-1545 | NOSOTROS + FUNDADOR | «encargo de diseño». El punto 3 (validar las opciones al guardar la plantilla) lo propuso S1 y espera sólo la elección del orquestador | descripción (0 comentarios) · traspaso de S1, 18-oct ~18:30Z |
| 1.11 | Aviso del 40 % de materiales en una reforma de vivienda | SCRUM-1074 | ASESOR + JAVIER | «Q-C1 y SCRUM-1052» | descripción (0 comentarios) |
| 1.12 | El «mensaje con IA» del presupuesto está construido desde el 22-may y no tiene botón | SCRUM-1182 | FUNDADOR | «decidir: enchufarlo o retirarlo» | descripción (0 comentarios) |

### 2 · Enviar y firmar

| # | qué le falta al producto | ticket | depende de | bloqueo | fuente |
|---|---|---|---|---|---|
| 2.3 | El correo puede decir «ok» sin salir, y ninguna pantalla enseña el rebote | SCRUM-1558 | NOSOTROS (S1 + S2) + FUNDADOR | **(a) ya está en `main`.** Queda (b), el rebote, que necesita «firma de texto». Y su gemelo del enlace de acceso (1558b) espera a que el fundador ponga `LOG_MAGIC_LINKS=true` en staging | (a): #2522, MERGEADO el 16-oct 12:46Z; el registro dice que la pantalla no necesita nada para (a). 1558b: rama `espera/scrum-1558b-…`, existe y no tiene PR (a propósito). Ticket sin comentarios |
| 2.4 | Lo que escribe el CLIENTE sale en su ficha como un envío nuestro | SCRUM-1518 | NOSOTROS (S2) | «firma del rótulo del chip» | descripción (0 comentarios) |
| 2.5 | Firmar sin cobertura: sin red no se crea albarán ni parte, no van las fotos, y al reabrir manda a `/login` | SCRUM-307 | NOSOTROS (S2) | «prueba con un iPhone de verdad» | c.16463 (22-sep) |
| 2.6 | «Voy de camino», aviso de visita y el portal en el pie del WhatsApp | SCRUM-975 · 981 · 1143 | FUNDADOR | «plantillas de Meta: una sola visita para las tres» | c.16051 · c.16297 · descripción |
| 2.7 | Con teclado no se abre una factura | SCRUM-1562 | JAVIER (J1) | ninguno | Trabajos (#2561) y Partes de oficina (#2560) ya están en `main`, **vistos en producción por S4 y S2**. La sonda de S3 (#2566, en `main`) deja **2 filas sin teclado y sin alternativa, las dos de Facturas** (`invoicesView.js`, J1) |
| 2.8 | El tope de plantillas por cliente se puede rebasar en una ráfaga | SCRUM-1513 | JAVIER (J2) | ninguno | c.19002. #2325 MERGEADO el 8-oct; la ráfaga, medida y sin cerrar |
| 2.9 | 🔴 **NUEVA · El enlace de FIRMA que llega por WhatsApp no funciona:** llegó `yaqu.app/albaran/%7B%7B1%7D%7D<token>`, el marcador `{{1}}` escrito tal cual y el token pegado detrás | sin ticket | FUNDADOR | **corregir la dirección del botón de `albaran_para_firmar_es` en WhatsApp Manager**. Desde el repo no se puede | nosotros mandamos SÓLO el token: `src/integrations/whatsappTemplates.ts:130-136` (medido por S4; leído otra vez por S0 sobre `74e60ebe`). La parte fija la pone Meta. Escrito también en `para-javier.md` §25 (#2576, en `main` desde las 18:54Z). ⚠️ `docs/WHATSAPP_TEMPLATES.md` §8 es la única de las cuatro fichas que **no escribe la dirección completa** (dice `/albaran/{{token}}`); las otras tres sí (`:132`, `:166`, `:242`) |
| 2.10 | 🔴 **NUEVA · Las otras tres plantillas con enlace pueden tener el mismo defecto, y no está mirado:** `quote_decision_es` (el botón del PRESUPUESTO), `payment_request_es` y `payment_confirmation_invoice_es` | sin ticket | FUNDADOR | **mirar en WhatsApp Manager la dirección de los tres botones** contra `docs/WHATSAPP_TEMPLATES.md:132`, `:166` y `:242`. Ninguna sesión ve el panel de Meta | `WA_TEMPLATE_SPECS` (`whatsappTemplates.ts:57-68`): son 4 las plantillas con botón de URL dinámica, y las 4 mandan sólo el final de la dirección. NO CONSTA un envío real de ninguna de las tres que se haya abierto en un móvil. Las plantillas se dan de alta **a mano** en WhatsApp Manager, no con un script del repo (`SPEC_SCRUM47_ALBARAN_FIRMADO_WA.md` §5), así que el defecto no sale de nuestro código |
| 2.11 | **NUEVA · Dos de los tres programas que mandan correo pueden salir todavía con la marca vieja** («PresuFácil»): el aviso programado de acreditación y el respaldo programado. El del backend (presupuestos, facturas) ya sale como `YaQu <no-reply@yaqu.app>` | SCRUM-1115 | FUNDADOR | **leer `EMAIL_FROM` en esos dos servicios de Railway**, o el `From` de su último envío en Resend. Desde el repo no se puede: ningún registro guarda el remitente efectivo | c.19624 (14-oct): el backend, **confirmado con una captura del fundador**; los dos cron, «sin verificar». #2433 (14-oct) concluyó que es configuración, no código. El ticket sigue en «Tareas por hacer». Esta fila la encontró S0 el 19-oct al volver a medir §4: no estaba entre las leídas el 18 |

### 3 · Facturar (SIF-1 · regla 24)

| # | qué le falta al producto | ticket | depende de | bloqueo | fuente |
|---|---|---|---|---|---|
| 3.1 | El Convenio 017 con la AEAT (exige sociedad mercantil) | SCRUM-143 | FUNDADOR | «S.L. constituida» | c.19621 (14-oct) |
| 3.2 | El nombre del productor que viaja a Hacienda | SCRUM-870 | FUNDADOR | «NIF de la S.L.» | c.19630. El marcador de pruebas ya está arreglado |
| 3.3 | El certificado de entidad en el servidor | sin ticket | FUNDADOR | «S.L. constituida» | SCRUM-1561: el fundador dijo el 13-oct que llega «en un mes» |
| 3.4 | Enviar a la AEAT desde el servidor (S1-D): anulación, R1, ≥10 registros seguidos, el cliente automático y su cola | SCRUM-1110 (el mapa es SCRUM-1531, Finalizada) | JAVIER (J1) | ninguno para pruebas; para producción, el Convenio 017 | c.16732 (24-sep). La AEAT de pruebas aceptó 1 alta |
| 3.5 | La declaración responsable del productor (S1-E) | SCRUM-523 | JAVIER (J1) + FUNDADOR | «NIF del productor» | c.16571 (23-sep) |
| 3.6 | La revisión fiscal externa (S1-F) | sin ticket | FUNDADOR | «no hay asesor fiscal» (0.3) | Parte U del máster; criba del 14-oct §2 |
| 3.7 | El paso a producción de la AEAT, con una factura real aceptada (S1-G) | sin ticket | FUNDADOR + JAVIER | «Convenio 017» | Parte U del máster, fila 3 |
| 3.8 | Reintentar un sellado que falló (el mecanismo existe y no corre) | SCRUM-1507 | JAVIER (J1) + NOSOTROS (S1) | «el PR-2 de Javier no existe» | c.19511 · `docs/equipo/para-javier.md` §15 |
| 3.9 | `ClaveRegimen` va fija a «01» para todos | SCRUM-1129 | JAVIER (J1) + FUNDADOR | «GO regla 40 + ALTER + firma de texto» | c.17405 |
| 3.10 | El criterio de caja no llega al registro ni al PDF (mención ROF 6.1.p) | SCRUM-1240 | JAVIER (J1) + FUNDADOR + ASESOR | «GO regla 40 + firma de texto» | c.17410 |
| 3.11 | Tipo F2 con una huella calculada sobre F1 | SCRUM-1258 | JAVIER (J1) | ninguno | c.17715. **#2048 MERGEADO el 1-oct** (§4) |
| 3.12 | Re-sellar pisaba la huella de una factura emitida | SCRUM-1330 | JAVIER (J1) | ninguno | c.19535: la guarda está en `main` (#2053, 1-oct) y en producción hay 0 duplicadas; falta medir el doble encolado a la AEAT |
| 3.13 | Un cobro con tarjeta podía emitir dos facturas | SCRUM-1304 | JAVIER | ninguno | c.17737: el arreglo va en **#2053, MERGEADO el 1-oct** (§4) |
| 3.14 | Acreditar en producción que ningún profesional real emite (el interruptor apagado) | SCRUM-1097 · 1101 · 1109 | JAVIER (J6) + FUNDADOR | «variable de sólo lectura en Railway» (1109) | c.16655 · descripciones |
| 3.15 | Las retenciones en el resumen del trimestre | SCRUM-1146 | FUNDADOR | «GO para el camino de emisión» | c.19788: ninguna factura aplica retención todavía |
| 3.16 | Quitar «[PENDIENTE]» del libro y de la exportación | SCRUM-1041 | ASESOR | «dictamen (PREGUNTAS_ASESOR §21)» | c.17186 |
| 3.17 | La puerta de go-live: lo que tiene que ser verdad antes de encender la facturación | SCRUM-1554 | NOSOTROS + JAVIER + FUNDADOR | «revisión de go-live; falta el mecanismo que lo impida» | c.19746 |

### 4 · Cobrar al cliente (CONNECT-1)

| # | qué le falta al producto | ticket | depende de | bloqueo | fuente |
|---|---|---|---|---|---|
| 4.1 | Stripe en modo real | SCRUM-41 | FUNDADOR | «S.L. constituida + SIF-1» | c.16294 (21-sep) |
| 4.2 | Dos secretos de webhook en Railway (Connect y Mercado Pago) | SCRUM-678 | FUNDADOR | ninguno: hacen falta antes de encender Connect o Mercado Pago | c.19059 |
| 4.3 | Un Bizum ya pagado puede pasar a «caducado» (en producción hay 0) | SCRUM-1292 | JAVIER (J2) + FUNDADOR | «GO de dinero» | c.17637 |
| 4.4 | Una factura cobrada a mano sigue como deuda, con el enlace de pago vivo | SCRUM-1429 | JAVIER (J1/J2) | «decisión sobre el cobro (Charge)» | c.18211 |
| 4.5 | Cancelar un cobro: el estado existe y nadie llega a él | SCRUM-1532 | FUNDADOR | «GO + 2 decisiones (el dinero que entra y la factura)» | c.19235 |

### 5 · Que nos paguen (PRECIOS-1)

| # | qué le falta al producto | ticket | depende de | bloqueo | fuente |
|---|---|---|---|---|---|
| 5.1 | La suscripción en modo real (claves reales y precios recreados) | 🔴 sin ticket propio; cuelga de SCRUM-41 | FUNDADOR | «S.L. + Stripe en modo real» | SCRUM-1561, descripción |
| 5.2 | 🔴 **Al suscribirse no se escribe la fecha de fin de periodo (`planExpiresAt`).** Quien cancele perdería el acceso al instante, contra lo firmado por el fundador el 7-sep y el 16-sep (SCRUM-809 c.14694 y c.15508) | **SCRUM-1565** (creado el 18-oct a las 19:32Z; etiquetas `area-j2`, `dinero`, `equipo-javier`). SCRUM-809 sigue Finalizada | JAVIER (J2) | ninguno: **el fundador lo autorizó el 18-oct a las 18:35Z**. La cita, con su uuid `1c5a7185-addc-4245-9438-ef4f0313eb81`, está en la descripción de SCRUM-1565 (verificada en la transcripción por S1 y S4). La receta de S1 va dentro. **A las 06:4xZ del 19: «Tareas por hacer», 0 comentarios, ninguna rama con su número en el remoto.** NO CONSTA que J2 lo haya cogido | declarado en `SCRUM-809.md:237` (#2569). La causa, confirmada con el cuerpo del 400 que guarda Stripe (`planExpiresAt: new Date("Invalid Date")`, API `2025-10-29.clover`, 2 entregas fallidas), en el tramo que añadió #2578 |

### 6 · Gestionar

| # | qué le falta al producto | ticket | depende de | bloqueo | fuente |
|---|---|---|---|---|---|
| 6.1 | Encender los mantenimientos (construidos y apagados) | SCRUM-911 | FUNDADOR | «GO escrito + plantilla de Meta» | c.19807 |
| 6.2 | Fichaje (registro de jornada) | SCRUM-913 | JAVIER + FUNDADOR | «ALTER + decisiones de ubicación, interruptor, textos y plan» | c.19821 |
| 6.3 | Equipos del cliente | SCRUM-914 | NOSOTROS + JAVIER | «respuesta del orquestador de Javier (J3 en el mismo PR)» | c.19414 |
| 6.4 | «Volver a llamar» dentro del cliente | SCRUM-1056 | JAVIER (J2/J3) | ninguno | c.19731: lo de S2 está en `main` sin montar |
| 6.5 | Preguntar la actividad junto a la retención de IRPF | SCRUM-1072 | NOSOTROS (S2) + JAVIER (contenedor J3) + ASESOR | la pantalla vive en `settingsView` (J3). Su punto 6 (que salga en el Resumen del trimestre) lo aparcó el orquestador hasta que el asesor conteste la Q-C5: rama `espera/scrum-1072c-…`, sin PR | c.19859. El servidor está en `main` (#2506). `SCRUM-1072.md:38` y `:43`: los dos puntos, «NO HECHO» |
| 6.6 | Leer el ticket con IA y que el gasto entre por WhatsApp | SCRUM-961 · 971 | FUNDADOR | «5 fotos reales de tickets» | c.19330 · c.16053 |
| 6.7 | Bandeja de gastos con estados | SCRUM-1069 | FUNDADOR | «cambio de máster (estados)» | descripción (0 comentarios) |
| 6.8 | Las fechas que se imprimen van en UTC (un albarán de las 00:30 lleva la víspera) | SCRUM-1445 | FUNDADOR + NOSOTROS + JAVIER | «firma de las 3 líneas del concepto» | c.19437 |
| 6.9 | La pantalla de provincia | SCRUM-1522 | JAVIER + FUNDADOR | «SCRUM-1536» | c.19338 |
| 6.10 | Las casillas de métodos de pago miden 20 px | SCRUM-1265 | NOSOTROS (S2) | «decidir el patrón; NO CONSTA quién» | descripción (0 comentarios) |
| 6.11 | **Las exportaciones CSV sólo están protegidas por la regla de Cloudflare:** la cabecera de caché del origen no ha entrado | SCRUM-231 (Finalizada desde el 3-ago; el tramo 231b vive en `docs/master/SCRUM-231.md`). **Ningún ticket abierto sigue esta fila** | NOSOTROS (S1) | ninguno: **falta VERLO en producción.** #2568 **MERGEADO el 19-oct a las 06:48:54Z** (`fc418648`), y producción lo sirve desde las 06:5xZ. Pone `Cache-Control: private, no-store` en todo el router de exportaciones (`exports.routes.ts`). **Sin sesión no se ve:** el 401 lo da `requireRole('admin')` antes del router (`app.ts:664`); medido por S0 a las 06:5xZ, los CSV sin cookie dan 401 sin esa cabecera (control: `/version` sí devuelve la suya, `no-store`). Hace falta una descarga **con sesión**. Cómo llegó: el rojo de las 18:05Z (5 guards) se declaró en `6ee2b55`; el intento 1 sobre ese commit cayó por UN test (SCRUM-1405c ④) y el intento 2, lanzado a las 06:35Z, salió verde a las 06:48:28Z | la mitad del fundador (SCRUM-1564) funciona: **medido por S0** a las 18:39Z del 18 (los 7 CSV) y otra vez a las 06:4xZ del 19 (`quotes.csv` y `jobs.csv`): 401 con `cf-cache-status: DYNAMIC` (§8) |

### 7 · Para salir a vender

| # | qué le falta al producto | ticket | depende de | bloqueo | fuente |
|---|---|---|---|---|---|
| 7.1 | La decisión de posicionamiento (no se puede vender facturación que no se puede usar) | SCRUM-328 | FUNDADOR | «enmienda A4.1 del máster sin redactar + SCRUM-534» | c.16771 (24-sep) |
| 7.2 | El guion H2 sobre VeriFactu dice cosas falsas | SCRUM-534 | JAVIER (J4) | ninguno | c.19589. **#2425 MERGEADO el 14-oct** (§4) |
| 7.3 | Textos falsos en la landing pública y en el bot | SCRUM-1236 | FUNDADOR | «firmar los recambios #4, #6, #7 y #9, y el B1 del bot» | c.19863 |
| 7.4 | Documentos legales servidos que prometen cobro | SCRUM-1551 · 1028 | FUNDADOR · JAVIER | «go-live (SCRUM-1554)» | c.19547 · c.16369 |
| 7.5 | El `title` y los dos H1 de la landing | SCRUM-1016 | JAVIER (J3) | ninguno | c.19608 |
| 7.6 | El respaldo de producción: el volcado no está programado | SCRUM-1525 | JAVIER + FUNDADOR | «3 decisiones: retención, RPO/RTO, tarea de Railway» | c.19365. #2370 (el correo) MERGEADO el 13-oct |
| 7.7 | Apagar `test-login` en producción antes de lanzar | SCRUM-1210 | FUNDADOR | ninguno: se cierra el día que se apague | descripción (0 comentarios) |
| 7.8 | 🔴 **La cuenta DEMO no puede crear un presupuesto:** `POST /quote/create` contesta 403 `trial_expired` (su prueba venció el 5-jun-2026). Es la cuenta con la que se enseña el producto. **Y al fundador no le llega el correo de `demo@yaqu.app`**, así que tampoco puede entrar con ella (lo dice el orquestador, 19-oct; S0 no lo ha medido) | sin ticket | FUNDADOR | decidir cómo se le devuelve el acceso (el plan o la fecha de la cuenta, en la base de producción) y **hacer que el correo de `demo@yaqu.app` llegue a algún buzón**. NO CONSTA que esté decidido. **Medido por S0 a las 06:4xZ:** `yaqu.app` sí tiene MX, los de Cloudflare Email Routing (`route1/2/3.mx.cloudflare.net`; control: `gmail.com` da los suyos). **MI LECTURA, sin medir:** si el correo no llega, lo probable es que falte una regla de reenvío para esa dirección en Cloudflare, y eso sólo se ve en su panel | **medido por S2** el 18-oct, con control (la cuenta QA, a la misma ruta, da 400 y no 403). La sonda (`muro-plan.mjs`) vive fuera del repo. S0 no lo ha repetido: entrar con la demo pisa la sesión QA que comparten las demás |

---

## 3 · De quién depende

Sobre las **66 filas** de §2 (66 de ayer − 1 hecha, la 2.2 + 1 nueva, la 2.11). Una fila puede depender de más de uno, así que las columnas no suman 66.

| | filas en las que aparece | filas que dependen SÓLO de él |
|---|---|---|
| **FUNDADOR** | **44** | **29** |
| JAVIER | 28 | 12 |
| NOSOTROS | 11 | 4 |
| ASESOR (hoy no hay) | 6 | 2 |

Contado por máquina sobre la columna «depende de» de §2: `node docs/master/evidencias/SCRUM-1563/contar-dependencias.mjs docs/producto/ESTADO-DEL-PRODUCTO.md`. Se vuelve a correr en cada actualización. **El primer recuento, hecho a mano, daba 28 · 25 · 8 · 6 · 1, y estaba mal. Y el de la segunda medida, a mano, daba 64 filas y 44 del fundador: también mal.** Control de hoy: el mismo comando sobre la versión de ayer a las 18:46Z da lo que se publicó entonces (66 filas · 43/28 · 28/12 · 12/5 · 6/2). Diferencia: sale la 2.2 (sólo NOSOTROS) y entra la 2.11 (sólo FUNDADOR).

### Lo que el equipo de Luis puede mover HOY sin esperar a nadie: UNA cosa, y es pequeña

| fila | qué | quién | estado a las 06:5xZ |
|---|---|---|---|
| 6.11 | **ver en yaqu.app, con sesión, que la descarga de un CSV trae `Cache-Control: private, no-store`** | S1 (o quien tenga la cuenta QA) | el arreglo, #2568, entró en `main` a las 06:48:54Z y producción lo sirve. Si se ve, la fila pasa a §8. **Ningún ticket abierto la sigue** (SCRUM-231 está Finalizada desde agosto) |

**La cuenta de las 66 filas:**

| | filas |
|---|---|
| esperan al FUNDADOR, a JAVIER o al ASESOR (alguno de los tres está en «depende de») | **62** |
| dependen sólo de NOSOTROS, pero su bloqueo es una firma del fundador (2.4) | **1** |
| dependen sólo de NOSOTROS y esperan algo que **no tiene dueño**: un iPhone de verdad (2.5) y decidir el patrón de las casillas (6.10) | **2** |
| dependen sólo de NOSOTROS y **no esperan a nadie** (6.11) | **1** |
| **total** | **66** |

**Ayer eran dos movibles. Hoy es una porque la otra se hizo:** 2.2 (SCRUM-1237) se vio en producción y se cerró (§8). No ha entrado ninguna nueva.

**Lo que pasaría a movible con una decisión del orquestador, sin nadie de fuera** (no son filas de §2):

| qué | quién | estado |
|---|---|---|
| el punto 3 de SCRUM-1545 (validar las opciones al guardar la plantilla) | S1 | lo propuso S1; espera que el orquestador lo elija |
| 6 controles táctiles de Productos (`productsView.js`: Editar/Activar y la casilla «solo activos», a 14 px) | S2 | sin repartir. `productsView.js` **no ha cambiado** desde la medida de S3 (`57b0bc82`), así que siguen ahí |
| 2 controles táctiles de la ficha del albarán (`albaranDetailView.js`) | S4 | **NO CONSTA si siguen:** el fichero cambió después de la medida de S3 (#2579, 1206e, la ficha en rejilla). Hay que volver a medirlo antes de repartirlo |

**Ya no está en esa lista:** la tabla de Albaranes (S2) entró en `main` con #2589 (1559i) a las 19:22Z del 18.

**Lo que la medida de las 17:13Z daba por movible y NO lo era:** la mitad (a) de 2.3 (SCRUM-1558) **ya estaba en `main` desde el 16-oct** (#2522). Lo escribió S0 sin mirar `main`.

Las demás filas donde aparecemos esperan a alguien: 1.9 (diseño, fundador), 2.3 (firma y staging, fundador), 2.4 (firma, fundador), 3.8 (Javier), 3.17 (go-live, fundador y Javier), 6.3 (orquestador de Javier), 6.5 (J3 y el asesor), 6.8 (firma, fundador). Y 2.5 y 6.10, sin dueño.

---

## 4 · Arreglos ya en `main` con el ticket todavía abierto

Puede que estén acabados y sólo falte cerrarlos. Lo cierra el orquestador del equipo dueño (A13). **No está medido si cubren su aceptación entera**, salvo donde la columna «qué falta» lo dice. **Re-medida el 19-oct a las 06:4xZ:** estados leídos en Jira en ese momento, PR comprobados en GitHub.

**Cómo se midió esta vez (no de memoria):** se sacaron de `git log origin/main --merges` todas las ramas `scrum-<n>-…` mergeadas desde el 11-oct (**110 tickets distintos**) y se preguntó a Jira cuáles siguen abiertos: **54**. ⚠️ **Que un ticket tenga un merge con su número no quiere decir que su arreglo esté hecho:** muchos de esos merges son un registro, una sonda o una propuesta (por ejemplo #2360 de 1532 y #2418 de 1551 sólo tocan `docs/`). Por eso la tabla recoge sólo los que **arreglan algo del producto**, comprobados por el título del PR. Los 54, con su último merge, están en el tramo 1563c de `docs/master/SCRUM-1563.md`.

| ticket | equipo | qué entró | qué falta, según su registro o su último comentario | estado del ticket (19-oct) |
|---|---|---|---|---|
| SCRUM-1564 | sin etiqueta (orquestador de Luis) | no es un PR: **la regla de Cloudflare para `/admin/*`, puesta por el fundador.** Medida por S0: 401 con `DYNAMIC` a las 18:39Z del 18 y a las 06:4xZ del 19 | nada de su mitad. La otra mitad, el origen, es #2568: **entró a las 06:48:54Z del 19** y falta verla con sesión (6.11) | **Acción del fundador** |
| SCRUM-1233 | Luis | #2588, MERGEADO el 18-oct 19:37Z (1233h: sin enlace, la barra de fallo de WhatsApp ya no ofrece copiar la portada) | NO CONSTA: el ticket es un censo de pantallas, y 1233h es una pieza | En curso |
| SCRUM-1444 | Luis (sin etiqueta de equipo) | #2584, MERGEADO el 18-oct 19:09Z (1444c: `numeroVisible` en las respuestas de S1) | NO CONSTA: el ticket es un censo de ~90 sitios | En curso |
| SCRUM-1442 | Luis + Javier | #2559, MERGEADO el 18-oct 00:37Z (página pública, vista por S2) | el PDF, de J1 (1.5) | Tareas por hacer |
| SCRUM-1562 | Luis + Javier | 11 PR con su número; el último, #2566 (18-oct 17:53Z); los de Trabajos (#2561) y Partes (#2560), vistos en producción | Facturas, de J1 (2.7) | Tareas por hacer |
| SCRUM-1558 | Luis | #2522, MERGEADO el 16-oct 12:46Z (la mitad a) | (b), con firma; 1558b, con staging (2.3) | Tareas por hacer |
| SCRUM-1072 | Luis + Javier | #2506, MERGEADO el 16-oct 12:03Z (el servidor) | la pantalla (J3) y el punto 6 (asesor) (6.5) | En curso |
| SCRUM-1115 | Javier | #2433, MERGEADO el 14-oct 08:18Z (el veredicto: es configuración). El fundador cambió `EMAIL_FROM` del backend y lo probó con una captura | los dos cron (2.11) | Tareas por hacer |
| SCRUM-529 | Javier | #2409, MERGEADO el 14-oct 03:22Z (cada envío de WhatsApp guarda a qué número se mandó) | NO CONSTA | En curso |
| SCRUM-1258 | Javier | #2048, MERGEADO el 1-oct-2026 03:33Z | NO CONSTA | Tareas por hacer |
| SCRUM-1304 | Javier | #2053, MERGEADO el 1-oct-2026 05:36Z | NO CONSTA | Tareas por hacer |
| SCRUM-1513 | Javier | #2325, MERGEADO el 8-oct-2026 10:33Z | la ráfaga | Tareas por hacer |
| SCRUM-534 | Javier | #2425, MERGEADO el 14-oct-2026 07:08Z | NO CONSTA | Acción del fundador |
| SCRUM-1525 | Javier | #2370 (el correo), MERGEADO el 13-oct-2026 12:27Z | programar el volcado | Tareas por hacer |

**Sale de la tabla:** SCRUM-1237, cerrado el 18-oct a las 19:06:56Z, con su VISTO en producción (§8).
**Ningún ticket de §2 ha cambiado en Jira desde la medida de ayer, salvo SCRUM-1237 (cerrado).** Se consultaron los otros 62: con `updated >= "2026-10-18 20:20"` (hora de Madrid) la consulta devuelve 0, y sin ese filtro devuelve los 62. El último que se tocó fue SCRUM-1562, a las 00:12Z del 18. SCRUM-1565 y SCRUM-1115 se leyeron aparte.

---

## 5 · Cómo va

Una fila por medida. **No se borra ninguna:** se añade la nueva arriba.

| medida (hora de GitHub) | abiertos en SCRUM | del equipo de Luis | sólo de Javier | sin etiqueta de equipo | cerrados desde el 14-oct (Luis + sin etiqueta) | creados desde el 14-oct (Luis + sin etiqueta) | filas de §2: hechas / quedan |
|---|---|---|---|---|---|---|---|
| 19-oct-2026 06:4xZ | 268 | 53 | 165 | 50 | 45 | 10 | 1 hecha / 66 (entra 1 nueva) |
| 18-oct-2026 18:4xZ | 271 | 56 | 164 | 51 | 41 | 10 | 2 hechas / 66 (entran 5 nuevas) |
| 18-oct-2026 17:09Z | 273 | 58 | 164 | 51 | 38 | 9 | 0 / 63 (primera foto) |

**Entre las 18:4xZ del 18 y las 06:4xZ del 19:** se cerraron **SCRUM-1237** (19:06Z, fila 2.2), **1503** (19:29Z), **1466** (19:30Z) y **1434** (19:31Z), y se creó **SCRUM-1565** (19:32Z, `equipo-javier`). Cuadra cifra a cifra: abiertos −4 +1 = **−3**; del equipo de Luis −3 (1237, 1466 y 1503, que lleva las dos etiquetas); sólo de Javier +1 (1565); sin etiqueta −1 (1434, que sólo lleva `area-s5`); cerrados +4; creados sin cambio (1565 es de Javier y esa consulta no lo cuenta). **Control:** 53 + 165 + 50 = 268.
⚠️ **1183 y 1177, que el encargo da como «cerrados ayer», ya estaban contados en la medida de las 18:4xZ** (se cerraron a las 18:09Z y 18:11Z). Y **SCRUM-1559** (sin etiqueta, cerrado a las 16:41Z del 18) también estaba ya fuera: su fecha de actualización (19:06Z) es de un comentario posterior, no del cierre. Se comprobó en su historial porque, sin eso, los cerrados no cuadraban (+4 medidos contra +5 esperados).

**Entre las 17:09Z y las 18:4xZ del 18:** se cerraron SCRUM-1190 (fila 1.10), 1183 y 1177 (estas dos no eran fila) y se creó SCRUM-1564 (la regla de Cloudflare; sin etiqueta de equipo, está en «Acción del fundador»). Eso explica +3 cerrados, +1 creado y −2 abiertos. **Ningún otro ticket de §2 cambió en Jira** desde las 17:09Z: se leyeron los 70 (los de §2, más 1183, 1177, 1503, 1563 y 1564) y la consulta devolvió los 70.

**Las consultas** (JQL, siempre por id de estado: por nombre dan 0 en falso):
- abiertos: `project = SCRUM AND status != 10004`
- del equipo de Luis: `… AND labels = equipo-luis`
- sólo de Javier: `… AND labels = equipo-javier AND labels != equipo-luis`
- sin etiqueta de equipo: `… AND (labels is EMPTY OR labels not in (equipo-luis, equipo-javier))`
- cerrados desde el 14-oct: `project = SCRUM AND status = 10004 AND resolved >= "2026-10-14" AND (labels = equipo-luis OR labels is EMPTY OR labels not in (equipo-javier))`
- creados desde el 14-oct: la misma, con `created >= "2026-10-14"` y sin el estado.

Las fechas de JQL van en la hora de Madrid. **Control:** 56 + 164 + 51 = 271.

---

## 6 · Lo que NO está medido

- **Cómo están registradas en Meta las cuatro plantillas con enlace** (2.9 y 2.10). Ninguna sesión ve WhatsApp Manager. Lo que sí está medido es lo que mandamos nosotros.
- **El valor de los interruptores y variables en Railway** (`INVOICING_ES_ENABLED`, `E2E_TEST_LOGIN_*`, los secretos de webhook, `LOG_MAGIC_LINKS` en staging). Ninguna sesión lo ve.
- **El estado de la cuenta demo** (7.8): lo midió S2; S0 no lo repite para no pisar la sesión QA compartida. **Que el correo de `demo@yaqu.app` no llegue** lo dice el orquestador; S0 sólo ha medido que el dominio tiene MX de Cloudflare. Las reglas de reenvío no se ven desde aquí.
- **El remitente de los dos cron que mandan correo** (2.11): sólo se ve en Railway o en Resend.
- **Lo que «vio en producción» otra sesión** (1.5, 2.7, y 2.1 y 2.2 en §8): sale de sus registros y traspasos. S0 no lo ha repetido.
- **La cabecera de los CSV con sesión** (6.11): #2568 está en producción, pero sin sesión no se ve.
- **Los 164 de Javier**, salvo los que nombra esta tabla. **Los 51 sin etiqueta**, lo mismo.
- **Que cada fila cubra la aceptación de su ticket.** Las filas salen de la descripción y del último comentario, leídos el 18-oct por cuatro lectores de sólo lectura; en esta medida, S0 ha releído los que cambiaron en Jira y los registros de 1237, 1558, 1072 y 809.
- **Tickets que no se han leído** y pueden tocar el producto: SCRUM-1509, 1517, 1523, 1529, 1535, 1444, 1215, 624, 1087, 1088, **1404** (el PDF de una factura en `pendiente_de_sellado` contesta 500, J1), y los epics 276, 280, 322, 323, 326. Y **los 54 tickets abiertos con algún merge desde el 11-oct** (§4), salvo los que nombra la tabla.
- **Las filas con «0 comentarios»** vienen sólo de la descripción: dicen lo que se pidió, no lo que queda.

---

## 7 · Cómo se actualiza (cada tanda de S0, o cuando lo pida el orquestador)

1. La cabecera, con la hora de GitHub (`gh api -i zen`) y el SHA de `origin/main` (`node scripts/equipo/ancla.mjs`).
2. Una fila nueva **arriba** de la tabla de §5, con las seis consultas.
3. Cada fila de §2 se vuelve a mirar en el ÚLTIMO comentario de su ticket y en `main` (`npm run ya-esta -- <números>`, o `git log origin/main --merges --grep=scrum-<n>`). Si está hecha, **no se borra**: pasa a §8 «Hecho», con su número, la fecha y la evidencia (PR mergeado o pantalla de yaqu.app).
4. Una cosa nueva que le falte al producto entra como fila, en su bloque, con el siguiente número libre, aunque no tenga ticket. **Sin ticket es justo lo que hay que ver** (así estuvo la S.L. semanas: SCRUM-1561).
5. Lo que no se sepa se escribe «NO CONSTA». Nunca se rellena.
6. ⚠️ **Las cifras del orquestador, y las de este documento, se comprueban como las de cualquiera.** El 18-oct, una auditoría de siete cierres encontró cinco que afirmaban algo que nadie había medido. Y en esta misma medida, dos frases de la anterior (la mitad (a) de 1558 como pendiente) y una del encargo («los CSV, cerrados por los dos lados») no aguantaron la medida.
7. **Antes de escribir que algo es movible hoy, se mira en `main`.** La lista de §3 se hace mirando cada fila con `git log origin/main --merges --grep`, no de memoria.

---

## 8 · Hecho

Lo que estaba en §2 y ya no falta. **No se borra.** Una fila que entra y sale el mismo día también se apunta aquí.

| # | qué era | cuándo | evidencia |
|---|---|---|---|
| 1.10 | «Presupuesto adicional» sobre un Trabajo ya en marcha (SCRUM-1190) | 18-oct-2026, cerrado 17:14Z | servidor #2495 (16-oct) y pantalla #2523 (17-oct 19:39Z), los dos en `main`. **Visto en producción por S2** sobre el build `57b0bc82`, a 1280 y 390 (SCRUM-1190 c.19951) |
| 2.1 | El WhatsApp de PRODUCCIÓN (el número de la casa, con sus plantillas) | 18-oct-2026, 17:53Z | el fundador pulsó «Enviar para firmar» con un móvil real y Meta contestó con un código suyo: filas 451 y 452 del historial del cliente 83, `albaran_para_firmar_es`, `failed`, `131026: Message undeliverable` (`docs/master/SCRUM-1236.md:158-162`, medido por S4). El número era el inventado; con el móvil del fundador, la fila 453 salió entregada (traspaso de S4). **Lo que destapó, el enlace roto, queda en §2 como 2.9** |
| 2.2 | Enviar a un cliente sin correo: la pantalla parecía que lo enviaba (SCRUM-1237) | 18-oct-2026, cerrado 19:06:56Z | arreglo #2521 (16-oct 13:10Z) en `main`. **Visto en producción por S2** después del merge, con producción sirviendo `214283d7` (que contiene el arreglo), a 1280 y a 390, contra la aceptación del c.19870: «Enviar por email» desactivado de entrada, el aviso dentro de la modal y a la vista, nada dado por hecho, y su control (el aviso de la página sigue tapado). Tramo 1237b de `docs/master/SCRUM-1237.md`, #2590 (19:34Z). **No medido, y lo dice el registro:** los dos errores de WhatsApp de la modal, porque mandar un WhatsApp no es una escritura que se pueda dejar salir |
| — | Los CSV de exportación se servían sin sesión desde la caché de Cloudflare (no era fila: entró y salió el 18-oct) | 18-oct-2026 | **medido por S0 a las 18:39:38Z**: los 7 CSV de `/admin/exports/` sin cookie dan **401** con `cf-cache-status: DYNAMIC`. Lo cierra la regla de Cloudflare del fundador (SCRUM-1564). **Vuelto a medir por S0 el 19-oct a las 06:4xZ** (`quotes.csv` y `jobs.csv`): lo mismo. **La mitad del origen entró a las 06:48:54Z del 19** (#2568) y falta verla con sesión: queda en §2 como 6.11 |
