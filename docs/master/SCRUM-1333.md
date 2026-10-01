# SCRUM-1333 · La misma factura no se encola dos veces a la AEAT

**Medido contra:** `origin/main` = `bee39d3b51e300ff4efdda3befcb1eff4626f988` · 2026-10-01T05:54:40Z

1-oct-2026 · **J1f** (equipo de Javier), relevo de J1e, que midió el defecto y paró a pedir número.
GO del fundador en SCRUM-1333, comentario 17733 («2-Go»): **me llegó por el orquestador**
(`cobroflash-backend-5b`), que se lo oyó al fundador; yo lo leí en Jira, no lo oí.

A9: comprobación → `tests/scrum1333-carrera-del-encolado-postgres.test.mjs`

## El defecto

`sellarTrasEmision` (`src/modules/invoicing/domain/selladoEstado.ts`) llama a
`encolarAltaTrasSellado` después de **cada** pasada, y la cola (`VfSubmission`) no tiene único por
factura. Una factura que pasa dos veces por `sellarTrasEmision` queda dos veces en la cola, con el
mismo registro: la misma alta, dos veces, esperando a salir hacia la AEAT.

Las guardas de SCRUM-1330 no lo cerraban: en ④b (dos entregas a la vez del mismo cobro) la que
pierde leyó la fila todavía `pendiente_de_sellado`; la guarda de dentro le conserva la huella, y
`sellarTrasEmision` sigue hasta el encolado.

En producción no ha ocurrido: el dato que me llega por el orquestador, medido por el fundador el
1-oct, es de cero facturas selladas. Yo no lo he medido (este árbol no toca producción).

## La decisión: en el camino, no en el esquema

El GO dejaba la decisión a quien lo construyera: evitar el encolado duplicado en el camino, o que
la cola no admita dos filas para la misma factura (un único en la tabla, o sea un ALTER).

**Se evita en el camino.** `encolarAltaTrasSellado` (`src/modules/invoicing/domain/encolarRemision.ts`)
abre una transacción, toma un cerrojo consultivo **por factura**, cuenta las altas que esa factura
ya tiene en la cola y sólo escribe si no hay ninguna. Por qué así:

- **Pregunta a la cola, no «quién selló».** Una guarda del tipo «sólo encola la pasada que escribió
  la huella» dejaría sin remitir, para siempre, la factura cuya primera pasada selló y no pudo
  encolar. Hay un caso que lo sujeta.
- **Dentro de un cerrojo.** Fuera, dos encolados preguntan a la vez, los dos oyen «no hay» y los
  dos escriben. Sin único en la tabla, el cerrojo es lo que serializa.
- **El cerrojo es por factura** (`ENCOLADO_LOCK_NS` = 1750, segunda clave el id de la factura), no
  el de la serie (1749) ni el de la cadena (1748), que son por comercio. Sólo tienen que esperarse
  dos encolados de la misma factura; meterlo en el de la serie pondría cada encolado a la cola de
  las emisiones del comercio, que ya se satura (SCRUM-728).
- **Sin ALTER.** Un único en `(invoice_id, tipo_operacion)` sería la red de debajo, y la más
  fuerte; pero decide ya, en el esquema, que una factura no tendrá nunca dos filas de alta (una
  subsanación, por ejemplo: la columna `subsanar` existe y nadie la escribe todavía). Eso no lo
  decide este ticket. Queda dicho abajo como lo que este arreglo no da.

No encolar **no es mudo y no es un fallo**: lo dice por `console.warn`, devuelve
`{ encolado: false, motivo: 'ya_encolada' }` y **no** deja `encolado_fallido`.

No se toca `sellarTrasEmision`, ni `applyVeriFactu`, ni ninguna huella, ni el esquema, ni ningún
flag, ni ninguna fila existente de la cola. No hay texto que vea el usuario.

## El rojo primero

`docs/master/evidencias/scrum1333/rojo-sobre-main-bee39d3b.tap.txt`: los 8 casos de
`tests/scrum1333-una-factura-se-encola-una-vez.test.mjs` sobre `main` `bee39d3b` sin el arreglo,
**3 rojos por efecto y 5 controles verdes**.

| Caso | `main` `bee39d3b` | Con el arreglo |
| --- | --- | --- |
| Una factura sellada una vez | 1 fila | 1 fila |
| Dos facturas distintas | 1 fila cada una | 1 fila cada una |
| ④b · dos entregas a la vez, ruta real | 🔴 2 filas | 1 fila |
| Segunda pasada por `sellarTrasEmision` | 🔴 2 filas | 1 fila, cadena byte a byte, lo dice y no deja `encolado_fallido` |
| Dos encolados a la vez | 🔴 2 filas | 1 fila |
| La primera pasada no pudo encolar; la segunda | 1 fila | 1 fila |
| Fila de otro comercio con el mismo id de factura | no impide encolar | no impide encolar |
| Fila de otra operación de la misma factura | no impide encolar | no impide encolar |

Corre `dist/` tal cual sobre el banco con estado de SCRUM-1304 (`tests/_banco-emision-con-estado.mjs`).
**El límite que midió J1e:** la fila sólo llega a la cola si la factura es declarable (merchant de
España, cliente con NIF, línea con IVA). Todos los casos la montan así y comprueban, antes de
medir, que la primera pasada dejó UNA fila.

El caso «RESIDUAL CONOCIDO (SCRUM-1333)» de `tests/scrum1330-…` fijaba las 2 filas. Se reescribe
con lo contrario en este mismo cambio, como pedía su propio mensaje.

