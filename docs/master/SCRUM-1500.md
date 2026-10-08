# SCRUM-1500 · Los 19 comentarios que el censo dio por buenos, cotejados contra el máster y no contra el código

**Medido contra:** `origin/main` = `0fd400cbc3dddf2d7d55573014937b53dc499edc` · 2026-10-07T18:05:32Z (hora de GitHub)

A9: comprobación → `tests/scrum1500-el-cotejo-contra-el-master.test.mjs`

Sesión J5 (`jv-j5`, 7-oct tarde, relevo de la que cerró SCRUM-1401), equipo de Javier, ticket de `area-j5`.

**MEDICIÓN Y UN INSTRUMENTO. `prisma/schema.prisma` no se toca, el máster no se toca y `src/` no se toca.**
Este PR trae tres cosas: el instrumento, su test y este registro.

## Ⓐ Qué se preguntaba y qué se pregunta ahora

El censo de SCRUM-1342 Ⓖ y SCRUM-1401 comparaba lo que enumera un comentario del esquema con lo que
hace el código. Si coincidían, lo daba por bueno. Un código que se sale del máster con su comentario
al lado sale «coincide».

El instrumento nuevo (`docs/master/evidencias/scrum1500/cotejo.cjs`) saca tres conjuntos por campo:

- **C**, lo que enumera el comentario. Se lee de la línea del esquema.
- **D**, lo que decide el código. Sale por AST de la constante o el validador que cierra la lista, más
  los literales que se escriben en esa columna dentro de una llamada de escritura de Prisma, más el
  `@default`.
- **M**, lo que fija el máster. Sale de UNA línea de `docs/YAQU_MASTER.md`, localizada con un ancla
  que tiene que casar exactamente una vez.

Primero compara D con M. El comentario se mira al final.

## Ⓑ La población

Los 20 que el censo dio por «coincide» son las líneas 18, 67, 72, 201, 973, 1115, 1174, 1175, 1453,
217, 328, 396, 609, 725, 1050, 1335, 1426, 1448, 1636 y 1642 (las 36 del censo menos las 14 que
divergían y menos las dos que describen un Json, 688 y 1474).

- La 72 (`Merchant.subscriptionStatus`) ya no enumera: la cambió SCRUM-1401, que la cotejó con la
  Parte L. Quedan **19**, y son los que se miden aquí.
- En esos 19 **está** `QuoteRequest.status` (1115), el caso que dio origen al ticket. Sin él son 18.
  El «19 sin cotejar» del ticket eran los 20 menos ése; hoy esa cuenta da 18.
- Cruce con el censo viejo corrido hoy: enumeran 27. Son estos 19, las dos del Json y seis de las
  catorce de SCRUM-1401 que siguen como estaban (1157, 1270, 1274, 1412, 1563, 1571).

Código leído: 319 ficheros `.ts` bajo `src/`, 0 sin parsear.

## Ⓒ El resultado

| veredicto | cuántos |
|---|---|
| coincide con el máster | 7 |
| el comentario está atrasado | 0 |
| **el código tiene valores que el máster no tiene** | **1** |
| **es un estado y el máster no trae su máquina** | **2** |
| el máster no fija este campo (no cotejable) | 9 |
| total | 19 |

El censo viejo da «coincide» a los 19. Con el máster delante coinciden 7.

### Coinciden con el máster (7): nada que hacer

| línea | campo | valores | dónde lo fija el máster |
|---|---|---|---|
| 67 | `Merchant.connectStatus` | none, pending, active, restricted | línea 1068 (C1-0) |
| 1174 | `TeamMember.role` | admin, tecnico | línea 662 (tabla S1) |
| 1453 | `Albaran.estado` | borrador, emitido, firmado | línea 407 (Parte L) |
| 1426 | `Albaran.estado`, comentario de cabecera | los mismos | línea 407 (Parte L) |
| 396 | `Customer.billingPeriodicity` | NINGUNA, QUINCENAL, MENSUAL | línea 1326 |
| 1335 | `Job.tipoOperacion` | OPERACIONES_SUELTAS, TRABAJO_UNICO | línea 643 |
| 1448 | `Albaran.modoValoracion` | SIN_VALORAR, VALORADO | línea 647 |

Sólo dos de las siete están en la Parte L. Las otras cinco las fija el máster en la Parte S o en el
registro del sprint que creó el campo. En `TeamMember.role` el máster nombra los roles como columnas
(«Admin», «Técnico») y el código como `admin` y `tecnico`: se comparan en minúsculas y sin acentos.

### 🔴 El código tiene valores que el máster no tiene (1): PARADO, regla 27

`QuoteRequest.status` (esquema, línea 1115).

| | valores |
|---|---|
| el código | `pending`, `read`, `done` |
| el máster, Parte L, línea 401 | `new → seen → converted(quoteId) \| discarded(reason)` |

Ningún valor es común. Dónde se escribe cada uno:

- `pending`: `@default` del esquema; `customerPortal.routes.ts:542`; `botFlow.service.ts:484`.
- `read` y `done`: `quoteRequests.routes.ts:65` guarda `req.body.status` después de comprobarlo
  contra la lista `['read', 'done', 'pending']` de la línea 54.
- `new`, `seen`, `converted`, `discarded`: ninguna escritura en `src/`.

No se propone línea de esquema. Es el caso que ya traía el ticket; aquí queda medido con sus sitios.

### 🔴 Es un estado y el máster no trae su máquina (2): PARADO, lo decide el fundador

**`ParteTrabajo.estado`** (esquema, línea 1642): `borrador`, `firmado`, `facturado`, cerrados por
`ESTADOS_PARTE` (`src/modules/jobs/domain/parteTrabajo.ts:78`).

- El máster no nombra la entidad. Búsquedas sobre `docs/YAQU_MASTER.md`, con las veces que casan:
  `ParteTrabajo` 0 · `ESTADOS_PARTE` 0 · `TIPOS_PARTE` 0 · `parte_trabajo` 0 · `SCRUM-652` (el ticket
  que creó el parte) 0 · `firmadoTecnicoAt` 0. Control de que la búsqueda ve: `QuoteRequest` 8,
  `SIN_VALORAR` 4. «parte de trabajo» sale 2 veces (líneas 644 y 1282) y las dos hablan del albarán.
- El instrumento avisó de dos líneas del máster que juntan los tres valores, la 408 y la 1329. Leídas:
  las dos hablan del **albarán** (su ciclo `borrador → emitido → firmado` y su vocabulario derivado de
  cobro `sin_facturar | parcial | facturado`). Ninguna habla del parte.
- La línea 1329 dice además que para el albarán se **rechazó** guardar un estado de facturado dentro
  de `Albaran.estado`, porque mezclaba el ciclo del documento con lo cobrado. El parte guarda
  `facturado` como estado. No digo que sea el mismo caso: lo pongo delante de quien decide.
- El propio código cita al máster: `parteTrabajo.ts:465` dice «`ESTADOS_PARTE` es vocabulario CERRADO
  (Parte L)». La Parte L (líneas 396-410) no lo trae.
- Dónde se escribe: `borrador` en `partes.routes.ts:447` y como `@default`; `firmado` por
  `estadoTrasFirmar` (`partes.routes.ts:685` y `:765`). **`facturado` no lo escribe ninguna línea de
  `src/`** (cinco llamadas de escritura a `parteTrabajo`, leídas una a una); sí se lee, en
  `puedeEditarPrecios` (`parteTrabajo.ts:420`).

**`TeamMember.status`** (esquema, línea 1175): `invited`, `active`, `suspended`.

- La Parte L no trae máquina para `TeamMember`. `TeamMember.status` sale 0 veces en el máster.
- Los tres valores sí aparecen, en prosa, en el registro de un sprint (líneas 716, 717, 728 y 730).
  Ninguna línea los da como lista ni dice sus transiciones.
- Dónde se escribe: `invited` en `team.service.ts:44` y `:48` y como `@default`; `active` en
  `auth.service.ts:263`; `suspended` en `team.service.ts:86`.

Para los dos, la decisión es la misma y no es mía: o la Parte L gana la máquina, o se dice que estos
campos no son máquinas de la Parte L. Hasta entonces no se propone línea de esquema.

### El máster no fija el campo (9): no cotejable

El máster no trae una lista para ninguno de estos nueve. No son estados ni flags. «No cotejable» es
el resultado: no es un verde.

