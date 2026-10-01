# Database Schema

The database uses the `businesses` table as the parent record for client accounts. Users, leads, jobs, and customers are connected to a business through `business_id`.

```mermaid
erDiagram
    BUSINESSES ||--o{ USERS : has
    BUSINESSES ||--o{ LEADS : owns
    BUSINESSES ||--o{ JOBS : owns
    BUSINESSES ||--o{ CUSTOMERS : owns

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
```

## Relationships

- One business can have multiple users.
- One business can have multiple leads.
- One business can have multiple jobs.
- One business can have multiple customers.
- `business_id` is used to keep each client's data separated.
