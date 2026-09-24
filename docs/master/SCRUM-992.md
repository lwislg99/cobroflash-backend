# SCRUM-992 · Un técnico ve, edita y firma los partes de OTROS técnicos

**Medido contra:** `origin/main` = `f21171a84991c5e2691a356209c96c3e950b3e59` · 2026-09-21T17:02:25Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-992-partes-por-rol` · **Carril:** S1 (servidor) · **Decisión del orquestador:** los tres ejes (leer, editar, firmar) en `findParte` y ningún parte suelto para el técnico, igual que 301/467 con los albaranes y 979/980 con clientes y trabajos.

## Paso 0, medido (corriendo, no leyendo)

Banco: Postgres 16 desechable en loopback (base `*_test`), la app REAL (`dist/app.js`), tres sesiones (técnico A, técnico B como dueño de otros trabajos y el propietario). El test salió **rojo con 27 fugas** contra el código de `f21171a8`, con los CONTROLES en verde (el propietario lo ve todo, el técnico abre y firma lo suyo): el fixture ejercita el camino.

- La lista del técnico A traía los partes de B, los de un trabajo sin dueño y el parte suelto.
- **Leer** (`GET /:id`), **editar** (`PATCH /:id`), **firmar por el cliente** (`/firmar`), **firmar como técnico** (`/firmar-tecnico`) y **dictar** (`/dictado`) sobre un parte ajeno: todos respondían 200 y **escribían** (el parte de B quedaba `firmado` por A).
- `POST /admin/partes` con el `jobId` de B o el de un trabajo sin dueño: 201. Sin `jobId`: 201.

## Lo que cambia

- **`partes.routes.ts` · `findParte`** — la puerta de las siete rutas `/:id`. Con `seesOnlyOwnJobs(rol)` pide el trabajo del parte y le pregunta a `esSuyoElTrabajo` (SCRUM-849, los tres ejes: `operarioId`, `assignedUserId`, tabla de asignados). Un parte **sin trabajo** no es de ningún técnico: `ParteTrabajo` no guarda quién lo abrió. **404**, no 403, como los albaranes. Admin y propietario no pagan ni un viaje más.
- **`GET /admin/partes`** — el técnico recibe solo los partes de sus trabajos. Dos consultas, porque `ParteTrabajo.jobId` es una columna suelta sin relación con `Job`.
- **`POST /admin/partes`** — el técnico no abre un parte colgado del trabajo de otro (404 `job_not_found`) ni un parte sin trabajo (400 `job_required`).
- **`accesoAlTrabajo.ts` · `whereSuyoElTrabajo(teamMemberId)`** — los mismos tres ejes para LISTAR. Sin identidad casa **nada** (`{ operarioId: null }` serían «los trabajos sin operario», de cualquiera).

**Sin texto nuevo para el usuario:** `job_required` es solo un código (sin `message`); la pantalla nunca lo puede provocar (ver abajo) y, si lo recibiera, su `catch` ya pinta su propio aviso.

## Lo que se midió aparte: ¿la pantalla de hoy crea partes sin trabajo?

**No.** Un solo llamador (`jobDetailView.js`, el botón «Parte de trabajo») hace `POST /admin/partes` y manda **siempre** `{ jobId: job.id }`; ningún otro fichero de `public/`, `src/` ni `scripts/` crea partes (`parteTrabajo.create` solo está en la ruta). O sea que exigir `jobId` al técnico **no rompe ninguna pantalla** y solo cierra la llamada directa a la API: sin él, el parte que creara ya no podría volver a abrirlo. El propietario y el admin siguen pudiendo abrirlo suelto, como hasta hoy.

Además, ese botón filtra `GET /admin/partes` por `jobId` en el cliente: recortar en el servidor no cambia lo que ve. (Y una firma en cola cuyo parte deja de ser suyo —la obra se reasignó— recibe 404, que `colaDeFirmas.js` ya trata como error permanente «otra cuenta abierta en el mismo móvil»: no se queda dando vueltas.)

## El juez: `tests/scrum992-partes-recortan-por-rol.test.mjs`

Dos mitades. **Cinco tests sin banco** (corren en cada `npm test`): la población (las 9 rutas de `partes.routes.ts`, con suelo), `findParte` mira el rol y la pertenencia, la lista y el detalle miran los MISMOS ejes (derivados por AST del cuerpo de `esSuyoElTrabajo` y de `whereSuyoElTrabajo`, sin constante intermedia), `whereSuyoElTrabajo` sin identidad y una red que suspende cualquier ruta nueva de partes que no sea de admin y no pase por `findParte` o lea la tabla sin mirar el rol. **Un test con banco** (`LIBRO_PG_URL` o `QA_DB_TEST=1`), declarado en `GATEADOS_DECLARADOS` de 419: las nueve rutas por HTTP con los tres ejes, un parte de B, uno de nadie y uno suelto; las fugas son aserciones blandas para que un rojo las enseñe todas a la vez.

**Medido: 6 pass · 0 fail** con banco; sin banco, 5 pass · 1 skipped.

### Mutaciones (BASE en verde antes y después, árbol limpio tras cada `git restore --source=HEAD`, `npm run build` entre una y otra)

| mutación | cae con |
|---|---|
| M1 · `findParte` sin recorte (compila) | el del banco (las fugas de leer/editar/firmar) |
| M2 · `GET /` sin `where.jobId` | el del banco |
| M3 · `POST` sin comprobar el dueño del trabajo | el del banco |
| M4 · `POST` sin `job_required` | el del banco |
| M5 · `whereSuyoElTrabajo` sin el tercer eje | **tres**: lista≡detalle por AST, el unitario y el del banco |
| M6 · `findParte` deja pasar el parte suelto | el del banco |
| M7 · `whereSuyoElTrabajo` sin identidad devuelve `{ operarioId: null }` | el unitario |
| M8 · ruta nueva que lee `parteTrabajo` sin rol | **dos**: la población (10 ≠ 9) y la red |

**Límite honesto de la mitad sin banco:** M1 y M4 solo las caza el test con banco. La red estructural ve que `findParte` *nombra* `seesOnlyOwnJobs`, no que la condición valga algo; una condición neutralizada (`&& rol === 'zzz'`) la caza el comportamiento, no el AST. Por eso el gate del banco importa.

## Tests de otros tickets, tocados con su motivo

- **419** (`GATEADOS_DECLARADOS`): el gateado nuevo, con su porqué.
- **889b** (líneas del parte que no mueven su precio): su fixture doblado hacía abrir un parte **suelto** a una petición de `tecnico`, que es justo lo que esta decisión cierra. El fixture cuelga el parte de un trabajo cuyo operario es el técnico que llama (`job.findFirst` doblado + `teamMemberId`). **No cambia ninguna aserción.**

## Hallazgo, sin arreglar (otro carril de decisión): el técnico puede ESCRIBIR precios en su parte

Sonda de un solo uso (no versionada), banco desechable: un técnico hace `PATCH /admin/partes/:id` con `{ precios: [{ indice: 0, precioUnitario: 45, tipoIva: 0.21 }] }` sobre **su propio** parte en borrador → **200, y el precio queda en la fila**. La respuesta no lo trae (el serializador del técnico no lleva importes), pero `permisoDeCampos` es solo por ESTADO, no por rol: la cabecera del fichero dice que el jefe pone los importes en la oficina, y esa puerta no está cerrada para escribir. La pantalla nunca lo manda (la vista del técnico no tiene campo de precio), así que la víctima de hoy es solo quien llame a la API. Propuesta si el orquestador lo quiere: `precios` reservado a `seesAllJobs`, igual que los campos de dinero de SCRUM-164 (`adminOnlyJobField`), rechazando la petición ENTERA.

## Lo que NO se ha hecho

- **Suite completa**: pendiente del turno del orquestador. Dirigidos: 26 ficheros, 240 tests, 238 pass · 0 fail · 2 skipped (los gateados sin banco), y los gateados relacionados con banco (992, 980, 979, 52): 15/15.
- **Verificación en `yaqu.app`**: al desplegar. No hay clientes reales; la comprobación es con el merchant demo (`demo@yaqu.app`) y un técnico.

## Errores propios

1. Las dos primeras mutaciones (M1 y M7) NO llegaron ni a compilar (`if (false)` deja el código muerto tipado): eso es un rojo del compilador, no del guard (A23 #12). Se rehicieron con una condición que compila y volvieron a caer por el guard.
2. El filtro de mi propio ejecutor no imprimía las líneas `✔`/`✖` (el `.ps1` sin BOM rompe los glifos): leí el resultado desde el fichero. Un instrumento que no dice nada no es un verde.
3. El primer test tenía aserciones duras: un rojo enseñaba UNA fuga, no las 27. Se cambió a blandas antes de dar el rojo por medido.
