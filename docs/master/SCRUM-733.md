# SCRUM-733 · El censo de deriva no se encoge en silencio (y el defecto del encargo no era ése)

**Fecha:** 4-sep-2026 · **Carril:** censo de deriva de esquema · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `8303db7524d3e0e90659c49f840d47adefaf6d5f` · 2026-09-04T21:42:02+01:00
**Medido en:** host `DESKTOP-A24926K` · rama `scrum-733-entrada-perdida-en-silencio`

**Tanda:** **5.289 pruebas · 5.200 en verde · 1 fallo · 88 saltadas**, con `main` ya mergeado
dentro y medida DESPUÉS del último cambio, entrada incluida.

🔴 **El «1 fallo» no es de esta rama.** `main` limpio da el mismo: se midió ANTES de tocar nada,
sobre un worktree recién nacido de `ac282d5553f17072ab2281244e5a3d853fdd176a`, y dio **5.274 ·
5.185 · 1 fallo · 88 saltadas**, con el mismo test y el mismo mensaje. Está abajo, en los hallazgos
fuera de carril; lo lleva S5 en SCRUM-730.

**Y los +15 cuadran exacto, sin necesidad de comparar TAP:** **10** son de este ticket (medidos
corriendo el fichero solo) y **5** son los de SCRUM-699, que entraron con el `main` mergeado —
`5.274 + 10 + 5 = 5.289`. Que la suma dé al píxel no sustituye a un fan-out nombre a nombre, que
**no se ha hecho**; se dice de dónde sale cada número en vez de dejarlo en «subió quince».

---

## 🔴 LO PRIMERO: EL DEFECTO DEL ENCARGO NO REPRODUCE, Y SE MIDIÓ ANTES DE TOCAR NADA

El encargo decía: *«el generador de `docs/sql/deriva-prod.sql` pierde una entrada EN SILENCIO si su
última línea lleva comentario SQL»*. Y añadía, como primera evidencia: *«escribe una entrada con
comentario al final, regenera, y comprueba que DESAPARECE. Antes de arreglar nada.»*

Se hizo, **con un `prisma generate` de verdad** —porque el generador lee el DMMF del cliente y no
un fichero, así que cualquier simulación que se salte ese paso mide otra cosa— añadiendo un campo
como **último** del modelo `Customer`:

| última línea del campo nuevo | `prisma generate` | columnas | ¿está la sonda? |
|---|---|---|---|
| **CONTROL** · `sonda733 String?` | genera | **423** | **SÍ** |
| `sonda733 String? // nota al final` | genera | **423** | **SÍ** |
| `sonda733 String? /// nota al final` | genera | **423** | **SÍ** |
| `sonda733 String? -- nota al final` | **NO GENERA** | — | — |

**No desaparece nadie.** Y el caso que el encargo nombra —el comentario **SQL**— ni siquiera puede
existir: `--` no es sintaxis Prisma y `prisma generate` lo rechaza con un error de validación. Un
comentario SQL en un `schema.prisma` no es una entrada que se pierda: es un fichero que no compila.

🔴 **`prisma/schema.prisma` NO se tocó.** Todo se hizo sobre una copia; el fichero del fundador se
verificó **byte a byte** con `Buffer.compare` al terminar.

### Y el CONTROL es lo que hace que esa tabla valga

La primera versión del medidor dio **«no está» en los cuatro casos, control incluido**, y eso
habría pasado por confirmación del defecto. La causa: leía el DMMF con un `import` con
cache-buster, y `generar-sql-deriva.mjs` hace `require('@prisma/client')` — CJS, cacheado por
proceso. Medía siempre el primer cliente cargado. **Se cazó porque un campo válido y generado
TENÍA que aparecer y no aparecía.** Ahora cada medición corre en un subproceso.

Es la misma lección de ayer con otra cara: sin control positivo, un instrumento roto y un defecto
real dan la misma salida.

## PASO 0

**ENTRADA.** No hay pantalla: el fundador lo ejecuta a mano —`node scripts/generar-sql-deriva.mjs`—
y pega el SQL resultante en la consola de Postgres de Railway. **No está en el CI** (comprobado:
`ci.yml` no lo invoca), y eso importa, porque el guard de SCRUM-461 ya dejó escrito que *«este
script lanzado a mano no pasa por `pretest` — y a mano es exactamente como se lanzó»*.

