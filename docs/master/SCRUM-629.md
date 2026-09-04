# SCRUM-629 · Un test que compara dos cadenas vacías pasa, y no ha medido nada

**Fecha:** 4-sep-2026 · **Carril:** herramienta / fixtures · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `8303db7524d3e0e90659c49f840d47adefaf6d5f` · 2026-09-04T21:05:00Z

---

## 🔴 LA PREMISA DEL TICKET NO ERA EXACTA, y decirlo primero cambia dónde va el arreglo

El encargo decía que `telefonoDePrueba(1)` **«se convierte en cadena vacía al normalizar»**.

**Medido: no.**

```
telefonoDePrueba(1)          = 34000000001   → normalizePhone → "34000000001"   ✅ intacto
telefonoDePrueba(1).slice(2) = 000000001     → normalizePhone → ""               🔴 destruido
```

El número **completo** sobrevive **siempre** — barrido de 206 índices, cero destruidos. Lo que se
destruye es el **tramo nacional**, los 9 dígitos sin el `34`, que es lo que sale de escribir
`.slice(2)` a mano. Su `00` de cabeza se lee como prefijo internacional, se quita, quedan 7
dígitos y no pasan el `^\d{8,15}$`.

### Por qué la distinción no es un matiz

**Decide dónde va el arreglo.** Si el defecto estuviera en el número completo, habría que mover el
rango — y eso cambiaría los números que ya usan otros fixtures, que es **exactamente la regresión
que este ticket prohíbe**. Como está en el tramo, el suelo va en **la operación que lo produce**, y
los números no se tocan ni uno.

---

## ① LA FRONTERA, con número

Buscada **por bisección y comprobada a los dos lados**, no deducida del código —el comportamiento
del `00` ya sorprendió una vez—:

| | índice | tramo | normaliza a |
|---|---:|---|---|
| último que **muere** | 9.999.999 | `009999999` | `""` |
| primero que **sobrevive** | 10.000.000 | `010000000` | `010000000` |

Y no es un salto suelto: por debajo mueren **todos** (comprobados 1, 2, 9, 99, 9999, 999999,
9999999) y por encima sobreviven **todos** (10000000, 12345678, 23456789, 99999999).

---

## ② EL DAÑO YA HECHO: **CERO**, y va declarado con su población

| | |
|---|---:|
| población barrida | **1.194 ficheros** (`tests/`, `scripts/`, `src/`, `public/`, `prisma/`) |
| llamadas al helper con índice literal | **18** |
| en la zona mala (`n < 10.000.000`) | **14** |
| **con daño real** | **0** |

**Ninguna se destruye, porque todas usan el número completo.** El cero va con el control positivo
delante: el detector caza la forma mala cuando se le da (`telefonoDePrueba(1).slice(2)`) y no
acusa a la buena (`tramoNacionalDePrueba(1)`).

**El único sitio que recorta a mano** es `tests/scrum578-duplicados-identificador.test.mjs`, y lo
hace **a propósito** en su suelo: fija que el tramo de `telefonoDePrueba(1)` da `""` — esta misma
trampa, escrita como aserción. Se declara y **no se toca**: su verde es información, no descuido.

> **Y ahí está la lección de fondo.** SCRUM-578 ya conocía este defecto y lo defendió… **en un
> test**. Un suelo copiado en el sitio que lo sufre protege a ese sitio y a ninguno más. Por eso
> este ticket lo mueve al helper.

---

## ③ EL CONTROL, en las dos direcciones

### ANTES — el falso verde, montado y visto pasar

```
canonico guardado = ""
canonico tecleado = ""
✅ VERDE — y no ha ejercitado NADA: "" === ""

[contraste] canonico con n=12345678 = "012345678"   ← aquí sí hay algo que comparar
```

El par natural de un test de duplicados —el mismo número guardado y tecleado— compara `""` con
`""`. **Pasa.** No falla, no avisa, y da confianza.

### DESPUÉS — ya no se puede montar en silencio

```
tramoNacionalDePrueba: el índice 1 produce el tramo «000000001», que empieza por «00» y una
normalización E.164 lo convierte en la CADENA VACÍA — dos vacíos comparan iguales y el test
pasa sin medir nada. Usa un índice >= 10000000 (p. ej. `tramoNacionalDePrueba(12345678)`).
El número COMPLETO sí es válido con cualquier índice: para eso está `telefonoDePrueba(n)`.
```

El mensaje **dice qué hacer**, no sólo que no.

### LOS ROJOS, por el mecanismo

| inyección | qué cae |
|---|---|
| ① la guardia del helper se desactiva | «el helper lo devolvió en silencio» |
| ② otro test escribe el `.slice(2)` a mano | el censo lo nombra: `scrum318-rail-contenido.test.mjs` |
| ③ el helper **desplaza** la zona válida | 🔴 **el CONTROL NEGATIVO** y la frontera |

**El rojo ③ es el importante:** desplazar el rango es la tentación obvia de este ticket —arreglaría
el tramo de un plumazo— y movería todos los números. El control negativo lo caza porque congela
los seis valores que hoy usan los fixtures.

Las tres revertidas, `git status` vacío y CR = 0 en disco.

---

## Lo construido

`tramoNacionalDePrueba(n)` en `scripts/_telefonos-prueba.mjs` — **el sitio único**, no copiado en
cada test. Falla en voz alta por debajo de la frontera en vez de devolver algo que se destruye.
Y `PRIMER_INDICE_NACIONAL_ESTABLE = 10000000`, la frontera medida, exportada para que quien la
necesite no la vuelva a deducir.

Más el censo (`tests/scrum629-…`, 7 tests) con su suelo, su control positivo, su control negativo
y un trinquete que impide que el `.slice(2)` a mano vuelva a escribirse **enfrente** del helper:
poner el suelo en el sitio único no sirve de nada si la trampa se monta al lado.

**`normalizePhone` NO se ha tocado.** ~40 llamadores, y es el número al que se manda el WhatsApp.

---

## Lo que NO cubre

1. **No se ha cambiado ningún llamador existente.** Los 14 de la zona mala siguen igual: no tienen
   daño, y migrarlos por gusto tocaría ficheros de otros carriles.
2. **El censo detecta el `.slice(2)` literal**, no cualquier forma imaginable de quitar el prefijo
   (`substring(2)`, una constante intermedia, un `replace('34','')`). Se eligió la forma que
   existe en el repo y la que aparece en la documentación del defecto; ampliarlo sin un caso real
   sería inventar población.
3. **No se ha medido si `normalizePhone` debería tratar el `00` de otra forma.** Está fuera de
   alcance por decisión del encargo, y puede ser correcto para lo suyo.
4. **La frontera es de `normalizePhone`, no del plan de numeración.** Si esa función cambiara su
   regla del `00`, la frontera se movería — y por eso el suelo la comprueba a los dos lados en vez
   de fiarse de la constante.

## HALLAZGOS FUERA DE ALCANCE

* `tests/scrum578-duplicados-identificador.test.mjs` fija esta trampa en su propio suelo desde
  SCRUM-578. Cuando alguien coja ese fichero, puede pasar a `tramoNacionalDePrueba` y quedarse sin
  la aserción local — pero entonces habría que mover esa aserción aquí, no borrarla.

## Ficheros

* `scripts/_telefonos-prueba.mjs` — `PRIMER_INDICE_NACIONAL_ESTABLE`, `tramoNacionalDePrueba` y el
  porqué medido. Los números de `telefonoDePrueba` **no cambian**.
* `tests/scrum629-telefono-que-no-se-destruye.test.mjs` — **nuevo**, 7 tests.
