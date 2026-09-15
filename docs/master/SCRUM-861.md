# SCRUM-861 · El oráculo de microcopy aprende la firma delegada, sin aflojar SCRUM-726

**Medido contra:** `origin/main` = `cae27c2e6dc1482db0567a8561ebeb6863c996b8` · 2026-09-15T17:20:43+02:00
**Rama:** `scrum-861-firma-por-delegacion`, partida de `main`.
**Va antes de:** SCRUM-600b, que es quien estrena la primera ficha firmada por delegación.

---

## 1 · El hueco, medido

El fundador delegó por escrito, y de forma permanente, la aprobación de microcopy en el orquestador:
`docs/equipo/limites-del-fundador.md` §«Delegación permanente» — *«Los textos de microcopy que haya
que aprobar los aprueba el orquestador»*.

El oráculo no lo sabía. `constaAprobado` filtraba `a.firmante === 'fundador'`
(`tests/_microcopy-aprobada.mjs`, SCRUM-726), así que una ficha con la firma
«Aprobado por el orquestador por delegación del fundador» se leía con firmante `'orquestador'` y
**acababa en `pendientesDeFirma`**. La única firma «que pasaba» era escribir «Aprobado por el
fundador» sin serlo.

🔒 **No se hizo, y es la razón de este ticket:** SCRUM-600 se paró antes de escribir una línea
porque el guard sólo aceptaba esa frase. Una firma no se falsifica para que un guard pase: se le
enseña al guard la firma de verdad.

---

## 2 · La regla

La firma delegada cuenta **sólo** con las tres cosas a la vez:

| | condición | por qué |
| --- | --- | --- |
| 1 | la frase exacta **«Aprobado por el orquestador por delegación del fundador»**, fuera de cita | es una firma con nombre, no «alguien lo escribió» |
| 2 | **en esa misma línea**, la referencia al comentario de Jira: `SCRUM-NNN comentario NNNNN` | sin ella no hay forma de ir a comprobarla. En otra línea no vale: una referencia suelta en la prosa no demuestra que respalde a ESTA firma |
| 3 | la sección **«Delegación permanente»** de `limites-del-fundador.md`, con su línea de microcopy **como viñeta suya** | si el fundador la retira, las firmas delegadas **dejan de contar solas**, sin tocar ni una ficha |

**Firmante registrado: `'orquestador'`.** La firma del fundador sigue **exactamente igual** y no
depende de la delegación.

---

## 3 · Cómo

* **`firmaDelegadaDe(texto)`** — la referencia de la firma delegada, o `null` si no está completa.
  Descarta las líneas de cita, igual que `firmanteDe`.
* **`delegacionVigente({ limites })`** — busca el `## Delegación permanente` y, **dentro** de esa
  sección, una viñeta que, sin la viñeta y sin la negrita, sea **idéntica** a la línea de microcopy
  (identidad, no subcadena: SCRUM-715). La misma frase fuera de la sección no es la delegación. Si el
  fichero no existe devuelve `false` **sin lanzar**: una delegación retirada es un estado legítimo, no
  una ceguera.
* **`firmanteDe`** registra `'orquestador'` en cuanto hay firma delegada completa, **antes** de mirar
  cualquier otra firma: si no, una línea «por el asesor» escrita más arriba decidiría el firmante.
* **Cada registro lleva `aprobada`**, y es la **única** pregunta que hacen `constaAprobado`,
  `literalesAprobados` y `pendientesDeFirma`. Antes cada una repetía su propio
  `firmante === 'fundador'`: tres copias de la misma regla pueden discrepar; una no.
* **`limites`** es una opción del barrido, igual que `dir` y `congelado`: retirar la delegación en un
  test no puede tocar el documento real, que otros guards leen a la vez.

---

## 4 · 🔒 Lo que NO se afloja

* **SCRUM-726 sigue mirando QUIÉN firma.** «Aprobado por el orquestador» a secas, «por el asesor»,
  «por la Sesión 4», «por Claude», «por delegación del fundador» sin nombre, y cualquier firma
  escrita dentro de una cita: **siguen sin contar**.
* **SCRUM-715 sigue comparando por identidad** — ni en los literales ni en la línea de delegación.

### El control de `scrum726` cambia de pregunta, y no es aflojarlo

`tests/scrum726-quien-firma-la-microcopy.test.mjs` exigía que **todo registro real** tuviera
`firmante === 'fundador'`. Con la delegación escrita, «¿lo firmó el fundador?» y «¿cuenta como
aprobación?» dejan de ser la misma pregunta: **la primera ficha firmada válidamente por el
orquestador —la de SCRUM-600b— lo habría puesto rojo siendo legítima.**

