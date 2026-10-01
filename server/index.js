import process from 'node:process'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({
  path: path.join(__dirname, '..', '.env')
})

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET is missing. Create a .env file before starting the server.'
  )
}

const app = express()
const PORT = 3001

app.disable('x-powered-by')

// Week 5 security: add standard HTTP security headers.
app.use(helmet())

// Only allow requests from the approved frontend.
const allowedOrigins = [
  process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  'http://127.0.0.1:5173'
]

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true)
      }

      return callback(new Error('Origin not allowed by CORS'))
    }
  })
)

// Limit request size so unexpectedly large payloads are rejected.
app.use(express.json({ limit: '50kb' }))

// General protection against excessive API requests.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false
})

app.use('/api', apiLimiter)

// Login and registration receive a much stricter limit.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    message: 'Too many login attempts. Please try again later.'
  }
})

// Open the SQLite database and enforce foreign-key relationships.
const db = new Database(path.join(__dirname, 'townside.db'))
db.pragma('foreign_keys = ON')

// Load the project database schema without deleting existing data.
const schema = fs.readFileSync(
  path.join(__dirname, 'database-schema.sql'),
  'utf8'
)

db.exec(schema)

// Create a signed login token that cannot be modified by the browser.
function issueToken(user) {
  return jwt.sign(
    {
      userId: Number(user.id),
      businessId: Number(user.businessId),
      role: user.role || 'client'
    },
    JWT_SECRET,
    {
      expiresIn: '8h'
    }
  )
}

// Protect private API routes and load the user's business directly
// from the database instead of trusting information sent by the browser.
function requireAuth(req, res, next) {
  const authorization = req.get('authorization') || ''
  const [scheme, token] = authorization.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      message: 'Authentication is required.'
    })
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET)

    const user = db.prepare(`
      SELECT
        id,
        business_id,
        role
      FROM users
      WHERE id = ?
    `).get(Number(payload.userId))

    if (!user) {
      return res.status(401).json({
        message: 'Authentication is no longer valid.'
      })
    }

    req.auth = {
      userId: user.id,
      businessId: user.business_id,
      role: user.role
    }

    next()
  } catch {
    return res.status(401).json({
      message: 'Authentication is invalid or has expired.'
    })
  }
}

// Password rules used by registration and password changes.
function passwordIsValid(password) {
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  )
}

// Create the original Phase 1 demo data only if the database is empty.
const existingBusiness = db
  .prepare('SELECT COUNT(*) AS count FROM businesses')
  .get().count

