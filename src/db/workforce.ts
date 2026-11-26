import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  approvalRequests,
  auditLogs,
  candidates,
  departments,
  employees,
  jobRequisitions,
  onboardingTasks,
  users,
} from './schema.ts';
import { DbUser } from './users.ts';

export interface ActorInfo {
  name: string;
  email: string;
  role: string;
}

function addDays(isoDate: string, days: number): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + days);
    return fallback.toISOString().slice(0, 10);
  }
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export async function getDepartmentsWithStaffing() {
  try {
    const allDepts = await db.select().from(departments).orderBy(departments.id);
    const allEmps = await db.select().from(employees);
    const allReqs = await db.select().from(jobRequisitions);

    return allDepts.map((dept) => {
      const deptEmps = allEmps.filter((e) => e.departmentId === dept.id);
      const filledCount = deptEmps.length;
      const activeCount = deptEmps.filter((e) => e.status === 'Active').length;
      const onLeaveCount = deptEmps.filter((e) => e.status === 'On Leave').length;
      const onboardingCount = deptEmps.filter((e) => e.status === 'Onboarding').length;
      const gap = dept.targetHeadcount - filledCount;
      const openReqs = allReqs.filter((r) => r.departmentId === dept.id && r.status === 'Open');

      return {
        ...dept,
        filledCount,
        activeCount,
        onLeaveCount,
        onboardingCount,
        gap,
        openRequisitionsCount: openReqs.length,
        openRolesNeeded: openReqs.reduce(
          (sum, r) => sum + Math.max(0, r.headcountNeeded - r.filledHires),
          0
        ),
      };
    });
  } catch (error) {
    console.error('Error in getDepartmentsWithStaffing:', error);
    throw new Error('Failed to load department staffing metrics.', { cause: error });
  }
}

export async function getDashboardSnapshot() {
  try {
    const [depts, allEmps, allReqs, allCandidates, pendingApprovals, recentAudit] =
      await Promise.all([
        getDepartmentsWithStaffing(),
        db.select().from(employees),
        db.select().from(jobRequisitions),
        db.select().from(candidates),
        db
          .select()
          .from(approvalRequests)
          .where(eq(approvalRequests.status, 'Pending')),
        db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(10),
      ]);

    const totalFilled = allEmps.length;
    const totalTarget = depts.reduce((sum, d) => sum + d.targetHeadcount, 0);
    const totalGap = totalTarget - totalFilled;
    const fillRate = totalTarget > 0 ? Math.round((totalFilled / totalTarget) * 100) : 100;
    const totalBudget = depts.reduce((sum, d) => sum + d.allocatedBudget, 0);

    const activeCount = allEmps.filter((e) => e.status === 'Active').length;
    const onLeaveCount = allEmps.filter((e) => e.status === 'On Leave').length;
    const onboardingCount = allEmps.filter((e) => e.status === 'Onboarding').length;

    const openRequisitionsCount = allReqs.filter((r) => r.status === 'Open').length;
    const activeCandidatesCount = allCandidates.filter(
      (c) => c.stage !== 'Hired' && c.stage !== 'Rejected'
    ).length;

    const criticalAlerts = depts
      .filter((d) => d.gap > 0 && (d.priority === 'Critical' || d.priority === 'High' || d.gap >= 3))
      .sort((a, b) => {
        const priorityWeight = (p: string) => (p === 'Critical' ? 3 : p === 'High' ? 2 : 1);
        const diff = priorityWeight(b.priority) - priorityWeight(a.priority);
        return diff !== 0 ? diff : b.gap - a.gap;
      });

    return {
      summary: {
        totalFilled,
        totalTarget,
        totalGap,
        fillRate,
        totalBudget,
        activeCount,
        onLeaveCount,
        onboardingCount,
        openRequisitionsCount,
        activeCandidatesCount,
        pendingApprovalsCount: pendingApprovals.length,
      },
      departments: depts,
      criticalAlerts,
      recentAudit,
    };
  } catch (error) {
    console.error('Error in getDashboardSnapshot:', error);
    throw new Error('Failed to load executive dashboard snapshot.', { cause: error });
  }
}

export async function globalSearch(query: string) {
  try {
    const trimmed = query.trim();
    if (!trimmed) {
      return { employees: [], departments: [], requisitions: [] };
    }
    const pattern = `%${trimmed}%`;

    const [matchedEmps, matchedDepts, matchedReqs] = await Promise.all([
      db
        .select({
          id: employees.id,
          employeeCode: employees.employeeCode,
          name: employees.name,
          email: employees.email,
          role: employees.role,
          departmentId: employees.departmentId,
          status: employees.status,
          location: employees.location,
        })
        .from(employees)
        .where(
          or(
            ilike(employees.name, pattern),
            ilike(employees.role, pattern),
            ilike(employees.email, pattern),
            ilike(employees.employeeCode, pattern),
            ilike(employees.location, pattern)
          )
        )
        .limit(8),
      db
        .select()
        .from(departments)
        .where(
          or(
            ilike(departments.name, pattern),
            ilike(departments.code, pattern),
            ilike(departments.leadName, pattern)
          )
        )
        .limit(6),
      db
        .select()
        .from(jobRequisitions)
        .where(
          or(
            ilike(jobRequisitions.roleTitle, pattern),
            ilike(jobRequisitions.reqCode, pattern),
            ilike(jobRequisitions.hiringManager, pattern)
          )
        )
        .limit(6),
    ]);

    return {
      employees: matchedEmps,
      departments: matchedDepts,
      requisitions: matchedReqs,
    };
  } catch (error) {
    console.error('Error in globalSearch:', error);
    throw new Error('Failed to execute search.', { cause: error });
  }
}

