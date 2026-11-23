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