**MECANISMO.** El generador **no parsea nada**: lee `Prisma.dmmf.datamodel` y escribe. Lo que sí
existe es una cadena de tres testigos ya construida —el parser de texto de `_pares-del-schema.mjs`,
el DMMF, y el regex sobre el fichero commiteado— y **una puerta** (`motivoParaNoEscribir`, de
SCRUM-461) que impide escribir con el cliente atrasado. Esa puerta funciona: en los tres casos con
el schema modificado dijo **BLOQUEA**.

## ① ¿Hay entradas perdidas HOY? No. Y se demuestra por conjuntos, no por número

Es el listón que puso el encargo: S3 midió 421 contra 422 y **no** era este defecto —era su rama
detrás de `main`—, y lo demostró viendo que ninguna entrada desaparecía.

| testigo | entradas |
|---|---|
| ① `prisma/schema.prisma`, por el parser de texto | **422** |
| ② DMMF del cliente generado | **422** |
| ③ `deriva-prod.sql`, con el regex ESTRICTO de la casa | **422** |
| ④ `deriva-prod.sql`, con un regex deliberadamente MÁS FLOJO | **422** |

**Las seis diferencias de conjuntos entre los cuatro: cero.** Y el fichero commiteado es **byte a
byte idéntico** a lo que el generador produce hoy. El testigo ④ está a propósito: si el flojo viera
más que el estricto, habría entradas que el vigilante de la casa no está mirando.

## ② ¿Qué formas de línea final ciegan al parser? Ninguna de las 16

Población declarada: **16 formas** de última línea, cada una probada contra los **dos** parsers de
texto que hay en el camino —`paresDelSchema` (el testigo) y `normalizarSchema` (la puerta)—, y
además las 4 de arriba probadas de punta a punta con `prisma generate`.

Las 16: línea normal · `//` · `///` · `--` · `--` pegado · `#` · `@default` con URL (lleva `//`)
· `@map` con `//` dentro · `@default` con `--` dentro · cierre `}` en la misma línea · cierre +
comentario · tabulador delante · espacios al final · comentario con `}` dentro · atributo con
paréntesis anidados · `@map` + comentario.

**Las 16 se ven en los dos.** El caso de control se ve, así que el arnés distingue.

**Lo único ciego que apareció** es el regex del **fichero ya escrito**
(`paresDelSql`, en `tests/scrum461-censo-no-encoge.test.mjs`), que exige la línea EXACTA
`^ {4}\('a','b'\),?$`. Medido sobre el fichero real:

| se le hace a una línea | ve | deja de ver |
|---|---|---|
| a la ÚLTIMA, ` -- nota` detrás | **421** | 1 (`whatsapp_messages.wa_message_id`) |
| a la PRIMERA, ` -- nota` detrás | **421** | 1 (`albaran_lineas_facturadas.albaran_id`) |
| a la ÚLTIMA, un espacio final | **421** | 1 |
| a TODAS, sangría de 2 en vez de 4 | **0** | 422 |

**Pero eso GRITA, no calla**, y por eso no es este ticket: la entrada invisible sale como *«falta en
el SQL»* y el test **cae**; y el caso de ceguera total lo cubre su suelo `>= 300`. Es un falso
positivo latente, no una pérdida — y **da exactamente 421 de 422**, que es el número que vio S3.
Se deja escrito por si vuelve a aparecer ese desfase, pero **no se afirma** que fuera la causa: S3
demostró la suya por conjuntos.

## ③ ¿Otro fichero generado con el mismo patrón? No

Población: **1.109** ficheros `.mjs/.js/.ts` en `scripts/`, `tests/` y `src/`. Con un regex de línea
entera (`^…$` + `gm`) **y** `readFileSync`: **12**. De ésos, **11** llevan suelo declarado. El
único sin él —`scripts/_scratch-run.mjs`— se revisó a mano y **no es el patrón**: extrae UN valor y
devuelve `null` si no lo encuentra, no un censo que pueda encogerse.

Y **sólo un script escribe en `docs/`** en todo el repo: éste. Control positivo (encuentra el caso
conocido) y negativo (el generador **no** sale, porque no parsea) incluidos. El censo es **por
texto** y su clasificación es una pista: por eso los 12 se listan uno a uno en vez de publicar sólo
el número.

## 🔴 LO QUE SÍ FALTABA, Y ES LO QUE EL ENCARGO PEDÍA COMO SUELO

> *«el generador debe FALLAR, no encogerse, cuando no sabe leer una entrada. "No hay entrada" y
> "no supe leerla" no pueden ser el mismo resultado.»*

Hoy **eran el mismo resultado**. Medido:

```
generarSql([])   ->  ESCRIBE SIN QUEJARSE   48 líneas   -- Columnas esperadas: 0. Tablas: 0.
generarSql(uno)  ->  ESCRIBE SIN QUEJARSE   48 líneas   -- Columnas esperadas: 1. Tablas: 1.
```

