# CleanStreak

A personalized habit tracking application that helps you maintain cleanliness and build consistent routines through customizable room-based task management and streak tracking.

## Features

### Core Functionality
- **User Authentication**: Secure registration and login with JWT-based authentication
- **Streak Tracking**: Track your daily completion streaks for multiple tasks
- **Task Completion**: Complete daily tasks and maintain your momentum
- **Progress Visualization**: View your current and longest streaks

### Room Customization (Phase 8)
- **Custom Room Configuration**: Add and manage rooms specific to your home (bedrooms, bathrooms, kitchen, etc.)
- **Automated Task Generation**: Intelligent task rotation based on your room configuration
- **Keystone Tasks**: High-frequency hygiene points (sinks, toilets, stovetops) automatically configured per room
- **Adaptive Rotation**: 3-pillar task system (surfaces, floors, organization) with keystone tasks interspersed every 3-5 tasks
- **Pending Configuration**: Changes to rooms apply after completing your current rotation cycle
- **Task Preview**: View upcoming tasks before starting each day

### User Experience
- **Onboarding Flow**: Guided setup for new users to configure rooms and keystone tasks
- **Settings Management**: Update room configurations, manage keystone tasks, and customize your account
- **Dark/Light Mode**: Modern, responsive UI with theme support
- **Mobile-Friendly**: Fully responsive design works on all devices

## Tech Stack

### Backend
- **Node.js** (v18+) - Runtime environment
- **Express.js** - Web framework
- **Prisma ORM** - Database management
- **PostgreSQL** - Production database
- **SQLite** - Development database
- **JWT** - Authentication tokens
- **bcrypt** - Password hashing
- **Jest & Supertest** - Testing framework

### Frontend
- **Vanilla JavaScript** - No framework dependencies
- **HTML5 & CSS3** - Modern, semantic markup
- **Single Page Application** - Dynamic content loading

### Security & Performance
- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing
- **Express Rate Limit** - API rate limiting
- **Cookie Parser** - Secure cookie handling

## Prerequisites

- **Node.js** version 18.0.0 or higher
- **npm** (comes with Node.js)
- **PostgreSQL** (for production) or **SQLite** (for development)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/CleanStreak_Simplified.git
cd CleanStreak_Simplified
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies (Optional)

```bash
cd ..
npm install
```

## Configuration

### Environment Variables

Create a `.env` file in the `backend` directory:

```bash
# Development Environment
NODE_ENV=development
PORT=3000

# Database Configuration
DATABASE_PROVIDER="sqlite"
DATABASE_URL="file:./dev.db"

# JWT Configuration
JWT_SECRET="your-development-secret-min-32-characters"
JWT_REFRESH_SECRET="your-development-refresh-secret-min-32-characters"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Cookie Configuration
COOKIE_SECRET="your-cookie-secret-min-32-characters"
COOKIE_SECURE=false
COOKIE_SAME_SITE="lax"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

**For production**, see [DEPLOYMENT.md](./DEPLOYMENT.md) for PostgreSQL configuration and security best practices.

### Database Setup

```bash
cd backend

# Generate Prisma Client
npm run db:generate

# Push schema to database (development)
npm run db:push

# Or run migrations (production)
npm run db:migrate

# (Optional) Seed the database with test data
npm run db:seed
```

## Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
# Serve the frontend (using any static server)
npx http-server -p 8080

# Or use the included script
npm start
```

Then open your browser to:
- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:3000

### Production Mode

```bash
cd backend
npm start
```

