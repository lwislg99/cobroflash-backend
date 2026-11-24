# SCRUM-1837 · el «+ Nuevo presupuesto» corto del censo táctil: cuál es y desde cuándo

**Medido contra:** `origin/main` = `f1cd9c39c07f172fa3a13fa7fa2016ba03369876` · 2026-11-24T18:38:32Z

A9: sin fallo que generalice — tramo de solo medición, sin cambio de producto; lo que confundió al ticket (leer el «p.ej.» de una fila por CLASE del censo como si nombrara un elemento) queda dicho abajo y se lo lleva el orquestador al equipo que lo abrió.

Los tres censos se corrieron con el árbol en `db0a6c04541c258eda6499e1088cf16db9f1836b`; los tres
commits que `main` ganó después (hasta `f1cd9c39c`) no tocan `public/` ni el instrumento. La rama
lleva además fusionado un `main` posterior que sí toca `public/dashboard/js/jobDetailView.js`
(+15 −2): la fila de la ficha del trabajo de abajo es la de `db0a6c045` y NO se ha vuelto a medir.

## Resultado, en corto

1. **No es el botón de SCRUM-1148.** El de 1148 es el de la cabecera de Plantillas
   (`renderTemplatesView`): hoy, 6 pulsables medidos y **0 cortos**, a 390 y a 929.
2. **Es el de la ficha 360 del cliente** (`renderCustomer360View`): `#btn-new-quote-360`,
   `public/dashboard/js/customerDetailView.js:477`. Mide 30,7–31,0 px de toque (caja 30,0).
3. **No es una regresión de hoy.** Con el `public/` de la base del día mide lo mismo, y `main` no
   ha tocado hoy ni ese fichero ni `templatesView.js`.
4. **No se cura aquí:** la ficha 360 no es del carril de S4. El propio registro de SCRUM-1148 lo
   dejó escrito al curar Plantillas («La de `BUTTON.btn-primary.btn-sm` «+ Nuevo presupuesto» que
   hay en ese fichero es de la ficha 360, `renderCustomer360View`, que es de J2: no se toca»).
   Nunca midió 44,6–45,0: esa cifra es del otro botón.

## Cómo se confunden los dos

La sección «POR CLASE» del censo agrupa elementos DISTINTOS que comparten clase y pone tres textos de
ejemplo. Su fila de hoy:

    3  BUTTON.btn-primary.btn-sm   toque 30.7–31.0 px · caja 30.0–30.0 px · 3 pantalla(s) · p.ej. + Nuevo presupuesto / Marcar como cobrada / + Añadir miembro

Son tres botones de tres pantallas, cada uno con su texto; no un «+ Nuevo presupuesto» en tres
pantallas. Y «+ Nuevo presupuesto» es el rótulo de dos botones de la misma clase: el de Plantillas
(curado por contenedor en 1148) y el de la ficha 360 (sin curar).

## Las tres mediciones

Instrumento: `node scripts/censo-objetivo-tactil-panel.mjs` (el árbitro del guard, navegador real).
Población de cada pasada, igual en las tres: 29 vistas publicadas, 28 montadas, 88 páginas ×
anchura, sonda de control leída en 88 de 88, 0 sondas no cazadas.

| pasada | fila de `BUTTON.btn-primary.btn-sm` | salida guardada |
|---|---|---|
| hoy (`db0a6c045`) | 3 elementos · 30,7–31,0 · 3 pantallas · + Nuevo presupuesto / Marcar como cobrada / + Añadir miembro | `evidencias/SCRUM-1837/censo-tactil-main-db0a6c045.txt` |
| `public/` de la base del día (`42cae6109`, 23-nov 22:48Z), instrumento de hoy | la misma fila, letra por letra | `evidencias/SCRUM-1837/censo-tactil-public-de-42cae6109.txt` |
| sonda: hoy, quitando `btn-sm` SOLO a `#btn-new-quote-360` | 2 elementos · 30,7–30,7 · 2 pantallas · Marcar como cobrada / + Añadir miembro | `evidencias/SCRUM-1837/censo-tactil-sonda-sin-btn-sm-en-la-360.txt` |

