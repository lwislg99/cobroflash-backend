# SCRUM-1597 · Dos cabos de SCRUM-1596b: `buildPaymentConfirmation` sin llamadores en `src/`, y el «Hoy: N plantillas» del panel que suma los avisos al profesional

**Medido contra:** `origin/main` = `28098fe4b1a160303526f5a4002d52556d2c5b22` · 2026-10-23T19:01:06Z (hora de GitHub; al escribir: 2026-10-23T19:07:20Z)

A9: comprobación → `docs/master/evidencias/SCRUM-1597/medir-builder.mjs`

J2 (sesión `jv-j2as`, equipo de Javier), por encargo del orquestador `cobroflash-backend-62`. Aceptación: la de Jira
c.20626 (la escribió el orquestador al cazarse que el enunciado no la tenía). **No se toca ningún fichero de `src/`,
`public/`, `prisma/`, test, plantilla de Meta ni workflow.** Entran este registro, `docs/master/evidencias/SCRUM-1597/`
(dos sondas y sus salidas) y el motivo de una entrada de `scripts/_sin-consumir-declarados.json` (contenedor de S0; cada
puesto declara SU pieza, `dos-equipos.md:178`). `dist/` con `tsc --noCheck` del mismo `28098fe4b`; no se corrió
`prisma generate`. El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió por encargo.

## ① `buildPaymentConfirmation`: NO se retira; se declara con su motivo

Sonda: `docs/master/evidencias/SCRUM-1597/medir-builder.mjs` (AST con el compilador de TypeScript; cada uso con lo que
lo envuelve: el `test('…')`, la función o la `const`). Población: 2.415 ficheros de `src/`, `tests/`, `scripts/` y
`public/`.

| pregunta | medido |
|---|---|
| llamadas en `src/` | **0** (sólo su declaración, `whatsappTemplates.ts:183`) |
| llamadas dentro de la hermana `sendPaymentConfirmationInvoice` | **0** (la hermana llama a `buildPaymentConfirmationInvoice`, `whatsappNotifications.ts:87`) |
| llamadas en `tests/` | **5**: una en su propio test («payment_confirmation_es: 4 vars (orden distinto) y SIN botones») y **cuatro en tests que NO son suyos** |
| · `tests/whatsappTemplates.test.mjs` | «todas: cuerpo de exactamente 4 variables (lo que exige Meta)» · «validación J7: lo que sale de los builders pasa la validación» · «validación J7: botón obligatorio que falta / botón de más se detectan», donde es el fixture SIN botón con el que se prueba el validador |
| · `tests/scrum931-un-solo-importe-de-plantilla.test.mjs` | uno de los builders de su `BUILDERS` (formato del importe), con su nombre también como cadena |
| llamadas en `scripts/` | **1**: `scripts/wa-prueba.mjs:93`, la prueba manual de plantillas |
| llamadas en `public/` | 0 |

**Veredicto, por la regla del encargo:** lo usan tests ajenos, así que **no se retira**. Su entrada en
`_sin-consumir-declarados.json` pasa a llevar `motivo` y `ticket: SCRUM-1597`. Retirarlo obligaría a reescribir tres
tests del validador y el de scrum931: eso ya no es consecuencia mecánica de c.20602 ①, es una decisión.

Controles (los tres corridos; salidas en la carpeta):

| control | resultado |
|---|---|
| S0 suelo de población (≥ 1.000) | 2.415 · cuadra |
| C0 sembrado en memoria: 2 llamadas + 1 import; un prefijo y un comentario no cuentan | 2 y 3 · cuadra |
| C1 un nombre inexistente | 0 · cuadra |
| C2 positivo: la hermana del builder tiene llamada en `src/` | sí · cuadra |
| C3 positivo de P2: la misma pregunta sobre `buildPaymentConfirmationInvoice` dentro de `sendPaymentConfirmationInvoice` | 1 · cuadra |
| `--sin-sembrado` | **CIEGO**, salida 2 (`salida-builder-ciego.txt`) |
| `--esperado-roto` | **ROJO**, salida 1 (`salida-builder-rojo.txt`) |

De paso (no arreglado, es una prueba manual que no corre en CI): `scripts/wa-prueba.mjs` llama a los builders con la
firma VIEJA (`amountWithCurrency`, `chargeId`); los builders piden hoy `amount` + `currency` (SCRUM-931). Ejecutado,
mandaría el importe vacío. No lo he ejecutado: mandaría un WhatsApp real.

