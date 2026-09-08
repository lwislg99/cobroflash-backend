# SCRUM-664 · El trinquete que vigila el nombre — y el compilador como segundo censo

**Fecha:** 3-sep-2026 · **Carril:** S3 (instrumentos) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `4e9e114d1620386c76982efbc4eeae1e9d55fc06` · 2026-09-03T13:05:11+02:00

**Tanda:** 4940 tests, 4855 pass, **1 fail**, 84 skipped — medida DESPUÉS del último cambio, entrada incluida, con Prisma regenerado. 🔴 **Ese fallo NO es de este ticket: viene rojo de `main`** — ver el hallazgo al final. Suelo de la tanda: `suelo 4798 · total 4940 · margen 142`.

---

Dos agujeros, y no valen lo mismo. **Se construye el ② y sólo el ②.** El ① se mide y se para: el
número está abajo y la decisión es del fundador.

## PASO 0

### ENTRADA

El profesional llega por **el alta de catálogo por gremio**: onboarding con la casilla marcada por
defecto (`onboardingView.js:284`) o el botón del catálogo → `POST` a
[products.routes.ts](src/modules/products/app/routes/products.routes.ts). Ahí es donde
`getLocale(merchant.country).defaultVat` estampaba un tipo impositivo en cada producto que nacía.

### MECANISMO

**Existe y funciona: `tests/scrum646-cortafuegos-defaultvat.test.mjs`**, anclado por AST sobre
`PropertyAccessExpression` para no cazarse a sí mismo en su propia prosa. Sus dos huecos están
declarados **en él mismo** — este ticket no descubre nada, cierra uno.

**Y el instrumento del ② también existía, sin nombre:** el compilador. En SCRUM-646 fue `tsc`
—no el censo— quien encontró el tercer sitio. Lo que faltaba era convertir ese hallazgo puntual en
una pieza que se pueda ejecutar.

## ② Lo construido: el compilador como censo

| Pieza | Qué es |
|---|---|
| `tests/_dependencias-por-compilacion.mjs` | `dependenciasDe(fuente, símbolo)`: retira la declaración y le pregunta al compilador quién se rompe |
| `escriturasEnLlamadaPrisma(fuente, campos)` | el censo por AST con el que se compara, ejecutable y no descrito |
| `tests/scrum664-el-compilador-como-censo.test.mjs` | 11 tests |

La pregunta que contesta no es «quién lo nombra en esta llamada» —posición, que es lo que un
recorrido sintáctico sabe— sino **quién se rompería si el símbolo dejara de existir**: ligadura, que
es lo que el compilador resuelve. Por eso ve la escritura que vive en otra función.

### 🔴 Y el instrumento estuvo a punto de nacer con el mismo punto ciego

Primer prototipo: filtrar el código **2304** («Cannot find name»). Sobre el corpus de tres
escrituras devolvió **DOS**. Medido por qué:

```
{ name: 'x', vat }        → 18004  «No value exists in scope for the shorthand property 'vat'»
{ name: 'y', vat: vat }   →  2304  «Cannot find name 'vat'»
{ tax: vat } (en el .map) →  2304
```

**El compilador no usa un solo código**, y el que se escapaba era justo el **ATAJO** — la forma más
corta de escribir la propiedad. Un instrumento contra la ceguera ajena que nace ciego para una de
las tres formas no vale. Los dos códigos van declarados, con su motivo, y **atados por un test**:
si alguien recorta la lista a uno, el atajo deja de verse y eso cae.

### La evidencia que pedía el encargo

| Exigencia | Cómo se cumple |
|---|---|
| **rojo por el MECANISMO** | se retira el símbolo y caen 3 usos; y se comprueba que **cada uno llega con un código de «nombre ausente»** (2304/18004) y que **el mensaje nombra `'vat'`** — no vale que caiga por otra cosa |
| **control NEGATIVO** | retirar `priceOf` no produce ni un hallazgo que hable de `vat` |
| **el que decide** | la escritura del `.map` **la ve el compilador y NO la ve el censo por AST**, y las dos mitades se afirman por separado: si el AST la viera, el corpus no reproduciría el defecto y la comparación sería un adorno |

### 🔴 Y no se queda en el corpus: muerde sobre el fichero REAL

