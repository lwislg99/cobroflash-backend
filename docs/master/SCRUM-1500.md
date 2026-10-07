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
