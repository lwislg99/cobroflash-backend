# SCRUM-1686 · PILOTO-1 · FLUJO trabajo→parte→albarán: lo que el código hace frente a lo que las pantallas cuentan

**Medido contra:** `origin/main` = `8a1acbac51e9bc574c94fdb64128378b75d613c8` · 2026-11-11T10:11:58Z (cabecera `Date:` de GitHub)

A9: sin fallo que generalice — el albarán #52 `AB260007`, emitido con 0 líneas, lo emitió MI banco de ayer (SCRUM-1658), y es uno de los cinco vacíos que se cuentan en ① b. Se dice aquí para que nadie lo lea como uso real; el defecto de fondo (el servidor deja emitir y firmar sin líneas) es el mismo con o sin él.

S4 · rama `scrum-1686-flujo-trabajo-parte-albaran` · sólo docs y banco de medida (GET y pulsar filas; nada escrito en producción para la ①).

Etiquetas `piloto-1` · `equipo-luis` · `area-s4`. Benchmark (entrega ②): comentario 21407 del ticket, del orquestador.

**Skill UI:** no cargada · esta entrega no toca `public/`: mide y propone.

## ① El flujo REAL (máster Parte L + código) frente a lo que cuentan las pantallas

### Los estados de verdad

| entidad | estados (Parte L, `docs/YAQU_MASTER.md:403-416`) | en el código |
|---|---|---|
| Trabajo (`Job`) | `pendiente_agendar → agendado → en_curso → terminado → cerrado` | nace al aceptar un presupuesto, o a mano |
| Parte (`ParteTrabajo`) | `borrador \| firmado` (SIN `facturado`: el código lo declara y nadie lo escribe) | `parteTrabajo.ts:78` declara los tres; pasa a `firmado` con la PRIMERA firma (`partes.routes.ts:714,802`) |
| Albarán (`Albaran`) | `borrador → emitido → firmado` (firmado = terminal) | + un eje DERIVADO de cobro `sin_facturar \| parcial \| facturado` (no es estado) |

### Qué se convierte en qué — la respuesta a la confusión ① del fundador

**Un parte no se convierte en NADA.** Medido: ninguna línea de `src/` lee un `ParteTrabajo` para crear un albarán, un presupuesto o una factura. Sus únicos lectores son sus propias rutas (`partes.routes.ts`), el historial del cliente (`historialDelCliente.ts:61`) y la fusión de clientes (`fusionClientes.ts:182`). Su vida entera:

    trabajo ─(botón «Parte de trabajo»)→ parte borrador ─(firma técnico o cliente)→ parte firmado
            → aparece en «Partes por valorar» (sólo si tiene alguna línea sin precio)
            → la oficina le pone precios → desaparece de esa lista … y ahí acaba.

El albarán es OTRO documento, con OTRA tabla, que nace del TRABAJO (prellenado del presupuesto, `jobDetailView.js:1544-1548`), no del parte. Y es el albarán, no el parte, el que podría acabar en factura (recapitulativa, cerrada para el piloto por la regla 24).

**Y la palabra «parte» nombra a los DOS documentos.** El código lo confiesa en `jobDetailView.js:1557-1559` y `:1569-1571` («la palabra "parte" ahí es herencia de cuando el albarán era lo único que había»). Lo que ve el usuario:

| dónde | qué dice | de qué documento habla de verdad |
|---|---|---|
| hoja de alta del albarán, `jobDetailView.js:2673` y `:2677` | «Incluir precios en el parte» · «El parte sigue sin ser una factura.» | del ALBARÁN |
| mismo sitio, `jobDetailView.js:1668` | «El parte sigue sin ser una factura.» | del ALBARÁN |
| consolidar, `jobDetailView.js:1711`, `:1747-1750` | «parte seleccionado», «partes de N meses» | de ALBARANES |
| servidor, `albaran.service.ts:245,249` · `jobs.routes.ts:1681,1747` | «El parte ALB… no está firmado», «Alguno de los partes…» | de ALBARANES |
| botón de la barra del trabajo, `jobDetailView.js:1587` | «Parte de trabajo» | del PARTE |
| lista «Partes por valorar», `parteOficinaView.js:36` | «Partes por valorar» | del PARTE |

