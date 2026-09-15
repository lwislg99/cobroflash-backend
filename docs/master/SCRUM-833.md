# SCRUM-833 · `scrum637:164` mide el ENVASE y está a cuatro ramas de caer

**Fecha del expediente:** 15-sep-2026 · **Carril:** instrumentos · cola de PRs · **Gate:** ⚠️ **RECONSTRUIDO A POSTERIORI**

**Medido contra:** `origin/main` = `289cbf41141fd6f6ae018324879e11b7f4a8ff54` · 2026-09-15T13:50:49Z
**Sha real del merge que entró sin expediente (SCRUM-267):**
`ee13c63f6d904fed6abda667db4e96fab4e24e93` — PR #1204, 2026-09-09T08:11:36Z,
rama `scrum-637-verificacion-s5`
**Rama de esta reconstrucción:** `scrum-858-expedientes-de-los-cinco`

---

> # ⚠️ ESTE EXPEDIENTE NO LO ESCRIBIÓ QUIEN HIZO EL TRABAJO
>
> Lo escribe la sesión que lo encontró en el censo de **SCRUM-857**, seis días después. Todo está
> **derivado del árbol y de Jira**. **No se reconstruye ninguna medición que no se pueda verificar
> hoy, ni se inventa ningún rojo.** Lo que no se pudo saber está en el **§5**.

---

## 0 · Una fase, y sin rama propia

**Una sola fase**, medida sobre toda la historia de `main`. Entró dentro de un PR de
`scrum-637-verificacion-s5` — invisible para el guard de SCRUM-854.

## 1 · Qué dice el ticket (fuente: Jira, leído el 15-sep-2026)

**Tipo:** Error · **Prioridad:** Medium · **Estado:** **Finalizada / Listo** · creado 2026-09-09.

**De dónde sale**, citado: Javier, al cerrar SCRUM-804 — *«Queda uno con la misma forma,
`scrum637:164`, a 4 ramas de caer. Cuando caiga volverá a frenar todos los PR igual.»*

**El mecanismo, ya conocido:** el guard tenía por población **ramas concretas del remoto**. El
autoborrado al mergear se llevó ~390 ramas y, al desaparecer los sujetos, **el control positivo se
quedó sin nada que interrogar**, así que el guard se pone rojo con el sistema sano. Y como CI
prueba la FUSIÓN, un rojo en `main` lo hereda cada PR abierto: **se para todo**. Ya había pasado:
26 PRs parados durante dos días.

> 🔒 **«Si el borrado de una rama puede cambiar tu medición, no estabas midiendo el trabajo:
> estabas midiendo el envase.»**

**La forma que ya había ganado** y que el ticket manda copiar, no reinventar: anclar a
`git log --merges` (que sobrevive al borrado) y **derivar los umbrales del árbol**.

**Por qué ese día y no el lunes:** la mecha eran cuatro ramas con seis sesiones mergeando —
*«cuatro merges es una mañana normal»*.

**La regla que nace de aquí, y ya está escrita: A12** — antes de cambiar una población (ramas,
ficheros, tablas, filas) se censa qué guards miden sobre ella.

## 2 · Qué entró en `main`, derivado de `git log`

**7 ficheros** (PR #1204): `tests/scrum637-la-rama-que-nadie-mira.test.mjs`,
`tests/scrum723-guard-contra-su-base.test.mjs`, y cinco de `docs/equipo/`.

Del mensaje del commit, citado:

> **SE COPIA LA FORMA QUE GANÓ, no se inventa una tercera:** `git log --merges` como población
> (permanente, sólo puede crecer) y umbrales derivados del árbol. Es la de Javier en SCRUM-804, y
> **dos formas distintas para el mismo problema es como nace la próxima contradicción**.

Y el asunto añade un hallazgo que **no estaba en el ticket**: *«y el censo encontró un tercero
dentro»* — el commit dice **«TRES COSAS, y sólo la primera estaba en el ticket»**, siendo la
primera el umbral `dentro.length > 10` sobre ramas vivas ya mergeadas.

## 3 · Lo único que esta sesión ha medido por su cuenta (15-sep-2026)

```
node --test tests/scrum637-la-rama-que-nadie-mira.test.mjs tests/scrum723-guard-contra-su-base.test.mjs
```

→ **26 pass · 0 fail · `# skipped 0`**

Los dos guards que tocó esta fase corren hoy y pasan. **Medición mía y de hoy.** Dice que siguen
vivos; **no** dice que la población ya no dependa de ramas vivas — eso exigiría leer su criterio y
es afirmación del autor, no mía.

## 4 · Estado del ticket, y el rastro que sí se puede seguir

**Finalizada / Listo.** Y hay una confirmación indirecta que vale la pena dejar escrita: la
**definición de hecho** del ticket pedía un control positivo que siguiera midiendo con la población
reducida. Seis días después **la cola de PRs no se ha vuelto a parar** por este guard — no es una
prueba de que el arreglo sea correcto, pero sí es el hecho observable que el ticket buscaba.

Además, el ticket de **SCRUM-838** (censado el mismo día) usa **este caso como siembra nº ①** de su
censo de tautologías: *«`dentro ∩ fuera === []`, complementarios por construcción»*. O sea, de aquí
salió además un hallazgo que fundó otro ticket.

## 5 · 🔴 LO QUE NO SE PUDO RECONSTRUIR

1. **Las otras DOS de las «tres cosas»** que el commit dice haber hecho. El cuerpo enumera la ①
   (el umbral del ticket) y el resto del mensaje no llegó a citarse entero en ningún fichero del
   árbol. **No se reconstruyen de memoria.**
2. **El control positivo con la población reducida.** El ticket lo exigía como definición de hecho
   («borra ramas a propósito y el guard sigue midiendo»). **No consta su ejecución** en el árbol.
3. **El censo del tercer guard de la misma familia** que el ticket pedía, y su suelo. El asunto
   dice «el censo encontró un tercero dentro», pero **cuál era y qué se hizo con él, no consta**.
4. **Si `scrum637:164` sigue siendo la línea 164.** Las coordenadas caducan (SCRUM-513) y no se
   re-ancla aquí: afirmarlo exigiría comprobar qué hay hoy en esa línea y atribuirle identidad.
5. **Por qué entró sin rama propia**, dentro de un PR de `scrum-637` — que es, además, el guard que
   venía a arreglar.

## 6 · Lo NO tocado

Ni una línea de código ni de tests. Esto es **sólo el registro que faltaba**.
