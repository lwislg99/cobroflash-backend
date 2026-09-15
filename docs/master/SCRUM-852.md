# SCRUM-852 · El guard de enlaces legales casa «404» contra el NÚMERO DE PUERTO

**Fecha:** 15-sep-2026 · **Carril:** instrumentos (guard de superficie pública) · **Gate:** arreglo + controles

**Medido contra:** `origin/main` = `5359f41d9593c22cbba7926bbe5a41510d79f3a1` · 2026-09-15T10:28:46Z
**Rama:** `scrum-852-estado-por-identidad`
**Preámbulo (A1):** `./node_modules/.bin/prisma generate` rc=0 · `npm run build` rc=0 ·
`git rev-list --count HEAD..origin/main` = **0** · árbol limpio.

> Nace del hallazgo de rebote de **SCRUM-849**, reportado allí sin tocarlo (regla 9 / norma A7).
> **Obligación 0:** sin rama remota, sin commit en `main`, sin expediente → causa **(a)**, nunca
> se empujó nada. Y **ninguna rama viva de `scrum-822`**, comprobado.

---

## 1 · El defecto, y por qué es la misma familia que SCRUM-824b

`tests/scrum329-legal-pagina-publica.test.mjs` comprobaba que «no pude conectar» no se confunde
con «404» así:

```js
assert.doesNotMatch(c.texto, /404/, '🔴 el mensaje habla de 404 sin haber recibido ninguno');
```

Y `c.texto`, para una conexión rechazada, es:

```
/privacidad → sin respuesta (connect ECONNREFUSED 127.0.0.1:54047) (enlazado desde public/index.html)
```

**El puerto era `54047`.** Contiene «404», así que el guard que existe **precisamente** para
distinguir «no hay respuesta» de «404» se confundió con un trozo del número de puerto y dio rojo
sobre una landing sana.

> **Misma familia que SCRUM-824b:** allí un sha de ocho caracteres todos dígitos parecía un reloj;
> aquí un puerto efímero parece un código de estado. **Un dato numérico que casualmente cumple el
> patrón de otro dato numérico.** *Un prefijo no es un nombre, y una subcadena tampoco* (A10).

---

## 2 · 🔴 LA FRECUENCIA, que es lo que justifica la prioridad

Rango efímero por defecto de Linux (`ip_local_port_range`): **32768–60999**.

```
RANGO EFIMERO: 32768-60999  (28232 puertos)
CONTIENEN '404': 157  ->  0.556 %  =  1 de cada 179.8

CONTROL POSITIVO (4040-4049, deberian ser los 10): 10 ✅
CONTROL NEGATIVO (5000-5009, deberian ser 0): 0 ✅

LECTURA: con 0.56 % por ejecucion, la probabilidad de haberlo visto
  tras  10 ejecuciones: 5.4 %
  tras  50 ejecuciones: 24.3 %
  tras 100 ejecuciones: 42.7 %
  tras 200 ejecuciones: 67.2 %
```

**1 de cada 180 ejecuciones.** Con CI por PR y auto-merge activo, 100 ejecuciones son días, no
meses: **42,7 %** de haberlo visto ya en ese plazo. No es una rareza teórica — costó un rojo real
el 15-sep-2026 y estuvo a punto de contarse como defecto del producto.

Banco: `docs/master/evidencias/scrum852/frecuencia-puertos-con-404.mjs` (+ `salida-frecuencia.txt`).
Lleva control positivo y negativo dentro: un contador que no sabe decir «10 de 10» y «0 de 10»
sobre rangos conocidos no cuenta nada.

---

## 3 · ¿Es un patrón? **Un caso muerde; cuatro comparten la forma y hoy no muerden**

Censo por AST sobre `tests/` y `scripts/` (nunca `grep`: un `/404/` aparece también en comentarios
y en mensajes). **2.080 regex literales** examinadas en `assert.match`/`doesNotMatch`; **5** buscan
un número de tres cifras que puede leerse como código de estado:

| sitio | patrón | ¿muerde? |
|---|---|---|
| `tests/scrum329-legal-pagina-publica.test.mjs:312` | `/404/` sobre un texto **con el puerto dentro** | 🔴 **SÍ** — es este ticket |
| `tests/scrum183-consola-e2e.test.mjs:60` | `/404/` sobre un aviso construido con textos **fijos del test** | no |
| `tests/scrum362-residuales.test.mjs:189` | `/502/` sobre un `error.message` de status **fijo** | no |
| `tests/scrum426-libro-recibidas.test.mjs:371` | `/100/` — **no es un código**, es un importe (60+40) | no |
| `tests/scrum677-vigilante-de-despliegue.test.mjs:48` | `/283/` — **no es un código**, es un contador de commits | no |

**La distinción que importa no es «¿la regex parece un código?» sino «¿el sujeto contiene un dato
VARIABLE fuera del control del test?».** Sólo el primero lo tiene: el puerto efímero. Los otros
cuatro son `match` positivos sobre datos fijos, así que a lo sumo darían un falso VERDE si el dato
cambiara — nunca el falso ROJO que aquí tumbó la suite.

**Se arregla el que muerde y se reportan los cuatro.** No se tocan: son tests ajenos sin defecto
hoy, y cambiarlos sería arreglar de paso lo que no está roto (regla 9).

---

## 4 · El arreglo: por IDENTIDAD, no por parecido

**El código de estado se devuelve como DATO.** `clasificar` ya decidía con `r.status`; ahora
también lo **expone** (`status`), que es la única forma de preguntar por él sin buscarlo dentro de
una cadena. `0` = no hubo respuesta: la ausencia tiene su propio valor y por eso no se parece a
ningún 4xx.

