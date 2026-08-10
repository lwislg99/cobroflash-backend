# SCRUM-244 · RGPD: el borrado ya no revienta a mitad — y el resto queda a dictamen

**Fecha:** 3-ago-2026 · **Carril:** A · **Gate:** el ticket **NO se cierra**: 1(b) bloqueado por
dictamen del asesor fiscal. Lo entregado aquí es **1(a)**, que no tiene gate (no toca el camino de
emisión: solo el servicio de borrado, que hoy no llama ninguna ruta).

## Lo que se midió antes de tocar nada, porque cambió el ticket entero

El ticket pedía «exponer una ruta». La medición dijo que **exponerla tal cual habría sido peor que
no tenerla**, por dos motivos independientes:

### 1 · `Reconciliation` no estaba en el borrado, y no fallaba callando

De los 24 modelos del schema, **tres no tienen `merchantId`**: `Merchant` (la raíz), `Event` y
`Reconciliation`. Los dos últimos cuelgan de `Charge`. `Event` estaba tratado a mano y bien;
`Reconciliation` **no estaba en ninguna parte** (`grep -c reconciliation` → 0).

**Y no se quedaba huérfana: bloqueaba.** Su `@relation` no declara `onDelete`, luego la FK es
**RESTRICT**. El `deleteMany` de `charge` habría **fallado** con **ocho tablas ya vacías**. El
servicio devuelve `ok:false` en vez de lanzar (para eso está diseñado), pero el merchant queda
partido por la mitad: media identidad borrada y la otra media viva. Un borrado parcial de datos
personales es peor que ninguno — lo dice la cabecera del propio servicio, y esto lo demuestra.

### 2 · Por qué el guard existente no podía verlo, que es el hallazgo que importa

El guard de cobertura de SCRUM-192 **deriva del schema los modelos con columna `merchantId`** y
exige que cada uno esté cubierto. Es correcto para lo que mira. Pero estos modelos **no tienen esa
columna**: pertenecen a un merchant *por herencia*. Para ese guard **no existen**, y su verde nunca
habló de ellos. El único sitio donde existían era una lista escrita a mano — **y una lista a mano
no avisa de lo que le falta**. Es la familia de SCRUM-239/235/272: *el medidor mira un sitio y el
defecto vive en otro*.

## Lo entregado — 1(a)

- **`COLGADOS_DE_CHARGE`** (`src/modules/system/domain/borradoMerchant.ts`): los modelos que
  pertenecen a un merchant sin tener su columna, declarados con su motivo, y borrados en bucle
  filtrando **por su padre** (`where: { charge: { merchantId } }`) **antes** que ese padre.
  `event` se movió ahí desde su línea suelta; `reconciliation` se añadió.
- **`tests/scrum244-colgados-de-otro-modelo.test.mjs`** (10 tests): guard que **deriva del
  schema** los modelos sin `merchantId` que apuntan con `@relation` a uno que sí lo tiene, y exige
  que estén cubiertos. El siguiente que aparezca sale en rojo **el día que se declare**, no el día
  que alguien pida su baja.
- **Suelo anti-verde-hueco:** la derivación tiene que seguir encontrando ≥2 modelos. Comprobado
  cegándola: con el patrón roto ve 0 y **falla**, en vez de pasar sin mirar.
- **Control negativo:** ningún `deleteMany` puede salir con `where` vacío — sin él, «borrar por el
  padre» podría degenerar en «borrar la tabla entera» y los otros tests seguirían verdes.

**Rojo obligatorio, hecho por el mecanismo y no por un símbolo que falta:** el primer intento falló
por `SyntaxError` (la constante aún no existía), que no prueba nada. Se introdujo `COLGADOS_DE_CHARGE`
**con solo `event`** —el estado del mundo expresado en la forma nueva— y entonces salieron
**exactamente 2 fallos de 10**, nombrando `reconciliation (cuelga de Charge)`. Con el arreglo, 10/10.

## Lo que NO se ha hecho, y por qué

- **1(b) · Qué se borra y qué se anonimiza → DICTAMEN.** La lista de borrado incluye `invoice` y
  `auditLog`. La **regla 29** dice que una factura emitida jamás se edita ni se borra, y el
  **art. 17.3.b RGPD** exceptúa del derecho de supresión lo necesario para cumplir una obligación
  legal. Anonimizar *dentro* de la factura tampoco es gratis: la **huella de VeriFactu se calcula
  sobre su contenido y va encadenada**, así que tocarla destruye el valor probatorio que la
  conservación busca. Escrito como **pregunta cerrada (a/b/c + plazo)** en
  `docs/legal/PREGUNTAS_ASESOR.md` §E punto 13, con el análisis dentro para que el asesor no tenga
  que reconstruir el contexto. Referencia cruzada en `RGPD_TRATAMIENTO_DATOS.md` (pregunta 7).
