# SCRUM-409 · Los fixtures salen del merchant demo

**Fecha:** 9-ago-2026 · **Carril:** guards · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `64c19884a97d240544a203df81a67b33744c1724` · 2026-08-09T20:34:56+02:00

## El defecto

El merchant **1 es el DEMO**, y el producto se comporta distinto con él: `whatsappPolicy` corta por
`DEMO_MERCHANT_ID`, el PDF lleva marca de agua, la pasarela se desvía. Un fixture con ese id
**desactiva comprobaciones sin tocar ningún guard**, y el test sigue verde midiendo otra cosa.

## El censo, derivado

| | |
|---|---|
| ficheros de test con `merchantId: 1` | **24** (57 ocurrencias) |
| de ellos, que PRUEBAN el demo (derivado de importar `isDemoMerchant` / `DEMO_MERCHANT_ID` / `DEMO_SAFE_NUMBERS`) | **2** |
| cambiados a un id inventado | **22** (55 ocurrencias) |

⚠️ El encargo hablaba de 25 ficheros y «11 mencionan el demo». Medido: **10** contienen la palabra
«demo» y `merchantId: 1`, pero solo **2** importan su mecanismo. Los otros 8 la mencionan en prosa
— por eso la lista se deriva de los imports y no de la palabra.

⚠️ **SCRUM-407 ya estaba arreglado** por otra sesión: `scrum399-hambre-del-lote` usa hoy
`merchantId: 7`.

## 🔴 Los tres tests que rompieron — y NINGUNO era el hallazgo que buscábamos

El encargo decía: si cambiar el merchant rompe un test, ese test pasaba por la rama demo del
producto. **Rompieron tres, y los tres eran artefactos de mi sustitución.** Lo digo entero porque
un falso hallazgo aquí habría mandado a alguien a buscar un defecto que no existe:

| test | por qué rompió | veredicto |
|---|---|---|
| `scrum207-conciliacion` · «los seis cubos» | su fila 6 **ES el cubo del demo** (`huecoDemo`), y no importa nada del demo: clasifica con un mapa de merchants | **mi error**: la derivación por import no lo veía. Devuelto al id 1 y **marcado** |
| `scrum302-presupuesto-y-fotos` · multi-tenant | el merchant entra por `handle({ merchantId })`, y la **espera** seguía en 1 | **mi error**: sustitución parcial |
| `scrum312-importador-clientes` · duplicado | el merchant es un **argumento posicional** `importarClientes(1, …)`, invisible para `merchantId: 1` | **mi error**: mismo motivo |

**Cero tests pasaban por la rama demo.** El hallazgo real es sobre el método: el id del demo viaja
en más formas que `merchantId: 1`, y una sustitución mecánica desincroniza el test sin revelar
nada del producto.

## El guard

Un fixture nuevo no puede usar el id del demo, **salvo** en los ficheros derivados como pruebas de
ese comportamiento, o en una línea **marcada a la vista**:

    merchantId: 1,  // MERCHANT DEMO A PROPOSITO (SCRUM-409): <por qué>

Dos señales y no una, **porque una sola falló**: la derivación por import no veía el caso de
`scrum207`. La marca no es una allowlist muda: va pegada al sitio y dice por qué.

* **Suelo:** menos de 100 ficheros de test → falla. Y un control positivo sintético comprueba que
  el detector **ve** un `merchantId: 1` y **no** se deja engañar por uno en un comentario.
* **Se excluye a sí mismo**: nombra `DEMO_MERCHANT_ID` para poder derivar, así que se
  auto-eximiría — la trampa de auto-referencia de siempre.
* **Rojo verificado:** un fixture nuevo con el demo cae nombrando
  `scrum343-cabecera-gastos-unica.test.mjs:2` con su línea.

## Lo que NO cubre

* **Solo ve `merchantId: 1`.** Un merchant demo pasado como argumento posicional o por otra
  variable no lo detecta — es justo lo que me rompió `scrum312`, y queda como hueco declarado.
