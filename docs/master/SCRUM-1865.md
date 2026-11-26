# SCRUM-1865 · El trinquete de zona: canarios PRIMERO, y la pared de la tanda sube por su propia regla

**Medido contra:** `origin/main` = `2a6675c978794595696f87fb1a7ed3e52f904adb` · 2026-11-25T14:52:39Z

A9: sin fallo que generalice — las dos curas se vieron en rojo antes de darlas, y cada mutación tumba su caso y sólo el suyo.

Puesto S5 (dueño de `scripts/_trinquete-de-zona.mjs` y `scripts/_trinquete-de-zona-hijo.mjs` por decisión de Javier del
24-oct, `docs/equipo/dos-equipos.md` §3.3). Rama `scrum-1865-canarios-primero`. Encargo del orquestador (25-nov, tarde).

## La causa (medida por S3, en la descripción del ticket — no la he vuelto a medir en el CI)

- `scripts/_trinquete-de-zona-hijo.mjs:63` — pared de la tanda de 15 min. El comentario de :54 ya ordenaba subirla «si una
  pasada normal llega a ~12 min»; el 25-nov la normal iba de 10 a 15.
- `scripts/trinquete-de-zona.mjs:85` — la lista se arma `[...deLaTanda, ...canarios]`: los canarios van en la COLA, que es lo
  que la pared corta.
- Sin resultado del canario en una zona, la repesca a solas tampoco lo compara (la clave del cortado es la ruta del fichero,
  y a solas esa clave no vuelve) → `juzgarCanarios` «NO SE PUDO COMPARAR» → **CIEGO**.
- Afectadas ese día: 1825, 1798c, 1863, 1847, 1822 (+3 sin abrir). Verdes de control: 1807, 1840, 1780, 1809.

## Las dos curas

1. **Canarios primero, dentro del instrumento.** `canariosPrimero()` en `scripts/_trinquete-de-zona.mjs`, aplicada por
   `medirEnZona` a toda lista que mide. Está ahí y no en la línea de órdenes para que el veredicto de los centinelas no dependa
   de que ningún llamador se acuerde. Se reconocen por las dos cosas a la vez (fuera del árbol Y nombre de uno de `CANARIOS`):
   un fichero de `tests/` no puede adelantarse aunque se llame igual. Sólo cambia el ORDEN; quién es canario para el
   autocontrol lo sigue decidiendo `rutaClave`. `scripts/trinquete-de-zona.mjs` no se toca (sin fila en §3, `dos-equipos.md:379`).
2. **Pared de la tanda 15 → 24 min** (`PARED_TANDA_MS`, línea fechada en el hijo). 24 = 1,6 × 15, el mismo margen que se
   escribió el 15-oct para la regla. No relaja nada (regla 41): la pared no decide veredictos, sólo cuándo se deja de esperar.
   - **Consecuencia que va en el mismo commit:** el job `trinquete-zona` de `.github/workflows/ci.yml` pasa de
     `timeout-minutes: 45` a `60`. Con dos pasadas de 24 min (48) y 45 de techo, el job habría muerto sin veredicto ANTES de que
     la pared hablara — peor que hoy. `ci.yml` es de S5 (`dos-equipos.md:72`). Coste: el job corre en paralelo y no es el check
     obligatorio; los 15 min extra sólo se gastan en una pasada que de verdad se va a la pared.

## Rojo primero

Banco nuevo `tests/scrum1865-canarios-primero.test.mjs` (fichero propio: mide al cargar, como `scrum1494`, SCRUM-935d).
Tanda SEMBRADA LENTA: `availableParallelism()` ficheros que tardan 15 s (uno más que los huecos del hijo), pared sembrada de
4 s, y los canarios DETRÁS, en el orden de la línea de órdenes. Mismo camino que el job: tanda → comparar → repesca → autocontrol.

- **Sin las curas** (commit base `2a6675c97`): 2 rojos de 3.
  - «con la cola CORTADA…»: `CIEGO como el 25-nov` — los cuatro canarios «NO SE PUDO COMPARAR: su resultado falta en alguna
    zona, también a solas», el mensaje literal del job. Cada canario salió `cortada` con la ruta por nombre.
  - «CONTROL…»: `la pared de la tanda es 15 min`.
  - El SUELO (la pared salta en las dos zonas) en verde: el sembrado siembra.
- **Con las curas:** 3/3, ~10 s.
- **Control:** tanda RÁPIDA (8 ficheros + 4 canarios, mismo orden, SIN topes): no salta la pared, autocontrol OK, y la pared
  que el hijo declara es la de la tanda (2 min × 12 = 24, así que `min()` no la esconde).

## Mutaciones (catálogo en el test)

| Mutación | Rojo |
|---|---|
| ① `const enOrden = canariosPrimero(ficheros, raiz);` → `const enOrden = ficheros;` | sólo «con la cola CORTADA…» |
| ② `PARED_TANDA_MS = 24 * 60_000` → `15 * 60_000` | sólo «CONTROL…» |

Las dos anclas casan una vez cada una; aplicadas a mano, restauradas con `git checkout` y `git status` limpio.
`meta-guard-mutaciones.mjs --solo-censo`: 0. Vecinos (`scrum813`, `scrum1494`, `scrum1621`, `scrum1339s` + éste): 57/57.

## Lo que NO dice esto

- Que el CI ya no salga CIEGO: lo dirá la primera pasada del job tras el merge. Si una pasada normal llega a ~19 min, se sube
  otra vez por la misma regla.
- La cola cortada sigue sin compararse: los ficheros del final que la pared corte salen en «NO PUDE COMPARAR» / «SIN INFORME
  ENTERO», contados. Lo que cambia es que ya no ciegan el autocontrol.
