# SCRUM-722 · «Válido hasta» por defecto y el atajo de 30 días pueden dar días DISTINTOS — más dos hallazgos del mismo módulo

**Fecha del expediente:** 15-sep-2026 · **Carril:** presupuestos · esquema · **Gate:** ⚠️ **RECONSTRUIDO A POSTERIORI**

**Medido contra:** `origin/main` = `289cbf41141fd6f6ae018324879e11b7f4a8ff54` · 2026-09-15T13:50:49Z
**Shas reales de los merges que entraron sin expediente (SCRUM-267):**

| fase | merge | PR | rama | fecha |
|---|---|---|---|---|
| 1 | `d7db9499ca9322da9cc414ecd40ac4777e1996e3` | #1140 | **`scrum-722-marcadores-a-la-vista`** (propia) | 2026-09-07T17:53:48+02:00 |
| 2 | `855562acee8879f9714d0d3114c3ba6a0b5bc0e7` | #1143 | `scrum-818-parte-de-trabajo` (ajena) | 2026-09-07T18:05:20+02:00 |

**Rama de esta reconstrucción:** `expedientes-de-los-cinco-15sep`

---

> # ⚠️ ESTE EXPEDIENTE NO LO ESCRIBIÓ QUIEN HIZO EL TRABAJO
>
> Lo escribe la sesión que lo encontró en el censo de **SCRUM-857**, ocho días después. Todo está
> **derivado del árbol y de Jira**. **No se reconstruye ninguna medición que no se pueda verificar
> hoy.** Lo que no se pudo saber está en el **§6**.

---

## 0 · 🔴 DOS fases, y este ticket es el raro de los cinco

**La fase 1 tuvo RAMA PROPIA** (`scrum-722-marcadores-a-la-vista`, 13 ficheros). Eso lo separa de
los otros cuatro: **el guard de SCRUM-854 SÍ habría cazado esa fase** —rama con número, toca
código, sin entrada— y aun así entró. El guard llegó después.

La fase 2 viajó dentro de `scrum-818-parte-de-trabajo`, y ésa sólo la ve el criterio de SCRUM-857.

### Y es la misma pieza vista por los dos lados

**El PR #1143 es uno de los dos «verdes falsos literales» de mi propio censo de SCRUM-857**: aquel
PR traía su entrada `docs/master/SCRUM-818.md` en regla, así que el criterio viejo lo daba por
bueno — y llevaba dentro este commit de la 722, sin entrada. Allí fue el **caso de prueba** que
demostró el defecto del guard; aquí es **el expediente que faltaba**. Las dos mitades del mismo
hecho, y conviene que cada una nombre a la otra.

## 1 · Qué dice el ticket (fuente: Jira, leído el 15-sep-2026)

**Tipo:** Error · **Prioridad:** Medium · **Estado:** **Finalizada / Listo** · creado 2026-09-04.
**Origen:** tres hallazgos fuera de carril de S1 al cerrar SCRUM-605.

**🔴 1 · Dos caminos calculan la misma fecha y pueden discrepar.** El valor por defecto usa
`Date.now() + 30*86400000` y `toISOString()`; el atajo de 30 días usa el motor de
`quoteAtajosVencimiento.js`. **En un cambio de hora pueden dar un día distinto.**

> **La víctima:** un profesional abre un presupuesto, ve una fecha por defecto, pulsa «30 días»
> esperando confirmarla — **y la fecha cambia**. No hay error, no hay aviso.

Y la evidencia que el ticket exige si se arregla: *«un caso en el cambio de hora de octubre y otro
en el de marzo. Si el test pasa en junio y en diciembre, no ha probado nada.»*

**2 · `atajoPorDebajoDelMinimo`: construido, probado y sin cablear.** Defecto nº 2 de la casa
—«construido ≠ alcanzable»— en su variante cara: sus tests están en verde, así que el mecanismo
**parece** vivo.

**3 · `expiresAt @map("vencimiento")` de `Charge` ocupa el nombre que tendría la factura.** Quien
busque «vencimiento» en el esquema puede creer que la factura ya lo tiene. No es hipotético: el
asesor estuvo a punto de darlo por hecho. **No se renombra** (columna con datos en tres bases): lo
barato es **documentarlo donde se busca**.

## 2 · Qué entró en `main`, derivado de `git log`

### Fase 1 · PR #1140 — el censo de marcadores sobre lo PINTADO

13 ficheros, entre ellos `scripts/guard-marcadores-en-pantalla.mjs`,
`public/dashboard/js/atajoNuevo.js`, `tests/scrum402-marcador-no-se-pinta.test.mjs` y
`docs/microcopy/2026-09-07-SCRUM-722-nuevo-albaran.md`.

