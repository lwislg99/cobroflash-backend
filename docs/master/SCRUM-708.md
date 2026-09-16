# SCRUM-708 · Los cuatro huecos del detector de tests mudos — medidos, y tres cerrados

**Medido contra:** `origin/main` = `fd290d4aef3a168c11c02a8f191cf4304f98a65e` · 2026-09-08T12:44:00+02:00
**Rama:** `scrum-708-huecos-del-detector`

> La pregunta del encargo no era «arréglalos»: era **cuántos siguen siendo huecos y cuántos son
> defectos disfrazados de hueco**. Se midió primero, se paró, y sólo después se tocó nada.

---

## 0 · PASO 0

Cero commits y cero referencias a SCRUM-708 en el árbol — la única aparición era su línea en
`docs/verificacion/asuntos-jira.tsv`. `docs/master/SCRUM-708.md` no lo estaba escribiendo nadie.

Los cuatro huecos **no estaban en `docs/master/SCRUM-702.md`**: se recuperaron literales de Jira.
Y `main` se movió durante la medición (`56fed423` → `f1c84a8a`, con 5 ficheros de `tests/` y
`scripts/` tocados), así que **los tres barridos estáticos se repitieron sobre el main nuevo**.
Mismo resultado.

## 1 · El veredicto: **tres huecos, un defecto**

| | el hueco declarado en SCRUM-702 | veredicto |
|---|---|---|
| ① | el fichero renombrado no tiene detección directa | **hueco, sin víctima** → ahora **cerrado** |
| ② | el detector nunca se probó sobre un caso vivo | **nunca fue defecto** → **cerrado por medición** |
| ③ | el censo mira cuatro señales; otra forma se le escaparía | 🔴 **DEFECTO: ya se le escapaba una** |
| ④ | la refutación se apoya en dos árboles | **cerrado, y sin el tercer árbol** |

### ① El fichero renombrado — hueco de verdad, y ya no hace falta que lo sea

`npm test` expande `tests/*.test.mjs`: **plano, sin recursión**. Barridos 1.217 ficheros de código
del árbol, clasificando por AST (importa `node:test` **y** llama a `test`/`it`/`describe`):

```
registran tests y SÍ los corre npm test  →  749
registran tests y NO los corre nadie     →    0
```

Control positivo ✅ y control negativo del patrón ✅ (`tests/sub/x.test.mjs` y `tests/x.mjs` caen
fuera). **Sin víctima.** Pero un hueco sin víctima y sin instrumento es un hueco que dentro de dos
semanas se vuelve a leer como pendiente, así que **se cierra en vez de declararse**:
`tests/scrum708-el-fichero-que-no-corre.test.mjs`.

🔴 **Y el total ya no podía verlo, aunque quisiera.** La tanda tiene 751 ficheros con **8,1 tests de
media y un máximo de 25**: perder un fichero entero mueve `# tests` entre 1 y 25. **Cualquier margen
de suelo se lo come.** La cifra agregada no puede, por construcción, ver la pérdida de un fichero.

> 🔒 Los dos lados del guard nuevo se miden **sobre el mismo árbol y en el mismo instante**: quién
> registra tests, y a quién se lo pasa la tanda. No hay número declarado, así que no hay nada que
> envejezca. Y el patrón **se deriva del `test` de `package.json`**, no se copia: si de ahí no sale
> ninguno, el guard se declara CIEGO en vez de decir «cero fuera».

### ② El detector nunca probado en vivo — cerrado por medición

Se corrió la tanda entera con reporter TAP y se le dio el TAP real a `ficherosMudosDelTap()`:

```
TAP real del 8-sep-2026 sobre `56fed423`:  # tests 6183 · # pass 6077 · # fail 0 · # skipped 106
ficherosMudosDelTap(TAP real)                       →  0
control positivo, SOBRE EL MISMO TEXTO REAL         →  cebo inyectado, 0 → 1  ✅
```

**El cero es medido, no ciego** — que era exactamente lo que el hueco pedía. Y de propina, el suelo
se portó: con el TAP a medias (la tanda aún corría) devolvió `SALIDA_NO_SUPE_MIRAR`, no «0».

### ③ 🔴 El censo de cuatro señales — ERA UN DEFECTO

Veía **14 de 14, justo en su propio tope**. Y se le escapaba, ese mismo día:

```
tests/_banco-camino-real.mjs:125
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
```

**No es una lectura cualquiera.** Ese banco monta la app REAL para medir **permisos**, y `NODE_ENV`
decide **qué app se monta**: `/dev` (`app.ts:371`), `/outbox` (`app.ts:186`), el `isProd` de
`authMiddleware.ts:80`, el modo de MercadoPago y los `throw` de `env.ts`. Con `NODE_ENV` puesto, ese
banco mediría **otra superficie** — y su propia cabecera dice que eso, en un test de permisos, «es lo
peor que puede pasar».

Hoy no diverge: ni `ci.yml` ni el arranque local fijan `NODE_ENV`. Pero **«hoy no diverge» y «no
puede divergir» no son lo mismo**, y el censo no podía notar la diferencia porque no miraba.

