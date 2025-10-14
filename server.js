const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");

const app = express();
const port = process.env.PORT || 10000;
const isProduction = process.env.NODE_ENV === 'production';

// Database setup - supports both SQLite (dev) and PostgreSQL (production)
let db;

if (isProduction && process.env.DATABASE_URL) {
  // Production - PostgreSQL
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  console.log('Using PostgreSQL database in production');
  
  // Wrapper to make PostgreSQL work like SQLite
  db = {
    serialize: (callback) => callback(),
    run: (query, params = [], callback) => {
      let pgQuery = query;
      let paramIndex = 1;
      pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);
      pgQuery = pgQuery.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY');
      pgQuery = pgQuery.replace(/AUTOINCREMENT/g, '');
      
      pool.query(pgQuery, params)
        .then(result => {
          if (callback) callback.call({ 
            lastID: result.rows && result.rows[0] ? result.rows[0].id : null,
            changes: result.rowCount || 0
          }, null);
        })
        .catch(err => {
          if (err.code === '42701' || err.message.includes('already exists')) {
            if (callback) callback.call({ lastID: null, changes: 0 }, null);
          } else {
            console.error('Database error:', err.message);
            if (callback) callback.call({ lastID: null, changes: 0 }, err);
          }
        });
    },
    get: (query, params = [], callback) => {
      let pgQuery = query;
      let paramIndex = 1;
      pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);
      
      pool.query(pgQuery, params)
        .then(result => callback(null, result.rows[0] || null))
        .catch(err => {
          console.error('Database error:', err.message);
          callback(err, null);
        });
    },
    all: (query, params = [], callback) => {
      let pgQuery = query;
      let paramIndex = 1;
      pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);
      
      pool.query(pgQuery, params)
        .then(result => callback(null, result.rows || []))
        .catch(err => {
          console.error('Database error:', err.message);
          callback(err, []);
        });
    }
  };
} else {
  // Development - SQLite
  const sqlite3 = require("sqlite3").verbose();
  db = new sqlite3.Database("app.db");
  console.log('Using SQLite database in development');
}

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));

