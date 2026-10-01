# SCRUM-1321 · El ancla de una mutación dejó de ser única, y el meta-guard acusó a un guard sano

**Medido contra:** `origin/main` = `e9e71cab67574538943cd94392bdecf5f3dcbfa2` · 2026-10-01T01:58:00Z
(J3b del equipo de Javier, por encargo del orquestador `cobroflash-backend-5b`)

A9: comprobación → `tests/scrum836-ancla-de-mutacion-viva.test.mjs`
A9: aviso → cicatriz J3 «Empecé un encargo fuera de mi carril sin decirlo en la línea de A16; lo dije cuando ya había tres commits locales, antes de empujar» — no se pudo comprobar: la línea de A16 es prosa del primer mensaje de una sesión y ningún hook la lee

## 0 · El permiso, y de dónde viene

Este cambio toca **carril de S3** (`docs/equipo/dos-equipos.md` §3.3: «bancos e instrumentos …
mutación»), y **S3 está en pausa**: `scripts/meta-guard-mutaciones.mjs` (`aplicarUna`,
`diagnosticoDeCorte`), `tests/scrum836-…`, y las declaraciones de mutación de `tests/scrum853-…` y
`tests/scrum767-…`. La ficha del encargo no declaraba la excepción y yo no lo dije al empezar
(A20): lo dije con tres commits locales y nada empujado.

- **`scrum836`, `scrum853`, `scrum767`** — los autorizó el orquestador del equipo de Javier
  (`cobroflash-backend-5b`), por mensaje, el 1-oct-2026.
- **`meta-guard-mutaciones.mjs` y `aplicarUna`** — el orquestador dijo que cruzar al carril del
  otro equipo no lo podía autorizar él, se lo subió a Javier, y me bajó su respuesta con estas
  palabras: «su respuesta literal, hace un minuto: **«2-Autorizo»**». **Yo no se lo he oído a
  Javier: me llega por el orquestador.** Quien lo lea más adelante y quiera confirmarlo, se lo
  pregunta a él.

## 1 · Lo que decía el ticket y lo que hay

| lo que decía | lo medido |
|---|---|
| `scrum859` sale CIEGO «porque cambió el título del test que busca» | **Nadie renombró nada.** El título lleva igual desde `b676ec8d` (15-sep). La frase la imprime el propio meta-guard, y es falsa por construcción (§4) |
| `scrum853` MUDO ×2: o (a) dos protecciones redundantes, o (b) un helper suelto | **Ninguna de las dos.** El ancla de la mutación dejó de ser única y la mutación cae en otro paso (§2) |
| «¿cuelgan de los plazos vencidos?» | **No.** Ninguna de las dos se cura con SCRUM-1318 |

## 2 · `scrum853` MUDO ×2 — la causa

