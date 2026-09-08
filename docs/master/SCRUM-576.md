# SCRUM-576 · CONT-03: asociar persona ↔ empresa — sin clave ajena, con servicio de borrado

**Fecha:** 7-sep-2026 · **actualizado el 8-sep-2026** (microcopy firmada + migración en dev)
**Carril:** producto · **Gate:** aprobado por el fundador el 24-ago-2026
**Medido contra:** `origin/main` = `d271d29aff85ed155d23397b7e6a1fca64a86bb0` · 2026-09-08T00:00:00+02:00
**Tanda:** 5927 tests, 5825 pass, **0 fail**, 102 skipped — `npm test`, exit **0** (comprobado por
código de salida, no por `| tail`). Re-corrida entera en cada pasada.

> ⚠️ Esa fecha es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Lo entregado:** la OBLIGACIÓN 0 verificada, el campo «Empresa» en el lado Persona de los **dos**
formularios, la validación en servidor, y el control que decide en verde — enseñando el antes ciego
y el después.

**8-sep-2026 · segunda pasada:** los dos rótulos **firmados** y aplicados byte a byte (el censo de
ranuras baja **6 → 4**, medido con el lector oficial), y la migración **aplicada en dev** —
**26 → 27** columnas.

**8-sep-2026 · tercera pasada:** 🔴 **la clave ajena se RETIRA del ticket** por decisión del
fundador, y lo que ella daba —qué pasa al borrar— **lo hace ahora el código**, con su evidencia
medida contra dev. El fichero SQL queda en dos sentencias. **Con staging y producción aplicadas, el
PR es mergeable: no queda nada más pendiente.**

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

## ✅ LA MIGRACIÓN, APLICADA EN LAS TRES BASES (8-sep-2026)

> ## El bloqueo «NO MERGEABLE HASTA APLICAR LA COLUMNA EN LAS TRES BASES» queda LEVANTADO
>
> **Y se retira también del cuerpo del PR**, que es donde de verdad lo lee quien va a pulsar el
> botón. Se retira porque **las tres casillas están marcadas**, no porque haya pasado el tiempo ni
> porque el ticket lleve días abierto: producción y staging las aplicó y **verificó** el fundador
> en `information_schema` (`integer` · `is_nullable = YES`, con capturas) y dev la apliqué y medí
> yo (26 → 27 columnas, con control positivo).
>
> Lo que el aviso decía **sigue siendo verdad y por eso no se borra de aquí**: `schemaDrift` compara
> esperado ⊆ real y **para el arranque** si el esquema nombra una columna que la base no tiene. Un
> aviso borrado no enseña nada; uno levantado, con la fecha y el motivo, sí.

`src/core/db/schemaDrift.ts` compara **esperado ⊆ real** en tablas y columnas y **para el
arranque** cuando el esquema nombra una columna que la base no tiene. `prisma/schema.prisma` ya
nombra `companyId`. Mergear antes de aplicar es reproducir SCRUM-574 — **nueve días de yaqu.app
sirviendo el código del PR #862**.

- **El SQL:** `docs/sql/scrum-576-customers-company-id.sql`
- **El registro por base:** `docs/MIGRATIONS_PENDING.md`
- **8-sep-2026 · dev:** columna e índice **aplicados** (26 → 27 columnas, medido antes y después
  con control positivo). **Staging y producción, sin tocar.**
- ✅ **dev** — aplicada y **medida por mí** (26 → 27 columnas, con control positivo).
- ✅ **staging y producción** — aplicadas **por el fundador** el 8-sep-2026. Esas dos casillas las
  marca su palabra, no una medida mía: desde un árbol de trabajo no hay credencial de producción
  (regla 3) y staging estaba prohibida por el encargo. Se dice así porque decir APLICADO sobre algo
  que no lo está es un 500 en producción (SCRUM-220).
- ✅ **Sin clave ajena pendiente:** se retiró del ticket (abajo). El fichero son dos sentencias.

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

## 🔴 La clave ajena se retira — y la promesa se muda al código

El ticket nació con `@relation` y `onDelete: SetNull`. **El fundador la retiró el 8-sep-2026**,
aplicando aquí una firma que ya existía en `docs/MIGRATIONS_PENDING.md` para `Quote.jobId`
(SCRUM-195): «la FK que importaría aquí es `onDelete`, y eso ya se decidió en SCRUM-192 —
**servicio de borrado, no cascadas**. La integridad la sostiene el CÓDIGO».

