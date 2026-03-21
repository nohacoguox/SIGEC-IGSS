const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

// Primero necesitamos obtener un token válido
async function login() {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      codigoEmpleado: 'admin',
      password: 'admin123'
    });
    return response.data.token;
  } catch (error) {
    console.error('Error en login:', error.response?.data || error.message);
    throw error;
  }
}

async function testAreas(token) {
  console.log('\n========== TESTING ÁREAS ==========\n');
  
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  try {
    // 1. GET - Listar áreas
    console.log('1. GET /api/areas - Listar áreas');
    const listResponse = await axios.get(`${BASE_URL}/areas`, config);
    console.log(`✅ Áreas encontradas: ${listResponse.data.length}`);
    console.log('Primeras 3 áreas:', listResponse.data.slice(0, 3).map(a => a.nombre));

    // 2. POST - Crear nueva área
    console.log('\n2. POST /api/areas - Crear nueva área');
    const newArea = {
      nombre: 'Área de Prueba Test',
      descripcion: 'Esta es un área de prueba creada por el script de testing',
      activo: true
    };
    const createResponse = await axios.post(`${BASE_URL}/areas`, newArea, config);
    console.log(`✅ Área creada con ID: ${createResponse.data.id}`);
    const areaId = createResponse.data.id;

    // 3. PUT - Actualizar área
    console.log('\n3. PUT /api/areas/:id - Actualizar área');
    const updateData = {
      nombre: 'Área de Prueba Test Actualizada',
      descripcion: 'Descripción actualizada',
      activo: true
    };
    const updateResponse = await axios.put(`${BASE_URL}/areas/${areaId}`, updateData, config);
    console.log(`✅ Área actualizada: ${updateResponse.data.nombre}`);

    // 4. DELETE - Eliminar área
    console.log('\n4. DELETE /api/areas/:id - Eliminar área');
    await axios.delete(`${BASE_URL}/areas/${areaId}`, config);
    console.log(`✅ Área eliminada correctamente`);

    // 5. Verificar que fue eliminada
    console.log('\n5. Verificar eliminación');
    const finalList = await axios.get(`${BASE_URL}/areas`, config);
    const exists = finalList.data.find(a => a.id === areaId);
    if (!exists) {
      console.log('✅ Confirmado: Área eliminada de la base de datos');
    } else {
      console.log('❌ Error: Área aún existe en la base de datos');
    }

  } catch (error) {
    console.error('❌ Error en test de áreas:', error.response?.data || error.message);
  }
}

async function testPuestos(token) {
  console.log('\n========== TESTING PUESTOS ==========\n');
  
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  try {
    // 1. GET - Listar todos los puestos
    console.log('1. GET /api/puestos/all - Listar todos los puestos');
    const listResponse = await axios.get(`${BASE_URL}/puestos/all`, config);
    console.log(`✅ Puestos encontrados: ${listResponse.data.length}`);
    console.log('Primeros 5 puestos:', listResponse.data.slice(0, 5).map(p => p.nombre));

    // 2. GET - Listar solo puestos activos
    console.log('\n2. GET /api/puestos - Listar puestos activos');
    const activeResponse = await axios.get(`${BASE_URL}/puestos`, config);
    console.log(`✅ Puestos activos: ${activeResponse.data.length}`);

    // 3. POST - Crear nuevo puesto
    console.log('\n3. POST /api/puestos - Crear nuevo puesto');
    const newPuesto = {
      nombre: 'PUESTO DE PRUEBA TEST',
      activo: true
    };
    const createResponse = await axios.post(`${BASE_URL}/puestos`, newPuesto, config);
    console.log(`✅ Puesto creado con ID: ${createResponse.data.id}`);
    const puestoId = createResponse.data.id;

    // 4. PUT - Actualizar puesto
    console.log('\n4. PUT /api/puestos/:id - Actualizar puesto');
    const updateData = {
      nombre: 'PUESTO DE PRUEBA TEST ACTUALIZADO',
      activo: false
    };
    const updateResponse = await axios.put(`${BASE_URL}/puestos/${puestoId}`, updateData, config);
    console.log(`✅ Puesto actualizado: ${updateResponse.data.nombre}`);
    console.log(`   Estado activo: ${updateResponse.data.activo}`);

    // 5. DELETE - Eliminar puesto
    console.log('\n5. DELETE /api/puestos/:id - Eliminar puesto');
    await axios.delete(`${BASE_URL}/puestos/${puestoId}`, config);
    console.log(`✅ Puesto eliminado correctamente`);

    // 6. Verificar que fue eliminado
    console.log('\n6. Verificar eliminación');
    const finalList = await axios.get(`${BASE_URL}/puestos/all`, config);
    const exists = finalList.data.find(p => p.id === puestoId);
    if (!exists) {
      console.log('✅ Confirmado: Puesto eliminado de la base de datos');
    } else {
      console.log('❌ Error: Puesto aún existe en la base de datos');
    }

  } catch (error) {
    console.error('❌ Error en test de puestos:', error.response?.data || error.message);
  }
}

