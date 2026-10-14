// SCRUM-1527c · reporter de prueba: escribe, en el momento, cuándo empieza y cuándo COMPLETA cada
// fichero (nesting 0) y cada caso. `test:dequeue` y `test:complete` están en
// `kExecutionOrderedEvents` del runner (24.18.0 y 24.21.0): llegan al reporter SIN pasar por la cola
// ordenada por fichero que retiene `spec` y `tap`. Medición local, no va a CI.
//
//   node --test --test-reporter=spec --test-reporter-destination=stdout \
//        --test-reporter=./eventos.mjs --test-reporter-destination=stdout a.mjs b.mjs c.mjs
export default async function* eventos(source) {
  for await (const ev of source) {
    if (ev.type !== 'test:dequeue' && ev.type !== 'test:complete') continue;
    const nivel = ev.data.nesting === 0 && ev.data.name === ev.data.file?.split(/[\\/]/).pop() ? 'FICHERO' : 'caso';
    yield `${new Date().toISOString()} ${ev.type} ${nivel} ${ev.data.name}\n`;
  }
}
