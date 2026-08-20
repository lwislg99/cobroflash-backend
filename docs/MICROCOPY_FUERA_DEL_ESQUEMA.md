# Los textos que el censo del bloque F no mira

**SCRUM-561** · derivado de la medición de SCRUM-555. **Este documento no aprueba nada y no
propone ninguna redacción:** pone delante los textos que quedaron fuera del esquema con el
que se extrajeron los que sí se aprobaron.

> ⚠️ **Generado, no escrito a mano** (`node scripts/citar-fuera-del-censo.mjs`). Los textos
> salen del marcado y se verifican byte a byte; no se retocan ni se reordenan.

---

## Antes de la lista: sí se le pusieron delante

El motivo del ticket dice que a estos textos no los vio nadie. **Medido, no es así.**

| | |
|---|---|
| nodos fuera del esquema | **20** |
| de ellos, presentes en `docs/MICROCOPY_BLOQUE_F_PARA_APROBAR.md` | **20** |
| inéditos (en ningún documento) | **0** |

**Ninguno es inédito.** El documento de aprobación del bloque F los recoge todos — tiene
**51** textos, y el esquema del censo ve **38**. El hueco no está entre el marcado y el
documento: está entre el **documento (51)** y lo que la aprobación cubrió.

🔴 **Y eso último no se puede verificar desde el repositorio:** no hay ningún fichero que
registre qué textos se aprobaron. La aprobación existe en la conversación, no en el árbol.
Mientras siga así, «¿está este texto aprobado?» no tiene respuesta comprobable.

Lo que sí es cierto del motivo del ticket, y sigue siéndolo: **ninguno de estos textos pasa
por el censo de anclas**. Si uno afirma algo del producto, nadie comprueba que sea verdad.

---

## ① Los que afirman algo sobre el producto

Estos necesitan **ancla además de aprobación**: son los que pueden hacer daño.

### `heroe-f4/span#1` · IDENTIDAD

```
El ERP por WhatsApp para los oficios
```

- **en el documento:** F4-1 (el nodo, literal)
- **naturaleza:** ROTULO — rótulo de sección o cabecera de columna
- **marcado:** `<span class="eyebrow">`
- 🔴 **dice qué ES el producto, no qué hace.** Es la afirmación más fuerte de la página
  y no la sostiene ningún ancla. **El posicionamiento lo decide el fundador:** aquí no se
  propone ninguna alternativa.

### `heroe-f4/a#2` · CONDICION

```
Empieza gratis
```

- **en el documento:** F4-5 (el nodo, literal)
- **naturaleza:** ETIQUETA_DE_ACCION — lo que se lee dentro del botón o el enlace
- **marcado:** `<a href="/register.html" class="btn btn-ghost btn-lg">`
- afirma una **condición comercial**. El ancla que hoy existe para «gratis» es
  `src/modules/auth/domain/auth.service.ts::planExpiresAt` (14 días).

### `gremios[fontaneria]/a#1` · CONDICION

```
Empezar gratis
```

- **en el documento:** F6-6 (el elemento entero: «Empezar gratis →»)
- **naturaleza:** ETIQUETA_DE_ACCION — lo que se lee dentro del botón o el enlace
- **marcado:** `<a class="p-link" href="/register.html">`
- afirma una **condición comercial**. El ancla que hoy existe para «gratis» es
  `src/modules/auth/domain/auth.service.ts::planExpiresAt` (14 días).

### `gremios[electricidad]/a#1` · CONDICION

```
Empezar gratis
```

- **en el documento:** F6-6 (el elemento entero: «Empezar gratis →»)
- **naturaleza:** ETIQUETA_DE_ACCION — lo que se lee dentro del botón o el enlace
- **marcado:** `<a class="p-link" href="/register.html">`
- afirma una **condición comercial**. El ancla que hoy existe para «gratis» es
  `src/modules/auth/domain/auth.service.ts::planExpiresAt` (14 días).

### `gremios[reformas]/a#1` · CONDICION

```
Empezar gratis
```

