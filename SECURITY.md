# Security

Security is built into the Townside Web Client Lead & Job Dashboard at both the application and database level.

## Password Security

Passwords are never stored as plain text. The application uses bcrypt to hash passwords before saving them to the database.

Password requirements include:

- At least 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

## Authentication

After a successful login, the server creates a signed JWT authentication token. Protected API routes require a valid authentication token before returning or modifying private business information.

## Business Data Separation

The server determines the user's business from the authenticated account. The application does not rely on a browser-provided business ID when deciding which records the user is allowed to access or modify.

## Database Security

Database operations use prepared statements instead of inserting user input directly into SQL commands. This helps reduce the risk of SQL injection attacks.

## API Protection

The Express backend uses Helmet security headers, API rate limiting, stricter rate limiting for login and registration, CORS restrictions, and JSON request-size limits.

## Environment Variables

Security secrets are stored in a local `.env` file. The `.env` file is excluded from Git and is not committed to the repository. An `.env.example` file is included to show the required configuration without exposing the real secret.
