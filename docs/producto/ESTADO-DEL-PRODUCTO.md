# Estado del producto · YaQu

**Última medida: 18-oct-2026, 17:13Z** (`Date:` de GitHub) · `origin/main` = `bea8415859996e0bda44c7d85011235120ab6ca3` · la escribió S0 (SCRUM-1563).

**Qué es:** UN documento que se ACTUALIZA, no un informe nuevo cada vez. Dice qué le falta al producto para estar completo, de quién depende cada cosa, qué la bloquea y cómo va. Lo pidió el fundador el 18-oct-2026: «molaría sacar un informe con todas las tareas que tenemos que cerrar para el producto y ver cómo las vamos cerrando, para tener algo controlado».

**Cómo se lee:**
- Una fila es **una cosa que le falta al producto**, no un ticket.
- **Depende de:** NOSOTROS (equipo de Luis, S0-S5) · JAVIER (equipo de Javier, J1-J6) · FUNDADOR (Luis) · ASESOR.
- **Bloqueo:** lo que hay que conseguir, con su nombre. Si dice «ninguno», la fila sólo espera a que alguien la trabaje.
- **Fuente:** de dónde sale la fila. «c.NNNNN» es el último comentario del ticket que se leyó. Un PR con fecha está comprobado en GitHub.

⚠️ **«Fundador» en los comentarios del equipo de Javier puede ser JAVIER**, no Luis: SCRUM-1525 c.19365 llama «la cuenta del fundador» a la de Javier, y SCRUM-1028 dice «decisión de Javier (jefe)». Aquí FUNDADOR es siempre Luis. Donde la decisión es de Javier, la fila dice JAVIER.

---

## 1 · La respuesta corta

