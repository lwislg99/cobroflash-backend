
---

# SCRUM-421 (cierre) · el escáner sin ventana, y el guard que hace aritmética la promesa

**Fecha:** 11-ago-2026 · **Carril:** B
**Medido contra:** `origin/main` = `e3d01ca00428bcf4ee40f9759673840e530427aa` · 2026-08-11T04:30:00+02:00
**Rama de partida:** `scrum-421-registro-presupuesto-INCOMPLETO` = `d5e5765fd7113bf4e608a5f60dc6a81096fc0a5d`

> Se parte del trabajo de otra sesión — no de cero. El escáner AST ya resolvía dos casos que
> costaría un turno redescubrir: `tx.quote.create` dentro de `$transaction`, y las variables
> declaradas en la función de fuera. **No se han tocado.**

## ① El falso positivo de `:216`, y por qué bloqueaba el suelo

`quotes.routes.ts:216` es `status: quote.status` **dentro de un `res.json`**. El censo lo contaba
como escritura porque miraba **400 caracteres hacia atrás** y la ventana alcanzaba el `create` de
arriba.

**La dependencia iba en ese sentido, no en el contrario:** mientras un cuerpo de respuesta contara
como escritura, el suelo `sinResolver === 0` **no se podía exigir sin mentir**.

**No se aflojó la ventana.** Ajustar una distancia a ojo es cómo un escáner deja de ver lo que sí
importa — y era la tercera ventana fija que fallaba aquí en dos días. Se resolvió por **estructura**:
se sube por los padres hasta la **primera llamada que envuelve** el nodo y se mira a quién llama.

| Código | Primera llamada que envuelve | ¿Escritura? |
| --- | --- | --- |
| `res.json({ status })` | `res.json` | no |
| `prisma.quote.update({ data: { status } })` | `prisma.quote.update` | sí |
| `tx.quote.create({ data: { status } })` | `tx.quote.create` | sí |

Sin distancias, sin umbrales, sin nada que calibrar.

**Resultado del censo:** 15 escrituras · **0 sin resolver** · los 6 estados exactos.

## ② El test que envuelve el censo

`tests/scrum421-registro-presupuesto.test.mjs` — 8 tests.

| Test | Qué impide |
| --- | --- |
| **SUELO** — ve ≥10 escrituras y resuelve TODAS | «no hay estados fuera» vs **«no supe mirar»** |
| el falso positivo del `res.json` no vuelve | que la ventana regrese por otra puerta |
| **CONTRASTE** — ningún estado escrito fuera de la tabla | el callejón sin salida |
| control negativo — los 6 conocidos no caen | que esto sea un guard que prohíbe escribir estados |
| **rojo por mecanismo, literal Y POR VARIABLE** | el agujero que el escáner de texto tenía |
| exactamente UNA primaria por estado | cero (callejón) y dos (regla rota) |
| cada fila cubre todos los estados | la celda ausente, que no es «oculta» sino una decisión que nadie tomó |
| rótulos con marcador | encender microcopy sin aprobar |

Rojos probados con la mutación confirmada:

```
sent → sin primaria      cae: «sent: 0 (—)»
btnPdf primaria en draft cae: «draft: 2 (btnEnviar, btnPdf)»
```

## ③ Rótulos, y ④ el enganche

Doce rótulos, **todos con `[PENDIENTE microcopy oficial]` visible en pantalla** (regla 30). El
marcador no es un recordatorio interno: se ve, para que nadie encienda por descuido texto sin
aprobar. **El texto es una PROPUESTA**, la aprueba el fundador.

Y el fichero ya se carga: `<script>` en `index.html` **y** en el SHELL de `sw.js` — sin lo segundo,
el service worker cache-first serviría un dashboard sin el registro.

## Lo ya medido que se ratifica

6 estados; ninguno sin primaria; `pending_approval → Aprobar` (su siguiente paso no es enviar) y
`rejected`/`expired` → **Duplicar**, lo único que hace avanzar el dinero desde ahí.