`aplicarUna` hace `texto.replace(de, a)`: muta la **primera** ocurrencia. `dc8ea603` (SCRUM-1263,
PR #1951) añadió dos pasos a `.github/workflows/claude.yml`:

| ancla de `scrum853` | antes de `dc8ea603` | hoy | adónde se iba la mutación |
|---|---|---|---|
| `        if: steps.puerta.outputs.despertar == 'si'` | 1 vez | 2 (líneas 252 y 271) | al `if:` del paso nuevo `origen`, que EMPIEZA igual; la acción (271) seguía intacta |
| `            CUERPO="$CUERPO" node --input-type=module -e "` | 1 vez | 2 (líneas 430 y 503) | al paso nuevo «¿Disparó CI el push?»; el de la rama muda (503) seguía intacto |

**Medido aplicándolas** con las piezas de la casa (`correr` + `aplicarUna`), no leyendo:

- sobre `main` sin tocar → MUDA ×2, y las otras siete de `scrum853` VIVAS (`evidencias/scrum1321/salida-scrum853-sobre-main.txt`);
- reancladas al paso que querían → VIVA ×2, 33 pasados y 1 caído cada una (`salida-scrum853-reanclado.txt`).

El test y sus asertos no han cambiado: **el guard estaba sano**. Lo roto era la declaración, y no la
rompió quien la escribió ni quien toca el guard, sino una línea escrita más arriba en el fichero
vigilado, en un PR correcto y con su tanda obligatoria en verde.

## 3 · Desde cuándo

Merge de #1951: `488410b5`, **29-sep-2026 09:44:13Z** (`mergedAt`).

Población: los 260 runs de `ci.yml` listados el 1-oct (28-sep 20:48Z → 1-oct 01:24Z). Con recuento
del meta-guard leído, **185**; con job pero sin recuento (cancelados o cortados), 28; sin job, 47.
El instrumento y su salida: `evidencias/scrum1321/historia-del-meta-guard.sh`, `historia.tsv` y
`salida-resumen-de-la-historia.txt`.

| | `scrum853` MUDO |
|---|---|
| ANTES del merge | **2 de 56**, y los dos son los runs del PROPIO #1951 (2 de 2). De los otros 54, cero |
| DESPUÉS | **129 de 129** (siempre ×2; el primero, a las 09:46:35Z). En `main`: 31 de 31 |

Unas 40 horas con el job del meta-guard en rojo en todos los PR. Y lo que no pedía el ticket: **el
meta-guard del PR que lo causó ya lo decía, en sus dos runs, y entró igual**, porque ese job no
bloquea. No es mío arreglar eso; lo tiene el orquestador.

## 4 · `scrum859` CIEGO — qué pasa de verdad

En el log del 1-oct (job 110167478819): la pasada LIMPIA trajo **20** tests, la MUTADA **16** (9
pasados, 7 caídos). Faltan cuatro, entre ellos el que la declaración nombra. Es la pérdida de
eventos de SCRUM-908, no un renombrado. El mensaje decía:

> resumen SÍ llegó en 1019 ms: node:test contó 16 tests … frente a los 16 que este script acumuló.
> CUADRAN: el fichero terminó con normalidad — si el test buscado no aparece, el título cambió.

Ese diagnóstico (SCRUM-1100) supone que `test:summary` viaja desde el hijo, y que si llega y cuadra
el fichero acabó. **Medido que no** (`evidencias/scrum1321/sonda-del-resumen.mjs` y su salida; Node
v24.18.0, win32): una cobaya de cinco tests que muere en el tercero —el testigo dice 3 ejecutados—
entrega al padre un resumen con `tests: 1`, y lo acumulado era 1. Cuadra. El resumen lo escribe el
proceso **padre** contando lo que le llegó: llega siempre y cuadra siempre.

⚠️ Límite de la sonda: mide que el resumen no prueba el final. NO reproduce la pérdida del CI (la
cobaya muere con `process.exit`, no por una tubería llena), y está corrida en Windows; el test nuevo
la vuelve a correr en el Linux del CI en cada tanda.

**Y ya no es rara:** `scrum859 · CIEGO` en **46 de 185** runs (25 %); 9 de 56 antes del merge y 37 de
129 después, o sea independiente de lo de `scrum853`. SCRUM-908 medía 3 de 38.

## 5 · Lo que cambia

1. **`tests/scrum836-…` (tanda obligatoria) gana una tercera criba: ningún ancla ambigua.** Visto
   en ROJO sobre el árbol real antes de arreglar nada (commit `24118654`): **3 de 357**
   declaraciones — las dos de `scrum853` y una de `scrum767`. Con un banco que reproduce el caso
   real (el ancla que casa antes, como prefijo de otra línea), su positivo (la misma mutación con
   su contexto) y tres casos de la única repetición que se admite.
   - Esa repetición —el guard que se muta a sí mismo y CITA su ancla en su declaración
     (SCRUM-812c)— **se deriva, no se lista**: exactamente dos ocurrencias, una sola empieza línea,
     y es la primera. En el árbol hay tres (`scrum758` ×2, `scrum812`) y el test exige que la
     rama que las absuelve se ejercite y que sólo absuelva a un guard que se cita a sí mismo.
2. **Las tres declaraciones, reancladas con su contexto.** `scrum853` ×2 (al `id: accion`, y al
   comentario pegado a la orden del paso de la rama muda). `scrum767`: su `where:` estaba dos
   veces en `customerPortal.routes.ts`; sigue mutando la MISMA ocurrencia y sigue VIVA
   (`salida-scrum767-reanclado.txt`). El `.ts` no se toca: sólo el literal de la declaración.
3. **`aplicarUna`, PUERTA 1b:** un ancla ambigua sale CIEGA sin mutar nada, con sus líneas. Antes:
   MUDO, acusando al guard. Usa el mismo `ambiguedadDelAncla` que la criba — vive en el script, una
   sola vez.
4. **`diagnosticoDeCorte(tras, limpia)`** deja de decir «el título cambió» y «terminó con
   normalidad»: compara con la pasada limpia, cuenta y NOMBRA los tests que faltan. Sin la limpia,
   no afirma nada.
5. `tests/scrum1321-…`: la sonda contra `node:test` de verdad, el caso del log (20 → 16) y la
   puerta. Si un día `node:test` cambia y el resumen vuelve a servir de prueba, ese test cae y lo
   dice.

Consecuencias mecánicas, dichas: `scrum836` pasa a declarar una mutación, así que el trinquete de
`scrum812` sube de 25 a **26** (regenerado, no elegido); y el test nuevo va declarado en
`scripts/_escritores-opacos-declarados.json` (escribe y relee un fichero en un temporal propio).

Mutaciones nuevas, aplicadas: las dos VIVAS (`salida-mutaciones-nuevas.txt`). La puerta 1b no
declara mutación: apagarla dentro del meta-guard haría que su propio test mutase un fichero mientras
el padre mide. La vi en rojo a mano (`if (false && ambigua)` → el test cae; restaurado con
`git restore --source=HEAD` y `git status` limpio).

## 6 · Lo que NO arreglo, y por qué

- **La pérdida de eventos de `scrum859`** (46 de 185 runs). Es SCRUM-908: tres sesiones con acceso
  al CI de Linux no la cerraron, no se reproduce en Windows, y es de otro carril. Lo que cambia es
  que el mensaje deja de culpar a un renombrado y nombra lo que falta: la próxima vez habrá con qué
  acotarla. **Mientras no se arregle, el job seguirá saliendo rojo uno de cada cuatro runs.**
- **Que el job del meta-guard no bloquee.** Decisión de un jefe, no de una sesión.
- Un fichero que muere a medias con código 0 llega al padre como **un `test:pass` cuyo nombre es
  la ruta del fichero** (línea MORIR=1 de la sonda). `murioElFichero` mira los caídos, no los
  pasados. No lo he seguido: queda dicho.

## 7 · Lo que hice mal

1. **No dije el A20 al empezar** (arriba, y en `docs/equipo/cicatrices/J3.md`).
2. **Mi primer barrido del histórico salió ciego y parecía un dato.** Bajé los logs con
   `gh api …/jobs/<id>/logs`, que devuelve cero bytes y sale 1 cuando el log lleva secuencias de
   escape; cincuenta filas decían «853 MUDO = 0». Lo cazó la columna de bytes que le había puesto
   al instrumento, no leer el resultado. Además paré la tarea y el bucle siguió vivo escribiendo en
   el mismo fichero: filas duplicadas. Lo repetí entero con `gh run view --job --log`, en un
   fichero nuevo. Las dos trampas están escritas en la cabecera de `historia-del-meta-guard.sh`.
3. Corrí la suite entera sólo en CI (decisión del orquestador: sin turno). En local, los ficheros
   que toco, los guards del instrumento y `guards:entrada`.