> 🔒 Y ése es el patrón, no el descuido: las señales están **partidas a propósito** para que el censo
> no se cace a sí mismo, y ese mismo cuidado es lo que deja la lista cerrada en cuatro.
> **Lo que protege la lista de la autorreferencia es lo mismo que impide que crezca.**

⛔ El blindaje **no se ha tocado**: es correcto. Lo que se ha ampliado es lo que MIRA.

### ④ La refutación sobre dos árboles — cerrada, y sin el tercer sistema operativo

No hacía falta un tercer árbol, porque la propiedad tiene **causa medible desde cualquier máquina**:

> 🔒 `# tests` sólo puede cambiar entre entornos si una lectura del entorno decide que un test **SE
> REGISTRE**. Un `skip` no vale: un test saltado se registra igual y suma — por eso `# skipped` va
> aparte.

Medido por AST sobre los **1.009 `.mjs`** de `tests/` y `scripts/` (`if`, ternario y `&&`, siguiendo
también las variables que nacen del entorno): **0 ficheros condicionan el registro de un test al
entorno.** Con control positivo del instrumento: un cebo `if (process.env.CI) test(…)` sí sale.

Y el caso que quedaba fuera de ese barrido —un fichero que **reviente al cargar** en otro SO— **lo
caza el propio detector de mudos**: `node --test` emite `not ok N - fichero.test.mjs`.

*Alcance honesto:* no cubre un registro **dinámico** sobre una colección que dependa del entorno. No
se ha encontrado ninguno, pero tampoco se ha barrido como tal.

## 2 · 🔴 Y MI PROPIO INSTRUMENTO MINTIÓ PRIMERO

El primer barrido del ③ acusaba a **dos** ficheros. Uno era falso positivo mío:

```js
// tests/scrum226-url-credencial-en-argv.test.mjs:179
assert.equal(argvConCredencial("spawnSync('psql', [process.env['DATABASE_URL']]);").length, 1);
```

Eso está **dentro de un literal de cadena, como dato de prueba**. `soloCodigo` quita comentarios,
**no literales**. Se rehizo vaciando también los literales por AST, **con control positivo del
filtro**: esa cadena tiene que verse con el filtro del censo y desaparecer con el mío. Sin ese paso,
el informe habría entregado un defecto de más.

> 🔒 Un instrumento que cuenta la cadena que un test usa **como ejemplo** acusa al censo de un hueco
> que no tiene. Es la misma familia que la autorreferencia de SCRUM-693: el filtro correcto depende
> de qué se está preguntando.

## 3 · El suelo: **no era del encargo, y era lo más roto que había**

```
SUELO_TESTS declarado el 2-sep = 4798   ·   tanda real del 8-sep = 6246   ·   margen +1448
```

Se podían perder **mil cuatrocientos cuarenta y ocho tests** y seguía verde.

🔴 **Y no es que nadie pudiera verlo.** Ese guard **imprime el margen en cada ejecución de CI**,
declarado en su propia cabecera como la compensación de ser un número a mano: *«un suelo rancio tiene
que verse sin que nadie vaya a buscarlo»*. Llevaba **seis días imprimiéndolo**.

Y su propio precedente sigue vivo: **el `SUELO_TOTAL` de `_evidencia-tanda.mjs` sigue donde se escribió** con la
tanda en más de 6.000 — meses después de quedar declarado rancio POR ESCRITO en el fichero de al lado.

> 🔒 **La compensación elegida era IMPRIMIR, y está medido dos veces que imprimir no basta.**

### La respuesta a «¿puede no depender de que alguien se acuerde?» — sí, y ya existía

**No hacía falta inventar nada: la casa lo resolvió en SCRUM-810** (`scripts/_suelo-contra-main.mjs`),
que deriva el suelo de la **base de fusión con `main`** en vez de declararlo, y cuya cabecera dice
literalmente *«Y NO CADUCA: main se mueve solo, así que la referencia se pone al día sin que nadie se
acuerde de subir un número»*. Tenía un registro de poblaciones con tres entradas y **le faltaba justo
la que peor estaba**.

Se ha añadido **`tests-declarados`** a ese registro. Y se ha cumplido la obligación que dejó fuera a
`bocas-de-emision` — **medir el impacto antes de conectar**:

```
40 últimos commits de origin/main (7-8 sep 2026):  5793 → 6098 tests · 720 → 752 ficheros
BAJA en 0 de los 39 pasos  ·  y la sonda SÍ se mueve (+305), o sea que el cero no es ceguera
```

**Ni una falsa alarma en la historia reciente.** Y el rojo, provocado: quitando un fichero de test del
árbol, el suelo derivado dice **«LA POBLACIÓN «tests-declarados» HA PERDIDO CONTRA LA BASE DE FUSIÓN:
6093 → 6090»**. Habla a la pérdida NETA de uno, donde el número declarado necesitaba mil cuatrocientos cuarenta y ocho.