- **3 · Quién dispara el borrado → DECIDIDO: opción C, mixta** (fundador, 3-ago-2026). El
  profesional **solicita** desde su cuenta —queda registrado, con fecha, y eso arranca el plazo
  legal— y el fundador **ejecuta** tras revisar. **El motivo de la decisión, que es el que manda:**
  lo que hoy falta para cumplir **no es la capacidad de borrar —ya existe— sino poder DEMOSTRAR
  que se atendió y cuándo.** C compra eso barato. El autoservicio completo (opción B) queda para
  cuando 1(b) esté resuelto, porque **un botón que borra facturas es peor que no tener botón**.
- **2 · Portabilidad: no se construye todavía, pero está medida.** El módulo de exports
  (`/admin/exports/datos.zip`, seis datasets en CSV + PDFs + XML VeriFactu, filtrable por fechas,
  con `requireRole('admin')` y filtrado por merchant) **sirve como base**: CSV cumple el
  «estructurado, de uso común y lectura mecánica» del art. 20. Le faltan tres cosas concretas:
  **(i)** siete datasets — `products`, `providers`, `teamMembers`, `attachments`,
  `maintenancePlans`, `albaranes`, `customerEvents`; **(ii)** una puerta de autoservicio (hoy exige
  rol admin y vive en `/admin`, no en «mis datos»); **(iii)** el registro de que se ejerció el
  derecho — el plazo legal es de **un mes** y sin registro no se puede demostrar que se atendió.

## Hallazgo de otro carril (reportado, no arreglado — regla 9)

`npm test` en `origin/main` está en **rojo por 1 test ajeno a esto**:
`tests/scrum273-registro-por-fichero.test.mjs` falla porque el commit `ba80273` metió la entrada de
**SCRUM-252** en `docs/YAQU_MASTER.md` cuando SCRUM-273 ya exige que los tickets nuevos vayan a
`docs/master/SCRUM-<n>.md`. Verificado que es previo y ajeno: el diff de esta rama no toca `docs/`
más que en ficheros nuevos, y la entrada está en `origin/main`. **Suite: 1088 tests, 1 fallo, y ese
fallo es ése.**

---

# SCRUM-244 · punto 3 (parte 1 de 2): EL REGISTRO de que se ejerció el derecho

