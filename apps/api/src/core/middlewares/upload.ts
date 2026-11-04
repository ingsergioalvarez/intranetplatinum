import multer from 'multer';
import { env } from '../../config/env';
import { HttpError } from '../errors/HttpError';

// Filtro rápido por tipo declarado; el servicio confirma con `detectarImagen` (firma de bytes).
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

/**
 * Subida de imágenes en memoria; el `StorageService` decide dónde guardarlas.
 * Uso: `router.post('/', uploadImages.array('fotos', 10), controller.create)`.
 */
export const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new HttpError(400, 'UPLOAD_ERROR', `Tipo de archivo no permitido: ${file.mimetype}`));
  },
});

const LOGO_MIME_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'];

/** Ícono de una empresa (C-07): un solo archivo de hasta 300 KB, SVG o imagen. El servicio confirma el contenido. */
export const uploadLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 300 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (LOGO_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new HttpError(400, 'UPLOAD_ERROR', 'El ícono debe ser SVG, PNG, JPG o WebP'));
  },
});
