# SCRUM-554 · Dos copias del medidor accname — medido al desbloquearse, y la deuda ya no era la que se declaró

**Fecha:** 16-sep-2026 · **Carril:** B · instrumentos de navegador · **Gate:** medición · **se propone NO unificar**

**Medido contra:** `origin/main` = `026677a1bd8260ce073648680a8eb7d7003f4b39` · 2026-09-16T04:07:51Z
**Rama:** `scrum-554-dos-copias-del-medidor`
**Preámbulo (A1):** `prisma generate` rc=0 · `git rev-list --count HEAD..origin/main` = **0** al ramificar.

> **Obligación 0:** sin rama remota, sin commit en `main`, sin expediente → causa **(a)**.
> **Desbloqueo comprobado, que era la condición del ticket:** *«se desbloquea cuando SCRUM-543 esté
> en main. Antes, no.»* — `scripts/guard-a11y-landing.mjs` y `tests/scrum543-landing-a11y.test.mjs`
> **están en `main`**. Desbloqueado.

---

## 1 · 🔴 LA DEUDA NO ES LA QUE EL TICKET DECLARÓ

El ticket dice que el medidor está **«copiado tal cual»** y que los dos son **«literalmente el
mismo código»**. Medido con `diff` real y comparación función a función por AST:

| | |
|---|---|
| líneas que difieren | **345 de 535** |
| funciones con el mismo nombre en los dos | 4 |
| **idénticas** | **2** — y las dos son de **una línea** (`caja`, `log`) |
| **divergidas** | **2** — `loQueSeOye` (11 vs 7 líneas) y `calibrar` (12 vs 16) |

**No son copias. Divergieron.** Y no en detalles:

### `loQueSeOye` — distinta FIRMA, distinto objeto

```js
// comparativa: direcciona por ÍNDICE dentro de una colección fija
async function loQueSeOye(page, indiceCelda) { … document.querySelectorAll('.cmp-cell')[i] … }

// landing: direcciona por SELECTOR CSS arbitrario
async function loQueSeOye(page, sel) { … document.querySelector(s) … }
```

Eso **es «lo que cada guard vigila»**, que el propio ticket manda no tocar (punto 2).

### `calibrar` — y aquí el ticket pide un control que no existe

El ticket propone como control: *«la calibración (`<span display:block>uno</span>dos` → `uno dos`)
sigue pasando en los dos»*. **Medido: no es la misma calibración.**

| | qué calibra |
|---|---|
| **comparativa** | UN caso: `<span style="display:block">uno</span>dos` → espera `'uno dos'` |
| **landing** | **DOS** casos: que inserta el espacio **y que NO lo inserta donde no lo hay** (`'unodos'`) |

**La de landing es estrictamente más fuerte.** Unificarlas cambiaría lo que cada guard garantiza
— y eso no es deuda, es su objeto.

---

## 2 · El arranque de Edge YA está unificado (y más allá del ticket)

El punto 2 del alcance daba por hecho que también estaba duplicado. **No lo está:** los dos llaman
a `lanzarNavegador(puppeteer, { headless: 'new' })`, que vive en **`scripts/_navegador.mjs:376`**
y lo usan **más de diez** guards, no dos. Alguien lo resolvió antes y a mayor escala.

**Queda un punto del alcance sin nada que hacer.**

---

## 3 · 🔴 LO INTENTÉ, Y UNIFICAR ROMPE EL GUARD

No me quedé en la lectura. Extraje el núcleo común —las cuatro líneas del truco del
`role="button"` temporal— a `_navegador.mjs` como `accnameDeNodo(page, nodo)`, recibiendo el nodo
**ya localizado** para que cada guard conservara su localización y sus mensajes.

**Ejecutado el guard de comparativa con el cambio puesto:**

```
🔴 NO SUPE MIRAR a 1280px: el detector rechaza algo que SÍ está en la celda.
🔴 NO SUPE MIRAR a 360px:  el detector rechaza algo que SÍ está en la celda.
🔴 2 problema(s).
```

