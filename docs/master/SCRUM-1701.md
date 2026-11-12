# SCRUM-1701 · PILOTO-1 · Menú del piloto: ocultar lo cerrado por la regla 24

**Medido contra:** `origin/main` = `a4a2ffc4aba6b5c0461affc5cff725fa099455ef` · 2026-11-11T16:20Z

**Skill UI:** cargada (`yaqu-premium-ui`; AB6: sin componente, clase, token ni CSS nuevos. Cuatro entradas
de la barra llevan un atributo declarativo y una función las oculta con `style.display`, igual que hace ya
`aplicarRolALaBarra`)

A9: comprobación → `tests/scrum1701-menu-del-piloto-por-modo.test.mjs`

## Origen y firma

T8 de la ③ de SCRUM-1686 (Jira c.21459). **D3, decisión del fundador** (SCRUM-1686 c.21461, AskUserQuestion
del orquestador, ~12:00 local): «¿esconder del menú del piloto Facturas/Cobros/Libro/Recibidas mientras el
interruptor esté en OFF?» → «Sí, esconder». El efecto ④ de la misma firma dice cómo: **leyendo el modo de
emisión que ya existe (`modoVisible`/`appModoEmision`), sin flag nuevo.**

Sin texto nuevo: no se escribe, cambia ni quita ningún literal. Sólo se ocultan cuatro entradas.

## Paso 0 · el defecto existe hoy (yaqu.app, build `a4a2ffc4a`, cuenta QA, admin)

`sondas-s2/menu-1701.mjs cap1701-antes prod`, sólo GET, a 390 y 1280: `appModoEmision = 'receipt'` y **18
entradas** a la vista, incluidas `invoices`, `cobros`, `libro-registro` y `facturas-recibidas`.

## Qué cambia

- `public/dashboard/index.html` (contenedor S2): las cuatro entradas de D3 declaran
  `data-oculta-en-modo="receipt"`. Lo declara la propia entrada, como `data-rol` desde SCRUM-1338.
- `public/dashboard/js/app.js` (contenedor S2): `aplicarModoALaBarra(documento, modo)`, al nivel de arriba
  para que el banco la ejecute. `initApp` la llama justo **después** de `aplicarRolALaBarra`. Oculta lo
  declarado para ese modo y cierra el rótulo de la sección que se quede sin ninguna entrada, contando lo que
  hayan quitado los dos filtros.
- `modo` nulo («no se sabe») no oculta nada. La barra queda como antes del ticket: aquí no se adivina el
  modo de nadie, y lo que de verdad no se puede hacer lo cierra el servidor.

## Medido

- **Navegador** (`sondas-s2/menu-1701.mjs cap1701-local local <worktree>`: yaqu.app con `app.js` e
  `index.html` de esta rama, sólo GET, 390 y 1280): **14 entradas**, sin las cuatro. Siguen a la vista los
  rótulos Venta, Negocio y Cuenta. 0 no-GET, 0 errores de página. Captura:
  `sondas-s2/cap1701-local/menu-local-1280.png`.
- **Test** (11 casos): control positivo (18 entradas con `fiscal`) · con `receipt` salen EXACTAMENTE las
  cuatro · `fiscal`/`demo`/`null`/`undefined` no quitan nada · operario + `receipt` no deja ningún rótulo
  encima de nada · caso fabricado de una sección que se vacía sólo por la SUMA de rol y modo (la barra real
  no tiene ninguna hoy, y sin este caso el recuento de la segunda pasada no lo comprobaba nadie) · la
  declaración la llevan sólo las cuatro · `initApp` la llama después del rol.
- **Rojo por mutación** (`$CLAUDE_JOB_DIR/tmp/mutar-1701.mjs`): BASE 0 fallos. Seis mutantes, seis en rojo:
  sin la llamada en `initApp` (1) · función que no hace nada (3) · recuento de lo que ya estaba oculto (1) ·
  sin cerrar rótulos (1) · Cobros sin declarar (2) · Clientes declarada de más (2).
- **Tanda completa** (TAP a fichero fuera del árbol): 13 233 tests · 13 033 ✔ · **30 ✖** · 170 saltados.
  - **15 eran míos y están arreglados:** el ancla de este registro sin hora (SCRUM-267, 12 ✖) · un `for`
    que construía el nombre de cuatro `test()` (SCRUM-1415; ahora van escritos) · el rótulo «Facturas» de
    `app.js` bajó de la línea 388 a la 391 (SCRUM-601, re-anclado con el mismo `grep -n`) · el registro
    sin commit todavía (SCRUM-854). Después de arreglarlos: 1701 + 601 + 1415 + 267 + 1338 = 44/44 ✔.
  - **15 son de entorno** (árbol sin `node_modules` propio, temporal en otra unidad, CLI de Prisma local):
    1199 ×2 · 1244c · 1321 · 245 ×2 · 385 ×3 · 471 · 475 ×3 · 476 · 976. `npm run guards:entrada` da
    `fail 0`; su salida 255 es el presupuesto de tiempo, que 976 juzga en CI.

## Fuera, declarado

- **El rol del operario** (lo que ve un miembro con `tecnico`) espera a la medida ①bis de SCRUM-1686. No se
  construye aquí. Ojo, porque la hipótesis de c.21459 («el front NO filtra el menú por rol») es **falsa en
  el código**: `aplicarRolALaBarra` (SCRUM-1338) ya oculta las entradas `data-rol="admin"`, y Cobros, Libro
  y Recibidas ya iban fuera para el operario. Lo que la ①bis tiene que medir es el resto.
