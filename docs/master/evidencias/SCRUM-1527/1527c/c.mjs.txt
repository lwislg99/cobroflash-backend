// SCRUM-1527c · fichero de control: va detrás del que no cierra. Termina, y `spec` lo retiene.
import test from 'node:test';
test('c1', () => {});
