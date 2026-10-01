import { createContext, useContext, useState } from 'react'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    try {
      const saved = localStorage.getItem('townsideAuth')

      if (!saved) {
        localStorage.removeItem('townsideUser')
        return null
      }

      const parsed = JSON.parse(saved)

      if (!parsed?.user || !parsed?.token) {
        localStorage.removeItem('townsideAuth')
        localStorage.removeItem('townsideUser')
        return null
      }

      return parsed
    } catch {
      localStorage.removeItem('townsideAuth')
      localStorage.removeItem('townsideUser')
      return null
    }
  })

  const login = (userData, token) => {
    const nextAuth = {
      user: userData,
      token
    }

    localStorage.setItem(
      'townsideAuth',
      JSON.stringify(nextAuth)
    )

    localStorage.removeItem('townsideUser')
    setAuth(nextAuth)
  }

  const logout = () => {
    localStorage.removeItem('townsideAuth')
    localStorage.removeItem('townsideUser')
    setAuth(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user: auth?.user || null,
        token: auth?.token || null,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
