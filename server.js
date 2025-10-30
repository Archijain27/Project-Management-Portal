const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 10000;

// PostgreSQL Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to PostgreSQL database:', err.stack);
  } else {
    console.log('Successfully connected to PostgreSQL database');
    release();
  }
});

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));

// Database initialization function
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ===================== BASE TABLES =====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name TEXT,
        owner_email TEXT,
        colleagues TEXT DEFAULT '[]',
        progress INTEGER DEFAULT 0,
        project_title TEXT,
        notes TEXT,
        colleague_name TEXT,
        colleague_phone TEXT,
        colleague_email TEXT,
        colleague_address1 TEXT,
        colleague_address2 TEXT,
        colleague_address3 TEXT,
        your_name TEXT,
        your_phone TEXT,
        your_email TEXT,
        your_address1 TEXT,
        your_address2 TEXT,
        your_address3 TEXT,
        objectives TEXT,
        timeline TEXT,
        primary_audience TEXT,
        secondary_audience TEXT,
        call_action TEXT,
        competition TEXT,
        graphics TEXT,
        photography TEXT,
        multimedia TEXT,
        other_info TEXT,
        client_name TEXT,
        client_comments TEXT,
        approval_date TEXT,
        approval_signature TEXT,
        idea TEXT,
        career_goals TEXT,
        future_work TEXT,
        deadlines TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS colleagues (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id),
        name TEXT,
        email TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        id SERIAL PRIMARY KEY,
        colleague_email TEXT,
        date TEXT,
        description TEXT
      )
    `);

    // ===================== ADDITIONAL TABLES =====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS ideas (
        id SERIAL PRIMARY KEY,
        user_email TEXT REFERENCES users(email),
        title TEXT,
        content TEXT,
        category TEXT DEFAULT 'general',
        created_date TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        user_email TEXT REFERENCES users(email),
        title TEXT,
        content TEXT,
        created_date TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS career_goals (
        id SERIAL PRIMARY KEY,
        user_email TEXT REFERENCES users(email),
        title TEXT,
        description TEXT,
        progress INTEGER DEFAULT 0,
        goal_type TEXT DEFAULT 'general',
        target_date TEXT,
        created_date TEXT,
        total_stages INTEGER DEFAULT 5,
        current_stage INTEGER DEFAULT 0,
        start_date TEXT,
        stage_description TEXT
      )
    `);

    // ===================== STAGE HISTORY TABLE =====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS career_stage_history (
        id SERIAL PRIMARY KEY,
        goal_id INTEGER REFERENCES career_goals(id) ON DELETE CASCADE,
        stage INTEGER,
        description TEXT,
        updated_date TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS future_work (
        id SERIAL PRIMARY KEY,
        user_email TEXT REFERENCES users(email),
        title TEXT,
        description TEXT,
        priority TEXT DEFAULT 'medium',
        timeline TEXT,
        created_date TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS deadlines (
        id SERIAL PRIMARY KEY,
        user_email TEXT REFERENCES users(email),
        title TEXT,
        description TEXT,
        due_date TEXT,
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'pending',
        created_date TEXT
      )
    `);

    // ===================== ENHANCED CALENDAR EVENTS TABLE =====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id SERIAL PRIMARY KEY,
        user_email TEXT REFERENCES users(email),
        title TEXT,
        description TEXT,
        event_date TEXT,
        start_time TEXT,
        end_time TEXT,
        location TEXT,
        category TEXT DEFAULT 'Work',
        attendees TEXT,
        reminder INTEGER DEFAULT 15,
        is_all_day INTEGER DEFAULT 0,
        recurrence TEXT DEFAULT 'none',
        recurrence_end TEXT,
        show_as TEXT DEFAULT 'busy',
        priority TEXT DEFAULT 'normal',
        is_online INTEGER DEFAULT 0,
        meeting_link TEXT,
        attachments TEXT,
        repeat_weekly INTEGER DEFAULT 0,
        created_date TEXT,
        modified_date TEXT
      )
    `);

    // ===================== PROFILE TABLE =====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id SERIAL PRIMARY KEY,
        user_email TEXT UNIQUE REFERENCES users(email),
        full_name TEXT,
        designation TEXT,
        department TEXT,
        institution TEXT,
        office_address TEXT,
        official_email TEXT,
        alternate_email TEXT,
        phone TEXT,
        website TEXT,
        degrees TEXT,
        employment TEXT,
        research_keywords TEXT,
        research_description TEXT,
        scholar_link TEXT,
        courses TEXT,
        grants TEXT,
        professional_activities TEXT,
        awards TEXT,
        skills TEXT,
        outreach_service TEXT,
        created_date TEXT,
        modified_date TEXT
      )
    `);

    await client.query('COMMIT');
    console.log('Database tables initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', error);
  } finally {
    client.release();
  }
}

// Initialize database on startup
initializeDatabase();

// ===================== AUTH API WITH PASSWORD HASHING =====================

// REGISTER endpoint
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
 
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }
 
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters long." });
  }

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
   
    const result = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email",
      [email.toLowerCase().trim(), hashedPassword]
    );
    
    res.json({
      success: true,
      id: result.rows[0].id,
      email: result.rows[0].email,
      message: "Account created successfully!"
    });
  } catch (error) {
    console.error('Signup error:', error);
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ success: false, message: "User already exists." });
    }
    res.status(500).json({ success: false, message: "Server error during signup." });
  }
});

// SIGNUP endpoint (backward compatibility)
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
 
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }
 
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters long." });
  }

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
   
    const result = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email",
      [email.toLowerCase().trim(), hashedPassword]
    );
    
    res.json({
      success: true,
      id: result.rows[0].id,
      email: result.rows[0].email,
      message: "Account created successfully!"
    });
  } catch (error) {
    console.error('Signup error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ success: false, message: "User already exists." });
    }
    res.status(500).json({ success: false, message: "Server error during signup." });
  }
});

// LOGIN endpoint
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
 
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    );
   
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid credentials." });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
   
    if (!passwordMatch) {
      return res.status(400).json({ success: false, message: "Invalid credentials." });
    }
   
    res.json({
      success: true,
      email: user.email,
      message: "Login successful!"
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: "Login failed." });
  }
});

// ===================== PROJECTS API WITH PROGRESS =====================
app.post("/projects", async (req, res) => {
  const { name, owner_email, colleagues, progress } = req.body;
 
  if (!name || !owner_email) {
    return res.status(400).json({ error: "Project name and owner email are required." });
  }
 
  try {
    const result = await pool.query(
      "INSERT INTO projects (name, owner_email, colleagues, progress) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, owner_email, colleagues || "[]", progress || 0]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Project creation error:', error);
    res.status(500).json({ error: "Error creating project." });
  }
});

app.get("/projects/:email", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM projects WHERE owner_email = $1",
      [req.params.email]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: "Error fetching projects." });
  }
});

app.put("/projects/:id", async (req, res) => {
  const { name, colleagues, progress } = req.body;
  try {
    const result = await pool.query(
      "UPDATE projects SET name = $1, colleagues = $2, progress = $3 WHERE id = $4",
      [name, colleagues, progress !== undefined ? progress : 0, req.params.id]
    );
    res.json({ updated: result.rowCount });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: "Error updating project." });
  }
});

app.delete("/projects/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM projects WHERE id = $1", [req.params.id]);
    res.json({ deleted: result.rowCount });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: "Error deleting project." });
  }
});

// ===================== MEETINGS API =====================
app.post("/meetings", async (req, res) => {
  const { colleague_email, date, description } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO meetings (colleague_email, date, description) VALUES ($1, $2, $3) RETURNING *",
      [colleague_email, date, description]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ error: "Error creating meeting." });
  }
});

app.get("/meetings/:email", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM meetings WHERE colleague_email = $1",
      [req.params.email]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching meetings:', error);
    res.status(500).json({ error: "Error fetching meetings." });
  }
});

// ===================== PROJECT DESCRIPTION API =====================
app.get("/projects/:id/description", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM projects WHERE id = $1",
      [req.params.id]
    );
    res.json(result.rows[0] || {});
  } catch (error) {
    console.error('Error fetching description:', error);
    res.status(500).json({ error: "Error fetching description." });
  }
});

app.put("/projects/:id/description", async (req, res) => {
  const { 
    projectTitle, notes, colleagueName, colleaguePhone, colleagueEmail, 
    colleagueAddress1, colleagueAddress2, colleagueAddress3, yourName, 
    yourPhone, yourEmail, yourAddress1, yourAddress2, yourAddress3, 
    objectives, timeline, primaryAudience, secondaryAudience, callAction, 
    competition, graphics, photography, multimedia, otherInfo, clientName, 
    clientComments, approvalDate, approvalSignature 
  } = req.body;
 
  try {
    const result = await pool.query(
      `UPDATE projects SET
        project_title = $1, notes = $2, colleague_name = $3, colleague_phone = $4, colleague_email = $5,
        colleague_address1 = $6, colleague_address2 = $7, colleague_address3 = $8,
        your_name = $9, your_phone = $10, your_email = $11, your_address1 = $12, your_address2 = $13, your_address3 = $14,
        objectives = $15, timeline = $16, primary_audience = $17, secondary_audience = $18, call_action = $19,
        competition = $20, graphics = $21, photography = $22, multimedia = $23, other_info = $24,
        client_name = $25, client_comments = $26, approval_date = $27, approval_signature = $28
        WHERE id = $29`,
      [
        projectTitle, notes, colleagueName, colleaguePhone, colleagueEmail, 
        colleagueAddress1, colleagueAddress2, colleagueAddress3, yourName, 
        yourPhone, yourEmail, yourAddress1, yourAddress2, yourAddress3, 
        objectives, timeline, primaryAudience, secondaryAudience, callAction, 
        competition, graphics, photography, multimedia, otherInfo, clientName, 
        clientComments, approvalDate, approvalSignature, req.params.id
      ]
    );
    res.json({ updated: result.rowCount });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: "Error updating description." });
  }
});

// ===================== IDEAS API =====================
app.get("/ideas/:email", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM ideas WHERE user_email = $1 ORDER BY created_date DESC", 
      [req.params.email]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching ideas:', error);
    res.status(500).json({ error: "Error fetching ideas." });
  }
});

app.post("/ideas", async (req, res) => {
  const { user_email, title, content, category, created_date } = req.body;
  const date = created_date || new Date().toISOString();
  try {
    const result = await pool.query(
      "INSERT INTO ideas (user_email, title, content, category, created_date) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [user_email, title, content, category || 'general', date]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating idea:', error);
    res.status(500).json({ error: "Error creating idea." });
  }
});

app.put("/ideas/:id", async (req, res) => {
  const { title, content, category } = req.body;
  try {
    const result = await pool.query(
      "UPDATE ideas SET title = $1, content = $2, category = $3 WHERE id = $4",
      [title, content, category, req.params.id]
    );
    res.json({ updated: result.rowCount });
  } catch (error) {
    console.error('Error updating idea:', error);
    res.status(500).json({ error: "Error updating idea." });
  }
});

app.delete("/ideas/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM ideas WHERE id = $1", [req.params.id]);
    res.json({ deleted: result.rowCount });
  } catch (error) {
    console.error('Error deleting idea:', error);
    res.status(500).json({ error: "Error deleting idea." });
  }
});

// ===================== NOTES API =====================
app.get("/notes/:email", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM notes WHERE user_email = $1 ORDER BY created_date DESC", 
      [req.params.email]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: "Error fetching notes." });
  }
});

app.post("/notes", async (req, res) => {
  const { user_email, title, content, created_date } = req.body;
  const date = created_date || new Date().toISOString();
  try {
    const result = await pool.query(
      "INSERT INTO notes (user_email, title, content, created_date) VALUES ($1, $2, $3, $4) RETURNING *",
      [user_email, title, content, date]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: "Error creating note." });
  }
});

app.put("/notes/:id", async (req, res) => {
  const { title, content } = req.body;
  try {
    const result = await pool.query(
      "UPDATE notes SET title = $1, content = $2 WHERE id = $3",
      [title, content, req.params.id]
    );
    res.json({ updated: result.rowCount });
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: "Error updating note." });
  }
});

app.delete("/notes/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM notes WHERE id = $1", [req.params.id]);
    res.json({ deleted: result.rowCount });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: "Error deleting note." });
  }
});

// ===================== CAREER GOALS API WITH STAGE HISTORY =====================
app.get("/career_goals/:email", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM career_goals WHERE user_email = $1 ORDER BY created_date DESC", 
      [req.params.email]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching career goals:', error);
    res.status(500).json({ error: "Error fetching career goals." });
  }
});

app.get("/career/:email", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM career_goals WHERE user_email = $1 ORDER BY created_date DESC", 
      [req.params.email]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching career goals:', error);
    res.status(500).json({ error: "Error fetching career goals." });
  }
});

app.post("/career_goals", async (req, res) => {
  const { 
    user_email, title, description, progress, goal_type, target_date, 
    total_stages, current_stage, start_date, stage_description, created_date 
  } = req.body;
  const date = created_date || new Date().toISOString();
  
  try {
    const result = await pool.query(
      `INSERT INTO career_goals (
        user_email, title, description, progress, goal_type, target_date, 
        total_stages, current_stage, start_date, stage_description, created_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        user_email, title, description, progress || 0, goal_type || 'general', 
        target_date, total_stages || 5, current_stage || 0, start_date, 
        stage_description, date
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating career goal:', error);
    res.status(500).json({ error: "Error creating career goal." });
  }
});

