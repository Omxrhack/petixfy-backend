const multer = require('multer');

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB, alineado con file_size_limit del bucket

const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);

function fileFilter(req, file, cb) {
  if (allowedMime.has(file.mimetype)) {
    return cb(null, true);
  }
  cb(new Error('photo must be image/jpeg, image/png or image/webp'));
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter,
});

/** Middleware: un solo archivo en el campo `photo` (buffer en memoria). */
const uploadPetPhotoSingle = upload.single('photo');

/**
 * Ejecuta multer.single y devuelve 400 con mensaje claro (tamaño / tipo / campo).
 */
function uploadPetPhotoMiddleware(req, res, next) {
  uploadPetPhotoSingle(req, res, (err) => {
    if (!err) {
      return next();
    }
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: `photo exceeds maximum size of ${MAX_BYTES} bytes` });
      }
      return res.status(400).json({ error: err.message, code: err.code });
    }
    return res.status(400).json({ error: err.message });
  });
}

module.exports = { uploadPetPhotoMiddleware, MAX_BYTES };
