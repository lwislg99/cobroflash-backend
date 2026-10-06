# SCRUM-1464 · El final de cada pantalla deja sitio al botón de ayuda, también en escritorio

**Medido contra:** `origin/main` = `ebd15a90618ea5da432485c048e9b170a221c9b6` · 2026-10-06T12:20:27Z
A9: comprobación → `tests/scrum1464-hueco-para-el-boton-de-ayuda.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Una regla en `public/dashboard/css/styles.css` (`.view-container`): sin marcado, sin clases nuevas, sin tokens nuevos.

6-oct-2026 · **S2** (`s2-6octb`) · rama `scrum-1464-hueco-para-el-boton-de-ayuda`. Lo abrió S4 al ver en producción el aviso de SCRUM-1302-B con el botón «?» encima. El botón (`#tut-help-btn`, `tutorial.js`) es de S2.

## Lo que el ticket dejó sin medir, medido

Sonda `sondas-s2/fab-tapa.mjs` (fuera del repo), en yaqu.app, cuenta QA 46, parte 9, build `ebd15a90`. El fallo de guardado lo simula la sonda (contesta 500 al `PATCH`); nada que no sea GET sale, y se comprueba antes. Mide el texto pintado (`Range`) contra el botón, no sólo la caja.

**¿En escritorio el botón tapa letras del aviso, o sólo el fondo? Sólo el fondo.** El texto acaba en x = 649 y el botón está en x = 1212–1260.

| ventana | página | antes: de la caja del aviso | antes: de sus letras | después: de la caja | después: de sus letras |
| --- | --- | --- | --- | --- | --- |
| 1280×800 | bajada del todo | 44×29 | nada | **nada** | nada |
| 1280×600 | bajada del todo | 44×29 | nada | **nada** | nada |
| 390×844 | aviso recién traído a la vista | 48×44 | **3×16** | 48×45 | **3×16** |
| 390×844 | bajada del todo | nada | nada | nada | nada |
| 360×640 | aviso recién traído a la vista | 48×46 | **33×16** | 48×45 | **33×16** |
| 360×640 | bajada del todo | nada | nada | nada | nada |

«Después» = el `styles.css` de esta rama servido por la sonda sobre producción.

## La causa

El botón es fijo: 48 px, a 20 del borde inferior. Ocupa 68 px desde abajo. `.view-container` reservaba 80 y 88 px en móvil (con su motivo escrito en la hoja) y **24 en escritorio**. Con 24, lo último de una pantalla bajada del todo queda debajo del botón y no hay más recorrido.

## Qué cambia

`.view-container` pasa de `padding: 24px` a `padding: 24px 24px 80px` (80 = 20 + 48 + 12 de aire). Es la regla de TODAS las pantallas en escritorio.

## El censo que faltaba: las 27 pantallas, bajadas del todo, a 1280×800

Sonda `sondas-s2/fab-censo.mjs`: en cada pantalla, qué texto y qué controles quedan debajo del botón con la página al final.

- **Antes:** texto debajo del botón en **1 de 27**: la ficha del parte («Sin notas», su última línea). Controles, en ninguna.
- **Después:** en ninguna.
- **Ninguna pantalla que cabía entera gana barra de desplazamiento** (las 14 sin recorrido siguen sin él). Las que ya lo tenían crecen 56 px.
- Tres filas no cuentan: en la ficha del presupuesto y en proveedores (después) y en la ficha del Trabajo (antes) la página cambió de alto mientras se medía y la sonda no quedó abajo del todo. Lo dice ella (`abajoDelTodo: false`).

🔴 **La primera versión de este censo midió mal y lo parecía todo menos eso.** El panel tiene desplazamiento suave: `scrollTop = …` no baja en el acto, así que midió las 27 pantallas ARRIBA DEL TODO y dio dos «hallazgos» (dos botones «Ir →» en Inicio, el rótulo «Total» del presupuesto) que eran sólo lo que pasa por debajo de cualquier botón flotante a mitad de página. Lo destapó que el «después» saliera idéntico al «antes». Ahora baja con `instant` y comprueba que ha llegado.

## Lo que este cambio NO arregla, y queda abierto

- **En móvil, con el aviso recién traído a la vista, el botón sigue tapando letras** (3×16 px a 390; 33×16 a 360). Bajando 100 px se libera, igual que antes. No es de relleno: es que el botón flota sobre lo que haya en esa esquina mientras se pasa por ella. Quitarlo pide otra decisión (apartar el botón cuando hay un aviso, o que el aviso se traiga a la vista por encima de él), y no está tomada.
- El botón tapa lo que pase por debajo a mitad de página, en cualquier ancho. Es lo propio de un botón flotante; no se ha medido como defecto.

## Lo que NO se ha podido mirar

- Otros avisos al final de otras pantallas: el censo es de las pantallas en reposo, con los datos de la cuenta QA. Sólo se ha provocado el aviso del parte.
- Un iPhone, con su barra inferior.
- Desplegado: «después» es el fichero de la rama servido por la sonda.

## Verificado, ejecutando

`tests/scrum1464-hueco-para-el-boton-de-ayuda.test.mjs`, 3 casos. Lee de `tutorial.js` lo que ocupa el botón (68 px) y exige que toda regla de `.view-container` reserve al menos eso.

- **Con el `styles.css` de `origin/main`: 1 rojo** (los 24 px) y 2 verdes.
- **Con el de la rama: 3 de 3.** Lleva su control positivo.

# APÉNDICE · SCRUM-1464b · Lo que se trae a la vista no acaba debajo del botón de ayuda (S2)

