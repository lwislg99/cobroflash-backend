# SCRUM-1334 · en una ficha se cruza toda cita, y el guard dice lo que no cruza

**Medido contra:** `origin/main` = `bee39d3b51e300ff4efdda3befcb1eff4626f988` · 2026-10-01T06:01:34Z (J2f, equipo de Javier)

A9: comprobación → `tests/banco-scrum1334/mutar.mjs`

**Decisión:** encargo del orquestador del equipo de Javier (`cobroflash-backend-5b`), por su ficha de
relevo del 1-oct-2026. El criterio de ① lo aprobó él por mensaje ese mismo día, con el censo delante.
No cambia ningún texto que vea el usuario, ningún estado y ningún envío. Toca un guard de
`guards:entrada` (`tests/scrum514-aprobado-y-aplicado.test.mjs`), fichas de `docs/microcopy/` y su
README. No toca `src/` ni `public/`.

## Lo que pasaba

`scrum514` comprueba que todo texto aprobado está pintado tal cual en el código. De una ficha sólo
leía las citas bajo un encabezado que dijera «Texto aprobado». Medido con
`tests/banco-scrum1334/censo.mjs` sobre 101 fichas (las 101 con firma que cuenta) y 418 ficheros de
código:

| qué | citas |
|---|---|
| líneas de cita con texto | 251 |
| de 4 caracteres o más | 248 |
| bajo «Texto aprobado» (lo que se cruzaba) | 110 |
| fuera, sin que el guard lo dijera | 138 |

De las 138, 106 iban bajo nueve títulos que se leen como de textos aprobados («Los literales, tal
cual se pintan», 45; «Textos aprobados, literales», 23; «Formato aprobado, literal», 15…). Entre
ellas, la cita de 276 caracteres de SCRUM-1247: pintada tal cual, y sin mirar porque su encabezado
está en plural.

## ① Cómo se reconoce un texto aprobado sin depender del título

**En una ficha, toda línea de cita es un texto aprobado.** Ningún encabezado decide nada. No es una
convención nueva: es la unidad que ya usa el lector (`constaAprobado` cuenta toda cita de
`docs/microcopy/` como literal firmado) y la que escribe el README del directorio.

Añadir los nueve títulos a una lista habría sido un catálogo por nombre, que falla callado con el
décimo. Aquí lo desconocido se cruza. Cada cita cae en una caja:

| caja | qué es | qué hace el guard |
|---|---|---|
| `cruce` | todo lo demás | la busca tal cual en `src/` y `public/` |
| `plantilla` | lleva huecos `{…}` | no la cruza: el código la compone (regla que ya existía) |
| `corta` | menos de 4 caracteres | no la cruza: «Sí» está en cualquier fichero (ya se saltaban; ahora se cuentan) |
| `declarada` | está en `NO_SE_CRUZAN` | no la cruza, y comprueba su prueba en cada pasada |

Una cita en `cruce` que el código no pinta y que no está aparcada **cae**, y el rojo dice la ficha y
la sección y que el guard no sabe cuál de tres cosas es: un texto firmado sin aplicar, un texto que
el código compone, o una nota escrita como cita.

### Las declaradas

`NO_SE_CRUZAN` es por **ficha y texto**, no por título. Cada entrada lleva el fichero donde se
compone y la cita troceada en partes fijas y datos; el texto de la cita es la suma de las partes.
En cada pasada el guard comprueba que la cita sigue en su ficha, que el código no la pinta ya tal
cual (entonces sobra), que cada parte fija sigue escrita en el fichero, que hay al menos una parte
fija de 4 caracteres y que ningún «dato» pasa de 12 (una nota no cuela como dato).

## ② El recuento, en cada pasada

El caso «RECUENTO» lo escribe como diagnóstico del test. Hoy, con las cinco fichas de abajo sin
arreglar:

    fichas: crucé 213 de 246 citas de 101 fichas (185 pintadas tal cual, 6 aparcadas con motivo,
    22 SIN SABER). No cruzo: 19 plantillas con huecos, 11 declaradas, 3 de menos de 4 caracteres.
    registro congelado: crucé 94 de 119 textos. No cruzo: 2 plantillas, 20 rutas o constantes,
    3 de menos de 4 caracteres.

Lleva una segunda sonda: las líneas de cita contadas a pelo sobre el directorio, con otro código.
Si el extractor se dejara alguna sin caja, las dos cifras dejarían de coincidir.

