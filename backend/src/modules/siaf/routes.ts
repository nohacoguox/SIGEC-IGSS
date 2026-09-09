import { Request, Response, Router } from 'express';
import { In } from 'typeorm';
import { AppDataSource } from '../../data-source';
import { User } from '../../entity/User';
import { Area } from '../../entity/Area';
import { UnidadMedica } from '../../entity/UnidadMedica';
import { Municipio } from '../../entity/Municipio';
import { Departamento } from '../../entity/Departamento';
import {
  SiafSolicitud,
  SiafAutorizacion,
  SiafItem,
  SiafSubproducto,
  SiafDocumentoAdjunto,
  SiafBitacora,
} from '../../entity/SiafSolicitud';
import { verifyToken, authorizeRoles } from '../../middleware/auth';
import { uploadMemory } from '../../middleware/upload';
import { resolveDepartamentoDireccion } from '../../services/departamentoDireccion';
import { pdfGeneratorService } from '../../services/PdfGeneratorService';
import { fileStorageService } from '../../services/FileStorageService';
import { validarReservaActiva, consumirCorrelativo } from '../../services/CorrelativoService';
import {
  ETIQUETAS_MOTIVO,
  MOTIVOS_VALIDOS,
  buildDetalleCorreccion,
  loadBitacoraBySiafId,
  resolverItemsSiafDesdeCatalogo,
} from './helpers';

// El router se monta en /api/siaf. El orden de declaración importa: las rutas
// específicas (rechazadas, adjuntos, para-direccion-departamental) deben quedar
// antes de /:id para que Express no las interprete como un id.
export const siafRouter = Router();

// Obtener todas las solicitudes SIAF creadas por el usuario actual
siafRouter.get('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const siafRepository = AppDataSource.getRepository(SiafSolicitud);

    const solicitudes = await siafRepository
      .createQueryBuilder('solicitud')
      .leftJoinAndSelect('solicitud.usuarioSolicitante', 'solicitante')
      .leftJoinAndSelect('solicitud.area', 'area')
      .leftJoinAndSelect('solicitud.items', 'items')
      .leftJoinAndSelect('solicitud.subproductos', 'subproductos')
      .leftJoinAndSelect('solicitud.documentosAdjuntos', 'documentosAdjuntos')
      .leftJoinAndSelect('solicitud.autorizaciones', 'autorizaciones')
      .where('solicitante.id = :userId', { userId })
      .orderBy('solicitud.createdAt', 'DESC')
      .getMany();

    const conUltimoRechazo = solicitudes.map((s) => {
      const rechazos = (s.autorizaciones || []).filter((a: any) => a.accion === 'rechazado')
        .sort((a: any, b: any) => new Date(b.fechaAutorizacion).getTime() - new Date(a.fechaAutorizacion).getTime());
      const ultimoRechazo = rechazos[0] ? { comentario: rechazos[0].comentario, fecha: rechazos[0].fechaAutorizacion } : null;
      return { ...s, ultimoRechazo };
    });

    res.json(conUltimoRechazo);
  } catch (error) {
    console.error('Error al obtener las solicitudes SIAF del usuario:', error);
    res.status(500).json({ message: 'Error al obtener las solicitudes SIAF' });
  }
});

// Crear una nueva solicitud SIAF (correlativo automático vía reserva)
siafRouter.post('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const siafData = req.body;
    const userId = (req as any).user.userId;

    const siafRepository = AppDataSource.getRepository(SiafSolicitud);
    const userRepository = AppDataSource.getRepository(User);
    const areaRepository = AppDataSource.getRepository(Area);

    const itemsResueltos = await resolverItemsSiafDesdeCatalogo(siafData.items);
    if (itemsResueltos.error) {
      return res.status(400).json({ message: itemsResueltos.error });
    }
    siafData.items = itemsResueltos.items;

    // 1. Validar reserva de correlativo (se consume solo tras guardar)
    const reservaId = Number(siafData.reservaId);
    if (!reservaId || Number.isNaN(reservaId)) {
      return res.status(400).json({
        message: 'Debe reservar un correlativo antes de crear el SIAF. Recargue el formulario.',
      });
    }
    const reservaOk = await validarReservaActiva(reservaId, userId);
    if (!reservaOk) {
      return res.status(409).json({
        message: 'La reserva del correlativo expiró o no es válida. Vuelva a abrir «Crear SIAF» para obtener uno nuevo.',
      });
    }
    const correlativoFinal = reservaOk.correlativo;

    // 2. Validar correlativo único (doble chequeo)
    const existingSiaf = await siafRepository.findOne({ where: { correlativo: correlativoFinal } });
    if (existingSiaf) {
      return res.status(409).json({ message: `El correlativo "${correlativoFinal}" ya existe.` });
    }

    // 3. Obtener entidades relacionadas
    const solicitante = await userRepository.findOneBy({ id: userId });
    if (!solicitante) {
      return res.status(404).json({ message: 'Usuario solicitante no encontrado.' });
    }

    let autoridad: User | null = null;
    if (siafData.usuarioAutoridadId) {
      autoridad = await userRepository.findOneBy({ id: siafData.usuarioAutoridadId });
    }
    let encargado: User | null = null;
    if (siafData.usuarioEncargadoId) {
      encargado = await userRepository.findOneBy({ id: siafData.usuarioEncargadoId });
    }

    let area: Area | null = null;
    if (siafData.areaId) {
      area = await areaRepository.findOneBy({ id: siafData.areaId });
    }

    // 4. Crear y poblar la solicitud
    const nuevaSolicitud = new SiafSolicitud();
    // Nace como borrador: enviar a revisión es una decisión del solicitante.
    nuevaSolicitud.estado = 'borrador';
    nuevaSolicitud.correlativo = correlativoFinal;
    nuevaSolicitud.fecha = new Date(siafData.fecha);
    nuevaSolicitud.nombreUnidad = siafData.nombreUnidad;
    nuevaSolicitud.direccion = siafData.direccion;
    nuevaSolicitud.justificacion = siafData.justificacion;
    nuevaSolicitud.consistenteItem = siafData.consistentItem;

    // Asignar datos textuales y entidades
    nuevaSolicitud.nombreSolicitante = siafData.nombreSolicitante;
    nuevaSolicitud.puestoSolicitante = siafData.puestoSolicitante;
    nuevaSolicitud.unidadSolicitante = siafData.unidadSolicitante;
    nuevaSolicitud.nombreAutoridad = siafData.nombreAutoridad;
    nuevaSolicitud.puestoAutoridad = siafData.puestoAutoridad;
    nuevaSolicitud.unidadAutoridad = siafData.unidadAutoridad;

    nuevaSolicitud.usuarioSolicitante = solicitante;
    if (autoridad) nuevaSolicitud.usuarioAutoridad = autoridad;
    if (encargado) nuevaSolicitud.usuarioEncargado = encargado;
    if (area) nuevaSolicitud.area = area;

    // 4. Mapear items y subproductos
    nuevaSolicitud.items = siafData.items.map((itemData: any, index: number) => {
      const newItem = new SiafItem();
      newItem.codigo = itemData.codigo;
      newItem.catalogoOrigen = itemData.catalogoOrigen ?? null;
      newItem.descripcion = itemData.descripcion;
      newItem.cantidad = itemData.cantidad;
      newItem.orden = index;
      return newItem;
    });

    nuevaSolicitud.subproductos = siafData.subproductos.map((subData: any, index: number) => {
      const newSub = new SiafSubproducto();
      newSub.codigo = subData.codigo;
      newSub.cantidad = subData.cantidad;
      newSub.orden = index;
      return newSub;
    });

    // 5. Guardar en la base de datos
    const savedSiaf = await siafRepository.save(nuevaSolicitud);

    // 6. Marcar correlativo como consumido (ya no se puede reutilizar)
    await consumirCorrelativo(reservaId, userId);

    // 7. Generar y guardar el PDF
    try {
      const pdfBuffer = await pdfGeneratorService.generateSiafPdf(savedSiaf);
      const pdfInfo = await fileStorageService.saveSiafPdf(pdfBuffer, savedSiaf.correlativo);

      // Actualizar la solicitud con la info del PDF
      savedSiaf.pdfPath = pdfInfo.filePath;
      savedSiaf.pdfHash = pdfInfo.hash;
      savedSiaf.pdfSize = pdfInfo.size;
      await siafRepository.save(savedSiaf); // Guardar la actualización

      res.status(201).json({
        message: 'Solicitud SIAF creada y PDF generado exitosamente.',
        siafId: savedSiaf.id,
        pdfGenerated: true
      });

    } catch (pdfError) {
      console.error('Error al generar o guardar el PDF:', pdfError);
      // La solicitud ya fue creada, pero el PDF falló. Se responde con éxito parcial.
      res.status(201).json({
        message: 'Solicitud SIAF creada, pero hubo un problema al generar el PDF.',
        siafId: savedSiaf.id,
        pdfGenerated: false
      });
    }

  } catch (error) {
    console.error('Error al crear solicitud SIAF:', error);
    res.status(500).json({ message: 'Error en el servidor al crear la solicitud SIAF.' });
  }
});

