# SCRUM-1323 · El resumen de SIF-1 no puede contradecir a la viñeta de detalle del mismo hito

**Medido contra:** `origin/main` = `e9e71cab67574538943cd94392bdecf5f3dcbfa2` · 2026-10-01T01:57:00Z

A9: comprobación → `tests/scrum1323-resumen-vs-detalle-sif1.test.mjs`

Sesión J5b (relevo de J5), por encargo del orquestador del equipo de Javier (`cobroflash-backend-5b`).
Es un test nuevo y su extracto histórico. **No se ha tocado `docs/YAQU_MASTER.md`**, ni `src/`, ni
ningún otro test.

## Ⓐ El defecto que deja de poder pasar

El máster dice el estado de cada hito de SIF-1 en dos sitios: la línea de resumen de la Parte U
(«> **SIF-1** (U1.3): …») y la viñeta de ese hito bajo «### U1.3». Nada los comparaba. El resumen
dijo `S1-D ✅` durante quince días con una viñeta que no llevaba ningún símbolo. SCRUM-1319 corrigió
la línea; esto impide que vuelva a pasar.

## Ⓑ 🔴 Lo primero que hay que saber: en `origin/main` este guard está EN ROJO, y es el caso

`origin/main` (`e9e71cab`) todavía lleva la línea vieja: la corrección de SCRUM-1319 está en el
PR #2040 (`50ff50e4`), sin mergear. Medido sobre esta rama, que sale de `origin/main`:

```
tests 25 · pass 24 · fail 1 · EXIT=1
✖ ② el resumen de SIF-1 y la viñeta de cada hito dicen el MISMO estado
    el resumen dice ✅ y la viñeta de S1-D no lleva ningún símbolo de estado
```

Ése es el rojo real que pedía el ticket, sin fabricar nada. **Consecuencia: este PR no puede
ponerse verde hasta que entre #2040** (CI prueba el merge con `main`). El orden lo hace cumplir el
propio check: primero #2040, después éste.

El verde, medido poniendo en el árbol el máster de `50ff50e4` y retirándolo después
(`git diff --numstat` = `1 1 docs/YAQU_MASTER.md` con él puesto; `git status --porcelain` vacío al
terminar): `tests 25 · pass 25 · fail 0 · EXIT=0`.

## Ⓒ Qué compara

El **símbolo**, no la prosa. No busca «DONE», «HECHO» ni «BORRADOR».

| sitio | qué se lee |
|---|---|
| resumen | el símbolo pegado al identificador del hito. `S1-D ~~✅~~ 🟡` es 🟡 (lo tachado no cuenta). `S1-0 🟡 HUMANO (cert FNMT ✅ …)` es 🟡: el ✅ del paréntesis es de una parte del hito |
| detalle | los símbolos de estado (✅ 🟡 ⏳) que lleva la viñeta del hito, fuera de lo tachado, estén donde estén y los acompañe la palabra que los acompañe |

- **regla ①** · la viñeta lleva algún símbolo → el del resumen tiene que ser uno de ellos.
- **regla ②** · la viñeta no lleva ninguno → el resumen no puede decir ✅.

Nada va por número de línea. El código de sección (`U1.3`) une el resumen con su encabezado, y el
identificador (`S1-D`) une cada tramo del resumen con su viñeta. La población sale de las viñetas.

Población medida hoy, resumen/detalle (— = viñeta sin símbolo):

```
S1-0 🟡/— · S1-0b ✅/✅ · S1-A ✅/✅ · S1-B ✅/✅ · S1-C ✅/✅ · S1-D ✅/— · S1-E 🟡/🟡 · S1-F ⏳/— · S1-G ⏳/— · S1-H 🟡/🟡
```

10 hitos. Con el máster de `50ff50e4`, S1-D pasa a `🟡/—` y no queda ninguna contradicción.

## Ⓓ Los límites, que son decisiones mías y las puede tumbar el orquestador

1. **Una viñeta sin símbolo solo prohíbe el ✅.** Cuatro de diez viñetas no llevan símbolo (S1-0,
   S1-D, S1-F, S1-G). Exigir igualdad estricta daría rojo en `S1-0 🟡` y en el `S1-D 🟡` de
   SCRUM-1319, y la única salida sería editar el máster para contentar al test. Así que
   `S1-0 🟡` contra una viñeta muda **no se comprueba**: ahí el estado vive en un solo sitio.
2. **Una viñeta con dos símbolos distintos se compara por pertenencia.** No sabe cuál es el
   vigente. En U1.3 hay 0 de 10; el test ① las imprime si aparecen. Con una viñeta
   «🟡 BORRADOR … ✅ DONE» sin tachar, un resumen que siguiera en 🟡 pasaría.
