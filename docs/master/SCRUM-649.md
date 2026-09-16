# SCRUM-649 · El guard comprobaba que el sha tuviera FORMA de sha, no que el commit existiera

**Medido contra:** `origin/main` = `1f18293ed08ed65f467151269c3f1f92f9d52675` · 2026-09-16T04:36:58+01:00

**Carril:** instrumentos · registro · **Gate:** sin gate — corre en `npm test`

---

**Tanda:** 6884 tests · 6774 pass · **0 fail** · 110 skipped (todos gateados por entorno y con su
motivo declarado) · `guards:entrada` 26/26.

## PASO 0 · el defecto está VIVO, y se comprueba corriendo

Se coge un ancla REAL del árbol —`SCRUM-16.md:3`—, se le cambia **un dígito** del sha
manteniendo los 40 hexadecimales, y se corre el guard:

```
sha REAL       : 3f9585c29af64ed5b326cd89ccd10cd4f83c4c31   git cat-file -t -> commit
sha INVENTADO  : 0f9585c29af64ed5b326cd89ccd10cd4f83c4c31   git cat-file -t -> (NO EXISTE)
misma forma    : true

con el ancla INVENTADA, el guard da: 0 rojo(s)
```

**Cero rojos sobre un ancla que no apunta a ningún sitio.** Un ancla así no es un ancla: es una
medición que nadie puede reproducir. Es el último agujero del sistema — SCRUM-516 arregló la
unidad, SCRUM-532 el delimitador, SCRUM-859 el criterio y la identidad, y todo eso validaba
anclas que podían no llevar a ninguna parte.

## ② El censo, con su población declarada

Medido **después** de mezclar `origin/main` dentro de la rama, que es el árbol que va a correr.
La columna de la derecha es la de antes del merge, para que se vea qué movió y qué no:

| | ya con `main` dentro | antes del merge |
|---|---|---|
| ficheros de `docs/master/` | **513** | 511 |
| líneas `**Medido contra:**` | **808** | 800 |
| · con sha de 40 | **797** | 790 |
| · en otra forma (no son anclas de sha) | **11** | 10 |
| **shas DISTINTOS a resolver** | **395** | 389 |
| · resuelven en este clon | **394** | 388 |
| · 🔴 **no resuelven** | **1** | 1 |

El merge trajo `SCRUM-861.md` y 7 anclas nuevas, **todas resuelven**. La onceava «en otra forma»
es de esta misma entrada: la fila de arriba que dice `líneas **Medido contra:**` y que el censo,
con razón, cuenta como mención en prosa. **La que no resuelve sigue siendo exactamente una, y la
misma.**

**El que no apunta a ningún sitio, listado y no corregido (regla 9):**

```
docs/master/SCRUM-652.md:284   01d5c5a03e1f5e1b93d24e9f10b5b6b9a8a3f9c2
# SCRUM-652 · T3 fase B — el parte de trabajo, construido hasta la puerta del esquema
```

Las **10 en otra forma** que no son mías no son un hallazgo nuevo: tres son **ejemplos de formato** en prosa
(`SCRUM-267` describiendo el ancla, `SCRUM-532` y `SCRUM-859` citándola), seis son **shas
abreviados** que ya están en `SIN_HORA_Y_SHA_CORTO`, y una es la `OTRA_BASE` de `SCRUM-821`.

### ⚠️ «No lo encuentro» y «no existe» no son lo mismo — contra qué se resuelve

Un commit puede faltar en un clon y estar en `origin`: una rama autoborrada, un objeto no
alcanzable localmente. Así que se usan **dos sondas independientes**:

1. **local** — `git cat-file --batch-check`, una sola llamada para los 395. Verificado antes que
   este clon **no es superficial** (`--is-shallow-repository` → `false`).
2. **origin** — sólo para el que la primera no encuentra: la API pública contesta **200** para un
   sha real y **422** para el inventado, y para `01d5c5a0…` contesta **422**.

O sea que ese sha **no existe en ninguna de las dos**. Y lo que el guard exige es resolver **en el
clon donde corre**: si algún día uno falta aquí y está en `origin`, eso se arregla **clonando
entero**, no añadiéndolo a la lista — y el mensaje del rojo lo dice.

**No hay ningún caso no decidible hoy**: 394 resueltos por la primera sonda, 1 por la segunda.

## Lo que se construye

`sondaDeExistencia()` + el test que recorre **todas** las anclas. Tres cosas que lo sujetan:

- **la sonda pasa su control antes de afirmar nada**: se le da `HEAD` (tiene que salir `commit`)
  y un sha inventado (tiene que salir `missing`). Una sonda que dijera «existe» a todo daría
  verde sobre cualquier cosa;
- 🔴 **un clon SUPERFICIAL no puede comprobar esto**: le faltan los objetos antiguos y caerían
  anclas **buenas** a cientos — el rojo intermitente que acaba con alguien apagando el guard. Se
  **detecta y se dice**, en vez de medir mal. (CI clona con `fetch-depth: 0` desde SCRUM-388,
  justo por esta familia de cegueras.)
- **suelo**: si hay menos de 300 entradas con ancla, se declara CIEGO — un cero sobre eso no
  significa «todas buenas».

### La lista, CERRADA en una

