# SCRUM-1367 · El sembrador sabe crear los cuatro casos que le faltan a la cuenta QA

**Medido contra:** `origin/main` = `5d7aaebc41d71d24102a4852c1de04059d9ac559` · 2026-10-02T11:20Z

A9: comprobación → `tests/scrum1367-sembrar-casos.test.mjs`

Carril S3 (bancos e instrumentos). Por encargo del orquestador (punto 3 del relevo del 2-oct).

🔴 **Nada de esto se ha ejecutado contra producción.** La regla de ejecución es del fundador y sigue
pendiente. Aquí entra la CAPACIDAD, probada sin red.

## El hueco

Cuatro verificaciones de cuatro sesiones se quedaron a medias el 1-oct por lo mismo, cada una
descubriéndolo por separado: la cuenta QA (merchant 46) no tiene ① ningún Trabajo con presupuesto
aceptado, ② ningún presupuesto con plan de cobro propio, ③ perfil fiscal (y por eso «Guardar
cambios» no envía), ④ ningún albarán y parte con el mismo id (SCRUM-1360).

## Qué entra

| Pieza | Qué hace |
|---|---|
| `scripts/qa/sembrar-casos.mjs` | Cuatro órdenes: `aceptado`, `plan`, `perfil-fiscal`, `mismo-id [--crear-hasta N]`. |
| `tests/scrum1367-sembrar-casos.test.mjs` | 17 tests sin red, con los esquemas de verdad de `dist/`, y 6 mutaciones declaradas. |
| `docs/RUNBOOKS.md` R24 | Cómo se crea cada caso y qué deja, para quien lo vaya a correr cuando haya regla. |

Vive en un fichero APARTE de `sembrar-qa.mjs` y no dentro: aquél tiene la autorización del
29-sep-2026 con su lista blanca, y éste añade una escritura que aquélla no cubre (ACEPTAR un
presupuesto). Dos ficheros, dos permisos: el fundador puede autorizar uno sin el otro. Los cerrojos
no se copian: la cuenta se comprueba con el `comprobarCuentaQA` de allí y todo lo demás sale por su
`escritura`. Lo ÚNICO que se añade es `POST /admin/quotes/<id>/accept`, y un test lo fija en una
entrada.

## Lo que se leyó en `src/` (no visto en producción)

- Aceptar (`acceptQuoteAdmin`) sólo cambia el estado del presupuesto; la ruta crea el Trabajo
  después, sin esperar (`ensureJobForQuote(...).catch`), con `totalAceptado` = total del presupuesto.
  Por eso la orden BUSCA el Trabajo hasta cinco veces y, si no aparece, sale 1.
- El plan propio viaja en el alta (`customBillingPlan` en `POST /quote/create`).
- El esquema del perfil (`merchantProfileUpdateSchema`) pide los cuatro campos como texto no vacío
  y el test pasa el perfil de prueba por él. Lo que haga la ruta DESPUÉS del esquema no se ha
  ejecutado; si el servidor guardara otra cosa, la orden relee, lo ve y sale 1.
- `GET /admin/albaranes` devuelve `{ filas }` y `GET /admin/partes`, `{ partes }` (tope 200).

## Un defecto del borrador, cazado por el test

El borrador heredado llevaba el plan en porcentaje (`40` y `60`). `validateCustomBillingPlan`
exige FRACCIÓN (`Σ round(percentage*100) === 100`): en producción la orden `plan` habría muerto con
un 400. Es el mismo defecto que SCRUM-1268c (el IVA en porcentaje), y lo cazó lo mismo: pasar el
cuerpo por el validador de verdad y no por un servidor falso que dice que sí a todo.

## Verificación

- `node --test tests/scrum1367-sembrar-casos.test.mjs`: 17 tests, 17 pass, 0 fail, 0 skip.
- Mutación (base sin mutar verde primero): 6 de 6 mutaciones aplicadas tumban el test que nombran, y
  sólo ése; árbol restaurado byte a byte y vuelto a correr en verde.

## Aceptación del ticket → dónde se ve

