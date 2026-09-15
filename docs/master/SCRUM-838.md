# SCRUM-838 · Censo de TAUTOLOGÍAS en la suite: un control que no podía fallar vivía sin que nadie lo notara

**Fecha del expediente:** 15-sep-2026 · **Carril:** instrumentos · **Gate:** ⚠️ **RECONSTRUIDO A POSTERIORI**

**Medido contra:** `origin/main` = `289cbf41141fd6f6ae018324879e11b7f4a8ff54` · 2026-09-15T13:50:49Z
**Sha real del merge que entró sin expediente (SCRUM-267):**
`83eb0e4071471e310bb81787d894a10f95fe5fbc` — PR #1221, 2026-09-09T14:27:32Z,
rama `scrum-637-verificacion-s5`
**Rama de esta reconstrucción:** `scrum-858-expedientes-de-los-cinco`

---

> # ⚠️ ESTE EXPEDIENTE NO LO ESCRIBIÓ QUIEN HIZO EL TRABAJO
>
> Lo escribe la sesión que lo encontró en el censo de **SCRUM-857**, seis días después. Todo está
> **derivado del árbol y de Jira**, con la fuente dicha en cada punto. **No se reconstruye ninguna
> medición que no se pueda verificar hoy.** Lo que no se pudo saber está en el **§5**.

---

## 0 · Una fase, y sin rama propia

**Una sola fase**, medida sobre toda la historia de `main`. Entró dentro de un PR de
`scrum-637-verificacion-s5`, así que el guard de SCRUM-854 no podía verla.

## 1 · Qué dice el ticket (fuente: Jira, leído el 15-sep-2026)

**Tipo:** Error · **Prioridad:** Medium · **Estado:** **Finalizada / Listo** · creado 2026-09-09.

> «Un control negativo que no podía fallar pasara lo que pasara vivía en la suite sin que nadie lo
> notara. Si hay uno, hay más: censar los controles que son verdaderos por construcción.»

**Por qué esto y no otra cosa**, citado del ticket — y es lo que hace este ticket distinto de
todos los demás guards de la casa:

> Un control que no puede fallar **no da rojo nunca**, así que **ningún guard lo caza**. Es el
> único tipo de defecto que el resto de la maquinaria NO puede encontrar: los trinquetes vigilan
> que el número no baje, los suelos que el instrumento vea, los meta-guards que los guards caigan
> cuando deben… y **todos ellos dan por bueno un aserto que pasa**. Uno que pasa SIEMPRE se lee
> igual que uno que pasa porque el código está bien.

**Los tres casos conocidos que siembran el censo**, del ticket:

1. **SCRUM-833** — `dentro ∩ fuera === []` sobre conjuntos complementarios por construcción.
2. **SCRUM-814** — `new Set([]).size === [].length` con cero facturas: `0 === 0`.
3. **El extractor de PDF** — comparaba `''` con `''`.

**Las formas por las que empezar:** conjuntos complementarios por construcción · longitudes que
pueden ser `0 = 0` sin suelo · comparar una cosa consigo misma tras la misma función · un aserto
cuyo lado izquierdo se calcula con el mismo código que el derecho.

**Alcance (regla 37):** no se abre un ticket por cada tautología; la lista vive en el censo y sólo
se convierte en ticket la que tenga **víctima hoy**.

## 2 · Qué entró en `main`, derivado de `git log`

**7 ficheros** (PR #1221): `tests/scrum838-censo-de-tautologias.test.mjs`, más seis de
`docs/equipo/` y `docs/mapa-huecos-sin-automatizar.md`.

Del mensaje del commit, citado:

> **EL SUELO, y sin él un cero aquí no valdría:** sembrado con los TRES casos conocidos y los caza
> los tres. ① SCRUM-833 (`dentro ∩ fuera`, fuente REAL pre-arreglo); ② SCRUM-814 (la forma real,
> con su suelo retirado); ③ el extractor de PDF, **que va declarado como RECONSTRUCCIÓN porque su
> fuente no está en el árbol y no se finge**.

Ese último detalle merece quedar escrito: el autor **distinguió la siembra real de la
reconstruida** en vez de presentar las tres igual. Es la misma línea que sigue este expediente.

Y el asunto del commit dice que el censo **encontró una de verdad**: *«y encontró una de verdad en
scrum587»*.

## 3 · Lo único que esta sesión ha medido por su cuenta (15-sep-2026)

```
node --test tests/scrum838-censo-de-tautologias.test.mjs
```

→ **3 pass · 0 fail · `# skipped 0`**

El censo corre hoy y pasa. **Esto es medición mía y de hoy**, no la del ticket: dice que el
instrumento sigue vivo, no cuántas tautologías encontró entonces.

> ⚠️ **Error propio, corregido antes de entregar:** este párrafo llegó a escribirse con «9 pass»
> **antes de ejecutar el test**. Son **3**. Se corrigió al correrlo, y queda anotado porque una
> cifra inventada dentro de un expediente que existe para no inventar nada es peor que un hueco.

## 4 · Estado del ticket

**Finalizada / Listo.** El censo existe, corre y trae su suelo sembrado con los tres casos.

## 5 · 🔴 LO QUE NO SE PUDO RECONSTRUIR

1. **Cuántas tautologías encontró el censo.** El asunto nombra **una** (`scrum587`) y el cuerpo
   habla del suelo, pero **la cifra total no está en el commit** ni en ningún fichero del árbol.
2. **Qué pasó con la de `scrum587`.** El ticket dice que sólo se convierte en ticket la que tenga
   víctima hoy. **No consta** si se arregló, si se abrió ticket o si se dejó en la lista.
3. **La lista que el ticket manda guardar «dentro del censo».** Si existe, no se localiza como
   fichero propio; podría estar dentro del test, pero afirmarlo exigiría leer el test entero y
   atribuirle una intención que su autor no escribió.
4. **La fuente del tercer caso de siembra** (el extractor de PDF): el propio commit dice que **no
   está en el árbol** y que por eso va como reconstrucción.
5. **Por qué entró sin rama propia**, dentro de un PR de `scrum-637`.

## 6 · Lo NO tocado

Ni una línea de código ni de tests. Esto es **sólo el registro que faltaba**.
