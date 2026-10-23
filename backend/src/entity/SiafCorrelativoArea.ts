import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

/** Un área solo puede pertenecer a un correlativo SIAF. */
@Entity('siaf_correlativo_areas')
@Index(['areaId'], { unique: true })
export class SiafCorrelativoArea {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'config_id', type: 'int' })
  configId: number;

  @Column({ name: 'area_id', type: 'int' })
  areaId: number;
}