| aceptación | dónde se ve |
|---|---|
| 1. Existe en una cuenta de prueba un Trabajo con un presupuesto ACEPTADO (y a ser posible un segundo con un tramo emitido) | NO HECHO → espera la regla de ejecución del fundador. La capacidad: orden `aceptado`. El segundo, con tramo emitido, NO entra: es emitir factura. |
| 2. Queda escrito cómo se crea sin tocar producción a mano | `docs/RUNBOOKS.md` R24 |
| 3. Crear el fixture no emite ningún documento fiscal ni cobra nada | `tests/scrum1367-sembrar-casos.test.mjs` («① «aceptado» desde el sembrado base…» y «🔴 LISTA…») |

## Lo que queda fuera, dicho

- El caso «Parcial» (un tramo ya emitido) exige emitir una factura: no entra, ni aquí ni por este camino.
- ④ depende de los contadores de la base: si el de partes ya pasó del mayor albarán, la orden lo
  dice y no se alcanza creando partes. La salida sería crear albaranes, y emitir uno gasta número.
- ③ cambia razón social y NIF, que entran en el hash de la firma de los albaranes: el albarán QA
  firmado antes dejará de verificar. La orden lo avisa al escribir.

# SCRUM-1367b · El sembrador sabe crear el albarán con diez fotos y el albarán firmado

**Medido contra:** `origin/main` = `ac17213a11b263372d494a52b8dd28c97e0e65a4` · 2026-10-02T14:13Z

A9: comprobación → `tests/scrum1367b-sembrar-albaranes.test.mjs`

Carril S3. Por encargo del orquestador (relevo del 2-oct, s3-2octd): el punto ⑤ del hueco y los
casos que S2 añadió ese día en Jira (comentario 18143).

🔴 **Nada de esto se ha ejecutado contra producción.** La regla de ejecución sigue siendo del
fundador. Entra la CAPACIDAD, probada sin red.

## Qué entra

| Pieza | Qué hace |
|---|---|
| `scripts/qa/sembrar-albaranes.mjs` | Dos órdenes: `diez-fotos` y `firmado`. Cada una con SU albarán (clave de idempotencia fija). |
| `tests/scrum1367b-sembrar-albaranes.test.mjs` | 16 tests sin red, con las reglas de verdad de `dist/` (`validarLineas`, `canTransitionAlbaran`, `fotoYaSubida`, `exigirNombreFirmante`, `resolverCalidadFirmante`), y 5 mutaciones declaradas. |
| `docs/RUNBOOKS.md` R24 | Las dos órdenes nuevas, qué dejan y qué no hacen. |

Fichero APARTE de `sembrar-casos.mjs`, por el motivo de siempre: firmar un albarán es irreversible
y ninguna de las dos listas lo cubría. Tres ficheros, tres permisos. Lo ÚNICO que se añade es
`POST /admin/albaranes/<id>/fotos` y `POST /admin/albaranes/<id>/firmar`; crear y emitir salen por
la `escritura` de `sembrar-qa.mjs`. Ninguna lista existente se ha ensanchado.

## Lo que cubre de la lista de S2 (c.18143)

