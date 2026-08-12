# SCRUM-498 · El «21» se cuenta, y las doce frases que lo escriben quedan atadas

**Medido contra:** `origin/main` = `4f20e2911d286b6c609d5137523c802ada2bcaaf` · 2026-08-12T12:26:32+01:00
**Fecha:** 12-ago-2026 · **Carril:** guards · **Gate:** sin gate, corre en `npm test`
**Cero líneas de `prisma/schema.prisma`.** Aquí solo se cuenta.

> El sha y la hora salen los dos de `git show -s --format=%H%n%cI`. El guard 267 valida la **forma**
> del sha y **nadie valida la hora**: una hora escrita a ojo pasa en verde, así que no se escribe a ojo.

---

## 0 · Paso 0

| | |
|---|---|
| `main` antes / después del fetch | `94739993…` → `84f60528e626f6bc569c43e08e635497fc351d13` |
| `main` al cerrar, tras mezclarlo dentro | `4f20e2911d286b6c609d5137523c802ada2bcaaf` |

**La premisa, medida y cierta:**

* `EmailMessage` **NO está** en `main:prisma/schema.prisma` (comprobado por contenido).
* Está en `scrum-475-schema-emailmessage` — **`56a5e462`, Javier Pereira Fernández,
  2026-08-12 11:05:10 +0100** — y **lleva `merchantId`** (línea 927). El día que entre, la
  población pasa de 21 a 22.
* **Ninguna de las ocho cae hoy**: las doce frases dicen 21 y 21 es la cifra. STOP 4 no dispara.

### 🔴 Y hay TRES variantes de suelo, no dos

| Suelo | Dónde |
|---|---|
| `MINIMO_MODELOS = 15` | `src/modules/exports/domain/portabilidadCompleta.ts:114` |
| `>= 20` | `tests/scrum314-wipedemo-derivado.test.mjs:59` |
| `>= 21` | `tests/scrum243-tenencia-lectura.test.mjs:147` |

## 1 · 🔴 Corrijo el encuadre: el suelo no estaba mal calibrado

La sospecha era *«un suelo con holgura convierte una afirmación exacta en decorativa»*. Medido,
**ninguno de los tres es un descuido**, y el de `portabilidadCompleta` lo argumenta su propio autor:

> *«El número no se fija a 21 a propósito: un mínimo no estorba cuando alguien añade un modelo, y un
> exacto obligaría a tocar esto en cada PR ajeno hasta que alguien lo desactive.»*

Tiene razón, y es exactamente el peaje que el encargo quería evitar. **El trabajo del suelo es cazar
CEGUERA** —si el DMMF llega vacío, el paquete de portabilidad saldría vacío y verde— y para eso un
mínimo es la forma correcta.

> 🔴 **La avería real no es que el suelo tenga holgura: es que la AFIRMACIÓN no la vigilaba nadie.**
> Pedirle al suelo que además vigile la cifra es pedirle dos trabajos con un solo número.

**Así que aquí no se toca ni un suelo.** Se ata la prosa, que es lo que estaba suelto.

## 2 · Lo aprendido — regla de la casa, no arreglo puntual

> 🔴 **Un número escrito en prosa no tiene fecha de caducidad visible, y el que lo lee no sabe que
> ya no vale.**
>
> 🔴 **Un suelo y una afirmación son dos trabajos distintos.** El suelo dice «no estoy ciego»; la
> afirmación dice «son N». Un solo número no puede hacer los dos, y cuando se le pide, el que se
> pierde es el segundo — en silencio.

Y el corolario que decide la forma del arreglo:

> **Un comentario no puede contar.** Donde el número vive en un mensaje interpolable, se **deriva** y
> desaparece. Donde vive en prosa, derivar es imposible: sólo queda **atarlo**.

**Excepción medida:** un número **con su fecha visible** no es el defecto.
`tests/scrum243-tenencia-lectura.test.mjs:148` dice *«el 30-jul había 21»*, y eso **seguirá siendo
cierto cuando sean 22**. No se registra, a propósito. Lo que caduca en silencio es el número **sin
fecha**.

## 3 · Qué se construye

### El contador — dos instrumentos, y gana el de la casa

| | Instrumento | Papel |
|---|---|---|
| ① | `modelosDelMerchant()` sobre `Prisma.dmmf.datamodel` | **la herramienta de la casa: gana ella.** Ya existe, es inyectable y está probada |
| ② | parseo del **texto** de `prisma/schema.prisma`, bloque a bloque | no la sustituye: la **contrasta** |

Si discrepan, **no es que el número esté en duda: es un cliente de Prisma desparejado**, y hay un
test que lo dice con esas palabras. Hoy los dos dan **21**, con la misma lista exacta.

