# Decisiones del fundador · YaQu

**Medido: 29-oct-2026, 17:50Z-18:10Z** (`Date:` de GitHub) · `origin/main` = `eafca9fe1` · la escribió S0 (SCRUM-1563g). Sale de las **48 filas** de `ESTADO-DEL-PRODUCTO.md` §2 donde aparece FUNDADOR. Es UN documento que se actualiza, como aquél.

**El eje, con las palabras del fundador** (SCRUM-1554): «no preguntes por cosas que están mal… importa que el día del go live lo sea». Por eso son **dos listas que no se mezclan**: lo que BLOQUEA HOY, y lo que se le pide **en bloque** en la revisión de go-live. **Ninguna fila de la segunda se le gotea antes.** Regla de reparto: si una fila no se sabe en cuál va, va en la segunda.

**El único cuello real para vender es la S.L. inscrita** (SCRUM-1561): de ella cuelgan 4 de las 5 piezas que faltan del SIF-1 (`ESTADO-DEL-PRODUCTO.md` §1b). Dado por el orquestador; no se replantea aquí.

| de las 48 | cuántas |
|---|---|
**🔵 Re-medido el 29-oct ~18:10Z** (`origin/main` = `5a247020e`): A decidida por el orquestador (3 filas y la mitad de 2.9 salen; 1.1 se queda); B baja a **2** (0.1 · 2.9 a + 2.10 en una visita); 2.11 baja a D; el simulacro de SCRUM-1605 entra en D; **parte E nueva** con las decisiones ya tomadas. ⚠️ **Sigue sin medir:** §1, §4 y §4b de `ESTADO-DEL-PRODUCTO.md`, y el `/version` de producción.

| de las 48 (versión del 29-oct 17:50Z) | cuántas |
|---|---|
| A · **las puede decidir el orquestador** (no le tocan al fundador) | 3 filas enteras (1.8, 6.12, 3.17) + 2 mitades (2.9 b, 1.1) |
| B · **bloquean HOY** | 3 |
| C · **no son decisión: esperan a la S.L.** | 11 |
| D · **revisión de go-live, en bloque** | 31 (1.1 incluida) |

3 + 3 + 11 + 31 = **48**, contando cada fila una vez (2.9 en B, 1.1 en D).

---

## A · Lo que NO le toca al fundador (las filas más rentables)

Están contadas como suyas en `ESTADO-DEL-PRODUCTO.md` y no lo son. **MI LECTURA, de S0:** cada una dice por qué; quien decide si se le quita es el orquestador.

**🟢 RESUELTA el 29-oct (~18:10Z, `origin/main` = `5a247020e`):** el orquestador decidió las cuatro (mensaje del orquestador a S0). **2.9 (b), 1.8, 6.12 y 3.17 salen de la lista del fundador. 1.1 NO sale**, por lo medido abajo.

| fila | veredicto | localizador |
|---|---|---|
| **2.9 (b)** | **GO dado** (el fundador delegó la decisión en el orquestador: «1 nos e decide tu») **y construido**: rama `scrum-1632c-firma-tolera-la-url-sucia`, **PR #2998 ABIERTO, sin mergear** (obligatorio sin terminar a las 18:10Z). ⚠️ El recorte a dos sitios abría un XSS (lo encontró S1): el arreglo lleva **tres** llamadas | PR #2998 |
| **1.8** · **6.12** | **No es decisión: es dato de prueba.** Pasan a **SCRUM-1638** (el plan de la cuenta QA con más de un usuario) | SCRUM-1638 |
| **3.17** | **Decidido por el orquestador: SÍ, se unifican.** Es documento, no producto; la parte D de esta hoja es la lista única | — |
| **1.1** (la mitad del GO) | 🔴 **SIGUE SIENDO DEL FUNDADOR.** Medido: `albaranes.routes.ts` está fuera de `RUTAS_FISCALES`, **pero es camino de emisión**: llama a `emitInvoice` en `:1390` y `:1672` (y es una «boca» del censo de `tests/_bocas-de-emision.mjs`). La regla 40 («el camino de emisión fiscal se lee, no se modifica») y la 38 hablan del camino, no de la lista de rutas | `src/modules/jobs/app/routes/albaranes.routes.ts:1390,1672` |

