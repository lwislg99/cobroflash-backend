# SCRUM-1690 — PILOTO-1 · La ficha del trabajo deja de titularse «Presupuesto #N · cliente»

**Medido contra:** `origin/main` = `db202031a449ba21c3cccf32d74afc8ecbda4a33` · 2026-11-11T11:06:04Z (cabecera `Date:` de `gh api -i zen`) · **Rama:** `scrum-1690-titulo-del-trabajo-es-el-cliente` · **Carril:** S1 · trabajos.

A9: comprobación → `tests/scrum1690-titulo-es-el-cliente.test.mjs`

> Puesto S1 (servidor). Origen: SCRUM-1686 c.21459 (X1). Rama `scrum-1690-titulo-del-trabajo-es-el-cliente`,
> desde `origin/main` = `db202031a` (11-nov-2026 ~11:00Z).

## Arranque (11-nov-2026 ~11:05Z)

- **Trabajo a medias de la sesión anterior: NINGUNO.** Se miró antes de empezar: `git ls-remote --heads origin`
  sin ninguna rama `*1690*`, sin rama local `*1690*` y sin worktree `s1-*1690*`. No había nada que continuar
  ni que limpiar.
- Jira: «Tareas por hacer», sin comentarios.

## El defecto

`tituloDeTrabajo` (`src/modules/jobs/domain/trabajoDirecto.ts`) fabricaba `Presupuesto #N · cliente` para
TODO trabajo con presupuesto y sin nombre propio. Eso contradice la regla de SCRUM-317 (`job.service.ts`,
bloque «EL TRABAJO YA NO NACE LLAMÁNDOSE «Presupuesto #N»»): mientras el profesional no le ponga nombre, la
pantalla se titula con el CLIENTE, y el presupuesto queda como documento de origen. Usan esa función:

| llamador | pantalla |
|---|---|
| `jobs.routes.ts` · `serializeJob` (`titulo`) | ficha del Trabajo |
| `expenses.service.ts` · `nombresDeTrabajos` | nombre del Trabajo en Gastos (SCRUM-944b) |
| `historialDelCliente.ts` | historial del cliente (SCRUM-980) |

## El arreglo (sin texto nuevo: se quita uno)

- `tituloDeTrabajo` ya no recibe `quote`: devuelve el nombre propio, si no el cliente, y si no `#<id del Trabajo>`.
- Los tres llamadores dejan de pasarle `quote`. En Gastos y en el historial, la consulta de presupuestos
  existía **solo** para ese nombre y se queda sin uso, así que se retira: Gastos pasa de tres consultas por página
  a dos (Trabajos y clientes).

## Rojo primero

`tests/scrum1690-titulo-es-el-cliente.test.mjs`, contra `dist/` **sin** el arreglo: **2 ✖ / 2 ✔**
(«con presupuesto → cliente» y «con presupuesto sin cliente → `#12`»; el control positivo y el del nombre
propio, en verde). Con el arreglo: 4/4.

Tests viejos que fijaban el literal y cambian con la regla (cada cambio lleva su comentario `SCRUM-1690`):
`scrum651` (el «control positivo» que exigía `Presupuesto #34 · Bar Paco`), `scrum944b` (7 ✖: el nombre es
ahora el cliente; el caso «adicional» se queda; el de «sin quoteId toma el primero por id» se retira porque
el presupuesto ya no entra en el nombre; el de coste constante exige **0** consultas de presupuestos y
siembra dos clientes para que el test distinga el nombre por fila) y `scrum980` (está tras un gate de BD,
y ahora espera `Ana 980` y que ningún título lleve «Presupuesto #»).

Tanda de los afectados (1690, 651, 944b, 980, 917d, 317): **52 ✔ / 0 ✖ / 1 skip** (el de 980, gateado por BD).

## Trinquetes que se mueven

- `scripts/_censo-gemelo-crudo.mjs` (SCRUM-1452): la entrada `NUMERO|…trabajoDirecto.ts::tituloDeTrabajo` baja
  de `n: 2` a `n: 1`, porque el número del presupuesto ha salido del título. Queda el `#<id del Trabajo>` (SCRUM-1444).
  Es lo que pide el propio trinquete: «si lo arreglaste, baja su `n`».
- `tests/_veredicto-mudez.json` se regenera con `npm run censo:mudez -- --escribir` (SCRUM-1395b), porque
  cambian los ficheros de test medidos.

## Tanda entera

Sin estos dos ajustes: 13155 tests · 20 ✖. 1452, 267 (×4 copias), 1395b y 854 eran de esta rama y se arreglan
aquí. 1321 («el temporal no se alcanza desde la raíz»: el TAP está en C: y el repo en D:) y 804 (refs locales
de la máquina) son de entorno. Tras el commit, `guards:entrada` (976) cayó por SCRUM-1294: a este registro
le faltaba la línea `A9:`. Añadida.

Cruce de carril declarado: `scripts/` es de S3, pero la entrada que se toca lleva `retira: 'S1'` y es el
ajuste que el propio trinquete pide; el hook de carril no lo bloquea.

## Pendiente de verificar

- Captura en yaqu.app (390 y escritorio) de la ficha de un trabajo con presupuesto aceptado: **después del
  merge**, que es cuando se despliega. Se añade aquí al hacerla.
