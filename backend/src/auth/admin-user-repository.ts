import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { adminUsers } from '../db/schema.js';
import { verifyPassword } from './password.js';

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
    const email = data.email.toLowerCase();

    const result = await this.database
      .insert(adminUsers)
      .values({
        email,
        passwordHash: data.passwordHash,
        fullName: data.displayName || email.split('@')[0],
        role: 'admin' as const,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
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
      .from(adminUsers)
      .where(eq(adminUsers.email, email.toLowerCase()));

    return result[0] || null;
  }

  /**
   * Find admin by ID
   */
  async findById(adminId: string) {
    const result = await this.database
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, adminId));

    return result[0] || null;
  }

  /**
   * Get all admin users
   */
  async findAll() {
    const result = await this.database
      .select()
      .from(adminUsers)
      .orderBy(adminUsers.createdAt);

    return result;
  }

  /**
   * Update admin profile
   */
  async updateProfile(adminId: string, data: {
    displayName?: string;
  }) {
    const result = await this.database
      .update(adminUsers)
      .set({
        fullName: data.displayName,
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, adminId))
      .returning();

    return result[0] || null;
  }

  /**
   * Update admin password
   */
  async updatePassword(adminId: string, newPasswordHash: string) {
    const result = await this.database
      .update(adminUsers)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, adminId))
      .returning();

    return result[0] || null;
  }

  /**
   * Record a successful admin sign-in.
   */
  async recordSuccessfulLogin(adminId: string) {
    const result = await this.database
      .update(adminUsers)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, adminId))
      .returning();

    return result[0] || null;
  }

  /**
   * Verify admin credentials
   */
  async verifyCredentials(email: string, password: string) {
    const admin = await this.findByEmail(email);

    if (!admin || admin.status !== 'active') {
      return null;
    }

    const isValid = verifyPassword(password, admin.passwordHash);

    if (!isValid) {
      return null;
    }

    return admin;
  }
}
