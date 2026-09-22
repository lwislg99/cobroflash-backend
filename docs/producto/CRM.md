# CRM · el apartado Clientes de YaQu — diseño y backlog (SCRUM-1012)

> **BORRADOR v0.9 · `sd-21` · 21-sep-2026 · cierre por fin de uso.** PASO 0 de código HECHO; comparativa HECHA;
> backlog DISEÑADO pero **los tickets todavía NO están creados en Jira** (§5 los deja listos para crear en bloque).
> Sin código de producto. Todo texto de pantalla que aparezca aquí es propuesta **sin firma** (regla 39).
> Contabilidad: `docs/producto/CONTABILIDAD.md` (mismo ticket, segundo entregable).

## 0 · Cómo se midió (PASO 0)

- Checkout fijado a `origin/main` = `6db52e1661ca63562ff082a45f970ad29be26ac9` (worktree `sd-21`), solo lectura: **visto en código**,
  no ejecutado ni en staging. Lo «deducido» va marcado. Referencias `ruta:línea` sobre ese commit.
  Abreviaturas: S=`prisma/schema.prisma` · R=`src/modules/system/app/routes/customersAdmin.routes.ts` · CA=`src/modules/system/customerAdmin.ts` ·
  CV/CD/FC/JR=`public/dashboard/js/` `customersView` / `customerDetailView` / `filtroClientes` / `jobRailBlocks`.
- Competencia: `docs/competencia/matriz.md` (M) y `propuestas-priorizadas-21sep.md` (P). **`[D]` = visto por dentro; `[F]` = por fuera.**
  En M solo Holded es `[D]`; Contasimple lo es solo por capturas (`capturas/contasimple/`, 6 PNG, no citadas por M ni P).

## 1 · Qué existe HOY (medido)

**En pantalla:** lista con búsqueda (servidor), pestañas Todos/Empresas/Personas, filtro por etiqueta, «Última visita» con filtro sin visita
6/12/24 meses (979), orden Recientes/A-Z, importar CSV y exportar CSV (solo admin), alta/edición con datos fiscales, botón Portal.
Ficha: cabecera, nota y «Próxima visita», 6 KPIs (Pendiente de cobro, Presupuestos, Facturas, Facturado, Cobrado, Beneficio),
«Actividad reciente», pestañas Presupuestos · Facturas · Trabajos (partes y albaranes con fotos «n», 980). Nota del cliente visible en el Trabajo (982).
Sin ningún flag de clientes (`flags.ts:14-38`); solo `MAINTENANCE_ENABLED=false` (planes de revisión: rutas sin pantalla).

**Datos (S:201-447):** un `notes` de texto único (S:307), `tags` Json máx 20 × 40 car. (S:379), UNA dirección fiscal `billing*` (S:409-413),
`phone` + `mobile`, `companyId` persona→empresa sin FK (S:267), `portalToken`, `waOptOut`, `CustomerEvent` (S:1136). **No existen** contactos,
direcciones múltiples, notas con fecha, opt-in, origen, equipo ni adjunto de cliente (`Attachment.entityType` = quote_request|job, S:1304).

**Defectos deducidos — confirmar en staging ANTES de arreglar (A2: corriendo, no leyendo):**
- **A.** `GET /admin/customers/duplicados` (R:70) va DESPUÉS de `/:id` (R:40), que responde 400 sin `next()` (R:43): el aviso de duplicado probablemente nunca sale.
- **B.** `jobDetailView.js:3058` hace `PATCH /admin/customers/:id` y R solo tiene `PUT` (R:124): probable 404 al guardar el NIF antes de emitir.
- **C.** Facturado/Cobrado/Pendiente/Presupuestos de la ficha se calculan con `take: 20` (R:295,301): cifras que mienten con más de 20 documentos.

## 2 · Ellos · nosotros · diferencia

