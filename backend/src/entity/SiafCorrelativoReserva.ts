import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from './User';

export type CorrelativoReservaEstado = 'reservado' | 'consumido' | 'liberado';

/**
 * Reserva temporal de un correlativo mientras el usuario llena el formulario SIAF.
 * Si cancela o expira, se libera para el siguiente solicitante.
 */
@Entity('siaf_correlativo_reservas')
@Index(['estado', 'numero'])
export class SiafCorrelativoReserva {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  numero: number;

  /** Valor formateado que se guarda en siaf_solicitudes.correlativo */
  @Column({ type: 'varchar', length: 50 })
  correlativo: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;

  @Column({ name: 'usuario_id' })
  usuarioId: number;

  @Column({ type: 'varchar', length: 20, default: 'reservado' })
  estado: CorrelativoReservaEstado;

  /** Token de reserva (compatibilidad con columna NOT NULL heredada) */
  @Column({ type: 'varchar', length: 64, nullable: true })
  token: string | null;

  @CreateDateColumn({ name: 'reservado_en' })
  reservadoEn: Date;

  @Column({ name: 'expira_en', type: 'timestamptz' })
  expiraEn: Date;

  @Column({ name: 'liberado_en', type: 'timestamptz', nullable: true })
  liberadoEn: Date | null;

  @Column({ name: 'consumido_en', type: 'timestamptz', nullable: true })
  consumidoEn: Date | null;
}
