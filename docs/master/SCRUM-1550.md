# SCRUM-1550 · Los 38 que el censo por número da por vacíos, mirados por CONTENIDO: 4 están bajo otra cosa, 20 siguen sin hacer y 14 no se pudieron mirar

**Medido contra:** `origin/main` = `c30729832c18b65c3793917ca836868e6cfdaa6e` · 2026-10-14T03:42:01Z

A9: aviso → cicatriz J3 «Di por «está, bajo otra cosa» tres tickets cuyo grep casaba con OTRA cosa: «sepa» dentro de «sepan», las notas de la cotización por las del cliente, «trial» y «usuarios» sueltos en la misma línea.» — no se pudo comprobar: decidir si lo que casa es lo que pide el ticket es un juicio, no un recuento, y un guard no lo puede hacer por mí

J3 (jv-j3b), por encargo del orquestador del equipo de Javier (`cobroflash-backend-2e`). Releva a jv-j3a, que
sacó la foto de partida (SCRUM-1496 c.19528). **Es LECTURA.** No se ha cerrado, transicionado ni etiquetado
ningún ticket, y no se ha tocado `src/`, ningún test, guard o workflow, ninguna base de datos, el esquema ni
ningún texto que vea el usuario. Construido con la orden escrita del orquestador aunque el hook de inicio dijo
**SIN IDENTIDAD**: eso es SCRUM-1549, la puerta instalada que responde ALTERADO desde el 28-sep.

## ① La foto del 14-oct, dentro del repo (SCRUM-1496b)

Los seis ficheros de la foto de jv-j3a vivían fuera de git. El orquestador los rescató del directorio efímero de
esa sesión. Están ahora en `docs/master/evidencias/SCRUM-1496b/`, copiados con `cp` y con el **mismo sha256**
que los rescatados (sin CR, medido por bytes):

| fichero | líneas | sha256 |
|---|---|---|
| `tabla-hoy.md` | 77 filas + control | `10efa803e5522899fc5e5e53ab30a45d70d233c63b399fd606cf06272f4641e5` |
| `tabla-viejos.md` | 88 filas + control | `1180730733cf2b44a09f4a2de6cd4c30c643b92fe572df76af0bdf248370d219` |
| `lineas-hoy.tsv` | 447 | `1773699a07691439ef676d03f39f0cf353bbe6993b8fb11e238b5b0227c39101` |
| `lineas-viejos.tsv` | 454 | `0f018bd9263686256b95e651f06f405161992bfcffe0959f5aea55fd436cb7b8` |
| `foto-hoy.tsv` | 77 | `93489fca7100d9c425d6ad290c8c89e463bea6c68120d81906dcaaa07a4d5faf` |
| `foto-viejos.tsv` | 88 | `b8558da8cfd3d1aa71daef6e9b2451d32af2e26f08a7db8e2d1427b188209947` |

La foto se midió contra `cb30885dd69c4df7f33d3a0066fed93698926857`. Las tablas llevan dentro la ruta del
directorio temporal de jv-j3a, que ya no existe: es la ruta donde se escribieron, no una ruta que se pueda abrir.

## La foto, otra vez, antes de empezar

La población del ticket es del 14-oct 02:52Z, y `main` se había movido cinco veces desde entonces. Se repitió
entera:

- **Jira, 03:31Z.** `project = SCRUM AND labels = "equipo-javier" AND statusCategory != Done`, dos páginas,
  `hasNextPage: false`. Da **167** abiertos, frente a 165. Entran 1549 y 1550 y no sale ninguno. Está en
  `docs/master/evidencias/SCRUM-1550/foto-jira-2026-10-14T0331Z.tsv`.
- **El censo por número sobre los 167**, con el mismo instrumento y contra `c30729832`, en 3 minutos: **128 ALGO EN
  MAIN · 39 NADA EN MAIN · 0 NO HE PODIDO MIRAR**, con el control 9999 a cero. Está en
  `tabla-por-numero-c30729832.md`.
