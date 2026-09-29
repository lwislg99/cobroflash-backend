# SCRUM-1280 · Un nombre no declarado en el panel pone el check obligatorio en rojo

**Medido contra:** `origin/main` = `82cb31c81e3fa7357819af7370a4fcf53bff6682` · 2026-09-29T15:55:14Z

Carril S3 (instrumentos). Sesión s3-29c.

## Qué entra

| Pieza | Qué hace |
|---|---|
| `scripts/guard-nombres-no-declarados.mjs` | TypeScript `checkJs` sobre los scripts que carga `public/dashboard/index.html` (95 + 1 bloque en línea) en **UN** programa. Solo cuenta 2304/2552 («Cannot find name»). Salida 0/1/2 (limpio / hallazgos con fichero:línea, nombre y qué hacer / no medido). |
| `tests/scrum1280-nombres-no-declarados.test.mjs` | Lo mete en `npm test`, que es el check `build + tests`: **el obligatorio**. No toca `ci.yml` (no choca con 1179-C). ~8 s. |

## La premisa, contrastada con el árbol

El encargo decía «el programa único de S2 da `cb` + 5 falsos (3 JSDoc y 2 `root.X`)». Sobre el
`main` de hoy el script de S2 tal cual da **70 nombres**: casi todos ayudantes compartidos
publicados con `window.X = X` o `root.X = X` dentro de una IIFE, y las declaraciones de primer nivel
de los scripts con `module.exports` (TypeScript los trata como CommonJS; en el navegador son
globales). Por eso el guard **modela la publicación por AST** en vez de declarar excepciones:
`window.`/`globalThis.`/`self.`, `root.` cuando `root` es el parámetro de una IIFE que recibe la raíz
global, y el primer nivel de los CommonJS. Con eso quedan `cb` y **4** falsos, todos JSDoc
(`miembros` ×2, `clave`, `elemento`), declarados uno a uno con su motivo. Los `root.X` de
`quoteSuplido.js` no necesitan excepción.

Un nombre usado solo como operando de `typeof` no cuenta: `typeof X` no lanza.

## Verificado en rojo

| Prueba | Resultado |
|---|---|
| `main` de hoy (con el defecto de 1275) | exit 1 · `public/dashboard/js/invoicesView.js:696 · «cb»` · el test del panel en rojo |
| `invoicesView.js` de #1976 (el arreglo de 1275) en local | exit 0 · 5/5 verdes |
| Mutante: el guard deja de ver el código 2304 | exit 2 · «CONTROL POSITIVO FALLIDO … su «limpio» no vale nada» |
| Mutante: el modelo de globales no reconoce `window` | 2 tests en rojo (falsos en la pieza de control y en el panel) |

Controles dentro del test: la forma exacta de 1275 (variable leída fuera del `if` que la declara)
sale con su línea; `root.X`, `window.X`, CommonJS y `typeof` no dan falsos; una excepción que ya no
ocurre sale como **caducada**.

## Orden de merge

**Este PR tiene que entrar DESPUÉS de #1976** (J1, arreglo de 1275). Antes, su propio check sale en
rojo con `cb` —que es justo lo que tiene que hacer— y yaqu-bot no lo mergea. Cuando #1976 esté en
`main`, se mergea `main` en esta rama y el check sale verde.
