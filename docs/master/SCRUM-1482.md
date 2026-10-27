# SCRUM-1482 · El buscador y la cabecera de la ficha dejan de enseñar el id de la tabla del presupuesto

**Medido contra:** `origin/main` = `bafb07340557298cd5bfde943d81ade8823d4a78` · 2026-10-06T19:29:37Z
A9: sin fallo que generalice — el primer rojo del buscador fue del banco y no del producto (el término buscado se envolvía en `<mark>` y el banco no suma el texto de los hijos); lo paró el control «CIEGO» del propio test antes de tocar código

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Dos ficheros de `public/dashboard/js` (`quotesDetailView.js`, `globalSearch.js`): cambia QUÉ texto se pinta en dos nodos que ya existían; sin marcado nuevo, sin clases, sin estilos, sin tokens.

6-oct-2026 · **S2** (`s2-6octh`) · rama `scrum-1482-el-panel-no-ensena-el-id-de-la-tabla`. Lo abrió S2
(`s2-6octf`) con su medición en yaqu.app. Gemelo: SCRUM-1483 (S1), en `main` y desplegado.

## Qué entra y qué NO

| Sitio | Antes | Ahora | Estado |
|---|---|---|---|
| Buscador de arriba (`globalSearch.js`) | `#205`, el id de la tabla | el texto que manda el servidor (`numeroVisible`: `#4`, `#4.1`); sin él, ningún número | **hecho** |
| Cabecera de la ficha, mientras carga y si la carga falla (`quotesDetailView.js`) | «Presupuesto #205» | la palabra de `appLocale.quote`, sola | **hecho** |
| Cabecera y título, cargada | «Presupuesto #4» | igual | sin tocar |
| **Título de la vista, mientras carga y si falla** (`app.js`, el router) | «Presupuesto #205» | **igual: sigue enseñando el id** | 🔴 **NO HECHO** |

Las aceptaciones 2 y 3 del ticket quedan **a medias**. El ticket no se cierra con esta entrega.

## Las firmas

- **El literal de la cabecera:** orquestador por delegación permanente, SCRUM-1482 c.18490, sobre la
  propuesta de S2 en c.18482. Registro: `docs/microcopy/2026-10-06-SCRUM-1482-ficha-sin-numero-mientras-carga.md`.
- **El buscador no lleva texto nuevo:** pinta el del servidor (SCRUM-1444 c.18429, «no se compone
  nada en el front»). Sin `numeroVisible` no pinta número: es una ausencia, no un literal. Que ahí
  deba leerse otra cosa no está firmado, y SCRUM-1483 lo dejó dicho.

## 🔴 Por qué el título de la vista no entra

El literal firmado para el título mientras carga es «Presupuesto», sin `#`. El caso 7 de
`tests/scrum832-atras-vuelve-a-la-lista.test.mjs` («el router escribe el título que la ficha sabe
CORREGIR») exige dos cosas del FUENTE:

1. que `quotesDetailView.js` corrija el título con una regex anclada sobre `viewTitleEl`; y
2. que el `case 'quotes-detail'` de `app.js` contenga, entre comillas, el mismo prefijo que esa
   regex: hoy `'Presupuesto #'`.

Con (2), el router tiene que escribir «Presupuesto #» y algo detrás antes de que exista la
respuesta, y lo único que tiene entonces es el id de la ruta. El literal firmado y ese caso no caben
a la vez. Medido por `s2-6octg` (SCRUM-1482 c.18498): con el literal puesto y la regex intacta, el
caso cae **y además** el título se queda sin número para siempre al cargar; «cuadrar la regex» deja
el número de OTRO presupuesto en el título.

Sustituir ese caso está denegado a este puesto y la denegación no la levanta el orquestador. No se
ha dejado un `'Presupuesto #'` sin uso en el router para que el caso pase: sería conseguir lo mismo
por otro camino. **Queda pedido en el ticket**, con qué mide hoy ese caso y qué debería medir.

## Cómo se ha medido

`tests/scrum1482-el-panel-no-ensena-el-id-de-la-tabla.test.mjs`: 8 casos que EJECUTAN los dos
ficheros en el banco de vistas (`_banco-vistas.mjs`), con un presupuesto de id 205 y número 4.

