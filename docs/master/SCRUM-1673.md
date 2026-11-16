# SCRUM-1673 — Un albarán sin líneas no se emite (PILOTO-1)

**Medido contra:** `origin/main` = `ec7e19e64eab26361a3d5ebae929b60474ae08ba` · 2026-11-12T12:09:59Z
A9: comprobación → `tests/scrum1673-albaran-vacio-no-se-emite.test.mjs`

**Puesto:** S1 · **Rama:** `scrum-1673-albaran-vacio-no-se-emite` · **Fecha:** 12-nov-2026

## Defecto (medido)

SCRUM-1658, yaqu.app, cuenta QA, 10-nov-2026: `POST /admin/albaranes/52/emitir` sobre un borrador
con `lineas: []` lo dejó `AB260007 · emitido · lineas: []`. PASO 0 en `origin/main` `ec7e19e64`:
el handler (`albaranes.routes.ts`, `router.post('/:id/emitir')`) comprobaba transición y congelaba
el cliente, pero no miraba las líneas. Rojo primero por la ruta real: ①②⑤ en rojo, ③④ en verde.

Decisión firmada previa: ninguna (buscado en el máster y en SCRUM-1656; el ticket tampoco la encontró).

## Arreglo

`src/modules/jobs/app/routes/albaranes.routes.ts`, `POST /:id/emitir`: tras la salida idempotente
y la comprobación de transición, y ANTES de congelar el cliente o escribir:
`!Array.isArray(albaran.lineas) || albaran.lineas.length === 0` → `409 { error: 'albaran_sin_lineas' }`.

- Crear un borrador vacío sigue permitido (es un documento a medias); lo que no puede es salir emitido.
- Fail-closed: `lineas` que no es una lista cuenta como vacío.
- Un albarán YA emitido (como AB260007) se devuelve tal cual, sin reescribirlo.
- No depende del rol: el técnico tampoco.
- **Sin `message`**: no hay texto firmado para este caso (regla 39). Propuesta para firmar, abajo.

## Test

`tests/scrum1673-albaran-vacio-no-se-emite.test.mjs` — sin gate y sin base; handler real con
`prisma` de doble (patrón de SCRUM-841). ① vacío → 409 sin escritura · ② no-lista → 409 ·
③ control positivo: con una línea se emite · ④ ya emitido vacío → 200 sin escribir ·
⑤ técnico → 409 (con su control positivo: con línea el mismo técnico sí emite, así que el 409 no es
un 404 de acceso).

## Vecinos tocados

- `tests/scrum849-escritura-no-afloja.test.mjs` ⑦: su fixture emitía un borrador con `lineas: []` y el control
  del DUEÑO caía por el 409 nuevo, no por la pertenencia que mide. Se le da UNA línea al fixture;
  la aserción no cambia.
- El arnés nuevo usa `reqDeSesion` (guard de SCRUM-1344).

## Medición

- Tanda sin base en el worktree (`origin/main` `ec7e19e64` + esta rama): 13355 tests, 3 rojos =
  1344 (arnés) + 849 (fixture) + 854 (faltaba este registro); los tres arreglados aquí.
- Mutación en `dist/` (`length === -1`): ① y ⑤ caen; ② lo sostiene la mitad `!Array.isArray`.

## Lo que queda fuera (otros puestos)

- **S2 (SCRUM-1659):** la pantalla. `jobDetailView.js` (`nextAct.kind === 'emitir'` y el
  «crear y emitir» de `crearAlbaran`) y `albaranDetailView.js` (`btnEmitir`) tienen que traducir
  `albaran_sin_lineas`. Aceptación 2 del ticket («dice por qué») depende de eso y de un texto firmado.
