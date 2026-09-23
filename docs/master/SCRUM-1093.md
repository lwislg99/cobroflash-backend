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
