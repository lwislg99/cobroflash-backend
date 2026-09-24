# SCRUM-943 · la API aceptaba CUALQUIER categoría de gasto

**Fecha:** 20-sep-2026 · **Carril:** ticket de S1 (servidor); lo trabaja S4 por encargo del orquestador (excepción de carril aceptada por escrito por el canal el 20-sep, porque S4 lo midió y S1 estaba con la IA de presupuestos) · **Pedido por:** el orquestador
**Medido contra:** `origin/main` = `205d3d4af7660d74281df366895436239b69d709` · 2026-09-20T13:35:47Z
**Rama:** `scrum-943-categoria-validada`

## 🔒 Sin víctima real (para quien lea esto dentro de un mes)

**No hubo incidente.** Hoy hay 0 merchants reales, y las cuatro filas sucias de staging (`materials` ×2, `travel`,
`subcontractor`) las sembró nuestra propia Sesión 4 el 17-sep. Se arregla porque el defecto es de la RUTA —cualquier
cliente de la API podía repetirlo—, no porque alguien lo sufriera.

## El defecto, medido antes de escribir (PASO 0, corriendo)

Rutas de verdad (`dist/modules/expenses/app/routes/expenses.routes.js`), base doblada, sin red:

```
POST category="materials"     -> HTTP 201 · guardado category="materials"
POST category="travel"        -> HTTP 201 · guardado category="travel"
POST category="subcontractor" -> HTTP 201 · guardado category="subcontractor"
POST category="materiales"    -> HTTP 201 · guardado category="materiales"
POST category=undefined / ""  -> HTTP 201 · guardado category="otros"
PUT  category="materials"     -> HTTP 200 · guardado category="materials"
PUT  category="herramientas"  -> HTTP 200 · guardado category="herramientas"
```

Los únicos escritores de `category` son `POST /` y `PUT /:id` de `expenses.routes.ts` (`String(category)` a pelo, y el
servicio tampoco miraba). Fuera de `src/`, sólo `scripts/seed-video.mjs` (siembra local). La pantalla cae a «Otros» para lo que
no conoce, así que las filas PARECEN correctas y el dato malo sólo asoma en el KPI «Mayor categoría» (eso es SCRUM-944 punto 1).

## Lo que se hace

- `createExpense` y `updateExpense` (DOMINIO, no la ruta: un tercer llamador no se lo salta, la razón de SCRUM-135)
  lanzan `ExpenseCategoryError` si llega una categoría que no es de `EXPENSE_CATEGORIES`.
- Las dos rutas lo pasan a **400 `{ ok:false, error:'category_invalid', categories:[…las cinco…] }`**, y no escriben nada.
  **Sin `message`**: el selector de la pantalla sólo ofrece las cinco, así que es la red para llamadas directas, y un
  texto nuevo para el usuario tendría que estar firmado. No hay copy nuevo.
- Sin categoría (ausente, `''` o `null` en el alta) sigue siendo «otros»; una edición que no manda `category` no la toca.
- ⚠️ Cambio de comportamiento a sabiendas: `PUT` con `category: ''` antes guardaba la cadena vacía y ahora da 400
  (la vacía tampoco es de las cinco). La pantalla nunca la manda: el `<select>` no tiene opción vacía.

## Tests

`tests/scrum943-la-categoria-se-valida.test.mjs` (9). Visto en **rojo** contra el `dist/` anterior al arreglo: **6 pasan
(suelo, positivos, negativo) y 3 caen (los tres del defecto)** sobre 9; en verde 9/9 tras compilar. Suelo: el banco ve la
escritura de una categoría válida, en el alta y en la edición. Positivo: las cinco entran igual y «sin categoría» es «otros».
Negativo: no se normaliza («Materiales» se rechaza, no se corrige) y la lectura no traduce una fila ya sucia.

## Lo que NO se hace

- No se normaliza ni se traduce nada, ni al escribir ni al leer: taparía el defecto.
- No se tocan las filas ya escritas (las 4 de staging): el saneo, si hace falta, es una decisión aparte.
- No se toca el KPI que pinta la clave cruda (SCRUM-944 punto 1, de S2) ni el motor del justificante.

## No mirado

- Una llamada real contra staging (el banco no toca base). La validación corre antes que cualquier consulta, así que
  no depende de la base.
- Si algún cliente externo manda `category` con mayúsculas o en inglés: hoy 0 merchants reales; con clientes reales sería un 400 visible.

## Errores propios

- `esCategoriaDeGasto` salió exportada y `scrum411-exports-inalcanzables` habría caído (un `export` sin consumidor de
  fuera): la salida fue no exportarla, no declararla huérfana. Lo cazó correr los guards vecinos antes de empujar.
