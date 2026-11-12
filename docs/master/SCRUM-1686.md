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

---

## SCRUM-1686b · ③ La propuesta «fácil de usar», pantalla a pantalla

**Medido contra:** `origin/main` = `8a1acbac51e9bc574c94fdb64128378b75d613c8` · 11-nov-2026 ~11:00Z · S4 (relevo). Fuentes: la ① de arriba (Jira c.21447), el benchmark (c.21407, patrones P1-P4), las capturas en texto de SCRUM-1658 (`evidencias/SCRUM-1658/capturas/01, 14, 17, 22, 24`), la firma de textos (SCRUM-1656 c.21408, alcance c.21411) y el plan de la semana de S0 (SCRUM-1656 c.21431 + c.21439). Carriles con `node scripts/carriles.mjs de <ruta>` (el FICHERO, no la memoria).

**Skill UI:** no cargada. Esta entrega no toca `public/`: propone. Quien construya una pieza carga `yaqu-premium-ui` antes.

**Lo que esta semana permite (S0, c.21431 §6):** sólo se construye lo que YA tiene ticket. Lo marcado **NUEVO** va a la lectura del fundador y entra después, salvo las cuatro piezas X1-X4 (sin texto nuevo, menos de una hora cada una) que el orquestador puede subir si quiere.

**Hueco declarado:** la vista del OPERARIO (①bis) está sin medir. El operario de prueba existe desde las 10:19Z (miembro 30, invitado); falta el enlace del correo. Donde la propuesta depende de lo que él ve, pone **[①bis]**.

### La decisión que ordena todo — D1, para el fundador

Hoy hay dos documentos que se firman en la obra, con el mismo nombre en pantalla: el **parte** (lo que se ha hecho, sin precios) y el **albarán** (la entrega, con o sin precios). El parte no se convierte en nada (①). Esa es la raíz de las confusiones ① y ② del fundador.

| | A · **en la obra, UN documento: el parte** (recomendada) | B · los dos al mismo nivel (lo de hoy) |
|---|---|---|
| qué hace el operario | abre el parte, apunta, firma él y el cliente. Nada más. | elige entre «Parte de trabajo» y «+ Nuevo albarán» |
| el albarán | lo hace la oficina DESDE el parte, cuando el cliente lo pida (copia sus líneas) | se hace aparte, desde el presupuesto |
| quién lo hace así | Tradify (Job Sheet sin precios, firmable en obra) + ServiceM8 (asistente de cierre, P2) | nadie de los cinco tiene dos documentos firmables en obra |
| cambio de estados | ninguno | ninguno |
| lo que pide | enlace parte→albarán (M1) o, como mínimo, la copia de líneas sin rastro | el texto 3, ya firmado, y nada más |

Con A, la frase firmada nº 3 («Parte: lo que se ha hecho, para tu oficina. Albarán: lo que firma el cliente al entregar.») sigue valiendo tal cual.