export async function createDepartment(
  data: {
    name: string;
    code: string;
    leadName: string;
    description: string;
    targetHeadcount: number;
    allocatedBudget: number;
    priority: string;
    location: string;
  },
  actor: ActorInfo
) {
  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(departments)
        .values({
          name: data.name.trim(),
          code: data.code.trim().toUpperCase(),
          leadName: data.leadName.trim(),
          description: data.description.trim(),
          targetHeadcount: Math.max(0, Math.floor(data.targetHeadcount)),
          allocatedBudget: Math.max(0, Math.floor(data.allocatedBudget)),
          priority: data.priority,
          location: data.location.trim() || 'Victoria Island, Lagos',
        })
        .returning();

      await tx.insert(auditLogs).values({
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'DEPARTMENT_CREATED',
        entityType: 'Department',
        entityId: created.id,
        summary: `Created department ${created.name} (${created.code}) with target ${created.targetHeadcount} FTE`,
        details: `Lead: ${created.leadName} · Budget: ₦${created.allocatedBudget.toLocaleString()} · Priority: ${created.priority}`,
      });

      return created;
    });
  } catch (error) {
    console.error('Error in createDepartment:', error);
    throw new Error('Failed to create department. Ensure name and code are unique.', { cause: error });
  }
}

export async function updateDepartment(
  id: number,
  data: {
    name?: string;
    leadName?: string;
    description?: string;
    targetHeadcount?: number;
    allocatedBudget?: number;
    priority?: string;
    location?: string;
  },
  actor: ActorInfo
) {
  try {
    return await db.transaction(async (tx) => {
      const existing = await tx.select().from(departments).where(eq(departments.id, id)).limit(1);
      if (existing.length === 0) {
        throw new Error('Department not found.');
      }

      const [updated] = await tx
        .update(departments)
        .set({
          name: data.name !== undefined ? data.name.trim() : existing[0].name,
          leadName: data.leadName !== undefined ? data.leadName.trim() : existing[0].leadName,
          description: data.description !== undefined ? data.description.trim() : existing[0].description,
          targetHeadcount:
            data.targetHeadcount !== undefined
              ? Math.max(0, Math.floor(data.targetHeadcount))
              : existing[0].targetHeadcount,
          allocatedBudget:
            data.allocatedBudget !== undefined
              ? Math.max(0, Math.floor(data.allocatedBudget))
              : existing[0].allocatedBudget,
          priority: data.priority !== undefined ? data.priority : existing[0].priority,
          location: data.location !== undefined ? data.location.trim() : existing[0].location,
          updatedAt: new Date(),
        })
        .where(eq(departments.id, id))
        .returning();

      await tx.insert(auditLogs).values({
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'DEPARTMENT_UPDATED',
        entityType: 'Department',
        entityId: updated.id,
        summary: `Updated staffing plan for ${updated.name} (${updated.code})`,
        details: `Target: ${updated.targetHeadcount} FTE · Budget: ₦${updated.allocatedBudget.toLocaleString()} · Priority: ${updated.priority}`,
      });

      return updated;
    });
  } catch (error: any) {
    console.error('Error in updateDepartment:', error);
    throw new Error(error?.message || 'Failed to update department.', { cause: error });
  }
}

