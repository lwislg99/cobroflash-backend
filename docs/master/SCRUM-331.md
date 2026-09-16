# SCRUM-331 · F4, el héroe — la prueba social no se disimula: se sustituye por demostración

**Medido contra:** `origin/main` = `e7772b71dfd22e472470739006155aad0ade4d53` · 2026-08-20T02:39:01+01:00

**20-ago-2026** · **Carril:** landing (F4) · **Gate:** sin gate en la suite; el guard de navegador va aparte

**LA VÍCTIMA:** el héroe es la frase más importante del producto, y su prueba se apoyaba en algo
que no existe.

---

## ① EL PASO 0 · qué capturas hay y de dónde salen — y la respuesta tumba el diseño original

El diseño de F4 resolvía la prueba social así: *«Capturas reales del producto. Tenemos producto y
funciona. Enseñarlo ES prueba.»* **Medido, las tres mitades de esa frase fallan:**

| Pregunta | Medido |
|---|---|
| ¿Hay capturas en la landing? | 🔴 **NO. Cero `<img>` en `public/index.html`.** |
| ¿Y los PNG del repo? | Hay **siete** en `public/img/landing/` (`home-390`, `firma-390`, `pago-390`, `customers-390`, `products-390`, `reports-390`, `quote-requests-390`) y **no los referencia nadie**: ni HTML, ni CSS, ni JS. Barrido sobre `public/`, `docs/` y `src/`; el único acierto es una línea de `docs/SPRINT_DEMO_READY_EXT.md` que las da por publicadas. |
| ¿De qué cuenta salen? | 🔴 **Del seed demo.** `scripts/capture-demo.mjs:36`, literal: *«Públicas del cliente final (**ids del seed demo**; ajustar si se resiembra)»*. Se tomaron contra `yaqu.app` con una sesión acuñada en BD (magic link) y Edge headless. |

**Una captura de un decorado no es prueba de producto**, y es la misma clase de cosa que D0
encontró en F6 con los conceptos del seed del vídeo. Aquí ni siquiera llegó a publicarse.

**Lo que el héroe tiene hoy en su lugar** (SCRUM-327 · Q2, remedido aquí) es una **escena animada
por CSS** con un presupuesto de ejemplo: cliente «José Luis Martín», «Instalación de descalcificador
690,00 €», total «961,95 €». Es un mockup rotulado `aria-label="Demostración"`, no una afirmación
sobre el mundo — y la aritmética cuadra (690 + 105 = 795; 21 % = 166,95; total 961,95). No es
deshonesto; simplemente **no es prueba**.

## ② QUÉ SE USA COMO PRUEBA, Y QUÉ SE DESCARTA

**Se usa: la DEMO INTERACTIVA.** Existe y está medida — SCRUM-327 · Q3: `#probar`, **13 pasos**,
recorrido presupuesto→pago. Con cero clientes pagando, dejar que el visitante lo pruebe es la mejor
prueba que hay: **se prueba el producto en vez de creerse a un desconocido.** La propuesta la sube a
**acción primaria** del héroe (hoy es la secundaria).

**Se descarta, con su motivo:**

* **Las capturas** — decorado, ver ①.
* **El catálogo por gremio** — sigue en `draft_pendiente_validacion` (F6/SCRUM-333). No se puede
  usar como prueba hasta que un profesional lo valide.
* **El contador de plazas** — **no hace falta descartarlo: ya está bien resuelto.** SCRUM-330 lo
  cambió a contar suscripción **activa de verdad** (`plan:'founding'` **y**
  `subscriptionStatus:'active'`), y con cero vendidas **no pinta la escasez**; si el dato no se
  puede leer, se oculta en vez de inventar un número. Hoy no pinta nada, que es lo correcto.
* **«Hecho con profesionales de oficio»** — no se escribe: no consta que sea cierto y **lo confirma
  el fundador o no se dice**.