| línea | campo | quién lo cierra en el código | rastro en el máster |
|---|---|---|---|
| 18 | `Merchant.trade` | validador `trade` (`schemas.ts:435`) | el nombre del campo, 0; los oficios, en prosa (línea 64) |
| 201 | `AuthSession.type` | lo que escribe `auth.service.ts` y `auth.routes.ts` | `magic_link` 1 vez (línea 712); la lista, no |
| 973 | `Expense.category` | `EXPENSE_CATEGORIES` (`expenses.service.ts:6`) | `subcontrata` 0, `desplazamiento` 0 |
| 217 | `Customer.contactKind` | validador `contactKind` (`schemas.ts:570`) | el campo, 0 |
| 328 | `Customer.tipoDestinatario` | validador `tipoDestinatario` (`schemas.ts:603`) | el campo y sus dos valores, 0 |
| 609 | `Quote.shippingAddressMode` | `MODOS_DIRECCION_OBRA` (`direccionObra.ts:45`) | el campo y sus tres valores, 0 |
| 725 | `Quote.ivaModo` | `MODOS_IVA` (`presentacionIva.ts:33`) | el campo, 0; `no_incluido`, 0 |
| 1050 | `Product.itemKind` | `ITEM_KIND` (`schemas.ts:539`) | el campo, 0; `SERVICIO`, 0 |
| 1636 | `ParteTrabajo.tipo` | `TIPOS_PARTE` (`parteTrabajo.ts:68`) | el campo, 0; `reparacion_asistencia`, 0 |

Dos de estas constantes invocan la regla 27 en su propio comentario para una lista que el máster no
tiene: `MODOS_IVA` («CERRADOS (regla 27)») y `TIPOS_PARTE` («Cerrado a propósito (regla 27)»). Si
esos vocabularios son del máster o son del código lo decide el fundador; aquí sólo consta que hoy
viven en el código.

En ninguno de los 19 hay un valor escrito fuera de su cierre.

## Ⓓ Los controles

1. **El que lo separa de su padre.** `Albaran.estado` y `QuoteRequest.status` salen los dos
   «coincide» en el censo viejo. El instrumento nuevo da al primero COINCIDE_CON_EL_MASTER y al
   segundo CODIGO_FUERA_DEL_MASTER.
2. **Tres controles viajan en cada pasada** y ninguno puede salir «coincide»: un campo inventado
   (sale NO_EXISTE), un ancla de máster inventada (CIEGO) y una constante inventada (CIEGO). 3 de 3.
3. **El máster movido.** Sobre una copia del máster con dos líneas cambiadas (`muta-master.cjs`): al
   quitar `firmado` de la línea del albarán, `Albaran.estado` pasa a CODIGO_FUERA_DEL_MASTER; al
   poner `pending → read → done` en la de `QuoteRequest`, pasa a COINCIDE_CON_EL_MASTER. Salida en
   `cotejo-salida-master-mutado.txt`. El instrumento lee el máster, no una copia suya.
4. **El test en rojo.** Con la regla «el código tiene un valor que el máster no» apagada en el
   instrumento (`git diff --numstat`: 1 1), el test da 7 casos, 5 pasan y 2 caen, y cae el del
   control 1. Restaurado: 7 de 7, y el árbol limpio.
5. **La salida no cambió con `main`.** Medí sobre `c8ab5d32`; al traer `0fd400cb` la salida es
   idéntica byte a byte.

## Ⓔ El arreglo del criterio, y lo que queda propuesto

**Hecho:** el instrumento y su test. El test sujeta el criterio con casos fabricados.

**No hecho, y a propósito:** un guard que corra el instrumento sobre el árbol en el CI. El
instrumento localiza cada comentario por su número de línea, así que caería con cualquier cambio del
esquema que mueva líneas. Antes de meterlo en el check obligatorio habría que anclar por modelo y
campo, y decidir qué hace con los tres casos parados. Lo decide el orquestador.

**Propuesto, sin aplicar** (regla 40: un comentario del esquema es el fichero, y no hay firma). Con el
criterio que el fundador firmó en SCRUM-1401 (c.18780), el comentario deja de enumerar y nombra a
quien decide. Siete líneas, una por una, sin mover ninguna:

| línea | hoy | propuesta |
|---|---|---|
| 18 | `// electricista\|fontanero\|reformista\|pintor\|cerrajero\|climatizacion\|otro` | `// lo cierra el validador de la ficha del negocio (schemas.ts, campo trade)` |
| 67 | `// none\|pending\|active\|restricted` | `// lo escribe el webhook de Connect según charges_enabled (connectWebhook.routes.ts); los valores, en el máster (C1-0)` |
| 201 | `// magic_link \| session` | `// lo escribe auth.service.ts: el enlace de acceso y la sesión que sale de canjearlo` |
| 973 | `// materiales\|desplazamiento\|herramientas\|subcontrata\|otros` | `// EXPENSE_CATEGORIES (src/modules/expenses/domain/expenses.service.ts)` |
| 1174 | `// admin \| tecnico` | `// los roles los fija el máster (S1); en código, SUPPORTED_ROLES (src/core/http/roleCapabilities.ts)` |
| 1453 | `// borrador \| emitido \| firmado (Parte L)` | `// estados CERRADOS (regla 27): los fija el máster, Parte L («Albaran»); en código, ALBARAN_ESTADOS` |
| 1636 | `/// reparacion_asistencia \| mantenimiento \| instalacion (TIPOS_PARTE)` | `/// TIPOS_PARTE (src/modules/jobs/domain/parteTrabajo.ts)` |

No se propone nada para 1115, 1175 y 1642 (esperan decisión) ni para los nueve comentarios de bloque
(217, 328, 396, 609, 725, 1050, 1335, 1426 y 1448): explican por qué existe el campo y la lista es
una parte pequeña de un texto que no he querido reescribir.

## Ⓕ Lo que NO se ha medido

- **Las entidades de la Parte L que no tienen un comentario con «|» en el esquema** (`Quote`,
  `Invoice`, `Charge`, `Customer`, `Job`, `Invoice.vfEstado`, `merchant.plan`). El ticket pedía los
  19; el mismo cotejo sobre ésas no está hecho.
- **Los flags de la Parte P.** Ninguno de los 19 es un flag.
- **Las transiciones.** Se comparan conjuntos de valores, no qué paso lleva a cuál.
- **Nada se ha ejecutado contra una base.** No sé qué valores hay hoy en las filas.
- Las escrituras por SQL crudo, por un objeto construido en otro fichero o por derrame no las ve el
  AST. Por eso D lleva también la constante que cierra la lista. `Albaran.estado = 'emitido'` es un
  caso: entra por `datosDeAlbaranEmitido` y sólo se ve por `ALBARAN_ESTADOS`.
- Si algún guard compara como texto los modelos de las siete líneas propuestas (como hace el de
  SCRUM-475 con `EmailMessage`). Busqué los siete textos literales en `tests/` y salen 0 (control:
  `model Albaran {` sale en 1 fichero), pero un guard que lea el bloque entero no se ve así.
- La tanda completa no se ha corrido en local.

## Ⓖ Lo que me salió mal

- **Mi instrumento dio un veredicto falso y lo cazó su propio control.** Con una constante de cierre
  que no existía, D se quedaba sólo con el `@default` y salía «el máster manda lo que nadie escribe»
  en vez de CIEGO. Un cierre declarado que no aparece ahora es CIEGO, y lo sujeta el test.
- **Un control mío salió vacío y no lo di por bueno de milagro.** Busqué ramas de SCRUM-1500 con un
  patrón de `git ls-remote` cuyo control positivo también salió vacío. Lo repetí volcando las 155
  ramas a un fichero y contando sobre él: 0 de SCRUM-1500, 0 del control inventado, y una rama real
  visible.
- Declarar «el máster no lo fija» es una afirmación mía en la tabla del instrumento. Por eso para
  esos campos el instrumento busca el nombre y cada valor en el máster y avisa si una línea los junta
  todos. Saltó una vez (`ParteTrabajo.estado`) y hubo que leer las dos líneas.

## Lo que pide → dónde se ve

El ticket no trae una lista bajo «Aceptación»; trae «Lo que pide», y es lo que se usa.