- **en el documento:** F6-6 (el elemento entero: «Empezar gratis →»)
- **naturaleza:** ETIQUETA_DE_ACCION — lo que se lee dentro del botón o el enlace
- **marcado:** `<a class="p-link" href="/register.html">`
- afirma una **condición comercial**. El ancla que hoy existe para «gratis» es
  `src/modules/auth/domain/auth.service.ts::planExpiresAt` (14 días).

### `gremios[climatizacion]/a#1` · CONDICION

```
Empezar gratis
```

- **en el documento:** F6-6 (el elemento entero: «Empezar gratis →»)
- **naturaleza:** ETIQUETA_DE_ACCION — lo que se lee dentro del botón o el enlace
- **marcado:** `<a class="p-link" href="/register.html">`
- afirma una **condición comercial**. El ancla que hoy existe para «gratis» es
  `src/modules/auth/domain/auth.service.ts::planExpiresAt` (14 días).

### `gremios[cerrajeria]/a#1` · CONDICION

```
Empezar gratis
```

- **en el documento:** F6-6 (el elemento entero: «Empezar gratis →»)
- **naturaleza:** ETIQUETA_DE_ACCION — lo que se lee dentro del botón o el enlace
- **marcado:** `<a class="p-link" href="/register.html">`
- afirma una **condición comercial**. El ancla que hoy existe para «gratis» es
  `src/modules/auth/domain/auth.service.ts::planExpiresAt` (14 días).

### `gremios[pintura]/a#1` · CONDICION

```
Empezar gratis
```

- **en el documento:** F6-6 (el elemento entero: «Empezar gratis →»)
- **naturaleza:** ETIQUETA_DE_ACCION — lo que se lee dentro del botón o el enlace
- **marcado:** `<a class="p-link" href="/register.html">`
- afirma una **condición comercial**. El ancla que hoy existe para «gratis» es
  `src/modules/auth/domain/auth.service.ts::planExpiresAt` (14 días).

---

## ② La lista completa, sección por sección

### `#heroe-f4`

Nodos de texto: **8** · los ve el esquema: **5** · **fuera: 3**

| identificador derivado | texto literal | naturaleza | afirma | en el documento |
|---|---|---|---|---|
| `heroe-f4/span#1` | «El ERP por WhatsApp para los oficios» | ROTULO | IDENTIDAD | F4-1 |
| `heroe-f4/a#1` | «Probar la demo» | ETIQUETA_DE_ACCION | — | F4-4 |
| `heroe-f4/a#2` | «Empieza gratis» | ETIQUETA_DE_ACCION | CONDICION | F4-5 |

### `#gremios`

Nodos de texto: **27** · los ve el esquema: **14** · **fuera: 13**

| identificador derivado | texto literal | naturaleza | afirma | en el documento |
|---|---|---|---|---|
| `gremios/span#1` | «Tu oficio» | ROTULO | — | F6-1 |
| `gremios[fontaneria]/a#1` | «Empezar gratis» | ETIQUETA_DE_ACCION | CONDICION | F6-6 |
| `gremios[fontaneria]/span#1` | «→» | GLIFO | — | F6-6 |
| `gremios[electricidad]/a#1` | «Empezar gratis» | ETIQUETA_DE_ACCION | CONDICION | F6-6 |
| `gremios[electricidad]/span#1` | «→» | GLIFO | — | F6-6 |
| `gremios[reformas]/a#1` | «Empezar gratis» | ETIQUETA_DE_ACCION | CONDICION | F6-6 |
| `gremios[reformas]/span#1` | «→» | GLIFO | — | F6-6 |
| `gremios[climatizacion]/a#1` | «Empezar gratis» | ETIQUETA_DE_ACCION | CONDICION | F6-6 |
| `gremios[climatizacion]/span#1` | «→» | GLIFO | — | F6-6 |
| `gremios[cerrajeria]/a#1` | «Empezar gratis» | ETIQUETA_DE_ACCION | CONDICION | F6-6 |
| `gremios[cerrajeria]/span#1` | «→» | GLIFO | — | F6-6 |
| `gremios[pintura]/a#1` | «Empezar gratis» | ETIQUETA_DE_ACCION | CONDICION | F6-6 |
| `gremios[pintura]/span#1` | «→» | GLIFO | — | F6-6 |