## ③ El rojo primero

Commit `10e04b71c60a1ba5af1499c579f538f834313911`: el extractor nuevo y los casos nuevos, con una
línea que conserva el criterio viejo. 28 casos, 19 pasan, 9 caen; el testigo de SCRUM-1247 cae con
«la cita larga de SCRUM-1247 no está en el cruce». TAP en
`docs/master/evidencias/scrum1334/rojo-con-el-criterio-viejo.tap.txt`.

## ④ Los controles

- Lo que se cruzaba por su título se sigue cruzando: el criterio de antes está reescrito aparte
  dentro del test, y ninguno de sus textos falta en el cruce de ahora.
- La prosa de una ficha que no va en cita (párrafo, viñeta, celda de tabla, comillas de código) no
  entra en la población.
- Los 17 casos de SCRUM-1329 pasan sin tocarlos: el umbral sigue en 160 y la negrita sigue siendo
  prosa.
- Mutaciones (`tests/banco-scrum1334/mutar.mjs`): 15 de 15 tumban su caso, y el fichero se restaura
  por contenido.

## ⑤ Las 11 que no están tal cual, una a una

Ninguna es un texto que no se pinte.

| ficha | cita | qué es | cómo se comprobó |
|---|---|---|---|
| 887 | «No se puede facturar: …» (171) | prefijo + constante | ejecutado contra `dist/`: idéntica a la cita |
| 887 | «No se puede crear una revisión: …» (181) | prefijo + constante | ejecutado contra `dist/`: idéntica |
| 1124 | «No se puede añadir la dirección…» (159) | un literal partido con `+` | ejecutado contra `dist/`: idéntica |
| 915 pasos | «N conceptos · total» | formato con datos | leído, `quotesView.js` |
| 915 pasos | «… · válido hasta dd/mm/aaaa» | formato con datos | leído, `quotesView.js` |
| 917 singulares | «en 1 trabajo sin cerrar» | singular con N = 1 | leído, `jobsView.js` |
| 917 singulares | «1 sin importe de referencia, no entra» | singular con N = 1 | leído, `jobsView.js` |
| 974 | tres ejemplos de «N partes firmados de M clientes» | plurales compuestos | leído, `weeklyDigest.service.ts` |
| 980 | «3 fotos» | plural compuesto | leído, `customerDetailView.js` |

Las ocho «leídas» no se han ejecutado: viven dentro de funciones que necesitan el DOM o la base. Lo
que el guard comprueba de ellas es que sus partes fijas siguen en ese fichero.

La de 1124 se declara y **no se junta** en `src/modules/jobs/domain/jobDireccion.ts` (decisión del
orquestador): ese fichero es del sellado del albarán.

## Las 27 notas escritas como cita

El resto del rojo no eran textos: 25 líneas de nota y 2 de historia («qué había antes») escritas
con `>` en seis fichas. Con el criterio viejo nadie las miraba.

Y tienen una segunda consecuencia, medida ejecutando el lector:
`constaAprobado('[PENDIENTE microcopy oficial] Nuevo albarán')` devuelve la ficha de SCRUM-722. Un
texto que dice de sí mismo que está pendiente consta como firmado, igual que las otras 26 líneas.
Hoy no lo pregunta nadie: buscadas las 27 por identidad en 2.012 ficheros de `src/`, `public/`,
`tests/` y `scripts/`, salen 0 en código y 1 en un comentario de `scrum402`. Lo que esa búsqueda no
cubre es una consulta construida en tiempo de ejecución con un texto que no esté escrito en ningún
fichero.

El arreglo es quitarles el `>`, en sitio y sin mover líneas.

- **SCRUM-1154** (5 líneas, ficha del equipo de Javier): hecho en este PR.
- **SCRUM-704, 605, 722, 728 y 832** (22 líneas, fichas del equipo de Luis): preparado en
  `tests/banco-scrum1334/quitar-cita-a-las-notas.mjs` y **sin aplicar**, a la espera del fundador.
  Sobre una copia: 22 de 22 líneas, el mismo número de líneas en cada ficha, el lector pasa de 500
  a 478 literales y los 22 que pierde son esas notas. El suelo de `scrum726` (150) no se toca.

No se declaran en el guard: lo pondría verde dejando a las notas contando como aprobadas.

