# SCRUM-1348 · La asimetría: auditoría rutinaria de cierres contra su aceptación — DISEÑO

**Medido contra:** `origin/main` = `36f1eee354cae549ec30dee009666757345a703b` · 2026-10-01T10:23:39Z

Encargo del orquestador (1-oct). Esto es el **diseño y un piloto medido**. El instrumento no está construido.

## El problema, en una frase

El equipo comprueba al orquestador y nadie comprueba al equipo. Lo que una sesión dice al cerrar no lo mira
nadie de forma independiente. Precedente único: la auditoría de la S0 del 28-sep, 4 de 8 cierres no cumplían.

## Qué pregunta contesta, y cuál no

Un cierre afirma tres cosas distintas. Se comprueban de tres formas distintas, y solo dos son mecánicas.

| lo que afirma el cierre | cómo se comprueba | ¿mecánico? |
|---|---|---|
| **«Está entregado»**: el trabajo entró en `main` y está desplegado | git y `/version` | sí |
| **«Lo dije bien»**: el test que cito existe, corre y está verde | el fichero, la tanda y el CI | sí |
| **«Hace lo que pedía el ticket»**: cada línea de la aceptación se cumple | alguien lee la aceptación y mira el producto | **no** |

La tercera es la que falló el 28-sep, y es la que no se deja automatizar. `censo:alcanzabilidad` (SCRUM-753)
ya lo dejó escrito: ninguna señal distingue «se construyó» de «se construyó LO QUE PEDÍAS».

Por eso la auditoría tiene **dos mitades**: una criba mecánica sobre TODOS los cierres, y una lectura sobre
UNA MUESTRA. La criba no absuelve a nadie: solo decide a quién se lee primero.

## Mitad 1 · La criba mecánica (todos los cierres de la ventana)

Entrada: los tickets que pasaron a «Finalizada» en la ventana. Por cada uno, seis señales:

| señal | qué mira | de dónde sale | qué significa si salta |
|---|---|---|---|
| C1 · sin rastro | ni registro `docs/master/SCRUM-n*.md` ni commit en `main` que lo nombre | git | cerrado sin nada que mirar: va a lectura SIEMPRE |
| C2 · rama fuera | existe `origin/scrum-n-…` sin mergear | `ramas:sin-mergear` (SCRUM-637) | regla 42: no se cierra con la rama fuera |
| C3 · sin desplegar | el commit del merge no está en lo que sirve producción | `vigia:despliegue` (SCRUM-677) | «hecho» que el profesional no puede notar |
| C4 · cita rota | el registro cita un test o una ruta que no existe en `main`, o el test está en la lista de saltados | registro + `# SKIP` del TAP | el «15/15 verde» no se puede reproducir |
| C5 · se declara sin verificar | el ÚLTIMO comentario dice «sin verificar», «queda pendiente verificar» o «falta verlo» (acotado tras el piloto, abajo) | Jira | el cierre dice de sí mismo que no se miró en yaqu.app |
| C6 · sin aceptación | la descripción no tiene aceptación escrita | Jira | no hay contra qué auditar: lo dice, no lo aprueba |

Lo que la criba **reutiliza**: C2 y C3 ya existen. No se escribe un segundo censo de ramas ni de despliegue.

Lo que la criba **no sabe**: C5 es una búsqueda por palabras. Marca candidatos, no culpables. Un ticket limpio en las seis señales **no está aprobado**: solo no está marcado.

## Mitad 2 · La lectura (una muestra)

A quién se lee, por este orden, hasta un tope fijo por pasada (propuesta: **6**):

1. Todos los C1 (sin rastro) y C2 (rama fuera). No son muestra: son defecto de proceso seguro.
2. Los marcados por C5.
3. **Al azar entre los NO marcados**, repartido por puesto: al menos uno por puesto que haya cerrado algo en la
   ventana. El azar sale de una semilla que es la fecha de la pasada, para que otra sesión saque la misma muestra.

