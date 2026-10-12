import multer from 'multer';
import { env } from '../../config/env';
import { HttpError } from '../errors/HttpError';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

/**
 * Subida de imágenes en memoria; el StorageService (F3-03) decide dónde guardarlas.
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
