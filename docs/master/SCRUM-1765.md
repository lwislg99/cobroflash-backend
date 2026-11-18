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
