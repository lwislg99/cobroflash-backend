# MÉTODO_YAQU — cómo se mide aquí

> **Fichero COMPARTIDO entre sesiones.** Cada caso vive en su propia sección de segundo nivel con
> su fecha y su sesión. Si dos sesiones lo tocan a la vez, **se conservan LAS DOS entradas**: no se
> resuelve el conflicto eligiendo, se resuelve pegando las dos secciones seguidas. Un método que
> pierde casos al mergear deja de ser un método.

---

# 🔴 LA PRUEBA DE ROJO QUE NUNCA SE EJECUTÓ

**Descubierto por DOS sesiones la misma noche (5-ago-2026), por caminos que no se parecen en nada.**

Llevamos una semana apoyándonos en la prueba de rojo como la prueba fuerte: *«quita la cosa vigilada
y comprueba que sale rojo»*. Es correcta. Pero tiene un agujero que nadie había mirado:

> **Una prueba de rojo que sale verde no es una prueba superada: es una prueba que NO SE HA
> EJECUTADO. Antes de creerse el verde, hay que comprobar que la mutación llegó a aplicarse.**

Un rojo que no se inyectó y un verde son **indistinguibles** si no se mira. Los dos se ven igual en
la terminal: la suite pasa.

## Caso A · el ancla que no casa por los FINALES DE LÍNEA (SCRUM-302, sesión 1)

El más traicionero de los dos, porque **el fichero se ve idéntico**.

Se intentó sacar `allocateAlbaranNumber` fuera de la transacción para comprobar que el guard de la
carrera caía. La inyección buscaba:

```js
const viejo = '    const copia = await prisma.$transaction(async (tx) => {\n      const numero = …';
```

Y el fichero está en **CRLF**, así que `\n` no casa nunca. El script imprimió `[!! no encuentro el
ancla]`, la suite se corrió **sobre el código sin tocar** y salió verde. Dos intentos seguidos.

**Lo que lo delató** fue que el script imprimía su propio fallo. Sin esa línea, el verde habría
pasado por «rojo comprobado».

```js
// Lo que hay que hacer ANTES de creerse nada:
if (!s.includes(viejo)) { console.log('[!! no encuentro el ancla]'); process.exit(1); }
```

Y comprobar los finales de línea del fichero **antes** de escribir el ancla:

```js
const nl = s.includes('\r\n') ? '\r\n' : '\n';
```

⚠️ `cat -A` **no basta** para verlo: a través de Git Bash puede mostrar `$` (LF) sobre un fichero
que en disco es CRLF. Lo que no miente es leerlo con Node y preguntar por `\r\n`.

## Caso B · el símbolo que no existía (SCRUM-368, sesión 3)

Hermano del anterior, no alternativa: allí el ancla no casaba **por los bytes**, aquí **por el
contenido**. El resultado es el mismo — la suite corre sobre el código sin tocar.

Para comprobar que el contador de botones pequeños caía al añadir uno más:

```js
fs.writeFileSync(p, s.replace('export', 'const __x = …\nexport'));
```

`homeView.js` **no contiene la palabra `export`** — es un script clásico, sin módulos.
`String.replace` **no lanza** cuando no encuentra el patrón: devuelve la cadena igual. Se
reescribió el fichero idéntico, el test volvió a contar 35 y salió **verde**. La prueba «pasó»
sin haber añadido nada.

No hubo ninguna línea que lo delatara: a diferencia del caso A, aquí **el script no imprimía su
propio fallo**. Se descubrió porque el número no cuadraba con lo esperado.

```js
// Con la comprobación puesta:
fs.appendFileSync(p, '\nconst __prueba = …\n__prueba.className = "btn-primary btn-sm";\n');
console.log('  inyeccion aplicada?', fs.readFileSync(p,'utf8').includes('__prueba'));
// → true, y entonces: «el residuo de contraste era 35 y ahora es 36»
```

## Caso C · el caso de prueba que no reproducía el defecto (SCRUM-368, sesión 3)

El tercero es distinto de los dos anteriores y **peor**, porque la mutación **sí se aplicó**: lo
que no existía era el defecto que se quería provocar.

Para comprobar que la exención de contraste por componente inactivo **caduca** al habilitarlo, se
inyectó un `<button class="btn-primary">` en `login.html` y se midió su contraste. Verde las dos
veces, deshabilitado y habilitado.

Motivo: **`login.html` no carga `styles.css`**. Ahí `.btn-primary` no tiene fondo verde, así que
el botón nunca reprodujo el par blanco-sobre-verde que se quería vigilar. Se midió un elemento
que no era el caso.

> Un selector no pinta nada si su hoja no está cargada. **Antes de medir un componente, comprobar
> qué CSS carga la página donde lo pones**, no solo qué clase le escribes.

