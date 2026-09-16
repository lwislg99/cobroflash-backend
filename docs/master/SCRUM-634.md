# SCRUM-634 · El banco de vistas devolvía `null` en silencio por un atributo que no copiaba

**Fecha:** 1-sep-2026 · **Carril:** producto · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `775bf7e04e4c0f55ca23ad4c9bfe58a0b365c3dc` · 2026-09-01T16:22:34+01:00

**Tanda:** 4190 tests, 4111 pass, 0 fail, 79 skipped

> ⚠️ El ancla es la base de esta rama, no la punta de ahora. Durante el trabajo `origin/main`
> avanzó a `46f083ad` (PR #883 y #885). **Comprobado: esos dos commits solo añaden
> `docs/master/SCRUM-633.md` y `SCRUM-638.md` — cero código y cero tests**, y nadie ha tocado
> `tests/_banco-vistas.mjs` entre una y otra (`git log <base>..origin/main -- <fichero>` vacío).
> Por eso la medición sigue valiendo y el recuento no cambia al rebasar.

---

## El defecto

El parser de `innerHTML` del banco copiaba **`id`, `class` y `data-*`**. Nada más.

Pero el matcher **sí da por soportado** un selector como `[name="cost"]`: la regex `SIMPLE` lo
acepta, así que `casa()` no lo anotaba en `reg.selectoresNoSoportados`. Lo resolvía por
`getAttribute('name')`, recibía `null`… y devolvía `false` **callado**.

Y `null` del banco es **indistinguible de «ese nodo no existe»**.

> Es exactamente el defecto que este banco existe para eliminar, una capa más abajo: el mismo
> `querySelector: () => null` fijo de SCRUM-451, con otra ropa. La cabecera de ese fichero ya lo
> dice —«un banco que no sabe algo tiene que poder declararse ciego, no devolver `null` y
> callarse»— y el propio banco lo estaba incumpliendo.

Salió a la luz en SCRUM-609, donde bloqueó el montaje de `productsView` y se parcheó **solo para
`name`**, dejando el hueco general declarado. Esto lo cierra entero.

---

## 🔢 EL CENSO, CON NÚMERO

Sobre los **65 ficheros de vista** de `public/dashboard/js/`, contando `querySelector` y
`querySelectorAll`:

| | consultas |
|---|---:|
| **CONSULTAS al DOM encontradas** | **311** |
| seguras — `#id`, `.clase`, etiqueta, `[data-*]` | 269 |
| selector NO literal (variable o plantilla) — no clasificable | 3 |
| **por un atributo que el banco NO copia** | **39** |
| &nbsp;&nbsp;· de esas, que **ya se anotaban** (sintaxis no soportada, `:checked`) | 3 |
| &nbsp;&nbsp;· 🔴 de esas, **NULL MUDO** | **36** |

**Los 36 mudos, por atributo:** `name` ×35 · `type` ×1.
Repartidos en `productsView.js` (16), `providersView.js` (13), `settingsView.js` (1, no literal),
`app.js` (1, `meta[name="yaqu-build"]`) y `homeView.js` (1, `.qq-terms input[type=radio]`).

**✅ Control positivo del censo:** no es un cero de instrumento ciego. El mismo barrido **ve
269 consultas seguras y 311 totales**; si hubiera visto 0 seguras, el 36 no significaría nada y el
censo aborta con código 2 en vez de imprimir un número.

Los 3 que **ya se anotaban** —`input[type=checkbox]:checked` y dos
`input[name="sp-calidad"]:checked`— **no son el defecto**: la pseudoclase hace que `SIMPLE` no
case, así que el banco se declara incapaz. Eso es el comportamiento correcto, y sigue igual.

---

## La decisión, y por qué — **MEDIDA, no elegida**

El encargo dejaba la forma abierta: copiar todos los atributos, **o** fallar ruidosamente al
consultar uno que el banco no tiene. Se midieron las dos.

### Opción B sola (gritar sin copiar nada): **cuesta la vista que SCRUM-451 vino a salvar**

Sonda desechable en `casaSimple`: lanzar para todo atributo fuera de `id`/`class`/`data-*`.

```
# tests 4183 · pass 4103 · fail 1
not ok 3042 - SCRUM-451 · el banco ya monta `invoicesView` y `productsView`
  error: 🔴 `renderProductsView` sigue sin montar en el banco:
         [SONDA-B] el banco no copia el atributo "name".
```

Un solo test roto, sí — pero **es el que existe para que `productsView` esté montada y medible**.
La opción B cambia una mentira muda por **perder la cobertura de la pantalla de catálogo**: nunca
podría contestar, solo declararse ciega para siempre.

*(Y de paso este rojo prueba algo que hacía falta saber: las consultas censadas **se ejercen de
verdad** en la tanda actual, no son código muerto.)*

### Opción A (el parser copia todo): **radio cero, y encima contesta**

| | tests | pass | fail | skipped |
|---|---:|---:|---:|---:|
| base de la rama | 4183 | 4104 | 0 | 79 |
| con la opción A | 4183 | 4104 | **0** | 79 |

Y contesta de verdad, montando las vistas reales:

| vista | nodos en el árbol | `[name]` que el banco contesta |
|---|---:|---|
| `renderProductsView` | 157 | **con A: 5/5** · sin A: 0/5 |
| `renderProvidersView` | 102 | **con A: 4/4** · sin A: 0/4 |

**✅ Control de esa medición:** el número de nodos es **el mismo en los dos lados** (157 y 102).
El árbol montado no cambia: lo único que cambia son los atributos. Y `selectoresNoSoportados` vale
**0 en ambos** — confirmación de que el banco **nunca se declaró ciego**: mentía.

### Lo que se hizo: **A como arreglo, B como red de lo que A no alcanza**

A es más barata (0 tests tocados frente a 1) y además **responde** en vez de negarse. Pero A sola
no cierra el hueco entero: queda el nodo hecho con `createElement` al que la vista le asigna el
**campo** (`i.name = 'x'`) en lugar del atributo. Ahí el banco **tiene el dato** y la consulta **no
lo ve** — el mismo `null` mudo por otra puerta.

Así que ese caso, y solo ese, **grita**:

```
[banco de vistas] el selector "[name="sin-copiar"]" pregunta por el atributo "name", que este
<input> SÍ lleva en su campo ("sin-copiar") pero no en sus atributos. El banco no puede contestar
y NO va a devolver null: usa setAttribute() al construir el nodo, o pon el atributo en el
marcado. (SCRUM-634)
```

---

## Verificado en rojo — **y el reparto ES el resultado**

`tests/scrum634-banco-atributo-no-copiado.test.mjs` corrido contra el banco **sin arreglar**:

| # | test | sin arreglo |
|---|---|---|
| 1 | el atributo del marcado se COPIA y la consulta lo contesta | **CAE** |
| 2 | **CONTROL ①** el nodo que NO existe sigue dando `null`, y calla | pasa |
| 3 | **CONTROL ②** el nodo que SÍ existe con el atributo sin copiar GRITA | **CAE** |
| 4 | un atributo SIN VALOR vale cadena vacía, no «no está» | **CAE** |
| 5 | comillas simples en el marcado | **CAE** |
| 6 | regresión: `id`, `class` y `data-*` siguen resolviendo | pasa |
| 7 | el hueco DECLARADO no grita: `value` y `checked` no reflejan | pasa |

**Que ① pase en los dos lados es el punto, no un descuido.** Con una sola dirección el arreglo
puede quedar midiendo su propia sonda:

* un banco que gritara **siempre** pasaría ② y sería inútil — y reventaría ①;
* uno que no gritara **nunca** pasaría ① y sería el de antes — y reventaría ②.

Solo las dos juntas dicen que la vara distingue **«no está»** de **«no sé mirar»**. Y que ⑥ y ⑦
pasen en ambos lados prueba que el test no está midiendo únicamente el código nuevo.

Mensajes con los que cae, literales:

```
🔴 `[name="cost"]` sigue devolviendo null: el parser no copió el atributo. Es el defecto entero.
Missing expected exception: 🔴 el banco ha devuelto algo en vez de gritar: vuelve a ser
indistinguible de «no existe».
```

**Reversión de la sonda:** `Buffer.compare(disco, testigo) === 0`, sin rastro de `SONDA-B` en el
fichero y **0 CR en disco** (guard de SCRUM-533).

---

## Lo que NO cubre — huecos DECLARADOS, no promesas

1. **El reflejo va en un solo sentido: atributo → consulta, no atributo → campo.** Tras
   `<input name="cost">`, `getAttribute('name')` vale `'cost'` pero **`n.name` sigue valiendo
   `''`**. Una vista que lea `.name` recibe una respuesta falsa. **Es un `null` mudo distinto** —el
   de leer el campo, no el de consultar el selector— y este ticket no lo toca. No se arregló de
   paso porque reflejar `disabled` como cadena vacía convertiría un booleano en algo falsy y eso es
   un defecto nuevo: pide su propia medición.
2. **`value` y `checked` quedan FUERA a propósito.** En el navegador el campo **no** refleja el
   atributo después de escribir o de marcar, así que aquí devolver `false` es lo fiel; gritar sería
   mentir al revés. Test ⑦ lo fija.
3. **La regex exterior de etiquetas sigue cortando en el primer `>`**, así que un `>` dentro del
   valor de un atributo parte el nodo. Es de antes, no se ha tocado, y no aparece en el dashboard.
4. **El parser sigue siendo PLANO**: no anida. Declarado desde SCRUM-285, intacto.
5. **Las 3 consultas con selector no literal** (`[name="${r.focus}"]` en `settingsView.js:1076` y
   compañía) **no se pueden censar** desde el texto: su selector se arma en ejecución.
6. **Los 3 con `:checked` siguen sin resolverse** — y está bien: se anotan, que es declararse
   ciego. Este ticket no amplía la sintaxis soportada.

---

## Ficheros

* `tests/_banco-vistas.mjs` — el parser copia **todos** los atributos vía `setAttribute`; se añaden
  `ATRIBUTO` (comillas dobles, simples y sin valor) y `REFLEJADOS`; `casaSimple` deja de tener una
  salida muda.
* `tests/scrum634-banco-atributo-no-copiado.test.mjs` — **nuevo**, 7 tests con las dos direcciones.

**Colisión conocida:** la rama `scrum-609-switch-y-margen` lleva el parche estrecho de SCRUM-609
que copia **solo** `name`. Este cambio lo **subsume**. Al mergear, **se queda el general**.

---

## HALLAZGOS FUERA DE ALCANCE

* **El hueco nº 1 de arriba (atributo → campo) merece ticket propio.** Hoy nadie lo sufre en la
  tanda, pero es el mismo mecanismo y la misma clase de mentira.
* Se mantiene el del CSV del tarifario (SCRUM-635) y no se ha tocado.