// (Flujo director/encargado de despacho anulado: solo Dirección Departamental autoriza con rol revisar-siaf-direccion-departamental.)

// Dirección Departamental: SIAFs PENDIENTES de su departamento (opcional: filtrar por municipio con ?municipioId=).
siafRouter.get('/para-direccion-departamental', verifyToken, authorizeRoles(['super administrador', 'revisar-siaf-direccion-departamental']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const municipioIdParam = req.query.municipioId != null ? parseInt(String(req.query.municipioId), 10) : null;
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId }, relations: ['roles', 'departamentoDireccionEntidad'] });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    const depto = await resolveDepartamentoDireccion(user);
    if (!depto) return res.status(400).json({ message: 'No tiene asignado un departamento de Dirección. Asigne una Unidad Médica de tipo Dirección Departamental (ej. Dirección Departamental Escuintla) o contacte al administrador.' });
    const unidadRepo = AppDataSource.getRepository(UnidadMedica);
    const todasUnidades = await unidadRepo.find({ relations: ['municipio', 'municipio.departamento'] });
    let unidadesDelDepto = todasUnidades.filter(
      (u) => (u.departamento === depto) || (u.municipio?.departamento?.nombre === depto)
    );
    if (municipioIdParam != null && !isNaN(municipioIdParam)) {
      unidadesDelDepto = unidadesDelDepto.filter((u) => u.municipio?.id === municipioIdParam);
    }
    const nombresUnidad = unidadesDelDepto.map((u) => u.nombre);
    const deptoPattern = `%${depto}%`;
    const siafRepo = AppDataSource.getRepository(SiafSolicitud);
    let qb = siafRepo
      .createQueryBuilder('solicitud')
      .leftJoinAndSelect('solicitud.autorizaciones', 'aut')
      .leftJoinAndSelect('aut.usuarioAutorizador', 'autorizador')
      .leftJoinAndSelect('solicitud.items', 'items')
      .leftJoinAndSelect('solicitud.subproductos', 'subproductos')
      .leftJoinAndSelect('solicitud.area', 'area')
      .leftJoinAndSelect('solicitud.usuarioSolicitante', 'usuarioSolicitante')
      .leftJoinAndSelect('usuarioSolicitante.puesto', 'puestoSolicitante')
      .leftJoinAndSelect('solicitud.usuarioAutoridad', 'usuarioAutoridad')
      .leftJoinAndSelect('solicitud.documentosAdjuntos', 'documentosAdjuntos')
      .where('solicitud.estado = :estado', { estado: 'pendiente' });
    const filtrandoPorMunicipio = municipioIdParam != null && !isNaN(municipioIdParam);
    if (filtrandoPorMunicipio) {
      const muniRepo = AppDataSource.getRepository(Municipio);
      const municipio = await muniRepo.findOne({ where: { id: municipioIdParam }, relations: ['departamento'] });
      const nombreMuni = municipio?.nombre ?? '';
      const perteneceAlDepto = municipio?.departamento?.nombre === depto;
      const municipioPattern = nombreMuni ? `%${nombreMuni}%` : '';
      const nombreMuniSinAcento = nombreMuni.replace(/í/g, 'i').replace(/á/g, 'a').replace(/é/g, 'e').replace(/ó/g, 'o').replace(/ú/g, 'u');
      const municipioPatternSinAcento = nombreMuniSinAcento ? `%${nombreMuniSinAcento}%` : '';
      if (!perteneceAlDepto && nombreMuni) {
        qb = qb.andWhere('1 = 0');
      } else if (nombresUnidad.length > 0 && (municipioPattern || municipioPatternSinAcento)) {
        if (municipioPattern && municipioPatternSinAcento && municipioPattern !== municipioPatternSinAcento) {
          qb = qb.andWhere(
            '(solicitud.nombreUnidad IN (:...nombres) OR solicitud.nombreUnidad ILIKE :municipioPattern OR solicitud.nombreUnidad ILIKE :municipioPatternSinAcento)',
            { nombres: nombresUnidad, municipioPattern, municipioPatternSinAcento }
          );
        } else {
          qb = qb.andWhere(
            '(solicitud.nombreUnidad IN (:...nombres) OR solicitud.nombreUnidad ILIKE :municipioPattern)',
            { nombres: nombresUnidad, municipioPattern: municipioPattern || municipioPatternSinAcento }
          );
        }
      } else if (nombresUnidad.length > 0) {
        qb = qb.andWhere('solicitud.nombreUnidad IN (:...nombres)', { nombres: nombresUnidad });
      } else if (municipioPattern && municipioPatternSinAcento && municipioPattern !== municipioPatternSinAcento) {
        qb = qb.andWhere('(solicitud.nombreUnidad ILIKE :municipioPattern OR solicitud.nombreUnidad ILIKE :municipioPatternSinAcento)', { municipioPattern, municipioPatternSinAcento });
      } else if (municipioPattern || municipioPatternSinAcento) {
        qb = qb.andWhere('solicitud.nombreUnidad ILIKE :municipioPattern', { municipioPattern: municipioPattern || municipioPatternSinAcento });
      } else {
        qb = qb.andWhere('1 = 0');
      }
    } else if (nombresUnidad.length > 0) {
      qb = qb.andWhere('(solicitud.nombreUnidad IN (:...nombres) OR solicitud.nombreUnidad ILIKE :deptoPattern)', { nombres: nombresUnidad, deptoPattern });
    } else {
      qb = qb.andWhere('solicitud.nombreUnidad ILIKE :deptoPattern', { deptoPattern });
    }
    const solicitudes = await qb.orderBy('solicitud.createdAt', 'DESC').getMany();
    const ids = solicitudes.map((s) => s.id);
    let esCorreccionIds: number[] = [];
    if (ids.length > 0) {
      const bitacoraRepo = AppDataSource.getRepository(SiafBitacora);
      const rows = await bitacoraRepo
        .createQueryBuilder('b')
        .innerJoin('b.siaf', 's')
        .select('DISTINCT s.id', 'siafId')
        .where('s.id IN (:...ids)', { ids })
        .andWhere("b.tipo IN ('rechazo', 'correccion')")
        .getRawMany();
      esCorreccionIds = (rows || []).map((r: any) => r.siafId).filter((id: any) => id != null);
    }
    const deptoRepo = AppDataSource.getRepository(Departamento);
    const deptoEntidad = await deptoRepo.findOne({ where: { nombre: depto } });
    res.json({
      solicitudes,
      meta: {
        unidadAsignada: user.unidadMedica || '',
        departamento: depto,
        departamentoId: deptoEntidad?.id ?? null,
        esCorreccionIds,
      },
    });
  } catch (err: any) {
    console.error('Error al obtener SIAFs para Dirección Departamental:', err);
    res.status(500).json({ message: err?.message || 'Error al obtener solicitudes.' });
  }
});