3. **No sabe si el estado es verdad.** Que haya 10 registros aceptados no lo mide esto: solo que
   los dos sitios dicen lo mismo.
4. **Solo U1.3.** Ver Ⓖ.

## Ⓔ Los controles

| control | qué prueba | resultado |
|---|---|---|
| ⑥ rojo real | el resumen y la sección tal como estaban en `e9e71cab`, sacados de git | acusa a S1-D y solo a S1-D |
| ⑦ | el arreglo de SCRUM-1319, literal (`~~✅~~ 🟡`) | pasa |
| ⑧ | el otro arreglo: dar S1-D por hecho en su viñeta, con tres prosas distintas («✅ DONE», «✅ HECHO», «(cerrado ✅)») | pasa las tres |
| ⑨ | la contradicción al revés: cambia la viñeta y no el resumen | cae |
| ③ | sobre el máster del árbol, hito por hito: cambiar solo el resumen → rojo; cambiar los dos sitios → verde | 9 hitos × 2 en `origin/main` (S1-D ya está en rojo sin mutar); 10 × 2 con el máster de `50ff50e4` |
| ④ | 137 líneas de relleno delante | mismo resultado: no depende de la posición |
| ⑩ × 15 | cada forma de no encontrar lo que busca | dice el motivo en vez de pasar |
| ⑪ | un texto que no es el máster | problemas y población cero, no verde |

Los quince motivos de ⑩: sin resumen, resumen duplicado, sin sección, sección duplicada, sección de
otro sprint, sección sin viñetas, viñeta sin identificador legible, hito del resumen sin viñeta, hito
con viñeta fuera del resumen, hito sin símbolo, símbolo no pegado al identificador, símbolo
desconocido, dos estados para un hito, dos viñetas para un hito y tachado sin cerrar.

«No veo» (test ①) y «veo y está mal» (test ②) van en dos tests para que no se confundan.

**Mutación del propio guard**, sobre el máster de `50ff50e4` (base 25/25), una línea cada vez y con
el árbol restaurado y comprobado al final:

| mutación | tests que caen |
|---|---|
| regla ② apagada | ③ ⑥ ⑨ |
| regla ① apagada | ③ ⑨ |
| lo tachado sí se lee | ① ③ ⑦ |
| el símbolo ya no tiene que ir pegado al identificador | los dos ⑩ de «sin símbolo» |
| símbolo desconocido aceptado | el ⑩ de «símbolo desconocido» |

## Ⓕ El extracto histórico

`tests/fixtures/scrum1323/master-u13-en-e9e71cab.md` son 15 líneas y 5.250 bytes: la línea de
resumen, una línea en blanco y la sección «### U1.3» hasta la línea anterior a «### U1.4», sacadas de
`e9e71cab:docs/YAQU_MASTER.md` con `grep` y `awk` desde Git Bash, sin editor. Su sha256 está en el
test (⑤). Lleva la sección y no solo la línea para que el rojo real no caduque cuando el máster
avance: si mañana S1-D se da por hecho, la línea vieja contra la viñeta nueva ya no contradiría.

Receta para regenerarlo:

```
git show e9e71cab67574538943cd94392bdecf5f3dcbfa2:docs/YAQU_MASTER.md > "$TMP/m.md"
{ grep '^> \*\*SIF-1\*\* (U1\.3):' "$TMP/m.md"; echo; awk '/^### U1\.3 /{on=1} /^### U1\.4 /{on=0} on' "$TMP/m.md"; } \
  > tests/fixtures/scrum1323/master-u13-en-e9e71cab.md
```

## Ⓖ Hallazgo de otro alcance, medido y sin tocar

Pasé el mismo comparador, en solo lectura, por las otras secciones de U1 que tienen resumen con
código (3: U1.1, U1.2, U1.3; CONNECT-1 y las demás no llevan el código en su línea de resumen):

- **U1.1 (VALIDA-0): el comparador no sirve tal cual.** Sus viñetas mezclan hitos (`V0-n`) con
  entradas de ticket, y varias llevan más de un símbolo. De lo que sí lee: `V0-5` dice ⏳ en el
  resumen y 🟡 («EN PREP») en su viñeta. Ninguno de los dos es ✅ y no le veo víctima hoy: lo dejo
  dicho, no abro ticket.
- **U1.2 (DOCS-F1):** su sección no tiene viñetas de hito; no hay dos sitios que comparar.

Extender el guard a U1.1 no es ampliar una constante: pide decidir cómo se lee una viñeta con
varios símbolos. No entra en este ticket.

