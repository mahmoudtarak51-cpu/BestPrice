import type { Database } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { adminUsersTable } from '../db/schema.js';
import { hashPassword, verifyPassword } from './password.js';

/**
 * Repository for managing admin user persistence
 */
export class AdminUserRepository {
  constructor(private database: Database) {}

  /**
   * Create an admin user account
   */
  async create(data: {
    email: string;
    passwordHash: string;
    displayName?: string;
  }) {
    const result = await this.database
      .insert(adminUsersTable)
      .values({
        email: data.email,
        password_hash: data.passwordHash,
        display_name: data.displayName || data.email.split('@')[0],
        role: 'admin' as const,
        created_at: new Date(),
      })
      .returning();

    return result[0];
  }

  /**
   * Find admin by email
   */
  async findByEmail(email: string) {
    const result = await this.database
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.email, email));

    return result[0] || null;
  }

  /**
   * Find admin by ID
   */
  async findById(adminId: string) {
    const result = await this.database
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.id, adminId));

    return result[0] || null;
  }

  /**
   * Get all admin users
   */
  async findAll() {
    const result = await this.database
      .select()
      .from(adminUsersTable)
      .orderBy(adminUsersTable.created_at);

    return result;
  }

  /**
   * Update admin profile
   */
  async updateProfile(adminId: string, data: {
    displayName?: string;
  }) {
    const result = await this.database
      .update(adminUsersTable)
      .set({
        display_name: data.displayName,
        updated_at: new Date(),
      })
      .where(eq(adminUsersTable.id, adminId))
      .returning();

    return result[0] || null;
  }

  /**
   * Update admin password
   */
  async updatePassword(adminId: string, newPasswordHash: string) {
    const result = await this.database
      .update(adminUsersTable)
      .set({
        password_hash: newPasswordHash,
        updated_at: new Date(),
      })
      .where(eq(adminUsersTable.id, adminId))
      .returning();

    return result[0] || null;
  }

  /**
   * Verify admin credentials
   */
  async verifyCredentials(email: string, password: string) {
    const admin = await this.findByEmail(email);
    
    if (!admin) {
      return null;
    }

    const isValid = await verifyPassword(password, admin.password_hash);
    
    if (!isValid) {
      return null;
    }

    return admin;
  }
}
