# SCRUM-916 · el parte de trabajo, pensado para el técnico en la obra

Registro del ticket paraguas. Cada tramo lleva su letra.

## SCRUM-916b · «+ Añadir línea» añade siempre, y la fila se asienta en su sitio

**Medido contra:** `origin/main` = `8e0d408168865aab0c7862d7c004cf864450aa71` · 2026-11-24T09:35:49Z (cabecera `Date:` de `gh api -i zen`)

A9: aviso → cicatriz S4 «Conté lo que devuelve `[data-x]` después de un `removeAttribute` y seis aserciones mías salieron rojas sobre código bueno: en el banco de vistas ese selector lee `dataset`, que `removeAttribute` no limpia.» — no se pudo comprobar: el banco es del carril de S3 (SCRUM-1821 abierto); hasta que `removeAttribute` limpie `dataset`, ningún test distingue las dos preguntas

Mutaciones: catálogo → `tests/scrum916b-anadir-linea-anade-siempre.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`, antes de tocar la vista). AB6: sin componente, sin color, sin clase y sin texto nuevos; cambia el comportamiento de un botón que ya existía. **Microcopy:** ninguna.

Puesto S4, rama `scrum-916b-anadir-linea`, worktree `s4-18nov-r42`. Versión 1 (SCRUM-1817, puesto 2).

Orden del fundador, dos veces, literal: «esto de añadir lineas sigue roto cogelo como lo tenemos en presupuesto si no pruebalo con playwright para ver como funciona y entiendas que falla».

### Qué pasaba (medido, no leído)

`docs/master/evidencias/SCRUM-916/b-anadir-linea/reproducir.mjs` abre el parte en un navegador real y lo pulsa como una persona: dedo a 390 px, ratón a 1280 px, con el servidor contestando a 0 y a 150 ms. Re-medido el 24-nov sobre el `main` de arriba, igual que el 20-nov, en las cuatro combinaciones:

- Con una fila escrita y el cursor en la descripción, pulsar «Añadir línea» **guardaba** (1 `PATCH` y una relectura) y **no abría fila nueva**. El foco quedaba en ningún sitio y lo tecleado a continuación se perdía. Hacía falta un segundo clic.
- A 1280 px con el servidor a 0 ms el clic **ni llegaba** al botón: la ficha se repintaba entre bajar y subir el ratón y el botón ya era otro nodo (1 clic llegado de 2).
- Con una fila a medias (sólo la cantidad), **los dos botones** —también el de materiales— sólo devolvían el foco a esa fila.

La causa común: había UNA sola fila por escribir, y cada guardado repintaba la ficha entera.

El editor de presupuestos, medido con el mismo instrumento: cada clic añade una fila y enfoca su concepto, cero escrituras, y los nodos de las filas anteriores son los mismos.

### Qué se ha hecho

En `public/dashboard/js/parteDetailView.js`, y sólo ahí:

1. **Cada pulsación pone una fila vacía** al final de su bloque, con el cursor en su UNDS. Conviven todas las que se pidan; ninguna bloquea ningún botón.
2. **Cada fila se guarda por su cuenta** al salir de sus casillas (misma regla de SCRUM-889: cantidad mayor que cero y descripción; lista entera en el `PATCH`). Su estado va en la propia fila, no en una variable de la ficha.
3. **Al volver la respuesta no se repinta la ficha: la fila se asienta.** El mismo `<tr>` pasa a ser la línea guardada (cambia sus marcas a las de una línea con índice y estrena el cable de las guardadas). Lo que se ve es lo que devolvió el servidor, salvo en la casilla que el técnico haya seguido escribiendo mientras el guardado viajaba: ésa no se pisa y se guarda al salir de ella.
4. **El aviso de «no se guardó» va detrás de su fila** (literal ya aprobado, `noSeGuardo`), y cada pulsación de «Añadir línea» reintenta las filas completas que sigan sin guardar.
5. **Si la respuesta no cuadra con lo mandado** (otro largo, otro bloque, otro `id`), no se adivina: se repinta entera, como antes.
6. **Un repintado ya no se lleva las filas por escribir.** La ficha se repinta entera por otros caminos (quitar una línea guardada, un campo que no se guardó, una firma confirmada, lo dictado que entra). Ahora `renderParteDetailView` recoge las filas por escribir de ese parte justo antes de repintar y las vuelve a poner después, con lo tecleado. Una que estaba en cola se guarda en la ficha nueva; una cuyo `PATCH` estaba fuera no se repite (saldría duplicada): vuelve bloqueada hasta saber el desenlace.
7. **El paso de las firmas se pone al día sin repintar** cuando un parte vacío recibe su primera línea: deja de estar «en espera» y la pista cambia a la de la primera firma. Antes eso lo hacía el repintado.

