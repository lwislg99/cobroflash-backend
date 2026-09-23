# SCRUM-735 · El RELOJ DEL PROCESO en la huella fiscal — medido, no arreglado

**Medido contra:** `origin/main` = `763d37e5225ea4897827b1a997e34cf5e117c5c3` · 2026-09-22T22:30:11Z

**Alcance: SOLO MEDICIÓN.** Cero ficheros de `src/` tocados. No se exporta nada, no se cambia
ninguna firma, no se construye ningún guard. Leer el camino de emisión no es STOP (regla 38);
modificarlo sí — así que aquí no se modifica nada.

---

## 0 · 🔴 Esto ya estaba medido, y sigue vigente 18 días después

**SCRUM-735 en Jira es, palabra por palabra, el APÉNDICE que `docs/master/SCRUM-643.md` ya
tiene mergeado en `main`** desde el 4-sep-2026 (commit `03183e0b`, rama
`scrum-643-periodificacion-emitida`, sección *"El censo que faltaba: el CAMINO DE EMISIÓN se
quedó fuera del arreglo"*). Mismas tablas, mismo hallazgo, misma cita de la huella SHA-256, hasta
la frase de la víctima. No hay nada que "descubrir": hay que **reconfirmar si sigue siendo
verdad hoy**, y **cerrar el hueco que ese apéndice dejó declarado y sin ejecutar**.

Las dos cosas están hechas abajo. **No repito el análisis que ya está escrito allí** — lo cito y
lo verifico.

---

## 1 · Re-verificación de hoy: nada ha cambiado desde el 4-sep

| Lo que el apéndice midió | Hoy (grep + lectura AST) |
|---|---|
| `formatFechaHoraHuso` (verifactu.service.ts) usa `getFullYear/getMonth/getDate/getHours/…` y `getTimezoneOffset()` — reloj y huso del PROCESO | **Igual.** `verifactu.service.ts:66-75`. Sin parámetro de zona. |
| `formatDateES` — mismos getters locales, no exportada | **Igual.** `verifactu.service.ts:57-59`. Sigue sin exportar: exportarla ya sería tocar el camino de emisión. |
| `allocateInvoiceNumber(tx, merchantId, opts, now = new Date())` deriva `year` del proceso | **Igual.** `invoiceNumber.service.ts:400,428`. **Los 7 caminos** (`lib/invoicing.ts`, `quotes.routes.ts`, `jobs.routes.ts`, `invoicesAdmin.routes.ts` ×1, `quotesAdmin.routes.ts` ×2, `invoicing.service.ts`) llaman sin pasar `now`: **ninguno** fija la zona. |
| `makeReceiptNumber` deriva el año del justificante `J-` del proceso | **Igual.** `invoiceNumber.service.ts:88-89`. |
| Test de caracterización `tests/scrum643-huso-del-sello-fiscal.test.mjs` | **Reejecutado hoy: 5/5 verde.** Sigue documentando el mismo defecto vivo, sin protegerlo. |

**Reconfirmado con las funciones REALES, no releído de memoria** (mismo método del apéndice:
`dist/`, TZ fijada en el `env` del subproceso, nunca en la línea de comandos de la shell — ver
§4 por qué):

| `TZ` del proceso | `formatFechaHoraHuso(2026-03-31T23:30Z)` declara | `makeReceiptNumber(2026-12-31T23:30Z)` |
|---|---|---|
| `UTC` (como Railway) | 🔴 `2026-03-31` (real: 1-abr en Madrid) | 🔴 `J-20261231` (real: 2027 en Madrid) |
| `Europe/Madrid` | `2026-04-01` | `J-20270101` |
| `Atlantic/Canary` (control negativo) | `2026-04-01` | `J-20261231` — **igual que Railway, y es el CORRECTO para un canario** |

Confirma la conclusión del apéndice: el arreglo **no puede ser** "usar Europe/Madrid" — sería el
mismo defecto con el signo cambiado. Tiene que ser la zona del merchant (`zonaDelMerchant()`,
ya existe desde SCRUM-643 fase ③, todavía sin consumidor en estas dos funciones).

---

## 2 · Qué depende de ese valor — confirmado, no ensanchado

Igual que enumera el apéndice, con la cita exacta:

- **La huella SHA-256** (`computeVeriFactuHash`, `verifactu.service.ts:92-111`): `fecha` (de
  `formatDateES`) y `timestamp` (de `formatFechaHoraHuso`) son DOS de los ocho campos que entran
  en el hash. Un valor mal derivado se hashea igual de bien que uno correcto — la huella no
  distingue "correcto" de "consistente" (ver §3).
- **`FechaHoraHusoGenRegistro` y `FechaExpedicionFactura` del XML** que se remitiría a la AEAT
  (`verifactu.service.ts:811,901`, `:548,773,790,885,914`).
- **El justificante `J-YYYYMMDD-…`** que ve el cliente final — vivo HOY, sin depender de
  `INVOICING_ES_ENABLED`.
- **La serie anual** F1/R1 (`allocateInvoiceNumber`): el `year` decide si se resetea el contador
  o se continúa el del año en curso. También vivo hoy, también sin depender del flag.

---

## 3 · 🔴 La pregunta que decide: ¿se nota o no se nota?

**No se nota en la propia huella, y ese es el punto que hay que entender bien.** La cadena de
huellas se auto-defiende contra la **manipulación posterior**: si alguien tocara un campo ya
sellado, el hash dejaría de cuadrar. Pero un reloj mal interpretado **en el momento de generar**
produce un hash perfectamente autoconsistente — el defecto está DENTRO de lo que se hashea, no
fuera. La huella no sabe que el día que acaba de sellar es el equivocado.

**Tampoco se nota necesariamente en el envío a la AEAT** (si algún día se construye — hoy no
existe, S1-B/skill `verifactu`). El motivo es sutil y vale la pena dejarlo escrito: `new Date()`
en Node siempre captura el **instante absoluto correcto** — lo que falla es la conversión de ese
instante a componentes de calendario (día/mes/año/hora) con `getFullYear()` etc., que usan la
zona LOCAL DEL PROCESO. Así que `2026-03-31T23:30:00+00:00` (Railway, UTC) y
`2026-04-01T01:30:00+02:00` (si el proceso fuera Madrid) son **el mismo instante en el tiempo**,
los dos ISO 8601 válidos. La validación **2004** de la AEAT (`FechaHoraHusoGenRegistro` contra
la hora de la AEAT, según la skill `verifactu` §5) compara **instante contra instante**, con un
margen de tolerancia — no compara "¿qué día es esto en España?". Un sello con el offset `+00:00`
en vez de `+02:00` no dispara por sí solo ningún código de error conocido: es una fecha VÁLIDA
que declara el DÍA EQUIVOCADO.

**Donde SÍ se nota, y hoy, es en tres sitios de cara al usuario — los dos primeros ya
documentados, el tercero y el cuarto medidos AHORA con ejecución real (§4):**

1. El justificante `J-` que recibe el cliente final lleva la fecha equivocada en su propia
   referencia, en la ventana de 1-2h de cada medianoche española.
2. La serie anual salta de año una noche antes de tiempo (o después, según la zona), rompiendo la
   correlatividad legal si coincide con la reserva de un número esa madrugada.
3. **`invalidAnioFiscal`** (`core/validation/fiscalInput.ts:52`, consumida por el export del
   Modelo 303 vía `docs`/`fiscal/evidencias`): en la madrugada del 1-ene española, un profesional
   que pide su ejercicio 2027 recién empezado se encuentra con *"2027 es un año futuro (el
   ejercicio en curso es 2026)"* — un rechazo visible, pero que se lee como un bug de validación,
   no como un bug de reloj.
