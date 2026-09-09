import { Request, Response, Router } from 'express';
import { In } from 'typeorm';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../../data-source';
import { User } from '../../entity/User';
import { Credential } from '../../entity/Credential';
import { Puesto } from '../../entity/Puesto';
import { Role } from '../../entity/Role';
import { verifyToken, authorizeRoles } from '../../middleware/auth';

// El router se monta en /api/users. Solo super administrador o gestionar-usuarios,
// salvo las consultas de director y personal médico que usa el formulario SIAF.
export const usuariosRouter = Router();

usuariosRouter.get('/', verifyToken, authorizeRoles(['super administrador', 'gestionar-usuarios']), async (req: Request, res: Response) => {
  try {
    const userRepository = AppDataSource.getRepository(User);
    const users = await userRepository.find({
      relations: ['puesto', 'roles', 'roles.permissions'],
      order: { nombres: 'ASC' }
    });
    res.json(users);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

// Restablecer contraseña de un usuario (debe ir antes de GET /:id)
usuariosRouter.post('/:id/reset-password', verifyToken, authorizeRoles(['super administrador', 'gestionar-usuarios']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'ID de usuario inválido.' });
    const userRepository = AppDataSource.getRepository(User);
    const credentialRepository = AppDataSource.getRepository(Credential);
    const user = await userRepository.findOne({ where: { id } });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    let credential = await credentialRepository.findOne({ where: { userId: id } });
    const newPassword = '123';
    const hashed = await bcrypt.hash(newPassword, 10);
    if (credential) {
      credential.password = hashed;
      credential.isTempPassword = true;
      await credentialRepository.save(credential);
    } else {
      credential = credentialRepository.create({
        codigoEmpleado: user.codigoEmpleado || `user-${id}`,
        password: hashed,
        userId: id,
        isTempPassword: true,
      });
      await credentialRepository.save(credential);
    }
    res.json({ message: 'Contraseña restablecida correctamente. La nueva contraseña es: 123' });
  } catch (err: any) {
    console.error('Error al restablecer contraseña:', err);
    res.status(500).json({ message: err?.message || 'Error al restablecer la contraseña.' });
  }
});

usuariosRouter.get('/:id', verifyToken, authorizeRoles(['super administrador', 'gestionar-usuarios']), async (req: Request, res: Response) => {
  try {
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: parseInt(req.params.id) },
      relations: ['puesto', 'roles', 'roles.permissions']
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ message: 'Error al obtener usuario' });
  }
});

// Roles de un usuario (para Gestión de Roles: asignar varios roles a un colaborador)
usuariosRouter.get('/:id/roles', verifyToken, authorizeRoles(['super administrador', 'gestionar-roles']), async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json({ roles: user.roles ?? [] });
  } catch (error) {
    console.error('Error al obtener roles del usuario:', error);
    res.status(500).json({ message: 'Error al obtener roles del usuario' });
  }
});

usuariosRouter.put('/:id/roles', verifyToken, authorizeRoles(['super administrador', 'gestionar-roles', 'gestionar-usuarios']), async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { roleIds } = req.body as { roleIds: number[] };
    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);
    const user = await userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    const roles = Array.isArray(roleIds) && roleIds.length > 0
      ? await roleRepository.find({ where: { id: In(roleIds) } })
      : [];
    user.roles = roles;
    await userRepository.save(user);
    res.json({ roles: user.roles });
  } catch (error) {
    console.error('Error al actualizar roles del usuario:', error);
    res.status(500).json({ message: 'Error al actualizar roles del usuario' });
  }
});

usuariosRouter.post('/', verifyToken, authorizeRoles(['super administrador', 'gestionar-usuarios']), async (req: Request, res: Response) => {
  try {
    const { nombres, apellidos, dpi, nit, telefono, correoInstitucional, codigoEmpleado, renglon, puestoId, unidadMedica, departamentoDireccion } = req.body;
    const userRepository = AppDataSource.getRepository(User);
    const credentialRepository = AppDataSource.getRepository(Credential);
    const puestoRepository = AppDataSource.getRepository(Puesto);
    if (!puestoId) return res.status(400).json({ message: 'Puesto es requerido' });
    const puesto = await puestoRepository.findOneBy({ id: puestoId });
    if (!puesto) return res.status(400).json({ message: 'Puesto no encontrado' });
    const hashed = await bcrypt.hash('TempPass123!', 10);
    const user = userRepository.create({
      nombres,
      apellidos,
      dpi,
      nit,
      telefono,
      correoInstitucional,
      codigoEmpleado,
      renglon,
      puesto,
      unidadMedica,
      departamentoDireccion: departamentoDireccion === '' || departamentoDireccion == null ? null : String(departamentoDireccion),
      roles: [],
    });
    const savedUser = await userRepository.save(user);
    const cred = credentialRepository.create({
      codigoEmpleado,
      password: hashed,
      userId: savedUser.id,
      isTempPassword: true,
    });
    await credentialRepository.save(cred);
    res.status(201).json(savedUser);
  } catch (error: any) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ message: error?.message || 'Error al crear usuario' });
  }
});

