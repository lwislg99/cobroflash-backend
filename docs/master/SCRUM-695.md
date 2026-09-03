# SCRUM-695 · Los cuatro tests que se fueron — y el recibo que NO debe entrar en git

**Fecha:** 2-sep-2026 · **Carril:** S3 (instrumentos) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `f803ec1e4ba189041a34d017fbf890081331ce45` · 2026-09-02T22:10:48+01:00

**Tanda:** 4798 tests, 4714 pass, **0 fail**, 84 skipped — medida DESPUÉS del último cambio, con `main` dentro por segunda vez (entró SCRUM-584, que subió el suelo a 4798). Lo único posterior es esta línea.

---

El encargo traía dos mitades, y **la medición cambió la forma de las dos**: la ① se cierra sin
restaurar nada, y la ② se construye —pero **no como se pidió**, porque tal y como se pidió estaba
prohibido por una decisión ya escrita. Este ticket no añade una línea a `src/` ni a `tests/`: un
veredicto, y una condición en `ci.yml`.

## 🛑 Mitad ① · Antes del hallazgo, el SUELO del método

El encargo avisaba: *«si tu diff no enseña ninguna retirada, estás mirando el commit equivocado»*.
Pasó exactamente eso.

    git show ec1845cd -- tests/scrum498-cifra-derivada.test.mjs   →  0 retiradas