export async function getEmployeesWithDetails() {
  try {
    const [allEmps, allDepts, allTasks] = await Promise.all([
      db.select().from(employees).orderBy(desc(employees.id)),
      db.select().from(departments),
      db.select().from(onboardingTasks).orderBy(onboardingTasks.id),
    ]);

    const deptMap = new Map(allDepts.map((d) => [d.id, d]));
    const taskMap = new Map<number, typeof allTasks>();
    for (const t of allTasks) {
      const list = taskMap.get(t.employeeId) || [];
      list.push(t);
      taskMap.set(t.employeeId, list);
    }

    return allEmps.map((emp) => {
      const dept = deptMap.get(emp.departmentId);
      const tasks = taskMap.get(emp.id) || [];
      return {
        ...emp,
        departmentName: dept?.name || 'Unassigned',
        departmentCode: dept?.code || '---',
        onboardingTasks: tasks,
        onboardingCompletedCount: tasks.filter((t) => t.completed).length,
        onboardingTotalCount: tasks.length,
      };
    });
  } catch (error) {
    console.error('Error in getEmployeesWithDetails:', error);
    throw new Error('Failed to load employee directory.', { cause: error });
  }
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  // Neutralize spreadsheet formula injection (=, +, -, @, tab, CR)
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

export async function exportEmployeesPayrollCsv(
  filters: {
    departmentId?: number;
    status?: string;
    employmentType?: string;
    q?: string;
  },
  actor: ActorInfo
): Promise<string> {
  try {
    const allEmps = await getEmployeesWithDetails();
    const qLower = (filters.q || '').trim().toLowerCase();

    const filtered = allEmps.filter((emp) => {
      if (filters.departmentId && emp.departmentId !== filters.departmentId) return false;
      if (filters.status && filters.status !== 'ALL' && emp.status !== filters.status) return false;
      if (
        filters.employmentType &&
        filters.employmentType !== 'ALL' &&
        emp.employmentType !== filters.employmentType
      ) {
        return false;
      }
      if (qLower) {
        const hay = `${emp.name} ${emp.email} ${emp.role} ${emp.employeeCode} ${emp.departmentName} ${emp.location}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      return true;
    });

    const headers = [
      'Employee ID',
      'Full Name',
      'Work Email',
      'Department Code',
      'Department Name',
      'Role',
      'Line Manager',
      'Employment Type',
      'Status',
      'Annual Compensation Band (NGN)',
      'Office Location',
      'Start Date',
    ];

    const rows = filtered.map((emp) =>
      [
        emp.employeeCode,
        emp.name,
        emp.email,
        emp.departmentCode,
        emp.departmentName,
        emp.role,
        emp.managerName,
        emp.employmentType,
        emp.status,
        emp.compensationBand,
        emp.location,
        emp.startDate,
      ]
        .map(escapeCsvCell)
        .join(',')
    );

    await db.insert(auditLogs).values({
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'EMPLOYEE_UPDATED',
      entityType: 'Employee',
      summary: `Exported payroll reconciliation CSV (${filtered.length} employee records)`,
      details: `Currency: NGN (₦) · Format: RFC-4180 CSV`,
    });

    return [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
  } catch (error) {
    console.error('Error in exportEmployeesPayrollCsv:', error);
    throw new Error('Failed to generate payroll CSV export.', { cause: error });
  }
}

export async function createEmployee(
  data: {
    name: string;
    email: string;
    role: string;
    departmentId: number;
    managerName: string;
    startDate: string;
    employmentType: string;
    status: string;
    compensationBand: string;
    location: string;
  },
  actor: ActorInfo
) {
  try {
    return await db.transaction(async (tx) => {
      const dept = await tx
        .select()
        .from(departments)
        .where(eq(departments.id, data.departmentId))
        .limit(1);
      if (dept.length === 0) {
        throw new Error('Selected department does not exist.');
      }

      const maxIdRes = await tx
        .select({ maxId: sql<number>`COALESCE(MAX(${employees.id}), 0)::int` })
        .from(employees);
      const nextNum = 1001 + (maxIdRes[0]?.maxId ?? 0);
      const employeeCode = `EMP-${nextNum}`;

      const [created] = await tx
        .insert(employees)
        .values({
          employeeCode,
          name: data.name.trim(),
          email: data.email.trim().toLowerCase(),
          role: data.role.trim(),
          departmentId: data.departmentId,
          managerName: data.managerName.trim() || dept[0].leadName,
          startDate: data.startDate,
          employmentType: data.employmentType,
          status: data.status,
          compensationBand: data.compensationBand.trim(),
          location: data.location.trim(),
        })
        .returning();

      if (created.status === 'Onboarding') {
        await tx.insert(onboardingTasks).values([
          {
            employeeId: created.id,
            title: 'Laptop Dispatch & Corporate SSO Provisioning',
            category: 'IT & Access',
            completed: false,
            dueDate: addDays(created.startDate, 1),
          },
          {
            employeeId: created.id,
            title: 'PAYE Tax ID, PenCom RSA & HMO Enrollment',
            category: 'HR & Compliance',
            completed: false,
            dueDate: addDays(created.startDate, 3),
          },
          {
            employeeId: created.id,
            title: 'NDPR Data Privacy & Security Policy Sign-Off',
            category: 'HR & Compliance',
            completed: false,
            dueDate: addDays(created.startDate, 5),
          },
          {
            employeeId: created.id,
            title: 'Department Architecture & Playbook Walkthrough',
            category: 'Orientation',
            completed: false,
            dueDate: addDays(created.startDate, 7),
          },
          {
            employeeId: created.id,
            title: '30-60-90 Day Success Plan Alignment',
            category: 'Manager Setup',
            completed: false,
            dueDate: addDays(created.startDate, 14),
          },
        ]);
      }

      await tx.insert(auditLogs).values({
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'EMPLOYEE_CREATED',
        entityType: 'Employee',
        entityId: created.id,
        summary: `Added ${created.name} (${created.employeeCode}) as ${created.role} in ${dept[0].name}`,
        details: `Status: ${created.status} · Type: ${created.employmentType} · ${created.location}`,
      });

      return created;
    });
  } catch (error: any) {
    console.error('Error in createEmployee:', error);
    throw new Error(error?.message || 'Failed to create employee record.', { cause: error });
  }
}

export async function updateEmployee(
  id: number,
  data: {
    name?: string;
    email?: string;
    role?: string;
    managerName?: string;
    startDate?: string;
    employmentType?: string;
    status?: string;
    compensationBand?: string;
    location?: string;
  },
  actor: ActorInfo
) {
  try {
    return await db.transaction(async (tx) => {
      const existing = await tx.select().from(employees).where(eq(employees.id, id)).limit(1);
      if (existing.length === 0) {
        throw new Error('Employee not found.');
      }

      const [updated] = await tx
        .update(employees)
        .set({
          name: data.name !== undefined ? data.name.trim() : existing[0].name,
          email: data.email !== undefined ? data.email.trim().toLowerCase() : existing[0].email,
          role: data.role !== undefined ? data.role.trim() : existing[0].role,
          managerName: data.managerName !== undefined ? data.managerName.trim() : existing[0].managerName,
          startDate: data.startDate !== undefined ? data.startDate : existing[0].startDate,
          employmentType: data.employmentType !== undefined ? data.employmentType : existing[0].employmentType,
          status: data.status !== undefined ? data.status : existing[0].status,
          compensationBand:
            data.compensationBand !== undefined ? data.compensationBand.trim() : existing[0].compensationBand,
          location: data.location !== undefined ? data.location.trim() : existing[0].location,
          updatedAt: new Date(),
        })
        .where(eq(employees.id, id))
        .returning();

      await tx.insert(auditLogs).values({
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'EMPLOYEE_UPDATED',
        entityType: 'Employee',
        entityId: updated.id,
        summary: `Updated profile for ${updated.name} (${updated.employeeCode})`,
        details: `Role: ${updated.role} · Status: ${updated.status} · Band: ${updated.compensationBand}`,
      });

      return updated;
    });
  } catch (error: any) {
    console.error('Error in updateEmployee:', error);
    throw new Error(error?.message || 'Failed to update employee.', { cause: error });
  }
}

export async function transferEmployee(
  employeeId: number,
  toDepartmentId: number,
  newRole: string | undefined,
  newManager: string | undefined,
  actor: ActorInfo
) {
  try {
    return await db.transaction(async (tx) => {
      const empRes = await tx.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
      if (empRes.length === 0) throw new Error('Employee not found.');
      const emp = empRes[0];

      const [fromDept, toDept] = await Promise.all([
        tx.select().from(departments).where(eq(departments.id, emp.departmentId)).limit(1),
        tx.select().from(departments).where(eq(departments.id, toDepartmentId)).limit(1),
      ]);

      if (toDept.length === 0) throw new Error('Target department not found.');
      if (emp.departmentId === toDepartmentId) {
        throw new Error('Employee is already assigned to this department.');
      }

      const [updated] = await tx
        .update(employees)
        .set({
          departmentId: toDepartmentId,
          role: newRole && newRole.trim() ? newRole.trim() : emp.role,
          managerName: newManager && newManager.trim() ? newManager.trim() : toDept[0].leadName,
          updatedAt: new Date(),
        })
        .where(eq(employees.id, employeeId))
        .returning();

      await tx.insert(auditLogs).values({
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'EMPLOYEE_TRANSFERRED',
        entityType: 'Employee',
        entityId: updated.id,
        summary: `Transferred ${updated.name} from ${fromDept[0]?.name || 'Previous Dept'} to ${toDept[0].name}`,
        details: `Role: ${updated.role} · Manager: ${updated.managerName} · Department headcounts recalculated`,
      });

      return updated;
    });
  } catch (error: any) {
    console.error('Error in transferEmployee:', error);
    throw new Error(error?.message || 'Failed to transfer employee.', { cause: error });
  }
}

export async function deleteEmployee(employeeId: number, actor: ActorInfo) {
  try {
    return await db.transaction(async (tx) => {
      const existing = await tx.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
      if (existing.length === 0) throw new Error('Employee not found.');
      const emp = existing[0];

      await tx.delete(employees).where(eq(employees.id, employeeId));

      await tx.insert(auditLogs).values({
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'EMPLOYEE_DELETED',
        entityType: 'Employee',
        entityId: emp.id,
        summary: `Removed ${emp.name} (${emp.employeeCode}) from workforce directory`,
        details: `Former role: ${emp.role}`,
      });

      return { deletedId: employeeId };
    });
  } catch (error: any) {
    console.error('Error in deleteEmployee:', error);
    throw new Error(error?.message || 'Failed to delete employee.', { cause: error });
  }
}

export async function toggleOnboardingTask(taskId: number, completed: boolean, actor: ActorInfo) {
  try {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(onboardingTasks)
        .where(eq(onboardingTasks.id, taskId))
        .limit(1);
      if (existing.length === 0) throw new Error('Onboarding task not found.');

      const [updated] = await tx
        .update(onboardingTasks)
        .set({
          completed,
          completedAt: completed ? new Date() : null,
        })
        .where(eq(onboardingTasks.id, taskId))
        .returning();

      const emp = await tx
        .select()
        .from(employees)
        .where(eq(employees.id, updated.employeeId))
        .limit(1);

      await tx.insert(auditLogs).values({
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'EMPLOYEE_UPDATED',
        entityType: 'Employee',
        entityId: updated.employeeId,
        summary: `${completed ? 'Completed' : 'Reopened'} onboarding task "${updated.title}" for ${emp[0]?.name || 'Employee'}`,
        details: `Category: ${updated.category}`,
      });

      return updated;
    });
  } catch (error: any) {
    console.error('Error in toggleOnboardingTask:', error);
    throw new Error(error?.message || 'Failed to update onboarding task.', { cause: error });
  }
}

export async function addOnboardingTask(
  employeeId: number,
  data: { title: string; category: string; dueDate: string },
  actor: ActorInfo
) {
  try {
    return await db.transaction(async (tx) => {
      const emp = await tx.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
      if (emp.length === 0) throw new Error('Employee not found.');

      const [created] = await tx
        .insert(onboardingTasks)
        .values({
          employeeId,
          title: data.title.trim(),
          category: data.category || 'General',
          dueDate: data.dueDate,
          completed: false,
        })
        .returning();

      await tx.insert(auditLogs).values({
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'EMPLOYEE_UPDATED',
        entityType: 'Employee',
        entityId: employeeId,
        summary: `Assigned onboarding task "${created.title}" to ${emp[0].name}`,
        details: `Due: ${created.dueDate} · Category: ${created.category}`,
      });

      return created;
    });
  } catch (error: any) {
    console.error('Error in addOnboardingTask:', error);
    throw new Error(error?.message || 'Failed to add onboarding task.', { cause: error });
  }
}

export async function getRequisitionsWithCandidates() {
  try {
    const [allReqs, allDepts, allCandidates] = await Promise.all([
      db.select().from(jobRequisitions).orderBy(desc(jobRequisitions.id)),
      db.select().from(departments),
      db.select().from(candidates).orderBy(desc(candidates.updatedAt)),
    ]);

    const deptMap = new Map(allDepts.map((d) => [d.id, d]));

    const reqs = allReqs.map((r) => {
      const dept = deptMap.get(r.departmentId);
      const reqCands = allCandidates.filter((c) => c.requisitionId === r.id);
      return {
        ...r,
        departmentName: dept?.name || 'Unknown',
        departmentCode: dept?.code || '---',
        candidates: reqCands,
      };
    });

    const enrichedCandidates = allCandidates.map((c) => {
      const req = allReqs.find((r) => r.id === c.requisitionId);
      const dept = req ? deptMap.get(req.departmentId) : undefined;
      return {
        ...c,
        roleTitle: req?.roleTitle || 'Role',
        reqCode: req?.reqCode || 'REQ',
        departmentId: req?.departmentId || 0,
        departmentName: dept?.name || 'Unknown',
        departmentCode: dept?.code || '---',
      };
    });

    return { requisitions: reqs, candidates: enrichedCandidates };
  } catch (error) {
    console.error('Error in getRequisitionsWithCandidates:', error);
    throw new Error('Failed to load recruitment pipeline.', { cause: error });
  }
}

export async function getPublicCareersListings() {
  try {
    const [openReqs, allDepts] = await Promise.all([
      db
        .select()
        .from(jobRequisitions)
        .where(
          and(
            eq(jobRequisitions.status, 'Open'),
            eq(jobRequisitions.isPublishedToWebsite, true)
          )
        )
        .orderBy(desc(jobRequisitions.createdAt)),
      db.select().from(departments),
    ]);

    const deptMap = new Map(allDepts.map((d) => [d.id, d]));

    return openReqs.map((req) => {
      const dept = deptMap.get(req.departmentId);
      return {
        id: req.id,
        reqCode: req.reqCode,
        roleTitle: req.roleTitle,
        departmentName: dept?.name || 'Engineering & Operations',
        departmentCode: dept?.code || 'CORP',
        urgency: req.urgency,
        openings: Math.max(1, req.headcountNeeded - req.filledHires),
        targetStartDate: req.targetStartDate,
        compensationBand: req.compensationBand,
        location: req.location,
        employmentType: req.employmentType,
        jobSummary:
          req.jobSummary ||
          `Join Meridian Global's ${dept?.name || 'team'} in ${req.location} to build high-impact enterprise infrastructure.`,
        publishedSocials: req.publishedSocials,
        createdAt: req.createdAt,
      };
    });
  } catch (error) {
    console.error('Error in getPublicCareersListings:', error);
    throw new Error('Failed to load public job listings.', { cause: error });
  }
}

export async function submitPublicJobApplication(
  reqCode: string,
  data: {
    name: string;
    email: string;
    currentTitle: string;
    location: string;
    compensationExpectation: string;
    notes: string;
    source?: string;
  }
) {
  try {
    return await db.transaction(async (tx) => {
      const reqRes = await tx
        .select()
        .from(jobRequisitions)
        .where(eq(jobRequisitions.reqCode, reqCode.trim().toUpperCase()))
        .limit(1);

      if (reqRes.length === 0) {
        throw new Error('Job opening not found.');
      }
      const req = reqRes[0];
      if (req.status !== 'Open' || !req.isPublishedToWebsite) {
        throw new Error('This job opening is no longer accepting public applications.');
      }

      const [created] = await tx
        .insert(candidates)
        .values({
          requisitionId: req.id,
          name: data.name.trim(),
          email: data.email.trim().toLowerCase(),
          currentTitle: data.currentTitle.trim(),
          source: data.source?.trim() || 'Careers Website',
          stage: 'Applied',
          location: data.location.trim() || req.location,
          compensationExpectation: data.compensationExpectation.trim(),
          notes: data.notes.trim(),
        })
        .returning();

      await tx.insert(auditLogs).values({
        actorName: data.name.trim(),
        actorEmail: data.email.trim().toLowerCase(),
        actorRole: 'APPLICANT',
        action: 'CANDIDATE_STAGE_CHANGED',
        entityType: 'Candidate',
        entityId: created.id,
        summary: `External application received for ${req.roleTitle} (${req.reqCode}) via ${created.source}`,
        details: `Applicant: ${created.name} · Location: ${created.location}`,
      });

      return {
        id: created.id,
        reqCode: req.reqCode,
        roleTitle: req.roleTitle,
      };
    });
  } catch (error: any) {
    console.error('Error in submitPublicJobApplication:', error);
    throw new Error(error?.message || 'Failed to submit application.', { cause: error });
  }
}

export async function createRequisition(
  data: {
    departmentId: number;
    roleTitle: string;
    hiringManager: string;
    urgency: string;
    headcountNeeded: number;
    targetStartDate: string;
    compensationBand: string;
    location: string;
    employmentType?: string;
    jobSummary?: string;
    isPublishedToWebsite?: boolean;
    publishedSocials?: string;
  },
  actor: ActorInfo
) {
  try {
    return await db.transaction(async (tx) => {
      const dept = await tx
        .select()
        .from(departments)
        .where(eq(departments.id, data.departmentId))
        .limit(1);
      if (dept.length === 0) throw new Error('Department not found.');

      const maxIdRes = await tx
        .select({ maxId: sql<number>`COALESCE(MAX(${jobRequisitions.id}), 0)::int` })
        .from(jobRequisitions);
      const reqCode = `REQ-${201 + (maxIdRes[0]?.maxId ?? 0)}`;

      const isPublished = data.isPublishedToWebsite ?? true;
      const socials = data.publishedSocials !== undefined ? data.publishedSocials : 'LinkedIn,X';

      const [created] = await tx
        .insert(jobRequisitions)
        .values({
          reqCode,
          departmentId: data.departmentId,
          roleTitle: data.roleTitle.trim(),
          hiringManager: data.hiringManager.trim() || dept[0].leadName,
          urgency: data.urgency || 'High',
          headcountNeeded: Math.max(1, Math.floor(data.headcountNeeded)),
          filledHires: 0,
          targetStartDate: data.targetStartDate,
          compensationBand: data.compensationBand.trim() || 'L5 · ₦18.5M–₦24.0M',
          location: data.location.trim() || dept[0].location,
          employmentType: data.employmentType || 'Full-Time',
          jobSummary: (data.jobSummary || '').trim(),
          isPublishedToWebsite: isPublished,
          publishedSocials: socials,
          status: 'Open',
        })
        .returning();

      await tx.insert(auditLogs).values({
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'REQUISITION_CREATED',
        entityType: 'Requisition',
        entityId: created.id,
        summary: `Opened requisition ${created.reqCode}: ${created.roleTitle} (${created.headcountNeeded} FTE) in ${dept[0].name}`,
        details: `Website: ${isPublished ? 'Published' : 'Internal'} · Socials: ${socials || 'None'} · Target Start: ${created.targetStartDate}`,
      });

      return created;
    });
  } catch (error: any) {
    console.error('Error in createRequisition:', error);
    throw new Error(error?.message || 'Failed to create job requisition.', { cause: error });
  }
}

export async function updateRequisition(
  id: number,
  data: {
    status?: string;
    isPublishedToWebsite?: boolean;
    publishedSocials?: string;
    jobSummary?: string;
  },
  actor: ActorInfo
) {
  try {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(jobRequisitions)
        .where(eq(jobRequisitions.id, id))
        .limit(1);
      if (existing.length === 0) throw new Error('Requisition not found.');

      const [updated] = await tx
        .update(jobRequisitions)
        .set({
          status: data.status !== undefined ? data.status : existing[0].status,
          isPublishedToWebsite:
            data.isPublishedToWebsite !== undefined
              ? data.isPublishedToWebsite
              : existing[0].isPublishedToWebsite,
          publishedSocials:
            data.publishedSocials !== undefined
              ? data.publishedSocials
              : existing[0].publishedSocials,
          jobSummary:
            data.jobSummary !== undefined ? data.jobSummary.trim() : existing[0].jobSummary,
          updatedAt: new Date(),
        })
        .where(eq(jobRequisitions.id, id))
        .returning();

      await tx.insert(auditLogs).values({
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'REQUISITION_CREATED',
        entityType: 'Requisition',
        entityId: updated.id,
        summary: `Updated publishing & status for ${updated.reqCode} (${updated.roleTitle})`,
        details: `Status: ${updated.status} · Website: ${updated.isPublishedToWebsite ? 'Live' : 'Hidden'} · Socials: ${updated.publishedSocials || 'None'}`,
      });

      return updated;
    });
  } catch (error: any) {
    console.error('Error in updateRequisition:', error);
    throw new Error(error?.message || 'Failed to update requisition.', { cause: error });
  }
}

