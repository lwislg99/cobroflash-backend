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
