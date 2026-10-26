# SCRUM-1610 · un hijo sale con su código correcto y la salida CORTADA: rojos falsos en el obligatorio

## J6 · SCRUM-1610 · medición y propuesta (nada construido)

**Medido contra:** `origin/main` = `f94908a532b9768abbf9ea7bd395a401c10d3a3b` · 2026-10-26T22:29:13Z (hora de GitHub; sesión J6 `jv-j6cu`, por encargo del orquestador `cobroflash-backend-8b`. Detalle y tablas en Jira, SCRUM-1610 c.20951)

A9: aviso → A10 «Antes de llamar mecanismo a lo que has visto, di sobre cuántos elementos lo mediste: un instante no es un régimen.» — no se pudo comprobar: con tres cortes (162-186 líneas) leí una cota por escrituras y no por bytes; el cuarto y el quinto (173 y 219) ensancharon la banda y la dejé como hipótesis. Ningún instrumento separa una banda de n=3 de un régimen

Sólo docs y una sonda en `docs/master/evidencias/SCRUM-1610/`. Ningún cambio en `src/`, en un test ni en una aserción.

**Cinco cortes, en el log del intento 1** (logs de unos 2,2 MB, bajados con `--allow-escape-sequences`):

- #2889 · scrum765 · 16.841 B · 171 líneas.
- #2894 · 1516c · 18.359 B · 162 líneas.
- #2892 · 1516c · 11.845 B · 186 líneas.
- #2896 · 1516c · 19.876 B · 173 líneas.
- #2899 · 1516c · 14.216 B · 219 líneas.

En los cinco, el código de salida es el correcto: sólo falta la cola. Todos cortan al final de una línea. El mismo hijo sale completo al relanzar (#2892, run 40361196496, intento 2 en verde). Los dos hijos acaban con `console.log` por línea y `process.exit()` (`tests/_censo-frontera.mjs:550`, `scripts/meta-guard-mutaciones.mjs:1692`). Los lectores leen hasta `close`.

**Reproducción local con `sonda-salida-cortada.mjs`:** win32 10.0.26200 · node v24.18.0 · stdout del hijo `Pipe`. Hice cinco lotes de 62 pasadas: con tubería y con fichero, en paralelo 1 y 5, con el lector ocupado 0 y 300 ms, y hasta 216 KB de salida. Resultado: **0 cortadas de 300**. El positivo sembrado se cazó 10 de 10.

**El hijo real NO se corrió en bucle.** El meta-guard tarda 45 s por pasada, y el censo de frontera necesita un `dist/` que este árbol no tiene.

**Causa: SIN MEDIR en Linux**, porque aquí no hay WSL ni Docker y un workflow no es de este carril. La hipótesis es ésta: en Windows el stdout que va a una tubería es bloqueante, y en Linux no lo es. Así, en Linux, si el lector no drena a tiempo, `process.exit()` tira la cola. Queda sin explicar por qué se llena con menos de 64 KB.

**Propuesta ✅/❌:**

1. En el hijo, salir con el stdout ya vaciado (`process.stdout.write('', () => process.exit(c))`).
   - `_censo-frontera.mjs` → J6.
   - `meta-guard-mutaciones.mjs` → S3, va a Luis.
2. En el lector, exigir el centinela final antes de afirmar nada. Si falta, se relanza una vez y, si sigue faltando, cae como «CIEGO · salida cortada».
   - `scrum1516c` → J6.
   - `scrum765` → sin fila.
3. Medirlo en el runner, con un workflow (S5 o el fundador).

Suite entera local: NO CORRIDA.