1. **Hoy, en España, un profesional puede presupuestar, enviar por WhatsApp y hacer firmar. No puede facturar ni cobrar por YaQu.** La regla 24 lo impide hasta que SIF-1 esté 8/8 con una factura real aceptada por la AEAT (Parte U del máster, fila 3).
2. **La primera pieza de todas es la S.L.** (SCRUM-1561). De ella cuelgan el Convenio 017 con la AEAT, el NIF del productor, el certificado del servidor, Stripe en modo real, la suscripción y la cesión del código.
3. **De las 63 cosas que faltan, 42 necesitan al fundador y 27 dependen SÓLO de él.** El detalle, en §3.
4. **5 filas esperan a un asesor fiscal, y hoy no hay asesor** (SCRUM-1264 c.19623: «no hay asesor fiscal», plazo 15-nov). En la práctica también son del fundador: o lo contrata o decide ir sin él.
5. **Hay cinco arreglos ya en `main` cuyos tickets siguen abiertos** (§4). Puede que estén acabados y sólo falte cerrarlos. No está medido.

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
| 1.5 | Una cabecera de apartado dentro de una opción se pinta «NaN €» (sólo por API) | SCRUM-1442 | FUNDADOR | «GO regla 40 (`schemas.ts`)» | c.18216. Hay commits suyos del 18-oct en `main` y **no se han revisado** |
| 1.6 | El profesional no lee en ningún sitio lo de los 1-2 céntimos entre presupuesto y facturas | SCRUM-1451 | FUNDADOR | «firma de texto (regla 39)» | descripción (0 comentarios) |
| 1.7 | Copiar el enlace entrega el presupuesto, pero su estado sigue en `draft` | SCRUM-1297 | FUNDADOR | «cambio de máster (Parte L)» | descripción (0 comentarios) |
| 1.8 | Un Técnico podía abrir y aceptar presupuestos ajenos: arreglado, y sin verificar con un Técnico de verdad | SCRUM-1555 | FUNDADOR | «test-login sólo abre propietarios; el plan de prueba admite 1 usuario» | c.19743 (#2456 en producción) |
| 1.9 | Guardar como plantilla un presupuesto de 3 opciones | SCRUM-1545 | NOSOTROS + FUNDADOR | «encargo de diseño» | descripción (0 comentarios) |
| 1.10 | «Presupuesto adicional» sobre un Trabajo ya en marcha (el servidor ya lo admite) | SCRUM-1190 | NOSOTROS + FUNDADOR | «firma del texto del botón» | c.19808 |
| 1.11 | Aviso del 40 % de materiales en una reforma de vivienda | SCRUM-1074 | ASESOR + JAVIER | «Q-C1 y SCRUM-1052» | descripción (0 comentarios) |
| 1.12 | El «mensaje con IA» del presupuesto está construido desde el 22-may y no tiene botón | SCRUM-1182 | FUNDADOR | «decidir: enchufarlo o retirarlo» | descripción (0 comentarios) |

### 2 · Enviar y firmar

| # | qué le falta al producto | ticket | depende de | bloqueo | fuente |
|---|---|---|---|---|---|
| 2.1 | El WhatsApp de PRODUCCIÓN (el número de la casa, con sus plantillas) | sin ticket propio · SCRUM-1512 | FUNDADOR | «NO CONSTA si está montado» | 1512 c.18926: «no sé si producción tiene la variable puesta»; el envío real a Meta no se midió |
| 2.2 | Enviar a un cliente sin correo: la pantalla parece que lo envía | SCRUM-1237 | NOSOTROS (S2) | ninguno | c.19870 (autorizado). Hay trabajo suyo en `main` desde el 16-oct; **no medido si cubre la aceptación** |
| 2.3 | El correo puede decir «ok» sin salir, y ninguna pantalla enseña el rebote | SCRUM-1558 | NOSOTROS (S1 + S2) | la mitad (b) necesita «firma de texto» | descripción (0 comentarios) |
| 2.4 | Lo que escribe el CLIENTE sale en su ficha como un envío nuestro | SCRUM-1518 | NOSOTROS (S2) | «firma del rótulo del chip» | descripción (0 comentarios) |
| 2.5 | Firmar sin cobertura: sin red no se crea albarán ni parte, no van las fotos, y al reabrir manda a `/login` | SCRUM-307 | NOSOTROS (S2) | «prueba con un iPhone de verdad» | c.16463 (22-sep) |
| 2.6 | «Voy de camino», aviso de visita y el portal en el pie del WhatsApp | SCRUM-975 · 981 · 1143 | FUNDADOR | «plantillas de Meta: una sola visita para las tres» | c.16051 · c.16297 · descripción |
| 2.7 | Con teclado no se abren una factura, un Trabajo ni un parte | SCRUM-1562 | NOSOTROS + JAVIER | ninguno | descripción. En `main`: #2561 (Trabajos) y el arreglo de Partes de oficina (`tests/scrum1562c-…`, entró en `bea84158`). Facturas (J1): no medido |
| 2.8 | El tope de plantillas por cliente se puede rebasar en una ráfaga | SCRUM-1513 | JAVIER (J2) | ninguno | c.19002. #2325 MERGEADO el 8-oct; la ráfaga, medida y sin cerrar |

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

### 6 · Gestionar

| # | qué le falta al producto | ticket | depende de | bloqueo | fuente |
|---|---|---|---|---|---|
| 6.1 | Encender los mantenimientos (construidos y apagados) | SCRUM-911 | FUNDADOR | «GO escrito + plantilla de Meta» | c.19807 |
| 6.2 | Fichaje (registro de jornada) | SCRUM-913 | JAVIER + FUNDADOR | «ALTER + decisiones de ubicación, interruptor, textos y plan» | c.19821 |
| 6.3 | Equipos del cliente | SCRUM-914 | NOSOTROS + JAVIER | «respuesta del orquestador de Javier (J3 en el mismo PR)» | c.19414 |
| 6.4 | «Volver a llamar» dentro del cliente | SCRUM-1056 | JAVIER (J2/J3) | ninguno | c.19731: lo de S2 está en `main` sin montar |
| 6.5 | Preguntar la actividad junto a la retención de IRPF | SCRUM-1072 | NOSOTROS (S2) + JAVIER (contenedor J3) | ninguno | c.19859. El servidor está en `main` (#2506); falta la pantalla |
| 6.6 | Leer el ticket con IA y que el gasto entre por WhatsApp | SCRUM-961 · 971 | FUNDADOR | «5 fotos reales de tickets» | c.19330 · c.16053 |
| 6.7 | Bandeja de gastos con estados | SCRUM-1069 | FUNDADOR | «cambio de máster (estados)» | descripción (0 comentarios) |
| 6.8 | Las fechas que se imprimen van en UTC (un albarán de las 00:30 lleva la víspera) | SCRUM-1445 | FUNDADOR + NOSOTROS + JAVIER | «firma de las 3 líneas del concepto» | c.19437 |
| 6.9 | La pantalla de provincia | SCRUM-1522 | JAVIER + FUNDADOR | «SCRUM-1536» | c.19338 |
| 6.10 | Las casillas de métodos de pago miden 20 px | SCRUM-1265 | NOSOTROS (S2) | «decidir el patrón; NO CONSTA quién» | descripción (0 comentarios) |

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

---

## 3 · De quién depende

Sobre las **63 filas** de §2. Una fila puede depender de más de uno, así que las columnas no suman 63.

| | filas en las que aparece | filas que dependen SÓLO de él |
|---|---|---|
| **FUNDADOR** | **42** | **27** |
| JAVIER | 26 | 9 |
| NOSOTROS | 13 | 5 |
| ASESOR (hoy no hay) | 5 | 2 |

Contado por máquina sobre la columna «depende de» de §2: `node docs/master/evidencias/SCRUM-1563/contar-dependencias.mjs docs/producto/ESTADO-DEL-PRODUCTO.md`. Se vuelve a correr en cada actualización. **El primer recuento, hecho a mano, daba 28 · 25 · 8 · 6 · 1, y estaba mal.**

**Lo que el equipo de Luis puede mover hoy sin esperar a nadie:** 2.2 (SCRUM-1237) y la mitad (a) de 2.3 (SCRUM-1558). Las otras tres filas que dependen sólo de NOSOTROS (2.4, 2.5 y 6.10) esperan una firma, un iPhone de verdad o una decisión de patrón.

---

## 4 · Arreglos ya en `main` con el ticket todavía abierto

Puede que estén acabados y sólo falte cerrarlos. Lo cierra el orquestador del equipo dueño (A13). **No está medido si cubren su aceptación entera.**

| ticket | equipo | qué entró | estado del ticket (17:09Z) |
|---|---|---|---|
| SCRUM-1258 | Javier | #2048, MERGEADO el 1-oct-2026 03:33Z | Tareas por hacer |
| SCRUM-1304 | Javier | #2053, MERGEADO el 1-oct-2026 05:36Z | Tareas por hacer |
| SCRUM-1513 | Javier | #2325, MERGEADO el 8-oct-2026 10:33Z (queda la ráfaga) | Tareas por hacer |
| SCRUM-534 | Javier | #2425, MERGEADO el 14-oct-2026 07:08Z | Acción del fundador |
| SCRUM-1525 | Javier | #2370 (el correo), MERGEADO el 13-oct-2026 12:27Z; el volcado sigue sin programar | Tareas por hacer |

---

## 5 · Cómo va

Una fila por medida. **No se borra ninguna:** se añade la nueva arriba.

| medida (hora de GitHub) | abiertos en SCRUM | del equipo de Luis | sólo de Javier | sin etiqueta de equipo | cerrados desde el 14-oct (Luis + sin etiqueta) | creados desde el 14-oct (Luis + sin etiqueta) | filas de §2: hechas / quedan |
|---|---|---|---|---|---|---|---|
| 18-oct-2026 17:09Z | 273 | 58 | 164 | 51 | 38 | 9 | 0 / 63 (primera foto) |

**Las consultas** (JQL, siempre por id de estado: por nombre dan 0 en falso):
- abiertos: `project = SCRUM AND status != 10004`
- del equipo de Luis: `… AND labels = equipo-luis`
- sólo de Javier: `… AND labels = equipo-javier AND labels != equipo-luis`
- sin etiqueta de equipo: `… AND (labels is EMPTY OR labels not in (equipo-luis, equipo-javier))`
- cerrados desde el 14-oct: `project = SCRUM AND status = 10004 AND resolved >= "2026-10-14" AND (labels = equipo-luis OR labels is EMPTY OR labels not in (equipo-javier))`
- creados desde el 14-oct: la misma, con `created >= "2026-10-14"` y sin el estado.

Las fechas de JQL van en la hora de Madrid. **Control:** 58 + 164 + 51 = 273.

---

## 6 · Lo que NO está medido

- **Si el WhatsApp de producción está montado** (2.1). Nadie lo ha medido: J1 lo dijo el 8-oct (SCRUM-1512 c.18926).
- **El valor de los interruptores y variables en Railway** (`INVOICING_ES_ENABLED`, `E2E_TEST_LOGIN_*`, los secretos de webhook). Ninguna sesión lo ve.
- **Los 164 de Javier**, salvo los que nombra esta tabla. **Los 51 sin etiqueta**, lo mismo.
- **Que cada fila cubra la aceptación de su ticket.** Las filas salen de la descripción y del último comentario, leídos el 18-oct por cuatro lectores de sólo lectura. La sesión que escribe esto ha comprobado en GitHub los PR que se citan; los comentarios no los ha releído uno a uno.
- **Tickets que no se han leído** y pueden tocar el producto: SCRUM-1509, 1517, 1523, 1529, 1535, 1444, 1215, 624, 1087, 1088, y los epics 276, 280, 322, 323, 326.
- **Las filas con «0 comentarios»** vienen sólo de la descripción: dicen lo que se pidió, no lo que queda.

---

## 7 · Cómo se actualiza (cada tanda de S0, o cuando lo pida el orquestador)

1. La cabecera, con la hora de GitHub (`gh api -i zen`) y el SHA de `origin/main` (`node scripts/equipo/ancla.mjs`).
2. Una fila nueva **arriba** de la tabla de §5, con las seis consultas.
3. Cada fila de §2 se vuelve a mirar en el ÚLTIMO comentario de su ticket y en `main` (`npm run ya-esta -- <números>`). Si está hecha, **no se borra**: pasa a una §8 «Hecho», con la fecha y la evidencia (PR mergeado o pantalla de yaqu.app).
4. Una cosa nueva que le falte al producto entra como fila, en su bloque, aunque no tenga ticket. **Sin ticket es justo lo que hay que ver** (así estuvo la S.L. semanas: SCRUM-1561).
5. Lo que no se sepa se escribe «NO CONSTA». Nunca se rellena.
6. ⚠️ **Las cifras del orquestador, y las de este documento, se comprueban como las de cualquiera.** El 18-oct, una auditoría de siete cierres encontró cinco que afirmaban algo que nadie había medido.
