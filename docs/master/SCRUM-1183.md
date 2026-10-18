# SCRUM-1183 · «Trabajos CSV» en Informes (y la supervisión por operario, que está sustituida)

**Medido contra:** `origin/main` = `73e41ab00f727fae5c6c8f1715d6eb6749133502` · 2026-10-15T16:16:04Z (`Date:` de GitHub)
**Skill UI:** cargada · `yaqu-premium-ui`: es la quinta fila de una lista que ya existe (`makeExportBtn`, `.btn-secondary.btn-sm`); ni clase, ni estilo, ni componente nuevos.
A9: sin fallo que generalice — el único tropiezo lo cazó el propio control de ceguera del test (`load()` no llega al año sin un P&L con forma real) antes de ningún verde.

Carril S2 · árbol `s2-1183` · rama `scrum-1183-trabajos-csv`.

## Las dos piezas del ticket

| pieza | estado | por qué |
|---|---|---|
| `GET /admin/metrics/operarios` | **NO se construye** | SUSTITUIDA por el hub de Equipo (SCRUM-136, `getTeamOverview`), medido por S1 en c.17343 y aceptado en c.19799. Se queda en `declaradas` del censo, ahora con su motivo; la fija `tests/scrum24-operarios-metrics` |
| `GET /admin/exports/jobs.csv` | **construido aquí** | existía desde SCRUM-25 y sólo salía dentro del paquete de «Descargar datos» |

## Qué cambia (sólo front, sin servidor y sin ALTER)

- `public/dashboard/js/reportsView.js`: «⬇ Trabajos CSV» entre «Presupuestos CSV» y «Clientes CSV», con el año del
  selector (`?from=AÑO-01-01&to=AÑO-12-31`), en el mismo sitio donde lo reciben sus hermanos.
- **Por qué vale el mismo año:** `jobs.csv` y `quotes.csv` filtran los dos por `createdAt` con `from`/`to`
  (`exports.routes.ts:666` y `:711`). Medido ANTES de pedir la firma.
- `scripts/_sin-consumir-declarados.json`: `ruta · GET /admin/exports/jobs.csv` pasa a `retiradas`.
- Texto: «Trabajos CSV», firmado por el ORQUESTADOR, no por el fundador (c.19799). Ficha:
  `docs/microcopy/2026-10-15-SCRUM-1183-trabajos-csv.md`.

## Verificado, ejecutando

- `tests/scrum1183-trabajos-csv.test.mjs`: **4 de 4**. Monta Informes en el banco: el botón (uno, con su rótulo y
  su ruta), el MISMO rango de año que «Presupuestos CSV» (con control de ceguera: si «Presupuestos CSV» aún no
  tiene año, el test dice CIEGO, no verde), el filtro por `createdAt` de las dos rutas, y la ficha de la firma.
- **Control por mutación**, con la base en verde: sin la línea del año cae SU caso; sin colgar el botón caen los dos
  de pantalla.

## SCRUM-1183b · en yaqu.app: el botón y la descarga, bien; el año NO es la misma fecha, y lo dije mal

**Medido contra:** `origin/main` = `48fc00f6a90089b0f172b58c49413d889288bec0` · 2026-10-16T11:13:30Z (`Date:` de GitHub) · producción en ese mismo SHA (`/version`).
A9: comprobación → `tests/scrum1183-trabajos-csv.test.mjs`

Carril S2 · árbol `s2-16oct` · rama `scrum-1183b-el-anio-es-la-fecha-prevista`.

**🔴 Lo de arriba que es FALSO** (no se borra; se corrige aquí): «`jobs.csv` y `quotes.csv` filtran los dos por
`createdAt`… Medido ANTES de pedir la firma» y «el filtro por `createdAt` de las dos rutas». Lo que se «midió» fue el
`where` que `exports.routes.ts` construye en cada ruta (`:674` jobs, `:719` quotes) y **no pasa a nadie**: el filtro
que corre está en `exportData.ts`, `buildTrabajos` → `whereRango(…, CAMPO_FECHA_TRABAJOS)` = **`scheduledAt`**, la
fecha de ejecución PREVISTA (decisión de SCRUM-106), y `buildPresupuestos` → `createdAt`. El orquestador firmó el
rótulo apoyándose en esa frase mía (c.19799).

**Visto en yaqu.app** con la cuenta QA (sonda de sólo lectura `sondas-s2/informes-csv-de-verdad.mjs`, fuera del repo;
corta todo lo que no sea GET, con control positivo; 0 escrituras), rol admin:

| aceptación | dónde se ve | resultado |
|---|---|---|
| el botón, al lado de los otros cuatro | Informes en yaqu.app | ✅ fila «Facturas · Gastos · Presupuestos · **Trabajos** · Clientes», visible (118×30 px) |
| descarga de verdad | clic en «⬇ Trabajos CSV» | ✅ evento de descarga, `trabajos_2026-10-16.csv`, CSV con su cabecera |
| lleva el año, igual que `quotes.csv` | href tras pintar y tras cambiar a 2025 | ✅ `?from=2026-01-01&to=2026-12-31` y luego `2025`, los dos botones a la par |
| el filtro por año funciona | `jobs.csv` sin filtro / por año | 🔴 **2 filas sin filtro; 0 en 2022, 2023, 2024, 2025, 2026 y en 2001**. Control: `quotes.csv` 2026 = 6, 2001 = 0 |

