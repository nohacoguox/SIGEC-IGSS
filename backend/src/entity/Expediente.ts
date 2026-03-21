import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { User } from './User';

@Entity('expedientes')
export class Expediente {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  numeroExpediente: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;

  @Column({ name: 'usuario_id' })
  usuarioId: number;

  @Column({ type: 'varchar', length: 100 })
  tipoExpediente: string; // 'Compras', 'Recursos Humanos', 'Legal', etc.

  @Column({ type: 'varchar', length: 200 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ type: 'varchar', length: 20, default: 'abierto' })
  estado: string; // abierto, en_proceso, cerrado, archivado

  @Column({ type: 'date' })
  fechaApertura: Date;

  @Column({ type: 'date', nullable: true })
  fechaCierre: Date;

  /** Unidad médica del creador (ej. "Consultorio de Palín, Escuintla") para filtro por departamento/municipio. */
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'unidad_origen' })
  unidadOrigen: string | null;

  /** Origen legible para el analista DAF (ej. "Palín, Escuintla"). */
  @Column({ type: 'varchar', length: 150, nullable: true, name: 'municipio_origen' })
  municipioOrigen: string | null;

  @Column({ type: 'text', nullable: true, name: 'comentario_rechazo' })
  comentarioRechazo: string | null;

  @OneToMany(() => ExpedienteDocumento, documento => documento.expediente, { cascade: true })
  documentos: ExpedienteDocumento[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('expediente_documentos')
export class ExpedienteDocumento {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Expediente, expediente => expediente.documentos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expediente_id' })
  expediente: Expediente;

  @Column({ name: 'expediente_id' })
  expedienteId: number;

  @Column({ type: 'varchar', length: 100 })
  tipoDocumento: string; // 'SIAF', 'Factura', 'Contrato', 'Orden de Compra', etc.

  @Column({ type: 'varchar', length: 255 })
  nombreArchivo: string;

  @Column({ type: 'varchar', length: 500 })
  rutaArchivo: string;

  @Column({ type: 'varchar', length: 100 })
  mimeType: string; // application/pdf, image/jpeg, etc.

  @Column({ type: 'bigint' })
  tamanioBytes: number;

  @Column({ type: 'varchar', length: 64 })
  hashArchivo: string; // SHA-256 para verificar integridad

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'subido_por' })
  subidoPor: User;

  @Column({ name: 'subido_por' })
  subidoPorId: number;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @CreateDateColumn({ name: 'fecha_subida' })
  fechaSubida: Date;
}

/** Bitácora del expediente: cada rechazo o aprobación es un registro (resumen + detalle por documento). */
@Entity('expediente_bitacora')
export class ExpedienteBitacora {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Expediente, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expediente_id' })
  expediente: Expediente;

  @Column({ name: 'expediente_id' })
  expedienteId: number;

  @Column({ type: 'varchar', length: 20 }) // 'rechazo' | 'aprobacion' | 'correccion'
  tipo: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha: Date;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;

  @Column({ name: 'usuario_id' })
  usuarioId: number;

  /** Comentario general / resumen (ej. motivo global del rechazo). */
  @Column({ type: 'text', nullable: true })
  comentario: string | null;

  /** Para tipo 'correccion': ID del documento (actual) que fue reemplazado. */
  @Column({ type: 'int', nullable: true, name: 'expediente_documento_id' })
  expedienteDocumentoId: number | null;

  /** Para tipo 'correccion': ID de la versión que quedó como respaldo (el documento reemplazado). */
  @Column({ type: 'int', nullable: true, name: 'expediente_documento_version_id' })
  expedienteDocumentoVersionId: number | null;

  @OneToMany(() => ExpedienteBitacoraDetalle, (d) => d.bitacora, { cascade: true })
  detalle: ExpedienteBitacoraDetalle[];
}

/** Motivo de rechazo (o anotación) por documento concreto dentro de un rechazo. */
@Entity('expediente_bitacora_detalle')
export class ExpedienteBitacoraDetalle {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ExpedienteBitacora, (b) => b.detalle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bitacora_id' })
  bitacora: ExpedienteBitacora;

  @Column({ name: 'bitacora_id' })
  bitacoraId: number;

  @ManyToOne(() => ExpedienteDocumento, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expediente_documento_id' })
  expedienteDocumento: ExpedienteDocumento;

  @Column({ name: 'expediente_documento_id' })
  expedienteDocumentoId: number;

  /** Nombre del documento al momento del rechazo (respaldo por si se reemplaza después). */
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'nombre_documento' })
  nombreDocumento: string | null;

  @Column({ type: 'text' })
  comentario: string;

  /** Página del documento donde el analista señaló el error (clic derecho). */
  @Column({ type: 'int', nullable: true, name: 'pagina' })
  pagina: number | null;

  /** Posición X en % del visor (0-100) donde se hizo clic derecho. */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'x_percent' })
  xPercent: number | null;

  /** Posición Y en % del visor (0-100) donde se hizo clic derecho. */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'y_percent' })
  yPercent: number | null;
}

/** Versión de un documento del expediente (respaldo de cada subida o reemplazo). */
@Entity('expediente_documento_versiones')
export class ExpedienteDocumentoVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ExpedienteDocumento, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expediente_documento_id' })
  expedienteDocumento: ExpedienteDocumento;

  @Column({ name: 'expediente_documento_id' })
  expedienteDocumentoId: number;

  @Column({ type: 'int', default: 1 })
  numeroVersion: number;

  @Column({ type: 'varchar', length: 255 })
  nombreArchivo: string;

  @Column({ type: 'varchar', length: 500 })
  rutaArchivo: string;

  @Column({ type: 'varchar', length: 64 })
  hashArchivo: string;

  @Column({ type: 'bigint' })
  tamanioBytes: number;

  @Column({ type: 'varchar', length: 100 })
  mimeType: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'subido_por' })
  subidoPor: User;

  @Column({ name: 'subido_por' })
  subidoPorId: number;

  @CreateDateColumn({ name: 'fecha_subida' })
  fechaSubida: Date;
}
