
// Roles and Permissions Endpoints
app.get('/api/roles', verifyToken, authorizeRoles(['super administrador']), async (req: Request, res: Response) => {
  try {
    const roleRepository = AppDataSource.getRepository(Role);
    const roles = await roleRepository.find({ relations: ['permissions'] });
    res.json(roles);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching roles' });
  }
});

app.post('/api/roles', verifyToken, authorizeRoles(['super administrador']), async (req: Request, res: Response) => {
  try {
    const { name, permissionIds } = req.body;
    const roleRepository = AppDataSource.getRepository(Role);
    const permissionRepository = AppDataSource.getRepository(Permission);

    const permissions = await permissionRepository.findByIds(permissionIds);
    
    const newRole = roleRepository.create({ name, permissions });
    await roleRepository.save(newRole);
    
    res.status(201).json(newRole);
  } catch (err) {
    res.status(500).json({ message: 'Error creating role' });
  }
});

app.put('/api/roles/:id', verifyToken, authorizeRoles(['super administrador']), async (req: Request, res: Response) => {
  try {
    const { name, permissionIds } = req.body;
    const roleId = parseInt(req.params.id);
    const roleRepository = AppDataSource.getRepository(Role);
    const permissionRepository = AppDataSource.getRepository(Permission);

    const role = await roleRepository.findOneBy({ id: roleId });
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    const permissions = await permissionRepository.findByIds(permissionIds);
    
    role.name = name;
    role.permissions = permissions;
    await roleRepository.save(role);
    
    res.json(role);
  } catch (err) {
    res.status(500).json({ message: 'Error updating role' });
  }
});

app.get('/api/permissions', verifyToken, authorizeRoles(['super administrador']), async (req: Request, res: Response) => {
  try {
    const permissionRepository = AppDataSource.getRepository(Permission);
    const permissions = await permissionRepository.find();
    res.json(permissions);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching permissions' });
  }
});
