# AGENTS.md — puntero a la constitución, no la constitución

> ## 🔴 QUÉ ES ESTE FICHERO, Y QUÉ NO
>
> **NO es la constitución de YaQu. Es el puntero a la constitución.**
>
> **La constitución viva es `CLAUDE.md`, en la raíz del repo. Ábrelo ANTES de tocar nada:**
> ahí están las 10 reglas duras, el protocolo de sesión AA1, las STOP CONDITIONS, los comandos
> y el mapa del código. **No hay una segunda copia, y no debe haberla.**
>
> **Que este fichero no lleve reglas propias no es un descuido: es el arreglo.**

## Por qué aquí no hay reglas (SCRUM-569, 20-ago-2026)  **[EXISTE]**

Hasta hoy `AGENTS.md` era una **copia** de `CLAUDE.md`. Nació el 29-jun-2026 y **no se volvió a
tocar ni una sola vez** mientras su gemelo recibía **siete commits más**. El resultado, medido:
de sus **64 afirmaciones, 5 eran falsas** — y una de ellas mandaba ejecutar
`npx prisma migrate diff`, que **`CLAUDE.md` prohíbe**, sobre una operación que toca el esquema.
Una sesión que arrancara por aquí recibía instrucciones que la casa prohíbe, sin forma de saberlo.

El máster ya había fijado el camino con este mismo espejo: *«"revisar el espejo" es una
prohibición sin mecanismo, y ya había fallado»*. Por eso `guard-dangerous` dejó de estar
duplicado (SCRUM-176): **una sola implementación, envoltorios finos, y un test que impide que la
copia vuelva.** Esto es lo mismo aplicado a la constitución.

**Si vas a añadir una regla aquí: no. Va en `CLAUDE.md`.** Lo comprueba
`tests/scrum569-agents-es-puntero.test.mjs`, y su razón de ser cabe en una línea: **dos ficheros
de arranque no pueden contradecirse si sólo uno tiene reglas.** Contradecirse deja de estar
vigilado y pasa a ser imposible.

## Lo único específico de Codex, que no está en `CLAUDE.md`  **[EXISTE]**

- **Tooling:** `.codex/config.toml` (MCP Playwright) · `.codex/hooks.json` (PreToolUse) ·
  `.codex/hooks/guard-dangerous.sh`, que **DELEGA** en `.claude/hooks/guard-dangerous.mjs` — no es
  una réplica con su propia copia (SCRUM-176).
- **Skills espejo:** `.agents/skills/` (`yaqu-*` y `impeccable`, esta última de terceros y
  gobernada por hash).
- Donde `CLAUDE.md` diga `.claude/`, léase su equivalente de arriba. **Todo lo demás aplica igual,
  palabra por palabra.**
