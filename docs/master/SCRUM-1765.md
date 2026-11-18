# SCRUM-1765

## SCRUM-1765a · Los tres bancos heredados (1324, 908c, 1345) se retiran: sus mutaciones vivas van al catálogo del test que tumban

**Puesto:** J6 (jv-j6ei) · **Rama:** `scrum-1765a-banco-1324-al-catalogo` · 18-nov-2026
**Medido contra:** `origin/main` = `29f570bba0b8d45540f14065f029571b13080b37` · 2026-11-18T16:23:05Z (cabecera `Date:` de `gh api -i zen`)
A9: comprobación → `tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs`
Mutaciones: catálogo → `tests/scrum1324-nadie-vigila-el-silencio.test.mjs`
Mutaciones: catálogo → `tests/scrum976-guards-entrada-con-techo.test.mjs`
Mutaciones: catálogo → `tests/scrum859-identidad-y-motivo-cerrado.test.mjs`

Decisión que se aplica: descripción de SCRUM-1765 y SCRUM-1387 c.22070 («retirar»). Sólo `tests/` y
`docs/master/`. Ningún guard tocado, ni su texto ni sus números (regla 41); `src/`, esquema y emisión, nada.

### Lo que dice el guard (el instrumento, no este registro)

`tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs`, su línea de población, en este árbol:

| momento | ficheros con «mut» | bancos | fuera = heredados | nuevos |
|---|---|---|---|---|
| antes (main `1372a1c2`) | 245 | 106 | 33 | 0 |
| sin `SCRUM-1324/mutar.mjs` | 244 | 106 | 32 | 0 |
| sin `scrum908c/mutar2.mjs` ni `mut2-todos.mjs` | 242 | 106 | 31 | 0 |
| sin `SCRUM-1345/mutar.mjs` | 241 | 106 | **30** | 0 |

Las tres carpetas siguen siendo «banco» (conservan salidas con «mut» en el nombre), pero ya sin guion,
así que salen de «fuera» solas: el guard baja porque el guion no está, no porque nada nombre el catálogo.

### 1324 — 15 de 15 al catálogo de `scrum1324`

Las 15 de `mutar.mjs`, con el mismo `de` y el mismo `a`; anclas contadas antes en
`scripts/vigia-silencio-de-main.mjs`: 15 de 15 aparecen exactamente una vez. Corridas con `correr` +
`aplicarUna` de `scripts/meta-guard-mutaciones.mjs` (driver fuera del árbol). Línea base limpia: 8 pasan,
0 caen, 0 saltan. **15 de 15 tumban su caso**, y los colaterales son los mismos que la salida vieja del
guion (`evidencias/SCRUM-1324/mutaciones.txt`; p. ej. M12: su caso ③ +4 = los 5 de entonces).
Control negativo del instrumento: M03 con `cae` del caso ①, que no cae, sale MUDA.

### 908c — ya estaba en el catálogo de `scrum859`

`mutar2.mjs` aplicaba la nº 2 de `scrum859` (`identidadDeEntrada` → clave posicional). Corrida con
`aplicarUna`: línea base 20 pasan, 0 caen; **tumba** «insertar una entrada en medio NO mueve ninguna
clave» (+7 colaterales). Se borran `mutar2.mjs` y `mut2-todos.mjs` (este último no mutaba: extraía de los
logs de CI el veredicto de esa mutación; contaba como guion por el nombre). Sus salidas se quedan.

### 1345 — 2 al catálogo de `scrum976`, 1 ya re-derivada, 3 caducadas

🔴 Corrección a la medición de partida (c.22069 y el traspaso J6eh): «M3 y M4 ya están en scrum976»
**no era cierto** en este árbol. Su catálogo tenía 6 declaraciones, todas de SCRUM-1386 sobre
`scripts/guards-entrada.mjs`; ninguna era M3 ni M4. Las anclas de M3 y M4 sí estaban vivas, en el
propio test. Van ahora a su catálogo con el salto de línea dentro del ancla (escapado en la
declaración, así que el ancla casa una sola vez, con el código). Base 11 pasan, 0 caen: **2 de 2
tumban** ④bis y ④ter.

| mutación | estado | por qué |
|---|---|---|
| M1 · el plazo agotado olvida los caídos | ya en el catálogo | SCRUM-1386 la re-derivó (`…ciegos: 1, vistos, terminado, callados: [] };` → ⑦) |
| M2 · el plazo agotado deja de ser ciego | CADUCADA | ancla reescrita por `4556d3ffc` (SCRUM-1386); no re-derivada |
| M3 · la señal CI por verdad | catálogo de `scrum976` | tumba ④bis |
| M4 · en CI el plazo deja de ser rojo | catálogo de `scrum976` | tumba ④ter |
| M5 · un rojo dentro de plazo sale 0 | CADUCADA | ancla reescrita por `4556d3ffc` (SCRUM-1386); no re-derivada |
| M6 · la línea de la pasada deja de salir | CADUCADA | ancla reescrita por `9b2bc971f` (SCRUM-1152c); no re-derivada |

Re-derivar M2, M5 y M6 sobre el código de hoy queda por hacer: no lo he intentado.

