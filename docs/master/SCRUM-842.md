# SCRUM-842 · Revisión ADVERSARIA de los guardianes que dejan a un robot tocar el repositorio solo

**Fecha del expediente:** 15-sep-2026 · **Carril:** proceso · seguridad del bucle · **Gate:** ⚠️ **RECONSTRUIDO A POSTERIORI**

**Medido contra:** `origin/main` = `289cbf41141fd6f6ae018324879e11b7f4a8ff54` · 2026-09-15T13:50:49Z
**Shas reales de los merges que entraron sin expediente (SCRUM-267):**

| fase | merge | PR | fecha |
|---|---|---|---|
| 1 | `2484eee73462e6b4be69ee0b15343075a5a606dc` | #1227 | 2026-09-09T14:44:39Z |
| 2 | `19215875cc8100cbade1666767e6225da8d5c70c` | #1229 | 2026-09-09T15:03:44Z |
| 3 | `5c35a66d5752bf4f28c5dca340379c68c860757e` | #1234 | 2026-09-09T15:19:47Z |

**Rama de esta reconstrucción:** `expedientes-de-los-cinco-15sep`

---

> # ⚠️ ESTE EXPEDIENTE NO LO ESCRIBIÓ QUIEN HIZO EL TRABAJO
>
> Lo escribe la sesión que lo encontró en el censo de **SCRUM-857**, seis días después. Todo está
> **derivado del árbol y de Jira**, y cada afirmación dice de dónde sale. **No se reconstruye
> ninguna medición que no se pueda verificar hoy, ni se inventa ningún rojo.** Lo que no se pudo
> saber está en el **§5**, con su nombre.

---

## 0 · 🔴 TRES fases, no una

**Ninguna de las tres tuvo rama propia:** las tres entraron dentro de PRs de `scrum-637-verificacion-s5`.
Por eso el guard de SCRUM-854 no podía verlas —derivaba el ticket del nombre de la rama— y sólo
las destapó el criterio de SCRUM-857, que mira también el asunto de los commits.

## 1 · Qué dice el ticket (fuente: Jira, leído el 15-sep-2026)

**Tipo:** Error · **Prioridad:** Medium · **Estado:** **Finalizada / Listo** · creado 2026-09-09.

> «Revisión adversaria de los guardianes que deciden si un robot puede tocar el repositorio solo:
> la puerta de forks del avisador, el filtro del camino fiscal, y el vigía. Los escribió una sola
> sesión y nadie más los ha mirado.»

**Por qué entonces:** ese mismo día se midió que `claude.yml` **arrancaba solo, disparado por el
bot, siete veces en media hora**. Esos tres guardianes eran lo único entre eso y el repositorio, y
los había escrito y probado la misma sesión — *un guardián revisado sólo por quien lo escribió está
probado contra los casos que su autor imaginó*.

**El método que el ticket fija:** ⛔ no se reescriben (regla 9). Se **intenta pasarlos**, y cada
intento que PASE es un hallazgo. Más un **suelo obligatorio**: si ningún intento pasa, hay que
sembrar un guardián flojo y demostrar que el método lo cazaría.

## 2 · Qué entró en `main`, derivado de `git log`

### Fase 1 · PR #1227 — «intenté pasar la puerta 11 veces y no pasa ninguna»

Fichero: `scripts/verificacion-s5/intentar-pasar-la-puerta.mjs`. Citado de su commit:

```
LA PUERTA REAL CIERRA LOS ONCE, y por el codigo correcto en cada eje:
  CI vacio / unknown / null  -> SIN-ROJOS
  fork declarado / repoOrigen null / repoBase null -> FORK-NO-DESPIERTA
  permiso vacio / unknown / read -> AUTOR-SIN-ESCRITURA
  «yaqu-bot» sin los corchetes  -> AUTOR-SIN-ESCRITURA
```

Y dice explícitamente *«NO LA ARREGLO (regla 9): la pruebo desde fuera y en contra. El banco se
sube porque el scratchpad es efímero»*.

### Fase 2 · PR #1229 — 🔴 el hallazgo: la puerta fiscal dejaba pasar `src/modules/fiscal/`

Fichero: `docs/equipo/sesion-0.md`. Su commit empieza por lo que **sí** funcionaba —los tres
ataques que pedía el orquestador quedaron cazados: fichero nuevo dentro de `invoicing/`,
`verifactu.service.ts` movido, y ruta relativa— y luego reporta el que **no**:

> **la puerta fiscal deja pasar los 20 ficheros de `src/modules/fiscal/`**

**Ése es el hallazgo que arregló SCRUM-834e** («la puerta fiscal deja de ser una lista y pasa a ser
un censo»), cuyo commit lo describe con la misma cifra de 20 de 20. Las dos piezas encajan, y se
dice aquí porque el expediente de la 834 se reconstruyó el mismo día sin poder citar su origen.

### Fase 3 · PR #1234 — cerrado, y de rebote nace SCRUM-846

Ficheros: `docs/equipo/sesion-0.md` y `scripts/verificacion-s5/censo-instrumentos-sin-caso.mjs`.
El commit cierra la 842 y trae el censo que dio pie a **SCRUM-846** (*«19 de 95 instrumentos pueden
dar un cero que nadie juzga»*), con sus tres intentos fallidos declarados dentro — el primero
contaba TEXTO buscando la palabra «SUELO» y dio 149 de 151, *«el mismo defecto que el ticket
denuncia, cometido al medirlo»*.

## 3 · Lo único que esta sesión ha medido por su cuenta (15-sep-2026)

```
node scripts/verificacion-s5/intentar-pasar-la-puerta.mjs
```

**No se ha ejecutado.** Es un script de ataque contra la puerta del robot y su salida depende de
respuestas de la API de GitHub; correrlo hoy mediría el estado de HOY, no el que el ticket declara,
y presentarlo como evidencia del trabajo original sería confundir dos cosas. **Los ficheros existen
en `main`** (verificado con `git ls-tree`), que es lo que sí se puede afirmar desde aquí.

## 4 · Estado del ticket

**Finalizada / Listo** en Jira, y el commit de la fase 3 dice «SCRUM-842 cerrado». El hallazgo
principal (la puerta fiscal) se trasladó a SCRUM-834e y allí se arregló. **Coherente: este ticket
reportaba, no arreglaba.**

## 5 · 🔴 LO QUE NO SE PUDO RECONSTRUIR

1. **Los once intentos, uno por uno.** El commit da el resultado agregado y los cuatro ejes, pero
   **la salida completa del banco no está en el árbol**: `scripts/verificacion-s5/` guarda el
   script, no su ejecución. Reproducirla hoy mediría otra cosa.
2. **El suelo que el ticket exigía.** Pedía sembrar un guardián flojo y demostrar que el método lo
   cazaría. El commit de la fase 1 no lo menciona. **No consta si se hizo**, y no se afirma que sí.
3. **El tercer guardián: el vigía.** El enunciado nombra tres (puerta de forks, filtro fiscal,
   vigía) y los commits documentan los dos primeros. **Del vigía no hay rastro** en estas tres fases.
4. **Por qué las tres fases viajaron en `scrum-637-*`** en vez de una rama propia. No consta.
5. **Quién cerró el ticket y con qué criterio**, teniendo un hallazgo abierto que tuvo que arreglar
   otro ticket.

## 6 · Lo NO tocado

Ni una línea de código ni de tests. Esto es **sólo el registro que faltaba**.