Citado de su commit:

> El de albaranes estuvo **tres días en pantalla** y lo encontró de rebote un barrido que medía
> otra cosa. La pregunta que valía era **por qué no lo vio ninguno de los guards que teníamos**, y
> la respuesta está medida: eran **CUATRO y ninguno mira ese eje**. Tres censan el FUENTE y son
> trinquetes, así que ese marcador estaba contado y permitido; el único que mira el DOM declara en
> su propia constante que cubre dos ficheros.

El censo nuevo va **sobre el DOM renderizado**, no sobre el fuente.

### Fase 2 · PR #1143 — el hallazgo ③ del ticket, resuelto como se dijo

7 ficheros, y el cambio propio es un comentario junto a `expiresAt @map("vencimiento")` en
`prisma/schema.prisma`. Citado:

> Vive AHÍ y no en un `.md` porque **quien se confunde está mirando ese fichero**: la columna se
> llama «vencimiento», es del COBRO, y `Invoice` NO tiene campo de vencimiento —medido en
> SCRUM-605—.
>
> **COMPROBADO QUE NO ABRE EL ORDEN ①②③, no supuesto:** regenerado el cliente y corrido
> `scripts/generar-sql-deriva.mjs` — **426 columnas, y `docs/sql/deriva-prod.sql` NO cambia**. Un
> comentario no toca el DDL.

Eso último importa: tocar `prisma/schema.prisma` es del fundador y abre el orden ①②③; el autor
**midió** que un comentario no genera DDL en vez de suponerlo.

## 3 · Lo único que esta sesión ha medido por su cuenta (15-sep-2026)

```
node --test tests/scrum402-marcador-no-se-pinta.test.mjs
```

→ **7 pass · 0 fail · `# skipped 0`**

**Medición mía y de hoy.** Dice que el guard de la fase 1 sigue vivo.

> ⚠️ **Error propio, y es el SEGUNDO de la misma forma en esta tanda:** este párrafo se escribió
> con «9 pass» **antes de ejecutar el test**. Son **7**. El mismo desliz ocurrió en
> `docs/master/SCRUM-838.md` (escrito «9», medido **3**). **No es un despiste, es un patrón:**
> redactar la cifra de una ejecución que aún no se ha hecho. Los dos se corrigieron al correr los
> tests, y el quinto expediente de esta tanda se escribió con el test ya ejecutado delante.
>
> Queda anotado porque una cifra inventada dentro de un expediente cuyo valor entero es *no
> inventar nada* lo invalidaría por completo.

## 4 · 🔴 Un hallazgo del ticket que NO se ve cerrado en estas dos fases

Las dos fases cubren el **censo de marcadores** (que no está en el enunciado del ticket) y el
hallazgo **③** (el comentario en el esquema). **Del hallazgo 🔴 1 —los dos caminos que calculan
«Válido hasta» y pueden discrepar en un cambio de hora— no hay rastro en el árbol dentro de estas
fases**, ni del hallazgo **2** (`atajoPorDebajoDelMinimo` sin cablear).

El ticket está **Finalizada / Listo** en Jira.

> ⛔ **Lo digo y paro, como manda el encargo: no reabro nada.** Puede que el 1 y el 2 se cerrasen en
> otro ticket, o que se decidiera no hacerlos. **No consta** — y cerrar o reabrir es del fundador.
> Lo que sí consta es que el hallazgo 1 tenía víctima descrita y una condición de evidencia muy
> concreta (octubre y marzo), y que esa evidencia no está en estas dos fases.

## 5 · Lo NO tocado

Ni una línea de código ni de tests. **Ni `prisma/schema.prisma`**, que además es del fundador.

## 6 · 🔴 LO QUE NO SE PUDO RECONSTRUIR

1. **Si los hallazgos 1 y 2 se hicieron, y dónde.** Ver §4. No se deduce del árbol.
2. **La cifra del censo de marcadores.** El commit dice «26 vistas derivadas del…» y la frase
   queda cortada en lo que se pudo citar; **el número final de marcadores encontrados no consta**
   en ningún fichero localizable.
3. **Los rojos de la fase 1.** El guard nuevo debía tener su control; **su ejecución no está en el
   árbol** y no se reconstruye.
4. **Por qué la fase 2 viajó en `scrum-818`** teniendo este ticket rama propia dos PRs antes.
5. **Quién cerró el ticket y con qué criterio**, con el hallazgo 1 sin rastro.
