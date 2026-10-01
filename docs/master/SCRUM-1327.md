# SCRUM-1327 · Un guard no decide con qué sale, ni cuándo deja de mirar

**Medido contra:** `origin/main` = `bee39d3b51e300ff4efdda3befcb1eff4626f988` · 2026-10-01T06:16:24Z

A9: comprobación → `tests/scrum1327-el-veredicto-no-se-decide-a-mano.test.mjs`

Sesión J5d (relevo de J5c), por encargo del orquestador del equipo de Javier (`cobroflash-backend-5b`).

## Ⓐ Cruce de carril, y qué ficheros se tocan bajo qué lectura

El ticket lleva `area-j1` y el puesto J5 no construye producto. La excepción, literal del
orquestador (1-oct-2026, también en el comentario 17774 de Jira):

> Cruce de carril autorizado por el orquestador el 1-oct-2026: SCRUM-1327 es `area-j1` y se asigna a
> J5 porque el árbol de J1 está ocupado con #2053 —la guarda del sellado, que es la tarea más delicada
> de la ronda— y éste era el árbol libre con el contexto adecuado: J5 construyó anoche el guard de
> SCRUM-1323 y conoce la doctrina de verde / CIEGO / rojo que 1327 generaliza.

La ficha del puesto (`docs/equipo/puesto-j5.md`, «Lo que NO tocas») dice, literal: «**Código**: ni
`src/` ni `public/`». Este PR no toca ninguno de los dos.

**Ficheros tocados, y la lectura bajo la que se tocan.** `dos-equipos.md` §3 asigna `scripts/` a la
S0 y los instrumentos de `tests/` a la S3, las dos del equipo de Luis. La lectura del orquestador de
Javier —**suya, no una norma escrita, y subida al fundador para que la resuelva con Luis**— es que esa
asignación cubre los instrumentos de la S0, no todo lo que viva en la carpeta: un guard que nació en un
ticket de este equipo lo mantiene este carril. Bajo esa lectura:

| fichero | de qué ticket viene |
|---|---|
| `scripts/_hallazgos-y-ciegos.mjs` (se AÑADE `recorrerCasos`; `veredictoDe` no cambia) | SCRUM-1320 (J1b) |
| `scripts/guard-caja-datos-del-cliente.mjs` | SCRUM-589 |
| `scripts/guard-caja-documento-suelto.mjs` | SCRUM-776 / 875 |
| `scripts/guard-portal-en-la-ficha.mjs` | SCRUM-795 |
| `scripts/guard-aviso-bizum.mjs` | SCRUM-515 |
| `scripts/guard-vias-de-cobro.mjs` | SCRUM-519 |
| `scripts/guard-firma-con-tramos.mjs` | SCRUM-892 |
| `tests/_salidas-de-guard.mjs` (se AÑADEN `comoSale`, `censoDeSalidas`, `SALEN_A_MANO`) | SCRUM-1320 (J1b) |
| `tests/scrum1320-hallazgo-y-ciego-no-son-excluyentes.test.mjs` (su lista pasa a derivarse) | SCRUM-1320 (J1b) |
| `tests/scrum1327-el-veredicto-no-se-decide-a-mano.test.mjs` (nuevo) | éste |

**No se toca:** `scripts/meta-guard-mutaciones.mjs`, `aplicarUna`, ni el banco de mutaciones de la
casa (fuera de la excepción). Tampoco `guards-visuales.mjs`, `package.json`, ningún workflow, `src/`,
`public/` ni el camino de emisión.

## Ⓑ PASO 0 — el defecto ocurre hoy, CORRIENDO

Población: 40 `scripts/guard-*.mjs`. Antes de este PR, 21 salían por `veredictoDe` y 19 a mano.

Línea base, los seis sin tocar, con navegador real y `dist/` recién compilado: **6 de 6 salen 0**.

El defecto se ve rompiendo el producto a mano y corriendo el guard de verdad
(`docs/master/evidencias/scrum1327/rojo-en-navegador.mjs`; deshace con la edición inversa y comprueba
por sha256 que cada fichero vuelve a su sitio; `porcelain` vacío al terminar). Ocho pasadas, las
mismas antes (`258fc29b`) y después del arreglo:

| pasada | la rotura | ANTES | DESPUÉS |
|---|---|---|---|
| g1 · `caja-datos-del-cliente` | ciego a 929 px y, **detrás**, la nota no cabe a 390 px | **2** · la nota no aparece | **1** · 2 hallazgos · 2 ciegos |
| g1 · `caja-documento-suelto` | ciego a 929 px y, **detrás**, el título no cabe a 390 px | **2** · el título no aparece | **1** · 1 hallazgo · 2 ciegos |
| g1 · `portal-en-la-ficha` | «SIN token» ciego y, **detrás**, «CON token» sin botón | **2** · «CON token» ni se mide | **1** · 1 hallazgo · 1 ciego |
| g2 · `aviso-bizum` | la ranura del aviso no existe en ningún caso | **1** | **2** · 0 hallazgos · 4 ciegos |
| g2 · `vias-de-cobro` | la ranura del aviso no existe en ningún caso | **1** | **2** · 0 hallazgos · 8 ciegos |
| g2 · `firma-con-tramos` | «aceptar» no envía nada en ningún modo | **1** | **2** · 0 hallazgos · 5 ciegos |
| positivo · `caja-datos-del-cliente` | la nota no cabe a 390 px, sin ningún ciego | 1 | 1 · 2 hallazgos · 0 ciegos |
| positivo · `portal-en-la-ficha` | «CON token» sin botón, sin ningún ciego | 1 | 1 · 1 hallazgo · 0 ciegos |

En el grupo ① **el ciego va delante del hallazgo**, que es lo que hace que la pasada pruebe algo: el
caso ciego es el primero que recorre cada guard (929 px va antes que 390; «SIN token» antes que «CON
token»). Lo que dijo cada guard, entero, está en `antes-*.txt` y `despues-*.txt` de esa carpeta.

Los seis limpios, después del arreglo: 6 de 6 salen 0, y los seis dicen `0 hallazgos · 0 ciegos`.

## Ⓒ Lo que cambia

**El recorrido, en un sitio.** `recorrerCasos(casos, juzgarCaso)` en `scripts/_hallazgos-y-ciegos.mjs`
recorre todos los casos y junta las dos cuentas. Un caso ciego se apunta y se sigue; un caso que lanza
es un ciego de ese caso; cero casos es un ciego, no un verde; y un juez que no devuelve sus dos listas
lanza. Los tres del grupo ① dejan de tener bucle propio: quien lo escribe a mano elige cuándo dejar de
mirar.

**Grupo ①.** `noSupeMirar()` hacía `process.exit(2)` desde dentro del bucle (las dos cajas) o un
`break` (el portal). Ahora cada caso devuelve sus cuentas. En `caja-documento-suelto` cada pantalla
(listado, página) es un caso, y una caja que no se puede medir deja ciega esa caja y no la pantalla.
En `portal-en-la-ficha` el juicio pasa a ser de cada caso: antes necesitaba los dos medidos.

**Grupo ②.** Los bucles ya apuntaban los ciegos y seguían; el defecto era la cola, que salía con 1 y,
con ciegos, no imprimía los fallos. Ahora imprimen las dos listas y sale lo que diga `veredictoDe`. En
`firma-con-tramos`, además: un caso que no llegó a enviar es ciego y no «firma sin trazo», y si el
control no dibuja no se juzga «3 opciones» (antes no hacía falta decirlo: cualquier ciego salía antes
de mirar las malas).

**Los seis** dicen su línea de las dos cuentas también en verde.

**Cambio de comportamiento que no pedía el ticket, y se dice:** un caso que LANZA (el navegador se
cae a mitad) en los tres del grupo ① salía con 1 por excepción sin capturar; ahora es un ciego de ese
caso y los demás se miden. Sigue sin ser verde: la puerta falla igual con un 2.

## Ⓓ El ④ — lo que impide la séptima vez

**La regla:** un `scripts/guard-*.mjs` sale sólo con el `.codigo` de un `veredictoDe(...)`. Todo lo
demás es «a mano» y va declarado.

`comoSale(fuente)` (`tests/_salidas-de-guard.mjs`) lo lee por AST y cuenta como salida a mano:

- `process.exit(<lo que sea>)` o `process.exitCode = …` que no es ese `.codigo` — un literal, una
  constante, una variable, o el `.codigo` de un objeto que no viene de `veredictoDe`;
- una salida, también por `.codigo`, a la que se llega **desde dentro de un recorrido**: escrita en un
  bucle, en el juez de `recorrerCasos`, o en una función local llamada desde ahí. Es la forma del
  grupo ①, y con `veredictoDe` puesto ningún otro lector la vería;
