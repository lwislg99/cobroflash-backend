# SCRUM-1072 · La actividad (profesional o empresarial), junto a la retención de IRPF — mitad de servidor

**Medido contra:** `origin/main` = `48fc00f6a90089b0f172b58c49413d889288bec0` · 2026-10-16T11:05:40Z

A9: comprobación → `tests/scrum1072-actividad-se-guarda.test.mjs`

Sesión S1 · rama `scrum-1072-actividad-irpf-servidor`. Encargo del orquestador (lote del 16-oct, punto 2). La pantalla vive en `settingsView`, contenedor de J3: **no se toca aquí**.

## Lo que hace

- `prisma/schema.prisma`: `Merchant.activityKind String? @map("activity_kind")`, sin `@default`. Es A5 paso ③: el DDL (`docs/sql/scrum-1072-activity-kind.sql`) consta aplicado en las tres bases desde el 29-sep (`docs/MIGRATIONS_PENDING.md`, «LOTE DE 7»).
- `src/core/validation/schemas.ts`: `activityKind` en `merchantProfileUpdateSchema`, lista CERRADA `profesional` · `empresarial` · `no_lo_se`, `nullable().optional()`. AUSENTE = no se toca; `null` = no consta; `no_lo_se` es una respuesta.
- `src/modules/system/merchantAdmin.ts`: `activityKind` en el `select` de `getMerchantProfile`. Sin esa línea, el siguiente guardado de cualquier ajuste la devolvería a NULL (SCRUM-1227).
- `docs/sql/deriva-prod.sql`: 514 → 515 columnas (`merchants.activity_kind`).

**No cambia la retención ni ningún importe.** Ningún fichero de `src` la lee para decidir nada: lo ata el caso ⑥ del test.

## Verificado, ejecutando

- `tests/scrum1072-actividad-se-guarda.test.mjs`: 7 de 7. **Rojo primero**, mutando `dist`: base sin mutar 7/7; «el GET no la devuelve» tumba 3; «el esquema no la deja entrar» tumba 4; «lista abierta» (`z.string()`) tumba ③; «guardar la actividad pone la retención a NULL» tumba ④. Los cuatro mutantes mueren.
- Vecinos (`scrum1102f`, `scrum1227`, `scrum1269`, `scrum222`, `scrum461`, `scrum1515`, `scrum495`, `scrum741`): 73 tests · 67 pass · 3 skip (piden `LIBRO_PG_URL`) · **3 fail, los tres de la causa A** y nombrando sólo `merchants.activity_kind`: `scrum222` (el SQL del censo frente al cliente) y dos de `scrum461` (el `.prisma` frente al cliente).

## 🔴 Desviación DECLARADA: el cliente de Prisma no se regeneró

Este árbol cuelga del `node_modules` compartido y regenerar desde él está vetado (A1, `trampas-del-entorno.md` §10 paso 5). Así que:

- `tsc` da **un** error, el esperado: `merchantAdmin.ts(147,7)`, `'activityKind' does not exist in type 'MerchantSelect'`. `dist` se emite igual.
- `scripts/generar-sql-deriva.mjs` se niega a escribir con el cliente atrasado (bien hecho). `deriva-prod.sql` se escribió con **las funciones del propio generador** (`paresEsperados` + `motivoParaNoEncoger` + `generarSql`) sobre el DMMF del cliente compartido más la única columna que añade esta rama. Control: el fichero en disco tenía 514 entradas y el cliente 514, o sea, el cliente va con `main`. El control de verdad es el CI, que genera el cliente desde este esquema y compara (`scrum222`).

## No medido

- **Las tres bases, por mí:** este árbol no tiene `DATABASE_URL_STAGING`/`_DEV`/`_TESTS` (`node scripts/comprobar-claves-bd.mjs`: las tres AUSENTES). Lo que consta es el registro del fundador del 29-sep, no una medida mía. Producción la pregunta el job «constancia del ALTER» del PR a `yaqu.app/schema-check`.

## Lo que falta (no se cierra con esto)

| aceptación (literal) | dónde se ve |
|---|---|
| 1. En el perfil, junto a «Retención de IRPF», una pregunta de tres opciones | NO HECHO → S2 / J3 (`settingsView`), con los rótulos firmados |
| 2. Tres estados que no colapsan: NULL = no consta · cada opción declarada | `tests/scrum1072-actividad-se-guarda.test.mjs` ② |
| 3. Columna nueva y anulable · viaja con el perfil · lista cerrada · multi-tenant | `tests/scrum1072-actividad-se-guarda.test.mjs` ① ③ ⑤ |
| 4. La respuesta NO cambia la retención ni ningún importe | `tests/scrum1072-actividad-se-guarda.test.mjs` ④ ⑥ |
| 5. Ninguna frase dice qué corresponde · ayuda «pregúntaselo a tu asesor» | NO HECHO → texto por firmar (regla 39), y la pantalla |
| 6. Si existe «Resumen del trimestre» (SCRUM-1049), la respuesta sale allí | NO HECHO → existe: «Resumen del trimestre» sale en `public/dashboard/js/reportsView.js` y `homeView.js`. Pintarla allí es pantalla (S2) y texto por firmar; de dónde lee esa vista, no lo he mirado |

**Textos que piden firma** (propuestos al orquestador, no escritos en ningún fichero): las tres opciones «Profesional» · «Empresarial» · «No lo sé»; y, aparte, el enunciado de la pregunta y la ayuda de «No lo sé», que el ticket también pide.
