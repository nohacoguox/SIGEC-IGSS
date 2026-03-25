const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const log = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

let restartCount = 0;
const maxRestarts = 10;

const startServer = () => {
  log('Iniciando servidor React con configuración ultra-estable...');
  
  // Limpiar el puerto antes de iniciar
  const cleanPort = spawn('cmd', ['/c', 'netstat', '-ano', '|', 'findstr', ':3003'], {
    stdio: 'pipe',
    shell: true
  });
  
  cleanPort.stdout.on('data', (data) => {
    const output = data.toString();
    const lines = output.split('\n').filter(line => line.includes(':3003') && line.includes('LISTENING'));
    lines.forEach(line => {
      const pid = line.trim().split(' ').pop();
      if (pid && !isNaN(pid)) {
        log(`Matando proceso en puerto 3003 (PID: ${pid})`);
        spawn('taskkill', ['/F', '/PID', pid], { stdio: 'ignore' });
      }
    });
  });
  
  cleanPort.on('close', () => {
    const env = {
      ...process.env,
      PORT: '3003',
      BROWSER: 'none',
      NODE_OPTIONS: '--max-old-space-size=4096',
      ESLINT_NO_DEV_ERRORS: 'true',
      GENERATE_SOURCEMAP: 'false',
      FAST_REFRESH: 'false',
      WDS_SOCKET_PORT: '0',
      DANGEROUSLY_DISABLE_HOST_CHECK: 'true'
    };
    
    const server = spawn('npm.cmd', ['run', 'start'], {
      cwd: __dirname,
      env: env,
      stdio: 'pipe',
      shell: true
    });
    
    let hasCompiled = false;
    
    server.stdout.on('data', (data) => {
      const output = data.toString();
      log(`[REACT] ${output.trim()}`);
      
      if (output.includes('Compiled successfully!')) {
        hasCompiled = true;
        log('✅ Frontend compilado exitosamente en http://localhost:3003');
      }
      
      if (output.includes('Failed to compile')) {
        log('❌ Error de compilación detectado');
      }
    });
    
    server.stderr.on('data', (data) => {
      const output = data.toString();
      log(`[ERROR] ${output.trim()}`);
    });
    
    server.on('close', (code) => {
      log(`Servidor React cerrado con código: ${code}`);
      
      if (!hasCompiled && restartCount < maxRestarts) {
        restartCount++;
        log(`Reiniciando servidor... (intento ${restartCount}/${maxRestarts})`);
        setTimeout(startServer, 3000);
      } else if (restartCount >= maxRestarts) {
        log('❌ Máximo número de reinicios alcanzado. Saliendo...');
        process.exit(1);
      } else {
        log('Servidor compiló exitosamente anteriormente. Saliendo...');
        process.exit(0);
      }
    });
    
    server.on('error', (error) => {
      log(`❌ Error en el servidor: ${error.message}`);
      if (restartCount < maxRestarts) {
        restartCount++;
        log(`Reiniciando por error... (intento ${restartCount}/${maxRestarts})`);
        setTimeout(startServer, 3000);
      }
    });
    
    // Manejo de señales
    process.on('SIGINT', () => {
      log('Recibida señal SIGINT, cerrando servidor...');
      server.kill('SIGINT');
    });
    
    process.on('SIGTERM', () => {
      log('Recibida señal SIGTERM, cerrando servidor...');
      server.kill('SIGTERM');
    });
  });
};

// Iniciar el servidor
startServer();