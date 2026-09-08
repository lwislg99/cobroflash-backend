# Afirmaciones del orquestador, pasadas por la Sesión 0

La regla: **todo lo que el orquestador escriba como HECHO sobre el código pasa por la Sesión 0
antes, o se escribe como PREGUNTA.**

Este fichero es el mecanismo, no el buen propósito. Sin él la regla es una intención; con él, cada
afirmación deja rastro y la siguiente se puede comprobar con un comando que ya está escrito.

## Cómo se usa

1. El orquestador va a escribir algo como hecho sobre el código → lo manda a la Sesión 0.
2. La Sesión 0 lo mide y añade una fila: **lo que se afirmó · lo que se midió · el comando exacto**.
3. Si no hay comando que lo mida, no es un hecho: es una pregunta, y se escribe como pregunta.

⚠️ La tercera columna es la que hace que esto valga. Una fila sin comando reproducible es una
opinión con dos columnas de adorno. Y el comando se escribe **entero y pegable**, no descrito.

⚠️ Y los números caducan. La columna del medio dice lo que se midió **el día que se midió**; el
comando es lo que permite volver a preguntarlo hoy. Cuando los dos discrepan, no es que la fila
esté mal: es que el árbol se movió, y ése es justo el dato.

## Las nueve que ya conocemos

Sembradas el 8-sep-2026 sobre `origin/main` = `da5ac06a`. Las marcadas **[re-medido hoy]** se han
vuelto a correr al escribir esta tabla; las marcadas **[del registro]** se conservan con su comando
pero **no** se han vuelto a medir — y eso se dice en vez de callarlo.

| lo que se afirmó | lo que se midió | comando exacto |
| --- | --- | --- |
| «171 llamadas a git» | **71**. Se contaba TEXTO, no llamadas. **[re-medido hoy: 201]** — el número está vivo y crece; lo que no cambia es que hay que contar llamadas, no menciones | `node --input-type=module -e "const {censarReferenciaMovil}=await import('./tests/_censo-referencia-movil.mjs'); const c=censarReferenciaMovil(process.cwd()); console.log(c.llamadas)"` |
| «cuatro sitios del atajo N» | **seis**. **[re-medido hoy: 6]** | `node scripts/verificacion-s5/kbd-en-botones-de-crear.mjs` |
| «el NIF se imprime en el PDF» | **no se imprime**. **[del registro]** — hoy `pdf.service.ts` nombra `taxId` 8 veces, pero son declaraciones de tipo y el flag `docFields.taxId`: **nombrarlo no es imprimirlo**, y eso se decide leyendo el texto del PDF generado, no el fuente | `node --test tests/scrum604-desglose-en-el-pdf.test.mjs` (usa `tests/_texto-del-pdf.mjs`, que lee el TEXTO real del PDF y no su tamaño en bytes) |
| «SCRUM-724: hay que decidir los 44 px» | **el ticket no existía**: ya estaba decidido en SCRUM-352. **[del registro]** | `git log --oneline --grep="SCRUM-724" origin/main` y `ls tests/ \| grep 352` |
| «SCRUM-822: main está rojo» | **main estaba verde**: 5909 tests, 0 fail, `exit 0` — más 48/48 del banco `LIBRO_PG_URL` que CI sí corre. El 404 que se vio era real, pero **de un worktree con un punto en la ruta** (`.claude/worktrees/…`), no de la landing | `git checkout --detach origin/main && npm run build && node --test --test-force-exit tests/*.test.mjs` |
| «la tabla ocupa 730 px» | **978**. **[del registro]** — una caja CSS no es lo que ocupa: hay que medir el DOM ejecutado | `node scripts/censo-objetivo-tactil-panel.mjs` (mide sobre el navegador, no sobre la hoja de estilos) |
| «faltan los objetivos táctiles» | **ya estaban hechos** (SCRUM-720d). **[del registro]** — hoy el guard declara 15 excepciones con su motivo, que es distinto de «faltan» | `grep -c "sel: 'BUTTON" scripts/guard-objetivo-tactil.mjs` y `npm run guard:objetivo-tactil` |
| «el auto-merge falla por el conflicto» | **fallaba por permisos**. **[del registro]** — no se puede medir desde aquí: hace falta el log del workflow | `gh run list --workflow=pr-automatico.yml` — ⚠️ **`gh` NO está instalado en este entorno**, así que esta fila queda declarada como NO verificable localmente |
| «Jira no funciona en Visual» | **sí funciona**. **[re-medido hoy]** — el MCP de Atlassian ha contestado en esta misma sesión sobre `cloudId 30938fdf-…` | consulta JQL por el MCP de Atlassian; sin MCP, `docs/equipo/00-normas-comunes.md` no promete otra vía |

## Lo que estas nueve tienen en común

Ninguna es una mentira: **todas empiezan en una observación real**. Lo que falla es el paso
siguiente — convertirla en diagnóstico y escribirla como hecho sin el comando que la sostenga.

Cinco de las nueve se habrían cazado en dos minutos con un comando de una línea. Ése es el coste
de la regla, y por eso la regla es barata.

> 🔒 Contar texto no es contar cosas · una caja CSS no es lo que ocupa · nombrar algo no es
> imprimirlo · un rojo en tu árbol no es un rojo en main.