// Database initialization
db.serialize(() => {
  // ===================== BASE TABLES =====================
  db.run(
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, password TEXT)"
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      approval_signature TEXT
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS colleagues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      name TEXT,
      email TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      colleague_email TEXT,
      date TEXT,
      description TEXT
    )`
  );

  // ===================== ADDITIONAL TABLES =====================
  db.run(`CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT,
    title TEXT,
    content TEXT,
    category TEXT DEFAULT 'general',
    created_date TEXT,
    FOREIGN KEY(user_email) REFERENCES users(email)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT,
    title TEXT,
    content TEXT,
    created_date TEXT,
    FOREIGN KEY(user_email) REFERENCES users(email)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS career_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT,
    title TEXT,
    description TEXT,
    progress INTEGER DEFAULT 0,
    goal_type TEXT DEFAULT 'general',
    target_date TEXT,
    created_date TEXT,
    FOREIGN KEY(user_email) REFERENCES users(email)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS future_work (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT,
    title TEXT,
    description TEXT,
    priority TEXT DEFAULT 'medium',
    timeline TEXT,
    created_date TEXT,
    FOREIGN KEY(user_email) REFERENCES users(email)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS deadlines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT,
    title TEXT,
    description TEXT,
    due_date TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    created_date TEXT,
    FOREIGN KEY(user_email) REFERENCES users(email)
  )`);

  // ===================== ENHANCED CALENDAR EVENTS TABLE =====================
  db.run(`CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT,
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
    modified_date TEXT,
    FOREIGN KEY(user_email) REFERENCES users(email)
  )`);

  // ===================== PROFILE TABLE =====================
  db.run(`CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT UNIQUE,
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
    modified_date TEXT,
    FOREIGN KEY(user_email) REFERENCES users(email)
  )`);

  // Add new columns to existing calendar_events table
  const calendarColumns = [
    "location TEXT",
    "category TEXT DEFAULT 'Work'",
    "attendees TEXT",
    "reminder INTEGER DEFAULT 15",
    "is_all_day INTEGER DEFAULT 0",
    "recurrence TEXT DEFAULT 'none'",
    "recurrence_end TEXT",
    "show_as TEXT DEFAULT 'busy'",
    "priority TEXT DEFAULT 'normal'",
    "is_online INTEGER DEFAULT 0",
    "meeting_link TEXT",
    "attachments TEXT",
    "modified_date TEXT"
  ];

  calendarColumns.forEach((columnDef) => {
    db.run(
      `ALTER TABLE calendar_events ADD COLUMN ${columnDef}`,
      (err) => {
        // Silently ignore duplicate column errors
        if (err && !err.message.includes('duplicate') && err.code !== '42701') {
          console.error(`Error adding column to calendar_events:`, err.message);
        }
      }
    );
  });

  // ===================== PROJECT DESCRIPTION EXTRA COLUMNS =====================
  const descriptionColumns = ["idea", "notes", "career_goals", "future_work", "deadlines"];

  descriptionColumns.forEach((column) => {
    db.run(
      `ALTER TABLE projects ADD COLUMN ${column} TEXT`,
      (err) => {
        if (err && !err.message.includes('duplicate') && err.code !== '42701') {
          console.error(`Error adding column ${column} to projects:`, err.message);
        }
      }
    );
  });

  // ===================== ADD PROGRESS COLUMN TO PROJECTS =====================
  db.run(
    `ALTER TABLE projects ADD COLUMN progress INTEGER DEFAULT 0`,
    (err) => {
      if (err && !err.message.includes('duplicate') && err.code !== '42701') {
        console.error('Error adding progress column:', err.message);
      }
    }
  );

  // Add career goals columns
  const careerGoalsColumns = [
    "total_stages INTEGER DEFAULT 5",
    "current_stage INTEGER DEFAULT 0",
    "start_date TEXT",
    "stage_description TEXT"
  ];

  careerGoalsColumns.forEach((columnDef) => {
    db.run(
      `ALTER TABLE career_goals ADD COLUMN ${columnDef}`,
      (err) => {
        if (err && !err.message.includes('duplicate') && err.code !== '42701') {
          console.error(`Error adding column to career_goals:`, err.message);
        }
      }
    );
  });
});

// ===================== AUTH API WITH PASSWORD HASHING =====================

// REGISTER endpoint (for frontend compatibility)
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
   
    db.run(
      "INSERT INTO users (email, password) VALUES (?, ?)",
      [email.toLowerCase().trim(), hashedPassword],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed') || err.code === '23505') {
            return res.status(400).json({ success: false, message: "User already exists." });
          }
          return res.status(500).json({ success: false, message: "Failed to create user." });
        }
        res.json({
          success: true,
          id: this.lastID,
          email: email.toLowerCase().trim(),
          message: "Account created successfully!"
        });
      }
    );
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, message: "Server error during signup." });
  }
});

// SIGNUP endpoint (keep for backward compatibility)
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
   
    db.run(
      "INSERT INTO users (email, password) VALUES (?, ?)",
      [email.toLowerCase().trim(), hashedPassword],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed') || err.code === '23505') {
            return res.status(400).json({ success: false, message: "User already exists." });
          }
          return res.status(500).json({ success: false, message: "Failed to create user." });
        }
        res.json({
          success: true,
          id: this.lastID,
          email: email.toLowerCase().trim(),
          message: "Account created successfully!"
        });
      }
    );
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, message: "Server error during signup." });
  }
});

// LOGIN endpoint
app.post("/login", (req, res) => {
  const { email, password } = req.body;
 
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }

  db.get(
    "SELECT * FROM users WHERE email = ?",
    [email.toLowerCase().trim()],
    async (err, row) => {
      if (err) {
        console.error('Login database error:', err);
        return res.status(500).json({ success: false, message: "Login failed." });
      }
     
      if (!row) {
        return res.status(400).json({ success: false, message: "Invalid credentials." });
      }

      try {
        const passwordMatch = await bcrypt.compare(password, row.password);
       
        if (!passwordMatch) {
          return res.status(400).json({ success: false, message: "Invalid credentials." });
        }
       
        res.json({
          success: true,
          email: row.email,
          message: "Login successful!"
        });
      } catch (error) {
        console.error('Password comparison error:', error);
        res.status(500).json({ success: false, message: "Login failed." });
      }
    }
  );
});

// ===================== PROJECTS API WITH PROGRESS =====================
app.post("/projects", (req, res) => {
  const { name, owner_email, colleagues, progress } = req.body;
 
  if (!name || !owner_email) {
    return res.status(400).json({ error: "Project name and owner email are required." });
  }
 
  db.run(
    "INSERT INTO projects (name, owner_email, colleagues, progress) VALUES (?, ?, ?, ?)",
    [name, owner_email, colleagues || "[]", progress || 0],
    function (err) {
      if (err) {
        console.error('Project creation error:', err);
        return res.status(500).json({ error: "Error creating project." });
      }
      res.json({ id: this.lastID, name, owner_email, colleagues, progress: progress || 0 });
    }
  );
});

app.get("/projects/:email", (req, res) => {
  db.all(
    "SELECT * FROM projects WHERE owner_email = ?",
    [req.params.email],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Error fetching projects." });
      res.json(rows);
    }
  );
});

app.put("/projects/:id", (req, res) => {
  const { name, colleagues, progress } = req.body;
  db.run(
    "UPDATE projects SET name = ?, colleagues = ?, progress = ? WHERE id = ?",
    [name, colleagues, progress !== undefined ? progress : 0, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: "Error updating project." });
      res.json({ updated: this.changes });
    }
  );
});

app.delete("/projects/:id", (req, res) => {
  db.run("DELETE FROM projects WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: "Error deleting project." });
    res.json({ deleted: this.changes });
  });
});

// ===================== MEETINGS API =====================
app.post("/meetings", (req, res) => {
  const { colleague_email, date, description } = req.body;
  db.run(
    "INSERT INTO meetings (colleague_email, date, description) VALUES (?, ?, ?)",
    [colleague_email, date, description],
    function (err) {
      if (err) return res.status(500).json({ error: "Error creating meeting." });
      res.json({ id: this.lastID, colleague_email, date, description });
    }
  );
});

app.get("/meetings/:email", (req, res) => {
  db.all(
    "SELECT * FROM meetings WHERE colleague_email = ?",
    [req.params.email],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Error fetching meetings." });
      res.json(rows);
    }
  );
});

// ===================== PROJECT DESCRIPTION API =====================
app.get("/projects/:id/description", (req, res) => {
  db.get(
    "SELECT * FROM projects WHERE id = ?",
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: "Error fetching description." });
      res.json(row || {});
    }
  );
});

app.put("/projects/:id/description", (req, res) => {
  const { projectTitle, notes, colleagueName, colleaguePhone, colleagueEmail, colleagueAddress1, colleagueAddress2, colleagueAddress3, yourName, yourPhone, yourEmail, yourAddress1, yourAddress2, yourAddress3, objectives, timeline, primaryAudience, secondaryAudience, callAction, competition, graphics, photography, multimedia, otherInfo, clientName, clientComments, approvalDate, approvalSignature } = req.body;
 
  db.run(
    `UPDATE projects SET
      project_title = ?, notes = ?, colleague_name = ?, colleague_phone = ?, colleague_email = ?,
      colleague_address1 = ?, colleague_address2 = ?, colleague_address3 = ?,
      your_name = ?, your_phone = ?, your_email = ?, your_address1 = ?, your_address2 = ?, your_address3 = ?,
      objectives = ?, timeline = ?, primary_audience = ?, secondary_audience = ?, call_action = ?,
      competition = ?, graphics = ?, photography = ?, multimedia = ?, other_info = ?,
      client_name = ?, client_comments = ?, approval_date = ?, approval_signature = ?
      WHERE id = ?`,
    [projectTitle, notes, colleagueName, colleaguePhone, colleagueEmail, colleagueAddress1, colleagueAddress2, colleagueAddress3, yourName, yourPhone, yourEmail, yourAddress1, yourAddress2, yourAddress3, objectives, timeline, primaryAudience, secondaryAudience, callAction, competition, graphics, photography, multimedia, otherInfo, clientName, clientComments, approvalDate, approvalSignature, req.params.id],
    function (err) {
      if (err) {
        console.error('Update error:', err);
        return res.status(500).json({ error: "Error updating description." });
      }
      res.json({ updated: this.changes });
    }
  );
});

// ===================== IDEAS API =====================
app.get("/ideas/:email", (req, res) => {
  db.all("SELECT * FROM ideas WHERE user_email = ? ORDER BY created_date DESC", [req.params.email], (err, rows) => {
    if (err) return res.status(500).json({ error: "Error fetching ideas." });
    res.json(rows);
  });
});

app.post("/ideas", (req, res) => {
  const { user_email, title, content, category, created_date } = req.body;
  const date = created_date || new Date().toISOString();
  db.run(
    "INSERT INTO ideas (user_email, title, content, category, created_date) VALUES (?, ?, ?, ?, ?)",
    [user_email, title, content, category || 'general', date],
    function (err) {
      if (err) return res.status(500).json({ error: "Error creating idea." });
      res.json({ id: this.lastID, user_email, title, content, category, created_date: date });
    }
  );
});

app.put("/ideas/:id", (req, res) => {
  const { title, content, category } = req.body;
  db.run(
    "UPDATE ideas SET title = ?, content = ?, category = ? WHERE id = ?",
    [title, content, category, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: "Error updating idea." });
      res.json({ updated: this.changes });
    }
  );
});

app.delete("/ideas/:id", (req, res) => {
  db.run("DELETE FROM ideas WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: "Error deleting idea." });
    res.json({ deleted: this.changes });
  });
});

// ===================== NOTES API =====================
app.get("/notes/:email", (req, res) => {
  db.all("SELECT * FROM notes WHERE user_email = ? ORDER BY created_date DESC", [req.params.email], (err, rows) => {
    if (err) return res.status(500).json({ error: "Error fetching notes." });
    res.json(rows);
  });
});

app.post("/notes", (req, res) => {
  const { user_email, title, content, created_date } = req.body;
  const date = created_date || new Date().toISOString();
  db.run(
    "INSERT INTO notes (user_email, title, content, created_date) VALUES (?, ?, ?, ?)",
    [user_email, title, content, date],
    function (err) {
      if (err) return res.status(500).json({ error: "Error creating note." });
      res.json({ id: this.lastID, user_email, title, content, created_date: date });
    }
  );
});

app.put("/notes/:id", (req, res) => {
  const { title, content } = req.body;
  db.run(
    "UPDATE notes SET title = ?, content = ? WHERE id = ?",
    [title, content, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: "Error updating note." });
      res.json({ updated: this.changes });
    }
  );
});

app.delete("/notes/:id", (req, res) => {
  db.run("DELETE FROM notes WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: "Error deleting note." });
    res.json({ deleted: this.changes });
  });
});

// ===================== CAREER GOALS API =====================
app.get("/career_goals/:email", (req, res) => {
  db.all("SELECT * FROM career_goals WHERE user_email = ? ORDER BY created_date DESC", [req.params.email], (err, rows) => {
    if (err) return res.status(500).json({ error: "Error fetching career goals." });
    res.json(rows);
  });
});

app.get("/career/:email", (req, res) => {
  db.all("SELECT * FROM career_goals WHERE user_email = ? ORDER BY created_date DESC", [req.params.email], (err, rows) => {
    if (err) return res.status(500).json({ error: "Error fetching career goals." });
    res.json(rows);
  });
});

app.post("/career_goals", (req, res) => {
  const { user_email, title, description, progress, goal_type, target_date, total_stages, current_stage, start_date, stage_description, created_date } = req.body;
  const date = created_date || new Date().toISOString();
  db.run(
    "INSERT INTO career_goals (user_email, title, description, progress, goal_type, target_date, total_stages, current_stage, start_date, stage_description, created_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [user_email, title, description, progress || 0, goal_type || 'general', target_date, total_stages || 5, current_stage || 0, start_date, stage_description, date],
    function (err) {
      if (err) return res.status(500).json({ error: "Error creating career goal." });
      res.json({ id: this.lastID, user_email, title, description, progress, goal_type, target_date, total_stages, current_stage, start_date, stage_description, created_date: date });
    }
  );
});

app.put("/career_goals/:id", (req, res) => {
  const { title, description, progress, goal_type, target_date, total_stages, current_stage, start_date, stage_description } = req.body;
  db.run(
    "UPDATE career_goals SET title = ?, description = ?, progress = ?, goal_type = ?, target_date = ?, total_stages = ?, current_stage = ?, start_date = ?, stage_description = ? WHERE id = ?",
    [title, description, progress, goal_type, target_date, total_stages, current_stage, start_date, stage_description, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: "Error updating career goal." });
      res.json({ updated: this.changes });
    }
  );
});

app.delete("/career_goals/:id", (req, res) => {
  db.run("DELETE FROM career_goals WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: "Error deleting career goal." });
    res.json({ deleted: this.changes });
  });
});

// ===================== FUTURE WORK API =====================
app.get("/future_work/:email", (req, res) => {
  db.all("SELECT * FROM future_work WHERE user_email = ? ORDER BY created_date DESC", [req.params.email], (err, rows) => {
    if (err) return res.status(500).json({ error: "Error fetching future work." });
    res.json(rows);
  });
});

app.get("/future/:email", (req, res) => {
  db.all("SELECT * FROM future_work WHERE user_email = ? ORDER BY created_date DESC", [req.params.email], (err, rows) => {
    if (err) return res.status(500).json({ error: "Error fetching future work." });
    res.json(rows);
  });
});

app.post("/future_work", (req, res) => {
  const { user_email, title, description, priority, timeline, created_date } = req.body;
  const date = created_date || new Date().toISOString();
  db.run(
    "INSERT INTO future_work (user_email, title, description, priority, timeline, created_date) VALUES (?, ?, ?, ?, ?, ?)",
    [user_email, title, description, priority || 'medium', timeline, date],
    function (err) {
      if (err) return res.status(500).json({ error: "Error creating future work." });
      res.json({ id: this.lastID, user_email, title, description, priority, timeline, created_date: date });
    }
  );
});

app.put("/future_work/:id", (req, res) => {
  const { title, description, priority, timeline } = req.body;
  db.run(
    "UPDATE future_work SET title = ?, description = ?, priority = ?, timeline = ? WHERE id = ?",
    [title, description, priority, timeline, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: "Error updating future work." });
      res.json({ updated: this.changes });
    }
  );
});

app.delete("/future_work/:id", (req, res) => {
  db.run("DELETE FROM future_work WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: "Error deleting future work." });
    res.json({ deleted: this.changes });
  });
});

// ===================== DEADLINES API =====================
app.get("/deadlines/:email", (req, res) => {
  db.all("SELECT * FROM deadlines WHERE user_email = ? ORDER BY due_date ASC", [req.params.email], (err, rows) => {
    if (err) return res.status(500).json({ error: "Error fetching deadlines." });
    res.json(rows);
  });
});

app.post("/deadlines", (req, res) => {
  const { user_email, title, description, due_date, priority, status, created_date } = req.body;
  const date = created_date || new Date().toISOString();
  db.run(
    "INSERT INTO deadlines (user_email, title, description, due_date, priority, status, created_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [user_email, title, description, due_date, priority || 'medium', status || 'pending', date],
    function (err) {
      if (err) return res.status(500).json({ error: "Error creating deadline." });
      res.json({ id: this.lastID, user_email, title, description, due_date, priority, status, created_date: date });
    }
  );
});

app.put("/deadlines/:id", (req, res) => {
  const { title, description, due_date, priority, status } = req.body;
  db.run(
    "UPDATE deadlines SET title = ?, description = ?, due_date = ?, priority = ?, status = ? WHERE id = ?",
    [title, description, due_date, priority, status, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: "Error updating deadline." });
      res.json({ updated: this.changes });
    }
  );
});

app.delete("/deadlines/:id", (req, res) => {
  db.run("DELETE FROM deadlines WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: "Error deleting deadline." });
    res.json({ deleted: this.changes });
  });
});

// ===================== ENHANCED CALENDAR EVENTS API =====================
app.get("/events/:email", (req, res) => {
  db.all(
    `SELECT 
      id, title, description, event_date as date, start_time as start, end_time as end, 
      location, category, attendees, reminder, is_all_day as isAllDay, recurrence,
      recurrence_end as recurrenceEnd, show_as as showAs, priority, is_online as isOnline,
      meeting_link as meetingLink, attachments, repeat_weekly as repeatWeekly,
      created_date as createdDate, modified_date as modifiedDate
    FROM calendar_events WHERE user_email = ? ORDER BY event_date ASC, start_time ASC`,
    [req.params.email],
    (err, rows) => {
      if (err) {
        console.error('Error fetching events:', err);
        return res.status(500).json({ error: "Error fetching events." });
      }
      const events = rows.map(row => ({
        ...row,
        isAllDay: Boolean(row.isAllDay),
        isOnline: Boolean(row.isOnline),
        repeatWeekly: Boolean(row.repeatWeekly)
      }));
      res.json(events);
    }
  );
});

app.post("/events", (req, res) => {
  const { userEmail, title, description, date, start, end, location, category, attendees, reminder, isAllDay, recurrence, recurrenceEnd, showAs, priority, isOnline, meetingLink, attachments, repeatWeekly } = req.body;
  
  const created_date = new Date().toISOString();
  const modified_date = created_date;
  
  db.run(
    `INSERT INTO calendar_events (
      user_email, title, description, event_date, start_time, end_time, location, category, 
      attendees, reminder, is_all_day, recurrence, recurrence_end, show_as, priority, 
      is_online, meeting_link, attachments, repeat_weekly, created_date, modified_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userEmail, title, description, date, start, end, location, category || 'Work', attendees, reminder || 15, isAllDay ? 1 : 0, recurrence || 'none', recurrenceEnd, showAs || 'busy', priority || 'normal', isOnline ? 1 : 0, meetingLink, attachments, repeatWeekly ? 1 : 0, created_date, modified_date],
    function (err) {
      if (err) {
        console.error('Error creating event:', err);
        return res.status(500).json({ error: "Error creating event." });
      }
      res.json({ id: this.lastID, title, description, date, start, end, location, category, created_date });
    }
  );
});

