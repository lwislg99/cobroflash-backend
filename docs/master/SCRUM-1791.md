# SCRUM-1791 · Auditoría de cierre del sprint del 21-nov: veredicto por ticket (solo docs)

**Medido contra:** `origin/main` = `0b2f6451af74f2142cf27e18c9a4c42fb56c1e65` · 2026-11-23T08:20:39Z (cabecera `Date:` de `gh api -i zen`)

A9: aviso → cicatriz J4 «filtré los PR del sprint con el patrón `17[89][0-9]` y dejé fuera a SCRUM-1779, cuya tercera cifra es un 7: la lista salía con 37 PR y ninguno era de 1779» — no se pudo comprobar: el filtro era de un solo uso y ninguna herramienta compara la lista de tickets pedidos con la de tickets que el patrón deja pasar

**Puesto:** J4 (`jv-j4ca`) · **Rama:** `scrum-1791-cierre-sprint-21nov` · encargo del orquestador J (`cobroflash-backend-2d`). Carril J4: sólo este registro y `docs/equipo/cicatrices/J4.md`. Nada en `src/`, `public/`, `prisma/` ni `tests/`. **No cierro nada: propongo.** Cierra el orquestador (A13).

## Población y cómo se midió

- **Tickets: 13.** Los siete del fundador (1779, 1780, 1781, 1782, 1783, 1784, 1785, 1786; 1779 y 1780 van juntos en su punto 7), los abiertos durante el sprint (1787, 1788, 1789, 1790) y 665, que se retomó.
- **Estado:** cada registro `docs/master/SCRUM-<n>.md` leído desde `origin/main`. 1782 no tiene registro en main: se leyó en su rama. 1790 no tiene ni registro ni rama. Además: `git log origin/main --grep`, `git ls-remote origin 'refs/heads/scrum-<n>*'` y la lista de PR de `gh pr list --state all --limit 400`, filtrada por el nombre de la rama: salen 37 PR, de ellos 33 mergeados. ⚠️ El filtro dejaba fuera a 1779 (ver A9); sus PR se sacaron de los mensajes de merge de `git log`.
- **Jira:** la descripción, los comentarios «✅» y el último de cada ticket. De 1787 y 665 sólo la descripción, como pedía el encargo: sus decisiones salen citadas de sus registros.
- **Lectura:** la hicieron cinco subagentes en paralelo, por grupos (1779-1780 · 1781-1784 · 1785/1786/1788/1789/1790 · 1787 · 665), con salida acotada.
- **Lo comprobé yo después sobre `origin/main`**, cada recuento con su positivo al lado:
  - `homeView.js:1018` sigue con `521XXXXXXXXXX` (1) y tiene 0 `selectorDePrefijo`.
  - `tipoDestinatarioPendiente.js`: «Tipo de cliente» 1 · «Factura como empresa» 0.
  - `partes.routes.ts`: `facturar` 0 (positivo: `partes`, 30).
  - `parteDetailView.js`: «Nueva factura» 0 (positivo: «Nuevo presupuesto», 1).
  - `cuerpoDelDocumentoSuelto.js`: `descripcion` 0 y `dto` 0 (positivo: «concepto», 3).
  - `quotesView.js:553` conserva el `if (!esDocumentoSuelto)`.
  - `schema.prisma` declara `due_date` y `pay_methods` en `invoices` (:891-892) y no tiene `pdf_sha256`.
- **NO medido** (por encargo: nada contra producción ni staging): `yaqu.app/health`, si los ALTER están en las bases, y ninguna pantalla de producción. Tampoco el CI de ningún PR.

## Tabla de veredictos

