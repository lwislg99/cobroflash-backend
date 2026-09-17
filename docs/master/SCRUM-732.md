# SCRUM-732 · Guards cuyo ALCANCE es más ancho que su SUJETO

**Medido contra:** `origin/main` = `5f7b994ef52020193f94560928521c73d4c9472d` · 2026-09-17T16:41:20+01:00
**Rama:** `scrum-732` · **Instrumento:** `scripts/censo-alcance-vs-sujeto.mjs`

Una aserción que toma **la fuente entera** de un fichero para defender una propiedad de **cuatro
rótulos** gobierna mucho más de lo que dice proteger. Mientras el resto del fichero esté limpio, las
dos cosas coinciden; el día que otro ticket escribe algo legítimo en otra parte, el guard se pone
rojo **acusando al sitio equivocado** — y un rojo que nombra el sitio equivocado se arregla
apagándolo. Ahí sí se pierde la propiedad entera.

---

## 🔴 EL HALLAZGO QUE ORDENA EL CENSO: son DOS defectos con un nombre común

Los dos casos conocidos —los dos arreglados por SCRUM-587— **no son el mismo defecto**. Se acusan
por **ejes opuestos**, y confundirlos en una sola cifra sería el primer error del instrumento:

| | caso | forma | qué hace mal |
|---|---|---|---|
| **A** | **SCRUM-286** | `assert.ok(!FUENTE.includes('[PENDIENTE…'))` sobre todo `quotesView.js` | **GOBIERNA DE MÁS.** Su mensaje nombra «los TÍTULOS del formulario»: cuatro, ya derivados dos líneas más arriba en `bloques`. |
| **B** | **SCRUM-591** | `assert.ok(!lit.some(l => l.includes('[PENDIENTE')))` | **PERMITE DE MENOS.** Prohíbe cualquier marcador mientras su mensaje promete que lo declarado en el censo de SCRUM-402 es legítimo. La vía que ofrecía no existía: el único modo de pasar era borrar el marcador o apagar el test. |

**A es decidible. B no.** Comparar el conjunto que una aserción gobierna contra el que **nombra su
mensaje** es leer castellano. Por eso este censo mide A y manda B a NO CLASIFICADO **con su motivo
escrito** — y no al revés: un censo que afirmara cubrir B cometería **dentro del instrumento** el
defecto que este ticket denuncia.

---

## Cómo se mide — conjuntos, no cadenas

    ALCANCE = las unidades que la aserción gobierna de hecho
    SUJETO  = las unidades sobre las que el fichero YA SABE hablar por separado

Se acusa cuando **ALCANCE ⊋ SUJETO**: la aserción opera sobre la **cadena cruda** del fichero (raíz
`readFileSync`) mediante una **búsqueda negada**, existiendo en el mismo ámbito una **colección
derivada** de esa misma fuente. O sea: el fichero ya sabe mirar el subconjunto, y la aserción no lo
mira.

Es el mismo tipo de distinción que la novena auto-referencia —**posicional, no semántica**— y por
eso se puede medir: por dónde fluye el valor, no qué significa.

**Dos cortes, los dos aprendidos de un falso positivo propio** (ver «errores» abajo):

- una **función** que envuelve `readFileSync` no es una cadena cruda;
- sólo cuenta la búsqueda **negada**: `!F.includes(x)` es una prohibición sobre todo el fichero;
  `F.includes(x)` es una precondición, y ahí el sujeto **sí** es la fuente entera.

---

## 🔴 LA PASADA HISTÓRICA — la prueba de que el banco no es un muñeco de paja

El banco del censo es **fabricado** y vive en el instrumento (decisión del orquestador: atar el
positivo a un ref histórico rompería el censo en CI, donde el clon puede venir superficial). Pero un
positivo que uno mismo escribe **pasa por construcción**. Así que el mismo `analizar()` se corrió
**una vez, a mano y fuera del test**, contra los dos ficheros REALES de antes de SCRUM-587
(`ac282d55^`, donde los dos defectos están vivos). Salida literal:

```
PASADA HISTÓRICA · ref ac282d55^ · mismo analizar() que el censo

tests/scrum286-bloques-orden.test.mjs
  acusado: true
  crudas: FUENTE
  derivadas: R, c
  aserciones ANCHAS: l.162 sobre `FUENTE`
  aserciones ESTRECHAS: 15

tests/scrum591-alta-desde-el-documento.test.mjs
  acusado: false
  crudas: (ninguna)
  derivadas: (ninguna)
  aserciones ANCHAS: (ninguna)
  aserciones ESTRECHAS: 0
```

**Y se acusa por el eje correcto, no por casualidad:** la línea que señala, `l.162`, es
**exactamente** la que SCRUM-587 estrechó —
`assert.ok(!FUENTE.includes('[PENDIENTE microcopy oficial]'), '…ha vuelto un marcador a los TÍTULOS del formulario…')`.
No la vecina, no el fichero entero: la línea.

