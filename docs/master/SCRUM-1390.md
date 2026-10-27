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

## SCRUM-1390d · las 15 NO-LLEGO, medidas por efecto

[Anexado por J4 (sesión jv-j4o), equipo de Javier, el 23-oct-2026 a las 10:16Z (`Date:` de GitHub), sobre
`origin/main` `809527fa691056443c545901152443d0d2a072dc`. Encargo del orquestador (`cobroflash-backend-62`).
No toca nada de lo de arriba. Ni `src/`, ni `public/`, ni `prisma/`, ni tests: arregla el banco
`docs/master/evidencias/SCRUM-1390c/medir-las-15.mjs`, deja sus salidas en `docs/master/evidencias/SCRUM-1390d/` y
añade una línea en `docs/equipo/cicatrices/J4.md`. Entrega en Jira, c.20457 (y c.20458, que corrige una cifra).]

A9: aviso → cicatriz J4 «el doble de medir-las-15 devolvía la fila ajena, con sus marcas, en todo modelo y en todo create: un alta de cliente entregaba al técnico el presupuesto del compañero» — no se pudo comprobar: el banco es de un solo ticket y nada obliga a un doble a devolver sólo lo que la consulta pidió

### El instrumento, antes de fiarse de él: cuatro fallos

1. **No arrancaba en una ruta con espacios.** La ruta a `recetas.mjs` salía de `URL.pathname` (con `%20`), y el
   fichero acababa con código 1 y la salida vacía. → `fileURLToPath`.
2. 🔴 **El doble fabricaba la fuga.** Devolvía la fila AJENA, con sus marcas, para todo modelo y también en
   `create`. En la primera pasada salían **5** rutas con marca del ajeno, y **4** las ponía el doble (`POST /admin/customers`,
   `POST /admin/customers/:id/sites`, `PATCH /admin/quote-requests/:id`, `POST /admin/expenses`). Ahora las marcas solo
   viven en los cinco modelos de documento, y lo recién creado nace sin `quoteId` ni `jobId`.
   Salida de aquella pasada: `las-15-primera-pasada-doble-con-marcas-en-todo.txt`.
3. **Reventaba en la cadena del portal**, porque `export default` compilado a CJS llega como `{ default: router }`. Ahora
   cualquier reventón del propio instrumento sale **CIEGO con código 2**: visto con ese mismo fallo todavía puesto.
4. **La IA, cortada, no medía nada:** 502 en las cuatro rutas. Ahora va doblada en el transporte. Apunta el cuerpo que le
   llega y lo devuelve como texto: mide que el documento **viaja**, no lo que contestaría un modelo real.

**Controles:** el par sembrado de jv-j4n, más uno nuevo para el eje de la IA (la sembrada que no distingue manda el
ajeno al modelo; la que recorta, no). `--sin-sembrar` → CIEGO, EXIT=2 (`las-15-sin-sembrar.txt`). **Mutante** en `dist/`,
restaurado y comprobado con `cmp`: `GET /admin/attachments/:id` niega al técnico → la fila dice «le NIEGA el ajeno» y las
marcas bajan de 2 a 1 (`las-15-mutante-attachments-niega-al-tecnico.txt`). Dos pasadas finales idénticas byte a byte.

### Lo medido (`las-15-salida.txt`)

**Población:** las 15 de la sección NO-LLEGO del censo del rol, corrido hoy sobre `809527fa6`: la salida es idéntica byte
a byte a `SCRUM-1390c/censo-rol-de-entrada.txt`. Las 15 llevan receta. Dos roles por dos pasadas cada una.

| ruta | qué le pasa al técnico con el documento del compañero |
|---|---|
| `GET /admin/attachments/:id` | 🔴 le llega la foto del albarán del compañero; no mira de qué albarán es el adjunto |
| `GET /admin/customers/:id/portal-url` → `GET /cliente/:token` | 🔴 consigue el enlace de cualquier cliente, y la página lleva el concepto del presupuesto del compañero |
| `POST /admin/ai/quote-message` con `quoteId` | 🔴 el cliente y el concepto del presupuesto del compañero viajan a la IA (`quote.findFirst {id, merchantId}`) |
| `POST /admin/expenses` con `quoteId` | 🔴 escritura: imputa un gasto al presupuesto del compañero (201) |
| `POST /admin/ai/suggest-albaran-lines` | lee el albarán ajeno sin mirar el rol, pero solo usa `estado` y `modoValoracion` (`ai.routes.ts:119-133`): no viaja contenido; queda saber si existe y está en borrador (leído, no medido contra una IA real) |
| `GET /admin/me` | lee solo los números de factura del comercio, para la serie |
| `POST /admin/jobs` | solo consulta documentos del Trabajo que acaba de crear; el 500 lo provoca el doble; el 201 real, sin medir |
| las otras 8 | no leen ningún documento |