**Y comprobé que el rojo era mío**, no preexistente: restaurado el fichero original, el mismo
guard vuelve a `✓ En los dos anchos, cada celda llega con su etiqueta de columna asociada`.

**Segundo intento:** la diferencia visible era `nodo.evaluate(fn)` frente a `page.evaluate(fn, nodo)`.
Probada la segunda forma —la que reproduce lo que los guards hacían—: **sigue rompiendo**.

> ⚠️ **No diagnostiqué la causa raíz y lo digo en vez de insinuar que la sé.** Sé que rompe, sé
> que es mío y sé que dos formas distintas de poner el rol no lo arreglan. Por qué exactamente
> —si es el momento en que se crea el handle, el aislamiento del contexto o algo del snapshot—
> exige una tanda con el navegador en la mano, y no la he hecho.

**Revertido byte a byte:** `git status` de `scripts/` **vacío**, y los dos guards en verde.

---

## 4 · La propuesta: NO unificar, como en SCRUM-546

El ticket cita el precedente y dice que *«la forma de decidirlo es la misma: medir antes»*. Medido:

1. el **arranque** ya está compartido — no hay nada que unificar;
2. el **medidor** ya divergió en la firma, que es el objeto de cada guard;
3. la **calibración** también, y la de landing es **más fuerte**;
4. y extraer el núcleo común **rompe** uno de los dos.

**Se quedan los dos.** Lo que se gana unificando son ~4 líneas; lo que se pierde, medido, es un
guard que funciona. **Un módulo común que hay que domar para que los dos sigan midiendo lo mismo
cuesta más que las cuatro líneas que ahorra.**

> 🔒 Y el conocimiento que el ticket quería proteger —la trampa del `role="button"` temporal, que
> costó «dos horas y dos trampas medidas»— **no se pierde por estar dos veces: se pierde si no
> está escrito**. Queda escrito aquí, en §6.

---

## 5 · El coste (punto 4 del alcance), parcial y declarado

`npm run censo:guards-navegador` ejecuta cada guard uno a uno. Los primeros, medidos hoy:

```
guard:contraste              31.6 s   verde
guard:caja-avisos            49.3 s   verde
guard:caja-semaforo          17.3 s   verde
guard:caja-documento-suelto  28.9 s   rojo(143)
```

⚠️ **No lo dejé terminar**, así que **no doy el total** — y ese total es el número que pedía
también SCRUM-522. Lo que sí se puede afirmar: **compartir el arranque no ahorraría nada aquí,
porque ya está compartido** desde `lanzarNavegador`, y aun así cada guard arranca su propio
navegador. El ahorro tendría que venir de **reutilizar el navegador entre guards**, que es otro
ticket y otro riesgo (aislamiento entre medidas).

> 📌 **Y un hallazgo de rebote, que se reporta y no se arregla** (regla 9):
> `guard:caja-documento-suelto` sale **rojo(143)** hoy. No es de este ticket y no lo he tocado.

---

## 6 · El conocimiento que se estaba duplicando, escrito una vez

`accessibility.snapshot()` sólo calcula el nombre accesible de un nodo **cuyo rol lo admita**.
Sobre un `<div>` pelado devuelve un árbol sin `name`, y ese vacío **se lee igual que «no tiene
nombre»** — un cero de medidor roto disfrazado de medida. Por eso los dos guards ponen
`role="button"`, miden, y lo quitan.

Y por eso los dos tienen **suelo**: si el medidor devuelve vacío dicen **NO SUPE MIRAR** en vez de
dar verde. Ese suelo es el que se disparó en §3 — hizo exactamente su trabajo.

---

## 7 · Lo NO tocado

Ni una línea de `scripts/` ni de `tests/`: `git status` de `scripts/` vacío tras revertir.
No se unificó nada · no se tocó lo que cada guard vigila · no se relajó ningún suelo · ninguna
dependencia nueva · `prisma/schema.prisma`, el camino de emisión y el copy, intactos.