- una cuenta escrita a mano en `veredictoDe({ hallazgos: 0, … })`.

**«No lo sé» no es «decide bien».** Un fichero que no se puede leer como programa, o al que no se le
encuentra ninguna salida, sale ROJO diciéndolo. **No hay lista que lo excuse.**

**La lista es una:** `SALEN_A_MANO`, con el número exacto de salidas de cada guard y su motivo. Las dos
mitades: ni entra un guard (o una salida) sin declarar, ni queda una entrada o un número de más. La de
SCRUM-1320 ya no se escribe: se deriva de ésta por la marca `eligeEntreCiegoYHallazgo`, y un test
comprueba que la marca coincide con lo que `defectosDe` encuentra.

Lo que dice el censo en cada pasada, también cuando todo es cero:

```
[SCRUM-1327] POBLACIÓN: 40 guards · 23 salen sólo por `veredictoDe` · 17 salen a mano (25 salidas) · 0 de los que NO SÉ cómo deciden
[SCRUM-1327] pintan el ciego de hallazgo, SIN ARREGLAR (SCRUM-1336): 6 de 17 declarados (…)
[SCRUM-1327] ⚠️ LO QUE ESTE CENSO NO MIRA: no sigo imports … · no veo un `throw` sin capturar … · de `veredictoDe(x)` sólo miro las cuentas si `x` es un objeto literal · y su población es `scripts/guard-*.mjs` …
```

## Ⓔ Los límites

1. **No sigue imports.** Una salida escrita en un módulo importado no se ve.
2. **No ve un `throw` sin capturar**, que sale con 1. `guard-rastro-del-menu.mjs` tiene su suelo así.
   Un guard cuya ÚNICA salida fuera un `throw` no pasa en silencio: no tiene ninguna salida
   reconocible y cae por «no lo sé» (mutación C2).
3. De `veredictoDe(x)` sólo mira las cuentas si `x` es un objeto literal.
4. **Población:** `scripts/guard-*.mjs`. Fuera: `guards-entrada.mjs`, `guards-visuales.mjs` y los
   `_prisma-*-guard.mjs`.
5. **Lo que sólo prueba el navegador:** que el caso real ponga ciego a cada guard y lo vea salir bien.
   `npm test` comprueba por AST que los seis llaman a `recorrerCasos` y `veredictoDe`, no los ejecuta.
   La regla nueva de `firma-con-tramos` (Ⓒ) no tiene test fuera del banco de navegador.
6. Los tres del grupo ② conservan su bucle propio: si su navegador lanza a mitad, salen con 1 por
   excepción, como antes.

Los cuatro primeros salen en la salida del censo, no sólo aquí.

## Ⓕ Mutación

`docs/master/evidencias/scrum1327/mutar.mjs`, comiteado antes de correrlo. Base sin mutar primero:
22 tests, 0 caídos. Cada fila la decide el NOMBRE del test que tenía que caer.

**POBLACIÓN = 23 mutaciones · CAZADA = 23 · MUDA = 0 · OTRA = 0 · CIEGA = 0.** Base tras deshacer:
22 tests, 0 caídos; `porcelain` vacío. Tabla en `mutaciones.json` y `mutaciones-traza.txt`.

| grupo | qué se rompe | filas |
|---|---|---|
| R · el recorrido | corta al primer ciego · corta si un caso lanza · cero casos da verde · acepta una frase por lista | 4 |
| S · los seis | salir con 1 a mano · cerrar dentro del recorrido · dejar `recorrerCasos` · callar las cuentas en verde | 4 |
| C · el censo sobre el árbol | un guard nuevo que decide solo · uno nuevo sin ninguna salida · una salida nueva en uno declarado · un número con holgura · una entrada caduca | 5 |
| L · el lector | cualquier `.codigo` vale · no ve el recorrido · no ve `exitCode` · no ve la cuenta a mano · «sin salidas» deja de ser «no lo sé» | 5 |
| F · el censo como función | calla los «no lo sé» · sólo ve números que suben · pierde las caducas · calla los sin declarar | 4 |
| U · la lista única | una marca que miente | 1 |

**Lo que NO se mutó, y por qué:** la regla nueva de `firma-con-tramos` y los textos que imprime cada
guard, que ningún test de `npm test` ejercita (límite 5).

