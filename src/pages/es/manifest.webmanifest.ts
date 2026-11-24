// The Spanish web app manifest (see src/pwa/manifest.ts).
import { manifestResponse } from '../../pwa/manifest';

export const GET = () =>
  manifestResponse({
    lang: 'es',
    name: 'Misiones de Sysadmin',
    shortName: 'Sysadmin',
    description: 'Aprende administración de sistemas, en Linux y en Windows, jugando con comandos reales. Funciona sin conexión; tu progreso se queda en este dispositivo.',
  });