if (existingBusiness === 0) {
  const result = db
    .prepare('INSERT INTO businesses (name) VALUES (?)')
    .run('Demo Service Company')

  const businessId = result.lastInsertRowid
  const passwordHash = bcrypt.hashSync('Townside123!', 10)

  db.prepare(`
    INSERT INTO users
    (business_id, name, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    businessId,
    'Demo Client',
    'demo@townsidewebs.com',
    passwordHash,
    'admin'
  )

  const lead = db.prepare(`
    INSERT INTO leads
    (
      business_id,
      customer_name,
      phone,
      email,
      service,
      status,
      estimated_value,
      notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  lead.run(
    businessId,
    'John Smith',
    '(704) 555-0142',
    'john@example.com',
    'House Washing',
    'New Lead',
    425,
    'Requested an estimate.'
  )

  lead.run(
    businessId,
    'Sarah Johnson',
    '(980) 555-0188',
    'sarah@example.com',
    'Driveway Cleaning',
    'Estimate Sent',
    300,
    'Estimate sent yesterday.'
  )

  lead.run(
    businessId,
    'Michael Davis',
    '(704) 555-0121',
    'michael@example.com',
    'Roof Cleaning',
    'Contacted',
    750,
    'Follow up later this week.'
  )

  // Additional demonstration records give the final project
  // enough realistic data to show search, filtering, and reporting.
  lead.run(
    businessId,
    'James Carter',
    '(704) 555-0201',
    'james@example.com',
    'Tree Removal',
    'New Lead',
    1200,
    'Customer requested an estimate for one large tree.'
  )

  lead.run(
    businessId,
    'Olivia Martinez',
    '(980) 555-0202',
    'olivia@example.com',
    'Tree Trimming',
    'Contacted',
    650,
    'Needs several trees trimmed away from the house.'
  )

  lead.run(
    businessId,
    'Daniel Brooks',
    '(704) 555-0203',
    'daniel@example.com',
    'Stump Grinding',
    'Estimate Sent',
    400,
    'Estimate sent for two stumps.'
  )

  lead.run(
    businessId,
    'Rachel Green',
    '(980) 555-0204',
    'rachel@example.com',
    'Emergency Tree Service',
    'New Lead',
    1800,
    'Storm damaged tree near driveway.'
  )

  lead.run(
    businessId,
    'Kevin Turner',
    '(704) 555-0205',
    'kevin@example.com',
    'Tree Removal',
    'Won',
    1450,
    'Customer approved the estimate.'
  )

  lead.run(
    businessId,
    'Nicole Harris',
    '(980) 555-0206',
    'nicole@example.com',
    'Tree Trimming',
    'Estimate Sent',
    725,
    'Waiting on customer approval.'
  )

  lead.run(
    businessId,
    'Brian Cooper',
    '(704) 555-0207',
    'brian@example.com',
    'Stump Grinding',
    'Contacted',
    325,
    'Follow up requested later this week.'
  )

  lead.run(
    businessId,
    'Ashley Morgan',
    '(980) 555-0208',
    'ashley@example.com',
    'Tree Removal',
    'New Lead',
    2100,
    'Multiple trees need inspection and removal estimate.'
  )

  lead.run(
    businessId,
    'Eric Thompson',
    '(704) 555-0209',
    'eric@example.com',
    'Tree Trimming',
    'Lost',
    550,
    'Customer decided to wait until later in the year.'
  )

  const job = db.prepare(`
    INSERT INTO jobs
    (
      business_id,
      customer_name,
      service,
      status,
      job_value,
      scheduled_date
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  job.run(
    businessId,
    'Amanda Wilson',
    'House Washing',
    'Scheduled',
    550,
    '2026-09-15'
  )

  job.run(
    businessId,
    'Robert Taylor',
    'Driveway Cleaning',
    'Completed',
    375,
    '2026-09-10'
  )

  const customer = db.prepare(`
    INSERT INTO customers
    (business_id, name, phone, email)
    VALUES (?, ?, ?, ?)
  `)

  customer.run(
    businessId,
    'Amanda Wilson',
    '(704) 555-0167',
    'amanda@example.com'
  )

  customer.run(
    businessId,
    'Robert Taylor',
    '(980) 555-0133',
    'robert@example.com'
  )

  customer.run(
    businessId,
    'Emily Brown',
    '(704) 555-0194',
    'emily@example.com'
  )
}

// Make sure the original demo account is the administrative account
// required for the Phase 3 submission.
db.prepare(`
  UPDATE users
  SET role = 'admin'
  WHERE email = ?
`).run('demo@townsidewebs.com')

// Verify login credentials against the hashed password in the database.
app.post('/api/login', authLimiter, (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({
      message: 'Email and password are required.'
    })
  }

  const user = db.prepare(`
    SELECT
      users.id,
      users.name,
      users.email,
      users.password_hash,
      users.business_id,
      users.role,
      businesses.name AS business_name
    FROM users
    JOIN businesses
      ON businesses.id = users.business_id
    WHERE users.email = ?
  `).get(email.trim().toLowerCase())

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({
      message: 'Invalid email or password.'
    })
  }

  const publicUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    businessId: user.business_id,
    businessName: user.business_name,
    role: user.role
  }

  res.json({
    user: publicUser,
    token: issueToken(publicUser)
  })
})

// Register a new Townside Web business and client user.
app.post('/api/register', authLimiter, (req, res) => {
  const {
    name,
    businessName,
    email,
    password
  } = req.body

  if (!name || !businessName || !email || !password) {
    return res.status(400).json({
      message: 'All registration fields are required.'
    })
  }

  if (!passwordIsValid(password)) {
    return res.status(400).json({
      message:
        'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.'
    })
  }

  const normalizedEmail = email.trim().toLowerCase()

  const existingUser = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(normalizedEmail)

  if (existingUser) {
    return res.status(409).json({
      message: 'An account with that email already exists.'
    })
  }

  const createAccount = db.transaction(() => {
    const business = db
      .prepare('INSERT INTO businesses (name) VALUES (?)')
      .run(businessName.trim())

    const businessId = business.lastInsertRowid
    const passwordHash = bcrypt.hashSync(password, 10)

    const user = db.prepare(`
      INSERT INTO users
      (business_id, name, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      businessId,
      name.trim(),
      normalizedEmail,
      passwordHash,
      'client'
    )

    return {
      id: user.lastInsertRowid,
      name: name.trim(),
      email: normalizedEmail,
      businessId,
      businessName: businessName.trim(),
      role: 'client'
    }
  })

  const newUser = createAccount()

  res.status(201).json({
    user: newUser,
    token: issueToken(newUser)
  })
})