Un instrumento probado sólo contra un corpus prueba el instrumento, no el guard. Así que la
mutación se hace **en memoria sobre `products.routes.ts`**, reintroduciendo la forma exacta que se
escapó: la declaración `const vat = getLocale(merchant.country).defaultVat;` **y** un `tax: vat`
dentro del `.map` de las plantillas que ya existe en el fichero.

* el instrumento lo caza, y se comprueba que **el uso cazado es el del `.map`**, no otro;
* el censo por AST **sigue sin verlo** sobre ese mismo fichero mutado;
* **control negativo sobre el fichero real:** añadir una propiedad ajena (`nota: 'x'`) no lo acusa;
* y los dos anclajes de la inyección se afirman: si el fichero se mueve, esto **cae diciendo que
  hay que reanclarlo**, en vez de dejar de probar en silencio.

### 🔴 Cinco mutaciones sobre el guard — y una NO tumbaba nada

Commiteado en verde antes de mutar. Cada mutación con post-condición de que cambió el fichero que
dice, y restaurada y re-verificada.

| Mutación | Cae |
|---|---|
| se recorta la lista de códigos a sólo 2304 | **3** (incluido «los códigos siguen siendo DOS») |
| se quita el suelo de «la fuente ya se quejaba» | **1** |
| el instrumento contesta siempre CERO usos | **4** |
| **vuelve la ligadura de IVA al fichero real, en disco** | **3** |
| el nombre se compara por SUBCADENA en vez de exacto | **0** ⚠️ |

La quinta es la que enseña algo. La pieza compara el nombre **entero** y su comentario explica por
qué —`vat` casaría dentro de otro nombre y contaríamos de más—, **pero ningún caso lo probaba**. Una
defensa sin test es una decisión que el siguiente deshace sin enterarse. Se añadió el caso.

**Y el primer intento de escribirlo tampoco valía:** usaba `defaultVat` como nombre vecino, y
`defaultVat` **no contiene `vat`** — lleva `Vat`, con V mayúscula, e `includes` distingue. El caso
pasaba con el arreglo y sin él. Con `vatName` —un campo real de la tabla— la mutación tumba
exactamente ese test y nada más. **Escribir el caso no es tenerlo: hay que verlo caer.**

### Los dos suelos del propio instrumento

* si la fuente **ya** echa en falta ese nombre antes de tocar nada → se declara **CIEGO**, porque lo
  que salga después no se le puede atribuir a la retirada;
* si **no hay declaración que retirar** → también se declara, y con otras palabras: «no hay
  dependencias» y «no tengo por dónde empezar» son el mismo cero con significados opuestos.

## ① 🔴 LA MEDICIÓN — y no se construye el guard

Censo por AST sobre `src/`, `tests/`, `public/` y `scripts/`: **1.139 ficheros, 20.065 literales
numéricos**. Suelo: falla si no ve ningún `0.21`.

**Dos instrumentos, a propósito:**

| | Criterio | Total | `src/` | `public/` | `tests/` | `scripts/` |
|---|---|---|---|---|---|---|
| **A** | por **VALOR**: la fracción es un tipo conocido (0.21 · 0.19 · 0.18 · 0.16 · 0.10 · 0.07 · 0.05 · 0.04 · 0.03) | **279** | 11 | 1 | 232 | 35 |
| **B** | por **CONTEXTO**: nombre fiscal (`vat`/`tax`/`iva`/`igic`) **y** valor de tipo, fracción o porcentaje entero | **303** | 6 | 1 | 264 | 32 |

### Lo que decide la forma del guard: A tiene 5 falsos positivos de 12, y B tiene CERO

Los 12 aciertos de **A** fuera de tests, uno a uno:

| Sitio | Valor | Qué es de verdad |
|---|---|---|
| `src/core/i18n/locales.ts` ×6 | 0.21 · 0.16 · 0.19 · 0.21 · 0.18 · 0.19 | **la tabla**. El único sitio legítimo |
| `src/modules/invoicing/infra/pdf/pdf.service.ts:492` | 0.21 | **anchura de columna** (`wRot = totalsW * 0.21`) — 🔴 falso positivo |
| `src/modules/jobs/infra/albaranPdf.service.ts:207,209` | 0.18 ×2 | **anchuras de columna** — 🔴 falsos positivos |
| `src/modules/system/domain/qrPagina.service.ts:72` | 0.05 ×2 | **fórmula de contraste WCAG** — 🔴 falsos positivos |
| `public/dashboard/js/app.js:103` | 0.21 | ✅ **un tipo impositivo escrito a mano de verdad** |

