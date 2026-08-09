# SCRUM-391 · Guards huérfanos: el mecanismo en main y su vigilante en una rama

**Fecha:** 9-ago-2026 · **Carril:** guards · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `7fae90fc9ba4cbfa41034c6d1d99b2cdaa353e44` · 2026-08-09T18:05:00+02:00

> **ENTREGA PARCIAL Y DECLARADA.** Está el **mecanismo que impide que vuelva a pasar** —lo que el
> encargo llama «lo que de verdad cierra este ticket»— con sus rojos por `$?`. **No está** la
> extracción de los guards que deben entrar: se identifican abajo con su motivo.

## El guard que cierra el ticket

`tests/scrum391-guards-declarados-presentes.test.mjs`. La pregunta que responde es la del encargo:
**¿está en el árbol lo que decimos que nos vigila?**

**Derivado de la constancia, no de una lista.** Cada `docs/master/SCRUM-<n>.md` declara los tests
del ticket (convención de SCRUM-273), así que la fuente es esa misma constancia: se leen las rutas
`tests/*.test.mjs` que las entradas nombran y se exige que **existan**.

- **No inspecciona literales de código**, sino RUTAS de fichero en markdown. Una ruta no puede
  «pasar a ser una expresión», así que la trampa del ternario / `||` / objeto indexado —que mordió
  tres veces— **no aplica aquí**. Es la única forma que encontré de que el detector no pueda
  quedarse ciego de esa manera.
- **NO hay allowlist.** Si una entrada declara un test que ya no debe existir, lo que se corrige es
  **la entrada**: es la constancia que dejó de ser cierta.
- El **suelo es un número a mano** (`MINIMO_ENTRADAS`, `MINIMO_DECLARACIONES`). Derivarlo del propio
  directorio haría que borrar entradas bajara el mínimo y el suelo dejara de serlo (lección de
  SCRUM-379).

### 🔴 Y la primera versión FABRICABA falsos positivos: declarar no es mencionar

Al escribir la tabla de abajo cité los tests huérfanos de otro ticket, y el detector los contó
**como si yo los declarara**: mi propia documentación creó tres huérfanos nuevos. `SCRUM-369.md`
hacía lo mismo, nombrando un test de 300 dentro de una cita en prosa.

Un guard que da falsos positivos es un guard que alguien acaba silenciando, así que la distinción
tenía que existir **y derivarse**, no listarse:

- una entrada **DECLARA** el test cuyo número de ticket es el suyo → se exige que exista;
- si nombra el de otro, es una **REFERENCIA** → **su dueño ya lo declara en su entrada**. No se
  pierde cobertura: cambia quién responde por él.

Se descartó acotar a la sección «Ficheros»: solo **58 de 104** entradas la usan, así que habría
cegado el detector en las otras 46 — y quedarse ciego es justo lo que este fichero persigue.

### Lo que devuelve hoy (re-medido tras el merge de #522)

**104 entradas · 101 declaraciones propias · 42 referencias ajenas · 3 HUÉRFANOS.**

Los tres son de `SCRUM-300.md`, y **la hipótesis de que #522 los traía era FALSA** — comprobado por
fichero, no deducido: C5 entró con tests de **otro nombre** (`scrum300-direccion-sugerida`,
`scrum300-firmante-ids-y-microcopy`), así que lo que queda en la entrada son **nombres viejos** que
nunca se mergearon con esos nombres. Es la constancia la que dejó de ser cierta.

**Carril de la sesión 3 (regla 9): no lo toco.**

### Verificación, por `$?`

| Qué | `$?` |
|---|---|
| Rojo por el mecanismo: se saca un test cuyo mecanismo sigue en main | **1**, NOMBRANDO entrada y fichero |
| Suelo: desaparece `docs/master/` | **1**, con el ENOENT y la ruta |
| Suelo: el detector ve menos declaraciones de las que hay | **1** |
| Suelo: cero referencias ajenas (el separador no separa) | **1** |
| Control negativo: las declaraciones presentes | no salta |

## Los 16, uno por uno

### Ya existen con otro nombre (5)

