const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

// Get MySQL pool from parent app - assume it's passed or create one
let pool;

// Initialize pool from parent or create new connection
router.use((req, res, next) => {
  // Try to get pool from app locals or create new one
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'mysql',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || 'root',
      database: process.env.DB_NAME || 'rental_db',
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  next();
});

// GET all tables
router.get('/tables', async (req, res) => {
  try {
    const [tables] = await pool.query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?",[process.env.DB_NAME || 'rental_db']
    );
    res.json(tables);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET table schema
router.get('/table/:tableName/schema', async (req, res) => {
  try {
    const { tableName } = req.params;
    const [columns] = await pool.query(
      "SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
      [process.env.DB_NAME || 'rental_db', tableName]
    );
    res.json(columns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET table data with pagination and search
router.get('/table/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get columns for search
    const [columns] = await pool.query(
      "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
      [process.env.DB_NAME || 'rental_db', tableName]
    );

    let query = `SELECT * FROM \`${tableName}\``;
    let params = [];

    // Add search clause if search term provided
    if (search && search.trim()) {
      const searchConditions = columns
        .filter(col => ['VARCHAR', 'CHAR', 'TEXT', 'LONGTEXT'].includes(col.DATA_TYPE))
        .map(col => `\`${col.COLUMN_NAME}\` LIKE ?`);

      if (searchConditions.length > 0) {
        query += ` WHERE ${searchConditions.join(' OR ')}`;
        const searchTerm = `%${search}%`;
        params = Array(searchConditions.length).fill(searchTerm);
      }
    }

    // Add pagination
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [data] = await pool.query(query, params);

    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create record
router.post('/table/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const values = req.body;

    const columns = Object.keys(values);
    const placeholders = columns.map(() => '?').join(',');
    const query = `INSERT INTO \`${tableName}\` (\`${columns.join('`,`')}\`) VALUES (${placeholders})`;
    const data = columns.map(col => values[col]);

    const [result] = await pool.query(query, data);
    res.status(201).json({ id: result.insertId, message: 'Record created successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update record
router.put('/table/:tableName/:id', async (req, res) => {
  try {
    const { tableName, id } = req.params;
    const values = req.body;

    // Get primary key column
    const [pkInfo] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_KEY = 'PRI'",
      [process.env.DB_NAME || 'rental_db', tableName]
    );

    if (pkInfo.length === 0) {
      return res.status(400).json({ error: 'Table has no primary key' });
    }

    const pkColumn = pkInfo[0].COLUMN_NAME;
    const columns = Object.keys(values);
    const setClause = columns.map(col => `\`${col}\` = ?`).join(',');
    const data = columns.map(col => values[col]);
    data.push(id);

    const query = `UPDATE \`${tableName}\` SET ${setClause} WHERE \`${pkColumn}\` = ?`;
    await pool.query(query, data);

    res.json({ message: 'Record updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE record
router.delete('/table/:tableName/:id', async (req, res) => {
  try {
    const { tableName, id } = req.params;

    // Get primary key column
    const [pkInfo] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_KEY = 'PRI'",
      [process.env.DB_NAME || 'rental_db', tableName]
    );

    if (pkInfo.length === 0) {
      return res.status(400).json({ error: 'Table has no primary key' });
    }

    const pkColumn = pkInfo[0].COLUMN_NAME;
    const query = `DELETE FROM \`${tableName}\` WHERE \`${pkColumn}\` = ?`;
    await pool.query(query, [id]);

    res.json({ message: 'Record deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET table statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const [tables] = await pool.query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?",
      [process.env.DB_NAME || 'rental_db']
    );

    const stats = {};

    for (const table of tables) {
      const [countResult] = await pool.query(
        `SELECT COUNT(*) as count FROM \`${table.TABLE_NAME}\``
      );
      stats[table.TABLE_NAME] = countResult[0].count;
    }

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