usuariosRouter.put('/:id', verifyToken, authorizeRoles(['super administrador', 'gestionar-usuarios']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { nombres, apellidos, dpi, nit, telefono, correoInstitucional, codigoEmpleado, renglon, puestoId, unidadMedica, departamentoDireccion } = req.body;
    const userRepository = AppDataSource.getRepository(User);
    const puestoRepository = AppDataSource.getRepository(Puesto);
    const user = await userRepository.findOne({ where: { id }, relations: ['puesto', 'roles'] });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (nombres != null) user.nombres = nombres;
    if (apellidos != null) user.apellidos = apellidos;
    if (dpi != null) user.dpi = dpi;
    if (nit != null) user.nit = nit;
    if (telefono != null) user.telefono = telefono;
    if (correoInstitucional != null) user.correoInstitucional = correoInstitucional;
    if (codigoEmpleado != null) user.codigoEmpleado = codigoEmpleado;
    if (renglon != null) user.renglon = renglon;
    if (unidadMedica != null) user.unidadMedica = unidadMedica;
    if (departamentoDireccion !== undefined) user.departamentoDireccion = departamentoDireccion === '' || departamentoDireccion === null ? null : String(departamentoDireccion);
    if (puestoId != null) {
      const puesto = await puestoRepository.findOneBy({ id: puestoId });
      if (puesto) user.puesto = puesto;
    }
    await userRepository.save(user);
    res.json(user);
  } catch (error: any) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ message: error?.message || 'Error al actualizar usuario' });
  }
});

usuariosRouter.delete('/:id', verifyToken, authorizeRoles(['super administrador', 'gestionar-usuarios']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { id } });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    await userRepository.remove(user);
    res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ message: 'Error al eliminar usuario' });
  }
});

usuariosRouter.get('/director/:unidadMedica', verifyToken, async (req: Request, res: Response) => {
  try {
    const { unidadMedica } = req.params;
    const userRepository = AppDataSource.getRepository(User);

    const director = await userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.puesto', 'puesto')
      .where('user.unidadMedica = :unidadMedica', { unidadMedica })
      .andWhere('puesto.nombre ILIKE :puestoNombre', { puestoNombre: '%DIRECTOR%' })
      .getOne();

    if (!director) {
      return res.status(404).json({ message: `No se encontró un director para la unidad: ${unidadMedica}` });
    }

    res.json(director);
  } catch (error) {
    console.error('Error al buscar director:', error);
    res.status(500).json({ message: 'Error en el servidor al buscar director' });
  }
});

/** Personal de la misma unidad con puesto de médico/doctor (para Encargado del Despacho). */
usuariosRouter.get('/medicos-por-unidad/:unidadMedica', verifyToken, async (req: Request, res: Response) => {
  try {
    const unidadMedica = decodeURIComponent(req.params.unidadMedica || '').trim();
    if (!unidadMedica) {
      return res.status(400).json({ message: 'La unidad médica es requerida.' });
    }
    const userRepository = AppDataSource.getRepository(User);
    // lower() en PG a veces no convierte É→é; se normalizan mayúsculas/tildes aparte.
    const medicos = await userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.puesto', 'puesto')
      .where('TRIM(user.unidadMedica) = :unidadMedica', { unidadMedica })
      .andWhere(
        `lower(translate(coalesce(puesto.nombre, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) ~ :patron`,
        { patron: '(^|[^a-z])(medicos?|doctores?|doctora)([^a-z]|$)' }
      )
      .orderBy('user.apellidos', 'ASC')
      .addOrderBy('user.nombres', 'ASC')
      .getMany();
    res.json(medicos);
  } catch (error) {
    console.error('Error al listar médicos por unidad:', error);
    res.status(500).json({ message: 'Error en el servidor al listar personal médico.' });
  }
});