## Ⓖ Hallazgo de alcance — SCRUM-1336, sin tocar

El ticket nombraba tres guards en el grupo ②. Leyendo los cuarenta, la misma forma —un «no supe mirar»
que acaba en el mismo 1 que el defecto— está en **seis más**: `a11y-comparativa`, `a11y-landing`,
`objetivo-tactil`, `contraste`, `marcadores-en-pantalla` y `duplicar-926`. **Leído en el fuente, no
ejercitado en ciego.** El censo de SCRUM-1320 no podía verlos: busca una salida de ciego Y otra de
hallazgo, y quien pinta el ciego con el mismo 1 no deja salida de ciego que encontrar.

Aquí no se arreglan: van declarados uno a uno en `SALEN_A_MANO` con la marca
`pintaElCiegoDeHallazgo`. SCRUM-1336 consiste en vaciar esas entradas.

Candidato a esa cola, también leído y no ejercitado: `guard-rastro-del-menu.mjs`, cuyo suelo («menos
de 17 destinos: está ciego») es un `throw` (límite 2).

## Ⓗ Lo que me salió mal

1. **Una rotura mía colgó el guard.** Para dejar ciego a `firma-con-tramos` cambié el `click` del
   botón por `dblclick`: el guard no terminó y el banco lo cortó a los 240 s (`EXIT=null`). Había
   predicho «todo ciego». La cambié por otra (la URL del envío) y repetí la pasada de «antes» entera.
2. **Leí una traza vieja como si fuera nueva.** Encadené un `grep -c` de comprobación con el commit
   y con el banco de mutaciones; el `grep` dio 0, la cadena se cortó y el banco NO corrió. La traza
   que leí era la de la pasada anterior. Lo delató la población: decía 21 y había 23 mutaciones.
   Repetido borrando la traza antes y con el banco en su propio comando.
3. **Tres veces pasé texto con acentos por un heredoc de bash**, que revienta. Falló cerrado (no se
   ejecutó nada), pero está apuntado en la memoria de esta máquina desde hace días y lo repetí.
4. Un guion mío dejó la línea de las cuentas de `vias-de-cobro` sin la sangría de sus vecinas; lo
   encontró el recuento de la mutación S4 antes de correrla.

Lo primero y lo segundo los cazó un instrumento que dice su población, no una relectura.

## Ⓘ Verificación

Sobre `origin/main` = `08f37ae000397facc48c286fa354ffa7ce202039`, mergeado en la rama (1-oct-2026 ~06:40Z).
Entre el punto de rama y ese merge, `main` no cambió ningún `scripts/guard-*.mjs` ni ningún fichero de
los que toca este PR; la población del censo sigue siendo 40.

- `prisma generate` y `npm run build`: salida 0 los dos, ANTES de los tests.
- Los dos ficheros del ticket: 22 tests, 22 pasan.
- **Suite completa** (con el turno del orquestador; TAP a fichero fuera del árbol, leído en un segundo
  comando): **1.154 ficheros · 9.548 tests · 9.410 pasan · 3 caen · 135 saltados**.
  - Dos de los tres eran MÍOS, y son el mismo: `SCRUM-480` y `SCRUM-533` (ni un CR en disco) acusaban a
    `evidencias/scrum1327/antes-g1-caja-documento-suelto.txt`, que guardó cuatro CR de lo que Windows
    escribe al matar el navegador. Arreglado quitando esos cuatro bytes (479 → 475) y haciendo que el
    banco no los guarde. Vueltos a correr los dos tests: en verde (abajo).
  - El tercero NO es de este PR: `SCRUM-1266b · corregir una descripción y «Añadir estas líneas» del
    dictado`. Cayó una vez dentro de la suite completa y pasa 3 de 3 corrido solo (15 tests, 15 pasan).
    Este PR no toca nada del dictado. Reportado al orquestador; no se toca.
- Después del último cambio: los tests de CR, los dos del ticket y los guards de suite — ver el
  comentario de entrega en Jira, que lleva las cifras de la última pasada.

Y un quinto error mío, que va con los de Ⓗ: **comiteé evidencias en `docs/` sin contrastar sus CR contra la
regla del repo.** Los conté (la tabla de bytes los enseñaba: «CR 4») y no hice nada con el número. Lo
cazó la suite completa, no yo.