**Medido contra:** `origin/main` = `eb1fdefaf9e660bd706e1fbba31c90f868343ad1` · 2026-10-06T12:52:23Z
A9: aviso → cicatriz S2 «Medí un aviso que mi propia sonda había traído a la vista y lo conté como lo que ve el técnico: el producto no lo traía, y nadie midió la pantalla sin ese empujón.» — no se pudo comprobar: la sonda de navegador vive fuera del repo; desde hoy mide primero el momento «tal como queda», sin desplazar ella

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Una declaración en la regla `html` de `public/dashboard/css/styles.css` (`scroll-padding-bottom`): sin marcado, sin clases nuevas, sin tokens nuevos, sin texto.

6-oct-2026 · **S2** · rama `scrum-1464b-lo-traido-a-la-vista-no-cae-bajo-la-ayuda`. Decisión del orquestador (relato suyo en el encargo, no cita de Jira): «el aviso se trae a la vista por encima del botón; el botón no se mueve».

## 🔴 Lo primero: la premisa de la decisión no se sostenía, y el fallo es mío

La fila «aviso recién traído a la vista» de arriba (y la del ticket) describe un estado que **provocó la sonda**: `fab-tapa.mjs` llamaba ella a `scrollIntoView({ block: 'nearest' })` sobre el aviso antes de medir. **El producto no trae ese aviso a la vista**: `avisarCampoNoGuardado` (`parteDetailView.js`, de S4) lo cuelga debajo del campo y no desplaza nada. Lo medido arriba es lo que pasaría SI algo lo trajera.

Sonda nueva, `sondas-s2/fab-aviso.mjs` (fuera del repo): mide primero «tal como queda», sin desplazar ella. En yaqu.app, cuenta QA 46, parte 9, build `eb1fdefa`; el 500 del `PATCH` lo pone la sonda y nada que no sea GET sale (control positivo antes de tocar). Población: 4 ventanas (390×844, 360×640, 1280×800, 1280×600), campo «Notas».

**Tal como queda hoy en producción: el aviso cae casi entero FUERA de la ventana en 4 de 4** (asoman 13 px de su caja en móvil y 5 en escritorio; su texto no entra entero en ninguna). ⚠️ Esa posición depende de dónde estaba el campo al tocarlo, y en la sonda lo coloca Playwright al borde inferior: es UNA posición posible, no «lo que ve siempre el técnico». Lo que sí es fijo: nada lleva la página hasta el aviso.

## Qué cambia

`html { scroll-padding-bottom: 80px; }`. Al traer algo a la vista, el navegador da por ocupados los 80 px de abajo —los mismos que reserva `.view-container`— y lo deja por encima del botón. Es de la página (la que se desplaza es `document.scrollingElement`), no de cada aviso. **No desplaza nada por sí solo.**

## Medido: las dos mitades, por separado y juntas

«La línea de S4» = `if (aviso.scrollIntoView) aviso.scrollIntoView({ block: 'nearest' })` tras colgar el aviso, **servida por la sonda** sobre una copia de `parteDetailView.js`. No está en esta rama ni en ninguna: el fichero es de S4.

| qué se sirve | 390×844 | 360×640 | 1280×800 y 1280×600 |
| --- | --- | --- | --- |
| producción tal cual | aviso casi fuera | aviso casi fuera | aviso casi fuera |
| sólo la línea de S4 | entero, **pisa letras 3×16** | entero, **pisa letras 33×16** | entero, pisa 44×28 de caja (letras no) |
| sólo esta regla | donde caiga (no lo trae nadie) | donde caiga | donde caiga |
| **las dos** | **entero y libre** | **entero y libre** | **entero y libre** |

Y con esta regla sola, cuando lo trae la sonda (`nearest`): libre en 4 de 4 (antes: letras 3×16 y 33×16 en móvil, 44×22 de caja en escritorio).

**El caso de escritorio de arriba no se rompe:** página bajada del todo, aviso libre en las 4 ventanas, igual que antes; y el censo de las 27 pantallas a 1280×800 (`fab-censo.mjs`, con el CSS de esta rama): 27 de 27 abajo del todo, texto bajo el botón en 0, controles en 0.

## 🔴 Lo que este cambio NO arregla, y queda abierto

- **El técnico sigue sin ver el aviso si el campo estaba abajo.** Falta la mitad de S4 (que el parte traiga su aviso): ticket gemelo, citado en Jira SCRUM-1464. **Este ticket no se cierra sin su gemelo hecho o declarado.**
- **Por arriba no hay reserva, y hace falta una decisión.** Si el aviso queda POR ENCIMA de la ventana y algo lo trae, acaba en y = 0–62 (móvil) y 0–42 (escritorio), **debajo de la cabecera fija** (`header.topbar`, 0–60): tapado entero en 4 de 4. Medido con el campo «Entrada», la página bajada del todo y la línea de S4 servida. El arreglo sería un `scroll-padding-top`, pero su medida no está decidida y no la he puesto.

## Lo que NO se ha podido mirar

- Los 12 sitios del panel que ya llaman a `scrollIntoView` (leídos, no ejecutados): 5 con `nearest`, 5 con `center` (quedan 40 px más arriba), 2 con `start` (esta regla no les afecta). Ni el foco del teclado.
- Un móvil de verdad: con el teclado en pantalla el campo no está donde lo deja la sonda.
- Desplegado: «después» es el `styles.css` de la rama servido por la sonda sobre producción.

## Verificado, ejecutando

`tests/scrum1464-hueco-para-el-boton-de-ayuda.test.mjs`, 5 casos (los 3 de antes y 2 nuevos): toda regla de `html` con `scroll-padding-bottom` reserva al menos lo que ocupa el botón (68 px), y tiene que haber una.