| ticket | Jira hoy | en main | rama sin mergear | de Luis | no empezado | lo que vio el fundador en yaqu.app | veredicto propuesto |
|---|---|---|---|---|---|---|---|
| **1779** | Acción del fundador | medición #3279 · modo sin VeriFactu #3282 · prueba en staging #3290 · aviso sólo en la factura suelta #3291 · nota A8 y correo del piloto #3292 (firma c.22289) | — | S0: las 2 filas de §3.4 de `dos-equipos.md` (c.22294 ①) · S1: qué hacen el XML y el ZIP con una factura sin huella (`SCRUM-1779.md:151`) · S1/S2: diff (`:232-254`) | 1779h, el aviso falso en albaranes (`albaranes.routes.ts:1466`) y `jobDetailView.js:3986` · el guard de 1097 pasa a dar ese comercio por decidido | c.22290: «Ok he puesto invoicing enabled en true y SIF no está. Está ya deployeado». Ninguna factura ni PDF vistos en producción | **ESPERA A LUIS** (§3.4 → 1779h) **+ DECISIÓN DEL FUNDADOR** (c.22294 ④: ¿convertir-en-factura entra en la excepción?). El aviso falso sigue en main con el flag encendido para todos |
| **1780** | Por hacer | medición #3278 · servidor `facturaDesdeParte.ts` #3297 (+1780b #3281) · literal firmado «+ Nueva factura» c.22230 | — | S1: montar la ruta, 3 líneas (`SCRUM-1780.md:259-267`), y bajar scrum411 a 4 (`:351`, c.22257) · S2: el botón (`:81-87`) | el botón (S2) | c.22244: ALTER aplicados. La ruta no está montada: nadie la ha visto | **ESPERA A LUIS** (montaje S1 + botón S2). Lo de J está en main |
| **1781** | Por hacer | prefijo en el alta #3287 · sin textos de ayuda #3294 (firma c.22275) · Clientes ya lo tenía (SCRUM-578/590) | — | S2: Inicio, presupuesto rápido (`homeView.js:1018`; `SCRUM-1781.md:23`) | Inicio | c.22313: «Sí sale el +34 y no sale lo otro, genial!» | **ESPERA A LUIS** (Inicio) · sigue abierta la pregunta 2 de c.22259 |
| **1782** | Por hacer | **nada** (0 literales en `public/` ni en `tests/`) | `scrum-1782b-rotulo-factura-como` @ `812d9793d9`, **PR #3317 CERRADO sin mergear** (2 vistas + test + scrum601/615) | S2: `tipoDestinatarioPendiente.js:58` (diff en el registro de la rama, `SCRUM-1782.md:61-71`); sin ella scrum615 sale 11/12 | — | nadie lo ha visto | **ESPERA A LUIS** (línea 58) y **ESPERA A J**: reabrir o volver a empujar 1782b, porque su PR está cerrado (regla 42) |
| **1783** | **Finalizada** | medición #3284 · sin selector #3293 | — | — | — | c.22306: «Sí, no sale el recargo de equivalencia» | **CERRAR** (ya lo está) |
| **1784** | **Finalizada** | ya existía (SCRUM-650/727b) · capturas #3286 | — | tarjeta «Cliente» a media anchura en móvil, S2/S4 (`SCRUM-1784.md:47`), sin ticket | — | c.22273: «1-Ok están perfectas», sobre capturas de main servido en local, **no de producción** | **CERRAR** (ya lo está). Fe de erratas: `SCRUM-1784.md:54` dice todavía «aprobación del fundador \| NO HECHO», y la dio en c.22273 |
| **1785** | Por hacer | PDF #3289 · rótulo con nombre comercial #3295 · con razón social #3307 | — | S2: vista previa (`SCRUM-1785.md:78-101`) · S1: «Duplicar» del PRESUPUESTO pierde `docFields` (`:103-106`) | vista previa | c.22315: «Correcto sí sale!» (1785b). 1785c no lo ha visto nadie | **ESPERA A LUIS** (vista previa + Duplicar) · pregunta abierta: ¿la vista previa lleva también el rótulo? (`:60`, c.22276) |
| **1786** | Por hacer | diseño #3283 · cabeceras fuera de la factura #3288 · f1 total del apartado #3305 | — | S1: c y d (`SCRUM-1786.md:102-103`) · S2: e (`:104`) · S1: g, la firma (`:106`) | f2 (J1, espera a d y e, c.22329) · g portal (J2) | c.22277 y c.22335: «verificación en yaqu.app NO HECHO» | **ESPERA A LUIS** (c, d, e, g-S1) **+ ESPERA A J** (f2, g-J2) · faltan 5 de 8 tramos · le falta la etiqueta `aviso-a-luis`, que c.22269 pide |
| **1787** | Por hacer | a, c, d, e, f, g, h, i, j, k, l, m, n, o, p (PR #3296 a #3316 + #3314, todos ancestros) · b entró por #3300 (rama `scrum-1787b-ficha-de-factura`, PR #3299 cerrado: su contenido sí está en main) | — | S2: conceptos apilados en móvil (`SCRUM-1787.md:241-247`) · S2: editor del suelto, Condiciones/vence/formas (`:410-418`) · S2: `descripcion`/`dto` en `cuerpoDelDocumentoSuelto.js` (`:632-674`) · S1: `docFooterText` en 3 rutas (`:561-569`) · S1: correo con líneas, T5 (`:41`) | T3: descuento global y forma de pago desde el presupuesto (`:406`, `:676`) · T4: el PDF con el dibujo del presupuesto | ninguna comprobación en producción. Sólo los ALTER de 1787d (c.22311) y 1787l (c.22346). **Que el fundador aplicara el ALTER de 1787i (`due_date`, `pay_methods`; `:734`) no lo confirma ninguna cita**, y está mergeado desde las 06:11Z | **PARTIR** + **DECISIÓN DEL FUNDADOR** (c.22322). Lo de J está entero en main; lo que queda va a hijos (Luis S1/S2, T3, T4, T5, verificar en yaqu.app) |
| **1788** | **Finalizada** | #3301 · el presupuesto no tiene el defecto (c.22317) | — | — | — | c.22321: «Perfecto ya se ven bien» | **CERRAR** (ya lo está). Fe de erratas: `SCRUM-1788.md:55` dice «no visto»; es anterior a c.22321 |
| **1789** | Por hacer | partes 1-3 #3315 (siete guards CIEGOS arreglados) | `scrum-1789b-ciego-es-rojo` @ `949428d516`, PR #3318 **DIRTY/CONFLICTING en GitHub**. ⚠️ En local, `git merge-tree` contra `0b2f6451a` sale LIMPIO: discrepancia sin explicar | S4: `guard:detalle-trabajo-917` en rojo, 42 hallazgos (`SCRUM-1789.md:28`) · S5 + fundador: hacer obligatorio el job | — | no aplica (CI). Nadie ha leído el CI de #3315 ni el de #3318 | **ESPERA A J** (que #3318 entre) **+ DECISIÓN DEL FUNDADOR**: job obligatorio (pide 917 en verde antes) o lista firmada de no-verdes (relaja un guard: regla 41) |
| **1790** | Por hacer | — | — (rama local de jv-j3cp sin commits; worktree `cobroflash-jv-j3cq` con un fichero sin seguimiento de las 08:20Z) | — | todo: test en rojo, arreglo, guard 5/5. 0 caídas en 6 pasadas; diff propuesto en c.22374 | defecto no demostrado hoy | **ESPERA A J** (J3) |
| **665** | En curso | censo y emisor congelado #1680 · medición DEV #1699 · coste de A #2968 | `scrum-665e-pdf-persistente`, **PR #3201 DIRTY**: 41 commits. Conflictos medidos: `src/lib/invoicing.ts`, `invoicesAdmin.routes.ts`, `AUDITORIA_CAMINO_EMISION.md`, `deriva-prod.sql`. Su registro (apéndices F-P) vive sólo en la rama | S1: parche `42655871` (c.21680) sobre `dirs.ts` y `adminOnlyRoutes.ts`; sin él caen scrum55 y scrum824. **No está en este repo** (`git cat-file` falla) | — | c.21710: volumen conectado · c.21943: «Railway comprobado, Sí, mergear ya». Nadie ha visto un PDF congelado al emitir | **ESPERA A LUIS** (parche) → **ESPERA A J** (volver a mergear main: 1787i/m/p tocan los generadores) **+ DECISIÓN DEL FUNDADOR** (custodia del art. 19.3 ROF · R1) |

**Resumen:** se pueden CERRAR 3 (1783, 1784 y 1788, que ya están Finalizada; dos llevan una fe de erratas en su registro). Ninguno de los 10 abiertos se puede cerrar hoy. 1787 se puede PARTIR: lo de J está entero en main.

## Preguntas al fundador sin responder

1. **SCRUM-1787 c.22322:** si se suprimen los datos de un cliente, ¿se redacta también la dirección congelada en sus facturas? Sigue abierta (`SCRUM-1787.md:177`). Esto es de mi puesto (RGPD), y la propuesta la puedo preparar yo si se me encarga.
2. **SCRUM-1787n:** «Ver detalle» con el mismo peso que en presupuestos (lo bloquea 1562g) y quitar «hace N días» (`SCRUM-1787.md:920-922`).
3. **SCRUM-1787h:** las líneas sólo se pintan en la página de pago si cuadran con el total. Lo decidió la sesión y nadie lo ha firmado (`SCRUM-1787.md:330`).
4. **SCRUM-1779 c.22294 ④:** ¿convertir-en-factura entra en la excepción? Hoy responde con el marcador de microcopy pendiente.
5. **SCRUM-1781 c.22259, pregunta 2:** ¿lleva también «Editar cliente» el selector de prefijo, aunque eso revise la decisión de SCRUM-590?
6. **SCRUM-1785, c.22276 pregunta 1:** ¿la vista previa lleva también el rótulo «WhatsApp de…»? Las firmas c.22281 y c.22328 cubren sólo el PDF.
7. **SCRUM-1789, rama 1789b:** ¿se hace obligatorio el job de guards de navegador, o se firma una lista de no-verdes?
8. **SCRUM-665:** la custodia del art. 19.3 ROF (`SCRUM-665.md:1876`) · si la R1 hereda el emisor (`:1600`, también la tiene el asesor) · pasar a Railway Pro antes de la primera factura real (c.21563).
9. **«Duplicar» de la factura: RESPONDIDA**, sin Duplicar (c.22303, `SCRUM-1787.md:190`). No va en la lista.
10. **Correo de factura con enlace:** **0 menciones** en el registro de 1787; lo único es T5, «correo con líneas» (`SCRUM-1787.md:41`). Si la pregunta se hizo, fue fuera de los registros, y no la he encontrado.

## «Para Luis»: cruce con las 12 piezas que ya le mandó el fundador

Las 12 piezas del mensaje se cuentan tal como las recibí del orquestador en el encargo. No he visto el mensaje original.

| pieza del mensaje | registro | estado en main hoy |
|---|---|---|
| 665e parche 42655871 | `SCRUM-665.md` (rama) L2037 | no está en este repo |
| 1782 línea 58 | rama `SCRUM-1782.md:61-71` | «Tipo de cliente» sigue (1) |
| 1780 montaje + botón + scrum411 | `SCRUM-1780.md:259-267, 81-87, 351` | `facturar` 0 · «Nueva factura» 0 |
| 1779 aviso falso albaranes | c.22292/c.22294 | `albaranes.routes.ts:1466` sigue |
| 1781 Inicio | `SCRUM-1781.md:23` | `homeView.js:1018` sigue |
| 1785 vista previa + Duplicar | `SCRUM-1785.md:78-106` | sin medir por mí |
| 1787e ficha presupuesto móvil | `SCRUM-1787.md:241-247` | 0 `quote-conceptos-tabla` (dato del subagente) |
| 1786 c/d/e | `SCRUM-1786.md:102-104` | — |
| 1787 editor Condiciones + description/dto | `SCRUM-1787.md:410-418, 632-674` | `quotesView.js:553` con el `if` · `descripcion` 0 |
| 1787l 3 rutas | `SCRUM-1787.md:561-569` | `docFooterText` 0 en `quotesAdmin.routes.ts` (dato del subagente) |
| paidVia en _sin-consumir | rama 1787b | ⚠️ `_sin-consumir-declarados.json` ya tiene 2 `paidVia` (:180): **puede estar hecha**. Medir antes de pedírsela |
| guard 917 y job obligatorio | `SCRUM-1789.md:28`, rama 1789b :57 | — |

**Lo que el equipo J dejó para Luis y NO está en las 12 piezas:**

1. **1779 · S0:** las 2 filas de §3.4 de `dos-equipos.md` (c.22294 ①). Sin ellas 1779h no puede empezar: la cerradura de carril para a J.
2. **1779 · S1:** qué hacen el XML y el ZIP de VeriFactu con una factura sin huella (`SCRUM-1779.md:151`). Toca el camino de emisión: es lectura para Luis.
3. **1786 · g, del lado S1:** la página de firma (`SCRUM-1786.md:106`).
4. **1787 · T5, S1:** el correo de la factura con sus líneas (`SCRUM-1787.md:41`).
5. **1784 · S2/S4:** la tarjeta «Cliente» a media anchura en `4-ficha-movil` (`SCRUM-1784.md:47`). No tiene ticket ni decisión: es del fundador decidir si se manda.
6. **1781 · opcional:** `admin.html:435` (`SCRUM-1781.md:25`), del superadmin. El registro dice que no es el alta.

## Fuera de esta auditoría (lo que el orquestador debería mirar al cerrar)

- **1787i en producción:** `due_date` y `pay_methods` ya están en el esquema de main y desplegados desde las 06:11Z. Ninguna cita confirma que el ALTER se aplicara en producción. Si no se aplicó, la lectura de facturas en producción puede fallar. **No lo he mirado** (encargo).
- **665e lleva 41 commits sin entrar**, y cada merge de 1787 en los generadores le añade conflictos. Cuanto más espere el parche de S1, más cuesta el siguiente merge.
- **1782b tiene el PR cerrado.** Ningún automatismo lo va a reabrir: una rama sin PR no aparece en el panel.

# SCRUM-1791b · Segunda auditoría de cierre del sprint del 21-nov: veredicto por ticket con lo medido hoy (solo docs)

**Medido contra:** `origin/main` = `42cae61092ba69761d6d7bba0504abe6baee1e52` · 2026-11-24T01:56:23Z (cabecera `Date:` de `gh api -i zen`)

A9: aviso → cicatriz J4 «filtré los PR del sprint con el patrón `17[89][0-9]` y dejé fuera a SCRUM-1779, cuya tercera cifra es un 7: la lista salía con 37 PR y ninguno era de 1779» — no se pudo comprobar: esta vez la población salió de `git log --first-parent 0b2f6451a..origin/main` (19 merges) y de los PR abiertos filtrados por número de ticket, pero sigue sin haber una herramienta que compare la lista pedida con la que deja pasar un filtro

**Puesto:** J4 (`jv-j4ce`) · **Rama:** `scrum-1791b-cierre-segunda-auditoria` · encargo del orquestador J (`cobroflash-backend-2d`). Sólo este registro. **No cierro nada: propongo** (A13).

## Población y cómo se midió

- **Desde la primera auditoría** (`0b2f6451a`, 23-nov 08:20Z) han entrado en main **19 PR**, no 25: #3320, #3321, #3322, #3318, #3323, #3324, #3325, #3327, #3326, #3328, #3329, #3330, #3333, #3334, #3331, #3338, #3341, #3332 y #3339. El último, #3339, a las 22:48:47Z.
- **PR abiertos de estos tickets** (en el repo hay 13 abiertos en total): #3336 (1316l), #3337 (1787w), #3340 (1532d), #3343 (1794b, abierto a las 01:54:56Z), #3335 (914d), #3201 (665e), #3277 (1005d, DIRTY), y #3014 y #2621 (914, DIRTY). En el rollup de la punta a las 01:56Z, `build + tests (con banco desechable)` sale así:
  - **FAILURE** en #3335, #3336, #3337, #3340 y #3201.
  - **Corriendo** en #3343.
  - **No he leído ningún log.** No sé si son rojos de la rama, cola perdida o de otro main. En `42cae6109` ese job sale `success`.
  - `guards de navegador` sale `failure` también en main, y no es obligatorio (c.22394).
- **Jira:** sólo el ÚLTIMO comentario de cada ticket, más el penúltimo cuando era del fundador. Lo leyeron tres subagentes, con salida acotada. Las citas de abajo son suyas: no las he releído yo en Jira.
- **Comprobado por mí en `origin/main`**, cada recuento con un positivo en el mismo fichero:
  - `homeView.js`: `521XXXXXXXXXX` 1 y `selectorDePrefijo` 0.
  - `tipoDestinatarioPendiente.js`: «Tipo de cliente» 1 y «Factura como» 0.
  - `partes.routes.ts`: `facturar` 0, con `partes` 30.
  - `parteDetailView.js`: «Nueva factura» 0, con «Nuevo presupuesto» 1.
  - `cuerpoDelDocumentoSuelto.js`: `descripcion` 0, con «concepto» 3.
  - `quotesAdmin.routes.ts` (system): `docFooterText` 0, con `router` 19.
  - `jobDetailView.js:3986` sigue con «⚠️ Factura emitida, revisa su registro».
  - `quote-conceptos-tabla`: 0 en `public/`.
- **NO medido** (por encargo): producción, staging, `yaqu.app/health` y las bases. Que 1790 está desplegado lo dice c.22411, no lo he medido yo.

## Tabla de veredictos

| ticket | en main (PR) | PR abierto | de Luis (cita) | lo que vio alguien en yaqu.app / staging | veredicto propuesto |
|---|---|---|---|---|---|
| **1779** | lo de la 1ª auditoría + 1779i (#3339, solo docs: la prueba en staging) | — | S1/S2: el aviso falso y `convertir-en-factura`. Lo pidió el fundador en c.22391 («1-Ok todos si»): «Se le pide a Luis como pieza suya… Nada se construye desde el equipo J hasta entonces» · S0: §3.4 · S1: XML/ZIP sin huella | Fundador, en Railway (c.22425): «5- Si invoicing true y SIF ausente» · J1, en staging (1779i, `SCRUM-1779.md:262`): F260005 con «Formas de pago» y «Vence el» · nadie ha visto una factura emitida en yaqu.app | **ESPERA A LUIS.** La decisión ④ de la 1ª auditoría ya está respondida (c.22391). `jobDetailView.js:3986` sigue en main |
| **1780** | #3281 + #3297 (servidor, 21-nov) | — | S1: el montaje (3 líneas) y bajar scrum411 a 4 · S2: el botón (c.22308) | nadie: `facturar` sigue en 0 en `partes.routes.ts` | **ESPERA A LUIS** (igual que en la 1ª auditoría) |
| **1781** | #3287 · #3294 · **1781d #3325** («Editar cliente» con prefijo; firma c.22402 «1-OK Sí») | — | S2: Inicio (`homeView.js:1018`, sigue igual) | c.22313: «Sí sale el +34 y no sale lo otro, genial!» (1781b/c) · 1781d: «no lo he visto en yaqu.app» (c.22406) | **PARTIR:** se cierra lo de J y un hijo con `aviso-a-luis` se lleva Inicio. La pregunta 2 de la 1ª auditoría ya está respondida y construida (1781d). Falta que el fundador vea 1781d |
| **1782** | **nada** | rama `scrum-1782b-rotulo-factura-como` @ `812d9793d9`, PR #3317 **CERRADO** a propósito: «Se reabre cuando S2 empuje la línea de tipoDestinatarioPendiente.js:58» (c.22376) | S2: la línea 58 y la bandeja (c.22272) | nadie | **ESPERA A LUIS**; después J reabre #3317 |
| **1783** | #3293 | — | — | c.22306: «Sí, no sale el recargo de equivalencia» | **CERRAR** (ya está Finalizada) |
| **1784** | #3286 | — | la tarjeta en móvil (S2/S4) | sólo capturas en local: «1-Ok están perfectas» | **CERRAR** (ya está Finalizada). Sigue pendiente la fe de erratas de `SCRUM-1784.md:54` |
| **1785** | #3289 · #3295 · #3307 | — | S2: la vista previa, que ahora lleva también el rótulo (c.22393, «1-Ok todos si») · S1: «Duplicar» pierde `docFields` | c.22315: «Correcto sí sale!» (1785b) · **1785c no lo ha visto nadie** | **PARTIR:** se cierra lo de J y un hijo con `aviso-a-luis` se lleva las tres piezas. Antes, que el fundador vea 1785c (comercio sin nombre comercial) |
| **1786** | #3283 · #3288 · #3305 · **1786g #3321** (portal) | — | S1: c, d y g (la firma) · S2: e · deuda: g pasará a usar `capitulos()` cuando S1 haga c (`SCRUM-1786.md:240+`) | c.22389: «Pendiente de ver en yaqu.app por el fundador» (1786g) | **ESPERA A LUIS** (c, d y e) **+ ESPERA A J** (f2, que espera a d y e). No se puede partir limpio: f2 es de J y depende de Luis |
| **1787** | de a a p, y **q, r, s, s-bis, t, u, v (solo docs), x, y y z** (#3323 a #3341) | **#3337** (1787w, el PDF construido): build+tests FAILURE en el rollup a las 01:56Z, sin leer | S1: los 5 caminos de 1787s (`SCRUM-1787.md:1097+`, c.22405) · S2: el editor de Condiciones y `descripcion`/`dto` del suelto · S1: las 3 rutas de Observaciones · S1: el correo T5, que ahora es **1794** | 1787r, en STAGING: «Vence el» sí, «Formas de pago» no · 1779i, en staging: las dos sí · en yaqu.app, ninguna comprobación (c.22464 tiene «mirar yaqu.app» entre lo no hecho) | **ESPERA A J** (#3337); después, **PARTIR**. Decisión firmada hoy en c.22467, «1-Nah me vale»: en los guards de recuento, la firma de un literal vale como la decisión de la regla 41 |
| **1788** | #3301 | — | — | c.22321: «Perfecto ya se ven bien» | **CERRAR** (ya está Finalizada) |
| **1789** | #3315 · **1789b #3318** (09:10Z) · 1789c (solo docs, en el registro) | — | S4: 917 en verde · S5 o el fundador: hacerlo obligatorio · S3: el driver de mutaciones (1789c, `SCRUM-1789.md:137`) | no aplica (es CI). `guards de navegador` sale `failure` en main `42cae6109` | **PARTIR:** lo de J ya está en main. Un hijo con `aviso-a-luis` se lleva 917 → obligatorio (c.22394, «1-Ok todos si») y el driver de S3 |
| **1790** | #3322 | — | — | c.22411: desplegado; «El fundador no lo ha mirado en su móvil» | **CERRAR** (ya está Finalizada, c.22411). Se reabre con captura si falla |
| **665** | lo de la 1ª auditoría | **#3201**: build+tests FAILURE, 4 de 14.162 (c.22396) | S1: el parche `42655871` · S3: una línea en `RETIRADAS_A_PROPOSITO` para scrum810 (c.22396: «DOS cosas, no una») | Railway (c.21710 / c.21943). Nadie ha visto un PDF congelado | **ESPERA A LUIS** (dos piezas). Las decisiones de la 1ª auditoría están respondidas en c.22395, «1-Ok todos si»: Hobby hasta que haya ventas, la R1 con su propio PDF, la custodia con el asesor |
| **1532** | **1532b #3332** (la ruta, el recibo y las páginas públicas) | **#3340** (1532d, el botón y el reenvío): build+tests FAILURE a las 01:56Z, sin leer | S1: la clave de auditoría `cobro_cancelado` (c.22435) · S2: el botón en `jobDetailView.js` · **S0: aviso de cruce de carril** en `scripts/_sin-consumir-declarados.json` (c.22463) | nadie: «No miró yaqu.app» (c.22462) | **ESPERA A J** (#3340); después, **PARTIR** (un hijo con S1 y S2, y la respuesta de S0 a c.22463) |
| **1316** | 1316c #3328 · 1316k #3334 · 1316m #3338 (solo docs) | **#3336** (1316l): build+tests FAILURE a las 01:56Z; c.22465 lo daba «corriendo» a las 01:40Z | S2: el selector en `jobDetailView.js` · S1: `status: true` en `cobrosPorCubo.ts:203`, y la línea de `seRegistroAMano` y el informe X2 (c.22445, no lo he leído yo) | «yaqu.app sin verificar (sin mergear)» (c.22465) | **ESPERA A J** (#3336) **+ ESPERA A LUIS**. 🔴 **Fecha: 1-dic-2026.** Es el único de la lista con fecha límite |
| **914** | el registro del diseño | **#3335** (914d) nace **ROJO a propósito** (c.22448, decisión de c.22443) · #3014 y #2621 en DIRTY | S1: `fusionClientes.ts:191` y `albaranDuplicado.ts:54` | ALTER aplicado en `yaqu_dev_javier`; los dos casos contra Postgres sin correr | **ESPERA A LUIS.** Lleva la etiqueta `equipo-luis`: no es de este sprint de J, y lo cierra quien lo tenga |
| **1794** | — | **#3343** (1794b: J2 exporta `detalleDeLaFactura`): corriendo | S1: llamarla desde `email.service.ts:99-107` (c.22461) | nadie | **ESPERA A J** (#3343); después, Luis. No se cierra en este sprint |

**Resumen:**

- **CERRAR, 4.** Los cuatro ya están Finalizada: 1783, 1784, 1788 y 1790.
- **PARTIR hoy, 3:** 1781, 1785 y 1789. Lo de J está entero en main y el resto se va a un hijo con `aviso-a-luis`.
- **ESPERAN a un PR de J abierto, 4:** 1787 (#3337), 1532 (#3340), 1316 (#3336) y 1794 (#3343). Los tres primeros salen FAILURE en el rollup; #3343 está corriendo.
- **ESPERAN sólo a Luis, 6:** 1779, 1780, 1782, 1786, 665 y 914. El de 914 es suyo: #3335 nace rojo a propósito hasta que entren sus dos líneas de S1.
- **Decisiones del fundador:** de las 8 que dejó la 1ª auditoría, no he visto ninguna sin responder. Están contestadas la ④ de 1779 (c.22391), la de 1781 (construida en 1781d), la de 1785 (c.22393), la de 1789 (c.22394) y la de 665 (c.22395). La que sigue sin respuesta visible es la de RGPD de 1787 (c.22322): no sale en ningún último comentario, y como no leí los anteriores, no sé si se contestó en otro.

## Cruce con las 27 piezas del mensaje del fundador a Luis

Tengo la lista del encargo, no el mensaje. En ella cuento **21 entradas**, no 27; puede que alguna lleve varias piezas, y desde aquí no lo puedo saber.

**Lo que el equipo J dejó para Luis y NO está en la lista:**

1. **1787 · S2:** `descripcion` y `dto` en `cuerpoDelDocumentoSuelto.js` (`SCRUM-1787.md:632-674`, con el diff hecho). La lista dice «editor Condiciones», que es otra pieza (`:410-418`). En main, `descripcion` sigue en 0.
2. **1532 · S0:** el cruce de carril en `_sin-consumir-declarados.json`. Lo pide c.22463: «para que S0 lo vea y, si prefiere otro mecanismo, lo diga».
3. **1789c · S3:** decidir la población (`SCRUM-1789.md:137-145`): los guards de navegador como segunda población, y `scrum836` leyendo `scripts/guard-*.mjs`. La lista dice «1789c driver», pero esto es una decisión A12, no sólo el driver.
4. **1316k · S1:** `seRegistroAMano` (`cobrosPorCubo.ts:234`) y el informe X2, que dice «tarjeta» (`SCRUM-1316.md:1412-1415`). Puede que lo cubra «status:true informe» de la lista; sin el mensaje no lo sé.
5. **1782 · S2:** el literal de la bandeja (c.22272), además de la línea 58.
6. **665 · S3:** la línea de `RETIRADAS_A_PROPOSITO` es de S3, no de S1. Si «línea 810» se le manda a S1, va al puesto equivocado.
7. **1781 · opcional:** `admin.html:435` (`SCRUM-1781.md:25`), del superadmin.
8. **1786g · deuda:** cuando S1 haga c, el portal pasará a usar `capitulos()`. Es trabajo de J, no de Luis, pero sólo funciona si la pieza c lo prevé.

**Y al revés:** «917+job obligatorio», «1765 24 bancos», «1502 8 marcas», «1792 guard», «1756 filas S» y «1005d contrato S3» no son de estos 17 tickets, y no los he medido.

## Fuera de esta auditoría

- **Cinco PR del sprint en FAILURE a la vez** (#3201, #3335, #3336, #3337 y #3340), mientras main está en verde. #3335 es un rojo declarado; de los otros cuatro no he leído el log. Puede haber una causa común, y no lo sé.
- **1787i en producción:** sigue sin haber una cita de que el ALTER de `due_date` y `pay_methods` esté aplicado. 1779i lo vio funcionar en staging, no en producción.
- **1779i, «visto de paso»:** la barra de estado marca «Enviada» en facturas que no se han enviado (`SCRUM-1779.md:262+`). Se le pasó al orquestador; no sé si tiene ticket.

# SCRUM-1791c · Tercera auditoría de cierre del sprint del 21-nov: qué falta, por partes y por equipo (solo docs)

**Medido contra:** `origin/main` = `3c6c651fecd17adcad2ec6088d1cf44da0110154` · 2026-11-24T06:36:58Z (cabecera `Date:` de `gh api -i zen`)

A9: aviso → cicatriz J4 «filtré los PR del sprint con el patrón `17[89][0-9]` y dejé fuera a SCRUM-1779, cuya tercera cifra es un 7: la lista salía con 37 PR y ninguno era de 1779» — no se pudo comprobar: esta vez el JQL del encargo (`labels = sprint-21nov OR key in (…)`) dejó fuera a 1792, 1793, 1798, 1801 y 1804, que no llevan la etiqueta; los saqué con un segundo JQL por clave, pero ninguna herramienta compara la lista pedida con la que devuelve el filtro

**Puesto:** J4 (`jv-j4cf`) · **Rama:** `scrum-1791c-tercera-auditoria-cierre`, que lleva dentro el merge de `scrum-1791b-cierre-segunda-auditoria` @ `2ac045dd6703bbff71e5c483e71035879e1446e0` (PR #3344, abierto, con el obligatorio CANCELADO: sin él este tramo no tendría encima el de 1791b, y los dos PR chocarían en la misma línea). **No cierro nada: propongo** (A13).

## Población y cómo se midió

- **Tickets: 24, más 7 hijos.** 1779 a 1790, 1793 a 1795, 1799 a 1803, 665, 914, 1316, 1532 (los J y los dos de Luis que el encargo nombra) y, como hijos, 1796, 1797, 1798, 1804, 1805, 1806 y 1807. 1791 (esta auditoría) y 1792 (guard de J6, sin etiqueta del sprint) no entran.
- **Jira:** sólo `summary`, `status` y `labels`, de dos JQL (el del encargo, 27 tickets, y uno por clave para los 5 que dejaba fuera). **No he leído descripciones ni comentarios.** Por eso las «partes del enunciado» de abajo NO son el literal del fundador leído en Jira: son las piezas que ya habían separado 1791a y 1791b en sus tablas y los títulos de los hijos. El encargo pedía el literal; no lo he podido traer sin leer las descripciones, y lo digo aquí.
- **Main:** `git log --first-parent 42cae6109..origin/main`: **9 merges** desde 1791b — #3342 (1264a), #3336 (1316l), #3343 (1794b), #3347 (1779m), #3337 (1787w), #3351 (1802), #3350 (1800 ①), #3346 (1793), #3349 (1779l). Coinciden con los 8 del encargo más #3342, que no es del sprint.
- **PR abiertos** (`gh pr list --state open`, 16): de J, #3340 (1532d), #3352 (1801), #3353 (1803), #3354 (1800b) con `build + tests` **corriendo** a las 06:37Z; #3348 (1799) **DIRTY** con el obligatorio en SUCCESS (conflicto con main: no se mergea); #3344 (1791b) BLOCKED con el obligatorio CANCELADO. De Luis o mixtos: #3201 (665e) y #3335 (914d) en **FAILURE**. No he leído ningún log.
- **Comprobado por mí en `origin/main`**, con positivo: `homeView.js` sigue con `521XXXXXXXXXX` (1); `tipoDestinatarioPendiente.js` sigue con «Tipo de cliente» (1); `jobDetailView.js` sigue con «Factura emitida, revisa su registro» (1); `facturar` en las rutas de partes: 0. Es decir: **ninguna de las cuatro piezas de Luis que sé localizar ha entrado**.
- 🔴 **1795 está Finalizada y no tiene ni un commit ni un PR con su número** (`git log origin/main -i --grep=1795` sólo da tres commits de otros tickets; `gh pr list --search "1795 in:title"`: 0). Puede estar resuelto dentro de otro tramo; no lo he leído, así que **no lo cuento ni como hecho ni como pendiente**.
- **NO medido** (por encargo): producción, staging, `yaqu.app/health`, las bases. Lo de «visto en yaqu.app/staging» sale de las citas de 1791a y 1791b, no releídas.

## Tabla: qué falta por ticket

Columnas: **J en main** (hecho) · **J pendiente** (PR o sesión) · **Luis pendiente** (hijo) · visto · veredicto.

| ticket (Jira hoy) | J en main | J pendiente | Luis pendiente (hijo) | visto en yaqu.app / staging | veredicto |
|---|---|---|---|---|---|
| **1779** (Acción del fundador) | medición #3279 · modo sin VeriFactu #3282 · staging #3290, #3339, #3347, #3349 · aviso #3291 · nota y correo #3292 — **4/4** | — | S0 §3.4 · S1/S2 aviso falso en albaranes y `convertir-en-factura` (`jobDetailView.js` sigue) · S1 XML/ZIP sin huella — **0/3**, sin hijo propio | fundador en Railway (c.22425); J1 en staging (1779i). Nadie ha visto una factura emitida en yaqu.app | **DECISIÓN DEL FUNDADOR** (cambio de máster) **+ ESPERA A LUIS** (no tiene hijo: las 3 piezas viajan en el mensaje) |
| **1780** (Por hacer) | medición #3278 · servidor #3281 #3297 · literal c.22230 — **3/3** | — | S1 montar la ruta · S1 scrum411 a 4 · S2 el botón — **0/3**, sin hijo | nadie: la ruta no está montada | **ESPERA A LUIS** · le falta un hijo `aviso-a-luis` como los demás |
| **1781** (Finalizada) | #3287 · #3294 · #3325 — **3/3** | — | Inicio → **1796** (0/1) | c.22313 (1781b/c); 1781d sin ver | CERRADO (partido) · espera a 1796 |
| **1782** (Finalizada) | **nada** | — (la rama `scrum-1782b-rotulo-factura-como`, PR #3317 cerrado, la reabre el hijo) | línea 58 + bandeja + reabrir #3317 → **1806** (0/2) | nadie | CERRADO (partido) · 🔴 **lo de J está en una rama sin PR abierto** (regla 42): si 1806 no la reabre, no entra nunca |
| **1783** (Finalizada) | #3284 · #3293 — **2/2** | — | — | c.22306 | CERRADO |
| **1784** (Finalizada) | #3286 — **2/2** | — | tarjeta en móvil: sin ticket ni decisión (no cuenta) | capturas en local, no en yaqu.app | CERRADO |
| **1785** (Finalizada) | #3289 · #3295 · #3307 — **3/3** | — | vista previa · Duplicar · rótulo en la vista previa → **1797** (0/3) | 1785b c.22315; 1785c sin ver | CERRADO (partido) · espera a 1797 |
| **1786** (Finalizada) | #3283 · #3288 · #3305 · #3321 — **4/5** | **f2** (J1): espera a d y e de Luis | c · d · e · g-firma → **1807** (0/4) | 1786g «pendiente de ver» (c.22389) | CERRADO (partido) · 🔴 **f2 es de J y no tiene ticket propio** que yo vea: al cerrarse 1786 se queda sin casa |
| **1787** (Finalizada) | de a a z, más w (#3337, 03:09Z) y la ficha sin cero (1802, #3351) — editor-servidor, ficha, PDF, página de pago y correo-J (#3343) — **5/6** | **1799** (T4: filas restantes), #3348 **DIRTY** | editor · Observaciones en 3 rutas · formas de pago en 5 caminos · correo T5 · ficha de presupuesto en móvil → **1805** (0/5) | staging: 1787r y 1779i; yaqu.app: ninguna | CERRADO (partido) · espera a 1799 (J) y 1805 (Luis) |
| **1788** (Finalizada) | #3301 — **1/1** | — | — | c.22321 | CERRADO |
| **1789** (Finalizada) | #3315 · #3318 — **2/2** | — | 917 verde (S4) · job obligatorio (S5) · medidor de mutaciones (S3) → **1798** (0/3) | no aplica (CI) | CERRADO (partido) · espera a 1798 |
| **1790** (Finalizada) | #3322 — **1/1** | — | — | desplegado (c.22411); sin ver en móvil | CERRADO |
| **1793** (Finalizada) | #3346 — **1/1** | — | — | no aplica | CERRADO |
| **1795** (Finalizada) | **0 commits y 0 PR con su número** | — | — | jv-j1im en staging (título) | **sin juzgar**: que el orquestador diga dónde entró |
| **1802** (Finalizada) | #3351 — **1/1** | — | — | nadie | CERRADO |
| **1794** (Por hacer) | 1794b #3343 (contada en 1787) | — | llamarla desde `email.service.ts` (S1): va dentro de **1805** (contada allí) | nadie | **PARTIR o cerrar contra 1805**: su parte J está en main |
| **1799** (Por hacer) | — | #3348 **DIRTY**, obligatorio SUCCESS (contada en 1787) | — | — | **ESPERA A J**: `git merge origin/main` en su rama (A4) |
| **1800** (Por hacer) | ① 409 #3350 — **1/2** | ② recibo «a continuación»: #3354 (jv-j2el), CI corriendo · ③ es 1803 | — | jv en staging (título: cobro 889) | **ESPERA A J** (#3354) |
| **1801** (Por hacer) | — | #3352 (jv-j6fi), CI corriendo; el encargo dice 4 rojos — **0/1** | aviso-a-luis en la etiqueta: no sé qué pieza (no leí la descripción) | no aplica | **ESPERA A J** (#3352) |
| **1803** (Por hacer) | — | #3353 (jv-j1je), CI corriendo · 1803b después (c.22506) — **0/2** | — | nadie | **ESPERA A J** |
| **1532** (Por hacer) | 1532 #2360 · 1532b #3332 — **1/2** (cuento la medición #2360 como base, no como parte) | 1532d #3340 (botón y reenvío), CI corriendo | clave de auditoría `cobro_cancelado` (S1) · cruce de carril `_sin-consumir-declarados.json` (S0, c.22463) — **0/2**, sin hijo | «No miró yaqu.app» (c.22462) | **ESPERA A J** (#3340); después PARTIR con hijo de Luis |
| **1316** (Finalizada) | 1316c #3328 · 1316k #3334 · 1316l #3336 · 1316m #3338 — **4/4** | — | aviso del 10 % en el editor · selector obligatorio en la ficha · `status: true` en el informe X2 → **1804** (0/3) | sin verificar en yaqu.app (c.22465, antes del merge) | CERRADO (partido) · 🔴 **FECHA 1-dic-2026: quedan 7 días y lo de Luis está a 0/3** |
| **665** (En curso) | #1680 · #1699 · #2968 — **3/4** | 665e #3201 **FAILURE** (41 commits) | parche `42655871` (S1) · línea de `RETIRADAS_A_PROPOSITO` (S3) — **0/2**, sin hijo | Railway (c.21943); ningún PDF congelado visto | **ESPERA A LUIS** (dos piezas) → luego J |
| **914** (En curso, `equipo-luis`) | — | — | `fusionClientes.ts:191` y `albaranDuplicado.ts:54` (S1); #3335 rojo a propósito — **0/2** | ALTER sólo en `yaqu_dev_javier` | **ESPERA A LUIS**: es suyo |

Los siete hijos (1796, 1797, 1798, 1804, 1805, 1806, 1807) están **Por hacer**. ⚠️ **1796, 1797 y 1798 no llevan la etiqueta `equipo-luis`** (sólo `aviso-a-luis`); 1804 a 1807 sí. Si Luis filtra su tablero por `equipo-luis`, no ve tres de los siete.

## Qué falta del lado J para cerrar el sprint

1. **#3354** · 1800 ② recibo «a continuación» (jv-j2el) — CI corriendo.
2. **#3353** · 1803 pago manual cierra el cobro (jv-j1je), y después 1803b — CI corriendo.
3. **#3340** · 1532d botón y reenvío — CI corriendo; al entrar, partir 1532 con hijo de Luis.
4. **#3352** · 1801 guard de rama con número (jv-j6fi) — CI corriendo.
5. **#3348** · 1799 T4 filas restantes — **DIRTY**: hace falta `git merge origin/main` en su rama.
6. **1786 f2** (J1) — sin PR y sin ticket propio; espera a 1807 (d y e).
7. **665e #3201** — volver a poner al día con main cuando llegue el parche de S1.
8. **1782b** — la rama existe y su PR está cerrado; la reapertura está escrita en 1806, que es de Luis. Alguien de J tiene que mergear main en ella cuando S2 empuje.
9. **1795** — decir dónde entró (0 commits con su número).
10. **#3344** (1791b) — obligatorio CANCELADO; si entra este PR, #3344 se queda vacío y se cierra.

## Qué falta del lado de Luis

1. **1804** · IVA 10 % y medio de cobro (S2/S1), 3 piezas — 🔴 **fecha 1-dic-2026**.
2. **1805** · facturas iguales que presupuestos, parte S: editor, Observaciones, formas de pago, correo T5 (incluye lo de 1794), ficha en móvil — 5 piezas.
3. **1807** · apartados c, d, e y g-firma — 4 piezas (desbloquea f2 de J).
4. **1797** · vista previa, Duplicar y rótulo — 3 piezas.
5. **1798** · 917 verde, job obligatorio, medidor de mutaciones — 3 piezas.
6. **1806** · línea 58, bandeja y reabrir #3317 — 2 piezas.
7. **1796** · Inicio con prefijo — 1 pieza.
8. **Sin hijo:** 1779 (S0 §3.4, S1/S2 aviso falso, S1 XML/ZIP: 3) · 1780 (montaje, scrum411, botón: 3) · 1532 (S1 clave, S0 cruce: 2) · 665 (S1 parche, S3 línea: 2) · 914 (S1: 2).

## El porcentaje, medido por partes

Cómo lo conté: **una parte = una pieza con dueño único** tal como la separan 1791a, 1791b y los títulos de los hijos. Lo de Luis se cuenta una vez, en el padre (los hijos no suman otra vez). 1794 y 1799 se cuentan dentro de 1787 (J) y 1805 (Luis), no en su fila. Fuera: 1795 (sin juzgar), 1784-tarjeta (sin decisión), 1791 y 1792. Una parte está HECHA sólo si su commit está en `origin/main` `3c6c651fe`; un PR verde sin mergear NO cuenta.

| equipo | hechas | total | % |
|---|---|---|---|
| **J** | 41 | 49 | **84 %** |
| **Luis (S0–S5)** | 0 | 33 | **0 %** |
| **sprint** | 41 | 82 | **50 %** |

Por tickets, en cambio, 14 de los 23 de J están Finalizada (61 %), y de ahí puede salir una cifra alta. **El 94 % no lo he podido reproducir con ninguna de las dos cuentas**; no sé con qué se calculó. Lo que no se mueve es la columna de Luis: **0 de 33 piezas en main** (cuatro comprobadas por recuento, el resto por ausencia de commit con el número del hijo, que es un «no lo he visto», no un «no existe» en una rama suya).
