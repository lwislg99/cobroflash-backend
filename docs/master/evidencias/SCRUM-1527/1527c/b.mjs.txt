// SCRUM-1527c · fichero de control: entrega su caso y su proceso NO cierra (sin --test-force-exit
// un temporizador vivo lo mantiene). Hace de «el anterior no cerró».
import test from 'node:test';
test('b1', () => {});
setInterval(() => {}, 1000);