## Mutaciones

`docs/master/evidencias/scrum1333/mutar.mjs` y `mutaciones.json`. Medido sobre la rama local en
`c999b952`, 4 ficheros de test, 50 casos. Base sin mutar: 50 de 50. **Las 8 caen**, cada una con su
`git diff --numstat` (1 línea) al lado; árbol restaurado, `git status --porcelain -- src` vacío.

| Mutación | Caen |
| --- | --- |
| M1 · la pregunta no decide (el defecto entero) | 4 |
| M2 · la pregunta va sin cerrojo | 1 (dos encolados a la vez) |
| M3 · ignora la factura | 1 (dos facturas distintas) |
| M4 · ignora el comercio (regla 2) | 1 |
| M5 · ignora el tipo de operación | 1 |
| M6 · no encolar se calla | 1 |
| M7 · no encolar se registra como un fallo | 4 |
| M8 · no encola nunca | 12 |

Las mutaciones se corrieron ANTES de añadir el test de Postgres: ese fichero no entra en ellas.

## La mitad con Postgres de verdad — y su límite

`tests/scrum1333-carrera-del-encolado-postgres.test.mjs`, 3 casos, gateado por `LIBRO_PG_URL` (el
banco desechable que CI levanta). Declarado en el inventario de `tests/scrum419-…` (3).

El banco en memoria no prueba que `pg_advisory_xact_lock` haga esperar de verdad, ni que el
recuento lanzado tras conseguir el cerrojo vea la fila que acaba de confirmar el otro. Este fichero sí:

1. una pasada encola una fila, y una segunda pasada por `sellarTrasEmision` ni encola otra ni cambia
   huella, anterior, sello o QR — de paso, la rama de la guarda B de SCRUM-1330 que quedó «sin
   medir contra una base real»;
2. seis encolados a la vez de la misma factura dejan una fila;
3. sin carrera ni ventanas: otro tiene el cerrojo de la factura, se mira en `pg_locks` que el
   encolado lo está ESPERANDO y que no ha escrito; el titular deja su fila y suelta; el encolado
   entra, la ve y no escribe.

🔴 **No lo he visto correr.** En esta máquina no hay Postgres (ni `psql`, ni `pg_ctl`, ni `docker`
en el PATH ni en `Program Files`; nada escuchando en 5432 ni 55432). Su primera ejecución es la de
CI, y tampoco lo he visto en ROJO contra el código sin arreglar. Hasta que CI lo corra, es un test
escrito, no una medición. Lo que diga CI va en el comentario de entrega de Jira.

## Lo que este arreglo NO da

- **No es un único.** Una escritura en `vf_submissions` que no pase por `encolarAltaTrasSellado`
  no la para nada. Hoy no hay ninguna otra (`grep` de `vfSubmission.create` en `src/`: una).
- **No toca las filas que ya estén duplicadas.** El GO lo excluye. Con cero facturas selladas en
  producción no debería haber ninguna; no lo he medido yo.
- **Los dos eventos `invoiced`** de la misma factura en ④b siguen igual (fuera del GO).
- Si el cerrojo o la transacción fallan, el encolado acaba en `encolado_fallido` con motivo
  `error`, como cualquier otro fallo de la cola: la factura queda sellada y sin fila. Era así antes.

## Lo que cambió fuera del encolado

- `tests/scrum1330-…`: el caso residual, reescrito con lo contrario (arriba).
- `tests/scrum419-…`: una entrada nueva en el inventario de gateados por banco.
- **La pregunta es un `count` y no un `findFirst`, y el motivo va dicho:** el doble de
  `tests/scrum1296-emitir-encola` contesta un objeto a cualquier método que no conoce, y con
  `findFirst` habría leído «ya encolada» siempre. Con `count` contesta 0 y sus 8 casos corren sin
  tocarlo. Las dos formas preguntan lo mismo; elegí la que no obligaba a enseñarle nada a un doble
  ajeno.

## Lo que se corrió, y lo que no

- `tests/scrum1333-una-factura-se-encola-una-vez`: 8 de 8.
- Barrido dirigido por CONTENIDO (cola, sellado, cerrojos, `executeRaw`): 70 ficheros, 564 tests,
  542 pasan, 0 fallan, 22 saltan (gateados por base real).
- Lo corrido después de escribir este registro está en el comentario de entrega de Jira.
- **La tanda completa no se ha corrido en local**: la cubre el CI del PR.

## Lo que salió mal

- En la entrega del CI de #2053 (el encargo anterior de esta misma sesión) le di al orquestador
  «91 saltos por `QA_DB_TEST`». Son **90**: sumé a ojo los ocho motivos en vez de sumarlos con la
  herramienta, y la lista que yo mismo mandé sumaba 99 sobre 98. Corregido en el mensaje de esta
  entrega. Va a las cicatrices del puesto.
- En esa misma entrega dejé un cabo sin mirar («0 líneas del aviso de la B en el log de CI») y lo
  mandé como «no lo investigué». El orquestador me lo devolvió. Mirado: los tests de SCRUM-1330
  sustituyen `console.warn` (lo silencian o lo capturan para comprobarlo), así que el aviso no
  llega al log; y CI no se traga los avisos: el literal de un `console.warn` de `src/`
  («Credenciales no configuradas, mensaje omitido») sale 2 veces en ese mismo log.
- El test de Postgres entra sin haberlo visto correr ni caer (arriba).
