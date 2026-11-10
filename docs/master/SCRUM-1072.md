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
| 5. Ninguna frase dice qué corresponde · ayuda «pregúntaselo a tu asesor» | Enunciado y opciones FIRMADOS (SCRUM-1072 c.19859; `docs/microcopy/2026-10-16-SCRUM-1072-tipo-de-actividad.md`) · la ayuda NO se escribe (SCRUM-1264) · pintarlos: NO HECHO → S2 |
| 6. Si existe «Resumen del trimestre» (SCRUM-1049), la respuesta sale allí | NO HECHO → existe: «Resumen del trimestre» sale en `public/dashboard/js/reportsView.js` y `homeView.js`. Pintarla allí es pantalla (S2) y texto por firmar; de dónde lee esa vista, no lo he mirado |

## SCRUM-1072b · los textos, firmados por el orquestador

A9: comprobación → `tests/scrum514-aprobado-y-aplicado.test.mjs`

- **Firmados** (orquestador por delegación, SCRUM-1072 comentario 19859, leído en Jira): «¿Qué tipo de actividad tienes?» · «Profesional» · «Empresarial» · «No lo sé». Registro: `docs/microcopy/2026-10-16-SCRUM-1072-tipo-de-actividad.md`, con el LÍMITE de la firma: son rótulos, no criterio fiscal; el día que algo decida una retención con este campo, decide el asesor.
- **NO firmada y NO se escribe:** la ayuda de «No lo sé». Va a SCRUM-1264. La pantalla no la necesita.
- `scrum514` (texto firmado = texto pintado) cayó con los tres que aún no se pintan. Se **aparcan** en `APARCADOS` con su motivo y quién los desbloquea (S2, al pintar la pregunta), que es la vía que el propio guard indica. «Profesional» no se aparca porque el cruce ya la encuentra en `src/modules/system/domain/publicProfile.service.ts:51`, que es OTRO texto (el nombre de respaldo del perfil público): eso no prueba que la pregunta esté pintada. Tests de microcopy (71 ficheros): primero 675 tests · 1 fail (`scrum514`, los tres textos); después, EXIT 0.
- **Rojo MÍO en el CI** (run `38893115898`, punta `40805a91`, 11.646 tests · 3 fail): ① `scrum694` y `scrum700`: el caso ⑥ de mi test se fabricaba su propio filtro de comentarios por regex, y la casa tiene `soloCodigo` (`tests/_solo-codigo.mjs`). Lo cambié. ② `scrum525d`: las 6 líneas de `activityKind` desplazaron dos anclas de `docs/legal/AUDITORIA_CAMINO_EMISION.md` (`schema.prisma:925-926` → `931-932`, en dos sitios, y `:1803` → `:1809`); las llevé a donde está hoy su testigo, sin tocar la frase. Antes de calcularlas mergeé `origin/main`. Después, esos tres, mi test y `scrum514`: 64/64. Lección: antes de empujar, correr los guards de la casa sobre los tests NUEVOS (`scrum694`, `scrum700`) y sobre lo que mueve líneas de `schema.prisma` (`scrum525d`), no solo los vecinos del perfil.


## SCRUM-1072d · la pregunta, pintada junto a «Retención de IRPF» (S2, 19-oct)

**Medido contra:** `origin/main` = `eee7d2b4bcea348a05d0020a1e912db73a894cfe` · 2026-10-19T12:09:21Z

A9: comprobación → `tests/scrum1072d-actividad-en-pantalla.test.mjs`
> **Skill UI:** cargada · `yaqu-premium-ui`: un `<select>` con la misma caja (`form-group` + `input`) que la retención de al lado; cero tokens, cero componentes; textos sólo los cuatro firmados.

Sesión S2 (`s2-19oct-d`). Cierra los puntos 1 y 5 de la tabla de arriba (la pregunta y sus textos, pintados). El 6
sigue aparcado en `espera/scrum-1072c-…` hasta Q-C5, y la ayuda de «No lo sé» sigue en SCRUM-1264.

### 🔴 El carril, con el conflicto a la vista (decisión del orquestador, 19-oct)

`settingsView.js` y `settingsSubmenus.js` son **contenedores de J3** (`dos-equipos.md:146`). Esto va como **bloque
de S2 marcado `// S2:`**, por tres referencias que no dicen lo mismo:
- `dos-equipos.md:95`: en un contenedor, el otro equipo añade **SOLO su bloque, marcado con su puesto, en un PR suyo**. Este caso es literalmente eso.
- `docs/microcopy/2026-10-16-SCRUM-1072-tipo-de-actividad.md`, «Dónde se pinta»: «la pinta S2». Es posterior y es de este ticket.
- ⚠️ **En contra:** `dos-equipos.md:56` dice que S2 «deja las pantallas de … configuración». Y `:146` pone la pestaña
  «Facturación» (datos fiscales) en el área de J1.
Si J1 o J3 objetan, el PR es el sitio, y se revierte sin coste: es un bloque y una clave del mapa.

### Lo que hace

- `settingsView.js`: un `<select name="activityKind">` justo después de la retención, en la misma pestaña. Las
  opciones son `""` → «no consta», `profesional`, `empresarial` y `no_lo_se`. Al cargar, un valor fuera de la
  lista se pinta como «no consta». Al guardar, «no consta» viaja como `null`, igual que los otros estados fiscales.
- **«No consta» es la opción VACÍA, sin texto**, porque un rótulo para ella no está firmado (la firma es «estos cuatro
  literales y nada más»). Propuesta pendiente de firma: reutilizar «No consta», el que ya llevan los tres selectores de
  estado fiscal de esa pestaña. Cambiarlo es una línea.
- `settingsSubmenus.js`: `activityKind: 'facturacion'`.
- `scrum514`: fuera las tres líneas de `APARCADOS` de 1072, como pedía su motivo («lo desbloquea S2 al pintar la
  pregunta: entonces estas tres líneas se QUITAN»). `scrum1227` y `scrum1269`: `activityKind` en su `GUARDADO`, como
  pedían sus mensajes («añádelos a GUARDADO»). No se tocó ninguna aserción.

### Medido

**yaqu.app** (build `eee7d2b4b`, cuenta QA, sirviendo los dos ficheros de la rama; el PUT lo contesta la sonda y nada
sale; `sondas-s2/actividad-1072d.mjs [árbol]`):

| | prod | rama 1280 | rama 390 |
|---|---|---|---|
| el campo | no existe | justo después de la retención, mismo panel | igual |
| opciones | — | ∅ · Profesional · Empresarial · No lo sé | igual |
| QA (sin respuesta guardada) | — | se pinta ∅ | igual |
| elegir «Empresarial» y guardar | — | el PUT lleva `activityKind: "empresarial"` y la retención sin tocar | igual |

**Test** `tests/scrum1072d-actividad-en-pantalla.test.mjs` (Configuración montada en el banco, como 1102f): los
cuatro estados ida y vuelta, el valor fuera de la lista, que elegir no mueva la retención, los textos firmados y el
sitio. **Antes de escribirlo**, los tests que ya existían (`scrum514`, `scrum1227`, `scrum1269`) cazaban **1 de 4**
mutaciones: sólo el texto cambiado. **Con él, 6 de 6**: sin el campo, sin la línea del envío, un texto cambiado, la
opción vacía con texto, `null` colapsado en `no_lo_se`, y sin la clave del mapa. Base verde.

**Visto de paso, no tocado** (contenedor de J3, y ya estaba así en prod): a 390 el rótulo «Retención de IRPF» va en
línea con su selector y «Añadir condición» sale sin estilo de botón. Los selectores de esa pestaña miden 36 px de alto.
