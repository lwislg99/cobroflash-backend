# SCRUM-329 · las páginas legales dejan de estar sin vigilar

**Fecha:** 10-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `c47d03655aacd7fe78044f89e7c55a7d467cbb5b` · 2026-08-10T23:05:00+02:00

## Lo que era, y no es lo que parecía

La rama `scrum-329-legal-pagina-publica` (1 commit) **no traía una página legal: traía un TEST**, y
nada más. Buscar «la página legal» habría dado el veredicto contrario — el mecanismo no era
contenido nuevo, era **la verificación de las páginas que ya existen**.

No se ha redactado ni una línea de texto legal, y la rama tampoco lo hacía.

## Se corrió contra main ANTES de traerlo

Condición del encargo, y la más importante: si hubiera fallado, el hallazgo sería que
`/privacidad` o `/terminos` están rotas o vacías HOY, y eso vale más que el merge.

**Pasó 7/7 contra `origin/main` limpio.** Las legales responden y tienen contenido. Así que el test
entra a vigilar, no a denunciar — y **no se mete un guard rojo en main**, que entrena a ignorarlo.

## Qué vigila

| Test | Qué impide |
| --- | --- |
| el censo de enlaces internos LEE de verdad (SUELO) | que el guard pase por no encontrar ningún enlace |
| cada enlace interno responde 200 **y con contenido** | el 404 y el **200 vacío**, que es el que no se nota |
| el inventario de cookies ENCUENTRA cookies (SUELO) | el verde por no saber mirar |
| el producto no escribe ninguna cookie no esencial | |
| visitar la página pública no instala NINGUNA cookie | |
| el estado legal medido coincide con el declarado | que la declaración envejezca sin que nadie lo note |
| los huecos declarados siguen siendo huecos REALES | una lista de pendientes vieja que ya no describe nada |

**Los dos suelos son la mitad que importa**: «todo correcto» y «no supe mirar» no pueden dar el
mismo verde. Con las legales caídas, el segundo nos dejaría tranquilos.

## Rojo por el mecanismo

Se vació `/privacidad` (mutación confirmada: 71 bytes). El test cae **nombrando la página y
diciendo por qué**, que es lo que se pedía — no basta con que caiga:

```
🔴 enlaces públicos rotos o vacíos:
    /privacidad → 200 pero solo 1 car. de texto visible (página legal)
```

Distingue **200-vacío** de 404. Restaurado, verde otra vez.

## La víctima que esto protege

Quien llega a `/privacidad` o `/terminos` llega **DESDE FUERA** —un cliente, un asesor, una
inspección—, porque **desde el dashboard no se enlaza a las legales** (medido en SCRUM-406). Es
justo el público que no perdona encontrarlas vacías, y hasta hoy **nada comprobaba que respondieran**.
