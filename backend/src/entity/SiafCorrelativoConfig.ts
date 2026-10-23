import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Configuración global de la secuencia de correlativos SIAF (una sola fila).
 */
@Entity('siaf_correlativo_config')
export class SiafCorrelativoConfig {
  @PrimaryGeneratedColumn()
  id: number;

  /** Nombre visible en Gestión de Correlativos. */
  @Column({ type: 'varchar', length: 120, default: 'General' })
  nombre: string;

  /** Letras opcionales. Vacío → 1/2026. */
  @Column({ type: 'varchar', length: 12, default: '' })
  prefijo: string;

  /** antes → BF 1/2026. despues → 14568 SC/2026. */
  @Column({ name: 'prefijo_posicion', type: 'varchar', length: 10, default: 'antes' })
  prefijoPosicion: string;

  /** Próximo número candidato a asignar (se ajusta al liberar reservas) */
  @Column({ name: 'siguiente_numero', type: 'int', default: 1 })
  siguienteNumero: number;

  /** Valor mínimo permitido al reasignar / piso administrativo */
  @Column({ name: 'numero_inicio', type: 'int', default: 1 })
  numeroInicio: number;

  /** Ceros a la izquierda (0 = sin padding). Ej: 4 → 0001 */
  @Column({ name: 'digitos', type: 'int', default: 0 })
  digitos: number;

  /** Minutos de vigencia de una reserva temporal */
  @Column({ name: 'minutos_reserva', type: 'int', default: 120 })
  minutosReserva: number;

  /** Año de la secuencia actual (si cambia el año, el número reinicia) */
  @Column({ name: 'anio_actual', type: 'int', default: 2026 })
  anioActual: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