| Lo que no se pudo ver | Con qué orden |
|---|---|
| «foto» con diez fotos ya subidas (SCRUM-1302, #2016) | `diez-fotos` |
| cantidades «2,5» y «12.345» en el resumen del pad (SCRUM-743, #1959) | las dos: sus albaranes llevan una línea de 2,5 m y otra de 12345 ud |
| la caja de un albarán FIRMADO (SCRUM-1360, #2087) | `firmado` |
| guardar el plan con la versión movida (SCRUM-1285, #2095) | ya estaba: `sembrar-casos.mjs plan` |

## Lo que se leyó en `src/` (no visto en producción)

- El alta de albarán admite `lineas` y las valida (`validarLineas`); en un Trabajo sin presupuesto
  no pueden decir que vienen de una línea de presupuesto, y no lo dicen.
- Subir dos veces la misma foto devuelve la primera (`fotoYaSubida`): por eso las diez son
  distintas, y por eso repetir la orden no ocupa plazas. La undécima es un 409: la orden para antes.
- `POST /:id/firmar` (firma en el sitio) no envía nada; exige nombre del firmante y admite la
  calidad vacía. Un firmado no admite fotos: por eso el de las fotos es OTRO albarán.
- Razón social y NIF del merchant entran en el hash de la firma: la orden `firmado` no firma con
  el perfil fiscal vacío, y dice que antes va `sembrar-casos.mjs perfil-fiscal`.

## Verificación

- `node --test tests/scrum1367b-sembrar-albaranes.test.mjs`: 16 tests, 16 pass, 0 fail, 0 skip.
- Mutación (base sin mutar verde primero): 5 de 5 mutaciones declaradas tumban el test que nombran
  (dos de ellas tumban además un segundo test); árbol restaurado byte a byte y verde otra vez.

- Tanda dirigida local: 234 ficheros, 2332 tests. Un rojo propio, corregido antes de empujar (abajo),
  y el ciego de esta máquina (`scrum1321 · PUERTA 1b`).

## Error propio

El cerrojo de cuenta se probó con el merchant demo (id 1) como «cuenta que no es la QA», y lo cazó
el guard de SCRUM-409 en la tanda. Es el MISMO tropiezo que tuvo el primer tramo de este ticket esa
mañana (commit `ebf6df96`): quien releva no hereda la cicatriz, la hereda el guard. Se cambió por un
merchant inventado.

## Lo que queda fuera, dicho

- **Una factura** en la cuenta QA (botones de anular y rectificar, SCRUM-1142): emitirla es el
  camino fiscal. No entra por un sembrador; es decisión del fundador.
- **Un parte con líneas dictadas no respaldadas** (SCRUM-1266): salen de la IA del dictado, no de
  una escritura que se pueda fijar.
- **Una sesión de operario** (SCRUM-1338): es una cuenta, no un dato.
- **Un cliente sin móvil con un albarán** (SCRUM-1302, #2015): el cliente sin móvil existe (#84),
  pero un albarán cuelga de un Trabajo y el de ese cliente no está sembrado. Sin construir.
- **Firmar por el enlace público** (el cliente, con su token): aquí se firma en el sitio. La caja
  del firmado se ve igual; el recorrido del enlace, no.
- La firma y las fotos son cuadrados de colores: sirven para contar y para ver cajas, no para
  juzgar cómo se ve una foto de obra.

# SCRUM-1367c · La orden `sin-movil`: un albarán de un cliente sin móvil ni teléfono

**Medido contra:** `origin/main` = `f30b1a4052957e245ebe1cfef53bbef410c5816b` · 2026-10-02T16:28:50Z

A9: comprobación → `tests/scrum1367c-albaran-de-cliente-sin-movil.test.mjs`

Puesto S3 (s3-2octe). **Capacidad. Nada ejecutado contra producción**: la cuenta QA no tiene sesión
viva y la regla de ejecución del sembrador sigue siendo del fundador.

## Qué hace

`node scripts/qa/sembrar-albaranes.mjs sin-movil` deja, en la cuenta QA:

| Qué | Cómo se reconoce | Si ya está |
|---|---|---|
| Un cliente sin móvil ni teléfono | nombre exacto «Cliente sin móvil de pruebas QA» | se usa; no se crea otro |
| Su Trabajo | título exacto «Trabajo de un cliente sin móvil, de pruebas QA» | se usa |
| Un albarán emitido, con las dos líneas de prueba | clave de idempotencia fija por trabajo | no se emite otra vez |

- No usa el cliente #84 que otra sesión creó a mano para SCRUM-1198: no sé su nombre exacto y no se
  puede leer hoy. El caso tiene su propio cliente y no depende de lo que haya en la cuenta.
- Si el cliente ya existe y alguien le puso móvil o teléfono, la orden sale 1 **sin escribir nada**.
- Al acabar relee la ficha del cliente. Si vuelve con un número, sale 1 y no da el caso por hecho.
- No añade ninguna escritura a la lista: cliente, trabajo, albarán y emitir salen por la `escritura`
  de `sembrar-qa.mjs`, que ya las admitía. No firma, no factura, no cobra y no envía.
- Emitir gasta un número ALB y no se deshace, igual que las otras dos órdenes.

## Verificación

| Qué | Resultado |
|---|---|
| `tests/scrum1367c-…` y `tests/scrum1367b-…` juntos | 23 tests, 23 pasan, 0 caen, 0 saltos |
| Las 3 mutaciones declaradas, con la base sin mutar verde primero | 3 caen de 3, cada una en el caso que nombra |
| Contra producción | NO corrido |

El panel falso valida el alta del cliente con `customerCreateSchema` y la del trabajo con
`datosDeTrabajoDirecto`, los dos de `dist/`: que el servidor acepta un cliente sin número lo dice su
propio validador. Lo que el test no dice: qué devuelve de verdad `GET /admin/customers/:id` en
producción. La forma (`mobile`, `phone`) está leída en `src/modules/system/customerAdmin.ts`.

## Lo que sigue fuera, con su motivo

| Caso | Por qué no entra |
|---|---|
| Una factura en la cuenta QA | Camino fiscal. Del fundador. |
| Un parte con dictado no respaldado | Sale de la IA del dictado, no de una escritura que se pueda fijar. |
| Una sesión de operario | Es una cuenta, no un dato. |
| Firma por enlace público | Manda algo a un tercero; las rutas de envío están prohibidas en el sembrador. |

## Error propio

El primer nombre que le puse al cliente fue «Cliente de pruebas QA sin móvil», que CONTIENE el del
cliente de base. La búsqueda del panel es por subcadena: buscar el de base habría devuelto los dos.
Hoy `sembrar-qa.mjs` filtra por nombre exacto y no habría fallado, pero dependía de eso. Cambiado
antes de empujar; el último caso del test fija que ningún nombre contiene al otro.

# SCRUM-1367d · Las tres respuestas «leídas en `src/`», vistas en producción

**Medido contra:** `origin/main` = `eca8566d130fc35e455b27508b1f3c199dc6263b` · 2026-10-02T17:02Z

A9: sin fallo que generalice — sólo registro: tres lecturas de producción con su fecha, sin código nuevo.

Puesto S3 (s3-2octf). **Sólo lectura: tres GET con la cuenta QA, por `peticion` de
`scripts/qa/sesion-panel.mjs`, que rechaza todo lo que no sea GET. Nada escrito ni sembrado.**
Control positivo antes de medir: `GET /admin/me` → 200.

Los tramos de arriba dejaron dicho que estas formas estaban leídas en `src/` y no vistas. Vistas el
2-oct-2026 ~17:00Z:

| Ruta | Lo que se había leído | Lo que devuelve producción |
|---|---|---|
| `GET /admin/customers/84` | ficha con `mobile` y `phone` | 200 · objeto plano (sin envoltorio), con `id`, `mobile` y `phone`; los dos `null` en el cliente #84 |
| `GET /admin/albaranes` | `{ filas }` | 200 · `{ filas, contadores, ejes }`; cada fila lleva `id`, `numero`, `estado`, `jobId`, `clienteId` |
| `GET /admin/partes` | `{ partes }` | 200 · `{ partes }`; cada parte lleva `id`, `jobId`, `estado` |

Coincide con lo que leen las órdenes: `sin-movil` relee la ficha como objeto plano (`releido.id`) y
`mismo-id` lee `filas` y `partes`.

## Un dato para quien corra `mismo-id` cuando haya regla

Ese día la cuenta QA tenía un albarán (id 46) y dos partes (ids 10 y 9). El contador de partes va por
detrás del de albaranes: el caso ④ se alcanzaría creando partes, pero son bastantes más que uno. Es
una foto de ese momento; la orden lo vuelve a medir al correr.

## Lo que esto NO dice

Que las ESCRITURAS de las órdenes funcionen en producción. Ninguna se ha corrido.

## SCRUM-1367e · las cinco condiciones de c.18479, dentro de `aceptado` (14-oct-2026)

Puesto S3 (s3-14octb), 09:20Z (hora de GitHub), base `origin/main` `7f5e1dd225430829497a6a778f06527892b606f4`.
**Nada sembrado ni escrito en producción.** Sólo lecturas GET con la cuenta QA (abajo).

| Condición (c.18479) | Antes de este tramo | Ahora |
|---|---|---|
| 1 · sólo la cuenta QA | sí (`comprobarCuentaQA`: merchant 46 y owner) | igual |
| 2 · ni documento ni cobro, y lo comprueba después | **no**: lo decía el comentario, no se medía | ids de `/admin/invoices`, `/admin/cobros` y `/admin/albaranes` antes y después; si difieren, sale 1 gritando. También si el `accept` revienta o el Trabajo no sale. Lista ilegible o llena = no acepta. ⚠️ **«deshace» NO se cumple:** un aceptado no se rechaza (409) y un emitido no se borra (regla 29) |
| 3 · teléfonos del rango imposible | sólo heredado de `sembrar-qa` (busca el cliente por nombre) | relee la ficha del cliente; todo teléfono `340` + 8 dígitos, o no escribe |
| 4 · deshacible y declarado | dice qué crea, no cómo se quita | dice qué queda y que **no se quita por el panel**. ⚠️ «deshacible» NO se cumple, por lo mismo que en la 2 |
| 5 · fail-closed si `INVOICING_ES_ENABLED` no está en OFF | **no** (0 menciones) | `GET /admin/me` → `modoEmision` tiene que ser `receipt` (lo calcula `getEmissionMode`). Cualquier otro valor o ninguno → sale 3 sin escribir. Se lee otra vez justo antes del `accept` |

**Medido:**

* `node --test tests/scrum1367-sembrar-casos.test.mjs`: 23 tests, 23 pass (17 de antes + 6 nuevos).
* 10 mutaciones declaradas (6 + 4), y cada una tumba el test que nombra. Base sin mutar verde antes y después.
* `npm run build` sale 2 por 7 errores de tipos de Prisma (`seriesYear`, `toPhone`), del cliente viejo en los `node_modules` compartidos. No son de este tramo.

**Visto en producción (sólo GET, cuenta QA, 14-oct ~09:18Z):**

| Ruta | Respuesta |
|---|---|
| `/admin/me` | `merchantId: 46` · `isOwner: true` · `modoEmision: "receipt"` |
| `/admin/invoices` | array, 0 elementos |
| `/admin/cobros` | array, 0 elementos |
| `/admin/albaranes` | `{ filas }`, 2 filas |
| `/admin/customers/83` | `mobile: "34000001268"` · `phone: null` |

🔴 **Lo que impide sembrarlo hoy:** `/admin/me` da `plan: "trial"` con `planExpiresAt: 2026-10-12T14:41:58.799Z`, y `POST /quote/create` lleva `requireActivePlan`, que con la prueba vencida responde **403 `trial_expired`** (`src/core/http/authMiddleware.ts`). La orden fallaría en el alta del borrador (sale 1 sin aceptar nada). Afecta a cualquier sesión que cree presupuestos en la cuenta QA. Alargar el plan es escribir en el merchant: no lo hago yo.

## SCRUM-1367e · seguimiento: el rojo de #2460 era mío (14-oct-2026)

**Medido contra:** `origin/main` = `099cfd383764b8cd87ab78e9ef7df8ca57a206a7` · 2026-10-14T16:25:50Z

Puesto S3 (2ª tanda del 14-oct).

* **Por qué estaba rojo.** El obligatorio de #2460 (job 115783802215, punta `1577a4f`) cayó sólo por `SCRUM-262 · todo teléfono sembrado está en el rango imposible`. La causa era `tests/scrum1367-sembrar-casos.test.mjs:441`, que usaba `phone: '911234567'`, un fijo de rango real, como caso negativo. Era un defecto de este tramo, no algo ajeno.
* **Qué cambia.** Los dos casos negativos de la condición 3 pasan a `mobile: '34612'` y `phone: '91123'`. Siguen fuera del rango imposible, así que el sembrador los sigue rechazando con el mismo mensaje, y tienen cinco cifras: no pueden ser de nadie, porque un abonado español tiene nueve. El `mobile: '34612345678'` de antes también era de rango real, y el guard no lo veía.
* **Medido:** `node --test tests/scrum1367-sembrar-casos.test.mjs tests/scrum262-telefonos-de-prueba.test.mjs` da 28 tests, 28 pass. El rojo previo es el del CI, con el `911234567` nombrado.
* **Hallazgo de paso, sin arreglar aquí:** `ESCRITURA` del guard 262 no incluye `mobile`, aunque `Customer.mobile` existe en el esquema. Con el mismo recorte de ficheros y la misma forma de literal hay 22 `mobile: '…'`, y 5 están fuera de rango. Uno era este. Los otros cuatro: `scrum1032-contacto-con-un-toque.test.mjs:47` y `:81` (dos, con números de ficción del Reino Unido y de EE. UU.) y `scrum312-importador-clientes.test.mjs:303` (`34600000009`, de rango real). Ensanchar el guard cambia el veredicto de ficheros de otros tickets, así que se lo paso al orquestador.
* **Decisión 4 (orquestador, 14-oct):** basta con «declarada» si la salida lista los ids creados. Lo hace la `:279` (`el presupuesto #<id> … y su Trabajo #<id>`), y el test lo comprueba en la `:504`.

A9: comprobación → `tests/scrum262-telefonos-de-prueba.test.mjs`

## SCRUM-1367f · aceptar un borrador que YA existe, y el caso ① sembrado en la cuenta QA (14-oct-2026)

**Medido contra:** `origin/main` = `bcd333823d9f97ea55a6dd9a126d9d0e89b80db3` · 2026-10-14T17:32Z (hora de GitHub)

Puesto S3 (3ª tanda del 14-oct). Encargo del orquestador: `POST /admin/quotes/:id/accept` no lleva el paywall, así que el caso ① se puede sembrar sin crear un presupuesto, por el sembrador y con las cinco condiciones.

**Qué cambia.** `node scripts/qa/sembrar-casos.mjs aceptado --presupuesto N` acepta el borrador #N que ya existe, en vez de crearlo. Corre por el mismo camino que la orden sin opción y con las mismas cinco condiciones de c.18479. Lleva además dos cerrojos:

* el #N tiene que ser del cliente QA, que es aquél cuyos teléfonos mira la condición 3. Si es de otro cliente, sale 3 sin escribir;
* si el cliente QA ya tiene un presupuesto aceptado, no se acepta otro: sale 1 y nombra el que hay. Como los borradores de producción no llevan marca, la idempotencia es ésta. Vale también al revés: sin la opción, un aceptado sin marca impide dar de alta otro.

**Medido sin red:** `tests/scrum1367-sembrar-casos.test.mjs` da 28 tests y 28 pass (23 de antes y 5 nuevos). Hay 13 mutaciones declaradas (10 de antes y 3 nuevas), y cada una tumba el test que nombra. La base sin mutar sale verde antes y después.

**El 403, recibido.** `POST /quote/create` con cuerpo `{}` y la sesión de la cuenta QA devuelve **403 `{"error":"trial_expired","redirect":"/dashboard/#plans"}`** (`Date: Wed, 14 Oct 2026 17:31:25 GMT`). El cuerpo vacío se eligió a propósito: si el plan estuviera activo, la validación lo habría parado con un 400 y no se habría creado nada. Antes, como control positivo, la misma cookie dio `GET /admin/me` → 200, merchant 46, `plan: "trial"`, `planExpiresAt: 2026-10-12T14:41:58.799Z`.

**Corrido en producción (cuenta QA, ~17:31Z):** `aceptado --presupuesto 206` sale 0.

| Visto | Por dónde |
|---|---|
| presupuesto #206 (nº 5) `accepted` | salida del sembrador y `GET /admin/quotes/206` |
| **Trabajo #77**: `quote.id` 206, `totalAceptado` 1.21, `remaining` 1.21 EUR, `totalCobrado` 0, `invoices` 0 | `GET /admin/jobs` |
| facturas 0 y cobros 0 después; ids de facturas, cobros y albaranes iguales antes y después (2: los albaranes 46 y 47) | condición 2 del sembrador, y `GET /admin/invoices` y `GET /admin/cobros` |
| repetir la orden: sale 0 y no escribe («ya estaba aceptado (no se repite)») | salida |
| `--presupuesto 204`: sale 1 («ya tiene un presupuesto aceptado (#206)») y el 204 sigue en `draft` | salida y `GET /admin/quotes/204` |

**Por qué el 206.** Los seis borradores tenían un uso medido:

* 202: es el presupuesto base `[QA-1268]`.
* 203: cuelga del Trabajo 76, que es el caso NEGATIVO de SCRUM-1355; ése se conserva.
* 204 y 208: son las versiones de SCRUM-1302 que usa S1.
* 205: es del cliente 84 (SCRUM-1198).
* 206: lo usaban las sondas de SCRUM-1150 y SCRUM-1482, que sólo leían.

⚠️ Riesgo declarado: esas sondas ven ahora el 206 aceptado. Ninguna dependía del estado: una mide el título y la otra tiene el POST de revisiones interceptado.

**Lo que queda en la cuenta QA y NO se quita por el panel:** el presupuesto #206 aceptado y el Trabajo #77.

**Qué desbloquea (el lado POSITIVO, un Trabajo con presupuesto aceptado):** SCRUM-1355, 1369 y 1370. 1365 lo tiene a medias, porque pide un Trabajo TERMINADO y el #77 está en `pendiente_agendar`. **No desbloquea:** 1285, que pide un plan propio y para eso hay que crear presupuesto; 1227, que pide el perfil fiscal ③ y no tiene regla; ni 1375, que pide un albarán `parcial`/`facturado`.

A9: comprobación → `tests/scrum1367-sembrar-casos.test.mjs`

## SCRUM-1367g · R25: la regla de firmar en la cuenta de QA (16-oct-2026)

**Medido contra:** `origin/main` = `555c65fa91cd12d54d735a40b90e479805b276fa` · 2026-10-16T11:56:36Z

Puesto S0. **Encargo del orquestador de Luis:** escribir la regla que él decidió ese mismo día, con la delegación del fundador («NO SE que dices de las firmas hazlo tú»). La regla y sus seis condiciones son suyas; lo que pone aquí la S0 es la redacción y lo que midió para escribirla.

| Qué | Dónde |
|---|---|
| La regla, con sus seis condiciones, qué firma entra y qué NO cubre | `docs/RUNBOOKS.md` R25 |

**El número.** El orquestador pidió comprobarlo antes de escribir. Sobre `555c65fa9`, el último apartado de `docs/RUNBOOKS.md` es R24 (SCRUM-1367). De los 11 PR abiertos a las 11:49Z, ninguno toca `RUNBOOKS.md`. Control positivo: los 11 traen su lista de ficheros, entre 2 y 18 cada uno. **R25 estaba libre.**

**Medido para escribirla (leído, sin tocar el camino de emisión):**

* Las tres firmas del panel (`partes.routes.ts` `/:id/firmar` y `/:id/firmar-tecnico`, `albaranes.routes.ts` `/:id/firmar`) se leyeron enteras, desde su `router.post` hasta el siguiente. Buscando `whatsapp|send[A-Z]|mailer|notif|enqueue|emit|invoice|verifactu`, sólo salen comentarios y el 409 «Emite el albarán antes de firmarlo.». **Ninguna envía.**
* 🔴 **La firma por el enlace público del albarán (`albaranPublic.routes.ts` `/:token/firmar`) llama a `sendAlbaranFirmadoWhatsApp(albaran.id)`**: el auto-envío de SCRUM-49. Por eso R25 lo deja FUERA y lo nombra. **El orquestador lo confirmó por `SendMessage` el mismo 16-oct: queda fuera «definitivamente y no "de momento"».** Su motivo, que R25 lleva escrito: un envío es dinero y es regla 28, y no lo puede autorizar él. Lo decide el fundador, y ya está en su lista.
* `scripts/qa/sembrar-albaranes.mjs firmado` firma por `POST /admin/albaranes/:id/firmar` (su lista de escrituras permitidas, línea 69), es decir, por la firma del panel. Queda dentro de R25.

**Lo que esto NO hace:** no firma nada. No toca ni el código ni el sembrador. No mide SCRUM-1302s ni la gemela del albarán: eso lo hace quien tenga esos tickets, ya con regla.

**Error propio.** El primer barrido de los handlers miró una ventana fija de ~125 líneas desde cada `router.post` y sólo las rutas del panel. Con eso, «firmar no envía nada» salía limpio. Al leer cada handler entero, y también el del enlace público, apareció el auto-envío. Sin esa segunda lectura, R25 habría dicho que ninguna firma envía.

A9: aviso → A10 «Una ventana fija es una tolerancia disfrazada.» — no se pudo comprobar: no hay instrumento que diga dónde acaba un handler sin abrir el fichero; el barrido entero desde `router.post` hasta el siguiente es la receta, y va en este registro