app.put("/events/:id", (req, res) => {
  const { title, description, date, start, end, location, category, attendees, reminder, isAllDay, recurrence, recurrenceEnd, showAs, priority, isOnline, meetingLink, attachments, repeatWeekly } = req.body;
  
  const modified_date = new Date().toISOString();
  
  db.run(
    `UPDATE calendar_events SET 
      title = ?, description = ?, event_date = ?, start_time = ?, end_time = ?, location = ?, 
      category = ?, attendees = ?, reminder = ?, is_all_day = ?, recurrence = ?, 
      recurrence_end = ?, show_as = ?, priority = ?, is_online = ?, meeting_link = ?, 
      attachments = ?, repeat_weekly = ?, modified_date = ?
    WHERE id = ?`,
    [title, description, date, start, end, location, category, attendees, reminder, isAllDay ? 1 : 0, recurrence, recurrenceEnd, showAs, priority, isOnline ? 1 : 0, meetingLink, attachments, repeatWeekly ? 1 : 0, modified_date, req.params.id],
    function (err) {
      if (err) {
        console.error('Error updating event:', err);
        return res.status(500).json({ error: "Error updating event." });
      }
      res.json({ updated: this.changes });
    }
  );
});

app.delete("/events/:id", (req, res) => {
  db.run("DELETE FROM calendar_events WHERE id = ?", [req.params.id], function (err) {
    if (err) {
      console.error('Error deleting event:', err);
      return res.status(500).json({ error: "Error deleting event." });
    }
    res.json({ deleted: this.changes });
  });
});

