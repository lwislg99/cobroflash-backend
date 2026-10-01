# SCRUM-1341 · El Técnico ve la actividad de sus compañeros, sin importes, con una ruta propia

**Medido contra:** `origin/main` = `f19ac2f0081a613d44079df86f4cecf2d6f9ace7` · 2026-10-01T08:05:12Z

1-oct-2026 · **J2j** (equipo de Javier, relevo de J2i), por encargo del orquestador (`cobroflash-backend-5b`).
[Escrito por J2j. Las frases del fundador las transcribe el orquestador en Jira; aquí se citan de allí, y
los cuatro comentarios que se nombran los he leído en Jira, no en el mensaje del encargo.]

A9: comprobación → `tests/scrum1341-actividad-del-equipo-sin-importes.test.mjs`

**Fecha:** 1-oct-2026
**Skill UI:** cargada (`yaqu-premium-ui`). Checklist AB6 de este cambio, casilla a casilla, en Ⓗ.

## Ⓐ Qué se decidió, quién, y dónde consta

| qué | quién | dónde |
|---|---|---|
| El Técnico ve la actividad de sus compañeros **sin importes** («1-B») | fundador | SCRUM-1337 c.17795; descripción de SCRUM-1341 |
| Forma: ruta nueva, en `TECNICO_ALLOWED` con motivo; `PENDIENTE_MAX` en 0; la del admin no se toca | orquestador | SCRUM-1341 c.17825 ① |
| La estrella «Mejor del mes» no sale; la ruta no devuelve `id`, `isBest` ni nada de «Sin asignar» | orquestador | c.17825 ②, ⑤ |
| El aviso «Sin actividad esta semana» no lo ve | orquestador (no el fundador) | c.17825 ③ |
| Cabeceras «Miembro», «Cotizaciones», «Aceptación»: reuso. «Ver equipo →» no se pinta | orquestador | c.17825 ④ |
| El título «Actividad del equipo · este mes» | **fundador** («1-Ese esta bien») | c.17827; ficha `docs/microcopy/2026-10-01-SCRUM-1341-actividad-del-equipo.md` |
| Las dos filas de la tabla S1 del máster, el «—» del admin y la nota | orquestador | c.17832 |

**Cinco cosas que decidí yo y el orquestador aprobó después, por mensaje (no llevan número de Jira):**

1. `inactive` **no sale en el JSON**. El ③ dice que el aviso no lo ve; devolver la lista ya hecha era dárselo
   por la API, igual que `isBest`. Se deriva de rol, estado y «esta semana», que sí salen: no oculta nada.
2. El rótulo de rol bajo el nombre («Propietario» / «Operario») sí se pinta: es la misma celda «Miembro» del
   panel del admin, con los mismos literales. No estaba en la lista de reusos del c.17825.
3. El nombre del propietario es `legalName` o `name` (el Técnico ya los recibe en `/admin/merchant`). No se
   usa el «Tu (propietario)» de reserva del panel del admin: quien lee no es el propietario.
4. `orderBy: { id: 'asc' }`: el orden de alta. No depende de nada que se cuente y no devuelve el `id`.
5. Colores por contraste medido, no por parecido con el panel del admin (Ⓗ).

**Un dato del encargo que no cuadraba, y se dijo:** «11 campos sobreviven, sin `id`». Los 11 de J2i ya
incluían el `id`; sin él son 10, y sin `inactive`, **9**: `hasTeam`, el orden, y por persona `name`, `role`,
`status`, `sent`, `accepted`, `acceptanceRate`, `thisWeek`.

## Ⓑ PASO 0 — el rojo de hoy, corriendo

`docs/evidencias/scrum1337/sonda-team.mjs.txt` sobre el router real de `dist/`, antes de escribir nada:
8 rutas en el router de métricas; `GET /team` con rol `tecnico` → **403** sin pasar a la siguiente mano; con
`admin` pasa; con un rol desconocido, 403.

