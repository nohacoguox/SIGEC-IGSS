import { Request, Response, Router } from 'express';
import { AppDataSource } from '../../data-source';
import { Puesto } from '../../entity/Puesto';
import { Departamento } from '../../entity/Departamento';
import { Municipio } from '../../entity/Municipio';
import { UnidadMedica } from '../../entity/UnidadMedica';
import { Area } from '../../entity/Area';
import { User } from '../../entity/User';
import { verifyToken, authorizeRoles, authorizeRolesOrPermissions } from '../../middleware/auth';

export const catalogosRouter = Router();

// Puestos: GET lista (para dropdown en Gestión de Usuarios) permite también gestionar-usuarios; resto solo super admin o gestionar-puestos
catalogosRouter.get('/puestos', verifyToken, authorizeRoles(['super administrador', 'gestionar-puestos', 'gestionar-usuarios']), async (req: Request, res: Response) => {
  try {
    const puestoRepository = AppDataSource.getRepository(Puesto);
    const puestos = await puestoRepository.find({ order: { nombre: 'ASC' } });
    res.json(puestos);
  } catch (error) {
    console.error('Error al obtener puestos:', error);
    res.status(500).json({ message: 'Error al obtener puestos' });
  }
});

catalogosRouter.get('/puestos/all', verifyToken, authorizeRoles(['super administrador', 'gestionar-puestos']), async (req: Request, res: Response) => {
  try {
    const puestoRepository = AppDataSource.getRepository(Puesto);
    const puestos = await puestoRepository.find({ order: { nombre: 'ASC' } });
    res.json(puestos);
  } catch (error) {
    console.error('Error al obtener puestos:', error);
    res.status(500).json({ message: 'Error al obtener puestos' });
  }
});

catalogosRouter.post('/puestos', verifyToken, authorizeRoles(['super administrador', 'gestionar-puestos']), async (req: Request, res: Response) => {
  try {
    const { nombre, activo } = req.body;
    const puestoRepository = AppDataSource.getRepository(Puesto);
    const puesto = puestoRepository.create({ nombre, activo: activo !== false });
    await puestoRepository.save(puesto);
    res.status(201).json(puesto);
  } catch (error) {
    console.error('Error al crear puesto:', error);
    res.status(500).json({ message: 'Error al crear puesto' });
  }
});

catalogosRouter.put('/puestos/:id', verifyToken, authorizeRoles(['super administrador', 'gestionar-puestos']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { nombre, activo } = req.body;
    const puestoRepository = AppDataSource.getRepository(Puesto);
    const puesto = await puestoRepository.findOneBy({ id });
    if (!puesto) return res.status(404).json({ message: 'Puesto no encontrado' });
    if (nombre != null) puesto.nombre = nombre;
    if (activo != null) puesto.activo = activo;
    await puestoRepository.save(puesto);
    res.json(puesto);
  } catch (error) {
    console.error('Error al actualizar puesto:', error);
    res.status(500).json({ message: 'Error al actualizar puesto' });
  }
});

catalogosRouter.delete('/puestos/:id', verifyToken, authorizeRoles(['super administrador', 'gestionar-puestos']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const puestoRepository = AppDataSource.getRepository(Puesto);
    const puesto = await puestoRepository.findOneBy({ id });
    if (!puesto) return res.status(404).json({ message: 'Puesto no encontrado' });
    await puestoRepository.remove(puesto);
    res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar puesto:', error);
    res.status(500).json({ message: 'Error al eliminar puesto' });
  }
});

// Departamentos (para asociar a unidades médicas y usuarios DD)
catalogosRouter.get('/departamentos', verifyToken, async (req: Request, res: Response) => {
  try {
    const repo = AppDataSource.getRepository(Departamento);
    const list = await repo.find({ order: { nombre: 'ASC' } });
    res.json(list);
  } catch (error) {
    console.error('Error al obtener departamentos:', error);
    res.status(500).json({ message: 'Error al obtener departamentos' });
  }
});