Ahora pregunta lo mismo que el oráculo: `a.aprobada !== true`. Una firma «por el asesor», «por el
orquestador» a secas, sin referencia o con la delegación retirada **sigue cayendo ahí**, con su
firmante escrito en el rojo.

---

## 5 · Verificación — los seis rojos, vistos caer

`tests/scrum861-firma-por-delegacion.test.mjs` — 8 tests, contra directorios de prueba en
`os.tmpdir()`, nunca escribiendo en `docs/`.

Cada rojo se provocó **mutando el oráculo ya comiteado**, comprobando antes que la mutación entraba
(un ancla que no casa no es un rojo probado) y restaurando después **byte a byte**
(`Buffer.compare = 0`). Instrumento: `docs/master/evidencias/SCRUM-861/rojos-861.mjs`.

| rojo | mutación del oráculo | qué cayó |
| --- | --- | --- |
| **a)** delegada con referencia y sección → cuenta | la firma delegada nunca cuenta | **a** |
| **b)** sección retirada → cae *(también sin la línea, y con la línea fuera de su sección)* | se ignora si la delegación sigue vigente | **b** |
| **c)** sin referencia → cae *(también referencia a medias, y referencia en otra línea)* | no se exige la referencia | **c** |
| **d)** «por el orquestador» a secas, «por el asesor», «por la Sesión 4», «por Claude» → caen | cualquier «por el orquestador» cuenta | **d** y **c** — lo esperable: si basta el nombre, la firma sin referencia también cuenta |
| **e)** firma delegada dentro de una cita → no cuenta | la firma delegada se lee también dentro de las citas | **e** |
| **f)** control del fundador, con y sin delegación | la firma del fundador pasa a depender de la delegación | **f** |

Tras las seis: oráculo restaurado (`Buffer.compare = 0`) y `scrum861` en verde.

### 🔴 Un rojo propio de la suite completa, y cómo se cerró sin tocar el guard

La primera versión de `scrum861` escribía sus fichas y su `limites` de prueba **desde ayudantes que
recibían la ruta por parámetro** (`ficha(dir, …)`, `limitesDePrueba(dir, …)`) y desestructuraba
`const { raiz, dir } = escenario()`. Todo caía en `os.tmpdir()`, pero **SCRUM-824 lo contó como
«sin probar»** —4 sitios `DESCONOCIDO`— porque su censo no atraviesa parámetros ni
desestructuración, y el conjunto de ficheros sin probar **no puede crecer**.

No se añadió el fichero a `SIN_PROBAR_CONOCIDOS`: se reescribió el test para que el origen **se vea**.
Los ayudantes ahora sólo devuelven **texto**, cada escritura se hace en el propio test sobre
`e.raiz` / `e.dir`, y `escenario` es un `const` con un único `return` que el censo sí sigue.
Resultado: **16 de 16 creaciones demostradas `TMP`**, `scrum824` en verde, y los seis rojos
**vueltos a ver caer** contra el test ya reescrito.

**Suelo:** con el `limites-del-fundador.md` real intacto, `delegacionVigente()` devuelve `true`. Si
no lo hiciera, cada «no cuenta» de arriba podría ser ceguera y no rigor.

**Control del árbol real:** todo registro con firma del fundador —y el congelado— sigue
`aprobada: true`, y cada uno de sus literales sigue constando uno a uno.

**Consumidores:** los 16 ficheros que llaman a `constaAprobado`, `literalesAprobados` o
`pendientesDeFirma`, en verde con el oráculo nuevo — 167 tests.

---

## 6 · La convención

`docs/microcopy/README.md` documenta la segunda firma válida junto a la del fundador, con sus tres
condiciones y la línea ⛔ *«Nadie escribe "Aprobado por el fundador" si no es él»*. Sin eso, el README
seguiría diciendo que sólo existe una firma, y la primera ficha delegada parecería un error.

---

## 7 · Lo que NO se ha tocado

* **Ninguna ficha de `docs/microcopy/`**: hoy no hay ninguna firmada por delegación. La primera
  llega con SCRUM-600b.
* **`docs/equipo/limites-del-fundador.md`**: se lee, no se escribe.
* **Ningún texto de pantalla**, ningún rótulo, `public/`, `src/` ni `prisma/`.
* **Cero producción y cero staging.**

## Tests que introduce esta entrada

* `tests/scrum861-firma-por-delegacion.test.mjs` — suelo, los seis casos (a–f) y el control del árbol
  real.
* `tests/scrum726-quien-firma-la-microcopy.test.mjs` — **modificado**: su control pregunta
  `aprobada`, no `firmante === 'fundador'`.
