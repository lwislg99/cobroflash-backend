# SCRUM-1259 · ¿Qué tickets siguen ABIERTOS en Jira con su trabajo ya en `main`? — 91 candidatos de 203

**Medido contra:** `origin/main` = `d216084a67b1f42e69b829e5829420562873e528` · 2026-09-28T22:12:24Z

J6 (jv-j6), por encargo del orquestador del equipo de Javier. El 28-sep se repartieron **seis** encargos ya
hechos (1224, 1204, 1223, 1200, 825, 1101). La causa: Jira no se cierra al ritmo al que se entrega, así que su
estado no dice qué queda por hacer.

    node scripts/abierto-con-trabajo-en-main.mjs --jira p1.json p2.json p3.json     # la foto: JSON del MCP
    node scripts/abierto-con-trabajo-en-main.mjs --jira … --ticket 1200              # el detalle de uno

**Sólo LEE**, sin escribir nada en Jira ni en el repo. **Da candidatos para LEERLOS, no para cerrarlos**: cerrar
sigue siendo A13, del orquestador, leyendo el ticket. Tarda ~90 s con 203 abiertos (el motor consulta git ticket
a ticket), y se corre desde un árbol al día con `main`.

## 🔴 Es una CAPA sobre el motor de la casa, y mi PASO 0 se equivocó

**La primera versión traía su propio censo** de ramas, commits y expedientes: funcionaba, tenía sus tests y sus
6 mutaciones, y **era un segundo censo**, que es justo lo que el encargo prohibía. El motor ya existía:

- `tests/_censo-tickets.mjs` · `censarTicket` (SCRUM-388): «¿qué hay en `main` de UN ticket?». Mira commits,
  entrada de máster y ramas, y declara **NO_MEDIBLE** cuando el número está compartido (SCRUM-738: `SCRUM-684.md`
  titulado para 683). Mi versión no tenía esto último.
- `scripts/_rastro-del-ticket.mjs` · `rastroDeLosTickets` (SCRUM-804): cada rama por su nombre entero, `en-main`
  o `viva`.
- `scripts/censo-tablero-vs-arbol.mjs` (SCRUM-738): los enumera, **y dice en su salida que no lee Jira**:
  «se cruza a mano».

Lo encontré tarde, cuando `SCRUM-723` saltó al entrar mi fichero en su censo de referencias móviles: describía
`censo-tablero-vs-arbol.mjs` con mi misma pregunta. **Busqué en `scripts/verificacion-s5/` y no por concepto.**
Es el tropiezo que confiesa la cabecera de SCRUM-738. Mi motor se retiró. Esta capa añade sólo lo que faltaba:

1. **El cruce con Jira**: una foto de los ABIERTOS, con fecha y caducidad.
2. **La trampa ②**: el número en TODO `docs/master/`, no sólo en la entrada propia.
3. **El motivo escrito** para seguir abierto con trabajo dentro.

### Por qué no `enlace:ticket-rama`

Se leyó entero `scripts/verificacion-s5/enlace-ticket-rama.mjs` (SCRUM-637). Mide otra pregunta: si las cuatro
fuentes del ENLACE concuerdan. **No exporta nada** (corre al cargarse y acaba en `process.exit`), es de la S5,
**empareja ramas por NÚMERO** (la trampa ①) y su foto de Jira es del **7-sep**.

## La foto de Jira, y su caducidad

La lee de un fichero que le pasa quien lo corre: el **JSON que guarda el MCP** de Atlassian
(`searchJiraIssuesUsingJql` con `statusCategory != Done`, todas las páginas) o un TSV.

**Con más de 12 h, o sin la última página (`hasNextPage:false`), sale CIEGO (2) sin tocar git**: con una foto
vieja, «abierto» ya no es una afirmación. Medición de hoy: 3 páginas (100 + 100 + 3), la última con
`hasNextPage:false`, tomada a las 22:03:39Z.

## El resultado, sobre 203 abiertos

