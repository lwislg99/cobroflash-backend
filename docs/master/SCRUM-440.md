# SCRUM-440 · la supresión comparaba el merchant de la URL con nada

**Fecha:** 10-ago-2026 · **Carril:** seguridad / tenencia · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `6cd4cffac1c3291da0caad6a3a4a10cc5c4a45c2` · 2026-08-10T19:14:35+02:00

## El agujero

`POST /admin/supresion/:merchantId` tomaba el merchant de la URL y **nunca lo comparaba con el del
solicitante**: `req.merchantId` aparecía **cero veces** en el fichero. Un admin autenticado del
merchant A que supiera el **nombre** del negocio B podía anonimizar a B.

Lo único que lo contenía era que `MERCHANT_DELETE_ENABLED` está en `false` y la ruta responde 404
antes de tocar nada. Construida y no encendida — pero ese 404 era **lo único** que había entre esto
y un incidente el día que se encienda.

Es mío en los dos sentidos: lo escribí esta tarde en SCRUM-244 (1b) y lo destapé midiendo mi propio
trabajo en el PASO 0 del ticket siguiente.

## El arreglo, y por qué el ORDEN es parte del arreglo

```ts
if (merchantId !== req.merchantId) return res.status(404).json({ error: 'not_found' });
```

**404 y no 403**: un 403 confirma que ese merchant existe, y eso es información que no se le debe a
quien pregunta por uno ajeno.

**Y va ANTES del `findUnique`**, no después. Un 404 que llega *después* de leer delata igual — por
el tiempo de respuesta, por los logs y por cualquier efecto de esa lectura. Pedir un merchant ajeno
no puede ni tocar la base.

## 🔴 Por qué NINGÚN guard de tenencia lo veía — ceguera estructural, no descuido

Los censos de SCRUM-243 y SCRUM-348 miran **lecturas de modelos que tienen columna `merchantId`**.
Están bien para lo que miran. Pero `merchant` es el modelo **raíz** y **no tiene esa columna**
(medido: **21** modelos la tienen, `merchant` no está entre ellos). Así que

```ts
prisma.merchant.findUnique({ where: { id: merchantId } })
```

produce **cero lecturas censables**, y los dos analizadores son ciegos a esta ruta **por
construcción**. Comprobado ejecutándolos: `supresion.routes.ts` no aparecía en ningún censo de
tenencia — solo en `adminOnlyRoutes.ts:32`, que es una lista de **roles**, no de tenencia, y cuyo
único consumidor (`tenancy-permisos.test.mjs`) está **gateado tras `QA_DB_TEST`**.

## El guard general, POR MECANISMO y no por mención

`tests/_censo-merchant-de-la-url.mjs` no pregunta *«¿qué modelo lee?»* sino **«¿de dónde sale el
merchant sobre el que actúa?»**. Si sale de la **petición** (`req.params` / `req.query` /
`req.body`), es un dato que elige quien llama, y **la misma función** tiene que compararlo con
`req.merchantId`.

- **Derivado del árbol** (AST sobre `src/**/*.ts`, 211 ficheros): cualquier ruta futura con
  `:merchantId` entra sola. **No hay lista de rutas que mantener.**
- **En la MISMA función**, que es la lección de SCRUM-348: aquel guard daba por cubierta cualquier
  lectura dentro de un handler que *mencionara* el merchant, y eso crecía hacia el falso verde. Aquí
  hay un test que fija exactamente esa trampa: un `req.merchantId` en **otra** función del mismo
  fichero **no** cubre a la de la URL.

Hoy el censo encuentra **1** toma y está comparada. Si mañana hay dos y una no compara, el rojo la
nombra con fichero y línea.

## Verificación

| control | resultado |
|---|---|
| **Negativo (el que más importa)** · `:merchantId = 99`, `req.merchantId = 7` | **404 Y `diario` vacío**: ni una consulta. No se supone — los modelos del cliente son dobles que EXPLOTAN si alguien los llama |
| **Positivo** · el merchant propio, con el flag encendido dentro del test | 200 y queda constancia en `auditLog` |
| **Con el flag apagado** | 404 sin consultar — y el test dice por qué eso **no es tenencia**: es que la puerta está cerrada |
| **Detector: comparar ≠ mencionar** | la trampa de SCRUM-348, fijada |
| **Control negativo del detector** | `req.params.id`, una lectura ya filtrada y `req.params.customerId` **no caen** |
| **SUELO** | ≥150 ficheros mirados **y** el censo tiene que encontrar la ruta que sabemos que existe; si encuentra cero, **falla declarándose ciego** |

**Rojo por el mecanismo:** quitar la comparación pone rojo el control negativo **nombrando la
tenencia** —«la ruta responde 200 a quien pide un merchant AJENO»— y no un error genérico.

## Un efecto que confirma que el mecanismo muerde

Tres fixtures de `scrum244-supresion-y-anonimizado.test.mjs` invocaban el handler **sin
`req.merchantId`**: pedían la supresión de un merchant que no era el suyo, y ahora eso es 404.
**El guard las cazó.** Se les añade el merchant del solicitante —que es lo que `requireAuth`
inyecta de verdad—, así que las fixtures se vuelven **más fieles**; no se relaja nada.

## Lo que NO se ha tocado

`MERCHANT_DELETE_ENABLED` sigue en `false` · el servicio de anonimizado, intacto · el `auditLog`
**sobrevive por diseño** (art. 17.3.b) y este ticket no lo roza · `prisma/schema.prisma` idéntico a
`origin/main` · **ninguna base real**: los tests sustituyen los modelos del cliente por dobles y
comprueban que la sustitución está puesta **antes** de invocar nada.

## Evidencia

- Worktree limpio desde el remoto, entorno completo: **2644 tests · 2570 pass · 0 fail · 74 skipped ·
  `$? = 0`**.
- `npm run guards:entrada`: **`$? = 0`**.
- `git diff --diff-filter=D --name-only origin/main...HEAD`: **vacío**.
