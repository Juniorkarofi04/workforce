import { eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { departments, users } from './schema.ts';

export type UserRole = 'CEO' | 'DEPARTMENT_HEAD';

export interface DbUser {
  id: number;
  uid: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  departmentId: number | null;
}

const INITIAL_CEO_EMAIL = 'juniornasir04@gmail.com';

export async function getOrCreateUser(
  uid: string,
  email: string,
  name: string,
  avatarUrl: string | null = null
): Promise<DbUser> {
  try {
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);

    if (existing.length > 0) {
      const updated = await db
        .update(users)
        .set({
          email,
          name: name || existing[0].name,
          avatarUrl: avatarUrl ?? existing[0].avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.uid, uid))
        .returning();
      return updated[0];
    }

    // Determine initial role safely for first-time registration
    const ceoCountResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, 'CEO'));

    const hasCeo = (ceoCountResult[0]?.count ?? 0) > 0;
    const isInitialOwner = email.toLowerCase() === INITIAL_CEO_EMAIL;
    const assignedRole: UserRole = isInitialOwner || !hasCeo ? 'CEO' : 'DEPARTMENT_HEAD';

    let defaultDepartmentId: number | null = null;
    if (assignedRole === 'DEPARTMENT_HEAD') {
      const firstDept = await db.select({ id: departments.id }).from(departments).limit(1);
      defaultDepartmentId = firstDept[0]?.id ?? null;
    }

    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        name: name || email.split('@')[0],
        avatarUrl,
        role: assignedRole,
        departmentId: defaultDepartmentId,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          name: name || email.split('@')[0],
          avatarUrl,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database error in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user profile.', { cause: error });
  }
}

export async function listUsersWithDepartments() {
  try {
    const allUsers = await db.select().from(users);
    const allDepts = await db.select().from(departments);
    const deptMap = new Map(allDepts.map((d) => [d.id, d]));

    return allUsers.map((u) => ({
      ...u,
      departmentName: u.departmentId ? deptMap.get(u.departmentId)?.name ?? null : null,
      departmentCode: u.departmentId ? deptMap.get(u.departmentId)?.code ?? null : null,
    }));
  } catch (error) {
    console.error('Database error in listUsersWithDepartments:', error);
    throw new Error('Failed to fetch user directory.', { cause: error });
  }
}