// Historial de SIAFs aprobados/rechazados por el usuario de Dirección Departamental (el que está logueado)
siafRouter.get('/historial-direccion-departamental', verifyToken, authorizeRoles(['super administrador', 'revisar-siaf-direccion-departamental']), async (req: Request, res: Response) => {
  try {
    const userId = Number((req as any).user?.userId);
    if (!userId || isNaN(userId)) return res.status(401).json({ message: 'Usuario no identificado.' });
    const autRepo = AppDataSource.getRepository(SiafAutorizacion);
    const autorizaciones = await autRepo
      .createQueryBuilder('aut')
      .innerJoinAndSelect('aut.siaf', 'siaf')
      .leftJoinAndSelect('siaf.usuarioSolicitante', 'usuarioSolicitante')
      .leftJoinAndSelect('usuarioSolicitante.puesto', 'puestoSolicitante')
      .leftJoinAndSelect('siaf.area', 'area')
      .leftJoinAndSelect('siaf.items', 'items')
      .leftJoinAndSelect('siaf.subproductos', 'subproductos')
      .leftJoinAndSelect('siaf.documentosAdjuntos', 'documentosAdjuntos')
      .where('aut.usuario_autorizador_id = :userId', { userId })
      .orderBy('aut.fecha_autorizacion', 'DESC')
      .getMany();
    const items = autorizaciones.map((aut) => ({
      id: aut.siaf.id,
      correlativo: aut.siaf.correlativo,
      fecha: aut.siaf.fecha ?? aut.siaf.createdAt,
      nombreSolicitante: aut.siaf.nombreSolicitante || (aut.siaf.usuarioSolicitante ? `${aut.siaf.usuarioSolicitante.nombres || ''} ${aut.siaf.usuarioSolicitante.apellidos || ''}`.trim() : 'N/A'),
      puestoSolicitante: aut.siaf.puestoSolicitante || aut.siaf.usuarioSolicitante?.puesto?.nombre || 'N/A',
      nombreUnidad: aut.siaf.nombreUnidad || aut.siaf.area?.nombre || 'N/A',
      areaUnidad: aut.siaf.area?.nombre || 'N/A',
      estado: aut.accion,
      fechaDecision: aut.fechaAutorizacion,
      comentario: aut.comentario ?? null,
      siaf: aut.siaf,
    }));
    res.json(items);
  } catch (err: any) {
    console.error('Error al obtener historial DD:', err);
    res.status(500).json({ message: err?.message || 'Error al obtener historial.' });
  }
});