// Municipios (opcional: ?departamentoId= para filtrar por departamento)
catalogosRouter.get('/municipios', verifyToken, async (req: Request, res: Response) => {
  try {
    const repo = AppDataSource.getRepository(Municipio);
    const departamentoId = req.query.departamentoId ? parseInt(String(req.query.departamentoId)) : undefined;
    if (departamentoId && !isNaN(departamentoId)) {
      const list = await repo.find({
        where: { departamento: { id: departamentoId } },
        order: { nombre: 'ASC' },
        relations: ['departamento'],
      });
      return res.json(list);
    }
    const list = await repo.find({ order: { nombre: 'ASC' }, relations: ['departamento'] });
    res.json(list);
  } catch (error) {
    console.error('Error al obtener municipios:', error);
    res.status(500).json({ message: 'Error al obtener municipios' });
  }
});

// Unidades médicas (incluye municipio y departamento para mostrar/asignar)
catalogosRouter.get('/unidades-medicas', verifyToken, async (req: Request, res: Response) => {
  try {
    const unidadMedicaRepository = AppDataSource.getRepository(UnidadMedica);
    const unidades = await unidadMedicaRepository.find({
      order: { nombre: 'ASC' },
      relations: ['municipio', 'municipio.departamento'],
    });
    res.json(unidades);
  } catch (error) {
    console.error('Error al obtener unidades médicas:', error);
    res.status(500).json({ message: 'Error al obtener unidades médicas' });
  }
});

const applyUnidadMedicaFields = async (
  unidad: UnidadMedica,
  body: any,
  opts: { requireNombre?: boolean } = {}
): Promise<string | null> => {
  const { municipioId, nombre, telefonos, codigo, direccion } = body ?? {};

  if (nombre !== undefined || opts.requireNombre) {
    const nom = typeof nombre === 'string' ? nombre.trim() : '';
    if (!nom) return 'El nombre de la unidad médica es obligatorio.';
    if (nom.length > 200) return 'El nombre no puede superar 200 caracteres.';
    unidad.nombre = nom;
  }

  if (codigo !== undefined) {
    const cod = typeof codigo === 'string' ? codigo.trim() : codigo == null ? '' : String(codigo).trim();
    unidad.codigo = cod || null;
  }

  if (direccion !== undefined) {
    const dir = typeof direccion === 'string' ? direccion.trim() : direccion == null ? '' : String(direccion).trim();
    unidad.direccion = dir || null;
  }

  if (telefonos !== undefined) {
    unidad.telefonos = telefonos == null ? '' : String(telefonos);
  }

  if (municipioId !== undefined) {
    if (municipioId == null || municipioId === '') {
      unidad.municipio = null;
      unidad.departamento = null;
    } else {
      const muniRepo = AppDataSource.getRepository(Municipio);
      const municipio = await muniRepo.findOne({
        where: { id: Number(municipioId) },
        relations: ['departamento'],
      });
      if (!municipio) return 'Municipio no encontrado';
      unidad.municipio = municipio;
      unidad.departamento = municipio.departamento?.nombre ?? null;
    }
  }

  return null;
};