<details><summary>Lo que se escribió antes de la decisión (no se borra)</summary>

| fila | qué hay que decidir | por qué no es del fundador | qué destraba |
|---|---|---|---|
| **2.9 (b)** | GO para que `albaranPublic.routes.ts:251` y `:381` limpien el token con `parseToken`, como ya hace el presupuesto | el fichero está en `src/modules/jobs/`, **fuera** de `RUTAS_FISCALES` (`scripts/puerta-avisador-rojo.mjs`: sólo `fiscal/`, `invoicing/`, `verifactu.service.ts`, `invoiceNumber.service.ts` y el esquema), y no cambia ningún texto que vea el usuario | que el enlace de firma no vuelva a romperse aunque Meta mande el `{{1}}`. Hoy `parseToken` en `src/modules/jobs/`: **0** |
| **1.8** · **6.12** | verificar con un Técnico de verdad (SCRUM-1555 · SCRUM-1390) | **crear datos de prueba es trabajo nuestro**, no del fundador. El hueco es el mismo de SCRUM-1638: el plan de la cuenta QA admite 1 usuario, y un plan con más usuarios sólo lo escribe el webhook de Stripe | dos arreglos de seguridad que están en `main` y nadie ha visto funcionar |
| **3.17** | unificar las 4 listas de go-live en una puerta (SCRUM-1554) | el fundador ya dijo QUÉ quiere («que el día del go live lo sea»); juntar las listas es un trabajo de documento, de S0 | esta hoja es el primer paso: la parte D es la lista única. Lo que falta es el mecanismo que impida encender sin ella |
| **1.1** (la mitad) | «OK a 2 líneas del camino de emisión (`albaranes.routes.ts`)» (SCRUM-1490, **CON FECHA 1-ene-2027**) | `albaranes.routes.ts` también vive en `src/modules/jobs/`, fuera de `RUTAS_FISCALES`. ⚠️ Antes de quitárselo hay que leer la regla 40 del máster: si llama «emisión» al albarán, sigue siendo suyo | la otra mitad (la consulta de sólo lectura en producción) sí es suya, y va con la misma credencial que 3.14 (parte D) |

</details>

---

## B · BLOQUEA HOY

Sin esto no se puede vender ni cobrar, o el equipo no lo puede hacer por él.

**🔵 Re-medida el 29-oct ~18:10Z (`origin/main` = `5a247020e`). Quedan DOS, escritas para pulsar, no para leer.**

### B1 · La S.L. (0.1) — lo que haces mañana por la mañana

Al 20-oct iban **3 de 8 pasos** (SCRUM-143 c.20086). El último dato es del 26-oct: «ya tiene la documentación el notario» (c.20865). **No consta en ningún sitio que el notario haya firmado.** Mañana:

1. **Llama o escribe a la gestoría** que te dio la hoja de ruta (SCRUM-143 c.19619) y pide **tres datos, por escrito**: ① ¿está firmada la escritura? ¿qué día? · ② ¿está pagado el **Modelo 600** de la Comunidad de Madrid (paso 4)? · ③ ¿qué día se presenta en el **Registro Mercantil** (paso 5) y cuánto tarda la inscripción?
2. Si la escritura **no** está firmada: pide **fecha de firma** y apúntala en SCRUM-143. Firmáis **los dos administradores** (Javier y tú, mancomunados: c.20865).
3. Pega la respuesta de la gestoría en SCRUM-143, tal cual. **Con esa fecha, el equipo sabe cuándo se abre la parte C entera.**

⚠️ **La firma del notario NO desbloquea lo fiscal.** Lo que lo desbloquea es la **inscripción en el Registro Mercantil** (paso 5) y, después, el **certificado de representante** (c.20088).

### B2 · Los botones de WhatsApp (2.9 a + 2.10) — UNA sola visita a Meta

**Por qué hoy:** el botón «Ver y firmar» del albarán lleva un `{{1}}` de más y el cliente ve un 404 al firmar (SCRUM-1632). ⚠️ **Cuando entre el PR #2998 (2.9 b), el servidor tolerará ese `{{1}}` y esto deja de romper: entonces B2 baja a la parte D.** Hasta entonces, rompe.

