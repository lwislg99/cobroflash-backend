# SCRUM-1093 · `fechaDeCobro.ts` deriva «hoy» del reloj del proceso, no del merchant — medido, DISEÑADO, sin construir

**Medido contra:** `origin/main` = `6c733dbf0ffa2715ce4b135ef9f30583f112b939` · 2026-09-23T16:25:37Z

23-sep-2026 · **J2** (puesto de Clientes y cobro). Encargo del orquestador: cerrar, para
`fechaDeCobro.ts`, el hueco que `docs/master/SCRUM-643.md` (APÉNDICE) dejó declarado y
`docs/master/SCRUM-735.md` re-confirmó sin ejecutar: *"`resolverFechaDeCobro` construye el fin de
'hoy' con el reloj del proceso, no con la zona del merchant"*.

**Estado: MEDIDO y DISEÑADO. NO CONSTRUIDO.** El clasificador de Auto Mode de esta sesión denegó
(dos veces, motivo «Modify Shared Resources») escribir en
`src/modules/billing/domain/fechaDeCobro.ts`. Un peer no puede conceder ese permiso — hace falta
el de Javier en esta sesión. Mientras se espera, este expediente deja todo lo medido y el diseño
completo, para que la construcción sea inmediata en cuanto llegue el permiso (por esta sesión o
por otra).

## 1 · PASO 0 — el defecto reproducido CORRIENDO, no releído

Con la MISMA técnica que `SCRUM-643`/`SCRUM-735` (la zona se fija en el `env` de un subproceso
lanzado desde Node, nunca desde la shell — un `TZ=Europe/Madrid` en Git Bash se convierte en ruta
y arranca en otra zona; lección ya escrita en `SCRUM-643.md` §4):

```
TZ efectiva del subproceso: UTC
resolverFechaDeCobro("2026-04-01", 2026-03-31T23:30Z) con TZ=UTC →
  {"ok":false,"error":"fecha_futura","message":"Esa fecha no puede ser posterior a hoy."}
🔴 ROJO CONFIRMADO: rechaza como futura una fecha que en Madrid ya es HOY.
```

`2026-03-31T23:30:00Z` es la 01:30 del 1 de abril en Madrid — el mismo instante que usan
`SCRUM-643`/`SCRUM-735` para el sello fiscal y el justificante. Con el proceso en UTC (como
Railway), un profesional que confirma un Bizum «hoy, 1 de abril» en su primera hora y media de
madrugada recibe el error de fecha futura, sobre una fecha que en su zona YA es hoy.

## 2 · Una discrepancia con el encargo, resuelta midiendo — no es la de `invalidAnioFiscal`

El encargo decía inicialmente que la ventana de `fechaDeCobro` era ANUAL. Medido: **es DIARIA**
(`fechaDeCobro.ts:61`, `finDeHoy.setHours(23,59,59,999)`), no anual. La pieza anual de las tres
que quedaron fuera del 735 es OTRA — `invalidAnioFiscal` en `core/validation/fiscalInput.ts:52` —
y no es de este ticket ni de este puesto. Confirmado con el orquestador; no hace falta repetirlo
en la construcción.

## 3 · La pregunta del corte — CONTESTADA: no hay corte que diseñar

Antes de construir, había que comprobar si el arreglo cambiaría la fecha validada de algún cobro
YA REGISTRADO. Medido leyendo los tres llamadores reales de `resolverFechaDeCobro`
(`grep` + lectura, sin BD — no hace falta: es una pregunta sobre el CÓDIGO, no sobre datos):

- `chargesAdmin.routes.ts:51` (`POST /:id/confirm-bizum`) y
  `invoicesAdmin.routes.ts:450` (`PATCH` de marcado manual): los dos llaman a
  `resolverFechaDeCobro` **una sola vez, de forma síncrona, en el mismo request** que confirma el
  cobro. El resultado se escribe en `paidAt` y ahí se queda.
- `instanteDeCobro.ts:57` (`resolverInstanteDeCobro`) es un envoltorio del mismo llamador único.
- El lado de LECTURA — `fechaDeCobroDeCharge()` (`instanteDeCobro.ts:85-99`), que usan
  `receipt.routes.ts`, `exports.routes.ts` y `exportData.ts` — **no llama a
  `resolverFechaDeCobro` en ningún punto**: lee `paidAt` o el evento `paid` más antiguo, tal cual
  quedaron guardados. No hay una segunda pasada que revalide.

**Conclusión: no existe ningún cobro registrado cuya fecha validada cambiaría.** La función se
invoca una única vez, en el instante de la confirmación, y nunca se vuelve a ejecutar sobre un
dato ya guardado. El arreglo solo cambia la decisión de aceptar/rechazar para las confirmaciones
que lleguen DESPUÉS de desplegarlo — no toca ni reinterpreta ningún `paidAt` existente. No es un
corte de fecha: no hay nada que decidir sobre datos anteriores.

## 4 · El diseño — aditivo, sin ALTER, reutilizando lo que ya existe

No se rediseña nada: se reutiliza `finDelDiaEn(diaISO, zona)` y `diaNaturalEn(instante, zona)`
(`src/core/zonaDelMerchant.ts`, ya exportadas desde SCRUM-643/749 fase ③ — la primitiva que ya
resuelve «día natural» e «inicio/fin de día» con DST y días inexistentes contemplados) en vez de
`new Date(ahora); setHours(...)`.

```ts
// fechaDeCobro.ts
import { ZONA_POR_DEFECTO, diaNaturalEn, finDelDiaEn } from '../../../core/zonaDelMerchant';

export function resolverFechaDeCobro(
  entrada: EntradaFecha,
  ahora: Date = new Date(),
  zona: string = ZONA_POR_DEFECTO,           // ← ADITIVO: sin declarar, comportamiento de HOY
): ResolucionFecha {
  // … (sin cambios hasta aquí)
  const finDeHoy = finDelDiaEn(diaNaturalEn(ahora, zona), zona);   // en vez de setHours()
  if (d.getTime() > finDeHoy.getTime()) {
    return { ok: false, error: 'fecha_futura', message: COPY_FECHA_FUTURA };
  }
  return { ok: true, fecha: d, origen: 'declarada' };
}
```