4. **`resolverFechaDeCobro`** (`modules/billing/domain/fechaDeCobro.ts:48-66`): un profesional que
   marca un cobro como recibido "hoy" en la primera hora u hora y media de cada día español recibe
   *"Esa fecha no puede ser posterior a hoy"* — rechazando una fecha que, en Madrid, es
   literalmente hoy.

**Conclusión de la pregunta:** el fallo es sistemático (toda madrugada española, no un caso
raro), invisible para el propio mecanismo que debería delatarlo (la huella y previsiblemente la
validación de la AEAT), y visible solo como síntomas dispersos de cara al usuario que nadie
conectaría con "el servidor está en la zona horaria equivocada" sin este censo delante.

---

## 4 · Lo que el apéndice dejó declarado y SIN EJECUTAR — cerrado aquí

El apéndice de SCRUM-643 (y el propio ticket de Jira) lo dice así: *"Capas censadas pero NO
medidas en ejecución (hueco declarado): Trimestre del 303, evidencias, `fiscalInput`,
`fechaDeCobro`. Leídas, no llamadas."* Dos de las tres SÍ se pueden llamar sin exportar nada
nuevo (`invalidAnioFiscal` y `resolverFechaDeCobro` ya están exportadas) — se ejecutan aquí,
contra `dist/`, con la zona fijada en el `env` de un subproceso lanzado **desde Node**, nunca
desde la línea de comandos de la shell:

> 🔴 **Trampa real, caída en esta misma medición:** el primer intento puso `TZ=Europe/Madrid` en
> la línea de comandos de Git Bash. El subproceso arrancó en **`Europe/London`**, no en Madrid —
> exactamente la trampa que el propio arnés de SCRUM-643 ya documentaba por escrito
> (*"un `TZ=Europe/Madrid` que Git Bash convirtió... arrancó en Europe/London"*). El control de
> suelo (`zonaEfectiva === zona pedida`) lo cazó antes de creer un resultado ciego. Repetido
> lanzando el subproceso con `execFileSync({ env: { TZ } })` desde dentro de Node — el mismo
> método del test existente —, los tres controles de suelo salieron `OK`.

| `TZ` del proceso | `invalidAnioFiscal(2027, medianoche 1-ene)` | `resolverFechaDeCobro("hoy", madrugada 1-abr)` |
|---|---|---|
| `UTC` (Railway) | 🔴 rechazado: *"2027 es un año futuro"* | 🔴 rechazado: *"fecha_futura"* |
| `Europe/Madrid` | aceptado (`null`) | aceptado |
| `Atlantic/Canary` | 🔴 rechazado — **correcto para un canario**, mismo patrón que §1 | aceptado (control: en la fecha usada, Canarias ya está en horario de verano, igual que Madrid) |

**`trimestreDe(mes)`** (`modelo303.routes.ts:13-14`) queda como el único de los cuatro SIN
ejecutar: es una función **no exportada**, y exportarla para poder llamarla sería exactamente el
tipo de cambio que el encargo prohíbe («no escribas un guard, no toques nada»). Lo que sí se
puede afirmar sin tocarla, porque es aritmética pura sobre un dato ya medido: en el instante
`2026-03-31T23:30:00Z` que las dos tablas de arriba usan, `getMonth()` vale `2` (marzo) en UTC y
`3` (abril) en Madrid — así que `Math.floor(mes/3)+1` da **trimestre 1 en Railway y trimestre 2
en Madrid** para el mismo instante. Es el mismo salto que ya está confirmado dos veces arriba,
aplicado a un tercer consumidor. **Declarado, no ejecutado — igual que dice el hueco original.**

---

## 5 · ¿Hay algo que ya proteja esto?

**Un test, y solo uno: `tests/scrum643-huso-del-sello-fiscal.test.mjs` (5/5 verde hoy).** Es una
**caracterización**, no un guardarraíl: afirma el comportamiento de HOY (el defecto) para que se
vea caer el día que alguien arregle `formatFechaHoraHuso`/`makeReceiptNumber` con zona. **No
impide nada, no avisa de nada, no falla si el defecto empeora.**

