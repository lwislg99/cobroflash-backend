# SCRUM-907 · Trabajo: cobrar MÁS de lo aceptado decía «Te falta por cobrar 0,00 €» y no avisaba

**Medido contra:** `origin/main` = `2be8fe16a3245322e64837f789189875e0c9f560` · 2026-09-17T14:39:14Z
**Rama:** `scrum-907-cobrado-de-mas` · **Estado:** EN PR — literal firmado por delegación (SCRUM-887 comentario 15697, L4).

Nace de SCRUM-887 (su PR 4) y del D2 de SCRUM-883. Carril front (Sesión 2).

## Qué pasaba

`jobCobroHuecos.js` (`faltaPorCobrar = Math.max(0, aceptado − cobrado)`) y `jobRailBlocks.js` («Pendiente», con el
mismo `max`) escondían el exceso: con C3 de SCRUM-883, «Cobrado 628,60 € de 539,05 €» y «Te falta por cobrar 0,00 €»,
sin aviso. Y con todo facturado y pagado la sección «Qué falta para cobrar» ni se pinta (no hay huecos).

## Arreglo (solo front, sin emisión ni dinero)

- `cobradoDeMas(aceptado, cobrado)` en CÉNTIMOS enteros: exceso si pasa de 2 céntimos (margen de SCRUM-141); sin
  importe aceptado, 0 (regla de «Pendiente», SCRUM-363). Viaja en `importesDeCobro`.
- `avisoCobradoDeMas(importe)`, el literal firmado, en un solo sitio.
- «Qué falta para cobrar»: la sección también se pinta con cobro de más; el aviso va bajo «Te falta por cobrar»
  (que sigue en 0,00 €, que es verdad). Rail «Dinero»: una línea de aviso detrás de «Pendiente». Las dos piezas leen
  el MISMO exceso. Estilo por clase (`.cobro-aviso`, `.detail-rail-linea--aviso`), ámbar de Aviso.

## Rojo, positivo y negativo

`tests/scrum907-cobrado-de-mas.test.mjs` (el cálculo es puro y se ejecuta; el render, por su cableado):

- **Rojo contra `2be8fe16`** (commit `4e82b942`): 7 de 7.
- **Con el arreglo:** 7 de 7, y siguen verdes `scrum318/319/320`.
- Rojo: 628,60 sobre 539,05 → 89,55 €; 3 céntimos avisan. Negativo: 1 y 2 céntimos no avisan, y 0,1 + 0,2 sobre 0,3
  tampoco. Positivo: cobrado ≤ aceptado → sin aviso y los importes de siempre; sin aceptado, sin aviso.

## SCRUM-907b · el veredicto EN STAGING, y las dos sondas que lo dieron

