# SCRUM-696 · `soloCodigo()` y las plantillas — el módulo que tenía la enfermedad que curaba

**Fecha:** 2-sep-2026 · **Carril:** instrumentos (guards de la casa) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `80db312b10b79292485ff99070648657f4dacca7` · 2026-09-02T21:40:02Z

**Tanda:** 4790 tests, 4706 pass, 0 fail, 84 skipped — medida DESPUES del ultimo cambio, entrada incluida.

---

## Cómo se encontró: usándolo, no leyéndolo

SCRUM-693 construyó `tests/_solo-codigo.mjs` para que los guards dejaran de filtrar comentarios a
mano. SCRUM-694 tenía que migrar los guards a ese mecanismo. Al migrar los nueve, **cinco se
pusieron en rojo** — y el rojo no era de los guards.

La cabecera de `_solo-codigo.mjs` explica por qué no vale un regex, con dos enfermedades:

> ① `const u = "http://ejemplo.com";` ← el `//` va DENTRO de una cadena. Un regex que corte en
> `//` se come media línea de CÓDIGO REAL y el guard deja de ver lo que vigila.

**El módulo tenía la ① dentro**, movida de las cadenas a las plantillas. Y no se vio antes porque
el corpus de `scrum693` no contenía ni un `${}`: la suite estaba verde sobre un mecanismo que en el
árbol real fallaba en **783 de 1.111 ficheros**.

> Un corpus que no contiene la forma que rompe no está dando un verde: está diciendo que no la
> miró. Por eso la mitad de este ticket no es el parche, es el suelo.

---

## PASO 0

**ENTRADA.** No hay entrada de usuario: este carril no tiene pantalla. Los consumidores del
mecanismo son tres, medidos sobre `origin/main`: el propio `tests/_solo-codigo.mjs`,
`tests/scrum578-formulario-duplicados.test.mjs` (que ya lo usaba **en main**) y su suite
`tests/scrum693-filtro-de-comentarios.test.mjs`.

**MECANISMO.** Existía y era el correcto: el scanner de TypeScript, cero dependencias nuevas. El
trabajo era **conducirlo bien**, no cambiarlo de motor ni rehacerlo.

---

## El defecto, y por qué hacen falta las dos direcciones

`sc.scan()` no sabe volver a entrar en una plantilla. Ante `` `hola ${x} adiós` `` devuelve el
`TemplateHead`, escanea `x`, y lee el `}` como una llave de cierre cualquiera. A partir de ahí
sigue en modo código: la comilla invertida final la toma como **apertura de otra plantilla**, y se
queda dentro de una plantilla fantasma hasta el fin del fichero.

Eso rompe en los dos sentidos, y los dos se midieron sobre el árbol de `f803ec1e` (antes de mezclar main, que lo dejó en 1.119 ficheros):

| | qué pasa | ficheros |
|---|---|---|
| **falso positivo** | los comentarios de después no se blanquean → el guard salta por su propia documentación | **723** de 1.111 |
| 🔴 **ceguera** | un `//` dentro de la plantilla se come el resto de la línea → **código real que nadie vuelve a vigilar** | **60** de 1.111 |

La ceguera es la cara: produce **verdes**. Y el patrón era de lo más corriente que hay, una URL
dentro de una plantilla — `https://wa.me/${tel}`, `file://${argv[1]}`, `http://127.0.0.1:${PUERTO}`.

---

## Lo que encontró el censo, y que los casos a mano no vieron

Con las plantillas arregladas, el censo del árbol seguía dando **83 ficheros ciegos** por otra causa
de la misma familia: **`scan()` tampoco devuelve una expresión regular por su cuenta**. El sitio
real es `src/core/validation/schemas.ts:300`:

```js
(v) => (typeof v === 'string' && v.trim() && !/^https?:\/\//i.test(v.trim()) ? `https://${v.trim()}` : v),
```

Las dos últimas barras del regex quedan **pegadas**, el scanner leía un comentario de línea y se
llevaba por delante el resto — incluida la plantilla que construye la URL.

**Ese trozo entró en este mismo ticket y el motivo se escribe aquí:** sin él el censo no puede dar
cero, y un módulo que sigue cegando código no está arreglado. No es «mejorar de paso»: es que el
criterio de cierre no se cumple sin ello. Se declaró en el informe para que el asesor pudiera
rechazarlo.

Cuándo un `/` puede abrir un regex se decide por el token anterior, que es la regla de siempre de
JavaScript. **Los dos casos que esa regla resuelve mal —el `}` que cierra un bloque y el `)` de un
`if`— caen del lado «división», que es lo que el módulo hacía antes para todos:** donde la regla
duda, no se empeora nada.

---

## Qué se construyó

**`tests/_solo-codigo.mjs`** — dos arreglos en la misma función, ningún cambio de firma ni de
contrato. Sigue sin encoger el texto, que es de lo que dependen los `slice(indexOf(…))` de sus
consumidores.

1. `reScanTemplateToken()` sobre el `}` que cierra una interpolación, **con pila**: no toda llave de
   cierre lo es. En `` `a ${ {b:1} } c` `` la primera cierra un objeto y la segunda la
   interpolación. Las anidadas salen solas: cada `TemplateHead` apila la suya.
2. `reScanSlashToken()` cuando un `/` no puede ser división, decidido por el token anterior.

**`tests/scrum693-filtro-de-comentarios.test.mjs`** — el suelo que faltaba: tres tests nuevos con
plantilla interpolada, **en las dos direcciones**, más las anidadas, el objeto en la interpolación
y el bloque de función. Con sólo la primera dirección pasaría un filtro que blanquee el fichero
entero; con sólo la segunda, uno que no blanquee nada.

**`tests/scrum696-censo-del-arbol.test.mjs`** — el censo, con el árbol entero de corpus. Se apoya en
un **motor distinto del que audita**: `soloCodigo()` conduce el scanner, y el censo usa el parser
completo, que es quien decide de verdad dónde acaba cada literal. El invariante es una igualdad, no
un umbral:

> 🔴 dentro de un literal no puede haber un comentario, así que `soloCodigo()` no tiene ningún
> motivo legítimo para cambiar ni un carácter de esos tramos.

Y su suelo es el **filtro ingenuo** —el regex que corta en el primer `//`—, que es el defecto real:
si el censo no lo caza, el censo no mide nada. Hoy caza 259 ficheros con él puesto y 0 con el
módulo arreglado.

---

## 🔴 Lo que cazó la mutación: dos tests míos que no podían fallar

Los dos casos nuevos de `scrum693` **pasaban igual con el arreglo puesto que sin él**, y no se
vio hasta inyectar la mutación. Los dos por el mismo motivo de fondo — el caso de prueba no
tenía la forma del defecto — y los dos merecen quedar escritos, porque el error es fácil:

1. **El `//` iba ANTES de la interpolación.** Escrito así (`https://x/${v}`) queda dentro del
   `TemplateHead`, que el scanner lee de una pieza y **protege sin querer**. El defecto sólo
   muerde DESPUÉS del `}`, que es donde el scanner vuelve a modo código.
2. **El regex y la cadena prohibida en LÍNEAS DISTINTAS.** El defecto se come hasta el fin de
   línea, así que con la cadena en la línea de abajo sobrevivía siempre. En el sitio real
   —`schemas.ts:300`— todo va en una línea, y esa era la forma que había que copiar.

> Un test que no puede fallar no es cobertura: es decoración que además da confianza. Es la
> misma familia que el defecto del ticket —un instrumento que dice medir algo y mide otra cosa—,
> sólo que un piso más arriba. Los cazó la mutación, no la lectura.

**Caso cruzado, para que ninguno cubra de más:** quitando el arreglo de plantillas caen los tres
tests de plantilla y el censo, y el de regex NO; quitando el de regex cae el de regex y el censo,
y los de plantilla NO.
---

## Evidencia

| qué | resultado |
|---|---|
| los 9 guards de SCRUM-694 que estaban en rojo | **verdes** con el arreglo (rama `scrum-694-trece-filtros`, no entra aquí) |
| `scrum693` (su suite) | 13 pass, 0 fail |
| `scrum578` (su consumidor en main) | 15 pass, 0 fail |
| censo del árbol | **0** ficheros ciegan · 1.119 ficheros y 97.685 tramos examinados |
| rojo probado por el mecanismo | revertido cada arreglo por separado, con post-condición sobre el fichero |
| control positivo | el rótulo prohibido inyectado en CÓDIGO (dentro de una plantilla) tumba a `scrum578`; el mismo rótulo en `/** */` y en `//` no lo toca |
| `guards:entrada` | 21 pass, 0 fail |

---

## Lo que NO se hizo, y por qué

- **No se migró ningún guard.** SCRUM-694 vuelve cuando esto esté en main. Entregarlo junto habría
  escondido lo importante dentro de lo aburrido, y ante un fallo no se sabría qué mitad fue.
- **No se tocó código de producto.** `schemas.ts:300` se nombra como sitio medido; no se cambia.
- **No se subió el suelo de la tanda** (4766, margen 23). De esos 23 sólo 6 son míos: subirlo aquí
  mezclaría mi aportación con la de los tickets que entraron en main esta tarde.
- **Cero dependencias nuevas** (regla 36): `typescript` ya estaba en el árbol.
