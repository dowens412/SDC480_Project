# Database Schema

This is the database setup I used for the Townside Web Client Lead & Job Dashboard.

The `businesses` table is the main table for each client account. The other tables use `business_id` so the records stay connected to the correct business.

```mermaid
erDiagram
    BUSINESSES ||--o{ USERS : has
    BUSINESSES ||--o{ LEADS : has
    BUSINESSES ||--o{ JOBS : has
    BUSINESSES ||--o{ CUSTOMERS : has

    BUSINESSES {
        integer id PK
        text name
        datetime created_at
    }

    USERS {
        integer id PK
        integer business_id FK
        text name
        text email
        text password_hash
        text role
        datetime created_at
    }

    LEADS {
        integer id PK
        integer business_id FK
        text customer_name
        text phone
        text email
        text service
        text status
        real estimated_value
        text notes
        datetime created_at
    }

    JOBS {
        integer id PK
        integer business_id FK
        text customer_name
        text service
        text status
        real job_value
        text scheduled_date
        datetime created_at
    }

    CUSTOMERS {
        integer id PK
        integer business_id FK
        text name
        text phone
        text email
        datetime created_at
    }
}
```

## Relationships

- A business can have multiple users.
- A business can have multiple leads.
- A business can have multiple jobs.
- A business can have multiple customers.
- `business_id` keeps each business account and its records separated.
