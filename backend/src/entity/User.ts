import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, ManyToOne, ManyToMany, JoinTable } from 'typeorm';
import { Credential } from './Credential';
import { Role } from './Role';
import { Puesto } from './Puesto';
import { Departamento } from './Departamento';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombres: string;

  @Column()
  apellidos: string;

  @Column({ unique: true })
  dpi: string;

  @Column({ unique: true })
  nit: string;

  @Column()
  telefono: string;

  @Column({ unique: true })
  correoInstitucional: string;

  @Column({ unique: true })
  codigoEmpleado: string;

  @Column()
  renglon: string;

  @ManyToOne(() => Puesto, { eager: true, nullable: true })
  @JoinColumn({ name: 'puestoId' })
  puesto: Puesto | null;

  @Column()
  unidadMedica: string;

  /** Departamento asignado para rol Dirección Departamental. Prioridad sobre departamentoDireccion (texto) si está seteo. */
  @ManyToOne(() => Departamento, { nullable: true, eager: true })
  @JoinColumn({ name: 'departamento_direccion_id' })
  departamentoDireccionEntidad: Departamento | null;

  /** Departamento (texto). Compatibilidad y fallback cuando no hay departamento_direccion_id. */
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'departamento_direccion' })
  departamentoDireccion: string | null;

  @ManyToMany(() => Role, (role) => role.users, { eager: true })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'userId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'roleId', referencedColumnName: 'id' },
  })
  roles: Role[];

  @OneToOne(() => Credential, (credential) => credential.user)
  credentials: Credential;
}