…y el script sale con **0** diciendo *«escrito … (0 columnas)»*.

**El modo de fallo es lo que lo hace serio.** Con CERO entradas el SQL ni siquiera es válido
(`VALUES\n\n),`) y Postgres protesta — ruidoso, se arregla. **Con POCAS es SQL perfectamente
válido que devuelve «0 filas»**, o sea *«en sync»*, sobre una base a la que le falten justo las
columnas que el censo ha dejado de preguntar. Es la mentira exacta que este fichero existe para
impedir, y llegaría firmada por su propia cabecera.

Que hoy no haya camino conocido para provocarlo **no es motivo para no ponerlo**: el guard de
procedencia se protege de que `.prisma/client/schema.prisma` sea detalle interno de Prisma y pueda
mudarse. `Prisma.dmmf.datamodel` es **igual de interno**, y la deprecación de `package.json#prisma`
que ya avisa en cada `generate` dice que Prisma 7 viene.

### Lo que se añade

Tres piezas, **en el camino de ESCRITURA y no dentro de `generarSql`** — misma decisión que ya
tomó `motivoParaNoEscribir` y por el mismo motivo: los tests llaman a `generarSql` con listas
sintéticas de tres pares, y meterlo dentro los haría depender del entorno.

* **`columnasDeclaradas(texto)`** — lo que la cabecera del fichero dice que hay.
* **`leerCensoDelFichero(texto)`** — las entradas del fichero ya escrito, **a propósito más
  tolerante** que el vigilante de SCRUM-461. Y lleva su propia comprobación: el fichero **declara**
  su recuento, así que se le pregunta a él; si lo leído no cuadra con lo declarado devuelve
  **«no supe leer»**, que NO es «este fichero tiene pocas entradas».
* **`motivoParaNoEncoger(pares, textoEnDisco, opciones)`** — el suelo: cero nunca se escribe; si
  alguna entrada **desaparece** se para y **se la nombra**; si el fichero no cuadra consigo mismo
  el veredicto es «no supe leerlo»; y un encogimiento **legítimo** se acepta a la cara con
  `--acepta-encogimiento`.

**Por qué el lector es más tolerante y no más estricto:** al vigilante de SCRUM-461 una entrada
invisible se le lee como *«falta en el SQL»* y grita, que es lo correcto allí. Aquí se leería como
que el censo **se encoge**, y pararía una regeneración legítima por una anotación de nadie —
enseñando de paso a la siguiente sesión a pasar `--acepta-encogimiento` por costumbre, que es cómo
se vacía una salvaguarda. Es la instrucción del encargo cumplida al pie: **no se prohíbe el
comentario; el parser sabe leerlo.**

## Verificado en rojo — cuatro mutaciones y una ejecución real

Cada mutación guarda los **bytes** de disco antes de tocar, comprueba que ha cambiado **ese**
fichero y no «alguno», corre la tanda del ticket y restaura verificando con `Buffer.compare`. El
árbol queda limpio y se comprueba con `git status` al final.

| se rompe a propósito | cae por |
|---|---|
| ① se **desenchufa** el suelo del camino de escritura | «el suelo se LLAMA en el camino de escritura, no sólo existe» |
| ② el lector se vuelve **estricto** (el defecto del encargo, puesto en mi lector) | «CONTROL NEGATIVO: el lector NO se ciega con un comentario SQL detrás» |
| ③ el suelo dice que sí a todo | los **tres**: el vacío, el encogimiento y el «no supe leerlo» |
| ④ **CONTROL NEGATIVO**: un cambio real que no toca el suelo | **no cae** — y no debe |

La ① es la que impide el verde hueco: **exportar un guard no es llamarlo**, y sin ese test los
otros nueve estarían probando una función que nadie invoca. La ② mete en mi propio lector el
defecto que el encargo describía, para demostrar que el test lo cazaría si alguien lo introdujera.

### Y una ejecución REAL del script, que prueba el producto y no el test

Se le añade al fichero de disco una entrada de más (subiéndole el contador de la cabecera para que
cuadre consigo mismo, de modo que el único hecho sea que el generador produce una menos) y se
ejecuta el script:

```
codigo de salida: 1  (para)
¿NOMBRA la entrada que desaparece? SI      -> zzz_inventada.columna_fantasma
¿dejo el fichero SIN TOCAR? SI
CONTROL NEGATIVO · con --acepta-encogimiento: codigo=0, escribe el censo bueno (422 columnas)
```

## Ficheros