| Huérfano | Lo cubre en main |
|---|---|
| `scrum340-contador-plazas-reales` | `scrum330-contador-solo-activas` — **lo construyó el 330**, como decía el censo |
| `scrum222-assert-arranque` | `scrum222-deriva-arranque` (sobre `src/core/db/schemaDrift.ts`) |
| `scrum253-adopcion-mismo-dueno` | `scrum253-adopcion` |
| `scrum216-tipo-rectificativa` | `scrum216-tipo-rectificativa-sin-defecto` |
| `scrum295-modelo-303` (×2) | `scrum295-modelo-303` y `scrum295-modelo-303-postgres` |

### Se retiran, con su motivo (3)

- **`scrum166-un-solo-comando`.** Su DoD pedía eliminar `test:staging:gated`; **main lo conserva a
  propósito**, con la razón escrita en `package.json:12`: los dos nombres apuntan al runner porque
  ~8 documentos citan uno u otro y borrar uno rompería la mitad de las referencias. **Ahí el guard
  no falta: SOBRA.** Y de ahí sale lo que más vale de este inventario: *un inventario que solo sabe
  detectar ausencias convierte cada sobrante en un falso positivo.*
- **`scrum222-manifest`.** Vigila `prisma/schema-manifest.json`, que **no existe en main**. Sin
  mecanismo no hay nada que vigilar.
- **`scrum329-legal-pagina-publica`.** El mecanismo no está: F2 se aparcó sin terminar. Guard sin
  mecanismo.

### No entran hoy, y por qué (3)

- **`scrum195-url-bd-sin-fuga` · el veredicto se mantiene, y su rojo es un HALLAZGO VIVO.**
  Main tiene `scrum226-url-credencial-en-argv`, que vigila **el argv**; el huérfano vigila que un
  **mensaje de error** no imprima la URL. **Son fugas distintas, y la del huérfano es la que costó
  rotar una credencial de producción. Por nombre parecían cubiertas; por contenido no lo están.**
  Extraído y corrido **contra main**: **falla**, y no por estar caducado —
  `scripts/backup-dump.mjs:167` hace `new URL(process.env.DATABASE_URL)` **a pelo**, con **cero**
  usos de `parseBDSegura`, y ese script pasa la URL de **producción** en el argv de `pg_dump`.
  🔴 **Defecto vivo, de otro carril (scripts/backup): se reporta, no se arregla aquí (reglas 9/37).**
  El guard entra el día que se cierre esa fuga — traerlo antes sería un rojo permanente.
- **`scrum245-sin-listas-blancas` · NO entra: está caducado y además es impreciso.**
  Corrido contra main, señala `DEMO_SAFE_NUMBERS` y `demoSendBlocked`, que son **V0-2** (máster
  U1.1, regla 8: el merchant demo solo envía a números seguros) — una decisión **deliberada** que
  main sostiene. Y señala `huecosDeLaSerie(numeros, …)`, que es de series de factura: **falso
  positivo**. Re-derivarlo para que distinga el envío real de la excepción demo es **alcance
  nuevo**, no precisión → ticket propio.
- **`scrum172-tenencia-nullable` · no entra hoy.** `MODELOS_POR_MERCHANT` sí está en main;
  **`TENENCIA_NULLABLE_CUBIERTA` no** (medido: 0 apariciones). El guard exige una declaración que
  no existe, así que entrar exigiría **construir esa lista** — alcance nuevo → ticket propio.

### Pendiente de medir (1)

- **`scrum224-sw-revalida`.** Vigila que el camino network-first del service worker **revalide** en
  vez de servir de la caché HTTP del navegador. Lo de main es otra cosa: `scrum224b-sello-build`
  vigila la línea base del aviso de versión. **No cubierto por nombre ni por asunto**, pero no lo
  he corrido contra main — verdicto honesto: probablemente entra, sin confirmar.

## Lo que falta para cerrar

1. Que el carril de la sesión 3 resuelva las tres declaraciones de `SCRUM-300.md`. **Hasta
   entonces este guard entra ROJO**, y eso lo anuncia el fundador antes de mergear: un rojo
   esperado que nadie ha anunciado se convierte en un rojo que la gente aprende a ignorar.
2. Cerrar la fuga de `scripts/backup-dump.mjs` y **entonces** traer `scrum195-url-bd-sin-fuga`.
3. Tickets propios para `scrum245` (re-derivar con V0-2) y `scrum172` (construir la lista).
4. Correr `scrum224-sw-revalida` contra main y decidir.

Ficheros: `tests/scrum391-guards-declarados-presentes.test.mjs` (3, nuevo).
