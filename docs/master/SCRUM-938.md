# SCRUM-938 · La lista real como fixture — censado, no arreglado

**Medido contra:** `origin/main` = `2242683172bad64e4cc9f591e5c81b43fe5dc52e` · 2026-09-17T21:38:32+01:00
**Rama:** `scrum-938-la-lista-como-fixture`
**Carril:** instrumentos · **Gate:** el censo vive fuera de `npm test`; su red corre siempre

> ⛔ **NINGÚN TEST ARREGLADO.** Reescribir un fixture sin saber su clase convierte un falso verde
> en un verde de verdad sin haber probado nada.
> ⛔ **Ninguna lista real del árbol vaciada.** La prueba que decide trabaja sobre una copia.
> ⛔ Ni una línea de `src/`. Ningún flag. Ninguna base.

---

## 1 · El defecto, y por qué miente en las dos direcciones

Un test que alimenta sus casos con **la misma lista que su guard consulta para decidir** mide el
**contenido** de la lista creyendo medir el **funcionamiento** del guard.

- **Falso verde** — el caso pasa porque la lista tiene contenido, no porque el guard sirva.
- **Falso rojo** — el día que alguien **vacía** la lista, que es el objetivo de toda lista de
  excepciones, caen de golpe. **Castiga a quien hace el trabajo bien.**

Medido el 17-sep-2026 en SCRUM-813: al retirar la última excepción, **seis casos cayeron a la vez**
y ninguno estaba roto.

    🔒 Un caso que se queda sin sujeto cuando el defecto se arregla estaba atado al defecto,
       no al mecanismo.

## 2 · El censo · población y veredicto

**Reutiliza `censarExcepciones` de SCRUM-927** en vez de escribir un segundo censo de listas.

| | |
|---|---|
| listas de excepciones declaradas | **132** (censo de SCRUM-927) |
| pares (lista × fichero que la consume) examinados | **156** |
| candidatos por análisis estático | **61** — (a) 10 · (b) 51 |
| **CONFIRMADOS** por la prueba que decide | **35** |
| absueltos (la lista vacía **no** los tumba) | **15** |
| **NO DECIDIBLES** (cuentan del lado malo) | **11** |

Los **15 absueltos son la justificación de la prueba que decide**: el análisis estático los
acusaba y el comportamiento los absolvió. Sin ella, este censo habría entregado 61 acusados con
un 25 % de ruido.

## 3 · El criterio es de FLUJO, y la forma ③ es la que no se ve

No basta con que el fichero **mencione** una lista. La pregunta es si el valor que alimenta el caso
sale de la misma constante que el guard consulta:

| forma | cómo se detecta |
|---|---|
| ① la constante se pasa como entrada a una llamada | AST: identificador en `arguments` |
| ② se llama omitiendo el parámetro, así que decide el valor por defecto | la lista real es el default |
| ③ 🔴 **un LITERAL escrito a mano que es un elemento de la lista** | comparar literales con los elementos |

**③ es la que me pasó a mí**: el fixture era `'scrum659/'`, copiado del contenido. **No hay import
que lo delate** — sólo se ve comparando el literal con los elementos reales.

## 4 · 🔴 Mi primera versión cometió el error que el ticket persigue

Emparejaba consumidores **por mención del nombre**: acusaba a **118 de 833**, y el primero de la
lista era `scrum405` acusado por una lista declarada en `scrum226` — dos ficheros que no se
importan. `EXCEPCIONES`, `EXENTAS` y `DECLARADOS` son nombres **genéricos** que se repiten por toda
la casa.

Es exactamente acusar por la **forma** (aparece la palabra) en vez de por el **flujo** (el valor
llega al caso): el defecto de este ticket, cometido por su censo. Y un censo que acusa al 14 % de
la casa se desactiva la primera semana.

Arreglado resolviendo el consumidor **por el import**, leído por AST — estático y dinámico, porque
así carga `dist/` esta casa. **118 → 61 candidatos.**

    🔒 Un prefijo no es un nombre, y un nombre repetido no es una referencia.

## 5 · La prueba que decide, y cómo no toca el árbol

Se copia el fichero que declara la lista a un **hermano temporal** —hermano para que sus rutas
relativas sigan resolviendo— con la lista **vaciada**, y se corre esa copia.

