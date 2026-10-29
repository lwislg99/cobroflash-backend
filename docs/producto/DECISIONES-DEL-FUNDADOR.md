# Decisiones del fundador · YaQu

**Medido: 29-oct-2026, 17:50Z-18:10Z** (`Date:` de GitHub) · `origin/main` = `eafca9fe1` · la escribió S0 (SCRUM-1563g). Sale de las **48 filas** de `ESTADO-DEL-PRODUCTO.md` §2 donde aparece FUNDADOR. Es UN documento que se actualiza, como aquél.

**El eje, con las palabras del fundador** (SCRUM-1554): «no preguntes por cosas que están mal… importa que el día del go live lo sea». Por eso son **dos listas que no se mezclan**: lo que BLOQUEA HOY, y lo que se le pide **en bloque** en la revisión de go-live. **Ninguna fila de la segunda se le gotea antes.** Regla de reparto: si una fila no se sabe en cuál va, va en la segunda.

**El único cuello real para vender es la S.L. inscrita** (SCRUM-1561): de ella cuelgan 4 de las 5 piezas que faltan del SIF-1 (`ESTADO-DEL-PRODUCTO.md` §1b). Dado por el orquestador; no se replantea aquí.

| de las 48 | cuántas |
|---|---|
**🔵 Re-medido el 29-oct ~18:10Z** (`origin/main` = `5a247020e`): A decidida por el orquestador (3 filas y la mitad de 2.9 salen; 1.1 se queda); B baja a **2** (0.1 · 2.9 a + 2.10 en una visita); 2.11 baja a D; el simulacro de SCRUM-1605 entra en D; **parte E nueva** con las decisiones ya tomadas. ⚠️ **Sigue sin medir:** §1, §4 y §4b de `ESTADO-DEL-PRODUCTO.md`, y el `/version` de producción. → **Cerrado a las 18:15Z** (línea siguiente).

**🔵 Re-medido el 29-oct a las 18:12Z-18:20Z** (`Date:` de GitHub) · `origin/main` = `c93f26a76` · **producción (`/version`) = el mismo `c93f26a7`, leído a las 18:15Z** · S0, SCRUM-1563i. **Cada fila lleva ahora su CLASE**, sacada de las etiquetas de Jira de sus tickets (leídas a las 18:1xZ con `labels`; leyenda justo abajo). §1, §4 y §4b de `ESTADO-DEL-PRODUCTO.md` re-medidos allí mismo. **Nada de lo re-medido mueve una fila entre A, B, C y D.**

### Las tres clases (cómo se lee la columna «clase»)

| etiqueta en Jira | qué quiere decir | qué hace el equipo |
|---|---|---|
| **`stop-fundador`** | hay trabajo identificado y él levanta la parada | nada hasta su GO; con el GO, se construye |
| **`equipo-javier`** | no es nuestro | se mide y se les pasa. Un informe medido vale tanto como un arreglo |
| **`fundador`** a secas | la decisión ES el trabajo | no hay nada que construir |

**Medido sobre los 47 tickets que nombra esta hoja** (consulta con `fields: key, summary, status, labels`): **11** llevan `stop-fundador`, **11** `equipo-javier`, **7** `fundador`; **20** llevan al menos una de las tres y **27 no llevan NINGUNA** (20 + 27 = 47). 🔴 **Es decir: para el 57 % de la hoja, la clase NO se puede leer en Jira.** ~~Donde no hay etiqueta, la columna dice «sin etiqueta» y la clase va como **MI LECTURA**, para que el orquestador decida si se la pone.~~ **→ Las 27, clasificadas una a una por sus comentarios: parte F (1563j).** Dos tickets del equipo de Luis llevan además `decision-jefe` (1182, 1210), que en el equipo de Javier significa «espera a un jefe» (`docs/equipo/orquestador-javier.md:39`): ~~**una cuarta etiqueta para lo mismo.**~~ **→ no es lo mismo: parte F, al final.**

**🔵 Re-medido el 29-oct a las 18:30Z-18:50Z** (`Date:` de GitHub) · `origin/main` = `53d9834d9` · S0, SCRUM-1563j. Las **27 sin etiqueta**, una a una, por el ÚLTIMO comentario de cada ticket (dos lectores de sólo lectura, con `fields` explícito; las citas que SACAN una fila de la lista, cotejadas por S0 en Jira). **Mueve tres filas a la parte A:** 3.2 (870) y 6.4 (1056), por decisión del orquestador, y **6.16 (1629), por lo medido: el fundador delegó la elección del texto** (c.21194). Lo de cada fila, en la parte F. **Jira no se ha tocado** (orquestador, 29-oct): la hoja dice lo medido, y la tabla de abajo, dónde Jira dice otra cosa.

**Donde la etiqueta y lo medido NO casan** (gana lo medido; se lo pasa el orquestador al dueño del ticket):