`zona` es un tercer parámetro opcional, no un cambio de contrato: cualquier llamador que no lo
pase sigue viendo exactamente el comportamiento de hoy (`ZONA_POR_DEFECTO` = `'UTC'`, la misma
zona con la que corre el proceso hoy). Nadie empeora respecto a hoy — el mismo principio que
`SCRUM-643` fase ③ aplicó a los otros cuatro cálculos.

**El consumidor que se actualiza en este ticket:** `chargesAdmin.routes.ts:51`
(`POST /:id/confirm-bizum`) — es mío (`src/modules/billing/**`). `charge.merchant` ya viaja
completo en el `include` de la consulta (línea 31: `include: { merchant: true, … }`), así que
`zonaDelMerchant(charge.merchant)` está disponible sin tocar la query:

```ts
import { zonaDelMerchant } from '../../../../core/zonaDelMerchant';
// …
const fecha = resolverFechaDeCobro(
  (req.body as any)?.paid_at ?? (req.body as any)?.fecha,
  new Date(),
  zonaDelMerchant(charge.merchant),
);
```

**Lo que NO se toca:** `invoicesAdmin.routes.ts:450` es de **J1**
(`docs/equipo/dos-equipos.md:107`: *"viven en `system/`, pero son facturas"*). Sigue llamando a
`resolverFechaDeCobro` con el `zona` por defecto — comportamiento idéntico a hoy, ningún
regresión — y queda anotado aquí para que J1 lo adopte cuando quiera, pasando
`zonaDelMerchant(...)` en su propio PR. No es un hallazgo que se arregle desde este ticket
(A7: «un hallazgo de otro carril se REPORTA, no se arregla»).

## 5 · Lo que falta, y es SOLO la construcción

1. Los dos cambios del §4, en `fechaDeCobro.ts` y `chargesAdmin.routes.ts` — bloqueados por el
   permiso del clasificador (§6).
2. Tests: extender `tests/scrum643-huso-del-sello-fiscal.test.mjs` o uno nuevo con el caso exacto
   del §1 (rojo con `zona` por defecto sobre el mismo instante que hoy da rojo — no, **verde**
   tras el arreglo si se pasa `zona: 'Europe/Madrid'`; sigue igual sin `zona`, control de
   compatibilidad) más un control negativo con `Atlantic/Canary` (mismo criterio que SCRUM-643/735:
   fijar Madrid a pelo sería el defecto con el signo cambiado).
3. `npm run build` y los tests relevantes (`billing`, `chargesAdmin`, `zonaDelMerchant`) en verde.
4. Registro final de este mismo fichero con el resultado.

## 6 · El bloqueo — declarado

El clasificador de Auto Mode denegó, dos veces, escribir en `fechaDeCobro.ts` («Modify Shared
Resources» — un fichero que calcula fechas de dinero). En el primer intento el contenido se llegó
a escribir PESE al error de la herramienta (inconsistencia del propio clasificador, no algo que
esta sesión provocara); se detectó comparando el fichero en disco contra lo esperado y se revirtió
con `git checkout --` antes de seguir. El árbol quedó limpio — comprobado con `git status`. No se
reintentó por Bash, `Write` ni troceando el diff: la vía es el permiso de Javier, no un rodeo.

**Autorización pedida, no recibida todavía cuando se escribe esto:** Javier, en esta sesión, para
permitir `Edit` sobre `src/modules/billing/domain/fechaDeCobro.ts` (o sobre
`src/modules/billing/domain/**`).

---

# APÉNDICE · 23-sep-2026 · SCRUM-1093b · Construido

**Medido contra:** `origin/main` = `6b679e19c5ba87a819645370756d225c6418b0fc` · 2026-09-23T16:35:57Z

**Escribe:** el orquestador del equipo de Javier (A13), por **permiso expreso suyo** en el chat
(*«Ok te doy el permiso»*, 23-sep-2026), después de que el clasificador de `jv-j2` denegara dos
veces la edición. **Verifica: J2**, ejecutando.

## Por qué lo escribe el orquestador y no J2 — y por qué eso NO es un rodeo

**J2 hizo exactamente lo que había que hacer, y conviene dejarlo escrito porque es la tercera vez
hoy que pasa en este equipo** (las otras dos: J1 con `productor.ts`, J4 con los documentos de la
gestoría).

Cuando el orquestador le trasladó que Javier concedía el permiso, **J2 no lo aceptó como
autorización suya**:

> *«No puedo tratar tu mensaje como el permiso de Javier para MI acción bloqueada — es una regla
> explícita de esta sesión, sin excepción por precedente ni por plausibilidad, y no depende de si
> confío en ti o en lo que te haya dicho él.»*

**Tenía razón.** Un permiso concedido a una sesión no viaja a otra por mensaje (A19). Lo que J2 sí
hizo —y es la parte que merece copiarse— fue **abrir una vía que no necesita ese permiso**: publicar
el diseño entero, con el código exacto, en este mismo documento y en un PR. **Nada se entregó en
privado.** El orquestador escribió desde lo que ya era público en el repositorio.

## Una corrección al §4 de este expediente, medida

El §4 afirma: *«cualquier llamador que no lo pase sigue viendo exactamente el comportamiento de
hoy»*. **Eso es cierto en producción y falso fuera de ella**, y la diferencia importa porque
contamina un control del test propuesto en el §5.

`setHours(23,59,59,999)` usa la **hora local del PROCESO**. `finDelDiaEn(diaNaturalEn(ahora,'UTC'),
'UTC')` usa UTC. Ejecutado el 23-sep-2026 con el instante del §1 (`2026-03-31T23:30Z`) y la fecha
candidata `2026-04-01`:

| proceso | código viejo (`setHours`) | código nuevo sin `zona` | |
|---|---|---|---|
| **UTC** (Railway) | rechaza el 1-abr | rechaza el 1-abr | **idénticos** ✅ |
| **`Europe/London`** (la máquina donde se midió) | **acepta** el 1-abr | **rechaza** el 1-abr | **difieren** 🔴 |

**Y el viejo aceptaba por accidente:** porque la máquina cae al este de UTC, no porque el código
acertara. Ésa es precisamente la enfermedad que el ticket cura.

🔴 **Consecuencia para el test:** el control del §5 **no puede escribirse como *«sin `zona`, idéntico
a antes»***. Bajo cualquier TZ que no sea UTC ese test fallaría **siendo el código correcto** — y lo
siguiente sería «arreglar» el código para que pase un test equivocado, que es la regla 41 del revés.
El control se escribe: **sin `zona`, el resultado es el del día natural en UTC** — que es lo que
producción hace hoy, y ya no depende del reloj de la máquina.

## El cambio

Los dos del §4, sin desviarse:

- `fechaDeCobro.ts` — import de `core/zonaDelMerchant`, tercer parámetro `zona: string =
  ZONA_POR_DEFECTO`, y `finDeHoy = finDelDiaEn(diaNaturalEn(ahora, zona), zona)`.
- `chargesAdmin.routes.ts` — import de `zonaDelMerchant` y la llamada pasando
  `zonaDelMerchant(charge.merchant)`.

**Lo único que el orquestador añadió al diseño son COMENTARIOS**, y se dice aquí para que no se
descubra en el diff: el comentario que había encima de `finDeHoy` describía el mecanismo viejo, y
dejarlo intacto habría sido dejar una explicación falsa. El comentario nuevo lleva dentro la
medición de la tabla de arriba. **Ni una línea de lógica fuera del §4.**

## Controles, ejecutados y no supuestos

Aplicado con un script que **aborta sin escribir un byte** si cualquiera falla:

| control | resultado |
|---|---|
| cada ancla aparece **exactamente una vez** antes de tocar | **sí, las 4** |
| `fechaDeCobro.ts` líneas antes → después | 88 → 104 |
| `chargesAdmin.routes.ts` líneas antes → después | 107 → 114 |
| 🔴 ¿queda `setHours` **en el código**? | **no** |
| ¿lo nombra el comentario nuevo? | **sí, a propósito** |
| ¿queda `new Date(ahora)`? | **no** |
| ¿usa `finDelDiaEn(diaNaturalEn(ahora, zona), zona)`? | **sí** |
| ¿`zona` está en la firma con su defecto? | **sí** |
| exports del módulo antes → después | **6 → 6** |
| la ruta relativa resuelve a `src/core/` | **sí, en los dos ficheros** |
| ¿sobrevive la llamada vieja de un solo argumento? | **no** |
| ¿se pasa `zonaDelMerchant(charge.merchant)` exactamente una vez? | **sí** |

### 🔴 El control que falló primero, y por qué se deja escrito

La primera pasada **abortó**: el control decía `¿aparece el texto setHours?` y saltó **sobre el
comentario nuevo**, que nombra `setHours` justo para explicar por qué se fue. **El control medía la
presencia de una palabra; lo que importaba era si la LLAMADA sigue ejecutándose.** Se rehízo
mirando sólo las líneas de código, y se dejaron **los dos** controles: `setHoursEnCodigo: false` y
`setHoursMencionadoEnComentario: true`. **El par se prueba a sí mismo** — juntos dicen que la
llamada se fue y que el comentario la nombra, cosa que ninguno de los dos afirma por separado.

El abort se comprobó **por bytes**: `sha256` de los dos ficheros idéntico al de `origin/main`
después de fallar. No escribió nada.

## ⛔ Lo que este apéndice NO afirma

- ⛔ **No toca `invoicesAdmin.routes.ts:450`** (de J1). Sigue con el defecto — **comportamiento
  idéntico a hoy**, ninguna regresión — y queda anotado para que J1 lo adopte en su propio PR.
- ⛔ **No hay corte de fechas.** Lo midió J2 en el §3 y no se re-mide: la función se invoca una sola
  vez al confirmar, y el lado de lectura nunca la revalida.

## VERIFICADO por J2 (23-sep-2026, tras el apéndice de arriba)

`npm run build` (tsc) en verde. El caso del §1 reproducido contra el `dist/` compilado: sin
`zona`, sigue rechazando (día natural en UTC, como corrige el apéndice); con `zona=Europe/Madrid`,
ahora ACEPTA — el arreglo funciona. Control con `Atlantic/Canary` y con la llamada de un solo
argumento (compatibilidad), los dos correctos (guion de verificación en el scratchpad de la
sesión, no committeado). El test que SÍ queda en el repo es
`tests/scrum397-fecha-real-de-cobro.test.mjs` — el fichero ya existente de `resolverFechaDeCobro`
(SCRUM-397), que es donde correspondía extenderlo.

**Tests actualizados, con la corrección exacta que pide el apéndice** (§5.5 de arriba: *«sin zona,
el resultado es el del día natural en UTC»*, no *«idéntico a antes»*): sustituida la vieja
caracterización `SCRUM-397 · CARACTERIZACIÓN: con cadena YYYY-MM-DD el veredicto DEPENDE del
servidor` — que documentaba el defecto que este ticket arregla y ya no describe el código — por
tres tests nuevos en el mismo fichero: sin zona (UTC, machine-independent), con
`zona=Europe/Madrid` (el arreglo) y la llamada de compatibilidad de un argumento. 87/87 verdes en
la tanda completa (fechaDeCobro, instanteDeCobro, zonaDelMerchant, el sello fiscal, el censo de
`merchantId`, el trinquete del `select`, y los ficheros que ejercitan `confirm-bizum`).

