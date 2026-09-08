# SCRUM-622 · «No lo sé» no se pinta de verde

**Medido contra:** `origin/main` = `910f2c0b116d2309e2ca6152b4d28173311fc98c` · 2026-09-02T12:30:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — criterio R14.

**Alcance:** se arregla **la red que SÍ tenía la barrera floja** (el color del toast). **NO se toca
`invoicesView.js:520`**, porque se midió que hoy no se alcanza y taparlo bien exige un rótulo para
«no lo sé» — microcopy, y posiblemente un estado, que decide el fundador. No se toca la aritmética
de fechas ni la zona (SCRUM-643), ni `mesNaturalKey`, ni el banco de vistas, ni `productsView`.

---

## 1 · La medición primero: ¿se alcanza el `|| SEMAFORO_META.verde`? **NO, hoy no**

`invoicesView.js:520` — `SEMAFORO_META[grupo.semaforo] || SEMAFORO_META.verde`. Para llegar al
`||` hace falta que `grupo.semaforo` no sea `verde`, `ambar` ni `rojo`. **Cuatro caminos
comprobados, los cuatro cerrados:**

| # | Camino | Medido |
|---|---|---|
| ① | el productor | `Semaforo` es un union CERRADO de tres (AST sobre el `.ts`) |
| ② | el cálculo | `calcularSemaforo` barrido sobre 801 días **y con fecha ilegible**: solo devuelve esos tres |
| ③ | un caché viejo | el service worker **NO cachea `/admin/`** (`sw.js:110-113`: pasa directo a red) |
| ④ | una respuesta mala | `fetchPendientesFacturar` **lanza** si `!res.ok`; no fabrica grupos |

**Los cuatro están ATADOS en el test**: el día que cualquiera deje de ser verdad, el fichero cae y
dice que el `||` ha pasado a ser alcanzable. No es una afirmación de hoy, es un trinquete.

### Lo que sí quedó escrito, y no lo escribí yo

`tipoDestinatarioPendiente.js` ya lo había anotado: la salida A de SCRUM-615 *«abre un estado
nuevo del semáforo y exige antes arreglar el `|| SEMAFORO_META.verde` de `invoicesView.js:520` —
sin eso, dejar de aplicar el implícito no deja de mentir: **miente en verde**»*. Ese es
exactamente el ① de la tabla, y por eso está atado.

### Y algo que el propio árbol contradice en la familia

El máster ya fija el criterio para esta misma bandeja (SCRUM-171b): *«**Fail-closed con valores
desconocidos:** una periodicidad que este código no conozca no inventa avisos»*. El `||` del
semáforo hace justo lo contrario con el suyo.

## 2 · 🔴 El censo destapó una SEGUNDA, y ésa sí tenía la barrera floja

Censo por AST de **redes que eligen el estado más benigno** (`|| X.verde`, `?? 'verde'`,
`cond ? a : 'verde'`, `default: return 'verde'`, y las formas con corchetes), sobre 527 ficheros.
**Dos**, no una:

* `public/dashboard/js/invoicesView.js:520` — la del ticket.
* **`public/dashboard/js/api.js:641` — `colors[kind] || colors.ok`**, el color del toast.

La diferencia entre las dos es **de qué las protege**:

* la del semáforo la protege un **union cerrado que produce el servidor** — barrera fuerte;
* la del toast la protegía únicamente **que nadie hubiera escrito mal un literal**. Basta un
  `'Error'` con mayúscula, un `'success'` o un `'info'` para que **un fallo salga con el verde de
  éxito**.

**Y no era teórico. Ya había condicionado código**, y está escrito en el árbol —
`productsView.js:743-744`:

> «`'info'` NO EXISTE — showToast solo admite ok|warn|error y **cualquier otra cosa cae al verde
> de éxito**»

Alguien tuvo que renunciar a `'info'` por esta trampa y lo dejó anotado. Esa es la barrera floja.

### El arreglo, y por qué ámbar

`colorDeToast(kind)`: un `kind` que no se reconoce cae en **ámbar**, no en el verde de éxito.

Las dos equivocaciones **no cuestan lo mismo**: decirle al profesional que todo ha ido bien cuando
el código no sabe qué ha pasado es la cara; decirle que mire, la barata. **Ni rojo**: un `kind`
desconocido tampoco afirma que haya fallado. Ámbar no miente en ninguna de las dos direcciones.