**SCRUM-591 sale `acusado: false`, y eso es lo correcto**, no un fallo del banco: su eje —«permite
de menos»— es el que este censo declara no medir. Sale como NO CLASIFICADO.

---

## CONTROLES DEL BANCO FABRICADO

Tres casos, la misma forma con una sola diferencia cada vez:

```
✅ los 3 casos fabricados responden como deben:
     ACUSA  · ANCHO · gobierna la fuente entera teniendo el subconjunto al lado
     limpio · ESTRECHO · la misma propiedad, mirada sobre el subconjunto
     limpio · NEGATIVO · gobierna la fuente entera y su sujeto ES la fuente entera
```

El tercero es **el control negativo obligatorio**: un guard cuyo alcance SÍ coincide con su sujeto
—no hay subconjunto derivado, así que gobernar el fichero entero es exactamente lo que dice hacer—
tiene que salir limpio. Si saliera acusado, el criterio acusaría a todo el que lea un fichero y su
lista no significaría nada.

---

## EL CENSO · las dos cifras juntas, y la población

    guards EXAMINADOS (ficheros .mjs con aserciones) ... 911
      · medibles (leen una fuente cruda) ............... 492
      · NO CLASIFICADOS ............................... 419

    CAZADOS 2  ·  NO CLASIFICADOS 419   (sobre 911 examinados)

**Los 419 no clasificados no son 419 guards sanos.** Son guards de los que este instrumento no
puede decir nada: no leen ninguna fuente cruda, así que no hay dos conjuntos que comparar. Cuentan
del lado malo, y por eso la cifra va pegada a la de cazados en la misma línea: un «caza 2» suelto
se leería como «el árbol está casi limpio», y lo que dice de verdad es «he podido mirar 492 de 911».

### Los dos cazados

**1 · `tests/scrum244-menu-portabilidad.test.mjs:211`** — gobierna `VISTA` entera; subconjunto
disponible: `card`, `handler`.

```js
for (const pista of ['borrar', 'eliminar cuenta', 'darme de baja', 'suprimir']) {
  assert.ok(!VISTA.toLowerCase().includes(pista), '🔴 la vista de descargas menciona «…»')
}
```

Es el de más riesgo de los dos: defiende un **dictamen legal** (la supresión del art. 17 sigue
bloqueada) prohibiendo cuatro palabras en **todo** el fichero. El día que alguien escriba «borrar»
en un comentario o en un control que no ofrece la supresión, este guard se pone rojo nombrando un
dictamen que nadie ha incumplido.

**2 · `tests/scrum895b-literales-firmados.test.mjs:235`** — gobierna `src` entera; subconjunto
disponible: `decl`, `codigo`. **Es mío, escrito hoy mismo.** Ver abajo.

---

## Errores propios (A9)

**① Conté el LECTOR como si fuera la fuente.** La primera pasada histórica dio
`scrum591 → crudas: leer`, y `leer` es `const leer = (p) => fs.readFileSync(p, 'utf8')`: la función,
no la cadena. Contarlo hacía «medible» un fichero del que no se había leído nada — un no-clasificado
disfrazado de clasificado, que es el cero sin población otra vez. **Lo destapó la pasada histórica,
no mi lectura del código.** Con el corte puesto, los no clasificados pasaron de 314 a **419**: la
cifra honesta era un 33 % peor que la que iba a publicar.

**② Acusé una precondición como si fuera una prohibición.** La misma pasada señalaba también la
`l.38` de `scrum286`: `assert.ok(FUENTE.includes(buscar), '🔴 el patrón a mutar ya no existe')`,
dentro del helper `mutar()`. Ahí el sujeto **sí** es la fuente entera. De ahí el corte de la
negación. Sin él, el censo habría entregado un cazado falso dentro de su propio control positivo —
acertando el fichero por una línea que no era.

**③ Uno de los dos cazados lo escribí yo esta mañana.**
`tests/scrum895b-literales-firmados.test.mjs:235` hace
`assert.ok(!src.includes('|| primaria.id'))` sobre **todo** `jobDetailView.js` para defender una
propiedad de **un respaldo** de la fila del albarán. Es la misma forma que SCRUM-286, y la escribí
seis horas después de documentar por qué está mal. **No lo arreglo aquí** —el ticket es el censo, y
estrechar un guard sin criterio convierte un guard ancho en un guard roto—, pero queda en la lista
con mi nombre.

---

## Lo que este censo NO hace

⛔ **No arregla ningún guard.** Ni los dos cazados ni el mío.
⛔ **No mide el eje de SCRUM-591**, y lo dice en cada ejecución.
⛔ No entra en `npm test`: es un censo, se corre a mano
(`node scripts/censo-alcance-vs-sujeto.mjs`). Salidas: 0 sin hallazgos, 1 hay cazados, 2 el banco no
responde como debe.
