import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Puesto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nombre: string;

  @Column({ default: true })
  activo: boolean;
}