| veredicto | n | qué es |
| --- | --- | --- |
| 🔴 **CANDIDATO** | **91** | el motor le ve trabajo en main (commits o entrada propia o rama `en-main`) y no hay rama suya viva |
| 🟠 CERRADO EN OTRO | 0 | nada propio, pero otro expediente dice «cerrado aquí» (el caso real, 1200, tiene además lo suyo) |
| 🟡 CON MOTIVO ESCRITO | 31 | trabajo en main, y Jira espera a otro («Acción del fundador», «En revisión»), o el título de su expediente lo declara (BLOQUEADO, PARADO, PASO 0…), o el motor lo da PARCIAL por marcas sin conectar. **Se lista, no se esconde** |
| 🟡 PARCIAL | 7 | trabajo en main y una rama suya VIVA fuera |
| ⚪ EN CURSO | 1 | sólo una rama viva |
| · SIN RASTRO | 73 | nada con su número (≠ «sin hacer», límite ③) |
| NO MEDIBLE / CIEGO | 0 / 0 | |

Ramas remotas: 153 (18 en main, 135 vivas, 0 sin clasificar). 837 expedientes de `docs/master/`.

| caso | lo que se sabía | lo que sale |
| --- | --- | --- |
| 1194, 1214 | hechos (el orquestador los cierra) | CANDIDATO ✅ |
| 1218, 1244 | sus PR (#1935, #1936) mergeados a las 21:39 y 21:45Z | CANDIDATO ✅ |
| 1200 | hecho, y además «cerrado aquí» en `SCRUM-1216.md` §⑦ | CANDIDATO, con la línea `SCRUM-1216.md:131 «## ⑦ SCRUM-1200, cerrado aquí»` ✅ |
| 825 | hecho, en «Acción del fundador», y con una rama nueva empujada a las 22:14Z (`scrum-825-retirar-generador-j`) | PARCIAL ✅ |
| 1101 | hecho bajo SCRUM-1097 sin nombrar el 1101 | SIN RASTRO: el límite ③, real |
| **1179, 1215, 1232, 1016** | **abiertos a propósito, con trabajo parcial en main** | **PARCIAL, NO marcados** ✅ (el control que pidió el orquestador) |
| 1063-1077 | «BLOQUEADO, motivo medido» | CON MOTIVO ESCRITO ✅ |

**Dos sondas, un desacuerdo, y el desacuerdo era el dato.** Mi primera versión (`ls-remote` a las 22:12Z) no
veía `scrum-825-retirar-generador-j`; el motor sí. La rama se empujó a las 22:14:18Z. Al repetir, las dos coinciden.

## Las tres trampas del encargo

- **① Por slug completo**: la da el motor de 804, rama a rama. Una sola viva hace PARCIAL al ticket.
- **② El número en TODO `docs/master/`**, separando la línea que dice cierre («cerrado aquí», «arreglado en»,
  «hecho bajo», «lo cubre»…) de la que sólo cita. En toda la población salen **3 líneas**: una es el caso real
  (`SCRUM-1216.md:131`, para 1200) y **dos son ruido sabido**. `SCRUM-1119.md:48` trae una frase de cierre sobre
  otro ticket de la misma fila, y `SCRUM-1200.md:11` cita «SCRUM-1200, cerrado aquí» nombrando a 1216, así que
  se le apunta a 1216. Por eso es un cribado para leer. La frontera es de letra Unicode: con `\b`, «sólo cubre»
  casaba con «lo cubre» (`SCRUM-1092.md:69`).
- **③ 🔴 NO RESUELTA, declarada.** Que el defecto esté arreglado sin rama, commit ni expediente con su número.
  1101 es el caso real. Para eso sigue haciendo falta el PASO 0 por CONTENIDO.

## Discriminadores probados

- **Palabras de «pendiente» en el CUERPO del expediente: DESCARTADO.** 95 de 112 candidatos las tienen, porque
  todo expediente habla de lo que queda.
- **El ESTADO de Jira que espera a otro y el TÍTULO del expediente: ADOPTADOS.** Falso negativo conocido:
  `SCRUM-323` («PASO 0: el mapa — y el bloqueo del ticket ya está resuelto») se aparta por «PASO 0» aunque diga
  resuelto.

## Límites declarados

- **Un ticket por partes (A18)** con la primera en main y las demás sin empezar sale CANDIDATO: no se distingue.
  Por eso un candidato se LEE antes de cerrar.
- **Una rama abandonada que sigue viva** deja al ticket en PARCIAL y lo aparta del rojo: el error va en la otra
  dirección (esconde un candidato).
- `docs/master/` se lee **del árbol donde se corre**, como hace `censarTicket`: un árbol viejo ve expedientes viejos.

## Visto en rojo

Con la capa commiteada (`db5b9664`) y restaurada con `git restore --source=HEAD` tras cada mutación,
`tests/scrum1259-abierto-con-trabajo-en-main.test.mjs` (10 casos fabricados con la forma que devuelve el motor)
cae en las **7**:

| mutación | cae |
| --- | --- |
| M1 · sin la regla PARCIAL (trampa ①) | ① |
| M2 · sin mirar los expedientes AJENOS (trampa ②) | ② |
| M3 · sin el «abierto con motivo» | el control del abierto legítimo, y el de las marcas del motor |
| M4 · sin exigir la última página | la foto |
| M5 · sin la caducidad | la foto vieja |
| M6 · la frontera vuelve a `\b` | «sólo cubre» |
| M7 · no respetar el NO_MEDIBLE del motor | el del número compartido |


---

# APÉNDICE · 29-sep-2026 · El BARRIDO por contenido: los 99 abiertos, uno a uno

**Medido contra:** `origin/main` = `9911a2dcd809780d80dd117cc6314093f4c6d90f` · 2026-09-29T17:33:40Z (los veredictos se leyeron sobre `51d81311`; de ahí a `9911a2dc` solo entraron SCRUM-1278 y SCRUM-1286, bancos de test y un workflow, ninguno de la población)

**Encargo:** orquestador del equipo de Javier (`cobroflash-backend-47`), 29-sep. **Quién:** J6. **Qué NO hace:** ni cierra tickets ni cambia su estado (eso es A13), ni construye nada.

## Por qué

Con este censo, el orquestador verificó seis tickets a mano (1133, 1136, 1216, 1275, 1126 y 1131) y los seis estaban hechos. 1131 salía SIN RASTRO: estaba arreglado bajo SCRUM-1269. 1216 salía CANDIDATO y tenía dos partes. El censo responde a «¿hay rastro de su número?», pero la pregunta de verdad es otra: **¿está el defecto arreglado o la función construida, HOY, en `origin/main`?** Eso se contesta leyendo el código, el test o la pantalla, no el historial.

## Recuento final (99)

**HECHO 32 · PENDIENTE 58 · NO SÉ 9.** De los 45 CANDIDATO, 25 están hechos: 20 de los que el censo marca como candidatos NO lo están. De los 29 SIN RASTRO, 1 está hecho (1101, bajo otro número). De los 25 CON MOTIVO o PARCIAL, 6.

## Población y método

- **Foto:** la sacó el orquestador. JQL `project = SCRUM AND labels = "equipo-javier" AND statusCategory != Done`, 17:20:54Z, **99 tickets, `hasNextPage: false`**, con `labels` y `description`. Viene sin los cinco que el orquestador cerró desde las 16:02Z.
- **Censo** (`--jira <foto>`): CANDIDATO 45 · ABIERTO CON MOTIVO 23 · PARCIAL 2 · SIN RASTRO 29 · CIEGO 0.
- **Verificación:** se leyó el enunciado completo de cada ticket y se contrastó contra el código de hoy, buscando también por **concepto** para dar con lo hecho bajo otro número. Hice a mano los 15 `listo-para-construir` y los 7 de mi carril. Los otros 77 los repartí entre seis verificadores de solo lectura, que siguieron las mismas instrucciones escritas. De sus veredictos comprobé a mano una muestra de las citas `fichero:línea` en cada lote (en total, más de 25). Ninguna falló.
- **Tres cubos.** HECHO: todas las partes, verificadas por contenido. PENDIENTE: con la prueba de lo que falta. NO SÉ: con su motivo.

## 🔴 Lo que cambia el reparto

1. **`listo-para-construir` miente en las dos direcciones.** De los 15, **uno** está hecho (1246) y **otro** lo está en lo esencial (1063). Los otros 13 NO están hechos, pero casi ninguno se puede construir hoy: esperan al asesor, la decisión D2, una firma de texto o un GO fiscal. **Construible sin STOP, solo la pantalla de 1043** (con firma de texto).
2. **Construible sin STOP fuera de esa etiqueta:** 1142 (una clase CSS, AB6) y poco más. Casi todo lo PENDIENTE está bloqueado, y el bloqueo está escrito en el ticket o en su expediente.
3. **Una sola firma desbloquea tres tickets:** L1 frente a L1′ en la política de privacidad (1154, 1196 y 1247). `public/privacidad.html` nombra a Anthropic (:79) y no nombra ni a Google ni a Cloudflare.
4. **Hecho bajo OTRO número:** 1101 → 1097 · 1200 → 1216b (400/409) + 1200 (sin respuesta) · 1203 → 1216b. Hay además partes sueltas bajo otro número que **no** cierran su ticket: 18 (1107), 957 (922), 1053 (1269), 658 (290), 1196 (1234), 529 (1209).
5. **Defecto nuevo, MEDIDO (A7):** en el arreglo de 1093, `confirm-bizum` valida la fecha con la zona del merchant (`chargesAdmin.routes.ts:72-76`) y el webhook la vuelve a validar en UTC (`psp.routes.ts:111` → `resolverInstanteDeCobro`, sin zona). Con Madrid, el 31-mar a las 23:30Z y fecha «2026-04-01», el paso 1 acepta, el webhook devuelve `fecha_futura` 400 y el catch responde 500. Hay cuatro controles negativos y los cuatro salen limpios. Solo afecta a merchants con `timezone` ≠ UTC. La sonda llama a las funciones compiladas y no a la ruta HTTP. Ticket: lo abre el orquestador.
6. **SCRUM-1127 estaba HECHO**, y el GO del fundador para cablear el envío se había escrito ahí. Su título dice «SIN tocar el camino de emisión». El orquestador lo movió a SCRUM-1296 (fase 2).

## HECHO

| Ticket | Dónde está | Salvedad declarada / otro número |
| --- | --- | --- |
| 998 | `docs/master/SCRUM-998.md` §1-5 + 998b. Solo pedía el PASO 0; se re-midió `register.html` (nombre, email y país) | — |
| 1000 | Fuera del repo, en solo lectura: `yaqu-equipo/config.json` (prefijo `jv-`, orquestador y j1-j6) y `schtasks` `yaqu-equipo-jv-0825/1330/1835` | — |
| 1063 | `modelo303.ts:126,374` y `casillas.ts:64-79` (28/29, 45 y 46), test `scrum1063b` | Hecho bajo el sub-número 1063b. La 30/31 va siempre a 0 porque no hay dato de bien de inversión. La marca de borrador es cosa de pantalla (1064) |
| 1101 | `scripts/guard-acreditacion-invoicing-es.mjs` (:58, :66, :122-128, :171-197), test `scrum1097` | **Bajo SCRUM-1097.** El registro sale solo por stdout. La pasada `--prod-ro` sigue pendiente |
| 1105 | `scripts/_destino-de-semilla.mjs`, llamado por `seed-demo:128`, `seed-staging:26` y `seed-video:86`; test `scrum1105` | — |
| 1108 | `garantiasRetenidas.ts`, `customerDetailView.js:405,429-433`, tests `scrum1108` y `1108b` | La lista «quién me debe» no tiene pantalla (1043) |
| 1110 | `scripts/sobre-soap-prueba-aeat.mjs:83-88`. Respuesta de la AEAT «Correcto», CSV `A-KR84MFNPTPDHMN` (`SCRUM-1110.md:109-114`) | No cierra S1-D |
| 1113 | `censo-afirmaciones-de-skills.mjs` distingue la plataforma; `scrum939b:106,234` | — |
| 1116 | `weeklyDigest.service.ts:146-149,247-252`, test `scrum1116` | Con pendientes y retención a la vez, el bloque no nombra la retención |
| 1119 | `SCRUM-1119.md:44-52`, una fila por cada rojo | 815 y 824b quedan «sin determinar», declarado |
| 1120 | `tests/scrum804b…:70-89` (`negativoVivo`), con `t.skip` y motivo | — |
| 1126 | `customerDetailView.js:860,947,981`, test `scrum1126` (9 casos), PR #1988 | Sin comprobar a ojo. El singular «1 presupuestos» está sin firmar. El bug P2-CONT-1126b está en BUGS.md |
| 1127 | `sif.client.ts:46-69,121-126` y `sif.cola.ts:31,34,74,84`, tests `scrum1127-*`, DDL en §④ | La fase 2 (cableado) va en SCRUM-1296 |
| 1128 | `_guard-afirmacion-fiscal.mjs:359`, test `scrum1128` (rojo y control positivo) | — |
| 1130 | `public/index.html:567,797-819`, test `scrum1130` | Factura y pago de A22, no (1246) |
| 1194 | `SCRUM-1194.md` + `evidencias/SCRUM-1194/censo-vocabulario.mjs`. Contesta sus dos preguntas | Integrarlo en la sonda de 1185 es una propuesta para Luis (:108) |
| 1195 | `SCRUM-1195.md` §②: las 5 rutas, cada una con su ticket (1064, 1249, 1250, 1251) | `_sin-consumir-declarados.json:138,151,152` sigue citando 1185 |
| 1200 | `onboardingView.js:271-294`, `puertaSerie.js:85-93`, tests `scrum1216b-*` y `scrum1200-sin-respuesta` | **El 400/409 va bajo 1216b** (`SCRUM-1216.md:131`) |
| 1203 | `invoiceNumber.service.ts:285,393`, `schema.prisma:28-29` y la puerta de la serie F en `app.ts` | **Bajo 1216b** (opción B). `numerosDeLaSerie` sigue en la serie vieja a propósito |
| 1212 | `settingsView.js:670` «…desde WhatsApp.», guard AST `scrum1212c`, PR #1975 | — |
| 1214 | Medición + `_clasificador-sql.mjs:183-221` apretado (ef73238e, #1876) | El ticket decía «no pide apretar». Se apretó después con GO |
| 1232 | `libroRegistro.repo.ts:95,155-157`, `libroRegistroView.js:56`, test `scrum1232` | El paquete de evidencias e Informes leen sin filtro (§Ⓒ; = 1252) |
| 1235 | `cobros.service.ts:351`, `cobrosView.js:83-99`, test `scrum1235` (12 casos) | El fallo previo a Resend no deja fila (= 1243) |
| 1245 | `CLAUDE.md` y `docs/RUNBOOKS.md:689`, con el patrón entre comillas y su motivo, + guard 1245b | — |
| 1246 | `docs/YAQU_MASTER.md:438`, commit 66cb1e98 | — |
| 1249 | `facturasRecibidasView.js:144,186`, test `scrum1249` | Sin verificar en yaqu.app |
| 1253 | `SCRUM-1253.md:16-50`, «SE PUEDE QUITAR, CON CONDICIONES» | Ejecutarlo lo decide Javier |
| 1259 | El instrumento, aprobado el 28-sep | **Sigue abierto como sede de este barrido**, por decisión del orquestador |
| 1018 | `customerPortal.routes.ts:259-290,426-440,471` (franja de 1 h + técnico), PR #1728 | Foto descartada por el fundador |
| 1022 | `read-excel-file` (`package.json:196`, c.16597), `importarClientes.service.ts:33-37,86-100`, `csvImport.js:67,74`, tests `scrum1022-*` y `scrum1022c-*` | Pantalla en 1022c |
| 1023 | `docs/legal/PREGUNTAS_ASESOR_POR_ESPECIALISTA.md` + `SCRUM-1023.md` (mapa, gravedad, las que no necesitan asesor) | Es una foto del 23-sep; las respuestas posteriores la envejecen |
| 1104 | `PREGUNTAS_ASESOR.md:978` (Q-C8 respondida), `CONTABILIDAD.md:10-15,131`, commit 6efe2175 | Cotejar contra el BOE es CON-03 |

## PENDIENTE DE VERDAD

| Ticket | Lo que falta, y la prueba | Bloqueo |
| --- | --- | --- |
| 18 | La entidad `Certificacion` no existe (grep en el esquema = 0). Solo está la retención sobre Charge (1107) | post-SIF + asesor |
| 19 | SEPA: 0 en src, prisma y public | Connect + STOP de dinero |
| 20 | `'ANT'` no existe como tipo (`tipoDocumento.ts:47-52`). La recapitulativa sí se sella | FISCAL-1 / P16.2 |
| 142 | `nextAntInvoiceNumber` y `devengoAt` = 0 | dictamen P1 |
| 529 | `toPhone` = 0 en `schema.prisma`, y nada lo rellena. El ALTER está en dev (1209) y en staging | A5 ③ + producción |
| 658 | B2 («abonado» = 0) y B3. B1 ya existía (SCRUM-290) | decisión del fundador |
| 665 | `ensureInvoicePdf` regenera el PDF si falta el fichero (`src/lib/invoicing.ts:71-78`). El eje de datos sí está | asesor + elección entre A y D |
| 906 | Verifacturamos y la familia española, sin recorrer por dentro (§906k) | alta por el fundador |
| 957 | La fila de `trampas-del-entorno.md` («wmic» = 0). El aviso sí está (922) | S0 |
| 1005 | `Attachment` sigue siendo `quote_request\|job` y `photo\|audio` (`schema.prisma:1396-1399`); no hay pestaña | ALTER + RGPD + firma |
| 1028 | `ALCANCE_BETA.md:21-22`: «Cobro integrado», «Justificantes de cobro» | Javier (parado-hasta-go-live) |
| 1039 | Las órdenes de 130/111/115/347/390 están localizadas en 1039b pero no en `CONTABILIDAD.md:134` («Sin fuente descargada todavía»), y el comprobador no las cubre | J4 |
| 1043 | **La pantalla.** El servidor está (`customerAdmin.ts:84-128`); `conDeuda` y `saldoPendiente` = 0 en `public/` | firma de texto; **construible** |
| 1044 | Depende de 1145 (`/sites` = 0 en public) | 1145 |
| 1050 | E1 y N1 no existen | Javier: esperar a un caso real (`SCRUM-1050.md:68`) |
| 1051 | Solo está el motor de S2 (`causaLineaEmitible.ts`, test `scrum1051`). Faltan el NIF, la UI, la leyenda y el 303, y el asesor añadió 3 condiciones (:272) | P11 + firma + GO fiscal |
| 1052 | La regla del 40 % de materiales: 0 en src y public | asesor + GO fiscal |
| 1053 | `retencionIrpf.ts:6` dice «NO LO LLAMA NADIE». El perfil ya guarda la retención (1269) | Q-C5 + GO |
| 1054 | `suplidos.ts:44-49` y `recargoEquivalencia.ts` no están conectados a la emisión (`customerAdmin.ts:43`) | STOP emisión |
| 1055 | `criterioCaja.ts:33`: «E5, y no está construido». No tiene llamadores | Q-C6 |
| 1064 | Ninguna pantalla consume `/admin/modelo-303`. `reportsView.js:398` usa `/admin/reports/vat` | firma |
| 1065, 1067, 1076, 1077 | No hay módulo de 130, 347, 390 ni calendario (`src/modules/fiscal/` = evidencias, librosAeat, modelo303, verifactu) | Q-C8 / D2. Su premisa «sin orden» está caducada en parte (1039b) |
| 1066 | Medición y dato hechos (1103). El **borrador** no está (`SCRUM-1066.md:158`) | D2 + casillas + firma |
| 1073 | Ni `Customer` ni `Invoice` tienen campo de retención | Q-C5 + ALTER + 1053 |
| 1092 | `sesion.mjs:143` lanza sin worktree y sin comprobar el cwd. La medición y la recomendación («EXIGIR») sí están | los dos equipos |
| 1093 | `/bulk-paid` (`invoicesAdmin.routes.ts:450`) sin zona. Y el defecto nuevo medido (arriba, ⑤) | — |
| 1102 | REDEME/SII = 0 en src y public; no hay campo de régimen | firma §⑤ + ALTER |
| 1129 | `registro.builder.ts:55,313,328`: `ClaveRegimen` fija a `'01'` | ALTER + regla 40 |
| 1142 | `invoiceDetailView.js:643,708,834` sin `accion-irreversible-btn-44` | **construible** (AB6) |
| 1145 | El servidor está (`customersAdmin.routes.ts:428-477`, SCRUM-1014); ninguna pantalla lo consume | firma |
| 1149 | Las 2 excepciones siguen en `guard-objetivo-tactil.mjs:655-657`; sin regla de 44 | decisión sobre `.btn-sm` |
| 1154 | `privacidad.html`: «Google\|Gemini» = 0 | L1 frente a L1′ |
| 1196 | Cloudflare = 0 en `privacidad.html`. Google Fonts sí está resuelto (1234) | L1 frente a L1′ |
| 1218 | Declaración reescrita y disparo cumplido. Los 42 tests **no** se han migrado | — |
| 1238 | `scripts/equipo/sesion.mjs:691`: `firstTerminalAt` sigue contando como muerte | S5 / STOP de sesion.mjs |
| 1240 | El builder no lee el criterio de caja; el PDF no lleva la mención del ROF 6.1.p | reglas 40 y 39 |
| 1242 | «BOE» y «consolidad» = 0 en `00-normas-comunes.md` | S0 |
| 1243 | `email.service.ts:32,35,41` lanzan antes de Resend sin `registrarEnvio` | GO |
| 1247 | R1 y R2 hechos. La política a la que remiten nombra al encargado equivocado (`privacidad.html:79`) | L1 frente a L1′ |
| 1250 | `invoicesAdmin.routes.ts:569,590` siguen montadas | aplazado a propósito |
| 1251 | `evidencias.zip` (`app.ts:602`) no tiene consumidor | decisión de pantalla + 1252 |
| 1252 | `paquete.repo.ts:42`, `reports.routes.ts:278,372` e `invoiceAdmin.ts:40` siguen sin filtrar | decisión sobre los 5 documentos |
| 1257 | C3: `settingsView.js:44` «…ni justificantes…». A, B, C1 y C2 están hechos | 825 |
| 1258 | `registro.builder.ts:273-290` sigue dando F2. Hoy lo tapa `SIN_DICTAMEN` (:228) | regla 27 |
| 1260 | `invoicing.service.ts:115`, más **5 escritores que el ticket no nombra** (`lib/invoicing.ts:395`, `jobs.routes.ts:1507`, `quotes.routes.ts:641`, `quotesAdmin.routes.ts:317,594`) | GO |
| 1262 | `isWaOptedOut` solo en `whatsapp.ts:269,413`; los otros 6 envíos no la consultan | — |
| 523 | Pantalla de la declaración responsable: no existe. `DECLARACION_RESPONSABLE.md:3-5` sigue siendo una PLANTILLA | NIF de la SL + emisión |
| 524 | Tabla + `scripts/tabla-verifactu.mjs` + trinquete `scrum524b` hechos. «Aceptado con errores» decidido (`sif.cola.ts:18,129-130`). Las **25 no comprobadas** siguen sin capa asignada | — |
| 534 | Las partes 1-3 están hechas (`YAQU_MASTER.md:215,404`, c38b7b09). **Parte 4**, las 16 de clase C: `INVENTARIO_AFIRMACIONES_VERIFACTU.md:260` sin tocar desde el 19-ago | P14 (`DECLARACION_RESPONSABLE.md:43`) |
| 612 | La enmienda está aplicada (`YAQU_MASTER.md:246,464,476`). Siguen abiertas E-3, E-4 y E-6, la regla 26b («gancho… MOROSIDAD/el cobro») y N3/M (:416) | 523, 1016 y firma |
| 825 | `'JUST'` sigue siendo tipo vivo (`tipoDocumento.ts:52`), con escritores (ver 1260). D3 y D5 sin firmar. **Rama viva** `scrum-825-guards-ciegos-a-factura` (3 commits: reapunta 915g/915i/965/pasos-del-editor, pasa a SCRUM-1290), que NO está en main por otro camino | firma D3/D5 |
| 870 | El marcador ya no está (`productor.ts:39,42`, 870b), pero el **candado** `productorLegible` = 0 | NIF y razón social de la SL |
| 1016 | Propuestas en main. La landing sigue diciendo «Del presupuesto al cobro» (`index.html:6,426`) y «te paga — con tarjeta, Bizum…» (:427). **Rama viva** `scrum-1016e-titular-aplicado` (3 commits, titular firmado), NO está en main | STOP regla 26 / 537 |
| 1103 | El dato está en el esquema (`schema.prisma:1000-1002`) y en el dominio. **No lo puede capturar nadie**: `expenses.routes.ts` = 0 `retencionPracticada`, y no hay pantalla. La etiqueta `esperando-alter` está caducada | — |
| 1106 | Volcado y revisión de alcance hechos. Falta la decisión del fundador sobre 1053 (`CONTABILIDAD.md:128`) | fundador (puede estar en Jira) |

## NO SÉ

| Ticket | Motivo |
| --- | --- |
| 143 | La SL, el certificado y el Convenio 017 son acciones humanas fuera del repo. Pista en contra: el 017 se vuelve a preguntar al asesor el 28-sep (`ENVIO_ASESOR_2026-09-28.md:59`) |
| 1058 | La nota de diseño existe (opción A), pero el criterio 1 pide que **J1 responda**, y esa respuesta no está en el repo. Puede estar en un comentario de Jira que la foto no trae |
| 1115 | El repo solo tiene el valor por defecto (`env.ts:68`). El `EMAIL_FROM` real está en Railway |
| 1159 | El ticket no dice qué pantalla. Si son los filtros de Cobros, ya tienen 44 px (`cobrosView.js:514`), y el banco (`_pagina-panel.mjs:34`, que solo lee `cssText` y `display`) podría no verlo: posible defecto del banco, sin medir. Si son los botones de Bizum de la factura, falta, y es STOP de cobro |
| 1244 | La medición y el arreglo de 1093h están, pero el propio veredicto es «no demostrado que baste» (`SCRUM-1244.md:89`), y el requisito 3 no se construyó. Hoy la tanda cabe |
| 1248 | Es una declaración. Seguirla o no depende de que se repita en CI, y eso está fuera del repo |
| 1264 | El entregable es la descripción de Jira más el envío que hace Javier |
| 657 | La pregunta 3 está medida (Facturae/DIR3 = 0). Las preguntas 1-2 las contesta una persona con datos de producción, y después decide el fundador |
| 1109 | El script y el test existen, y la tarea corre en Railway (1112/1114). Pero la aceptación es que **avise**: falta `RESEND_API_KEY` en el cron y que llegue un correo (`SCRUM-1114.md:108-115`), y eso no se ve desde el repo |
