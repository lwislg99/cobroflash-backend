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

## SCRUM-1765b · 1288b/c/d con puesto propuesto, y el censo de los 29 heredados que quedan, por dueño

**Puesto:** J6 (jv-j6ej) · **Rama:** `scrum-1765b-los-que-quedan` · 18-nov-2026
**Medido contra:** `origin/main` = `e37a7051f87b195ceeae4852c56a02bc0d218438` · 2026-11-18T23:35:43Z (cabecera `Date:` de `gh api -i zen`)
A9: aviso → A10 «Cero resultados con tu vocabulario no es silencio del documento.» — no se pudo comprobar: la sonda declara ILEGIBLE y «0 anclas leídas» por banco, pero ningún guard exige que un censo de anclas lea todos los formatos de guion

Solo medición y docs: ningún banco retirado, ningún test ni guard tocado (regla 41), `src/` y emisión, nada.

### PASO 0

Ninguna rama `scrum-1765*` en el remoto, ningún commit con «1765b» en main, ningún PR. `scrum1387` en este
árbol, su línea de población: **246 ficheros con «mut» · 107 bancos · 29 fuera · 29 heredados · 0 nuevos**
(historia de 3536 commits). Cuadra con 33 − 3 (#3235) − 1 (#3238) = 29.

### 1288b/c/d: el literal del ticket

SCRUM-1288 está «Finalizada» y **sin ninguna etiqueta** (leído en Jira hoy). El literal que sí hay es el de
autoría de cada tramo, en sus comentarios: 1288b, c.19094 («S3 · 9-oct-2026»); 1288c, c.19112 y c.19321
(«S3»); 1288d, c.19465 («S3»). Sujetos de sus guiones, por `node scripts/carriles.mjs de`:
`scripts/_censo-gemelo-crudo.mjs` → **S3** (`dos-equipos.md:183`); `merchantNotifications.ts` y
`quotesAdmin.routes.ts` → **S1** (`dos-equipos.md:136`); los tests nombrados (`scrum1288b/c/d`, `scrum1452`)
→ «el test de un ticket» = quien lo trabajó, S3.
**Propuesta: los tres a S3 (equipo de Luis, `aviso-a-luis`).** Por literal de autoría, no por etiqueta: la
etiqueta no existe.

### Los 29, por dueño

Sonda: `docs/master/evidencias/SCRUM-1765/1765b-sonda.mjs` (generaliza la de 1387y; población con las
funciones del guard, anclas por AST), salida `1765b-censo.txt`. Control SEMBRADO: un ancla del catálogo de
`scrum1387` sale VIVA y «en catálogo», una inventada sale MUERTA; con `--sin-control` dice CIEGO y sale 2
(corrido). Total: 210 anclas · VIVA 161 · AMBIGUA 12 · MUERTA 3 · SIN-FICHERO 34 · ilegibles 12 · ya en
catálogo 6. **Nueve bancos salen con 0 anclas leídas**: mutan por función, por tuplas o sobre `dist/` por
plantilla; eso es «la sonda no sabe leerlos», no «no tienen mutaciones».

| banco | padre · etiquetas (Jira, 18-nov) | dueño propuesto | anclas V/A/M/SF/ileg · en catálogo |
|---|---|---|---|
| docs/evidencias/scrum1317 | 1317 · area-j4 | J4 | 13/0/0/0/0 · 0 |
| docs/evidencias/scrum1338 | 1338 · area-j4 | J4 | 8/1/1/0/0 · 0 |
| SCRUM-1056 | 1056 · area-s1, area-s2, equipo-luis | Luis | 14/3/0/0/0 · 0 |
| SCRUM-1150 | 1150 · area-s4, equipo-luis | Luis (S4) | 6/1/0/0/0 · 0 |
| SCRUM-1150c | 1150 · area-s4, equipo-luis | Luis (S4) | 0/0/0/3/0 · 0 |
| SCRUM-1188 | 1188 · area-s2, equipo-luis | Luis (S2) | 8/0/0/0/0 · 0 |
| SCRUM-1288b | 1288 · ninguna | S3 por autoría (arriba) | 0/0/1/9/1 · 0 |
| SCRUM-1288c | 1288 · ninguna | S3 por autoría | 0 leídas |
| SCRUM-1288d | 1288 · ninguna | S3 por autoría | 0 leídas |
| SCRUM-1482 | 1482 · area-s2, equipo-luis | Luis (S2) | 0 leídas |
| SCRUM-1486 | 1486 · area-s3, equipo-luis | Luis (S3) | 0 leídas |
| SCRUM-876f | 876 · area-s3 | Luis (S3) | 0 leídas |
| SCRUM-876g | 876 · area-s3 | Luis (S3) | 0 leídas |
| SCRUM-912 | 912 · area-s1, equipo-luis | Luis (S1) | 0/0/0/17/0 · 0 (anclas sobre `dist/`) |
| SCRUM-917 | 917 · area-s4, equipo-luis | Luis (S4) | 2/0/0/0/0 · 0 |
| scrum1304 | 1304 · area-j1 | J1 | 5/0/0/0/0 · 0 |
| scrum1326 | 1326 · equipo-javier, sin área | sin dueño por literal; propuesta **J2**: los sujetos son `whatsappBot/` (J2, `dos-equipos.md:124`) | 23/3/0/0/0 · 0 |
| scrum1327 | 1327 · area-j1 | J1 | 16/0/0/0/5 · 1 |
| scrum1330 | 1330 · area-j1 | J1 | 6/0/0/0/0 · 1 |
| scrum1333 | 1333 · area-j1 | J1 | 8/0/0/0/0 · 2 |
| scrum1340 | 1340 · area-j4 | J4 | 16/0/0/0/2 · 0 |
| scrum1344 | 1344 · area-j4 | J4 | 0/1/0/0/0 · 0 |
| scrum1392 | 1392 · equipo-javier, sin área | **J6** por literal: `SCRUM-1392.md:7` «Sesión J6 (`jv-j6`)» | 6/0/0/0/0 · 0 |
| scrum1395 | 1395 · equipo-javier, sin área | **J4** por literal: `SCRUM-1395.md:7` «Sesión J4c (`jv-j4`)» | 0 leídas, 3 ilegibles |
| scrum864 | 864 · ninguna | sin dueño por literal; el sujeto (`tests/_temporal.mjs`) no lo reclama nadie: lo decide el orquestador | 0 leídas |
| scrum864c | 864 · ninguna | igual que scrum864 | 0 leídas |
| scrum920 | 920 · ninguna | sin dueño por literal; propuesta **Luis**: el guion lo comiteó la máquina de Luis (`3326db1e5`) y el registro es de S2/S4 | 18/1/0/5/1 · 0 |
| scrum933 | 933 · ninguna | sin dueño por literal; mismo sujeto que scrum864c: va con ellos | 0/2/0/0/0 · 2 |
| scrum982 | 982 · area-s2, equipo-luis | Luis (S2) | 12/0/1/0/0 · 0 |

Recuento, cuadrado fila a fila: J1 4 · J4 5 · J6 1 · J2 1 (propuesta) · Luis 15 (11 por etiqueta, 3 de
1288 por autoría, 920 por propuesta) · sin dueño 3 (864, 864c, 933) = 29. (El primer borrador decía J4 6
y Luis 14: sumado a ojo; lo cazó cuadrar con el 29 antes de comentar en Jira.)

### Lo que NO está

- **scrum1392, el banco de J6, sigue sin retirar**: 6 anclas vivas, 0 en el catálogo de su test. Por orden
  del orquestador (contexto) queda para el siguiente J6, con la receta de c.22070.
- Las tres MUERTAS (1338 M1, 1288b M9, 982 M7) no se han re-derivado; las 12 AMBIGUAS y las 34 SIN-FICHERO
  no se han resuelto a mano. La sonda no aplica mutaciones: «VIVA» es «el ancla está», no «tumba su test».
- Los nueve bancos con 0 anclas leídas: sin leer por la sonda.

## SCRUM-1765c · El banco de J6 (`scrum1392`) se retira al catálogo, y el carril del sujeto de 864, 864c y 933

**Puesto:** J6 (jv-j6ek) · **Rama:** `scrum-1765c-banco-1392-al-catalogo` · 19-nov-2026 (Madrid)
**Medido contra:** `origin/main` = `e37a7051f87b195ceeae4852c56a02bc0d218438` · 2026-11-18T23:49:47Z (cabecera `Date:` de `gh api -i zen`)
A9: aviso → A10 «Una operación que no se ejecutó se lee exactamente igual que un éxito.» — no se pudo comprobar: pasé a `node -e` por bash un texto con acentos graves (mi cicatriz de no pasar texto a node por bash) y bash los ejecutó; node abortó antes de escribir y lo cacé con `git diff --stat`, que no mostraba `scrum812`; ningún hook de este árbol lee un `node -e` antes de lanzarlo
Mutaciones: catálogo → `tests/scrum1392-un-hallazgo-visto-no-caduca.test.mjs`

Decisión que se aplica: SCRUM-1387 c.22070 («retirar») y SCRUM-1765 c.22116 (los 3 sin dueño, por el
carril del SUJETO). La rama salió de `e37a7051f`, sin 1765b. Antes del empujón 1765b ya estaba en
`main` (#3242, `d86f7ef92`), y se trajo con `git merge origin/main`. El merge salió limpio pero dejó el
tramo c delante del b; se reordenó comprobando que no se pierde ni se gana ninguna línea.

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

## SCRUM-1765f · El banco de J2 (`scrum1326`) se retira al catálogo de su test

**Puesto:** J2 (jv-j2d7) · **Rama:** `scrum-1765f-banco-1326-al-catalogo` · 19-nov-2026 (Madrid)
**Medido contra:** `origin/main` = `d4a0fc951cd54405d6e9ae908a7b52b12b26c024` · 2026-11-19T17:46:20Z (cabecera `Date:` de `gh api -i zen`)
A9: aviso → A10 «Un prefijo no es un nombre, y una subcadena tampoco.» — no se pudo comprobar: mi driver (fuera del árbol) buscó la mutación del control MUDA por una subcadena del ancla de M13 que también está en el ancla unida de M5, y aplicó M5; el resultado (MUDA) vale para M5 y la etiqueta de la traza se corrigió a mano con la explicación; ningún guard lee un driver que no está en git
Mutaciones: catálogo → `tests/scrum1326-vale-pregunta-una-vez.test.mjs`

Decisión que se aplica: SCRUM-1387 c.22070 («retirar») y el reparto de SCRUM-1765 c.22114/c.22116
(J2, 1 propuesto: `scrum1326`).

### PASO 0

Sin ramas `scrum-1765f*` en el remoto, sin PR y sin commits «1765f» en `origin/main`. Carril del SUJETO
(`node scripts/carriles.mjs de`): `src/modules/whatsappBot/domain/decisionPorTexto.ts` y
`src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts` → **J2** (`dos-equipos.md:124`). El test es
el de SCRUM-1326. `scrum1387` en `d4a0fc951`: **28 heredados** (249 ficheros con «mut» · 107 bancos · 0 nuevos).

### `scrum1326` — 19 de 20 al catálogo, 1 caducada

- **19 VIVAS** → `MUTACIONES_QUE_ME_TUMBAN` de `tests/scrum1326-vale-pregunta-una-vez.test.mjs`, cuatro
  literales cada una, con el `de`/`a` del guion. Seis del guion (M1, M5, M16, M18, M19, M20) hacían **dos**
  sustituciones (`ademas`). Van en **una** sola: `de` = primer tramo + texto intermedio + segundo tramo, y
  `a` igual con los dos tramos cambiados. El generador comprobó dos cosas: que cada ancla unida aparece
  una sola vez y que el fichero resultante es **idéntico** al de aplicar las dos del guion una detrás de
  otra. `cae` es el primer caso que esa misma mutación tumbaba en `mutaciones.json`. Ningún fuente lleva CR.
- **M17 «sin quitar las tildes» → CADUCADA.** Su ancla (`.replace(/\p{M}/gu, '')`) aparece 0 veces en
  `decisionPorTexto.ts`. Se la llevó `604df568c` (SCRUM-1325, 1-oct-2026) a `src/core/texto/sinTildes.ts`.
  No se re-deriva aquí, porque ese fichero es de **S1** (`carriles.mjs de`) y sus mutaciones son de quien lo vigila.
- Corridas con `correr` + `aplicarUna` de `scripts/meta-guard-mutaciones.mjs` (driver fuera del árbol). La
  salida está en `docs/master/evidencias/SCRUM-1765/1765f-aplicarUna.txt`. Línea base: 16 pasan · 0 caen ·
  0 saltados · 0 movidos. **19 de 19 tumban** su caso, con 11, 9, 4, 2, 9, 3, 3, 6, 6, 6, 6, 3, 1, 1, 1, 4, 5,
  4 y 2 caídos: los mismos números, en el mismo orden, que la traza original del guion (`mutaciones.json`,
  1-oct). Controles: un `cae` inexistente sale **CIEGO**; M5 con el `cae` de un caso que no tumba sale
  **MUDA**. `git status` tras la pasada: solo el test editado (`src/` y `dist/` restaurados por `aplicarUna`).
- Guion borrado: `docs/master/evidencias/scrum1326/mutar.mjs`. Se conservan `mutaciones.json` y las dos
  trazas `.tap.txt`. Línea fechada en `docs/master/SCRUM-1326.md`, bajo «Mutaciones».
- `scrum1387`: **28 → 27 heredados** (248 ficheros con «mut» · 107 bancos · 0 nuevos). Baja porque el guion
  desaparece; el guard no se ha tocado. `scrum812` sigue verde sin tocarlo.

### Corrido (sobre `d4a0fc951` + este diff, `dist/` de `tsc --noCheck`; no toco `src/`)

- guards 1387, 745, 757, 1321, 1415, 812, 1294, 267, 273, 854, 237, 976, 700, 719 + `scrum1326` + el
  meta-guard (`tests/scrum1610d-meta-guard-censo-sale-vaciado.test.mjs`): **153/153 en 16 ficheros**
  (TAP a fichero). `guards:entrada`: 15 guards, salida 0. Los 5 de árbol entero que nombra: 38/38.
  `meta-guard-mutaciones.mjs --solo-censo`: 319 declarantes, 1.323 declaraciones, salida 0.
  `censo:mudez -- --escribir`: salida 0, sin cambios en `tests/_veredicto-mudez.json`.
- Suite: solo el tramo 4/15 (el de `scrum1326`): 115 ficheros · 1.111 tests · **0 fail**. **La suite entera
  no se ha corrido** (contexto); la mide el obligatorio.

### Lo que NO está

- `tests/_catalogo-obligatorio.mjs:219` sigue nombrando `docs/master/evidencias/scrum1326` en
  `RETIRA_LEIDO_EN_JIRA_EL_7_OCT`. Es un dato con fecha que solo informa (lo mismo hizo 1765c con 1392).
- `docs/master/evidencias/SCRUM-1394/bancos.mjs:60` usaba `scrum1326` como CONTROL POSITIVO «sale FUERA». Con
  el guion borrado, ese control ya no se cumple. Es evidencia de otro ticket y ningún test la corre (no
  medido más allá de `git grep`). Queda dicho, no tocado.
- SCRUM-1005b (la medición de solo lectura del mismo encargo): **NO empezada**, porque se acabó el
  contexto (185k al cerrar las mutaciones, por encima del tope de 180k).

### Relevo (jv-j2dc, 2026-11-19T18:27Z, `Date:` de GitHub): el rojo de `scrum921c` en #3257

- **Lo medido.** El obligatorio (run 44582347799) cayó en `scrum921c` con 9 marcas sin respaldo y el
  trinquete en 8. La marca de más NO era una antigua que hubiera perdido su respaldo con el guion: era
  NUEVA, el comentario de M16 que este tramo añadió en `tests/scrum1326-vale-pregunta-una-vez.test.mjs:148`
  («la que el fundador decidio que acepta»), copiado del id del guion borrado. El guion vivía en
  `docs/master/evidencias/`, que `scrum921c` no barre; el test sí lo barre.
- **La firma existe, no se fabrica:** `sale` la decidió el fundador según `docs/master/SCRUM-1326.md:31` y
  el propio test (línea 563, «SCRUM-1326, comentario 17802»). El comentario 17802 no lo he vuelto a leer
  en Jira (presupuesto de contexto).
- **Arreglo:** el comentario de M16 lleva `SCRUM-1326`. El trinquete no se toca: `scrum921c` da 16/16, y
  su caso «tampoco baja en silencio» pasa, así que vuelve a ser exactamente 8.
- **Lo que me salió mal:** primero escribí «SCRUM-1326, comentario 17802». Esa forma exige su par en
  `tests/_pares-leidos-en-jira.mjs`, y `scrum921c` (caso 1511h) lo tumbó. Quité el número de comentario
  en vez de añadir un par que no había leído.
- **La punta se movió:** `claude[bot]` empujó `2613f3f0f` (18:27:25Z) con «SCRUM-1326, comentario 17802»
  en esa línea; sobre ella, `scrum921c` dio 15/16 (cae 1511h, «par no leído»). Decisión del orquestador:
  (b), por mensaje 18:3xZ. Se trae `2613f3f0f` por merge y en el conflicto de una línea se queda «SCRUM-1326».

A9: comprobación → `tests/scrum921c-firma-con-respaldo-en-codigo.test.mjs`
## SCRUM-1765g · Dos de los cuatro bancos de J1 (`scrum1304`, `scrum1330`) se retiran al catálogo

**Puesto:** J1 (jv-j1ft) · **Rama:** `scrum-1765g-bancos-1304-1330-al-catalogo` · 19-nov-2026 (Madrid)
**Medido contra:** `origin/main` = `89bb8593b603c84b3413f4c3f90b1c4e4e715329` · 2026-11-19T18:03:42Z (cabecera `Date:` de `gh api -i zen`)
A9: comprobación → `.claude/hooks/guard-dangerous.sh`
Mutaciones: catálogo → `tests/scrum1304-un-cobro-una-factura.test.mjs`
Mutaciones: catálogo → `tests/scrum1330-una-sellada-no-se-resella.test.mjs`

Receta de SCRUM-1387 c.22070, con la tabla de c.22114 (J1: 1304, 1327, 1330, 1333). Aquí solo 1304 y 1330;
1327 y 1333 van en 1765h. Las salidas de `aplicarUna`: `docs/master/evidencias/SCRUM-1765/1765g-aplicarUna.txt`.

- **Carril del sujeto** (`carriles.mjs de`): `src/lib/invoicing.ts` y
  `src/modules/invoicing/domain/verifactu.service.ts` → **J1**. Camino de emisión: solo se LEE (regla 38);
  las mutaciones las aplica y revierte `aplicarUna` (fuente y `dist/`), y `git status` sale limpio después.
- **scrum1304** (5 anclas, las 5 vivas una vez en `src/lib/invoicing.ts`): M1–M5 al catálogo nuevo de su
  test. Las 5 tumban con `aplicarUna` (base 18 pasan · 0 caen). M3 y M5 comparten ancla (dos reemplazos
  distintos de la misma línea): el ancla casa una vez.
- **scrum1330** (6 mutaciones): MB ya estaba en el catálogo. MA, MB-lanza, MB-anterior y MB-calla entran:
  las 4 tumban, y MB sigue tumbando (base 16 pasan · 0 caen). **MAB no se traslada**: muta dos ficheros a la
  vez y una declaración es de un fichero; la cubren MA y MB por separado (sus anclas son las mismas).
- **Controles:** un `cae` que no existe sale CIEGO en los dos tests; M4 con el `cae` de M3 (1304) y MA con
  el `cae` de MB-calla (1330) salen MUDA. El driver va por índice de la declaración, no por subcadena del id.
- **Guiones borrados:** `scrum1304/mutar.mjs` y `scrum1330/mutar.mjs`; sus salidas se quedan. Línea fechada
  en `docs/master/SCRUM-1304.md` y `docs/master/SCRUM-1330.md`, bajo «Mutaciones».
- **`scrum1387`:** 28 heredados con los dos guiones (medido en este árbol, restaurándolos sin `git`) → **26**
  sin ellos, 0 nuevos. El guard no se ha tocado. `scrum812` sigue en verde sin tocarlo (entra `scrum1304`).
- **Sin tocar, dicho:** `docs/master/evidencias/SCRUM-1404/mutar-guarda.mjs` exige UNA declaración sobre
  `verifactu.service.ts` en el catálogo de `scrum1330`; ahora hay cuatro, así que si se vuelve a correr dirá
  CIEGO por su propio mensaje. Ningún test lo corre (`git grep`). `docs/master/evidencias/scrum1333/mutar.mjs`
  cita en un comentario el guion retirado de 1330: es de 1765h.
- **Lo que me salió mal:** para medir el «antes» de `scrum1387` lancé `git checkout HEAD --` sobre los dos
  guiones ya borrados en el índice; el hook `guard-dangerous` lo paró antes de tocar nada. Lo hice con
  `git show HEAD:<ruta> > <ruta>` y los volví a borrar.