**Fecha:** 3-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test`

> **Nota sobre el ancla.** Esta sección se midió contra `origin/main` =
> `dd61eb09b7a22121217c19dbbdd2ec13ab939873` · 2026-08-03T20:04:00+02:00. Va **en prosa y no como
> campo `Medido contra:`** a propósito: el fichero está en el censo heredado de SCRUM-267, cuya
> decisión escrita es que esas tres entradas **no se rellenan**. Ponerle el campo habría bajado el
> censo y obligado a editar el guard de otro ticket — así que el dato queda declarado sin cambiar
> una decisión que no es mía. Si prefieres que el fichero salga del censo, es una línea.

## Qué resuelve, y no es «poder exportar»

Exportar ya se puede. Lo imposible hoy es **demostrar que se atendió, y cuándo** — que es
justamente lo que se incumple: el art. 12.3 da **un mes desde la recepción de la solicitud**. Sin
registro no se sabe si un caso lleva tres días o cinco semanas, ni se puede probar después que se
respondió a tiempo.

## Dos instantes, porque el flujo tiene un humano en medio

Opción **C MIXTA** (decisión del fundador, 3-ago-2026): el profesional **solicita** desde su cuenta
—eso arranca el plazo— y el fundador **ejecuta** tras revisar. No son dos nombres para el mismo
hecho: hay una revisión humana entre medias, así que dos fechas no son teatro, son la forma del
flujo. El autoservicio completo espera a 1(b): **un botón que borra facturas es peor que no tener
botón.**

## Sin tocar schema, y sin tabla nueva

`AuditLog` ya traía todo: `createdAt` (los dos instantes), `entityId` (la correlación) y los dos
índices que las consultas necesitan (`[merchantId, action, createdAt]` y
`[merchantId, entityType, entityId]`). **Cero migraciones, cero índices nuevos** — y el schema es
el único freno duro del proyecto, así que evitarlo no es elegancia, es no abrir esa puerta.

**La correlación, que es lo único no obvio:** la fila de ATENCIÓN guarda en `entityId` el `id` de
la fila de SOLICITUD. Así «lo pendiente» es una diferencia de conjuntos entre dos columnas
indexadas — sin buscar dentro del JSON de `meta` y sin inventar un identificador propio.

## La pregunta que justifica el módulo

`solicitudesPendientes(cliente, { dias })` contesta **«¿cuántas solicitudes llevan más de N días
sin atender?»**. Un registro que guarda las dos fechas y no puede cruzarlas tiene el dato y no la
respuesta, y la respuesta es lo único que sirve para demostrar cumplimiento.

## Las dos acciones son BLOQUEANTES

Mismo criterio que `exportacion_fiscal`: registrar de menos es lo único que esto existe para
impedir. Una solicitud perdida en silencio deja **un plazo legal corriendo que nadie sabe que
corre**. Fire-and-forget aquí sería construir la prueba y tirarla si el `INSERT` falla.

`recordAuditOrThrow` pasa a devolver la fila (`Promise<{id}>`). Es **aditivo**: los llamadores
fiscales que la ignoran siguen igual. Hacía falta para que la atención pueda apuntar a su
solicitud sin releer la fila recién escrita, que sería una carrera contra uno mismo.

## Un defecto que cazó el propio test, al primer intento

`fechaLimite` usaba `setMonth`, que trabaja en hora **local**. Medido con el proceso en
`Europe/Madrid`: una solicitud del 1-mar a las 10:00Z daba límite el 1-abr a las **09:00Z** — el
cambio de hora CET→CEST cae en medio y **se comía una hora del plazo**, siempre hacia el lado
peligroso. Y peor que la hora: el resultado **dependía del huso del servidor**, así que el mismo
caso vencía en dos instantes distintos según dónde corriera el proceso. Corregido a `setUTCMonth`.

El plazo se cuenta por **mes de calendario, no por 30 días**: en un mes de 31, contar 30 adelanta
el vencimiento un día entero sobre una obligación legal.

## Verificado en rojo, tres veces, cada una en un mecanismo distinto

1. **La correlación se rompe** (la atención deja de apuntar a su solicitud) → cae nombrando que es
   «la fila que PARECE cumplimiento sin serlo».
2. **La consulta deja de excluir las atendidas** → caen dos tests: el registro diría que todo está
   al día, que es la mentira cara.
3. **Las acciones dejan de ser bloqueantes** → cae el que impide el fire-and-forget.

Las tres revertidas, verde comprobado después, y las inyecciones fueron en `dist`: `src` limpio.
**Suite ungated: 1162 tests, 0 fallos.**

## 🔴 Lo que NO tiene todavía, dicho aquí y no en una nota al pie

**Nadie lo dispara.** No hay ruta que registre una solicitud: eso es «la puerta», el paso
siguiente. Es a conciencia —el orden acordado es registro → cobertura → puerta— pero mientras
tanto **este mecanismo existe y no lo llama nadie**, que es exactamente el patrón que este
proyecto persigue. Queda escrito para que no se lea como terminado.

Y **la ruta de supresión sigue sin mergearse**: hoy ejecutarla destruiría el `AuditLog` fiscal.
Registro sí, ejecución no, hasta el dictamen.

---

# SCRUM-244 · punto 2: LA COBERTURA — «dame TODO lo mío», derivado y no enumerado

**Fecha:** 4-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test`

> **Ancla (en prosa, no como campo).** Medido contra `origin/main` = `24e0e4f336119797cc40e45f29fadc34d399352a` · 2026-08-04T11:15:46+02:00. Va en prosa **porque el guard de SCRUM-267 juzga por FICHERO y no por sección** — `entradas()` devuelve un objeto por fichero y `motivoSinAncla` corre sobre el texto entero, así que un campo `Medido contra:` aquí marcaría todo el fichero como anclado y lo sacaría del censo heredado. Medido, no supuesto.

## El «todo» no se escribe a mano, y esa es toda la diferencia

`/admin/exports/datos.zip` contesta **«dame mi actividad»**: seis datasets elegidos porque son
los que un profesional mira. Está bien y no se toca. Esto contesta otra pregunta — **«dame TODO
lo mío»** (art. 15 y 20) — y ahí una lista enumerada deja de ser una decisión de producto y pasa
a ser un **defecto**: envejece el día que alguien declara un modelo, y nadie se entera de que el
«todo» dejó de serlo.

El dato del repo, y ya van dos de dos: las listas de modelos **con** guard
(`MODELOS_POR_MERCHANT`, `ORDEN_BORRADO_MERCHANT`) están completas; las dos **sin** guard
(`wipeDemo`, el `TABLES` del backup) han derivado las dos.

Por eso aquí **no hay ninguna lista de modelos**. `modelosDelMerchant()` los deriva de
`Prisma.dmmf` —el schema compilado dentro del cliente generado, la misma fuente de la que ya
derivan SCRUM-192 y SCRUM-222— y un modelo nuevo con `merchantId` aparece **solo**.

## La trampa de los nombres físicos, medida antes de escribir nada