**Lo que NO existe:**

- Ningún guard que compare la zona del proceso con la zona del merchant.
- Ninguna comprobación al arrancar (`schemaDrift.ts` y similares no miran esto).
- Ninguna cobertura para `invalidAnioFiscal`, `resolverFechaDeCobro` ni `trimestreDe` — el test
  existente solo cubre `formatFechaHoraHuso` y `makeReceiptNumber`.
- `zonaDelMerchant()` (SCRUM-643 fase ③) existe y resuelve exactamente este problema para otros
  cuatro cálculos, pero **ninguna de las funciones de este documento la importa todavía**.

**No se propone un guard aquí** (el encargo lo prohíbe explícitamente: "mide, no arregles"). La
propuesta de arreglo ya está escrita, completa, en `docs/master/SCRUM-643.md` §5 del apéndice
(`formatFechaHoraHuso(d, zona)` / `formatDateES(d, zona)`, misma forma que ya se le dio a
`fechaLimiteRecapitulativa`) — **pendiente del mismo GO del fundador que el propio ticket de
Jira pide en su título**, sin decidir desde hace 18 días.

---

## 6 · SUELO — lo que no se pudo medir, declarado

- **No hay envío real a la AEAT que observar**: SIF-1 no construye la remisión (skill
  `yaqu-verifactu-sif`, "NO CONSTRUIDO · flujo de control con la AEAT"). La afirmación de §3 sobre
  el código 2004 es una LECTURA de la spec (skill `verifactu` §5), no una prueba contra el
  entorno de pruebas de la AEAT — no hay credencial ni mTLS configurado en esta máquina para eso,
  y tampoco lo pide el encargo.
- **`trimestreDe` no se ejecutó**, por no estar exportada (§4) — se declaró por aritmética
  derivada de un instante ya medido, no se llamó.
- **Sin medir contra producción**: ninguna clave de este árbol apunta a producción (norma
  A7/`_clave-vs-destino.mjs`), y no hace falta — esto es lectura de código, no de datos.

---

## 7 · Lo que esto NO es

No es un hallazgo nuevo. Es: **(a)** la confirmación de que el hallazgo de SCRUM-643 (apéndice)
sigue siendo verdad 18 días después, sin ninguna deriva; y **(b)** el cierre del único hueco que
ese apéndice dejó explícitamente declarado y sin ejecutar. La decisión que falta —el GO del
fundador sobre el arreglo y sobre el corte de fecha entre documentos antes/después— es la MISMA
que SCRUM-643 ya dejó pedida y SCRUM-735 repite en su título. No hay una segunda decisión que
tomar: hay una que sigue esperando.

---

# APÉNDICE · El arreglo (SCRUM-735b) — 23-sep-2026

**Medido contra:** `origin/main` = `1e107d0baba2ce1ff50de13f072a2be4935fb241` · 2026-09-23T09:24:31Z

**GO del fundador:** Jira SCRUM-735, comentario **16573**, literal: *«y go al reloj»*. Autoriza
derivar día/año/huso de la **zona del merchant** (`zonaDelMerchant`), nunca `Europe/Madrid` fijo
(el control negativo de Canarias de §3 arriba lo desmonta), en las **23 ocurrencias fiscales
censadas** por el apéndice de `docs/master/SCRUM-643.md` §5. No autoriza tocar `productor.ts`,
el esquema, ni nada fuera de esas 23.

## 0 · Primera tarea del GO: ¿hay corte de fecha que diseñar?