## ② El «Hoy: N plantillas» del panel: SOLO MEDIDO

| pregunta | medido |
|---|---|
| pantalla | Informes → tarjeta «WhatsApp · este mes», `public/dashboard/js/reportsView.js:821`: «Hoy: N plantilla(s) · M por ventana» |
| de dónde sale | `GET /admin/metrics/whatsapp` (`metrics.routes.ts:79`) → `getWhatsAppMetrics` → `channel.templateToday` (`whatsappLog.service.ts:489`) |
| consulta | `count` con `plantillasDeHoy`: tipo `template`, del día del comercio, con identificador del proveedor o en `queued`. **No aparta `merchant_alert_es`** |
| consulta del tope de clientes (desde 1596b) | la misma, MÁS «sin `merchant_alert_es`» (las filas sin nombre sí cuentan) |
| ¿enseña el tope de 100? | **No.** La tarjeta no pinta el cupo (leído en `reportsView.js:770-821`; no he barrido el resto de `public/`) |

Sonda: `docs/master/evidencias/SCRUM-1597/medir-panel.mjs`: las MISMAS filas por `getWhatsAppMetrics` y
`reservarPlantilla` reales de `dist/`, base doblada en memoria (patrón de `tests/scrum1522b-el-panel-cuenta-lo-mismo.test.mjs`).

| filas de hoy | «Hoy» del panel | tope de clientes cuenta | ¿sale una más a un cliente? | ¿sale un aviso más? |
|---|---|---|---|---|
| 87 a clientes (suelo) | 87 | 87 | sí | sí |
| 99 a clientes, 0 avisos (cero) | 99 | 99 | sí | sí |
| **99 a clientes + 5 avisos** (el caso del encargo) | **104** | 99 | **sí** | sí |
| 100 a clientes + 5 avisos | 105 | 100 | no (`daily_cap`) | sí |
| 70 a clientes + 30 avisos | **100** | 70 | **sí** (le quedan 30) | no (el 31.º) |

Controles: el positivo sembrado (la reserva de avisos ve los 5) cuadra; con `--sin-sembrado` sale **CIEGO** (2); con
`--esperado-roto` sale **ROJO** (1).

**Lo que dice la medición.** Con 99 + 5 el panel dice **104**, no 99. Desde 1596b se ha roto lo que fijó el fundador en
SCRUM-1522 (c.19157 ③): «Hoy» cuenta lo mismo que el tope. El test de 1522b sigue en verde porque sus filas no llevan
ningún aviso. El peor caso es el último de la tabla: el panel dice «Hoy: 100 plantillas» y al profesional le quedan 30
para clientes. Ojo, como la tarjeta no enseña el 100, el engaño sólo afecta a quien conozca el cupo.

### Opciones — NO he elegido ninguna

- **N · Sólo el número, el rótulo no cambia.** `templateToday` cuenta con el mismo filtro que el tope de clientes (sin
  `merchant_alert_es`): 99 en el caso del encargo, 70 en el último. Vuelve a cumplir c.19157 ③. Coste: en la misma
  tarjeta, «Coste estimado · N plantillas» del mes sigue contando los avisos (cuestan dinero), así que el «Hoy» y el
  mes pasan a medir poblaciones distintas sin decirlo; y «Hoy: 99 plantillas» cuando salieron 104 es cierto sólo como
  «a clientes». Un test que lo fije añadiría avisos al caso de 1522b.
- **Si se prefiere que se vea la diferencia, hay que cambiar texto (regla 39, firma del fundador).** Literales, con 99 + 5
  y 0 por ventana:
  - T1 · «Hoy: 99 plantillas · 5 avisos para ti · 0 por ventana»
  - T2 · «Hoy: 99 plantillas a clientes · 5 avisos a ti · 0 por ventana»
  - T3 · «Hoy: 99 de 100 plantillas a clientes · 5 avisos para ti · 0 por ventana» (enseña el cupo, que hoy no se ve)

  Los tres necesitan su singular («1 aviso») y qué se pinta con 0 avisos; eso también lo firma quien firme.
- **Nada.** El panel enseña lo que se envió; sólo descuadra con el tope cuando hay avisos por plantilla.

## ③ Ningún envío cambia

