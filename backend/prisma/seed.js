const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Seed script for CleanStreak database
 * Initializes default keystone task types
 */

const defaultKeystoneTypes = [
  {
    task_type: 'master_toilet',
    description: 'Scrub and disinfect master toilet',
    sort_order: 1
  },
  {
    task_type: 'guest_toilet',
    description: 'Scrub and disinfect guest/hall toilet',
    sort_order: 2
  },
  {
    task_type: 'kitchen_sink',
    description: 'Scrub kitchen sink and faucet',
    sort_order: 3
  },
  {
    task_type: 'master_bath_sink',
    description: 'Clean master bathroom sink',
    sort_order: 4
  },
  {
    task_type: 'guest_bath_sink',
    description: 'Clean guest bathroom sink',
    sort_order: 5
  },
  {
    task_type: 'stovetop',
    description: 'Wipe down stovetop and burners',
    sort_order: 6
  },
  {
    task_type: 'shower_tub',
    description: 'Scrub shower/tub',
    sort_order: 7
  },
  {
    task_type: 'microwave',
    description: 'Clean microwave interior',
    sort_order: 8
  }
];

async function main() {
  console.log('Starting database seed...');

  // Note: This seed script is designed to be idempotent
  // Keystone tasks are user-specific, so they are created when a user
  // first configures their rooms via the KeystoneService.initializeDefaultKeystones()

  console.log('\nDefault keystone task types defined:');
  defaultKeystoneTypes.forEach((keystone, index) => {
    console.log(`  ${index + 1}. ${keystone.task_type}: ${keystone.description}`);
  });

  console.log('\nThese will be initialized per-user when they configure their first room.');
  console.log('\nSeed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

module.exports = { defaultKeystoneTypes };
