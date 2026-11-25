# SCRUM-1822 (tramo ⓐ) · el candado del parte se explica, y el borrador lleva «Editar» arriba

**Medido contra:** `origin/main` = `7592c8c140cbe5ddb1bcc516c8c6af38af90d59d` · 2026-11-25T08:38:33Z

A9: aviso → cicatriz S4 «Lancé `meta-guard-mutaciones.mjs` con un fichero detrás creyendo que filtraba por él: no filtra, recorrió el catálogo del repo entero y, al pararlo, dejó mutado un fichero fiscal ajeno hasta que su propia red lo devolvió.» — no se pudo comprobar: el instrumento es de otro carril y acepta en silencio un argumento que no conoce; no hay test mío que pueda ver qué lanza una sesión

**Skill UI:** cargada (`yaqu-premium-ui`, con `DESIGN.md` y la Parte AB del máster leídos antes de tocar la vista)

Mutaciones: catálogo → `tests/scrum1822-candado-explicado.test.mjs`

## El pedido

El fundador, el 20-nov-2026, con la captura del parte firmado PT-2026-010: «un parte ahora como que no es
editable... un boton arriba para editar y que se desbloqueen los campos». El ticket pide dos cosas de
pantalla y prohíbe tocar los candados del servidor.

## PASO 0 · medido antes de tocar (sobre `77c000dea`)

- El servidor ya dice por qué: `puedeEditarContenido(estado)` devuelve `{ ok, motivo }`
  (`src/modules/jobs/domain/parteTrabajo.ts`) y viaja en `GET /admin/partes/:id`.
- La vista decidía `editable` con `puedeEditarContenido.ok` y **no pintaba el motivo en ningún sitio**
  (cero usos). Un parte firmado era texto plano sin una palabra de por qué.
- El borrador **ya** pintaba sus casillas con borde, «Ahora», «Añadir línea» y el dictado (fotos «antes»
  del banco). Lo que el fundador vio «no editable» estaba firmado. Arriba, nada decía que se podía tocar.

## Lo decidido (y quién)

| qué | firma |
|---|---|
| El firmado pinta `puedeEditarContenido.motivo` tal cual llega, byte a byte, sólo si no se puede editar. Minúscula inicial y sin punto incluidos; sin mayúscula por CSS | SCRUM-1656 comentario 22754 |
| El borrador lleva «Editar» en la cabecera, pastilla de relleno neutro con lápiz, que deja el cursor en la primera casilla | SCRUM-1656 comentario 22758 |
| El borrador NO pasa a solo lectura para que el botón «desbloquee»: sería un toque más para el operario | SCRUM-1656 comentario 22758 |

Las dos firmas son del orquestador por delegación del fundador y las dos se leyeron en Jira antes de
citarlas. Ficha: `docs/microcopy/2026-11-25-SCRUM-1822-candado-explicado.md`.

## Qué cambia

- `public/dashboard/js/parteDetailView.js`: una ranura en la cabecera del parte, debajo del cliente.
  `pintarCandado` (no editable + motivo de texto → `<p data-parte-candado>` con el motivo escapado y
  nada más), `pintarEditar` (editable → `<button data-parte-editar>`), `atarEditar` (clic → foco en el
  primer `[data-parte-campo]`) y `TEXTOS.editar`. La vista no lleva copia de la frase del servidor.
- `public/dashboard/css/styles.css`, bloque `S4 · SCRUM-1822`: `.parte-candado` (nota: tarjeta blanca con
  borde, texto Cuerpo, candado dibujado) y `.parte-editar` (relleno `--neutral-200`, 44 px, anillo Foco).
  Sólo tokens que ya existían; ni un `style=`.
- Los candados del servidor: sin tocar. `src/` no cambia.

## Medido en el navegador

`node docs/master/evidencias/SCRUM-1822/capturar-candado.mjs` → salida 0. Población: 4 combinaciones
(borrador y firmado × 390 y 1280), cada una antes (merge-base) y después. Cifras en `medidas.json`.