// Obtener solicitudes SIAF rechazadas (misma unidad que el usuario)
siafRouter.get('/rechazadas', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    const unidadUsuario = user.unidadMedica || '';
    const siafRepository = AppDataSource.getRepository(SiafSolicitud);

    const solicitudes = await siafRepository
      .createQueryBuilder('solicitud')
      .leftJoinAndSelect('solicitud.autorizaciones', 'aut')
      .leftJoinAndSelect('aut.usuarioAutorizador', 'autorizador')
      .leftJoinAndSelect('solicitud.items', 'items')
      .leftJoinAndSelect('solicitud.subproductos', 'subproductos')
      .leftJoinAndSelect('solicitud.area', 'area')
      .leftJoinAndSelect('solicitud.usuarioSolicitante', 'usuarioSolicitante')
      .leftJoinAndSelect('usuarioSolicitante.puesto', 'puestoSolicitante')
      .leftJoinAndSelect('solicitud.usuarioAutoridad', 'usuarioAutoridad')
      .where('solicitud.unidadSolicitante = :unidad', { unidad: unidadUsuario })
      .andWhere('solicitud.estado = :estado', { estado: 'rechazado' })
      .orderBy('solicitud.createdAt', 'DESC')
      .getMany();

    res.json(solicitudes);
  } catch (err: any) {
    console.error('Error fetching SIAF solicitudes rechazadas:', err);
    res.status(500).json({ message: 'Error al obtener solicitudes SIAF rechazadas' });
  }
});

// Descargar un documento adjunto de SIAF (ruta debe ir antes de /:id)
siafRouter.get('/adjuntos/:idAdjunto/descargar', verifyToken, async (req: Request, res: Response) => {
  try {
    const idAdjunto = parseInt(req.params.idAdjunto);
    if (isNaN(idAdjunto)) return res.status(400).json({ message: 'ID de adjunto inválido.' });
    const adjuntoRepo = AppDataSource.getRepository(SiafDocumentoAdjunto);
    const adjunto = await adjuntoRepo.findOne({
      where: { id: idAdjunto },
      relations: ['siaf', 'siaf.usuarioSolicitante'],
    });
    if (!adjunto) return res.status(404).json({ message: 'Documento adjunto no encontrado.' });
    // Solo el solicitante o quien tenga acceso a la unidad puede descargar (por ahora permitir a cualquier autenticado que conozca el id)
    const buffer = await fileStorageService.readFileByRelativePath(adjunto.rutaArchivo);
    const fileName = adjunto.nombreOriginal || `adjunto-${idAdjunto}`;
    res.setHeader('Content-Type', adjunto.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send(buffer);
  } catch (err: any) {
    if (err.message === 'Archivo no encontrado') return res.status(404).json({ message: 'Archivo no encontrado.' });
    console.error('Error al descargar adjunto:', err);
    res.status(500).json({ message: 'Error al descargar el documento.' });
  }
});

// Eliminar un documento adjunto de SIAF (debe ir antes de /:id)
siafRouter.delete('/adjuntos/:idAdjunto', verifyToken, async (req: Request, res: Response) => {
  try {
    const idAdjunto = parseInt(req.params.idAdjunto);
    if (isNaN(idAdjunto)) return res.status(400).json({ message: 'ID de adjunto inválido.' });
    const userId = (req as any).user.userId;
    const adjuntoRepo = AppDataSource.getRepository(SiafDocumentoAdjunto);
    const adjunto = await adjuntoRepo.findOne({
      where: { id: idAdjunto },
      relations: ['siaf', 'siaf.usuarioSolicitante'],
    });
    if (!adjunto) return res.status(404).json({ message: 'Documento adjunto no encontrado.' });
    if (adjunto.siaf?.usuarioSolicitante?.id !== userId) return res.status(403).json({ message: 'Solo el solicitante puede eliminar documentos de esta solicitud.' });
    await fileStorageService.deleteSiafAdjunto(adjunto.rutaArchivo);
    await adjuntoRepo.remove(adjunto);
    res.status(204).send();
  } catch (err: any) {
    console.error('Error al eliminar adjunto:', err);
    res.status(500).json({ message: err?.message || 'Error al eliminar el documento.' });
  }
});

// Subir documento adjunto a un SIAF
siafRouter.post('/:id/adjuntos', verifyToken, uploadMemory.single('archivo'), async (req: Request, res: Response) => {
  try {
    const siafId = parseInt(req.params.id);
    if (isNaN(siafId)) return res.status(400).json({ message: 'ID de SIAF inválido.' });
    const file = (req as any).file;
    if (!file || !file.buffer) return res.status(400).json({ message: 'Debe enviar un archivo (campo "archivo").' });
    const siafRepo = AppDataSource.getRepository(SiafSolicitud);
    const siaf = await siafRepo.findOne({ where: { id: siafId }, relations: ['usuarioSolicitante'] });
    if (!siaf) return res.status(404).json({ message: 'Solicitud SIAF no encontrada.' });
    const userId = (req as any).user.userId;
    if (siaf.usuarioSolicitante?.id !== userId) return res.status(403).json({ message: 'Solo el solicitante puede adjuntar documentos a esta solicitud.' });
    const nombreOriginal = file.originalname || `documento-${Date.now()}`;
    const pdfInfo = await fileStorageService.saveSiafAdjunto(file.buffer, siafId, nombreOriginal);
    const adjuntoRepo = AppDataSource.getRepository(SiafDocumentoAdjunto);
    const adjunto = adjuntoRepo.create({
      siafId,
      nombreOriginal,
      rutaArchivo: pdfInfo.filePath,
      mimeType: file.mimetype || 'application/octet-stream',
      tamanioBytes: pdfInfo.size,
      hashArchivo: pdfInfo.hash,
    });
    await adjuntoRepo.save(adjunto);
    res.status(201).json(adjunto);
  } catch (err: any) {
    console.error('Error al subir adjunto:', err);
    res.status(500).json({ message: err?.message || 'Error al subir el documento.' });
  }
});

// Bitácora: GET (con cabeceras anti-caché)
siafRouter.get('/:id/bitacora', verifyToken, async (req: Request, res: Response) => {
  try {
    const siafId = parseInt(req.params.id);
    if (isNaN(siafId)) return res.status(400).json({ message: 'ID inválido.' });
    const bitacora = await loadBitacoraBySiafId(siafId);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    return res.json(bitacora);
  } catch (err: any) {
    console.error('Error GET bitácora:', err);
    res.status(500).json({ message: err?.message || 'Error al cargar bitácora.' });
  }
});

// Bitácora: POST para cargar siempre datos frescos (el navegador NUNCA cachea POST)
siafRouter.post('/:id/bitacora', verifyToken, async (req: Request, res: Response) => {
  try {
    const siafId = parseInt(req.params.id);
    if (isNaN(siafId)) return res.status(400).json({ message: 'ID inválido.' });
    const bitacora = await loadBitacoraBySiafId(siafId);
    return res.json(bitacora);
  } catch (err: any) {
    console.error('Error POST bitácora:', err);
    res.status(500).json({ message: err?.message || 'Error al cargar bitácora.' });
  }
});

// Obtener una solicitud SIAF por ID (bitácora se carga con consulta explícita para incluir siempre rechazos y correcciones)
siafRouter.get('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const siafId = parseInt(req.params.id);
    if (isNaN(siafId)) {
      return res.status(400).json({ message: 'ID de solicitud inválido.' });
    }
    const siafRepository = AppDataSource.getRepository(SiafSolicitud);
    const solicitud = await siafRepository.findOne({
      where: { id: siafId },
      relations: ['items', 'subproductos', 'area', 'usuarioSolicitante', 'usuarioAutoridad', 'usuarioEncargado', 'documentosAdjuntos', 'autorizaciones'],
    });

    if (!solicitud) {
      return res.status(404).json({ message: 'Solicitud SIAF no encontrada.' });
    }

    const rechazos = (solicitud.autorizaciones || []).filter((a) => a.accion === 'rechazado').sort((a, b) => new Date(b.fechaAutorizacion).getTime() - new Date(a.fechaAutorizacion).getTime());
    const ultimoRechazo = rechazos[0] ? { comentario: rechazos[0].comentario, fecha: rechazos[0].fechaAutorizacion, usuario: rechazos[0].usuarioAutorizador } : null;

    const bitacoraRows = await AppDataSource.query(
      `SELECT id, tipo, comentario, detalle_antes AS "detalleAntes", detalle_despues AS "detalleDespues", fecha, usuario_id FROM siaf_bitacora WHERE siaf_id = $1 ORDER BY fecha DESC`,
      [siafId]
    );
    const bitacoraUserIds = [...new Set((bitacoraRows || []).map((r: any) => r.usuario_id).filter(Boolean))];
    const bitacoraUsers = bitacoraUserIds.length ? await AppDataSource.getRepository(User).find({ where: { id: In(bitacoraUserIds) } }) : [];
    const bitacoraUserMap = new Map(bitacoraUsers.map((u) => [u.id, { nombres: u.nombres, apellidos: u.apellidos }]));
    const bitacora = (bitacoraRows || []).map((row: any) => ({
      id: row.id,
      tipo: String(row.tipo || ''),
      comentario: row.comentario ?? null,
      detalleAntes: row.detalleAntes ?? row.detalle_antes ?? null,
      detalleDespues: row.detalleDespues ?? row.detalle_despues ?? null,
      fecha: row.fecha,
      usuario: row.usuario_id ? (bitacoraUserMap.get(row.usuario_id) ?? { nombres: '', apellidos: '' }) : null,
    }));

    res.json({
      ...solicitud,
      ultimoRechazo,
      bitacora,
    });
  } catch (error) {
    console.error('Error al obtener solicitud SIAF por ID:', error);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
});

