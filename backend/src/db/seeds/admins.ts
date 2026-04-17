import { eq } from 'drizzle-orm';

import { hashPassword } from '../../auth/password.js';
import { loadConfig } from '../../support/config.js';
import { isMainModule } from '../../support/runtime.js';
import { createDatabaseClient } from '../client.js';
import { adminUsers } from '../schema.js';

export async function seedAdmins(config = loadConfig()) {
  const database = createDatabaseClient(config.databaseUrl);
  const email = config.adminSeedEmail.toLowerCase();

  try {
    const existing = await database.db.query.adminUsers.findFirst({
      where: eq(adminUsers.email, email),
    });

    if (existing) {
      await database.db
        .update(adminUsers)
        .set({
          passwordHash: hashPassword(config.adminSeedPassword),
          fullName: 'BestPrice Admin',
          role: 'admin',
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(adminUsers.email, email));
    } else {
      await database.db.insert(adminUsers).values({
        email,
        passwordHash: hashPassword(config.adminSeedPassword),
        fullName: 'BestPrice Admin',
        role: 'admin',
        status: 'active',
      });
    }
  } finally {
    await database.close();
  }
}

if (isMainModule(import.meta.url)) {
  void seedAdmins()
    .then(() => {
      console.log('Admin seed completed successfully.');
    })
    .catch((error: unknown) => {
      console.error('Admin seed failed.', error);
      process.exitCode = 1;
    });
}