* 🔴 **Testimonios, logos, «más de X profesionales»** — cero. Con cero clientes pagando eso no es
  marketing agresivo: **es falso**. Hay un guard que lo impide por patrón, en el héroe vivo y en la
  propuesta.

## ③ 🔴 UNA CIFRA INVENTADA, YA PUBLICADA, QUE NADIE HABÍA CAZADO

El ticket ya venía con una corregida («un visitante decide en noventa segundos» — fuera). Al medir
el héroe **publicado** apareció otra, viva:

> `public/index.html` · héroe · **«Listo en 5 minutos»**

**Nadie la midió, y D0 (SCRUM-310) midió que no se puede medir hoy**, literal:

> *«Los segundos no son medibles desde el árbol y no se estiman: dependen de la latencia de Resend y
> del filtro de spam del destinatario, que no están en el repo.»*

Y el alta **cruza la bandeja de entrada del usuario** (magic link de 15 min) — el camino crítico de
esa promesa no está bajo nuestro control.

**No se toca aquí:** es copy publicado, y el copy de la landing ES el máster (A22 + regla 30). Lo
que se hace es **declararla con su motivo y su dueño, y ponerle trinquete para que no crezca**. Que
salga del héroe es la mitad de la propuesta de ④, y la decide el fundador.

## ④ LA PROPUESTA — marcada como propuesta, y no se pinta

`#heroe-f4` en `public/index.html`, `hidden` y con `data-microcopy="PENDIENTE_FUNDADOR"`. Mecanismo
de F6, con test en las **dos** direcciones. **Aprobarla = mover lo aprobado al héroe vivo y borrar
el bloque; no se publican dos héroes** (hay test que lo impide).

| | Héroe vivo | Propuesta F4 |
|---|---|---|
| Eyebrow y H1 | *(A22)* | **idénticos, letra a letra** — con guard que lo exige |
| Acción primaria | «Empieza gratis» → registro | **«Probar la demo» → `#probar`** |
| Acción secundaria | «Probar la demo» | «Empieza gratis» → registro |
| Subtítulo | *(el vivo)* | añade *«No hace falta que te fíes: haz tú el recorrido completo antes de dar tu correo.»* |
| Pie | 14 días · Sin tarjeta · **Listo en 5 minutos** | 14 días · Sin tarjeta — **sin la cifra sin fuente** |

**Todo el texto de la columna derecha es PROPUESTA.** El fundador aprueba.

## ⑤ VERIFICACIÓN

* **Censo de cifras** (`scripts/_cifras-heroe.mjs`): las tres cifras de la copia del héroe, con
  procedencia — «30 segundos» → máster A1/PROJECT BRIEF · «14 días» → código (`registerMerchant`
  fija `planExpiresAt` +14 d) y máster H1 · «5 minutos» → **SIN FUENTE**, con motivo y decisor.
  **La decoración de `.stage` queda fuera a propósito**, y escrito por qué: censar un mockup
  diluiría el censo de lo que sí afirma.
* **SUELO** — si el extractor no encuentra el héroe, o su copia sale casi vacía, **se declara
  CIEGO**. «El héroe no tiene cifras» y «el extractor dejó de reconocerlas» son la misma lista vacía
  y consecuencias opuestas.
* **AUTOPRUEBA** — el detector VE un «340 profesionales» sintético. Sin ella, el verde del trinquete
  significaría «no supe buscar». *(Y el fixture tuvo que alargarse: el primero medía 38 caracteres y
  el suelo lo declaraba ciego — la autoprueba estaba midiendo el suelo, no el trinquete.)*
* **CONTROL NEGATIVO, en el navegador y no en el código que dice cumplirlo** — ver ⑥.
* **Regla 26** — ni VeriFactu ni Hacienda en el héroe, ni con sinónimos.

### 🔴 EL ROJO POR EL MECANISMO, con su SHA

Con la rama **ya commiteada** en `19ac1253` y el árbol limpio, se metió en el héroe vivo
«Ya lo usan 340 profesionales». **Cayeron DOS guards independientes**, cada uno por su motivo:

```
✖ SCRUM-331 · 🔴 ninguna cifra del héroe sin PROCEDENCIA escrita
  🔴 HAY UNA CIFRA EN EL HÉROE QUE NADIE HA DECLARADO: 340
✖ SCRUM-331 · 🔴 ni un testimonio, ni un logo, ni un «más de X profesionales»
```

Que caigan dos y no uno es la propiedad que se buscaba: **la cifra sin fuente y el cliente inventado
son dos defectos distintos**, y una frase puede ser sólo uno de los dos. Revertida la inyección con
la edición inversa —**no con `git checkout --`, que el hook bloqueó y con razón**—, verde otra vez.

## ⑥ MEDIDO EN NAVEGADOR · Edge, 4G emulada, 360 y 390 px

`npm run guard:primera-pantalla` (fuera de la suite, misma decisión que `guard:contraste` y
`guard:caja-avisos`). Levanta su propio servidor con el `http` de Node — **sin dependencias nuevas**
(regla 36) — y sirve `/public/founding-status` en dos modos.

**El control negativo, que es lo que de verdad prueba:**

| `/public/founding-status` | escasez de plazas | números de plazas pintados |
|---|---|---|
| responde (7 plazas) | visible | los suyos |
| **ROTO (500)** | **OCULTA ✔** | **ninguno ✔** |

A 360 y a 390 px. La regla de SCRUM-330 —*si el dato no se puede leer, no se inventa un número*—
**verificada en el navegador**, no en el código que dice cumplirla.

**Rendimiento, después del cambio:**

| ancho | FCP | LCP | CLS | scroll horizontal |
|---|---|---|---|---|
| 360 px | 976 ms | 976 ms | 🔴 **0,382** | no |
| 390 px | 636 ms | 636 ms | 🔴 0,108 | no |
| 360 px *(fuente rota)* | 604 ms | 604 ms | **0,001** | no |
| 390 px *(fuente rota)* | 592 ms | 592 ms | **0,001** | no |

**LCP = FCP: el héroe no espera a ningún fetch.** La demo no bloquea la primera pintura.

🔴 **Pero el CLS de la primera pantalla está muy por encima de 0,1, y la causa queda AISLADA por el
A/B del propio guard:** con la fuente del contador rota, el CLS cae a **0,001**. Lo desplaza **la
barra de anuncio**, que se despliega arriba cuando responde el `fetch` y empuja la página entera.
**No es de este cambio** (la propuesta va `hidden`) y **no se arregla aquí**: reservarle el hueco es
tocar la barra de oferta, que es de SCRUM-330 y A22. **Reportado.**

**Objetivos táctiles < 44 px en la primera pantalla** (AB6): «Ver planes →» (24 px, dentro de la
barra de anuncio) y el logo (34 px). **Ninguno es `.p-link`**, así que **no es SCRUM-542**; son
preexistentes y quedan reportados.

## ⑦ Ficheros

* `scripts/_cifras-heroe.mjs` (nuevo) · `scripts/guard-primera-pantalla.mjs` (nuevo) ·
  `tests/scrum331-heroe.test.mjs` (nuevo, 11) · `public/index.html` (+42, 0 borradas) ·
  `package.json` (el script del guard, con su `//` de motivo).

**Lo que NO se toca:** el posicionamiento (F1 y el máster) · el precio (F3) · lo legal (F2) · la
comparativa (F5) · los gremios (F6) · la app · el héroe VIVO (ni una palabra) · `.p-link` (SCRUM-542).

⚠️ **F5 (SCRUM-332) ya está en `main`** y esta rama sale de ahí. **F7 (SCRUM-334) sigue corriendo en
paralelo sobre el mismo fichero**: si al mergear aparece conflicto en `public/index.html`, **no lo
resuelve esta sesión**.

## ⑧ Tanda

**3.722 tests · 3.645 pass · 0 fail · 77 skipped.**
