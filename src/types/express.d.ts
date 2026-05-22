import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    merchantId: number;
    userRole: 'admin' | 'tecnico';
    teamMemberId: number | null;
  }
}