* No mira `tests/*.ts` (no hay) ni fixtures fuera de `tests/`.

---

# FASE 2 (13-ago-2026) - El detector estaba CIEGO en CRLF, y por eso paso a AST

> ADVERTENCIA: la entrada de arriba es de otra sesion (9-ago-2026) y NO se toca: esto se
> ANEXA. Casi la borro con un `cat >`. El registro se conserva ENTERO, siempre.

---

# FASE 2 (13-ago-2026) - El detector estaba CIEGO en CRLF, y por eso paso a AST

> ADVERTENCIA: la entrada de arriba es de otra sesion (9-ago-2026) y NO se toca: esto se ANEXA.
> Casi la borro con un `cat >`. El registro se conserva ENTERO, siempre.

**Medido contra:** `origin/main` = `d17e54260a953bcb19cd3382a6577d8b312f2d28` · 2026-08-13T09:40:00+02:00
**Rama:** `scrum-222-deriva-al-dia` · **Ninguna base tocada.**

> **Este documento sobrevive a su propio arreglo.** El parche que lo originó está SUPERADO por la
> versión de AST que entró en `main` el mismo día. Se escribe igual, porque **un arreglo superado se
> tira y el motivo por el que hizo falta, no.**

---

## 1 · El defecto: el guard estaba CIEGO en todo fichero con CRLF

La versión anterior leía el fichero como texto y quitaba los comentarios así:

```js
texto.split('\n').forEach((linea, i) => {
  const sinComentario = linea.replace(/\/\/.*$/, '');
```

**Con CRLF eso no quita nada.** `split('\n')` deja un `\r` al final de cada línea, y entonces
`/\/\/.*$/` **no casa**: el `.` de una expresión regular **no incluye `\r`**, y el `$` sin la bandera
`m` exige fin de cadena. El `replace` devuelve la línea intacta.

Consecuencia: su promesa —*«se mira el CÓDIGO, no los comentarios»*— **era falsa en todo checkout de
Windows**. Lo destapó `main` en rojo por `scrum508:76`, una línea que es **solo un comentario**:

```js
// 7 y no 1: el guard de SCRUM-409 lee un `merchantId: 1` como el merchant DEMO y salta.
```

El guard se cazó a sí mismo en la frase que explica su propia prohibición — la trampa de
auto-referencia, esta vez con una capa más: **el mecanismo que debía evitarla existía y no
funcionaba**, y no funcionaba solo en la mitad de los árboles.

## 2 · Por qué esto justifica dejar de leer texto

No es que la regex estuviera mal escrita: es que **quitar comentarios con una regex es un problema
que hay que resolver bien cada vez**, y falla en silencio. La versión de AST que entró en `main`
—`ts.isPropertyAssignment` / `ts.isNumericLiteral`— es **inmune por construcción**: no quita
comentarios porque **no los ve**; un comentario no es un `PropertyAssignment`. Y de paso compara el
VALOR y no el prefijo, así que `1.5` deja de contar como el merchant demo.

> Un guard de texto necesita acordarse de quitar comentarios. Uno de AST no puede olvidarse.

## 3 · Lo que SÍ se midió de la versión nueva, y sale limpio

En la versión de `main` queda un `const lineas = texto.split('\n')` (línea 77) que alimenta dos
campos del hallazgo: `texto:` y `marcada:`. La pregunta era si el `\r` los estropea. **No.**

| caso | `includes(MARCA)` |
|---|---|
| marca en medio, LF | `true` |
| marca en medio, CRLF | `true` |
| marca **al final**, LF | `true` |
| marca **al final**, CRLF | **`true`** |
| **control negativo** · línea sin marca, CRLF | `false` |

`includes` busca **subcadena y no está anclado**, así que el `\r` queda *después* de la marca y nunca
la rompe — que es justo lo contrario de un `$` en una regex. Y `trim()` se come el `\r` para `texto:`.

