import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Search() {
  const { user } = useAuth()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)

  // Search leads, jobs, and customers belonging to this business.
  const handleSearch = async (event) => {
    event.preventDefault()

    if (!query.trim()) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch(
        `http://localhost:3001/api/search/${user.businessId}?q=${encodeURIComponent(query)}`
      )

      const data = await response.json()

      setResults(data)
      setSearched(true)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
    setSearched(false)
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h2>Search</h2>
          <p>
            Search across your leads, jobs, and customers.
          </p>
        </div>
      </div>

      <div className="content-card search-card">
        <div className="search-help">
          <strong>How to Search</strong>

          <p>
            Enter a customer name, service, email, phone number, or status.
            You can also use <strong>*</strong> as a wildcard for multiple
            characters and <strong>?</strong> for one character.
          </p>

          <p>
            Example: <strong>*wash*</strong> will return records containing
            words such as House Washing or Driveway Washing.
          </p>
        </div>

        <form className="search-controls" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search your records..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            required
          />

          <button className="primary-button" type="submit">
            {loading ? 'Searching...' : 'Search'}
          </button>

          <button
            className="secondary-button"
            type="button"
            onClick={clearSearch}
          >
            Clear
          </button>
        </form>
      </div>

      {searched && (
        <div className="content-card table-card search-results">
          <div className="search-result-heading">
            <strong>
              {results.length} result{results.length === 1 ? '' : 's'} found
            </strong>
          </div>

          {results.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name</th>
                  <th>Details</th>
                  <th>Status</th>
                  <th>Value</th>
                </tr>
              </thead>

              <tbody>
                {results.map((result) => (
                  <tr key={`${result.type}-${result.id}`}>
                    <td>
                      <span className="result-type">
                        {result.type}
                      </span>
                    </td>

                    <td>
                      <strong>{result.title}</strong>
                    </td>

                    <td>{result.details || '—'}</td>
                    <td>{result.status || '—'}</td>

                    <td>
                      {result.value === null
                        ? '—'
                        : `$${Number(result.value).toLocaleString()}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-search">
              No matching records were found.
            </div>
          )}
        </div>
      )}
    </>
  )
}