**Decisión del orquestador (1-oct), añadida por J5c:** no se abre ticket —no tiene víctima y sería
cola que nadie trabaja—, pero extender el comparador a U1.1, con el `V0-5 ⏳` del resumen contra el
🟡 de su viñeta dentro, queda como **candidato a ticket el día que alguien toque U1.1**.

## Ⓗ Lo que me salió mal

1. **Una de mis mutaciones del guard era equivalente y la había dado por buena al escribirla.**
   Quería probar «el ✅ de una parte del hito cuenta como estado», y la línea que cambié no
   cambiaba el comportamiento: salió 25/25 y no era un test mudo, era una mutación mal hecha. La
   retiré de la tabla. Lo que sostiene esa afirmación es la aserción de ⑥ sobre S1-0 (lee 🟡 con un
   ✅ en su paréntesis) y la mutación de «pegado al identificador».
2. **Cogí el ticket en Jira después de escribir el test, no antes** (A13, paso 2). Comprobé que no
   había rama ni PR ni comentarios antes de empezar, pero el «En curso» llegó tarde.
3. Al parametrizar la sección con un reemplazo por script dejé un mensaje de error apuntando a una
   variable fuera de ámbito. Lo vi en el `grep` de después, antes de correr nada.

## Ⓘ Verificación

- El test solo: 25 tests, 24 en verde y ② en rojo sobre `origin/main` (Ⓑ); 25/25 con el máster de
  `50ff50e4`.
- Subtanda de 285 ficheros de `tests/` —los que barren `tests/`, los que leen `docs/master/` o
  `fixtures`, y los 15 que ya leían el máster—, con este registro ya escrito: 2.686 tests · 2.670 en
  verde · 15 saltados (gateados por base) · **1 rojo, el ② de este guard**, que es el de Ⓑ. EXIT=1
  por ese rojo y por ningún otro.
- `npm run guards:entrada`, después de la última edición de este registro: resultado en el cuerpo
  del PR.
- La tanda entera no la lanza una sesión: va en CI. Allí saldrán además `scrum55` y `scrum128`, que
  son plazos vencidos de `main` (SCRUM-1318) y no de este PR.

---

# Segunda vuelta (J5c) · El guard dice en su salida lo que NO comprueba

**Medido contra:** `origin/main` = `eabcb2d51ae7c71bb4b9177236ae9da6ec803a6d` · 2026-10-01T02:12:02Z

A9: comprobación → `tests/scrum1323-resumen-vs-detalle-sif1.test.mjs`

Sesión J5c (relevo de J5b), por encargo del orquestador (`cobroflash-backend-5b`). Son las condiciones
con las que aceptó los límites 1 y 2 de Ⓓ, más la frase añadida a Ⓖ. Cambia el test y este registro.
**No se ha tocado `docs/YAQU_MASTER.md`**, ni `src/`, ni el extracto histórico, ni
`compararResumenYDetalle`: la regla es la misma; lo nuevo es lo que el guard dice de ella.

## Ⓙ El defecto, que era del propio guard

Cuatro de los diez hitos (S1-0, S1-D, S1-F, S1-G) no se comparan contra nada: su viñeta no lleva
símbolo y ahí la regla solo prohíbe el ✅. Estaba escrito en un comentario del test y en Ⓓ de este
registro, y en ningún sitio que se lea al ver el verde. Un «25/25» se entendía como «los diez hitos
están vigilados»: un resumen que dice más de lo que su detalle sostiene, que es lo que este guard
vino a impedir.

## Ⓚ Lo que cambia

El cuerpo del test ① pasa a ser una función con nombre, `veLosDosSitios(texto)`, y ① la llama con el
máster. Imprime, en cada pasada:

```
[SCRUM-1323] población: 10 hitos de U1.3 · S1-0 🟡/— · S1-0b ✅/✅ · … · S1-H 🟡/🟡
[SCRUM-1323] ⚠️ SIN COMPROBAR contra su viñeta: 4 de 10 hitos (S1-0, S1-D, S1-F, S1-G) — su viñeta no lleva símbolo de estado; ahí solo se prohíbe ✅
```

La segunda línea es nueva y sale **siempre**, también con cero («0 de 10 hitos (ninguno)»): si solo
saliera cuando hay alguno, su ausencia se leería como «todos vigilados» y también como «alguien la
quitó». La tercera, «comparados solo por pertenencia (viñeta con varios símbolos): …», ya existía y
sigue saliendo solo cuando hay alguna (hoy 0 de 10).

Tres tests nuevos (28 en total) corren esa misma función con `console.log` sustituido mientras dura,
y fijan lo que dice:

| test | qué fija |
|---|---|
| ⑫ | sobre el extracto histórico, la línea nombra exactamente S1-0, S1-D, S1-F, S1-G y dice «4 de 10 hitos»; si S1-F gana un símbolo en su viñeta, deja de salir y la cuenta baja a 3; sobre el máster del árbol, los nombres son los que da el comparador |
| ⑫ (cero) | con las cuatro viñetas mudas ya con símbolo, la línea sigue saliendo y dice «0 de 10 hitos (ninguno)» |
| ⑬ | el caso que señaló el orquestador: la viñeta de S1-E con «🟡 BORRADOR … ✅ DONE» sin tachar → S1-E **no cae** (es el límite 2, dicho con un test) y el aviso de pertenencia sale nombrando S1-E y solo S1-E. Control: la misma edición tachando el 🟡 sí cae, y entonces el aviso no sale; sin tocar nada, tampoco |

## Ⓛ Mutación, repetida entera

Sobre el máster de `50ff50e4` puesto en el árbol mientras dura (`git diff --numstat` =
`1 1 docs/YAQU_MASTER.md`; base 28/28) y con el árbol comprobado por sha256 al terminar. Una línea
cada vez; las cinco primeras son las de Ⓔ, repetidas con los tests nuevos dentro.

| mutación | tests que caen |
|---|---|
| regla ② apagada | ③ ⑥ ⑨ ⑬ |
| regla ① apagada | ③ ⑨ ⑬ |
| lo tachado sí se lee | ① ③ ⑦ ⑫ ⑬ |
| el símbolo ya no tiene que ir pegado al identificador | los dos ⑩ de «sin símbolo» |
| símbolo desconocido aceptado | el ⑩ de «símbolo desconocido» |
| la línea «SIN COMPROBAR» no se imprime | los dos ⑫ y ⑬ |
| la línea «SIN COMPROBAR» sale sin nombres | los dos ⑫ |
| «SIN COMPROBAR» solo sale si hay alguno | ⑫ (cero) |
| «SIN COMPROBAR» nombra a los comprobados en vez de a los mudos | los dos ⑫ |
| el aviso de pertenencia no se imprime | ⑬ |
| el aviso de pertenencia sale sin nombres | ⑬ |
| el aviso de pertenencia sale siempre | ⑬ |
| «varios símbolos» pide tres y no dos | ⑬ |

13 de 13 cazadas; ninguna retirada.

## Ⓜ El límite de lo nuevo

⑫ y ⑬ fijan lo que **dice la función**, no que ① la siga llamando: quien borre el cuerpo de ① se
lleva también la línea de población y las tres aserciones de lectura, y eso no lo caza ningún test
de este fichero. No lo he cerrado con un proceso hijo que corra el fichero y lea su salida: un hijo
de `node --test` hereda el contexto del padre y en CI pisa el TAP de la tanda (SCRUM-1308), y el
riesgo que cubre es una llamada de una línea a la vista.

## Ⓝ Lo que me salió mal

1. Dejé en el test un comentario a medio pensar (una frase que se corregía a sí misma dentro del
   comentario). Lo reescribí antes de correr nada; no llegó a ningún commit.
2. **No desarmé el auto-merge de #2044 al arrancar, y lo acabó desarmando el orquestador.** Fue una
   apuesta medida, no una garantía: #2040 tenía el check obligatorio en rojo y la tanda de #2044
   era anterior al merge de #2039, así que #2044 no podía entrar sin una tanda nueva. Si alguien la
   hubiera relanzado sobre el head viejo con #2040 ya dentro, habría entrado incompleto. Desarmar
   costaba una orden y lo re-arma el orquestador: era la opción barata y no la cogí.
3. Empecé a escribir antes de leer `00-normas-comunes.md` desde `origin/main`; la leí con el código
   ya escrito y antes de empujar.
4. **La primera pasada de mutación la corrí con el árbol sin comitear** (A23 nº 9), y `arbol:mio`
   después de la primera escritura y no antes (A2). El script restaura por contenido y lo comprueba
   por sha256, y salió bien, pero si el proceso hubiera muerto a mitad el test mutado se habría
   quedado en el árbol sin un commit al que volver. La tabla de Ⓛ es la de la segunda pasada, ya
   con todo comiteado y `origin/main` mergeado.

## Ⓞ Verificación

- El test solo, en esta rama con `origin/main` (`eabcb2d5`) mergeado: 28 tests, 27 en verde y ② en
  rojo (el de Ⓑ: `main` todavía no lleva #2040). Con el máster de `50ff50e4`: 28/28.
- `npm run guards:entrada`, `scrum237`, `scrum976`, `scrum1294`, `scrum525d` y los que leen el máster:
  resultado en el cuerpo del PR y en el comentario de entrega del ticket.
- La tanda entera va en CI.