- **S3 — hecho aquí con excepción de carril (regla 37):** `scripts/qa/sembrar-qa.mjs` creaba el albarán de QA
  SIN líneas y lo emitía; con este portón, en un entorno limpio daba 409. Lo rompía ESTE cambio, así que
  se arregla en el mismo PR: el sembrador manda una línea al crear. GO del orquestador (12-nov, respuesta
  al aviso de S1; S3 avisado en el ticket, c.21675). El doble de `tests/scrum1268-sembrar-qa.test.mjs`
  ahora rechaza como el servidor (409 sin líneas): con el sembrador viejo caen 6, con el nuevo 70/70 en
  los cinco ficheros que lo usan. No se importa `LINEAS_QA` de `sembrar-albaranes.mjs` (circular).
## Texto propuesto (NO aplicado; para firma del fundador)

«No se puede emitir un albarán sin líneas. Añade al menos una línea con lo que se ha hecho.»

→ **Firmado** el 12-nov-2026: c.21707 (localizador allí). Aplicado en la pantalla por S2, abajo.

## Pantalla · S2 · 12-nov-2026 · rama `scrum-1673b-albaran-remates-front`

**Medido contra:** `origin/main` = `e599191a2ae41038acbeadd04a76feb2151746ec` · 2026-11-12T19:07:13Z
A9: comprobación → `tests/scrum1673b-albaran-remates-front.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`, en el remate). AB6 sobre el diff: cero componentes,
clases, tokens o colores nuevos; el texto sale por el `setStatus('error', …)` de siempre y lo demás
es QUITAR nodos al técnico. Sin capturas antes/después: no hay pieza visual nueva que comparar; lo
que se mide es qué nodos existen, y eso lo mide el test en el banco de vistas.

Agrupa dos remates del mismo editor de la ficha del Trabajo, declarado: este ticket y
**SCRUM-1712 ①** (c.21700), que no se repite en `docs/master/SCRUM-1712.md` (lo anota su comentario).

- **SCRUM-1673** · `albaranAccion.js`: `errorDeEmitirSinLineas(data)` devuelve el literal firmado si
  `data.error === 'albaran_sin_lineas'` y `null` en otro caso; va a `window` porque las tres
  superficies que emiten lo alcanzan por ahí. `jobDetailView.js` lo usa en `falloDelCta` (CTA de
  cabecera, `nextAct` `emitir`) y en el `catch` de «Entregar y enviar a firmar». Además ese botón
  corta SIN líneas ANTES del alta, con la forma del mismo 409: antes dejaba un borrador vacío con
  número reservado.
- **SCRUM-1712 ①** · `buildAlbEditor`: con `appUserRole === 'tecnico'` no se montan la casilla
  «Incluir precios en el albarán», las columnas precio+IVA, el total orientativo, «Ocultar precios en
  el albarán» ni el precio del dictado; tampoco el rótulo «modo congelado» en un borrador. El servidor
  ya lo rechaza (403, #3123). Cero textos nuevos.

**Test:** `tests/scrum1673b-albaran-remates-front.test.mjs`, 6 casos por el camino real
(`buildAlbEditor` montado en el banco de vistas con el rol de cada uno). Con `albaranAccion.js` y
`jobDetailView.js` de `main`: 4 rojos (②④⑤⑥); ① es el control positivo (la jefa SÍ ve todo, mismo
albarán) y ③ guarda la rama `else if` (en `main` el técnico ve la casilla, no el rótulo), así que
pasan en los dos lados. Con la rama: 6/6.

**Tanda de vecinos** (todo test que lee `albaranAccion` o `jobDetailView`, 86 ficheros; fuera
`scrum759`, que lanza la tanda entera y lo cubre el CI): 790 tests, 789 en verde, 0 rojos, 1 saltado
con motivo declarado (SCRUM-22, `sin QA_DB_TEST=1 ni LIBRO_PG_URL`).

**Lo que queda fuera:** `albaranDetailView.js` (`btnEmitir`) es carril S4; tiene la función en
`window.errorDeEmitirSinLineas` para usarla. Verificación en yaqu.app, tras el merge.