Cero textos nuevos. No se tocan los candados de firma, el dictado ni la hoja de estilos.

### Decisiones mías que el diseño heredado no traía, declaradas

- **La fila se convierte, no se sustituye.** El diseño del 20-nov cambiaba el `<tr>` por uno recién pintado. Lo cambié al medir un caso que eso rompía: si el técnico vuelve a una casilla y sigue escribiendo mientras el guardado viaja, sustituir el nodo le quita el foco y pisa lo que escribe. Convertir el mismo nodo lo conserva.
- **La fila asentada no se mueve.** Si se rellenan en otro orden que el de pantalla, el orden del servidor se ve en el siguiente repintado. Los índices van en los atributos, no en la posición, así que nada de lo que se guarda depende de eso.
- **Desaparece la «mudanza»**: antes, una fila vacía en un bloque saltaba al otro al pulsar su botón. Con varias filas no tiene sentido; cada botón añade en el suyo.
- **La «×» de una fila cuyo `PATCH` está fuera no hace nada** hasta que vuelve: un instante después es una línea guardada y su «×» la quita del servidor.
- **`pistaDeLasFirmas`** sale de `pintarLasDosFirmas` sin cambiar una letra, para que la pista tenga un solo marcado. El marcado que pinta el paso de las firmas es idéntico.
- **Fila-fantasma automática:** en el parte no existe (cero coincidencias de «fantasma» en la vista sobre el `main` de arriba). La única fila que aparece sola es el hueco «sin líneas» de un bloque vacío, que se conserva y se quita al añadir la primera fila, como antes. Confirmado con el orquestador.

### De paso (defecto mío de carril, arreglado en el momento)

- **Quitar una línea guardada y, antes de que volviera, completar una fila nueva, devolvía al servidor la línea recién quitada.** La «×» repintaba fuera de su turno en la cola de guardados, y la fila que esperaba armaba su lista con los índices viejos. Ahora el repintado va dentro del turno. Lo cubre el caso «una fila EN COLA detrás de otro guardado que repinta…».
- `quitarAvisoNoGuardada` quitaba la celda del aviso y dejaba su `<tr>` hueco; ahora quita el renglón.

### AUTORIZACIÓN NOMINAL (bloque literal del orquestador)

«AUTORIZACIÓN NOMINAL · 24-nov-2026 · scrum889 cambia su exigencia al patrón de presupuestos que el fundador señaló como el bueno (pre-autorizada en acta SCRUM-1656 §51 y SCRUM-916 c.22546; rojo visto: tanda de 19 con 18 pass · 1 fail, y el único fail es éste — "🔴 cada pulsación deja otra línea vacía · 3 !== 2", scrum889…test.mjs:193, medido sobre origin/main 8e0d40816 con la cura puesta). Fichero tests/scrum889-anadir-linea-del-parte.test.mjs, línea 187: el caso «SCRUM-889 · pulsar "Añadir línea" dos veces no deja dos líneas vacías» pasa a exigir lo contrario con nombre «…dos veces deja DOS líneas en las que escribir, y no escribe nada» — la intención: CADA pulsación añade exactamente UNA fila vacía más y enfoca, dos pulsaciones = dos filas nuevas escribibles, 0 escrituras al servidor por el clic. Los otros 7 casos de scrum889 siguen verdes SIN tocarse, incluido «se relee del servidor» (gets === 2). — firma del orquestador, c.21978»