// Crear unidad médica
catalogosRouter.post(
  '/unidades-medicas',
  verifyToken,
  authorizeRolesOrPermissions(['super administrador', 'gestionar-areas'], ['gestionar-unidades-medicas']),
  async (req: Request, res: Response) => {
    try {
      const repo = AppDataSource.getRepository(UnidadMedica);
      const unidad = repo.create({
        nombre: '',
        codigo: null,
        direccion: null,
        departamento: null,
        municipio: null,
        telefonos: '',
      });
      const err = await applyUnidadMedicaFields(unidad, req.body, { requireNombre: true });
      if (err) return res.status(400).json({ message: err });

      const dupNombre = await repo.findOne({ where: { nombre: unidad.nombre } });
      if (dupNombre) return res.status(409).json({ message: 'Ya existe una unidad con ese nombre.' });
      if (unidad.codigo) {
        const dupCodigo = await repo.findOne({ where: { codigo: unidad.codigo } });
        if (dupCodigo) return res.status(409).json({ message: 'Ya existe una unidad con ese código de identificación.' });
      }

      const saved = await repo.save(unidad);
      const full = await repo.findOne({
        where: { id: saved.id },
        relations: ['municipio', 'municipio.departamento'],
      });
      res.status(201).json(full ?? saved);
    } catch (error: any) {
      console.error('Error al crear unidad médica:', error);
      if (error?.code === '23505') {
        return res.status(409).json({ message: 'Nombre o código de identificación duplicado.' });
      }
      res.status(500).json({ message: error?.message || 'Error al crear unidad médica' });
    }
  }
);

// Actualizar unidad médica
catalogosRouter.put(
  '/unidades-medicas/:id',
  verifyToken,
  authorizeRolesOrPermissions(['super administrador', 'gestionar-areas'], ['gestionar-unidades-medicas']),
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'ID inválido' });
      const repo = AppDataSource.getRepository(UnidadMedica);
      const unidad = await repo.findOne({
        where: { id },
        relations: ['municipio', 'municipio.departamento'],
      });
      if (!unidad) return res.status(404).json({ message: 'Unidad médica no encontrada' });

      const err = await applyUnidadMedicaFields(unidad, req.body);
      if (err) return res.status(400).json({ message: err });

      if (req.body?.nombre != null && String(req.body.nombre).trim()) {
        const dupNombre = await repo.findOne({ where: { nombre: unidad.nombre } });
        if (dupNombre && dupNombre.id !== unidad.id) {
          return res.status(409).json({ message: 'Ya existe una unidad con ese nombre.' });
        }
      }
      if (unidad.codigo) {
        const dupCodigo = await repo.findOne({ where: { codigo: unidad.codigo } });
        if (dupCodigo && dupCodigo.id !== unidad.id) {
          return res.status(409).json({ message: 'Ya existe una unidad con ese código de identificación.' });
        }
      }

      await repo.save(unidad);
      const full = await repo.findOne({
        where: { id: unidad.id },
        relations: ['municipio', 'municipio.departamento'],
      });
      res.json(full ?? unidad);
    } catch (error: any) {
      console.error('Error al actualizar unidad médica:', error);
      if (error?.code === '23505') {
        return res.status(409).json({ message: 'Nombre o código de identificación duplicado.' });
      }
      res.status(500).json({ message: error?.message || 'Error al actualizar unidad médica' });
    }
  }
);

// Eliminar unidad médica
catalogosRouter.delete(
  '/unidades-medicas/:id',
  verifyToken,
  authorizeRolesOrPermissions(['super administrador', 'gestionar-areas'], ['gestionar-unidades-medicas']),
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: 'ID inválido' });
      const repo = AppDataSource.getRepository(UnidadMedica);
      const unidad = await repo.findOne({ where: { id } });
      if (!unidad) return res.status(404).json({ message: 'Unidad médica no encontrada' });

      const userRepo = AppDataSource.getRepository(User);
      const enUso = await userRepo.count({ where: { unidadMedica: unidad.nombre } });
      if (enUso > 0) {
        return res.status(409).json({
          message: `No se puede eliminar: hay ${enUso} usuario(s) asignado(s) a esta unidad.`,
        });
      }

      await repo.remove(unidad);
      res.json({ message: 'Unidad médica eliminada correctamente' });
    } catch (error: any) {
      console.error('Error al eliminar unidad médica:', error);
      res.status(500).json({ message: error?.message || 'Error al eliminar unidad médica' });
    }
  }
);

