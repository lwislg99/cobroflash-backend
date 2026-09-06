# SCRUM-749 · La primitiva que normalizaba en silencio

**Fecha:** 6-sep-2026 · **Carril:** producto · fechas · **Gate:** sin gate — el guard corre en `npm test`

**Medido contra:** `origin/main` = `50312d327c0f7ddcf8a0670ab54c46407a7bba9d` · 2026-09-06T22:36:05+01:00

---

## 1 · 🔴 EL ROJO, PRIMERO

`inicioDelDiaEn` / `finDelDiaEn` se apoyaban en `Date.UTC(y, m - 1, d, …)`, que **normaliza en
silencio**. Merchant en `Europe/Madrid`, y **el mismo resultado con el proceso en UTC y en
`Europe/Madrid`**:

```
'2026-02-31'  →  fin del día 2026-03-03T22:59:59.999Z     ← el 31 de febrero es 3 de marzo
'2026-06-31'  →  fin del día 2026-07-01T21:59:59.999Z
'2026-13-01'  →  fin del día 2027-01-01T22:59:59.999Z
```

**Dónde lo nota el profesional**, con el filtro REAL de consolidación de cliente —lo que decide
qué partes entran en una recapitulativa:

```
hasta «2026-02-28» → corte 2026-02-28T22:59:59.999Z   ENTRAN: ["ALB-2026-001"]
hasta «2026-02-31» → corte 2026-03-03T22:59:59.999Z   ENTRAN: ["ALB-2026-001","ALB-2026-002"]
```

`ALB-2026-002` es del **2 de marzo** y entraba en una factura acotada a febrero. Y
`GET /consolidables` pasa `req.query.hasta` **sin validar el formato**
(`typeof req.query.hasta === 'string' ? req.query.hasta : null`).

⚠️ **Precisión sobre el alcance, para no venderlo más alto de lo que es:** hoy **el panel no llama
a ese endpoint** (medido: 0 referencias a `consolidables` en `public/`). El daño está reproducido
en el servicio que alimenta esa bandeja y es alcanzable **por API**; desde el panel, todavía no.

---

## 2 · EL CENSO — y **la cifra de seis no se sostiene**

Por AST, sobre **1.278 ficheros**, sin lista cableada:

| | |
|---|---|
| llamadas totales | **11** |
| · en PRODUCTO (`src/`, `public/`) | **2** — `consolidacionCliente.service.ts:104` y `:109` |
| · en `tests/` | 9 |
| ficheros que las importan | 3 |

**SCRUM-633 no añade cinco: añade CERO.** Tres medidas:

1. La cabecera de su propio test enumera los cinco sitios y **los cinco están hechos**
   (`🔧 arreglado` ×4, `✔ ya era correcto` ×1).
2. Los cinco son **front y landing** y **no pueden** llamar a esta primitiva: es TypeScript
   compilado a `dist/` para Node. Lo dice el propio árbol —
   `quoteAtajosVencimiento.js:40`: *«es TypeScript compilado para Node y esta pantalla es
   JavaScript de navegador»*.
3. El front usa una **copia declarada** (`quoteCaducidad.js:27`), y esa copia **sólo implementa la
   dirección segura** (instante → día). **No arrastra el defecto**: comprobado.

El `finDelDiaEn` del test de 633 es un **oráculo** para verificar la cadena del front, no un
llamador de producto.

**Conclusión:** no hay un mecanismo de seis. Hay un defecto real en una primitiva con **un fichero
llamador**. Eso no quita el ticket — lo abarata.

### 📌 Y el árbol ya lo sabía: SCRUM-747 los tenía censados

`tests/scrum747-validar-antes-de-normalizar.test.mjs` llevaba los dos en su lista `PENDIENTES`. Su
motivo escrito decía: *«su entrada ya viene de `diaNaturalEn`, que sólo produce días bien
formados»*. **Medido, eso está al revés:** en `dentroDeRangoFecha`, el ayudante `diaISO(v, zona)`
devuelve `v.slice(0, 10)` cuando `v` llega como **cadena** —el `req.query.hasta` crudo— y sólo pasa
por `diaNaturalEn` cuando llega un `Date`. Por ahí entraba «2026-02-31».

Al arreglarlo, su censo se movió y el guard cayó pidiendo justo lo que hay que hacer: *«Si has
arreglado uno, quítalo de la lista»*. Quitados, con el porqué escrito al lado.

---

## 3 · LA DECISIÓN: ① RECHAZAR (fail-closed)

