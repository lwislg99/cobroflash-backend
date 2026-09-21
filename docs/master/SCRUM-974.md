# SCRUM-974 · El dinero firmado y sin facturar, en el correo del lunes

**Medido contra:** `origin/main` = `f88afc1c0e2b0222211fa3cf4060b8fb0328a24f` · 2026-09-21T07:41:12Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-974-firmado-sin-facturar`
**Microcopy:** `docs/microcopy/2026-09-21-SCRUM-974-firmado-sin-facturar.md` (firma delegada, SCRUM-974 comentario 16056).

## Paso 0: el defecto existía hoy

`sendDigestForMerchant` consultaba seis cosas (cobrado, facturas emitidas, presupuestos aceptados y
enviados, clientes nuevos, pendiente de cobro) y ningún albarán. El test nuevo salió **rojo** contra
el código de `f88afc1c`: `A · con la facturación encendida, el resumen NO nombra lo firmado y sin facturar`.

## Lo que cambia (un fichero de `src/`)

`weeklyDigest.service.ts` · `bloqueFirmadoSinFacturar`, debajo de «Pendiente de cobro»:

- **Definición:** la de la bandeja del panel, `getPendientesFacturar`, **sin tocarla** (parte firmado +
  valorado + sin factura, fuera `TRABAJO_UNICO`). El importe es su `importePotencial.total`, con IVA,
  sumado en céntimos.
- **Solo con la facturación encendida** (decisión del orquestador, regla 7): la puerta es
  `getEmissionMode(merchant) !== 'receipt'`, la misma que decide el botón «Nueva factura»
  (`facturaSuelta.ts`). **Se lee, no se toca.** No es `isFlagEnabled('INVOICING_ES_ENABLED')` a
  secas porque ese flag es solo de España: un negocio de otro país (que factura siempre) se habría
  quedado sin el bloque, y el demo también.
- **Importe 0 → no sale.**
- **Best-effort:** si la bandeja falla, el resumen sale igual, sin el bloque.

## El juez: `tests/scrum974-firmado-sin-facturar-en-el-lunes.test.mjs`

Corre el resumen DE VERDAD (`sendWeeklyDigests`) y lee el HTML en `axios.post` (sustituido: no sale
nada). Solo sobre el banco desechable (`LIBRO_PG_URL`), no sobre staging, porque el resumen recorre
todos los merchants activos de la base. Medido contra un Postgres 16 propio: **1 pass · 0 fail · 0 skipped**.

| caso | resultado |
|---|---|
| A · encendida, 3 partes de 2 clientes | sale, «363,00 EUR», «3 partes firmados de 2 clientes» |
| B · **mismo importe**, apagada | no sale ni el bloque ni el importe |
| C · encendida, nada pendiente | no sale |
| D · 1 parte de 1 cliente | «121,00 EUR», «1 parte firmado de 1 cliente» |
| suelo | se capturó el resumen de los cuatro |

Mutaciones sobre el `dist`, con la base en verde antes y después:

| mutación | cae con |
|---|---|
| M1 · sin la puerta del modo de emisión | B «con la facturación APAGADA el resumen empuja a facturar» |
| M2 · sin el «importe 0 no sale» | C «sin nada pendiente sale el bloque» |
| M3 · el singular nunca se elige | D «el singular de verdad» |

⚠️ **Trampa medida al escribir el test:** `Job.tipoOperacion` nace `TRABAJO_UNICO`, que la bandeja
excluye. Con el valor por defecto, el primer rojo salía **igual con el arreglo puesto**: no
distinguía el defecto del montaje. Se repitió con `OPERACIONES_SUELTAS` y el rojo se volvió a medir
contra el código de main antes de darlo por bueno.

## Hueco declarado

El orquestador pidió dejar «{n} factura(s) sin cobrar» como hueco declarado si salía en el mismo
correo. **No hace falta:** ese detalle ya se escribe con plural real (`factura${n !== 1 ? 's' : ''}`).

**No medido:** el correo en un cliente de correo real, y la vista previa `getDigestPreview`, que no
lleva este bloque (devuelve cifras, no HTML).