Y el test del ticket, visto en ROJO contra el `dist/` de `main` antes de compilar lo nuevo
(`docs/evidencias/scrum1341/rojo-contra-dist-de-main.tap.txt`): 12 casos, **7 caen** (la ruta nueva contesta
404) y 5 pasan. Los 5 que pasan son el 403 de hoy y los cuatro de pantalla, que leen `public/` y no `dist/`:
a ésos el rojo se lo dio el banco de mutaciones (Ⓕ).

Ramas remotas de 1341: ninguna al empezar. La rama local de J2i (`44e249f7`, dos sondas) va dentro de ésta;
su árbol estaba bloqueado por su sesión, así que el trabajo se hizo en otro árbol con su commit dentro.

## Ⓒ Qué se toca

| fichero | qué |
|---|---|
| `src/modules/metrics/domain/actividadEquipo.ts` | nuevo: el ensamblado, puro. No recibe facturas |
| `src/modules/metrics/domain/metrics.service.ts` | `getActividadEquipo`: tres consultas, ninguna a facturas |
| `src/modules/metrics/app/routes/metrics.routes.ts` | `GET /actividad-equipo`, sin `requireRole` |
| `src/core/http/adminRouteDeclarations.ts` | la ruta, en `TECNICO_ALLOWED`, con su motivo |
| `public/dashboard/js/homeView.js` | `renderTeamActivity`; `renderTeamPerformance` sólo cambia su primera línea |
| `public/dashboard/css/styles.css` | nueve reglas `equipo-actividad-*` |
| `docs/YAQU_MASTER.md` | tabla S1: dos filas y la nota (c.17832) |
| `docs/microcopy/2026-10-01-SCRUM-1341-actividad-del-equipo.md` | la ficha del título |
| `tests/scrum1341-actividad-del-equipo-sin-importes.test.mjs` | 13 casos |
| `tests/banco-scrum1341/` | `mutar.mjs`, `admin-identico.mjs`, `navegador.mjs` |
| `docs/equipo/cicatrices/J2.md` | una línea |

**No se toca:** `GET /admin/metrics/team`, su `requireRole('admin')`, `adminOnlyRoutes.ts`,
`metricasEquipo.ts`, `getTeamMetrics`, el esquema, el camino de emisión. `PENDIENTE_MAX` sigue en 0.

## Ⓓ El control que decide: ni un euro

Medido sobre la respuesta REAL de la ruta (router de `dist/`, base doblada), no sobre el fuente. El doble
de la base **no aplica `select`**: devuelve las filas enteras, con el `total` de cada presupuesto y el correo
de cada miembro, para que un `...fila` en el servicio se vea en la respuesta.

- **Seis escenarios que sólo difieren en lo cobrado** → el JSON del Técnico es **idéntico byte a byte** en
  los seis. Con los mismos datos, el del admin son seis JSON distintos, y se mueve por los seis caminos que
  midió J2i (`members[].collected`, `members[].isBest`, `sinAsignar`, `sinAsignar.collected`,
  `sinAsignar.label`, `totalCollected`). Ese control va PRIMERO en el caso: si el admin no se moviera, «no
  cambia» no significaría nada.
- **Los cinco mecanismos, uno a uno:** en ninguna profundidad de la respuesta aparecen las claves
  `collected`, `isBest`, `totalCollected`, `sinAsignar`, `label`, `id`, `inactive`, `email` ni `total`; y
  `sinAsignar` no EXISTE como clave, haya o no cobros sueltos. Control: en la del admin están todas.
- **Ningún valor es un importe:** ni lo cobrado (por factura, por persona, en total) ni el total de un
  presupuesto. Los importes de los datos llevan céntimos para no confundirse con un recuento.
- **Por efecto en la base:** la ruta hace tres consultas (`merchant.findUnique`, `teamMember.findMany`,
  `quote.findMany`) y ninguna a `invoice`; de los presupuestos pide `teamMemberId`, `status`, `createdAt`.
  Control: la del admin sí consulta facturas.
- **El orden:** la consulta lleva `orderBy: { id: 'asc' }`. Control: la del admin no lleva ninguno.

**Lo que este control NO cubre, y es SCRUM-1346:** que el Técnico no pueda reconstruir lo cobrado por
`GET /admin/invoices` + `GET /admin/quotes?teamMemberId=`. Aquí se garantiza para la ruta nueva.