- El nombre **no acaba en `.test.mjs`** a propósito: así `npm test` no la recoge nunca, ni aunque
  quedara suelta.
- Borrado en `finally`, **con aviso si no se pudo borrar**. Verificado: **0 sondas sueltas** tras
  las tres pasadas completas.
- **Límite declarado:** sólo decide cuando la lista vive **en el propio fichero**. Si vive en un
  módulo aparte, haría falta copiar también ese módulo y reescribir el import: eso sale
  **NO DECIDIBLE** y cuenta del lado malo. Son los 11.

## 6 · Las clases, y el remedio propuesto — SIN implementar

| clase | qué significa | remedio propuesto |
|---|---|---|
| **(a) MIENTE** · 10 candidatos | la lista es la **única** fuente de los casos | **banco fabricado**: una lista de prueba local. El caso pasa a medir el mecanismo y sobrevive a que la real llegue a cero |
| **(b) DEGRADA** · 51 candidatos | alimenta un caso entre otros fabricados | igual, **por caso**: sólo el que se alimenta de la real. Los demás no se tocan |
| **(c) LIMPIO** | el test **declara** que mide el contenido (trinquete de conjunto o de tamaño) | **no se toca**. No es este defecto |

**El remedio general es banco fabricado**, y así se hizo en SCRUM-813: una `LISTA_DE_PRUEBA`
sintética dejó el amparo probado **aunque la lista real esté a cero**, que es el estado al que se
quiere llegar.

**Si un caso necesita el elemento real, se declara por qué.** Hay un motivo legítimo: cuando lo que
se mide es la *integración* con ese elemento concreto y no el mecanismo. Pero entonces el caso
tiene que decirlo, porque **volverá a caer el día que la lista encoja** — y quien lo pague tiene
derecho a saber que era esperado.

## 7 · Los controles

- **🔴 EL POSITIVO — y por el eje correcto.** Se lee de git (`2b317011`, antes del arreglo) porque
  hoy ya está arreglado en `main`: un positivo sobre el código de hoy saldría limpio y no probaría
  nada. Resultado: el censo lo caza por la **forma ③**, y su prueba **nombra el literal**
  (`"scrum659/"`), no el fichero.
- **✅ EL NEGATIVO.** Un trinquete de contenido sale **LIMPIO**. Es el que tenía que salir verde:
  acusarlo marcaría todos los trinquetes de la casa. Y un **fixture fabricado** tampoco se
  denuncia, aunque el fichero cite la lista — si no, el censo castigaría el arreglo que propone.
- **SUELO.** Cero listas ⇒ **CIEGO** (salida 2), no «árbol limpio». Hoy ve 132.
- **`MUTACIONES_QUE_ME_TUMBAN`**: dos, una por cada eje que puede apagarse — el consumidor por
  import y el corte de la prosa.

## 8 · Dos errores propios más, además del de §4

1. **Mi umbral mínimo hacía invisible un elemento corto.** Exigía 3 caracteres, así que `'a/'` no
   se veía: una lista de elementos cortos habría salido limpia sin serlo. Lo cazó **mi propio
   test**. Bajado a 2, y el límite de 1 carácter queda **declarado** en el código con su motivo.
2. **La puerta de entrada reventaba al importar el módulo** (`process.argv[1]` undefined), y era
   además la comparación que **SCRUM-765 ya dejó medida como inservible en Windows**. Sustituida
   por `pathToFileURL(argv[1]).href`, que es el patrón que esta casa ya tenía probado — lo reusé en
   vez de inventar el mío, que es lo que debí hacer desde el principio.

## 9 · Lo que NO se ha hecho

- ⛔ **Ningún test arreglado.** El censo entrega clase y prueba; el arreglo es otra tanda.
- ⛔ **Los 11 NO DECIDIBLES no se han forzado.** Copiar el módulo del guard y reescribir imports es
  un instrumento nuevo, y de momento cuentan del lado malo.
- ⛔ **Los elementos de un solo carácter no se ven** (declarado en §8).
- 🟠 **La clase (a)/(b) la decide el número de formas detectadas**, que es una aproximación: un
  caso con una sola forma pero que sea la única fuente saldría como (b). La prueba que decide da el
  dato que importa —cuántos casos caen de cuántos— y ahí se ve: `1 de 6` es (a) de hecho.
