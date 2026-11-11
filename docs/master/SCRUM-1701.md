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