1. Entra en **WhatsApp Manager** (business.facebook.com → WhatsApp Manager) con la cuenta que manda los mensajes de producción → **Plantillas de mensajes**. *(Nombres de pantalla: MI LECTURA, no verificada; ninguna sesión ve ese panel.)*
2. Para **cada una de estas cuatro**, abre la plantilla → **Editar** → baja a **Botones** → en el botón con enlace, «Tipo de URL» = **Dinámica**, y en el campo de la URL escribe **exactamente** esto (**sin `{{1}}`**, acabado en `/`):

| plantilla | botón | campo URL |
|---|---|---|
| `albaran_para_firmar_es` | Ver y firmar | `https://yaqu.app/albaran/` |
| `quote_decision_es` | Ver presupuesto | `https://yaqu.app/pay/quote/` |
| `payment_request_es` | Pagar ahora | `https://yaqu.app/pay/invoice/` |
| `payment_confirmation_invoice_es` | Ver documento | `https://yaqu.app/recibo/` |

   **Al terminar tiene que verse UN SOLO `{{1}}`, al final.** Si ves `…/albaran/{{1}}{{1}}` o un `{{1}}` escrito por ti, ése sobra. No toques el cuerpo, la categoría ni el idioma. Fuente: `docs/WHATSAPP_TEMPLATES.md:52-62`.
3. **Cómo compruebas que quedó bien** (y mirar el panel NO vale, es lo que falló en julio): desde YaQu, mándate a **tu propio móvil** un albarán para firmar → en WhatsApp **mantén pulsado el botón → Copiar enlace** → pégalo en una nota. **Si contiene `%7B%7B1%7D%7D` o `{{1}}`, sigue mal.** Si acaba en `/albaran/` + letras y números, está bien.

⚠️ Editar una plantilla aprobada la manda **otra vez a revisión de Meta** (MI LECTURA). Hacerlo con las cuatro a la vez es una sola espera.

<details><summary>La tabla anterior (no se borra)</summary>

| fila | qué decide / hace | si lo hace | si no | qué está parado mientras |
|---|---|---|---|---|
| **0.1** | inscribir la S.L. (SCRUM-1561). **No es una decisión: ya está en marcha** (notaría la semana del 26-oct; «mediados de noviembre») | se abre la parte C entera | no hay Convenio 017, ni certificado, ni NIF del productor, ni Stripe real | 11 filas (parte C) y 4 de las 5 piezas del SIF-1 |
| **2.11** | mirar `EMAIL_FROM` en los **TRES** servicios de Railway (SCRUM-1115). **Tres clics.** El código ya no tiene nada que arreglar (medido por el orquestador, c.21240) | los correos salen con la marca de YaQu | un cliente puede recibir un correo firmado «PresuFácil» | nada del equipo; es sólo la variable |
| **2.9 (a)** | corregir el botón de `albaran_para_firmar_es` en WhatsApp Manager con la dirección exacta de `docs/master/SCRUM-1632.md` (S4) | el cliente abre el enlace de firma | **el cliente ve un 404 al firmar**: el corazón del producto | firmar por WhatsApp. **En la misma visita a Meta**, mirar también los tres botones de 2.10: no es otra pregunta, es el mismo panel |

</details>

**Por qué 2.11 (`EMAIL_FROM`) sale de B y baja a D — medido, no opinado:** el servicio que escribe a **clientes** (el backend) **ya** manda como `YaQu <no-reply@yaqu.app>`: lo confirmó el fundador con captura el 14-oct (SCRUM-1115 c.19624). Los otros dos sólo escriben a **buzones internos**: el aviso de acreditación a `AVISO_ACREDITACION_EMAIL_DESTINO` (`scripts/aviso-programado-acreditacion-invoicing-es.mjs:335`) y el respaldo a `BACKUP_EMAIL_DESTINO` (`scripts/respaldo-programado.mjs:346`). **Hoy no se rompe nada de cara a un cliente.** La fila de la versión anterior («un cliente puede recibir un correo firmado PresuFácil») estaba mal.

