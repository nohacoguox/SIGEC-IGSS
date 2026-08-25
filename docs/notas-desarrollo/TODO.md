# TODO - Mostrar Datos Reales en Dashboard de Administrador

## Tareas Completadas ✅

### 1. Backend - Endpoint de Estadísticas
- [x] Crear endpoint `GET /api/dashboard/stats` en `backend/src/index.ts`
- [x] Implementar conteo de usuarios totales
- [x] Implementar conteo de roles totales
- [x] Configurar respuesta para informes generados (0 por ahora)
- [x] Agregar manejo de errores

### 2. Frontend - Actualización del Dashboard
- [x] Importar `useEffect` y `CircularProgress` en `AdminDashboard.tsx`
- [x] Importar `api` para hacer peticiones HTTP
- [x] Crear interfaz `DashboardStats` para tipado TypeScript
- [x] Agregar estados para:
  - Estadísticas del dashboard
  - Estado de carga (loading)
  - Manejo de errores
- [x] Implementar `useEffect` para obtener datos al montar el componente
- [x] Actualizar valores hardcodeados por datos reales:
  - Total de Usuarios: `{stats.totalUsers}`
  - Total de Roles: `{stats.totalRoles}`
  - Informes Generados: `{stats.totalReports}`
- [x] Agregar indicador de carga mientras se obtienen los datos
- [x] Agregar manejo de errores en la UI

## Próximos Pasos 🔄

### Pruebas
- [x] Verificar que el backend esté corriendo en `http://localhost:3001` ✅
- [x] Verificar que el endpoint `/api/dashboard/stats` funcione correctamente ✅
  - Total de Usuarios: 4 ✅
  - Total de Roles: 2 ✅
  - Informes Generados: 0 ✅
- [ ] Verificar que el frontend esté corriendo en `http://localhost:3002`
- [ ] Iniciar sesión en el dashboard como administrador
- [ ] Verificar que el dashboard muestre los datos reales
- [ ] Verificar que el indicador de carga funcione correctamente

### Instrucciones para Probar
1. Asegúrate de que el backend esté corriendo (ya está activo en `http://localhost:3001`)
2. Inicia el frontend con: `cd frontend; npm start`
3. Abre el navegador en `http://localhost:3002`
4. Inicia sesión con las credenciales de administrador:
   - Código de Empleado: `admin`
   - Contraseña: `admin123`
5. Navega a la sección "Dashboard" (debería ser la vista por defecto)
6. Verifica que los números mostrados sean los datos reales de la base de datos:
   - **Total de Usuarios**: Debería mostrar el número real de usuarios en la BD
   - **Total de Roles**: Debería mostrar el número real de roles en la BD
   - **Informes Generados**: Mostrará 0 (por ahora, hasta implementar sistema de reportes)

### Mejoras Futuras (Opcional)
- [ ] Implementar sistema de reportes para mostrar datos reales en "Informes Generados"
- [ ] Agregar más estadísticas al dashboard (usuarios activos, últimos registros, etc.)
- [ ] Implementar actualización automática de estadísticas cada X minutos
- [ ] Agregar gráficos para visualizar mejor las estadísticas
