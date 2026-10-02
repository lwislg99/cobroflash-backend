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