**Control positivo sobre datos reales:** hoy hay **3 marcas** en el árbol —`scrum207:37`,
`scrum409:21` y `scrum409:55`— **las tres en líneas CRLF y las tres reconocidas**. El defecto no
existe ahí.

## 4 · Veredicto de esta rama

`scrum409-fixtures-sin-merchant-demo` en `origin/main` limpio (`npm ci` + build): **rc=0 · 6 tests ·
6 pass · 0 fail.** El arreglo del `split(/\r?\n/)` **ya no hace falta y no entra**: el conflicto se
resuelve **quedándose con la versión de `main`**, sin forzar la mía.

⚠️ **En código NO se suma.** Un «aceptar los dos cambios» aquí habría dejado los dos detectores
corriendo a la vez y cada `merchantId` contado dos veces. Sumar es la regla de `docs/master/*.md`,
que son registro; el código se ELIGE, y se elige midiendo.

## 5 · Y el dato para el censo de ramas

**Es el duplicado nº 6 del mes: dos carriles arreglando el mismo guard el mismo día sin saberlo.**
Ninguno de los dos podía verlo — no hay nada que avise de que otra rama toca tu fichero. Este caso es
el **argumento nº 1** del censo de ramas pendiente: el coste no es el trabajo tirado (una línea),
es que **los dos arreglos eran correctos y solo uno podía entrar**.

---

# FASE 3 (13-ago-2026) · El censo de ramas que este duplicado motivó

> ⚠️ Se ANEXA. Las fases 1 y 2 de arriba son de otras sesiones y NO se tocan.
>
> Vive aquí y no en un `CENSO-RAMAS.md` suelto porque el guard de SCRUM-273 lo impide, y tiene
> razón: un nombre libre en `docs/master/` reintroduce por la puerta de atrás la colisión que ese
> ticket cerró. Su casa es ésta porque **el duplicado nº 6 —el de la fase 2— es su argumento nº 1**.
**Medido:** las **274 ramas** de `origin` (sin `main`), tras `git fetch origin --prune` (rc=0,
ninguna ref sin fetchear).

**Medido contra:** `origin/main` = `3912f3a3f35cf00200baa00da8b3016449971ee9` · 2026-08-13T19:23:11+02:00

> 🛑 **Esta lista NO borra ni mergea nada.** Mide y ordena para que se ejecute a clics.

## El resultado

| | |
|---|---|
| ramas medidas | **274** |
| ya enteras en `main` (`is-ancestor` rc=0) | **213** |
| con commits que `main` no tiene | **61** |
| … cuyo trabajo YA está en main con otro sha → **BORRAR** | **28** |
| … con trabajo que `main` NO tiene → **MEDIR** | **33** |

## Cómo se contestó, y por qué no vale la lista de ramas ni la fecha

① `git merge-base --is-ancestor <sha> origin/main`. **rc=0 = está entera en main.** 213 lo están.

② Para las 61 restantes `is-ancestor` **no basta**: un rebase o un cherry-pick reescriben el sha,
así que una rama cuyo trabajo YA está en main sigue saliendo con «commits propios». La pregunta
buena es **si el ASUNTO de cada commit existe en la historia de `main`**. Ese es el discriminador
que separa BORRAR de MEDIR. Los commits de merge no cuentan: no son trabajo.

**SUELO del instrumento** — si falla, se declara ciego y NO emite lista:

- índice de asuntos de `main`: **2.641**. Con menos de 100 → «no se ha leído la historia».
- **control positivo del fundador:** `scrum-474-filtro-cobros` tiene 1 commit propio. Sale.
- **control positivo del índice:** un asunto que SÍ está en main se reconoce. Sin esto las 61
  saldrían «no está en main» y el censo mandaría **mergear 61 ramas**.
- barrido con **cero** ramas propias → el script **falla**: cero y «no supe mirar» no son
  el mismo número.