| lo que pide | dónde se ve |
|---|---|
| ① Cotejar contra el máster los 19 | sección Ⓒ y `docs/master/evidencias/scrum1500/cotejo-salida.txt` |
| ② Clasificar lo que salga | sección Ⓒ: 7 coinciden, 0 atrasados, 1 con el código fuera, 2 estados sin máquina, 9 no cotejables |
| ② el código se salió del máster → se PARA | NO HECHO, a propósito → `QuoteRequest.status`, `ParteTrabajo.estado` y `TeamMember.status` esperan al fundador |
| ③ Arreglar el criterio del censo | `docs/master/evidencias/scrum1500/cotejo.cjs` y `tests/scrum1500-el-cotejo-contra-el-master.test.mjs`. Un guard sobre el árbol en el CI: NO HECHO → lo decide el orquestador (sección Ⓔ) |
| ③ si el máster no es legible por máquina, decirlo | sección Ⓒ, los nueve «no cotejable» |
| ④ Un control que dé cero | sección Ⓓ, controles 2 y 3 |
| las líneas del esquema | NO HECHO → siete propuestas en la sección Ⓔ, sin aplicar: falta la firma |

# SCRUM-1500b · El instrumento corre en la tanda: el cotejo sigue siendo contra el máster

**Medido contra:** `origin/main` = `a65a8c756c0363ec5ea6f4f0b1e811ba17a909c0` · 2026-10-07T23:30:24Z (hora de GitHub)

A9: comprobación → `tests/scrum1500-el-cotejo-contra-el-master.test.mjs`

Sesión J5 (`jv-j5`, 8-oct de madrugada en Madrid, relevo de la que entregó SCRUM-1500), equipo de
Javier, ticket de `area-j5`. Rama `scrum-1500b-guard-del-cotejo`.

**El permiso es el comentario 18831 de SCRUM-1500 en Jira**, del orquestador del equipo
(`cobroflash-backend-90`), leído en el ticket antes de escribir una línea. Contesta a lo que la
sección Ⓔ de arriba le dejaba: sí se construye, como un fichero de test y no como un workflow,
extendiendo `cotejo.cjs` y su test, y con los tres casos parados esperando sin poner el CI en rojo.

**`prisma/schema.prisma`, el máster y `src/` no se han tocado.** Este PR cambia tres cosas: el
instrumento, su test y este registro. Las siete líneas de Ⓔ siguen sin aplicar y sin firma.

El hook de arranque dijo «SIN IDENTIDAD… no construyas» porque no reconoce el nombre `jv-j5`. La
ficha del orquestador dice que es SCRUM-1498 (carril de S5) y que se siga; se siguió, y queda dicho.

## Ⓗ Qué faltaba para poder correrlo, y qué se hizo

La sección Ⓔ decía por qué no se hizo el 7-oct: el instrumento localizaba cada comentario por su
número de línea, y habría caído con cualquier cambio del esquema que moviera líneas.

1. **El comentario se localiza por modelo y campo** (`localizar`). La tabla ya no lleva números de
   línea: dice si el comentario va detrás del campo (`cola`), en el bloque pegado encima (`encima`) o
   encima de `model X {` (`cabecera`). Un modelo o un campo que no aparece exactamente una vez sale
   NO_EXISTE.
2. **Detrás del cotejo va un juicio** (`juzgar`): qué veredictos se nombran y cuáles no.
3. **Los tres parados llevan su excepción** (`PARADOS`), dentro del instrumento.
4. **El test corre el instrumento sobre el árbol** y lo interroga.

Control de que el punto 1 no cambió nada: la salida del instrumento antes y después, sobre el mismo
árbol, es idéntica en las 19 fichas (línea, C, D y M de cada una). Sólo cambian la línea de población
(3 controles → 4), la ficha del control nuevo y el bloque del juicio al final. Antes de tocar nada, la
salida era idéntica byte a byte a `evidencias/scrum1500/cotejo-salida.txt`, que queda como estaba; la
de hoy está en `evidencias/scrum1500b/cotejo-salida.txt`.

## Ⓘ Qué pone el CI en rojo y qué no

| veredicto del campo | en la tanda |
|---|---|
| COINCIDE_CON_EL_MASTER | no se nombra |
| EL_MASTER_NO_LO_FIJA | no se nombra, pero se imprime como «sin cotejar»: no es un verde |
| CODIGO_FUERA_DEL_MASTER, MASTER_SIN_ESCRIBIR, COMENTARIO_ATRASADO, ESTADO_SIN_MAQUINA_EN_EL_MASTER | cae, salvo que sea uno de los tres parados y siga siendo exactamente lo que se paró |
| NO_EXISTE, CIEGO, un control que sale mal, un fichero de `src/` sin parsear | cae |

Sobre el árbol de hoy: 7 coinciden, 9 sin cotejar, 3 parados, 0 hallazgos. Son los 19 de Ⓒ.

Además cae, porque es lo que haría que el cotejo dejara de ser contra el máster sin que nadie lo viera:

- **Una línea nueva del máster que junte todos los valores de un campo que la tabla declara «sin
  lista».** Que el máster no lo fije lo afirma la tabla; el instrumento lo vuelve a buscar en cada
  pasada.
- **Un comentario que deja de enumerar** sin que la tabla lo diga (`sinLista: true`), y al revés. Es
  lo que pasará el día que se firmen las siete líneas de Ⓔ: quien las aplique lo declara en la tabla,
  en ese PR. Sin esto, un comentario que el localizador dejara de encontrar saldría en verde.

## Ⓙ Los tres parados: la excepción, y por qué no es un agujero

`QuoteRequest.status`, `ParteTrabajo.estado` y `TeamMember.status`. No se ha decidido ninguno ni se
ha tocado ningún estado. Cada entrada de `PARADOS` lleva:

- **motivo**, **quién la retira** (el fundador decide; quien aplique su decisión borra la entrada en
  ese mismo PR) y **dónde consta** (los comentarios 18796 y 18831, y la sección Ⓒ).
- **lo que se le llevó al fundador, congelado**: el veredicto, los valores del código y los del
  máster. La excepción no dice «ignora este campo». Si el código gana un valor, si el máster cambia su
  lista, si el campo pasa a pararse por otra cosa o deja de estar parado, cae nombrándola.
- **la prueba de que sigue montada**, en cada pasada y por AST: sus valores tienen que salir de un
  cierre encontrado en `src/` o de una escritura de Prisma, no sólo del `@default`. Hoy:
  `quoteRequests.routes.ts:54`, `parteTrabajo.ts:78` y las escrituras de `team.service.ts` y
  `auth.service.ts`. Los sitios se imprimen en cada pasada.
- **el día en que se paró** (7-oct-2026). El juicio imprime su edad. **No caduca sola:** un plazo
  pondría el CI en rojo a fecha fija por una decisión que es del fundador, y eso no lo autoriza el
  comentario 18831. Lo dejo dicho como límite, no resuelto.

Para `ParteTrabajo.estado` van además los dos trozos literales de las líneas del máster que juntan
sus tres valores y que la sección Ⓒ ya leyó (hablan del albarán). Una tercera no estaría leída: cae.

## Ⓚ Los controles: verlo en rojo

1. **El que pedía el permiso: comentario = código ≠ máster tiene que caer.** Hecho de dos maneras.
   - Sobre el árbol y sin fabricar nada: quitando las excepciones caen los tres parados y sólo ellos,
     y `QuoteRequest.status` es ese caso (el censo viejo le sigue diciendo «coincide»).
   - Fabricado: a cada una de las 6 líneas del máster que sujetan los 7 comentarios que coinciden se
     le quita su último valor, en memoria y de una en una. Cae el comentario de esa línea, con
     CODIGO_FUERA_DEL_MASTER, y no cae ningún otro. El test comprueba que el comentario sigue siendo
     igual al código.
   - **Lo que no hice:** fabricar el comentario. Lo fabricado es la línea del máster; el comentario y
     el código son los del árbol. Para el instrumento es la misma situación (C = D ≠ M), pero no es
     literalmente «un comentario fabricado».
2. **El positivo que podía tumbarlo:** con el máster sin tocar, los 7 no se nombran, y en cada una de
   las 6 pasadas siguen sin nombrarse los que no dependen de la línea movida.
3. **Mover las líneas del esquema** (tres líneas añadidas arriba, en memoria): ningún veredicto
   cambia y cada comentario sale tres líneas más abajo.