app.put("/career_goals/:id", async (req, res) => {
  const { 
    title, description, progress, goal_type, target_date, 
    total_stages, current_stage, start_date, stage_description 
  } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE career_goals SET 
        title = $1, description = $2, progress = $3, goal_type = $4, 
        target_date = $5, total_stages = $6, current_stage = $7, 
        start_date = $8, stage_description = $9 
      WHERE id = $10`,
      [
        title, description, progress, goal_type, target_date, 
        total_stages, current_stage, start_date, stage_description, 
        req.params.id
      ]
    );
    res.json({ updated: result.rowCount });
  } catch (error) {
    console.error('Error updating career goal:', error);
    res.status(500).json({ error: "Error updating career goal." });
  }
});

app.delete("/career_goals/:id", async (req, res) => {
  try {
    // Delete history entries first (CASCADE should handle this, but being explicit)
    await pool.query("DELETE FROM career_stage_history WHERE goal_id = $1", [req.params.id]);
    
    // Delete the goal
    const result = await pool.query("DELETE FROM career_goals WHERE id = $1", [req.params.id]);
    res.json({ deleted: result.rowCount });
  } catch (error) {
    console.error('Error deleting career goal:', error);
    res.status(500).json({ error: "Error deleting career goal." });
  }
});

// ===================== STAGE HISTORY API =====================
app.get("/career_goals/:id/history", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM career_stage_history WHERE goal_id = $1 ORDER BY stage ASC, updated_date DESC",
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching stage history:', error);
    res.status(500).json({ error: "Error fetching stage history." });
  }
});

app.post("/career_goals/:id/history", async (req, res) => {
  const { stage, description } = req.body;
  const updated_date = new Date().toISOString();
  
  try {
    const result = await pool.query(
      "INSERT INTO career_stage_history (goal_id, stage, description, updated_date) VALUES ($1, $2, $3, $4) RETURNING *",
      [req.params.id, stage, description, updated_date]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding stage history:', error);
    res.status(500).json({ error: "Error adding stage history." });
  }
});

app.delete("/career_goals/:goalId/history/:historyId", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM career_stage_history WHERE id = $1 AND goal_id = $2",
      [req.params.historyId, req.params.goalId]
    );
    res.json({ deleted: result.rowCount });
  } catch (error) {
    console.error('Error deleting history entry:', error);
    res.status(500).json({ error: "Error deleting history entry." });
  }
});

// ===================== FUTURE WORK API =====================
app.get("/future_work/:email", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM future_work WHERE user_email = $1 ORDER BY created_date DESC", 
      [req.params.email]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching future work:', error);
    res.status(500).json({ error: "Error fetching future work." });
  }
});

app.get("/future/:email", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM future_work WHERE user_email = $1 ORDER BY created_date DESC", 
      [req.params.email]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching future work:', error);
    res.status(500).json({ error: "Error fetching future work." });
  }
});

app.post("/future_work", async (req, res) => {
  const { user_email, title, description, priority, timeline, created_date } = req.body;
  const date = created_date || new Date().toISOString();
  
  try {
    const result = await pool.query(
      "INSERT INTO future_work (user_email, title, description, priority, timeline, created_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [user_email, title, description, priority || 'medium', timeline, date]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating future work:', error);
    res.status(500).json({ error: "Error creating future work." });
  }
});

app.put("/future_work/:id", async (req, res) => {
  const { title, description, priority, timeline } = req.body;
  try {
    const result = await pool.query(
      "UPDATE future_work SET title = $1, description = $2, priority = $3, timeline = $4 WHERE id = $5",
      [title, description, priority, timeline, req.params.id]
    );
    res.json({ updated: result.rowCount });
  } catch (error) {
    console.error('Error updating future work:', error);
    res.status(500).json({ error: "Error updating future work." });
  }
});

app.delete("/future_work/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM future_work WHERE id = $1", [req.params.id]);
    res.json({ deleted: result.rowCount });
  } catch (error) {
    console.error('Error deleting future work:', error);
    res.status(500).json({ error: "Error deleting future work." });
  }
});

// ===================== DEADLINES API =====================
app.get("/deadlines/:email", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM deadlines WHERE user_email = $1 ORDER BY due_date ASC", 
      [req.params.email]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching deadlines:', error);
    res.status(500).json({ error: "Error fetching deadlines." });
  }
});

app.post("/deadlines", async (req, res) => {
  const { user_email, title, description, due_date, priority, status, created_date } = req.body;
  const date = created_date || new Date().toISOString();
  
  try {
    const result = await pool.query(
      "INSERT INTO deadlines (user_email, title, description, due_date, priority, status, created_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [user_email, title, description, due_date, priority || 'medium', status || 'pending', date]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating deadline:', error);
    res.status(500).json({ error: "Error creating deadline." });
  }
});

app.put("/deadlines/:id", async (req, res) => {
  const { title, description, due_date, priority, status } = req.body;
  try {
    const result = await pool.query(
      "UPDATE deadlines SET title = $1, description = $2, due_date = $3, priority = $4, status = $5 WHERE id = $6",
      [title, description, due_date, priority, status, req.params.id]
    );
    res.json({ updated: result.rowCount });
  } catch (error) {
    console.error('Error updating deadline:', error);
    res.status(500).json({ error: "Error updating deadline." });
  }
});

app.delete("/deadlines/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM deadlines WHERE id = $1", [req.params.id]);
    res.json({ deleted: result.rowCount });
  } catch (error) {
    console.error('Error deleting deadline:', error);
    res.status(500).json({ error: "Error deleting deadline." });
  }
});

// ===================== ENHANCED CALENDAR EVENTS API =====================
app.get("/events/:email", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        id, title, description, event_date as date, start_time as start, end_time as end, 
        location, category, attendees, reminder, is_all_day as isAllDay, recurrence,
        recurrence_end as recurrenceEnd, show_as as showAs, priority, is_online as isOnline,
        meeting_link as meetingLink, attachments, repeat_weekly as repeatWeekly,
        created_date as createdDate, modified_date as modifiedDate
      FROM calendar_events WHERE user_email = $1 ORDER BY event_date ASC, start_time ASC`,
      [req.params.email]
    );
    
    const events = result.rows.map(row => ({
      ...row,
      isAllDay: Boolean(row.isallday),
      isOnline: Boolean(row.isonline),
      repeatWeekly: Boolean(row.repeatweekly)
    }));
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: "Error fetching events." });
  }
});

