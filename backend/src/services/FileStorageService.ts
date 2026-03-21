import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export class FileStorageService {
  private uploadDir: string;

  constructor() {
    // Directorio base para almacenar archivos
    this.uploadDir = path.join(__dirname, '../../uploads');
    this.ensureDirectoryExists(this.uploadDir);
  }

  /**
   * Asegura que un directorio exista, si no lo crea
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Genera un hash SHA-256 de un buffer
   */
  private generateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Guarda un archivo PDF de SIAF
   * @param pdfBuffer Buffer del PDF generado
   * @param correlativo Correlativo de la solicitud SIAF
   * @returns Objeto con la ruta del archivo, hash y tamaño
   */
  async saveSiafPdf(pdfBuffer: Buffer, correlativo: string): Promise<{
    filePath: string;
    hash: string;
    size: number;
  }> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Crear estructura de directorios: uploads/siaf/2024/01/
    const siafDir = path.join(this.uploadDir, 'siaf', String(year), month);
    this.ensureDirectoryExists(siafDir);

    // Nombre del archivo: SIAF-001-2024.pdf
    const fileName = `${correlativo}.pdf`;
    const fullPath = path.join(siafDir, fileName);

    // Guardar el archivo
    fs.writeFileSync(fullPath, pdfBuffer);

    // Generar hash para verificación de integridad
    const hash = this.generateHash(pdfBuffer);

    // Ruta relativa para almacenar en BD
    const relativePath = path.join('siaf', String(year), month, fileName);

    return {
      filePath: relativePath,
      hash: hash,
      size: pdfBuffer.length
    };
  }

  /**
   * Lee un archivo PDF de SIAF
   * @param filePath Ruta relativa del archivo
   * @returns Buffer del archivo
   */
  async readSiafPdf(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.uploadDir, filePath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error('Archivo no encontrado');
    }

    return fs.readFileSync(fullPath);
  }

  /**
   * Verifica la integridad de un archivo usando su hash
   * @param filePath Ruta relativa del archivo
   * @param expectedHash Hash esperado
   * @returns true si el archivo es íntegro, false si está corrupto
   */
  async verifyFileIntegrity(filePath: string, expectedHash: string): Promise<boolean> {
    try {
      const fileBuffer = await this.readSiafPdf(filePath);
      const actualHash = this.generateHash(fileBuffer);
      return actualHash === expectedHash;
    } catch (error) {
      return false;
    }
  }

  /**
   * Elimina un archivo PDF de SIAF
   * @param filePath Ruta relativa del archivo
   */
  async deleteSiafPdf(filePath: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, filePath);
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  /**
   * Guarda un documento de expediente
   * @param fileBuffer Buffer del archivo
   * @param numeroExpediente Número del expediente
   * @param fileName Nombre original del archivo
   * @returns Objeto con la ruta del archivo, hash y tamaño
   */
  async saveExpedienteDocument(
    fileBuffer: Buffer, 
    numeroExpediente: string, 
    fileName: string
  ): Promise<{
    filePath: string;
    hash: string;
    size: number;
  }> {
    // Crear estructura de directorios: uploads/expedientes/EXP-001/
    const expedienteDir = path.join(this.uploadDir, 'expedientes', numeroExpediente);
    this.ensureDirectoryExists(expedienteDir);

    // Generar nombre único para evitar colisiones
    const timestamp = Date.now();
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const uniqueFileName = `${baseName}-${timestamp}${ext}`;
    
    const fullPath = path.join(expedienteDir, uniqueFileName);

    // Guardar el archivo
    fs.writeFileSync(fullPath, fileBuffer);

    // Generar hash
    const hash = this.generateHash(fileBuffer);

    // Ruta relativa
    const relativePath = path.join('expedientes', numeroExpediente, uniqueFileName);

    return {
      filePath: relativePath,
      hash: hash,
      size: fileBuffer.length
    };
  }

  /**
   * Lee un documento de expediente
   * @param filePath Ruta relativa del archivo
   * @returns Buffer del archivo
   */
  async readExpedienteDocument(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.uploadDir, filePath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error('Archivo no encontrado');
    }

    return fs.readFileSync(fullPath);
  }

  /**
   * Obtiene información de un archivo
   * @param filePath Ruta relativa del archivo
   * @returns Información del archivo (tamaño, fecha de creación, etc.)
   */
  async getFileInfo(filePath: string): Promise<{
    size: number;
    createdAt: Date;
    modifiedAt: Date;
  }> {
    const fullPath = path.join(this.uploadDir, filePath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error('Archivo no encontrado');
    }

    const stats = fs.statSync(fullPath);

    return {
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime
    };
  }

  /**
   * Lista todos los archivos de un expediente
   * @param numeroExpediente Número del expediente
   * @returns Array de nombres de archivos
   */
  async listExpedienteFiles(numeroExpediente: string): Promise<string[]> {
    const expedienteDir = path.join(this.uploadDir, 'expedientes', numeroExpediente);
    
    if (!fs.existsSync(expedienteDir)) {
      return [];
    }

    return fs.readdirSync(expedienteDir);
  }

  /**
   * Guarda un documento adjunto de SIAF (especificación técnica, cotización, etc.)
   * @param fileBuffer Buffer del archivo
   * @param siafId ID de la solicitud SIAF
   * @param nombreOriginal Nombre original del archivo
   * @returns Objeto con la ruta del archivo, hash y tamaño
   */
  async saveSiafAdjunto(
    fileBuffer: Buffer,
    siafId: number,
    nombreOriginal: string
  ): Promise<{
    filePath: string;
    hash: string;
    size: number;
  }> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const dir = path.join(this.uploadDir, 'siaf-adjuntos', String(year), month);
    this.ensureDirectoryExists(dir);

    const ext = path.extname(nombreOriginal) || '';
    const baseName = path.basename(nombreOriginal, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    const uniqueName = `siaf-${siafId}-${Date.now()}-${baseName}${ext}`;
    const fullPath = path.join(dir, uniqueName);

    fs.writeFileSync(fullPath, fileBuffer);
    const hash = this.generateHash(fileBuffer);
    const relativePath = path.join('siaf-adjuntos', String(year), month, uniqueName);

    return {
      filePath: relativePath,
      hash,
      size: fileBuffer.length,
    };
  }

  /**
   * Lee un archivo por ruta relativa (adjuntos SIAF, etc.)
   */
  async readFileByRelativePath(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.uploadDir, filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error('Archivo no encontrado');
    }
    return fs.readFileSync(fullPath);
  }

  /**
   * Elimina un archivo adjunto de SIAF por ruta relativa
   */
  async deleteSiafAdjunto(filePath: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  /**
   * Elimina un documento de expediente por ruta relativa
   */
  async deleteExpedienteDocument(filePath: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
}

// Exportar instancia singleton
export const fileStorageService = new FileStorageService();
