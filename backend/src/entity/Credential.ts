import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { User } from './User';

@Entity()
export class Credential {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  codigoEmpleado: string; // Este será el nombre de usuario para el login

  @Column()
  password: string; // Contraseña hasheada

  @Column({ default: true })
  isTempPassword: boolean; // Para forzar el cambio de contraseña al primer login

  @OneToOne(() => User, user => user.id, { onDelete: 'CASCADE', eager: true }) // Relación OneToOne con User
  @JoinColumn({ name: 'userId' }) // Columna FK en esta tabla que referencia a User
  user: User;

  @Column()
  userId: number; // Columna para almacenar el ID del usuario
}