## 🔴 Lo que el control positivo destapó, y cambia el diagnóstico

`scrum-474-filtro-cobros` —la rama «sin PR y sin dueño»— sale **BORRAR**: su commit `79248b55`
**está en main con otro sha** (cherry-pick `63530890`). O sea: **no había trabajo perdido, había
una rama que lo parecía.** El susto y el coste de comprobarlo son reales; la pérdida, no.
**28 de las 61 son exactamente eso.**

## 🔴 RAMAS HERMANAS: 44 tickets con más de una rama — la trampa peor

El caso que costó reabrir un ticket:

```
scrum-500-suplidos-COLUMNA   → mergeada, era SOLO documento
scrum-500-suplidos-CASILLA   → el trabajo de verdad, mergeada después
```

Se cerró el ticket creyendo que estaba dentro **porque la lista de ramas las enseña juntas y
parecen la misma cosa**. Comparten prefijo; el contenido no comparte nada.

Los peores hoy:

- **SCRUM-300 · 5 ramas** — y **`scrum-300-firmado-por` NO es copia de las otras**: lleva 5
  commits que main no tiene, con schema y rótulos APROBADOS. Nombre parecido, contenido distinto.
- **SCRUM-304 · 4 ramas** (`-rebasada`, `-2`, `-3`) — tres BORRAR.
- **SCRUM-284 · 4 ramas** — las cuatro BORRAR.
- **SCRUM-242 · 4 ramas** — solo una con trabajo propio.

> **La regla que sale de aquí:** un sufijo `-rebasada-N` es una rama **que no se borró tras el
> merge**. Son mayoría entre las 28 de BORRAR, y ninguna aporta nada.

## ⚠️ ARGUMENTO Nº 1 — el duplicado nº 6 del mes, de hoy mismo

**Dos carriles arreglaron el MISMO guard (`scrum409-fixtures-sin-merchant-demo`) el mismo día sin
saberlo**: uno con `split(/\r?\n/)`, otro reescribiéndolo con AST. Los dos arreglos eran correctos
y **solo uno podía entrar**. Nada avisa de que otra rama toca tu fichero. El coste no es el código
tirado —una línea— sino descubrirlo y decidir. Ver `docs/master/SCRUM-409.md`.

## MEDIR — 33 ramas con trabajo que `main` no tiene

> Ninguna se borra sin mirarla: **un BORRAR equivocado es irreversible.**