Cómo quedó la aserción: mide el total tras las dos pulsaciones y exige lo que había al abrir más DOS (una por pulsación), las dos vacías y por escribir, y cero escrituras. Los otros siete casos de ese fichero no se han tocado.

### Aceptación → dónde se ve

| aceptación (del encargo) | dónde se ve |
|---|---|
| el clic SIEMPRE inserta una fila vacía nueva y pone el foco en su UNDS | navegador real: `docs/master/evidencias/SCRUM-916/b-anadir-linea/reproducir.mjs` (función `exigir`, sale 0) y `secuencia.json`, paso 3 de «despues» · banco: caso «con la fila escrita, UN clic…» |
| lo escrito NUNCA se pierde; se guarda por fila sin repintar la ficha entera | casos «guardar una línea NO repinta la ficha…», «lo que hay A MEDIAS…», «lo que se teclea MIENTRAS viaja…» y los tres de repintado ajeno |
| dos clics = dos filas vacías | caso «dos clics son dos filas vacías…» y el caso invertido de `tests/scrum889-anadir-linea-del-parte.test.mjs` |
| la fila-fantasma, decidida y declarada | arriba: no existe |
| sin tocar candados de firma, dictado ni textos | el diff: un solo fichero de producto; los 35 ficheros de test que nombran la vista, verdes |
| scrum889: la línea por nombre con su rojo antes del push | el bloque de arriba |
| test rojo-primero | `tests/scrum916b-anadir-linea-anade-siempre.test.mjs`: 11 casos, los 11 rojos sobre el `main` de arriba (cada uno por el motivo que nombra) y los 11 verdes con la cura |
| mutaciones al catálogo | 11 en el propio test; ejecutadas una a una en local con su base sin mutar: las 11 tumban el caso que declaran |
| capturas antes/después a 390 y 1280 | fuera de git, las saca `reproducir.mjs`: ocho PNG `antes-…` y `despues-…` en la carpeta `capturas/SCRUM-916/b-anadir-linea` de la máquina del equipo |
| visto en yaqu.app | NO HECHO → se mira al desplegar el merge; hasta entonces este tramo no se da por cerrado |

### Lo medido en el navegador con la cura (las cuatro combinaciones, igual)

Paso 3 —pulsar «Añadir línea» con la fila escrita—: la línea queda guardada, hay una fila nueva vacía, el foco está en su UNDS, 1 `PATCH`, **1 relectura en total** (la de abrir: ya no se relee) y el clic llega (2 de 2, también a 1280 px con el servidor a 0 ms). Lo tecleado a continuación cae en la fila nueva y la tercera pulsación lo guarda. Fila a medias: «4» sigue en su casilla tras pulsar los dos botones, y cada uno abre fila en su bloque.

### La tanda de antes del push

De `git grep -l parteDetailView -- 'tests/*.test.mjs'`: 35 ficheros, 299 casos, 299 verdes, 0 saltados. Más `npm run guards:entrada` y los de árbol entero que nombra al final.

### NO hecho / NO visto

- **La suite entera no se corrió en local.** El cliente de Prisma de este worktree es el compartido y va por detrás del esquema de `main` (el guard lo nombra: 12 campos), así que un `build` aquí no vale y no me toca regenerarlo. El cambio es de un fichero del panel y de tests que no pasan por `dist/`. La corre el check obligatorio del PR.
- **El foco no se puede exigir en el banco de vistas** (su `focus()` no hace nada). Se exige en el navegador real, que no corre en el CI.
- **Límite del banco** (SCRUM-1821, carril de S3): `removeAttribute` no limpia `dataset`. El test pregunta con `hasAttribute` y lo dice en su cabecera.
- **No tocado, y lo dejo dicho:** «Añadir al parte» del dictado guarda en su turno pero repinta fuera de él, como hacía la «×». Si alguien completa una fila a mano justo mientras lo dictado viaja, esa fila arma su lista sin las líneas dictadas. Es la misma familia que el «de paso» de arriba y ya estaba antes de este tramo. Leído en el código, no reproducido. No lo arreglé porque el encargo deja el dictado fuera.
- Nada contra staging ni producción.