4. **El banco de mutaciones** (`evidencias/scrum1500b/mutar.mjs`, salida en `mutaciones.txt`): 17
   cambios de un literal en el instrumento, con la base en verde antes (13 de 13). **17 vivas, 0
   mudas, 0 ciegas**, y el instrumento restaurado con el mismo sha256. La primera es volver a la
   pregunta vieja (comparar el código con el comentario): caen 8 de 13.
5. **Controles a cero que viajan en cada pasada:** 4 de 4 (campo inventado, modelo inventado, ancla
   inventada, constante inventada).

## Ⓛ La tanda dirigida local: lo que medí para SCRUM-1503 (sin arreglar nada)

`node scripts/tests-que-cubren.mjs --porque <fichero>`, un fichero cada vez, sobre 1.290 tests:

| fichero que se toca | ¿selecciona este test? | por qué |
|---|---|---|
| `docs/master/evidencias/scrum1500/cotejo.cjs` | sí | lo nombra |
| `prisma/schema.prisma` | sí | lo nombra |
| `docs/YAQU_MASTER.md` | **no** | el test lo lee a través del instrumento, no lo nombra |
| `src/modules/jobs/domain/parteTrabajo.ts` | **no** | ídem |
| `src/modules/quoteRequests/app/routes/quoteRequests.routes.ts` | **no** | ídem |

Control: un nombre inventado (`scrum99999`) sale 0 veces en las cinco. Quien añada un estado en
`src/` o cambie una máquina en el máster no verá este test en su dirigida local; lo verá en el CI.
Es de J3 (SCRUM-1503) y va por el orquestador. No he probado más ficheros de `src/` que esos dos.

## Ⓜ Lo que NO se ha medido

- **Los 11 campos del esquema con nombre de estado que no están en la tabla** (`Merchant.status`,
  `Merchant.subscriptionStatus`, `Charge.status`, `Quote.status`, `Invoice.status`,
  `Invoice.vfEstado`, `BotSession.state`, `WhatsAppMessage.status`, `Job.status`,
  `EmailMessage.status`, `VfSubmission.status`). El juicio los cuenta y los nombra en cada pasada, y
  no los coteja. Un campo de estado nuevo tampoco entra solo en la tabla. Es el límite más serio de
  lo entregado.
- Las transiciones, los flags de la Parte P y las filas de una base: igual que en Ⓕ.
- La tanda completa no se ha corrido en local. Qué corrió, en la sección Ⓝ.
- El meta-guard de mutaciones de la casa: este test no declara mutaciones en su formato. Las 17
  están en el banco de esta carpeta, que la tanda no corre.

## Ⓝ Qué corrió antes de empujar

Worktree anidado: sin `node_modules` propio (hereda el del checkout compartido) y sin `dist/`.
`dist/` se compiló aquí con `tsc --noCheck` (salida 0); `prisma generate` **no** se corrió, porque
escribe en el `node_modules` que comparten otras sesiones y este PR no toca ni el esquema ni `src/`.

| qué | resultado |
|---|---|
| el fichero del test, solo | 13 casos, 13 pasan (7 «SCRUM-1500 · » de antes y 6 «SCRUM-1500b · »), 3 s |
| el banco de mutaciones | base 13 de 13; 17 vivas, 0 mudas, 0 ciegas |
| `npm run tanda:dirigida`, en cuatro tramos | 240 ficheros de 1.290 · 2.396 tests · 2.390 pasan · **1 cae** · 5 ni pasan ni caen, sin desglosar |
| el que cae | «SCRUM-476 · SUELO: el censo de directorios `node_modules` no puede dar cero». Su mensaje dice «CERO directorios `node_modules` en el árbol»; este worktree no tiene ninguno (`ls node_modules`: no existe). No lo toca este PR. **No he comprobado que pase en un árbol con `node_modules`:** eso lo dirá el CI |
| los seis casos «SCRUM-1500b · » dentro de la dirigida | 6 pasan (tramo 2); un nombre inventado, «SCRUM-99999 · », sale 0 veces en los cuatro tramos |
| `npm run guards:entrada` | 13 guards, 158 tests, 158 pasan, salida 0 (corrido después del último cambio de este registro) |
| a mano, con el test: scrum237, 976, 267, 1294, 525d, 812, 824, 864c, 850, 710b, 859, 921, 1327, 391, 242, 273 | 206 pasan de 208; los 2 que caen son de scrum622, que entró por error en esa lista y pide `dist/` (aún no estaba compilado: `ERR_MODULE_NOT_FOUND`). Repetido solo, ya con `dist/`: 12 de 12. (La dirigida NO lo selecciona: sale 0 veces en sus cuatro TAP) |

La tanda completa no se corrió en local: la da el obligatorio del CI.

## Ⓞ Lo que me salió mal

- **El test salió verde a la primera y no valía nada todavía.** Lo que lo valida es el banco de Ⓚ.
- **Una mutación habría salido muda y la vi antes de correr el banco, leyendo, no midiendo:** «la
  excepción ampara cualquier veredicto que pare» no la cazaba ningún caso. Añadí el caso ②bis y
  después corrí el banco; no tengo la fila en rojo de antes de añadirlo.
- **Escribí en este registro un dato sin medir y lo cacé al comprobarlo:** que scrum622 «va en la
  dirigida y pasa». En los cuatro TAP de la dirigida sale 0 veces. Lo corrí solo y corregí la fila.
- **El localizador abría un hueco que no existía con números de línea:** un comentario que no se
  encuentra da una lista vacía, y eso habría salido «coincide». Lo cierra `sinLista` (sección Ⓘ) y
  una mutación del banco.

## Lo que pide el comentario 18831 → dónde se ve

| lo que pide | dónde se ve |
|---|---|
| ① un fichero de test en `tests/`, no un workflow | `tests/scrum1500-el-cotejo-contra-el-master.test.mjs`, los seis casos «SCRUM-1500b · » |
| ② que caiga un comentario que coincide con el código y no con el máster | casos «SCRUM-1500b · CAE» y «SCRUM-1500b · LOS TRES PARADOS»; `evidencias/scrum1500b/mutaciones.txt` |
| ② se extiende el instrumento, no se escribe otro | `docs/master/evidencias/scrum1500/cotejo.cjs` (`localizar`, `juzgar`, `PARADOS`) |
| ③ los tres parados esperan sin poner el CI en rojo | caso «SCRUM-1500b · EL ÁRBOL» (0 hallazgos, 3 parados) |
| ③ su excepción lleva motivo, quién la retira y prueba de que sigue montada | `PARADOS` en el instrumento; casos «LOS TRES PARADOS» y «la excepción cubre lo que se le llevó al fundador» |
| no tocar el esquema, no decidir los parados, no relajar nada, ningún workflow | `git diff --stat origin/main`: tres ficheros cambiados y tres nuevos, ninguno de esos |

# SCRUM-1500c · Los once campos de estado que el cotejo nombraba y no cotejaba

**Medido contra:** `origin/main` = `fae0553295d655d5579e3a1fc1c93b6f468c0149` · 2026-10-08T01:50:22Z (fecha del commit; no es una cabecera de GitHub)

A9: sin fallo que generalice — los dos errores de esta tanda (sección Ⓤ) son del instrumento nuevo y los cazaron sus propios controles antes de entregar; ninguna comprobación de la tanda corre este instrumento, y se dice en Ⓣ

Sesión J5 (`jv-j5`, 8-oct de madrugada, relevo de la que entregó SCRUM-1500b), equipo de Javier, ticket de
`area-j5`. Rama `scrum-1500c-los-once-estados-sin-cotejar`. Encargo del orquestador
(`cobroflash-backend-90`): recoger el límite que la sección Ⓜ dejó declarado.

**MEDICIÓN. `prisma/schema.prisma`, el máster, `src/`, los tests y el instrumento de SCRUM-1500 no se han
tocado.** Este tramo trae una carpeta de evidencias (`docs/master/evidencias/scrum1500c/`) y este registro.

El hook de arranque volvió a decir «SIN IDENTIDAD… no construyas» para `jv-j5` (SCRUM-1498, carril de
S5). Se siguió, como dice la ficha del orquestador.

## Ⓟ Cuáles son los once