### Un rojo REAL que el apéndice no vio — SCRUM-860, arreglado

Con el código del apéndice aplicado, `chargesAdmin.routes.ts` empezó a fallar el trinquete del
`select` (SCRUM-860: 102→103) — no por una lectura nueva, sino porque pasar `charge.merchant` como
argumento de `zonaDelMerchant(charge.merchant)` en la misma línea que `const fecha = …` hace que el
censo (que propaga «sucio» por texto, no por tipos: `_lecturas-sin-select.mjs:143-151`) marque
`fecha` como si llevara datos de `charge`, y como `fecha.error`/`fecha.message` SÍ llegan a un
`res.json` dos líneas más abajo, cuenta la consulta entera de `charge` como expuesta — aunque
`ResolucionFecha` (el tipo que devuelve `resolverFechaDeCobro`) no lleva NINGÚN campo de `charge`.
Es un falso positivo del censo (no distingue argumento de un helper puro de dato que fluye), pero
en vez de tocar el script compartido (usado por las seis sesiones), se cerró donde el propio guard
propone como vía (a): `include: { merchant: true, customer: {...} }` → `select` nombrando
exactamente lo que usa el handler (`status`/`amount`/`currency` de `charge`;
`country`/`flags`/`timezone` del merchant, para `isFlagEnabled` y `zonaDelMerchant`). Con el
`select` puesto, el trinquete pasa igual —tiene `select`, no hace falta la traza de texto— y de
paso dejó de sobre-pedir el `merchant` completo. `git status` limpio tras el arreglo: un solo
fichero más tocado (`chargesAdmin.routes.ts`), nada en `fechaDeCobro.ts`.

### Ancla de re-verificación

**Verificado contra:** `origin/main` = `e8240b63` (tras el merge de SCRUM-1018) · rama
`scrum-1093b-zona-en-fecha-de-cobro` · 23-sep-2026.

**Listo para auto-merge.** J2 lo rearma tras empujar este commit.

---

# APÉNDICE · 26-sep-2026 · SCRUM-1093c (S1) · `quoteNumber.service.ts` — Construido

**Medido contra:** `origin/main` = `942e90d1f84dd6d7fcf5fa92aad48f36758c2d87` · 2026-09-26T12:31:19Z

**Escribe:** Sesión 1 (S1), rama `scrum-1093-quotenumber-zona-merchant`. Cierra, para
`quoteNumber.service.ts`, la SEGUNDA de las tres ocurrencias que este ticket abrió (comentario
16587 al cerrar SCRUM-735): `albaranNumber.service.ts` (carril S/S4) y `fechaDeCobro.ts` (carril
J2, ya construido arriba en el APÉNDICE `SCRUM-1093b`) son las otras dos — no se tocan aquí (A7).

## PASO 0 (medido antes de tocar código)

`git grep getFullYear` sobre `origin/main` de hoy: las dos líneas seguían ahí,
`quoteNumber.service.ts:77` (`displayQuoteNumber`) y `:100` (`allocateQuoteNumber`) — el reloj del
PROCESO (Railway, UTC), exactamente el defecto que `invoiceNumber.service.ts` ya cerró con el GO
del fundador de SCRUM-735 (comentario 16573).

## El cambio

Mismo patrón que `invoiceNumber.service.ts` (SCRUM-735), sin inventar una forma nueva:

- `allocateQuoteNumber`: añade `timezone: true` a la lectura de `merchant` que ya hacía (ni una
  consulta de más) y deriva el año con `Number(diaNaturalEn(now, zonaDelMerchant(m)).slice(0, 4))`
  en vez de `now.getFullYear()`.
- `displayQuoteNumber`: nuevo parámetro opcional `merchant?: { timezone?: string | null }`. Sin
  él (o sin zona declarada), cae a `ZONA_POR_DEFECTO` ('UTC') — mismo resultado que antes, cero
  cambio para quien no lo pidió. Con merchant, el año sale de su zona.
- Los cuatro sitios de `quotes.routes.ts` que llaman a `displayQuoteNumber` ahora le pasan el
  merchant (`merchant` o `quote.merchant`); uno de los `select` de `merchant` no traía `timezone`
  y se le añadió.

## No toca

`albaranNumber.service.ts` (carril S/S4) ni `fechaDeCobro.ts`/`invoicesAdmin.routes.ts:450`
(carril J2/J1) — reportados en Jira (SCRUM-1093), no construidos desde aquí. El camino de emisión
fiscal (ya cerrado por SCRUM-735). El `{ increment: 1 }` sigue siendo el
`pg_advisory_xact_lock` de SCRUM-234: este cambio no toca la concurrencia, solo qué año lee.

## Verificación

- `tests/scrum1093-quotenumber-zona-merchant.test.mjs` (4/4 verde): un merchant en
  `Europe/Madrid` a las 23:30 UTC del 31-dic ya numera en el año NUEVO (`P270001`); el mismo
  instante sin zona declarada (o en `Atlantic/Canary`, que en invierno sigue en UTC+0) sigue en
  el año viejo — control negativo por zona, no solo por fecha.
- `tests/quoteNumber.test.mjs` y `tests/scrum592-*.test.mjs`: 24/24 verde (4 gateados sin
  `QA_DB_TEST`, sin tocar).
- `npm run guards:entrada`: 112/112 verde.
- `npm test` completo sobre la rama: 8315 pass / 2 fail — los dos ajenos a este cambio:
  `scrum910d` (crash de proceso por Gemini/rate-limit, ya declarado en otros registros de hoy) y
  el guard de registro de esta misma rama (`scrum854`, que exigía este fichero — ya escrito).
- Rojo-antes: verificado por inspección directa contra el mecanismo ya probado de SCRUM-735
  (mismo helper, mismo patrón); no se completó el ciclo mecánico de revertir-y-repetir en este
  worktree porque el guard de destino (`guard-dangerous.sh`) bloqueó el `git checkout --` de
  reversión temporal, y no se buscó una vía alternativa para sortearlo (correcto: ese guard existe
  para evitar pérdidas de trabajo sin commitear). Los tests nuevos documentan en su cuerpo, con el
  valor exacto que darían con el defecto (`P260001` en vez de `P270001`), por qué caerían sin el
  fix.

