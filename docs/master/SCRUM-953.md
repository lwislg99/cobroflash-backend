# SCRUM-953 · `instalar.mjs` no entrecomilla la ruta del statusLine

**Fecha:** 22-sep-2026 10:02Z · **Carril:** S5 · `scripts/equipo/**`
**Medido contra:** `origin/main` = `5588e3263847bd40ea906d325e4f83c883c24e6e` · 2026-09-22T08:02Z
**Rama:** `scrum-953-statusline-comillas` · **Worktree:** `wt-s5-953`

## ① El defecto

`lineaStatusLine()` (`scripts/equipo/instalar.mjs:82-85`) generaba `command: "node ${uso} escribir"`
sin comillas. En un usuario de Windows con espacio (`C:/Users/Javier Pereira/…`, medido por el equipo
de Javier) Claude Code corta la orden en el espacio y ejecuta `node C:/Users/Javier`, que no existe:
el statusLine nunca arranca y no hay error visible en ningún sitio — `uso.json` sencillamente no se
crea. `arranqueCmd()` y `ordenesSchtasks()` ya entrecomillaban `destino`/`repo`; sólo faltaba aquí.

## ② El arreglo

`command: \`node "${uso}" escribir\`` — una comilla a cada lado de la ruta.

## ③ Medido

- `tests/scrum951a-equipo-configurable.test.mjs`: 18 pass · 0 fail (antes 17 con la aserción vieja
  sin comillas; se corrigió la aserción del test A2 para exigirlas).
- **Caso nuevo con espacio** (lo que ningún test cubría: la máquina de Luis, `C:/Users/Admin`, no
  tiene espacios): `lineaStatusLine('C:/Users/Javier Pereira/AppData/Local/yaqu-equipo')` →
  `node "C:/Users/Javier Pereira/AppData/Local/yaqu-equipo/uso.mjs" escribir`.
- **Control positivo**: una ruta sin espacio también sale entrecomillada (no depende de detectar el
  espacio).
- **Mutante**: revertido el arreglo → 16 pass · 2 fail en el mismo fichero. Restaurado, vuelve a 18/0.

## ④ Lo que no cubre

`arranque.cmd` y `ordenesSchtasks()` no se tocan: ya entrecomillaban `${r}`/`${d}`/`${cmd}` (revisado,
no medido con un caso de espacio aparte — el riesgo ya estaba cerrado en el código, no en el test).
El punto 3 del ticket (que `comprobar-instalacion.mjs` distinga «sin configurar» de «configurado pero
no arranca») queda sin hacer: el ticket lo pedía como opcional («si se quiere») y no formaba parte del
defecto medido.