No los escribo yo: son `estadosFueraDeLaTabla` del instrumento de SCRUM-1500, y `cotejo-once.cjs`
comprueba en cada pasada que su tabla y esa lista son la misma (hoy: 11 y 11, los mismos).

| # | modelo.campo | línea del esquema | tipo | `@default` |
|---|---|---|---|---|
| 1 | `Merchant.subscriptionStatus` | 72 | `String?` | no tiene |
| 2 | `Merchant.status` | 129 | `String` | `active` |
| 3 | `Charge.status` | 473 | `String` | no tiene |
| 4 | `Quote.status` | 653 | `String` | `draft` |
| 5 | `Invoice.status` | 830 | `String` | `pending` |
| 6 | `Invoice.vfEstado` | 916 | `String` | `pendiente_de_sellado` |
| 7 | `BotSession.state` | 1138 | `String` | `menu` |
| 8 | `WhatsAppMessage.status` | 1274 | `String` | `queued` |
| 9 | `Job.status` | 1315 | `String` | `pendiente_agendar` |
| 10 | `EmailMessage.status` | 1568 | `String` | `aceptado_sin_identificador` |
| 11 | `VfSubmission.status` | 1802 | enum `VfSubmissionStatus` | `pending` |

Ninguno es un flag de la Parte P: los trece flags de esa tabla son variables de entorno o ajustes, no
columnas con nombre de estado. No se ha cotejado ningún flag.

## Ⓠ Cómo se sacó cada conjunto

- **D, lo que decide el destino**, por AST sobre 320 ficheros `.ts` de `src/` (0 sin parsear, 196 llamadas
  de escritura de Prisma vistas). Casi ninguno de estos campos se escribe con un literal dentro de la
  llamada de Prisma, así que cada campo declara de dónde sale: la escritura directa, una constante, las
  claves de un objeto, un `[..].includes(x)`, el enum del esquema, la propiedad de un argumento en todas
  las llamadas a una función (`setSession`, `recordWaMessage`) o el objeto que devuelve una fábrica
  (`datosDeCobroPagado`, `nuevaRevisionDe`). Una fuente declarada que no encuentra nada deja el campo
  CIEGO.
- **M, lo que fija el máster**, de una línea localizada por un ancla que casa una sola vez: los tramos
  entre comillas invertidas de esa línea que llevan una flecha.
- **El veredicto** es la función `veredicto` del instrumento de SCRUM-1500, sin cambiar.
- **El comentario** se mira al final: qué valores de D o de M nombra como palabra entera.

## Ⓡ El resultado

| cajón | cuántos | cuáles |
|---|---|---|
| coincide con el máster | 3 | `Invoice.vfEstado`, `BotSession.state`, `Job.status` |
| el comentario está atrasado | 0 | ninguno |
| **el código tiene un valor que el máster no tiene** (regla 27) | **4** | `Quote.status`, `Invoice.status`, `Charge.status`, `WhatsAppMessage.status` |
| es un estado y el máster no trae su máquina | 3 | `Merchant.status`, `EmailMessage.status`, `VfSubmission.status` |
| el máster nombra valores que esta columna no guarda | 1 | `Merchant.subscriptionStatus` |
| total | 11 | |

Los dos últimos cajones no estaban en el encargo. No caben en ninguno de los tres pedidos y no los he
forzado.

### Coinciden (3)

| campo | valores | línea del máster |
|---|---|---|
| `Invoice.vfEstado` | `pendiente_de_sellado`, `sellado`, `no_aplica` | 404 (Parte L) |
| `BotSession.state` | `menu`, `choosing_merchant`, `asking_description`, `asking_zone`, `confirming_request`, `done`, `handoff` | 374 (Parte K1) |
| `Job.status` | `pendiente_agendar`, `agendado`, `en_curso`, `terminado`, `cerrado` | 406 (Parte L) |

`BotSession.state` sólo escribe `menu` con un literal dentro de Prisma; los otros seis entran por las 16
llamadas a `setSession`. `Job.status` sólo escribe `pendiente_agendar`; el resto lo cierra `JOB_STATES`.

### 🔴 El código tiene un valor que el máster no tiene (4): PARADO, regla 27

**1. `Quote.status` → `pending_approval`.**

- Máster, línea 398: `draft → sent → accepted | rejected`, y `expired` en esa misma línea con la etiqueta
  `F2`. `expired` lo doy por del máster y lo digo: el código ya lo escribe (`expire.service.ts:17`).
- Dónde se escribe `pending_approval`: `quotes.routes.ts:160` lo elige cuando un técnico crea un
  presupuesto por encima de `merchant.approvalThreshold`, y la `:197` lo guarda en `quote.create`.
  Sale de ahí por `quotesAdmin.routes.ts:854`, que lo pasa a `draft`.
- Búsqueda en el máster, como palabra entera: `pending_approval` 0 líneas. Además, por texto:
  `needsApproval` 0, `approvalThreshold` 0, `ENT-2` (como lo llama el comentario del código) 0. El
  CONCEPTO sí está: «aprobaciones» sale 3 veces (líneas 129, 1654 y 1655), como capacidad del plan
  Equipo que «ya existe». El estado, no.

**2. `Invoice.status` → `expired`.**

- Máster, línea 399: `pending → paid` y `pending → annulled`.
- Dónde entra: `PUT /admin/invoices/:id/status` (`invoicesAdmin.routes.ts:555`) admite
  `['pending', 'paid', 'expired']`, y `updateInvoiceStatusAdmin` lo guarda tal cual
  (`invoiceAdmin.ts:306`; la `:279` dice «para 'expired' dejamos paidAt como esté»).
- **Ninguna línea de `src/` lo escribe con un literal.** Llega sólo por el cuerpo de esa petición. En
  `public/` hay un filtro «Vencidas» con ese valor (`invoicesView.js:325`). Tres sitios de `public/`
  llaman a esa ruta: `jobDetailView.js:2191` manda `paid`; de `invoiceDetailView.js:490` y
  `quotesDetailView.js:942` no leí el cuerpo que mandan.
- Búsqueda: `expired` sale en 5 líneas del máster (398, 405, 1085, 1089, 1699). Leídas las cinco:
  hablan del presupuesto (`validUntil`/`expired`) y de la suscripción. Ninguna de una factura.

**3. `Charge.status` → `failed` y `expired`; y `cancelled`, del máster, no lo escribe nadie.**

- Máster, línea 400: `pending → paid(...)` y `pending → cancelled`.
- Dónde se escriben: `failed` en `mpWebhook.routes.ts:259` y `psp.routes.ts:393`; `expired` en
  `psp.routes.ts:393` (la `:388` elige entre los dos según el aviso). `estadoDelCobro.ts:40` los da por
  estados de pleno derecho (`ESTADOS_QUE_UN_FALLO_PUEDE_PISAR`).
- `paid` no se escribe con un literal en Prisma: entra por la fábrica `datosDeCobroPagado`
  (`instanteDeCobro.ts:74`). Sin declararla, el instrumento habría dicho que nadie marca un cobro pagado.
- `cancelled`: 0 escrituras y 0 lecturas en `src/` como estado de un cobro (los dos sitios donde sale la
  palabra son el estado que devuelve Mercado Pago y la suscripción).
- Búsqueda: `failed` sale en 5 líneas del máster (309, 310, 312, 403, 1646): las cuatro primeras son de
  `WhatsAppMessage` y la 1646 es `Refund.status`. `expired`, las cinco de arriba. Ninguna de un cobro.

**4. `WhatsAppMessage.status` → `received`.** Es SCRUM-1499, abierto el 7-oct y «Tareas por hacer» al
leerlo hoy. Aquí sólo se confirma con otro instrumento: `whatsappLog.service.ts:81`; `received` 0 líneas
en el máster; la Parte L (403) y la J4 (309) dicen lo mismo entre sí. No abro nada nuevo.

### Es un estado y el máster no trae su máquina (3)