### El registro — regex, no números de línea

Doce afirmaciones atadas en ocho ficheros. El registro guarda un **regex con un grupo** (el número),
no una línea: las líneas se mueven con cualquier edición y un registro que apunta a una línea rota
sin que nadie lo note.

🔴 **Y si el patrón deja de casar, el guard NO da verde: se declara CIEGO.** «Ya no dice 21» y «no sé
leer la frase» no pueden salir por la misma línea. *Eso me cazó a mí durante el trabajo*: un regex
mal escrito para `portabilidadCompleta.ts` salió como **CIEGA** en vez de pasar de largo.

### La única que sí se pudo derivar

`tests/scrum314-wipedemo-derivado.test.mjs:60` — el mensaje del suelo decía *«y son 21»*. Ahora
interpola la cifra contada y **el número desaparece**. El `>= 20` de al lado **no se toca**, y el
comentario explica por qué.

## 4 · Verificación

| | Qué | |
|---|---|---|
| 🔴 **EL ENSAYO DEL DÍA D** | se inyecta el `EmailMessage` **real** de `56a5e462` en el texto del esquema —sin tocar `schema.prisma`— y **caen las doce**, cada una con fichero, línea, lo que dice y lo que son | ✅ |
| 🔴 **AUTOPRUEBA** | fuente sintética: cuenta bien · no cuenta el que no tiene `merchantId` · la frase buena pasa · la vieja cae · la reescrita se declara ciega | ✅ |
| **CONTROL POSITIVO** | con el esquema tal cual: verde, 21, cero viejas | ✅ |
| **CONTROL NEGATIVO** | quitar `Event` —que **no** tiene `merchantId`— no mueve la cifra. Si la moviera, se estaría contando el total de modelos | ✅ |
| **SUELO** | cero modelos se declara **ciego** (cliente sin generar), no «esquema limpio» | ✅ |
| **Dos instrumentos** | DMMF y texto, contrastados, con su propio rojo | ✅ |

### Los rojos por el mecanismo, probados

| Mutación | Cae diciendo |
|---|---|
| se neutraliza la comparación | *«el día que entre `EmailMessage` solo caerían **0 de 12** frases … se quedarían diciendo 21 para siempre, y nadie se enteraría»* |
| un patrón deja de casar | *«el guard ha dejado de VER alguna de las frases que vigila … NO es que la frase esté bien: es que el guard mira a la pared»* |

**Suite:** línea base **3.436 · 3.359 pasan · 0 fallos · 77 saltados**, medida aparte apartando el
fichero nuevo del glob (no se borró nada del disco). `guards:entrada` en verde. `dist/` reconstruido
y cliente regenerado desde este worktree antes de medir.

## 5 · Huecos declarados

* 🔴 **`tests/_merchant-fixture.mjs` queda fuera** (SCRUM-495/497, otra sesión dentro). Sus **tres**
  frases dicen 21 y se volverán falsas el mismo día. Quedan **declaradas con trinquete**: si aparece
  una cuarta, salta.
* **La cabecera de `docs/sql/scrum-475-email-messages.sql`** —la víctima que originó todo, con la
  cuenta de `invoices` del 7-ago— **no se toca aquí**: ya está corregida en otra rama pendiente.
* **El registro cubre esta población, no todas las cifras del repo.** Otros «21» del árbol son otra
  cosa (tipos de IVA, respuestas del bot, importes de fixture) y están descartados por nombre.
* **`docs/` no se vigila.** Si una entrada de máster escribe la cifra, este guard no la ve.
* **El regex es por redacción.** Si alguien reescribe la frase, el guard se declara ciego y hay que
  actualizar su patrón — es el precio de atar prosa, y es más barato que no verla.

## 6 · Lo que NO se ha tocado

`prisma/schema.prisma` (cero líneas) · **ningún suelo** · `tests/_merchant-fixture.mjs` ·
`borradoMerchant.ts`, `CAMPOS_PERSONALES`, `backup-dump.mjs`, `deriva-prod.sql` · ninguna otra cifra
de prosa del repo · ninguna dependencia nueva.

## 7 · Ficheros

* `tests/_afirmaciones-derivadas.mjs` (nuevo) — el contador, el registro y la autoprueba.
* `tests/scrum498-cifra-derivada.test.mjs` (nuevo) — 9 tests, con el ensayo del día D.
* `tests/scrum314-wipedemo-derivado.test.mjs` — el mensaje del suelo pasa a **contar**; el `>= 20`
  intacto, con el motivo escrito al lado.
* `docs/master/SCRUM-498.md` — esta entrada.