async function testErrorHandling(token) {
  console.log('\n========== TESTING MANEJO DE ERRORES ==========\n');
  
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  try {
    // Test 1: Crear área duplicada
    console.log('1. Intentar crear área con nombre duplicado');
    const area1 = {
      nombre: 'ÁREA DUPLICADA TEST',
      descripcion: 'Primera área',
      activo: true
    };
    await axios.post(`${BASE_URL}/areas`, area1, config);
    
    try {
      await axios.post(`${BASE_URL}/areas`, area1, config);
      console.log('❌ Error: Debería haber rechazado el duplicado');
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('✅ Correctamente rechazó área duplicada:', error.response.data.message);
      } else {
        console.log('❌ Error inesperado:', error.response?.data);
      }
    }

    // Limpiar
    const areas = await axios.get(`${BASE_URL}/areas`, config);
    const areaToDelete = areas.data.find(a => a.nombre === 'ÁREA DUPLICADA TEST');
    if (areaToDelete) {
      await axios.delete(`${BASE_URL}/areas/${areaToDelete.id}`, config);
    }

    // Test 2: Crear puesto duplicado
    console.log('\n2. Intentar crear puesto con nombre duplicado');
    const puesto1 = {
      nombre: 'PUESTO DUPLICADO TEST',
      activo: true
    };
    await axios.post(`${BASE_URL}/puestos`, puesto1, config);
    
    try {
      await axios.post(`${BASE_URL}/puestos`, puesto1, config);
      console.log('❌ Error: Debería haber rechazado el duplicado');
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('✅ Correctamente rechazó puesto duplicado:', error.response.data.message);
      } else {
        console.log('❌ Error inesperado:', error.response?.data);
      }
    }

    // Limpiar
    const puestos = await axios.get(`${BASE_URL}/puestos/all`, config);
    const puestoToDelete = puestos.data.find(p => p.nombre === 'PUESTO DUPLICADO TEST');
    if (puestoToDelete) {
      await axios.delete(`${BASE_URL}/puestos/${puestoToDelete.id}`, config);
    }

    // Test 3: Actualizar área inexistente
    console.log('\n3. Intentar actualizar área inexistente');
    try {
      await axios.put(`${BASE_URL}/areas/99999`, { nombre: 'Test' }, config);
      console.log('❌ Error: Debería haber rechazado ID inexistente');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Correctamente rechazó área inexistente:', error.response.data.message);
      } else {
        console.log('❌ Error inesperado:', error.response?.data);
      }
    }

    // Test 4: Eliminar puesto inexistente
    console.log('\n4. Intentar eliminar puesto inexistente');
    try {
      await axios.delete(`${BASE_URL}/puestos/99999`, config);
      console.log('❌ Error: Debería haber rechazado ID inexistente');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Correctamente rechazó puesto inexistente:', error.response.data.message);
      } else {
        console.log('❌ Error inesperado:', error.response?.data);
      }
    }

  } catch (error) {
    console.error('❌ Error en test de manejo de errores:', error.response?.data || error.message);
  }
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   TESTING CRUD DE ÁREAS Y PUESTOS - Portal IGSS       ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  try {
    console.log('\n🔐 Obteniendo token de autenticación...');
    const token = await login();
    console.log('✅ Token obtenido exitosamente\n');

    await testAreas(token);
    await testPuestos(token);
    await testErrorHandling(token);

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║              ✅ TODOS LOS TESTS COMPLETADOS            ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ Error fatal en la ejecución de tests:', error.message);
    process.exit(1);
  }
}

runAllTests();