**No introduce nada nuevo** (regla 27): `warn` ya existía y ya se usa en 5 llamadas.
**Cero microcopy** (regla 30): sólo cambia un color; el censo de marcadores **no sube**.

## 3 · El control, en las dos direcciones

| | Resultado |
|---|---|
| **ANTES** — 12 `kind` desconocidos (`'exito'`, `'Error'`, `'info'`, `null`, `0`, `false`, `42`…) | **VERDE de éxito**, los doce |
| **DESPUÉS** — los mismos doce | **ámbar**, ninguno verde |
| **NEGATIVO** — `'ok'`, `'warn'`, `'error'`, `true` y el default de la firma | **EXACTAMENTE el mismo color que antes** |

El negativo importa: hay **36 llamadas sin segundo argumento** (medido por AST) que usan el
default `'ok'` y tienen que seguir en verde. Si cambiaran, se habría movido el criterio en vez de
tapar el hueco.

### Probado en ROJO, cuatro veces, sobre el árbol de verdad

| Inyección | Cae |
|---|---|
| ① la red vuelve a caer en el verde de éxito | el «DESPUÉS» **y** el censo (2 rojos) |
| ② alguien escribe una red benigna nueva | el censo |
| ③ el union `Semaforo` admite un cuarto valor | ① del trinquete |
| ④ el SW empieza a cachear `/admin/` | ③ del trinquete |

Las cuatro revertidas comparando **bytes de disco** (`Buffer.compare`), y verde otra vez (11/11).

## 4 · ⚠️ Una corrección mía, porque casi firmo un hallazgo falso

Al ejecutar la expresión del color **aislada**, concluí que `homeView.js:1281` —
`showToast(msg, true)` — pintaba de verde el aviso de que WhatsApp **no** se había enviado. **Es
falso**: `api.js` normaliza `true → 'warn'` **dos líneas antes** del `||`. Sale ámbar, que es lo
correcto.

Lo destapó leer la función entera antes de afirmar. **Medir un trozo fuera de su camino da un
resultado que parece un hallazgo**, y por eso los tests llaman a la función completa y no a su
interior. Queda escrito porque el error es reutilizable, no anecdótico.

## 5 · Lo que NO se hace, y por qué

**No se toca `invoicesView.js:520`.** Hoy no se alcanza (§1), y arreglarlo de verdad significa
decidir **qué ve el profesional** cuando el sistema no sabe. Eso es un rótulo que no existe, y
posiblemente una cuarta apariencia del semáforo: microcopy (regla 30) y estado (regla 27), las
dos del fundador. **Se propone y se para.**

Cuando se decida, la forma está preparada: el censo lo tiene fichado, el trinquete dirá el día que
pase a ser alcanzable, y las tres condiciones que lo abrirían están escritas.

## 6 · 🔴 HALLAZGOS FUERA DE ALCANCE

1. **Cuatro lecturas de `grupo.semaforo`, cuatro tratos distintos del desconocido:**
   `:520` → verde (miente) · `:601` `=== 'rojo'` → no avisa (conservador) · `:638` `!== 'verde'`
   → cuenta como pendiente (correcto) · `:658` `orden[a.semaforo]` → **`NaN` en el `sort`**, o sea
   orden indefinido. Nada obliga a que las cuatro coincidan.
2. **`aria-live` del toast** se calcula con `kind === 'error' ? 'assertive' : 'polite'`: un `kind`
   desconocido queda `polite`. Coherente con el ámbar nuevo, pero es otra decisión implícita.
3. **Una referencia desactualizada** en `productsView.js:744`: cita `api.js:111` y hoy es `:641`.
   No se toca (S1).
4. **`calcularSemaforo` con fecha ilegible devuelve `'verde'`** — no un desconocido. No es
   alcanzable (el `mesKey` siempre sale de una fecha válida) pero es la misma familia, y vive en
   el código que SCRUM-643 dejó esperando al fundador. **No se toca.**

## Tests que introduce esta entrada

* `tests/_censo-redes-benignas.mjs` — el detector por AST, exportado y probado aparte.
* `tests/scrum622-desconocido-no-es-verde.test.mjs` — 11 pruebas: suelo, antes/después, control
  negativo, la compatibilidad de `true`, el censo con su ratchet, el control del detector (seis
  formas que ve y tres que no) y las cuatro condiciones de inalcanzabilidad atadas.
