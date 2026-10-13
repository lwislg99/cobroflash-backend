# SCRUM-1056 · «Volver a llamar»: diseño y `.sql` del ALTER (paso ② de A5)

**Medido contra:** `origin/main` = `c30b4ed43e27b79d65f8e8aabefd7154058e6245` · 2026-09-27T16:12:23Z

**Escribe:** Sesión 1 (S1, `s1-27a`) · **Rama:** `scrum-1056-volver-a-llamar-alter` · **Carril:** S1
(servidor) + S2 (pantallas) · bloque CRM (SCRUM-977), ola 3.

## Alcance de esta rama: SÓLO el ②

Diseño y `docs/sql/scrum-1056-volver-a-llamar.sql`. No toca `prisma/schema.prisma` (regla 40) ni
código, y no aplica nada a ninguna base.

## PASO 0 — medido en origin/main

- Ningún modelo de seguimiento: `callback|followUp|volverA` en `schema.prisma` → 0. Lo que sale con
  `remind` son los recordatorios de PAGO (`reminder7SentAt`…), otra cosa.
- `CustomerEvent` existe y es el historial del cliente (`type` libre, con la lista en comentario).
- D6 = tarea PROPIA (`docs/producto/CRM.md` §6); `MAINTENANCE_ENABLED` no se toca.

## El diseño: dos columnas en `customers`, no una tabla

La aceptación pide UNA pendiente por cliente («poner otra sustituye a la anterior») y que «hecho»
deje el apunte en `CustomerEvent`. El historial ya tiene tabla; otra tabla sería un historial paralelo
y necesitaría un índice parcial para «una activa por cliente». Por eso:

- `callback_on DATE` (NULL = nada pendiente). `DATE`, porque es un día del calendario; «vencido» se
  decide contra HOY en la zona del merchant (`diaNaturalEn`), nunca con el reloj del proceso.
- `callback_note TEXT` (NULL = sin nota).
- Índice `(merchant_id, callback_on)` para «hoy o vencidos» y «esta semana».

DDL derivado offline con `previewMigracion` (control positivo: ok, 31 tablas): 2 `ADD COLUMN`
nullables sin `DEFAULT` + 1 `CREATE INDEX`. Nada más.

## Criterios de aceptación que añade el esquema al ③

1. `callbackNote` entra en la lista de `customer` de `anonimizarMerchant.ts`, con test.
2. «Hecho» pone las dos columnas a NULL y crea el `CustomerEvent` en la MISMA transacción (test).
3. «Vencido/hoy» se calcula con la zona del merchant (test en la frontera del día, Europe/Madrid).
4. Toda lectura/escritura filtra por `req.merchantId`; otro merchant no la ve (test).
5. El tipo nuevo de `CustomerEvent` se añade a la lista de su comentario en el esquema (en el ③).

## SCRUM-1056b · la pieza de pantalla: el bloque de la ficha y la marca de la lista (13-oct, S2)

**Medido contra:** `origin/main` = `18014c49ab7f2089c48d4c2e189f1fe799b829cf` · 2026-10-13T14:09:59Z

A9: comprobación → `tests/scrum1056b-volver-a-llamar-la-pieza.test.mjs`

El fallo propio de esta entrega: la primera versión pintaba la nota en un párrafo sin más, y una nota
con una palabra muy larga se salía de la tarjeta a 390 px. El banco de vistas no lo ve (no calcula
anchos); lo vio el navegador, en la sonda. Arreglado con una regla de la hoja, y el test fija que la
nota lleva su clase y que la regla existe. Un segundo, del test y no del código: su detector de rutas
contaba como ruta la barra que separa día, mes y año, y dio un rojo falso en la primera pasada.

**Sesión:** S2 (`s2-13oct`, tercera tanda) · carril: `public/**` es S2 (`node scripts/carriles.mjs de …`).
**Skill UI:** cargada (`yaqu-premium-ui`). Sección AÑADIDA: lo de arriba no se toca.

**Qué es.** Un fichero nuevo, `public/dashboard/js/clienteVolverALlamar.js`, que dibuja el bloque
«Volver a llamar» y dice qué marca lleva el cliente en la lista. Es la mitad de S2 del paso ③. La
ficha y la lista son de J2 y las rutas, de S1: ninguna de las dos existe todavía para esto.