**Cinco de doce son ruido, y ninguno tiene nada que ver con impuestos.** Un guard por VALOR daría
rojo por la anchura de una columna de PDF.

**B, en cambio, en `src/` y `public/` devuelve exactamente 7 y NINGUNO es falso positivo:** los 6 de
la tabla y el del frontend. Los 63 que B ve y A no —porcentajes enteros con nombre fiscal— **están
todos en `tests/` y `scripts/`**.

### El coste, que es la otra mitad de la decisión

**232 (A) / 264 (B) apariciones viven en `tests/` y `scripts/`, y son legítimas**: fixtures, seeds y
guards fiscales que tienen que teclear el tipo para comprobarlo. Los que más:

```
30  scripts/seed-video.mjs        13  tests/scrum295-modelo-303.test.mjs
22  tests/scrum141-factura-final   9  tests/scrum507-cantidad-supuesta
14  tests/scrum500-suplidos       8  tests/scrum293-retencion-irpf
```

Un guard que no los excluya es una fábrica de rojos legítimos.

### 🔴 El único hallazgo real del ①, con su matiz medido

`public/dashboard/js/app.js:103` cablea `defaultVat: 0.21` como respaldo de `window.appLocale`
cuando `me.locale` no viene. Es la misma forma que SCRUM-646 retiró del backend.

**Pero hoy no lo lee nadie:** las otras seis menciones de `defaultVat` en `public/dashboard/js/` son
**prosa** —comentarios que explican por qué NO se usa—, y `tiposDeIva.js` dice explícitamente que el
selector de IVA no sale de ahí. O sea: un literal de tipo impositivo **sin consumidor**.

**LA DECISIÓN ES DEL FUNDADOR. El guard del ① no se ha escrito**, tal y como pedía el encargo.
Si se construye, la medición dice cómo: **por NOMBRE + VALOR (instrumento B), acotado a `src/` y
`public/`**. Por valor a secas sería 42 % de ruido en `src/`.

## 🕳️ Huecos declarados

1. **El ① no está cubierto por ningún guard, y este fichero lo dice en su cabecera.** Un `0.21`
   tecleado a mano en un `create` sigue pasando por delante de los dos instrumentos que existen.
2. **El ② cubre la ligadura por NOMBRE de variable.** Si alguien escribe
   `tax: getLocale(c).defaultVat` **en línea**, sin variable intermedia, no hay declaración que
   retirar: eso lo caza el cortafuegos de SCRUM-646 (que mira el acceso a la propiedad), no éste.
   Los dos se necesitan, y por eso no se ha tocado aquel.
3. **El instrumento compila UN fichero aislado**, con `noLib`/`noResolve`. Resuelve nombres, no
   tipos: no sustituye a `npm run build`, y no lo pretende.
4. **La clasificación legítimo/sospechoso del ① la he hecho leyendo los 12 sitios de `src/` y
   `public/` uno a uno.** Los 267 de `tests/` y `scripts/` los he contado, **no los he leído**.

## 🔴 Hallazgo fuera de carril, y hay que decirlo: **`main` está en rojo**

La tanda de esta rama sale con **1 fallo**, y **no es de este ticket**:

```
not ok — SCRUM-652d · ✅ CONTROL POSITIVO: NO se estrena una entrada de nav para el parte
   🔴 se ha estrenado una entrada de nav para el parte. La puerta va en el Trabajo.
   tests/scrum652d-puerta-al-parte.test.mjs:164
```

**Medido, no supuesto** —porque «no es mío» es justo lo que hay que probar, no afirmar:

* mi diff contra `origin/main` son **TRES ficheros nuevos**: esta entrada y los dos del guard;
* ese test lee `public/dashboard/js/app.js`, `public/dashboard/index.html` y
  `tests/_solo-codigo.mjs` — **ninguno de los tres está en mi diff**, así que para todo lo que ese
  test mira, este árbol **es** el de `main`;
* y el HEAD de `main` es `4e9e114d Merge pull request #942 from lwislg99/scrum-652-puerta-al-parte`,
  que es **el ticket dueño de ese test**.

Se intentó además correrlo sobre un árbol limpio de `main` (`git worktree`), y **eso no sirvió**: sin
`node_modules` el fichero cae entero, que es otro rojo distinto. Se dice para que nadie lo cuente
como confirmación.

**No lo arreglo:** no es mi carril y el fichero es de otra sesión. Se reporta.