## SCRUM-916c · r42 en vivo: «+ Añadir línea» visto en yaqu.app

**Medido contra:** `origin/main` = `44747663306139dc7513320efae02f9fd82fa437` · 2026-11-24T13:59:05Z

A9: aviso → cicatriz S4 «Mi guion de producción exigía «lo único cortado es mi control» y salió rojo sobre un panel sano: el panel manda por su cuenta `POST /admin/entorno` al cargar, y el interceptor también lo corta.» — no se pudo comprobar: el guion vive en evidencias, fuera de la tanda de tests

Puesto S4, rama `scrum-916c-r42-en-vivo`. Es la fila «visto en yaqu.app → NO HECHO» del tramo 916b, hecha. No toca producto: un guion, sus dos informes y diez capturas.

### Qué se miró y con qué

- **Dónde:** `https://yaqu.app`, cuenta de QA (negocio «PruebaQA»), parte en borrador `PT-2026-013` (id 21) y parte firmado `PT-2026-014` (id 22).
- **Qué versión:** el PR #3367 entró en `main` como `f14c253600aae315d1758524ae28872a81286758`. Al medir, producción ya servía `44747663306139dc7513320efae02f9fd82fa437` (lo dice `GET /version`), que es la punta de `main`. El guion no se fía del número: calcula en la propia página el id de git del `parteDetailView.js` que ha cargado y lo compara con `git rev-parse origin/main:public/dashboard/js/parteDetailView.js`. Los dos dan `d08fa890ff16f81e478bedc4415123d71d1efb83`, y si no coinciden el guion sale 2 sin medir.
- **Con qué:** `docs/master/evidencias/SCRUM-916/r42-vivo/verificar-en-vivo.mjs`. Chromium real sin interfaz, con la sesión de QA; a 390×844 pulsa con el dedo y a 1280×900 con el ratón, siempre en el punto del botón y comprobando antes que debajo de ese punto está el botón. Teclea con el teclado. Lee el estado después de cada paso (filas, foco, peticiones) y lee el parte del servidor por fuera de la página.
- **Qué escribe:** sólo `PATCH /admin/partes/21`. Cualquier otra escritura se corta y se apunta (control positivo del interceptor antes de empezar). Pone cinco líneas marcadas `QA916c-<ancho>` y al acabar las quita con la «×» de la pantalla.

### Aceptación → dónde se ve

Cada fila se cumple en las dos pasadas (390 con el dedo y 1280 con el ratón): 24 comprobaciones de 24 en cada una, salida 0. Los informes son `vivo-390.json` y `vivo-1280.json`, en `docs/master/evidencias/SCRUM-916/r42-vivo/`; las comprobaciones van por su número.