Se deriva por el **nombre del CAMPO** (`merchantId`), nunca por el de la columna. Medido contra
el DMMF: de los **21** modelos con `merchantId`, **19** mapean a `merchant_id` y **DOS no** —
`Quote` e `Invoice` guardan la columna en **camelCase** (`invoices.merchantId`).

Es la trampa que ya costó el backfill de SCRUM-205, y el rojo la enseña exacta: al derivar por
columna la lista **baja de 21 a 19 y desaparecen `Quote` e `Invoice`**. Un export de
portabilidad sin las facturas ni los presupuestos, sin un solo aviso.

Como el filtro va por Prisma (`findMany({ where: { merchantId } })`), el nombre físico no entra
en juego en ningún punto del módulo. Y si algún día hiciera falta, sale del DMMF
(`dbName ?? name`), jamás de una convención.

## Dos derivaciones independientes, atadas por el guard

| camino | fuente |
|---|---|
| producción | `Prisma.dmmf` (el schema compilado en el cliente) |
| guard | `modelosConTenancy(schema.prisma)` — la derivación que YA usan SCRUM-172 y 192 |

El guard exige que **coincidan**. Si divergen, algo está desincronizado —el cliente sin
regenerar es el caso típico— y este export estaría prometiendo «todo» sobre una lista que no es
la del schema. **No se ha escrito un tercer derivador**: reusar el existente es lo que impide
repetir el defecto que cerró SCRUM-240 (dos generadores capaces de calcular cosas distintas).

## Lo que queda fuera va DECLARADO, con su motivo

- **`authSession`** — tokens de sesión vivos. Exportarlos es meter credenciales operativas en un
  ZIP que viaja por correo: quien lo interceptara entraría en la cuenta. No son datos del
  interesado en ningún sentido útil; son la llave, no el contenido.
- **`auditLog`** — rastro fiscal, **bloqueado por dictamen** (punto 1b). Sacarlo ahora no
  prejuzga esa decisión; meterlo sí.

Y el guard comprueba las dos direcciones: que no haya modelos sin cubrir **ni declarar**, y que
cada exclusión siga correspondiendo a un modelo que existe — una exclusión huérfana confunde a
quien la lea.

## El suelo, que es la mitad del valor

Con el DMMF vacío —import roto, cliente sin generar— la derivación daría **cero** modelos y el
paquete saldría **vacío y verde**: un ZIP con un `LEEME` dentro, entregado como «todos tus
datos». Eso es peor que un error, porque nadie lo revisa. `comprobarDerivacion` exige un mínimo
de 15 y `construirPaquete` **lanza** en vez de entregar a medias.

El mínimo no se fija en 21 a propósito: un exacto obligaría a tocar este guard en cada PR que
añada un modelo, y un guard que estorba se acaba desactivando.

## Verificado en rojo, tres veces, cada una en un mecanismo distinto

1. **Derivar por la columna** en vez de por el campo → caen dos tests, y el mensaje enseña la
   lista de 19 sin `Quote` ni `Invoice`.
2. **El suelo a 0** → un datamodel vacío pasa por bueno, y el test lo caza.
3. **Un modelo se cae del paquete sin declararlo fuera** (`albaran`) → cae nombrándolo.

Las tres revertidas y verde comprobado después. Las inyecciones fueron en `dist`: `src` limpio.
**Suite ungated: 1196 tests, 0 fallos.**

## ⚠️ Un verde falso que casi cuela, y queda escrito

La primera vez los 12 tests salieron **verdes con el build ROTO** (`TS2353`): `node --test` corrió
contra un `dist` anterior. El verde no era del código que acababa de escribir. Se vio porque el
`tail` del build estaba en la misma salida — si hubiera mirado solo la línea de `pass`, habría
dado por bueno un módulo que no compilaba. **Un test verde solo vale si el build de esa misma
corrida pasó.**

## Lo que NO entra todavía, dicho aquí y no en una nota al pie

- **`Event` y `Reconciliation`** pertenecen a un merchant SIN tener su columna (cuelgan de
  `Charge`), así que la derivación por `merchantId` no los ve — por diseño. Están declarados en
  `COLGADOS_DE_CHARGE` y entran en el paso siguiente, junto con los **adjuntos binarios**, que no
  son filas de CSV.
- **Nadie lo dispara.** No hay ruta: eso es «la puerta», el paso 3. Es a conciencia, pero queda
  escrito para que no se lea como terminado — un mecanismo sin llamador es el patrón que este
  proyecto persigue.

---

# SCRUM-244 · punto 3: LA PUERTA — el profesional ejerce el derecho desde su cuenta

