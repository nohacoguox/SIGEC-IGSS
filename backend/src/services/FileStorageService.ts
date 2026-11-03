import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export class FileStorageService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(__dirname, '../../uploads');
    this.ensureDirectoryExists(this.uploadDir);
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private generateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Convierte un identificador en nombre de archivo seguro.
   * El correlativo usa formato "número/año", y la barra se interpretaría como subdirectorio.
   */
  private sanitizeFileName(valor: string): string {
    const limpio = String(valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return limpio || 'sin-correlativo';
  }

  /**
   * Normaliza rutas relativas guardadas en Windows (\) para que funcionen en Linux.
   */
  private normalizeRelativePath(filePath: string): string {
    return String(filePath || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');
  }

  private resolveUploadPath(filePath: string): string {
    return path.join(this.uploadDir, this.normalizeRelativePath(filePath));
  }

  /** Guarda PDF SIAF en uploads/siaf/AAAA/MM/ */
  async saveSiafPdf(pdfBuffer: Buffer, correlativo: string): Promise<{
    filePath: string;
    hash: string;
    size: number;
  }> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    const siafDir = path.join(this.uploadDir, 'siaf', String(year), month);
    this.ensureDirectoryExists(siafDir);

    const fileName = `SIAF-${this.sanitizeFileName(correlativo)}.pdf`;
    const fullPath = path.join(siafDir, fileName);

    fs.writeFileSync(fullPath, pdfBuffer);
    const hash = this.generateHash(pdfBuffer);
    const relativePath = path.join('siaf', String(year), month, fileName);

    return {
      filePath: relativePath,
      hash: hash,
      size: pdfBuffer.length
    };
  }

  async readSiafPdf(filePath: string): Promise<Buffer> {
    const fullPath = this.resolveUploadPath(filePath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error('Archivo no encontrado');
    }

    return fs.readFileSync(fullPath);
  }

  async verifyFileIntegrity(filePath: string, expectedHash: string): Promise<boolean> {
    try {
      const fileBuffer = await this.readSiafPdf(filePath);
      const actualHash = this.generateHash(fileBuffer);
      return actualHash === expectedHash;
    } catch (error) {
      return false;
    }
  }

  async deleteSiafPdf(filePath: string): Promise<void> {
    const fullPath = this.resolveUploadPath(filePath);
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  async saveExpedienteDocument(
    fileBuffer: Buffer, 
    numeroExpediente: string, 
    fileName: string
  ): Promise<{
    filePath: string;
    hash: string;
    size: number;
  }> {
    const carpetaExpediente = this.sanitizeFileName(numeroExpediente);
    const expedienteDir = path.join(this.uploadDir, 'expedientes', carpetaExpediente);
    this.ensureDirectoryExists(expedienteDir);

    const timestamp = Date.now();
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const uniqueFileName = `${baseName}-${timestamp}${ext}`;

    const fullPath = path.join(expedienteDir, uniqueFileName);
    fs.writeFileSync(fullPath, fileBuffer);
    const hash = this.generateHash(fileBuffer);
    const relativePath = path.join('expedientes', carpetaExpediente, uniqueFileName);

    return {
      filePath: relativePath,
      hash: hash,
      size: fileBuffer.length
    };
  }

  async readExpedienteDocument(filePath: string): Promise<Buffer> {
    const fullPath = this.resolveUploadPath(filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error('Archivo no encontrado');
    }

    return fs.readFileSync(fullPath);
  }

  async getFileInfo(filePath: string): Promise<{
    size: number;
    createdAt: Date;
    modifiedAt: Date;
  }> {
    const fullPath = this.resolveUploadPath(filePath);
    
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

  async listExpedienteFiles(numeroExpediente: string): Promise<string[]> {
    const expedienteDir = path.join(this.uploadDir, 'expedientes', this.sanitizeFileName(numeroExpediente));
    
    if (!fs.existsSync(expedienteDir)) {
      return [];
    }

    return fs.readdirSync(expedienteDir);
  }

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

  async readFileByRelativePath(filePath: string): Promise<Buffer> {
    const fullPath = this.resolveUploadPath(filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error('Archivo no encontrado');
    }
    return fs.readFileSync(fullPath);
  }

  async deleteSiafAdjunto(filePath: string): Promise<void> {
    const fullPath = this.resolveUploadPath(filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  async deleteExpedienteDocument(filePath: string): Promise<void> {
    const fullPath = this.resolveUploadPath(filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
}

export const fileStorageService = new FileStorageService();
