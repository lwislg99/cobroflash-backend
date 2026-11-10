# SCRUM-1406 · El límite del plan `trial` al máster (W3bis): el diff exacto, para quien tenga el carril del máster

**Medido contra:** `origin/main` = `6b7b18db9fcbae42fbcb2c90a5795f4b4a7e6780` · 2026-10-23T13:51:36Z (hora de GitHub)
A9: sin fallo que generalice — este tramo sólo prepara un diff; lo que podría salir mal (copiar el literal de mi ficha o de la propuesta y no de la firma) se evitó copiándolo de `c.20516`

J4 (`jv-j4q`, equipo de Javier), 23-oct-2026.

## Lo firmado

- **SCRUM-1406 comentario 20476** (decisión): la prueba gratis se queda en 1 usuario, y se escribe en el máster.
- **SCRUM-1406 comentario 20516** (firma del literal): la opción A de la propuesta `c.20488` (jv-j4p), una línea nueva **W3bis** debajo de W3.
- **SCRUM-1406 comentario 20517** (decisión): la prueba tiene las mismas 300 plantillas de WhatsApp al mes que Pro, y «se escribe en el máster junto a W3bis». ⚠️ **De esta no hay literal firmado**: el comentario da la decisión, no la frase.

El código ya lo cumple: `src/core/entitlements.ts:18`, `trial: { maxUsers: 1, waFairUseMonthly: 300 }`. No hay nada que construir.

## Por qué no lo meto yo

`node scripts/carriles.mjs de docs/YAQU_MASTER.md` → «SIN CERRADURA · `docs/equipo/dos-equipos.md:197` · **un jefe**» (fila `CLAUDE.md`, `.claude/**`, `docs/YAQU_MASTER.md`: «derivados del máster (regla 35); la S0 prepara la propuesta»). El encargo decía: si es de S0 o del fundador, no se toca; se deja el diff.

## El diff (sobre `docs/YAQU_MASTER.md` de `origin/main` arriba citado)

Sitio: Parte W, justo debajo de la línea que empieza por `**W3. Entitlements a IMPLEMENTAR — solo dos:**` (hoy la 1662; el sitio es «debajo de W3», la línea cambia con cada merge).

```diff
 **W3. Entitlements a IMPLEMENTAR — solo dos:** límite de usuarios (1 Pro / 5 Equipo manual) + contador fair-use WA (soft). Todo lo demás = incluido = cero checks.
+**W3bis. La prueba gratis (`trial`) es para 1 usuario. Se prueba solo y el equipo entra al pagar. Decisión del fundador, 23-oct-2026 (SCRUM-1406, comentario 20476).**
```

La línea `+` es la de `c.20516`, copiada de Jira. ⚠️ En `c.20516` la negrita abarca «W3bis. La prueba gratis (» y se cierra antes del `` `trial` `` (es como lo deja Jira al guardar el markdown). Tal cual, en el máster quedaría la negrita partida; lo que he puesto arriba es la línea entera en negrita, como las demás de la Parte W. **Eso es una decisión de forma que no he tomado yo: quien lo aplique elige, y si duda, la copia byte a byte de `c.20516`.**

### Las 300 plantillas (`c.20517`) — PROPUESTA, sin firma de literal

```diff
+La prueba (`trial`) tiene las mismas 300 plantillas de WhatsApp al mes que Pro (W2). Decisión del fundador, 23-oct-2026 (SCRUM-1406, comentario 20517).
```

Iría al final de la misma línea W3bis o en la siguiente. ⛔ **No se aplica sin que el fundador vea esta frase** (es texto nuevo del máster; mismo criterio que `c.20481` en SCRUM-1244: «quien lo construya trae el literal para que el fundador lo vea antes»).

## Lo que queda fuera

- Qué ve el profesional si intenta invitar a alguien durante la prueba (hoy 409 `user_limit`): sin decidir, y es texto nuevo (regla 39). Lo dice `c.20517`.
- `CLAUDE.md` no necesita esta línea (`c.20488`).
- No he tocado el máster, `CLAUDE.md`, el código ni el estado del ticket (A13). No he mirado yaqu.app.

## ② 23-oct: W3bis y las 300 de WhatsApp, APLICADAS al máster (carril un jefe, por encargo)

**Medido contra:** `origin/main` = `a3c13611ed6f078fa7fe5af5882b0b8b2d1b2d3f` · 2026-10-23T14:14:13Z (hora de GitHub)
A9: comprobación → `tests/scrum1572-registro-creado-por-dos-ramas.test.mjs`

J4 (`jv-j4s`, equipo de Javier). Carril «un jefe» (`dos-equipos.md:197`), aplicado por encargo del orquestador `cobroflash-backend-62`: el fundador decidió en `c.20525` («Tú, como jefe») que las líneas las aplique el orquestador de su equipo.

- **W3bis**, debajo de la línea de W3 de la Parte W: copiada **byte a byte de `c.20516`**, con la negrita cerrada antes de `` `trial` `` tal como la guarda Jira. No la he puesto entera en negrita (la propuesta del tramo de arriba): el encargo decía que, en la duda, manda `c.20516`.
- **Las 300 plantillas**, en la línea siguiente: la frase **firmada en `c.20525`** (Javier: «Firmo»), la misma que propuso `c.20522`.
- Diff: `docs/YAQU_MASTER.md` +2 / −0. `CLAUDE.md` no la lleva (`c.20488`).
- El código ya lo cumplía (`src/core/entitlements.ts:18`): no se construye nada.
- Sin mirar: yaqu.app (es texto del máster, no se sirve). No transiciono (A13).
- Error mío: la primera rama, `scrum-1406b-tres-lineas-al-master` (PR #2746), metía las dos ramas de jv-j4q con un merge octopus, y `scrum1572` cayó con «tiene 3 padres». Se rehízo como `scrum-1406c-tres-lineas-al-master`: un solo commit sobre main, con el máster, `CLAUDE.md` y los dos registros idénticos byte a byte a la punta `892791c18caadd600f2518d18df47a5630c06c61` de #2746, salvo esta línea y la `A9:` de este tramo. La cicatriz está en `docs/equipo/cicatrices/J4.md`.