Medido y respondido en el propio ticket (comentarios 16578-16579, J1): la numeración de
**partes de trabajo** (`src/modules/jobs/domain/parteNumero.ts`, llamada desde
`partes.routes.ts:418`) **no está gateada** por `INVOICING_ES_ENABLED`/`modoEmision` — corre para
cualquier merchant. Tiene el mismo defecto (año del reloj del proceso), pero su ventana es
**anual** (Nochevieja), no diaria, y no hace falta corte de fecha: el número se deriva por MÁXIMO
existente por año, sin contador persistido que migrar. Queda **fuera de este arreglo** (no es una
de las 23, y su propia cabecera se declara "serie NO FISCAL"): se deja dicho, no se toca.

Para facturas: cero selladas en las tres bases (medido por el fundador, comentario 16573) — sin
nada sellado no hay un "antes" que proteger. **No hay corte de fecha que diseñar, en ningún lado.**

## 1 · Qué se arregló, y dónde

La forma es la del apéndice de SCRUM-643 §5: `formatFechaHoraHuso(d, zona)` y
`formatDateES(d, zona)`, ambas ahora **exportadas** (el GO lo autoriza expresamente) y
**REQUIEREN** `zona` — sin valor por defecto, para que ningún llamador nuevo pueda olvidarse de
pasarla. Ninguna de las dos toca `zonaDelMerchant.ts`: el reloj de pared con hora y desfase que
necesita `formatFechaHoraHuso` se resuelve con un helper local
(`relojDeParedEnZona`, mismo método — `Intl.DateTimeFormat` + `Date.UTC` — que ya usa
`core/zonaDelMerchant.ts`, sin exportar nada nuevo de allí: el GO acota el arreglo a las 23
ocurrencias, y esta pieza sólo la necesita este módulo).

| Fichero | Qué cambió | Ocurrencias |
|---|---|---|
| `src/modules/invoicing/domain/verifactu.service.ts` | `formatFechaHoraHuso`/`formatDateES` con `zona` obligatoria; `applyVeriFactu`/`applyVeriFactuAnulacion` leen `zonaDelMerchant` del emisor ANTES de sellar (después del portón `$transaction`, para no gastar la consulta en un cliente rechazado); `buildVerifactuRegistrosXml`/`anulacionPrev` la propagan | la huella SHA-256, `FechaHoraHusoGenRegistro`, `FechaExpedicionFactura`, `FechaExpedicionFacturaAnulada` del XML |
| `src/modules/invoicing/domain/invoiceNumber.service.ts` | `makeReceiptNumber(now, zona = 'UTC')` deriva el `J-YYYYMMDD` con `diaNaturalEn`; `allocateInvoiceNumber` deriva el `year` de la serie DESPUÉS de leer `m` (con `timezone` en el `select`), no antes | el justificante `J-`, el año de la serie F1/R1 |
| `src/core/validation/fiscalInput.ts` | `invalidAnioFiscal(valor, ahora, zona = 'UTC')` deriva el año máximo con `diaNaturalEn` | el tope "año futuro" del export `/verifactu.xml` |
| `src/modules/fiscal/modelo303/modelo303.routes.ts` | el año/trimestre "en curso" (sin `?year=`/`?quarter=`) sale de `zonaDelMerchant` del merchant de la petición | el periodo por defecto del Modelo 303 |
| `src/modules/fiscal/evidencias/evidencias.routes.ts` | mismo arreglo, mismo patrón | el periodo por defecto del paquete de evidencias |
| `src/modules/exports/app/routes/exports.routes.ts` (bloque J1, `/verifactu.xml`) | el merchant se lee ANTES de derivar año/`invalidAnioFiscal`, con su zona | el año por defecto y el tope del export suelto |

`makeReceiptNumber`/`invalidAnioFiscal` llevan `zona` con valor por defecto (`ZONA_POR_DEFECTO`,
'UTC') en vez de obligatoria: tienen consumidores DIRECTOS en varios tests con firmas de un solo
argumento, y UTC-por-defecto es EXACTAMENTE el comportamiento de antes de este ticket para
cualquier llamador que no pase zona — no hay regresión posible, sólo la posibilidad de pasar la
zona real cuando se tiene (que es lo que hace el único llamador real de cada una).