| Tanda | Código | Resultado |
|---|---|---|
| antes | `origin/main` `bafb0734` | 8 casos · 2 pasan (los dos CONTROL) · **6 caen** |
| después | esta rama | 8 casos · 8 pasan · 0 saltados |

Los 6 que caían son exactamente los que miran el id: cabecera mientras carga, cabecera con otro
locale, cabecera con la carga fallida, y las tres filas del buscador. Los dos controles (cargada →
«Presupuesto #4» en cabecera y título; pulsar la fila abre la ficha 205) pasan antes y después.

En yaqu.app, antes de este cambio (build `bafb0734`, cuenta QA 46, sólo GET, sonda
`sondas-s2/id-global.mjs`, fuera del repo): el servidor ya manda `numeroVisible` y buscar «205» ya
no devuelve nada (SCRUM-1483), y la fila seguía pintando «#205».

## Lo que NO se ha medido

- **Nada de esta rama en yaqu.app:** no está desplegada. Cuando lo esté: `id-global.mjs` (fila
  «búsqueda») e `id-ficha.mjs`, sin argumento.
- **El router no se ejecuta en el banco.** En el caso «cargada» el título se siembra con lo que el
  router escribe hoy; el recorrido entero es de navegador.
- **Otro país en producción:** la cuenta QA es de España. Que la palabra sale del locale está
  ejecutado en el banco con un locale de «Cotización», no visto en una cuenta real.
- Móvil. Otro navegador.

## Lo que queda fuera, nombrado

- El título de la vista (arriba).
- Un presupuesto SIN número: la ficha cargada cae al id (`quote.number ?? id`). Familia de 12
  líneas nombrada en la descripción del ticket.
- La cabecera cuando el id de la ruta no es un número («Presupuesto #-»): intacta, no entra en la firma.
- Los «Presupuesto» escritos a mano: SCRUM-1487. Leído de paso y no contado allí: el botón
  «← Volver» de la ficha escribe «Presupuestos» a mano en el título (`quotesDetailView.js`).

## SCRUM-1482b · el título de la vista deja de enseñar el id de la tabla (13-oct, S2)

**Medido contra:** `origin/main` = `97618f169b3b4f71e384600b3d0720d7e502fea9` · 2026-10-13T11:24:48Z

A9: sin fallo que generalice — leí el literal de las reglas 39, 40 y 41 del máster con el instrumento y el cambio ya en commits locales (antes de empujar, no antes de la primera línea, que es lo que manda `CLAUDE.md`); releídas, no cambian nada de lo hecho

**Sesión:** S2 (`s2-13oct`, primera tanda) · carril: `public/dashboard/js/app.js` y
`public/dashboard/js/quotesDetailView.js` son de S2 (`node scripts/carriles.mjs de …`).
**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Cambia QUÉ texto escribe
el router en un nodo que ya existía, y cómo lo reconoce la ficha: sin marcado nuevo, sin clases, sin
estilos, sin tokens. Sección AÑADIDA: lo de arriba no se toca, y su fila «🔴 NO HECHO» y su apartado
«Por qué el título de la vista no entra» quedan como historia del 6-oct.

**Qué pasaba** (visto en yaqu.app el 13-oct, build `9358f02b`, presupuesto de id 206 y número 5):
al abrir la ficha, el título de la vista decía «Presupuesto #206» mientras cargaba, y se quedaba
así si la carga fallaba. La pestaña del navegador decía «Presupuesto #206 · YaQu» siempre, también
con la ficha cargada. El 206 es el id de la tabla, de toda la plataforma.

**Qué cambia.** Dos líneas:

1. `app.js`, `case 'quotes-detail'`: el router escribe `L.quote`, la palabra del documento, sola
   (antes, `'Presupuesto #' + state.quoteId`). Es el literal firmado en SCRUM-1482 c.18490, el mismo
   que la cabecera lleva desde el 6-oct.
2. `quotesDetailView.js`: la ficha, al cargar, corrige el título si sigue MONTADA (SCRUM-1495) y el
   título es EXACTAMENTE esa palabra (antes, si casaba con `/^Presupuesto #/`). Un título que ya
   lleva su número, o el de otra vista, no se toca.

La pestaña del navegador sale de ese mismo título (`document.title`, al final del router): pasa a
«Presupuesto · YaQu», como «Trabajo · YaQu» o «Factura · YaQu». Sin texto nuevo.

**La firma.** Ninguna nueva: SCRUM-1482 c.18490 (orquestador, por delegación permanente) firmó la
palabra sola «para el título de la vista y la cabecera de la ficha». Registro:
`docs/microcopy/2026-10-06-SCRUM-1482-ficha-sin-numero-mientras-carga.md`, con su nota de hoy.

### 🔴 El caso 7 de `scrum832` se ha CAMBIADO, y con qué permiso

El apartado de arriba dice que sustituirlo estaba denegado. Lo que consta escrito: el «no» lo dio el
orquestador en sus encargos del 6 y del 7-oct (SCRUM-1482 c.18521). El 9-oct lo levantó él mismo
(c.19093, transcrito por S4: «el caso 7 se CAMBIA, no se rodea… con su motivo escrito en el propio
test y con su control positivo»), y el 13-oct me lo repite en mi encargo. S4 buscó otra denegación
(del fundador o del sistema de permisos) y no encontró ninguna; yo tampoco, y la edición del fichero
no la ha parado nada. Regla 41: no es una edición de paso; se paró y se dijo el 6-oct, con qué mide
y qué debería medir (c.18534).

- **Qué exigía:** que el router llevara escrito, entre comillas, el prefijo de la regex de la ficha
  («Presupuesto #»). Eso obliga a escribir un número antes de saberlo. Exigía el defecto.
- **Qué exige ahora** (mismo nombre, mismo propósito): EJECUTA el enganche. Saca del router de
  verdad el título que escribe, monta la ficha de verdad sobre él y exige que mientras carga no
  lleve ni el id ni una almohadilla, y que cargada diga «‹palabra› #‹número›», en España y con un
  locale de «Cotización». Sale CIEGO si no encuentra la expresión del router.
- **No es más laxo:** el viejo no veía un título cruzado ni uno sin corregir con las dos cadenas en
  su sitio. El nuevo cae con 5 de los 7 mutantes de abajo.

**Desviación DECLARADA: tres tests más cambian su PREPARACIÓN, no lo que exigen.**
`scrum1482`, `scrum1487` y `scrum1495` sembraban el título de la vista con una cadena copiada a mano
de lo que escribía el router («Presupuesto #» + id). Con el router cambiado habrían seguido en verde
midiendo un panel que ya no existe, o en rojo por su copia. Ahora los cuatro toman el título de
`tests/_titulo-provisional-del-router.mjs`, que busca por AST el `case 'quotes-detail'`, evalúa la
expresión que asigna a `viewTitle.textContent` con `state` y `L`, y falla cerrado (lanza si no hay
exactamente un `case` y una asignación, o si la expresión nombra otra cosa). Cada test lleva la
fecha y el motivo en su cabecera. En `scrum1495`, dos aserciones que decían «el título se queda como
lo dejó el router» comparan ahora con ese título, no con la cadena vieja.

### Pruebas de SCRUM-1482b

- **Rojo primero** (instrumento comiteado antes que el código, `ca69fd3b1973361efc2b0421e1f575b10ad053d7`):
  con el código de `main`, 27 casos · 23 pasan · **4 caen**: los tres «título de la vista» nuevos de
  `scrum1482` y el caso 7 de `scrum832`. Con el cambio: 27 de 27.
- **Mutantes** (`evidencias/SCRUM-1482/mutantes-1482b.mjs` y `salida-1482b-mutantes.txt`; base sin
  mutar 27 de 27; cada uno con su `git diff --numstat`): **7 de 7 mueren, 0 ciegos.** El código de
  antes, 4 casos · router nuevo con ficha vieja (el título sin número para siempre de c.18498), 8 ·
  router viejo con ficha nueva, 11 · la palabra escrita a mano en el router, 3 · la ficha sin mirar
  si sigue montada, 2 · la ficha corrigiendo cualquier título, 1 · el router con una almohadilla
  suelta, 11.
- **Navegador, sobre yaqu.app** (cuenta QA, 5 presupuestos, los 5 con número distinto de su id;
  sólo GET, control del interceptor antes de pulsar; `evidencias/SCRUM-1482/`). La sonda sirve los
  dos ficheros de la rama encima de producción e imprime un testigo de que lo servido es lo que se
  ejecuta. A = id 206 / número 5 · B = id 205 / número 4.

| escenario | producción (`9358f02b`) · título · pestaña | la rama · título · pestaña |
|---|---|---|
| mientras carga A | «Presupuesto #206» · «Presupuesto #206 · YaQu» | «Presupuesto» · «Presupuesto · YaQu» |
| A cargada | «Presupuesto #5» · «Presupuesto #206 · YaQu» | «Presupuesto #5» · «Presupuesto · YaQu» |
| la carga de A falla | «Presupuesto #206» · «Presupuesto #206 · YaQu» | «Presupuesto» · «Presupuesto · YaQu» |
| se va a Inicio mientras A carga | «Inicio» | «Inicio» |
| abre A (lenta) y luego B, que falla | «Presupuesto #205» | «Presupuesto», nada de A |
| abre A (lenta) y luego B, que carga | «Presupuesto #4» · «Presupuesto #205 · YaQu» | «Presupuesto #4» · «Presupuesto · YaQu» |

  Con la palabra del locale forzada a «Cotización» por la sonda (simula otro país, no lo es): las
  seis filas igual, con «Cotización» y «Cotización #5».
- **Dirigida** (los ficheros de `tests/` que nombran lo tocado, el banco de vistas, los registros,
  la microcopy o las evidencias: **562 de 1.310**, en 6 lotes): 4.918 casos · **4.836 pasan · 1
  cae · 81 saltos**. El que cae es del entorno, no del cambio: `scrum476` hace `realpath` de un
  worktree de OTRA sesión que git tiene registrado y cuya carpeta no existe en ese momento; había
  pasado en la primera pasada. `guards:entrada`: 13 guards, 158 tests, verde.
- **Un rojo mío en la primera pasada, arreglado en el código:** `scrum601` ancla un control POR
  POSICIÓN (`app.js`, línea 386, el rótulo «Facturas»), y mi comentario metía 7 líneas por encima.
  No se ha reanclado el control: los comentarios de las dos líneas ocupan ahora exactamente las
  líneas que ocupaban (`git diff --numstat`: `5 5` y `8 8`), y el control sigue donde se midió.
- **Visto de paso, no tocado:** `scrum1266b` (un caso de `quotesView.js`, que esta rama no toca)
  cayó UNA vez dentro de un lote y pasa solo (15 de 15) y en la segunda pasada del mismo lote.
- 🔴 **Sin `tsc`:** este cambio no toca `src/`. La suite completa la corre el obligatorio.

### Lo que NO hace, y se dice

- **La pestaña del navegador no lleva el número del presupuesto ni con la ficha cargada.** Antes
  llevaba el id; ahora, la palabra sola. Que diga «Presupuesto #5 · YaQu» es función nueva y otra
  decisión (SCRUM-1482 c.19079).
- **Con otro país, los avisos de la ficha siguen diciendo «presupuesto»** («Cargando presupuesto…»,
  «Error cargando presupuesto.») bajo un título «Cotización»: c.18490 dice que el aviso no se toca.
- Un presupuesto SIN número: la ficha cargada sigue cayendo al id (`quote.number ?? id`). Fuera.
- «Sin cotización seleccionada» (`app.js`, mismo `case`, cuando no hay id): escrito a mano, nombrado
  por S4 en c.19078. No tocado: es otro texto.

### No visto en yaqu.app

Hasta que la rama entre y se despliegue. El paso exacto: `node sondas-s2/id-ficha.mjs` sin argumento
(copia en `evidencias/SCRUM-1482/sonda-1482b-id-ficha.mjs`); el testigo tiene que decir
`conPalabraExacta: true` y las filas, lo de la columna derecha.
