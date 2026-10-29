// ============================================================================
// Hospital Management System - Backend Server
// Built with pure Node.js (http, fs, path, url) and MySQL (mysql2/promise)
//
// REFERENCE LINKS:
// Node.js HTTP:  https://nodejs.org/docs/latest/api/http.html
// Node.js FS:    https://nodejs.org/docs/latest/api/fs.html
// Node.js Path:  https://nodejs.org/docs/latest/api/path.html
// Node.js URL:   https://nodejs.org/docs/latest/api/url.html
// MySQL:         https://dev.mysql.com/doc/
// MySQL2:        https://sidorares.github.io/node-mysql2/docs
// dotenv:        https://github.com/motdotla/dotenv
// HTTP Status:   https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
// REST API:      https://developer.mozilla.org/en-US/docs/Glossary/REST
// ============================================================================

// Load environment variables from the .env file
// Reference: https://github.com/motdotla/dotenv
require('dotenv').config();

// Import built-in Node.js modules and MySQL2 client
// HTTP: https://nodejs.org/api/http.html
// FS:   https://nodejs.org/api/fs.html
// Path: https://nodejs.org/api/path.html
// URL:  https://nodejs.org/api/url.html
// MySQL2: https://sidorares.github.io/node-mysql2/docs
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const mysql = require('mysql2/promise');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Database pool reference (initialized in initializeDatabase)
// MySQL connection pools: https://sidorares.github.io/node-mysql2/docs
let pool;

function setPool(newPool) {
  pool = newPool;
}


// ============================================================================
// MIME Types Dictionary for Static Files
// ============================================================================
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// ============================================================================
// HTTP Helper Functions
// ============================================================================

/**
 * Send JSON response with appropriate status code and headers
 */
function sendJson(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

/**
 * Parse incoming JSON request body
 * Reference: https://nodejs.org/api/http.html#class-httpincomingmessage
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Safeguard against very large payloads (1MB limit)
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => {
      if (!body || body.trim() === '') {
        return resolve({});
      }
      try {
        const parsed = JSON.parse(body);
        resolve(parsed);
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', err => reject(err));
  });
}

/**
 * Serve static files from the public folder
 * Reference: https://nodejs.org/api/fs.html
 */
function serveStaticFile(req, res, pathname) {
  const relativePath = pathname === '/' ? '/index.html' : pathname;
  // Normalize path to prevent path traversal attacks
  const safePath = path.normalize(path.join(PUBLIC_DIR, relativePath));

  if (!safePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 Forbidden');
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size
    });

    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
  });
}