## 2 · Lo que se dejó FUERA, y por qué (3 de las 23 ocurrencias)

El apéndice de SCRUM-643 censó 23 ocurrencias en `verifactu.service.ts`, `invoiceNumber.service.ts`,
`albaranNumber.service.ts` y `quoteNumber.service.ts` (categoría A, 17) más `fechaDeCobro.ts`
(categoría C, 1). **3 quedan sin tocar**, y no por olvido:

- **`src/modules/jobs/domain/albaranNumber.service.ts:115`** (año de la serie del albarán) —
  fuera de `docs/equipo/puesto-j1.md` («Tus ficheros»): es dominio `jobs/`, no `invoicing/` ni
  `fiscal/`.
- **`src/modules/quotes/domain/quoteNumber.service.ts:100`** (reserva del año de la serie de
  presupuestos) y **`:77`** (`displayQuoteNumber`, que RECALCULA el año desde `createdAt` al
  mostrarlo, con getters locales, en vez de leer un año persistido) — presupuestos son
  explícitamente "NO tocas" en la ficha de J1 (S1). Y hay una razón de fondo para NO arreglar
  sólo una mitad: hoy las dos derivan el año con el MISMO método (reloj del proceso), así que
  SIEMPRE coinciden — el número que se reserva y el que se muestra nunca discrepan, aunque los
  dos estén "mal" en la ventana de Nochevieja. Arreglar sólo `:100` (la reserva) dejaría
  `:77` (la vista) mostrando un año DISTINTO del reservado en esa misma ventana — una
  inconsistencia nueva que hoy no existe. Las dos van juntas o ninguna, y las dos son de S1.
- **`src/modules/billing/domain/fechaDeCobro.ts:61`** (`resolverFechaDeCobro`, fin de "hoy" para
  marcar un cobro) — tiene DOS llamadores reales: `invoicesAdmin.routes.ts` (J1) y
  **`chargesAdmin.routes.ts`** (medios de pago, J2), más un envoltorio
  (`billing/domain/instanteDeCobro.ts`) que usan los webhooks de MercadoPago/PSP (J2 también).
  Tocar la firma de una función compartida entre dos puestos sin coordinar es exactamente lo que
  A4/A13 piden evitar.

Los tres siguen con el defecto (reloj del proceso). Quedan reportados aquí y en Jira para que se
repartan a quien corresponda (S para albaranes, S1 para presupuestos, J2 para `fechaDeCobro`), en
vez de tocar ficheros fuera de carril sin coordinación.

## 3 · Tests — rojo primero, luego verde, luego el control negativo

`tests/scrum643-huso-del-sello-fiscal.test.mjs` **se reescribió en el mismo sitio** (el borrado de
ficheros de test está bloqueado por política de esta sesión de seguridad): su propia cabecera
decía que el día del arreglo había que retirarlo, y el arreglo cayó exactamente donde predijo —
sus 5 tests viejos (caracterización del defecto) habrían quedado midiendo la máquina en vez del
código, porque `zona = undefined` en una llamada de un solo argumento cae al huso del PROCESO vía
`Intl`, no a un error. Reescrito para afirmar el comportamiento CORRECTO (Madrid declara el día
peninsular, Canarias no se mueve) más un trinquete de firmas por AST y una comprobación textual de
que `allocateInvoiceNumber` ya no deriva el año de `now` con getters locales.

Efecto en cascada, medido y corregido (no cada uno es un fallo del arreglo: cada uno es una firma
que cambió y un consumidor que hay que actualizar, exactamente como predice A12):

- `tests/_huerfanos-declarados.mjs` — `formatDateES` pasa a `PIEZA_INTERNA_EXPORTADA` (el GO
  autoriza exportarla; su único consumidor externo es su propio test).
- `tests/scrum291-series-huecos.test.mjs` — el hash SHA-256 que protege `invoiceNumber.service.ts`
  contra cambios sin GO (regla 38) se recalculó y se anotó el motivo (este mismo ticket).
