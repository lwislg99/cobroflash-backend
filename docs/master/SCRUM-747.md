# SCRUM-747 · Validar antes de normalizar: un mes que no existe no tiene un mes correcto

**Medido contra:** `origin/main` = `b54423162c3dca9f25dd160c928a70fb371f3c6f` · 2026-09-05T00:31:00+02:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Alcance:** validar la entrada del cálculo del plazo del art. 13.2 **antes** de que `Date.UTC`
la normalice, fallando **con el valor delante**. Un fichero de producción tocado:
`src/modules/jobs/domain/pendientesFacturar.service.ts`.

---

## 1 · El defecto, que salió midiendo SCRUM-648

`Date.UTC` **normaliza en silencio**. Y eso, en un cálculo de plazo legal, no produce un error:
produce **otro plazo**.

| `mesKey` | Antes devolvía | Semáforo |
|---|---|---|
| `2026-13` (mes 13) | `2027-01-31` | **verde** |
| `2026-00` | `2025-12-31` | rojo |
| `99999-99` | año `+100007` | **verde** |

**🔴 Y es peor que un valor ilegible.** Contra un ilegible se puede programar una barrera —es
**detectable**—; contra un plazo plausible **no hay síntoma**: el número es finito, el semáforo es
correcto para ese número, y el número es de otro mes.

## 2 · Lo que se hace, y lo que NO

**Se valida antes de trocear y se falla nombrando el valor:**

```
mesKey inválido: "2026-13". Se esperaba «YYYY-MM» con mes entre 01 y 12. No se normaliza a un
mes vecino: un plazo del art. 13.2 calculado sobre un mes que no existe sería un plazo inventado.
```

**⛔ NO se repara con un valor por defecto.** Elegir un mes vecino convertiría un dato roto en un
plazo legal inventado. Y el error **dice qué entró**: un fallo que no lo dice obliga a
reproducirlo para arreglarlo, y el origen puede estar en otra máquina.

**Un solo sitio de validación** (`partesDelMesKey`), no dos: las dos funciones reciben el mismo
`mesKey` y lo troceaban cada una por su cuenta. Dos validaciones acaban divergiendo.

## 3 · 🔴 EL FILO — y es la mitad del ticket

> *«Si endureces de más, rompes la bandeja de alguien que no tenía ningún problema.»*

**2.424 casos legítimos** (2000-2100 × 12 meses × 2 tipos), comparados contra una línea base
capturada **antes** de tocar nada:

```
casos legítimos comparados: 2424 vs 2424
diferencias: 0
✔ IDÉNTICO: no se ha roto la bandeja de nadie que funcionara
```

Y el desbordamiento **legítimo** sigue intacto: `2026-12` → `2027-01-16`; el bisiesto
`2024-02` → `2024-02-29`.

### La expectativa se DERIVA, no se congela

Un fichero de referencia con 2.424 filas envejecería igual que las cifras de SCRUM-737. En el
test la expectativa se calcula **por otro camino** —tabla de días por mes con la regla de
bisiesto, escrita a mano—, para que sean **dos implementaciones independientes contrastándose**.

## 4 · Mi propio hueco declarado en SCRUM-648, cerrado

`avisoDeFacturacion` recibe el **mismo** `mesKey` y decide **si avisar**. Con un mes fuera de
rango, su `dia16` salía como `2026-13-16` —ilegible—, `diasEntre` daba `NaN`, la comparación era
falsa y **el aviso quincenal se perdía en silencio**.

**Si el semáforo miente, ese aviso también.** Ahora valida por el mismo sitio.

## 5 · 🔴 El censo me corrigió a mí misma a mitad del ticket

La primera versión del detector buscaba `Date.UTC` cuyos argumentos vinieran de un
`split().map(Number)` **en el mismo ámbito**. Dio **3**.

**Y había 6.** `inicioDelDiaEn` y `finDelDiaEn` **trocean en una función y construyen la fecha en
otra** (`instanteDe`), así que el detector no cruzaba la llamada y los daba por limpios.
Comprobado **ejecutándolos**:

```
inicioDelDiaEn("2026-13-01") → 2026-12-31T23:00Z   (enero de 2027 en Madrid)
inicioDelDiaEn("2026-02-31") → 2026-03-02T23:00Z   ← el 31 de febrero es 2 de marzo
inicioDelDiaEn("2026-00-10") → 2025-12-09T23:00Z
```

**El criterio bueno no es dónde se construye la fecha: es que se trocea una cadena a números y no
se mira el resultado antes de usarlo.** Eso se ve en la declaración, sin seguir llamadas.

| | |
|---|---|
| Población declarada | **268** ficheros de `src/` |
| Sitios con troceo sin validar | **6**, en 4 ficheros |
| Cerrados por este ticket | **2** (los que producen un plazo del art. 13.2) |

### Los 4 que quedan, NOMBRADOS con su motivo

| Sitio | Por qué no aquí |
|---|---|
| `zonaDelMerchant.ts` · `inicioDelDiaEn` | primitiva usada por cuatro cálculos; su entrada ya viene de `diaNaturalEn`, que sólo produce días bien formados. Arreglarla toca los cuatro y merece su paso |
| `zonaDelMerchant.ts` · `finDelDiaEn` | idéntico |
| `expenses.service.ts` · `listExpenses` | otro módulo, otro carril (regla 9) |
| `albaran.service.ts` · `mesNaturalLabel` | produce una **etiqueta para leer**, no un plazo legal: el coste de equivocarse no es el mismo |

Subir un total sin decir qué lo compone es cómo un censo deja de vigilar.

## 6 · El guard de SCRUM-411 me pidió quitar dos exports, y tenía razón

`MesKeyInvalidoError` y `partesDelMesKey` sólo las usaba su test. **Un export sin llamador de
fuera es indistinguible de una función entregada** — así estuvo meses `borrarMerchant`, con la
promesa escrita en la página de privacidad.

Retirados, y el test pasa a medir por la **superficie pública**, que además es lo que vería un
llamador real.

## 7 · Probado en ROJO, en las dos direcciones

| Mutación | Qué cae |
|---|---|
| se quita la barrera de rango (vuelve la normalización silenciosa) | los **tres** del defecto — y **el filo sigue verde**, que es lo correcto |
| **se endurece de más** (se rechaza diciembre) | **sólo el filo** |

**La segunda es la que da valor a la primera:** demuestra que el filo muerde, y que la protección
no se ha pasado de dura. Los ficheros mutados quedaron **idénticos byte a byte** al original
leído de disco.

## 8 · Huecos declarados

* **`inicioDelDiaEn` y `finDelDiaEn` siguen normalizando en silencio.** Medido y nombrado, no
  arreglado. Hoy su entrada viene bien formada, pero eso es una garantía del llamador, no de la
  función.
* **El detector no sigue el valor entre funciones.** Ésa fue justo la razón de que la primera
  versión diera 3 en vez de 6. El criterio nuevo lo esquiva mirando la declaración, pero **una
  validación hecha en otra función tampoco la vería** — daría un falso positivo, no un falso
  negativo, que es el lado bueno del error.
* **No he medido si algún dato en base puede producir un `mesKey` corrupto.** `mesNaturalEn` no
  puede hoy, pero no he auditado importaciones antiguas.
* **La lista `VALIDA` de formas de comprobar un número es a mano**, y podría no reconocer una
  validación escrita de otra manera.