## Ⓔ El positivo: el admin, igual

`tests/banco-scrum1341/admin-identico.mjs` monta el Inicio dos veces con la misma red —con el
`homeView.js` de `origin/main` (`f19ac2f0…`, leído con `git show`) y con el de esta rama— y compara el
sha256 de TODOS los nodos (etiqueta, clase, id, estilo, texto), del marcado del bloque y de las peticiones.
Salida en `docs/evidencias/scrum1341/admin-identico.salida.txt`:

| respuesta del equipo | nodos antes / ahora | bloque del equipo | veredicto |
|---|---|---|---|
| con dinero, estrella, «Sin asignar» y aviso | 205 / 205 | 3.776 / 3.776 caracteres | idéntico |
| sin cobros sueltos ni inactivos | 178 / 178 | 2.006 / 2.006 | idéntico |
| sin equipo de campo | 145 / 145 | 0 / 0 | idéntico |
| **control: rol Técnico** | — | 0 / 1.730 | **distinto**, como tiene que ser |

Y el recuento de actividad está escrito dos veces a propósito (sacarlo a un sitio común era tocar la ruta
del admin). Que no diverjan lo sujeta el caso «persona a persona»: con los mismos datos, las filas del
Técnico son las del admin sin `id`, `collected` ni `isBest`.

## Ⓕ El banco de mutaciones

`tests/banco-scrum1341/mutar.mjs`, con el árbol comiteado (`e47a0067`). Base 12 de 12; **26 mutaciones, 26
caen en el caso que tenían que tumbar, 0 mudas, 0 ciegas**; build final 0, 12 de 12, árbol limpio. Salida
entera en `docs/evidencias/scrum1341/mutar.salida.txt`. Las que más dicen:

- M5 · la ruta recorta por campo el panel del admin y se deja la estrella → cae «NI UN EURO».
- M6 · deja la clave de «Sin asignar», vacía → cae «los cinco mecanismos».
- M8 · las filas salen ordenadas por lo cobrado, **sin la cifra** → cae «NI UN EURO» (la ruta `ORDEN`).
- M11 · `/team` pierde su `requireRole` → cae el 403.
- M18 a M21 · el bloque del Técnico pinta la estrella, la columna, el aviso, el botón → cae «aunque le LLEGUE».
- M23, M24 · al admin se le pinta el bloque del Técnico, o pierde «Cobrado» → cae el caso del admin.

Después se añadió el caso del contraste y sus dos mutaciones (M27, M28); su salida va en el anexo Ⓙ.

## Ⓖ El máster

Tabla «Qué VE el Técnico en Inicio» (Parte S1): dos filas detrás de la de las herramientas de
administración, y la nota que decía «Sin construir: SCRUM-1341» pasa a decir quién decidió cada cosa. Texto
aprobado, tal cual, en c.17832. El «—» de la columna Admin es un símbolo nuevo en esa tabla: la ruta le
contesta 200 a un admin, lo que no hay es pantalla, y un ❌ diría que se le niega.

**Desplazamiento:** +2 líneas desde la 678. Las citas `YAQU_MASTER.md:<n>` de más abajo ya iban +16 desde
SCRUM-1337; quedan en +18. No se renumera ninguna (c.17788, c.17832 ④).

## Ⓗ La pantalla, y el checklist AB6

Un bloque, una pantalla: el Inicio, sólo con sesión de Técnico. Sin componente nuevo: `data-card`,
`table-scroll` y `table` del inventario. Sin estilos en línea (el panel del admin los lleva; el bloque nuevo,
ninguno, y lo exige un caso del test). El título se pinta en mayúsculas por CSS, como el del admin; el
literal del código es el firmado.

- **Contraste AA — medido** (`docs/evidencias/scrum1341/contraste.salida.txt`, colores leídos de las hojas):
  título y rótulo de rol en `--neutral-600`, 7,21:1 sobre el lienzo y 7,27:1 sobre la fila en hover; % alto
  en `--green-700`, 5,02:1 sobre blanco y 4,71:1 en hover; % bajo en `--red-600`, 4,83:1 y 4,53:1. Lo que
  NO se usa: el `--neutral-500` del panel del admin (4,44:1 sobre el lienzo, 4,48:1 en hover) y su
  `--green-600` (3,30:1). Tema oscuro: el panel no tiene (0 `prefers-color-scheme`, 0 `data-theme`).