Censo de envíos de 1596b (`docs/master/evidencias/SCRUM-1596/envios-1596b.mjs`), corrido hoy sobre este árbol:
334 ficheros `.ts`, sembrado 1 de 1, **55 envíos**. Su salida (`evidencias/SCRUM-1597/salida-envios.txt`) es **byte a
byte igual** que `evidencias/SCRUM-1596/salida-envios-despues-1596b.txt`. Mi diff no toca `src/`.

## Lo corrido

Ver la entrega en Jira (SCRUM-1597) para la tanda y el obligatorio.

## NO medido

- PostgreSQL real: la base de ② es un doble que evalúa el filtro; el `NULL` de `{ not }` lo modela él, no SQL.
- yaqu.app: no lo he intentado; ver el «Hoy» con avisos exige que salgan plantillas reales.
- `scripts/wa-prueba.mjs` ejecutado: no, mandaría un mensaje real.

## Errores propios

- La primera versión de la sonda de ① se paraba en la `const` más cercana y clasificaba como «const pc» una llamada que
  vive dentro de un test: la pregunta «¿es de un test ajeno?» no se podía contestar. Lo vi en la salida y la cambié
  para que gane el `test('…')`.
- Y su pregunta P2 («¿la llama la hermana?») no tenía positivo: habría dado 0 igual de ciega. Le puse C3, la misma
  pregunta sobre el builder de la hermana, que tiene que dar 1.
- El esperado de tests de P1 lo escribí a 6 antes de contar y lo bajé a 5 contando el `git grep`, antes de la primera
  pasada: es un control derivado de otra sonda, no de la salida.

# SCRUM-1597b · El «Hoy» de la tarjeta de WhatsApp deja de contar los avisos al profesional

**Medido contra:** `origin/main` = `ca40d673c5cb3ba9448100a924fc17f4c42ee311` · 2026-10-23T19:41:45Z (hora de GitHub)

A9: comprobación → `tests/scrum1522b-el-panel-cuenta-lo-mismo.test.mjs`