### Líneas fechadas

`SCRUM-1324.md` (⑤; y se quita el comando de reproducir que apuntaba al guion), `SCRUM-908.md`
(tramo 908c), `SCRUM-1345.md` y `SCRUM-1152.md`.

### El trinquete de `scrum812` sube 40 → 41

Al declarar sus 15, `scrum1324` entra en la lista de «titulados GUARD que declaran»: el trinquete dijo
«LA COBERTURA HA SUBIDO a 41 (el suelo decía 40)». Se re-ancla hacia ARRIBA, con su línea fechada en el
comentario y la declaración ④ que cita la constante (41 → 40). Cobertura que sube, no una tolerancia
(visto por el orquestador). Sus 5 mutaciones, con `aplicarUna`: 5 de 5 tumban.

### Suite, por tramos (`scripts/tanda-entera-por-tramos.mjs`, 15 tramos, 1.707 ficheros)

- Tramos 1 a 13 sobre el commit `eb41c3a14` (sin el cambio de `scrum812`): 11.905 casos y 2 fallos, los
  dos en el tramo 3, `scrum1298b`, por el `TMP` en ruta corta 8.3 (`JAVIER~1`) que hereda esta sesión del
  lanzador. Con `TMP` largo, ese fichero da 8 de 8 (y entonces caen 2 de `scrum1289b`, que con el `TMP` por
  defecto da 9 de 9): son del entorno. No los arreglo aquí: los corrige el orquestador en su lanzador.
- Tramo 14 (que tiene `scrum812`) y tramo 15, sobre el árbol final: 1.941 casos · 1.910 pass · 0 fail.
- 🔴 `--resumen 15` dice **CIEGO**: la pasada se identifica por la huella del árbol, y el cambio de
  `scrum812` la cambió, así que los tramos 1 a 13 no cuentan para ella. No es un verde de la tanda entera.
  Lo que sí cubre: el único fichero que difiere entre los dos árboles está en el tramo 14, ya re-corrido.

### Lo que NO está

- 1288b/c/d (puesto propuesto en SCRUM-1765): no lo he leído; no me cupo en contexto.
- La aceptación «lo dice el propio guard»: sí, 30, en su línea de población (tabla de arriba).
- Lección de M3/M4 («ya está en el catálogo» se comprueba contra el catálogo antes de borrar el guion):
  sin comprobación, porque `scrum1387` mira texto y no compara mutaciones; y su cicatriz iría a
  `docs/equipo/`, fuera de este encargo. Se la paso al orquestador.

## SCRUM-1765c · El banco de J6 (`scrum1392`) se retira al catálogo, y el carril del sujeto de 864, 864c y 933

**Puesto:** J6 (jv-j6ek) · **Rama:** `scrum-1765c-banco-1392-al-catalogo` · 19-nov-2026 (Madrid)
**Medido contra:** `origin/main` = `e37a7051f87b195ceeae4852c56a02bc0d218438` · 2026-11-18T23:49:47Z (cabecera `Date:` de `gh api -i zen`)
A9: aviso → A10 «Una operación que no se ejecutó se lee exactamente igual que un éxito.» — no se pudo comprobar: pasé a `node -e` por bash un texto con acentos graves (mi cicatriz de no pasar texto a node por bash) y bash los ejecutó; node abortó antes de escribir y lo cacé con `git diff --stat`, que no mostraba `scrum812`; ningún hook de este árbol lee un `node -e` antes de lanzarlo
Mutaciones: catálogo → `tests/scrum1392-un-hallazgo-visto-no-caduca.test.mjs`

Decisión que se aplica: SCRUM-1387 c.22070 («retirar») y SCRUM-1765 c.22116 (los 3 sin dueño, por el
carril del SUJETO). Esta rama sale de `main`, que **todavía no lleva 1765b** (`199f5fc4b`, PR del bot):
los dos tramos se añaden al final de este fichero, y el segundo en entrar puede quedar en DIRTY.

### PASO 0

Sin ramas `scrum-1765c*` en el remoto ni commits «1765c» en `origin/main`. `scrum1387` en `e37a7051f`:
**29 heredados** (246 ficheros con «mut» · 107 bancos · 0 nuevos), los mismos que midió 1765b.

### `scrum1392` — 6 de 6 al catálogo de su test

Las 6 de `docs/master/evidencias/scrum1392/mutar.mjs`, con el mismo `de`, `a` y `cae`, declaradas en
`MUTACIONES_QUE_ME_TUMBAN` de `tests/scrum1392-un-hallazgo-visto-no-caduca.test.mjs`. Sujetos:
`scripts/_hallazgos-y-ciegos.mjs` (M1–M4), `scripts/guard-duplicar-926.mjs` (M5),
`scripts/guard-portal-en-la-ficha.mjs` (M6); ninguno lleva CR, y cada ancla aparece una vez.

