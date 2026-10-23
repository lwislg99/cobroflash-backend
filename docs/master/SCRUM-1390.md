# SCRUM-1390 · La Parte S1 del máster marca «autor o asignado» sin afirmar lo que el código aún no hace

**Medido contra:** `origin/main` = `cadf00bcee699dc200ff142050986a62b692b3c4` · 2026-10-01T15:50:29Z

A9: aviso → cicatriz J4 «una sonda que ejecuta manejadores reales ejecuta también sus envíos, y la lancé sin mirar antes si el entorno llevaba credenciales de WhatsApp, de correo o de IA; no salió nada sólo porque no las había» — no se pudo comprobar: la negativa a arrancar con credenciales vive dentro de esa sonda y nada impide que la próxima nazca sin ella

1-oct-2026 · **J4h** (puesto J4, equipo de Javier, relevo de J4g), por encargo del orquestador
(`cobroflash-backend-5b`). [Escrito por J4h. Las frases del fundador las transcribe el orquestador en
Jira; aquí se citan de allí, y los comentarios que se nombran los he leído en Jira, no en el encargo.]

**Sólo documentación.** Tres ficheros: `docs/YAQU_MASTER.md` (tres líneas, en sitio), este registro con
su banco (`docs/evidencias/scrum1390/`) y una línea en `docs/equipo/cicatrices/J4.md`. Ni `src/`, ni
`public/`, ni `prisma/`, ni tests.

El censo (Ⓓ) se midió sobre `dist/` construido de `8c0bf72850988e5f06266f330ab4c6c869f42a36`. Entre ese
commit y el del ancla `main` no tocó `src/`, `public/`, `prisma/`, el máster ni las cicatrices de J4
(`git diff --name-only`, 0 ficheros de esas rutas sobre 36 cambiados).

## Ⓐ Qué se decidió, quién, y dónde consta

| qué | quién | dónde lo leo |
|---|---|---|
| El Técnico ve sólo SUS facturas | fundador, «1-Ok la B» | SCRUM-1346 c.17828 |
| «Suya» = de lo que es autor MÁS lo que se le ha asignado como trabajo; «mejor ser más laxo al principio y evitar errores» | fundador | SCRUM-1346 c.17932 |
| La regla vale para facturas Y para presupuestos | fundador, «1-Para los dos» | SCRUM-1346 c.17952 |
| Orden: primero el máster, después el código | orquestador | SCRUM-1346 c.17952 |
| La fila dice qué hace HOY y qué está DECIDIDO; puntero dentro de la celda de facturas; la fila de «Quotes … crear-ver» no se toca | orquestador, aprobando lo que propuse | descripción de SCRUM-1390 |

**Lo que NO consta, y el máster lo dice así:** el motivo de la decisión para los presupuestos. Para las
facturas está escrito (c.17828). Para los presupuestos hay una respuesta literal y la constancia de que
se le avisó de la consecuencia antes de contestar; no hay una frase suya con el porqué, y no la he puesto.

**El literal de las tres líneas es mío.** No es texto de usuario (la regla 39 no pide firma), pero es una
fila del máster redactada por una sesión: el PR se empuja con el auto-merge DESARMADO y lo rearma el
orquestador si aprueba el literal.

## Ⓑ Qué se ha cambiado: tres líneas, en sitio

`git diff --numstat` → `3 3 docs/YAQU_MASTER.md`. El fichero tiene 1.904 líneas antes y después.

| línea | qué era | qué se le hace |
|---|---|---|
| `:665` | `Facturas: emitir/anular/R1 … ❌ (ver sí)` | dentro de la celda: «ver sí» es lo que hace HOY; decidido que verá sólo las suyas, sin construir; puntero a la nota |
| `:675` | `Actividad reciente del negocio (últimos presupuestos, con importe) … ✅ ✅` | la celda del Técnico dice las dos cosas: ✅ HOY los del negocio, y lo decidido por la tarde, sin construir |
| `:681` | la frase firmada por la mañana («…quitarlos de Inicio los esconde, no los cierra») | **se queda entera**; a continuación, en la MISMA línea, la nota «Autor o asignado» |