Totales del instrumento: NO-DISTINGUE 5 · NO-LLEGO 2 · SIN-DOCUMENTO 8 · RECORTA 0 · suma 15. Leídos a mano, dos de los
cinco NO-DISTINGUE (`/admin/me` y `POST /admin/jobs`) no dejan pasar nada ajeno. Cuántos tickets salen de las cuatro
puertas, lo decide el orquestador: aquí no se arregla ninguna.

### Lo que no

- **yaqu.app:** sin sesión de técnico en producción (SCRUM-1555). No lo he intentado.
- La respuesta de una IA real, y el 201 real de `POST /admin/jobs`.
- Error mío: escribí en c.20457 «6 rutas» de memoria; eran 5 (c.20458).

## SCRUM-1390e · el Técnico ya no se lleva el portal de un cliente con documentos ajenos

[Anexado por J2 (sesión jv-j2ab), equipo de Javier, el 23-oct-2026, sobre `origin/main`
`8eff88f54db6a4b776df4defb20958cbf8104f3f`. Encargo del orquestador (`cobroflash-backend-62`). Toca
`src/modules/system/app/routes/customersAdmin.routes.ts` (carril J2), un test nuevo, su línea en el inventario de
`tests/scrum419-ci-declara-lo-que-no-corre.test.mjs` y `docs/master/evidencias/SCRUM-1390e/`. Las otras tres puertas de 1390d son carril S1: van a SCRUM-1582.]

A9: comprobación → `tests/scrum1390e-el-portal-solo-lo-suyo.test.mjs`
A9: comprobación → `tests/scrum757-la-declaracion-que-nadie-lee.test.mjs`

### Qué estaba mal

Medido por J4 en 1390d (c.20457): `GET /admin/customers/:id/portal-url` le daba al Técnico el enlace del portal de
cualquier cliente, y `GET /cliente/:token` enseña todos los presupuestos y facturas del cliente sin mirar el rol. Con
eso rodeaba «ve sólo lo suyo» (c.17962, c.17963).

### El arreglo

`puedeLlevarseElPortal` (en el mismo fichero de rutas): el enlace se da sólo a quien vería TODOS los documentos que
enseña el portal, contados con las mismas dos puertas que la pestaña de documentos de la ficha (SCRUM-1403:
`wherePresupuestosVisibles`, `whereFacturasVisibles`). No escribe ningún eje propio (lo sujeta el test, por AST).
Quien ve todo el negocio no hace ninguna consulta de más. Se pregunta ANTES de `ensurePortalToken`, así que pedirlo
tampoco le escribe el token al cliente. El rechazo es el `404 {"error":"not_found"}` que la ruta ya daba a un cliente
que no existe: ni texto nuevo ni la pista de que hay algo de un compañero. La pantalla lo pinta con el mismo aviso
de error que ya tenía para ese 404 (leído en `customersView.js` y `customerDetailView.js`, no visto en navegador).

Se cuentan los dos lados (todos / suyos) en vez de buscar uno que NO sea suyo: un `NOT` sobre `teamMemberId` deja
fuera las filas con `NULL`, que son justo las de la oficina.

**De paso** (mismo fichero, mismo carril): `GET /admin/customers/:id/detail` servía el mismo enlace en crudo
(`portalToken` y `portalUrl`) si el cliente ya tenía token. Ahora pasa por la misma pregunta; al Técnico que no puede
llevárselo le sale como un cliente sin token (los dos a `null`), que es un estado que la ficha ya pinta.

### Lo medido

| qué | dónde |
| --- | --- |
| ROJO por la ruta real: el `src` de main transpilado a `dist/`, banco PGlite de SCRUM-1218c → 2 de 6 caen (`portal-url` da 200 y la ficha da el enlace); los 2 AST leen el `src` ya arreglado y por eso no caen ahí | `evidencias/SCRUM-1390e/rojo-contra-main.salida.txt` |
| VERDE: 6 de 6 en 2 pasadas | `evidencias/SCRUM-1390e/verde.salida.txt` |
| Las 4 `MUTACIONES_QUE_ME_TUMBAN` del test (catálogo del meta-guard, SCRUM-1387), con su mecánica: `src` mutado en sitio, test SIN base, bytes restaurados → las 4 mueren por su caso AST | `evidencias/SCRUM-1390e/meta-sin-base.salida.txt` |
| Esas 4 y las 2 `MUTACIONES_CON_BASE`, tomadas del test, transpiladas a `dist/` y corridas CON base → las 6 mueren (las 2 de la cuenta, por su caso) | `evidencias/SCRUM-1390e/mutar.salida.txt` |
| El banco de 1390d con el arreglo: `portal-url` pasa de SIN-DOCUMENTO a RECORTA | `evidencias/SCRUM-1390e/las-15-despues.salida.txt` |

