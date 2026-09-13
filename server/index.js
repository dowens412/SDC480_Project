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

const db = new Database(path.join(__dirname, 'townside.db'))
db.pragma('foreign_keys = ON')

const schema = fs.readFileSync(
  path.join(__dirname, 'database-schema.sql'),
  'utf8'
)

db.exec(schema)

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
  `).get(email)

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

app.get('/api/leads/:businessId', (req, res) => {
  const data = db.prepare(`
    SELECT *
    FROM leads
    WHERE business_id = ?
    ORDER BY id DESC
  `).all(Number(req.params.businessId))

  res.json(data)
})

app.get('/api/jobs/:businessId', (req, res) => {
  const data = db.prepare(`
    SELECT *
    FROM jobs
    WHERE business_id = ?
    ORDER BY id DESC
  `).all(Number(req.params.businessId))

  res.json(data)
})

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
