/**
 * Aviso de privacidad integral del control de asistencia con reconocimiento facial (A-68).
 *
 * Es la fuente del texto: la app lo muestra tal cual y `docs/AVISO_PRIVACIDAD_BORRADOR.md` se genera de aquí
 * (no editar el .md a mano). Cuando el abogado entregue el texto final se cambia este archivo y se sube
 * `AVISO_PRIVACIDAD_VERSION`: a todos los guardias les vuelve a salir. Lo que va entre [corchetes] está por completar.
 */

/** Versión del texto. Al cambiarlo, a todos se les vuelve a pedir que lo lean y acepten. */
export const AVISO_PRIVACIDAD_VERSION = 'borrador-0';

/** Mientras el texto no esté aprobado por el abogado, la app lo marca como borrador. */
export const AVISO_PRIVACIDAD_ES_BORRADOR = true;

export interface SeccionAviso {
  titulo: string;
  /** Párrafos de texto. */
  parrafos?: string[];
  /** Lista con viñetas, después de los párrafos. */
  puntos?: string[];
}

export interface AvisoPrivacidadTexto {
  titulo: string;
  /** Lo que se ve en la ventana antes de abrir el texto completo. */
  resumen: string[];
  /** Quién es el responsable y el encargado. */
  introduccion: string[];
  secciones: SeccionAviso[];
  actualizado: string;
}