`scripts/generar-sql-deriva.mjs` (tres funciones nuevas + el suelo enchufado antes del
`writeFileSync`) · `tests/scrum733-el-censo-no-se-encoge-en-silencio.test.mjs` (**nuevo**, 10
tests) · esta entrada.

**No se ha tocado:** `docs/sql/deriva-prod.sql` — **byte a byte idéntico** antes y después, y hay
un test que lo fija · `prisma/schema.prisma` (del fundador; verificado por bytes tras el
experimento) · `tests/scrum461-censo-no-encoge.test.mjs` ni ningún otro test existente ·
`scripts/_pares-del-schema.mjs` · `scripts/_prisma-procedencia-guard.mjs` · `package.json` · sin
dependencias nuevas (regla 36) · el suelo de la tanda, que sigue siendo un mínimo y esta rama sólo
añade tests.

## Estado del árbol

* Rama nacida de `origin/main` = `ac282d5553f17072ab2281244e5a3d853fdd176a`. Durante la sesión
  `origin/main` avanzó a `8303db75` (entre otras cosas, con el merge de SCRUM-699): se **mergeó
  `main` DENTRO**, sin reescribir historia, y **las mediciones se repitieron sobre el árbol
  mezclado** — 422 por los cuatro testigos, cero diferencias, byte a byte idéntico, y las cinco
  verificaciones en rojo otra vez.
* Comprobado que lo que trae ese `main` **no toca** este territorio: cero líneas en
  `generar-sql-deriva.mjs`, `deriva-prod.sql`, `schema.prisma` ni el guard de procedencia.
* Cero CR en disco en los ficheros tocados, medido por **BYTES**.
* `npm run guards:entrada` en verde.

## 🔴 Los huecos que declaro

1. **No he demostrado que el DMMF pueda venir corto.** El suelo se pone porque el modo de fallo es
   caro y el mecanismo es interno de Prisma, no porque haya un camino medido que lo provoque. Es
   una barrera preventiva y se declara como tal: si alguien busca el incidente que la justifica,
   **no lo hay**.
2. **El censo de la medición ③ es POR TEXTO.** Clasifica «con suelo / sin suelo» mirando si la
   palabra está cerca, no si ese suelo cubre ese extractor. Por eso los 12 se listan; el único que
   salía sin suelo se revisó a mano y los otros 11 **no**.
3. **No he probado el suelo contra un cliente de Prisma realmente roto**, que es el escenario que
   motiva el punto ①: los casos del vacío y del encogimiento se construyen pasándole listas a la
   función, no averiando el DMMF.
4. **El experimento del `prisma generate` se hizo sobre UN modelo (`Customer`) y UN campo
   opcional.** No he barrido los 24 modelos ni los tipos con `@relation`, `@@map` o enums.
5. **No he tocado el vigilante ciego de `tests/scrum461-censo-no-encoge.test.mjs`**, que es de otro
   carril: queda medido y reportado abajo, no arreglado.
6. **`--acepta-encogimiento` no deja rastro.** Si alguien lo usa, el fichero encoge y nada lo
   registra: el argumento es la salida declarada, no una autorización con constancia como la de
   `_clasificador-sql.mjs`. Si el fundador quiere constancia, es otro ticket.

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* `paresDelSql` en `tests/scrum461-censo-no-encoge.test.mjs` exige la línea EXACTA y pierde una entrada por un comentario SQL —o un espacio— detrás: da **421 de 422**, y el falso «falta en el SQL» apuntaría al schema en vez de a la anotación.
* `npm test` sobre `main` limpio sigue dando **1 fallo** en esta máquina (`tests/scrum176b-force-por-identidad.test.mjs:118`, la ruta sin decodificar el `%20`): medido hoy sobre árbol limpio, **5.274 · 5.185 verde · 1 fallo · 88 saltadas** — lo lleva S5 en SCRUM-730.
* `prisma generate` avisa en cada ejecución de que `package.json#prisma` está **deprecado y se elimina en Prisma 7**; hoy nadie tiene ticket para eso y media docena de guards leen internos de Prisma.
* Ejecutar `node_modules/.bin/prisma` con `execFileSync` **falla siempre en Windows** (es un lanzador de shell): quien escriba un script que invoque Prisma, que resuelva `prisma/build/index.js` por `require.resolve` — el fallo se lee como «no se puede generar», que es otra cosa.
* Prisma **infiere la raíz del proyecto desde la ruta del `--schema`**: con el schema fuera del repo intenta un `npm i prisma` y muere, así que cualquier prueba con un schema de usar y tirar tiene que dejarlo dentro de `prisma/`.