| | 390 | 1280 |
|---|---|---|
| firmado · candado | 366×65 px, contraste 9,22:1, texto idéntico al del dominio | 606×44 px, 9,22:1, idéntico |
| firmado · palabras nuevas | las 17 del motivo y ninguna más; 0 perdidas; 0 botones nuevos | igual |
| firmado · casillas | las de antes, todas `disabled` | igual |
| borrador · «Editar» | 100×44 px, contraste 14,32:1, relleno contra lienzo 1,14:1 | igual |
| borrador · palabras y botones nuevos | «Editar» y nada más; 0 perdidos; casillas idénticas | igual |
| borrador · tras PULSAR «Editar» | el cursor está en `entrada` (la primera casilla) | igual |
| se sale / desborde | 0 / 0 | 0 / 0 |

Control del banco: el «antes» no trae ni candado ni botón; si los trajera, sale con 2 sin comparar.
Fotos (fuera de git): `D:\MILLONARIO\cobroFlash\capturas\SCRUM-1822\` — ocho, `antes-`/`despues-` ×
`borrador`/`firmado` × `390`/`1280`.

## Tests

- `tests/scrum1822-candado-explicado.test.mjs`: 9 tests. Antes del cambio, 8 rojos y 1 verde (el ④, que
  es un cerrojo de lo que ya se cumplía); después, 9 verdes.
- Las 5 mutaciones del catálogo, aplicadas una a una con la base sin mutar primero (9 pasan, 0 caen):
  las 5 tumban el test que nombran y el fichero vuelve a sus bytes. Se probaron con un guion de un solo
  uso, no con el meta-guard entero (ver A9).
- Tanda de antes del push, sacada con `git grep -l` de los tests que nombran lo tocado (la vista del
  parte, la hoja de estilos, `docs/microcopy` y los censos de scripts): 231 ficheros, 1.932 tests,
  1.923 pasan, 7 saltan (sin `LIBRO_PG_URL`, `SERIE_PG_URL` o `QA_DB_TEST`), 2 caen. Los 2 son de
  `tests/scrum1199-avisos-alta-cliente.test.mjs` y caen por el entorno: `Cannot find module
  …\s4-1822\node_modules\express` (este worktree no tiene `node_modules` propio; el test lo pide por
  ruta). No tocan nada de este cambio.

## De paso

- El build local avisa de que el cliente de Prisma compartido va 18 campos por detrás y `tsc` sale con 2,
  pero emite `dist/`. Ya constaba en el registro de SCRUM-1837; no es de esta rama.

## Aceptación → dónde se ve

| aceptación (literal del ticket) | dónde se ve |
|---|---|
| En un parte FIRMADO: que se explique visiblemente por qué está sellado (candado con texto; la microcopy nueva necesita firma — regla 39). | `tests/scrum1822-candado-explicado.test.mjs` ①②③④ · en yaqu.app, cualquier parte firmado: bajo el cliente, el candado y la frase del servidor. NO VISTO AÚN en yaqu.app: se mira tras el merge |
| En un BORRADOR: que la edición sea obvia (hoy «parece» no editable). | `tests/scrum1822-candado-explicado.test.mjs` ⑤⑥ · en yaqu.app, cualquier parte en borrador: «Editar» bajo el cliente, y al pulsarlo el cursor en Entrada. NO VISTO AÚN en yaqu.app: se mira tras el merge |
| SIN tocar los candados del servidor (título del ticket) | el diff de la rama no toca `src/` |

## Lo que queda

- Verlo en yaqu.app tras el merge (regla 42), sobre los partes de QA #21 (borrador) y #22 (firmado).
- Tramo ⓑ, si se quiere otra frase para el candado: la del servidor empieza en minúscula y no lleva
  punto. Cambiarla es cambiar `parteTrabajo.ts`, y los motivos del dominio viajan también en los `409` de
  las rutas del parte (`partes.routes.ts`): leído en el código, no intentado.
