# SCRUM-576 · CONT-03: asociar persona ↔ empresa — la columna en dev, la clave ajena en ninguna

**Fecha:** 7-sep-2026 · **actualizado el 8-sep-2026** (microcopy firmada + migración en dev)
**Carril:** producto · **Gate:** aprobado por el fundador el 24-ago-2026
**Medido contra:** `origin/main` = `d271d29aff85ed155d23397b7e6a1fca64a86bb0` · 2026-09-08T00:00:00+02:00
**Tanda:** 5919 tests, 5817 pass, **0 fail**, 102 skipped — `npm test`, exit **0** (comprobado por
código de salida, no por `| tail`). Re-corrida entera tras la firma de la microcopy y la migración
en dev: **mismas cifras**.

> ⚠️ Esa fecha es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Lo entregado:** la OBLIGACIÓN 0 verificada, el campo «Empresa» en el lado Persona de los **dos**
formularios, la validación en servidor, y el control que decide en verde — enseñando el antes ciego
y el después.

**8-sep-2026 · segunda pasada:** los dos rótulos **firmados** por el fundador y aplicados byte a
byte (el censo de ranuras baja **6 → 4**, medido con el lector oficial), y la migración **aplicada
en dev** — columna e índice, **26 → 27** columnas. 🔴 **La clave ajena no entró: la rechaza el
aplicador**, y hay que aplicarla a mano en las tres bases.

---

## El defecto

El profesional no puede representar que una persona pertenece a una empresa: el administrador de
fincas y la comunidad de propietarios, el que firma el presupuesto y el que paga, el encargado de
obra y la constructora.

«Razón social (empresa, opcional)» es **texto libre**: dos clientes de la misma empresa la escriben
distinto —«Fincas García SL» y «FINCAS GARCIA, S.L.»— y el sistema no sabe que son la misma.

## OBLIGACIÓN 0 · CONT-01 está en el árbol

Verificado antes de apoyarse en ello, no supuesto:

| Qué | Dónde | Estado |
|---|---|---|
| `contactKind String? @map("contact_kind")` | `prisma/schema.prisma` | ✅ presente |
| El componente del switch | `public/dashboard/js/switchFormaJuridica.js` | ✅ presente |
| Su suite | `tests/scrum574-switch-forma-juridica.test.mjs` | ✅ 12 verdes |
| El merge | PR #861 (`2363343b`) | ✅ en `main` |
| La columna en la base | `contact_kind` en `acela/yaqu_dev_javier` | ✅ leída en `information_schema` |

## 🔴 LO QUE HAY QUE HACER ANTES DE MERGEAR

> ## NO MERGEABLE HASTA APLICAR `customers.company_id` EN LAS TRES BASES

`src/core/db/schemaDrift.ts` compara **esperado ⊆ real** en tablas y columnas y **para el
arranque** cuando el esquema nombra una columna que la base no tiene. `prisma/schema.prisma` ya
nombra `companyId`. Mergear antes de aplicar es reproducir SCRUM-574 — **nueve días de yaqu.app
sirviendo el código del PR #862**.

- **El SQL:** `docs/sql/scrum-576-customers-company-id.sql`
- **El registro por base:** `docs/MIGRATIONS_PENDING.md`
- **8-sep-2026 · dev:** columna e índice **aplicados** (26 → 27 columnas, medido antes y después
  con control positivo). **Staging y producción, sin tocar.**
- 🔴 **La clave ajena no está en NINGUNA base, dev incluida:** `aplicar-sql-dev.mjs` la rechaza —su
  lista blanca sólo admite `ADD COLUMN`, `CREATE INDEX` y `CREATE TABLE`— y es fail-closed. **Se
  aplica a mano en las tres.** No se tocó ninguna lista blanca para que pasara (regla 37).

**El orden correcto lo dejó escrito SCRUM-588:** la columna primero, la línea del schema después.
Aquí la línea va delante porque el ticket entero es media función sin ella — decisión del fundador
del 7-sep-2026, al descartar trocearlo en dos PR («un selector que no vincula a nadie… el riesgo se
gestiona con ORDEN, no troceando el ticket»). Por eso el aviso va en mayúsculas y en primera línea.

## La decisión de diseño: auto-relación, no tabla nueva