| rama | comm. fuera | lleva | primer commit que main no tiene |
|---|---|---|---|
| `scrum-480-fin-de-linea` | 7 | MODULO ENTRADA | docs(SCRUM-480 fase 3): lo que quedo fuera, el rojo y la perdida que cuent… |
| `scrum-300-firmado-por` | 5 | MODULO ENTRADA SCHEMA | SCRUM-300: los dos rotulos del PDF, APROBADOS por el asesor tras verlos li… |
| `scrum-37b-agregacion-por-job` | 5 | MODULO | docs(runbooks): la regla del parseo de URLs de BD, con el camino corto don… |
| `scrum-475-constancia-correo` | 4 | MODULO ENTRADA | docs(SCRUM-475): por qué la medición sigue en pie aunque main se movió dos… |
| `scrum-222-deriva-prod` | 2 | MODULO | SCRUM-222: cablea el assert de arranque en index.ts + campo de deriva en /… |
| `scrum-440-tenencia-supresion` | 2 | — | SCRUM-441+397: la cuarta columna del lote — charges.paid_at |
| `scrum-172-tier3-tenencia-nullable` | 2 | — | SCRUM-172 (tier 3): el guard de tenencia nullable ve CUALQUIER tipo nullab… |
| `scrum-223-wrapper-silencioso` | 2 | — | SCRUM-226: el guard senala la linea REAL, no la del fuente sin comentarios |
| `scrum-253-adopcion-mismo-dueno` | 2 | — | docs(master): SCRUM-253 -- adopcion por mismo-dueno, fin del auto-bloqueo … |
| `scrum-309-g0-medir-el-trabajo` | 2 | ENTRADA | SCRUM-309: el ancla del informe en ISO-8601, para que la lea una maquina |
| `scrum-340-contador-plazas-reales` | 2 | MODULO ENTRADA | SCRUM-340: capturas AB6 (3 superficies x antes/despues x 360 y 390) + rast… |
| `scrum-38-staging-expres` | 2 | MODULO | docs(master+flujo): SCRUM-38 -- staging expres + paso E2E automatizado pos… |
| `scrum-397-fecha-de-cobro-rebasada` | 2 | ENTRADA | feat(SCRUM-397): el microcopy aprobado de la fecha de cobro, y el guard qu… |
| `scrum-433-censo-un-salto` | 2 | ENTRADA | docs(master): SCRUM-433 · el censo resuelve un salto |
| `scrum-268-p3-guard-espera-automatica` | 1 | ENTRADA | docs(registro): SCRUM-268 punto 3 -- el guard del esperador automatico |
| `scrum-390-puerta-cliente-real` | 1 | MODULO ENTRADA | feat(guards): microcopy aprobada del aviso de la puerta (SCRUM-390) |
| `scrum-482-contador-offline` | 1 | ENTRADA | SCRUM-482 PASO 0: no hace falta columna, y el servidor no ve la mitad de l… |
| `chore-flujo-pr` | 1 | — | chore(flujo): main protegida -> ramas + PR (reglas AA1 + FLUJO_DE_TRABAJO.… |
| `scrum-161-tanda-en-ci` | 1 | — | SCRUM-161: la tanda gateada corre en CI (diaria, no depende de que nadie l… |
| `scrum-166-un-solo-comando` | 1 | — | refactor(SCRUM-166): un nombre por cosa -- test:staging ES el runner gatea… |
| `scrum-198-spike-xsd` | 1 | — | SCRUM-198 (spike): los tres candidatos de validacion XSD, ejecutables |
| `scrum-216-p12-contradiccion` | 1 | — | docs(legal): P12 corrige su propia premisa -- las R1 consignan el delta (I… |
| `scrum-224-sw-revalida` | 1 | MODULO | SCRUM-224: el SW revalida el estático (network-first de verdad) + instrume… |
| `scrum-242-backup-verificado` | 1 | — | feat(SCRUM-242): produccion no se vuelca, y el destino se comprueba VACIO … |
| `scrum-245-fuera-listas-blancas` | 1 | MODULO | APARCADA · SCRUM-245: retirada del freno del demo, SIN mergear |
| `scrum-270-evidencia-reunida` | 1 | ENTRADA | docs(master): SCRUM-270 — fijar como se lee el 55, y dejar la pregunta abi… |
| `scrum-312-importador-clientes-rebasada` | 1 | MODULO | SCRUM-312 · el mensaje de la base va al LOG, nunca a la pantalla |
| `scrum-329-legal-pagina-publica` | 1 | — | wip(legal): SCRUM-329 (F2) — mecanismo a medio hacer, PARADO por cambio de… |
| `scrum-397-fecha-de-cobro` | 1 | ENTRADA | docs(SCRUM-397): censo de la fecha de cobro -- que es hecho, que es declar… |
| `scrum-412-primarias-tactiles` | 1 | ENTRADA | SCRUM-412: el botón de firmar es primaria (decisión del fundador) |
| `scrum-418-puerta-de-produccion` | 1 | MODULO | SCRUM-418: la puerta de produccion, en el punto de CONEXION |
| `scrum-471-pretest-antes-de-la-suite` | 1 | — | SCRUM-471: el comprobador de node_modules cae en pretest, ANTES de la suit… |
| `scrum-484-clasificar-59` | 1 | ENTRADA | SCRUM-484 (cont. 2): el filtro mata 12 de los 15 — y con ellos MI ticket |

### Las que más pesan

- **`scrum-480-fin-de-linea`** — 7 commits, entrada de máster + guard de `.gitattributes`. Es el
  ticket del CRLF, y hoy ese defecto costó un rojo en `main`. **Mirar primero.**
- **`scrum-300-firmado-por`** — 5 commits con módulo, schema y **rótulos aprobados por el asesor**.
  Microcopy aprobada sin mergear es lo más caro de perder: no se reconstruye midiendo.
- **`scrum-475-constancia-correo`** — 4 commits, 7 módulos. Hermana de `scrum-475-firma-del-webhook`.
- **`scrum-245-fuera-listas-blancas`** — 11 módulos, y su propio commit dice **«APARCADA · SIN
  mergear»**. Está declarada: no es un olvido. **No borrar.**
- **`scrum-222-deriva-prod`** — hermana de la rama de hoy: `schemaDrift.ts` e `index.ts`.

## BORRAR — 28 ramas cuyo trabajo YA está en `main`

Todos sus commits (sin contar merges) tienen su **asunto en la historia de `main`**: entraron por
rebase o cherry-pick con otro sha.

| rama | commits | ya en main |
|---|---|---|
| `scrum-205-206-sellado` | 7 | 7/7 |
| `scrum-300-c5-fusion-rebasada` | 7 | 7/7 |
| `scrum-368-a1-texto-grande` | 6 | 6/6 |
| `scrum-215-destinatarios` | 5 | 5/5 |
| `scrum-216-consolidar` | 1 | 1/1 |
| `scrum-284-configuracion-submenus-rebasada` | 4 | 4/4 |
| `scrum-388-censo-contra-main-rebasada-2` | 4 | 4/4 |
| `scrum-234-carrera-numeracion` | 3 | 3/3 |
| `scrum-284-censo-configuracion` | 3 | 3/3 |
| `scrum-284-configuracion-submenus` | 3 | 3/3 |
| `scrum-388-censo-contra-main-rebasada` | 3 | 3/3 |
| `scrum-240-sobre-duplicado-rebasada` | 2 | 2/2 |
| `scrum-240-sobre-duplicado-rebasada-2` | 2 | 2/2 |
| `scrum-255-migrar-sondeos` | 2 | 2/2 |
| `scrum-275-message-en-el-acceso` | 2 | 2/2 |
| `scrum-304-albaranes-tabla-rebasada` | 2 | 2/2 |
| `scrum-381-sembradores` | 2 | 2/2 |
| `scrum-388-censo-contra-main` | 2 | 2/2 |
| `scrum-415-fixture-version` | 2 | 2/2 |
| `scrum-205-206-sellado-rebasada` | 1 | 1/1 |
| `scrum-304-albaranes-tabla` | 1 | 1/1 |
| `scrum-304-albaranes-tabla-rebasada-2` | 1 | 1/1 |
| `scrum-325-libros-por-periodo` | 1 | 1/1 |
| `scrum-368-contraste-texto-y-guard-rebasada` | 1 | 1/1 |
| `scrum-404-trazo-no-se-pierde` | 1 | 1/1 |
| `scrum-405-descarga-verificada` | 1 | 1/1 |
| `scrum-474-fase2-INCOMPLETO` | 1 | 1/1 |
| `scrum-474-filtro-cobros` | 1 | 1/1 |

## Lo que este censo NO afirma

1. **Asunto igual no es contenido igual.** Un commit reescrito en un rebase puede conservar el
   asunto y haber perdido líneas. Para las 28 de BORRAR el riesgo es bajo —son ramas de
   tickets cerrados— pero **no está medido fichero a fichero**. Si una importa, se mira antes.
2. **No se ha mirado si alguna rama de MEDIR está obsoleta por diseño** (una decisión posterior la
   anuló). Eso lo sabe el fundador, no el `git log`.
3. **No se ha ejecutado nada**: ni un borrado, ni un merge.
