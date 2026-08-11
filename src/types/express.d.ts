import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    merchantId: number;
    userRole: 'admin' | 'tecnico';
    teamMemberId: number | null;
    /** SCRUM-360 (H5 fase 2): QUÉ sesión es. `requireAuth` ya la carga entera; sin el id, nada
     *  puede escribir en su fila —y el riesgo del borrado de iOS es POR DISPOSITIVO, o sea por
     *  sesión. Se expone el id y nada más: el resto de la fila no es asunto de las rutas. */
    sessionId: number;
  }
}
