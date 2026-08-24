# SCRUM-567 · el censo decide por POSICIÓN, y el trinquete deja de gastar margen en ruido

**Medido contra:** `origin/main` = `fdabac014a31acd6a7ad31ed03ca643332b2e122` · 2026-08-20T23:09:23+01:00
(la rama nació de `164d092d`; `main` se movió con SCRUM-565 y SCRUM-566 y se mezcló antes de cerrar)

> **20-ago-2026 · instrumentación. No toca producto, ni marcado, ni copy, ni ningún guard para
> que el censo cuadre. Cero dependencias nuevas: `typescript` ya compila este repo.**

## El defecto: un extractor BUSCA, un fixture CONSTRUYE, y se escriben igual

Por eso el criterio no puede ser léxico. Y como este censo alimenta un **trinquete**, su ruido no
sólo ensucia el número: **gasta el margen**. Cuando alguien arregle extractores de verdad, el
número no bajará lo que debería y la salida cómoda será subir el tope — y un trinquete que se
ajusta cuando molesta deja de ser un trinquete.

## ① El censo del ruido — abriendo las 29, no contándolas

La ficha avisaba de SCRUM-566: *un criterio léxico sobre texto miente más de lo que parece* (allí
dio 3 falsos positivos de 4). Así que las **29 líneas se abrieron una a una** y se clasificaron
leyendo. Después se implementó el criterio y **coincidió con la lectura en las 29 de 29**.

```
29 con el criterio viejo  =  16 extractores de verdad  +  13 de RUIDO
```

### 🔴 Y eran DOS defectos, no uno

El ticket señalaba el `.replace()`. Al medir salió un segundo, más ancho:

| clase de ruido | nº | por qué colaba |
|---|---|---|
| **2.º argumento de un `.replace()`** | 2 | `USO_EXTRACTOR` miraba si en la LÍNEA había `.replace(`. Pero en `x.replace(A, B)` sólo A busca. **Es lo que reportó S3 tres veces.** |
| **fixtures de tabla construidos por concatenación** | 8 | la heurística «¿está dentro de una regex?» era `/\/[^/\n]*<[a-z]/` sobre lo anterior en la línea — y **cualquier etiqueta de cierre previa la dispara**: en `'<tr><td>Mano de obra</td><td>2.5</td>'`, el `</td>` es `/` + texto + `<`. |
| **prosa dentro de un mensaje de error** | 2 | la línea contenía `.includes(`/`.split(`, y la etiqueta estaba en el mensaje: *«no está entre los `<script src>` del dashboard»*. |
| **dato de entrada pasado a una función** | 1 | `textoPublicado('…<p>tres</p>').split('\n')` — el `.split` se aplica al RESULTADO. |

## ② El criterio: posicional, del AST, sin lista de excepciones

El literal cuenta **sólo si está en posición de búsqueda**:

- dentro de un literal de expresión regular, o
- en el **primer argumento** de un método cuya aguja es el primer argumento, o
- en el primer argumento de `new RegExp(...)`.

Todo lo demás es dato. **No hay lista de nombres que ignorar**: el siguiente fixture no se cuela
porque no está en posición de búsqueda, no porque alguien se acuerde de apuntarlo.

`typescript` ya es `devDependency` —es lo que compila el proyecto—, así que no es dependencia
nueva. Y es lo que manda la propia `cerebro-yaqu`: *«para vigilar código, análisis estático del
árbol (AST), no `grep`»*.

> ⚠️ **`test` NO está en la lista de buscadores, y no es un olvido.** En `re.test(hay)` el primer
> argumento es el **pajar**. Incluirlo habría marcado el documento entero como «lo que se busca» y
> dado por extractor cualquier literal de esa llamada — el error contrario al que este ticket
> arregla. Tiene su caso.

## ③ El tope: 29 → 23, y la cuenta va escrita porque NO es una resta simple

```
29 con el criterio viejo  =  16 de verdad  +  13 de RUIDO
23 con el criterio nuevo  =  16 de verdad  +   7 QUE NO SE VEÍAN
```

**Los 7 no se absorben.** Son extractores **reales** que el detector viejo no veía porque exigía
la etiqueta y la llamada de búsqueda **en la misma línea**:

| dónde | por qué se escapaba |
|---|---|
| `tests/scrum331-heroe.test.mjs:163` y `:164` | regex en línea de continuación |
| `tests/scrum541-comparativa-a11y.test.mjs:82` | `.exec()`, que no estaba en la lista vieja |
| `tests/_barra-lateral.mjs:77` | regex asignada a una constante |
| `tests/scrum264-copy-que-llega-al-cliente.test.mjs:74` | regex en una propiedad de objeto |
| `tests/scrum363-eje-de-cobro.test.mjs:133` | `assert.match` multilínea |
| `tests/scrum551-anclas-bloque-f.test.mjs:152` | `.replace()` multilínea |