Los dos trabajos de la cuenta (#77, alta 2026-10-14; #76, alta 2026-09-29) están `pendiente_agendar`, sin fecha
prevista. **Efecto, dicho sin adornos: hoy, en Informes y con 2026 puesto, «Trabajos CSV» baja un fichero VACÍO
aunque el profesional tenga trabajos, si no están agendados.** El paquete de «Descargar datos» lo explica en su LEEME
(`CRITERIO_TRABAJOS`); el botón suelto de Informes, no.

- **NO medido:** el positivo (un trabajo agendado que SÍ sale en su año). Agendar es escribir en el fixture de S3 de
  la cuenta QA; no lo he intentado, por orden del orquestador.
- **Decisión** (orquestador, 16-oct, mensaje a S2): se corrige el comentario y el test (esta rama). Qué hace el
  botón —(b) bajar sin año, o (c) decirlo en pantalla, que pide firma— **va a la puerta de go-live, SCRUM-1554**, y
  no se construye.
- **Código muerto, de back, NO tocado:** el `where` de `exports.routes.ts:674` (jobs) y `:719` (quotes) se construye y
  no se usa. Nombrado para que lo reparta el orquestador; borrarlo a ciegas no es de este carril.
- **El motivo de `ruta · GET /admin/exports/jobs.csv`** en `scripts/_sin-consumir-declarados.json` repetía «las dos
  filtran por createdAt». Se esperó a que #2449 (1273), que añade la línea vecina, entrara en `main` (11:23:03Z,
  `7e53b1474`); después se trajo `main` a esta rama y se corrigió.

### Qué cambia

- `public/dashboard/js/reportsView.js`: sólo el comentario (dice ahora qué fecha filtra cada uno). Cero cambio de pantalla.
- `tests/scrum1183-trabajos-csv.test.mjs`: el caso que leía el `where` muerto se sustituye por uno que lee el campo
  que de verdad se pasa a `whereRango` en `exportData.ts`, sin comentarios, y resuelve la constante a su literal.

### Verificado, ejecutando

- Base: **4 de 4** (con `dist` compilado; sin él caen los dos de pantalla por `Cannot find module`, que es el
  worktree, no el test).
- **Rojo primero, por mutación** de `CAMPO_FECHA_TRABAJOS` a `'createdAt'`: el caso nuevo CAE (3 de 4).
- **El instrumento viejo, contra lo mismo:** el test de `origin/main` da 4 de 4 hoy, con el producto filtrando por
  `scheduledAt`, y 4 de 4 con el mutante. Verde en los dos sentidos: no medía el filtro.

## SCRUM-1183d · los tres `where` muertos de `exports.routes.ts`, quitados

**Medido contra:** `origin/main` = `78a1af2506c053c460eeca9b458026060cf83829` · 2026-10-17T19:37:19Z
A9: sin fallo que generalice — la sonda de `evidencias/SCRUM-1183/` se niega a correr sobre el código limpio (su
ancla sale 0 y se declara CIEGA), que es lo que debe hacer; para medir el «después» se usó una copia fuera del árbol.

Carril S1 · árbol `s1-1183d` · rama `scrum-1183d-quita-tres-where-muertos`. Reparto del orquestador (17-oct), tras
entrar #2508 (1183b) el 16-oct a las 12:57:32Z.

### Re-medido ANTES de quitar nada (la medida de 1183c tenía 30 h y 88 commits encima)

`sonda-where.cjs` y `compara-where.mjs` de `evidencias/SCRUM-1183/`, sin tocar, sobre `dist/` compilado de este `main`:

- `base` frente a `mutante` (los tres bloques borrados en memoria; ancla = 3): **9 de 9 idénticas**. Siguen muertos.
- `base` frente a `control`: **3 distintas** (las tres con `status`). La sonda sigue viendo lo que importa.

### Qué cambia

- `src/modules/exports/app/routes/exports.routes.ts`: fuera los tres `const where …` de `charges.csv`, `jobs.csv` y
  `quotes.csv` (eran `:645-651`, `:671-677` y `:716-722`). 24 líneas borradas, ninguna añadida. El filtro que corre
  —`buildCobros` / `buildTrabajos` / `buildPresupuestos` con `whereRango`, en `exportData.ts`— no se toca.
- Con esto desaparece también el `createdAt` que mentía en `jobs.csv` (a `prisma.job` le llega `scheduledAt`).

### Verificado, ejecutando

- **Después frente a antes:** la misma batería de 9 peticiones sobre el `dist` ya limpio, comparada con el `base` de
  arriba (que aún llevaba los `where`): **9 de 9 idénticas** — el CSV y el `where` que llega a Prisma.
- **Control positivo sobre el código limpio:** **3 distintas**. La copia de la sonda ve diferencias en este código.
  La copia sólo cambia una cosa: no exige el ancla en `base`/`control` (no existe ya). El fichero de evidencias, intacto.
- 18 ficheros de `tests/` (los 17 que leen `exports.routes` + `scrum25-exports`): **128 pasan, 0 fallan, 2 saltados**
  con motivo declarado (`SCRUM-25` y `SCRUM-82`, «sin QA_DB_TEST=1»). Por eso la equivalencia la da la sonda, no ellos.
- `tsc`: sólo el error conocido de `merchantAdmin.ts:147` (cliente de Prisma viejo; sin `prisma generate`).
