import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { User } from './User';
import { Area } from './Area';

@Entity('siaf_solicitudes')
export class SiafSolicitud {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  correlativo: string;

  @Column({ type: 'date' })
  fecha: Date;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'usuario_solicitante_id' })
  usuarioSolicitante: User;

  @Column({ type: 'varchar', length: 200 })
  nombreUnidad: string;

  @Column({ type: 'text', nullable: true })
  direccion: string;

  @ManyToOne(() => Area, { eager: true, nullable: true })
  @JoinColumn({ name: 'area_id' })
  area?: Area;

  @Column({ type: 'text' })
  justificacion: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  nombreSolicitante: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  puestoSolicitante: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  unidadSolicitante: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  nombreAutoridad: string;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'usuario_autoridad_id' })
  usuarioAutoridad?: User;

  /** Cuando el director está ausente, quien cubre como "Encargado/a del Despacho de Dirección". Solo puede autorizar esta solicitud. */
  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'usuario_encargado_id' })
  usuarioEncargado?: User;

  @Column({ type: 'varchar', length: 200, nullable: true })
  puestoAutoridad: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  unidadAutoridad: string;

  @Column({ type: 'text', nullable: true })
  consistenteItem: string;

  @Column({ type: 'varchar', length: 20, default: 'pendiente' })
  estado: string; // pendiente, autorizado, rechazado

  /** True cuando Dirección Departamental dio el OK final (para crear expediente). */
  @Column({ type: 'boolean', default: false, name: 'aprobado_direccion_departamental' })
  aprobadoDireccionDepartamental: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  pdfPath: string; // Ruta del PDF almacenado

  @Column({ type: 'varchar', length: 64, nullable: true })
  pdfHash: string; // SHA-256 para verificar integridad del archivo

  @Column({ type: 'bigint', nullable: true })
  pdfSize: number; // Tamaño del archivo en bytes

  @OneToMany(() => SiafItem, item => item.siaf, { cascade: true, eager: true })
  items: SiafItem[];

  @OneToMany(() => SiafSubproducto, subproducto => subproducto.siaf, { cascade: true, eager: true })
  subproductos: SiafSubproducto[];

  @OneToMany(() => SiafAutorizacion, autorizacion => autorizacion.siaf, { eager: true })
  autorizaciones: SiafAutorizacion[];

  @OneToMany(() => SiafBitacora, bitacora => bitacora.siaf, { cascade: true, eager: true })
  bitacora: SiafBitacora[];

  @OneToMany(() => SiafDocumentoAdjunto, adjunto => adjunto.siaf, { cascade: true, eager: true })
  documentosAdjuntos: SiafDocumentoAdjunto[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('siaf_items')
export class SiafItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SiafSolicitud, siaf => siaf.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'siaf_id' })
  siaf: SiafSolicitud;

  @Column({ type: 'varchar', length: 50 })
  codigo: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ type: 'int', default: 0 })
  orden: number; // Para mantener el orden de los items
}

@Entity('siaf_subproductos')
export class SiafSubproducto {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SiafSolicitud, siaf => siaf.subproductos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'siaf_id' })
  siaf: SiafSolicitud;

  @Column({ type: 'varchar', length: 50 })
  codigo: string;

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ type: 'int', default: 0 })
  orden: number;
}

@Entity('siaf_autorizaciones')
export class SiafAutorizacion {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SiafSolicitud, siaf => siaf.autorizaciones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'siaf_id' })
  siaf: SiafSolicitud;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'usuario_autorizador_id' })
  usuarioAutorizador: User;

  @Column({ type: 'varchar', length: 20 })
  accion: string; // 'autorizado' o 'rechazado'

  @Column({ type: 'text', nullable: true })
  comentario: string;

  /** Categoría del motivo de rechazo (solo cuando accion === 'rechazado'). Se mantiene por compatibilidad; ver motivosRechazo. */
  @Column({ type: 'varchar', length: 80, nullable: true, name: 'motivo_rechazo' })
  motivoRechazo: string | null;

  /** Todas las categorías del rechazo (JSON array de strings), para que cada una cuente en estadísticas. Ej: ["falta_documento","ortografia"] */
  @Column({ type: 'text', nullable: true, name: 'motivos_rechazo' })
  motivosRechazo: string | null;

  @CreateDateColumn({ name: 'fecha_autorizacion' })
  fechaAutorizacion: Date;
}

/** Bitácora: registro de rechazos (motivo) y correcciones del solicitante para trazabilidad. */
@Entity('siaf_bitacora')
export class SiafBitacora {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SiafSolicitud, siaf => siaf.bitacora, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'siaf_id' })
  siaf: SiafSolicitud;

  @Column({ type: 'varchar', length: 20 })
  tipo: string; // 'rechazo' | 'correccion' | 'autorizado'

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;

  @Column({ type: 'text', nullable: true })
  comentario: string;

  /** Para tipo 'correccion': lo que tenía antes (texto que el solicitante indica). */
  @Column({ type: 'text', nullable: true, name: 'detalle_antes' })
  detalleAntes: string;

  /** Para tipo 'correccion': lo que corrigió / valor nuevo. */
  @Column({ type: 'text', nullable: true, name: 'detalle_despues' })
  detalleDespues: string;

  @CreateDateColumn({ name: 'fecha' })
  fecha: Date;
}

@Entity('siaf_documentos_adjuntos')
export class SiafDocumentoAdjunto {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SiafSolicitud, siaf => siaf.documentosAdjuntos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'siaf_id' })
  siaf: SiafSolicitud;

  @Column({ name: 'siaf_id' })
  siafId: number;

  @Column({ type: 'varchar', length: 255 })
  nombreOriginal: string;

  @Column({ type: 'varchar', length: 500 })
  rutaArchivo: string;

  @Column({ type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ type: 'bigint' })
  tamanioBytes: number;

  @Column({ type: 'varchar', length: 64 })
  hashArchivo: string;

  @CreateDateColumn({ name: 'fecha_subida' })
  fechaSubida: Date;
}