**Fecha:** 4-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test`

> **Ancla (en prosa, no como campo).** Medido contra `origin/main` = `57f6380a467f53340ea36f25c38cfb2e579de20b` · 2026-08-04T12:58:18+02:00. En prosa por lo mismo que la sección anterior: el guard de SCRUM-267 juzga por FICHERO, así que un campo aquí sacaría todo el fichero del censo heredado.

## Las tres piezas, unidas

`GET /admin/exports/portabilidad.zip` — cobertura derivada + registro del derecho + entrega.
Es el paso que convierte dos mecanismos sin llamador en un derecho ejercitable.

## 🔴 Lo que este ticket NO ha hecho, y es la distinción que decide todo

**Esta es la puerta de PORTABILIDAD (art. 15 y 20). NO es la de SUPRESIÓN (art. 17), que sigue
bloqueada por dictamen.** Son dos derechos distintos y solo uno destruye el `AuditLog` fiscal: la
portabilidad **solo lee**.

Y no basta con decirlo en un comentario, porque el día que alguien «complete» esta ruta añadiéndole
el borrado, **el diff se leería como una mejora** y el dictamen se habría saltado sin que nadie lo
decidiera. Por eso hay un guard que **falla si esta ruta llega a contener una operación de
borrado** — probado inyectando un `deleteMany` dentro.

## El rol NO se relaja

Decisión del fundador, con su motivo: el titular del derecho sobre los datos del **negocio** es el
negocio, no cada miembro del equipo. Un técnico tiene derecho sobre **sus** datos personales —su
nombre y su correo en `teamMembers`—, que es otra cosa y mucho más pequeña. Relajar un
`requireRole` para resolver un caso que no es el que parece es cómo se abren los agujeros.

La ruta hereda el `requireRole('admin')` del montaje, y hay un test que falla si ese montaje
cambia.

## El registro se escribe ANTES del primer byte

Mismo criterio que `exportacion_fiscal` (SCRUM-221): registrar de más es infinitamente menos grave
que registrar de menos. Si la descarga se corta a mitad, consta un ejercicio del derecho que quizá
no llegó — preferible a no poder demostrar que se atendió. Hay un test que compara las posiciones
en el AST y falla si el registro se cuela detrás de `archive.pipe`.

**Las dos fechas coinciden aquí, y no es que sobre una:** en autoservicio el derecho se satisface
en el acto, así que solicitud y atención son el mismo instante y `solicitudesPendientes` devuelve
—correctamente— que no queda nada pendiente. Donde no coincidirán es en la supresión, que lleva
revisión humana en medio (opción C MIXTA). El mismo registro sirve para las dos.

## Microcopy: cero inventada (regla 30)

La ruta responde con **códigos**, nunca con texto (`error: 'portabilidad_fallida'`), siguiendo
SCRUM-151. El `LEEME.txt` del art. 15 viaja con `[PENDIENTE microcopy oficial]`, que es lo que el
fundador autorizó: la pieza existe vacía para que ponerlo sea una línea el día que esté aprobado.

**Lo que NO se ha hecho, y está esperando texto aprobado: el botón en Configuración.** Una etiqueta
y su confirmación son microcopy, y adaptarlas de otro sitio ES escribirlas — la lección de
SCRUM-264, donde el texto existente hablaba de importe y hacía falta para cantidad.

## Un bug real que cazó el propio test

`datasetACsv` unía las filas con `''`. `csvRow` devuelve la fila **sin terminador** —lo pone quien
une, como en `sendCsv`— así que la cabecera quedaba **pegada a la primera fila** y el CSV entero
salía en un renglón: `a;b;c;d1;;2026-08-04T…`. Un fichero que se abre, no da error y no significa
nada. Corregido a `\r\n`, con un test que cuenta las líneas.

El otro fallo de esa misma corrida era **mío en el test**: exigía el JSON sin escapar, cuando
escaparlo es lo correcto. Se corrigió el assert, no el código.

## Verificado en rojo, tres veces

1. **Un `deleteMany` dentro de la puerta** → cae nombrándolo: la portabilidad se habría convertido
   en supresión.
2. **El registro detrás de `archive.pipe`** → cae por orden.
3. **El registro desaparece** → cae nombrando la función que falta.

Revertidas, verde después. **Suite ungated: 1222 tests, 0 fallos.**

## Sigue fuera, y sigue escrito

- **`Event` y `Reconciliation`**: pertenecen a un merchant sin tener su columna (cuelgan de
  `Charge`), así que la derivación por `merchantId` no los ve — **por diseño**. Declarados en
  `COLGADOS_DE_CHARGE`.
- **Los adjuntos binarios**, que van como ficheros y no como filas de CSV.
- **La ruta de supresión**, bloqueada por dictamen.

---

# SCRUM-244 · la descarga de portabilidad, EN EL MENÚ (donde se puede pulsar)

**Fecha:** 4-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test` · **UI:** vanilla (regla 4)

> **Ancla (en prosa).** Medido contra `origin/main` = `fed079eaa94931aa9893ef91df59c7a2011898c0` · 2026-08-04T14:17:00+02:00. En prosa por lo mismo que las secciones anteriores: el guard de SCRUM-267 juzga por FICHERO.