See [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) for rapid deployment or [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive deployment guides.

## Testing

### Run All Tests

```bash
cd backend
npm test
```

### Run Specific Test Suites

```bash
# Authentication tests
npm test tests/auth.test.js

# Streak tracking tests
npm test tests/streak.test.js

# Room customization tests
npm test tests/services/roomService.test.js
npm test tests/integration/roomConfigFlow.test.js

# Test coverage
npm run test:coverage
```

### Current Test Coverage

- **276 total tests** with 100% pass rate
- Auth Tests: 43/43
- Security Tests: 25/25
- Streak Tests: 28/28
- User Tests: 24/24
- Performance Tests: 25/25
- Room Service Tests: 32/32
- Task Generation Tests: 19/19
- Task Progress Tests: 29/29
- Integration Tests: 51/51

## API Documentation

Full API documentation is available in [backend/docs/API.md](./backend/docs/API.md).

### Key Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout

#### Room Management
- `GET /api/rooms` - Get all user rooms
- `POST /api/rooms` - Create a new room
- `PUT /api/rooms/:id` - Update a room
- `DELETE /api/rooms/:id` - Delete a room
- `PUT /api/rooms/reorder` - Reorder rooms

#### Keystone Tasks
- `GET /api/keystone-tasks` - Get all keystone tasks
- `POST /api/keystone-tasks/initialize` - Initialize default keystones
- `POST /api/keystone-tasks/add-for-room` - Add keystones for a specific room
- `PUT /api/keystone-tasks/:id` - Update keystone task
- `DELETE /api/keystone-tasks/:id` - Delete keystone task

#### Task Rotation
- `GET /api/tasks/current` - Get current task
- `GET /api/tasks/preview` - Preview upcoming tasks
- `POST /api/user/complete` - Complete current task

#### User Management
- `GET /api/user/profile` - Get user profile
- `GET /api/user/account` - Get account summary with stats
- `GET /api/user/stats` - Get user statistics
- `GET /api/user/history` - Get completion history
- `PUT /api/user/change-password` - Change password
- `DELETE /api/user/account` - Delete account

## Project Structure

```
CleanStreak_Simplified/
├── backend/
│   ├── src/
│   │   ├── controllers/      # Route controllers
│   │   ├── middleware/       # Express middleware
│   │   ├── routes/           # API route definitions
│   │   ├── services/         # Business logic layer
│   │   ├── utils/            # Helper functions
│   │   ├── config/           # Configuration files
│   │   └── app.js            # Express app entry point
│   ├── tests/                # Test suites
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema
│   │   ├── migrations/       # Database migrations
│   │   └── seed.js           # Database seeding
│   ├── docs/                 # API documentation
│   └── package.json
├── index.html                # Frontend SPA
├── .env.production           # Production environment template
├── package.json              # Frontend package configuration
├── start-frontend.sh         # Frontend startup script
├── DEPLOYMENT.md             # Deployment guide
├── QUICK_DEPLOY.md           # Quick deployment reference
├── CONTRIBUTING.md           # Contribution guidelines
└── README.md                 # This file
```

## Key Services

### RoomService
Manages user room configurations, validation, and CRUD operations.

### KeystoneService
Handles high-frequency hygiene tasks that are interspersed in the rotation.

### TaskGenerationService
Generates intelligent task rotations based on room configurations:
- 3-pillar system: surfaces, floors, organization
- Keystones inserted every 3-5 tasks
- Room-specific task descriptions
- Rotation versioning for change management

### TaskProgressService
Tracks user progress through rotations and handles cycle completion.

### StreakService
Manages streak calculations, completion history, and statistics.

## Database Schema

The application uses Prisma ORM with the following main models:

- **users** - User accounts and authentication
- **user_sessions** - Refresh token management
- **user_streaks** - Streak tracking per task
- **completion_history** - Historical completion records
- **user_rooms** - Custom room configurations
- **user_keystone_tasks** - High-frequency hygiene points
- **task_rotation** - Generated task sequences
- **user_task_progress** - Current position in rotation
- **pending_room_configs** - Queued configuration changes

See [backend/prisma/schema.prisma](./backend/prisma/schema.prisma) for the complete schema.

## Development

### Database Management

```bash
# Open Prisma Studio (GUI for database)
npm run db:studio

# Create a new migration
npm run db:migrate

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Generate Prisma Client
npm run db:generate
```

### Adding New Features

1. Update the database schema in `prisma/schema.prisma`
2. Create migration: `npm run db:migrate`
3. Add business logic in `src/services/`
4. Create controller in `src/controllers/`
5. Define routes in `src/routes/`
6. Add tests in `tests/`
7. Update API documentation in `backend/docs/API.md`

## Deployment

### Quick Deploy

For rapid deployment to platforms like Railway or Render, see [QUICK_DEPLOY.md](./QUICK_DEPLOY.md).

### Full Deployment Guide

For comprehensive deployment instructions including:
- Railway (Recommended)
- Render
- Vercel
- DigitalOcean

See [DEPLOYMENT.md](./DEPLOYMENT.md).

### Environment Considerations

**Development:**
- SQLite database
- Relaxed rate limits
- Debug logging enabled
- CORS enabled for localhost

**Production:**
- PostgreSQL database
- Strict rate limits
- Security headers enabled
- Environment-based CORS
- HTTPS/secure cookies

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Running Tests Before Commit

```bash
cd backend
npm test
```

All tests must pass before submitting a pull request.

## Security

- Passwords are hashed using bcrypt with salt rounds
- JWT tokens for stateless authentication
- Refresh tokens stored in httpOnly cookies
- Rate limiting on all endpoints
- Helmet.js for security headers
- Input validation and sanitization
- SQL injection protection via Prisma

**Security Best Practices:**
- Never commit `.env` files
- Rotate secrets regularly in production
- Use strong JWT secrets (min 32 characters)
- Enable HTTPS in production
- Keep dependencies updated

## Roadmap

- [ ] Email verification for new accounts
- [ ] Password reset functionality
- [ ] Task scheduling and reminders
- [ ] Social features and shared challenges
- [ ] Mobile app (React Native)
- [ ] Data export and analytics
- [ ] Multi-language support

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or contributions:
- **Issues**: [GitHub Issues](https://github.com/yourusername/CleanStreak_Simplified/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/CleanStreak_Simplified/discussions)

## Acknowledgments

- Built with modern web technologies and best practices
- Comprehensive test coverage ensuring reliability
- Clean architecture for maintainability and scalability

---

**Made with dedication to building better habits, one task at a time.**
