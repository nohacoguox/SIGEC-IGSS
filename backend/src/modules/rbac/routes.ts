import { Request, Response, Router } from 'express';
import { In } from 'typeorm';
import { AppDataSource } from '../../data-source';
import { Role } from '../../entity/Role';
import { Permission } from '../../entity/Permission';
import { APP_SCREENS } from '../../config/appScreens';
import { verifyToken, authorizeRoles } from '../../middleware/auth';

export const rbacRouter = Router();

// Roles (solo super administrador)
rbacRouter.get('/roles', verifyToken, authorizeRoles(['super administrador', 'gestionar-roles']), async (req: Request, res: Response) => {
  try {
    const roleRepository = AppDataSource.getRepository(Role);
    const roles = await roleRepository.find({ relations: ['permissions'] });
    res.json(roles);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching roles' });
  }
});

rbacRouter.post('/roles', verifyToken, authorizeRoles(['super administrador', 'gestionar-roles']), async (req: Request, res: Response) => {
  try {
    const { name, permissionIds } = req.body;
    const roleRepository = AppDataSource.getRepository(Role);
    const permissionRepository = AppDataSource.getRepository(Permission);
    const permissions = permissionIds?.length
      ? await permissionRepository.find({ where: { id: In(permissionIds) } })
      : [];
    const newRole = roleRepository.create({ name, permissions });
    await roleRepository.save(newRole);
    res.status(201).json(newRole);
  } catch (err) {
    res.status(500).json({ message: 'Error creating role' });
  }
});

rbacRouter.put('/roles/:id', verifyToken, authorizeRoles(['super administrador', 'gestionar-roles']), async (req: Request, res: Response) => {
  try {
    const { name, permissionIds } = req.body;
    const roleId = parseInt(req.params.id);
    const roleRepository = AppDataSource.getRepository(Role);
    const permissionRepository = AppDataSource.getRepository(Permission);
    const role = await roleRepository.findOne({ where: { id: roleId }, relations: ['permissions'] });
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    role.name = name ?? role.name;
    if (permissionIds != null) {
      role.permissions = permissionIds.length
        ? await permissionRepository.find({ where: { id: In(permissionIds) } })
        : [];
    }
    await roleRepository.save(role);
    res.json(role);
  } catch (err) {
    res.status(500).json({ message: 'Error updating role' });
  }
});

rbacRouter.delete('/roles/:id', verifyToken, authorizeRoles(['super administrador', 'gestionar-roles']), async (req: Request, res: Response) => {
  try {
    const roleId = parseInt(req.params.id);
    const roleRepository = AppDataSource.getRepository(Role);
    const role = await roleRepository.findOne({ where: { id: roleId } });
    if (!role) return res.status(404).json({ message: 'Rol no encontrado' });
    await roleRepository.remove(role);
    res.status(204).send();
  } catch (err) {
    console.error('Error al eliminar rol:', err);
    res.status(500).json({ message: 'Error al eliminar el rol' });
  }
});

// Permissions (solo super administrador)
rbacRouter.get('/permissions', verifyToken, authorizeRoles(['super administrador', 'gestionar-roles']), async (req: Request, res: Response) => {
  try {
    const permissionRepository = AppDataSource.getRepository(Permission);
    const permissions = await permissionRepository.find();
    res.json(permissions);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching permissions' });
  }
});

// Catálogo de pantallas disponibles para vincular roles
rbacRouter.get('/app-screens', verifyToken, authorizeRoles(['super administrador', 'gestionar-roles']), async (req: Request, res: Response) => {
  try {
    const permissionRepository = AppDataSource.getRepository(Permission);
    const permissions = await permissionRepository.find();
    const screens = APP_SCREENS.map((screen) => {
      const perm = permissions.find((p) => p.name === screen.permission);
      return {
        ...screen,
        permissionId: perm?.id ?? null,
        registered: !!perm,
      };
    });
    res.json({
      total: screens.length,
      admin: screens.filter((s) => s.panel === 'admin'),
      colaborador: screens.filter((s) => s.panel === 'colaborador'),
      screens,
    });
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener catálogo de pantallas' });
  }
});