## El caso real que lo origina, y que ningún test de backend podía ver

La ruta funcionaba y **el fundador no consiguió usarla**: la puso detrás del hash del dashboard
(`/dashboard/#invoice-detail/admin/exports/portabilidad.zip`), así que **la petición nunca salió
del navegador**. No fue un fallo del backend — fue que no había dónde pulsar.

**Un endpoint sin sitio en la interfaz es, para quien lo necesita, lo mismo que un endpoint que
no existe.** Por eso el primer test del guard no comprueba estilos: comprueba que el botón existe
y llama a *su* ruta.

## Dos descargas, dos preguntas — y tienen que distinguirse en la pantalla

| | pregunta | forma |
|---|---|---|
| **Gestoría** (ya existía) | «dame mi actividad» | por fechas, seis entidades, para el asesor |
| **Portabilidad** (nueva) | «dame TODO lo mío» | sin filtros, formato abierto (art. 15 y 20) |

Van en cards separadas con su propio bloque. Y la de portabilidad **no ofrece filtros a
propósito**: dar fechas o selección de datasets sería invitar a ejercer a medias un derecho que
no admite medias tintas — y borraría justo la diferencia que evita que alguien se baje la que no
era creyendo que se lleva todo. Hay un test que falla si esa descarga acepta `from`, `to`,
`incluir` o `params()`.

## Microcopy: CERO inventada, y con guard (regla 30)

Todos los textos visibles de la card nuevos son **`[PENDIENTE microcopy oficial]`**: título,
descripción, botón, contador, avisos y toasts. Los aprueba el fundador y **no se adaptan de la
card de gestoría** — cambiar «tus datos para el asesor» por «todos tus datos» ES escribir
microcopy nueva, que es exactamente la lección de SCRUM-264.

Y no queda en una promesa: hay un test que **extrae los textos visibles de esa card y su
manejador y falla si alguno no es el marcador**. Probado inyectando un título plausible
(«Descargar todos tus datos») → cae nombrándolo. El día que lleguen aprobados, esto es un
reemplazo de una cadena, no una obra.

⚠️ El recorte de ese guard se acota a la card y su manejador **y comprueba sus dos extremos**: la
primera versión usaba un ancla de fin que no existía, `indexOf` devolvía −1 y `slice(inicio, −1)`
se llevaba medio fichero — dio rojo contra `0 && ds.length`, código de la función de filtros que
está fuera de la card. El ámbito demasiado ancho, otra vez.

## El nombre del fichero lleva la fecha

`portabilidad-YYYY-MM-DD.zip`. Dos ZIP con el mismo nombre en la carpeta de Descargas se
convierten en `portabilidad (1).zip` y nadie sabe cuál es cuál — y éste se descarga más de una
vez por naturaleza (antes y después de un cambio, o para comparar). `YYYY-MM-DD` porque ordena
alfabéticamente igual que cronológicamente.

El front lee el nombre de la cabecera `Content-Disposition` en vez de fijarlo, igual que la
descarga de gestoría: si el servidor cambia el formato, el fichero guardado lo sigue.

## Vanilla, y sin componentes nuevos (regla 4 · AB3)

Sin React, sin bundler. Se reutiliza el inventario existente —`customers-card`, `btn-secondary`,
los tokens `--ink` / `--muted` / `--neutral-400`— y el mismo patrón `fetch` + blob de la descarga
de al lado. **Ni un color, ni una sombra, ni una clase nueva.** `btn-secondary` se comprobó que
existe en `styles.css` antes de usarla, en vez de suponerlo.

Target del botón ≥44 px y `aria-live` en la línea de estado, como la card hermana.

## Verificado en rojo, tres veces

1. **Desaparece el botón** (el bug real del fundador) → cae explicando que un endpoint sin sitio
   donde pulsar no existe para quien lo necesita.
2. **Alguien rellena la microcopy de su cosecha** → cae nombrando el texto inventado.
3. **La portabilidad acepta filtros** → caen dos tests: se habría convertido en la descarga de
   gestoría con otro nombre.

Revertidas, verde después. **Suite ungated: 1228 tests, 0 fallos.**

## Lo que sigue fuera

La **supresión** no aparece en esta pantalla y hay un test que falla si alguien la menciona:
sigue bloqueada por dictamen, y hoy ejecutarla destruiría el `AuditLog` fiscal. `Event`,
`Reconciliation` y los adjuntos binarios siguen fuera del paquete, como estaba escrito.

**Falta lo único que no puedo poner yo:** los textos aprobados.

---

# SCRUM-244 · 1(b) LEVANTADO: la supresión existe, y ANONIMIZA en vez de borrar