### ¿Cuántos partes por trabajo? — la confusión ③, medida

- **El servidor admite N.** `POST /admin/partes` (`partes.routes.ts:361-451`) no cuenta los partes del trabajo, y el esquema no tiene `@@unique` sobre `jobId` (`prisma/schema.prisma:1715-1717`).
- **La pantalla sólo deja llegar a UNO.** El botón «Parte de trabajo» abre el MÁS RECIENTE del trabajo y sólo crea si no hay ninguno (`jobDetailView.js:1577-1597`; el motivo, escrito ahí: evitar «seis partes vacíos» por entrar a mirar).
- **Y el detalle del trabajo no lista sus partes**: `GET /admin/jobs/:id` no trae `ParteTrabajo` (sólo albaranes y facturas). Con más de uno, los anteriores quedan INALCANZABLES desde el trabajo.
- **Ya pasa en la cuenta QA:** el trabajo #76 tiene `PT-2026-002` (firmado) y `PT-2026-001` (borrador, 1 línea). El botón abre el 002; al 001 no se llega desde el trabajo. Censo (GET, 11-nov): 5 partes · 3 firmados, 2 borradores · 4 trabajos con parte · 1 trabajo con dos.
- Respuesta corta: **en la base, varios; en pantalla, uno, y sin decirlo.** Lo que la competencia hace (P4 del benchmark: sub-entidad numerada por visita) choca justo con eso.

### Las cinco anomalías de las capturas del fundador