// Autorizar/rechazar por director o encargado de despacho ya no se usa; solo Dirección Departamental (revisar-siaf-direccion-departamental) autoriza.
siafRouter.put('/:id/autorizar', verifyToken, (_req: Request, res: Response) => {
  return res.status(403).json({ message: 'La autorización de SIAF la realiza únicamente Dirección Departamental (rol revisar-siaf-direccion-departamental).' });
});
siafRouter.put('/:id/rechazar', verifyToken, (_req: Request, res: Response) => {
  return res.status(403).json({ message: 'El rechazo de SIAF lo realiza únicamente Dirección Departamental (rol revisar-siaf-direccion-departamental).' });
});

// Dar visto bueno al SIAF por Dirección Departamental. La revisión lo deja finalizado,
// pero una edición posterior lo devolverá a borrador para que los cambios puedan revisarse de nuevo.
siafRouter.post('/:id/aprobar-direccion-departamental', verifyToken, authorizeRoles(['super administrador', 'revisar-siaf-direccion-departamental']), async (req: Request, res: Response) => {
  try {
    const siafId = parseInt(req.params.id);
    if (isNaN(siafId)) return res.status(400).json({ message: 'ID de SIAF inválido.' });
    const userId = (req as any).user.userId;
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: userId });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    const depto = await resolveDepartamentoDireccion(user);
    if (!depto) return res.status(403).json({ message: 'No tiene departamento de Dirección asignado. Asigne una Unidad Médica de tipo Dirección Departamental.' });
    const unidadRepo = AppDataSource.getRepository(UnidadMedica);
    const unidades = await unidadRepo.find({ where: { departamento: depto } });
    const nombresUnidad = unidades.map((u) => u.nombre);
    const siafRepo = AppDataSource.getRepository(SiafSolicitud);
    const siaf = await siafRepo.findOne({ where: { id: siafId }, relations: ['usuarioSolicitante'] });
    if (!siaf) return res.status(404).json({ message: 'Solicitud SIAF no encontrada.' });
    if (siaf.estado !== 'pendiente') return res.status(400).json({ message: 'Solo se puede revisar favorablemente un SIAF en estado pendiente.' });
    const perteneceAlDepto = nombresUnidad.includes(siaf.nombreUnidad) || (siaf.nombreUnidad && siaf.nombreUnidad.toLowerCase().includes(depto.toLowerCase()));
    if (!perteneceAlDepto) return res.status(403).json({ message: 'Este SIAF no corresponde a su departamento.' });
    siaf.estado = 'finalizado';
    siaf.aprobadoDireccionDepartamental = true;
    await siafRepo.save(siaf);
    const autRepo = AppDataSource.getRepository(SiafAutorizacion);
    const aut = autRepo.create({ siaf, usuarioAutorizador: user, accion: 'autorizado', comentario: undefined });
    await autRepo.save(aut);
    const bitacoraRepo = AppDataSource.getRepository(SiafBitacora);
    const bitacora = bitacoraRepo.create({ siaf, tipo: 'aprobado_dd', usuario: user, comentario: 'Revisión favorable de Dirección Departamental. SIAF marcado como finalizado.' });
    await bitacoraRepo.save(bitacora);
    res.json(siaf);
  } catch (err: any) {
    console.error('Error al revisar favorablemente SIAF por DD:', err);
    res.status(500).json({ message: err?.message || 'Error al finalizar la revisión.' });
  }
});