### `#comparativa`

Nodos de texto: **36** · los ve el esquema: **32** · **fuera: 4**

| identificador derivado | texto literal | naturaleza | afirma | en el documento |
|---|---|---|---|---|
| `comparativa/span#1` | «PROPUESTA · La diferencia» | ROTULO | — | F5-1 |
| `comparativa/span#2` | «La situación» | ROTULO | — | F5-4 |
| `comparativa/span#3` | «Tu método actual» ⚠️ | ROTULO | — | F5-5 |
| `comparativa/span#4` | «Con YaQu» ⚠️ | ROTULO | — | F5-6 |

⚠️ Esos textos existen **dos veces** en el
marcado: aquí como cabecera de columna, y otra vez **dentro** de cada fila, donde el
esquema sí los ve. No son inéditos ni son otros: son la misma cadena en dos sitios, y por
eso el identificador derivado dice cuál de los dos es.

---

## ③ ¿Y en `#comparativa`? El mecanismo de F5 tampoco los alcanza

`#comparativa` no la censa el censo de anclas: la vigila `tests/scrum332-comparativa-anclas.test.mjs`,
con otra unidad — la **fila**, no la frase. La pregunta es si esa otra unidad los cubre.

**Medido: no.** El registro de F5 tiene **6 claves**, y las seis son valores de `data-fila`
(`firma`, `cobro-pendiente`, `presupuesto-sin-respuesta`, `historial-cliente`, `margen-mes`,
`catalogo-precios`). Los cuatro nodos citados arriba están **antes de la primera fila**: son
el rótulo de la sección y las tres cabeceras de columna. **No pertenecen a ninguna fila, así
que ninguna ancla los alcanza.**

Es el mismo hueco con otra sección: cada censo mira su unidad, y lo que no es esa unidad no
lo mira nadie.

---

## ④ Con qué criterio está hecha cada columna

**Naturaleza** — el encargo pedía separar «texto de usuario» de «mecanismo (clase, id,
atributo de datos)». Esa separación **no hace falta aquí, y decirlo es más honesto que
fabricarla**: este censo sólo produce **nodos de texto**, lo que hay entre `>` y `<`. Una
clase o un `data-*` no son nodos de texto y no pueden salir de esta lista. Los
20 citados son, los 20, texto que un visitante lee. Lo que sí se deriva del marcado
es de qué tipo:

- `GLIFO` — símbolo, sin ninguna letra
- `ROTULO` — rótulo de sección o cabecera de columna
- `ETIQUETA_DE_ACCION` — lo que se lee dentro del botón o el enlace
- `PROSA` — frase corrida

**Afirma** — tres señales léxicas, cada una con consecuencia distinta:

- `IDENTIDAD` — un sustantivo de **categoría** que dice qué ES el producto: `\b(erp|crm|app|aplicaci[oó]n|software|programa|plataforma|herramienta|sistema)\b`.
  ⚠️ Son sustantivos de categoría, **no el nombre del producto**: «Con YaQu» nombra a YaQu y
  no afirma nada de él. Meter «yaqu» en la lista daría un falso positivo.
- `CONDICION` — una condición comercial: `\bgratis\b|\bsin tarjeta\b|\bsin permanencia\b|\bgratuit[oa]s?\b`.
- `CAPACIDAD` — `MARCAS_CAPACIDAD`, el contraste que ya existe en el censo de anclas.

🔴 **Este criterio es un suelo, no un techo.** SCRUM-555 midió que el léxico de capacidad se
deja **una de cada tres** promesas. Por eso la lista se entrega con el **texto literal**
delante: para que quien la lea no dependa del léxico.

**En el documento** — cruce con `docs/MICROCOPY_BLOQUE_F_PARA_APROBAR.md` usando `===` y `Buffer.compare`,
nunca `includes()`. Se prueba con tres formas: el nodo suelto, el texto entero de su
elemento, y el del enlace que lo envuelve — porque el documento juntó el enlace con su
flecha en una sola entrada, y sin esa tercera forma seis nodos parecerían inéditos.