| | anomalía | veredicto | dónde |
|---|---|---|---|
| a | «Partes por valorar» pinta `PT-2026-004` dos veces, una como fila rota «— · 4 o» | **CONFIRMADA y explicada.** No es un duplicado: arriba la FILA de la lista, abajo el parte ABIERTO, sin nada que los una (la fila no se marca como elegida). La fila dice «—» porque la lista del servidor no resuelve el cliente: `/oficina/pendientes` (`partes.routes.ts:326-331`) serializa las filas tal cual y sólo `findParte` añade `clienteNombre` (`:101`); el detalle sí lo trae («Cliente de pruebas QA»). «4 ⚬» es el número de líneas con un glifo sin palabra (`parteOficinaView.js:89`). Y el detalle abierto no rotula sus columnas (cantidad · casilla de precio · importe). | pantalla: `docs/master/evidencias/SCRUM-1686/capturas/a-oficina-abierto-390.png` |
| b | albaranes FIRMADOS y EMITIDOS con 0 líneas y «Sin precios» | **CONFIRMADA.** `POST /admin/albaranes/:id/emitir` (`albaranes.routes.ts:958-1000`) y `/:id/firmar` (`:1046`) no exigen ninguna línea; el parte sí (`parte_vacio`, `partes.routes.ts:676,760`, regla en `parteTrabajo.ts:437-445`). En la cuenta QA, **5 de los 6** albaranes no borrador tienen 0 líneas; dos están FIRMADOS (#47 `AB260002`, #49 `AB260004`). Casi todos los han hecho bancos de prueba (uno, el #52, el mío: ver A9), pero el servidor lo deja hacer a cualquiera. «Sin precios» = `modoValoracion: SIN_VALORAR`. | censo GET `/admin/albaranes` + `/admin/albaranes/:id` |
| c | un trabajo llamado «Presupuesto #5 · Cliente…» | **CONFIRMADA y NO es herencia.** El trabajo #77 nació el 14-oct (después de SCRUM-317) y **no tiene título propio** (`tituloPropio` vacío). El nombre lo FABRICA el servidor al servirlo: `tituloDeTrabajo` (`trabajoDirecto.ts:170-176`) cae a «Presupuesto #N · cliente» cuando el trabajo tiene presupuesto, y así lo sirve el detalle (`jobs.routes.ts:504`). SCRUM-317 quiso lo contrario («mientras no lo ponga, la pantalla se titula con el CLIENTE», `job.service.ts:94-96`), y la lista sí lo cumple (usa `tituloPropio`). **Todo trabajo del piloto nacido de un presupuesto aceptado se titula así en su detalle.** | GET `/admin/jobs/77` |
| d | en el parte, «DATOS DEL PARTE» DEBAJO de las firmas | **CONFIRMADA, y es a propósito para el borrador.** `parteDetailView.js:755-756`: firmas y después los datos plegados (SCRUM-1175 PR-C: obra, técnicos, tipo y notas se fueron al final para que el trabajo fuera lo primero). En un parte FIRMADO deja datos del documento DESPUÉS de las firmas que lo cierran. | `docs/master/evidencias/SCRUM-1658/capturas/22-parte-firmado-1280.txt:31-45` |
| e | horas/desplazamiento todo «—» sin invitación a rellenar | **CONFIRMADA, por dos lados.** Firmar sólo exige alguna línea (`puedeFirmarse`, `parteTrabajo.ts:437-445`): un parte se firma sin horas ni desplazamiento. Y una vez firmado, el campo vacío se pinta «—», que no distingue «no se apuntó» de «cero» (`pintarHoras`, `parteDetailView.js:636-654`). En borrador sí hay casillas y el botón «Ahora». | código; pantalla de la ①bis |

### ② «El trabajo enseña todo junto y revuelto» — lo que hay en su detalle

El detalle del trabajo #79, a 390, JUSTO DESPUÉS de firmar su parte `PT-2026-005` (texto de la pantalla, `docs/master/evidencias/SCRUM-1658/capturas/14-trabajo-con-parte-390.txt`), de arriba abajo:

    Marta Prieto (PILOTO-1 QA) · 10 nov · AGENDADO · ▶ Empezar
    LO QUE FALTA — Este trabajo no tiene presupuesto aceptado … [Hacer presupuesto]
    ALBARANES — [+ Nuevo albarán] [Parte de trabajo]
                El parte sigue sin ser una factura.            ← habla del ALBARÁN
                Aún no hay documentos. Crea un albarán por cada visita o entrega.   ← con un parte FIRMADO
    EL TRABAJO — tipo · nombre y dirección · quién lo ejecuta · notas · gastos
    CLIENTE · DÓNDE · RESPONSABLE

El parte NO tiene sección: es un botón dentro de la barra de los ALBARANES (`jobDetailView.js:1584-1605`), gemelo de «+ Nuevo albarán» (misma clase `btn-secondary btn-sm`). Dos documentos que se llaman igual, dos botones iguales en la misma fila, una frase sobre «el parte» que habla del otro, y un parte firmado que no deja rastro: la sección dice «Aún no hay documentos».

## Carril de cada hallazgo (contrastado con `docs/equipo/dos-equipos.md` §3 y `.claude/rules/carril-*.md`)

| hallazgo | fichero | carril |
|---|---|---|
| botón de parte, hoja de alta del albarán, secciones del trabajo | `public/dashboard/js/jobDetailView.js` | S2 |
| fila de «Partes por valorar» | `public/dashboard/js/parteOficinaView.js` | S2 (no está en la lista de S4) |
| orden firmas/datos, «—» del parte firmado | `public/dashboard/js/parteDetailView.js` | S4 |
| cliente en la lista de la oficina, lista de partes del trabajo | `src/modules/jobs/app/routes/partes.routes.ts` | S1 |
| emitir/firmar albarán sin líneas | `src/modules/jobs/app/routes/albaranes.routes.ts` | S1 |
| título fabricado «Presupuesto #N» | `src/modules/jobs/domain/trabajoDirecto.ts` | S1 |
| mensajes de servidor que llaman «parte» al albarán | `albaran.service.ts`, `jobs.routes.ts` | S1 (texto: firma, regla 39) |