| ticket | Jira dice | lo medido dice | por qué |
|---|---|---|---|
| SCRUM-1115 (2.11) | `stop-fundador` + `equipo-javier` | **`fundador`** | no hay nada que construir: es una variable de Railway (c.21240) |
| SCRUM-1525 (7.6) | `fundador` | **`fundador` + `equipo-javier`** | después de su decisión, la tarea programada la monta J |
| SCRUM-523 (3.5) | `equipo-javier` | **`equipo-javier` + `fundador`** | la declaración la firman los dos administradores |
| SCRUM-1632 (2.9 · 2.10) | `stop-fundador` | **`fundador`** en cuanto entre #2998 | el GO de (b) ya está dado; lo que queda es la visita a Meta |
| SCRUM-1390 (6.12) | `equipo-javier` + `fundador` | **ya no `fundador`** | su parte de fundador pasó a SCRUM-1638 (parte A) |
| SCRUM-913 (6.2) | `equipo-luis`, sin ninguna de las tres | `stop-fundador`; **y la fila dice «J lo construye»** | ~~o la fila o la etiqueta de equipo están mal: NO CONSTA cuál~~ **1563j: la fila estaba mal.** El título dice «esquema para que Javier **aplique el ALTER**» (paso ② de la regla 3, el colaborador) y el ticket es `equipo-luis` + `area-s0`: **construye el equipo de Luis.** Lo que espera al fundador, c.19821 (15-oct): «ubicación · móvil personal · si va detrás de un flag» |
| SCRUM-1629 (6.16) | sin ninguna de las tres; el título dice «FIRMA DEL FUNDADOR (sin prisa)» | **nuestro (S2), sin fundador** | c.21194 (27-oct): el fundador **delegó** la elección («weligue tu lo que me pides») y el orquestador eligió el literal. **No es una firma suya** y no se cita como tal (lo dice el propio comentario). **Sale a la parte A** |
| SCRUM-1555 (1.8) | sin ninguna de las tres; c.19743 (14-oct): «Las dos son del fundador» | **nuestro** (SCRUM-1638) | la decisión del orquestador del 29-oct (parte A) es posterior al comentario; el ticket no lo dice todavía |
| SCRUM-1433 (1.4) | sin ninguna; título «PARADO (decide el fundador)» | **`stop-fundador`** | un lector lo propuso «nuestro» por c.18156 (2-oct: «la urgencia es menor de la que escribí»). **Menos urgencia no quita la decisión:** se queda en D |

| de las 48 (versión del 29-oct 17:50Z) | cuántas |
|---|---|
| A · **las puede decidir el orquestador** (no le tocan al fundador) | 3 filas enteras (1.8, 6.12, 3.17) + 2 mitades (2.9 b, 1.1) |
| B · **bloquean HOY** | 3 |
| C · **no son decisión: esperan a la S.L.** | 11 |
| D · **revisión de go-live, en bloque** | 31 (1.1 incluida) |

3 + 3 + 11 + 31 = **48**, contando cada fila una vez (2.9 en B, 1.1 en D).

| de las 48 (**versión del 29-oct 18:50Z**, 1563j) | cuántas | qué cambia |
|---|---|---|
| A · no le tocan al fundador | **6** filas enteras (1.8, 6.12, 3.17, **3.2, 6.4, 6.16**) + 2 mitades (2.9 b, 1.1) | entran 3.2 y 6.4 (orquestador) y 6.16 (medido) |
| B · bloquean HOY | **2** (0.1 · 2.9 a, con 2.10 en la misma visita) | ninguno desde las 18:10Z |
| C · esperan a la S.L. | **10** | sale 3.2 |
| D · go-live, en bloque | **30** (1.1 y 2.11 incluidas) | salen 6.4 y 6.16 |

6 + 2 + 10 + 30 = **48**. (La de las 18:10Z era 3 + 2 + 11 + 32: allí 2.11 bajó de B a D.)

---

## A · Lo que NO le toca al fundador (las filas más rentables)

Están contadas como suyas en `ESTADO-DEL-PRODUCTO.md` y no lo son. **MI LECTURA, de S0:** cada una dice por qué; quien decide si se le quita es el orquestador.

**🟢 RESUELTA el 29-oct (~18:10Z, `origin/main` = `5a247020e`):** el orquestador decidió las cuatro (mensaje del orquestador a S0). **2.9 (b), 1.8, 6.12 y 3.17 salen de la lista del fundador. 1.1 NO sale**, por lo medido abajo.

