const http = require('http');

console.log('Testing backup endpoint...');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/backup/export',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const backup = JSON.parse(data);
      console.log('Backup successful!');
      console.log('Version:', backup.version);
      console.log('Tables:', Object.keys(backup.tables));
      console.log('TDS deposits:', backup.tables.tds_deposits ? backup.tables.tds_deposits.length : 0);
    } catch (err) {
      console.error('Error parsing backup:', err.message);
      console.log('Raw response:', data.substring(0, 500));
    }
  });
});

req.on('error', (err) => {
  console.error('Request error:', err.message);
});

req.end();