// ===================== LEGACY CALENDAR EVENTS API (backward compatibility) =====================
app.get("/calendar_events/:email", (req, res) => {
  db.all("SELECT * FROM calendar_events WHERE user_email = ? ORDER BY event_date ASC", [req.params.email], (err, rows) => {
    if (err) return res.status(500).json({ error: "Error fetching events." });
    res.json(rows);
  });
});

app.post("/calendar_events", (req, res) => {
  const { user_email, title, description, event_date, start_time, end_time, repeat_weekly, created_date } = req.body;
  const date = created_date || new Date().toISOString();
  db.run(
    "INSERT INTO calendar_events (user_email, title, description, event_date, start_time, end_time, repeat_weekly, created_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [user_email, title, description, event_date, start_time, end_time, repeat_weekly, date],
    function (err) {
      if (err) return res.status(500).json({ error: "Error creating event." });
      res.json({ id: this.lastID, user_email, title, description, event_date, start_time, end_time, repeat_weekly, created_date: date });
    }
  );
});

app.put("/calendar_events/:id", (req, res) => {
  const { title, description, event_date, start_time, end_time, repeat_weekly } = req.body;
  db.run(
    "UPDATE calendar_events SET title = ?, description = ?, event_date = ?, start_time = ?, end_time = ?, repeat_weekly = ? WHERE id = ?",
    [title, description, event_date, start_time, end_time, repeat_weekly, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: "Error updating event." });
      res.json({ updated: this.changes });
    }
  );
});