// ============================================================================
// 1. Database Initialization Function
//
// References:
// MySQL CREATE DATABASE:
// https://dev.mysql.com/doc/refman/8.4/en/create-database.html
//
// MySQL CREATE TABLE:
// https://dev.mysql.com/doc/refman/8.4/en/create-table.html
//
// MySQL connection pools:
// https://sidorares.github.io/node-mysql2/docs
// ============================================================================
async function initializeDatabase() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  };

  const dbName = process.env.DB_NAME || 'hospital_db';

  console.log('Connecting to MySQL server...');

  // Step A: Connect to MySQL server without selecting a database
  // Reference: https://sidorares.github.io/node-mysql2/docs
  const connection = await mysql.createConnection(dbConfig);

  // Step B: Create the database if it doesn't exist
  // Reference: https://dev.mysql.com/doc/refman/8.4/en/create-database.html
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  console.log(`Database "${dbName}" verified / created.`);
  await connection.end();

  // Step C: Create a connection pool targeting our hospital database
  // Reference: https://sidorares.github.io/node-mysql2/docs
  pool = mysql.createPool({
    ...dbConfig,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true // Returns MySQL DATE fields as clean 'YYYY-MM-DD' strings
  });

  // Step D: Create Doctors Table
  // Reference: https://dev.mysql.com/doc/refman/8.4/en/create-table.html
  await pool.query(`
    CREATE TABLE IF NOT EXISTS doctors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      specialization VARCHAR(100) NOT NULL,
      time_slot VARCHAR(100) NOT NULL,
      department VARCHAR(100) NOT NULL
    )
  `);

  // Step E: Create Patients Table
  // Reference: https://dev.mysql.com/doc/refman/8.4/en/create-table.html
  await pool.query(`
    CREATE TABLE IF NOT EXISTS patients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      age INT NOT NULL,
      gender VARCHAR(20) NOT NULL,
      contact VARCHAR(20) NOT NULL,
      address VARCHAR(255) NOT NULL,
      department VARCHAR(100) NOT NULL,
      admission_date VARCHAR(20) NOT NULL,
      assigned_doctor VARCHAR(100) NOT NULL,
      status VARCHAR(50) NOT NULL,
      batch VARCHAR(50) DEFAULT 'Morning Batch'
    )
  `);

  // Step F: Create Appointments Table
  // Reference: https://dev.mysql.com/doc/refman/8.4/en/create-table.html
  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      patient_name VARCHAR(100) NOT NULL,
      doctor_name VARCHAR(100) NOT NULL,
      appointment_date VARCHAR(20) NOT NULL,
      appointment_time VARCHAR(20) NOT NULL,
      department VARCHAR(100) NOT NULL,
      status VARCHAR(50) NOT NULL
    )
  `);

  // Step G: Create Beds Table
  // Reference: https://dev.mysql.com/doc/refman/8.4/en/create-table.html
  await pool.query(`
    CREATE TABLE IF NOT EXISTS beds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bed_number VARCHAR(20) NOT NULL UNIQUE,
      ward_name VARCHAR(100) NOT NULL,
      bed_type VARCHAR(50) NOT NULL,
      status VARCHAR(50) NOT NULL,
      patient_id INT NULL,
      patient_name VARCHAR(100) NULL
    )
  `);

  // Step H: Seed Sample Doctors if table is empty
  // SELECT and COUNT reference:
  // https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html
  // INSERT reference:
  // https://dev.mysql.com/doc/refman/8.4/en/insert.html
  const [doctorRows] = await pool.query('SELECT COUNT(*) AS count FROM doctors');
  if (doctorRows[0].count === 0) {
    const sampleDoctors = [
      ['Dr. Sarah Jenkins', 'Cardiologist', '09:00 AM - 01:00 PM', 'Cardiology'],
      ['Dr. Ramesh Patel', 'Neurologist', '10:00 AM - 02:00 PM', 'Neurology'],
      ['Dr. Anita Roy', 'Pediatrician', '01:00 PM - 05:00 PM', 'Pediatrics'],
      ['Dr. John Miller', 'Orthopedic Surgeon', '02:00 PM - 06:00 PM', 'Orthopedics'],
      ['Dr. Priya Sharma', 'General Physician', '08:00 AM - 12:00 PM', 'General Medicine']
    ];
    await pool.query(
      'INSERT INTO doctors (name, specialization, time_slot, department) VALUES ?',
      [sampleDoctors]
    );
    console.log('Sample doctors inserted.');
  }

  // Step I: Seed Sample Beds if table is empty
  // Reference: https://dev.mysql.com/doc/refman/8.4/en/insert.html
  const [bedRows] = await pool.query('SELECT COUNT(*) AS count FROM beds');
  if (bedRows[0].count === 0) {
    const sampleBeds = [
      ['B-101', 'General Ward A', 'Standard', 'Available', null, null],
      ['B-102', 'General Ward A', 'Standard', 'Available', null, null],
      ['B-103', 'General Ward A', 'Standard', 'Available', null, null],
      ['ICU-01', 'Intensive Care Unit', 'ICU', 'Available', null, null],
      ['ICU-02', 'Intensive Care Unit', 'ICU', 'Available', null, null],
      ['SP-201', 'Semi-Private Ward B', 'Semi-Private', 'Available', null, null],
      ['SP-202', 'Semi-Private Ward B', 'Semi-Private', 'Available', null, null],
      ['PVT-301', 'Private Deluxe', 'Private', 'Available', null, null]
    ];
    await pool.query(
      'INSERT INTO beds (bed_number, ward_name, bed_type, status, patient_id, patient_name) VALUES ?',
      [sampleBeds]
    );
    console.log('Sample hospital beds inserted.');
  }

  // Step J: Seed Initial Patients if table is empty
  // Reference: https://dev.mysql.com/doc/refman/8.4/en/insert.html
  const [patientRows] = await pool.query('SELECT COUNT(*) AS count FROM patients');
  if (patientRows[0].count === 0) {
    const samplePatients = [
      ['Alice Johnson', 34, 'Female', '9876543210', '12 Maple Avenue', 'Cardiology', '2026-10-25', 'Dr. Sarah Jenkins', 'Admitted', 'Morning Batch'],
      ['Robert Brown', 52, 'Male', '9123456780', '45 Oak Lane', 'Orthopedics', '2026-10-26', 'Dr. John Miller', 'Waiting', 'Afternoon Batch'],
      ['Clara Smith', 28, 'Female', '9988776655', '78 Pine Road', 'Pediatrics', '2026-10-24', 'Dr. Anita Roy', 'Discharged', 'Evening Batch']
    ];
    await pool.query(
      'INSERT INTO patients (name, age, gender, contact, address, department, admission_date, assigned_doctor, status, batch) VALUES ?',
      [samplePatients]
    );
    console.log('Sample patients inserted.');
  }

  // Step K: Seed Initial Appointments if table is empty
  // Reference: https://dev.mysql.com/doc/refman/8.4/en/insert.html
  const [appointmentRows] = await pool.query('SELECT COUNT(*) AS count FROM appointments');
  if (appointmentRows[0].count === 0) {
    const sampleAppointments = [
      ['Alice Johnson', 'Dr. Sarah Jenkins', '2026-10-28', '10:00 AM', 'Cardiology', 'Confirmed'],
      ['Robert Brown', 'Dr. John Miller', '2026-10-29', '02:30 PM', 'Orthopedics', 'Pending'],
      ['David Wilson', 'Dr. Ramesh Patel', '2026-10-30', '11:00 AM', 'Neurology', 'Cancelled']
    ];
    await pool.query(
      'INSERT INTO appointments (patient_name, doctor_name, appointment_date, appointment_time, department, status) VALUES ?',
      [sampleAppointments]
    );
    console.log('Sample appointments inserted.');
  }

  console.log('Database and tables initialized successfully.');
}

// ============================================================================
// 2. HTTP Request Handler (Pure Node.js REST API & Static Files)
//
// References:
// Node.js HTTP server: https://nodejs.org/api/http.html
// HTTP methods:        https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods
// HTTP status codes:   https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
// REST API:            https://developer.mozilla.org/en-US/docs/Glossary/REST
// ============================================================================
async function requestHandler(req, res) {
  // Support CORS preflight if needed
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // Match URL parameter patterns
  const patientMatch = pathname.match(/^\/api\/patients\/(\d+)$/);
  const bedMatch = pathname.match(/^\/api\/beds\/(\d+)$/);

  // --------------------------------------------------------------------------
  // A. Patient Endpoints
  // --------------------------------------------------------------------------

  // GET /api/patients - Fetch all patients
  if (method === 'GET' && pathname === '/api/patients') {
    try {
      const [rows] = await pool.query('SELECT * FROM patients ORDER BY id DESC');
      return sendJson(res, 200, rows);
    } catch (error) {
      console.error('Error fetching patients:', error);
      return sendJson(res, 500, { error: 'Failed to retrieve patients from database' });
    }
  }

  // GET /api/patients/:id - Fetch a single patient by ID
  if (method === 'GET' && patientMatch) {
    const patientId = patientMatch[1];
    try {
      const [rows] = await pool.query('SELECT * FROM patients WHERE id = ?', [patientId]);
      if (rows.length === 0) {
        return sendJson(res, 404, { error: 'Patient not found' });
      }
      return sendJson(res, 200, rows[0]);
    } catch (error) {
      console.error('Error fetching patient:', error);
      return sendJson(res, 500, { error: 'Failed to retrieve patient details' });
    }
  }

  // POST /api/patients - Add a new patient
  if (method === 'POST' && pathname === '/api/patients') {
    try {
      const body = await parseJsonBody(req);
      const {
        name,
        age,
        gender,
        contact,
        address,
        department,
        admission_date,
        assigned_doctor,
        status,
        batch
      } = body;

      // Simple validation
      if (!name || !age || !gender || !contact || !department || !admission_date || !assigned_doctor || !status) {
        return sendJson(res, 400, { error: 'Please provide all required patient fields' });
      }

      const assignedBatch = batch || 'Morning Batch';

      const [result] = await pool.query(
        `INSERT INTO patients 
         (name, age, gender, contact, address, department, admission_date, assigned_doctor, status, batch) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, age, gender, contact, address || '', department, admission_date, assigned_doctor, status, assignedBatch]
      );

      return sendJson(res, 201, {
        message: 'Patient registered successfully',
        id: result.insertId
      });
    } catch (error) {
      console.error('Error creating patient:', error);
      return sendJson(res, 500, { error: 'Failed to register patient in database' });
    }
  }

  // PUT /api/patients/:id - Update an existing patient
  if (method === 'PUT' && patientMatch) {
    const patientId = patientMatch[1];
    try {
      const body = await parseJsonBody(req);
      const {
        name,
        age,
        gender,
        contact,
        address,
        department,
        admission_date,
        assigned_doctor,
        status,
        batch
      } = body;

      const [result] = await pool.query(
        `UPDATE patients 
         SET name = ?, age = ?, gender = ?, contact = ?, address = ?, department = ?, 
             admission_date = ?, assigned_doctor = ?, status = ?, batch = ? 
         WHERE id = ?`,
        [name, age, gender, contact, address || '', department, admission_date, assigned_doctor, status, batch || 'Morning Batch', patientId]
      );

      if (result.affectedRows === 0) {
        return sendJson(res, 404, { error: 'Patient not found' });
      }

      return sendJson(res, 200, { message: 'Patient updated successfully' });
    } catch (error) {
      console.error('Error updating patient:', error);
      return sendJson(res, 500, { error: 'Failed to update patient' });
    }
  }

  // DELETE /api/patients/:id - Delete a patient
  if (method === 'DELETE' && patientMatch) {
    const patientId = patientMatch[1];
    try {
      // If patient was occupying any bed, free that bed up
      await pool.query(
        'UPDATE beds SET status = ?, patient_id = NULL, patient_name = NULL WHERE patient_id = ?',
        ['Available', patientId]
      );

      const [result] = await pool.query('DELETE FROM patients WHERE id = ?', [patientId]);
      if (result.affectedRows === 0) {
        return sendJson(res, 404, { error: 'Patient not found' });
      }

      return sendJson(res, 200, { message: 'Patient deleted successfully' });
    } catch (error) {
      console.error('Error deleting patient:', error);
      return sendJson(res, 500, { error: 'Failed to delete patient' });
    }
  }

  // --------------------------------------------------------------------------
  // B. Doctor Endpoints
  // --------------------------------------------------------------------------

  // GET /api/doctors - Fetch all doctors
  if (method === 'GET' && pathname === '/api/doctors') {
    try {
      const [rows] = await pool.query('SELECT * FROM doctors ORDER BY id ASC');
      return sendJson(res, 200, rows);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      return sendJson(res, 500, { error: 'Failed to retrieve doctors list' });
    }
  }

  // --------------------------------------------------------------------------
  // C. Appointment Endpoints
  // --------------------------------------------------------------------------

  // GET /api/appointments - Fetch all appointments
  if (method === 'GET' && pathname === '/api/appointments') {
    try {
      const [rows] = await pool.query('SELECT * FROM appointments ORDER BY id DESC');
      return sendJson(res, 200, rows);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      return sendJson(res, 500, { error: 'Failed to retrieve appointments' });
    }
  }

  // POST /api/appointments - Create a new appointment
  if (method === 'POST' && pathname === '/api/appointments') {
    try {
      const body = await parseJsonBody(req);
      const { patient_name, doctor_name, appointment_date, appointment_time, department, status } = body;

      if (!patient_name || !doctor_name || !appointment_date || !appointment_time || !department || !status) {
        return sendJson(res, 400, { error: 'Please provide all appointment details' });
      }

      const [result] = await pool.query(
        `INSERT INTO appointments 
         (patient_name, doctor_name, appointment_date, appointment_time, department, status) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [patient_name, doctor_name, appointment_date, appointment_time, department, status]
      );

      return sendJson(res, 201, {
        message: 'Appointment booked successfully',
        id: result.insertId
      });
    } catch (error) {
      console.error('Error booking appointment:', error);
      return sendJson(res, 500, { error: 'Failed to book appointment' });
    }
  }

  // --------------------------------------------------------------------------
  // D. Bed & Ward Endpoints
  // --------------------------------------------------------------------------

  // GET /api/beds - Fetch all hospital beds
  if (method === 'GET' && pathname === '/api/beds') {
    try {
      const [rows] = await pool.query('SELECT * FROM beds ORDER BY id ASC');
      return sendJson(res, 200, rows);
    } catch (error) {
      console.error('Error fetching beds:', error);
      return sendJson(res, 500, { error: 'Failed to retrieve bed status' });
    }
  }

  // PUT /api/beds/:id - Update bed allocation (assign or release)
  if (method === 'PUT' && bedMatch) {
    const bedId = bedMatch[1];
    try {
      const body = await parseJsonBody(req);
      const { status, patient_id, patient_name } = body;

      // Check if the bed exists
      const [existing] = await pool.query('SELECT * FROM beds WHERE id = ?', [bedId]);
      if (existing.length === 0) {
        return sendJson(res, 404, { error: 'Bed not found' });
      }

      const currentBed = existing[0];

      // Backend validation: prevent assigning patient if bed is already occupied by someone else
      if (status === 'Occupied' && currentBed.status === 'Occupied' && currentBed.patient_id !== patient_id) {
        return sendJson(res, 400, {
          error: `Bed ${currentBed.bed_number} is already occupied by ${currentBed.patient_name || 'another patient'}.`
        });
      }

      // Update bed record
      await pool.query(
        'UPDATE beds SET status = ?, patient_id = ?, patient_name = ? WHERE id = ?',
        [
          status || 'Available',
          status === 'Available' ? null : (patient_id || null),
          status === 'Available' ? null : (patient_name || null),
          bedId
        ]
      );

      return sendJson(res, 200, { message: 'Bed allocation updated successfully' });
    } catch (error) {
      console.error('Error updating bed allocation:', error);
      return sendJson(res, 500, { error: 'Failed to update bed allocation' });
    }
  }

  // --------------------------------------------------------------------------
  // E. Unmatched API routes
  // --------------------------------------------------------------------------
  if (pathname.startsWith('/api/')) {
    return sendJson(res, 404, { error: 'API endpoint not found' });
  }

  // --------------------------------------------------------------------------
  // F. Static File Serving (HTML, CSS, JS, etc.)
  // --------------------------------------------------------------------------
  if (method === 'GET' || method === 'HEAD') {
    return serveStaticFile(req, res, pathname);
  }

  return sendJson(res, 405, { error: 'Method Not Allowed' });
}

// ============================================================================
// 3. Server Startup
//    Only starts listening on port after database initialization is complete
//
// Reference:
// Node.js HTTP server: https://nodejs.org/api/http.html
// ============================================================================
async function startServer() {
  try {
    await initializeDatabase();

    const server = http.createServer(requestHandler);

    server.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(` Hospital Management System running at:`);
      console.log(` http://localhost:${PORT}`);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error('Failed to initialize database or start server:');
    console.error(error.message);
    console.log('\nPlease check:');
    console.log('1. Is MySQL server running?');
    console.log('2. Are DB credentials correct in .env (DB_USER, DB_PASSWORD)?');
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = {
  requestHandler,
  startServer,
  sendJson,
  parseJsonBody,
  serveStaticFile,
  setPool
};

