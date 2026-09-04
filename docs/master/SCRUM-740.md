# SCRUM-740 · Dos tests se pisan, y ninguno de los dos tiene un defecto

**Fecha:** 4-sep-2026 · **Carril:** herramienta / tanda · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `0cc1376eb2a1f5fb12001bf9d596eab85786d981` · 2026-09-04T21:40:00Z

---

## PASO 0

**ENTRADA:** `npm test`. No hay pantalla: la víctima son las nueve sesiones que hoy leen un rojo
intermitente y lo archivan como «el rojo ajeno de siempre».

**MECANISMO:** el acoplamiento existe y está construido — `tests/` es a la vez el árbol que se
barre y el sitio donde se escribe. Lo que faltaba era una forma de leer que sobreviva a eso.

---

## EL DEFECTO

`scrum206b` crea y borra `tests/__tmp-emite-sin-sellar.ts` mientras `scrum226` barre el árbol.
Entre el `readdirSync` que lo lista y el `readFileSync` que lo lee hay un hueco, y en ese hueco el
fichero se esfuma. TOCTOU de manual.

**No es defecto de ninguno de los dos: es acoplamiento por un recurso global.**

### ANTES — reproducido por el mecanismo, no por suerte

Correr los tres ficheros juntos **8 veces salió verde**: `node --test` no los solapa lo bastante
con tan pocos ficheros. Así que se provocó el solape a propósito — un proceso replicando lo que
hace `scrum206b` (crear y borrar el mismo fichero en bucle) mientras `scrum226` barría:

```
pasada 1 → 🔴 ROJO
  Error: ENOENT: no such file or directory,
    open 'C:\Users\Javier Pereira\cobroflash-b5\tests\__tmp-emite-sin-sellar.ts'
pasada 2 → verde     ← el churn ya había terminado
```

El rojo aparece **sólo mientras hay escritura concurrente**. Eso es el control: la carrera existe,
y existe por eso.

---

## 🔢 EL CENSO — y es lo que decide la forma del arreglo

| | |
|---|---:|
| cota bruta (cualquier escritor × cualquier barredor del repo) | 25 × 112 = **2.800** |
| escritores **dentro de `tests/`** | **4** |
| barredores que **alcanzan `tests/` o la raíz** | **6** |
| 🔴 **colisiones reales posibles** | **4 × 6 = 24** |

Lo que baja 2.800 a 24 es exigir que el escritor escriba **dentro** de un árbol que el barredor
recorre. **Son 24, no 2:** el arreglo no puede ser para este par.

* **Escriben en `tests/`:** `scrum205`, `scrum206b`, `scrum240`, `scrum538`.
* **Barren ese árbol:** los dos `scrum226`, `scrum233`, `scrum268`, `scrum393`, `scrum419`.

---

## 🔴 POR QUÉ SE ARREGLA EL BARRIDO Y NO LOS ESCRITORES

Porque **los cuatro escritores no pueden dejar de escribir ahí**. Son **autopruebas**: fabrican un
fichero sintético con el defecto que su propio guard busca, para verlo salir en rojo. El fichero
**tiene** que estar dentro del árbol que el guard barre.

`scrum206b:178` lo dice en su comentario: *«un guard que nunca se ha visto en rojo es
decoración»*. Mover ese fichero a `tmpdir` **no arregla la carrera: desactiva el control
positivo.** Es la razón por la que este ticket sólo tiene un lado posible, y conviene que quede
escrita: el próximo que lo lea pensará primero en mover los escritores.

---

## Lo construido · `tests/_barrido-estable.mjs`

Las dos mitades van juntas **a propósito**, porque cada una sola es peor que nada:

* **`leerSiSigueAhi(ruta)`** — devuelve el contenido, o `null` si el fichero desapareció.
  🔴 **Perdona SÓLO `ENOENT`.** Un permiso denegado, un directorio o un disco lleno se relanzan:
  «no está» y «no supe leerlo» no pueden salir por la misma puerta.
* **`exigirCorpusLeido(n, minimo, contexto)`** — el suelo. Mira lo **leído**, no lo listado.
  El suelo que cada barrido ya tenía cuenta `readdir`, así que **sobreviviría a que todas las
  lecturas fallaran**. Ese era el agujero.

Aplicado a los **6** barredores, cada uno con su suelo y su motivo escrito.