**Por eso este PR se empuja en ROJO, a propósito** (decisión del orquestador, 1-oct-2026): `scrum514`
cae en 2 de sus 28 casos, y los dos por esas 22 líneas. Es el estado real del árbol. Entra cuando
su dueño les quite el `>`, o cuando diga que lo haga este puesto.

## `guards:entrada` y su techo

`guards:entrada` se pasó del techo de 90 s con 42 procesos node en la máquina, y `scrum514` tarda lo
mismo que en `main` (9,1 s). Medido el 1-oct-2026 corriendo el fichero de esta rama y el de
`origin/main` uno detrás de otro, en la misma máquina y con la misma carga. El techo lo decidió la
carga, no el instrumento.

## Lo que queda fuera

- El hallazgo de `constaAprobado` es de la otra mitad de la regla 30 y tiene ticket aparte, que
  abre el orquestador.
- Las 185 «pintadas tal cual» se buscan por subcadena en todo el código. Para una cita de una
  palabra («Trabajo», «Estado») eso se cumple casi con cualquier cosa. Ya era así y no lo he tocado.
- `textosAprobados()` no mira si la firma de la ficha cuenta para las citas de 160 o menos. Lo dejó
  dicho SCRUM-1329; sigue igual.

## Mis errores

- Le di al orquestador «186 pintadas y 18 plantillas» sumando dos listas de mi censo que se
  solapaban. Son 185 y 19: una plantilla está además pintada tal cual. El total no cambia. Ahora la
  cuenta la da el guard, con cada cita en una sola caja.
- El banco de mutaciones dio una mutación «muda» que no lo era: la salida del test mutado pasó de
  1 MB, `spawnSync` mató al proceso y el banco leyó ocho casos como si fueran el resultado. Ahora
  declara CIEGO un TAP que no llega a su resumen. Es la línea `A9` de arriba.
- Pasé un guion a node por bash dos veces, y las dos se comió las barras invertidas. Va como
  cicatriz de J2.

## Verificación

- `node --test tests/scrum514-aprobado-y-aplicado.test.mjs`
- `node tests/banco-scrum1334/censo.mjs`
- `node tests/banco-scrum1334/mutar.mjs`
- `node tests/banco-scrum1334/quitar-cita-a-las-notas.mjs`
- `npm run guards:entrada`

# SCRUM-1334b · las notas que el guard no cruza y son de otro equipo: nombradas, con dueño, y sólo bajan

**Medido contra:** `origin/main` = `f7d013778fc979caff89d7c9ac47d8ed79dca248` · 2026-10-02T03:39:35Z (J2c, equipo de Javier)

A9: comprobación → `tests/scrum514-aprobado-y-aplicado.test.mjs`

**Decisión:** del orquestador del equipo de Javier (`cobroflash-backend-5b`), en SCRUM-1334 comentario
18018 (2-oct-2026) y en dos mensajes suyos de esa madrugada, que este anexo transcribe en ② y ③. No es
del fundador: no toca texto de usuario, dinero, emisión ni ningún estado o flag. Este tramo no toca
ninguna ficha de `docs/microcopy/`, ni `src/`, ni `public/`.

## ① Por qué hacía falta

El PR #2054 llevaba desde el 1-oct a las 06:08Z rojo a propósito y con el auto-merge armado: no iba a
entrar nunca, y nada avisaba. Lo que lo tenía rojo eran 22 líneas de nota escritas como cita en cinco
fichas (704, 605, 722, 728, 832), a la espera de que su dueño les quitara el `>`.

Re-medido el 2-oct sobre `main` = `bbe633ac` mezclado en la rama (commit `59a728c1`, sin conflictos): el
rojo era el mismo —`scrum514`, 28 casos, 26 pasan, 2 caen, las mismas 22 líneas— sobre una población
mayor: 251 citas de 106 fichas (el 1-oct eran 246 de 101). Las cinco fichas nuevas de `main` cruzan
todas. TAP: `docs/master/evidencias/scrum1334/rojo-del-2-oct-sobre-main-bbe633ac.tap.txt`.

## ② Lo decidido (comentario 18018)

1. El guard sigue juzgando TODAS las fichas. No se recorta su ámbito.
2. Lo que no puede cruzar porque la ficha es de otro equipo sale NOMBRADO, uno por uno, con su dueño,
   y no tumba el obligatorio.
3. El recuento es un trinquete que sólo baja.
4. Cada entrada lleva motivo, dueño y fecha.