- **Otras puertas a las cuatro vistas, fuera de la barra.** En Inicio sigue a la vista la acción rápida
  «Pendientes de cobro · facturas abiertas» (captura de arriba). Que una vista tecleada (`#invoices`) siga
  abriendo NO está medido: `vistaVedadaPorRol` sólo veta por rol, así que es lo esperable. D3 habla del MENÚ: se dice aquí y se propone aparte, no se arregla de paso.

---

## Tramo b — el atajo de Inicio a Facturas (S2, 11-nov-2026)

**Medido contra:** `origin/main` = `81f5795355200112e4d79feb4ec472b252ea243b` · 2026-11-11T16:38:23Z (cabecera `Date:` de `gh api -i zen`) · **Rama:** `scrum-1701-menu-piloto-modo-emision` (la misma: #3077 aún no había entrado) · **Carril:** S2.

**Skill UI:** cargada (`yaqu-premium-ui`; AB6: sin componente, token ni texto nuevos. Se quita un botón ya existente; la rejilla de acciones rápidas pasa a dos columnas cuando quedan menos de tres, sólo por encima de 640px)

A9: comprobación → `tests/scrum1701-menu-del-piloto-por-modo.test.mjs`

Los casos de este tramo llevan el prefijo `1701b` en ese mismo fichero.

**Decisión del orquestador, coherencia con D3 firmada, reversible** (SCRUM-1701 c.21511, hallazgo (b); decisión
en el encargo de la S2 de relevo, 11-nov). La acción rápida de Inicio «Pendientes de cobro · facturas abiertas»
lleva a Facturas; con `receipt`, D3 (SCRUM-1686 c.21461) saca Facturas de la barra. Un atajo a una sección
escondida es un callejón roto, no un texto nuevo: **lee el mismo interruptor** (`window.appModoEmision`, sin
recalcularlo) y no se pinta. `fiscal`, `demo` y `null` lo dejan como estaba. No se escribe ni cambia ningún
literal (regla 39 no aplica: sólo se quita uno).

- **Cómo:** `homeView.js` pinta la plantilla igual que antes y, si el modo es `receipt`, quita
  `#btn-view-pending` después. NO va con un ternario dentro de la plantilla, a propósito: así el literal no se
  mueve y el censo de SCRUM-601 lo sigue leyendo igual. Probado y descartado: anidado en la plantilla, el censo
  lo cuenta como construcción que no sabe leer (38 → 39) y como un flag más (8 → 9).
- **CSS** (`styles.css`, bloque S2): `.home-quick-actions:not(:has(> :nth-child(3)))` a dos columnas con
  `min-width: 641px`. Sin esto, las dos acciones dejaban un hueco a la derecha en la rejilla de tres.
- **Tests:** la Inicio se PINTA en el banco (`pintarVista`, control positivo `#btn-add-customer`) con los cuatro
  modos: `receipt` sin el botón; `fiscal`/`demo`/`null` con él.
- **Rojo por mutación:** condición forzada a falso → `1701b · con receipt…` en rojo (1/1). Restaurado.
- **SCRUM-601 re-anclado:** la nota de condiciones de `homeView.js` baja de la 898 a la 906 (`git diff --numstat`:
  9 1, todo por encima; mismo `grep -n`). El veredicto `{ flag: 8, tipo: 11, aPelo: 160 }` y las 38
  construcciones que no lee, sin cambios.
- **Tandas:** tests que leen `homeView.js` o son de 1701: 486 ✔ · 0 ✖. Tests que leen `styles.css`: 826 ✔ ·
  0 ✖ · 1 saltado (lo declara su fichero). Tests que leen `docs/master` (326 ficheros): 2551 ✔ · 6 ✖ · 106
  saltados; 1 era mío (SCRUM-1294, la línea A9 llevaba una coletilla; arreglado: 45/45 ✔ con 1701 y 811c) y
  5 son los de entorno ya declarados arriba (475 ×3 · 476 · 976).
- **(a) de c.21511:** la frase de la auditoría «el front NO filtra el menú por rol» queda corregida en el
  propio `docs/master/SCRUM-1686.md` (D3), con la cita a `aplicarRolALaBarra`, sin borrar la original.
## Tramo c — el rojo de #3077 (S2, 11-nov-2026)

**Medido contra:** `origin/main` = `d7c2006b274be4e3ac1d306e6d5fe6ee647f40b8` · 2026-11-11T17:08:09Z (cabecera `Date:` de `gh api -i zen`) · **Rama:** `scrum-1701-menu-piloto-modo-emision` (la misma) · **Carril:** S2.

El check obligatorio de #3077 salió en rojo por dos tests, y ambos los causaba esta rama (no son de entorno):

- **scrum836** (y los dos meta-guards, por lo mismo): el comentario de (b) iba entre `const veNegocio = …;` y
  `container.innerHTML = …`, y partía en dos el ancla de la cuarta mutación de `scrum1390y-inicio-por-rol`. La
  mutación no se podía aplicar, así que el guard quedaba ciego. **Arreglo:** el comentario baja al lado del
  `if` que quita `#btn-view-pending`, que es la línea que explica. Código idéntico, mismo número de líneas:
  la nota de 601 sigue en la 906 (`git diff --numstat` 9 1, como dice el re-anclaje). No se tocó la
  declaración de 1390y: su ancla vuelve a casar porque el texto vuelve a ser el de antes.
- **scrum719 / 1395b:** el veredicto de mudez no recogía el cambio en `scrum601-copy-del-documento-vs-flag.test.mjs`
  (el re-anclaje 898 → 906). **Arreglo:** `npm run censo:mudez -- --escribir`; `tests/_veredicto-mudez.json` va
  en el commit, sin tocarlo a mano.
- **Tanda local:** 836 · 719 · 601 · 1390y · 1701 → 78 ✔ · 0 ✖ · 0 saltados.

A9: comprobación → `tests/scrum1701-menu-del-piloto-por-modo.test.mjs`