Van **nombrados en el test**, cuentan dentro del tope como cualquier otro, y hay un caso que avisa
si alguno deja de verse — porque entonces el número bajaría **sin que nadie hubiera arreglado
nada**, que es el fallo caro.

> 🔴 **Por qué el tope no baja a 16, que es lo que decía la ficha.** Porque 16 no es lo que hay:
> sería un tope que el árbol no cumple, o sea `main` en rojo. La instrucción daba por hecho que
> afinar el criterio sólo QUITA; aquí también REVELA. La rebaja honesta es de **6** —13 que se van,
> 7 que aparecen— y las dos mitades están escritas en el propio `TOPE`. **El tope baja porque se
> midió ruido, nunca porque el número molestara**, y no sube en ningún caso.
>
> Si se prefiere el 16, el camino es arreglar esos 7 —`<span class="eyebrow"[^>]*>`, la convención
> de SCRUM-543— y bajar el tope con ellos. Eso es trabajo, no ajuste.

Y el caso de `scrum551:152` merece señalarse: es **exactamente** el que reportó S3, y tiene el
**mismo literal en los dos argumentos** del `.replace()`. El criterio cuenta el primero y no el
segundo — hay un caso dedicado a eso.

## ④ El control que decide, en las dos direcciones

Con el commit `857b65e1` ya hecho, sobre un fichero **real** del árbol que hoy no aporta ningún
acierto:

```
censo de partida: 23 extractores

✅ ① un EXTRACTOR de verdad con el `>` pegado        23 → 24   (esperado 24)
✅ ② un HTML literal en el 2.º argumento de replace  23 → 23   (esperado 23)
✅ ③ un fixture construido por concatenación         23 → 23   (esperado 23)
✅ ④ los DOS a la vez → sube exactamente UNO         23 → 24   (esperado 24)
⑤ el TRINQUETE con el extractor inyectado → exit 1  ✅ cae, y nombra fichero y etiqueta
revertido · Buffer.compare = 0 ✅ · git status limpio ✅
```

Las dos direcciones no valen lo mismo: que un dato vuelva a contarse es el ruido que este ticket
quita; **que un extractor de verdad deje de contarse es el fallo caro**, porque el número bajaría
solo y el trinquete mentiría.

## El suelo que yo creía tener NO EXISTÍA

Escribí un caso que exigía que un fichero ilegible **lanzara**, y falló: `ts.createSourceFile`
**no lanza** — se recupera de los errores de sintaxis y devuelve un árbol parcial. Con eso, un
fichero roto habría salido con **cero tramos de búsqueda**, y cero tramos se lee como *«aquí no
hay extractores»*: la conclusión cómoda.

Lo cantó su propio control. Ahora se miran los `parseDiagnostics` del parser y se lanza nombrando
el fichero y el error. Medido: ninguno de los 667 ficheros del árbol falla al parsear, así que el
suelo no da falso positivo.

## Verificación

- **Los 29 aciertos abiertos uno a uno**, y la clasificación del AST coincidió **29/29** con la
  lectura. No se ha confiado en la cuenta.
- **Controles del criterio**: 7 formas de extractor real que siguen contándose, 4 formas de dato
  que ya no, el caso del mismo literal en las dos posiciones, y el de `test` como pajar.
- **Suite:** `3936 tests · 3859 pass · 0 fail · 77 skipped` (ya mezclado con `fdabac01`).
- **CRLF** comprobado con `Buffer`: CR=0 en los dos ficheros tocados.
- **El trinquete en vivo**: al mezclar `main` entraron dos ficheros nuevos a `tests/` y
  `scripts/` (SCRUM-565). El censo siguió en **23** — el trinquete aguantó su primera crecida real
  del árbol.

## Lo que NO se ha hecho

- **No se ha subido el tope.** Baja de 29 a 23.
- **No se ha tocado ningún marcado ni ningún guard** para que el censo cuadre. Los 7 nuevos se
  dejan sin arreglar **a propósito**: arreglarlos es trabajo con su propio riesgo, y absorberlos
  habría sido justo lo que la ficha prohíbe.
- **No se ha metido un parser de HTML.** El AST es de JavaScript, y de una dependencia que ya
  estaba.

## Ficheros

| fichero | qué |
|---|---|
| `scripts/censo-etiquetas-pegadas.mjs` | el criterio posicional por AST, y el suelo de verdad |
| `tests/scrum553-etiquetas-pegadas.test.mjs` | `TOPE` 29 → 23 con su descomposición, los 7 nombrados, y 6 casos nuevos |