Una empresa **ya es un contacto** (`contactKind = 'EMPRESA'`, SCRUM-574) con su teléfono, su NIF y
su dirección. Una tabla `companies` aparte obligaría a mantener los mismos campos en dos sitios —
que es justo el defecto que este ticket viene a cerrar.

**La dirección es la de Holded y no es capricho:** la relación se declara desde el lado PERSONA. La
ficha de persona tiene «Empresa»; la de empresa **no** tiene «personas». Un solo sitio donde se
escribe el vínculo; con dos, uno podría contradecir al otro y nada diría cuál manda.

`onDelete: SetNull` y no `Cascade`: borrar la empresa **no** puede llevarse por delante a las
personas. Pierden el vínculo —que es un dato— y siguen existiendo, con sus presupuestos y facturas.

## El punto fino: «Razón social» NO se borra y NO se migra

Convivir es correcto; migrar a ciegas texto que alguien escribió es cómo se pierden datos.

| base | clientes | con razón social escrita |
|---|---|---|
| **desarrollo** · `acela/yaqu_dev_javier` (7-sep-2026, sólo lectura) | 14 | **0** |
| producción · `autorack/railway` | — | **no medible desde un árbol de trabajo** (regla 3) |
| staging · `acela/railway` | — | no medida: prohibida por el encargo, y SCRUM-668 la declara **contaminada** como fuente de cifra |

**Con 0 de 14 en dev no hay nada que migrar ahí.** El número que decide es el de **producción**, y
**no lo decido yo**: si sale > 0, es un ticket de migración aparte.

De paso, el reparto de `contact_kind` en dev: **1 PERSONA · 1 EMPRESA · 12 sin declarar**. Ese 12
es el motivo de que el servidor **no** exija que la empresa apuntada sea `contactKind = 'EMPRESA'`
(rechazar lo no declarado convertiría un campo opcional en un muro, y deducirlo de otra cosa está
prohibido por el fundador desde el 24-ago-2026). Donde sí cabe la preferencia es en el
**formulario**, que sólo ofrece las declaradas empresa.

## La verificación

| Control | Qué exige | Rojo probado rompiendo |
|---|---|---|
| 🔴 **EL CONTROL QUE DECIDE** | dos fichas montadas por separado eligen la misma empresa y mandan **el mismo entero** | el desplegable manda `c.name` en vez de `c.id` → **cae** |
| 🔴 **EL ANTES** | dos personas con razón social escrita **no** son dos empresas elegibles: el sistema está ciego | `empresasElegibles` deduce de `legalName` → **cae** |
| ✅ **POSITIVO** | sin empresa lee `null`; Zod acepta el alta sin el campo; `undefined ≠ null` en la edición parcial | el campo desaparece de la ficha → **cae** |
| ✅ **NEGATIVO** | en el lado EMPRESA el campo se esconde, en la regla **y en el DOM** | `SOLO_PERSONA` vacío → **caen los dos** |
| 🔴 **SUELO** | si no encuentra fichas de persona, **falla declarándose ciego** | quitar el `appendChild` del campo → **cae** |
| **Quinto eslabón** | el `select` del servidor devuelve `companyId` y **no** la relación | comentar `companyId: true` → **cae** |

**Lo que estos controles NO prueban, declarado:** la escritura en Postgres. Este entorno no tiene
Postgres desechable (`psql` y `docker`, ausentes) y la suite no toca ninguna base. Lo que la base
garantiza —que ese entero apunte a una fila que existe— lo declara la **clave ajena**, y el test
comprueba que la MIGRACIÓN la lleva, no que esté aplicada. **A 8-sep-2026 no lo está en ninguna
base**, así que esa garantía todavía no rige en ningún sitio.

## Los dos rojos que encontró la propia verificación

**① El guard de SCRUM-574 tumbó la primera versión de la regla.** Al generalizar `debeEsconder`
metí un `ladoDelCampo || 'EMPRESA'`, y ese guard prohíbe el patrón en los tres ficheros del switch
porque una caída por defecto convierte «sin declarar» en una declaración. Aquí el default era
inofensivo —era el de un parámetro, no el del contacto— pero **eso no lo hace distinguible en el
diff**. Se quitó el default; **no se tocó el guard**. La salida es mejor código: una función general
`debeEsconderDelLado(ladoDeclarado, ladoDelCampo, tieneValor)` con los tres argumentos obligatorios,
y `debeEsconder` conservada como el caso particular de SCRUM-574 con su contrato intacto.

