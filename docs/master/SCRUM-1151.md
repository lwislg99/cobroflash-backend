# SCRUM-1151 · resumen-trimestre trae el conteo de la nota firmada y los avisos del libro de recibidas

**Medido contra:** `origin/main` = `c62df27e5707eeff188a24d1cf030e30ede3f4b4` · 2026-09-26T12:54:40Z

**Sesión 1 · 26-sep-2026 · rama `scrum-1151-conteo-no-deducible`**

## El defecto

`GET /admin/reports/resumen-trimestre` (SCRUM-1048/1147) no traía el conteo que necesita la nota
firmada del Resumen del trimestre («N gastos… no los has marcado como IVA deducible…», SCRUM-1049)
ni los avisos del libro de recibidas. Mientras siga así, `reportsView.js` sigue llamando a
`GET /admin/libros/recibidas.json` SOLO para esos dos datos — un origen de más, sin ninguna cifra
de IVA en juego.

## Por qué no vale derivarlo de lo que ya devuelve el resumen

`resumen.ivaSoportado.noDeducible.count + resumen.ivaSoportado.sinClasificar.count` **NO** es ese
número: medido por SCRUM-1147 con 2000 lotes aleatorios de gastos por los dos caminos, difiere en
**1718 de 2000**. La causa: `sinClasificar` de `calcularIvaSoportado` también cuenta gastos CON
base pero SIN `vatRate`/`vatAmount` — casos que el libro de recibidas (`construirLibroRecibidas`,
que solo exige `baseAmount`) sigue contando como un asiento normal, con su `deducible` tal cual
esté. Cablear la nota a la suma equivocada le habría cambiado el significado a un texto firmado
sin que nadie lo notara (regla 39).

## Hecho

En `reports.routes.ts`, dentro del mismo handler de `/resumen-trimestre` y para el MISMO periodo
(`rangoTrimestre`, ya usado por el repercutido):

- `leerLibroRecibidas(prisma, {merchantId, desde, hasta})` (solo lectura, reutilizada de
  `invoicing/domain/libroRecibidas.repo` — regla 38, no se modifica ese fichero).
- `gastosNoDeducibleDeclarados = libro.asientos.filter(a => a.deducible !== true).length` — el
  MISMO criterio que pinta hoy `recibidas.json` sobre sus filas (`deducible !== 'Sí'`).
- `avisosLibroRecibidas = avisosLibroRecibidas(libro).slice(1)` (reutilizada de
  `fiscal/librosAeat/librosAeat` — regla 38, no se modifica ese fichero), sin el aviso de formato
  provisional en la posición 0 (ya lo sabe la pantalla, no hace falta repetirlo).

Los dos campos son **aditivos**: no se toca ni un campo de los que el endpoint ya devolvía.

## No toca

`src/modules/invoicing/**` ni `src/modules/fiscal/**` — se importan y llaman sus funciones
exportadas de solo lectura, ni una línea editada ahí. No retira `GET /admin/libros/recibidas.json`
de `reportsView.js`: eso es de **S2**, en su propio ticket, una vez el campo esté disponible.

## Verificación

`tests/scrum1151-conteo-no-deducible.test.mjs` (3/3 verde), handler REAL con `prisma` SUSTITUIDO
(patrón de `scrum1057-duplicados-antes-de-id`, sin red ni base):

1. Con un fixture de 6 gastos (2 deducibles, 2 marcados «No», 1 sin marcar, 1 sin base),
   `gastosNoDeducibleDeclarados` coincide EXACTAMENTE con
   `filasLibroRecibidas(...).filter(f => f.deducible !== 'Sí').length` (3), y es DISTINTO de
   `noDeducible.count + sinClasificar.count` — el control negativo que el propio ticket exige.
2. `avisosLibroRecibidas` en la respuesta ya sale sin el aviso de formato y con el del gasto sin
   base.
3. Control negativo: sin ningún gasto sin marcar, el conteo es `0` (no `undefined`/ausente) y los
   avisos, `[]`.

Regresión: `scrum1048/1049/1075/1147` (27/27 verde) y `guards:entrada` (112/112) sin tocar.
`scrum389` (banco desechable) sigue sin base local — se skip, lo corre el CI.
