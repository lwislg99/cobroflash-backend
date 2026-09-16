# SCRUM-522 · nueve guards figuraban como cobertura y no corrían en ningún sitio

**Medido contra:** `origin/main` = `164d092dc8e955aa1b01ce254133a24553ce91d9` · 2026-08-20T21:29:53+01:00

> **20-ago-2026 · instrumentación y CI. No se relaja ningún guard, no se toca `pretest`, `test`
> ni los cuatro guards de entrada. Ni una palabra de copy. El único fichero de producto que se
> toca es `public/index.html`, y sólo durante el control, revertido byte a byte.**

## El número del ticket, corregido A LA VISTA

La ficha decía **«al menos tres»**. Derivado de `package.json`, no contado a mano:

```
guard:* declarados ........ 10
de ellos, de navegador .... ~~3~~ 9
de esos 9, en npm test .... 0
de esos 9, en CI .......... 0
```

**Ninguno de los nueve corría en CI.** Un PR podía romper lo que vigilan y mergear en verde.

## 🔴 La pregunta que decidía el ticket: ¿54 s de comprobación, o nueve arranques?

Cinco de los nueve cargan el mismo `/index.html`. La duda razonable era si el coste es el trabajo
o el ceremonial. **Medido con procesos reales, mediana de 5 pasadas:**

| | |
|---|---|
| arrancar node y salir | 0,05 s |
| + importar `puppeteer-core` | 0,24 s |
| **+ levantar el navegador, una pestaña, cerrar** | **0,96 s** |
| + servir `public/` y cargar `/index.html` una vez | 1,25 s |
| cinco cargas de esa página en UN solo navegador | 2,41 s |

```
arranque fijo × 9 ......................  8,7 s  =  16 %
comprobación real ...................... 45,3 s  =  84 %
cargar /index.html con el navegador ya abierto ....  0,29 s
compartir sesión para los cinco ahorraría .........  3,84 s  (7 %)
```

**El coste es la comprobación, no el arranque.** La hipótesis del enunciado queda refutada: no
son nueve navegadores para leer cinco veces el mismo fichero — esas cinco lecturas cuestan ~1,5 s
de los ~50.

Por eso **no se comparte sesión**: ahorraría un 7 % a cambio de acoplar nueve guards hoy
independientes, y el que fallara arrastraría a los demás. Y por eso **no se reescriben sin
navegador** (opción C): lo que miden —área que recibe el toque, contraste computado, salto de
diseño, árbol de accesibilidad— **sólo existe en un navegador**. Reescribirlos sería vigilar
menos, que es lo que la ficha prohíbe.

> ⚠️ **El total es ruidoso y conviene que esté escrito.** Cuatro medidas en esta máquina: `54 ·
> 49,6 · 50,6 · 102,4` s. La de 102 fue con la máquina cargada, y un guard suelto pasó de 6,4 a
> 47,8 s en esa pasada — comprobado aislado después: 6,3–6,5 s, o sea contención y no el cambio.

## La salida: **A**, un objetivo aparte que invoca el workflow

`npm run guards:visuales`, con job propio en `.github/workflows/ci.yml`.

**Por qué no B** (dentro de `npm test`, saltado en local por variable): serían ~50 s más en cada
`npm test` local, o un salto que —como avisa la propia ficha— puede llevar meses apagado sin que
nadie lo vea. Y su rojo llegaría disfrazado de test fallando en vez de con nombre propio.

**Y no cuesta reloj:** GitHub corre los jobs de un workflow en paralelo. Éste tarda ~50 s; el de
tests tarda varios minutos entre `npm ci`, Prisma y la suite. El PR no espera más por esto.

### 🔴 Por qué NO se reutilizó `censo:guards-navegador`, que ya los ejecuta

**Porque mide y no juzga.** Imprime «verdes: 7 · no verdes: 2» y **sale con 0**. Engancharlo al
workflow habría dado un job **verde** con dos guards rojos dentro: el mismo problema con una capa
más de pintura. En la puerta el código de salida es el producto, y **un guard CIEGO cuenta como
fallo** — «no supo mirar» no es «ha vigilado».

## Lo que lo hacía imposible, y era la misma línea en los nueve

```js
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/…/msedge.exe';
```

Byte a byte idéntica en los nueve: **una ruta de Windows como valor por defecto**. En el runner
—Ubuntu— eso no existe, así que los nueve eran inejecutables donde de verdad hacían falta.