⚠️ **No sustituye al número declarado**, y por eso éste sigue donde estaba conceptualmente: aquél es
el suelo de **ceguera** (un TAP a medias, una tanda que ni arrancó), y éste es el otro — la pérdida
contra la base, a la primera. El número se ha subido igualmente **a 6246** (margen 0 al declararlo), con todo esto escrito al lado.

## 3bis · 🔴 Y el guard de cifras me cazó a MÍ, escribiendo esto

`scrum737` se puso rojo con mi propio cambio: **83 cifras sin ancla, y el censo estaba en 81.** Las
dos eran mías, en la misma línea del comentario que documenta el impacto medido — la fecha estaba en
la línea de ARRIBA, y ese detector va **por línea**.

El arreglo NO fue subir `CENSO_CONGELADO`, que es exactamente lo que su mensaje prohíbe («NO lo
actualices al valor de hoy: eso reproduce el defecto mañana»). Se reformuló para que cada cifra viva
en una línea que dice de cuándo es. Censo de vuelta en 81, **el mismo que la base**.

> 🔒 Escribiendo el registro de un ticket sobre cifras que caducan, escribí dos cifras que caducan.

## 4 · Lo construido

| fichero | qué |
|---|---|
| `tests/_poblacion-de-tests.mjs` | **nuevo** · quién registra tests y cuántos, por AST, en UN solo sitio (lo usan los dos guards) |
| `tests/scrum708-el-fichero-que-no-corre.test.mjs` | **nuevo** · el ① cerrado: detección directa del fichero renombrado |
| `tests/scrum702-suelo-misma-poblacion.test.mjs` | el ③ arreglado (señal + tope 14→15 + causa al lado) y el ④ declarado con su medición |
| `tests/scrum810b-los-suelos-derivados.test.mjs` | la población `tests-declarados` conectada al suelo que no caduca |
| `scripts/_suelo-de-la-tanda.mjs` | suelo subido con su margen escrito, y el mensaje ya no manda deducir el ① de este número |

## 5 · Verificación — los rojos, provocados uno a uno

| | |
|---|---|
| 🔴 **③** | quitando `NODE_ENV` de `SENALES`, cae el control nuevo. **Y el test del tope se queda VERDE** (14 ≤ 15): ésa es la prueba de por qué el control va anclado al FICHERO y no al número — si no, el hallazgo se deshacía solo y en silencio |
| 🔴 **①** | renombrando `tests/scrum480-fin-de-linea.test.mjs` → `.mjs` de verdad (`git mv`), el guard cae **nombrando el fichero**. Restaurado y verde |
| 🔴 **suelo derivado** | sacando un fichero de test del árbol, habla y da los dos números. Restaurado y verde |
| ✅ **controles positivos** | el barrido del ① **se ve a sí mismo** (si no, está mirando otro sitio); el censo del ③ sigue viendo `scrum480`; el detector del ② ve un cebo inyectado en el TAP real |
| ✅ **controles negativos** | el clasificador no cuenta `re.test(s)`, ni un `import` sin llamada, ni un test **comentado**, ni un fuente de ejemplo dentro de una cadena |
| ✅ **la tanda** | 6246 tests · 6139 en verde · **1 fallo**, y ese fallo es de `main` (§6) · 106 saltadas |
| ✅ **entrada** | `npm run guards:entrada` · 21 de 21 |

## 6 · ⚠️ Un rojo de `main` que NO es de este ticket, y queda dicho

`tests/scrum753-censo-de-alcanzabilidad.test.mjs` falla **con el árbol limpio**, comprobado
apartando todos mis cambios y volviéndolos a poner:

```
SCRUM-753 · 🔴 las DOS reglas rama→ticket siguen de acuerdo (SCRUM-387 vs SCRUM-738)
  actual:   [ { rama: 'revert-1192-scrum-824b-el-vigia-que-no-deja-pasar', a: 824, b: null } ]
  expected: []
```

Lo provoca una **rama remota que GitHub genera al revertir un PR**: `revert-1192-scrum-824b-…`.
`numeroDeClave` lee 824 y `numeroDeRama` no lee nada, porque el `scrum-824b` ya no va al principio
del nombre. No es un defecto de este ticket y **no se toca desde aquí**: tocar esas dos reglas es del
carril de SCRUM-387/738. Queda escrito con su fecha para que la siguiente sesión que vea ese rojo no
gaste una tanda en diagnosticarlo.

## ⛔ No tocado

El blindaje de señales partidas del censo · `HASH_VIEWS` · `_evidencia-tanda.mjs` (su `SUELO_TOTAL`
queda **declarado aquí**, no arreglado: es otra población y otro ticket) · el lector de
declaraciones de SCRUM-757 · `RETIRADAS_A_PROPOSITO`, que sigue vacía · ningún rótulo · `src/`.

**Y no se declara `MUTACIONES_QUE_ME_TUMBAN` en el guard nuevo, a propósito:** el defecto que vigila
es **renombrar un fichero**, y una mutación de SCRUM-745 es una sustitución de texto — no puede
imitarlo. Media declaración parece cobertura, así que no se pone ninguna y queda dicho por qué.