**Fecha:** 10-ago-2026 · **Carril:** A · **Gate:** sin gate en `npm test`; el control contra base va
tras `LIBRO_PG_URL` (banco desechable) · **Flag:** `MERCHANT_DELETE_ENABLED` = OFF
**Medido contra:** `origin/main` = `08f0445315cbbee52aa6cb878a5b9fef5a9d6bc1` · 2026-08-10T13:37:47+02:00
**Entregado:** 2026-08-10T14:08:04+02:00

Esto cierra el **1(b)** que la primera entrada dejó «a dictamen» y desbloquea el punto 1 (la ruta),
que llevaba desde el 3-ago escrito como «exponerla tal cual habría sido peor que no tenerla».

## Las tres decisiones del fundador (10-ago-2026), y lo que cambian

**① DOS acciones de auditoría, no una** (`merchant_borrado` **y** `merchant_anonimizado`). Borrar y
anonimizar son actos **distintos**: con una sola acción, dentro de un año nadie podría saber qué se
hizo con los datos de quién. `AuditAction` es una unión CERRADA (regla 5) y crece solo así.

**② `MERCHANT_DELETE_ENABLED`, OFF por defecto.** Esto borra datos y es irreversible: **se
construye, no se enciende** (mismo criterio que la regla 24). Con el flag apagado la ruta responde
**404 y no 403** — una ruta que no existe todavía no anuncia que existe. La tabla P crece con su
fila (regla 5: la lista es cerrada) y `flags.test.mjs` pasa de 12 a 13 flags; **ese rojo llegó
solo**, antes que ninguna persona, que es exactamente para lo que está.

**③ El rastro fiscal se ANONIMIZA, no se borra.** Art. 17.3.b RGPD: queda excluido de la supresión
lo necesario para cumplir una obligación legal, y el registro de facturación hay obligación de
conservarlo. Se van los identificativos —nombre, email, teléfono, NIF, dirección, notas, del
negocio y de sus clientes—; se queda el asiento con su encadenamiento intacto. **Esto responde la
pregunta cerrada de `PREGUNTAS_ASESOR.md` §E punto 13** y cierra la decisión que
`borradoMerchant.ts` llevaba abierta desde SCRUM-207.

## Por qué la anotación va ANTES, y por qué eso solo funciona si se anonimiza

Anotar antes de ejecutar **no bastaba**: `ORDEN_BORRADO_MERCHANT` incluye `auditLog`, así que el
borrado completo **se habría llevado por delante la propia anotación**. Habría sido decorativa —la
misma trampa que un vigilante que rompe lo que vigila—. Como el rastro se conserva redactado, la
anotación previa sigue ahí cuando todo termina, y el test **la lee DESPUÉS**: es la única forma de
probarlo.

Dos correcciones que el propio test destapó, y que valen más que el código que arreglan:
`recordAudit` es **fire-safe** (no puede tumbar una respuesta) — aquí eso era justo lo contrario de
lo que hace falta, así que se usa `recordAuditOrThrow`; y la primera versión pasaba por el
**singleton**, con lo que la anotación se iba a **otra base** que la redacción. Constancia en otro
sitio no es constancia: el cliente entra por parámetro y el control contra el banco lo cazó con «la
anotación NO ha sobrevivido».

## El control que decide si esto vale

**Tras anonimizar, la cadena de huellas sigue verificando.** El test crea dos facturas encadenadas
(`i2.vfPrevHash === i1.vfHash`), anonimiza, y comprueba cadena, número, importe y QR intactos. Si
se rompiera, habríamos cambiado un problema legal por otro peor — y ése no se arregla, porque lo
sellado no se toca ni para arreglarlo (regla 29). La red `tocaIntocables` para el `data` **antes**
de llegar a la base el día que alguien añada `vfHash` «para limpiar bien».

## Lo entregado

- `src/modules/system/domain/anonimizarMerchant.ts` — `CAMPOS_PERSONALES` (lista **explícita** a
  propósito: derivarla «de todo lo que parezca texto» borraría el concepto de una factura),
  `INTOCABLES` con su motivo, `planDeAnonimizado()` (se calcula aparte de ejecutarse **para poder
  anotarlo antes**), `redaccionesPara`, `tocaIntocables`.
- `src/modules/system/domain/supresionMerchant.service.ts` — anota primero o no toca nada.
- `src/modules/system/app/routes/supresion.routes.ts` — `POST /admin/supresion/:merchantId`,
  admin-only y declarada en `ADMIN_ONLY_ROUTES`; 404 con el flag apagado; **409 si la confirmación
  escrita no es el nombre del negocio**.
- `tests/scrum244-supresion-y-anonimizado.test.mjs` — 10 tests.

## Rojos probados (por el mecanismo, no por sintaxis)

