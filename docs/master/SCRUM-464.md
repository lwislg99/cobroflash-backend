# SCRUM-464 · Que el técnico lleve SUS trabajos (H1 · fase 4)

**Fecha:** 11-ago-2026 · **Carril:** H (offline) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `2ff61f01bf4c1afffaf43bf85304e00dff3e10d1` · 2026-08-11T00:21:05+01:00
**Tanda:** 2925 tests · 2851 pass · **0 fail** · 74 gateados · `npm test` exit **0** · `guards:entrada` 17/17

> 🔴 **DEPENDENCIA DE ORDEN DE MERGE:** esta rama sale de **`scrum-460-precarga-al-movil`**, no de
> `main`, porque la ruta que hay que abrir (`precargaAdmin.routes.ts`) vive ahí y todavía no está en
> `main`. **460 primero, 464 después.**

## La víctima

Un merchant con equipo. El dueño está en la oficina; **el que baja al sótano es el operario**. Con
la precarga admin-only, el profesional que de verdad necesita el albarán delante era justo el que no
lo llevaba: **H1 estaba resolviendo el problema para la persona equivocada**.

## PASO 0

**a)** `docs/master/SCRUM-464.md` no existía en `main`; ninguna rama `scrum-464-*`. **Y su ausencia
no probaba nada por sí sola** — el fichero es un atajo: la premisa se comprobó aparte.
**b) La premisa se sostiene:** la ruta era `requireRole('admin')` y el paquete de SCRUM-458 solo
filtraba por `merchantId`.
**Worktrees:** cuatro, ninguno en esta rama (`b1` en 461, `b3` en 463).

## 🔴 Por qué campo se filtra — MEDIDO, no elegido a ojo

`jobs` declara dos columnas que podrían significar «quién hace este trabajo». **Las dos están vivas
y no significan lo mismo, por diseño**:

| | `operarioId` | `assignedUserId` |
|---|---|---|
| qué es (el esquema, literal) | «autoría = creador del presupuesto, **congelado en el accept**» | «**el asignado a ejecutar**» |
| quién lo escribe | el sistema, al aceptar el presupuesto (`job.service.ts`) | **el admin, a mano** (`PATCH`, `ADMIN_ONLY_JOB_FIELDS`) |
| quién FILTRA por él | la visibilidad de Trabajos (`jobs.routes.ts`) — **es el filtro row-level de la casa** | **NADIE**: cero `where` en todo el árbol |
| índice | `@@index([merchantId, operarioId])` | ninguno |

**Y cada uno solo falla en un sitio.** `operarioId` deja en cero **exactamente a la víctima de este
ticket** (si el dueño crea el presupuesto, vale `null`); `assignedUserId` deja fuera al técnico que
se hace sus propios presupuestos en obra.

### La decisión del fundador: LOS DOS, en unión — y por qué

**La asimetría de coste.** Pasarse de ancha cuesta que un técnico lleve un albarán de un trabajo
**que él mismo creó** —datos que ya vio—; quedarse corta cuesta que el profesional esté en el sótano
**sin nada que firmar y sin saberlo**. Y **la unión nunca le da un trabajo que no haya tocado: o lo
creó él, o se lo asignaron.**

**Los números de producción, medidos por el fundador el 11-ago-2026 sobre `jobs`:**

| total | con `assigned_user_id` | con `operario_id` | discrepan |
|---|---|---|---|
| **42** | **6** | **2** | **0** |

Tres cosas que esos números cierran:

* **`assignedUserId` NO está muerto** (6 de 42), así que **la unión no degenera** — era el riesgo que
  yo dejaba declarado como hueco abierto, y queda **medido y cerrado**;
* **`discrepan = 0`**: nunca se contradicen, así que la unión **no tiene que arbitrar nada**;
* la unión **triplica la cobertura**, de 2 trabajos a 6. Los 36 sin ninguno son merchants en
  solitario, donde el dueño **es** el profesional y ya los recibe.

**En dev no había con qué desempatar** —5 trabajos, 0 con cualquiera de los dos campos, 0 miembros de
equipo—, así que mi medición fue **del código**; la de producción la puso el fundador.

### ⚠️ Esto NO es una barrera de acceso, y conviene no confundirlo

Medido: **`GET /admin/albaranes/:id` no filtra por operario**, solo por merchant. Un técnico ya puede
abrir —y firmar— cualquier albarán del negocio si tiene el id. Lo que este filtro decide es **qué se
copia a su móvil**: es **minimización, no permisos**. Y ahí el fundador eligió la opción cara
sabiéndolo, porque **la minimización importa MÁS en el móvil de un técnico, no menos**: es el aparato
que más manos toca y sobre el que menos control tiene el dueño.

## Lo que se construye

**El filtro, en un sitio.** `condicionDelTecnico(id)` —el `OR` de los dos campos— y su gemelo puro
`esDelTecnico(job, id)`, para poder contrastar la consulta contra el criterio. `whereDePrecarga` y
`construirPaquetePrecarga` aceptan `soloDelTecnico`, **cuarto parámetro y opcional**, para que las
llamadas de SCRUM-458 sigan valiendo sin tocar una línea.

