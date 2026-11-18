# SCRUM-1755

## Fila de §3.4 (S0, rama scrum-1755c-fila-carril-pad) · S3 puede tocar la regla de medida de `scripts/guard-pad-de-firma-cabe.mjs`

**Medido contra:** `origin/main` = `d69ccd51362c2861389ebc632a843e971330b406` · 2026-11-18T08:27:35Z
**Sesión:** S0 (dueña de `docs/equipo/dos-equipos.md`), worktree `s0-1755c`, rama `scrum-1755c-fila-carril-pad`.

**Por qué.** S3 necesita cambiar `scripts/guard-pad-de-firma-cabe.mjs` para SCRUM-1755. El fichero es de S4
(`dos-equipos.md:189`, por SCRUM-1742) y la cerradura `.claude/hooks/carril.mjs` bloquea a S3 sin una fila en
§3.4. **Autoridad:** decisión del orquestador por la delegación general de firma (SCRUM-1656 c.21978), en su
encargo a S0 del 18-nov. El texto de la fila es el del encargo, literal.

**Qué entra.**
- `docs/equipo/dos-equipos.md` §3.4: la fila `scripts/guard-pad-de-firma-cabe.mjs | S3 | SCRUM-1755: cambiar
  sólo la regla de medida (hojas del índice + espera de las caras + LETRA en la salida), sin tocar ningún caso
  ni veredicto | SCRUM-1755`. El fichero sigue siendo de S4.
- `.claude/carriles.json`, regenerado con `node scripts/carriles.mjs generar` (84 filas · 211 reglas · 11
  excepciones; escritos 1, borrados 0).

**Comprobado.** `node scripts/carriles.mjs de scripts/guard-pad-de-firma-cabe.mjs` → S4 (puesto),
`dos-equipos.md:189`, con la excepción para S3 en `dos-equipos.md:268`.

A9: comprobación → `tests/scrum1295-carriles.test.mjs`