**Qué NO es, y por eso no cierra nada.** La pieza se carga con el panel y ninguna pantalla la monta:
hoy no se ve en yaqu.app. No hay esquema, ni rutas, ni apunte en el historial.

**Cómo está hecha para no inventar lo que no existe.**

- No conoce ninguna ruta. Quien la monta le pasa la llamada (`{ dia, nota, estado }`) y dos
  funciones, `guardar({ dia, nota })` y `hecho()`. Cuando S1 ponga las rutas, quien monte las llama
  ahí; la pieza no cambia.
- «Hoy», «vencida» o «para más adelante» lo dice el servidor en `estado`. La pieza no compara
  ninguna fecha con el reloj del navegador, y por eso no rechaza una fecha en el pasado: se manda y
  se pinta lo que vuelve (decisión de c.19396, aceptada en c.19401).
- Lo que llega y no se entiende (sin objeto, un día con otra forma, un día sin estado) no se lee como
  «no hay ninguna»: el bloque se queda vacío y no hay marca. Lo mismo si `guardar` resuelve con algo
  sin día.
- Sólo usa clases que ya existían (`section-title`, `field`, `form-actions`, `btn`, `alert error`),
  más una regla nueva en `styles.css`, `.volver-a-llamar-nota`, que parte las palabras largas.

**Desviaciones declaradas.**

- La forma `{ dia, nota, estado }` es una propuesta de S2 (c.19341); S1 no ha contestado con el
  contrato. Si el servidor los llama de otra manera, lo traduce quien monte.
- Sin día, «Guardar» no manda nada y el aviso lo pone el navegador (es un campo obligatorio suyo): no
  hay texto nuestro para ese caso.
- La nota no tiene tope de largo en la pieza: lo pondrá el servidor, y un rechazo se lee como el
  fallo de guardar.
- B11 («Llamada hecha») no está en la pieza: lo escribe el servidor en el historial.
- Una línea en `tests/_banco-vistas.mjs`, que es de S3: su lista de scripts tiene que ser la del
  índice, y sin esa línea el panel no carga en el banco.

**Textos y firma.** Los catorce de SCRUM-1056 comentario 19401; trece son de esta pieza. Registro:
`docs/microcopy/2026-10-13-SCRUM-1056-volver-a-llamar.md`. Cada uno lleva su marca en su línea.

### Pruebas de SCRUM-1056b

`tests/scrum1056b-volver-a-llamar-la-pieza.test.mjs`: 14 casos por el banco de vistas, con el panel
entero cargado por el índice.

- **Mutantes** (`evidencias/SCRUM-1056/salida-1056b-mutantes.txt`; base sin mutar 14 de 14): trece,
  mueren trece, cada uno con su `git diff --numstat` al lado. Entre ellos: un texto firmado cambiado,
  la marca en una llamada futura, un día sin estado dado por futuro, pintar lo tecleado en vez de lo
  devuelto, callar el fallo, pasar el día por una fecha con hora, y la nota sin su clase.
- **Navegador, a 390 px, sobre yaqu.app** (cuenta QA, hojas de producción; la pieza no hace
  peticiones y el interceptor corta todo lo que no sea `GET`; `evidencias/SCRUM-1056/`): ocho
  estados. Todos los botones y campos miden 44 px de alto o más; rótulos enlazados a su campo; el
  aviso de fallo sale una vez; una fecha de 2020 se manda y vuelve como vencida. Con la hoja de
  producción la nota larga se sale de la caja (1 estado de 8: es el control); con la hoja de la rama,
  ninguno. Dos capturas.
- **Dirigida, a mano:** 82 ficheros (los que nombran el service worker, la lista de scripts, los
  censos de microcopy y de sin-consumir y las clases de las hojas, más los que leen los registros):
  785 tests, 784 pasan y 1 rojo esperado, el de `scrum811c`, que pide esta sección. Repetida con la
  sección escrita. `npm run tanda:dirigida` selecciona 610 ficheros y no se lanza en esta máquina.
- 🔴 **Sin `tsc`:** no cabe en memoria. Este cambio no toca `src/`. La suite completa y los tipos los
  corre el obligatorio.

### No visto en yaqu.app

La pieza no se ve hasta que J2 la monte en la ficha y en la lista y S1 ponga las rutas. Lo que sí se
puede ver al desplegar es que el panel la carga: `window.clienteVolverALlamar` existe en la consola.