**La ruta deja de ser admin-only**, y el rol decide **qué paquete toca, no si hay paquete**. El rol se
pregunta con **`seesAllJobs`**, la allowlist de la casa, **nunca** con `role !== 'tecnico'`: un rol
desconocido tiene que caer del lado restringido (SCRUM-147). Va a `TECNICO_ALLOWED` con su motivo.

**Con fail-closed para un caso hoy imposible:** un no-admin sin `teamMemberId` daría
`soloDelTecnico = null`, y `null` significa **el merchant entero** — el fallo se abriría hacia el lado
malo y en silencio. Se cierra en alto con un 403.

## Verificado

**9 tests.** **Cinco rojos por el MECANISMO**, con post-condición en disco:

| # | qué se rompe | qué sale |
|---|---|---|
| **R1** | fuera el filtro | 🔴 «**UN TÉCNICO ESTÁ RECIBIENDO TRABAJOS QUE NO SON SUYOS**: en el paquete de Ana hay un albarán de Bruno» |
| **R2** | la unión degenera a `operarioId` | 🔴 «la técnica recibe `["ALB-ANA-PROPIO"]`… la unión ha degenerado y **la víctima de este ticket se queda sin nada en el sótano**» |
| **R3** | la unión degenera a `assignedUserId` | 🔴 «la técnica recibe `["ALB-ANA-ASIGNADO"]`» — el que crea en obra se queda fuera |
| **R4** | la ruta vuelve a la denylist | 🔴 «con una denylist, un rol NUEVO se llevaría el merchant entero al móvil» |
| **R5** | fuera el fail-closed | 🔴 «ahí `soloDelTecnico` sería `null` y eso significa EL MERCHANT ENTERO» |

**R2 y R3 juntos son lo que prueba que la unión es portante en los dos sentidos:** con un solo test
del caso feliz, quitar cualquiera de las dos mitades habría pasado desapercibido.

**Control positivo:** la técnica recibe **sus dos**, uno por cada camino. **El control negativo que
importa, con su positivo dentro:** el paquete de Ana no trae nada de Bruno **ni del dueño**, y se pide
el de Bruno **como Bruno** —y el del dueño **como dueño**— para comprobar que ahí sí están: sin eso,
«no aparece» sería cierto porque ese dato no existe en ningún sitio (regla de SCRUM-237, que ya me
cayó encima en 458).

**El dueño no cambia, con DOS regresiones:** recibe lo mismo que antes, y **sin técnico el `where` es
exactamente la forma de antes** — de eso depende que el contraste consulta-vs-criterio de SCRUM-458
siga midiendo lo que dice medir. Sus 11 tests pasan **sin tocar una línea**.

**El aislamiento entre merchants no se relaja:** test propio con el mismo id de miembro en dos
negocios, y comprobado **por el mecanismo** —las tres consultas siguen llevando `merchantId`—, no solo
por el resultado.

**Suelo, y son tres estados también para el técnico:** una técnica sin trabajos da
`LISTA` con cero albaranes —«no había nada»— y **no** `NO_SE_PUDO`; y si la consulta revienta, sale
por la otra puerta. Los dos la dejan igual en el sótano y por eso tienen que distinguirse.

**Y un rojo que era de mi escáner:** el guard de la ruta buscaba el literal `'tecnico'` y **nació rojo
señalando la anotación de tipo** (`userRole: 'admin' | 'tecnico'`), que no decide nada. Afinado a
buscar la **comparación** (`=== 'tecnico'`): un escáner que da ruido acaba relajado hasta quedarse
ciego (SCRUM-451).

## Lo que NO cubre — huecos declarados

* 🔴 **El técnico puede llevar precargado un albarán de un trabajo QUE NO VE EN SU LISTA DE
  TRABAJOS**, porque esa lista solo mira `operarioId`. **Es incoherente y lo sabemos**: se elige igual
  porque la alternativa deja al profesional sin nada. Escrito, no tapado.
* **No se ha probado con un equipo real.** En producción hay 6 jobs con asignado y **ningún merchant
  con equipo de verdad**: los tests inyectan un Prisma de mentira.
* **El filtro no es una barrera de acceso** (ver arriba): si alguien lo lee como control de permisos,
  lo leerá mal.
* **Nadie enseña al técnico qué lleva encima.** Los tres resultados de SCRUM-460 siguen sin
  superficie: eso es H2.

## Ficheros

* `src/modules/jobs/domain/precarga.service.ts` — `condicionDelTecnico`, `esDelTecnico` y el
  parámetro opcional.
* `src/modules/jobs/app/routes/precargaAdmin.routes.ts` — el rol resuelve el paquete.
* `src/core/http/adminRouteDeclarations.ts` — la ruta, en `TECNICO_ALLOWED` con motivo.
* `tests/scrum464-precarga-del-tecnico.test.mjs` (nuevo, 9).