- **Qué cambió en los 39 nombrados:** `SCRUM-1536` (#2410) y `SCRUM-1548` (#2414) pasaron a ALGO, porque sus PR
  entraron después de la foto. Entra `SCRUM-1549`, que es nuevo, y `SCRUM-1550` es este ticket y se queda fuera.
  **La población son 38.**

## ② El censo por contenido

### No es un segundo censo

Busqué por CONCEPTO («por contenido», «bajo otro número», «otra redacción») en `scripts/`, `tests/_censo-*` y
`docs/master/evidencias/`. Los tres motores por número —`censarTicket` (SCRUM-388), `ya-esta` (SCRUM-1424/1454) y
`abierto-con-trabajo-en-main` (SCRUM-1259)— **declaran este mismo límite y no lo resuelven**: «SIN RASTRO no es
sin hacer: para eso, el PASO 0 por CONTENIDO». `censo-regla-42` sí mira contenido, pero solo el que nombra el
registro del propio ticket, y estos 38 no tienen registro. La capa es
`docs/master/evidencias/SCRUM-1550/contenido.mjs` y reusa `reMencion` de SCRUM-1259. No toca `scripts/equipo/`.

Lo que se mira de cada ticket está en `sondas.json`: lo que pide el enunciado y la sonda que lo comprueba (un
literal, una función, una ruta, una fila del máster). Una sonda es «presente» si el trabajo está cuando el patrón
aparece, y «ausente» si el trabajo está cuando el DEFECTO citado ya no aparece; en ese caso, solo si sus rutas
existen en el commit. Las líneas que nombran el propio ticket no cuentan, porque citarlo no es hacerlo.

### El comando para repetirlo

    node docs/master/evidencias/SCRUM-1550/contenido.mjs --ref c30729832c18b65c3793917ca836868e6cfdaa6e

Sin `--ref`, mide contra `origin/main`. Tarda unos 3 s. Sale 0 si los dos controles salieron bien y 2 si no. Para
otra población hay que rehacer `sondas.json` desde los enunciados: **qué buscar no lo decide el instrumento.** La
salida de esta medición está en `salida-c30729832.md`.

### Los controles, corridos

| control | qué tenía que pasar | qué pasó |
|---|---|---|
| NEGATIVO: SCRUM-9999 con un literal que no existe | SIGUE SIN HACER | SIGUE SIN HACER |
| POSITIVO SEMBRADO: SCRUM-9998 con el literal de `semilla.txt` | ESTÁ, BAJO OTRA COSA | ESTÁ, BAJO OTRA COSA |
| el positivo sembrado, quitando `semilla.txt` | el instrumento se declara inválido, salida 2 | «EL INSTRUMENTO NO MIDE: la tabla no vale», salida 2 |
| una referencia que no existe | NO HE PODIDO MIRAR, salida 2 | eso mismo, salida 2 |
| POSITIVO DE POBLACIÓN YA CLASIFICADA: SCRUM-1101 | ESTÁ, bajo SCRUM-1097: así lo dejó escrito SCRUM-1259 en su cabecera el 28-sep | ESTÁ, BAJO OTRA COSA, entró por #1744 (`scrum-1097-guard-acreditacion-invoicing-es`) |

**Por qué 1101 y no 1344, que proponía el encargo:** 1344 está en ALGO EN MAIN **por su propio número** (#2119,
tres commits y un registro). No es un caso de «bajo otra cosa», así que no mide el punto débil de este censo.
1101 es un caso real, está entre los 38 y ya lo había clasificado otro instrumento. **La semilla se busca en el
árbol de trabajo, no en el commit medido**, porque el commit es anterior a ella. Por eso prueba el grep, el filtro
y el veredicto, pero no la referencia; el positivo contra la referencia lo da 1101.

### Lo que salió

**4 ESTÁ, BAJO OTRA COSA · 20 SIGUE SIN HACER · 14 NO HE PODIDO MIRAR**, sobre 38: 24 con sonda y 14 sin sonda
posible, cada uno con su motivo.

🔴 **Los cuatro «está» llevan por dónde entró, y tres son de UNA PARTE:**

| ticket | Jira | qué lo cubre | por dónde entró | qué NO está |
|---|---|---|---|---|
| SCRUM-1101 | En curso | `scripts/guard-acreditacion-invoicing-es.mjs:59` (y su test `scrum1097-…`) | #1744, SCRUM-1097, 23-sep | — (el censo no mira si cumple cada requisito del enunciado) |
| SCRUM-1499 | Tareas por hacer | `docs/YAQU_MASTER.md:403`: `received` en la Parte L | #2375, SCRUM-1529c, 13-oct | `inbound` en la Parte L; qué pasa con `queued` |
| SCRUM-957 | Tareas por hacer | el DEFECTO ya no está: `scrum858b` no llama a `wmic` (usa CIM) | #1631, `scrum-922-wmic-cim`, 22-sep | el texto que pedía en `trampas-del-entorno.md` (0 apariciones de «wmic») |
| SCRUM-18 | Tareas por hacer | `prisma/schema.prisma:516`: la retención de garantía en el Trabajo | #1758, `scrum-1107c-garantia-desatasco`, 25-sep | las certificaciones por % (`model Certificacion`: 0) |

⚠️ Ninguno de los cuatro es de «Acción del fundador». Si lo fuera, un «está» **no autorizaría nada**.

**Los 20 SIGUE SIN HACER:** 19, 142, 1005, 1028, 1044, 1052, 1053, 1054, 1073, 1132, 1145, 1149, 1242, 1250, 1251,
1260, 1310 (solo la parte ii; la i es una decisión), 1347, 1406, 1507. Cuatro de ellos son defectos que se ven
**todavía** en el árbol, con su línea: 1028 (`ALCANCE_BETA.md:21`, «Cobro integrado»), 1149
(`guard-objetivo-tactil.mjs:689`), 1250 (`adminOnlyRoutes.ts:13`), 1260 (`src/lib/invoicing.ts:432`). Dos son
primos que NO son el ticket. En 1242, `00-normas-siempre.md:115` (SCRUM-1316) habla de textos consolidados, pero
no dice que una cita del BOE se fije con ellos. En 1044, el «Cómo llegar» de `customerDetailView.js:336`
(SCRUM-1004) es el de la dirección fiscal, no el de cada sitio.

**Los 14 NO HE PODIDO MIRAR, y no son «sin hacer»:** 143, 658, 1314 y 1501 piden una decisión que no se ha tomado.
1115 y 1549 viven fuera del árbol: una variable de Railway y la copia instalada de `sesion.mjs`. 1264 espera al
asesor. 1346 pide una base real, que este encargo tiene prohibida. 1159 no nombra los botones. 1248 es una
declaración con criterio de disparo. 1396 es un arreglo de algoritmo, sin literal que buscar, y su rama sigue viva
sin mergear. 1410 se mide en los runs de `claude.yml`. 1497 pedía dejarlo escrito EN JIRA, y es él mismo. 1506 se
mide ejecutando la puerta de S5. Tres de los catorce (143, 1264 y 1314) son de «Acción del fundador»; 142,
1028 y 1310, también de «Acción del fundador», tienen sonda y salen SIGUE.

## Mi error, y cómo lo cacé

La primera pasada dio **7 «está»**. Leyendo la línea citada de cada uno, **tres eran otra cosa**:

- 19: `sepa` sin distinguir mayúsculas casaba con «sepan» y «SEPARADO», 191 aciertos. Ceñido a «SEPA» como palabra,
  casó con un comentario de Bizum que nombra SEPA de pasada (`bizumCharge.ts:31`). Ceñido al objeto del ticket
  (mandato o `sepa_debit`): 0.
- 1132: `/notes` casaba con las notas de la COTIZACIÓN (`quotesDetailView.js:1114`, mayo de 2026), no con las del
  cliente.
- 1406: `docs/YAQU_MASTER.md:1081` dice «canceled→trial» y, más adelante, «usuarios», sin relación entre ellos.

Es la trampa que la cabecera de `tests/_censo-tickets.mjs` pone por escrito: **encontrar un mecanismo que se
parece no es encontrar el ticket.** Y falla en la dirección cómoda, la que da trabajo por hecho. Por eso
`contenido.mjs` imprime el TEXTO de cada acierto al lado de su `fichero:línea`: el recuento solo no lo habría
delatado. Va a las cicatrices de J3. Un guard no lo puede comprobar, porque decidir si lo que casa es lo que se
pide es un juicio.

## Lo que este censo NO contesta

- **Si lo que está «bajo otra cosa» está BIEN**, o si cumple todos los requisitos del enunciado (1101 tiene cinco).
- **Si un ticket con partes las tiene TODAS.** Las sondas miran las partes que se pudieron nombrar, no las demás.
- **Qué sonda no se escribió.** Una sonda que no casa da SIGUE, y una sonda mal elegida también. Cada sonda está
  en `sondas.json` con lo que pide su ticket, para que se pueda discutir sonda a sonda.

## Tramo 1550b (J6, `jv-j6bx`, equipo de Javier, 24-oct-2026) · el auto-descarte mira el TEXTO de la línea, no la ruta

**Medido contra:** `origin/main` = `c6d3aa11f15a0a582f92b8ec4a8c9838ea426dd8` · 2026-10-24T15:47:41Z (hora de GitHub)

A9: comprobación → `tests/scrum1550b-sonda-por-texto.test.mjs`

Por encargo del orquestador `cobroflash-backend-95`, a partir del hallazgo de jv-j5aj (SCRUM-1310 c.20822).

### El defecto, reproducido antes de tocar nada

`contenido.mjs` descartaba toda línea de `git grep` que casara con `reMencion(n)`, y la línea lleva delante su RUTA.
Sobre la rama `scrum-1310c-ddl-de-las-13` @ `11bba3bc1d1244b40060e0e31a793427ac6f59ce`, `git grep` encuentra
`invoices_rectifies_id_fkey` en `docs/sql/scrum-1310c-claves-ajenas-ddl.sql:46`, y aun así la sonda decía
`SCRUM-1310 · SIGUE SIN HACER · [presente] · 0`: la ruta lleva `scrum-1310c`. Con ese filtro, ningún DDL de 1310
escrito en un fichero con su número podía contar nunca.

### El arreglo

- `lineaCuenta(linea, n)`, pura y exportada: separa `ruta:nº:texto` y descarta la línea si su **TEXTO** nombra el
  ticket, o si vive en su **registro** (`docs/master/SCRUM-<n>.md`) o en sus **evidencias**
  (`docs/master/evidencias/SCRUM-<n>[letra]/`). La ruta, sola, ya no descarta nada.
- `reMencion` se importa de forma estática (el módulo no hace nada al cargarse), en vez de copiarla.
- **Un tercer control dentro de cada pasada** (9997, «ruta sembrada»): `semilla-ruta-SCRUM-9997.txt` tiene la
  semilla en dos líneas y solo una nombra el ticket en su texto. Tiene que contar **exactamente 1**: con 0 se ha
  vuelto a filtrar por la ruta; con 2, ya no se filtra el texto. Si no da 1, la tabla no vale y sale 2.
- No se ha renombrado ningún fichero de 1310.

### Antes y después, por programa (comparación fila a fila de la tabla, veredicto + alcance)

| commit | filas antes → después | cambian |
|---|---|---|
| `origin/main` `c6d3aa11f` | 40 → 41 | solo entra la fila del control 9997. Las 38 de `sondas.json`, iguales también en sus recuentos |
| 1310c `11bba3bc1` | 40 → 41 | **SCRUM-1310: SIGUE SIN HACER → ESTÁ, BAJO OTRA COSA** (`docs/sql/scrum-1310c-claves-ajenas-ddl.sql:46`, entró por `cc358f5d1`), y la fila del control 9997 |

- **Positivo:** con el fichero de 1310c, la sonda de 1310 sale «presente · 1».
- **Negativo:** una línea que solo NOMBRA el ticket sigue descartada (casos ① del test, incluida `scrum-1310` en
  minúsculas), y también las del registro y las evidencias del ticket.
- **Las demás:** sobre main no cambia ni una fila; sobre 1310c, solo la de 1310.

### El test, en rojo primero

`tests/scrum1550b-sonda-por-texto.test.mjs`: 4 casos y 4 en verde en 1,9 s, sobre el commit `91f0cfaa8`. Su ②
corre el instrumento entero sobre `HEAD` con una lista de sondas vacía en el temporal del sistema (solo corren
los controles). Mutaciones vistas en ROJO a mano, una a una, restaurando con `git restore --source=HEAD` y con el
árbol limpio después (`git status --porcelain` vacío):

| mutación | `numstat` | cae | sonda sobre 1310c |
|---|---|---|---|
| el filtro mira la línea ENTERA, como antes | 1 1 | ① cuenta… · ② | sale 2 · 1310 vuelve a SIGUE |
| sin filtro de texto | 1 1 | ① descarta… · ② | sale 2 |
| la semilla sin la línea que nombra el ticket | 1 1 | ② · ③ | — |
| sin el fichero de la semilla | (borrado) | ② · ③ | sale 2 |

Las tres primeras están declaradas en `MUTACIONES_QUE_ME_TUMBAN` del test. Comprobado a mano: cada `de` sale una
sola vez en su fichero y cada `cae` está dentro del nombre de un caso. **El meta-guard no lo he corrido en
local**; lo corre el CI.

### De paso, medido y no tocado: `scripts/_clasificador-sql.mjs`

| sentencia | veredicto |
|---|---|
| `ALTER TABLE "t" ADD COLUMN "x" TEXT` | permitida |
| `ALTER TABLE public.t ADD COLUMN "x" TEXT` | permitida |
| `ALTER TABLE "public"."t" ADD COLUMN "x" TEXT` | **rechazada** · «acción no reconocida como aditiva: «. T ADD COLUMN X TEXT»» |
| `ALTER TABLE "public"."t" ADD COLUMN IF NOT EXISTS "x" TEXT` | **rechazada** · igual |
| `CREATE TABLE "public"."t" ("id" TEXT)` | permitida |
| la clave ajena de 1310c, con `"public".` | rechazada · «acción no reconocida» |
| la misma, sin `"public".` | rechazada · «añade una restricción FOREIGN KEY…» (su motivo verdadero, SCRUM-1214) |

Falla del lado seguro: rechaza de más, nunca deja pasar algo. El sitio es `scripts/_clasificador-sql.mjs:177`. Lo
que queda tras quitar el nombre de la tabla empieza por «. T», así que la clase `[A-Z0-9_."]+` se para antes del
punto. Qué deja `desnudar` del identificador entre comillas **no lo he leído**. Carril: `carriles.mjs` dice
«SIN CERRADURA», con la fila general de `scripts/`. Solo se nombra.

### Lo que no he hecho

- **Suite entera local: NO CORRIDA** (hoy hay 10 sesiones a la vez). Los guards dirigidos, en la entrega.
- **No he medido sobre 1310c después de su merge en main**, porque no ha entrado. El día que entre, la sonda de
  1310 tiene que salir «presente» sobre main; si no, el filtro ha vuelto.
- **Mi error de este tramo:** pasé un script de comprobación a node por un heredoc y se comió una barra invertida.
  Lo cazó node, que no compiló. Es la misma cicatriz que la de J6 del 2026-10-14: no añado otra línea, pero ha
  vuelto a pasar.