El punto 3 es el que da la medida de verdad. Si solo se lee a los marcados, la auditoría mide a la criba, no al
equipo. La cifra que se informa es la de la muestra al azar; la de los marcados se informa aparte.

**Quién lee:** un agente nuevo por cierre, que NO es la sesión que cerró ni el orquestador. Recibe tres cosas y
nada más: la aceptación literal del ticket, el diff de su merge, y cómo mirar producción (la cuenta QA). No recibe
el comentario de entrega: quien lee el «hecho, 15/15» tiende a confirmarlo.

**Qué devuelve:** por CADA línea de la aceptación, uno de tres: `CUMPLE` con su evidencia (ruta y línea, o lo
que vio en yaqu.app), `NO CUMPLE` con lo que vio en su lugar, `NO PUDE MIRAR` con el motivo. Sin evidencia,
la línea cuenta como `NO PUDE MIRAR`, nunca como `CUMPLE`.

**Qué no se puede quitar de aquí:** decidir si lo visto satisface la frase de la aceptación es un juicio. Se
puede abaratar, no eliminar. Y un `NO CUMPLE` del lector es una hipótesis: lo confirma la S0 antes de reabrir.

## Población y fail-closed

Cada pasada imprime, antes de cualquier veredicto:

    cierres en la ventana: N · cribados: N · marcados: M (C1 a, C2 b, …) · leídos: k (m marcados + a al azar)
    al azar: x de a cumplen TODA su aceptación · no pude mirar: y

Y sale **en rojo, con código 2**, sin dar cifra, en cuatro casos:

- no pudo leer Jira, o la ventana devuelve 0 cierres habiendo merges en `main` en esas fechas (control cruzado:
  los merges de la ventana se cuentan en git, que no depende de Jira);
- algún cierre no se pudo cribar (cribados < N);
- el **canario** no salta: la pasada incluye siempre un cierre que se sabe malo (uno de los cuatro del 28-sep),
  y si la criba y el lector lo dan por bueno, el instrumento no ve y su resultado no vale;
- más de un tercio de las líneas leídas acabaron en `NO PUDE MIRAR`: eso no es una auditoría, es una ceguera.

La cifra nunca se da como porcentaje del equipo. «4 de 8» fue 4 de 8, no «la mitad de los cierres».

## Lo que hace falta para que la lectura sea barata (propuesta de norma, NO aplicada)

Hoy la aceptación es prosa y la entrega es prosa. Emparejarlas cuesta una lectura entera. Propuesta para
`00-normas-comunes.md` (soy la dueña, pero cambia el trabajo de las doce sesiones: lo decide el orquestador):

> Al cerrar, el comentario de entrega lleva una tabla: una fila por línea de la aceptación, y al lado **dónde se
> ve** (ruta del test, o URL y qué se ve en yaqu.app), o `NO HECHO` con a quién se le pasa.

Con eso, tres cosas pasan a ser mecánicas: que haya tantas filas como líneas de aceptación, que cada evidencia
exista, y que ningún cierre lleve un `NO HECHO` (eso es un cierre por efecto, y se parte). Al lector le queda
solo juzgar si la evidencia prueba la línea.

## Quién la corre, cuándo y cuánto cuesta

- **La S0**, una vez por jornada, al arrancar. No la sesión que cerró. No el orquestador, que es parte.
- La criba es un script sin red propia: Jira no tiene credenciales fuera de la sesión, así que la sesión baja los
  cierres con su conector y se los pasa al script en un fichero. Ese paso manual es una costura y se declara: el
  script comprueba que el fichero es de la ventana pedida y que no viene vacío.
- La lectura son 6 agentes. Es el coste real. El tope es fijo para que la auditoría no se coma la jornada.
- Salida: UNA tabla, en UN documento que se actualiza (`docs/equipo/auditoria-de-cierres.md`), con la fecha.

## Lo que este diseño NO resuelve

