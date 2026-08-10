# SCRUM-363 · «Pagado» deja de ser inalcanzable, y «Parcial» deja de mentir

**Fecha:** 5-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `ee082403e1aa37fad9c2ed485e368c9b147b1760` · 2026-08-05T11:07:40+02:00
**Tanda:** 1563 tests, 1496 pass, 0 fail (el resto, gateados a staging)

## El defecto

```ts
if (a > 0 && c >= a) return 'Pagado';
if (c > 0) return 'Parcial';
```

Con `totalAceptado` **null o 0**, un Trabajo cobrado se quedaba en «Parcial» **para siempre**: el
pro cobraba, el dinero entraba, y el Trabajo seguía diciendo que faltaba. La pestaña «Pagado» no lo
enseñaba nunca, así que **perseguía un pago que ya tenía**. Y nadie veía un error — no hay excepción
ni log: la afirmación falsa era el comportamiento normal.

No es un caso raro: es **el camino nuevo**. En staging ya hay 5 de 8 Trabajos sin presupuesto
(SCRUM-51) y la factura suelta de A0 los multiplica.

## La decisión (fundador), implementada

El importe de referencia se resuelve en este orden: **aceptado > 0**, si no **facturado > 0**, y si
no hay ninguno, **el Trabajo no tiene eje de cobro y no se pinta nada**.

El tercero es el que importa y es el que estaba mal. «Parcial» es una **afirmación sobre el dinero
de alguien**: no pintar nada es verdad, pintar «Parcial» no lo es. El estado pasa a poder valer
`null`, y `null` significa «aquí no se afirma nada», no «no lo sé todavía».

**El facturado sale de las facturas de los presupuestos del Trabajo**, que el serializer ya tenía
resueltas — sin consulta nueva. Se suman todas, incluidas las anuladas: aquí no se decide política
fiscal, solo **si existe un eje contra el que medir**. Afinarlo es otra decisión y queda declarado.

## Los dos casos son DOS, y el segundo es el que se escapa

- `totalAceptado = null` + cobro que lo cubre → ya no se queda en Parcial.
- `totalAceptado = 0` + cobro que lo cubre → **test aparte**. El cero **se cuela por las
  comprobaciones de nulos** (`!= null` lo deja pasar, `??` no lo sustituye) y llega al cálculo
  como un importe legítimo. Un solo test con `null` habría dado verde con el defecto vivo para
  el 0.

**Verificado en rojo:** restaurando el cálculo viejo caen **3 de 9** — el caso NULL, el caso CERO y
el suelo. Cada uno por su mensaje.

## El suelo

Sin importe de referencia **no se devuelve el estado intermedio**. Cubre cinco formas de no
saberlo: sin referencias, ambas a cero, sin cobrar, referencias ausentes, y referencias que no son
números (más negativos e `Infinity`, que tampoco son un eje). **Devolver «Parcial» ante la duda es
exactamente lo que produjo este defecto.**

Con su control opuesto: con eje, los tres estados siguen saliendo — sin él, «devolver `null`
siempre» habría pasado el suelo y roto el semáforo entero.

## Arrastre · las tres superficies ven lo mismo

- **Detalle y listado**: `serializeJobDetail` **delega** en `serializeJob`, así que no pueden
  divergir por construcción; y hay un test que exige que el estado se calcule **una sola vez**.
- **La lista ya no decide por su cuenta.** Gateaba el chip con `aceptado > 0` — un **segundo
  criterio**. En cuanto el eje puede venir de lo facturado, ese criterio y el del backend dejan de
  coincidir: el mismo Trabajo saldría «Pagado» en el detalle y **sin chip** en la lista. Era una
  divergencia que **este arreglo iba a introducir**, así que el backend ahora manda el eje
  (`importeReferencia`) y la interfaz lo obedece.
- **El CSV** hereda el mismo semáforo y, con `null`, imprime **celda vacía** — comprobado, no
  supuesto: la palabra «null» en un fichero que abre el profesional sería el mismo defecto con
  otra cara.

## Lo que NO cubre

- **No se ha visto en un navegador.** Lo verificado es la lógica y sus tres consumidores.
- **Las facturas anuladas suman** para decidir si hay eje. Es deliberado y declarado: la pregunta
  aquí es si existe una cifra contra la que medir, no cuál es el importe fiscalmente correcto.
- **Los Trabajos ya existentes no se recalculan**: el estado es derivado, así que se corrige solo
  en cuanto se vuelven a leer. No hay migración ni backfill.
- **AB6 · matriz de dispositivos: hueco declarado.**

## Ficheros

`src/modules/jobs/domain/job.service.ts` (`importeDeReferencia` + `estadoCobroFor`) ·
`src/modules/jobs/app/routes/jobs.routes.ts` (el facturado y el eje expuesto) ·
`public/dashboard/js/jobsView.js` · `public/dashboard/js/jobDetailView.js` ·
`tests/scrum363-eje-de-cobro.test.mjs` (9).