**576 con clave ajena y 195 sin ella serían dos criterios para la misma clase de relación**, y ésta
es autorreferente sobre `customers`: deshacerla cuesta más.

⚠️ **Que el aplicador la rechazara fue OTRA COSA, y no conviene mezclarlas.** Al ir a aplicar en dev
se descubrió que `_aplicar-sql-dev.mjs` no admite `ADD CONSTRAINT` y es fail-closed. Eso fue el
**hallazgo**; la retirada es una **decisión** y se sostiene sola. No se ensanchó ninguna lista
blanca (regla 37).

**La `@relation` sale del schema, no sólo la sentencia del `.sql`**, y eso no es cosmética:
dejarla declarada haría que `prisma db push` volviera a crear la clave ajena retirada, y el
esquema prometería una integridad que la base no tiene. Verificado con
`preview-migracion.mjs --desde`: el schema de hoy genera **dos** sentencias, sin `FOREIGN KEY`.

### Lo que hace el código en su lugar

`deleteCustomer` desvincula a las personas **antes** de borrar la empresa, **en la misma
transacción**. Las dos decisiones tienen su porqué:

* **El orden** — al revés queda una ventana con filas apuntando a un id que ya no existe, y si el
  segundo paso falla no se cierra nunca. Sin clave ajena **nada protestaría**: el defecto sería
  mudo, que es el peor.
* **La transacción** — sin ella, un fallo al borrar dejaría a las personas desvinculadas de una
  empresa que **sigue existiendo**: se habría perdido un dato del profesional sin que nadie borrara
  nada.

Y el `updateMany` filtra por `merchantId` además de por `companyId` (regla 2): un `companyId` es
un entero, y sin el dueño en el `WHERE` alcanzaría filas de otro inquilino que casaran por número.

### La evidencia, medida contra dev — sembrada, ejercida y limpiada

```
── ANTES ──────────────────────────────────
   empresa id = 983
   id=983 companyId=null · SCRUM576-EVIDENCIA Fincas SL
   id=984 companyId=983 · SCRUM576-EVIDENCIA Ana
   id=985 companyId=983 · SCRUM576-EVIDENCIA Luis
   ✔ suelo: 2 personas vinculadas a la empresa 983

── BORRANDO la empresa por el camino real ──
   deleteMany count = 1

── DESPUÉS ────────────────────────────────
   id=984 companyId=null · SCRUM576-EVIDENCIA Ana
   id=985 companyId=null · SCRUM576-EVIDENCIA Luis

   ¿la empresa se borró?           true
   ¿sobreviven las personas?       true
   ¿su companyId es NULL?          true
   ¿alguien apunta al id borrado?  false (0)

── LIMPIEZA ── borradas 2 · restos con la marca: 0
```

**El suelo va dentro:** sin dos personas vinculadas el script se planta — «no encontré a nadie» y
«nadie quedó colgado» no pueden salir por la misma puerta. Y **no quedaron restos**.

⚠️ No se importó `deleteCustomer` directamente: usa el `prisma` del módulo, que pide
`DATABASE_URL`, y **en un árbol de trabajo esa clave no existe** (regla 3 — medido: reventó antes
de sembrar nada). Se ejerció la misma función que él llama, dentro de la misma transacción.

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
| 🔴 **SUELO del borrado** | hay una empresa **con** personas vinculadas, y la mesa de pruebas reproduce `updateMany`/`deleteMany` de verdad | — |
| 🔴 **EL ANTES del borrado** | sin desvincular, las personas quedan apuntando a una fila que ya no existe | — |
| 🔴 **EL DESPUÉS del borrado** | borrar la empresa **desvincula** y **no se lleva** a sus personas | — |
| ✅ **POSITIVO del borrado** | borrar una empresa **sin** personas vinculadas funciona igual que hoy | — |
| ✅ **Regla 2** | el desvinculado no toca filas de otro merchant que casen por número | — |
| 🔴 **Transacción** | los dos pasos van juntos, no sueltos | — |
| 🔴 **Sin FK** | ni el schema declara la relación ni el SQL **ejecutable** trae `FOREIGN KEY` | — |

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
