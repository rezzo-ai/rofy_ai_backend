# Rofy AI Backend

A production-ready NestJS backend API for Rofy AI application with Clerk authentication, Firebase integration, and MySQL database support.

## Features

- 🔐 **Clerk Authentication** - JWT token verification for secure API access
- 🗄️ **MySQL Database** - User management with connection pooling
- 🔥 **Firebase Integration** - Document updates and real-time data
- 🤖 **Anthropic AI** - Claude integration for AI-powered features
- 🛡️ **Security** - Helmet, CORS, rate limiting, and input validation
- 📊 **Health Checks** - Monitoring endpoints for service status
- ⚡ **PM2 Process Management** - Production-ready process management with clustering
- 🚀 **Production Ready** - Logging, error handling, and graceful shutdown

## Prerequisites

- Node.js 18+ 
- MySQL database
- Clerk account and API keys
- Firebase project
- Anthropic API key

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd rofy_ai_backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (copy `.env.example` to `.env`):
```bash
cp .env.example .env
```

4. Configure your `.env` file with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=5000

# Database Configuration
DB_HOST=your_mysql_host
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=your_database_name
DB_PORT=3306

# Clerk Authentication
CLERK_ISSUER=https://clerk.accounts.dev
CLERK_AUDIENCE=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Firebase Configuration
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
FIREBASE_APP_ID=your_firebase_app_id
FIREBASE_MEASUREMENT_ID=your_firebase_measurement_id

# Anthropic AI
ANTHROPIC_KEY=your_anthropic_api_key
PLAN_CREATION_MODEL=claude-3-sonnet-20240229

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

## Development

Start the development server:
```bash
npm run start:dev
```

The API will be available at `http://localhost:5000`

## Production

### With PM2 (Recommended)

1. Build the application:
```bash
npm run build
```

2. Start with PM2 in production mode:
```bash
npm run pm2:start:prod
```

For more PM2 commands and configuration details, see [PM2_SETUP.md](./PM2_SETUP.md).

### Standard Node.js

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm run start:prod
```

## API Endpoints

### Health Check
- `GET /health` - Service health status
- `GET /` - API information

### Users
- `POST /users/register` - Register a new user (requires authentication)
- `GET /users/profile` - Get user profile (requires authentication)
- `GET /users/health` - Users service health check

## Authentication

All API endpoints (except health checks) require a valid Clerk JWT token in the Authorization header:

```
Authorization: Bearer <your-clerk-jwt-token>
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clerk_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_clerk_id (clerk_id),
    INDEX idx_email (email)
);
```

## Error Handling

The API returns standardized error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (development only)"
}
```

## Security Features

- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - Request throttling
- **Input Validation** - Request payload validation
- **JWT Verification** - Token-based authentication
- **SQL Injection Protection** - Parameterized queries

## Logging

The application uses NestJS built-in logger with different log levels:
- `log` - General information
- `warn` - Warning messages
- `error` - Error messages

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment (development/production) | No |
| `PORT` | Server port | No (default: 5000) |
| `DB_HOST` | MySQL host | Yes |
| `DB_USER` | MySQL username | Yes |
| `DB_PASSWORD` | MySQL password | Yes |
| `DB_NAME` | Database name | Yes |
| `DB_PORT` | MySQL port | No (default: 3306) |
| `CLERK_ISSUER` | Clerk JWT issuer | Yes |
| `CLERK_AUDIENCE` | Clerk audience | Yes |
| `CLERK_SECRET_KEY` | Clerk secret key | Yes |
| `FIREBASE_*` | Firebase configuration | Yes |
| `ANTHROPIC_KEY` | Anthropic API key | Yes |
| `FRONTEND_URL` | Frontend URL for CORS | No |

## Deployment

### Docker (Recommended)

The Docker setup includes PM2 for production process management:

1. Build the Docker image:
```bash
docker build -t rofy-ai-backend .
```

2. Run the container:
```bash
docker run -p 5000:5000 --env-file .env rofy-ai-backend
```

### Traditional Hosting with PM2

1. Build the application:
```bash
npm run build
```

2. Install dependencies (including PM2):
```bash
npm install
```

3. Start with PM2:
```bash
npm run pm2:start:prod
```

### Traditional Hosting (Basic)

1. Build the application:
```bash
npm run build
```

2. Upload the `dist` folder and `package.json`

3. Install production dependencies:
```bash
npm install --production
```

4. Start the application:
```bash
npm run start:prod
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the ISC License.
