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
