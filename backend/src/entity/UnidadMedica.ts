import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Municipio } from './Municipio';

@Entity()
export class UnidadMedica {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nombre: string;

  /** Departamento (texto). Se mantiene por compatibilidad; si existe municipio, se puede derivar de municipio.departamento. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  departamento: string | null;

  @ManyToOne(() => Municipio, { nullable: true, eager: true })
  @JoinColumn({ name: 'municipio_id' })
  municipio: Municipio | null;

  @Column({ nullable: true }) // Puede que no todas tengan teléfono
  telefonos: string; // Almacenar como string para manejar múltiples números o formatos
}