---

## C · No son decisión: esperan a la S.L.

No se le pregunta nada de esto: se desbloquean solas, en este orden, cuando la S.L. esté inscrita.

| fila | qué | lo que la destraba |
|---|---|---|
| 0.2 | ceder a la S.L. los derechos del código (SCRUM-1283) | S.L. constituida |
| 0.3 · 3.6 | asesor fiscal y la revisión fiscal externa (SCRUM-1264) | aplazado por él hasta la S.L. |
| 3.1 | Convenio 017 con la AEAT (SCRUM-143) | S.L. inscrita → certificado de representante |
| 3.2 | nombre del productor que viaja a Hacienda (SCRUM-870) | NIF definitivo de la S.L. |
| 3.3 · 3.4 | certificado de entidad en el servidor y quien hace los envíos de prueba | S.L. constituida |
| 3.5 | declaración responsable con dos firmantes (SCRUM-523, PR #2881 en borrador) | «cuando ya esté la SL» |
| 3.7 | paso a producción de la AEAT con una factura real | Convenio 017 |
| 4.1 · 5.1 | Stripe y la suscripción en modo real (SCRUM-41) | S.L. + SIF-1 |

---

## D · Revisión de go-live, EN BLOQUE

**Ninguna de éstas se le pregunta suelta.** Se le presentan juntas el día de la revisión. Agrupadas por lo que tiene que hacer, para que sea una sentada y no treinta.

🔴 **La única con FECHA:** **1.1** (SCRUM-1490) — el 1-ene-2027 la ficha de un presupuesto con secuencia repetida da 500. **Si la revisión de go-live cae después del 1-dic, ésta sube a la parte B.**

| fila | qué decide | si sí | si no | qué está parado |
|---|---|---|---|---|
| **Una credencial de sólo lectura de producción** | | | | |
| 1.1 · 3.14 | darla (SCRUM-1490 · SCRUM-1097/1109) | se corre la consulta de 1490 y el guard de «nadie emite» contra la base real | 1490 no cierra su aceptación 6; no se puede acreditar que ningún profesional real emite | dos guards en `main` sin correr contra nada |
| **Firmas de texto (regla 39)** | | | | |
| 1.6 | el texto de los 1-2 céntimos (SCRUM-1451) | el profesional entiende el «te falta 0,01 €» | sigue viendo una deuda de un céntimo sin explicación | el ticket |
| 2.3 | el texto del rebote del correo (SCRUM-1558 b) | la pantalla enseña el correo que no llegó | el correo puede decir «ok» sin salir | 1558 b; 1558 c espera además `LOG_MAGIC_LINKS=true` en staging |
| 6.8 | las 3 líneas del concepto de fechas (SCRUM-1445) | las fechas se imprimen en hora de España | un albarán de las 00:30 lleva la víspera | el arreglo de los dos equipos |
| 6.16 | que el Paquete del trimestre diga su periodo (SCRUM-1629, «sin prisa») | se pinta el periodo | la tarjeta funciona sin decirlo | nada más |
| 7.3 | los recambios #4, #6, #7 y #9 de la landing y el B1 del bot (SCRUM-1236) | sale el texto verdadero | **siguen en la landing pública textos que afirman algo falso** | nada del equipo: el resto ya se cambió |
| **Plantillas de Meta** | | | | |
| 2.6 | «Voy de camino», aviso de visita y portal en el pie (SCRUM-975 · 981 · 1143): **una sola visita para las tres** | se pueden enviar | no existen esos avisos | las tres |
| 2.10 | los tres botones con enlace (`quote_decision_es`, `payment_request_es`, `payment_confirmation_invoice_es`) | se sabe si tienen el defecto de 2.9 | **los de pago no se usan antes del SIF-1 (regla 24)**; el del presupuesto ya lo tolera el servidor | nada hoy. ⚠️ Si va a Meta por 2.9 (a), que los mire entonces |
| 6.1 | GO de los mantenimientos + su plantilla (SCRUM-911) | se encienden (construidos y apagados) | siguen apagados | la función entera |
| **GO del camino de emisión o del SIF-1 (regla 40)** | | | | |
| 3.9 | `ClaveRegimen` fija a «01» (SCRUM-1129): GO + ALTER + firma | cada régimen va con su clave | se declara un régimen equivocado a Hacienda para quien no es «01» | J1 |
| 3.10 | criterio de caja en el registro y el PDF (SCRUM-1240): GO + firma, con el asesor | se puede facturar en criterio de caja | quien lo use emite sin la mención obligatoria | J1 |
| 3.15 | retenciones en el resumen del trimestre (SCRUM-1146) | el resumen las cuenta | el resumen no las enseña | el ticket |
| 3.19 | diseño de subsanar un registro «aceptado con errores» (SCRUM-1612) | J1 lo construye | un rechazo parcial de la AEAT se queda sin camino | J1 |
| **Cambios de máster (estados, Parte L)** | | | | |
| 1.7 | copiar el enlace ¿cuenta como enviado? (SCRUM-1297) | el presupuesto deja `draft` al copiar | parece no enviado estando entregado | el ticket |
| 6.7 | estados de la bandeja de gastos (SCRUM-1069) | se construye la bandeja | no hay bandeja | el ticket |
| 7.1 | la enmienda A4.1 de posicionamiento (SCRUM-328) | se sabe qué se vende antes del SIF-1 | no se puede vender facturación que no se puede usar | el mensaje comercial |
| **Decisiones de producto** | | | | |
| 1.3 | qué dice un documento con IVA «no indicado» (SCRUM-1438), con el asesor | texto correcto | sale «IVA 0 %» | el ticket |
| 1.4 | qué enseña cada línea en la página de aceptar (SCRUM-1433) | líneas y total cuadran a la vista | líneas sin impuesto y total con él | el ticket |
| 1.9 | el «encargo de diseño» de guardar como plantilla con 3 opciones (SCRUM-1545) | S2 hace los puntos 1, 2, 4 y 5 | sólo funciona el punto 3 | S2 |
| 1.12 | enchufar o retirar el «mensaje con IA» (SCRUM-1182) | o tiene botón o se borra | código construido desde el 22-may sin uso | nada |
| 1.14 | GO del arreglo del bucle de recordatorios de presupuesto (SCRUM-1586, regla 28) | deja de reenviar 48 en 48 h | un cliente real recibiría el recordatorio en bucle | S1 |
| 4.5 | cancelar un cobro: GO + 2 decisiones (SCRUM-1532) | el estado tiene camino | existe y nadie llega | el ticket |
| 6.2 | fichaje: ALTER + ubicación, interruptor, textos y plan (SCRUM-913) | J lo construye | no hay registro de jornada | J |
| 6.4 | el ALTER de «volver a llamar» (SCRUM-1056) | J2/J3 terminan | sólo está en dev | J2 y J3 |
| 6.6 | 5 fotos reales de tickets (SCRUM-961 · 971) | se prueba la lectura con IA | no se sabe si lee tickets de verdad | el gasto por WhatsApp |
| 7.8 | devolverle el acceso a la cuenta DEMO y que su correo llegue a un buzón (sin ticket) | se puede hacer una demo | `POST /quote/create` da 403 `trial_expired` | las demos comerciales |
| 7.9 | los cinco guiones comerciales (SCRUM-1554 fila 24, c.20778) | entran en la puerta | se vende sin guion | — |
| **Coste e infraestructura** | | | | |
| 4.2 | dos secretos de webhook en Railway (SCRUM-678) | se puede encender Connect y Mercado Pago | no se pueden encender | CONNECT-1 |
| 7.6 | respaldo: retención, RPO/RTO y la tarea de Railway (SCRUM-1525) | volcado programado y restauración probada | sólo hay un volcado a mano del 13-oct | J |
| 7.7 | apagar `test-login` en producción (SCRUM-1210) | — se hace el día del lanzamiento | queda una puerta de pruebas abierta | nada antes de ese día |
| **Bajadas o añadidas el 29-oct** | | | | |
| 2.11 | `EMAIL_FROM` en los otros dos servicios (SCRUM-1115). **Pasos:** Railway → proyecto `cobroflash-backend` → en **cada caja** que no sea la base de datos: pestaña **Variables** → `EMAIL_FROM`. Valor: **`YaQu <no-reply@yaqu.app>`** (el mismo que ya tiene el backend, c.19624). Si una caja no tiene la variable, no la crees: dínoslo con el nombre de la caja. **Cómo lo compruebas:** el valor se ve en la misma pestaña; o en Resend → Emails, el «From» del último envío de cada uno | los avisos internos salen con la marca nueva | un aviso interno sale como «PresuFácil»; a clientes, no | nada |
| — | **simulacro del vigía** (SCRUM-1605): `gh workflow run vigia-despliegue.yml -f simulacro=true`, o GitHub → Actions → «Vigía del despliegue» → **Run workflow** → marcar **simulacro**. Fabrica una producción congelada **de mentira** y hace sonar el aviso; **no mira ni toca `yaqu.app`**. **Lo lanza el fundador o lo autoriza con su palabra:** a S5 se le denegó el 27-oct | se sabe que el aviso suena | el aviso de producción congelada **no ha sonado nunca**; hoy el equipo estuvo 6 h 38 min caído | nada del equipo. **No bloquea vender; no está en las 48** |

**Dicho, para que nadie la cuente dos veces:** 2.9 sale en A (la mitad b) y en B (la mitad a); 1.1 sale en A (la mitad del GO) y en D. En el total de 48, 2.9 cuenta en B y 1.1 en D.

---

## E · Decisiones YA TOMADAS, con su localizador (para no volver a preguntarlas)

**Una decisión que no se puede encontrar se vuelve a preguntar.** Aquí van las que ya dio, con el sitio donde están. Si una sesión se la iba a preguntar, primero mira aquí.

### SCRUM-1529 · las siete decisiones de campo (estados de la Parte L) — 7 de 7 ENCONTRADAS

Censo de S0, 29-oct, sobre `origin/main`. El ticket dice que «no viven en ningún sitio abierto»: **eso era cierto el 8-oct y dejó de serlo el 13-oct.** Las siete las recogió el orquestador del equipo de Javier en **SCRUM-1529 c.19228**, la autorización para aplicarlas al máster está en **c.19299**, y **están aplicadas en `docs/YAQU_MASTER.md:403-409`**, cada línea con su nota «SCRUM-1529c».

| n | campo | decisión | localizador |
|---|---|---|---|
| 1 | `QuoteRequest.status` | `pending → read → done` | c.19228 ① · máster `:407` |
| 2 | `ParteTrabajo.estado` | entra, sin `facturado` | c.19228 ② · máster `:403` |
| 3 | `TeamMember.status` | entran los tres valores; las transiciones, no | c.19228 ③ · máster `:403` |
| 4 | `Quote.status` | entra `pending_approval` | c.19228 ④ · máster `:404` |
| 5 | `Invoice.status` | `expired` no se quita, se añade | c.19228 ⑤ · máster `:405` |
| 6 | `Charge.status` | entran `failed` y `expired`; `cancelled` se queda y se construye quién cancela (SCRUM-1532, fila 4.5 de la parte D) | c.19228 ⑥a/⑥b · máster `:406` |
| 7 | `WhatsAppMessage.status` | entra `received` para entrantes | c.19228 ⑦ · máster `:409` |

⚠️ **De qué clase es el localizador:** c.19228 y c.19299 **no son la voz literal del fundador**: los firma el orquestador «recogiendo» lo que el fundador dio por el canal. El equipo lo aceptó como localizador válido (c.19279). **No hay ninguna que preguntarle.** Lo que queda es cerrar el ticket con este censo, y eso lo decide el orquestador (SCRUM-1529 lleva sólo la etiqueta `fundador`).

---

## Cómo se actualiza

Cada vez que S0 recuenta `ESTADO-DEL-PRODUCTO.md` (`node docs/master/evidencias/SCRUM-1563/contar-dependencias.mjs docs/producto/ESTADO-DEL-PRODUCTO.md`): una fila nueva con FUNDADOR entra aquí en su parte; una que sale de §2 sale de aquí. **La parte B no crece sin que la fila diga qué se rompe HOY.**