app.delete("/calendar_events/:id", (req, res) => {
  db.run("DELETE FROM calendar_events WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: "Error deleting event." });
    res.json({ deleted: this.changes });
  });
});

// ===================== PROFILE API ENDPOINTS =====================
app.get("/profile/:email", (req, res) => {
  db.get(
    "SELECT * FROM profiles WHERE user_email = ?",
    [req.params.email],
    (err, row) => {
      if (err) {
        console.error('Error fetching profile:', err);
        return res.status(500).json({ error: "Error fetching profile." });
      }
      
      if (!row) {
        return res.json(null);
      }
      
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
    }
  );
});

app.post("/profile", (req, res) => {
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

  db.get(
    "SELECT id FROM profiles WHERE user_email = ?",
    [userEmail],
    (err, row) => {
      if (err) {
        console.error('Error checking profile:', err);
        return res.status(500).json({ error: "Error saving profile." });
      }

      const degreesJson = JSON.stringify(degrees || []);
      const employmentJson = JSON.stringify(employment || []);
      const coursesJson = JSON.stringify(courses || []);
      const grantsJson = JSON.stringify(grants || []);
      const awardsJson = JSON.stringify(awards || []);

      if (row) {
        db.run(
          `UPDATE profiles SET 
            full_name = ?, designation = ?, department = ?, institution = ?,
            office_address = ?, official_email = ?, alternate_email = ?, phone = ?,
            website = ?, degrees = ?, employment = ?, research_keywords = ?,
            research_description = ?, scholar_link = ?, courses = ?, grants = ?,
            professional_activities = ?, awards = ?, skills = ?, outreach_service = ?,
            modified_date = ?
          WHERE user_email = ?`,
          [
            fullName, designation, department, institution,
            officeAddress, officialEmail, alternateEmail, phone,
            website, degreesJson, employmentJson, researchKeywords,
            researchDescription, scholarLink, coursesJson, grantsJson,
            professionalActivities, awardsJson, skills, outreachService,
            modifiedDate, userEmail
          ],
          function(err) {
            if (err) {
              console.error('Error updating profile:', err);
              return res.status(500).json({ error: "Error updating profile." });
            }
            res.json({ message: "Profile updated successfully", updated: this.changes });
          }
        );
      } else {
        const createdDate = new Date().toISOString();
        db.run(
          `INSERT INTO profiles (
            user_email, full_name, designation, department, institution,
            office_address, official_email, alternate_email, phone, website,
            degrees, employment, research_keywords, research_description,
            scholar_link, courses, grants, professional_activities, awards,
            skills, outreach_service, created_date, modified_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userEmail, fullName, designation, department, institution,
            officeAddress, officialEmail, alternateEmail, phone, website,
            degreesJson, employmentJson, researchKeywords, researchDescription,
            scholarLink, coursesJson, grantsJson, professionalActivities,
            awardsJson, skills, outreachService, createdDate, modifiedDate
          ],
          function(err) {
            if (err) {
              console.error('Error creating profile:', err);
              return res.status(500).json({ error: "Error creating profile." });
            }
            res.json({ message: "Profile created successfully", id: this.lastID });
          }
        );
      }
    }
  );
});

app.delete("/profile/:email", (req, res) => {
  db.run(
    "DELETE FROM profiles WHERE user_email = ?",
    [req.params.email],
    function(err) {
      if (err) {
        console.error('Error deleting profile:', err);
        return res.status(500).json({ error: "Error deleting profile." });
      }
      res.json({ deleted: this.changes, message: "Profile deleted successfully" });
    }
  );
});

// ===================== RESUME GENERATION API =====================
app.get("/generate-resume/:email", async (req, res) => {
  try {
    const profile = await new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM profiles WHERE user_email = ?",
        [req.params.email],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!profile) {
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

    const degrees = profile.degrees ? JSON.parse(profile.degrees) : [];
    const employment = profile.employment ? JSON.parse(profile.employment) : [];
    const courses = profile.courses ? JSON.parse(profile.courses) : [];
    const grants = profile.grants ? JSON.parse(profile.grants) : [];
    const awards = profile.awards ? JSON.parse(profile.awards) : [];

    const resumeHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resume - ${profile.full_name || 'Academic Professional'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Georgia', serif; line-height: 1.6; color: #333; background: #f5f5f5; padding: 20px; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 50px; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
    .header { text-align: center; border-bottom: 3px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { font-size: 2.5rem; color: #1a1a1a; margin-bottom: 10px; }
    .header .designation { font-size: 1.3rem; color: #4f46e5; font-weight: 600; margin-bottom: 15px; }
    .contact-info { display: flex; justify-content: center; flex-wrap: wrap; gap: 20px; font-size: 0.95rem; color: #666; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 1.5rem; color: #4f46e5; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px; }
    .item { margin-bottom: 20px; }
    .item-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px; }
    .item-title { font-weight: 700; font-size: 1.1rem; color: #1a1a1a; }
    .item-subtitle { font-style: italic; color: #666; margin-bottom: 5px; }
    .item-date { color: #888; font-size: 0.9rem; }
    .item-description { color: #555; margin-top: 8px; line-height: 1.7; }
    .keywords { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
    .keyword { background: #e0e7ff; color: #4f46e5; padding: 5px 12px; border-radius: 15px; font-size: 0.9rem; }
    .print-btn { position: fixed; top: 20px; right: 20px; background: #4f46e5; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600; box-shadow: 0 4px 10px rgba(79,70,229,0.3); transition: all 0.3s; }
    .print-btn:hover { background: #4338ca; transform: translateY(-2px); }
    @media print { body { background: white; padding: 0; } .container { box-shadow: none; padding: 0; } .print-btn { display: none; } }
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
        ${profile.website ? `<span>🌐 <a href="${profile.website}">${profile.website}</a></span>` : ''}
      </div>
    </div>
    ${profile.research_description ? `<div class="section"><h2 class="section-title">Research Interests</h2><p class="item-description">${profile.research_description}</p></div>` : ''}
    ${degrees.length > 0 ? `<div class="section"><h2 class="section-title">Education</h2>${degrees.map(deg => `<div class="item"><div class="item-header"><div class="item-title">${deg.degree || ''} ${deg.specialization ? 'in ' + deg.specialization : ''}</div><div class="item-date">${deg.year || ''}</div></div><div class="item-subtitle">${deg.institution || ''}</div></div>`).join('')}</div>` : ''}
  </div>
</body>
</html>
    `;

    res.send(resumeHTML);
  } catch (error) {
    console.error('Resume generation error:', error);
    res.status(500).send('<h1>Error</h1>');
  }
});

// ===================== FRONTEND ROUTES =====================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

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
  console.log(`Database: ${isProduction && process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite'}`);
});

// Process error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});