```js
if (!r || r.status === 0) return { tipo: 'sin-respuesta', status: 0, texto: … };
if (r.status !== 200)     return { tipo: 'roto',          status: r.status, texto: … };
```

Y los asserts preguntan por el dato:

```js
assert.equal(c.status, 0);            // un fallo de conexión no tiene código HTTP
assert.notEqual(c.status, 404);
```

**Lo que NO se hizo, y estaba prohibido:** fijar el puerto a una constante para esquivarlo. El
servidor real de este fichero sigue pidiendo puerto efímero (`listen(0)`); lo único que se fija es
la **entrada del clasificador** en el control, que es justo la pieza que se equivocaba.

### La comprobación del texto también se arregló, y sin una sola regex

El mensaje que lee una persona tampoco debe anunciar un código que nadie devolvió. Se pregunta
**por la posición** —lo que va detrás de la flecha— en vez de buscar el número suelto:

```js
const trasLaFlecha = c.texto.split(FLECHA)[1] ?? '';
assert.equal(Number.isNaN(Number.parseInt(trasLaFlecha, 10)), true, …);
```

`FLECHA` se declara **una vez** junto al clasificador, para que los asserts no tecleen la marca
cada uno por su cuenta.

---

## 5 · Los controles, y sus rojos

| # | control | rojo demostrado |
|---|---|---|
| ① | 🔴 **EL QUE DECIDE**: cuatro puertos trampa (54047, 33404, 40412, 44045) no se leen como 404 | sí — ver abajo |
| ② | ✅ **POSITIVO**: un 404 de verdad sigue siendo `roto`, y también 403/500/502 | sí |
| ③ | ✅ **NEGATIVO**: lo que cerró SCRUM-822 sigue en pie, sin relajar | sí |
| ④ | **SUELO**: el clasificador distingue los CUATRO cubos o se declara ciego | sí |

① lleva **su propio suelo dentro**: comprueba que los cuatro puertos de prueba *contienen* «404».
Un caso de prueba que no lleva la trampa es una tautología con forma de test. Y se usan valores
fijos a propósito: si dependiera de que `listen(0)` reparta un puerto con «404», el control se
ejecutaría de verdad 1 de cada 180 veces — **y un control que casi nunca corre no es un control**.

### 🔴 ROJO ①, el que decide — repuesto el assert de antes del arreglo

```
not ok 7 - SCRUM-852 · 🔴 EL QUE DECIDE: un puerto con «404» dentro NO se cuenta como 404
  error: '🔴 el mensaje habla de 404 sin haber recibido ninguno'
  actual: '/privacidad → sin respuesta (connect ECONNREFUSED 127.0.0.1:54047) (enlazado desde public/index.html)'
```

### 🔴 ROJO ②③④ — apagado el guard (un 404 real pasa a contarse como «sin respuesta»)

```
not ok 6 - SCRUM-822 · 🔴 «no pude conectar» NO se cuenta como 404
    🔴 un 404 real ha dejado de contar como enlace roto: el guard está apagado
not ok 8 - SCRUM-852 · ✅ POSITIVO: un 404 DE VERDAD sigue siendo un enlace roto
not ok 9 - SCRUM-852 · ✅ NEGATIVO: lo que cerró SCRUM-822 sigue en pie, sin relajar
    🔴 «sin respuesta» y «roto» han dejado de distinguirse
not ok 10 - SCRUM-852 · SUELO: el clasificador distingue los CUATRO cubos, o está ciego
    🔴 CLASIFICADOR CIEGO: sólo distingue 3 cubos (sin-respuesta, vacio, ok).
# pass 8 · fail 4
```

Fuente **restaurada byte a byte** tras cada mutación (`Buffer.compare === 0`, 32176 = 32176).

---

## 6 · 🔴 Error propio: escribí un control INCAPAZ DE FALLAR, y casi lo entrego (A9)

La primera versión de los dos asserts nuevos usaba regex con `\s`, `\d` y `\b`. **La herramienta se
comió las barras y dejó un BACKSPACE (`0x08`) dentro del patrón**, medido sobre bytes:

```
tramo tras 404: 0034(4) 0030(0) 0034(4) 0008(CTRL) 002f(/)
```

* El `assert.match` **falló** — y ese rojo fue la suerte: me delató.
* El `assert.doesNotMatch`, con la misma corrupción, **habría pasado siempre**: una regex que no
  casa con nada hace que un `doesNotMatch` sea verde por construcción. **Un control incapaz de
  fallar, entregado como si midiera algo** — exactamente el defecto que este ticket viene a quitar,
  cometido al quitarlo.

Por eso la versión final **no usa ni una regex** en esos dos sitios: compara datos y posiciones.
Y se añadió una post-condición sobre bytes que barre el fichero entero buscando caracteres de
control: **0** ✅.

---

## 7 · Lo NO tocado

El puerto sigue siendo efímero · no se reintenta · no se salta ningún test (SCRUM-754: un test
saltado cuenta como pasado) · no se relaja nada de SCRUM-822 — de hecho su test ahora cae también
si el guard se apaga · `prisma/schema.prisma` · los cuatro guards ajenos del §3 · ninguna base ·
**nada ejecutado contra producción ni staging**.

## 8 · Documentos consultados

`docs/master/SCRUM-849.md` (de donde sale el hallazgo) · `docs/equipo/00-normas-comunes.md`
(A1, A2, A7, A8, A9, A16) · `CLAUDE.md` (reglas 9, 27, 36)
