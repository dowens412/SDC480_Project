import express from 'express'
import cors from 'cors'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

// Open the local SQLite database and enforce foreign-key relationships.
const db = new Database(path.join(__dirname, 'townside.db'))
db.pragma('foreign_keys = ON')

// Load the database schema each time the server starts.
// CREATE TABLE IF NOT EXISTS keeps existing data intact.
const schema = fs.readFileSync(
  path.join(__dirname, 'database-schema.sql'),
  'utf8'
)

db.exec(schema)

// Passwords must meet the same complexity requirements used
// by both registration and password-change features.
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

// Seed Phase 1 demo data only when the database is empty.
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
    'client'
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

// Verify a user's email and hashed password before allowing login.
app.post('/api/login', (req, res) => {
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

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      businessId: user.business_id,
      businessName: user.business_name
    }
  })
})

// Phase 2: Register a new Townside Web client business and user.
// Passwords are hashed before being stored in the database.
app.post('/api/register', (req, res) => {
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

  // Creating the business and user together keeps the account
  // connected to the correct Townside Web client.
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
      businessName: businessName.trim()
    }
  })

  const newUser = createAccount()

  res.status(201).json({
    user: newUser
  })
})

// Phase 2: Change an existing user's password.
// The current password must be verified first.
app.post('/api/change-password', (req, res) => {
  const {
    userId,
    currentPassword,
    newPassword
  } = req.body

  if (!userId || !currentPassword || !newPassword) {
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
  `).get(Number(userId))

  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({
      message: 'Current password is incorrect.'
    })
  }

  const newHash = bcrypt.hashSync(newPassword, 10)

  db.prepare(`
    UPDATE users
    SET password_hash = ?
    WHERE id = ?
  `).run(newHash, user.id)

  res.json({
    message: 'Password changed successfully.'
  })
})

// Phase 2 search feature.
// "*" matches any number of characters and "?" matches one character.
// A normal search automatically matches the term anywhere in the record.
app.get('/api/search/:businessId', (req, res) => {
  const businessId = Number(req.params.businessId)
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

  // Prepared statements are used so search input is never
  // inserted directly into SQL.
  const leads = db.prepare(`
    SELECT
      id,
      'Lead' AS type,
      customer_name AS title,
      service AS details,
      status,
      estimated_value AS value
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
      'Job' AS type,
      customer_name AS title,
      service AS details,
      status,
      job_value AS value
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
      'Customer' AS type,
      name AS title,
      COALESCE(email, phone, '') AS details,
      '' AS status,
      NULL AS value
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

// Dashboard totals are calculated from records belonging to one business.
app.get('/api/dashboard/:businessId', (req, res) => {
  const businessId = Number(req.params.businessId)

  const newLeads = db.prepare(`
    SELECT COUNT(*) AS count
    FROM leads
    WHERE business_id = ? AND status = 'New Lead'
  `).get(businessId).count

  const openEstimates = db.prepare(`
    SELECT COUNT(*) AS count
    FROM leads
    WHERE business_id = ? AND status = 'Estimate Sent'
  `).get(businessId).count

  const jobs = db.prepare(`
    SELECT COUNT(*) AS count
    FROM jobs
    WHERE business_id = ?
  `).get(businessId).count

  const potentialValue = db.prepare(`
    SELECT COALESCE(SUM(estimated_value), 0) AS total
    FROM leads
    WHERE business_id = ? AND status != 'Lost'
  `).get(businessId).total

  res.json({
    newLeads,
    openEstimates,
    jobs,
    potentialValue
  })
})

// Return only the leads assigned to the requested client business.
app.get('/api/leads/:businessId', (req, res) => {
  const data = db.prepare(`
    SELECT *
    FROM leads
    WHERE business_id = ?
    ORDER BY id DESC
  `).all(Number(req.params.businessId))

  res.json(data)
})

// Return only jobs belonging to the requested client business.
app.get('/api/jobs/:businessId', (req, res) => {
  const data = db.prepare(`
    SELECT *
    FROM jobs
    WHERE business_id = ?
    ORDER BY id DESC
  `).all(Number(req.params.businessId))

  res.json(data)
})

// Return only customers belonging to the requested client business.
app.get('/api/customers/:businessId', (req, res) => {
  const data = db.prepare(`
    SELECT *
    FROM customers
    WHERE business_id = ?
    ORDER BY id DESC
  `).all(Number(req.params.businessId))

  res.json(data)
})

app.listen(PORT, () => {
  console.log(`Townside API running at http://localhost:${PORT}`)
})
