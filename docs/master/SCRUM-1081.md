# SCRUM-1081 · «FICHERO MURIÓ AL MUTAR» en scrum853-avisador-solo-obligatorio — MISMA FAMILIA que SCRUM-908

**Medido contra:** `origin/main` = `a41c59f9e21a4c13e2a98c828d7f44c2f8cc65f5` · 2026-09-22T10:28:58Z

**Puesto:** J6 · Calidad y seguridad (`jv-j6`, equipo de Javier) · **Rama:** `scrum-1081-mismo-mecanismo-908`

## 1 · Encargo

Decidir si la firma **«FICHERO MURIÓ AL MUTAR»** sobre `scrum853-avisador-solo-obligatorio.test.mjs`
(3 apariciones: SCRUM-963 comentario 16159, y PR #1627 hoy) es el MISMO mecanismo que SCRUM-908
(carrera de stdout en `scripts/meta-guard-mutaciones.mjs`) o una causa distinta (mutación con radio
demasiado ancho, la explicación genérica que el propio guard imprime). Instrucción explícita del
orquestador: si encaja con el 908, se cierra apuntando allí **sin volver a medir a fondo**; solo si
no encaja se abre una campaña de medición con presupuesto declarado.

## 2 · Lo que dice el propio código sobre esta firma

`scripts/meta-guard-mutaciones.mjs` documenta «FICHERO MURIÓ AL MUTAR» como un 4º veredicto
(SCRUM-784, líneas 523-565): `node:test` emite un solo `test:fail` cuyo `name` es la RUTA del
fichero cuando el RADIO de una mutación mata el proceso entero (ejemplo documentado: mutar una
«puerta» para que un `import` ejecute código no relacionado). Es una explicación PLAUSIBLE, pero
genérica — el mensaje que el guard imprime («Suele significar que…») es un diagnóstico probable, no
uno confirmado para cada caso.

## 3 · Verificación — la mutación NO rompe nada estructuralmente

La declaración exacta (`tests/scrum853-avisador-solo-obligatorio.test.mjs:83-88`):

```
fichero: 'scripts/puerta-claude.mjs'
de:  const cabeza = cabezaRemota === '' ? '' : (/^[0-9a-f]{40}$/.test(String(cabezaRemota)) ? cabezaRemota : null);
a:   const cabeza = cabezaRemota;
cae: 'un 404 que llega como CUERPO DEL ERROR no es una cabeza remota'
```

Es una mutación de **una sola función pura**, sin imports nuevos, sin I/O, sin tocar ninguna
«puerta» de arranque — nada parecido al ejemplo de SCRUM-784. El test que la ejercita (`:351-360`)
llama a `C.ramasMudas(...)` directamente con un objeto JS; no hay shell, no hay `gh api`, no hay
async.

**Reproducido dos veces en local** (Windows, Node v24.18.0 — CI corre v24.20.0 en Linux), aplicando
la mutación exacta byte a byte y restaurando después (verificado con `sha256sum` antes/después:
idéntico):

1. Vía CLI (`node --test tests/scrum853-avisador-solo-obligatorio.test.mjs`): **34 tests, 32 pass,
   2 fail** — los dos con nombre correcto, ningún fichero muerto.
2. Vía el harness REAL (`correr()` de `meta-guard-mutaciones.mjs`, la misma función que usa el CI):
   idéntico resultado — `caidos` trae los DOS nombres de test correctos, cero mención al fichero.

**Si la causa fuera «radio demasiado ancho» (estructural), esto tendría que fallar SIEMPRE, en
cualquier plataforma — es determinista por definición.** No falló ni una vez en dos intentos
distintos por dos vías distintas. Eso ya pesa en contra de la hipótesis estructural.

## 4 · La prueba decisiva — mismo commit, mismo job, resultado DISTINTO

En vez de montar una campaña de tiradas nueva, se reutilizó el método ya establecido en SCRUM-908
(`gh run rerun <run> --job <job>`) sobre el job REAL que falló, sin tocar nada:

```
gh run view 35640688921 --json status,conclusion   → completed / failure (confirmado ANTES de repetir)
gh run rerun 35640688921 --job 106468984256
```

**Resultado del rerun** (`databaseId` nuevo, `106704045293`, mismo commit exacto que el job
original): `conclusion: success`. El log confirma la línea exacta:

```
✔ scrum853-avisador-solo-obligatorio.test.mjs · un 404 que llega como CUERPO DEL ERROR no es una
  cabeza remota   (+1 test(s) más caídos)
...
vivas 314 · mudas 0 · ciegas 0 · ficheros muertos 0
```

Contra la tirada original (mismo commit, mismo job, sin ningún cambio de código entre medias):

```
vivas 313 · mudas 0 · ciegas 0 · ficheros muertos 1
```

**El mismo commit, la misma mutación, el mismo job, dieron dos resultados distintos.** Eso es la
firma de una CARRERA, no de un defecto estructural — un defecto estructural no puede curarse solo
al repetir sin tocar una línea.

## 5 · Decisión

**Es la MISMA FAMILIA que SCRUM-908**, no una causa aparte. SCRUM-908 ya tiene diagnosticado
(§908c-6/7/8) que `scripts/meta-guard-mutaciones.mjs` sufre una carrera entre el hijo
(`node:test --test-force-exit`, vía la función `correr()` de este mismo fichero, que usa `run()` de
`node:test`) y el padre consumiendo sus eventos: si el hijo termina antes o después de un punto
crítico, se pierde información de la pasada. SCRUM-908 lo vio como UNA línea del TAP perdida
(MUDO); aquí se ve como la pérdida de la asociación evento↔nombre-de-test para el fichero entero
(FICHERO MUERTO) — un síntoma más severo del mismo transporte, no un mecanismo distinto. No se
decide AQUÍ cuál es el motivo exacto de por qué esta vez la pérdida fue total en vez de parcial —
eso es exactamente el terreno que SCRUM-908 ya dejó "no concluyente" a propósito, y no hay
justificación para reabrirlo con más coste del que costó esta vez.

**No se toca `scripts/meta-guard-mutaciones.mjs`** (S3, y el propio ticket lo pide así): el arreglo,
si lo hay, es el mismo que necesita SCRUM-908 (drenar el transporte antes de dar por cerrada la
pasada), no uno nuevo para esta firma.

**Efecto sobre SCRUM-836 (obligatoriedad del meta-guard):** ningún cambio — ya estaba bloqueado por
SCRUM-908, y esto confirma que el bloqueo cubre también esta firma, no solo MUDO.

## 6 · Coste y método — por qué no hizo falta una campaña de N tiradas

El encargo pedía explícitamente NO repetir el patrón de SCRUM-908 (N=4, +300 turnos). La pregunta
aquí era más estrecha — «¿es la misma familia?», no «¿cuál es la tasa exacta?» — y se contesta con
un experimento binario: ¿el mismo commit da resultados distintos en dos corridas? Una sola
repetición (el rerun de §4) ya lo confirma o lo refuta; no hace falta una distribución. Coste real:
2 reproducciones locales (segundos) + 1 rerun de CI (~13 min de espera, sin turnos intermedios) + la
lectura del código ya escrito en SCRUM-784. Ningún instrumento nuevo se ha quedado en el árbol: el
script de prueba usado para la reproducción vía `correr()` (`scripts/_probar-correr-853.mjs`) se
escribió, se usó y se borró en la misma tanda — nunca se comiteó. Quien quiera repetir la
reproducción local, el snippet es:

```js
import { correr } from './meta-guard-mutaciones.mjs';
const r = await correr('scrum853-avisador-solo-obligatorio.test.mjs');
console.log(JSON.stringify({ pasados: r.pasados.length, caidos: r.caidos }, null, 2));
```

(tras aplicar y luego revertir la mutación de `scripts/puerta-claude.mjs:173` citada en §3).

## 7 · Lo que NO se tocó

- `scripts/meta-guard-mutaciones.mjs` (S3): ni una línea, solo lectura.
- `.github/workflows/**` (S5): ni una línea.
- `tests/scrum853-avisador-solo-obligatorio.test.mjs`: ni una línea (la mutación se aplicó y
  revirtió sobre `scripts/puerta-claude.mjs`, verificado byte a byte con `sha256sum` antes/después).
- No se abre ninguna tirada adicional sobre SCRUM-908: esta medición no cambia su cierre.

## 8 · Ticket

Jira **SCRUM-1081** (`equipo-javier`, `area-j6`). Se cierra apuntando a **SCRUM-908** — mismo
mecanismo, síntoma más severo. Lo cierra el orquestador (A13), no yo.