// Verify the current password before allowing a password change.
app.post('/api/change-password', requireAuth, (req, res) => {
  const {
    currentPassword,
    newPassword
  } = req.body

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      message: 'Current and new passwords are required.'
    })
  }

  if (!passwordIsValid(newPassword)) {
    return res.status(400).json({
      message:
        'New password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.'
    })
  }

  const user = db.prepare(`
    SELECT id, password_hash
    FROM users
    WHERE id = ?
  `).get(req.auth.userId)

  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({
      message: 'Current password is incorrect.'
    })
  }

  db.prepare(`
    UPDATE users
    SET password_hash = ?
    WHERE id = ?
  `).run(
    bcrypt.hashSync(newPassword, 10),
    user.id
  )

  res.json({
    message: 'Password changed successfully.'
  })
})

// Search across leads, jobs, and customers.
// "*" represents multiple characters and "?" represents one character.
app.get('/api/search/:businessId', requireAuth, (req, res) => {
  // Ignore the browser-supplied business id and trust the signed login.
  const businessId = req.auth.businessId
  const query = String(req.query.q || '').trim()

  if (!query) {
    return res.json([])
  }

  const containsWildcard =
    query.includes('*') ||
    query.includes('?') ||
    query.includes('%') ||
    query.includes('_')

  let pattern = query
    .replace(/\*/g, '%')
    .replace(/\?/g, '_')

  if (!containsWildcard) {
    pattern = `%${pattern}%`
  }

  // Additional fields are returned so Phase 3 can load records
  // into the edit form directly from the Search page.
  const leads = db.prepare(`
    SELECT
      id,
      'lead' AS recordType,
      'Lead' AS type,
      customer_name AS title,
      service AS details,
      status,
      estimated_value AS value,
      phone,
      email,
      notes,
      NULL AS scheduledDate
    FROM leads
    WHERE business_id = ?
      AND (
        customer_name LIKE ?
        OR phone LIKE ?
        OR email LIKE ?
        OR service LIKE ?
        OR status LIKE ?
        OR notes LIKE ?
      )
  `).all(
    businessId,
    pattern,
    pattern,
    pattern,
    pattern,
    pattern,
    pattern
  )

  const jobs = db.prepare(`
    SELECT
      id,
      'job' AS recordType,
      'Job' AS type,
      customer_name AS title,
      service AS details,
      status,
      job_value AS value,
      '' AS phone,
      '' AS email,
      '' AS notes,
      scheduled_date AS scheduledDate
    FROM jobs
    WHERE business_id = ?
      AND (
        customer_name LIKE ?
        OR service LIKE ?
        OR status LIKE ?
        OR scheduled_date LIKE ?
      )
  `).all(
    businessId,
    pattern,
    pattern,
    pattern,
    pattern
  )

  const customers = db.prepare(`
    SELECT
      id,
      'customer' AS recordType,
      'Customer' AS type,
      name AS title,
      COALESCE(email, phone, '') AS details,
      '' AS status,
      NULL AS value,
      phone,
      email,
      '' AS notes,
      NULL AS scheduledDate
    FROM customers
    WHERE business_id = ?
      AND (
        name LIKE ?
        OR phone LIKE ?
        OR email LIKE ?
      )
  `).all(
    businessId,
    pattern,
    pattern,
    pattern
  )

  res.json([
    ...leads,
    ...jobs,
    ...customers
  ])
})