| apartado | ellos | nosotros hoy | diferencia |
|---|---|---|---|
| Ficha por pestañas | Housecall: Profile, Estimates, Jobs, Invoices, Attachments, Notes `[F]` M§14.1 L1354-1374 (`housecall-pro/ficha-del-cliente-pestanas`) · Contasimple: Información, Documentos adjuntos, Informes, Registro mercantil `[D captura]` | Presupuestos · Facturas · Trabajos | faltan Documentos y Notas como pestañas |
| Llamar / WhatsApp / correo | (no citado en M) | 0 `tel:`/`wa.me`/`mailto` en lista y ficha; el móvil no se pinta (CV:664). El rail del Trabajo sí lo tiene (JR:48-64) | hueco propio, evidencia = nuestro código |
| vCard | Contasimple «Descargar vCard» `[D captura]` (`ficha-del-cliente-pestanas-mapa-vcard`) | no existe | SCRUM-1003 |
| Cómo llegar / mapa | Contasimple mapa lat/long `[D]` · ServiceM8 mapa `[F]` | mapa solo en el Trabajo (JR:94) | SCRUM-1004 |
| Documentos adjuntos | Contasimple pestaña `[D]` · Housecall Attachments `[F]` | no existe | SCRUM-1005 |
| Equipos / instalaciones | Housecall equipo por dirección, plan, filtro «último servicio», CSV `[F]` (8 capturas) · ServiceM8 activo+QR+foto `[F]` | 0 modelos | SCRUM-914 (nº 1 de P L15-27) |
| Varias direcciones | Housecall padre-hijo y notas por dirección `[F]` | una dirección fiscal | ALTER de esquema |
| Notas | Housecall Notes `[F]` · Fergus job card `[F]` · Contasimple `[D]` | un texto sin fecha ni autor | notas con fecha (sin tabla nueva, ver CRM-08) |
| Etiquetas / segmentos | Housecall etiquetas con filtro, «Do Not Service» `[F]` | en lista y filtro; NO en la ficha; sin segmentos guardados | mostrar y editar en la ficha |
| Última visita / recordar | Housecall lista «último servicio» + CSV `[F]` | hecho (979), sin «volver a llamar» | seguimiento: sin modelo |
| Portal del cliente | Holded 9 acciones `[F]`; dentro solo PDF + aceptar `[D]` | existe (`customerPortal.routes.ts:223`); el cliente nunca lo recibe en el mensaje (M L774) | SCRUM-967 |
| Importar clientes | FacturaDirecta y Verifacturamos XLSX/CSV `[F]` · Anfix «por ti» | CSV de 4 campos, ≤500 filas (`importarClientes.service.ts:80`) | NIF/móvil/etiquetas/.xlsx (P L103, sin ticket) |
| Saldo («qué debe») | (M no lo trata) | KPI Pendiente sobre 20 facturas; sin lista de deudores | defecto C + lista |

## 3 · Principios del bloque

1. **Primero lo que se ve.** Cada ticket cambia UNA pantalla (regla AB de UI). Un diseño que no está en pantalla no está hecho.
2. **Lo aditivo antes que el esquema.** Ola 1 no toca `schema.prisma`; lo que sí lo toca (A5) espera decisión + ALTER de Javier.
3. **Nada de envío nuevo sin J6** (regla 28): `wa.me` y `tel:` son enlaces del navegador, no envíos de YaQu.
4. **La factura emitida no se toca** (regla 29): fusionar clientes con facturas emitidas es zona fiscal y queda para la Ola 3.

## 4 · Dueños (¡ojo al mapa!)

`dos-equipos.md` §3: `customersView.js`, `customerDetailView.js`, `filtroClientes.js`, `csvImport.js`, `system/customerAdmin.ts`,
`customersAdmin.routes.ts`, `tagsDelCliente.ts`, `customerPortal.routes.ts` son de **J2** (equipo de Javier); el resto del panel es de S2; el servidor
suelto, de S1. Los tickets llevan `equipo-luis` por encargo del fundador, pero **la ruta ajena se pide al dueño por Jira** (regla de §3) → **decisión D1**.

## 5 · Backlog (candidatos a ticket; tamaño S = una sesión)

Formato: `id · título profesional · por qué · tamaño · depende · dueño (mapa) · STOP`. Aceptación testable = 3-6 líneas (se escribe al crear el ticket
con el texto de «por qué»; aquí va la semilla).

### Ola 1 — se empieza YA, sin decisión

