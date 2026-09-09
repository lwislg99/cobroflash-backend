# PR · SCRUM-816 · La lista de Trabajos, al día y CERTIFICADA

> Compare: https://github.com/lwislg99/cobroflash-backend/compare/main...scrum-816-lista-de-trabajos-al-dia

**Qué es esto:** la rama de SCRUM-816 puesta al día con `main` y certificada por una segunda
sesión. Deriva de `scrum-816-lista-de-trabajos` @ `4dd6baa8`; **su rama no se toca**.

**La mezcla entró limpia: cero conflictos.** Yo había pronosticado dos, leyendo «changed in both»
de `merge-tree` — que no es un choque. Queda dicho porque un pronóstico equivocado que nadie
corrige es la razón por la que el siguiente no lo intenta.

---

## Lo que he verificado EJECUTANDO

| | |
|---|---|
| su test `scrum816-la-lista-no-miente` | **12/12** |
| `guard:lista-trabajos` (Edge, `page.setViewport` real) | **exit 0** |
| **tanda completa** | **5.972 tests · 0 fallos · 102 saltos**, todos de base y con su motivo |
| 🔒 ① el clic en el DESPLEGABLE asigna y NO navega | ✅ `PATCH /admin/jobs/3 {"assignedUserIds":[1,3]}` · ni abrir ni marcar navegaron |
| 🔒 ② el clic en la FILA navega y NO asigna | ✅ `jobs-detail {"jobId":3}` · **cero PATCH** · casillas intactas |
| anchos 390 / 1280 / 1700, con 20 y con 1 | ✅ cero scroll horizontal en los seis |
| las otras CUATRO listas, por hash | ✅ idénticas, con control positivo |

Las dos del candado son **pruebas distintas** y las he corrido **las dos, separadas**: son el único
riesgo real del ticket y no valen leídas.

**Y el PASO 0 del ancho lo he re-medido por mi cuenta en vez de heredarlo:** `.jobs-pantalla
{ max-width: 980px }` es una sola regla, en una sola vista, y ningún otro selector lleva ese tope.
**No es compartido** — el alcance del ticket no cambia. Coincide con lo que midió su sesión.

## 🔴 El hallazgo del `serializeJob`, CONFIRMADO ejecutando

Es el que decide si SCRUM-823 se puede construir, así que no vale heredado. Se ejecuta la escalera
real (`jobNextAction.js`) con la misma fila en dos formas, cinco estados × con y sin resto:

```
SIN `albaranes`/`invoices` (lo que mandaba serializeJob ANTES):   10 × nuevo
CON un albarán `emitido`   (lo que manda AHORA):                  10 × firmar
```

Sin los campos, la escalera sabía decir **una sola cosa para los cinco estados** — de ahí el mismo
botón veinte veces. No era diseño: era un dato que no viajaba. **SCRUM-823 tiene con qué
construirse.**

## 🔴 Lo que he cambiado de su trabajo, y por qué

**Un fichero: `scripts/_banco-lista.mjs`. La espera que faltaba, y sólo ésa.**

Su guard daba **un rojo que no se reproducía**: «Facturas HA CAMBIADO · 5919 ≠ **5839**», 80
caracteres de menos, contra una rama que no toca facturas.

La causa, medida: el banco marcaba la página lista con `await render(...)` **más dos
`requestAnimationFrame`** — un plazo (~32 ms), no una espera; no sincroniza con ninguna promesa. Y
`renderInvoicesView` dispara una carga que no espera, **con `fetch` crudo en vez de `apiRequest`**
(`invoicesView.js:89`), así que ni siquiera aparecía en la cuenta. Bajo carga, la captura llegaba
antes.

**El arreglo:** el banco cuenta las peticiones en vuelo —`apiRequest` **y** `fetch`— y se declara
listo cuando no queda ninguna y sigue sin quedar ninguna un tick después. No cambia qué se mide:
cambia cuándo se mira.

**La prueba: N = 10 pasadas CONSECUTIVAS, las diez exit 0 y las cuatro hermanas con los mismos
hashes.** N se declara porque el intento anterior sobrevivió **tres** y cayó a la cuarta.

Se toca porque un guard que se pone rojo al azar entra en `main` y pone un rojo falso en el PR de
todo el mundo: es la familia de SCRUM-822.

## Hallazgo reportado, NO arreglado (regla 37)

`invoicesView.js:89` pide su bandeja de pendientes con **`fetch` crudo** en vez de `apiRequest`.
Aquí sólo se ha hecho que el banco lo vea. Saltarse `apiRequest` deja esa petición fuera de su
registro, de su trato de errores tipado y de cualquier instrumento que lo doble, y hoy nada lo
impide. Es del carril de Facturas.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