// Rechazo por Dirección Departamental (uno o varios motivos; se registra una sola revisión en autorizaciones y bitácora)
siafRouter.post('/:id/rechazar-direccion-departamental', verifyToken, authorizeRoles(['super administrador', 'revisar-siaf-direccion-departamental']), async (req: Request, res: Response) => {
  try {
    const siafId = parseInt(req.params.id);
    if (isNaN(siafId)) return res.status(400).json({ message: 'ID de SIAF inválido.' });
    const userId = (req as any).user.userId;
    let comentario: string;
    let motivoRechazoPrimero: string | null = null;
    let motivosRechazoJson: string | null = null;
    let motivosRaw = req.body?.motivos;
    if (typeof motivosRaw === 'string') {
      try {
        motivosRaw = JSON.parse(motivosRaw);
      } catch {
        motivosRaw = undefined;
      }
    }
    type MotivoConMarca = {
      categoria: string;
      descripcion: string;
      pagina?: number | null;
      xPercent?: number | null;
      yPercent?: number | null;
    };
    let motivosConMarca: MotivoConMarca[] = [];
    if (Array.isArray(motivosRaw) && motivosRaw.length > 0) {
      const motivos = motivosRaw
        .filter((m: any) => m != null && (typeof m.descripcion === 'string' || typeof m.descripcion === 'number'))
        .map((m: any) => {
          const pagina = m.pagina != null && !Number.isNaN(Number(m.pagina)) ? Number(m.pagina) : null;
          const xPercent = m.xPercent != null && !Number.isNaN(Number(m.xPercent)) ? Number(m.xPercent) : null;
          const yPercent = m.yPercent != null && !Number.isNaN(Number(m.yPercent)) ? Number(m.yPercent) : null;
          return {
            categoria: typeof m.categoria === 'string' && MOTIVOS_VALIDOS.includes(m.categoria.trim()) ? m.categoria.trim() : 'otro',
            descripcion: String(m.descripcion ?? '').trim(),
            pagina,
            xPercent,
            yPercent,
          } as MotivoConMarca;
        })
        .filter((m) => m.descripcion.length > 0);
      if (motivos.length === 0) return res.status(400).json({ message: 'Debe indicar al menos un motivo con descripción.' });
      motivosConMarca = motivos;
      motivoRechazoPrimero = motivos[0].categoria;
      motivosRechazoJson = JSON.stringify(motivos.map((m) => m.categoria));
      const lineas = motivos.map((m, i) => {
        return `${i + 1}) ${ETIQUETAS_MOTIVO[m.categoria] || m.categoria}: ${m.descripcion}`;
      });
      comentario = '[Dirección Departamental] Motivos de rechazo (esta revisión):\n' + lineas.join('\n');
    } else {
      const comentarioLegacy = typeof req.body?.comentario === 'string' ? req.body.comentario.trim() : '';
      if (!comentarioLegacy) return res.status(400).json({ message: 'Debe indicar al menos un motivo con descripción. Si envía varios, use el campo "motivos" (array con categoría y descripción).' });
      const motivoRechazoRaw = typeof req.body?.motivoRechazo === 'string' ? req.body.motivoRechazo.trim() : '';
      motivoRechazoPrimero = motivoRechazoRaw && MOTIVOS_VALIDOS.includes(motivoRechazoRaw) ? motivoRechazoRaw : null;
      if (motivoRechazoPrimero) motivosRechazoJson = JSON.stringify([motivoRechazoPrimero]);
      comentario = `[Dirección Departamental] ${comentarioLegacy}`;
    }
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: userId });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    const depto = await resolveDepartamentoDireccion(user);
    if (!depto) return res.status(403).json({ message: 'No tiene departamento de Dirección asignado. Asigne una Unidad Médica de tipo Dirección Departamental.' });
    const unidadRepo = AppDataSource.getRepository(UnidadMedica);
    const unidades = await unidadRepo.find({ where: { departamento: depto } });
    const nombresUnidad = unidades.map((u) => u.nombre);
    const siafRepo = AppDataSource.getRepository(SiafSolicitud);
    const siaf = await siafRepo.findOne({ where: { id: siafId } });
    if (!siaf) return res.status(404).json({ message: 'Solicitud SIAF no encontrada.' });
    if (siaf.estado !== 'pendiente') return res.status(400).json({ message: 'Solo se puede rechazar un SIAF en estado pendiente.' });
    const perteneceAlDepto = nombresUnidad.includes(siaf.nombreUnidad) || (siaf.nombreUnidad && siaf.nombreUnidad.toLowerCase().includes(depto.toLowerCase()));
    if (!perteneceAlDepto) return res.status(403).json({ message: 'Este SIAF no corresponde a su departamento.' });
    siaf.estado = 'rechazado';
    await siafRepo.save(siaf);
    const autRepo = AppDataSource.getRepository(SiafAutorizacion);
    const aut = autRepo.create({
      siaf,
      usuarioAutorizador: user,
      accion: 'rechazado',
      comentario,
      motivoRechazo: motivoRechazoPrimero,
      motivosRechazo: motivosRechazoJson,
    });
    await autRepo.save(aut);
    const bitacoraRepo = AppDataSource.getRepository(SiafBitacora);
    const conPosicion = motivosConMarca.filter(
      (m) => m.pagina != null && m.xPercent != null && m.yPercent != null
    );
    const detalleMarcadores =
      conPosicion.length > 0
        ? JSON.stringify({
            marcadores: conPosicion.map((m) => ({
              categoria: m.categoria,
              descripcion: m.descripcion,
              pagina: m.pagina ?? null,
              xPercent: m.xPercent ?? null,
              yPercent: m.yPercent ?? null,
            })),
          })
        : undefined;
    const bitacora = bitacoraRepo.create({
      siaf,
      tipo: 'rechazo',
      usuario: user,
      comentario,
      ...(detalleMarcadores ? { detalleAntes: detalleMarcadores } : {}),
    });
    await bitacoraRepo.save(bitacora);
    res.json(siaf);
  } catch (err: any) {
    console.error('Error al rechazar SIAF por DD:', err);
    res.status(500).json({ message: err?.message || 'Error al rechazar.' });
  }
});

