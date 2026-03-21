import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Departamento } from './Departamento';

@Entity('municipios')
export class Municipio {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @ManyToOne(() => Departamento, (d) => d.municipios, { eager: true })
  @JoinColumn({ name: 'departamento_id' })
  departamento: Departamento;
}
