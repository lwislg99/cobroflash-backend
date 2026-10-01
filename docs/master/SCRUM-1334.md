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
