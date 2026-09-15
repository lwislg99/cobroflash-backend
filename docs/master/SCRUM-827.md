# SCRUM-827 · El trinquete del IVA pasa a vigilar el VALOR, no sólo el NOMBRE

**Medido contra:** `origin/main` = `5dcf766ace4f78dcb773f9ac2a4fb935033ab5a7` · 2026-09-08T09:08:14Z

**Carril:** instrumentos / fiscal (lectura) · **Reemplaza a SCRUM-706**

> ⛔ Este ticket **sólo LEE** el camino de emisión (regla 38). No lo modifica y no lo importa.
> No entra ningún estado, flag ni dependencia. `prisma/schema.prisma` no se toca.

---

## 0 · Obligación 0, y qué hay vivo de SCRUM-706

```
git ls-remote --heads origin | grep -E "refs/heads/scrum-827[a-z]?(-|$)"   → ninguna
git ls-remote --heads origin | grep -E "refs/heads/scrum-706[a-z]?(-|$)"   → ninguna
```

**De SCRUM-706 lo vivo es «el cable del dictado», y está ENTERO en `main`**: PR #985 desde
`scrum-706-cablear-el-dictado` (mergeada y borrada), commits `c6a38db7` y `903afdb7`, y su entrada
`docs/master/SCRUM-706.md` titulada *«el cable del dictado — la cadena de Tecnosel, OCHO DE OCHO»*.

⇒ El trinquete del IVA **nunca estuvo en 706**: era sólo el asunto de Jira. Por eso 827 lo
reemplaza, y por eso **no hay nada que rescatar**: renumerar no pierde trabajo aquí.

## 1 · 🔴 El hueco estaba DECLARADO POR ESCRITO, con fichero y línea

No hubo que descubrirlo. Los propios guards lo decían:

| dónde | qué dice, literal |
| --- | --- |
| `tests/scrum646-cortafuegos-defaultvat.test.mjs:27` | «Esto vigila el NOMBRE. Si alguien copia el número `0.21` a mano en un `create`, este guard no lo ve. **No se puede vigilar «un tipo impositivo» sin vigilar cualquier número, y eso no es un guard: es ruido.**» |
| `tests/scrum664-el-compilador-como-censo.test.mjs:11` | «① vigila el NOMBRE, no el VALOR: un `0.21` escrito a mano pasa por delante. 🔴 **NO SE CUBRE AQUÍ.**» |

> 🔒 **Un límite declarado y no cerrado deja de ser una advertencia y pasa a ser un permiso.**

Y es el defecto 3 de la casa —el instrumento no mide lo que dice medir— agravado por el 1: produce
**verdes**. Un `0.21` a mano pasaba y nadie se enteraba.

## 2 · La objeción del 646 tenía respuesta, y es la forma del censo

«No se puede vigilar un tipo impositivo sin vigilar cualquier número» es **cierto si sólo se mira
el valor**. Ya estaba medido en `docs/master/SCRUM-664.md`:

| criterio | aciertos en `src/`+`public/` | falsos positivos |
| --- | ---: | ---: |
| **A** · sólo el VALOR | 12 | **5** — anchuras de columna de PDF, contraste WCAG |
| **B** · NOMBRE **y** VALOR | **7** | **0** |

Por eso este guard exige **las dos cosas a la vez**. Reproducido hoy con el instrumento nuevo:
**7 aciertos exactos, y 0 en los tres sitios de ruido conocidos.**

### 🔴 El nombre se compara por SEGMENTOS, no por subcadena

Es la lección literal de SCRUM-664 (`:151-152`): **`defaultVat` NO contiene `vat`** —lleva `Vat`,
con V mayúscula, y `includes` distingue—, así que una comparación ingenua se dejaría fuera justo el
caso que originó todo. Y al revés: `iva` como subcadena casaría dentro de `derivado`, `privado` y
`activar`. El identificador se parte por camello y guiones bajos y se pregunta si **algún segmento
es exactamente** un nombre fiscal (`vat` · `tax` · `iva` · `igic` · `igv`). Sin listas de excepciones.

## 3 · La decisión de alcance: `defaultVat: 0.21` en `app.js:103` se RETIRA

El ticket pedía medir antes de vigilar. **Medido:** en todo `public/`, quitando comentarios,
`defaultVat` aparecía **una sola vez — esa** y con **cero lectores**. El censo no se equivocaba.

Era el respaldo de `window.appLocale` cuando el servidor no manda `me.locale`, y **estampaba el
21 % español a cualquiera**, cuando `defaultVat` está indexado por PAÍS (MX 16 % · PE 18 % ·
CO/CL 19 %). Ahora, si alguien lo leyera, obtendría `undefined` y fallaría a la vista en vez de
aplicar en silencio el tipo de otro país.

⇒ Tras retirarlo, **el único sitio del árbol con un tipo de IVA escrito es la tabla de locales**,
que es donde el número ES el dato y no una copia.

## 4 · Verificación

- 🔴 **EL ROJO, sobre fuente sintética:** un `tax: 0.21` en un fichero nuevo **cae nombrando
  fichero y línea**. Y el caso está elegido para que **el mecanismo viejo lo deje pasar**: no
  nombra `defaultVat`, así que `scrum646` no tiene nada que decir — que es exactamente el hueco.
- 🔴 **También con el PORCENTAJE ENTERO** (`tipoIva: 21`): las pantallas enseñan enteros y la tabla
  guarda fracciones; vigilar una sola forma dejaría la otra abierta, y el front es justo donde
  estaba el caso real.
- ✅ **POSITIVO ENUMERADO:** los seis tipos de la tabla, uno a uno y en orden
  (ES 0.21 · MX 0.16 · CO 0.19 · AR 0.21 · PE 0.18 · CL 0.19).
- ✅ **NEGATIVO, apuntado a casos que EXISTEN:** los tres sitios que un guard por valor acusaría en
  falso —`pdf.service.ts` (ancho de columna), `albaranPdf.service.ts` (anchos), `qrPagina.service.ts`
  (contraste WCAG)— **no se cuentan**. Lleva su propio suelo: si esos ficheros desaparecen, el
  control lo dice en vez de pasar vacío. Más la mitad simétrica sobre casos fabricados
  (`descuentoGlobal`, `derivado`, `tax: 0` → exención legítima, no hallazgo).
- 🔴 **SUELO:** cero aciertos es CEGUERA, no limpieza — la tabla tiene seis por construcción.

## 5 · Lo que NO se toca

`scrum646` y `scrum664` **no se relajan**: aquéllos vigilan que nadie NOMBRE `defaultVat` fuera de
la tabla, éste que nadie escriba su VALOR. Son complementarios y se completan.
Tampoco el camino de emisión fiscal, ni `prisma/schema.prisma`, ni microcopy.