app.post("/events", async (req, res) => {
  const { 
    userEmail, title, description, date, start, end, location, category, 
    attendees, reminder, isAllDay, recurrence, recurrenceEnd, showAs, 
    priority, isOnline, meetingLink, attachments, repeatWeekly 
  } = req.body;
  
  const created_date = new Date().toISOString();
  const modified_date = created_date;
  
  try {
    const result = await pool.query(
      `INSERT INTO calendar_events (
        user_email, title, description, event_date, start_time, end_time, location, category, 
        attendees, reminder, is_all_day, recurrence, recurrence_end, show_as, priority, 
        is_online, meeting_link, attachments, repeat_weekly, created_date, modified_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) RETURNING *`,
      [
        userEmail, title, description, date, start, end, location, category || 'Work', 
        attendees, reminder || 15, isAllDay ? 1 : 0, recurrence || 'none', recurrenceEnd, 
        showAs || 'busy', priority || 'normal', isOnline ? 1 : 0, meetingLink, 
        attachments, repeatWeekly ? 1 : 0, created_date, modified_date
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: "Error creating event." });
  }
});

app.put("/events/:id", async (req, res) => {
  const { 
    title, description, date, start, end, location, category, attendees, 
    reminder, isAllDay, recurrence, recurrenceEnd, showAs, priority, 
    isOnline, meetingLink, attachments, repeatWeekly 
  } = req.body;
  
  const modified_date = new Date().toISOString();
  
  try {
    const result = await pool.query(
      `UPDATE calendar_events SET 
        title = $1, description = $2, event_date = $3, start_time = $4, end_time = $5, 
        location = $6, category = $7, attendees = $8, reminder = $9, is_all_day = $10, 
        recurrence = $11, recurrence_end = $12, show_as = $13, priority = $14, 
        is_online = $15, meeting_link = $16, attachments = $17, repeat_weekly = $18, 
        modified_date = $19
      WHERE id = $20`,
      [
        title, description, date, start, end, location, category, attendees, 
        reminder, isAllDay ? 1 : 0, recurrence, recurrenceEnd, showAs, priority, 
        isOnline ? 1 : 0, meetingLink, attachments, repeatWeekly ? 1 : 0, 
        modified_date, req.params.id
      ]
    );
    res.json({ updated: result.rowCount });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: "Error updating event." });
  }
});