| id | título (lenguaje del profesional) | por qué / semilla de aceptación | tam. | depende | dueño | STOP |
|---|---|---|---|---|---|---|
| CRM-01 | Confirmar en staging los tres fallos de la ficha (duplicados, NIF desde el Trabajo, cifras con más de 20) | hallazgos A/B/C de §1. Aceptación: cada uno «ocurre / no ocurre» corrido en staging con captura; los que ocurren abren su ticket de arreglo y su línea en `docs/BUGS.md` | S | — | S0 | — |
| CRM-02 | Llamar, escribir por WhatsApp o mandar un correo al cliente con un toque, desde la lista y la ficha; y ver también el móvil | 0 enlaces hoy (CV,CD); el Trabajo ya lo hace (JR:48-64). Aceptación: teléfono y móvil como `tel:`/`wa.me` en lista y ficha; el correo como `mailto:`; teléfono vacío = sin enlace | S | — | J2 (D1) | microcopy del botón: firma |
| CRM-03 | = **SCRUM-1003** «Descargar vCard» de la ficha | Contasimple `[D]` | S | — | J2 (D1) | datos de cliente (descarga del propio merchant: confirmar que no es «export» de la regla 4) |
| CRM-04 | = **SCRUM-1004** «Cómo llegar» en la ficha | v1 con la dirección fiscal (S:409); sin dirección = botón ausente | S | — | J2 (D1) | — |
| CRM-05 | La ficha enseña etiquetas, NIF, móvil, dirección y referencia | hoy invisibles en la cabecera (CD:106-127) aunque existen en datos. Aceptación: los 5 campos visibles si tienen valor; nada nuevo en servidor | S | — | J2 (D1) | — |
| CRM-06 | Editar las etiquetas del cliente desde su ficha | solo se edita en la lista (CV:1119-1345). Aceptación: mismo límite 20×40 (`tagsDelCliente.ts:54-57`), sin perder las de la lista | S | CRM-05 | J2 (D1) | — |
| CRM-07 | Las cifras del cliente (facturado, cobrado, pendiente, presupuestos) cuentan TODO, no los últimos 20 | defecto C. Aceptación: cliente de prueba con 25 facturas → las cifras suman las 25; test que lo fija | S | CRM-01 | J2 (D1) | dinero: **solo lectura**, no toca cobro |
| CRM-08 | Notas del cliente con fecha y quién las escribió | hoy un texto único (S:307). Diseño: guardar cada nota como `CustomerEvent` tipo nota (`S:1136` ya tiene type/title/detail/meta) — **sin tabla nueva (deducido, confirmar)**; el texto de hoy queda como «nota fija» | M | — | J2 (D1) | — |

### Ola 2 — necesita decisión del fundador o ALTER de Javier

| id | título | por qué / semilla | tam. | depende | dueño | STOP |
|---|---|---|---|---|---|---|
| CRM-09 | «Quién me debe»: lista de clientes con saldo pendiente y filtro «con deuda» | hueco 4 del PASO 0; hoy solo el KPI de una ficha | M | CRM-07 | J2 (D1) | dinero solo lectura; recordatorios de cobro NO (regla 28) |
| CRM-10 | Varias direcciones u obras por cliente (con «cómo llegar» de cada una) | Housecall lo ata a la dirección `[F]`; hoy una fiscal (S:409-413) | M | D4 | J2 + Javier (ALTER) | **schema aditivo** |
| CRM-11 | Equipos del cliente v1 (= **SCRUM-914**): pestaña «Equipos» con historial de trabajos y garantía | nº 1 de la consultoría (P L15-27); Housecall/ServiceM8 `[F]` | M | CRM-10, D3 | J2 + Javier (ALTER) | **schema aditivo** |
| CRM-12 | Dar de alta un equipo desde el propio Trabajo | Housecall `alta-del-equipo-desde-el-trabajo` `[F]` | S | CRM-11 | S4 (`jobsView`) | — |
| CRM-13 | = **SCRUM-1005** Documentos adjuntos del cliente (contratos, boletines, planos en PDF) | Contasimple/Housecall. `Attachment.entityType` hoy no admite cliente (S:1304): **por medir** si es cambio de esquema | M | D5 | J2 (D1) | datos de cliente; posible schema |
| CRM-14 | Importar clientes con NIF, móvil, etiquetas y dirección, y desde Excel | hoy 4 campos CSV; P L103 (.xlsx, MEDIANO, sin ticket) | M | — | J2 (D1) | datos de cliente |