Repetido en `index.html`, que sí define `.btn-primary` con el verde de marca: deshabilitado →
exento; habilitado → **rojo**. Y ese rojo, ya legítimo, destapó un defecto real del guard (ver
más abajo, «La excepción escrita más ancha que su caso»).

## La regla, para las tres

1. **La inyección declara si se aplicó.** Un script de rojo que no imprime `[inyección VERIFICADA]`
   —o que no sale con código ≠ 0 cuando no encuentra su ancla— no sirve.
2. **Se comprueba que el fichero cambió**, no que el script terminó. `git diff --stat`, un `grep` del
   texto nuevo, lo que sea: algo que mire el resultado y no el proceso.
3. **Y se restaura comprobando.** `git status` después, no antes.
4. **Y el caso de prueba tiene que poder reproducir el defecto** (caso C). Aplicar la mutación no
   basta si el escenario donde se aplica no es el escenario del fallo.

Es la misma familia que ya conocíamos —*ver un verde y preguntarse qué mediría si el sistema
estuviera roto*— aplicada un nivel más abajo: al propio mecanismo con el que comprobamos los verdes.

---

# LA EXCEPCIÓN ESCRITA MÁS ANCHA QUE SU CASO

**SCRUM-368, sesión 3 · 5-ago-2026**

> **Una excepción por par de colores no es una excepción: es un permiso para ese par en cualquier
> sitio.**

`scripts/guard-contraste.mjs` llevaba una lista de pares `texto|fondo` conocidos y aceptados, con
su motivo. La comparación era **por par**, así que cualquier nodo NUEVO que reutilizara esos dos
colores entraba al producto sin que nada avisara: la excepción se había escrito para unos nodos
concretos y acabó amparando a todos los futuros.

**Cómo apareció:** por la prueba del caso C, ya bien hecha. El botón habilitado volvía al censo,
pero su par ya estaba en la lista, así que el guard seguía verde. Sin esa prueba, el guard entraba
en `main` en verde vigilando un permiso abierto.

**Arreglo:** cada excepción declara **cuántos nodos** ampara, y el guard cae si el par gana o
pierde nodos. Y las excepciones **caducan**: si un par listado deja de ocurrir, también falla, para
que se borre. *Una excepción que sobrevive a su causa deja de ser una nota y pasa a ser un permiso.*

**Y el motivo también caduca.** En el mismo guard, un par listado decía «el botón primario,
decisión del fundador pendiente». Cuando esa decisión se tomó, los nodos que quedaban bajo ese par
eran otros —mockups del landing— y el motivo escrito ya no describía nada. **Vigilar un motivo
muerto es no vigilar.** Al cambiar la causa, se reescribe la excepción o se borra.

---

# NO SE MIDE MIENTRAS ALGO SE MUEVE

**SCRUM-368, sesión 3 · 5-ago-2026**

Transiciones y animaciones devuelven valores **interpolados**, y en headless a veces el inicial.
Dos casos, en dos superficies distintas:

- **Estilos:** `getComputedStyle` justo tras un `Tab` real devolvió el `box-shadow` a mitad de la
  transición de `.15s`. Dio «sin anillo» para tres botones que **sí lo tienen**. Falso rojo.
- **Cajas:** `getBoundingClientRect()` sobre botones dentro de un `.modal` con la animación
  `slide-up` (que arranca en `scale(.98)`) dio **43,48 px** donde el valor real era 44. El
  `transform` del **ancestro** entra en el rect aunque el elemento medido no tenga ninguno. El
  43,48 es traicionero porque *casi* es 44.

**Un falso rojo cuesta lo mismo que un falso verde**: se investiga un defecto que no existe, o
peor, se «arregla».

```js
await page.evaluate(() => Promise.all(
  document.getAnimations().map(a => a.finished.catch(() => {}))));   // antes de geometría
await page.evaluate(() => new Promise(r =>
  requestAnimationFrame(() => requestAnimationFrame(r))));           // antes de estilos
```

Y cuando el criterio sea «¿lo ve el usuario?», **medir píxeles** —capturar en reposo y en el estado
nuevo y comparar los bytes— en vez de propiedades computadas: un hash no se deja engañar por un
valor a medio camino.

---

# EL NAVEGADOR ES EL ÁRBITRO

**SCRUM-368, sesión 3 · 5-ago-2026**

> **Cuando el analizador estático y el navegador discrepan, el roto es el analizador.**

Un censo estático de contraste daba `.sidebar-logo-text` en **1,00** (blanco sobre blanco) porque
no sabía que ese texto vive dentro del sidebar oscuro, y marcaba `.nav-item.active` como fallo
cuando medido en su contenedor real da **5,89**. Adivinar ancestros y componer `rgba()` a mano no
funciona: eso ya lo resuelve el motor.