export async function createCandidate(
  data: {
    requisitionId: number;
    name: string;
    email: string;
    currentTitle: string;
    source: string;
    stage: string;
    location: string;
    compensationExpectation: string;
    notes: string;
  },
  actor: ActorInfo
) {
  try {
    return await db.transaction(async (tx) => {
      const req = await tx
        .select()
        .from(jobRequisitions)
        .where(eq(jobRequisitions.id, data.requisitionId))
        .limit(1);
      if (req.length === 0) throw new Error('Requisition not found.');

      const [created] = await tx
        .insert(candidates)
        .values({
          requisitionId: data.requisitionId,
          name: data.name.trim(),
          email: data.email.trim().toLowerCase(),
          currentTitle: data.currentTitle.trim(),
          source: data.source || 'Direct',
          stage: data.stage === 'Hired' ? 'Offer' : data.stage || 'Applied',
          location: data.location.trim() || req[0].location,
          compensationExpectation: data.compensationExpectation.trim() || req[0].compensationBand,
          notes: data.notes.trim(),
        })
        .returning();

      await tx.insert(auditLogs).values({
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'CANDIDATE_STAGE_CHANGED',
        entityType: 'Candidate',
        entityId: created.id,
        summary: `Added candidate ${created.name} to ${req[0].reqCode} (${req[0].roleTitle})`,
        details: `Initial Stage: ${created.stage} · Source: ${created.source}`,
      });

      return created;
    });
  } catch (error: any) {
    console.error('Error in createCandidate:', error);
    throw new Error(error?.message || 'Failed to add candidate.', { cause: error });
  }
}