⚠️ **El banco de 1390d no ve el efecto**, sólo que la consulta ya distingue el rol: su doble no aplica el `where` y su
`count` da 1 a los dos lados, así que sigue entregando el token y la cadena del portal sigue con la marca. El efecto
lo mide el banco PGlite (base real, `where` real).

Control del banco: `tests/scrum1403-el-tecnico-y-las-otras-puertas.test.mjs` da 4 de 6 en esta máquina ANTES y DESPUÉS,
con los mismos dos rojos: el cliente de Prisma compartido va dos campos por detrás del esquema (`Quote.archivedAt`,
`Merchant.activityKind`) y `GET /admin/quotes` revienta. Ninguna de mis dos rutas usa esos campos. No lo he
regenerado: es el compartido.

### Lo que no cierra

- ⚠️ **El token es del CLIENTE y no caduca.** Si el Técnico se lleva el enlace cuando todo era suyo y después un
  compañero le hace un presupuesto a ese cliente, el mismo enlace lo enseñará. Cerrarlo pide un token por documento o
  rotarlo, y eso es esquema o producto: no es de esta tanda.
- Los envíos que llevan el enlace al CLIENTE (`portalUrlDelCliente`: correo del presupuesto, firma del parte) no pasan
  por aquí: van a un destinatario que es el propio cliente, no al Técnico. No los he tocado.
- **yaqu.app:** sin sesión de técnico en producción (SCRUM-1555). No lo he intentado.

### Mis errores

- Di por base `7fa745dc2` (mi primer `fetch`) y la rama nació sobre `8eff88f54`: otra sesión movió `origin/main` entre
  el `fetch` y el `checkout`. Lo vi porque el guion del rojo imprime el SHA que lee; todo lo medido es sobre `8eff88f54`.
- El TAP del primer rojo lo pisaron las pasadas siguientes (el banco escribe `tap-<fichero>-0.tap` cada vez). Lo rehice
  con un guion que deja la salida en el repo.
- Mi guion de mutación, en su primera versión, exigía con base el caso AST de las mutaciones del meta-guard, y las dio
  por VIVAS a las cuatro: muta `dist/` y el caso AST lee el `src`, que no toca. El instrumento estaba mal, no el test;
  lo destapó `meta-sin-base.mjs`, que muta el `src`.
- Primera tanda local: 3 guards en rojo por mí (banco de mutación fuera del catálogo, saltos sin motivo literal y fuera
  del inventario de `scrum419`, y una aparición de `portalToken` que el censo de `scrum767` no sabía leer). Arreglé mi
  código y mi test; ningún guard. La de `scrum767`: escribía `{ ...customer, portalToken, portalUrl }`.
- Crucé los 200k de contexto sin avisar en el momento; avisé a 274.730.
- 🔴 Las 4 `MUTACIONES_QUE_ME_TUMBAN` llevaban `fichero` y `cae` en VARIABLES (`RUTAS_CLIENTE`, `CASO_*`). El lector
  del meta-guard sólo acepta literales: el obligatorio de #2722 (job 120380706936) cayó en `scrum745`, `scrum757` y
  `scrum765`, y yo no los había corrido en local. Lo arregló el relevo (J2, jv-j2ae): los cuatro campos, literales,
  sin cambiar qué mutan ni qué caso tumban. Visto en rojo con la versión anterior (27 casos de 745/757/765 = 24 ok +
  3 not ok, los mismos tres) y en verde con la nueva; `meta-sin-base.mjs` vuelve a dar las 4 MUERE.

Local, antes de empujar (41 ficheros: los guards de suite y de registro y los que tocan estas rutas): 328 casos =
319 ok + 2 not ok + 7 saltados. Los 2 rojos son `scrum1199`, que no encuentra `express` en el `node_modules` del árbol
anidado (`MODULE_NOT_FOUND`): entorno, no lo he medido en otro árbol.

## SCRUM-1390x · la Parte S1 marca CONSTRUIDO lo que ya está, y escribe que un recuento sin euros no es un documento

[Anexado por J4 (sesión jv-j4ad), equipo de Javier, el 24-oct-2026 hacia las 10:48Z (`Date:` de GitHub), sobre
`origin/main` `0a7eef15c907acc7646ed7ab33cab9176f8f1bc0`. Encargo del orquestador (`cobroflash-backend-95`). Sólo
docs: `docs/YAQU_MASTER.md` (carril «un jefe»: la decisión es del fundador) y este registro.]

