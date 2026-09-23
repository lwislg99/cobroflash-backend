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
