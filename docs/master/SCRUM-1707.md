# SCRUM-1707 · OPERARIO · el rol deja de recibir el DINERO del negocio por la API (servidor; PILOTO-1)

**Medido contra:** `origin/main` = `6cf6a8176b985a1e5f9b39c5a74319665dec91f0` · 2026-11-12T08:22:13Z (el `main` que lleva la rama de SCRUM-1662, sobre cuya punta se apila esta)

**Rama:** `scrum-1707-operario-sin-dinero` · **Carril:** S1 (servidor; la pantalla —tarjeta, columna, filtros, botón— es de S4).

A9: comprobación → `tests/scrum1707-operario-sin-dinero.test.mjs`

## 🔴 Apilada sobre SCRUM-1662 — no se empuja antes que ella

`trabajoParaElRol` nace en la rama de 1662 (todavía sin empujar: espera la 3.ª base de Javier, A5). Esta rama
sale de su punta y **no se empuja hasta que 1662 esté en `main`**: si saliera antes, el PR llevaría el esquema
de 1662 sin su ALTER confirmado y saltaría A5. Cuando 1662 entre: `git merge origin/main` aquí, tanda y push.

## Origen y firma

- **El defecto** (captura del fundador, 11-nov ~19:30, operario de prueba miembro 30): en SU lista de Trabajos,
  «POR COBRAR · 1,21 € en 1 trabajo sin cerrar», la columna IMPORTE y los filtros Pendiente/Parcial/Pagado.
- **FIRMADO** por el fundador (c.21547, literal):
  - Q1 — «Importe de SUS trabajos: ve el importe de los trabajos suyos (igual que ya ve sus presupuestos), pero
    SIN la tarjeta "Por cobrar" ni los filtros de cobro del negocio.»
  - Q2 — «No: se recortan — el servidor recorta los precios del albarán para el rol operario, igual que ya hace
    con el parte.»
- **Alcance** (c.21556, decidido por el orquestador como ejecución): ① `invoices` NO sale para el operario (ve el
  IMPORTE, no su estado de cobro); ② el PDF del albarán queda FUERA del recorte por rol (lo gobierna
  `ocultarPreciosEnDocumento`); Q2 cubre la API JSON.

## Qué cambia

- `src/modules/jobs/domain/trabajoParaElRol.ts` (de 1662) se EXTIENDE. Al operario (`seesOnlyOwnJobs`):
  - **se quedan** `totalAceptado`, `importeReferencia`, `quote.total` — el importe de sus trabajos (Q1);
  - **salen con su valor vacío** (`null`/`0`/`false`/`[]`, la clave se conserva): `totalCobrado`, `estadoCobro`,
    `remaining`, `nextStage`, `pendingStagesCount`, `hasCustomPlan`, `invoices` y, en el detalle, `charge`;
  - los `albaranes` del detalle pasan por `albaranParaElRol` (son la misma API de datos que recorta Q2).
- `src/modules/jobs/domain/albaranParaElRol.ts` (nuevo): líneas y `pendientes` reescritos CAMPO A CAMPO sin
  `precioUnitario`/`tipoIva` (patrón `lineasParaElTecnico` del parte), `totales` e `importePendienteDeFacturar`
  a `null`; `filaDeAlbaranParaElRol` (el `total` del listado) y `grupoPendienteParaElRol` (el `importePotencial`
  de «pendientes de facturar»). `modoValoracion` y `ocultarPreciosEnDocumento` se quedan: dicen cómo es el
  documento, no cuánto vale.
- Rutas — las ocho puertas JSON: `GET /admin/albaranes`, `GET /admin/albaranes/pendientes-facturar`,
  `GET /:id` (el objeto entero, no sólo `serializeAlbaran`), `PATCH /:id`, `POST /:id/emitir` (las dos salidas),
  `POST /:id/duplicar`, `POST /:id/firmar` y `POST /admin/jobs/:id/albaranes`. `serializeAlbaran` no cambia.
- **Escalera del front:** `jobNextAction.js` ya salta los niveles de dinero al técnico (SCRUM-89, `isAdmin`):
  con `invoices: []` no se le pinta CTA de cobrar ni de recordar. Comprobado leyendo el fichero (`:74`, `:86`).

## Lo que NO cambia y se declara

- **El PDF** (`GET /admin/albaranes/:id/pdf`): fuera, por c.21556 ②.
- **La ESCRITURA del albarán por el operario.** `PATCH /:id` con `lineas` en un albarán VALORADO exige precio e
  IVA en todas (`validarLineas`): el operario, que ya no los recibe, si reenvía líneas sin ellos se lleva un 400
  `lineas_invalidas` — falla CERRADO, no borra precios. Y sigue pudiendo ESCRIBIR precios si los manda (el parte
  lo cierra con `adminOnlyParteField`, SCRUM-1078; el albarán no tiene gate por campo). La firma de Q2 habla de
  recortar la lectura; cerrar la escritura es otra decisión → **propuesta de ticket**, no se hace aquí.
- `GET /admin/albaranes/presupuestos` y `/consolidables`: no se tocan (el operario ve sus presupuestos, Q1).

## Medición

- **Rojo primero por rol** (banco desechable `yaqu_1662_test`, antes de cablear las rutas): ① 11 fallos (todas
  las claves de cobro + rol desconocido fail-open), ③ **23 fugas** por las ocho puertas, con TODOS los controles
  del jefe en verde (el jefe sí recibe lo cobrado, el estado de cobro, el total y el precio).
- Tras el cambio: 4 fugas seguían en los dos detalles → `pendientePorLinea` lleva `precioUnitario`/`tipoIva`;
  se añadió `pendienteDeLineaParaElOperario`. Con eso, `scrum1707` 3/3 y `scrum1662` 3/3, 0 saltados.
- `scrum419` declara `scrum1707-operario-sin-dinero.test.mjs: 1`.