| campo | valores del código | quién los cierra | rastro en el máster |
|---|---|---|---|
| `Merchant.status` | `active` | sólo el `@default` y `auth.service.ts:346` | `Merchant.status` 0 líneas. La Parte L trae «Merchant readiness (checklist, no FSM)», que es otra cosa |
| `EmailMessage.status` | `aceptado_sin_confirmacion`, `aceptado_sin_identificador`, `fallo_envio`, `entregado`, `rebotado`, `reclamado` | `ESTADOS_CORREO` (`constanciaCorreo.ts:36`) | `EmailMessage` 0, `ESTADOS_CORREO` 0, `SCRUM-475` 0; cuatro de los seis valores, 0 |
| `VfSubmission.status` | `pending`, `sent`, `accepted`, `rejected`, `manual_review` | el enum del esquema y `ESTADOS_VF_SUBMISSION` (`sif.cola.ts:25`) | la entidad sí (líneas 156, 404, 1060) y `manual_review` 1 vez (580); la lista, no |

- `Merchant.status` no tiene más valor que `active` y nadie lo cambia. Se lee en dos sitios
  (`publicProfile.routes.ts:32`, `botFlow.service.ts:258`).
- `VfSubmission`: la línea 404 del máster dice que la cola de remisión «NO está construida — no hay
  tabla». El esquema tiene el modelo y su enum, y `sif.procesador.ts:122` escribe `sent`. La línea 980
  del máster, corregida el 1-oct, ya dice que S1-D no está hecho y que hay 3 registros aceptados en
  pruebas. Las dos líneas no dicen lo mismo. No decido cuál manda: lo dejo delante.

Es la misma decisión que SCRUM-1500 dejó para `ParteTrabajo.estado` y `TeamMember.status`.

### El máster nombra valores que esta columna no guarda (1)

`Merchant.subscriptionStatus`: el código escribe `active`, `past_due` y `canceled`
(`stripe.routes.ts:123`, `:173`, `:181`, `:190`, `:205`), y los tres están en la línea 405. El veredicto
del instrumento es MASTER_SIN_ESCRIBIR, por `trial` y `expired`. Leído:

- la máquina de la línea 405 se titula «Subscription (merchant.plan)» y junta dos columnas: `trial` se
  escribe en `plan` (tres sitios), no aquí;
- `expired` no lo guarda ninguna columna: `authMiddleware.ts:72` lo calcula (`plan === 'trial'` con
  `planExpiresAt` pasado).

No hay ningún valor fuera del máster. No lo paro por regla 27; tampoco lo doy por «coincide».

## Ⓢ Los controles

1. **De cero, en cada pasada:** un campo inventado sale NO_EXISTE; una función inventada como fuente,
   CIEGO; un ancla de máster inventada, CIEGO.
2. **Positivos, en cada pasada:** `Albaran.estado`, sacado con estas fuentes y esta lectura del máster,
   sale COINCIDE (lo mismo que le da el instrumento de SCRUM-1500); `QuoteRequest.status` sale
   CODIGO_FUERA_DEL_MASTER. 5 de 5.
3. **El rastro:** `confirming_request` sale en 3 líneas del máster (374, 376, 386); una palabra derivada
   que no puede estar sale en 0.
4. **El máster movido** (`master-movido.cjs`, en memoria): seis cambios de una línea. Los tres que le
   dan al máster el valor que le falta sacan a su campo del tercer cajón; los tres que le quitan un
   valor meten en él a un campo que coincidía. 6 de 6, y en ninguno cambia otro campo.
5. **La población:** 11 en la lista del instrumento de SCRUM-1500 y 11 en la tabla nueva, los mismos.

## Ⓣ Lo que NO se ha medido ni hecho

- **Ningún test corre esto.** El guard de SCRUM-1500b sigue nombrando los once sin cotejarlos. Meterlos
  en su tabla pide cuatro excepciones nuevas en `PARADOS` (o siete, con los estados sin máquina), y eso
  es la misma clase de decisión que el comentario 18831. No la tomo.
- **Un campo de estado nuevo sigue sin entrar solo.** Este tramo cierra los once de hoy, no el hueco.
- **Las transiciones.** Sólo conjuntos de valores.
- **Las lecturas.** No he buscado valores que el código compare y nadie escriba, salvo `cancelled`.
- **SQL crudo:** 15 usos de `$executeRaw`/`$queryRaw` en `src/`, vistos por texto: cerrojos, consultas
  de columnas y un `SELECT 1`. Ninguno es un `UPDATE` de estas columnas. No pasó por el AST.
- **Escrituras anidadas** (una tabla escrita dentro de la llamada de otra): el instrumento las imprime
  aparte y hoy no imprime ninguna para estos campos.
- **`public/`**: sólo lo dicho de `Invoice.status`.
- Nada contra una base: no sé qué valores hay en las filas.
- La tanda no se ha corrido: no hay ningún test nuevo ni tocado. `dist/` no se compiló.

## Ⓤ Lo que me salió mal

- **Mi primera lectura del máster casaba con texto que no era una lista.** La expresión que cogía los
  tramos entre comillas invertidas cogía también lo que queda ENTRE dos pares. No añadió ningún valor
  falso, de milagro. Lo vi en la salida (salían tramos de prosa), lo cambié por emparejar las comillas
  y comprobé que la salida no cambia en nada más que esos tramos.
- **Predije mal un cambio del máster movido.** Esperaba que darle `received` al máster dejara
  `WhatsAppMessage.status` en «coincide», y salió COMENTARIO_ATRASADO: el comentario del esquema no trae
  ese valor. El instrumento tenía razón y yo no.
- **La primera sonda no veía cómo se paga un cobro.** Buscando sólo literales dentro de Prisma,
  `Charge.status` no tenía `paid`. Es la frase de SCRUM-1401 sobre el objeto que se construye en otro
  fichero; lo cacé porque un cobro que nunca se paga no podía ser.
- **Pasé de 200.000 de contexto antes de avisar:** medido 247.296 al avisar.

## Lo que pide el encargo → dónde se ve

| lo que pide | dónde se ve |
|---|---|
| ① cuáles son los once, con modelo y campo | sección Ⓟ |
| ② valores del código y del máster, derivados del destino | sección Ⓡ y `docs/master/evidencias/scrum1500c/cotejo-once-salida.txt` |
| ③ los tres cajones | sección Ⓡ: 3 coinciden, 0 atrasados, 4 fuera del máster; y dos cajones más, 3 y 1 |
| ③ el tercero se PARA, con el valor y dónde se escribe | NO HECHO, a propósito → `Quote.status`, `Invoice.status`, `Charge.status` y `WhatsAppMessage.status` esperan al fundador |
| antes de decir que el máster no lo tiene, buscarlo y guardar el grep | cada caso de Ⓡ lleva sus búsquedas; el rastro por palabra, en la salida del instrumento |
| no tocar el esquema ni el máster | `git diff --stat origin/main`: este registro y la carpeta nueva |

# SCRUM-1500d · ¿Existe la cola de VfSubmission? Una tabla que la emisión llena y que ningún proceso vacía

