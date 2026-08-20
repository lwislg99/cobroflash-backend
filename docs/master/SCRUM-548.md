# SCRUM-548 · el peaje es real, y lo que escondía era una revisión manual que ahora se deriva

**Medido contra:** `origin/main` = `e023ab3732292ab87088447a841aed13053d611b` · 2026-08-20T20:18:30+01:00
(la rama nació de `9f25dab9`; `main` se movió con SCRUM-562 y se mezcló antes de cerrar —
**con conflicto en `package.json`**, ver abajo)

> **20-ago-2026 · instrumentación y documentación. No se toca `pretest`, `postinstall`, `test` ni
> `test:staging`. No se reordena ningún script. Ningún guard se muda de fichero.**

## ① El patrón, MEDIDO — y la premisa del ticket, corregida

Se reproduce **cada merge del repositorio** con `git merge-tree --write-tree` sobre sus dos
padres. Leer los mensajes de commit habría medido quién se acordó de escribirlo.

```
1008 merges reproducidos          (ventana 2026-07-13 → 2026-08-20)
  10 con los DOS lados tocando package.json
   5 con CONFLICTO reproducido
```

| clase | nº | cuáles |
|---|---|---|
| **DOS SCRIPTS NUEVOS** (los dos lados sólo añaden) | **3** | 20-ago · `a24227e9`, `072b74b2`, `1381065e` |
| **MODIFICACIÓN REAL** (alguien cambió lo que había) | 2 | 22-jul · `9c6de108`, `4adba321` — sobre `test` y `test:staging` |

**No es cinco de cinco.** Es **tres de los tres últimos**, más dos anteriores que eran conflictos
de verdad y en los que el conflicto estaba haciendo su trabajo. El patrón existe y es **más joven
y más estrecho** que el enunciado: empieza el 20-ago, cuando los guards se multiplican.

> ⚠️ **Lo que este censo no puede ver:** un conflicto resuelto en una rama que nunca se empujó, o
> cuyo merge se aplastó, no deja rastro reproducible. La población es «los merges que existen en
> este repositorio». Si el recuento del ticket incluía alguno así, no está aquí.

## ② Dónde caen

De las claves implicadas en los tres conflictos aditivos: **14 de familia `guard:`, 6 de
`censo:`, ninguna fuera**. Los dos de julio caen en `test`/`test:staging`.

El bloque `guard:*`/`censo:*` es contiguo (líneas 26–53 antes de este PR) y **todo el mundo añade
en el mismo punto**: el final del bloque. Por eso chocan.

## ③ El número que esperaba SCRUM-522

```
9 guards de navegador · 54 s en serie · 9/9 verdes
```

**Nueve, no siete ni ocho.** El «siete guards, 45,9 s» estaba escrito a mano en **tres** sitios y
llevaba días siendo falso.

Y una segunda pasada **minutos después, en la misma máquina**:

| | pasada 1 | pasada 2 | Δ |
|---|---|---|---|
| `guard:contraste` | 10,2 s | 7,2 s | **−29 %** |
| `guard:cls-barra-anuncio` | 16,4 s | 15,9 s | −3 % |
| `guard:primera-pantalla` | 6,2 s | 6,0 s | −3 % |
| **TOTAL** | **54 s** | **49,6 s** | **−8 %** |

## ④ La salida propuesta: documentarlo — y con el motivo medido

**Se elige (c): escribir que el conflicto es esperado y cómo se resuelve.** No por resignación:
porque las otras dos candidatas **no eliminan el conflicto**, y eso se puede razonar con los
números delante.

- **Una convención de dónde se añade** no lo quita. El conflicto es de git: dos ramas que insertan
  en el mismo punto chocan, y «al final de su familia» es exactamente lo que ya se hace.
- **Un guard de orden derivable** tampoco. Dos guards nuevos caen adyacentes se ordene como se
  ordene — y alfabéticamente, además, dos que empiecen por la misma letra colisionan igual,
  rompiendo de paso la agrupación por familia y los `//comentario` pegados a su comando.
- **Sacarlos de `package.json`** rompería la autoridad sobre la que está montado
  `censo:guards-navegador`, y lo haría **en silencio**.

La convención va **en `package.json`, en la cabecera del bloque de guards** — donde la lee quien
añade uno, no en un documento que no va a abrir. Dice cinco cosas: que el conflicto es esperado,
que se resuelve conservando los dos, por qué ordenar no lo arregla, por qué no se mudan, y qué
correr al añadir uno.

### 🔴 Pero el peaje escondía algo que SÍ había que sustituir

El coste no era resolverlo. Era que **dos de los cinco conflictos destaparon un defecto porque
obligaron a mirar `package.json` a mano**. Eso era suerte.

La parte derivable de esa revisión —**a qué página va cada guard**— ahora la hace el censo en
milisegundos, y **dice más de lo que encontró la suerte**:

```
5 guards sobre /index.html    a11y-comparativa, a11y-landing, cls-barra-anuncio,
                              objetivo-tactil, primera-pantalla
2 guards sobre /medicion.html aviso-bizum, vias-de-cobro
```

SCRUM-546 encontró **un solape de dos**. Medidos, sobre la landing son **cinco**.