export async function updateCandidateStage(
  candidateId: number,
  newStage: string,
  actor: ActorInfo
) {
  try {
    return await db.transaction(async (tx) => {
      const candRes = await tx
        .select()
        .from(candidates)
        .where(eq(candidates.id, candidateId))
        .limit(1);
      if (candRes.length === 0) throw new Error('Candidate not found.');
      const cand = candRes[0];

      if (cand.stage === 'Hired' && newStage !== 'Hired') {
        throw new Error('Hired candidates are already converted into employee records.');
      }

      const reqRes = await tx
        .select()
        .from(jobRequisitions)
        .where(eq(jobRequisitions.id, cand.requisitionId))
        .limit(1);
      if (reqRes.length === 0) throw new Error('Associated requisition not found.');
      const req = reqRes[0];

      const deptRes = await tx
        .select()
        .from(departments)
        .where(eq(departments.id, req.departmentId))
        .limit(1);
      const dept = deptRes[0];

      if (newStage === 'Hired' && cand.stage !== 'Hired') {
        const maxIdRes = await tx
          .select({ maxId: sql<number>`COALESCE(MAX(${employees.id}), 0)::int` })
          .from(employees);
        const nextNum = 1001 + (maxIdRes[0]?.maxId ?? 0);
        const employeeCode = `EMP-${nextNum}`;

        const baseHandle = cand.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '.')
          .replace(/(^\.|\.$)/g, '');
        let corpEmail = `${baseHandle || 'hire'}@meridianglobal.io`;
        const emailConflict = await tx
          .select({ id: employees.id })
          .from(employees)
          .where(eq(employees.email, corpEmail))
          .limit(1);
        if (emailConflict.length > 0) {
          corpEmail = `${baseHandle}.${nextNum}@meridianglobal.io`;
        }

        const startDate = req.targetStartDate || new Date().toISOString().slice(0, 10);

        const [newEmployee] = await tx
          .insert(employees)
          .values({
            employeeCode,
            name: cand.name,
            email: corpEmail,
            role: req.roleTitle,
            departmentId: req.departmentId,
            managerName: req.hiringManager,
            startDate,
            employmentType: req.employmentType || 'Full-Time',
            status: 'Onboarding',
            compensationBand: cand.compensationExpectation || req.compensationBand,
            location: cand.location || req.location,
          })
          .returning();

        await tx.insert(onboardingTasks).values([
          {
            employeeId: newEmployee.id,
            title: 'Laptop Dispatch & Corporate SSO Provisioning',
            category: 'IT & Access',
            completed: false,
            dueDate: addDays(startDate, 1),
          },
          {
            employeeId: newEmployee.id,
            title: 'PAYE Tax ID, PenCom RSA & HMO Enrollment',
            category: 'HR & Compliance',
            completed: false,
            dueDate: addDays(startDate, 3),
          },
          {
            employeeId: newEmployee.id,
            title: 'NDPR Data Privacy & Security Policy Sign-Off',
            category: 'HR & Compliance',
            completed: false,
            dueDate: addDays(startDate, 5),
          },
          {
            employeeId: newEmployee.id,
            title: `${dept?.name || 'Department'} Architecture & Playbook Walkthrough`,
            category: 'Orientation',
            completed: false,
            dueDate: addDays(startDate, 7),
          },
          {
            employeeId: newEmployee.id,
            title: `30-60-90 Day Goal Alignment with ${req.hiringManager}`,
            category: 'Manager Setup',
            completed: false,
            dueDate: addDays(startDate, 14),
          },
        ]);

        const [updatedCandidate] = await tx
          .update(candidates)
          .set({
            stage: 'Hired',
            hiredEmployeeId: newEmployee.id,
            updatedAt: new Date(),
          })
          .where(eq(candidates.id, candidateId))
          .returning();

        const newFilledHires = req.filledHires + 1;
        await tx
          .update(jobRequisitions)
          .set({
            filledHires: newFilledHires,
            status: newFilledHires >= req.headcountNeeded ? 'Filled' : req.status,
            updatedAt: new Date(),
          })
          .where(eq(jobRequisitions.id, req.id));

        await tx.insert(auditLogs).values({
          actorName: actor.name,
          actorEmail: actor.email,
          actorRole: actor.role,
          action: 'CANDIDATE_HIRED',
          entityType: 'Candidate',
          entityId: updatedCandidate.id,
          summary: `Hired ${cand.name} for ${req.roleTitle} (${dept?.name || 'Dept'}) -> Created ${newEmployee.employeeCode}`,
          details: `Auto-provisioned employee record (${corpEmail}), triggered 5 onboarding tasks, and updated ${dept?.code || ''} headcount.`,
        });

        return {
          candidate: updatedCandidate,
          hiredEmployee: newEmployee,
        };
      }

      const [updated] = await tx
        .update(candidates)
        .set({
          stage: newStage,
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, candidateId))
        .returning();

      await tx.insert(auditLogs).values({
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'CANDIDATE_STAGE_CHANGED',
        entityType: 'Candidate',
        entityId: updated.id,
        summary: `Moved ${cand.name} from ${cand.stage} to ${newStage} (${req.reqCode})`,
        details: `Role: ${req.roleTitle} · Department: ${dept?.name || ''}`,
      });

      return { candidate: updated, hiredEmployee: null };
    });
  } catch (error: any) {
    console.error('Error in updateCandidateStage:', error);
    throw new Error(error?.message || 'Failed to update candidate stage.', { cause: error });
  }
}

