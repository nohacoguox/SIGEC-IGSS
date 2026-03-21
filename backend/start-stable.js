const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const log = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

let restartCount = 0;
const maxRestarts = 5;

const startServer = () => {
  log('Iniciando servidor Backend con configuración ultra-estable...');
  
  // Limpiar el puerto antes de iniciar
  const cleanPort = spawn('cmd', ['/c', 'netstat', '-ano', '|', 'findstr', ':3001'], {
    stdio: 'pipe',
    shell: true
  });
  
  cleanPort.stdout.on('data', (data) => {
    const output = data.toString();
    const lines = output.split('\n').filter(line => line.includes(':3001') && line.includes('LISTENING'));
    lines.forEach(line => {
      const pid = line.trim().split(' ').pop();
      if (pid && !isNaN(pid)) {
        log(`Matando proceso en puerto 3001 (PID: ${pid})`);
        spawn('taskkill', ['/F', '/PID', pid], { stdio: 'ignore' });
      }
    });
  });
  
  cleanPort.on('close', () => {
    const env = {
      ...process.env,
      NODE_OPTIONS: '--max-old-space-size=4096'
    };
    
    const server = spawn('npm.cmd', ['run', 'dev'], {
      cwd: __dirname,
      env: env,
      stdio: 'pipe',
      shell: true
    });
    
    let hasStarted = false;
    
    server.stdout.on('data', (data) => {
      const output = data.toString();
      log(`[BACKEND] ${output.trim()}`);
      
      if (output.includes('Servidor corriendo en http://localhost:3001')) {
        hasStarted = true;
        log('✅ Backend iniciado exitosamente en http://localhost:3001');
      }
      
      if (output.includes('Error')) {
        log(`⚠️ Error detectado: ${output.trim()}`);
      }
    });
    
    server.stderr.on('data', (data) => {
      const output = data.toString();
      log(`[ERROR] ${output.trim()}`);
    });
    
    server.on('close', (code) => {
      log(`Servidor Backend cerrado con código: ${code}`);
      
      if (!hasStarted && restartCount < maxRestarts) {
        restartCount++;
        log(`Reiniciando servidor Backend... (intento ${restartCount}/${maxRestarts})`);
        setTimeout(startServer, 5000);
      } else if (restartCount >= maxRestarts) {
        log('❌ Máximo número de reinicios alcanzado. Saliendo...');
        process.exit(1);
      } else {
        log('Servidor Backend se detuvo después de iniciar correctamente. Saliendo...');
        process.exit(0);
      }
    });
    
    server.on('error', (error) => {
      log(`❌ Error en el servidor Backend: ${error.message}`);
      if (restartCount < maxRestarts) {
        restartCount++;
        log(`Reiniciando por error... (intento ${restartCount}/${maxRestarts})`);
        setTimeout(startServer, 5000);
      }
    });
    
    // Manejo de señales
    process.on('SIGINT', () => {
      log('Recibida señal SIGINT, cerrando servidor Backend...');
      server.kill('SIGINT');
    });
    
    process.on('SIGTERM', () => {
      log('Recibida señal SIGTERM, cerrando servidor Backend...');
      server.kill('SIGTERM');
    });
  });
};

// Iniciar el servidor
startServer();