// Area Endpoints: GET lista (para dropdown en formulario SIAF) permite también crear-siaf y autorizar-siaf; gestión completa solo super admin o gestionar-areas
catalogosRouter.get('/areas', verifyToken, authorizeRoles(['super administrador', 'gestionar-areas', 'crear-siaf', 'autorizar-siaf']), async (req: Request, res: Response) => {
  try {
    const areaRepository = AppDataSource.getRepository(Area);
    const areas = await areaRepository.find({ order: { nombre: 'ASC' } });
    res.json(areas);
  } catch (error) {
    console.error('Error al obtener áreas:', error);
    res.status(500).json({ message: 'Error en el servidor al obtener áreas' });
  }
});

catalogosRouter.post('/areas', verifyToken, authorizeRoles(['super administrador', 'gestionar-areas']), async (req: Request, res: Response) => {
  try {
    const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
    const descripcion = typeof req.body.descripcion === 'string' ? req.body.descripcion.trim() : null;
    const activo = req.body.activo !== false;

    if (!nombre) {
      return res.status(400).json({ message: 'El nombre del área es obligatorio.' });
    }
    if (nombre.length > 200) {
      return res.status(400).json({ message: 'El nombre del área no puede superar 200 caracteres.' });
    }

    const areaRepository = AppDataSource.getRepository(Area);
    const existente = await areaRepository.findOne({ where: { nombre } });
    if (existente) {
      return res.status(409).json({ message: 'Ya existe un área con ese nombre.' });
    }

    const area = areaRepository.create({
      nombre,
      descripcion: descripcion || null,
      activo,
    });
    await areaRepository.save(area);
    res.status(201).json(area);
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY' || err?.message?.includes('Duplicate')) {
      return res.status(409).json({ message: 'Ya existe un área con ese nombre.' });
    }
    console.error('Error al crear área:', err);
    res.status(500).json({ message: err?.message || 'Error al crear el área.' });
  }
});

catalogosRouter.put('/areas/:id', verifyToken, authorizeRoles(['super administrador', 'gestionar-areas']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'ID de área inválido.' });

    const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
    const descripcion = typeof req.body.descripcion === 'string' ? req.body.descripcion.trim() : null;
    const activo = req.body.activo !== false;

    if (!nombre) {
      return res.status(400).json({ message: 'El nombre del área es obligatorio.' });
    }
    if (nombre.length > 200) {
      return res.status(400).json({ message: 'El nombre del área no puede superar 200 caracteres.' });
    }

    const areaRepository = AppDataSource.getRepository(Area);
    const area = await areaRepository.findOne({ where: { id } });
    if (!area) return res.status(404).json({ message: 'Área no encontrada.' });

    const otroConMismoNombre = await areaRepository.findOne({ where: { nombre } });
    if (otroConMismoNombre && otroConMismoNombre.id !== id) {
      return res.status(409).json({ message: 'Ya existe un área con ese nombre.' });
    }

    area.nombre = nombre;
    area.descripcion = descripcion || null;
    area.activo = activo;
    await areaRepository.save(area);
    res.json(area);
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY' || err?.message?.includes('Duplicate')) {
      return res.status(409).json({ message: 'Ya existe un área con ese nombre.' });
    }
    console.error('Error al actualizar área:', err);
    res.status(500).json({ message: err?.message || 'Error al actualizar el área.' });
  }
});

catalogosRouter.delete('/areas/:id', verifyToken, authorizeRoles(['super administrador', 'gestionar-areas']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'ID de área inválido.' });
    const areaRepository = AppDataSource.getRepository(Area);
    const area = await areaRepository.findOne({ where: { id } });
    if (!area) return res.status(404).json({ message: 'Área no encontrada.' });
    await areaRepository.remove(area);
    res.status(204).send();
  } catch (err: any) {
    console.error('Error al eliminar área:', err);
    res.status(500).json({ message: err?.message || 'Error al eliminar el área.' });
  }
});