export async function getApprovalRequests() {
  try {
    const [requests, allDepts, allEmps] = await Promise.all([
      db.select().from(approvalRequests).orderBy(desc(approvalRequests.createdAt)),
      db.select().from(departments),
      db.select().from(employees),
    ]);

    const deptMap = new Map(allDepts.map((d) => [d.id, d]));
    const empMap = new Map(allEmps.map((e) => [e.id, e]));

    return requests.map((r) => ({
      ...r,
      departmentName: deptMap.get(r.departmentId)?.name || 'Unknown',
      departmentCode: deptMap.get(r.departmentId)?.code || '---',
      toDepartmentName: r.toDepartmentId ? deptMap.get(r.toDepartmentId)?.name || null : null,
      employeeName: r.employeeId ? empMap.get(r.employeeId)?.name || null : null,
      employeeCode: r.employeeId ? empMap.get(r.employeeId)?.employeeCode || null : null,
    }));
  } catch (error) {
    console.error('Error in getApprovalRequests:', error);
    throw new Error('Failed to load approval requests.', { cause: error });
  }
}

export async function createApprovalRequest(
  data: {
    requestType: 'STAFFING_INCREASE' | 'DEPARTMENT_TRANSFER' | 'NEW_REQUISITION';
    departmentId: number;
    employeeId?: number | null;
    toDepartmentId?: number | null;
    title: string;
    justification: string;
    requestedTargetHeadcount?: number | null;
    requestedBudget?: number | null;
    requestedRoleTitle?: string | null;
    requestedUrgency?: string | null;
  },
  dbUser: DbUser
) {
  try {
    return await db.transaction(async (tx) => {
      const dept = await tx
        .select()
        .from(departments)
        .where(eq(departments.id, data.departmentId))
        .limit(1);
      if (dept.length === 0) throw new Error('Department not found.');

      const [created] = await tx
        .insert(approvalRequests)
        .values({
          requestType: data.requestType,
          status: 'Pending',
          requesterUserId: dbUser.id,
          requesterName: dbUser.name,
          requesterEmail: dbUser.email,
          departmentId: data.departmentId,
          employeeId: data.employeeId ?? null,
          toDepartmentId: data.toDepartmentId ?? null,
          title: data.title.trim(),
          justification: data.justification.trim(),
          requestedTargetHeadcount: data.requestedTargetHeadcount ?? null,
          requestedBudget: data.requestedBudget ?? null,
          requestedRoleTitle: data.requestedRoleTitle?.trim() || null,
          requestedUrgency: data.requestedUrgency || null,
        })
        .returning();

      await tx.insert(auditLogs).values({
        actorName: dbUser.name,
        actorEmail: dbUser.email,
        actorRole: dbUser.role,
        action: 'REQUEST_SUBMITTED',
        entityType: 'Approval',
        entityId: created.id,
        summary: `Submitted ${data.requestType.replace('_', ' ')} request: ${created.title}`,
        details: `Department: ${dept[0].name} · Awaiting CEO approval`,
      });

      return created;
    });
  } catch (error: any) {
    console.error('Error in createApprovalRequest:', error);
    throw new Error(error?.message || 'Failed to submit approval request.', { cause: error });
  }
}

