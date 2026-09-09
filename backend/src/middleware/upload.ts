const multer = require('multer');

export const CATALOGO_MAX_MB = Math.max(50, Number(process.env.CATALOGO_MAX_UPLOAD_MB) || 200);

export const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CATALOGO_MAX_MB * 1024 * 1024 },
}); // Catálogos MINFIN/SIBOFA pueden superar 50 MB