La sonda es la que identifica el botón: al quitarle la clase a ese y solo a ese (1 ocurrencia en el
fichero), «+ Nuevo presupuesto» desaparece de la fila y la cuenta baja de 3 a 2. Si el corto fuese el
de Plantillas, la fila no se habría movido. Se repite así: `git checkout 42cae6109 -- public` para la
segunda pasada, y para la tercera cambiar en `customerDetailView.js`
`class="btn-primary btn-sm" id="btn-new-quote-360"` por `class="btn-primary" id="btn-new-quote-360"`;
censo, y `git checkout HEAD -- public`.

Bisección contra los merges de hoy: 62 merges en `main` desde `42cae6109`, 13 tocan `public/`
(12 ficheros). Ninguno toca `customerDetailView.js` ni `templatesView.js`, y `styles.css` solo gana
3 líneas (un `:focus-visible` de `.customers-card[role="button"]`, SCRUM-1639c). Con la fila
idéntica en los dos extremos no queda nada que bisecar.

## Las tres pantallas que nombraba el encargo (parte, ficha del trabajo, lista de partes)

| pantalla | a 390 | a 929 | lo que NO se pudo mirar |
|---|---|---|---|
| parte (`renderParteDetailView`) | 8 medidos · 0 cortos · 3 no tocables | 8 medidos · 1 corto (no es de esta clase) | — |
| ficha del trabajo (`renderJobDetailView`) | 10 medidos · 0 cortos · 16 ocultos | 10 medidos · 0 cortos · 16 ocultos | la pestaña «Partes» no se deja abrir en el banco: su contenido NO está medido |
| lista de partes de oficina (`renderPartesOficinaView`) | NO MEDIDA | NO MEDIDA | el censo la da por no medida (12 nodos con su contrato) |

En lo que el censo ve del carril del parte no hay ningún `btn-primary.btn-sm` corto. De la pestaña
«Partes» y de la lista de oficina no se sabe nada: no es un cero, es un «no he mirado».

## Lo que queda para quien corresponda

- Los otros dos de la fila («Marcar como cobrada», «+ Añadir miembro») también miden 30,7 y tampoco
  son de hoy. Qué botón es cada uno no se ha identificado con sonda: las pantallas con cortos de
  esa familia son `renderInvoiceDetailView`/`renderInvoicesView` y `renderTeamView`.
- La cura de `#btn-new-quote-360` es «por contenedor, como en 1148»; la decide y la reparte el
  orquestador (carril de la ficha 360).

## Con qué se midió, dicho

- `dist` de este árbol: `tsc` salió 2 con 29 errores de tipos en 9 ficheros, todos por el cliente
  de Prisma compartido (18 campos por detrás, `scripts/_prisma-client-guard.mjs`); emitió igual
  (372 `.js`). El censo solo usa de `dist` módulos de dominio que no pasan por el cliente.
- guards:entrada: CIEGO por carga de máquina (corte a 90 s, cuarta vez en la tarde); los 16 guards
  de su lista con `node --test` sueltos: 177/177, 0 fallos. Mismo criterio que firmó el orquestador
  para SCRUM-1824 (SCRUM-1656 c.22684 ①): el juez es el check obligatorio del CI.
- Sin cambio de producto: la rama lleva este registro y las tres salidas del censo. suite con dist:
  NO CORRIDA; la corre el CI.

## Aceptación → dónde se ve

| aceptación | dónde se ve |
|---|---|
| medir en cuál pantalla se ha encogido | arriba: `renderCustomer360View`, `#btn-new-quote-360`; las tres salidas en `docs/master/evidencias/SCRUM-1837/` |
| por qué (¿un merge de hoy?) | no: fila idéntica con el `public/` de `42cae6109`; es el botón que 1148 dejó fuera |
| curar donde toque sin romper las otras dos | NO HECHO → fuera del carril de S4; al orquestador, para el dueño de la ficha 360 |
| capturas a 390 | NO HECHO → no hay cura que fotografiar; la medida es la del censo |
