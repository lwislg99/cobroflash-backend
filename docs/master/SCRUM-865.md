# SCRUM-865 · dos guards medían la misma página y le pedían cosas distintas

**Medido contra:** `origin/main` = `77ce9d1e86d6ffa921b1c92561ec2d7994f8e5eb` · 2026-09-16T08:47:00+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-865-la-landing-usa-el-minimo-compartido`
**Carril:** front / instrumentos

## La víctima

Quien lee un rojo y no sabe a cuál de los dos guards creer. `guard-objetivo-tactil` y
`guard-a11y-landing` miden **los dos** la landing publicada, a 1280 y 360 px. Desde SCRUM-711 el
primero exige el mínimo que dice DESIGN.md —44 en móvil, 36 en escritorio— y el segundo seguía
exigiendo 44 también a 1280.

## De dónde sale

De un hallazgo de la sesión anterior, reportado y no tocado al cerrar SCRUM-711: `guard-a11y-landing`
**no importaba** el umbral del medidor común, declaraba el suyo (`const MINIMO_TACTIL = 44;`).

🔒 **La causa no es el número: es que estuviera escrito dos veces.** Un umbral repetido diverge en
cuanto alguien decide sobre uno de los dos, y eso es exactamente lo que pasó. Es la misma lección que
SCRUM-562 dejó escrita con el árbitro: «una copia en línea es lo que dejó que estos dos midieran
distinto durante dos días». Por eso el arreglo **no** es escribir 36 en el segundo sitio.

## Lo que cambia

- `guard-a11y-landing` importa `minimoPara`, `CORTE_MOVIL`, `MINIMO_TACTIL` y `MINIMO_ESCRITORIO` del
  medidor común, y cada ancho mide con el suyo. **Ni un número nuevo escrito a mano.**
- El resumen final ya no promete «los táctiles llegan a 44»: dice el mínimo de cada ancho.

## 🔴 Y aquí las sondas hacían más falta que en el otro guard

Los dos táctiles que mide esta landing —el logo y «Ver planes →»— miden **45 y 47 px**. Están tan por
encima de cualquier umbral que **un mínimo mal aplicado no se notaría**: el guard saldría verde con
44, con 36 y con 12. Su verde no habría significado nada.

Tres sondas de umbral, inyectadas en la página cargada y medidas con el **mismo árbitro**, en cada
pasada y en cada ancho:

| sonda | ancho | tiene que | medido |
|---|---|---|---|
| 40 px | 360 | caer | 41 px · cae contra 44 ✅ |
| 30 px | 1280 | caer | 31 px · cae contra 36 ✅ |
| 37 px | 1280 | pasar | 38 px · pasa contra 36 ✅ |

📌 Este guard mide la landing a **360**, no a 390: el «40 px a 390» del encargo se comprueba aquí a su
ancho móvil real, y el de 390 ya lo cubren `tests/scrum711b-escritorio-36.test.mjs` y la sonda del
guard del panel.

## El control: lo que hoy cumple sigue cumpliendo

Los dos táctiles de la página dan **exactamente los mismos píxeles** que antes del cambio:

```
antes            después
el logo 45px     el logo 45px          (1280)
«Ver planes →» 47.1px   47.1px         (1280)
el logo 45px     el logo 45px          (360)
«Ver planes →» 47.6px   47.6px         (360)
```

## Los rojos, corridos

Mutando `minimoPara` a un valor fijo, uno por uno y revertido cada vez:

| `minimoPara` fijo en | lo que rompe | lo que dijo el guard |
|---|---|---|
| 44 | 37 px a 1280 debe pasar | `✖ UMBRAL MAL APLICADO @1280px: «__sonda-37» mide 38px contra 44 y CAE` |
| 36 | 40 px a 360 debe caer | `✖ @360px: «__sonda-40» mide 41px contra 36 y PASA` |
| 30 | 30 px a 1280 debe caer | `✖ @1280px: «__sonda-30» mide 31px contra 30 y PASA` |

En los tres, `tests/scrum865-un-solo-minimo-para-la-landing.test.mjs` cae también en la tanda: su
aritmética usa la **misma** función que el guard. Revertido: guard con salida 0.

## Excepciones

**No apareció ninguna que retirar.** Este guard no tiene lista de excepciones, y sus dos táctiles
cumplen con los dos mínimos. La retirada de las que sí existían por el 44 de escritorio se hizo en
SCRUM-711, en `guard-objetivo-tactil`.

## El trinquete

`tests/scrum865-un-solo-minimo-para-la-landing.test.mjs`:

- 🔒 **los dos guards importan `minimoPara` del mismo sitio** y lo usan con el ancho;
- la landing **no vuelve a escribir su propio umbral** ni a medir con el de móvil para todo;
- las tres sondas siguen dentro, con su altura y su veredicto por ancho;
- SUELO: los dos ficheros siguen midiendo la landing a 1280 y 360, así que la comparación habla de la
  misma página.