- No audita los tickets del equipo de Javier salvo que su orquestador lo pida: el canal es Jira (§5).
- No ve un cierre correcto de un ticket mal planteado. Eso es de quien escribe la aceptación.
- **No mide si alguien LEYÓ la señal.** Es un límite, no un olvido. Medido por S3 el 1-oct sobre seis PR suyos
  en rojo: ninguno era solo podredumbre; cinco traían fallo propio desde que nacieron, tres por la misma causa,
  y el guard que la detectaba (`scrum273`) estaba en rojo desde el primer día. La señal existía y funcionaba;
  nadie la miró. Esta auditoría puede decir que un cierre tiene su check en rojo. No puede decir si quien cerró
  lo vio. Lo más cerca que llega: contar cuánto tiempo estuvo un rojo sin que nadie empujara nada.
- A la S0 no la audita nadie. Una pasada de cada cinco debería repetirla otra sesión sobre la misma semilla.

## Piloto de la criba

Medido el 1-oct sobre `36f1eee3` por un agente de solo lectura (no la S0 a mano). Las tres marcas de git las
recomprobé yo contra el árbol; las de Jira (comentarios y descripciones) son suyas y no las he releído.

**Población: 47 cierres** (`statusCategory = Done AND resolved >= 2026-09-29`), los 47 cribados.
Por equipo: 30 de Javier, 12 de Luis, 5 sin etiqueta de área (un ticket lleva dos áreas).