**② El banco de vistas tumbó la segunda.** `poblarEmpresas` leía `ultimoLote` para ahorrarse una
petición: `ReferenceError: ultimoLote is not defined`. Ese identificador vive en el ámbito de
`renderCustomersView`, y el formulario es la superficie compartida que SCRUM-591 sacó fuera para
que un documento también pudiera abrirlo. **No era una optimización: reventaba el modal al
abrirlo.** Ahora se pide la lista siempre, que además es lo único correcto en los dos caminos.

## ✅ MICROCOPY — firmada el 7-sep-2026 por la noche

| Dónde | Texto aprobado |
|---|---|
| El rótulo del campo, en el lado Persona | **«Empresa»** |
| La primera opción del desplegable | **«Sin empresa»** |

Aplicados byte a byte; salen ya **sin marca**. Entraron marcados el día que nació el campo y
estuvieron marcados hasta que se firmaron: eso es el mecanismo funcionando, no un provisional que
se quedó.

### 🔴 EL CENSO BAJA A 4, NO A 0 — y la premisa de que «los seis se apagan» era falsa

El encargo decía que los **seis** marcadores se apagaban de golpe. **Medido con el lector oficial**
(`ranurasDelPanel` de `tests/_ranuras-con-marcador.mjs`), no supuesto:

| | ranuras | líneas |
|---|---|---|
| antes | **6** | 64, 88, 117, 280, 299, 341 |
| después | **4** | 64, 88, 117, 343 |

Se apagan **dos**, que son exactamente las dos firmadas. Las cuatro que quedan **no son mías y no
están firmadas**: la pregunta «Este contacto es» (64), las dos etiquetas del switch (88) —las tres
de SCRUM-574— y las dos posiciones donde `MARCADOR` se expone (117 y 343). El propio encargo lo
corregía al pedir «6 → 4», que es lo que sale.

Por eso la entrada del censo **se actualiza a 4 y NO se borra**: borrarla (precedente
SCRUM-424/405) diría «este fichero ya no tiene nada que vigilar», y es falso. El censo de SCRUM-402
**sigue en 1**, y tampoco se movió al añadir las ranuras: cuenta literales por AST, y el único
literal aquí es la declaración de `MARCADOR`. Ése es justo el hueco que el contador de SCRUM-755
existe para tapar.

## Lo que se anotó y NO se arregló (regla 37)

`scripts/_clasificador-sql.mjs` rotula un `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY` como
**«ADD COLUMN ×1»**. El **veredicto** es correcto —es aditivo y no toca datos— pero el rótulo es
falso: la regla casa por `^ADD\s+(COLUMN\s+)?` y un `ADD CONSTRAINT` empieza por `ADD`. Tocar la
lista blanca de lo que puede correr contra producción no es un arreglo «de paso». Anotado en
`docs/MIGRATIONS_PENDING.md`.

## Ficheros

| Fichero | Qué |
|---|---|
| `prisma/schema.prisma` | `companyId` + la relación y su índice — ⛔ **sin aplicar** |
| `docs/sql/scrum-576-customers-company-id.sql` | la migración, generada por la herramienta |
| `docs/MIGRATIONS_PENDING.md` | el registro con las tres bases sin marcar |
| `docs/sql/deriva-prod.sql` | regenerado (`generar-sql-deriva.mjs`): 426 → **427** columnas |
| `src/core/validation/schemas.ts` | `companyId` en Zod — forma, no existencia |
| `src/modules/system/customerAdmin.ts` | el `select`, `examinarVinculoDeEmpresa` (pura) y `exigirEmpresaValida` |
| `src/modules/system/app/routes/customersAdmin.routes.ts` | 400 y no 500 para un vínculo que no se sostiene |
| `public/dashboard/js/switchFormaJuridica.js` | `SOLO_PERSONA`, la regla general, `empresasElegibles`, `selectorDeEmpresa` |
| `public/dashboard/js/customersView.js` · `customerDetailView.js` | el campo en los **dos** formularios |
| `tests/scrum576-persona-vinculada-a-empresa.test.mjs` | 10 controles |
| `tests/scrum755-el-contador-que-cuadro-solo.test.mjs` | censo 4 → 6, con su motivo |