A9: sin fallo que generalice — el encargo pedía marcar construidas las tres filas, y medir antes de escribir sacó que el rótulo y el vacío por rol no lo están; eso se dijo en la propia marca y no es un tropiezo mío que pueda repetirse

### La decisión

SCRUM-1346 c.20745 (24-oct-2026, la transcribe el orquestador `cobroflash-backend-95`; responde a las preguntas de
jv-j2bb en c.20735):
- **P3 «Sí»**: las filas que dicen «sin construir» se marcan CONSTRUIDAS, con fecha y motivo, sin borrar nada, citando
  1397, 1403 y 1555.
- **P2 «No, se quedan del negocio»**: los recuentos sin euros no se recortan, y el máster escribe que un recuento sin
  euros no es un documento.
- P1 (las dos bandejas de albaranes) es carril S1 y no entra aquí.

### Qué se ha cambiado: cinco líneas, en sitio

El máster tenía 1.913 líneas antes y las tiene después: ninguna cita `YAQU_MASTER.md:<n>` se desplaza. Cada cambio
AÑADE una marca fechada al final de lo que había; no se ha quitado ni una palabra.

| línea | qué decía | qué se añade |
|---|---|---|
| `:671` (Facturas) | «ver sí — es lo que hace HOY … sin construir» | ✅ CONSTRUIDA (24-oct): sólo las suyas, desde SCRUM-1397 (#2121) |
| `:680` (globos del menú) | Técnico ✅ | la línea de P2: los globos y los números de la ficha de cliente son recuentos del negocio; un recuento sin euros no es un documento |
| `:681` (Actividad reciente) | «HOY: los del negocio … sin construir» | ✅ CONSTRUIDA (24-oct): `GET /admin/metrics/inicio` recorta con `wherePresupuestosVisibles` (SCRUM-1555, #2456) · ⚠️ el rótulo y el vacío por rol NO están construidos |
| `:687` (nota «Autor o asignado») | «HOY NO ESTÁ CONSTRUIDA» | ✅ CONSTRUIDA (24-oct): 1397 (#2121), 1403 (#2130), 1555 (#2456), con el trinquete de 1346 en `FUGAS_CONOCIDAS` vacía |
| `:687` (misma línea, más adelante) | «Sin medir, y sin texto: qué enseña el bloque si la carga FALLA» | medido después en SCRUM-1390c (c.20438) |

Los merges citados, leídos en `origin/main`: SCRUM-1397 `bbe633acb852b1aaca413df4c5ebef76f1291e6c` (#2121),
SCRUM-1403 `0f6b3099ddbdbf28fd2bcc2fcdc1c55a17282f6a` (#2130), SCRUM-1555 `becfaf83094b8ddba05043e7850dbf5c6c6635bd` (#2456).

### Lo que la medición corrige del encargo

El encargo decía «se marcan CONSTRUIDAS» las tres filas. Leído el código de `main` antes de escribir:
- **El recorte sí está construido**: `invoicesAdmin.routes.ts:90` (`whereFacturasVisibles`), `quotesAdmin.routes.ts:123`
  y `metrics.routes.ts:28` (`wherePresupuestosVisibles`), y `tests/scrum1346-el-tecnico-ve-documentos-ajenos.test.mjs:64`
  con `FUGAS_CONOCIDAS = new Map([])`.
- 🔴 **Los textos firmados por rol NO lo están**: `public/dashboard/js/homeView.js:93` pinta «Actividad reciente» y
  `:647` «Sin actividad reciente» a los dos roles; «Tus presupuestos recientes» y «Todavía no tienes presupuestos…»
  (c.17962, c.17963) dan 0 resultados en `public/` y `src/`. Marcar la fila de Inicio CONSTRUIDA a secas habría hecho
  que el máster afirmara un rótulo que la pantalla no pinta, que es lo que c.17795 prohibió. Por eso la marca de `:681`
  y la de `:687` lo dicen. Construirlos es `public/` (no es carril J4) y no se toca aquí.
- La actividad de Inicio sigue **con importe** (`total`, `metrics.service.ts`): son los importes de SUS presupuestos.
  c.20735 la describe «sin importes»; el máster dice «con importe», y eso no cambia.

### Lo corrido

Guards de máster y de registro y los de suite, en local (resultado abajo, en el comentario de Jira). Suite entera
local: NO CORRIDA (10 sesiones a la vez; hace de tanda el obligatorio de CI). yaqu.app: no aplica a un cambio sólo de
docs; lo construido tampoco se puede ver allí con un Técnico (SCRUM-1555, sin sesión de técnico en producción). No lo
he intentado.