**Medido contra:** `origin/main` = `179c248b496a963a999b5d45f125c5b458f21d78` · 2026-10-08T02:10:08Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/scrum1500d/cola.mjs`

Sesión J5 (`jv-j5`, 8-oct de madrugada en Madrid, relevo de la que entregó SCRUM-1500c), equipo de
Javier, ticket de `area-j5`. Rama `scrum-1500d-existe-la-cola-de-vfsubmission`. El encargo es el
comentario 18912 de SCRUM-1500 en Jira, del orquestador del equipo (`cobroflash-backend-90`), leído
en el ticket antes de medir.

**Es MEDICIÓN.** `src/`, `prisma/schema.prisma`, el máster y los tests no se han tocado: el camino
de emisión fiscal se ha LEÍDO (regla 38). Este PR trae este tramo y la carpeta
`docs/master/evidencias/scrum1500d/`. No decido nada de los estados parados.

El hook de arranque dijo «SIN IDENTIDAD… no construyas» para `jv-j5`; la ficha del orquestador lo
atribuye a SCRUM-1498 y dice que se siga. Se siguió, y queda dicho.

## Ⓤ El veredicto, en una frase

**Hay una tabla que la emisión llena y que ningún proceso vacía:** el esquema tiene el modelo, sellar
una factura deja su alta en `pending`, y el único código que la sacaría de ahí
(`procesarObligado`) existe, tiene tests y **no lo llama ni lo carga nadie**: ni un cron, ni una
ruta, ni el arranque.

No es «no hay nada» (la línea 404 del máster) ni es «una cola que alguien vacía». Y no es un
descuido: está declarado así a propósito (decisión D2 = X de SCRUM-1296, y
`scripts/_sin-consumir-declarados.json:158`).

Todo lo de abajo sale de `node docs/master/evidencias/scrum1500d/cola.mjs`, con su salida entera en
`cola-salida.txt`. Población: **321 ficheros `.ts` de `src/`, 0 sin parsear**, leídos por AST.

## Ⓥ Las dos líneas del máster, literales, y en qué chocan

El instrumento las localiza por su frase y comprueba el número: son la 404 y la 980.

**Línea 404** (Parte L), la escribió el commit `970f3bf12` el 23-sep-2026 (SCRUM-534n, «opción B
FIRMADA»):

> **La cola de remisión a la AEAT NO está construida** — no hay tabla, no hay envío, cero llamadas de red (`docs/legal/AUDITORIA_CAMINO_EMISION.md`, eslabones 8-9). Su diseño, antes descrito aquí como `VfSubmission`, vive en S1-D (Parte U1.3) hasta que se construya.

**Línea 980** (Parte U), el trozo de S1-D, lo escribió el commit `50ff50e49` el 1-oct-2026
(SCRUM-1319):

> S1-D ~~✅~~ 🟡 NO HECHO — la VÍA está DECIDIDA 2026-09-16 (fundador): la representación ante la AEAT se hará como COLABORADOR SOCIAL. La vía MERCHANT no se implementa. Ningún certificado de colaborador social viaja a ninguna sesión, ni de prueba. *(1-oct-2026, SCRUM-1319: el ✅ que había aquí marcaba esa decisión, no el hito. Su «Done» es ≥10 registros (alta/anulación/R1) aceptados consecutivos, y hay 3 aceptados en pruebas (SCRUM-1110, SCRUM-1296); `enviarSobre` no tiene ningún llamador en `src/`.)*

En qué chocan, exactamente:

| la 404 dice | la 980 dice | medido hoy |
| --- | --- | --- |
| «no hay tabla» | no habla de la tabla | **la 404 es falsa aquí**: `model VfSubmission` está en el esquema desde el commit `7bb4b1c02`, 30-sep-2026 (SCRUM-1296) |
| «no hay envío, cero llamadas de red» | «hay 3 aceptados en pruebas» | las dos caben si la 404 se lee «desde `src/`»: `enviarSobre` tiene 0 llamadas en `src/`. Los 3 aceptados no salieron de `src/`; **no he leído con qué se enviaron** |
| «vive en S1-D hasta que se construya» | S1-D «NO HECHO» | coinciden en que el hito no está; la 404 además niega piezas que ya están |
| — | «`enviarSobre` no tiene ningún llamador en `src/`» | cierto: 0 (sección Ⓧ) |

Es decir: **no se contradicen entre sí sobre la cola —la 980 no la nombra—; la que quedó atrás es
la 404, y sólo en «no hay tabla».** Era cierta el día que se escribió. Siete días después SCRUM-1296
metió la tabla y el encolado sin tocar esa frase: desde el 30-sep, de los 8 commits que tocan el
máster, 0 nombran `VfSubmission`, «cola de remisi» o «no hay tabla» en su diff.

Por el ORIGEN sale además por qué `VfSubmission.status` es «un estado sin máquina» (SCRUM-1500c):
**el máster la tenía y ese mismo commit `970f3bf12` la quitó.** La línea borrada decía:

> **VfSubmission:** `pending → sent → accepted` · `sent → rejected(error) → pending(retry, attempts++)` · `attempts≥5 → manual_review`. accepted terminal.

El código de hoy tiene esos cinco valores y se aparta de esa línea borrada en una transición: un
`rejected` **no** vuelve solo a `pending` (`sif.cola.ts:14-16` lo declara y dice por qué). No decido
si la máquina vuelve al máster ni con qué transiciones.

Las otras dos líneas del máster que nombran `VfSubmission` (156 y 1060) son del 11-jun-2026 (commit
`3d7a42ab0`) y describen el diseño de S1-D: «`sif.client.ts` + cola `VfSubmission
{invoiceId,status,attempts,lastError}`».

Dos textos más repiten lo de la 404 y siguen diciéndolo; no los he tocado:

- `docs/legal/AUDITORIA_CAMINO_EMISION.md`, líneas 40 y 150: eslabón 8 «NO EXISTE — ningún modelo
  del esquema», «Ningún fichero de `src/` menciona `vfSubmission`». Es la fuente que cita la 404 y
  la que la skill `yaqu-verifactu-sif` señala para saber qué está construido. Sólo he leído las
  líneas que casan con la búsqueda, no el documento.
- `src/modules/invoicing/domain/modoVisible.ts:22`, un comentario: «`VfSubmission` no está en el
  schema, no hay cola de remisión».

## Ⓦ Quién escribe filas y quién las lee, una a una

Toda llamada `<algo>.vfSubmission.<método>()` de `src/`: **7**, y un acceso más por nombre de modelo.

| | dónde | qué hace | ¿se ejecuta? |
| --- | --- | --- | --- |
| escribe | `encolarRemision.ts:61` `create` | deja la fila con el `@default`: `pending`. Sólo `tipoOperacion: 'Alta'` | **sí**: la llama `sellarTrasEmision` (`selladoEstado.ts:173`), que tiene 11 llamadas en `src/` |
| escribe | `sif.procesador.ts:120` `updateMany` | `pending → sent` | no: dentro de `procesarObligado` |
| escribe | `sif.procesador.ts:168` `update` | `status: d.estado`, lo que decida `decidirTrasEnvio` | no: ídem |
| lee | `encolarRemision.ts:57` `count` | ¿ya está encolada esta factura? (para no encolarla dos veces) | sí |
| lee | `borradoMerchant.ts:225` `count` | ¿tiene envíos este comercio? (para negarse a borrarlo) | sí |
| lee | `barridoDemo.ts:83` `contar(prisma, 'vfSubmission', …)` | cuántas tiene el demo | sí |
| lee | `sif.procesador.ts:81` `findMany` | las `sent` colgadas | no: dentro de `procesarObligado` |
| lee | `sif.procesador.ts:98` `findMany` | las `pending` vencidas, para enviarlas | no: ídem |

**Las tres lecturas que se ejecutan sólo CUENTAN.** Ninguna mira `status`, `lastError` ni
`registroXml`; ninguna ruta enseña la cola a una persona. Las dos únicas que leen para procesar
están en la función que nadie llama.

Por otras vías: `vf_submissions` y `vf_flujo_obligado` salen 0 veces en una cadena o plantilla de
`src/` (no hay SQL crudo sobre la tabla), y la relación `vfSubmissions` 0 veces como propiedad
(nadie la pide con `include`/`select`). Fuera de `src/`: `scripts/verificar-vf-submissions.mjs` lee
la FORMA de la tabla en una base (columnas, índices, claves), no filas.

No se encola una anulación: el único `create` escribe `'Alta'` y su única llamada está en
`sellarTrasEmision`. El «Done» de S1-D pide alta, anulación y R1.

## Ⓧ Quién la vacía: nadie. El grep, y tres vías más

Lo que me pedías enseñar, por texto (`grep -rn` sobre `src/`, 327 ficheros):

```
procesarObligado  → 1 línea: sif.procesador.ts:70 (su definición)
enviarSobre       → 3 líneas: sif.client.ts:355 (su definición) y sif.procesador.ts:10 y :11 (comentarios)
src/core/cron/cron.ts · sif|vfsub|remisi|aeat|cola|verifactu|sellado|procesar → 0 líneas
src/index.ts      · lo mismo → 4 líneas (3, 16, 18 y 19), las cuatro de assertVerifactuIdSistema (comprueba una constante al arrancar)
controles: un nombre derivado → 0 · `startCronJobs` en index.ts → 3
```

Y por AST, que no cuenta comentarios ni cadenas:

1. **Llamadas.** `procesarObligado`: declara 1, importa 0, llama 0, otra referencia 0. `enviarSobre`:
   lo mismo. `encolarAltaTrasSellado`: llama 1. Control de cero: un nombre derivado, 0 usos. Positivo:
   `sellarTrasEmision`, 11 llamadas.
2. **Lo que carga el proceso.** Desde `src/index.ts` se alcanzan 299 de 321 ficheros (0 importaciones
   relativas sin resolver). `encolarRemision.ts` y `cron.ts` **se cargan**; `sif.cola.ts`,
   `sif.procesador.ts` y `sif.client.ts` **no se cargan**. A `sif.procesador.ts` y a `sif.client.ts`
   no los importa como valor ningún fichero de `src/`; a `sif.cola.ts`, sólo `sif.procesador.ts`.
3. **Lo que se programa.** 6 `.schedule()` (los 6 `programar(` de `cron.ts`, que es el único fichero
   con `node-cron`) y 5 `setInterval`/`setTimeout` en todo `src/`: los que llaman a una pieza de la
   cola o tocan el modelo, **0**. Los seis crons llaman a: `expireQuotes`, `sendPendingReminders`,
   `sendInvoicePaymentReminders`, `runMaintenanceProposals`, `avisarSiEntroClienteReal`,
   `sendWeeklyDigests`, `runLifecycleEmails`, `barrerSellosAlbaran`.
4. **El detector de la casa** (`scripts/_guard-afirmacion-fiscal.mjs`, `envioConstruido`,
   SCRUM-1128), sobre el mismo árbol: `construido: false`, 0 llamantes de `enviarSobre`,
   `SIF_ENABLED` por defecto en OFF, 321 ficheros leídos. Le fabriqué una llamada en memoria y la
   cuenta (1); un `import type`, no (0).

Fuera de `src/`, `procesarObligado` y `enviarSobre` sólo salen en tests y en dos ficheros de
`scripts/` que los NOMBRAN sin llamarlos (el detector y `_sin-consumir-declarados.json`). No hay
`Procfile` ni `railway.json`, y `package.json` no trae ningún script de remisión.

Por ORIGEN: el commit que creó `procesarObligado` (`1f436fd80`, 30-sep) ya lo trae con la cabecera
«NO LO LLAMA NINGÚN CRON. Nada en `src/` lo invoca todavía», y `docs/master/SCRUM-1296.md:278`
dice «nadie llama al procesador ni a `enviarSobre`». Lo declarado y lo medido coinciden.

## Ⓨ Los valores de status: el código frente al máster

El `enum VfSubmissionStatus` del esquema y `ESTADOS_VF_SUBMISSION` (`sif.cola.ts:25`) son la misma
lista de cinco.

| valor | quién lo escribe | ¿lo filtra una lectura? | ¿el máster lo da para `VfSubmission`? |
| --- | --- | --- | --- |
| `pending` | el `@default`, al encolar (**se ejecuta**); y `sif.cola.ts:108` como reintento | `sif.procesador.ts:98` | no |
| `sent` | `sif.procesador.ts:120` | `sif.procesador.ts:81` | no |
| `accepted` | `sif.cola.ts:118, 121, 126, 129` | ninguna | no |
| `rejected` | `sif.cola.ts:131, 175, 195` | ninguna | no |
| `manual_review` | `sif.cola.ts:106, 123, 161` | ninguna | no |

**De los cinco, hoy sólo se puede escribir `pending`**: los otros cuatro salen de `procesarObligado`
o de las decisiones que sólo él aplica. Y el máster no da ninguno para esta entidad: 0 de sus líneas
traen un valor y `VfSubmission` a la vez. `manual_review` sale en una línea (la 580) y `rejected` en
una (la 398, del presupuesto); los otros tres salen por otras entidades.

`accepted`, `rejected` y `manual_review` no los filtra ninguna lectura: `manual_review` es «va a una
persona» y hoy no hay pantalla ni consulta que se lo enseñe a nadie.

## Ⓩ Los controles

19 de 19 en su sitio, salida 0. Cada recuento lleva los dos:

| recuento | control de cero (nombre DERIVADO del árbol) | positivo que tiene que salir |
| --- | --- | --- |
| accesos al modelo | `vfSubmissionZ` → 0 | `.invoice` → 114 |
| llamadas a las piezas | `procesarObligadoZ` → 0 usos | `sellarTrasEmision` → 11; el encolado → 1 |
| grafo de carga | `sif.procesador.ts` no alcanzable | `cron.ts` y `encolarRemision.ts` alcanzables; 0 sin resolver |
| lo programado | 0 tocan la cola | 6 `.schedule()` = 6 `programar(` |
| el máster | `VfSubmissionZ` → 0 líneas | las dos frases, en UNA línea cada una; `manual_review` aparece |
| el detector de la casa | un `import type` → 0 | una llamada fabricada → 1; ve 5 líneas con el host de la AEAT; misma población (321) |

Los nombres de cero no están escritos: el instrumento alarga uno real hasta que ningún fuente lo
contiene.

Medí primero sobre `8518dc7a1`; `main` se movió a `179c248b4` (entró el PR #2302, entre otros), lo
mergeé y volví a correr: la salida es idéntica byte a byte (`cmp`). En `src/` ese tramo de `main`
cambia una línea, de `invoicesAdmin.routes.ts`.

## ⓐ Lo que NO se ha medido

- **Ninguna base.** No sé si la tabla existe en producción, staging o dev, ni cuántas filas tiene.
  «Se llena» está medido en el código: quien selle una factura de un comercio que no sea el demo
  ejecuta el `create`. Con `INVOICING_ES_ENABLED` en OFF en producción puede no haber ninguna fila;
  eso lo dice `docs/master/SCRUM-1296.md`, no lo he medido.
- **Ningún test corrido**: no hay `dist/` y no toco tests. Que `procesarObligado` funcione cuando
  se le llama lo dicen `tests/scrum1296-procesador-cola.test.mjs` y compañía; no los he ejecutado.
- **Con qué se enviaron los 3 registros aceptados.** No desde `src/`. Existe
  `scripts/sobre-soap-prueba-aeat.mjs`; no lo he abierto.
- **El valor de `SIF_ENABLED` en Railway.** Sólo su valor por defecto en `src/core/flags.ts`.
- Un `import()` o `require()` con el nombre calculado no lo ve el grafo; no he contado cuántos hay.
- `public/`: ningún fichero nombra `vfSubmission` (búsqueda por texto); no he leído más.
- `docs/legal/AUDITORIA_CAMINO_EMISION.md`: sólo las líneas que casan.
- **Ningún test corre este instrumento.** Si mañana alguien engancha el procesador, este registro
  queda atrás y nada lo avisa; lo que sí lo vería es el detector de SCRUM-1128, que ya está en la
  tanda.
- El obligatorio de este PR: SIN LEER al escribir esto.

## ⓑ Qué corrió antes de empujar

`docs/master/evidencias/scrum1500d/cola.mjs`: salida 0, 19 controles. Los tests del registro
(scrum267, scrum1294, scrum525d, scrum812, scrum273), con este tramo ya escrito: 37 tests, 37 pasan,
0 caen, 0 saltados (leído del TAP en fichero). La tanda no se corrió.

## ⓒ Lo que me salió mal

- **Mi población perdió un fichero.** Excluí los `.d.ts` y conté 320; el detector de la casa lee
  321. Lo cazó el control que compara las dos poblaciones, en la primera pasada. No cambiaba ningún
  resultado (era `src/types/express.d.ts`), pero «320 ficheros» habría salido en la entrega.
- Intenté sobrescribir la salida guardada con `>` y el hook `guard-dangerous` lo paró. Tenía razón:
  comparé con `cmp` contra un temporal en vez de reemplazarla.
- Empecé a medir sin volver a traer `main`, que ya se había movido. Lo vi al copiar la hora.
- Volqué en el contexto una respuesta entera de `gh api -i` para leer una cabecera.

## Lo que pide el comentario 18912 → dónde se ve

| lo que pide | dónde se ve |
| --- | --- |
| ① las líneas 404 y 980 literales, y en qué se contradicen | sección Ⓥ |
| ② qué escribe filas, una a una | sección Ⓦ |
| ③ qué las lee | sección Ⓦ |
| ④ cron, worker o reintento; y si no hay, el grep | sección Ⓧ |
| ⑤ los valores de status en el código frente al máster | sección Ⓨ |
| ⑥ el veredicto en una frase | sección Ⓤ |
| buscarlo también por ORIGEN | secciones Ⓥ (los commits de las dos frases y el que borró la máquina) y Ⓧ (el que creó el procesador) |
| no tocar `src/`, el esquema ni los tests | `git diff --stat origin/main`: este registro y la carpeta nueva |
| nada de los 11 estados parados | NO HECHO, a propósito → siguen con el fundador |