`ANCLAS_QUE_NO_RESUELVEN` con `TOPE_SHA_NO_RESUELVE = 1`, clavada **por identidad** (SCRUM-859).
Si aparece una segunda, el guard cae: **se decide, no se añade una línea más.** Y hay un test en
las dos direcciones — que la excepción no se quede huérfana, y que **no sobre**: si ese sha
llegara a resolver, hay que quitarla y bajar el tope.

## Los cuatro controles

| control | resultado |
|---|---|
| 🔴 **EL QUE DECIDE**: sha bien formado e inexistente | **cae**, y nombra **fichero, línea y sha** — ejercido sobre las 797 anclas reales, cambiando un dígito **en memoria**, y comprobando que los hallazgos suben en **exactamente uno** |
| ✅ **POSITIVO**: las anclas reales siguen pasando | **394 de 394**, una por una, y los números cuadran (no-resuelven = declarados) |
| ✅ **NEGATIVO**: lo que cerró SCRUM-859 sigue cerrado | tope de 5 · 5 usos · identidad por `tituloCompleto`, **ejercido** insertando una entrada |
| 🔴 **MUTACIÓN**: apagar la comprobación | **1 rojo**, y es el control que decide — verificando que **la mutación entró en disco** antes de creerse el resultado |

### 🔴 Tres rojos que sacó la tanda, y los tres eran míos

No salieron del ticket: salieron de mezclar `main` y correr la tanda entera. Van escritos porque
**el más grave era el instrumento, no lo medido**.

**① SCRUM-824 tumbó mi control que decide, y tenía razón.** Su primera versión mutaba
`docs/master/SCRUM-16.md` **de verdad** y corría el guard en un proceso hijo. La tanda corre a
**concurrencia 12**: mientras ese fichero tenía un sha inventado dentro, cualquier otro test que
recorra `docs/master/` lo estaba leyendo. Eso no es un control, es una **fábrica de rojos
intermitentes** — y un rojo que sale una vez de cada dos enseña a relanzar la tanda y acaba con el
guard apagado. Es decir: el instrumento que escribí para cerrar un agujero abría otro peor, y el
trinquete de la casa lo cazó antes que yo.

Rehecho: la decisión se extrae a `anclasMuertas(entradas, resuelve, exentas)` —una función pura— y
el control la ejerce **sobre el registro real, en memoria, sin escribir un byte**. Gana además las
dos direcciones en la misma pasada y un número exacto: cambiar un dígito sube los hallazgos de N a
N+1, ni cero (no lo ve) ni más de uno (acusa a otros de paso).

**② SCRUM-723 me metió en su censo, y también tenía razón.** `scrum267` llevaba tiempo nombrando
`origin/main` en `RE_ANCLA` —es parte del **texto que valida**, no un objetivo de comparación—,
pero **no llamaba a git**, y ese censo sólo mira los ficheros que lo llaman. Al añadirle la sonda
de existencia, sus literales de siempre se hicieron visibles de golpe. El censo no falló: acertó el
día que tuvo materia. Declarados los dos con su motivo y quién los retira, que es lo que su propio
rojo pide.

**③ SCRUM-859 declaró sobrante mi lista nueva** — «YA tiene ancla: sobra en la lista». Correcto
según lo que ese test sabía, y el fallo era de diseño mío: hay **dos familias de lista** y las
estaba juzgando con la misma vara. Las de SCRUM-859 eximen de **tener** ancla (si la tiene, sobra);
`ANCLAS_QUE_NO_RESUELVEN` es lo contrario: la entrada **tiene** ancla y lo que falla es que el sha
no apunta a nada. Ahora cada familia se juzga con su criterio, **y la población de motivos está
declarada**: un motivo sin clasificar hace caer el test en vez de colarse por una de las dos vías.

### 🔴 Y una trampa que me mordió antes de eso, y que queda escrita aunque el código ya no la tenga

Aquella primera versión con proceso hijo falló diciendo que el guard seguía **verde**. No era
cierto: `node --test` marca a sus hijos con `NODE_TEST_CONTEXT` y, si la ve, **se niega a ejecutar**
(«run() is being called recursively… skipping running files») **y sale con 0**. Mi control leía ese
0 como «el guard pasa» y habría dado por vivo un defecto ya arreglado. Es la familia de SCRUM-850
dentro del instrumento escrito para cazarla.

El arreglo de entonces fue limpiar la variable en el hijo **y** exigir que la salida no dijera
`skipping running files` — porque sin eso un `0` no se distingue de un runner que no corrió. Hoy el
control ya no lanza ningún hijo (ver ① arriba), así que el código no lo necesita; **queda anotado
porque la trampa sigue ahí para el siguiente que lance un runner dentro de un runner.**

## Lo que NO se hizo

- **Ningún ancla corregida ni inventada.** La que no resuelve se **lista**: sólo quien la escribió
  sabe contra qué midió, y ponerle otro sha sería fabricar una medición.
- **No se subió ningún tope ni se relajó ningún guard** (regla 41).
- **No se tocó el texto de ninguna entrada de máster.**
- **`src/` intacto** · cero dependencias (36) · cero estado o flag de producto (27).

> ⚠️ **Nota de tanda:** `scrum649-…` importa `trocearEntradas` y `sondaDeExistencia` de
> `scrum267-…test.mjs`, que es donde viven. Importar un fichero de tests **ejecuta sus tests**,
> así que los 14 de SCRUM-267 corren también dentro de éste y el total de la tanda sube en 14.
> Se dice en vez de dejar que alguien lo descubra contando.