export async function reviewApprovalRequest(
  requestId: number,
  decision: 'Approved' | 'Rejected',
  reviewerNotes: string,
  actor: ActorInfo
) {
  try {
    return await db.transaction(async (tx) => {
      const reqRes = await tx
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, requestId))
        .limit(1);
      if (reqRes.length === 0) throw new Error('Approval request not found.');
      const approval = reqRes[0];

      if (approval.status !== 'Pending') {
        throw new Error(`Request has already been ${approval.status.toLowerCase()}.`);
      }

      const [updated] = await tx
        .update(approvalRequests)
        .set({
          status: decision,
          reviewerName: actor.name,
          reviewerNotes: reviewerNotes.trim(),
          reviewedAt: new Date(),
        })
        .where(eq(approvalRequests.id, requestId))
        .returning();

      if (decision === 'Approved') {
        if (approval.requestType === 'STAFFING_INCREASE') {
          const deptRes = await tx
            .select()
            .from(departments)
            .where(eq(departments.id, approval.departmentId))
            .limit(1);
          if (deptRes.length > 0) {
            await tx
              .update(departments)
              .set({
                targetHeadcount: approval.requestedTargetHeadcount ?? deptRes[0].targetHeadcount,
                allocatedBudget: approval.requestedBudget ?? deptRes[0].allocatedBudget,
                updatedAt: new Date(),
              })
              .where(eq(departments.id, approval.departmentId));
          }
        } else if (
          approval.requestType === 'DEPARTMENT_TRANSFER' &&
          approval.employeeId &&
          approval.toDepartmentId
        ) {
          const empRes = await tx
            .select()
            .from(employees)
            .where(eq(employees.id, approval.employeeId))
            .limit(1);
          const toDeptRes = await tx
            .select()
            .from(departments)
            .where(eq(departments.id, approval.toDepartmentId))
            .limit(1);

          if (empRes.length > 0 && toDeptRes.length > 0) {
            await tx
              .update(employees)
              .set({
                departmentId: approval.toDepartmentId,
                role: approval.requestedRoleTitle || empRes[0].role,
                managerName: toDeptRes[0].leadName,
                updatedAt: new Date(),
              })
              .where(eq(employees.id, approval.employeeId));
          }
        } else if (approval.requestType === 'NEW_REQUISITION') {
          const deptRes = await tx
            .select()
            .from(departments)
            .where(eq(departments.id, approval.departmentId))
            .limit(1);
          const maxIdRes = await tx
            .select({ maxId: sql<number>`COALESCE(MAX(${jobRequisitions.id}), 0)::int` })
            .from(jobRequisitions);
          const reqCode = `REQ-${201 + (maxIdRes[0]?.maxId ?? 0)}`;
          const targetStartDate = addDays(new Date().toISOString().slice(0, 10), 30);

          await tx.insert(jobRequisitions).values({
            reqCode,
            departmentId: approval.departmentId,
            roleTitle: approval.requestedRoleTitle || approval.title,
            hiringManager: deptRes[0]?.leadName || approval.requesterName,
            urgency: approval.requestedUrgency || 'High',
            headcountNeeded: 1,
            filledHires: 0,
            targetStartDate,
            compensationBand: 'L5 · ₦18.5M–₦24.0M',
            location: deptRes[0]?.location || 'Victoria Island, Lagos',
            employmentType: 'Full-Time',
            jobSummary: approval.justification,
            isPublishedToWebsite: true,
            publishedSocials: 'LinkedIn,X',
            status: 'Open',
          });
        }
      }

      await tx.insert(auditLogs).values({
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: decision === 'Approved' ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED',
        entityType: 'Approval',
        entityId: updated.id,
        summary: `${decision} request "${updated.title}" submitted by ${updated.requesterName}`,
        details: reviewerNotes.trim() || `Decision executed by ${actor.name}`,
      });

      return updated;
    });
  } catch (error: any) {
    console.error('Error in reviewApprovalRequest:', error);
    throw new Error(error?.message || 'Failed to process approval decision.', { cause: error });
  }
}