**`ec1845cd` es un MERGE** (`878bfd9e` + `a8850075`, PR #932). `git show` sobre un merge imprime el
diff **combinado**, que oculta lo que sólo cambió en una de las ramas. Con el instrumento correcto:

    git diff ec1845cd~1 ec1845cd -- <fichero>   →  4 retirados, 0 añadidos

Sin ese suelo, la respuesta habría sido «no encuentro nada» — y habría sido falsa.

## Qué vigilaba cada uno

Los cuatro giran sobre **el mismo sujeto**: `AFIRMACIONES`, el registro de frases del árbol que
escribían **a mano** el tamaño de la población de modelos con `merchantId`.

| Retirado | Qué vigilaba |
|---|---|
| `🔴 CONTROL POSITIVO: con el esquema tal cual…` | que hoy no hubiera ninguna frase ya caducada |
| `🔴 ninguna afirmación atada está CIEGA` | que ninguna frase hubiera cambiado de redacción dejando al guard mirando a la pared |
| `🔴 EL ENSAYO DEL DÍA D` | que al entrar `EmailMessage` las doce frases cayeran **nombradas** |
| `el registro cubre los ocho ficheros del encargo` | que las ocho fuentes con frases estuvieran atadas, y cuál quedaba fuera |

## ✅ Veredicto: DELIBERADO — y además, OBLIGATORIO

**El motivo ya estaba escrito**, y no sólo en el mensaje del commit (*«SCRUM-498 se retira con su
motivo, y el hecho sigue vigilado»*): está en la **cabecera del propio fichero**, con los cuatro
nombres y el porqué. Un test retirado con su motivo en el sitio donde alguien lo buscaría no es
cobertura perdida.

**Se quedaron sin sujeto.** SCRUM-680 hizo que las doce frases **dejaran de decir un número** —
donde hacía falta saber *cuáles*, se nombran (`Quote` e `Invoice`), y una frase sin número no se
desincroniza. Medido hoy: `AFIRMACIONES` tiene **0 entradas**, y un barrido del árbol buscando prosa
que cite el recuento no devuelve **ninguna afirmación viva**: la única aparición del «23» está en
`portabilidadCompleta.ts` y es el **relato del defecto cazado**, no una afirmación.

### 🔴 Y no era optativo: mantenerlos era imposible

Vaciar un registro tiene la forma exacta de *ajustar el guard al código*, así que no basta con que el
motivo esté escrito. **Se resucitó el fichero de antes de la retirada y se corrió contra el registro
de hoy:**

    # tests 9 · # pass 7 · # fail 2
    not ok 7 — EL ENSAYO DEL DÍA D
    not ok 8 — el registro cubre los ocho ficheros

* **Dos se quedan en VERDE HUECO** (`CONTROL POSITIVO` y `CIEGAS`): con el registro vacío recorren
  cero frases y no encuentran cero problemas. Pasan **porque no miran nada**, que es la peor
  variante de verde que hay.
* **Dos se ponen ROJOS Y SE QUEDAN ASÍ.** El ENSAYO cae con `🔴 el rojo no NOMBRA qué frase se quedó
  vieja`: sin frases atadas, el día D no derriba nada que se pueda nombrar.

Mantener los cuatro no era «más cobertura»: eran **dos rojos permanentes y dos verdes que mienten**.

> Predicción escrita antes de medir: tres verdes huecos y un rojo. **Medido: dos y dos.** Se deja
> dicho porque el ENSAYO no cae por lo que yo suponía, y la diferencia la dio ejecutarlo.

### El hecho sigue vigilado — probado por el mecanismo, no por el comentario

La cabecera **afirma** que otro guard cubre el hecho. Una afirmación se mide:

    inyectado en prisma/schema.prisma:  model CuadernoDeObra { merchantId Int }
    node --test tests/scrum172-cobertura-tenancy.test.mjs

      🔴 Modelo(s) con `merchantId` que NADIE barre:
         · cuadernoDeObra

Cae, y **lo nombra**. Retirada la inyección: verde (4/4) y el árbol sin rastro. `scrum172` deriva del
**esquema**, no de la prosa, así que no envejece. La otra mitad —supresión, no portabilidad— la
sostiene `ORDEN_BORRADO_MERCHANT` (SCRUM-192).

**Nada que restaurar. Se cierra.**

## 🛑 Mitad ② · El recibo en git: PARA

El encargo pedía versionar `.claude/evidencia-tanda.json` *con la lección de SCRUM-662 delante*, y
parar si el remedio reproducía el problema del contador. **Lo reproduce, y además hay algo peor.**

### ① La decisión ya estaba tomada, con su motivo, en DOS sitios

De `.gitignore:154` (SCRUM-161):

> recibo de la tanda gateada. LOCAL Y NUNCA COMMITEADO […] si viajara con la rama seria un artefacto
> que se COPIA entre ramas, y una prueba que se copia deja de probar nada.

De `scripts/_evidencia-tanda.mjs:72`:

> El recibo NO se commitea (`.gitignore`), como el sentinel de `db push`: si viajara con la rama se
> convertiría en un artefacto que se copia entre ramas — lo contrario de una prueba.

No es un olvido que rellenar: es una decisión vigente. El recibo certifica que **ESTE** árbol pasó la
tanda; commiteado, viaja a árboles donde no se corrió.

### ② Es la fábrica de conflictos del 662, y peor

SCRUM-662 retiró una **cuenta** porque *«una cuenta no distingue tu script del mío»*. Aquel contador
sólo cambiaba cuando un humano añadía un script. Éste lleva `commit`, `huella` y `terminadaEn`:

**se reescribe entero en CADA ejecución, y lo escribe una máquina.** Con **nueve worktrees en vuelo**
(medido con `git worktree list`), cada tanda de cada sesión ensucia el mismo fichero. No es un
conflicto ocasional en una línea: es conflicto garantizado, en JSON, y en un fichero que nadie edita
a mano — o sea que quien lo resuelva estaría eligiendo a ciegas entre dos recibos, y ninguno de los
dos describe su árbol.

### ③ Y aun sin conflictos, no daría el histórico que se buscaba

El objetivo era el hueco nº 2 de SCRUM-672: *el total de aquellos commits no es recuperable*. Un
fichero **sobrescrito** no es un histórico: su `git log` sería el pisoteo de nueve ramas. Y el recibo
mide la tanda **GATEADA**, no la de `npm test`, que es donde se midió el defecto.

**El recibo en git no se construye** — tal como pedía el encargo: *prefiero no tener histórico a
tener una fábrica de conflictos*.

## ✅ Y el histórico SÍ se construye — pero como ARTEFACTO, no como fichero

El objetivo del ② era **que existiera histórico**, no que hubiera un fichero en git. Y el CI ya
escribía el TAP y ya lo guardaba… **con `if: failure()`**. O sea que **de las tandas VERDES no
quedaba nada** — y verde es exactamente como sale el defecto del 672: `fail 0`, salida 0, once tests
menos. Se guardaba el TAP justo cuando ese defecto **no** estaba.

```diff
  - name: Guardar el TAP completo
-       if: failure()
+       if: always()
```

Un artefacto de CI **no viaja con la rama**, así que no se copia entre árboles y no choca: los tres
motivos del PARA no le aplican. Sin fichero en git, sin conflictos, sin dependencias nuevas.

**El comentario de encima también se reescribió**, porque decía *«se sube SIEMPRE que haya rojo»* y
eso pasaba a ser falso. Un comentario que sobrevive al cambio que lo desmiente es la avería de
siempre.

### 🕳️ Los dos huecos de esto, declarados

1. **No se puede verificar hasta que una tanda VERDE suba el artefacto.** Lo comprobado aquí es que
   el TAP se escribe siempre —lo emite `NODE_OPTIONS` en el propio `npm test`, no un paso
   condicionado, así que en verde el fichero existe y `if-no-files-found: warn` no tiene por qué
   saltar— y que los cinco guards que leen `ci.yml` siguen en verde (76/76). Lo que **no** se ha
   visto todavía es el artefacto subido en una ejecución sin rojo.
2. **`retention-days: 7`: es histórico CORTO, no eterno.** Sirve para mirar unos días atrás cuando el
   total baje. **No** reconstruye el pasado — el total real de los commits viejos sigue sin ser
   recuperable, porque nadie lo guardó.

## Mezclado `main`: el conflicto de `ci.yml` era de SIGNIFICADO

Mientras esto se medía, **SCRUM-672 entró en `main`** (con 692 detrás). Al mezclar, `ci.yml` chocó
—y no en una línea suelta: los dos lados habían escrito **cosas distintas y las dos buenas** en el
mismo sitio.

| Lado | Qué traía | Qué se hizo |
|---|---|---|
| `main` | el paso `¿Ha perdido tests la tanda?` con su bloque de SCRUM-672 | **se conserva entero** (19 líneas) |
| `main` | el comentario viejo del paso de subida: *«Se sube SIEMPRE que haya rojo»* | **se BORRA**: este ticket lo dejó falso |
| esta rama | el comentario reescrito del paso de subida | **se conserva** (15 líneas) |

Un comentario que miente sobre el paso que tiene debajo es peor que no tenerlo. Y no se pierde nada
del viejo: su motivo —*un diagnóstico que hay que pedir a mano llega un día tarde*— ya estaba
recogido en el nuevo.

Se resolvió **extrayendo los bloques del propio fichero conflictado**, no retranscribiéndolos, y con
controles que abortan si algún trozo no es lo que se dice que es (que el bloque de 672 lleve su paso
y su `if: always()`, que el mío lleve el hueco declarado, que lo borrado sean exactamente 2 líneas).

### 🔴 De qué lado vino el `if: always()` del paso de subida — comprobado, no supuesto

Aparecía **fuera** del conflicto, y eso invita a dar por hecho que ya estaba en `main`. **No estaba.**
Medido en las etapas del merge:

    :2 (nuestro)  →  if: always()
    :3 (main)     →  if: failure()

Base `failure`, nuestro `always`, suyo `failure`: git resolvió esa línea **a nuestro favor y sin
conflicto**, porque sólo un lado la cambió. Salió de esta rama.

### ① El workflow parsea — y sin bajar un parser

*«Un workflow que no parsea no falla: NO CORRE»* (`ci.yml:311`). Un YAML roto aquí no da rojo, da
silencio: el defecto del 672 un piso más arriba. No hay parser de YAML en el árbol y **no se baja
uno** (`npx` se trae otro CLI de la red en silencio; incidente del 5-ago-2026).

La comprobación es falsable: **quitando líneas en blanco y comentarios, este fichero y el de `main`
tienen 131 líneas de código cada uno y difiere EXACTAMENTE UNA**, la que se cambió a propósito:

    main:  "        if: failure()"
    mía :  "        if: always()"

`main` corre hoy en CI, y un comentario no cambia el árbol sintáctico: mismas líneas de código, mismo
orden, misma indentación ⇒ mismo parse. Además: **0 tabuladores** y **0 marcadores de conflicto**.

### Las demás comprobaciones, con su número

| # | Comprobación | Resultado |
|---|---|---|
| ② | los cinco guards que leen `ci.yml` | **76/76**, 0 fail |
| ③ | paso `¿Ha perdido tests la tanda?` | **1 sola vez**, con `if: always()` |
| ④ | paso `Guardar el TAP completo` | **1 sola vez**, con `if: always()`, comentario nuevo, **0** apariciones de «siempre que haya rojo» |
| ⑤ | `guards-visuales`, `vigia-despliegue`, `constancia-del-alter` | los tres presentes; los dos últimos conservan su `continue-on-error: true`, **sin tocar** |

### ⑥ 🔴 El suelo, contra el `main` de ahora

```
[suelo de la tanda] ✅ suelo 4766 · total actual 4783 · margen 17
```

**No canta.** Se dejó en 4766 con margen 0 —el borde exacto, y pasa: es un mínimo, no una igualdad—
y con 672 y 692 dentro sobraban **17**.

**Segunda vuelta:** entró SCRUM-584 en `main` y **subió el suelo a 4798** (`24ea2b3c`), que es la
operación que el propio fichero describe. Aquí ese número **no se tocó**, así que sólo cambió un lado
y git lo resolvió a favor de `main` sin conflicto — pero se comprobó **con los ojos**, porque si
hubiera quedado en 4766 con la tanda en 4798 el suelo estaría **32 tests por debajo y nada lo diría**:

```
export const SUELO_TESTS = 4798;
export const MEDIDO_CONTRA = 'origin/main = 80db312b · 2026-09-02';

[suelo de la tanda] ✅ suelo 4798 · total actual 4798 · margen 0
```

Y la cadena que el test del 672 ata sigue apareciendo **una sola vez** en `_suelo-de-la-tanda.mjs`:
el merge no trajo otra copia que volviera a ensombrecer al guard.

### El censo de EOL cazó algo, y no era el contenido

La primera tanda tras resolver dio **2 rojos** en `scrum480-fin-de-linea`:

    🔴 CIEGO: cabecera inesperada «:.github/workflows/ci.yml missing»

El conflicto estaba resuelto **en disco pero no en el índice**, así que no había etapa 0 y el censo
**no pudo leer el blob**. No dijo «limpio»: dijo que **no supo mirar** — que es justo lo que se le
pide a un guard. Marcado como resuelto (`git add`), 10/10.

## 🕳️ Huecos y lo que NO se ha tocado

1. **No se ha tocado `SUELO_TOTAL = 646`** (rancio, otro carril) ni ningún test migrado.
2. **El suelo del 672 no distingue una retirada documentada de una pérdida silenciosa** — habría
   llorado igual ante esta retirada, que era correcta. Es su diseño (es un suelo, no un juez), pero
   quien lo baje legítimamente debe saber que **bajarlo a propósito es lícito**: la regla «se queda el
   más alto» resuelve un choque entre dos ramas, no prohíbe retirar tests con motivo escrito.
   **⚠️ Ese aviso NO cabe en esta rama:** `scripts/_suelo-de-la-tanda.mjs` **no existe en `main`**
   (SCRUM-672 sigue sin mergear, su rama va por `6215e2a4`). El comentario —sólo comentario, sin
   tocar lógica ni el número— va en la rama del 672, que es donde vive el fichero. Se anota aquí para
   que no se pierda si aquel PR se cierra antes.
3. **`AFIRMACIONES` vacío deja la maquinaria viva pero sin uso.** La autoprueba sobre fuente sintética
   sigue probando que el mecanismo funciona, así que el día que alguien vuelva a escribir una cifra a
   mano puede registrarla y funcionará. Lo que **no** hay es nada que obligue a registrarla — igual
   que antes de SCRUM-680, porque el registro siempre fue manual.