**La última frase de la nota (`:681`, «⛔ Y no se puede construir sobre el eje del Trabajo…») es del
orquestador**, que la pidió al aprobar el literal: yo había escrito la pregunta de Ⓔ como algo «sin
decidir», y medida es un muro para quien construya. Entra con sus palabras.

**Nada se ha borrado.** La frase de la mañana se conserva palabra por palabra y lleva al lado quién la
firmó y cuándo. La nota dice que la decisión de la tarde es posterior, que la sustituye en cuanto se
construya, y que hoy no está construida.

### Por qué la tabla no dice todavía «sólo lo suyo»

El encabezado de S1 es «implementado; esta tabla es la verdad», y esta misma mañana se fijó sobre esta
misma tabla que no se pone un ✅ por algo sin construir (SCRUM-1337 c.17795). Hoy el Técnico recibe los
presupuestos del negocio (medido por J4g en yaqu.app, y aquí en Ⓓ). Escribir «sólo lo suyo» haría que el
máster afirmase algo que el código no hace. Por eso cada celda lleva las dos cosas y su orden: el código
de hoy no contradice al máster, y el que se escriba después tampoco.

### Las tres filas que la decisión contradice, no una

El encargo nombraba una fila y `:670`. Medido en `origin/main`: `:670` es el título de la tabla; la fila
es la `:675` y su razón la `:681`. Y la decisión choca con otras dos filas, las del «ver» de la tabla de
capacidades:

- `:665`, «Facturas … (ver sí)». Estaba contradicha desde c.17828 (1-oct, 07:50Z), no desde la tarde:
  nadie la cambió cuando el fundador eligió la opción B. Lleva ahora su marca.
- `:664`, «Quotes/clientes/productos crear-ver». **No se toca:** es la línea que reescribe SCRUM-1347
  (Por hacer; 0 ramas, 0 PR y 0 commits con ese número al medir). La nota la nombra.

## Ⓒ Las citas al máster por número de línea

No se ha añadido ni quitado ninguna línea, así que ninguna cita `YAQU_MASTER.md:<n>` se desplaza. Las
tres líneas tocadas conservan su número. Fuera del propio máster, la única cita a la franja `:650`–`:699`
es `docs/master/SCRUM-534.md` (`:650`, dos veces), que queda por encima de lo tocado.

## Ⓓ El censo: en cuántos sitios recibe el Técnico un presupuesto o una factura que no es suyo

**Instrumento:** `docs/evidencias/scrum1390/censo-que-ve-el-tecnico.mjs.txt`. **Salida:**
`censo-que-ve-el-tecnico.salida.txt`, al lado.

**Población:** las 78 rutas de `TECNICO_ALLOWED` (`src/core/http/adminRouteDeclarations.ts`), que es la
lista cerrada de lo que un Técnico alcanza bajo `/admin` (la vigila `tests/scrum55-admin-fail-closed`).

**Qué se ejecuta de verdad:** los manejadores reales de cada ruta, con una petición de rol `admin` y otra
de rol `tecnico`, en dos pasadas (lecturas vacías; y lecturas que devuelven un documento del compañero).
**Qué es doble:** Prisma, que no aplica el `where`: lo apunta. Se mide qué consulta arma la ruta para
cada rol, no a Prisma. No se abrió servidor ni se tocó ninguna base.

**Controles, los nueve como se sabía que eran:** cinco rutas con recorte conocido (Trabajos, albaranes,
partes: SCRUM-23, 467, 992) salen RECORTA; las cuatro que J4g y J2i midieron sin recorte (lista y ficha
de presupuestos, lista de facturas, Inicio) salen NO-DISTINGUE.

| veredicto | rutas |
|---|---|
| NO-DISTINGUE (algún modelo de documento se consulta igual para admin y técnico) | 20 |
| RECORTA | 26 |
| SIN-DOCUMENTO (contestó sin consultar ningún documento) | 17 |
| NO-LLEGO (4xx/5xx en las cuatro corridas antes de consultar: **no medida**) | 15 |
| CIEGO | 0 |
| suma | 78 |

### Las 20, clasificadas a mano una por una

**Presupuestos y facturas ajenos, LECTURA — 10 rutas.** Son los sitios de la regla:

| # | ruta | qué es en pantalla | presupuesto | factura |
|---|---|---|---|---|
| 1 | `GET /admin/metrics/inicio` | Inicio, «Actividad reciente» | sí | sólo el recuento del globo |
| 2 | `GET /admin/quotes` | la lista de Presupuestos | sí | |
| 3 | `GET /admin/quotes/:id` | la ficha del presupuesto | sí | |
| 4 | `GET /admin/quotes/:id/pdf` | el PDF del presupuesto | sí | |
| 5 | `GET /admin/invoices` | la lista de Facturas | | sí |
| 6 | `GET /admin/invoices/:id` | la ficha de la factura | | sí |
| 7 | `GET /admin/invoices/:id/pdf` | el PDF de la factura | | sí |
| 8 | `GET /admin/customers/:id/detail` | la ficha del cliente: sus presupuestos, sus facturas y lo facturado y cobrado a ese cliente | sí | sí |
| 9 | `GET /admin/search` | el buscador general | sí | sí |
| 10 | `GET /admin/albaranes/presupuestos` | el buscador de presupuestos de «Nuevo albarán» | sí | |

Las tres primeras de presupuestos son las que midió J4g en producción. **El suelo eran 3; son 10.**

**Presupuesto ajeno, ACCIÓN — 5 rutas.** Buscan el presupuesto por `id` y negocio, sin mirar de quién es:
`PUT …/notes`, `POST …/accept`, `POST …/reject`, `POST …/send-whatsapp`, `POST …/send-email`. Si la
lectura se cierra y éstas no, se repite lo que midió SCRUM-849 en los albaranes: se podía firmar uno que
no se podía ni abrir.