| señal | marcados | sobre | lo que enseñó el piloto |
|---|---|---|---|
| sin registro en `docs/master/` | 2 (1131, 1203) | 47 | 1203 tiene commit en `main`; solo le falta el registro |
| sin registro NI commit (C1) | 1 (1131) | 47 | su comentario dice que ya estaba hecho bajo otro commit: cierre por duplicado, no trabajo perdido |
| rama fuera de `main` (C2) | 1 (1196) | 47 | **falsa**, medido después (abajo): el contenido entró por otra rama (#2023); queda una rama zombi |
| lenguaje de a medias (C5) | 28 | 41 con comentarios | **ruido**: leídas las citas, unos 6 son de verdad (1135, 1142, 1196, 1216, 1235, 1275) |
| sin aceptación escrita (C6) | 23 | 47 | la mitad de los cierres no tiene contra qué auditarse |

C3 (despliegue) y C4 (cita rota) no entraron en el piloto.

**Lo que el piloto cambia del diseño:**

1. **C5 tal como estaba no sirve.** Marcar 28 de 41 es gritar siempre. «pendiente» casa dentro de
   «independiente» y de `PENDIENTE_MAX`; «falta» casa con «lo que faltaba». Y mirar los dos últimos comentarios
   marca a 1287, que dice «falta verlo» en el penúltimo y «VERIFICADO» en el último. Se acota a UNA forma, en el
   ÚLTIMO comentario y con límite de palabra: «sin verificar», «queda pendiente verificar», «falta verlo».
   Los seis casos reales tienen esa forma: cinco dicen que no se vio en yaqu.app.
2. **Lo más repetido no es «no cumple», es «no lo miré en producción».** Cinco cierres en tres días lo dicen de
   sí mismos. Eso la norma ya lo prohíbe (CLAUDE.md, punto 3) y nadie lo estaba contando.
3. **C6 es el hallazgo grande: 23 de 47 no tienen aceptación escrita.** Sobre esos, «auditar contra su
   aceptación» no significa nada. La auditoría los cuenta aparte y no los da por buenos; la cura está antes, al
   abrir el ticket, y es del que lo escribe.
4. **C1 necesita leer un comentario antes de acusar**: 1131 es un duplicado bien cerrado. La criba lo marca y la
   lectura lo descarta; no se puede ahorrar ese paso.
5. **El coste de la criba es bajo**: una consulta a Jira que trajo los 47 con sus comentarios, y tres llamadas a
   git. Lo caro sigue siendo leer.

**Para repartir hoy, sin esperar al instrumento** (no los decido yo):
- ~~SCRUM-1196: «Finalizada» con un commit fuera de `main`~~ — medido después: no hay trabajo fuera (abajo).
- SCRUM-1135, 1142, 1216, 1235, 1275: «Finalizada» diciendo que no se verificó en yaqu.app.

**Límites del piloto:** tres días, una pasada. No se leyó ninguna aceptación contra el producto: la mitad 2 no
está probada. La cifra «unos 6» sale de 1–2 citas por ticket: es un mínimo leído.

## Decisiones del orquestador (1-oct) y lo que cambian

El dato de 23 de 47 reordena el plan: **el instrumento no es lo primero.** Medir contra una aceptación que
en la mitad de los casos no existe sería construir un medidor para una magnitud que no está.

1. **Un ticket sin aceptación escrita no se reparte.** Escrito en `00-normas-comunes.md` A13.1, en este PR.
2. **La tabla «aceptación → dónde se ve» en la entrega.** Escrita en A8, en este PR. Rige para los seis
   puestos de Luis. Al equipo de Javier se le PROPONE (abajo): no se le impone.
3. **El instrumento se construye después**, en otro ticket, con este diseño. Tres piezas no se tocan: el lector
   NO recibe el comentario de entrega; la cifra que vale es la del AZAR; y el canario.

### Propuesta para el orquestador del equipo de Javier

De los 47 cierres medidos, 30 son de vuestro equipo. No sé cuántos de los 23 sin aceptación son vuestros: el
piloto no cruzó las dos cosas, y no lo supongo. Lo que proponemos es lo que ya nos hemos puesto nosotros:

- que el ticket nazca con su aceptación (qué hay que ver, y dónde se ve);
- que el comentario de entrega lleve una fila por línea de aceptación, con dónde se ve.

Con eso, comprobar un cierre pasa de leer dos textos en prosa a mirar si cada fila tiene un sitio que existe.
Si decís que no, lo aplicamos a los nuestros y os contamos qué midió.

## SCRUM-1196, medido: no hay trabajo perdido — y la criba se equivocó

El piloto marcó 1196 por rama fuera de `main`. Medido después contra el árbol:

- El commit `0ae2be8c` existe. Es de documentación: corrige en `docs/master/SCRUM-1154.md`, en el registro de
  microcopy y en la cabecera de `tests/scrum1154-google-encargado.test.mjs` una afirmación falsa sobre Google
  Fonts. No lleva código de producto.
- Su PR #2013 se cerró **a favor de #2023** (rama `scrum-1154-apendice-google-fonts`), mergeado el 30-sep a las
  22:49Z (`46195e86`). El motivo, en el propio #2013: la rama se llamaba 1196 y llevaba trabajo de 1154.
- El contenido **está en `main`**: el apéndice del 30-sep, las dos correcciones y la cabecera del test salen en
  `origin/main`. Fusionar hoy `0ae2be8c` añadiría 3 líneas a un fichero.
- `fonts.googleapis.com` sale 0 veces en `public/` y `src/` de `origin/main`.

Lo que queda es una **rama zombi** (`origin/scrum-1196-fecha-de-la-politica`), no un cierre malo.

**Lo que cambia del diseño:** C2 medía ANCESTRÍA, y el trabajo puede entrar por otra rama. Antes de acusar,
C2 compara CONTENIDO: si fusionar la rama sobre `main` no cambia nada (o casi), es una rama por borrar, no un
cierre con trabajo fuera. Con esto, las dos marcas «seguras» del piloto (1131 y 1196) eran falsas las dos.
La criba sola no acusa a nadie: todo lo que marca pasa por lectura.

El principio, que vale para más que esta auditoría, queda en A10: que un commit no esté en `main` no dice que su
contenido no esté. El 1-oct pasó tres veces que un trabajo había entrado bajo otro número.

A9: aviso → cicatriz S0 «Diseñé una señal por palabras sin medirla: marcaba 28 de 41 cierres. Una señal que salta en dos de cada tres casos no es una señal.» — no se pudo comprobar: el instrumento aún no existe; su test llevará el techo de marcados