**Y no se confunde con «no ajustes el guard a tu código».** La prueba que los separa es concreta:

- Si la forma que el analizador no ve **la acabas de introducir tú** → se cambia **el código**.
- Si **llevaba ahí desde antes** → se arregla **el analizador**.

Sin ese criterio, las dos reglas se contradicen.

---

# EL MEDIDOR QUE NO LLEGÓ A EJECUTARSE

Familia de todo lo anterior, y la que más veces ha aparecido en el proyecto: **el fallo no está en
lo que el guard mira, sino en que el guard no miró nada.**

| Forma | Caso real |
| --- | --- |
| El código de salida se pierde en la tubería | `npm test \| tail` devolvía **exit 0** con dos tests en rojo: `$?` era el de `tail`. Se lee el código de salida de **node**, redirigiendo a fichero. |
| El analizador no reconoce lo que mira | El censo de clases no resolvía `className = <ternario>` y dejaba fuera `albaranDetailView.js:256`, donde las tres ramas son botones. Lo cazó **el suelo**, no el test. |
| El CLI no se reconoce a sí mismo | SCRUM-235: `import.meta.url` viene percent-encodeado y `argv[1]` no, así que bajo una ruta con espacios el guard era un **NO-OP silencioso con exit 0**. |

**El suelo es la defensa.** Todo censo declara un mínimo (nodos, ficheros, clases) por debajo del
cual **falla en vez de informar de cero**: «no supe mirar» y «no hay» son el mismo número y
significan lo contrario.

---

# EL GUARD QUE VIGILA LA ORTOGRAFÍA, NO EL CABLEADO

**SCRUM-381, sesión 2 · 6-ago-2026**

Familia distinta de todo lo anterior. Arriba el fallo era **que el guard no llegó a mirar**; aquí
el guard mira, corre, sale verde — y **mira la cosa equivocada**.

> **① Un guard que fija una ruta sin resolverla vigila la ortografía, no el cableado.**
>
> **② Un test que fija el estado actual convierte un defecto en un requisito.**

## El caso

`scrum314-wipedemo-derivado.test.mjs` comprobaba que el sembrador importase el barrido del dominio:

```js
assert.match(src, /from '\.\/_wipe-demo\.mjs'/, '🔴 seed-demo no importa el barrido derivado');
```

Ese fichero **lo había borrado el propio SCRUM-314** al mover el barrido, sin actualizar el import.
El assert comprobaba el **texto** del import y **nunca que el destino existiera**, así que
`seed-demo.mjs` pasó **tickets enteros sin poder ni arrancar** —reventaba en su primer `import`,
antes de la primera línea útil— con su test en verde. Se descubrió porque otra sesión necesitó
datos a la una de la madrugada.

## Lo que hace a ② peor que ①

**Ese test no falló al romperse el import: falló al ARREGLARSE.** Mientras el defecto estuvo ahí,
estuvo verde; el día que alguien puso la ruta buena, se puso rojo y pidió volver a la rota. Un test
así no vigila una propiedad: **fotografía el árbol y exige que no cambie**, y en cuanto la foto
incluye un defecto, el defecto pasa a ser el requisito.

## Y el arreglo obvio es el mismo defecto mirando a otro lado

Apuntar el `assert.match` a la ruta NUEVA se ve como una corrección y **muda el defecto de sitio**:
volverá a fijar el siguiente import roto. Lo único que corrige de verdad es **resolver**:

| | Cambia el texto del import | Rompe el cableado |
| --- | --- | --- |
| Mover el módulo a otra ruta válida | sí | **no** → tiene que seguir VERDE |
| El destino deja de exportar el símbolo | **no** | sí → tiene que salir ROJO |

Un assert de texto contesta las dos al revés. Las dos filas se comprobaron sabotéandolas.

**Y resolver tiene que ser tan fácil como deletrear**, o nadie lo hará a las dos de la mañana: por
eso vive en `tests/_imports-estaticos.mjs` (`origenDe(fichero, símbolo)` → dónde sale de verdad, o
por cuál de los tres motivos no sale) y no dentro de un test.

## Cómo se reconoce

Un assert que nombra una **ruta**, un **número de línea** o una **cadena literal del árbol** está
en riesgo. La pregunta que lo separa: **si esto que afirmo dejara de ser cierto, ¿sería porque algo
se rompió, o porque algo se movió?** Si la respuesta puede ser «porque se movió», el assert no
vigila lo que cree.

⚠️ El asesor cuenta **tres apariciones de esta forma: SCRUM-340, SCRUM-378 y ésta.** Verificadas
desde esta rama solo dos —378 (un `<script>` comentado que el guard seguía dando por cargado) y
381—; de SCRUM-340 no hay entrada en `docs/master/` aquí, así que queda anotado como suyo y sin
comprobar, no como medición propia.