app.delete("/events/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM calendar_events WHERE id = $1", [req.params.id]);
    res.json({ deleted: result.rowCount });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: "Error deleting event." });
  }
});

// ===================== LEGACY CALENDAR EVENTS API (backward compatibility) =====================
app.get("/calendar_events/:email", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM calendar_events WHERE user_email = $1 ORDER BY event_date ASC", 
      [req.params.email]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: "Error fetching events." });
  }
});

app.post("/calendar_events", async (req, res) => {
  const { user_email, title, description, event_date, start_time, end_time, repeat_weekly, created_date } = req.body;
  const date = created_date || new Date().toISOString();
  
  try {
    const result = await pool.query(
      "INSERT INTO calendar_events (user_email, title, description, event_date, start_time, end_time, repeat_weekly, created_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [user_email, title, description, event_date, start_time, end_time, repeat_weekly, date]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: "Error creating event." });
  }
});

app.put("/calendar_events/:id", async (req, res) => {
  const { title, description, event_date, start_time, end_time, repeat_weekly } = req.body;
  try {
    const result = await pool.query(
      "UPDATE calendar_events SET title = $1, description = $2, event_date = $3, start_time = $4, end_time = $5, repeat_weekly = $6 WHERE id = $7",
      [title, description, event_date, start_time, end_time, repeat_weekly, req.params.id]
    );
    res.json({ updated: result.rowCount });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: "Error updating event." });
  }
});