// Actualizar una solicitud SIAF: cualquier edición la devuelve a borrador.
// Si existió rechazo, además registra el detalle de la corrección en bitácora.
siafRouter.put('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const siafId = parseInt(req.params.id);
    if (isNaN(siafId)) return res.status(400).json({ message: 'ID de solicitud inválido.' });
    const userId = (req as any).user.userId;
    const userRepo = AppDataSource.getRepository(User);
    const siafRepo = AppDataSource.getRepository(SiafSolicitud);
    const solicitud = await siafRepo.findOne({
      where: { id: siafId },
      relations: ['usuarioSolicitante', 'area', 'items', 'subproductos', 'autorizaciones'],
    });
    if (!solicitud) return res.status(404).json({ message: 'Solicitud SIAF no encontrada.' });
    if (solicitud.usuarioSolicitante?.id !== userId) return res.status(403).json({ message: 'Solo el solicitante puede editar esta solicitud.' });
    const estadoAntesDeEditar = solicitud.estado;
    const tieneAlgunRechazo = (solicitud.autorizaciones || []).some((a: any) => a.accion === 'rechazado');
    const registrarCorreccion = estadoAntesDeEditar !== 'borrador';
    console.log('[SIAF] PUT corrección', { siafId, estado: solicitud.estado, tieneAlgunRechazo, registrarCorreccion, numAutorizaciones: (solicitud.autorizaciones || []).length });
    const body = req.body;
    if (Array.isArray(body.items)) {
      const itemsResueltos = await resolverItemsSiafDesdeCatalogo(body.items);
      if (itemsResueltos.error) {
        return res.status(400).json({ message: itemsResueltos.error });
      }
      body.items = itemsResueltos.items;
    }

    // Si ya había salido de borrador, se registra el cambio para que una revisión
    // posterior deje claro qué se modificó respecto de la versión anterior.
    const oldState = registrarCorreccion ? {
      justificacion: solicitud.justificacion ?? '',
      direccion: solicitud.direccion ?? '',
      consistenteItem: (solicitud.consistenteItem ?? '').toString(),
      items: (solicitud.items || []).map((i: any) => ({ codigo: i.codigo ?? '', descripcion: i.descripcion ?? '', cantidad: Number(i.cantidad ?? 0) })),
      subproductos: (solicitud.subproductos || []).map((s: any) => ({ codigo: s.codigo ?? '', cantidad: Number(s.cantidad ?? 0) })),
    } : null;

    if (body.fecha != null) solicitud.fecha = new Date(body.fecha);
    if (body.nombreUnidad != null) solicitud.nombreUnidad = body.nombreUnidad;
    if (body.direccion != null) solicitud.direccion = body.direccion;
    if (body.justificacion != null) solicitud.justificacion = body.justificacion;
    if (body.consistenteItem != null || body.consistentItem != null) solicitud.consistenteItem = String(body.consistenteItem ?? body.consistentItem ?? '');
    if (body.nombreSolicitante != null) solicitud.nombreSolicitante = body.nombreSolicitante;
    if (body.puestoSolicitante != null) solicitud.puestoSolicitante = body.puestoSolicitante;
    if (body.unidadSolicitante != null) solicitud.unidadSolicitante = body.unidadSolicitante;
    if (body.nombreAutoridad != null) solicitud.nombreAutoridad = body.nombreAutoridad;
    if (body.puestoAutoridad != null) solicitud.puestoAutoridad = body.puestoAutoridad;
    if (body.unidadAutoridad != null) solicitud.unidadAutoridad = body.unidadAutoridad;
    if (body.areaId != null) {
      const area = await AppDataSource.getRepository(Area).findOneBy({ id: body.areaId });
      if (area) solicitud.area = area;
    }
    if (body.usuarioAutoridadId != null) {
      const aut = await userRepo.findOneBy({ id: body.usuarioAutoridadId });
      solicitud.usuarioAutoridad = aut || undefined;
    }
    if (body.usuarioEncargadoId != null) {
      const enc = await userRepo.findOneBy({ id: body.usuarioEncargadoId });
      solicitud.usuarioEncargado = enc || undefined;
    }
    if (body.usuarioEncargadoId === null) {
      (solicitud as any).usuarioEncargado = null;
    }
    if (Array.isArray(body.items)) {
      const itemRepo = AppDataSource.getRepository(SiafItem);
      if (solicitud.items?.length) await itemRepo.remove(solicitud.items);
      solicitud.items = body.items.map((itemData: any, index: number) => {
        const item = new SiafItem();
        item.codigo = itemData.codigo;
        item.catalogoOrigen = itemData.catalogoOrigen ?? null;
        item.descripcion = itemData.descripcion;
        item.cantidad = itemData.cantidad;
        item.orden = index;
        return item;
      });
    }
    if (Array.isArray(body.subproductos)) {
      const subRepo = AppDataSource.getRepository(SiafSubproducto);
      if (solicitud.subproductos?.length) await subRepo.remove(solicitud.subproductos);
      solicitud.subproductos = body.subproductos.map((subData: any, index: number) => {
        const sub = new SiafSubproducto();
        sub.codigo = subData.codigo;
        sub.cantidad = subData.cantidad;
        sub.orden = index;
        return sub;
      });
    }
    // Toda edición invalida el cierre o visto bueno anterior. El usuario decide si
    // vuelve a finalizarlo directamente o si lo envía otra vez a revisión.
    if (estadoAntesDeEditar !== 'borrador') {
      solicitud.estado = 'borrador';
      solicitud.aprobadoDireccionDepartamental = false;
    }
    await siafRepo.save(solicitud);

    let bitacoraTrasCorreccion: any[] | null = null;
    if (registrarCorreccion) {
      const newState = {
        justificacion: (body.justificacion ?? solicitud.justificacion ?? '').toString(),
        direccion: (body.direccion ?? solicitud.direccion ?? '').toString(),
        consistenteItem: (body.consistenteItem ?? body.consistentItem ?? solicitud.consistenteItem ?? '').toString(),
        items: (Array.isArray(body.items) ? body.items : (solicitud.items || [])).map((i: any) => ({
          codigo: (i.codigo ?? '').toString(),
          descripcion: (i.descripcion ?? '').toString(),
          cantidad: Number(i.cantidad ?? 0),
        })),
        subproductos: (Array.isArray(body.subproductos) ? body.subproductos : (solicitud.subproductos || [])).map((s: any) => ({
          codigo: (s.codigo ?? '').toString(),
          cantidad: Number(s.cantidad ?? 0),
        })),
      };
      const { detalleAntes, detalleDespues } = oldState
        ? buildDetalleCorreccion(oldState, newState)
        : { detalleAntes: 'Rechazo previo.', detalleDespues: 'Corrección enviada.' };
      const user = await userRepo.findOneBy({ id: userId });
      if (user) {
        const comentarioCorreccion = 'Corrección registrada automáticamente por el sistema.';
        const siafIdVal = Number(solicitud.id);
        if (!isNaN(siafIdVal)) {
          const qr = AppDataSource.createQueryRunner();
          try {
            await qr.connect();
            await qr.startTransaction();
            await qr.query(
              `INSERT INTO siaf_bitacora (siaf_id, usuario_id, tipo, comentario, detalle_antes, detalle_despues) VALUES ($1, $2, 'correccion', $3, $4, $5)`,
              [siafIdVal, user.id, comentarioCorreccion, detalleAntes ?? '', detalleDespues ?? '']
            );
            await qr.commitTransaction();
            const rowsTrasInsert = await qr.query(
              `SELECT id, tipo, comentario, detalle_antes AS "detalleAntes", detalle_despues AS "detalleDespues", fecha, usuario_id FROM siaf_bitacora WHERE siaf_id = $1 ORDER BY fecha DESC`,
              [siafIdVal]
            );
            bitacoraTrasCorreccion = Array.isArray(rowsTrasInsert) ? rowsTrasInsert : [];
            console.log('[SIAF] Bitácora corrección guardada (siaf_id=', siafIdVal, ') filas=', bitacoraTrasCorreccion.length);
          } catch (errInsert: any) {
            await qr.rollbackTransaction().catch(() => {});
            console.error('[SIAF] Error al guardar corrección en bitácora:', errInsert?.message);
          } finally {
            await qr.release();
          }
        }
      }
    }
    try {
      const pdfBuffer = await pdfGeneratorService.generateSiafPdf(solicitud);
      const pdfInfo = await fileStorageService.saveSiafPdf(pdfBuffer, solicitud.correlativo);
      solicitud.pdfPath = pdfInfo.filePath;
      solicitud.pdfHash = pdfInfo.hash;
      solicitud.pdfSize = pdfInfo.size;
      await siafRepo.save(solicitud);
    } catch (_) {}
    let bitacoraActualizada: any[];
    if (bitacoraTrasCorreccion != null) {
      const userIds = [...new Set(bitacoraTrasCorreccion.map((r: any) => r.usuario_id).filter(Boolean))];
      const users = userIds.length ? await userRepo.find({ where: { id: In(userIds) } }) : [];
      const userMap = new Map(users.map((u) => [u.id, { nombres: u.nombres, apellidos: u.apellidos }]));
      bitacoraActualizada = bitacoraTrasCorreccion.map((row: any) => ({
        id: row.id,
        tipo: String(row.tipo || ''),
        comentario: row.comentario ?? null,
        detalleAntes: row.detalleAntes ?? row.detalle_antes ?? null,
        detalleDespues: row.detalleDespues ?? row.detalle_despues ?? null,
        fecha: row.fecha,
        usuario: row.usuario_id ? (userMap.get(row.usuario_id) ?? { nombres: '', apellidos: '' }) : null,
      }));
    } else {
      bitacoraActualizada = await loadBitacoraBySiafId(Number(solicitud.id));
    }
    res.json({ ...solicitud, bitacora: bitacoraActualizada });
  } catch (error) {
    console.error('Error al actualizar SIAF:', error);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
});