| fila | veredicto | localizador | clase (Jira, 18:1xZ) |
|---|---|---|---|
| **2.9 (b)** | **GO dado** (el fundador delegó la decisión en el orquestador: «1 nos e decide tu») **y construido**: rama `scrum-1632c-firma-tolera-la-url-sucia`, **PR #2998 ABIERTO, sin mergear** (obligatorio sin terminar a las 18:10Z). ⚠️ El recorte a dos sitios abría un XSS (lo encontró S1): el arreglo lleva **tres** llamadas | PR #2998 | `stop-fundador` (1632) — **parada ya levantada** |
| **1.8** · **6.12** | **No es decisión: es dato de prueba.** Pasan a **SCRUM-1638** (el plan de la cuenta QA con más de un usuario) | SCRUM-1638 | 1638 sin etiqueta de las tres (`equipo-luis`): **es nuestro**. ⚠️ 1390 sigue con `fundador` (tabla de arriba) |
| **3.17** | **Decidido por el orquestador: SÍ, se unifican.** Es documento, no producto; la parte D de esta hoja es la lista única | — | 1554: `equipo-javier` + `fundador` |
| **3.2** (SCRUM-870) | **Sale: decisión del orquestador (29-oct, respuesta a S0 en 1563i).** No hay nada que decidir: el nombre del productor es el de la S.L., que trae su NIF, y lo pone J1. Se desbloquea solo con la parte C | sigue en `ESTADO-DEL-PRODUCTO.md` §2 3.2 como JAVIER (J1), esperando a la S.L. | `equipo-javier` + `decision-jefe`, **sin `fundador`** |
| **6.4** (SCRUM-1056) | **Sale: decisión del orquestador (29-oct).** El ALTER lo aplica el colaborador: es el **paso ② de la regla 3**, no una decisión del fundador. Y lo que falta lo dice c.19731 (14-oct): «Lo que falta es todo de J2 y J3» | `ESTADO-DEL-PRODUCTO.md` §2 6.4 | `equipo-luis` + `listo-para-construir` · medido: **`equipo-javier`** (J2, J3) |
| **6.16** (SCRUM-1629) | **Sale: medido por S0 (1563j).** La hoja la tenía como `stop-fundador` (MI LECTURA de 1563i) y **estaba mal**: el fundador **delegó** la elección del texto el 27-oct («weligue tu lo que me pides»), y el orquestador eligió el literal «Usa el año y el trimestre seleccionados arriba.» (c.21194). **S2 lo puede construir hoy.** ⚠️ Se cita como «texto elegido por el orquestador por delegación del fundador», **nunca como «aprobado por el fundador»** (lo exige el propio comentario), y no se verá en yaqu.app: sólo se pinta en modo fiscal (regla 24) | SCRUM-1629 c.21194, leído por S0 | sin ninguna · medido: **nuestro (S2)** |
| **1.1** (la mitad del GO) | 🔴 **SIGUE SIENDO DEL FUNDADOR.** Medido: `albaranes.routes.ts` está fuera de `RUTAS_FISCALES`, **pero es camino de emisión**: llama a `emitInvoice` en `:1390` y `:1672` (y es una «boca» del censo de `tests/_bocas-de-emision.mjs`). La regla 40 («el camino de emisión fiscal se lee, no se modifica») y la 38 hablan del camino, no de la lista de rutas | `src/modules/jobs/app/routes/albaranes.routes.ts:1390,1672` | 1490 sin etiqueta (`equipo-luis`) · MI LECTURA: **`stop-fundador`** |

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

**Clase:** **`fundador`** — llamar a la gestoría ES el trabajo; el equipo no tiene nada que construir. *(SCRUM-1561 no lleva ninguna etiqueta: MI LECTURA. SCRUM-143, de donde salen los pasos, lleva `equipo-javier` + `fundador`: lo de Javier es el Convenio 017, fila 3.1 de la parte C.)*

Al 20-oct iban **3 de 8 pasos** (SCRUM-143 c.20086). El último dato es del 26-oct: «ya tiene la documentación el notario» (c.20865). **No consta en ningún sitio que el notario haya firmado.** Mañana:

1. **Llama o escribe a la gestoría** que te dio la hoja de ruta (SCRUM-143 c.19619) y pide **tres datos, por escrito**: ① ¿está firmada la escritura? ¿qué día? · ② ¿está pagado el **Modelo 600** de la Comunidad de Madrid (paso 4)? · ③ ¿qué día se presenta en el **Registro Mercantil** (paso 5) y cuánto tarda la inscripción?
2. Si la escritura **no** está firmada: pide **fecha de firma** y apúntala en SCRUM-143. Firmáis **los dos administradores** (Javier y tú, mancomunados: c.20865).
3. Pega la respuesta de la gestoría en SCRUM-143, tal cual. **Con esa fecha, el equipo sabe cuándo se abre la parte C entera.**

⚠️ **La firma del notario NO desbloquea lo fiscal.** Lo que lo desbloquea es la **inscripción en el Registro Mercantil** (paso 5) y, después, el **certificado de representante** (c.20088).

### B2 · Los botones de WhatsApp (2.9 a + 2.10) — UNA sola visita a Meta