No es un defecto por sí solo —dos guards pueden mirar cosas distintas de la misma página—, pero es
el sitio donde mirar, y hasta hoy sólo se miraba cuando había un conflicto delante.

**Y lo que el detector NO puede resolver se declara:** `guard:contraste` saca sus páginas de una
función (`paginasDelProducto()`), así que su destino no es derivable. Sale como *no resuelto*.

> ⚠️ Una versión anterior de ese detector lo dejaba en cadena vacía —o sea `/index.html`— y
> anunciaba «no resueltos: ninguno» habiendo uno. Un destino **inventado**, y encima hacia el lado
> cómodo. Lo causaba un `\x00*` codicioso que se comía también la variable de la ruta.

## ⑤ Las cifras escritas a mano — decidido con la varianza delante

**Se retira el RECUENTO de la población y el TOTAL del coste; se conserva el coste de cada guard.**

El criterio no es «los números caducan»: es **qué los invalida**. El coste de un guard es suyo y
sólo cambia si alguien toca ese guard. El recuento y el total los invalida **el commit de otra
sesión**, así que nadie los revisa — por eso «siete guards» sobrevivió a dos guards nuevos.

**Y no hay trinquete sobre el coste**, descartado con dato y no con opinión: si el total varía un
8 % entre dos pasadas **en la misma máquina**, en otra sería rojo o verde por suerte. *Un rojo
permanente es el que el segundo que lo ve desactiva.*

Lo que sí hay es un trinquete sobre **escribir la cifra**, que es independiente de la máquina: un
test que falla si un `//comentario` cita un recuento de guards o un total en segundos.

Retiradas de **cuatro** sitios (el ticket señalaba dos):

| dónde | qué decía |
|---|---|
| `//guard:cls-barra-anuncio` | «15,9 s de los 45,9 s que suman los siete guards de navegador» |
| `//guard:primera-pantalla` | «6,2 s de los 45,9 s de los siete guards de navegador» |
| `//censo:guards-navegador` | «medido hoy, SIETE guards y 45,9 s en serie» ← **una tercera copia** |
| `//guards:entrada` | «`npm test` compila y corre **2.400** tests» (hoy 3.899) |

## 🔴 EL CONFLICTO, EN VIVO, DURANTE EL TICKET QUE LO MIDE

`scrum-562` mergeó a `main` mientras esto se escribía, añadiendo `censo:arbitro-de-toque`. Al
mezclar: **`CONFLICT (content): Merge conflict in package.json`**. Sexta ocurrencia.

Y es **dato que corrige el enunciado**: esta vez **no fue un peaje puro**. Un lado añadía dos
líneas y el otro **modificaba** la línea contigua (`//guards:entrada`, quitándole el recuento), así
que el clasificador de este mismo ticket la marcaría como `MODIFICACION REAL`. Resuelta con la
convención recién escrita —se conservan las dos aportaciones—, verificando cada línea
superviviente con `Buffer.compare` contra la versión de su lado del índice.

## Verificación

- 🔴 **SUELO del censo de conflictos**: si el recorrido no encuentra ninguno, falla declarándose
  ciego. Un cero se leería como «no hay peaje».
- 🔴 **El aviso literal de la ficha**: comprobado **después** del merge — `censo:guards-navegador`
  sigue viendo **10 `guard:*` declarados, 9 de navegador**, y hay un test que exige que el censo
  vea tantos como declara `package.json`, con suelo en 9 y con el fichero de cada uno en disco.
- ✅ **Controles que discriminan**: el detector de solape entiende las dos grafías de la casa
  (plantilla y concatenación) y **declara** lo que sale de una variable; el detector de cifras
  caducadas se ejercita contra las tres frases reales que había escritas, y contra una correcta
  que no debe morder.
- **Suite:** `3899 tests · 3822 pass · 0 fail · 77 skipped`. CRLF comprobado con `Buffer`: CR=0 en
  los cinco ficheros tocados.

### Un guard de la casa cazó mi código nuevo

`SCRUM-474` vigila por AST cuántas implementaciones hay de la partición `<metodo>:<pasarela>`, y
marcó mi `familiaDe()`, que partía un `guard:contraste` por el `':'`. Es otro dominio y la misma
forma. **Se cambió mi código —el nuevo—, no el guard**: ahora usa una expresión regular, que
además dice mejor lo que hace.

> 🟡 **Nota sobre este PR**: añade dos comandos (`censo:conflictos-package` y su `//comentario`) en
> el mismo punto de siempre. Es decir, **este PR es él mismo una ocurrencia del peaje**. Va con su
> convención al lado, que es lo único que se puede hacer.

## Ficheros

| fichero | qué |
|---|---|
| `scripts/censo-conflictos-package.mjs` | reproduce los merges y clasifica los conflictos (nuevo) |
| `scripts/_solape-de-guards.mjs` | a qué página va cada guard, y qué no se puede resolver (nuevo) |
| `scripts/censo-guards-navegador.mjs` | enseña el solape; su comentario deja de citar la cifra |
| `package.json` | la convención `//guards`, los dos comandos nuevos, cuatro cifras retiradas |
| `tests/scrum548-peaje-package-json.test.mjs` | 8 tests |