| Inyección | Cae | Lo que demuestra |
|---|---|---|
| se quita la anotación previa | `ROJO DEL MECANISMO: sin poder anotar, NO se borra nada` | sin constancia no se toca un dato |
| se quita la lectura del flag | `con el flag APAGADO la ruta responde 404` | el flag es puerta, no cartel |
| se quita la confirmación | `confirmacion que no coincide: 409` | el nombre escrito es requisito |
| la anotación pasa a ir después | `ANOTA primero y redacta despues` | el orden es el ticket entero |

## Lo que NO se ha tocado, dicho

- **Ninguna base real.** El control corre contra el banco desechable (loopback y base terminada en
  `_test`, **fail-closed**); los tests de la ruta sustituyen los modelos del cliente por dobles **y
  comprueban que la sustitución está puesta ANTES de invocar nada**. Si fallara, el test cae ahí y
  no sale una sola consulta — «nada contra producción ni staging, ni en lectura» tenía que ser un
  mecanismo, no una intención.
- **Cero `db push`, cero migración**; no toca `prisma/schema.prisma`.
- **Cero superficie de usuario.** No hay pantalla: la confirmación se **propone** abajo, no se pinta.

## Propuesta de microcopy — PENDIENTE de aprobación del fundador (regla 30)

Dice **qué se borra**, **qué se conserva y por qué**, y obliga a un acto deliberado: escribir el
nombre del negocio, no un «¿seguro?» que se pulsa sin leer. Escribirlo obliga a **mirar de quién
son los datos que se van**, que es el error que no se deshace.

> **Vas a borrar los datos personales de {NOMBRE DEL NEGOCIO}.**
>
> **Se borra:** nombre, email, teléfono, NIF, dirección y notas del negocio y de todos sus
> clientes. No se puede deshacer.
>
> **Se conserva:** las facturas emitidas —número, importe, fechas y líneas— y el registro de
> actividad. La ley obliga a guardarlas aunque se ejerza el derecho al borrado (art. 17.3.b RGPD),
> y tocarlas invalidaría la prueba de todas las facturas siguientes.
>
> Para confirmar, escribe el nombre del negocio: `[____________]`
>
> [Cancelar] · [Borrar los datos personales]

## Tope de SCRUM-411: **NO se ha bajado a 7, y aquí está el número**

El encargo pedía bajarlo de 8 a 7 en este mismo commit. **Medido con el propio censo, en los dos
árboles:** main = **8** módulos de dominio inalcanzables, esta rama = **8**. Los mismos ocho.

Este ticket **no saca a ninguno de la lista**: `borradoMerchant.ts` ya era alcanzable en main (entra
por `barridoDemo.ts`), así que nunca estuvo entre los ocho — lo huérfano era su **export**
`borrarMerchant`, y **lo sigue siendo** porque la decisión ③ manda anonimizar en vez de borrar. Los
dos módulos nuevos nacen **alcanzables** (dominio: 85 → 87; inalcanzables: 8 → 8), que es
justamente la prueba de que la superficie existe. El trinquete es de **igualdad**
(`assert.equal(lista.length, MAX)`), no de «≤»: ponerlo en 7 lo dejaría en rojo hoy mismo por un
motivo ajeno a este ticket. Se deja en 8 y se reporta.

## Hallazgo de otro carril (regla 9): `scrum297-evidencias-postgres` está ROJO en main

Con `LIBRO_PG_URL` puesto, `tests/scrum297-evidencias-postgres.test.mjs` falla **en `origin/main` =
08f0445**, sin nada de esta rama: comprobado ejecutándolo en un árbol de main con entorno completo.
Mismo mensaje: «el sello del albarán sale como `hash_no_coincide`».

**Causa localizada, y no es el verificador:** SCRUM-300 hizo que `obra` salga de `Job.direccion` en
la **v:1** del sello y de `Albaran.lugarEntrega` en la **v:2**, y que la versión **se LEA del dato**.
La fixture de SCRUM-297 escribe `evidenciaFirma: { v: 1, … contentHash: computeAlbaranContentHash(fuentes) }`
—declara v:1 pero sella con la versión **por defecto**, hoy v:2—, así que el verificador recalcula
con las reglas de v:1 y no cuadra. **El producto está bien; la fixture es la que miente.** Arreglo
de una línea (`computeAlbaranContentHash(fuentes, 1)`), de otro carril, **no tocado aquí**.

## Aviso de rama concurrente

`origin/scrum-244-microcopy-aprobada` (f6c6848) trabaja el **mismo número de ticket** en otra parte
—los ocho textos aprobados del menú de portabilidad, `exportView.js`— y añade **su propia sección
de 84 líneas a este mismo fichero**. No hay solape de código con esta rama. Al mergear, **se
conservan AMBAS secciones**.
