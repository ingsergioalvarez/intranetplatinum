import { ROLES, type Rol } from './roles';

/**
 * Tips por notificación (A-78): dos a la semana, una lista fija por rol más unos para todos. Al tocar la
 * notificación la app abre una ventana con el texto completo. Cada texto debe ser cierto según los manuales
 * (`docs/manual`): si una pantalla cambia, se revisa el tip que la menciona.
 */
export interface Tip {
  /** Estable: va en el enlace de la notificación (`/?tip=<id>`). No se cambia una vez enviado. */
  id: string;
  /** Una línea: es lo que dice la notificación. */
  titulo: string;
  /** La explicación completa que se muestra en la ventana. */
  texto: string;
  /** A quién le sirve; sin `roles` es para todos. */
  roles?: readonly Rol[];
}

const { GUARDIA, SUPERVISOR, ADMIN, CLIENTE, C2 } = ROLES;

export const TIPS: readonly Tip[] = [
  // ---------- Para todos ----------
  {
    id: 'instalar-app',
    titulo: 'Usa la app desde su icono',
    texto:
      'Instalada, la app se abre a pantalla completa, te llegan los avisos aunque esté cerrada y, si eres guardia, puedes checar aunque se vaya la señal. Ábrela siempre desde el icono Platinum de tu pantalla de inicio.',
  },
  {
    id: 'acceso-rapido',
    titulo: 'Entra más rápido con un PIN',
    texto:
      'Puedes crear un PIN de 4 dígitos para entrar con un toque, sin escribir tu contraseña. Toca el icono de usuario de arriba y elige "Acceso rápido (PIN)".',
  },
  {
    id: 'ayuda',
    titulo: 'La app trae su manual',
    texto:
      'Toca el botón ? de arriba: ahí está el manual de ayuda, explicado paso a paso, con todo lo que puedes hacer según tu cargo.',
  },

  // ---------- Guardia ----------
  {
    id: 'guardia-comida-salida',
    titulo: 'La salida pide primero tu comida',
    texto:
      'Antes de checar tu salida debes registrar tu comida con "Salir a comer" y "Regresar de comer". Si falta, el botón "Checar salida" sale en gris y dice "Primero registra tu comida". En turnos de más de 12 horas son dos comidas.',
    roles: [GUARDIA],
  },
  {
    id: 'guardia-horas-extra',
    titulo: 'Si te quedas más tiempo, queda registrado',
    texto:
      'Cuando pasa tu hora de salida y sigues en el sitio, la app pregunta "¿Sigues en turno?". Si tocas "Sí, sigo aquí", tu supervisor recibe el aviso y esas horas quedan como horas extra. Si ya terminaste, toca "No, ya terminé"; y si no puedes quedarte, toca "No puedo quedarme" y avisa el motivo.',
    roles: [GUARDIA],
  },
  {
    id: 'guardia-sin-senal',
    titulo: 'Puedes checar sin internet',
    texto:
      'Si no hay señal, checa normal: la checada se guarda en tu celular con la hora en que la hiciste y se envía sola cuando vuelva la señal. Verás "Guardada en tu celular".',
    roles: [GUARDIA],
  },
  {
    id: 'guardia-cambio-turno',
    titulo: 'Puedes pedir un cambio de turno',
    texto:
      'En Mis sitios, al final, está la tarjeta "Cambios de turno": toca "Solicitar" para pedir que te cubran o para mover tu descanso. Tu supervisor decide, y hasta que lo apruebe nada cambia.',
    roles: [GUARDIA],
  },
  {
    id: 'guardia-ausencia',
    titulo: 'Pide tus ausencias por adelantado',
    texto:
      'Si vas a faltar con permiso, pídelo en la pestaña Ausencias antes del día. Así no se cuenta como falta. La resuelve el administrador y te llega un aviso con su decisión.',
    roles: [GUARDIA],
  },
  {
    id: 'guardia-reportar',
    titulo: 'Reporta lo que veas mal en tu sitio',
    texto:
      'Si ves algo descompuesto o peligroso, como una lámpara fundida o una puerta dañada, levántalo en la pestaña Reportes, con "Nuevo reporte" y una foto. Tu supervisor lo ve y le da seguimiento.',
    roles: [GUARDIA],
  },
  {
    id: 'guardia-sos',
    titulo: 'El botón SOS es para emergencias',
    texto:
      'En una emergencia usa el botón SOS de la app: avisa de inmediato a tu supervisor y a los administradores. Úsalo solo cuando de verdad lo necesites.',
    roles: [GUARDIA],
  },

  // ---------- Supervisor ----------
  {
    id: 'supervisor-retardos',
    titulo: 'Tú decides los retardos y las faltas',
    texto:
      'Cuando un guardia llega tarde o no se presenta, desde Asistencia puedes justificar, aceptar o mandar a casa, según el caso. Siempre se guarda el motivo de tu decisión.',
    roles: [SUPERVISOR],
  },
  {
    id: 'supervisor-cubrir',
    titulo: 'Si un sitio se queda sin guardia, envía a cubrir',
    texto:
      'Desde Asistencia puedes enviar a cubrir a un guardia de tus sitios. Si necesitas a uno de otro supervisor, se pide al administrador con una solicitud de cobertura.',
    roles: [SUPERVISOR],
  },
  {
    id: 'supervisor-rostros',
    titulo: 'Revisa los rostros pendientes',
    texto:
      'Cuando un guardia registra su rostro queda pendiente hasta que lo apruebas en Asistencia, en "Rostros por revisar". Mientras no esté aprobado, el cliente no ve la foto de ese guardia.',
    roles: [SUPERVISOR],
  },
  {
    id: 'supervisor-quejas',
    titulo: 'Atiende las quejas de los clientes',
    texto:
      'Los clientes pueden reportar algo del servicio o de un guardia, con hasta 5 fotos. Entra a Quejas, tómala a revisión o resuélvela: lo que escribas al resolver es lo que lee el cliente.',
    roles: [SUPERVISOR],
  },
  {
    id: 'supervisor-horas-extra',
    titulo: 'Revisa las horas extra de tus guardias',
    texto:
      'Cuando un guardia se queda después de su hora de salida, esas horas quedan registradas para tu revisión. Las encuentras en Asistencia, en "Horas extra".',
    roles: [SUPERVISOR],
  },

  // ---------- Administrador ----------
  {
    id: 'admin-ausencias',
    titulo: 'Resuelve las ausencias de tus guardias',
    texto:
      'Los guardias piden sus ausencias por adelantado y las resuelves tú desde Asistencia, en Ausencias. Las que registras tú mismo quedan aprobadas al momento.',
    roles: [ADMIN],
  },
  {
    id: 'admin-celulares',
    titulo: 'Si un guardia pierde su celular',
    texto:
      'En Usuarios, toca "Celulares" en la fila de la persona y quita el celular guardado (o "Quitar todos"): así nadie más entra con su perfil rápido. La persona entrará con su correo y contraseña y podrá guardar su celular nuevo.',
    roles: [ADMIN],
  },
  {
    id: 'admin-clientes',
    titulo: 'Da acceso a tus clientes a la app',
    texto:
      'Puedes crear la cuenta de un cliente, ligada a su empresa, para que vea sus guardias y su asistencia y levante reportes sobre el servicio.',
    roles: [ADMIN],
  },
  {
    id: 'admin-quejas-urgentes',
    titulo: 'Las quejas urgentes te llegan siempre',
    texto:
      'Cuando un cliente marca un reporte como urgente te llega el aviso al momento. Los demás solo te llegan si el sitio no tiene supervisor; aun así puedes verlos y resolverlos en Quejas.',
    roles: [ADMIN],
  },

  // ---------- Cliente ----------
  {
    id: 'cliente-reportar',
    titulo: 'Puedes reportar algo del servicio',
    texto:
      'En Reportar puedes levantar un reporte sobre el servicio o sobre un guardia y adjuntar hasta 5 fotos que ayuden a entender lo que pasó. Lo ven el supervisor del sitio y el administrador.',
    roles: [CLIENTE],
  },
  {
    id: 'cliente-comentar',
    titulo: 'Comenta y manda fotos en un reporte',
    texto:
      'Dentro de un reporte puedes agregar un comentario o un dato adicional y mandar hasta 5 fotos como evidencia.',
    roles: [CLIENTE],
  },
  {
    id: 'cliente-asistencia',
    titulo: 'Consulta quién está en tu sitio',
    texto:
      'En Asistencia ves, día por día, quién debe estar en tu sitio con su foto, y la foto con la que checó, para que compares.',
    roles: [CLIENTE],
  },
  {
    id: 'cliente-urgente',
    titulo: 'Si algo no puede esperar',
    texto:
      'Al levantar un reporte marca "Es urgente" solo cuando necesite atención de inmediato: se avisa al momento al administrador.',
    roles: [CLIENTE],
  },
  {
    id: 'cliente-respuesta',
    titulo: 'Te avisamos cuando resolvemos tu reporte',
    texto:
      'Cuando tu reporte pasa a revisión o se resuelve te llega un aviso, y en Reportar ves la respuesta. Si el problema sigue, haz un reporte nuevo.',
    roles: [CLIENTE],
  },
  {
    id: 'supervisor-c2',
    titulo: 'Mira lo que hizo el C2 sobre tus sitios',
    texto:
      'En Inicio, la tarjeta "Lo que hizo el C2 hoy" te muestra sus notas, avisos, reportes y respuestas a SOS. En el menú, "Bitácora C2" tiene el día completo, y bajo cada sitio de la asistencia del día ves su última nota. Solo lees: no escribes ahí.',
    roles: [SUPERVISOR],
  },
  {
    id: 'admin-c2',
    titulo: 'Mira lo que hizo el C2 en tu cartera',
    texto:
      'En Inicio, la tarjeta "Lo que hizo el C2 hoy" resume sus notas, avisos, reportes y respuestas a SOS. La bitácora completa está en C2, pestaña Bitácora. Sus reportes llevan la etiqueta C2 y solo los ven tú y el supervisor.',
    roles: [ADMIN],
  },
  // ---------- Operador C2 ----------
  {
    id: 'c2-sonido',
    titulo: 'Activa el sonido de tu pantalla',
    texto:
      'Al entrar a tu pantalla toca "Activar sonido". Sin eso el navegador no deja sonar y podrías no enterarte de un sitio solo o de un SOS. Con "Silenciar" apagas lo que hay ahora; si aparece algo nuevo, vuelve a sonar.',
    roles: [C2],
  },
  {
    id: 'c2-estados',
    titulo: 'Qué significa cada estado de un sitio',
    texto:
      '"Solo" quiere decir que pasaron 15 minutos de la hora del turno y nadie ha checado. "Parcial": debían estar dos o más y falta alguno. "Por llegar" todavía no es problema, y "Sin turno" tampoco: a esa hora no debe haber nadie. Con "Con problema" ves solo lo que necesita atención, y al tocar un color ves solo esos sitios.',
    roles: [C2],
  },
  {
    id: 'c2-sos',
    titulo: 'Si hay un SOS, sube arriba de todo',
    texto:
      'La emergencia aparece arriba, en rojo, con quién la lanzó, el sitio y los teléfonos para llamar. Toca "Estamos atendiendo" para avisar que la atiendes y "Registrar respuesta" para dejar lo que hiciste (llamaste al guardia, avisaste al supervisor, pediste apoyo externo). Se queda en rojo hasta que se cierra, aunque ya la estén atendiendo.',
    roles: [C2],
  },
  {
    id: 'c2-bitacora',
    titulo: 'Todo queda en la bitácora',
    texto:
      'En la pestaña Bitácora ves, por día, lo que pasó con los sitios (solo, parcial, cubierto), los SOS y lo que hiciste tú: notas, avisos y reportes. Lo registra el sistema solo y puedes filtrar por sitio, cliente o tipo.',
    roles: [C2],
  },
  {
    id: 'c2-iconos',
    titulo: 'Qué hacen los iconos de cada sitio',
    texto:
      'A la derecha de cada sitio tienes cuatro iconos: Llamar (los números del supervisor), Avisar al supervisor, Nota y Reporte. Todo lo que haces con ellos queda en la bitácora con tu nombre y la hora, y la última nota del día se ve en el sitio.',
    roles: [C2],
  },
];

export const tipPorId = (id: string) => TIPS.find((t) => t.id === id);

/** Los tips que le sirven a un celular según los roles de las cuentas que tiene guardadas. */
export function tipsParaRoles(roles: readonly Rol[]): Tip[] {
  return TIPS.filter((t) => !t.roles || t.roles.some((r) => roles.includes(r)));
}