**Medido:** 2026-09-17 ~19:30Z · staging sirviendo `963c2732400c8ea786994c80214a65bae80bed17` (`/version`), que
contiene el merge de SCRUM-907 (`87edbe336f0d75daa9175dca52aca935b6433e26`, PR #1461).

Esta sección NO cambia código: guarda los instrumentos. El veredicto ya está dado; lo que se
conserva es **con qué** se dio, porque SCRUM-915 rediseña esta misma ficha y entonces habrá que
volver a preguntárselo.

    🔒 Guardar la conclusión y tirar el instrumento es quedarse con la parte que caduca.

### Lo que NO hizo falta: fabricar el caso

Había OK para crear un Trabajo de prueba en staging. **No se usó.** El barrido de solo lectura
`buscar-casos-cobrado-de-mas.mjs` encontró el caso REAL ya existente:

    POBLACIÓN: 18 Trabajos · 13 con aceptado > 0
    CANDIDATOS (cobrado > aceptado + 0,02 €): 1  → job 3102 · aceptado 539,05 · cobrado 628,60 · exceso 89,55
    CONTROL NEGATIVO (cobrado < aceptado, el caso normal): 10

Cero escrituras en staging, cero fixtures tocados. Y la diferencia no es de estilo: **un fixture
demuestra que el código funciona con lo que tú le pusiste; el caso real demuestra que funciona con
lo que hay.**

El control negativo está por la misma razón de siempre: si salieran 0 en los DOS lados, el
instrumento no estaría discriminando —estaría sin mirar—, y los dos ceros se leerían igual.

### El veredicto: 6 de 6

`veredicto-en-staging.mjs` abre la ficha DE VERDAD (`#jobs-detail/<id>`) en navegador, con sesión
QA, 3 Trabajos × 2 anchos (1280 y 390 px). Salida completa en `salida-veredicto.txt`:

| job | importes | se espera | sección `.cobro-aviso` | rail `.detail-rail-linea--aviso` |
| --- | --- | --- | --- | --- |
| 3102 | aceptado 539,05 · cobrado 628,60 | AVISO | «Has cobrado 89,55 € más de lo aceptado.» | la misma frase |
| 3100 | 243,14 · 243,14 (cuadrado) | SIN AVISO | ninguno | ninguno |
| 3103 | 970,23 · 291,07 (falta 679,16 €) | SIN AVISO | ninguno | ninguno |

Y lo que la pantalla dice ahora, en una frase: la línea sigue diciendo **«Te falta por cobrar
0,00 €»** —que es verdad, no falta nada— y **el aviso dice lo que esa línea no podía decir**.

**Los dos sujetos sanos no son adorno.** Si la sonda no supiera encontrar el aviso, el 3102
saldría «sin aviso» exactamente igual que un 3100 cuadrado, y los dos ceros se leerían igual. Con
los tres, una sonda muda se delata porque salen TODOS iguales. Es la otra mitad de A21.

### Lo que salió mal, y no se arregló relajando nada

🔴 **No se pudo tomar el turno de staging, y no por descuido: en esta máquina no se puede.**
`scripts/turno-staging.mjs` exige `DATABASE_URL_TESTS` y sale con «falta DATABASE_URL_TESTS en el
entorno». Medido el 17-sep-2026: **no hay `.env` en ningún worktree** (ni en `cobroflash-backend`,
ni en `wt-907`), y el fichero de secretos que vive fuera del repositorio declara
`SESSION_SECRET`, `INTERNAL_API_SECRET`, `E2E_TEST_LOGIN_SECRET` y `DATABASE_URL_STAGING` —
`DATABASE_URL_TESTS` **no está**. Es decir: la medición del 10-ago-2026 que cita `CLAUDE.md` («los
cuatro worktrees llevan las tres claves») **ya no describe esta máquina**.

Como estas dos sondas sólo LEEN, se siguió sin turno y se dijo. Si hubiera habido que escribir, se
habría parado. **Se podía haber pasado el valor de `DATABASE_URL_STAGING` a `DATABASE_URL_TESTS` a
mano para que el script arrancara, y NO se hizo a propósito:** eso es improvisar un procedimiento,
que es exactamente lo que SCRUM-232 vino a cortar. Queda abierto como **SCRUM-932**, carril S5.

Y tres intentos fallidos antes de acertar con la consulta —`from "Job"` (la tabla no se llama así)
y `title` en vez de `titulo`—, ninguno de los cuales tocó nada porque todo era lectura. Los tres
son la misma pereza, y está anotada dentro de la sonda para que no se repita:

    🔒 Adivinar el nombre en vez de preguntárselo al esquema.

### Cómo se vuelve a correr

    node docs/master/evidencias/scrum907b/buscar-casos-cobrado-de-mas.mjs
    node docs/master/evidencias/scrum907b/veredicto-en-staging.mjs

Los ids de los tres sujetos son los de staging del 17-sep-2026. Si cambian, **se vuelven a sacar
con la primera sonda, no se escriben a mano**: un número heredado de un enunciado no es una
medición. Las dos se corrieron desde esta ruta antes de comitearlas —salidas 0 las dos— porque una
cobaya que no se ejecuta da el mismo resultado que un arreglo perfecto (A21).