export async function getAuditLogs(actionFilter?: string, limitCount = 100) {
  try {
    if (actionFilter && actionFilter !== 'ALL') {
      return await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, actionFilter))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limitCount);
    }
    return await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limitCount);
  } catch (error) {
    console.error('Error in getAuditLogs:', error);
    throw new Error('Failed to fetch audit log.', { cause: error });
  }
}

export async function updateUserAccessRole(
  targetUserId: number,
  role: 'CEO' | 'DEPARTMENT_HEAD',
  departmentId: number | null,
  actor: ActorInfo
) {
  try {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);
      if (existing.length === 0) throw new Error('User not found.');

      const [updated] = await tx
        .update(users)
        .set({
          role,
          departmentId: role === 'CEO' ? null : departmentId,
          updatedAt: new Date(),
        })
        .where(eq(users.id, targetUserId))
        .returning();

      await tx.insert(auditLogs).values({
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'ROLE_UPDATED',
        entityType: 'User',
        entityId: updated.id,
        summary: `Updated RBAC role for ${updated.name} (${updated.email}) to ${role}`,
        details:
          role === 'DEPARTMENT_HEAD' && departmentId
            ? `Assigned Department ID: ${departmentId}`
            : 'Organization-wide Super Admin access',
      });

      return updated;
    });
  } catch (error: any) {
    console.error('Error in updateUserAccessRole:', error);
    throw new Error(error?.message || 'Failed to update user access role.', { cause: error });
  }
}
