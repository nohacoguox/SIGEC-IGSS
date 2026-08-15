import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Configuración independiente de la secuencia interna de expedientes. */
@Entity('expediente_correlativo_config')
export class ExpedienteCorrelativoConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'siguiente_numero', type: 'int', default: 1 })
  siguienteNumero: number;

  @Column({ name: 'numero_inicio', type: 'int', default: 1 })
  numeroInicio: number;

  @Column({ name: 'digitos', type: 'int', default: 4 })
  digitos: number;

  @Column({ name: 'anio_actual', type: 'int', default: 2026 })
  anioActual: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