| salida | por qué NO / SÍ |
|---|---|
| ② devolver el valor **y un aviso** | ⛔ **reproduce el defecto**: en JavaScript nada obliga a mirar un aviso. El estado de hoy ya es «el valor con un aviso que nadie escribió» |
| ③ normalizar **declarándolo** | ⛔ sigue emitiendo una fecha que nadie eligió; una línea de log no para la factura equivocada, y esa ruta no lee logs |
| ① **rechazar** | ✅ es lo único que **no se puede ignorar por construcción**, y hoy cuesta **dos llamadas en un fichero** |

La doctrina encaja literal: *un valor por defecto plausible es peor que un valor imposible*. Una
fecha normalizada es el valor plausible perfecto — existe, casi siempre es del mismo mes, y nadie
la eligió.

**Cómo se comprueba que el día existe:** por **ida y vuelta**. `Date.UTC` normaliza, así que si los
componentes que salen no son los que entraron, el día no existía. No hay una segunda tabla de
meses que mantener.

---

## 4 · LO CONSTRUIDO, Y DÓNDE PARO

**Construido** (no necesita literal nuevo: la ruta ya tiene `catch → 500 internal_error`): las dos
primitivas lanzan `RangeError: dia_inexistente` con el día dentro. Es mensaje de log, no de
pantalla.

**PARÉ AQUÍ y el asesor FIRMÓ EL TEXTO en la misma sesión**, así que también está construido:

> **«La fecha «hasta» no existe en el calendario. Revísala.»**

`GET /consolidables` lo contesta con **400** siguiendo el patrón que ya existe en ese mismo
fichero (`res.status(400).json({ error, message })`, líneas 290/389/401) y que el front enseña por
`api.js:299` (`data?.message`). El predicado `diaExiste` se **deriva** de la primitiva: no hay una
segunda tabla de meses.

El asesor firmó **los dos textos**, uno por campo:

> **«La fecha «hasta» no existe en el calendario. Revísala.»**
> **«La fecha «desde» no existe en el calendario. Revísala.»**

🔴 **Van ENTEROS, no compuestos.** Habría sido cómodo sustituir el nombre del campo en una
plantilla; eso convierte dos textos APROBADOS en uno inventado en tiempo de ejecución. El guard
exige los dos literales, y además exige que **no aparezca un tercero**:  («YYYY-MM») entra por
esta misma ruta y este ticket **no lo cubre** — si alguien le escribe un aviso, que lo firme antes.

---

## LOS CONTROLES

| control | resultado |
|---|---|
| 🔴 **el que decide** — `'2026-02-31'` | antes `2026-03-03T22:59:59.999Z` · ahora **`RangeError: dia_inexistente`** |
| 🔴 **el que decide** — el filtro | antes ENTRAN `[001, 002]` · ahora **rechaza** |
| ✅ **la respuesta al profesional** | antes `500 internal_error` · ahora **400** con el texto firmado, literal |
| ✅ **positivo** — fechas normales | **exactamente los mismos instantes que antes**, incluidos el 29-feb bisiesto y **los dos días de cambio de hora** (2026-03-29 y 2026-10-25) |
| ✅ **zona horaria** | la tanda entera en **UTC** y en **`Europe/Madrid`**: mismo recuento, mismos instantes, mismo fallo antes de arreglar `scrum747` y mismo verde después |

**Sobre el aviso del encargo (cinco tests que miden la máquina):** este fichero **no añade un
sexto**. Todas las zonas van escritas en cada llamada, los instantes se comparan en ISO (UTC) y no
se lee `process.env.TZ` ni `resolvedOptions()`. Los valores esperados van **escritos**, no
recalculados con la misma aritmética que se prueba — recalcularlos habría sido un espejo.

---

## TESTS

- [tests/scrum749-la-primitiva-que-normaliza.test.mjs](tests/scrum749-la-primitiva-que-normaliza.test.mjs)
- [tests/scrum747-validar-antes-de-normalizar.test.mjs](tests/scrum747-validar-antes-de-normalizar.test.mjs) — su lista `PENDIENTES` pierde los dos

## MUTACIÓN DECLARADA

| mutación | qué prueba |
|---|---|
| `if (!existe) {` → `if (false) {` | el ida y vuelta deja de comprobarse y el 31 de febrero vuelve a ser 3 de marzo |

---

## HUECOS DECLARADOS

- **El 500 no es la respuesta correcta** para «ese día no existe». Descrito arriba; el 400 con su
  texto es del asesor.
- **Los otros dos troceos sin validar siguen en `PENDIENTES`** (`expenses.service.ts|listExpenses`
  y `albaran.service.ts|mesNaturalLabel`): otro carril y otro coste de equivocarse (regla 9). No se
  tocan aquí.
- **No se ha tocado la ruta**: sigue aceptando `req.query.hasta` sin validar el formato. El rechazo
  ocurre una capa más abajo. Validar en la boca es lo que pediría el 400.
