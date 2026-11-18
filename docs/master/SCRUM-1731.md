# SCRUM-1731 · La línea «Mutaciones:» entra en la A3, y el guard de la A9 la comprueba

**Medido contra:** `origin/main` = `6881a0d27e8b4e337bd55175c3068791c8304c69` · 2026-11-18T07:43:02Z
**Sesión:** S0 (consultoría, dueña de las normas comunes), worktree `s0-18nov`, rama `scrum-1731-norma-mutaciones-a3`.

**Autoridad.** Redacción de S0 en c.21965 (versión ACOTADA de la propuesta del equipo J), firmada por el
equipo de Luis por la delegación general (SCRUM-1656 c.21978) en c.21980, y **acuse del jefe J en c.21999**
(18-nov, ~06:00 Madrid): acepta la versión acotada literal, incluido el cambio de su punto (c).

**Qué entra.**
- `docs/equipo/00-normas-comunes.md`, A3: la viñeta firmada, LITERAL, con la nota de firma, acuse y corte.
- `tests/scrum1294-a9-leccion-en-a10.test.mjs`: el guard de la A9 valida la línea cuando EXISTE, en los
  tramos con ancla desde el 2026-11-18. `catálogo → <test>`: el test existe y declara al menos una mutación
  completa en `MUTACIONES_QUE_ME_TUMBAN`, leída por AST con `mutacionesDeclaradas` del meta-guard (no por
  texto). `una vez → <guion>`: el guion está en `git ls-files` (si git no contesta, el guard sale CIEGO y
  rojo, no verde). Ruta con o sin comillas invertidas, porque la norma firmada la escribe `→ <test>`. Una
  línea `Mutaciones:` sin una de las dos claves no es «la línea»: no la ve el guard; la ve quien cierra.

**Premisa medida antes de escribir la norma.** La redacción firmada dice «lo comprueba el guard de la A9
cuando la línea existe». En `origin/main` 6881a0d2, el guard de la A9 NO miraba ninguna línea
`Mutaciones:` (grep de `Mutaciones:` y `MUTACIONES_QUE_ME_TUMBAN` en él: 0). Escribir la norma sin ampliar el
guard la hacía falsa el día de su entrada; por eso van en el mismo PR. El guard es de S0 (SCRUM-1294).

**Barrido (A23 ①).** `docs/master/` tenía ~20 líneas que empiezan por «Mutaciones:», todas en prosa libre
(«6 de 6 caen…»), ninguna con la clave: ninguna cae. La de `docs/master/SCRUM-1743.md` (equipo J, de hoy, cuyo
encargo exige la línea) tampoco lleva la clave: no rompe nada, pero **no cuenta como evidencia al cerrar**.
Se avisa al orquestador para el canal con el equipo J; no es de este carril corregirla.

**Población (salida del guard):** 1312 registros · 2591 anclas · 1207 desde 2026-09-30 · Mutaciones desde
2026-11-18: 0 catálogo, 0 una vez antes de este registro (hacia adelante: arranca en cero, y lo que lo prueba
es el control positivo y el rojo real de abajo).

Mutaciones: una vez → `docs/master/evidencias/SCRUM-1731/mutar.mjs`
(inyecta cada línea en ESTE registro, corre el guard, restaura por bytes; base sin mutar primero.
Resultado en la sección «Rojo real», abajo.)

A9: comprobación → `tests/scrum1294-a9-leccion-en-a10.test.mjs`
