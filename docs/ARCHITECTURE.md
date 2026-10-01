# Application Architecture

The Townside Web Client Lead & Job Dashboard uses a React frontend, an Express backend, and a SQLite database.

```mermaid
flowchart LR
    A[Client Browser] --> B[React / Vite Frontend]
    B -->|REST API| C[Express API]
    C --> D[Helmet Security Headers]
    C --> E[Rate Limiting]
    C --> F[JWT Authentication]
    F --> G[Business Access Control]
    G --> H[Prepared SQL Statements]
    H --> I[(SQLite Database)]
    I --> J[Businesses]
    I --> K[Users]
    I --> L[Leads]
    I --> M[Jobs]
    I --> N[Customers]
```

## Request Flow

1. A user signs in through the React frontend.
2. The Express server verifies the email and hashed password.
3. The server issues a signed authentication token.
4. Protected API requests include the authentication token.
5. The server determines the user's business from the authenticated account.
6. Database queries are limited to records belonging to that business.
7. Prepared statements are used when reading or changing database records.