app.delete("/calendar_events/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM calendar_events WHERE id = $1", [req.params.id]);
    res.json({ deleted: result.rowCount });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: "Error deleting event." });
  }
});

// ===================== PROFILE API ENDPOINTS =====================
app.get("/profile/:email", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM profiles WHERE user_email = $1",
      [req.params.email]
    );
    
    if (result.rows.length === 0) {
      return res.json(null);
    }
    
    const row = result.rows[0];
    
    // Convert snake_case to camelCase for frontend
    const profile = {
      userEmail: row.user_email,
      fullName: row.full_name,
      designation: row.designation,
      department: row.department,
      institution: row.institution,
      officeAddress: row.office_address,
      officialEmail: row.official_email,
      alternateEmail: row.alternate_email,
      phone: row.phone,
      website: row.website,
      degrees: row.degrees ? JSON.parse(row.degrees) : [],
      employment: row.employment ? JSON.parse(row.employment) : [],
      researchKeywords: row.research_keywords,
      researchDescription: row.research_description,
      scholarLink: row.scholar_link,
      courses: row.courses ? JSON.parse(row.courses) : [],
      grants: row.grants ? JSON.parse(row.grants) : [],
      professionalActivities: row.professional_activities,
      awards: row.awards ? JSON.parse(row.awards) : [],
      skills: row.skills,
      outreachService: row.outreach_service
    };
    
    res.json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: "Error fetching profile." });
  }
});