**D2 · ¿un parte por visita?** La base ya admite varios por trabajo; la pantalla sólo llega a uno y no lo dice. Propuesta: «+ Nuevo parte» crea uno nuevo; si ya hay un borrador de HOY, abre ese (así se evita lo que el código quería evitar: «seis partes vacíos» por entrar a mirar). Es el patrón P4 (Housecall Pro: #105-1, #105-2).

**D3 · el menú del piloto.** Para PILOTO-1 están cerradas por la regla 24 Facturas, Cobros, Libro de registro y Facturas recibidas, y el menú las enseña (18 entradas; `17-lista-menu-390.txt`). ¿Se ocultan para un merchant con `INVOICING_ES_ENABLED` en OFF? Es una pregunta, no una propuesta de texto. **[①bis]** además: leído en código, el front NO filtra el menú por rol (0 coincidencias de `role`/`tecnico` en `app.js` e `index.html`); hipótesis a medir: el operario ve las 18 y choca con un 403 en las de la oficina.

> **CORRECCIÓN (S2, 11-nov-2026, al construir D3 en SCRUM-1701 c.21511):** «el front NO filtra el menú por rol» es **falso**. `aplicarRolALaBarra` (SCRUM-1338; `public/dashboard/js/app.js:1180`, llamada en `app.js:162` con `window.appUserRole`) oculta al operario las 10 entradas `data-rol="admin"` de `index.html`, Cobros, Libro y Recibidas entre ellas; la búsqueda de arriba no la vio porque buscaba `role` y el código dice `Rol`/`appUserRole`/`data-rol`. Lo que la ①bis tiene que medir es lo que queda a la vista del operario, no si hay filtro.

### Orden: cuántas veces al día lo pisa un oficio

| # | pantalla | quién | veces al día | fichero → carril |
|---|---|---|---|---|
| 1 | Lista de Trabajos `#jobs` | operario y jefe | 5-10 | `jobsView.js` → **S4** |
| 2 | Parte `#parte-detail` | operario | 1-3 por trabajo | `parteDetailView.js` → **S4** |
| 3 | Ficha del trabajo `#jobs-detail` | los dos | 3-6 | `jobDetailView.js` → **S2** · `jobs.routes.ts`, `trabajoDirecto.ts` → **S1** |
| 4 | Partes por valorar `#partes-oficina` | jefe | 1 (fin de jornada) | `parteOficinaView.js` → **S2** · `partes.routes.ts` → **S1** |
| 5 | Nuevo albarán (hoja) y ficha del albarán | jefe | unas por semana | `jobDetailView.js` → **S2** · `albaranDetailView.js` → **S4** · `albaranes.routes.ts` → **S1** |
| 6 | Menú | todos | cada entrada | `app.js` → **S2** (contenedor) |

### Pantalla 1 · Lista de Trabajos (S4)

Hoy (`01-trabajos-lista-390.txt`): la tarjeta dice el CLIENTE y «no hay presupuesto aceptado», no qué trabajo es; «Partes por valorar» es un botón gemelo de «Nuevo trabajo» en la cabecera; filtros de COBRO (Pendiente/Parcial/Pagado).

Qué cambia:
- La tarjeta dice qué trabajo es → **SCRUM-1679** (ya existe, S4).
- Un trabajo EN CURSO lleva como acción primaria ir a su parte: «Abrir parte» (N1). Patrón P2: el operario no elige documento. **NUEVO**, depende de D1.
- «Partes por valorar» sale de la cabecera de la lista (es la cola de la OFICINA, P1) y se queda en el menú con su número: «Partes por valorar · 2» (N2). **NUEVO.**
- **[①bis]** qué de esto ve el operario: el «Por cobrar», los filtros de cobro y el botón de la oficina no deberían salirle.

```
TRABAJOS                                   [+ Nuevo trabajo]
PARA HOY · 1
┌──────────────────────────────────────────────┐
│ Cambio de latiguillos — Marta Prieto          │  ← qué + quién (1679)
│ Calle Mayor 14 · jue 12 nov, 09:00 · EN CURSO │
│ [ Abrir parte ]                     [ ⋯ ]     │  ← N1
└──────────────────────────────────────────────┘
```

### Pantalla 2 · Parte (S4)

Ya en ticket: 1674 (nace vacío, S1) · 1676 y 1677 (PR #3050 y #3049, obligatorio en cola) · 1683 (textos 8-13 y 16) · 1682 (dictado, S1) · 1675 ✅.

Qué cambia además:
- **X4 · parte FIRMADO en el orden de un papel** (anomalía d): cabecera «← Trabajo: {cliente}» (firmado nº 5) → DATOS DEL PARTE (obra, tipo, operarios) → horas → líneas → firmas AL FINAL. El borrador NO cambia (decisión de SCRUM-1175: allí manda lo que se apunta). Sin texto nuevo. `parteDetailView.js:755-756`. S4.
- Campo vacío de un parte firmado: «—» → «Sin apuntar» (N3), que distingue «no se apuntó» de «cero» (anomalía e). `parteDetailView.js:636-654`. **NUEVO.**
- Con D2: «PT-2026-005 · Visita 2 de 3» en la cabecera (N4). **NUEVO.**
- Con D1=A, tras firmar, el siguiente paso (P2): «Volver al trabajo» (firmado nº 6) y, para la oficina, «Hacer albarán con este parte» (N5). **NUEVO.**

```
← Trabajo: Marta Prieto                      PT-2026-005 · Visita 2 de 3 (N4)
DATOS DEL PARTE  Calle Mayor 14 · Reparación · Operario: Jorge
HORAS            09:10 → 11:40 · 2 h 30 min · Desplazamiento (min): Sin apuntar (N3)
MANO DE OBRA     Horas | Descripción …           MATERIALES …
FIRMAS           Firmado por Marta Prieto el 10/11/2026 a las 11:42 (nº 8)
[ Volver al trabajo ] (nº 6)        [ Hacer albarán con este parte ] (N5, sólo oficina)
```

### Pantalla 3 · Ficha del trabajo (S2 + S1)

Hoy (`14-trabajo-con-parte-390.txt`): el parte no tiene sección, es un botón dentro de ALBARANES; con un parte firmado, «Aún no hay documentos»; «El parte sigue sin ser una factura.» habla del albarán; título «Presupuesto #N · cliente» fabricado.

Ya en ticket: **1671** (S1: el detalle trae los partes — sin esto nada de lo de abajo se puede pintar) · **1680** (S2: texto 3, cerrar desde la ficha) · **1662** (S1: «qué hay que hacer» visible) · 1670 (S1, tipo) · 1672 ✅.

Qué cambia: las secciones, en el orden en que se usan.

```
Marta Prieto · Cita: jue 12 nov, 09:00 (nº 1)        AGENDADO  [▶ Empezar]
QUÉ HAY QUE HACER                                      ← 1662
  Fuga en el baño: cambiar latiguillos y llave de escuadra
PARTES (N6)                                          [+ Nuevo parte] (N9)
  PT-2026-005 · Firmado · 10 nov · 2 h 30 min    ›
  PT-2026-001 · Borrador · 9 nov                 ›   ← hoy, inalcanzable
ALBARANES                                            [+ Nuevo albarán]
  Parte: lo que se ha hecho, para tu oficina. Albarán: lo que firma el cliente al entregar. (nº 3)
  Aún no hay albaranes. (N7)
EL TRABAJO · CLIENTE · DÓNDE · OPERARIO (nº 16)
```

- **X1 · título:** el servidor deja de fabricar «Presupuesto #N · cliente» y cae al CLIENTE, que es lo que SCRUM-317 pidió (`job.service.ts:94-96`) y lo que ya hace la lista. Sin texto nuevo: quita uno. `trabajoDirecto.ts:170-176`, `jobs.routes.ts:504`. S1.
- La sección PARTES (N6) con la lista de partes y «+ Nuevo parte» (N9) según D2. **NUEVO**, S2, después de 1671.
- «El parte sigue sin ser una factura.» (`jobDetailView.js:1668`) **se quita** (N8: quitar también es texto, va a firma). Con el nº 3 ya debajo de los botones sobra.
- **[①bis]** qué ve el operario aquí: «LO QUE FALTA … Hacer presupuesto», importes, notas internas.

### Pantalla 4 · Partes por valorar (S2 + S1)

Hoy (anomalía a, `a-oficina-abierto-390.png`): la fila dice «—» por cliente y «4 ⚬»; la fila elegida no se marca y parece un duplicado; el detalle no rotula sus columnas; tras poner precios, el parte sale de la lista y no va a ninguna parte.

- **X2 · cliente en la fila:** `/oficina/pendientes` resuelve `clienteNombre` como ya hace `findParte` (`partes.routes.ts:101` frente a `:326-331`). Sin texto. S1.
- **X3 · fila elegida marcada** (`aria-current` + el estilo de selección que ya exista en DESIGN.md). Sin texto. `parteOficinaView.js:74-92`. S2.
- «4 ⚬» → «4 líneas» / «1 línea» (N10). **NUEVO.**
- Columnas del detalle: «Cant. · Precio ud. · Importe», el mismo criterio de las firmadas nº 18-19 (N11: extender su alcance a esta pantalla, sin texto nuevo). **NUEVO.**
- Tras valorar, con D1=A: «Hacer albarán con este parte» (N5), que ya lleva los precios (P3: lo valorado pasa al documento, no se pierde). **NUEVO**, pide M1.

### Pantalla 5 · Nuevo albarán y ficha del albarán (S2 + S4 + S1)

Ya en ticket: **1673** (S1, emitir sin líneas) · **1661** (S4, ficha valorada sin líneas ni total) · 1663 · 1665 (S4) · 1669 (S1, lista) · 1666-1668 (S1, página pública).

- La hoja de alta llama «parte» al albarán: «Incluir precios en el parte» (`jobDetailView.js:2673`) → «Incluir precios en el albarán» (N12) · «El parte sigue sin ser una factura.» (`:2677`) → se quita (N8). **NUEVO**, S2.
- Con D1=A: la hoja ofrece rellenar «Desde el parte PT-…» además de «desde el presupuesto» (N13). **NUEVO.**
- Los mensajes de CONSOLIDAR que llaman «parte» al albarán (`albaran.service.ts:245,249`, `jobs.routes.ts:1681,1747`, `jobDetailView.js:1711,1747-1750`) son de la FACTURA recapitulativa: el piloto no los ve (regla 24). Fuera de esta propuesta; se arreglan con SIF-1.

### Pantalla 6 · Menú (S2 contenedor)

Sólo D3 y **[①bis]**. Nada que construir antes de medir.

### Lo que pide cambio de máster (regla 5: se propone, NO se construye)

| | propuesta | por qué no es un estado nuevo |
|---|---|---|
| M1 | Enlace parte→albarán: campo opcional `Albaran.parteId` (ALTER aditivo, regla 40) y, en la Parte L junto al parte, un vocabulario DERIVADO `sin_albaran \| en_albaran` calculado del enlace | igual que el «estado de cobro» del albarán (SCRUM-170): dos ejes; el parte sigue `borrador \| firmado` y sólo eso. Se RECHAZA añadir `valorado` o `convertido` a la FSM |
| M2 | Escribir en el máster la cardinalidad «un trabajo, varios partes: uno por visita» | el código ya la admite (`partes.routes.ts:361-451`, sin `@@unique`); hoy el máster no dice nada y la pantalla dice «uno» |

### Orden de construcción mié-jue (sobre el plan de S0, c.21431 + c.21439)

| día | S1 | S2 | S4 |
|---|---|---|---|
| mié 11 | 1685 (alta) → **1671** (partes en la ficha: confusiones ② y ③) | 1680 (en curso) | #3049/#3050 al verde y vistos en yaqu.app · 1661 |
| jue 12 | 1674 → 1662 → 1673 → 1670 · *X1, X2 si el orquestador los sube* | 1681 · *X3* | 1683 → 1679 · *X4* |
| después de la lectura | M1, M2 · lo de D1 | sección PARTES (D2) · hoja del albarán (N8, N12) · D3 | N1-N5 |

### Tickets que propongo (NO abiertos: se abren tras la lectura del fundador)

| | qué | carril | depende de | texto |
|---|---|---|---|---|
| X1 | La ficha del trabajo deja de titularse «Presupuesto #N · cliente» | S1 | — | ninguno |
| X2 | «Partes por valorar»: la fila trae el cliente | S1 | — | ninguno |
| X3 | «Partes por valorar»: la fila abierta se marca | S2 | — | ninguno |
| X4 | Parte firmado en el orden de un papel (datos arriba, firmas al final) | S4 | — | ninguno |
| T1 | Ficha del trabajo: sección PARTES con todos sus partes y «+ Nuevo parte» | S2 | 1671, D2 | N6, N7, N9 |
| T2 | «Hacer albarán con este parte» (desde el parte y desde Partes por valorar) | S2 + S1 | D1, M1 | N5, N13 |
| T3 | La hoja de alta del albarán deja de llamarlo «parte» | S2 | — | N8, N12 |
| T4 | Parte: «Visita n de m» | S4 | D2 | N4 |
| T5 | Parte firmado: «Sin apuntar» en lo vacío | S4 | — | N3 |
| T6 | Partes por valorar: «n líneas» y columnas rotuladas | S2 | — | N10, N11 |
| T7 | Lista de trabajos: «Abrir parte» y la cola de la oficina fuera de la cabecera | S4 | D1 | N1, N2 |
| T8 | Menú del piloto | S2 | D3, ①bis | por decidir |

### LISTA ÚNICA DE TEXTOS PARA FIRMA (regla 39) — nada aplicado

| Nº | dónde y cuándo se ve | literal propuesto | porqué |
|---|---|---|---|
| N1 | Tarjeta de un trabajo EN CURSO, lista de Trabajos | «Abrir parte» | el operario va a su parte sin elegir documento (P2) |
| N2 | Entrada del menú de la oficina | «Partes por valorar · {n}» | la cola de la oficina dice cuánto espera (P1) |
| N3 | Parte firmado, campo de horas o desplazamiento vacío | «Sin apuntar» | «—» no distingue «no se apuntó» de «cero» |
| N4 | Cabecera del parte, con varios en el trabajo | «Visita {n} de {m}» | cuenta qué parte es de cuántos (P4) |
| N5 | Parte firmado (oficina) y Partes por valorar | «Hacer albarán con este parte» | el parte por fin lleva a algún sitio (D1=A) |
| N6 | Ficha del trabajo, rótulo de sección | «Partes» | hoy el parte no tiene sección |
| N7 | Ficha del trabajo, vacíos de sección | «Aún no hay partes.» · «Aún no hay albaranes.» (sustituye a «Aún no hay documentos. Crea un albarán por cada visita o entrega.») | el vacío de hoy sale con un parte firmado |
| N8 | Ficha del trabajo y hoja de alta del albarán | QUITAR «El parte sigue sin ser una factura.» (`jobDetailView.js:1668`, `:2677`) | habla del albarán con el nombre del otro documento; el nº 3 ya lo explica |
| N9 | Ficha del trabajo, botón de la sección Partes | «+ Nuevo parte» (sustituye a «Parte de trabajo») | el botón crea; con borrador de hoy, abre ese (D2) |
| N10 | Fila de Partes por valorar | «{n} líneas» · «1 línea» (sustituye a «{n} ⚬») | un glifo sin palabra |
| N11 | Detalle de Partes por valorar, cabeceras | «Cant. · Precio ud. · Importe» (EXTENDER el alcance de las firmadas nº 18-19; sin literal nuevo) | las columnas no tienen rótulo |
| N12 | Hoja de alta del albarán, casilla | «Incluir precios en el albarán» (sustituye a «Incluir precios en el parte») | nombra al documento que es |
| N13 | Hoja de alta del albarán, origen de las líneas | «Desde el parte {PT-…}» | con D1=A, el albarán se rellena del parte |

**Choques que veo (no elijo yo):** N5 y N13 sólo existen con D1=A · N4 y N9 sólo con D2 · N8 quita una frase que hoy está en DOS sitios: firmarla vale para los dos.

---

## APÉNDICE · SCRUM-1686 M1b + M2 aplicados al máster · S0 · 11-nov-2026 ~14:45Z (GitHub)

Medido sobre `origin/main` = `412ddc20d0233162159567d4e7705bf845f71404`. Rama `scrum-1686-maestro-m2-m1b`.

**Autorización:** GO del fundador, SCRUM-1686 **c.21479** («Sí, GO a todo (Recomendado)», AskUserQuestion «GO esquema», transcripción del orquestador `ed676fd1-feb4-4658-bda2-01f4bf9fb3fc`, 11-nov ~12:15 local). Textos: los borradores de S0 en **c.21472**, copiados del comentario.

**Qué cambia:** `docs/YAQU_MASTER.md:403` (Parte L, línea de `ParteTrabajo.estado`), AL FINAL de la línea y sin añadir ninguna, para no mover ninguna cita `YAQU_MASTER.md:<n>` (mismo método que SCRUM-1529c):
1. **M1b** · vocabulario DERIVADO `sin_albaran | en_albaran` (no es estado; no amplía `borrador | firmado`). Literal de c.21472.
2. **M2** · «un trabajo, varios partes: uno por visita; la visita ES su parte». Literal de c.21472.
3. **Hueco 1 de M2 (orden de «Visita {n} de {m}»)** · dentro, como una frase más de M2: c.21479 ③ lo cubre («orden de visitas»).

**Lo que NO he metido, y por qué — hueco 2 («borrador de hoy», zona horaria):** la pregunta del GO lo nombró «“hoy” en hora de Madrid»; mi borrador c.21472 decía «la del merchant, la que guarda el alta». No son lo mismo, y el código ya tiene decidido lo contrario de «Madrid fija»: `prisma/schema.prisma:111-124` (`Merchant.timezone`, opción A) prohíbe derivar la zona del país o fijarla a la península, y `core/zonaDelMerchant.ts` hace caer NULL a UTC, «nunca a Madrid». Escribir cualquiera de las dos en el máster sería elegir yo entre la pregunta y su objeto. Queda FUERA hasta que el fundador diga cuál (una línea); mientras, T1/T4 lo miden y vuelve como propuesta (c.21472, fallback ya escrito). Para PILOTO-1 en la península, las dos lecturas dan el mismo día si su `timezone` es `Europe/Madrid`.

**M1 (esquema):** NO se toca `prisma/schema.prisma` en esta rama. El DDL va como paquete para el fundador en un comentario de este ticket; T2 (SCRUM-1695) sigue bloqueado hasta que las tres bases tengan el ALTER (c.21479 ③).

**Efecto:** cuando este PR entre en `main`, se desbloquean T4 (SCRUM-1697) y la parte multi-visita de T1 (SCRUM-1694) (c.21479 ④).

## APÉNDICE · SCRUM-1686 ④ · EL DÍA DEL OPERARIO, pantalla a pantalla · S4 · 11-nov-2026 (noche)

**Medido sobre:** `origin/main` = `4d8043854` (código leído, nada tocado en `src/` ni `public/`). **Encargo:** c.21524
(literal del fundador, transmitido por el orquestador). **Material:** las tres capturas del fundador como operario
(miembro 30 «Operario QA», merchant QA 46, 11-nov ~19:30), SCRUM-1706 y SCRUM-1707 (descripciones íntegras, sin
comentarios), los patrones P1-P4 del benchmark (c.21407) y la Parte S1 del máster (qué puede HACER y qué VE el
Técnico). Carriles sacados con `node scripts/carriles.mjs de <ruta>`. **Límite:** Parte L (regla 5); lo que pide un
estado, una pantalla o un texto nuevo va como propuesta, no se construye.

**El rol, en una línea:** en el código el operario es `tecnico` (`src/core/http/roleCapabilities.ts:30`); lo que ve
lo decide `seesOnlyOwnJobs` (`:56`) y, para la pertenencia a un Trabajo, `esSuyoElTrabajo` con TRES ejes
—creador `operarioId`, `assignedUserId` y la tabla `assignees`— (`src/modules/jobs/domain/accesoAlTrabajo.ts:66-96`).

### 0 · Llegar (Inicio) — EXISTE, con dos cosas que no son suyas
- Menú: `aplicarRolALaBarra` (`public/dashboard/js/app.js:1185`) esconde las 10 entradas con `data-rol="admin"`
  (`public/dashboard/index.html`). Queda justo lo de la captura ①: Inicio, Solicitudes, Trabajos, Presupuestos,
  Albaranes, Facturas, Clientes, Productos. **Facturas** es correcto por el máster (S1: ve sólo las suyas) y para
  PILOTO-1 la esconde ya el modo `receipt` (SCRUM-1701, #3077): la cuenta QA 46 enseña Facturas porque **no** está en
  ese modo (MI LECTURA, sin medir el modo de la 46).
- «Esto es lo que pasa hoy en **tu negocio**.» (`homeView.js:18`) sale igual a los dos roles: para el operario el
  negocio no es suyo. → **H4** (texto, firma).
- Héroe «Nuevo presupuesto · en 30 segundos · tecla N» (`homeView.js:68-71`): **no es un fallo**: S1 le deja crear
  presupuestos. Lo que falta es que el primer bloque de SU Inicio sea SU trabajo de hoy (P2). → **H4**.
- «Actividad del equipo · este mes» sin importes: **es lo firmado** (SCRUM-1337 c.17795, construido en SCRUM-1341).
- «No hay nada que llevarte…» es la precarga offline (`estadoFirma.js:181`, SCRUM-460). La captura ① parece anterior
  a la asignación al #77: **re-medir** tras asignar antes de llamarlo fallo.

### 1 · Ver SU trabajo (lista) — EXISTE, enseña el dinero → SCRUM-1707
- El servidor filtra bien: `GET /admin/jobs` aplica los tres ejes (`jobs.routes.ts:827-842`). El #77 le sale.
- **El dinero sale entero**, sin condición de rol en ningún sitio: `serializeJob` (`jobs.routes.ts:373-558`) manda
  `totalAceptado`, `totalCobrado`, `remaining`… a cualquier rol; `jobsView.js` pinta la tarjeta «Por cobrar»
  (`:349-373`), la columna «x de y» (`:920-967`) y los filtros Pendiente/Parcial/Pagado (`:136-147`) sin mirar el
  rol. El único botón de dinero con rol es «💰 Cobrar el resto», que al técnico le sale BLOQUEADO (`:1145`) —
  pintado, pero bloqueado.
- El máster no lo decide para ESTA pantalla: S1 le deja ver sus presupuestos y facturas CON importe, y le quita
  «lo que le deben» del Inicio. Son dos lecturas posibles → **pregunta Q1** (no se ejecuta sin firma).
- «Abrir parte» (SCRUM-1700, #3069) no depende del rol: al operario también le sale en su trabajo en curso.

### 2 · Abrir el trabajo (ficha) — ROTO → SCRUM-1706 (P0), CAUSA MEDIDA
- `jobDetailView.js:698` pide `GET /admin/jobs/:id`; si esa petición falla, y SÓLO esa, pinta «No pudimos cargar
  el trabajo.» (`:699-702`).
- **Lo niega el servidor:** `jobs.routes.ts:938` → `if (seesOnlyOwnJobs(rol) && job.operarioId !== req.teamMemberId)
  return 404`. Mira **un eje** (el creador). El operario 30 está en el #77 sólo por ASIGNACIÓN → la lista le da
  200 y la ficha le da 404. No es el front.
- **El mismo eje único está en cuatro sitios más del mismo fichero:** líneas 980, 1005, 1170 y 1217 (esta última es
  `POST /:id/albaranes`, y su comentario de SCRUM-849 dice que copia a propósito el eje de `GET /:id`). Partes
  (`partes.routes.ts:92-99`, `:407`) y albaranes (`albaranes.routes.ts:865-873`) ya usan los tres.
- El máster ya lo decide (S1, nota «Autor o asignado»: ve «los que tiene asignados como trabajo»), así que el
  arreglo no pide firma: pasar los cinco sitios a `esSuyoElTrabajo`, con un test por rol en rojo primero. → **H1**.
- Con 1706 roto, el operario PUEDE llegar a su parte (el «Abrir parte» de la lista crea/abre por `/admin/partes`,
  que mira los tres ejes), pero no a la ficha: cualquier enlace del parte «← Trabajo» acaba en la banda roja.
- Qué verá en la ficha cuando abra («LO QUE FALTA … Hacer presupuesto», importes, notas, «+ Nuevo albarán», que con
  D1=A firmado en c.21461 no le toca ofrecer): **sin medir**, se mide en cuanto 1706 entre. → **H5**.

### 3 · Parte → apuntar → firmar — EXISTE
- `parteDetailView.js`: carga `GET /admin/partes/:id` (`:1705`), guarda con `PATCH` (`:1742`), firma el operario
  (`POST …/firmar-tecnico`) y firma el cliente (`POST …/firmar`) (`:1393-1394`). Sin precios en ningún punto: el
  servidor los recorta (`lineasParaElTecnico`; `precios` es campo sólo de admin, `roleCapabilities.ts:112-115`).
  Es el Job Sheet de Tradify del benchmark: el parte ya cumple «los precios se quitan por permiso».
- Verificado en prod el 11-nov (SCRUM-1698, PT-2026-006, con la cuenta QA de ADMIN). **Falta hacerlo con la cuenta
  del operario**, y depende de H1 sólo para la ficha, no para el parte.

### 4 · Segunda visita — EXISTE SIN DECIRLO
- No hay «+ Nuevo parte». El mecanismo es implícito: «Abrir parte» busca un borrador del trabajo; si el de la
  visita 1 ya está firmado, crea otro (`jobsView.js:1233-1237`, `jobDetailView.js:1655-1661`). Cumple M2 («la visita
  ES su parte»). No hay tope de partes por trabajo (`partes.routes.ts`, sólo numeración).
- Falta que la pantalla diga qué visita es: «Visita n de m» = SCRUM-1697, esperando el campo que calcula S1 en el
  GET del parte. Y el hueco 2 de M2 («borrador de HOY», zona horaria) sigue en el fundador: hoy se reabre CUALQUIER
  borrador, aunque sea de ayer.

### 5 · Qué ve la oficina — EXISTE
- «Partes por valorar · N» (`parteOficinaView.js:50`, `GET /admin/partes/oficina/pendientes`, `requireRole('admin')`,
  `partes.routes.ts:338`); el parte con precios para la oficina (`:367-378`). El número del menú se pone al día al
  entrar, al recargar o a los 5 min (anotado en SCRUM-1700). Parte → albarán (M1) espera el ALTER (T2, SCRUM-1695).

### Lo que encontré de paso (no es del flujo, va a la lista)
- **Albarán: la API manda `precioUnitario` al técnico** (`src/modules/jobs/domain/albaran.service.ts:732`,
  `serializeAlbaran`: las `lineas` salen enteras, con `totales` en VALORADO, y la función no recibe el rol;
  `ocultarPreciosEnDocumento` sólo gobierna el papel del cliente). No he mirado si alguna ruta recorta DESPUÉS
  del serializador: es lo primero que mide quien lo coja. El parte y el presupuesto
  (`sinCosteEnDocumento`) sí recortan. Choca con «los precios se quitan por permiso». → **Q2**.

### LISTA PARA EL ORQUESTADOR (propuestas, NINGÚN ticket abierto)
| | Qué | Carril | ¿Pide firma? |
|---|---|---|---|
| H1 | 1706: los 5 sitios de `jobs.routes.ts` (938, 980, 1005, 1170, 1217) a `esSuyoElTrabajo`; test por rol en rojo primero; verificar con la cuenta del operario en yaqu.app | S1 | No (S1 del máster ya lo decide) |
| H1b | Guard de CLASE: ninguna comprobación de pertenencia al Trabajo fuera de `accesoAlTrabajo.ts` (la lección de SCRUM-147, que convirtió una denylist en clase) | S3 | No |
| H2 | 1707: dinero de la lista para el técnico — servidor (`serializeJob`) + pantalla (tarjeta, columna, filtros, botón bloqueado) | S1 + S4 | **Sí → Q1** |
| H3 | Precios del albarán en la API del técnico | S1 | **Sí → Q2** |
| H4 | Inicio del técnico: «tu negocio» por rol y, como primer bloque, «tu trabajo de hoy» (P2) | S2 | **Sí → Q3** (texto + cambio de la tabla de S1, que fija qué ve en Inicio) |
| H5 | Ficha del trabajo vista por el técnico: medir tras H1 y quitar lo que D1=A no le deja (`+ Nuevo albarán`) | S2 | Ya firmado (D1=A); lo nuevo, a firma |
| H6 | Verificar el día entero con la cuenta del operario tras #3069 + H1 (lista → Abrir parte → apuntar → dos firmas → segunda visita → la oficina lo ve) | S4 | No |

**Preguntas para el fundador (una línea cada una):**
- **Q1** · En su lista de Trabajos, el operario: (a) no ve dinero ninguno; (b) ve el importe de SUS trabajos (como
  ya ve sus presupuestos y facturas) pero no «Por cobrar» ni los filtros de cobro; (c) como hoy.
- **Q2** · ¿El operario debe recibir los precios del albarán? Hoy sí, aunque los del parte no.
- **Q3** · Texto para el Inicio del operario en vez de «tu negocio» (propuesta mía, SIN firmar: «Esto es lo que
  tienes hoy.»), y si su primer bloque pasa a ser su trabajo de hoy.
- (sigue abierta, de S0) el «hoy» del borrador de parte: zona del merchant o Madrid.

## APÉNDICE · SCRUM-1686 H4 · EL INICIO DEL OPERARIO, construido · S2 · 12-nov-2026

**Medido contra:** `origin/main` = `acac25dbac0dbb870f6dbda9f240df3664326c2d` · 2026-11-12T08:08:34Z (cabecera `Date:` de `gh api -i zen`) · **Rama:** `scrum-1686h4-inicio-operario` · **Carril:** S2 (`homeView.js`); `jobsView.js` es de S4 y NO se toca: se LLAMA.

**Autorización (regla 39), las dos firmas del fundador del 11-nov-2026 en este ticket, literales:**
- **c.21549** (Q3 de arriba): «Sí a los dos — Firma el texto "Esto es lo que tienes hoy." y el primer bloque pasa a ser su trabajo de hoy.»
- **c.21551**: «Sí, los mismos — "Para hoy" · "N trabajos"/"1 trabajo" · "Nada para hoy." se usan tal cual en el bloque del Inicio del operario. Mismo significado, misma palabra en las dos pantallas.» Extiende EXPRESAMENTE al Inicio los literales de SCRUM-917 c.15881.

**Qué cambia:**
1. `public/dashboard/js/homeView.js` — el saludo va por rol: quien no es admin (`veNegocio`) lee «Esto es lo que tienes hoy.»; el admin conserva «Esto es lo que pasa hoy en tu negocio.». Bloque nuevo `#home-hoy` DESPUÉS de los avisos de riesgo (se leen antes que una capacidad, SCRUM-357) y ANTES del héroe y de las acciones rápidas. Lo pinta `pintarCifrasDeLaLista` de `jobsView.js` con `GET /admin/jobs` (ya recortado a lo suyo, SCRUM-1706): misma función ⇒ mismo significado (en curso + agendado hoy) y mismas palabras. De esa zona se QUITA «Por cobrar»: es dinero, no su trabajo de hoy. Si la carga falla NO se pinta nada (un «Nada para hoy.» sobre una carga caída afirmaría que no tiene trabajo, y el fallo no tiene texto firmado); vacío no ocupa (`.jobs-cifras:empty`). El admin no pide `/admin/jobs` desde el Inicio.
2. `docs/YAQU_MASTER.md` — fila nueva en la tabla «En la pantalla de Inicio | Admin | Técnico» (Parte S1) citando c.21549 y c.21551, en el MISMO PR que el código (lo pide c.21549).
3. `tests/scrum1686h4-inicio-operario.test.mjs` — 7 casos en el banco de vistas (sin red ni BD). **Rojo primero:** contra el `homeView.js` de `main`, 5 ✖ / 2 ✔ (los dos verdes son las guardas ⑤ y ⑥, que en `main` se cumplen por ausencia); **mutación** de ⑤ (el `catch` pinta con lista vacía) ⇒ ⑤ ✖. Con el cambio, 7/7.

**Ningún texto fuera de los firmados:** el pie de la cifra (nombres de cliente) es DATO, como en la lista (c.15881).

**Lo que salió mal (A9):** el traspaso de la S2 anterior decía «H4 MEDIDO, SIN EMPEZAR A CONSTRUIR», y en otra worktree había un commit WIP sin empujar de después de escribirlo (`189d32aa9`). Lo vi sólo porque `git branch -m` chocó con el nombre; lo reaproveché (cherry-pick) en vez de hacerlo dos veces. Ese choque no es una comprobación. Lo que SÍ queda comprobado es el fallo que este bloque podía meter —afirmar «Nada para hoy.» con la carga caída—: el caso ⑤, cazado por mutación.

A9: comprobación → `tests/scrum1686h4-inicio-operario.test.mjs`