`scripts/_navegador.mjs` los busca en nueve sitios conocidos (Edge primero, porque es sobre el que
se midió todo lo escrito en la casa; Chrome y Chromium después). Comprobado en la documentación de
la imagen `ubuntu-latest`: **trae Edge, Chrome y Chromium preinstalados.**

Dos decisiones que no son de estilo:

- **Sin navegador NO devuelve una ruta plausible**: para con código 2 nombrando los nueve sitios
  donde ha mirado. Una ruta inventada haría que el guard fallara al abrirla, y el rojo diría «no
  se pudo abrir» en vez de «aquí no hay».
- **`EDGE_PATH` puesta y rota NO cae hacia atrás** a otro navegador. Alguien la puso a propósito;
  medir en otro sería medir otra cosa y el informe diría lo que no es.

> Y el suelo de los nueve es hoy **ése y sólo ése**: cuatro de ellos no tenían comprobación propia
> —envuelven el `launch` en un `try`—, cosa que se descubrió al escribir el test. Por eso el caso
> que lo prueba **ejecuta** un proceso con `EDGE_PATH` rota y comprueba el código 2, en vez de
> buscar una frase en el fuente.

## Verificación

### 🔴 El control que decide: se rompe, y CI se pone rojo

Con el commit `6da7e543` ya hecho, se baja un objetivo de toque del pie de 44 px a 20 px y se
corre **el comando leído del propio workflow**, para que no haya hueco entre lo probado y lo que
correrá allí:

```
el job de CI corre: npm run guards:visuales
codigo de salida de la puerta: 1   ✅ CI se pondria ROJO
   ✖ guard:objetivo-tactil        2.9 s   rojo(1)
   ✖ 23.4px < 44 · [footer] A «Cómo funciona» (caja CSS 22.4px)
guards denunciados que NO son el roto: 0  ✅ ninguno
revertido · Buffer.compare contra HEAD:public/index.html = 0  ✅
```

La puerta **cae, nombra al guard, reproduce lo que dijo** y no acusa a los otros ocho.

> ⚠️ Lo que este control prueba es que el comando del job se pone rojo. **La ejecución del job en
> GitHub la ve el fundador en el PR**: esta sesión no tiene `gh` a propósito.

### Suelo

Si la lista derivada de guards fuera de la tanda saliera **vacía**, la puerta sale con 2
declarándose ciega: «todos los guards corren» y «no supe mirar los scripts» son el mismo resultado
con significados opuestos.

**Suite:** `3936 tests · 3859 pass · 0 fail · 77 skipped`.

## Tres cosas que cazaron mi propio trabajo

1. **SCRUM-237** marcó una negación mía sin respaldo: comprobaba que no aparece `HA SEGUIDO`, un
   token que no aparecía en positivo en ningún sitio — verde permanente. Se le añadió el hermano
   positivo (apuntando `EDGE_PATH` al binario de node, que existe siempre).
2. **SCRUM-533** detectó CR en dos guards. **No lo trajo este ticket**: 435 y 311 retornos, o sea
   el fichero entero, no las seis líneas insertadas. La copia de trabajo ya los tenía y tocarlos
   lo destapó. Quitados byte a byte con node; el diff contra `origin/main` queda en `+6/-1` en los
   dos, o sea sólo el cambio real.
3. **Mi primer parche** ancló en `import puppeteer from 'puppeteer-core'` y **paró en seco** al
   llegar al tercer guard: dos de los nueve lo cargan con `createRequire`. Anclar ahí habría
   dejado dos fuera sin que se notara. Se cambió el ancla a la línea de `EDGE`, idéntica en los
   nueve.

Y un riesgo de YAML evitado por medición y no por suerte: el paso que resuelve el navegador lleva
`: ` dentro de un `node -e`, y en un escalar plano YAML eso se lee como un mapa. **Un workflow que
no parsea no falla: no corre.** Va como bloque literal, y hay una comprobación de que ningún otro
`run:` plano del fichero tiene el mismo problema.

## Ficheros

| fichero | qué |
|---|---|
| `scripts/_navegador.mjs` | dónde está el navegador, y el suelo si no hay (nuevo) |
| `scripts/guards-visuales.mjs` | la puerta: los corre y falla si alguno cae (nuevo) |
| `.github/workflows/ci.yml` | job `guards-visuales` |
| `scripts/guard-*.mjs` (×9) | dejan de llevar la ruta de Windows escrita a mano |
| `package.json` | `guards:visuales` + su `//comentario` |
| `tests/scrum522-guards-fuera-de-la-tanda.test.mjs` | 18 tests |