J2 (sesión `jv-j2au`, equipo de Javier), por encargo del orquestador `cobroflash-backend-62`. Construye la decisión del
orquestador en Jira **c.20635** (opción N de c.20634): el número «Hoy» de Informes → «WhatsApp · este mes» deja de contar
`merchant_alert_es`, con el mismo filtro del tope de 1596b. **El rótulo no cambia y ningún texto cambia** (regla 39).
Esta rama lleva dentro la de 1597a (`scrum-1597a-cabos-1596b` @ `f985b463`, PR #2765, sin mergear al escribir), traída
con `git merge`, para que los dos tramos de este registro no se entrelacen. Carril medido con `scripts/carriles.mjs de`:
`whatsappLog.service.ts` es J2; `reportsView.js` es S2 y no se toca. `dist/` con `tsc --noCheck`; sin `prisma generate`.
El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió por encargo.

## El arreglo

`plantillasDeHoy` **no se cambia**: la usan el tope y el panel, y el tope de los avisos (30) cuenta precisamente las filas
`merchant_alert_es` a partir de ella; con el filtro dentro, ese tope contaría siempre 0. Lo que se hace es sacar a una
función, `sinLosAvisosAlProfesional`, el filtro que 1596b escribía en línea dentro de `reservarPlantilla`, y pedírsela
también en `getWhatsAppMetrics` para `templateToday`. Un solo filtro para los dos: no hay un segundo criterio.

## Quién usa qué (AST, con suelo)

`docs/master/evidencias/SCRUM-1597/medir-hoy.mjs` sobre 2.415 ficheros de `src/`, `tests/`, `scripts/` y `public/`
(`salida-hoy.txt`; sin el sembrado sale CIEGO, 2, en `salida-hoy-ciego.txt`; con un esperado roto, ROJO, 1, en
`salida-hoy-rojo.txt`):

| pregunta | resultado |
|---|---|
| llamadas a `plantillasDeHoy` en `src/` | 2: `reservarPlantilla` y `getWhatsAppMetrics` (y una cadena en el control de `scrum529`) |
| llamadas al filtro nuevo en `src/` | 2: las mismas dos funciones |
| quién LEE `.templateToday` en `public/` | sólo `reportsView.js:821` (el número y su plural) |
| quién lo lee en `src/` o `scripts/` | nadie (las demás apariciones son el valor por defecto `0` en fixtures) |

`settingsView.js:1256` pide el mismo endpoint, pero lee `channel.windowMonth`, no `templateToday` (leído). **No se mueve
otra cifra que el «Hoy».** El total del mes de la misma tarjeta sigue contando los avisos: es el coste aceptado en c.20635.

## Rojo, verde, control y mutación

Tres casos nuevos en `tests/scrum1522b-el-panel-cuenta-lo-mismo.test.mjs`, por las dos funciones reales de `dist/`:

| caso | antes del arreglo | después |
|---|---|---|
| 99 a clientes + 5 avisos | ROJO: «Hoy: 104», tope 99 | panel 99 = tope 99, sale la siguiente; mes 104 |
| 70 a clientes + 30 avisos | ROJO: «Hoy: 100», tope 70 | panel 70 = tope 70 |
| CONTROL: 97 + 2 filas sin nombre, sin avisos | verde, 99 | verde, 99 (igual que antes) |

Antes: 14 de 16 en el fichero, caen los dos esperados. Después: 16 de 16.

**El tope no cambia** (regla 28; condición del orquestador): `scrum1596b-tope-de-avisos-al-profesional.test.mjs` da 9 de
9 antes y después, y el censo de envíos de 1596b (`evidencias/SCRUM-1596/envios-1596b.mjs`) sale con 55 envíos y **byte
a byte igual** que `salida-envios-despues-1596b.txt` (`evidencias/SCRUM-1597/salida-envios-1597b.txt`).

Mutaciones, en `MUTACIONES_QUE_ME_TUMBAN` del test (las corre el meta-guard) y medidas a mano sobre `dist/` antes:

| mutación | `scrum1596b` (el tope) | `scrum1522b` (el panel) |
|---|---|---|
| ninguna (base) | 9 de 9 | 16 de 16 |
| el filtro compartido deja de apartar los avisos | **caen 2** (el C5 y su control) | **caen 2** (los dos casos nuevos) |
| sólo el panel vuelve a `plantillasDeHoy` a secas | 9 de 9 | **caen 2** |

La primera es la misma línea que ya mutaba 1596b para su C5: tras este cambio vive sólo en la función compartida.

## `scripts/wa-prueba.mjs`

Usa la firma vieja de los builders (`amountWithCurrency`), como dijo c.20634. **No es de J2:** `carriles.mjs de` dice
«SIN CERRADURA», cubierto sólo por la fila general de `scripts/`, sin dueño decidido (`dos-equipos.md:172`). Se
**declara aquí y no se toca**; tampoco se ejecuta, porque mandaría un WhatsApp real. Quien le dé dueño, que lo arregle.

## No medido

- PostgreSQL real: el doble de 1522b evalúa el filtro, y el `NULL` de `{ not }` lo modela él, no SQL.
- yaqu.app: no lo he intentado; ver el «Hoy» con avisos exige que salgan plantillas reales.
- El meta-guard entero en local: no lo he corrido; las dos mutaciones se midieron a mano sobre `dist/`.
- **Suite entera local: SIN VEREDICTO.** La lancé una vez y la cortó mi `timeout` a los 570 s, sin terminar. Lo parcial
  (8.190 `ok`, 10 `not ok`) lleva los mismos títulos que vio 1597a (1199, 1298b, 245, 351, 385); sus motivos **no los he
  leído**. El orquestador dijo después que no se repitiera y que haga de suite el obligatorio.

## Lo corrido

39 ficheros de guards y vecinos (los de suite 237, 976, 824, 836, 419, 702, 700, 719, 411, 737 y 1415; los de registro
267, 273, 1294, 921c y 1572; más 1387, los cuatro de 1339, 1522b, 1596b, 529, 530, 850, 850b, 1177, 747, 124, 180, 931,
812, 723, 1185, 1480e y `whatsappTemplates`): **374 de 374**, 0 fallos, 0 saltados. Los de registro, otra vez tras el
commit: 57 de 57.

## Errores propios

- Escribí el esperado de P3 del censo a 3 lecturas antes de contar, y la sonda salió ROJO; la línea 821 lee
  `ch.templateToday` exactamente 2 veces (el número y el plural). Lo corregí leyendo la línea, no copiando la salida.
- Hice primero un guion propio de mutación en `evidencias/` y `scrum1387` lo tumbó: un banco nuevo con su lista propia
  tiene que usar el catálogo. Lo retiré y las mutaciones van en el test, que es la vía de la casa.
- Dejé en local un commit «wip» sin el carril en la primera línea; lo rehice antes de empujar (nunca salió de la máquina).
