# SCRUM-680 · Las doce frases dejan de decir un número, y SCRUM-498 se retira con su motivo

**Medido contra:** `origin/main` = `795e9c289e7028c33f37df258b3a7611a5a29e02` · 2026-09-03T11:20:00+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-680-prosa-sin-numero`

## PASO 0 · recontado, no creído

`ParteTrabajo` ya está en `origin/main` (SCRUM-674). El comando del encargo busca **nombres de
fichero** y el modelo vive dentro de `schema.prisma`, así que se comprobó por las dos vías.

**Contado ejecutando el DMMF, no leyendo:** 27 modelos, **23 con `merchantId`**; de esos, **21
mapean a `merchant_id` y 2 no** (`Quote` e `Invoice`, camelCase). **21 + 2 = 23: cuadra.**

## 1 · EL DEFECTO REAL

`portabilidadCompleta.ts` decía *«de los 23 modelos, **19** mapean a `merchant_id` y DOS no»*.
**19 + 2 = 21, no 23.** El total se fue subiendo 21 → 22 → 23 y el «19» se quedó atrás: es
exactamente cómo miente un derivado escrito a mano, y vivía en el fichero que se ejecuta cuando un
cliente pide todos sus datos.

Corregido **nombrando en vez de contando**: la frase dice ahora qué modelos guardan la columna en
camelCase (`Quote` e `Invoice`), que es lo que hacía falta saber. Los nombres no caducan.

## 2 · LAS DOCE

**El registro de SCRUM-498 resultó mejor fuente que mi propio barrido**, y merece decirse: cinco
frases tenían otra redacción —`«cubrir los 23»`, `durante los 23 deleteMany`, `medido: 23 modelos
la tienen`— y mi regex no las veía. Dos instrumentos contrastados es lo único que separa «no hay»
de «no supe mirar».

Las doce, en siete ficheros, dejan de decir un número: `src/app.ts` · `portabilidadCompleta.ts` ·
`barridoDemo.ts` (×2) · `_censo-merchant-de-la-url.mjs` · `scrum244` · `scrum272` (×2) ·
`scrum314` (×3) · `scrum440`.

## 3 · LO QUE **NO** SE TOCA, y es una decisión

**`docs/master/*.md` y `YAQU_MASTER.md` se quedan como están.** Son entradas **fechadas**:
SCRUM-244 midió 21 el día que se escribió y SCRUM-497 narra la corrección de 21 a 22. Quitarles el
número no sería desactivar algo que caduca: sería **falsear el registro**. No son afirmaciones
sobre hoy.

## 4 · SCRUM-498 SE RETIRA — pero solo lo que se quedó SIN SUJETO

Al quitar los números, el registro de afirmaciones se vacía y **el propio guard se negó a quedarse
hueco**: sus dos autopruebas cayeron diciendo *«el guard está ciego: el ensayo no vale»*. Eso no es
que se rompieran; es que su población dejó de existir.

Se retiran **cuatro** pruebas, las cuatro cuyo sujeto era el registro:
`CONTROL POSITIVO con el esquema tal cual` · `ninguna afirmación atada está CIEGA` ·
`EL ENSAYO DEL DÍA D` · `el registro cubre los ocho ficheros`.

**Siguen vivas cinco, porque siguen midiendo algo:** la autoprueba del detector sobre fuente
sintética, el suelo de ceguera, la comparación de los **dos instrumentos** (texto del esquema
contra DMMF, que caza un cliente desparejado) y el hueco declarado.

### 🔴 EL HECHO NO SE QUEDA SIN GUARDIÁN, y está demostrado ejecutándolo

Que un modelo nuevo con `merchantId` no se olvide lo sostienen dos guards que **derivan del
schema**, no de la prosa: `scrum172` (`MODELOS_POR_MERCHANT`) y SCRUM-192
(`ORDEN_BORRADO_MERCHANT`).

Comprobado, no supuesto — se replicó el árbol mínimo que `scrum172` necesita y se le inyectó un
modelo que nadie barre:

    ══ CONTROL POSITIVO · la copia sin tocar: exit=0   (4/4)
    ══ EL ROJO · modelo nuevo con merchantId: exit=1
       Modelo(s) con `merchantId` que NADIE barre:
          · cuadernoDeObra

⚠️ **`prisma/schema.prisma` NO se tocó** —la sesión 3 lo está escribiendo—: el test calcula su raíz
desde su propia ubicación, así que la inyección fue sobre una copia en el scratchpad. Comprobado
después: `git status prisma/` vacío.

El motivo queda escrito **en el propio fichero del guard**, nombrando a `scrum172` y a SCRUM-192,
para que dentro de tres meses se sepa que se retiró porque **sobraba**, no porque estorbara.

## Lo que NO se ha tocado

`prisma/schema.prisma` · el camino de emisión · el orden de borrado de SCRUM-192 · y no se ha
construido ningún guard nuevo.
