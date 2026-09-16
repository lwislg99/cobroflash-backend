# yaqu-backend
YaQu — cotizaciones WhatsApp-first para profesionales de servicios (LATAM/ES).

---

## 🔴 ANTES DE MEDIR NADA EN ESTE ÁRBOL: `npm ci`

**Un árbol con el código al día y las dependencias viejas miente mejor que un árbol viejo**, porque
el defecto está en lo que **falta** — y lo que falta no aparece en ningún `git diff`.

Esta semana **cinco rojos de `main`** resultaron ser `fake-indexeddb` ausente de un `node_modules`
desfasado. La suite no lo distingue de un fallo del producto: se lee como código roto.

```bash
npm ci                              # antes de creerte un rojo, un verde o una medición
node scripts/diagnostico-dependencias.mjs   # ¿qué árbol de esta máquina está desfasado?
npm run topologia                   # ¿comparten node_modules entre ellos, y por qué vía?
```

## Qué comparten los worktrees, y qué no — **se comprueba, no se cita**

| | |
|---|---|
| `dist/` | **Nunca se comparte.** Cada árbol tiene el suyo. |
| `node_modules/` | **Depende del árbol, y por tres vías distintas**: propio · enlazado (junction/symlink) · **resuelto hacia arriba** (el árbol no tiene la carpeta y usa la del padre, sin que ningún enlace lo delate). |
| `package-lock.json` | **Es de cada rama.** Dos árboles pueden compartir el mismo `node_modules` y tener veredictos distintos, y los dos ser correctos. |

⚠️ **Ninguna de esas respuestas se escribe aquí como hecho fijo**, y ése es el punto: durante meses
el repo afirmaba que todos compartían por junction, de ahí salió la regla «no regeneres el cliente
de Prisma» — y costó en las dos direcciones. La topología cambia en cuanto alguien recrea un
worktree o cambia de máquina. **Por eso se pregunta con `npm run topologia`, no se recuerda.**

⚠️ **Y un `node_modules` propio VACÍO no deja aislado a un árbol:** Node resuelve **por paquete** y
sigue subiendo por los ancestros, así que un árbol de dentro del repo funciona con las dependencias
del padre aunque tenga su carpeta vacía.

## Nunca borres un worktree con `rm -rf` ni con `rmdir /s`

Si su `node_modules` es un **enlace**, el borrado recursivo **entra por él y arrasa el destino
compartido**. Ya pasó: 37 worktrees retirados dejaron el `node_modules` común con cero ficheros, y
ningún comando falló. Orden correcto: **quitar el enlace primero** (`cmd /c rmdir "<ruta>\node_modules"`,
sin `/s` — borra el enlace y deja el destino intacto) y **después** `git worktree remove`.

📎 El detalle y las mediciones: [`docs/PLAN_EJECUCION_Y_PARALELO.md`](docs/PLAN_EJECUCION_Y_PARALELO.md) ·
[`docs/ERRORES_ASESOR.md`](docs/ERRORES_ASESOR.md) · [`CLAUDE.md`](CLAUDE.md) para el protocolo de trabajo.