Con una precondición: «es de otro equipo» se MIDE, derivándolo de la propiedad de la ficha y nunca de
un patrón en el nombre del fichero. Y lo que al medirlo resulte de este equipo se arregla, no se declara.

## ③ La precondición, medida por tres vías — y no cuadraban

| vía | qué mide | resultado |
|---|---|---|
| etiqueta de equipo en Jira | la del ticket de la ficha | **no existe**: SCRUM-704, 605, 722, 728 y 832 llevan `labels = []` las cinco (control: SCRUM-1154 sí lleva `equipo-javier`) |
| `git blame`, línea a línea | quién TECLEÓ cada nota | 18 de 22 la identidad «Luis»; **4 la identidad de Javier**: las de «Dónde se pinta» de la ficha de 605, en el commit `7f695c75` (4-sep-2026), que además es el que CREÓ esa ficha |
| `dos-equipos.md` §3.3 | «cada registro, el puesto que usa el texto» | 704 → `parteDetailView.js` (S4); 832 → `app.js` (S2); 722 → 15 ficheros, todos de S1, S2 o S4; **728 → `src/modules/invoicing/domain/cerrojoSaturado.ts`, que §3.1 da a J1**; 605 → no se deduce solo (abajo) |

**Corrige al tramo de arriba.** Donde dice «SCRUM-704, 605, 722, 728 y 832 (22 líneas, fichas del
equipo de Luis)», y donde la entrega de J2f en Jira (comentario 17779) dice «cinco fichas que creó
Luis»: es falso para dos. La de 605 la creó la identidad de Javier. Y la de 728, por la regla escrita
de propiedad, es de J1, que es de este equipo.

**El orquestador decidió el eje** (mensaje del 2-oct, ~03:30Z): manda §3.3. `git blame` contesta quién
tecleó; §3.3 contesta de quién es, y es la regla que el repositorio escribió. El commit de las cuatro
líneas es anterior a que existiera el reparto de carriles. Y editar cuatro líneas de la ficha de otro
equipo, en un PR propio, para que el guard propio salga verde, tiene la forma de «hacer que el rojo
desaparezca». Así que las cuatro NO se editan: se declaran con dueño «equipo de Luis» y **llevan
escrita la discrepancia en su motivo**, para que decida su dueño con el dato delante.

**La ficha de 605 no se deduce sola de «quién contiene el texto».** Sus citas pintadas son «7 días»,
«14 días» y «30 días», que por subcadena salen en ficheros de los dos equipos; «14 días» ni siquiera
está en `quoteAtajosVencimiento.js`. Por eso la entrada DECLARA qué fichero usa el texto y el guard
comprueba la declaración, en vez de deducirlo.

## ④ Lo construido, en `tests/scrum514-aprobado-y-aplicado.test.mjs`

- **Caja `ajena`.** Una cita que está en `NOTAS_AJENAS` (por ficha y texto) sale del cruce y entra en
  el recuento con su nombre: «N notas de OTRO EQUIPO que no sé cruzar».
- **`NOTAS_AJENAS`: 21 entradas** (704: 6 · 605: 12 · 722: 1 · 832: 2), cada una con `dueno`, `motivo`,
  `fecha` y `usa`: el fichero que usa los textos de su ficha.
- **`fallosDeAjena` mide en cada pasada**, y cae si: falta el motivo, la fecha o el dueño; el dueño no
  es otro equipo; la ficha ya no tiene esa cita (la entrada SOBRA: se borra y se baja el techo); el
  código pinta la línea (no era una nota); `usa` no existe o no pinta ninguna cita de esa ficha; las
  tablas de §3 no dicen de quién es `usa` (CIEGO); o `usa` es de un puesto J («es de este equipo: se
  arregla»).
- **El reparto se LEE de `docs/equipo/dos-equipos.md` §3.1 y §3.2**, no se copia al test. Gana la ruta
  nombrada, después el directorio con `/**`, y al final «todo lo demás de». Con su suelo: 33 filas el
  2-oct (cae por debajo de 25) y diez ficheros de control de los dos equipos.
- **`TECHO_DE_AJENAS`, por ficha, con igualdad.** Si una ficha tiene más que su techo, cae (no sube).
  Si tiene menos, cae pidiendo que se baje el número (no baja callado). Una ficha sin techo tiene 0.
- **Cada nota sale nombrada** en el diagnóstico de su caso: ficha, sección, texto, dueño, puesto y
  fichero por el que se sabe, y fecha en que se declaró.

