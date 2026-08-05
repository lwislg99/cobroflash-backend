# MÉTODO — las formas de verde que no valen

> **Derivado de `docs/YAQU_MASTER.md`** (regla 35). Aquí vive el método de medición: **las formas
> en que una comprobación se pone verde sin haber comprobado nada.** El registro de cada ticket
> sigue en `docs/master/SCRUM-<n>.md`; esto es lo que se repite entre tickets.
>
> Cada entrada trae **su caso real**. Una regla con su caso concreto al lado se recuerda; una
> regla sola, no.

---

## 1 · La mutación que no llegó a aplicarse

> **Una prueba de rojo que sale verde no es una prueba superada: es una prueba que no se ha
> ejecutado. Antes de creerse el verde, hay que comprobar que la mutación llegó a aplicarse.**

Para verificar que un guard vigila de verdad se le rompe lo que vigila y se exige rojo. Si sale
verde hay dos explicaciones —el guard no mira, o la rotura no ocurrió— y **el verde no las
distingue**. La segunda es la más fácil de pasar por alto, porque parece que el trabajo está hecho.

### Caso A — el `replace` sobre un ancla que no existe (SCRUM-368)

Para probar que el contador del residuo cae al añadir un botón:

```js
fs.writeFileSync(p, s.replace('export', 'const __x = …\nexport'));
```

`homeView.js` **no contiene la palabra `export`**. `String.replace` no lanza cuando no encuentra
el patrón: devuelve la cadena igual. Se reescribió el fichero idéntico, el test volvió a contar
35 y salió **verde**. La prueba «pasó» sin haber añadido nada.

El arreglo no fue tocar el test, sino **comprobar que la inyección se aplicó** antes de creerse
el resultado:

```js
fs.appendFileSync(p, '\nconst __prueba = …\n__prueba.className = "btn-primary btn-sm";\n');
console.log('  inyeccion aplicada?', fs.readFileSync(p,'utf8').includes('__prueba'));
```

Con la mutación aplicada de verdad: `«el residuo de contraste era 35 y ahora es 36»`, con fichero
y línea.

### Caso B — el caso de prueba que no reproducía el defecto (SCRUM-368)

Para probar que la exención por componente inactivo **caduca** al habilitar el control, se inyectó
un `<button class="btn-primary">` en `login.html` y se midió su contraste. Salió verde las dos
veces, deshabilitado y habilitado.

Motivo: **`login.html` no carga `styles.css`**. Ahí `.btn-primary` no tiene fondo verde, así que
el botón nunca reprodujo el par que se quería vigilar. Se midió un elemento que no era el caso.

Repetido en `index.html`, que sí define `.btn-primary` con el verde de marca: deshabilitado →
exento y declarado; habilitado → **rojo**. Y ese rojo destapó un defecto real del guard (§2).

### Cómo se evita

- **Afirmar la mutación, no suponerla.** `assert.notEqual(mutada, original)` en los tests de rojo
  que operan en memoria; un `includes()` impreso cuando se toca un fichero.
- **Preguntarse qué carga la página**, no solo qué clase lleva el elemento. Un selector no pinta
  nada si su hoja no está.
- **Sospechar del verde barato.** Si una prueba de rojo pasa a la primera y sin esfuerzo, mirar
  el diff de la mutación antes de darla por buena.

---

## 2 · La excepción escrita más ancha que su caso

> **Una excepción por par de colores no es una excepción: es un permiso para ese par en cualquier
> sitio.**

`scripts/guard-contraste.mjs` llevaba una lista de pares `texto|fondo` conocidos y aceptados. La
comparación era **por par**, así que cualquier nodo NUEVO que reutilizara esos dos colores entraba
al producto sin que nada avisara: la excepción se había escrito para unos nodos concretos y acabó
amparando a todos los futuros.

Apareció **porque la prueba del §1 caso B, ya bien hecha, seguía saliendo verde**: el botón
habilitado volvía al censo, pero su par ya estaba en la lista. Sin esa prueba, el guard entraba
en `main` en verde vigilando un permiso abierto.

**Arreglo:** cada excepción declara **cuántos nodos** ampara, y el guard cae si el par gana o
pierde nodos. Y las excepciones **caducan**: si un par listado deja de ocurrir, también falla,
para que se borre.

### Cómo se evita

- Una excepción se escribe con **su alcance contado**, no solo con su motivo.
- Y con **fecha de caducidad por construcción**: si la causa desaparece, el guard lo dice.

---

## 3 · El medidor que no llegó a ejecutarse

Familia de las dos anteriores, y la que más veces ha aparecido: **el fallo no está en lo que el
guard mira, sino en que el guard no miró nada.** Tres formas vistas en el proyecto:

| Forma | Caso real |
| --- | --- |
| El código de salida se pierde en la tubería | `npm test \| tail` devolvía **exit 0** con dos tests en rojo: `$?` era el de `tail`. Se lee el código de salida de **node**, redirigiendo a fichero, nunca el del último proceso de un pipe. |
| El analizador no reconoce lo que mira | El censo de clases no resolvía `className = <ternario>` y dejaba fuera `albaranDetailView.js:256`, donde las tres ramas son botones. Lo cazó **el suelo**, no el test. |
| El CLI no se reconoce a sí mismo | SCRUM-235: `import.meta.url` viene percent-encodeado y `argv[1]` no, así que bajo una ruta con espacios el guard era un **NO-OP silencioso con exit 0**. |

**El suelo es la defensa.** Todo censo declara un mínimo (nodos, ficheros, clases) por debajo del
cual **falla en vez de informar de cero**: «no supe mirar» y «no hay» son el mismo número y
significan lo contrario.

---

## 4 · Medir mientras algo se mueve

> **No se mide mientras algo se mueve.** Transiciones y animaciones devuelven valores
> **interpolados**, y en headless a veces el inicial.

Dos casos reales, los dos en SCRUM-368:

- **Estilos:** `getComputedStyle` justo tras un `Tab` real devolvió el `box-shadow` a mitad de la
  transición de `.15s`. Dio «sin anillo» para `.btn-secondary`, `.btn-danger` y `.btn-ghost`, que
  **sí lo tienen**. Falso rojo.
- **Cajas:** `getBoundingClientRect()` sobre botones dentro de un `.modal` con la animación
  `slide-up` (que arranca en `scale(.98)`) dio **43,48 px** donde el valor real era 44. El
  `transform` del **ancestro** entra en el rect aunque el elemento medido no tenga ninguno.

**Cómo se evita:** `await Promise.all(document.getAnimations().map(a => a.finished.catch(() => {})))`
antes de leer geometría, y doble `requestAnimationFrame` más una espera mayor que la transición
más larga antes de leer estilos. Y cuando el criterio sea «¿lo ve el usuario?», **medir píxeles**
—capturar en reposo y en el estado nuevo y comparar los bytes— en vez de propiedades computadas:
un hash no se deja engañar por un valor a medio camino.

---

## 5 · El árbitro

> **Cuando el analizador estático y el navegador discrepan, el roto es el analizador.**

El censo estático de contraste daba `.sidebar-logo-text` en **1,00** (blanco sobre blanco) porque
no sabía que ese texto vive dentro del sidebar oscuro, y marcaba `.nav-item.active` como fallo
cuando medido en su contenedor real da **5,89**. Adivinar ancestros no funciona.

**Y no se confunde con «no ajustes el guard a tu código».** La prueba que los separa es concreta:

- Si la forma que el analizador no ve **la acabas de introducir tú** → se cambia **el código**.
- Si **llevaba ahí desde antes** → se arregla **el analizador**.

Sin ese criterio, las dos reglas se contradicen.