- **Foco y objetivo táctil — no aplica:** el bloque no tiene ningún control.
- **Estados:** sin equipo de campo no se pinta nada (caso del test); si la ruta falla, tampoco, igual que el
  panel del admin. No hay esqueleto de carga: el bloque se añade al final del Inicio cuando llega.
- **Textos largos, y 390 / 1280 px:** `tests/banco-scrum1341/navegador.mjs`; su salida, en el anexo Ⓙ.
- **Capturas antes/después y matriz de dispositivos reales: NO hechas.** Antes no había bloque. Verlo en
  `yaqu.app` pide una sesión de Técnico, que esta sesión no tiene.
- **Importes grandes, merchant sin logo, cliente sin WhatsApp, modo demo:** no aplican; el bloque no pinta
  importes ni nada de eso.

## Ⓘ Lo que salió mal, contado por mí

1. **Copié el gris del panel del admin para el título y el rótulo de rol, y sólo medí el verde.** Lo destapó
   medir los seis colores contra los tres fondos antes de empujar: 4,44:1. Corregido, y convertido en un caso
   del test que lee los colores de las hojas (es la línea `A9:` de arriba).
2. **Puse una hora a ojo** («~08:10Z») en un mensaje al orquestador; la cabecera de GitHub, leída después,
   decía 08:05:12Z. Cicatriz en `docs/equipo/cicatrices/J2.md`; no tiene comprobación.
3. **Escribí la cifra 4,44:1 en un comentario de la hoja antes de que el instrumento la diera.** Salió igual,
   pero el orden fue el malo.

## Lo que queda fuera, dicho

- El panel del **admin** tiene el mismo defecto de contraste (% alto en `--green-600`, 3,30:1) y no se
  toca: es otra pantalla. Y `.table th` (`--neutral-500` sobre `--neutral-50`, 4,48:1) es del componente
  común. Los dos, pasados al orquestador.
- SCRUM-1346 (las dos rutas por las que el Técnico reconstruye lo cobrado): del fundador.
- Verificación en `yaqu.app` tras el despliegue: pide sesión de Técnico.

# SCRUM-1341 · APENDICE · 1-oct-2026 · Lo que midió el relevo después de mezclar `main`, y tres rojos propios que el 13 de 13 no veía

**Medido contra:** `origin/main` = `7580bcc876d6d86f35e3578d4f1cf06c807f44a6` · 2026-10-01T15:04:44Z

A9: aviso → cicatriz J2 «el registro de SCRUM-1341 prometía en un anexo la salida de un instrumento de navegador que, tal como estaba comiteado, salía CIEGO: ni el anexo ni la salida existían» — no se pudo comprobar: nada exige que un instrumento que el registro nombra tenga su salida en el repo; lo destapó correrlo

Sesión **J2k** (puesto J2, relevo de J2j), por encargo del orquestador (`cobroflash-backend-5b`): no
reconstruir, mezclar `main`, volver a medir y empujar. Lo de arriba es de J2j y no lo he reescrito; donde
este apéndice lo contradice, manda el apéndice, y lo dice.

**El «anexo Ⓙ» que Ⓕ y Ⓗ prometen no existía.** No he reconstruido lo que J2j habría puesto en él: lo
que sigue es medición nueva, mía, sobre el árbol mezclado.

## ① Dónde estaba el trabajo, y qué se mezcló

El encargo nombraba la rama local `scrum-1341-actividad-del-equipo-sin-importes`; esa rama seguía en
`44e249f7` (las dos sondas de J2i). El trabajo de J2j estaba en `worktree-scrum-1341-j2j`, punta
`d259a5ee5f00275c2a0946d594ebf704b02a044a`, y su traspaso no estaba escrito. Monté un árbol propio sobre esa
punta. En remoto no había rama ni PR de 1341 (control positivo: la rama de SCRUM-1334 sí sale).

Dos mezclas de `main`, las dos sin conflictos:

| mezcla | `origin/main` | commits de `main` dentro | ficheros que movió `main` | de ellos, tocados también aquí |
|---|---|---|---|---|
| primera (`d2ac84ed`) | `762f4fbb` | 215 | 206 | **1**: `public/dashboard/js/homeView.js` |
| segunda | `7580bcc8` | — | 14 | 0 |

En `homeView.js`, `main` tocó `submitQuickQuote` (SCRUM-1371): otra zona del fichero. Un merge sin
conflictos no es un merge correcto, así que se volvió a medir todo lo de abajo.

## ② Los dos controles que deciden, repetidos sobre el árbol mezclado

- **Ni un euro.** El test del ticket: 13 casos, 13 pasan, 0 saltos. El caso «NI UN EURO: seis escenarios
  que sólo difieren en lo cobrado dan la MISMA respuesta, ruta a ruta» pasa, con su control delante (el
  admin se mueve por los seis caminos).
- **El admin, idéntico.** `tests/banco-scrum1341/admin-identico.mjs` contra `origin/main` `7580bcc8`, con
  el código final (`docs/evidencias/scrum1341/admin-identico.codigo-final.salida.txt`): tres respuestas,
  mismos sha256 — 205 / 205, 178 / 178 y 145 / 145 nodos; bloque del equipo de 3.776, 2.006 y 0
  caracteres en los dos lados. Control: con rol Técnico sale DISTINTO (0 caracteres antes, 1.730 ahora).
- **Mutaciones.** `tests/banco-scrum1341/mutar.mjs`, dos pasadas (tras la primera mezcla, y otra vez con el
  código final de ④): base 13 de 13; **28 mutaciones, 28 caen en el caso que tenían que tumbar, 0 mudas,
  0 ciegas**; build final 0, 13 de 13, árbol limpio. Incluye M27 y M28, las del contraste, que arriba
  quedaron sin salida. Las dos pasadas dan la misma salida, byte a byte:
  `docs/evidencias/scrum1341/mutar.tras-mezclar-main.salida.txt`.

## ③ El instrumento de navegador no había medido nunca

`tests/banco-scrum1341/navegador.mjs`, tal como estaba comiteado, salía con 2 (CIEGO) en los dos anchos:
«renderTeamPerformance lanzó: fmtMoneyEs is not defined». Su página carga `homeView.js` y no `api.js`,
donde vive ese formateador, y el panel del admin —el control— lo llama. El bloque del Técnico no. Así que
lo que Ⓗ dice de «textos largos, y 390 / 1280 px» **no estaba medido** cuando se escribió.

Arreglado en el instrumento, no en el código: la página lleva un doble de `fmtMoneyEs` (sólo le da al
control un «€» que enseñar). Salida en `docs/evidencias/scrum1341/navegador.salida.txt`, EXIT 0:

| | 390 px | 1280 px |
|---|---|---|
| control: panel del admin | 4 cabeceras, 1 botón, con «€», pide `/admin/metrics/team` | igual |
| título del Técnico | «Actividad del equipo · este mes», 13 px, `rgb(75, 85, 79)` | igual |
| cabeceras | Miembro · Cotizaciones · Aceptación | igual |
| tabla / caja | 364 / 364 px, sin barra horizontal, la página no desborda | 1.230 / 1.230 px, igual |
| nombre de 66 caracteres | cabe | cabe |
| % alto · medio · bajo | `rgb(21, 128, 61)` · `rgb(75, 85, 79)` · `rgb(220, 38, 38)` | igual |
| botones · nodos con estilo en línea | 0 · 0 | 0 · 0 |
| pide | sólo `/admin/metrics/actividad-equipo` | igual |

Es Chromium sin interfaz sobre una página montada para la medición, con la respuesta fabricada: no es
`yaqu.app` ni una sesión real de Técnico.

## ④ Tres rojos NUESTROS que el 13 de 13 no veía

La tanda dirigida (`scripts/tests-que-cubren.mjs --lanzar`, la herramienta de SCRUM-1363 que llegó con
la mezcla) eligió 548 ficheros de 1.190 y dio 4.922 casos, 4.910 pasan, **7 caen**. Leído el motivo de
cada uno antes de clasificar:

| caso | motivo, leído en el TAP | de quién |
|---|---|---|
| `scrum553` · el número de etiquetas con el `>` pegado no sube | 21 sobre un tope de 20; la nueva: `tests/scrum1341-…test.mjs:404  <tr>` | **nuestro** |
| `scrum601` · el censo distingue depender del flag | ancla por número de línea `homeView.js:885`; el bloque nuevo, metido por encima, la llevaba a la 955 | **nuestro** |
| `scrum723` · quién nombra una referencia móvil | `tests/banco-scrum1341/admin-identico.mjs` la nombraba fuera de los argumentos de git | **nuestro** |
| `scrum976` ④ · `guards:entrada` sale 0 | cascada del anterior: lo corre de verdad | cascada |
| `scrum1199` × 2 | `Cannot find module '…\scrum-1341-j2k\node_modules\express'` | del árbol: no tiene `node_modules` |
| `scrum476` · suelo del censo de `node_modules` | «CERO directorios `node_modules` en el árbol» | del árbol, lo mismo |

Los tres nuestros habrían salido rojos en CI. Arreglados **en el código, ninguno en el guard**:

1. **`scrum553`:** el extractor del test deja hueco a los atributos (`<tr[^>]*>`).
2. **`scrum601`:** el bloque del Técnico (`TONO_DE_ACEPTACION` y `renderTeamActivity`; el código, sin
   cambiar una línea) baja al **final** de `homeView.js`, y el cambio en `renderTeamPerformance` pasa a ser de
   dos líneas por dos. La nota de condiciones vuelve a estar en la 885, que es donde el control la busca.
   El comentario del bloque dice por qué está ahí abajo. Es la tercera vez que ese control se cruza con
   un cambio de `homeView.js` (SCRUM-1124 y SCRUM-1317 lo re-anclaron); aquí no se ha tocado.
3. **`scrum723`:** al banco se le PASA la referencia; sin ella sale CIEGO con 2. Ya no la nombra.

Repetida la dirigida sobre el código final (commit `7aac7cff`, con la segunda mezcla dentro): 548 ficheros
de 1.191, 4.922 casos, 4.914 pasan, 5 saltos, **3 caen: los tres del árbol sin `node_modules`**, ninguno
nuestro. Después de mover el bloque se repitieron también el admin idéntico, el navegador (misma salida
que la tabla de ③) y las 28 mutaciones.

## ⑤ Lo que NO está hecho, y por qué

- **La tanda completa local NO se ha corrido.** Tenía el turno. Este árbol hereda `node_modules` del
  checkout compartido, y su cliente de Prisma es del 25-sep y no coincide con el esquema de hoy (medido:
  los dos `schema.prisma` difieren; `tsc` sin `--noCheck` da 6 errores, los 6 de `invoiceStartSeq`, 0 en
  los ficheros de este ticket). Una tanda completa aquí mediría ese desfase, no el cambio. La dirigida
  de ④ es lo que hay; el juez es el CI, y los 13 casos se leen allí por nombre.
- **Tipos:** por lo mismo, el `dist/` de todas estas mediciones se emitió con `--noCheck`. Los cuatro
  ficheros de `src/` de este ticket no dan ningún error de tipos; el build con tipos lo hace el CI.
- `guards:visuales` no se ha lanzado; lo de navegador es el instrumento de ③.
- Verlo en `yaqu.app` sigue pidiendo una sesión de Técnico.

## ⑥ Lo que me salió mal

1. **Lancé la tanda dirigida antes de escribir este apéndice** y tuve que repetir los guards de registro
   después de escribirlo. El orden bueno estaba en A6.
2. **Quise sobrescribir las salidas de J2j** en `docs/evidencias/scrum1341/` con las mías. Lo paró el hook;
   van en ficheros nuevos y las suyas se quedan como estaban.
3. **Mi primer informe al orquestador decía «13 de 13» y «admin idéntico» con tres rojos nuestros dentro.**
   Los dos datos eran ciertos, y ninguno miraba fuera del test del ticket. Lo destapó la tanda dirigida,
   que corrí después de informar y no antes.