// Enviar un SIAF en borrador a revisión de Dirección Departamental (acción opcional del solicitante)
siafRouter.post('/:id/enviar-revision', verifyToken, async (req: Request, res: Response) => {
  try {
    const siafId = parseInt(req.params.id);
    if (isNaN(siafId)) return res.status(400).json({ message: 'ID de solicitud inválido.' });
    const userId = (req as any).user.userId;
    const siafRepo = AppDataSource.getRepository(SiafSolicitud);
    const solicitud = await siafRepo.findOne({
      where: { id: siafId },
      relations: ['usuarioSolicitante'],
    });
    if (!solicitud) return res.status(404).json({ message: 'Solicitud SIAF no encontrada.' });
    if (solicitud.usuarioSolicitante?.id !== userId) {
      return res.status(403).json({ message: 'Solo el solicitante puede enviar esta solicitud a revisión.' });
    }
    if (solicitud.estado !== 'borrador') {
      return res.status(400).json({ message: 'Solo un SIAF en borrador puede enviarse a revisión.' });
    }

    solicitud.estado = 'pendiente';
    await siafRepo.save(solicitud);

    res.json({
      message: 'Solicitud SIAF enviada a revisión.',
      id: solicitud.id,
      estado: solicitud.estado,
    });
  } catch (error) {
    console.error('Error al enviar SIAF a revisión:', error);
    res.status(500).json({ message: 'Error en el servidor al enviar a revisión.' });
  }
});

// Finalizar un SIAF en borrador sin pasar por Dirección Departamental
siafRouter.post('/:id/finalizar', verifyToken, async (req: Request, res: Response) => {
  try {
    const siafId = parseInt(req.params.id);
    if (isNaN(siafId)) return res.status(400).json({ message: 'ID de solicitud inválido.' });
    const userId = (req as any).user.userId;
    const siafRepo = AppDataSource.getRepository(SiafSolicitud);
    const solicitud = await siafRepo.findOne({
      where: { id: siafId },
      relations: ['usuarioSolicitante'],
    });
    if (!solicitud) return res.status(404).json({ message: 'Solicitud SIAF no encontrada.' });
    if (solicitud.usuarioSolicitante?.id !== userId) {
      return res.status(403).json({ message: 'Solo el solicitante puede finalizar esta solicitud.' });
    }
    if (solicitud.estado !== 'borrador') {
      return res.status(400).json({ message: 'Solo un SIAF en borrador puede marcarse como finalizado.' });
    }

    solicitud.estado = 'finalizado';
    await siafRepo.save(solicitud);

    res.json({
      message: 'Solicitud SIAF marcada como finalizada.',
      id: solicitud.id,
      estado: solicitud.estado,
    });
  } catch (error) {
    console.error('Error al finalizar SIAF:', error);
    res.status(500).json({ message: 'Error en el servidor al finalizar el SIAF.' });
  }
});