### El arreglo A MEDIAS que ya estaba en el árbol

`scrum393:107` **ya toleraba**… con un `catch` pelado que se tragaba cualquier error. Es
exactamente la mitad buena sin la otra: tolerar sin suelo. Ahora usa el helper.

---

## El control, en las dos direcciones

### DESPUÉS

Mismo churn, más carga: **31.618 ciclos** de crear/borrar concurrentes (el ANTES reventó con
9.502). Seis pasadas de los barredores: **0 rojos**.

### 🔴 LOS TRINQUETES ERAN MUDOS, Y ME CAZÓ PROBAR EL ROJO

Los dos trinquetes miraban `src.includes('leerSiSigueAhi')`. Al quitar la **llamada** de un
barredor, el `import` y el comentario que explica la regla mantienen la palabra viva en el
fichero — **así que el guard seguía verde sobre un barredor que había vuelto a leer a pelo**.
Un guard que cuenta menciones vigila la prosa, no el código. Es la lección de la casa («mencionar
no es hacer») cometida por mí, y encontrada por el único método que la encuentra: inyectar el
defecto y exigir el rojo.

Ahora se cuenta por AST —`CallExpression` con ese identificador— y **el contador lleva su propio
suelo de tres casos**, porque el arreglo tenía que poder fallar del otro lado: un `import` no
cuenta, un comentario no cuenta, y **una llamada de verdad sí**. Sin ese tercero, el trinquete
pasaría de mudo a **ciego**, que no es mejor.

| inyección | qué cae, con el trinquete corregido |
|---|---|
| ① el barredor vuelve a `fs.readFileSync` | «UN BARREDOR DEL ÁRBOL VOLVIÓ A LEER A PELO: · scrum393…» |
| ② tolera el ENOENT pero se le quita el suelo | «TOLERA EL ENOENT PERO NO EXIGE CORPUS: · scrum393…» |

**Las dos NO caían antes de corregir el contador.** Revertidas y comprobadas: `git status` vacío,
CR = 0.

### CONTROL NEGATIVO

`exigirCorpusLeido(50, 50)` y `(5000, 50)` **no saltan**: un barrido sano no puede dar ruido, y el
ruido se aprende a ignorar justo antes de que el aviso importe. Y `leerSiSigueAhi` sobre un
**directorio** lanza — se comprueba que el error relanzado **no** es `ENOENT`.

---

## Lo que NO cubre

1. **No se ha tocado ninguno de los 4 escritores.** No pueden moverse sin desactivar su control
   positivo, y explicarlo era parte del ticket.
2. **El trinquete vigila una lista de 6 barredores escrita a mano.** Si mañana nace un barredor
   nuevo, el censo lo verá (los detectores son derivados) pero **el trinquete no lo exigirá** hasta
   que alguien lo añada a `BARREDORES`. Derivar esa lista automáticamente exigiría distinguir
   «barrido del árbol» de «lectura de un fichero fijo» con más precisión de la que hoy tengo
   medida, y una lista derivada mal haría el guard ruidoso.
3. **Los suelos por barredor son números escritos** (50, 30, 100). Salen del suelo que cada
   fichero ya declaraba, no de una medición nueva.
4. **No se ha reproducido la carrera dentro de una tanda completa real**, sólo con churn
   provocado. Reproducirla de verdad exige suerte y muchas pasadas de `npm test`.

## HALLAZGOS FUERA DE ALCANCE

* `scrum235` y `scrum262` resuelven su directorio temporal como
  `process.env.TMPDIR || process.env.TEMP || '.'`. **El último recurso es `'.'`, la raíz del
  repo.** En una máquina sin ninguna de las dos variables escribirían dentro del árbol y entrarían
  en este censo. Hoy no muerde en Windows; en un runner Linux sin `TMPDIR` sí podría.
* Los 106 barredores restantes (de los 112) no alcanzan `tests/` ni la raíz **hoy**. Si alguno
  amplía su árbol, hereda la carrera sin que nada avise.

## Ficheros

* `tests/_barrido-estable.mjs` — **nuevo**. El helper y sus dos mitades.
* `tests/scrum740-carrera-por-el-arbol.test.mjs` — **nuevo**, 9 tests: el helper, el suelo, el
  censo, los dos trinquetes y el suelo del contador de llamadas.
* Los 6 barredores — leen con el helper y cierran con su suelo.