Corridas con `correr` + `aplicarUna` de `scripts/meta-guard-mutaciones.mjs` (driver fuera del árbol;
salida en `docs/master/evidencias/SCRUM-1765/1765c-aplicarUna.txt`). Línea base: 9 pasan, 0 caen, 0
movidos. **6 de 6 tumban** su caso, con 2, 3, 2, 1, 1 y 1 caídos: los mismos números que la traza
original (`evidencias/scrum1392/mutaciones-traza.txt`). Controles: un `cae` que no existe sale CIEGO; M4
con el `cae` de ③ (un caso que M4 no tumba) sale **MUDA**. Árbol limpio tras cada pasada (`git status`).

Se borra `mutar.mjs`; se conservan la traza y el resto del banco (`banco.mjs` y
`censo-lista-en-la-mano.mjs` no llevan «mut» en el nombre y no son bancos para `scrum1387`). Línea
fechada en `docs/master/SCRUM-1392.md`, bajo «El test, y visto en rojo» (es el único registro que lo cita:
`git grep "scrum1392/mutar"`).

`scrum1387`, su línea de población después: **245 ficheros con «mut» · 107 bancos · 28 fuera · 28
heredados · 0 nuevos**. Baja de 29 a 28 porque el guion desaparece. El guard no se ha tocado.

### El trinquete de `scrum812` sube 41 → 42

Entra `scrum1392` como test titulado que declara: «LA COBERTURA HA SUBIDO a 42 (el suelo decía 41)».
Re-anclado hacia arriba con su línea fechada, y su mutación ④ re-anclada a 42 → 41. Con `aplicarUna`,
sus 5 mutaciones tumban su test (base 6 pasan; misma evidencia).

### 864, 864c y 933: el carril del sujeto, medido

| banco | mutación → sujeto | test que tumba | `carriles.mjs de <sujeto>` |
|---|---|---|---|
| scrum864 | `process.on('exit', limpiarTodo)` → `tests/_temporal.mjs` (ancla viva, 1 vez; en ningún catálogo) | banco propio `el-que-decide.mjs` | «sin fila en §3: nadie lo reclama» |
| scrum864c | import de `_temporal.mjs` → `tests/scrum899b-arranque-de-la-tanda.test.mjs` | `scrum864c` | test de SCRUM-899 → etiqueta: **`area-s5`, `equipo-luis`** |
| scrum864c | import de `_temporal.mjs` → `tests/scrum182-arbol-movido.test.mjs` | `scrum864c` | test de SCRUM-182 → **sin etiquetas** |
| scrum933 | M1 y M2 → `scripts/_censo-mkdtemp.mjs` (ya en el catálogo de `scrum864c`, según 1765b) | `scrum864c` | fila general de `scripts/**`: «su dueño no lo ha decidido nadie» |

Etiquetas leídas hoy en Jira: SCRUM-864, SCRUM-933 y SCRUM-182 no llevan ninguna; SCRUM-899 lleva
`area-s5`. Autoría en git, solo como dato: `_temporal.mjs`, `_censo-mkdtemp.mjs`, `scrum864c` y los tres
guiones entraron desde la máquina de Javier (16 a 18 de septiembre); `scrum899b` y `scrum182`, desde la
de Luis.

**Propuesta:** el carril del sujeto da puesto a **una** de las cinco mutaciones: la de `scrum899b`, que es
de **S5** (equipo de Luis, `aviso-a-luis`). Las otras cuatro no tienen dueño por carril: tres sujetos
dicen «nadie lo reclama», «sin etiqueta» o «sin decidir». No propongo un puesto que el instrumento no da.
Lo que se decide es de quién son `tests/_temporal.mjs` y `scripts/_censo-mkdtemp.mjs` (`dos-equipos.md`
§3.3), y eso no es de esta sesión. Dato útil para quien lo herede: las dos de `scrum933` ya están en el
catálogo de `scrum864c`. Retirarlas solo exige ver que tumban y borrar el guion.

### Lo que NO está

- La suite entera no se ha corrido (orden del encargo: RAM justa). Solo los guards de la lista y los
  dos tramos de la suite que contienen los tests tocados, sobre `cee71881c` con `dist/` de `tsc --noCheck`
  (no toco `src/`):
  · guards 1387, 745, 757, 1321, 1415, 812, 1294, 267, 273, 854, 237, 976 + `scrum1392`: **103/103 en 13
    ficheros** (TAP a fichero) · `meta-guard-mutaciones.mjs --solo-censo`: 316 declarantes, 1.296
    declaraciones, salida 0 (no muta: el meta-guard no admite limitarse a un test, y sus mutaciones de los
    dos tests tocados se corrieron con su propio `aplicarUna`, arriba).
  · tramo 4/15 (`scrum1392`): 115 ficheros · 1.111 tests · **2 fail**, los dos en
    `tests/scrum1328-skips-con-motivo-en-el-tap.test.mjs` (EPERM al abrir `C:\Users\Javier`: su línea 99
    pasa la ruta del TAP sin comillas y aquí `TMP` lleva un espacio). Del entorno: el mismo fichero, con
    `TMP` sin espacios, 5/5. Mismo patrón que `scrum1298b` en 1765a. No es de mi carril y no lo toco.
  · tramo 14/15 (`scrum812`): 115 ficheros · 988 tests · 0 fail.
- 864, 864c y 933 no se retiran: no son de J6 por literal.
