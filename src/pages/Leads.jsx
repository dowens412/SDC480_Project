import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Leads() {
  const { user } = useAuth()
  const [leads, setLeads] = useState([])

  useEffect(() => {
    fetch(`http://localhost:3001/api/leads/${user.businessId}`)
      .then((response) => response.json())
      .then((data) => setLeads(data))
      .catch((error) => console.error(error))
  }, [user.businessId])

  return (
    <>
      <div className="page-heading">
        <div>
          <h2>Leads</h2>
          <p>View potential customers and track where they are in the process.</p>
        </div>

        <button className="primary-button">+ Add Lead</button>
      </div>

      <div className="content-card table-card">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Service</th>
              <th>Status</th>
              <th>Estimated Value</th>
              <th>Phone</th>
            </tr>
          </thead>

          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <strong>{lead.customer_name}</strong>
                  <span>{lead.email}</span>
                </td>

                <td>{lead.service}</td>

                <td>
                  <span className="status-badge">{lead.status}</span>
                </td>

                <td>
                  ${Number(lead.estimated_value).toLocaleString()}
                </td>

                <td>{lead.phone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