**Albaranes de Trabajos ajenos, por la puerta de las facturas — 2 rutas.** `GET
/admin/albaranes/pendientes-facturar` y `GET /admin/albaranes/consolidables` leen los Trabajos del negocio
sin recorte. Las dos están declaradas con el motivo «mismo criterio S1 que GET /admin/invoices ("facturas:
ver sí")», que es justo la fila que la decisión cambia. El resto de albaranes y partes recorta: 0 de 14 y
0 de 8 rutas sin distinguir.

**Trabajo ajeno — 1 ruta.** `GET /admin/jobs/:id/ics` busca el Trabajo por `id` y negocio; su hermana
`GET /admin/jobs/:id` sí niega el ajeno. No es un presupuesto ni una factura: es un hallazgo aparte.

**Fuera de la regla, y por qué — 2 rutas.** `GET /admin/metrics/actividad-equipo` cuenta presupuestos
por persona sin importes: es la decisión firmada «1-B» (SCRUM-1341). `GET /admin/products/frequent-concepts`
lee las líneas de los presupuestos del negocio para sacar conceptos frecuentes; lo LEÍ, no medí qué
campos salen.

10 + 5 + 2 + 1 + 2 = 20.

### Lo que este censo NO ha medido

- **Las 15 NO-LLEGO.** La petición fabricada no pasó la validación. Leídas a mano, tres tocan documentos:
  `GET /admin/attachments/:id` (busca por `id` y negocio; sirve las fotos del albarán y las de las
  solicitudes), `GET /admin/customers/:id/portal-url` (da el enlace del portal de cualquier cliente del
  negocio; LEÍDO después, no ejecutado: la página `GET /cliente/:token` de
  `src/modules/system/app/routes/customerPortal.routes.ts` consulta los presupuestos y las facturas de
  ese cliente, así que es una undécima puerta de lectura, por un enlace público) y `POST /admin/ai/suggest-albaran-lines`. Las otras doce
  son altas, soporte, entorno, sitios de cliente, gastos e IA de presupuesto.
- **Las pantallas.** Se han contado rutas, no vistas de `public/dashboard/`. Una ruta puede pintarse en
  varias pantallas y al revés.
- **Lo que hay fuera de `/admin`:** los enlaces públicos por token (presupuesto, albarán, portal del
  cliente) y el bot de WhatsApp. No dependen del rol.
- **Qué campos salen** en cada una: se ha medido si la consulta distingue el rol, no si recorta campos.
- **Por efecto en yaqu.app** sólo están las tres de J4g. La sesión de operario está cerrada y no se pide.

## Ⓔ Lo que quedaba sin decidir

**Decidido por el fundador el mismo 1-oct-2026, SCRUM-1390 c.17962 (leído en Jira), después de mandarle
lo de abajo:** la asignación al documento cuenta para ver («1-Sí»); el rótulo del Técnico es «Tus
presupuestos recientes» («2-Ok firmo»); el admin conserva «Actividad reciente» («3-El admin conserva
sí»). El máster lo recoge en la misma nota. El texto del bloque vacío lo firmó después (c.17963, «1-Firmo la
1»): «Todavía no tienes presupuestos. Aquí verás los que hagas tú y los que te asignen.» para el Técnico;
el admin conserva «Sin actividad reciente». Nadie ha medido qué enseña el bloque si la carga falla. Y
el comentario «ASIGNAR NO ES UN PERMISO» de `prisma/schema.prisma` queda falso: no se toca aquí.

Un aviso para quien construya: «los tres ejes» son dos listas distintas. Los de la decisión son autor del
documento, Trabajo asignado y asignado al documento. Los de `esSuyoElTrabajo` son los tres del TRABAJO
(`operarioId`, `assignedUserId`, la tabla de asignados): cubren sólo el segundo de la decisión.

Lo que sigue es lo que se le mandó, tal como se escribió antes de la decisión:

**Qué cuenta como «asignado» en un presupuesto que todavía no tiene Trabajo.** El literal es «lo que se
le ha asignado como trabajo» (c.17932). El Trabajo nace cuando el presupuesto se acepta. Antes de eso, un
presupuesto que redacta el propietario no tiene Trabajo, así que por ese eje no puede estar asignado a
nadie. Con la regla tal cual, un Técnico no podría abrir, enseñar en PDF, enviar ni registrar la
aceptación de un presupuesto que preparó la oficina y que él lleva a la visita: las rutas 3 y 4 y las
cinco de acción, que hoy están declaradas con motivos de campo («Enseñar el presupuesto al cliente en la
obra», «Registrar la aceptación del cliente delante del cliente»).

Existe otra asignación, la del documento (`QuoteAssignee` e `InvoiceAssignee`, SCRUM-597), pero su
comentario en `prisma/schema.prisma` dice «ASIGNAR NO ES UN PERMISO». Que cuente o no para ver el
documento no lo ha decidido nadie.

Y un dato de nombres: c.17932 llama «Trabajo asignado a él» a `Job.operarioId`. En el esquema ese campo es
la AUTORÍA congelada al aceptar; la asignación es `assignedUserId` y la tabla de asignados. La casa ya
tiene los tres ejes juntos en `esSuyoElTrabajo` (`src/modules/jobs/domain/accesoAlTrabajo.ts`).

**El rótulo del bloque.** «Actividad reciente» es, en el máster, «del negocio». Texto de usuario: lo
firma el fundador. Las propuestas se le mandan al orquestador por mensaje; no están en el repo.

## Ⓕ Lo corrido

- Tanda dirigida sobre el árbol ya mezclado con `main`: los 164 ficheros de `tests/` que nombran el
  máster, los registros, las cicatrices, las evidencias o `docs/equipo`. 1.585 casos, 1.577 pasan, 0 caen,
  8 saltos declarados (seis sin banco desechable, uno sin `TRAMOS_PG_URL`, uno de enlaces a fichero). TAP a
  fichero fuera del árbol y código de salida leído en un segundo comando: 0.
- `npm run guards:entrada`, después de la última edición de este registro: resultado en el comentario de
  entrega de Jira.
- La tanda completa NO se corrió en local: el cambio es de documentación y la cubre el CI del PR, donde
  los casos se comprueban por nombre.

## Ⓖ Mis errores de esta tanda

1. **Lancé la sonda sin mirar si el entorno llevaba credenciales.** Ejecuta los POST del Técnico, entre
   ellos enviar por WhatsApp y por correo. No salió nada porque el árbol no tiene ningún `.env` ni
   variables de integración (medido DESPUÉS: 0 nombres, 0 ficheros); su stderr dice «Credenciales no
   configuradas, mensaje omitido». Fue suerte medida a posteriori, no un control. Ahora la sonda se niega
   a arrancar si las ve, y está vista en rojo con una variable ficticia
   (`censo-que-ve-el-tecnico.rojo-con-credencial.salida.txt`). Es la línea `A9:` de arriba.
2. **La primera pasada dio 16 y eran 20.** Dos causas. Cogía sólo el primer registro de cada ruta, y
   `POST …/send-whatsapp` está registrada dos veces (la puerta del plan delante): medía la puerta y salía
   «sin documento». Y sin `q` en la petición, el buscador contestaba vacío sin consultar. Además metía en
   la misma clase «no consulta documentos» y «no llegó a consultar». Lo cazó leer las 35 filas de esa
   clase una por una, no los controles, que salían bien las dos veces. De ahí la clase NO-LLEGO.
3. **Mi propia línea `A9:` puso rojo el guard de la A9** (`tests/scrum1294`) en la primera tanda: cité la
   cicatriz con su «(SCRUM-1390)» final y el guard guarda la frase sin el origen. Corregida la cita, no el
   guard; segunda tanda, 0 caen.
4. **Pasé texto con acentos a un intérprete por un heredoc de bash** y reventó. La nota ya estaba en la
   memoria de la máquina y no me paró. Escrito con la herramienta de ficheros la segunda vez.

## SCRUM-1489 · la fila 9 del censo (`GET /admin/search`, el buscador general)

[Anexado por S1, equipo de Luis, el 6-oct-2026, sobre `origin/main` `bafb0734`. No toca nada de lo de
arriba: la tabla sigue siendo la medición del 1-oct.]

La fila 9 la cierra SCRUM-1489: la ruta pide el recorte a las dos puertas (`wherePresupuestosVisibles`,
`whereFacturasVisibles`) y lo pone en `AND` en sus consultas de presupuestos y de facturas. Los
clientes que devuelve no se recortan (la cartera entera ya es del Técnico por `GET /admin/customers`).
Medición, mutantes y lo que queda sin ver en yaqu.app: `docs/master/SCRUM-1489.md`.

## SCRUM-1390b · «Trabajo ajeno — 1 ruta»: `GET /admin/jobs/:id/ics`

[Anexado por S1, equipo de Luis, el 19-oct-2026 a las 07:33Z (`Date:` de GitHub), sobre `origin/main`
`1edb5ce43cc9da8b1e0dc6e0477557c9cb5e0960`. No toca nada de lo de arriba. Encargo del orquestador
(`cobroflash-backend-86`), tras volver a salir en la sonda de frontera de S3 (SCRUM-1516, eje del rol:
`GET /admin/jobs/:id/ics [job=NO-DISTINGUE]`).]

**Qué era, medido antes de tocar nada.** Dentro de un mismo comercio: la ruta busca el Trabajo por `id` y
`merchantId`, así que **entre comercios no se cruzaba**. Lo que le faltaba es la comprobación de su
hermana `GET /admin/jobs/:id` (SCRUM-23): un técnico que no puede ABRIR el Trabajo de otro sí se bajaba
su `.ics`, con el nombre del cliente, el número del presupuesto, la fecha y las notas.

**¿Tenía razón de ser así?** No. El único llamador es el «⋯» del Trabajo (`jobsView.js`, «Añadir a mi
calendario»), y un técnico sólo llega a ese menú en sus Trabajos, porque la lista y el detalle ya le
recortan. No existe un calendario compartido del equipo que lo use.

**Qué cambia.** `jobs.routes.ts`, `GET /:id/ics`: la misma línea que `GET /:id`, con el mismo 404
`not_found` (no delata que el Trabajo existe), antes del 409 `not_scheduled`. Mismo eje que la
hermana (`operarioId`); si la lectura del Trabajo pasa a mirar más ejes, ésta tiene que seguirla.

**Verificado, ejecutando** — `tests/scrum1390b-ics-sin-trabajo-ajeno.test.mjs`, handler real de `dist/`
con `prisma` de doble:

| caso | sin el arreglo | con el arreglo |
| --- | --- | --- |
| técnico AJENO | **200**, cita entregada (rojo) | 404 `not_found`, nada enviado |
| control · técnico DUEÑO | 200 | 200, `text/calendar`, lleva al cliente |
| control · administrador | 200 | 200 |

Mutante sobre `dist/` (la condición del `if` nuevo a `false`, la línea en su sitio): cae SÓLO el caso del
técnico ajeno; los dos controles siguen en verde. ⚠️ El primer mutante que probé cortaba en el `}` de
`{ error: 'not_found' }`, rompía la sintaxis y tumbaba los tres: un rojo que no medía nada. Rehecho.

Vecinos: los 95 ficheros de `tests/` que leen `jobs.routes`, `/admin/jobs` o los censos de rol:
**878 tests, 862 pasan, 0 fallan, 16 saltados** (con puerta). `tsc`: sólo el error conocido de
`merchantAdmin.ts:147` (cliente de Prisma viejo; sin `prisma generate`).

**Lo que NO se ha medido.** En yaqu.app, con un técnico de verdad: el plan de prueba sólo abre
propietarios (la misma limitación que SCRUM-1555). Se mira cuando eso exista.

## SCRUM-1390c · qué pinta Inicio si la carga falla, y las 15 NO-LLEGO (éstas, sin medir)

[Anexado por J4 (sesión jv-j4n), equipo de Javier, el 23-oct-2026 a las 09:41Z (`Date:` de GitHub), sobre
`origin/main` `00179a513a5fb11ca12d61fe25b1b2dec26b51ca`. Encargo del orquestador (`cobroflash-backend-62`).
No toca nada de lo de arriba. Ni `src/`, ni `public/`, ni `prisma/`, ni tests: un banco en
`docs/master/evidencias/SCRUM-1390c/` y una línea en `docs/equipo/cicatrices/J4.md`. Entrega en Jira, c.20438.]

A9: aviso → cicatriz J4 «mi fetch doblado no hacía caso a la señal de aborto y el banco dijo que Inicio se quedaba en esqueletos para siempre, un cuelgue que el navegador no tiene porque api.js aborta a su plazo» — no se pudo comprobar: el banco es de un solo ticket y nada obliga a un doble a cumplir la parte del contrato que la vista usa

**Partido por contexto, por orden del orquestador:** la parte ① está medida; la ② no (va a traspaso).

### ① ¿Un fallo de carga cae en el mismo sitio que el vacío? (la pregunta de c.17963)

**Instrumento:** `inicio-si-falla-la-carga.mjs`. Usa el `index.html` real del panel, con sus 96 scripts en su orden, en
Edge sin cabeza (`puppeteer-core` y `scripts/_navegador.mjs`). `fetch` va doblado dentro de la página. Se llama a
`renderHomeView` con el rol puesto y se lee el texto del bloque `[data-home-block="activity"]` ya pintado.
`PLAZO_RED_MS` baja a 1,5 s: es lo único del panel que se cambia, y se dice. **Población:** 2 roles × 10
escenarios = 20 celdas, ninguna ciega. **Salida:** `inicio-salida.txt`.

| la ruta de métricas contesta… | técnico | admin |
|---|---|---|
| 200, `recentActivity: []` | «Sin actividad reciente» | «Sin actividad reciente» |
| 200, un presupuesto (sembrado) | el presupuesto | el presupuesto |
| 500 · 502 sin JSON · 401 · 403 · sin red · 200 que no es JSON · se cuelga (vence el plazo) | estado de error en el bloque: «No pudimos cargar tus métricas. Revisa tu conexión.» + Reintentar | error en `#kpi-grid`; **el bloque de actividad queda en blanco bajo su título** |
| 🔴 200 **sin** la clave `recentActivity` | **«Sin actividad reciente»: igual que el vacío** | igual que el vacío |

**Controles.** El positivo se siembra: un cliente inventado tiene que salir en «con datos», y sale en los dos
roles; además, «vacío» y «con datos» tienen que dar textos distintos. Rojo visto: con `--lector-roto` lee un
bloque que no existe, dice CIEGO y sale 2 (`inicio-salida-rojo-lector-roto.txt`). Mutante: una COPIA del panel
fuera del árbol, con el `catch` cambiado a `renderActivity([]); return;` (la línea mutada se imprimió y se leyó
antes de correr). Con ella, las 16 celdas de fallo salen «IGUAL QUE EL VACÍO»
(`inicio-salida-mutante-catch-pinta-vacio.txt`). El instrumento distingue, por tanto, las dos conductas.

**Lo que se le pasa a quien construya los textos firmados de c.17963:**

1. **No hace falta un tercer texto por el fallo de carga.** Un fallo no cae en el cartel de vacío: tiene su
   propio estado de error.
2. 🔴 **Una respuesta 200 sin `recentActivity` sí cae en el vacío**, por `data.recentActivity || []`
   (`public/dashboard/js/homeView.js:144`; en Jira, c.20438, puse `:142` por error). Con el texto firmado, el
   técnico leería «Todavía no tienes presupuestos…» sobre una respuesta rota. La propuesta no lleva texto
   nuevo: si falta la clave, se va al estado de error.
3. El aviso de error dice «tus métricas», y para el técnico el bloque pasa a llamarse «Tus presupuestos
   recientes». Si eso pide otro texto lo decide el fundador (regla 39). **No propongo ningún literal.**
4. El título se queda en pantalla cuando hay error. Cuando dependa del rol, tiene que estar puesto antes de
   la carga.
5. **Leído, NO ejecutado:** el `catch` envuelve también lo que viene DESPUÉS de pintar la actividad (la lista de
   puesta en marcha, los avisos, los globos). Una excepción ahí cambiaría un bloque ya bueno por el error.

**De paso, leído y no medido en yaqu.app:** el censo del rol de hoy da `GET /admin/metrics/inicio` con
`quote=RECORTA` (autor o asignado), pero `homeView.js` sigue pintando «Actividad reciente» (`:93`) y
«Sin actividad reciente» (`:647`) a los dos roles. Los textos de c.17962 y c.17963 no están construidos.

**Mi error en este banco** (es la línea `A9:`). La primera pasada salió «se cuelga → esqueletos para siempre»
(`inicio-salida-primera-pasada-fetch-sin-senal.txt`). El defecto no era del panel: era mi `fetch` doblado, que
no atendía la señal de aborto que `api.js` usa para cortar a su plazo. Corregido, la celda vence a los 1,5 s
y pinta el error. Antes de eso, la primera corrida entera se colgó en `page.evaluate`, porque esperaba a
`renderHomeView` sin tope. Ahora espera con tope, y un «no volvió» queda como dato de la celda.

### ② Las 15 NO-LLEGO de Ⓓ — NO MEDIDAS

Sobre `00179a513` el censo del rol da NO-DISTINGUE 5 · RECORTA 41 · SIN-DOCUMENTO 17 · NO-LLEGO 15 · suma 78.
Su sección NO-LLEGO es la de `docs/evidencias/scrum1390/censo-que-ve-el-tecnico.salida.txt`, sin un byte de
diferencia (`diff` vacío). La copia de hoy está en `censo-rol-de-entrada.txt`.

**`medir-las-15.mjs` está ESCRITO y NO CORRIDO.** Lo escribí antes de que llegara la orden de partir. Nadie lo
ha visto en verde ni en rojo, así que su presencia en el repo no dice que funcione. Lleva tres cosas: las 8
recetas de SCRUM-1514c (importadas de su `recetas.mjs`, no copiadas), 7 recetas propias y un par sembrado con
validación delante. **Siguiente paso:** `dist/` con `tsc --noCheck`. Después,
`node medir-las-15.mjs <raíz> censo-rol-de-entrada.txt --sin-sembrar`, que tiene que salir 2, y la misma
orden sin `--sin-sembrar`.

Por dónde empezar, **leído, sin ejecutar** (ninguna de estas mira el rol):

- `POST /admin/ai/quote-message` con `quoteId`: busca el presupuesto por `id` y comercio
  (`ai.routes.ts:148`).
- `GET /admin/attachments/:id`: busca por `id` y comercio y sirve los bytes (`attachments.routes.ts:11`). Lo
  que sirve son las fotos de los albaranes.
- `POST /admin/expenses` con `quoteId`.
- La cadena `GET /admin/customers/:id/portal-url` → `GET /cliente/:token`, que ya se leyó en c.17964.

### Lo corrido, y lo que no

- Las tres pasadas del banco de Inicio y su mutante, con las salidas al lado.
- El censo del rol, una vez, sobre `dist/` construido con `tsc --noCheck` desde este árbol.
- ⚠️ El cliente de Prisma, que es compartido, va 2 campos por detrás del esquema (`Merchant.activityKind` y
  `Quote.archivedAt`, según `_prisma-client-guard`). No se ha regenerado, y Prisma va doblado.
- **En yaqu.app, nada:** no hay sesión de técnico en producción (SCRUM-1555). No lo he intentado.