app.post("/profile", async (req, res) => {
  const {
    userEmail, fullName, designation, department, institution,
    officeAddress, officialEmail, alternateEmail, phone, website,
    degrees, employment, researchKeywords, researchDescription,
    scholarLink, courses, grants, professionalActivities,
    awards, skills, outreachService
  } = req.body;

  if (!userEmail) {
    return res.status(400).json({ error: "User email is required." });
  }

  const modifiedDate = new Date().toISOString();
  const degreesJson = JSON.stringify(degrees || []);
  const employmentJson = JSON.stringify(employment || []);
  const coursesJson = JSON.stringify(courses || []);
  const grantsJson = JSON.stringify(grants || []);
  const awardsJson = JSON.stringify(awards || []);

  try {
    // Check if profile exists
    const checkResult = await pool.query(
      "SELECT id FROM profiles WHERE user_email = $1",
      [userEmail]
    );

    if (checkResult.rows.length > 0) {
      // Update existing profile
      await pool.query(
        `UPDATE profiles SET 
          full_name = $1, designation = $2, department = $3, institution = $4,
          office_address = $5, official_email = $6, alternate_email = $7, phone = $8,
          website = $9, degrees = $10, employment = $11, research_keywords = $12,
          research_description = $13, scholar_link = $14, courses = $15, grants = $16,
          professional_activities = $17, awards = $18, skills = $19, outreach_service = $20,
          modified_date = $21
        WHERE user_email = $22`,
        [
          fullName, designation, department, institution,
          officeAddress, officialEmail, alternateEmail, phone,
          website, degreesJson, employmentJson, researchKeywords,
          researchDescription, scholarLink, coursesJson, grantsJson,
          professionalActivities, awardsJson, skills, outreachService,
          modifiedDate, userEmail
        ]
      );
      res.json({ message: "Profile updated successfully" });
    } else {
      // Create new profile
      const createdDate = new Date().toISOString();
      const result = await pool.query(
        `INSERT INTO profiles (
          user_email, full_name, designation, department, institution,
          office_address, official_email, alternate_email, phone, website,
          degrees, employment, research_keywords, research_description,
          scholar_link, courses, grants, professional_activities, awards,
          skills, outreach_service, created_date, modified_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) RETURNING id`,
        [
          userEmail, fullName, designation, department, institution,
          officeAddress, officialEmail, alternateEmail, phone, website,
          degreesJson, employmentJson, researchKeywords, researchDescription,
          scholarLink, coursesJson, grantsJson, professionalActivities,
          awardsJson, skills, outreachService, createdDate, modifiedDate
        ]
      );
      res.json({ message: "Profile created successfully", id: result.rows[0].id });
    }
  } catch (error) {
    console.error('Error saving profile:', error);
    res.status(500).json({ error: "Error saving profile." });
  }
});