### Ola 3 — grande o con riesgo; solo tras las anteriores y su decisión

| id | título | nota | tam. | STOP |
|---|---|---|---|---|
| CRM-15 | Seguimiento «volver a llamar» (tarea con fecha en el cliente, aparece en el resumen del lunes) | sin modelo hoy; `MAINTENANCE_ENABLED=false` sin pantalla; **decidir** si reutilizar mantenimientos (D6) | M | posible schema · aviso automático → J6 |
| CRM-16 | Fusionar dos clientes duplicados | fusión no existe; depende del arreglo de A. Un cliente con facturas emitidas NO se fusiona sin pasar por J1 (regla 29) | L → partir | **fiscal** · datos de cliente |
| CRM-17 | Acciones masivas sobre la selección (etiquetar, exportar) | hoy la selección solo cuenta (FC:436-442). «Avisar» a la selección = envío nuevo → J6, fuera de este ticket | M | regla 28 |
| CRM-18 | Fotos en el historial del cliente (980 v2) | 980 salió sin fotos; M L1309 lo corrigió a GRANDE; medir peso de la foto antes (S4/920d) | L → partir | — |
| CRM-19 | Historial de WhatsApp del cliente en su ficha | `WhatsAppMessage` guarda solo el estado y se lee por documento | M | canal WhatsApp = J2, **sin mandar nada nuevo** |

**Ya hechos (no se reabren):** 979 última visita · 980 historial v1 · 982 nota en el Trabajo · 981 aviso de visita · 967 portal en el mensaje (existe; enlazar).
**Aparcados por no ser CRM:** varios destinatarios M§10.2 (GRANDE) · QR del equipo M§13.3.2 · calendario por suscripción M§15.3.2 · SCRUM-993 albarán a firmar.
**Descartado por falta de evidencia:** «origen del cliente» (ningún competidor citado lo trae).

**Housekeeping:** 977 y 978 tienen el MISMO título (ambos «Tareas por hacer»). **Cerrar 978 como duplicado de 977** y colgar todo de 977.
1006 (SIF) y 1007 (relevo) NO son CRM; 913 (fichaje), 1008-1010 (productos/compras) tampoco.

## 6 · Decisiones del fundador (sí/no, con recomendación)

1. **D1 — ¿El equipo de Luis construye en los ficheros de clientes (dueño J2) mientras J2 no tenga cola de CRM, avisando a J2 en Jira por ticket?** Recomiendo **sí**: el mapa obliga a pedirlo al dueño, y el fundador quiere el CRM ya.
2. **D2 — ¿Cerramos SCRUM-978 como duplicado de 977?** Recomiendo **sí**.
3. **D3 — ¿Equipos del cliente (914) entra en la v1 del bloque, con su ALTER?** Recomiendo **sí**: es la propuesta nº 1 de la consultoría.
4. **D4 — ¿Varias direcciones/obras por cliente (ALTER)?** Recomiendo **sí, ANTES de los equipos**: el equipo cuelga de la dirección en Housecall `[F]`.
5. **D5 — ¿Documentos adjuntos del cliente (contratos, planos)?** Recomiendo **sí** con tope de tamaño (el tope lo decide J4/Javier; no lo invento aquí).
6. **D6 — ¿«Volver a llamar» reutiliza el mecanismo de mantenimientos (hoy apagado) o es una tarea propia?** Recomiendo **propia y simple** (fecha + nota); mantenimientos aún no tiene pantalla.
7. **D7 — ¿Aparcamos «varios destinatarios» (M§10.2, GRANDE) fuera del bloque?** Recomiendo **sí, aparcar**.

## 7 · Lo que falta para cerrar este entregable

1. Crear en Jira los tickets de §5 (8 + 6 + 5) con etiquetas `listo-para-construir` + `equipo-luis` + `area-*`; enlazar (`createIssueLink`, «Relates») 1003, 1004, 1005, 914, 967 y colgar de 977.
2. Adjuntar la lista D1-D7 como comentario en SCRUM-1012 (una sola).
3. Mirar 4 capturas de Contasimple/Housecall si se quiere afinar CRM-04/CRM-13 (no cargadas aquí por coste).
4. Empujar la rama `scrum-1012-diseno-crm-contabilidad` (hoy solo commit local).
