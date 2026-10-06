# SCRUM-1475 · El parte trae a la vista su aviso de «No se ha podido guardar el cambio»

**Medido contra:** `origin/main` = `fdac6867180adf6892fa3cb0f514ebbf69d04ab5` · 2026-10-06T13:35:48Z
A9: comprobación → `tests/scrum1475-el-parte-trae-su-aviso-a-la-vista.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Una línea de conducta en `public/dashboard/js/parteDetailView.js` (`avisarCampoNoGuardado`): sin marcado, sin clases, sin estilos y sin tokens nuevos. El desplazamiento es el de la página (`scroll-behavior` de `html`, que ya se anula con `prefers-reduced-motion`).

6-oct-2026 · **S4** · rama `scrum-1475-el-parte-trae-su-aviso-a-la-vista`. Lo abrió S2 midiendo SCRUM-1464.

**Gemelo: SCRUM-1464 (b), de S2 — la reserva de la página (`scroll-padding-top` y `scroll-padding-bottom` de `html`). Ninguno de los dos se cierra sin el otro.** Esta rama lleva sólo la mitad del parte; sola no cumple la aceptación (abajo, fila «sólo la línea»). La de S2 va en el PR #2217, abierto y sin mergear a las 13:38Z.

## Qué cambia

`avisarCampoNoGuardado` cuelga el aviso y, después, lo trae: `aviso.scrollIntoView({ block: 'nearest' })`. Va detrás de abrir su línea plegada y de colgarlo. `nearest`: si el aviso ya se ve entero la página no se mueve.

## Medido en yaqu.app

Sonda `D:\MILLONARIO\cobroFlash\tmp-s4-1475\qa1475.mjs` (fuera del repo). Cuenta QA (merchant 46, comprobado dentro de la página), parte 9. Cuatro ventanas (320×568, 360×640, 390×844, 1280×800) por tres casos: 12 filas por pasada, 0 rotas en las tres pasadas. El 500 del `PATCH` lo pone la sonda; nada que no sea GET sale (control del interceptor antes de tocar: cortado).

**La sonda no desplaza nada después del cambio.** Coloca la página antes, con `scrollTo`, y desde el `change` sólo mira. Un espía puesto antes de cargar apunta cada `scrollIntoView` de la página: la columna «quién lo trae» sale de ahí.

- **A** · «Notas» con su borde inferior a 4 px del final de la ventana; el guardado falla.
- **B** · «Entrada» falla con el `PATCH` tardando 1,2 s; mientras, la página se baja del todo. El aviso nace por encima de la ventana.
- **C** · «Notas» con su borde superior a un tercio de la ventana.

| qué se sirve | A (4 ventanas) | B (4 ventanas) | C (4 ventanas) | quién lo trae |
|---|---|---|---|---|
| producción tal cual (build `6aaec0dc`) | fuera de la ventana, 0 px dentro | fuera, por encima | entero; el «?» pisa letras en las tres de móvil (16×2, 33×2, 3×2) | nadie (0 llamadas) |
| sólo la línea (este PR) | entero; el «?» pisa letras en móvil (16×16, 33×16, 3×16) y 44×28 de caja a 1280 | bajo la cabecera fija: tapa 56 de 63 px (36 de 42 a 1280) | igual que producción, la página no se mueve (0 px) | el aviso, `{"block":"nearest"}`, 12 de 12 |
| la línea + la reserva de S2 (`72px / 80px`) | **entero y libre** | **entero y libre** (aviso en y = 66) | **entero y libre** (la página sube 41–54 px) | el aviso, 12 de 12 |

La primera fila es el control positivo de la sonda: con el fichero de producción lee el defecto y cero llamadas. La reserva de S2 se sirvió desde su commit `3623a2f0889a69d134e65f273453e9dadd903a6c` (su `styles.css` sólo difiere del de `main` en esa regla).

El foco: tras el fallo queda en `body` en las 36 filas, con la línea y sin ella. Lo pierde el repintado, que ya estaba; traer el aviso no lo cambia.

Producción desplegó `fdac6867` a mitad de la tercera pasada. No toca ninguno de los dos ficheros servidos.

## El test

`tests/scrum1475-el-parte-trae-su-aviso-a-la-vista.test.mjs`, cinco tests sobre la vista de verdad en el banco. El banco no maqueta: se sujeta la llamada — quién la recibe, con qué opciones y en qué momento (ya colgado, con su línea abierta).

- Contra la vista de antes: 3 rojos de 5 (los dos verdes son los controles «no se mueve»).
- Siete mutantes de la vista, los siete mueren, y la base pasa (`tmp-s4-1475\mut1475.mjs`, con el `numstat` de cada inyección): sin la línea · antes de colgarlo · `start` · se trae el paso y no el aviso · la línea se abre después · sin opciones · se trae también cuando el guardado sale bien.

**Lo que salió mal y cómo queda sujeto.** En la primera pasada el séptimo mutante vivía: el control «un guardado que sale bien no mueve la página» sólo espiaba los nodos creados con `createElement`, así que no veía la ficha ya pintada. Ahora el espía cubre también todo lo que hay en el documento al acabar de montar, con su suelo (más de 20 nodos). Su límite está escrito en el test: lo que nazca de un repintado posterior no lo ve.

## Sin medir

- Un móvil de verdad, con el teclado en pantalla.
- Los otros avisos de la ficha del parte y los del albarán: sólo «Notas» y «Entrada».
- El caso C en producción hoy ya deja el «?» sobre letras sin que nada falle de nuevo; lo arregla la reserva de S2, no esta rama.