**Clase:** **`fundador`** — la visita a Meta ES el trabajo. *(SCRUM-1632 lleva `stop-fundador` por la mitad (b), cuyo GO ya está dado: parte A.)* ⚠️ **La skill `yaqu-wa-templates` dice lo contrario que estos pasos** (`SKILL.md:20,30,31,33`: «la URL base termina en `/{{1}}`»): **para esta visita valen estos pasos y `docs/WHATSAPP_TEMPLATES.md:52-63`, no la skill.** Su corrección está escrita en `docs/master/SCRUM-1563.md` (1563i) y la sube el orquestador, que es quien puede tocar `.claude/`.

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

**Las filas que mezclan dos clases van partidas en (a) y (b)**; el total de 48 no cambia (cada fila sigue contando una vez).

| fila | qué | lo que la destraba | clase (Jira, 18:1xZ) |
|---|---|---|---|
| 0.2 | ceder a la S.L. los derechos del código (SCRUM-1283) | S.L. constituida | sin etiqueta · MI LECTURA: **`fundador`** (la cesión la firman los socios) |
| 0.3 · 3.6 (a) | contratar al asesor fiscal y encargar la revisión externa (SCRUM-1264) | aplazado por él hasta la S.L. | **`fundador`** |
| ↳ (b) | la lista de 28 preguntas para el asesor (SCRUM-1264) | — | **`equipo-javier`** |
| 3.1 (a) | el certificado de representante de la S.L. (SCRUM-143) | S.L. inscrita | **`fundador`** |
| ↳ (b) | el alta del Convenio 017 con la AEAT (SCRUM-143) | el certificado de (a) | **`equipo-javier`** |
| ~~3.2~~ | ~~nombre del productor que viaja a Hacienda (SCRUM-870)~~ | ~~NIF definitivo de la S.L.~~ | **SALE a la parte A (orquestador, 29-oct).** `equipo-javier`: el NIF lo trae la S.L. y lo pone J1 |
| 3.3 · 3.4 | certificado de entidad en el servidor y quien hace los envíos de prueba | S.L. constituida | sin ticket · MI LECTURA: (a) **`fundador`** el certificado · (b) **`equipo-javier`** instalarlo y enviar |
| 3.5 (a) | firmar la declaración responsable, dos firmantes (SCRUM-523) | «cuando ya esté la SL» | sin `fundador` en Jira · MI LECTURA: **`fundador`** |
| ↳ (b) | construirla (PR #2881, borrador y en conflicto) | — | **`equipo-javier`** |
| 3.7 | paso a producción de la AEAT con una factura real | Convenio 017 | sin ticket · MI LECTURA: **`fundador`** |
| 4.1 · 5.1 | Stripe y la suscripción en modo real (SCRUM-41) | S.L. + SIF-1 | sin etiqueta · MI LECTURA: **`fundador`** (activar la cuenta en modo real) |

---

## D · Revisión de go-live, EN BLOQUE

**Ninguna de éstas se le pregunta suelta.** Se le presentan juntas el día de la revisión. Agrupadas por lo que tiene que hacer, para que sea una sentada y no treinta.

**Desde 1563j, donde una celda de «clase» dice «sin etiqueta · MI LECTURA», manda la parte F**, que la sustituye por lo leído en el comentario del ticket, con su número.

🔴 **La única con FECHA:** **1.1** (SCRUM-1490) — el 1-ene-2027 la ficha de un presupuesto con secuencia repetida da 500. **Si la revisión de go-live cae después del 1-dic, ésta sube a la parte B.**

| fila | qué decide | si sí | si no | qué está parado | clase (Jira, 18:1xZ) |
|---|---|---|---|---|---|
| **Una credencial de sólo lectura de producción** | | | | |  |
| 1.1 · 3.14 | darla (SCRUM-1490 · SCRUM-1097/1109) | se corre la consulta de 1490 y el guard de «nadie emite» contra la base real | 1490 no cierra su aceptación 6; no se puede acreditar que ningún profesional real emite | dos guards en `main` sin correr contra nada | (a) darla: **`stop-fundador`** (1097; 1490 sin etiqueta) · (b) la tarea programada que corre el guard con ella (SCRUM-1109): **`equipo-javier`** + `stop-fundador` |
| **Firmas de texto (regla 39)** | | | | |  |
| 1.6 | el texto de los 1-2 céntimos (SCRUM-1451) | el profesional entiende el «te falta 0,01 €» | sigue viendo una deuda de un céntimo sin explicación | el ticket | sin etiqueta · MI LECTURA: **`stop-fundador`** |
| 2.3 | el texto del rebote del correo (SCRUM-1558 b) | la pantalla enseña el correo que no llegó | el correo puede decir «ok» sin salir | 1558 b; 1558 c espera además `LOG_MAGIC_LINKS=true` en staging | sin etiqueta · MI LECTURA: **`stop-fundador`** |
| 6.8 | las 3 líneas del concepto de fechas (SCRUM-1445) | las fechas se imprimen en hora de España | un albarán de las 00:30 lleva la víspera | el arreglo de los dos equipos | sin etiqueta · MI LECTURA: **`stop-fundador`**; con la firma construyen los dos equipos |
| ~~6.16~~ | ~~que el Paquete del trimestre diga su periodo (SCRUM-1629, «sin prisa»)~~ | | | | **SALE a la parte A (medido, 1563j):** el fundador delegó la elección del texto (c.21194). ~~MI LECTURA: `stop-fundador`~~ estaba mal |
| 7.3 | los recambios #4, #6, #7 y #9 de la landing y el B1 del bot (SCRUM-1236) | sale el texto verdadero | **siguen en la landing pública textos que afirman algo falso** | nada del equipo: el resto ya se cambió | **`stop-fundador`** |
| **Plantillas de Meta** | | | | |  |
| 2.6 | «Voy de camino», aviso de visita y portal en el pie (SCRUM-975 · 981 · 1143): **una sola visita para las tres** | se pueden enviar | no existen esos avisos | las tres | **`stop-fundador`** (1143) · 975 y 981 sin etiqueta |
| 2.10 | los tres botones con enlace (`quote_decision_es`, `payment_request_es`, `payment_confirmation_invoice_es`) | se sabe si tienen el defecto de 2.9 | **los de pago no se usan antes del SIF-1 (regla 24)**; el del presupuesto ya lo tolera el servidor | nada hoy. ⚠️ Si va a Meta por 2.9 (a), que los mire entonces | **`stop-fundador`** (1632) · lo que queda es **`fundador`**: la visita de B2 |
| 6.1 | GO de los mantenimientos + su plantilla (SCRUM-911) | se encienden (construidos y apagados) | siguen apagados | la función entera | sin etiqueta · MI LECTURA: **`stop-fundador`** |
| **GO del camino de emisión o del SIF-1 (regla 40)** | | | | |  |
| 3.9 | `ClaveRegimen` fija a «01» (SCRUM-1129): GO + ALTER + firma | cada régimen va con su clave | se declara un régimen equivocado a Hacienda para quien no es «01» | J1 | (a) GO + firma: **`stop-fundador`** · (b) construir + ALTER: **`equipo-javier`** |
| 3.10 | criterio de caja en el registro y el PDF (SCRUM-1240): GO + firma, con el asesor | se puede facturar en criterio de caja | quien lo use emite sin la mención obligatoria | J1 | (a) GO + firma: **`stop-fundador`** · (b) construir: **`equipo-javier`** |
| 3.15 | retenciones en el resumen del trimestre (SCRUM-1146) | el resumen las cuenta | el resumen no las enseña | el ticket | sin etiqueta · MI LECTURA: **`stop-fundador`** |
| 3.19 | diseño de subsanar un registro «aceptado con errores» (SCRUM-1612) | J1 lo construye | un rechazo parcial de la AEAT se queda sin camino | J1 | (a) GO al diseño: **`stop-fundador`** · (b) construir: **`equipo-javier`** |
| **Cambios de máster (estados, Parte L)** | | | | |  |
| 1.7 | copiar el enlace ¿cuenta como enviado? (SCRUM-1297) | el presupuesto deja `draft` al copiar | parece no enviado estando entregado | el ticket | sin etiqueta · MI LECTURA: **`stop-fundador`** |
| 6.7 | estados de la bandeja de gastos (SCRUM-1069) | se construye la bandeja | no hay bandeja | el ticket | sin etiqueta · MI LECTURA: **`stop-fundador`** (lleva `esperando-decision`) |
| 7.1 | la enmienda A4.1 de posicionamiento (SCRUM-328) | se sabe qué se vende antes del SIF-1 | no se puede vender facturación que no se puede usar | el mensaje comercial | **`fundador`** |
| **Decisiones de producto** | | | | |  |
| 1.3 | qué dice un documento con IVA «no indicado» (SCRUM-1438), con el asesor | texto correcto | sale «IVA 0 %» | el ticket | sin etiqueta · MI LECTURA: **`stop-fundador`** |
| 1.4 | qué enseña cada línea en la página de aceptar (SCRUM-1433) | líneas y total cuadran a la vista | líneas sin impuesto y total con él | el ticket | sin etiqueta · MI LECTURA: **`stop-fundador`** |
| 1.9 | el «encargo de diseño» de guardar como plantilla con 3 opciones (SCRUM-1545) | S2 hace los puntos 1, 2, 4 y 5 | sólo funciona el punto 3 | S2 | sin etiqueta · MI LECTURA: **`stop-fundador`** |
| 1.12 | enchufar o retirar el «mensaje con IA» (SCRUM-1182) | o tiene botón o se borra | código construido desde el 22-may sin uso | nada | sin etiqueta · MI LECTURA: **`stop-fundador`** (lleva `decision-jefe`) |
| 1.14 | GO del arreglo del bucle de recordatorios de presupuesto (SCRUM-1586, regla 28) | deja de reenviar 48 en 48 h | un cliente real recibiría el recordatorio en bucle | S1 | **`stop-fundador`** |
| 4.5 | cancelar un cobro: GO + 2 decisiones (SCRUM-1532) | el estado tiene camino | existe y nadie llega | el ticket | sin etiqueta · MI LECTURA: **`stop-fundador`** |
| 6.2 | fichaje: ALTER + ubicación, interruptor, textos y plan (SCRUM-913) | J lo construye | no hay registro de jornada | J aplica el ALTER; **construye el equipo de Luis** | **`stop-fundador`** (c.19821) · ~~⚠️ la fila dice «J lo construye» y el ticket es `equipo-luis`~~ resuelto en 1563j: J aplica el ALTER (título), construye `equipo-luis` |
| ~~6.4~~ | ~~el ALTER de «volver a llamar» (SCRUM-1056)~~ | | | | **SALE a la parte A (orquestador, 29-oct).** `equipo-javier`: el ALTER lo aplica el colaborador (paso ② de la regla 3), y lo demás es de J2 y J3 (c.19731) |
| 6.6 | 5 fotos reales de tickets (SCRUM-961 · 971) | se prueba la lectura con IA | no se sabe si lee tickets de verdad | el gasto por WhatsApp | **`stop-fundador`** (961) · 971 sin etiqueta |
| 7.8 | devolverle el acceso a la cuenta DEMO y que su correo llegue a un buzón (sin ticket) | se puede hacer una demo | `POST /quote/create` da 403 `trial_expired` | las demos comerciales | sin ticket · MI LECTURA: **`fundador`** |
| 7.9 | los cinco guiones comerciales (SCRUM-1554 fila 24, c.20778) | entran en la puerta | se vende sin guion | — | (a) los cinco guiones: **`fundador`** · (b) entrarlos en la puerta (SCRUM-1554): **`equipo-javier`** |
| **Coste e infraestructura** | | | | |  |
| 4.2 | dos secretos de webhook en Railway (SCRUM-678) | se puede encender Connect y Mercado Pago | no se pueden encender | CONNECT-1 | sin etiqueta · MI LECTURA: **`fundador`**: los secretos los pega él en Railway (CLAUDE.md §9) |
| 7.6 | respaldo: retención, RPO/RTO y la tarea de Railway (SCRUM-1525) | volcado programado y restauración probada | sólo hay un volcado a mano del 13-oct | J | **`fundador`** · (b) la tarea programada: **`equipo-javier`** (falta en Jira) |
| 7.7 | apagar `test-login` en producción (SCRUM-1210) | — se hace el día del lanzamiento | queda una puerta de pruebas abierta | nada antes de ese día | sin etiqueta · MI LECTURA: **`fundador`** (lleva `decision-jefe`) |
| **Bajadas o añadidas el 29-oct** | | | | |  |
| 2.11 | `EMAIL_FROM` en los otros dos servicios (SCRUM-1115). **Pasos:** Railway → proyecto `cobroflash-backend` → en **cada caja** que no sea la base de datos: pestaña **Variables** → `EMAIL_FROM`. Valor: **`YaQu <no-reply@yaqu.app>`** (el mismo que ya tiene el backend, c.19624). Si una caja no tiene la variable, no la crees: dínoslo con el nombre de la caja. **Cómo lo compruebas:** el valor se ve en la misma pestaña; o en Resend → Emails, el «From» del último envío de cada uno | los avisos internos salen con la marca nueva | un aviso interno sale como «PresuFácil»; a clientes, no | nada | Jira: `stop-fundador` + `equipo-javier` · **medido: **`fundador`****, no hay nada que construir |
| — | **simulacro del vigía** (SCRUM-1605): `gh workflow run vigia-despliegue.yml -f simulacro=true`, o GitHub → Actions → «Vigía del despliegue» → **Run workflow** → marcar **simulacro**. Fabrica una producción congelada **de mentira** y hace sonar el aviso; **no mira ni toca `yaqu.app`**. **Lo lanza el fundador o lo autoriza con su palabra:** a S5 se le denegó el 27-oct | se sabe que el aviso suena | el aviso de producción congelada **no ha sonado nunca**; hoy el equipo estuvo 6 h 38 min caído | nada del equipo. **No bloquea vender; no está en las 48** | sin etiqueta · MI LECTURA: **`fundador`** |

**Y una pregunta más en la misma sentada (no está en las 48; añadida el 29-oct, SCRUM-1529):**

> **¿Confirmas estas siete?** Son decisiones sobre estados de la Parte L que **ya están aplicadas en el máster** (`docs/YAQU_MASTER.md:403-409`), pero las apuntó el orquestador del equipo de Javier «recogiéndolas» (SCRUM-1529 c.19228), **no con tus palabras**. Si alguna no es tuya, hay una regla viva sin firma.
> ① `QuoteRequest.status`: `pending → read → done` · ② `ParteTrabajo.estado`: entra, sin `facturado` · ③ `TeamMember.status`: entran los tres valores; las transiciones, no · ④ `Quote.status`: entra `pending_approval` · ⑤ `Invoice.status`: `expired` no se quita, se añade · ⑥ `Charge.status`: entran `failed` y `expired`; `cancelled` se queda y se construye quién cancela · ⑦ `WhatsAppMessage.status`: entra `received` para entrantes.
>
> **Clase:** **`fundador`** (SCRUM-1529 lleva sólo esa): confirmarlas ES el trabajo. **No bloquea hoy, y SCRUM-1529 no se cierra hasta que conteste.**

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

⚠️ **De qué clase es el localizador:** c.19228 y c.19299 **no son la voz literal del fundador**: los firma el orquestador «recogiendo» lo que el fundador dio por el canal. El equipo lo aceptó como localizador válido (c.19279). ~~**No hay ninguna que preguntarle.** Lo que queda es cerrar el ticket con este censo, y eso lo decide el orquestador (SCRUM-1529 lleva sólo la etiqueta `fundador`).~~ **Corregido el 29-oct (orquestador, SCRUM-1563i):** un «sí» del fundador viaja como **cita literal con localizador**, y una decisión apuntada por otro orquestador no lo es. Como las siete ya están aplicadas en el máster, si no fueran suyas serían siete reglas vivas sin firma. **Por eso van como UNA pregunta en la revisión de go-live (final de la parte D): «¿confirmas estas siete?». SCRUM-1529 NO se cierra hasta su respuesta.**

---

## F · Las 27 sin etiqueta, clasificadas una a una (1563j)

**Medido el 29-oct a las 18:30Z-18:45Z** (`Date:` de GitHub), sobre los 27 tickets de la hoja que no llevan `stop-fundador`, `equipo-javier` ni `fundador`. **Fuente: el ÚLTIMO comentario de cada uno**, leído por dos lectores de sólo lectura (`fields` con `comment`), y **cotejado por S0 en Jira donde saca una fila de la lista del fundador** (1629). Donde el ticket no tiene comentarios, la clase sale del título y se dice. **Lo que no se sabe, se queda en D** (regla de reparto de esta hoja). Clases: las tres de arriba, más **«nuestro»** (equipo de Luis, sin nada del fundador).

| ticket | fila | clase (medida) | evidencia | va en |
|---|---|---|---|---|
| SCRUM-41 | 4.1 · 5.1 | (a) **`fundador`** activar la cuenta en modo real · (b) **`stop-fundador`** migrar a `sk_live` (dinero real) | c.16294 (21-sep): «Stripe live no se activa antes de constituir la SL». (b) es MI LECTURA por la regla 4 | C |
| SCRUM-678 | 4.2 | **`fundador`** | c.19059 (9-oct): «De sesión no queda nada por hacer»: pegar los dos secretos en Railway | D |
| SCRUM-911 | 6.1 | **`stop-fundador`** (GO escrito) + **`fundador`** (la plantilla en Meta) | c.19807 (15-oct): «Pide su GO escrito» | D |
| SCRUM-913 | 6.2 | **`stop-fundador`** | c.19821 (15-oct): «Decide el fundador: ubicación · móvil personal · si va detrás de un flag» | D |
| SCRUM-971 | 6.6 | **`fundador`** (las fotos, vía 961) | c.16053 (21-sep): «961 está en Acción del fundador esperando esas fotos» | D |
| SCRUM-975 | 2.6 | **`stop-fundador`** (aprobar el literal) | c.16051 (21-sep): «aprobar el texto literal de la plantilla (STOP de plantillas de Meta)» | D |
| SCRUM-981 | 2.6 | **`fundador`** (crear las plantillas en Meta) + **`stop-fundador`** | c.16297 (21-sep): «el fundador tiene que CREAR las plantillas… en Meta» | D |
| SCRUM-1056 | 6.4 | **`equipo-javier`** | c.19731 (14-oct): «Lo que falta es todo de J2 y J3» | **A** |
| SCRUM-1069 | 6.7 | **`stop-fundador`** (estados nuevos = cambio de máster) | 0 comentarios con la decisión; lleva `esperando-decision`. Por título | D |
| SCRUM-1146 | 3.15 | **`stop-fundador`** | c.19788 (15-oct): «espera la decisión del jefe sobre la emisión» | D |
| SCRUM-1182 | 1.12 | **`stop-fundador`** (enchufar o retirar) | 0 comentarios; lleva `decision-jefe`. Por título | D |
| SCRUM-1210 | 7.7 | **`fundador`** (las variables de Railway, el día del lanzamiento) | 0 comentarios; lleva `decision-jefe`. Por título | D |
| SCRUM-1283 | 0.2 | (a) **`fundador`** la cesión, la firman los socios · (b) **nuestro** cambiar `LICENSE` después | 0 comentarios. Por título | C |
| SCRUM-1297 | 1.7 | **`stop-fundador`** (propuesta de máster, Parte L) | 0 comentarios. Por título | D |
| SCRUM-1433 | 1.4 | **`stop-fundador`** | título «PARADO (decide el fundador)»; c.18156 (2-oct) baja la urgencia, no quita la decisión | D |
| SCRUM-1438 | 1.3 | **`stop-fundador`** (con la asesora) | 0 comentarios. Por título | D |
| SCRUM-1445 | 6.8 | **`stop-fundador`** + **`equipo-javier`** (sub-tickets 1470-1472) | c.19429 (13-oct): «OK del fundador para dos líneas» | D |
| SCRUM-1451 | 1.6 | **`stop-fundador`** (firma del literal) | 0 comentarios. Por título | D |
| SCRUM-1490 | 1.1 | **`stop-fundador`** | c.20041 (19-oct): «Las 2 líneas del camino de emisión que siguen esperando OK» | A (mitad) + D |
| SCRUM-1532 | 4.5 | **`stop-fundador`** | c.19234 (13-oct): «Dos decisiones que son del fundador» | D |
| SCRUM-1545 | 1.9 | un lector la lee **nuestro** (c.20042, 19-oct: «Los puntos 1, 2, 4 y 5 siguen sin hacer») · **NO cotejado por S0** | si el «encargo de diseño» de la fila sigue esperando al fundador, NO CONSTA | **D** (no se sabe → se queda) |
| SCRUM-1555 | 1.8 | **nuestro** (SCRUM-1638) por la decisión del orquestador del 29-oct | c.19743 (14-oct) decía «Las dos son del fundador»: es anterior | A |
| SCRUM-1558 | 2.3 | **`stop-fundador`** (el texto del rebote, regla 39) | 0 comentarios. Por título | D |
| SCRUM-1561 | 0.1 | **`fundador`** | 0 comentarios. Por título | B |
| SCRUM-1605 | — | **`fundador`** (autorizar el simulacro: a S5 se le denegó el 27-oct) | c.21251 (29-oct): «Lo que queda es esa mitad de apertura». Un lector lo leyó «nuestro»; **lo denegado lo reintenta quien tiene el permiso**, no otra sesión | D |
| SCRUM-1629 | 6.16 | **nuestro (S2)** | c.21194 (27-oct), **cotejado por S0**: delegación «weligue tu lo que me pides» | **A** |
| SCRUM-1638 | 5.4 | **nuestro (S1)** | 0 comentarios; ya en A desde las 18:10Z | A |

**Cuenta de las 27:** `stop-fundador` **13** (913, 975, 1069, 1146, 1182, 1297, 1433, 1438, 1451, 1490, 1532, 1558, y 1445 con J) · `fundador` **5** (678, 971, 1210, 1561, 1605) · mixtas `fundador` + `stop-fundador` **3** (41, 911, 981) · `fundador` + nuestro **1** (1283) · `equipo-javier` **1** (1056) · nuestro **3** (1555, 1629, 1638) · **sin decidir 1** (1545). 13 + 5 + 3 + 1 + 1 + 3 + 1 = **27**. **Por título y no por comentario: 10** (1069, 1182, 1210, 1283, 1297, 1438, 1451, 1558, 1561, 1638).

### `decision-jefe`: NO es lo mismo que `fundador`

- **Qué es:** la etiqueta del equipo de Javier para «espera a **un jefe**» (`docs/equipo/orquestador-javier.md:39`), y su cola se saca con `labels = equipo-javier AND labels = decision-jefe` (`:28`). «Un jefe» es **Luis o Javier**: «donde las normas dicen "el fundador" para pedir un sí, vale un jefe» (`docs/equipo/dos-equipos.md:28`).
- **Por qué no es `fundador`:** dice **QUIÉN** (cualquiera de los dos jefes), no **QUÉ** (si la decisión ES el trabajo o si es un GO para construir). Las tres de esta hoja dicen el QUÉ. En la hoja aparece en seis: 143, 870, 1390 y 1554 (las cuatro con `equipo-javier`, donde es su cola normal) y **1182 y 1210, que son `equipo-luis`**.
- **El riesgo, en esas dos:** ninguna consulta del equipo de Luis busca `decision-jefe`, así que **1182 y 1210 no salen en nuestra cola de «lo que espera al fundador»**. La consulta de Javier tampoco las ve, porque exige `equipo-javier`. **Están en la hoja, y en ninguna cola.**
- **Unificado en la hoja:** `decision-jefe` **no es una clase**; cada ticket lleva una de las tres por su contenido (1182 → `stop-fundador`, 1210 → `fundador`). **Propuesta, para que la decida el orquestador:** en los tickets `equipo-luis`, sustituir `decision-jefe` por la clase medida. Jira no se ha tocado.

---

## Cómo se actualiza

Cada vez que S0 recuenta `ESTADO-DEL-PRODUCTO.md` (`node docs/master/evidencias/SCRUM-1563/contar-dependencias.mjs docs/producto/ESTADO-DEL-PRODUCTO.md`): una fila nueva con FUNDADOR entra aquí en su parte; una que sale de §2 sale de aquí. **La parte B no crece sin que la fila diga qué se rompe HOY.**