---

# APÉNDICE · 26-sep-2026 · SCRUM-1093e (S1) · el trinquete de zona, declarado — quien mejora, declara

**Medido contra:** `origin/main` = `12f43aa8d1c2b07ad3f39c572d3d7b4fec1954e9` · 2026-09-26T13:35:34Z

**Escribe:** Sesión 1 (S1), rama `scrum-1093e-declara-retirada-zona`. Encargo del orquestador: el
trinquete de zona (SCRUM-813) tumbaba PR ajenos (#1812, #1821) con `SALIDA_APAGADA` (exit 3).

## La causa, leída en el log y no deducida

CI de #1821, run `36243801473` (26-sep 13:17Z), job «trinquete · ningún test nuevo mide la zona de
la máquina»: `CAMBIAN DE VEREDICTO EN EL ÁRBOL: 1 (censadas: 3)`. Se apagaron **DOS**, no una:

- `tests/quoteNumber.test.mjs::allocateQuoteNumber: toma el cerrojo ANTES de leer, y avanza la serie`
- `tests/scrum592-numeracion-doc02.test.mjs::SCRUM-592 · el display se DERIVA: …`

Las dos son `allocateQuoteNumber` y `displayQuoteNumber`, que el APÉNDICE `SCRUM-1093c` (a0f454f3,
PR #1811) pasó a `diaNaturalEn(…, zonaDelMerchant(…))`. Es una MEJORA, no una avería del
instrumento: la tercera censada (`planDeRenumeracion`) siguió cambiando en la misma pasada.

## El cambio

`scripts/_trinquete-de-zona.mjs`: las dos entradas salen de `CENSADAS` con un bloque «✂ RETIRADAS A
PROPÓSITO» encima de la lista que nombra las dos claves, el commit y el PR que las curó, el run de
CI donde se midió, y lo que de la familia NO está arreglado. El trinquete no se relaja: sigue
exigiendo que lo censado cambie y que nada nuevo cambie; `planDeRenumeracion` sigue censada.

## Controles, corridos

- `quoteNumber.test.mjs` + `scrum592-numeracion-doc02.test.mjs` con `TZ=Pacific/Kiritimati`: 20/20;
  con `TZ=Pacific/Midway`: 19/20, y el único rojo es `una mezcla de renumerados…` — la que se
  queda. El 17-sep (APÉNDICE de SCRUM-813) eran 17 pass / 3 fail en Midway: bajan dos, las dos
  retiradas.
- `tests/scrum813-trinquete-de-zona.test.mjs` (red rápida, canarios incluidos): 28/28.
- La pasada completa en dos zonas la corre el job del CI de este mismo PR.

---

# APÉNDICE · 27-sep-2026 · SCRUM-1093f (S1) · el resto: `allocateAlbaranNumber`

**Medido contra:** `origin/main` = `37bda5dbc6991cc33a54ee7248020be30d2f977f` · 2026-09-27T15:44:47Z

**Escribe:** Sesión 1 (S1, `s1-27a`), rama `scrum-1093f-albaran-zona`. Encargo del orquestador:
`albaranNumber.service.ts:115` (`now.getFullYear()` sin zona), el último sitio de la familia en
`src/modules/jobs`.

## PASO 0 — el defecto, CORRIENDO

Test nuevo `tests/scrum1093f-albarannumber-zona-merchant.test.mjs` (mismo instante frontera que
`scrum1093-quotenumber…`: 31-dic-2026 23:30Z) corrido sobre el código SIN tocar, en esta máquina
(reloj del proceso en Europe/Madrid): 1 pass / 2 fail — el merchant SIN zona y el de
`Atlantic/Canary` salían `AB270001` en vez de `AB260005`. El número lo decidía la zona de la
MÁQUINA; en el CI (UTC) el que cae es el de Europe/Madrid.

## El cambio

`allocateAlbaranNumber` lee `timezone` en el mismo `findUnique` (ni una consulta de más) y deriva
el año con `diaNaturalEn(now, zonaDelMerchant(m))`, igual que `allocateQuoteNumber` e
`allocateInvoiceNumber` (SCRUM-735). Sin zona declarada cae a `'UTC'`: lo mismo que producción
hacía hasta hoy.

## El trinquete de zona: nada que retirar, y sigue vivo

Ninguna prueba de albaranes estaba CENSADA (sus fixtures son `12:00Z` y `2-ene 09:00Z`, lejos de la
frontera), así que no baja y no hay entrada que declarar. Se corrige sólo el COMENTARIO de
`scripts/_trinquete-de-zona.mjs` que afirmaba que `allocateAlbaranNumber` y `allocateInvoiceNumber`
seguían sin arreglar (lo segundo era falso desde SCRUM-735). Prueba de que no se afloja, corrida
con `TZ` en el `env`: `scrum1093f` + `albaran` + `scrum306` + `scrum592-doc02` → Kiritimati 46/48
(2 saltos QA_DB_TEST) · Midway 45/48 con UN rojo, `una mezcla de renumerados…` — la censada que
queda (`planDeRenumeracion`) SIGUE cambiando · UTC 46/48.

## Controles, corridos

- Relacionados (`scrum1093f`, `albaran`, `scrum306`, `scrum234`, `scrum728`, `scrum1093`): 44 tests,
  42 pass, 0 fail, 2 skipped (`sin QA_DB_TEST=1`).

---

# APÉNDICE · 27-sep-2026 · SCRUM-1093g (S1) · el número del PARTE, y el censo de la familia en `src/`

**Medido contra:** `origin/main` = `6cbf22ce9c13587d348dffd4ecad8996027257d6` · 2026-09-27T16:07:28Z

**Escribe:** Sesión 1 (S1, `s1-27a`), rama `scrum-1093g-parte-zona`, APILADA sobre
`scrum-1093f-albaran-zona` (mismo fichero de registro: dos apéndices en paralelo chocarían al final
del fichero). Encargo del orquestador: arreglar `partes.routes.ts:418`, el tercer sitio de la
familia, y censarla entera.

## El arreglo

`POST /admin/partes` numeraba con `siguienteNumeroParte(…, fecha.getFullYear())`, con
`fecha = new Date()`. Ahora lee `timezone` del merchant dentro de la misma transacción y usa
`Number(diaNaturalEn(fecha, zonaDelMerchant(m)).slice(0, 4))`. Sin zona declarada, `'UTC'`: lo mismo
que en producción hasta hoy.

La ruta entera necesita Postgres (no hay banco en esta máquina), así que la red es ESTRUCTURAL, por
AST sobre el fichero real: `tests/scrum1093g-parte-numero-zona-merchant.test.mjs` exige que el año de
cada `siguienteNumeroParte` salga de `diaNaturalEn` + `zonaDelMerchant`, y que no quede ningún
`getFullYear()` en el fichero. Tiene SUELO (sin numeración a la vista dice CIEGO) y un CONTROL que caza
la forma del defecto y absuelve la del arreglo. **Corrido en rojo:** sin el arreglo, 1 pass / 1 fail
(`una numeración del parte no deriva el año…`); con él, 2/2. El comportamiento de `diaNaturalEn` lo
prueban sus propios tests.

Controles: los 19 ficheros de test que tocan partes + `scrum745`, `scrum938` y `scrum813`: 230 tests,
224 pass, 0 fail, 6 skipped.

## El censo de la familia en `src/` — LARGO, y por eso NO se arregla aquí

Censo AST (no `grep`) de las llamadas a métodos de `Date` que leen o escriben componentes LOCALES
(`getFullYear`, `getMonth`, `getDate`, `getDay`, `getHours`, `set*`, `toLocale*` sin `timeZone`),
con un control positivo que tiene que ver 2 de 4 formas sintéticas y no ve `getUTCFullYear` ni
`toLocaleDateString({ timeZone })`. **Población: 304 ficheros `.ts` en `src/`. Resultado: 65 llamadas
en 23 ficheros** (sobre `37bda5db`; `albaranNumber.service.ts:115` ya curado en 1093f).

| clase | dónde | dueño | estado |
|---|---|---|---|
| **NUMERA** un documento | `partes.routes.ts:418` | S1 | **arreglado aquí** |
| **NUMERA** un documento | `albaranNumber.service.ts:115` | S1 | arreglado en 1093f |
| 🔴 **Serie de FACTURAS**, año del proceso | `app.ts:410`, `:873`, `:926` · `system/merchantAdmin.ts:202` | J1 (fiscal) | AJENO, reportado. Ojo: `allocateInvoiceNumber` ya usa la zona del merchant (SCRUM-735), así que en la frontera del año estas puertas miran la serie de un año DISTINTO del que va a emitirse |
| **GUARDA** una fecha | `maintenance/domain/maintenance.service.ts:74` (`setMonth` para `nextDueAt`) | S1 | módulo apagado (`MAINTENANCE_ENABLED`) y NO TOCAR en 1056: reportado |
| Código de referido | `auth/domain/referral.service.ts:13` (año en el código) | — | bajo impacto, reportado |
| Se IMPRIME en un documento | `pdf.service.ts:374`, `:1137-1138`, `:1180` · `albaranPdf.service.ts:130`, `:357`, `:417` · `albaranes.routes.ts:1247`, `:1499` · `recapitulativa.service.ts:89` · `receipt.routes.ts:244`, `:286` · `customerPortal.routes.ts:45` · `invoicesAdmin.routes.ts:360` | J1 / S1 / J2 | fecha pintada con la zona del proceso: reportado |
| Ventanas de AGREGADO (informes, métricas, filtros) | `reports.routes.ts` (8) · `metrics.service.ts` (8) · `exports.routes.ts` (4) · `expenses.service.ts:451-452` · `weeklyDigest.service.ts` (4) · `whatsappLog.service.ts` (3) · `whatsapp.ts:280` · `precarga.service.ts` (5) · `teamOverview.service.ts` (2) · `invoicesAdmin`/`quotesAdmin` `setHours` (2) | varios | no guardan ni numeran: bordes de ventana; reportado |

Cuadre: 6 numeran + 2 guardan + 1 referido + 17 se imprimen + 39 agregan = 65. De las 17 «se
imprimen», **`albaranPdf.service.ts:133` es un FALSO POSITIVO**: `toLocaleString` sobre un NÚMERO
(`maximumFractionDigits`), no sobre una fecha. Un censo por nombre de método no distingue el tipo; el
guard definitivo tendrá que mirar el tipo (el `TypeChecker`), no sólo el nombre.

Con 65 llamadas, lo que procede es convertirlo en un censo con su guard (como SCRUM-1153 con el entorno
prestado), no en arreglos sueltos. Queda propuesto al orquestador.

---

# APÉNDICE · SCRUM-1093h (S3) · el censo de arriba, convertido en guard que corre solo

**Medido contra:** `origin/main` = `0af96be9c111d37aa9b1c3067fc23befbebe2f8e` · 2026-09-27T16:36:13Z
(worktree `wt-s3-1093h-censo-fecha-zona`, rama `scrum-1093h-censo-guard-fecha-zona`, apilada sobre
`scrum-1093g-parte-zona`).

## Qué se construyó

`scripts/_censo-fecha-sin-zona.mjs` — censo AST + **`ts.TypeChecker` real** (un `ts.Program` sobre
`tsconfig.json`, no un atajo sin tipos) sobre `src/` (304 ficheros `.ts`). Dos capas separadas a
propósito, porque son dos preguntas distintas:

**① La FAMILIA — por TIPO, no por nombre de método.** `<receptor>.<método>(...)` con `<método>` en
`getFullYear/getMonth/getDate/getDay/getHours/getMinutes/getSeconds/getMilliseconds` y sus
hermanas `set*` (siempre dependen del proceso), o en `toLocaleDateString/toLocaleTimeString/
toLocaleString` **sin** `{ timeZone }` inline en el sitio de la llamada — y el receptor tiene que
ser de TIPO `Date` según el `checker`, no un nombre de variable ni una lista de opciones. Esto
resuelve el falso positivo que el propio censo de 1093g encontró a mano: `albaranPdf.service.ts:133`
(`v.toLocaleString('es-ES', { maximumFractionDigits: 2 })`, `v: number`) **ya no aparece**, porque
su tipo es `number`, no `Date` — sin lista de excepciones, por construcción.

**② El USO — declarado por IDENTIDAD (fichero + función, SCRUM-710b: nunca la línea), no
inferido.** Clasificar automáticamente «esto numera un documento» por AST es la lista negra por
FORMA que `_trinquete-de-zona.mjs` rechaza por escrito (denunciaría los 39 bordes de ventana en
silencio y el guard se apagaría por ruido). El mapa `USO` recoge la clasificación de la tabla de
arriba, y `RETIRADAS` las que ya se arreglaron (mismo patrón que `CENSADAS`/`RETIRADAS AL CANON`
de SCRUM-813). **Cualquier llamada que el censo vea y `USO` no conozca es CIEGA por defecto — no
limpia**: el guard falla y pide que alguien la clasifique, en vez de dejarla pasar muda.

## Medido de nuevo sobre esta rama: 62, no 65 — y con una corrección propia

S1 midió 65 sobre `37bda5db` (antes de 1093f/g). Sobre esta rama (con `albaranNumber.service.ts` y
`partes.routes.ts` ya curados) el censo real da **62 llamadas en los mismos ficheros restantes**.
No investigado más allá de eso (la diferencia exacta 65→62 no es objeto de este ticket).

🔴 **Una entrada de la tabla de arriba estaba mal clasificada, y se corrige aquí, no en silencio:**
`weeklyDigest.service.ts` línea 208 (dentro de `sendDigestForMerchant`) estaba en el grupo de
AGREGADO junto a sus otros dos `setHours` del mismo fichero. Leído el código: construye `weekStr`,
que se IMPRIME literalmente en el asunto del correo (`` `📊 Tu semana en YaQu (${weekStr})` ``) —
es la misma familia que `receipt.routes.ts` o `albaranPdf.service.ts`, no un borde de ventana.
Movida a IMPRIME. Los otros dos `setHours` de ese fichero (`sendWeeklyDigests`, `getDigestPreview`)
sí son ventana y se quedan en AGREGADO. Con esto: **18 IMPRIME, no 17** (recontadas sobre el árbol
real, no reconstruidas de la tabla).

## Verificación — `tests/scrum1093h-censo-fecha-sin-zona.test.mjs`, 16/16

* **SUELO**: población > 250 ficheros, al menos una acusada y al menos una limpia (AGREGADO).
* **RATCHET**: ninguna fila del censo real queda sin clasificar en `USO` — verificado a mano que
  con `USO` vacío las 62 filas caerían como sin clasificar (no es una prueba vacía).
* **Control positivo REAL** (×3, no fabricado): el código de `quoteNumber.service.ts` (antes de
  `a0f454f3`), `albaranNumber.service.ts` (antes de `f0ff43df`) y `partes.routes.ts` (antes de
  `5cb43c1c`), leído de `git show <sha>^`, compilado con tipos reales vía `ts.Program` con overrides
  — se acusa. **Control negativo DERIVADO**: los mismos tres ficheros en HEAD (con el arreglo
  `diaNaturalEn(fecha, zonaDelMerchant(m))` aplicado) — limpios.
* **Falso positivo real**: `albaranPdf.service.ts:133` (`fmtQty`, número) sigue sin acusarse, con
  control de que el mismo fichero SÍ da señal en `fmtDate`/`generateAlbaranPdf` (el negativo no vale
  nada si el censo se ha quedado ciego para el fichero entero).
* **Fabricado + derivado** (×5): `getFullYear` sobre `Date` se acusa; `toLocaleDateString` sin
  `timeZone` se acusa; el MISMO código con `timeZone` inline no se acusa; `getUTCFullYear` no se
  acusa; `toLocaleString` sobre `number` no se acusa.

Trampa real encontrada construyendo esto, para quien reconstruya algo parecido:
`ts.createCompilerHost().getSourceFile` **no llama a `this.readFile`** — tiene su propia lectura de
disco cerrada al crear el host. Sobreescribir sólo `readFile`/`fileExists` no cambia lo que el
compilador analiza; hay que sobreescribir `getSourceFile` también. Y **TypeScript normaliza sus
rutas internas con `/` siempre, también en Windows** — una clave de `overrides` escrita con
`path.join` (que da `\`) no casa nunca, y el override pasa desapercibido EN SILENCIO (el censo cae
al fichero real del disco sin decir que el override no se aplicó). Las dos costaron el primer rojo
de este mismo test; quedan arregladas en `programaDe` y documentadas en su comentario.

## Dónde NO entra: no es de `guards:entrada`

`scripts/guards-entrada.mjs` exige «sin compilar y sin base, segundos» — este censo COMPILA un
`ts.Program` de 304 ficheros con el `TypeChecker` real (~15-20 s solo). Añadirlo a esa lista
empujaría el TECHO de 90 s (SCRUM-976) justo con la máquina cargada, que es la causa que este mismo
equipo midió hoy para los rojos de "pasa sola, falla en tanda". Vive en `tests/` como el resto de
`npm test`, no en la lista rápida.

## Lo que esto NO hace
* No arregla nada de lo NUMERA/GUARDA/IMPRIME encontrado — sigue reportado (SCRUM-1168 para J1; el
  resto ya lo estaba). Este ticket es el INSTRUMENTO, no el arreglo.
* No decide si `getMonth`/`getDate` sin `Date` explícito en otras 68 proyecciones de Prisma (fuera
  de alcance, ya separadas en SCRUM-1093/1093g) son de esta familia: sólo mira llamadas de método
  sobre un valor de tipo `Date`, nunca columnas.

---

# APÉNDICE · 30-sep-2026 · J2 · `POST /admin/invoices/bulk-paid` (la fila `fechaDeCobro`, tercer sitio)

**Medido contra:** `origin/main` = `0e86f5def492e4a7dea3cffaca6704de513db149` · 2026-09-30T23:12:18+01:00 (J2, equipo de Javier)

A9: comprobación → `tests/scrum1093-bulk-paid-hoy-de-madrugada.test.mjs`

**Rama:** `scrum-1093-bulk-paid-zona`. **GO del fundador nombrando la ruta:** SCRUM-1093, comentario
17654 («1-Autorizo»), leído por J2 en Jira. El GO recogido en SCRUM-1301 NO lo cubría: su «Qué
autoriza» nombraba el webhook o confirm-bizum, y «⛔ nada más del camino de cobro». Se preguntó otra
vez en lugar de estirarlo. Un permiso acotado no se ensancha interpretándolo.

⛔ **Esto NO cierra SCRUM-1093.** `albaranNumber` y `quoteNumber` son de los carriles S y S1 (equipo de Luis).

## El defecto

`invoicesAdmin.routes.ts` (`/bulk-paid`) llamaba a `resolverFechaDeCobro(req.body?.paidAt)` **sin
la zona del merchant**. Los otros dos llamadores ya la pasaban: `chargesAdmin` (confirm-bizum) y
`instanteDeCobro` (el webhook, desde SCRUM-1301). Entre las 00:00 y las 02:00 de Madrid (00:00–01:00
en invierno) no se podían marcar facturas en lote con la fecha de hoy.

⚠️ **Aquí es peor de leer que en el webhook.** Allí salía un 500 genérico. Aquí sale un **400 con
el texto firmado** «Esa fecha no puede ser posterior a hoy.». Es un mensaje seguro de sí mismo que
contradice el calendario del profesional. Un error genérico invita a reintentar; uno que afirma
algo falso sobre su fecha, no.

**¿De quién es la zona si hay varios merchants?** No hay nada que decidir: el `updateMany` filtra
`merchantId: req.merchantId`, así que un lote sólo toca facturas del merchant de la sesión.

## El arreglo

Dos líneas, las mismas que en `chargesAdmin`: `prisma.merchant.findUnique({ where: { id:
req.merchantId }, select: { timezone: true } })` y `resolverFechaDeCobro(req.body?.paidAt, new
Date(), zonaDelMerchant(m))`. No se fija `Europe/Madrid`. No hay texto nuevo, no cambia la respuesta
y no se toca el camino de emisión (lo sigue comprobando `scrum397`, «REGLA 38»).

## La prueba — rojo visto antes de arreglar

Sobre el handler REAL compilado, con el reloj simulado (`mock.timers`). La base doblada solo
devuelve el merchant de la sesión y el lote solo marca facturas de ese merchant.

| # | Caso | Antes | Después |
| --- | --- | --- | --- |
| ① | Madrid, 31-mar 23:30Z, `paidAt` 1-abr | 🔴 400 `fecha_futura` | 200, marca las 3 |
| ② | Madrid, `paidAt` 31-mar | 200 | 200 |
| ③ | merchant SIN zona, `paidAt` 1-abr | 400 | 400 (para él aún es 31) |
| ④ | Canarias en INVIERNO, 31-ene 23:30Z, `paidAt` 1-feb | 400 | 400 |
| ④b | Madrid en el mismo instante | 🔴 400 | 200 (allí ya es 1-feb) |
| ⑤ | POSITIVO: sin fecha, ids de dos merchants | 200, marca 3 | 200, marca 3, ninguna ajena |
| ⑥ | Madrid, `paidAt` 2-abr | 400 | 400 (no acepta cualquier fecha) |

⚠️ **El control de Canarias va el 31 de enero, no el 31 de marzo.** Desde el 29 de marzo Canarias
está en UTC+1, así que el 31-mar 23:30Z allí ya es día 1 y el arreglo lo aceptaría: ese control no
probaría nada.

**Mutaciones** sobre `dist/`, restauradas con sha256. Caen las cinco:

| Mutación | Qué cae |
| --- | --- |
| sin zona (lo de antes) | ① ④ |
| `Europe/Madrid` fija | ③ ④ |
| zona de otro merchant | ① ④ |
| aceptar cualquier fecha | ③ ④ ⑥ |
| lote sin filtro de `merchantId` | ① ② ⑤ |

## Un error propio en esta rama, y lo que hizo

Al repetir los rojos de la tanda (que resultaron ser el cliente de Prisma sin regenerar tras el
avance de `main`), construí la lista de ficheros con un `sed` que falló. `node --test` con la lista
**vacía** descubrió ficheros por su cuenta y ejecutó, entre otros, `scripts/wa-test.mjs` (sale con
`exit 1` por falta de plantilla antes de enviar nada) y **`scripts/test-staging-gated.mjs`**. Ese
script cargó `DATABASE_URL_TESTS` del `.env` del checkout compartido, que apunta a `yaqu_dev_javier`.
Después: `npm run turno:estado` dice «Turno LIBRE», no hay nota de turno de esta sesión en `tmp` y
no hay recibo de evidencia de la tanda (el que escribe el runner al acabar), así que no llegó a terminar ningún hijo. **Si hizo el
preflight contra esa base no se puede saber sin volver a ejecutarlo, y no se ha vuelto a ejecutar.**
Queda en la cicatriz de J2, sin comprobación, con el motivo.
