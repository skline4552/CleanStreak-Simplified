#!/bin/bash

# Exit immediately if a command exits with a non-zero status (except the test command itself)
set -e

# Store the current directory to return to it
CURRENT_DIR=$(pwd)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/.."

echo "Starting test run..."
echo "Setting up SQLite environment for testing..."

# Navigate to backend root
cd "$PROJECT_ROOT"

# Function to restore original client
restore_client() {
    echo ""
    echo "Restoring PostgreSQL Prisma Client..."
    npx prisma generate --schema=prisma/schema.prisma
}

# Trap exit to ensure client is restored even if script fails/is interrupted
trap restore_client EXIT

# Generate Prisma Client for SQLite
echo "Generating Prisma Client for SQLite..."
npx prisma generate --schema=prisma/schema.test.prisma

# Push schema to SQLite DB
echo "Pushing schema to test database..."
# Use a specific test db file
export DATABASE_URL="file:./test.db"
export CORS_ORIGIN="http://localhost:3000,http://localhost:8080"
# Ensure clean slate
rm -f prisma/test.db
npx prisma db push --schema=prisma/schema.test.prisma

# Run tests
echo "Running tests..."
# We allow the test command to fail (set +e) so we can capture the exit code
set +e
npm test -- "$@"
TEST_EXIT_CODE=$?
set -e

# Cleanup is handled by trap
exit $TEST_EXIT_CODE