export const AVISO_PRIVACIDAD: AvisoPrivacidadTexto = {
  titulo: 'Aviso de privacidad integral: control de asistencia con reconocimiento facial',
  resumen: [
    'Para checar usamos tu rostro: guardamos las medidas de tu cara (no es un dibujo de ella) y fotos tuyas.',
    'Te tomamos 5 fotos al registrar tu rostro, y una foto en cada entrada y cada salida.',
    'También guardamos tu ubicación y datos del teléfono al checar.',
    'Solo lo ven tu supervisor y la administración, y es para saber que tú checaste en tu sitio.',
    'Puedes pedir ver, corregir o borrar tus datos, y retirar tu permiso cuando quieras.',
  ],
  introduccion: [
    '**[Razón social de Platinum Agency]** (en adelante, "el Responsable"), con domicilio en [domicilio completo], es responsable del tratamiento de los datos personales que se describen en este aviso, conforme a la legislación mexicana en materia de protección de datos personales en posesión de particulares.',
    'El sistema "Intranet Platinum" es operado por cuenta del Responsable por **Comunicalo de México, S.A. de C.V.** (en adelante, "el Encargado"), que trata los datos solo siguiendo las instrucciones del Responsable.',
  ],
  secciones: [
    {
      titulo: '1. Datos personales que recabamos',
      parrafos: ['Para el control de asistencia mediante la aplicación recabamos los siguientes datos.'],
      puntos: [
        '**Datos biométricos (datos personales sensibles).** Las características de tu rostro: al registrarlo, la aplicación calcula en tu teléfono una serie de números (una "huella facial" de 128 valores por foto) a partir de 5 fotografías (mínimo 3). Esos números permiten saber si quien checa es la misma persona; no son una imagen y no sirven para reconstruir tu cara por sí solos. Se guardan junto con las fotografías del registro, que pueden incluir tomas con y sin lentes.',
        '**Fotografías al checar.** Una fotografía en cada entrada, en cada salida y en la salida final después de horas extra. La fotografía se compara con tu rostro registrado y se guarda como comprobante. Al registrar el inicio y el fin de la comida no se toma fotografía.',
        '**Fotografías de intentos rechazados.** Cuando el sistema detecta algo irregular (otra persona frente a la cámara, una foto o una pantalla en lugar de tu rostro, o que el gesto de verificación no se completó), guarda la fotografía como evidencia para que un supervisor o administrador la revise.',
        '**Resultado de la verificación.** Qué tan parecida fue la fotografía a tu rostro registrado, con qué rostro se comparó y cuántos intentos se necesitaron. No se graba video: durante la verificación la cámara solo captura imágenes fijas.',
        '**Ubicación al checar.** Las coordenadas GPS del teléfono en el momento de checar, su precisión y la distancia al sitio asignado. Solo se guardan al checar o al usar el botón de emergencia. Mientras tienes abierta la pantalla del Checador, la aplicación consulta tu ubicación para decirte si estás dentro del sitio, pero esa consulta no se guarda ni se envía: no hay rastreo continuo.',
        '**Datos del dispositivo y la conexión.** Fecha y hora del servidor y del teléfono (para detectar relojes alterados), dirección IP, y tipo de dispositivo y navegador. Si usas el botón de emergencia (SOS), también el nivel de batería.',
        '**Datos de identificación y de la relación laboral.** Nombre, correo electrónico, teléfono de contacto (y personal, si lo das), sitio y turno asignados, y tu foto de perfil, que es la fotografía aprobada de tu registro de rostro.',
        '**Datos de tu actividad.** Entradas, salidas, comidas, retardos, faltas, ausencias, cambios de turno, horas extra, reportes, bitácoras y las acciones que realizas en la aplicación (registro de auditoría).',
      ],
    },
    {
      titulo: '2. Finalidades del tratamiento',
      parrafos: ['**Finalidades necesarias** (sin ellas no es posible usar el control de asistencia):'],
      puntos: [
        'Verificar tu identidad y registrar tu entrada, salida y comida en el sitio asignado.',
        'Evitar suplantaciones y registros fraudulentos de asistencia (que alguien checara por ti).',
        'Confirmar que checaste dentro del sitio asignado.',
        'Calcular retardos, faltas, horas extra y la cobertura de turnos.',
        'Atender emergencias y avisar a tu supervisor y a la administración.',
        'Mantener bitácoras y el registro de auditoría de las acciones del sistema.',
        'Atender aclaraciones, inconformidades y requerimientos de autoridad sobre tus registros.',
      ],
    },
    {
      titulo: '3. Finalidades secundarias',
      parrafos: [
        'No usamos tus datos personales para fines distintos a los de la sección 2: no los usamos para publicidad, perfiles comerciales ni los vendemos. [Confirmar con el abogado si se requiere separar alguna finalidad.]',
      ],
    },
    {
      titulo: '4. Consentimiento',
      parrafos: [
        'Los datos biométricos son datos personales sensibles. Para tratarlos necesitamos tu consentimiento expreso, que otorgas al marcar la casilla y presionar "Aceptar y continuar" en la aplicación. Se registra la fecha y hora (del servidor), la versión de este aviso, tu dirección IP y el dispositivo desde el que aceptas.',
        'Si no aceptas, no podrás usar el control de asistencia con reconocimiento facial. Tu supervisor te indicará cómo registrar tu asistencia mientras tanto. [Alternativa por definir con el abogado y la empresa.]',
        'Si este aviso cambia, te lo mostraremos de nuevo en la aplicación. Puedes retirar tu consentimiento cuando quieras (sección 8).',
      ],
    },
    {
      titulo: '5. Cuánto tiempo conservamos tus datos',
      puntos: [
        '**Rostro registrado y sus fotografías:** mientras trabajes con nosotros. Los eliminamos [plazo, por ejemplo: dentro de 30 días] después de que termine tu relación.',
        '**Fotografías de entrada y salida y registros de asistencia:** [plazo, por ejemplo: X años] por obligaciones laborales, de seguridad y para atender aclaraciones.',
        '**Fotografías de intentos rechazados y bitácoras:** [plazo].',
        '**Registro de auditoría:** [plazo].',
        'Puedes pedir en cualquier momento que se elimine tu rostro registrado: deberás registrarlo de nuevo para checar con reconocimiento facial. Las fotografías de tus checadas pasadas se conservan como comprobante durante el plazo indicado arriba.',
      ],
    },
    {
      titulo: '6. Quién puede ver tus datos',
      parrafos: [
        'Dentro de la empresa: tu supervisor, los administradores y el personal que autorice el Responsable. Cada persona ve solo lo que su cargo requiere. Tu rostro, tus fotografías y tu ubicación no se publican ni se muestran a otros guardias. Los clientes de seguridad, solo en los sitios donde estás asignado, ven tu nombre y correo, tu foto de referencia, tu horario, la hora a la que checas (con tus retardos y faltas confirmadas) y la foto y la ubicación de cada checada. No ven tu teléfono ni el resultado del reconocimiento facial.',
        'El centro de monitoreo (C2) vigila que cada sitio tenga guardia y atiende los avisos de emergencia. Para eso ve tu nombre, tu foto de referencia, tu horario y la hora a la que checas en los sitios; y, si pides ayuda con el botón SOS, tu ubicación y tus teléfonos (el de la empresa y el personal). No ve el resultado del reconocimiento facial.',
        'Las fotografías se muestran mediante enlaces temporales firmados, no públicos.',
      ],
    },
    {
      titulo: '7. Transferencias y encargados',
      parrafos: [
        'El Encargado (Comunicalo de México, S.A. de C.V.) aloja y opera el sistema. Las fotografías y la base de datos se guardan en un servidor del Encargado, con acceso restringido.',
        '[Por definir con el abogado: si el centro de monitoreo (C2) pertenece a una empresa distinta del Responsable y cómo se documenta esa transferencia; y si se comparten datos con clientes de seguridad, otros proveedores o autoridades.] Fuera de lo anterior, no transferimos tus datos personales sin tu consentimiento, salvo los casos que la ley permita.',
      ],
    },
    {
      titulo: '8. Tus derechos',
      parrafos: [
        'Puedes **acceder** a tus datos, **rectificarlos**, **cancelarlos**, **oponerte** a su tratamiento (derechos ARCO) y **retirar tu consentimiento**, en los términos de la ley. Para ejercerlos escribe a [correo de contacto] o preséntate con [área o persona responsable] con una identificación oficial. Te responderemos en [plazo legal] días hábiles.',
        'Retirar tu consentimiento implica que no podrás usar el reconocimiento facial para checar. [Consecuencia por definir con el abogado y la empresa.]',
        'Si consideras que tu derecho a la protección de datos personales fue vulnerado, puedes acudir ante la autoridad competente en la materia.',
      ],
    },
    {
      titulo: '9. Medidas de seguridad',
      parrafos: [
        'Protegemos tus datos con acceso por usuario y contraseña, permisos por rol, conexión cifrada (HTTPS), registro de auditoría de las acciones administrativas, enlaces temporales para las fotografías y un servidor con acceso restringido. [Completar con las medidas que el abogado considere necesarias.]',
      ],
    },
    {
      titulo: '10. Cambios a este aviso',
      parrafos: [
        'Si este aviso cambia, te lo mostraremos de nuevo en la aplicación y te pediremos que lo aceptes otra vez. La versión vigente siempre está disponible en la aplicación.',
      ],
    },
  ],
  actualizado: '[fecha de la versión aprobada]',
};