- `tests/scrum524b-trinquete-de-la-tabla.test.mjs` — la mutación-cobaya de `exports.routes.ts`
  citaba el literal viejo (`invalidAnioFiscal(year)`); se actualizó al nuevo.
- `tests/scrum525d-anclas-que-apuntan.test.mjs` — 4 anclas de `docs/legal/AUDITORIA_CAMINO_EMISION.md`
  y `docs/legal/PREGUNTAS_ASESOR.md` apuntaban a líneas que se movieron; recalculadas.
- `tests/scrum149-sin-lineas-no-sella.test.mjs`, `scrum880-el-empate-del-sello.test.mjs`,
  `scrum844-sellar-dentro-de-transaccion.test.mjs` — sus dobles de Prisma no tenían
  `merchant.findUnique`, que `applyVeriFactu`/`applyVeriFactuAnulacion` ahora necesitan; añadido
  con `timezone: null` (cae a UTC, el comportamiento de antes).
- `tests/scrum844d-quien-entra-en-la-cadena.test.mjs` — su «reloj doble» fingía
  `d.getTimezoneOffset()`, método que la función ya NO llama; reescrito con zonas REALES
  (`America/New_York` para el signo negativo, `UTC` para el borde), lo que además retira el
  subproceso con `TZ` que ya no hace falta.
- `tests/verifactu.test.mjs`, `tests/emission.test.mjs` — llamadas de un argumento que construían
  la fecha con el constructor LOCAL de `Date` (`new Date(2026, 5, 11)`); con `zona` explícita la
  interpretación cambia de «lo que diga el reloj local» a «UTC, o la zona pedida», así que se
  pasaron a construcción UTC explícita.

**Control negativo, confirmado en el código (no sólo en el test):** ningún fichero tocado fija
`Europe/Madrid`. La zona sale siempre de `zonaDelMerchant(merchant)` o de un parámetro explícito
que el caller decide.

## 4 · Suelo — lo que no se pudo verificar aquí

- **La tanda completa de `npm test` (973 ficheros) no se terminó de correr en esta máquina**: dos
  intentos en paralelo se pisaron el fichero de salida (se relanzó limpio) y el tercero lo mató el
  propio harness por presión de memoria del sistema — no un fallo del comando. De los primeros
  ~4500 tests medidos ANTES del corte salieron 8 rojos; los 7 causados por este cambio están
  arriba, corregidos y reverificados uno a uno (más un octavo, SCRUM-476, que compara la
  topología de `node_modules` entre TODOS los worktrees de la máquina — de otro carril, no de
  este diff: no menciona ningún fichero de este cambio). Se verificó a mano, en su lugar, una
  batería dirigida de ~200 tests que SÍ tocan cada fichero cambiado (los de arriba, más
  `scrum844c`, `scrum665e`, `scrum145`, `scrum834`, `scrum73`, `scrum221` ×2, `scrum82`,
  `scrum206`, `scrum198`, `scrum111`): 100 % verde. **Falta la confirmación de CI sobre la tanda
  entera**, que sí puede correrla sin este límite de memoria.
- **Lo gateado por `QA_DB_TEST`/`LIBRO_PG_URL`** (SCRUM-173, SCRUM-295, SCRUM-297) no se pudo
  correr: esta máquina no tiene Postgres. Se leyeron sus dobles/fixtures y no dependen del reloj
  del proceso (usan Prisma real o `merchant.findUnique` ya completo); no hay motivo medido para
  esperar que caigan, pero no está confirmado en ejecución.
- Categoría B del apéndice de SCRUM-643 (trimestre por defecto de `modelo303.routes.ts` y
  `evidencias.routes.ts`) se verificó por lectura y por su batería de tests (`scrum834`), no con
  una petición HTTP real end-to-end: ninguna clave de este árbol apunta a un entorno con datos.