/* =========================================================
   PHASE 3 CRUD ROUTES
   Add, edit, and delete records directly from Search.
   Every operation checks the business_id so one client
   cannot change another client's records.
   ========================================================= */

// Add a new lead, job, or customer.
app.post('/api/records/:type', requireAuth, (req, res) => {
  const type = req.params.type
  const data = req.body

  // The authenticated account determines which business owns the record.
  const businessId = req.auth.businessId

  if (!businessId) {
    return res.status(400).json({
      message: 'Business information is required.'
    })
  }

  if (type === 'lead') {
    if (!data.name) {
      return res.status(400).json({
        message: 'Customer name is required.'
      })
    }

    const result = db.prepare(`
      INSERT INTO leads
      (
        business_id,
        customer_name,
        phone,
        email,
        service,
        status,
        estimated_value,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      businessId,
      data.name.trim(),
      data.phone || '',
      data.email || '',
      data.service || '',
      data.status || 'New Lead',
      Number(data.value) || 0,
      data.notes || ''
    )

    return res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Lead added successfully.'
    })
  }

  if (type === 'job') {
    if (!data.name) {
      return res.status(400).json({
        message: 'Customer name is required.'
      })
    }

    const result = db.prepare(`
      INSERT INTO jobs
      (
        business_id,
        customer_name,
        service,
        status,
        job_value,
        scheduled_date
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      businessId,
      data.name.trim(),
      data.service || '',
      data.status || 'Scheduled',
      Number(data.value) || 0,
      data.scheduledDate || ''
    )

    return res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Job added successfully.'
    })
  }

  if (type === 'customer') {
    if (!data.name) {
      return res.status(400).json({
        message: 'Customer name is required.'
      })
    }

    const result = db.prepare(`
      INSERT INTO customers
      (
        business_id,
        name,
        phone,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      businessId,
      data.name.trim(),
      data.phone || '',
      data.email || ''
    )

    return res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Customer added successfully.'
    })
  }

  return res.status(400).json({
    message: 'Invalid record type.'
  })
})

// Edit an existing lead, job, or customer.
app.put('/api/records/:type/:id', requireAuth, (req, res) => {
  const type = req.params.type
  const id = Number(req.params.id)
  const data = req.body
  const businessId = req.auth.businessId

  if (!id || !businessId) {
    return res.status(400).json({
      message: 'Invalid record information.'
    })
  }

  let result

  if (type === 'lead') {
    result = db.prepare(`
      UPDATE leads
      SET
        customer_name = ?,
        phone = ?,
        email = ?,
        service = ?,
        status = ?,
        estimated_value = ?,
        notes = ?
      WHERE id = ?
        AND business_id = ?
    `).run(
      data.name || '',
      data.phone || '',
      data.email || '',
      data.service || '',
      data.status || 'New Lead',
      Number(data.value) || 0,
      data.notes || '',
      id,
      businessId
    )
  } else if (type === 'job') {
    result = db.prepare(`
      UPDATE jobs
      SET
        customer_name = ?,
        service = ?,
        status = ?,
        job_value = ?,
        scheduled_date = ?
      WHERE id = ?
        AND business_id = ?
    `).run(
      data.name || '',
      data.service || '',
      data.status || 'Scheduled',
      Number(data.value) || 0,
      data.scheduledDate || '',
      id,
      businessId
    )
  } else if (type === 'customer') {
    result = db.prepare(`
      UPDATE customers
      SET
        name = ?,
        phone = ?,
        email = ?
      WHERE id = ?
        AND business_id = ?
    `).run(
      data.name || '',
      data.phone || '',
      data.email || '',
      id,
      businessId
    )
  } else {
    return res.status(400).json({
      message: 'Invalid record type.'
    })
  }

  if (result.changes === 0) {
    return res.status(404).json({
      message: 'Record was not found.'
    })
  }

  res.json({
    message: 'Record updated successfully.'
  })
})

// Delete a record only when it belongs to the logged-in business.
app.delete('/api/records/:type/:id', requireAuth, (req, res) => {
  const type = req.params.type
  const id = Number(req.params.id)
  const businessId = req.auth.businessId

  if (!id || !businessId) {
    return res.status(400).json({
      message: 'Invalid record information.'
    })
  }

  let result

  if (type === 'lead') {
    result = db.prepare(`
      DELETE FROM leads
      WHERE id = ?
        AND business_id = ?
    `).run(id, businessId)
  } else if (type === 'job') {
    result = db.prepare(`
      DELETE FROM jobs
      WHERE id = ?
        AND business_id = ?
    `).run(id, businessId)
  } else if (type === 'customer') {
    result = db.prepare(`
      DELETE FROM customers
      WHERE id = ?
        AND business_id = ?
    `).run(id, businessId)
  } else {
    return res.status(400).json({
      message: 'Invalid record type.'
    })
  }

  if (result.changes === 0) {
    return res.status(404).json({
      message: 'Record was not found.'
    })
  }

  res.json({
    message: 'Record deleted successfully.'
  })
})

// Dashboard summary.
app.get('/api/dashboard/:businessId', requireAuth, (req, res) => {
  const businessId = req.auth.businessId

  const newLeads = db.prepare(`
    SELECT COUNT(*) AS count
    FROM leads
    WHERE business_id = ?
      AND status = 'New Lead'
  `).get(businessId).count

  const openEstimates = db.prepare(`
    SELECT COUNT(*) AS count
    FROM leads
    WHERE business_id = ?
      AND status = 'Estimate Sent'
  `).get(businessId).count

  const jobs = db.prepare(`
    SELECT COUNT(*) AS count
    FROM jobs
    WHERE business_id = ?
  `).get(businessId).count

  const potentialValue = db.prepare(`
    SELECT COALESCE(SUM(estimated_value), 0) AS total
    FROM leads
    WHERE business_id = ?
      AND status != 'Lost'
  `).get(businessId).total

  res.json({
    newLeads,
    openEstimates,
    jobs,
    potentialValue
  })
})

app.get('/api/leads/:businessId', requireAuth, (req, res) => {
  const data = db.prepare(`
    SELECT *
    FROM leads
    WHERE business_id = ?
    ORDER BY id DESC
  `).all(req.auth.businessId)

  res.json(data)
})

app.get('/api/jobs/:businessId', requireAuth, (req, res) => {
  const data = db.prepare(`
    SELECT *
    FROM jobs
    WHERE business_id = ?
    ORDER BY id DESC
  `).all(req.auth.businessId)

  res.json(data)
})

app.get('/api/customers/:businessId', requireAuth, (req, res) => {
  const data = db.prepare(`
    SELECT *
    FROM customers
    WHERE business_id = ?
    ORDER BY id DESC
  `).all(req.auth.businessId)

  res.json(data)
})

app.listen(PORT, () => {
  console.log(`Townside API running at http://localhost:${PORT}`)
})
