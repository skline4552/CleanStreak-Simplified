#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { createId } = require('@paralleldrive/cuid2');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔍 Inspecting database...\n');

    // Check existing users
    const users = await prisma.users.findMany({
      select: {
        id: true,
        email: true,
        created_at: true
      }
    });

    console.log(`📊 Found ${users.length} existing users:`);
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (ID: ${user.id})`);
    });

    // Check for any existing streaks
    const streaks = await prisma.user_streaks.findMany({
      take: 5
    });

    console.log(`\n📈 Found ${streaks.length} existing streaks (showing first 5):`);
    streaks.forEach((streak, index) => {
      console.log(`   ${index + 1}. User: ${streak.user_id}, Task: ${streak.task_name}, Streak: ${streak.current_streak}`);
    });

    // Check completion history
    const completions = await prisma.completion_history.count();
    console.log(`\n✅ Found ${completions} completion records`);

    // Create a test user if none exist or if we need a fresh one
    if (users.length === 0) {
      console.log('\n🔧 Creating test user...');
      const hashedPassword = await bcrypt.hash('TestPassword123', 12);

      const testUser = await prisma.users.create({
        data: {
          id: createId(),
          email: 'step10testuser@example.com',
          password_hash: hashedPassword,
          created_at: new Date(),
          last_login: new Date()
        }
      });

      console.log(`✅ Created test user: ${testUser.email} (ID: ${testUser.id})`);
      console.log('📝 Test credentials:');
      console.log('   Email: step10testuser@example.com');
      console.log('   Password: TestPassword123');
    } else {
      console.log('\n✅ Existing users available for testing');
      console.log('💡 Try these common test credentials:');
      console.log('   Email: test@example.com, Password: TestPassword123');
      console.log('   Email: step10testuser@example.com, Password: TestPassword123');
    }

  } catch (error) {
    console.error('❌ Database inspection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();