Una nota NUEVA sin cruzar, en la ficha que sea, sigue cayendo en el caso de siempre («TODO texto
APROBADO…»), que ahora dice además que no se añade a `NOTAS_AJENAS`.

### Lo que NO hace, y se dice

- **No arregla `constaAprobado`:** con el `>` puesto, las 21 siguen constando como firmadas. Esto las
  nombra; el arreglo sigue siendo quitarles el `>`, y es de su dueño.
- **No impide elegir un fichero de coincidencia** como `usa` en una ficha de citas cortas. Lo frena el
  techo y quien revise la entrada, no un mecanismo.
- **Ata el guard al formato de las tablas de §3**, que son de la S0. Si cambian de forma, cae el suelo
  diciendo que no las lee: es un rojo en el PR que las cambie.
- **Cuando su dueño arregle una nota, su PR tendrá que borrar la entrada y bajar el techo** (una línea
  por nota). Lo aceptó el orquestador: es la única forma de que la lista mengüe de verdad.

## ⑤ La línea de la ficha de 728: SIN RESOLVER al escribir esto

`> No se pudo crear el albarán: **API 500: internal_error**` (sección «Qué se veía antes, medido
corriendo»). El guard se niega a declararla ajena, porque el único fichero que pinta el texto de esa
ficha es de J1. Por la decisión, ésa se arregla. Preguntado el orquestador si se le quita el `>` en
este PR (es cruce de carril dentro del equipo: `area-j1`); sin respuesta al escribir este anexo. **No
se ha tocado.** Mientras siga con el `>`, `scrum514` cae en 2 de sus 37 casos por esa línea y sólo por
ésa, nombrada.

## ⑥ Lo corrido

| qué | resultado |
|---|---|
| `scrum514` antes del mecanismo, sobre `main` mezclado | 28 casos · 26 pasan · 2 caen (22 líneas) |
| `scrum514` con el mecanismo | 37 casos · 35 pasan · 2 caen (1 línea, la de 728) · 0 saltos |
| su recuento | «crucé 196 de 251 citas de 106 fichas (189 pintadas tal cual, 6 aparcadas con motivo, 1 SIN SABER). No cruzo: 20 plantillas, 11 declaradas, 3 de menos de 4 caracteres, 21 notas de OTRO EQUIPO» |
| banco de mutaciones, 1.ª pasada (30 filas) | 26 caen · 2 controles mudos · **M10 CIEGA y M26 MUDA** (ver ⑦) |
| banco de mutaciones, 2.ª pasada | BANCO_SEGUNDA_PASADA |
| lo demás | LO_DEMAS_CORRIDO |

La tanda completa NO se ha corrido en local: no es alcanzable en esta máquina y la pasada completa es
el CI, que lee el orquestador.

## ⑦ Lo que me salió mal

- **Construí primero sobre `git blame`** (quién tecleó la línea y cuándo) y se lo conté al orquestador
  como plan. Era medir una propiedad que el repositorio no usa para decir de quién es algo. Lo cortó su
  decisión, no yo. La versión con `blame` no llegó a ningún commit.
- **El banco tenía dos filas que no valían, y las dos por código mío.** La M10 salió CIEGA porque al
  escribir `fallosDeAjena` repetí letra por letra la línea que ella muta: su ancla dejó de ser única. Y
  la M26 salió MUDA porque mutaba un `deFicha &&` que era una segunda guarda de lo que ya garantiza
  otra línea: quitarla no cambiaba nada. Quité la guarda redundante y la mutación va ahora a la que
  decide.
- **Pasé de 200k de contexto sin avisar** (medido: 312.212 cuando lo miré). Y puse dos horas «a ojo» en
  mensajes al orquestador («~03:45Z» cuando GitHub decía 03:3x). Las dos son cicatrices de J2 ya
  escritas; no las repito allí.

## ⑧ Lo que NO está hecho

- La línea de 728 (⑤).
- Pedirle al equipo de Luis que quite el `>` a sus 21 notas: es un ticket con `equipo-luis` y el área
  dueña (`dos-equipos.md` §5), y lo abre el orquestador. El ticket lleva `aviso-a-luis` desde el 2-oct.
- El PR trae de J2f un cambio en `docs/microcopy/README.md`, que §3.3 da a la S4. Dicho al orquestador.
- `tests/banco-scrum1334/quitar-cita-a-las-notas.mjs` sigue preparado para las 22 y sin aplicar.