| aceptación (del encargo) | dónde se ve |
|---|---|
| ① escribir en la fila vacía → clic «+ Añadir línea» → lo escrito SE GUARDA y aparece fila nueva vacía CON EL FOCO en su UNDS | yaqu.app → Trabajos → el parte `PT-2026-013` de la cuenta QA → «+ Añadir línea», escribir, «+ Añadir línea» · informes, ①.0 a ①.5: el clic llega (2 de 2), un solo `PATCH` 200, la línea está en el servidor, hay una fila vacía y el foco está en su UNDS; lo que se teclea después cae en ella · capturas `vivo-390-1-…png` y `vivo-1280-1-…png` |
| ② dos clics seguidos = DOS filas vacías escribibles | misma pantalla, bloque «Materiales» · informes, ②.1 a ②.3: dos filas vacías, ninguna escritura, ninguna bloqueada, foco en la última; en ③ se escribe en las dos · capturas `…-2-dos-clics-dos-filas.png` |
| ③ nada se pierde: escribir en una fila mientras otra guarda | informes, ③a.1 a ③a.4: con el `PATCH` de una fila fuera se teclea la otra entera; llega la respuesta, la primera queda guardada y la segunda sigue con su texto y el cursor; el servidor acaba con todas |
| ③ quitar una línea con «×» y completar otra → el servidor conserva lo correcto | informes, ③b.1 a ③b.6 y ③.fin: salen dos `PATCH` 200, el de la «×» sin la línea quitada y el siguiente también sin ella y con la nueva; el servidor no tiene la quitada y sí las demás; las de partida conservan su id; la fila a medias («7») sobrevive al repintado · capturas `…-3b-quitada-una-y-completada-otra.png` |
| ④ SOLO MIRAR: el cuadro «Cuéntalo con tu voz» sigue en su sitio | misma pantalla, encima de «Mano de obra» · informes, ④.1 y el bloque `dictado`: rótulo, pista y botón iguales a los leídos en producción el 20-nov (916a); se ven los tres; no se pulsó «Ordenar en líneas» · capturas `…-4-cuadro-del-dictado.png` |
| ④ SOLO MIRAR: el parte firmado sigue sellado | yaqu.app → el parte `PT-2026-014` de la cuenta QA · informes, ④.2 y ④.3: ningún «Añadir línea», ninguna casilla de línea, ninguna «×», sus 6 líneas a la vista; el parte leído del servidor es idéntico antes y después de abrirlo · capturas `…-4-parte-firmado-sellado.png` |
| capturas del vivo a 390 y 1280 | diez PNG en la carpeta de arriba (825 KB). Otras cuatro (el paso ③a y el parte ya recogido) se quedan fuera de git, en la carpeta `capturas/SCRUM-916/r42-vivo` de la máquina del equipo |

### Lo medido, en cifras

- Tras guardar la primera línea, la ficha no relee el parte: 0 relecturas (la única es la de abrir). Con la «×» sí relee, una por cada línea quitada, que es lo que hace el código.
- Diez `PATCH` por pasada, los diez con 200: dos de ①, dos de ③a, dos de ③b y cuatro de recoger.
- Al acabar cada pasada el parte 21 vuelve a sus tres líneas de partida, con los mismos ids. Comprobado además con una segunda sonda (`scripts/qa/sesion-panel.mjs get`), comparando lo leído antes de la primera pasada con lo leído después de la última: iguales.
- Ningún error de JavaScript en la página en todo el recorrido.

### Lo que este tramo NO prueba, y un fallo mío

- **El «antes» no se ha visto en producción**: el código viejo ya no está desplegado. Que el instrumento ve el defecto lo acredita el banco de 916b (`b-anadir-linea/reproducir.mjs`), de donde sale la función que lee filas y foco: allí dio el fallo 4 de 4 sobre el código anterior.
- **En ③ la carrera se fabrica reteniendo el `PATCH` 1,5 s en el navegador** antes de dejarlo salir (cada `PATCH` del informe declara su `retrasoMs`). Sin eso, «tecleé mientras viajaba» sería una suposición sobre la red. El servidor no se toca; ① y ② van con la latencia real.
- **Es Chromium con el dedo emulado, no un teléfono**: no aparece el teclado en pantalla, y lo que el teclado del móvil mueva la página no se ha medido.
- **Una sola cuenta y un solo parte en borrador.** De la carrera de la «×» se ha recorrido un orden: «×» primero y fila completada mientras viaja. El otro (fila completada que sale a guardarse y, detrás, la «×») no se ha recorrido en vivo.
- **Fallo mío:** la primera pasada a 390 salió 23 de 24. La roja era la ④.3, que exigía que lo único cortado por el interceptor fuera mi control; el panel manda por su cuenta `POST /admin/entorno` al cargar y también se cortó. Era una suposición del guion, no un defecto del parte: ahora lista lo cortado y exige que nada de ello apunte a un parte. Esa pasada fue sobre `f14c2536…`; las dos que quedan en los informes, sobre `44747663…`, con el mismo `parteDetailView.js`.
- **Tanda:** este tramo no toca `public/`, `src/` ni tests. Se pasó `npm run guards:entrada`; la suite entera la corre el check obligatorio del PR.
- El ticket SCRUM-916 sigue abierto por el micrófono (916a) y el rediseño. Este tramo sólo deja visto en producción el de añadir línea.