app.delete("/profile/:email", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM profiles WHERE user_email = $1",
      [req.params.email]
    );
    res.json({ deleted: result.rowCount, message: "Profile deleted successfully" });
  } catch (error) {
    console.error('Error deleting profile:', error);
    res.status(500).json({ error: "Error deleting profile." });
  }
});

// ===================== RESUME GENERATION API =====================
app.get("/generate-resume/:email", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM profiles WHERE user_email = $1",
      [req.params.email]
    );

    if (result.rows.length === 0) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Resume Not Available</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 50px; text-align: center; }
            h1 { color: #ef4444; }
          </style>
        </head>
        <body>
          <h1>Profile Not Found</h1>
          <p>Please complete your profile first before generating a resume.</p>
          <button onclick="window.close()">Close</button>
        </body>
        </html>
      `);
    }

    const profile = result.rows[0];

    // Parse JSON fields
    const degrees = profile.degrees ? JSON.parse(profile.degrees) : [];
    const employment = profile.employment ? JSON.parse(profile.employment) : [];
    const courses = profile.courses ? JSON.parse(profile.courses) : [];
    const grants = profile.grants ? JSON.parse(profile.grants) : [];
    const awards = profile.awards ? JSON.parse(profile.awards) : [];

    // Generate HTML resume
    const resumeHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resume - ${profile.full_name || 'Academic Professional'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Georgia', serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 50px;
      box-shadow: 0 0 20px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #4f46e5;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 2.5rem;
      color: #1a1a1a;
      margin-bottom: 10px;
    }
    .header .designation {
      font-size: 1.3rem;
      color: #4f46e5;
      font-weight: 600;
      margin-bottom: 15px;
    }
    .contact-info {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 20px;
      font-size: 0.95rem;
      color: #666;
    }
    .contact-info span {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 1.5rem;
      color: #4f46e5;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 8px;
      margin-bottom: 15px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .item {
      margin-bottom: 20px;
    }
    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 5px;
    }
    .item-title {
      font-weight: 700;
      font-size: 1.1rem;
      color: #1a1a1a;
    }
    .item-subtitle {
      font-style: italic;
      color: #666;
      margin-bottom: 5px;
    }
    .item-date {
      color: #888;
      font-size: 0.9rem;
    }
    .item-description {
      color: #555;
      margin-top: 8px;
      line-height: 1.7;
    }
    .keywords {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 10px;
    }
    .keyword {
      background: #e0e7ff;
      color: #4f46e5;
      padding: 5px 12px;
      border-radius: 15px;
      font-size: 0.9rem;
    }
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4f46e5;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      box-shadow: 0 4px 10px rgba(79,70,229,0.3);
      transition: all 0.3s;
    }
    .print-btn:hover {
      background: #4338ca;
      transform: translateY(-2px);
    }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; padding: 0; }
      .print-btn { display: none; }
    }
    ul { margin-left: 20px; margin-top: 8px; }
    li { margin-bottom: 5px; color: #555; }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ Print Resume</button>
  
  <div class="container">
    <div class="header">
      <h1>${profile.full_name || 'Name Not Provided'}</h1>
      <div class="designation">${profile.designation || ''} ${profile.department ? '| ' + profile.department : ''}</div>
      ${profile.institution ? `<div style="font-size: 1.1rem; color: #666; margin-bottom: 15px;">${profile.institution}</div>` : ''}
      <div class="contact-info">
        ${profile.official_email ? `<span>✉️ ${profile.official_email}</span>` : ''}
        ${profile.phone ? `<span>📱 ${profile.phone}</span>` : ''}
        ${profile.website ? `<span>🌐 <a href="${profile.website}" target="_blank">${profile.website}</a></span>` : ''}
        ${profile.scholar_link ? `<span>📚 <a href="${profile.scholar_link}" target="_blank">Google Scholar</a></span>` : ''}
      </div>
    </div>

    ${profile.research_description ? `
    <div class="section">
      <h2 class="section-title">Research Interests</h2>
      <p class="item-description">${profile.research_description}</p>
      ${profile.research_keywords ? `
        <div class="keywords">
          ${profile.research_keywords.split(',').map(kw => `<span class="keyword">${kw.trim()}</span>`).join('')}
        </div>
      ` : ''}
    </div>
    ` : ''}

    ${degrees.length > 0 ? `
    <div class="section">
      <h2 class="section-title">Education</h2>
      ${degrees.map(deg => `
        <div class="item">
          <div class="item-header">
            <div class="item-title">${deg.degree || ''} ${deg.specialization ? 'in ' + deg.specialization : ''}</div>
            <div class="item-date">${deg.year || ''}</div>
          </div>
          <div class="item-subtitle">${deg.institution || ''}</div>
          ${deg.thesis ? `<div class="item-description"><strong>Thesis:</strong> ${deg.thesis}</div>` : ''}
          ${deg.advisor ? `<div class="item-description"><strong>Advisor:</strong> ${deg.advisor}</div>` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${employment.length > 0 ? `
    <div class="section">
      <h2 class="section-title">Professional Experience</h2>
      ${employment.map(emp => `
        <div class="item">
          <div class="item-header">
            <div class="item-title">${emp.position || ''}</div>
            <div class="item-date">${emp.duration || ''}</div>
          </div>
          <div class="item-subtitle">${emp.organization || ''}</div>
          ${emp.responsibilities ? `<div class="item-description">${emp.responsibilities}</div>` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${grants.length > 0 ? `
    <div class="section">
      <h2 class="section-title">Research Grants & Funding</h2>
      ${grants.map(grant => `
        <div class="item">
          <div class="item-header">
            <div class="item-title">${grant.projectTitle || ''}</div>
            <div class="item-date">${grant.duration || ''}</div>
          </div>
          <div class="item-subtitle">${grant.role || ''} | ${grant.agency || ''} ${grant.amount ? '| ' + grant.amount : ''}</div>
          <div class="item-description"><strong>Status:</strong> ${grant.status || 'N/A'}</div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${courses.length > 0 ? `
    <div class="section">
      <h2 class="section-title">Teaching</h2>
      ${courses.map(course => `
        <div class="item">
          <div class="item-header">
            <div class="item-title">${course.courseName || ''} ${course.courseCode ? '(' + course.courseCode + ')' : ''}</div>
            <div class="item-date">${course.semester || ''}</div>
          </div>
          ${course.labDetails ? `<div class="item-description">${course.labDetails}</div>` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${awards.length > 0 ? `
    <div class="section">
      <h2 class="section-title">Awards & Achievements</h2>
      ${awards.map(award => `
        <div class="item">
          <div class="item-header">
            <div class="item-title">${award.title || ''}</div>
            <div class="item-date">${award.year || ''}</div>
          </div>
          <div class="item-subtitle">${award.organization || ''}</div>
          ${award.description ? `<div class="item-description">${award.description}</div>` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${profile.professional_activities ? `
    <div class="section">
      <h2 class="section-title">Professional Activities</h2>
      <div class="item-description">${profile.professional_activities}</div>
    </div>
    ` : ''}

    ${profile.skills ? `
    <div class="section">
      <h2 class="section-title">Skills & Tools</h2>
      <div class="keywords">
        ${profile.skills.split(',').map(skill => `<span class="keyword">${skill.trim()}</span>`).join('')}
      </div>
    </div>
    ` : ''}

    ${profile.outreach_service ? `
    <div class="section">
      <h2 class="section-title">Outreach & Service</h2>
      <div class="item-description">${profile.outreach_service}</div>
    </div>
    ` : ''}
  </div>
</body>
</html>
    `;

    res.send(resumeHTML);
  } catch (error) {
    console.error('Resume generation error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 50px; text-align: center; }
          h1 { color: #ef4444; }
        </style>
      </head>
      <body>
        <h1>Error Generating Resume</h1>
        <p>An error occurred while generating your resume. Please try again.</p>
        <button onclick="window.close()">Close</button>
      </body>
      </html>
    `);
  }
});

// ===================== FRONTEND ROUTES =====================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

// Catch all route for SPA
app.get("*", (req, res) => {
  if (req.path.endsWith('.html')) {
    res.sendFile(path.join(__dirname, req.path));
  } else {
    res.sendFile(path.join(__dirname, "index.html"));
  }
});

// ===================== ERROR HANDLING =====================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: PostgreSQL`);
});

// ===================== PROCESS ERROR HANDLERS =====================
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
