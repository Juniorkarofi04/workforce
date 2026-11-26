import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { eq } from 'drizzle-orm';
import { AuthRequest, requireAuth, requireCeo } from './src/middleware/auth.ts';
import { db } from './src/db/index.ts';
import { ensureSeeded } from './src/db/seed.ts';
import { candidates, employees, jobRequisitions, onboardingTasks } from './src/db/schema.ts';
import { listUsersWithDepartments } from './src/db/users.ts';
import {
  addOnboardingTask,
  createApprovalRequest,
  createCandidate,
  createDepartment,
  createEmployee,
  createRequisition,
  deleteEmployee,
  exportEmployeesPayrollCsv,
  getApprovalRequests,
  getAuditLogs,
  getDashboardSnapshot,
  getDepartmentsWithStaffing,
  getEmployeesWithDetails,
  getPublicCareersListings,
  getRequisitionsWithCandidates,
  globalSearch,
  reviewApprovalRequest,
  submitPublicJobApplication,
  toggleOnboardingTask,
  transferEmployee,
  updateCandidateStage,
  updateDepartment,
  updateEmployee,
  updateRequisition,
  updateUserAccessRole,
} from './src/db/workforce.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT =
  process.env.NODE_ENV === 'production' ? Number(process.env.PORT) || 3000 : 3000;

app.use(express.json({ limit: '1mb' }));

function getActor(req: AuthRequest) {
  return {
    name: req.dbUser!.name,
    email: req.dbUser!.email,
    role: req.dbUser!.role,
  };
}

function canAccessDepartment(req: AuthRequest, departmentId: number): boolean {
  if (!req.dbUser) return false;
  if (req.dbUser.role === 'CEO') return true;
  return req.dbUser.role === 'DEPARTMENT_HEAD' && req.dbUser.departmentId === departmentId;
}

// Public Careers Website Routes (Job seekers can view and apply without signing in)
app.get('/api/public/careers', async (_req, res) => {
  try {
    await ensureSeeded();
    const listings = await getPublicCareersListings();
    res.json({
      company: {
        name: 'Meridian Global',
        tagline: 'Building resilient financial & enterprise infrastructure across Africa and global markets.',
        headquarters: 'Abuja & Lagos · Global Remote',
      },
      listings,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load job listings' });
  }
});

app.post('/api/public/careers/:reqCode/apply', async (req, res) => {
  try {
    await ensureSeeded();
    const reqCode = String(req.params.reqCode || '');
    const { name, email, currentTitle, location, compensationExpectation, notes, source } =
      req.body || {};

    if (!name || !email || !String(email).includes('@')) {
      return res.status(400).json({ error: 'Valid full name and email address are required.' });
    }

    const result = await submitPublicJobApplication(reqCode, {
      name: String(name),
      email: String(email),
      currentTitle: String(currentTitle || ''),
      location: String(location || ''),
      compensationExpectation: String(compensationExpectation || ''),
      notes: String(notes || ''),
      source: source ? String(source) : 'Careers Website',
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to submit application' });
  }
});

// Current user & RBAC profile
app.get('/api/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const depts = await getDepartmentsWithStaffing();
    const assignedDept = req.dbUser?.departmentId
      ? depts.find((d) => d.id === req.dbUser!.departmentId) || null
      : null;

    res.json({
      user: req.dbUser,
      assignedDepartment: assignedDept,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load user profile' });
  }
});

// Executive Dashboard
app.get('/api/dashboard', requireAuth, async (_req: AuthRequest, res) => {
  try {
    const snapshot = await getDashboardSnapshot();
    res.json(snapshot);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load dashboard' });
  }
});

// Global Instant Search
app.get('/api/search', requireAuth, async (req: AuthRequest, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const results = await globalSearch(q);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Search failed' });
  }
});

// Departments & Gap Tracker
app.get('/api/departments', requireAuth, async (_req: AuthRequest, res) => {
  try {
    const depts = await getDepartmentsWithStaffing();
    res.json(depts);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch departments' });
  }
});

app.post('/api/departments', requireAuth, requireCeo, async (req: AuthRequest, res) => {
  try {
    const { name, code, leadName, description, targetHeadcount, allocatedBudget, priority, location } =
      req.body || {};
    if (!name || !code || !leadName) {
      return res.status(400).json({ error: 'Department name, code, and lead name are required.' });
    }
    const created = await createDepartment(
      {
        name: String(name),
        code: String(code),
        leadName: String(leadName),
        description: String(description || ''),
        targetHeadcount: Number(targetHeadcount ?? 0),
        allocatedBudget: Number(allocatedBudget ?? 0),
        priority: String(priority || 'Normal'),
        location: String(location || 'Victoria Island, Lagos'),
      },
      getActor(req)
    );
    res.status(201).json(created);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create department' });
  }
});

app.patch('/api/departments/:id', requireAuth, requireCeo, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid department ID.' });
    }
    const updated = await updateDepartment(id, req.body || {}, getActor(req));
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update department' });
  }
});

// Employees & Payroll CSV Export
app.get('/api/employees/export', requireAuth, requireCeo, async (req: AuthRequest, res) => {
  try {
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const employmentType =
      typeof req.query.employmentType === 'string' ? req.query.employmentType : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;

    const csv = await exportEmployeesPayrollCsv(
      {
        departmentId: departmentId && Number.isInteger(departmentId) ? departmentId : undefined,
        status,
        employmentType,
        q,
      },
      getActor(req)
    );

    const dateStamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="meridian-global-payroll-reconciliation-${dateStamp}.csv"`
    );
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to export payroll CSV' });
  }
});

app.get('/api/employees', requireAuth, async (_req: AuthRequest, res) => {
  try {
    const list = await getEmployeesWithDetails();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch employees' });
  }
});

app.post('/api/employees', requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      name,
      email,
      role,
      departmentId,
      managerName,
      startDate,
      employmentType,
      status,
      compensationBand,
      location,
    } = req.body || {};

    const deptIdNum = Number(departmentId);
    if (!name || !email || !role || !Number.isInteger(deptIdNum) || deptIdNum <= 0) {
      return res.status(400).json({ error: 'Name, email, role, and valid department are required.' });
    }

    if (!canAccessDepartment(req, deptIdNum)) {
      return res.status(403).json({
        error: 'Department Heads can only add employees directly to their assigned department.',
      });
    }

    const created = await createEmployee(
      {
        name: String(name),
        email: String(email),
        role: String(role),
        departmentId: deptIdNum,
        managerName: String(managerName || ''),
        startDate: String(startDate || new Date().toISOString().slice(0, 10)),
        employmentType: String(employmentType || 'Full-Time'),
        status: String(status || 'Active'),
        compensationBand: String(compensationBand || 'L4 · ₦12.0M–₦16.5M'),
        location: String(location || 'Victoria Island, Lagos'),
      },
      getActor(req)
    );
    res.status(201).json(created);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to add employee' });
  }
});

app.patch('/api/employees/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid employee ID.' });
    }

    const existing = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    if (!canAccessDepartment(req, existing[0].departmentId)) {
      return res.status(403).json({
        error: 'You can only update employees within your assigned department.',
      });
    }

    const updated = await updateEmployee(id, req.body || {}, getActor(req));
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update employee' });
  }
});

app.post('/api/employees/:id/transfer', requireAuth, requireCeo, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const toDepartmentId = Number(req.body?.toDepartmentId);
    if (!Number.isInteger(id) || !Number.isInteger(toDepartmentId) || toDepartmentId <= 0) {
      return res.status(400).json({ error: 'Valid employee and target department are required.' });
    }

    const updated = await transferEmployee(
      id,
      toDepartmentId,
      req.body?.newRole,
      req.body?.newManager,
      getActor(req)
    );
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Transfer failed' });
  }
});

app.delete('/api/employees/:id', requireAuth, requireCeo, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid employee ID.' });
    }
    const result = await deleteEmployee(id, getActor(req));
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete employee' });
  }
});

// Onboarding Checklists
app.patch('/api/onboarding/:taskId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const taskId = Number(req.params.taskId);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({ error: 'Invalid task ID.' });
    }

    const taskRes = await db
      .select()
      .from(onboardingTasks)
      .where(eq(onboardingTasks.id, taskId))
      .limit(1);
    if (taskRes.length === 0) return res.status(404).json({ error: 'Task not found.' });

    const empRes = await db
      .select()
      .from(employees)
      .where(eq(employees.id, taskRes[0].employeeId))
      .limit(1);
    if (empRes.length > 0 && !canAccessDepartment(req, empRes[0].departmentId)) {
      return res.status(403).json({
        error: 'You can only manage onboarding tasks for your assigned department.',
      });
    }

    const updated = await toggleOnboardingTask(
      taskId,
      Boolean(req.body?.completed),
      getActor(req)
    );
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update onboarding task' });
  }
});

app.post('/api/employees/:id/onboarding', requireAuth, async (req: AuthRequest, res) => {
  try {
    const employeeId = Number(req.params.id);
    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return res.status(400).json({ error: 'Invalid employee ID.' });
    }

    const empRes = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
    if (empRes.length === 0) return res.status(404).json({ error: 'Employee not found.' });
    if (!canAccessDepartment(req, empRes[0].departmentId)) {
      return res.status(403).json({
        error: 'You can only assign onboarding tasks within your assigned department.',
      });
    }

    if (!req.body?.title) {
      return res.status(400).json({ error: 'Task title is required.' });
    }

    const created = await addOnboardingTask(
      employeeId,
      {
        title: String(req.body.title),
        category: String(req.body.category || 'Orientation'),
        dueDate: String(req.body.dueDate || new Date().toISOString().slice(0, 10)),
      },
      getActor(req)
    );
    res.status(201).json(created);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to add onboarding task' });
  }
});

// Recruitment & Candidate Pipeline
app.get('/api/recruitment', requireAuth, async (_req: AuthRequest, res) => {
  try {
    const data = await getRequisitionsWithCandidates();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load recruitment data' });
  }
});

app.post('/api/requisitions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const deptId = Number(req.body?.departmentId);
    if (!Number.isInteger(deptId) || deptId <= 0 || !req.body?.roleTitle) {
      return res.status(400).json({ error: 'Department and role title are required.' });
    }

    if (!canAccessDepartment(req, deptId)) {
      return res.status(403).json({
        error: 'Department Heads can only open requisitions for their assigned department.',
      });
    }

    const created = await createRequisition(
      {
        departmentId: deptId,
        roleTitle: String(req.body.roleTitle),
        hiringManager: String(req.body.hiringManager || ''),
        urgency: String(req.body.urgency || 'High'),
        headcountNeeded: Number(req.body.headcountNeeded ?? 1),
        targetStartDate: String(req.body.targetStartDate || new Date().toISOString().slice(0, 10)),
        compensationBand: String(req.body.compensationBand || 'L5 · ₦18.5M–₦24.0M'),
        location: String(req.body.location || 'Victoria Island, Lagos'),
        employmentType: String(req.body.employmentType || 'Full-Time'),
        jobSummary: String(req.body.jobSummary || ''),
        isPublishedToWebsite: req.body.isPublishedToWebsite ?? true,
        publishedSocials:
          typeof req.body.publishedSocials === 'string'
            ? req.body.publishedSocials
            : 'LinkedIn,X',
      },
      getActor(req)
    );
    res.status(201).json(created);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create requisition' });
  }
});

app.patch('/api/requisitions/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid requisition ID.' });
    }
    const reqRes = await db
      .select()
      .from(jobRequisitions)
      .where(eq(jobRequisitions.id, id))
      .limit(1);
    if (reqRes.length === 0) return res.status(404).json({ error: 'Requisition not found.' });

    if (!canAccessDepartment(req, reqRes[0].departmentId)) {
      return res.status(403).json({ error: 'Unauthorized to modify this requisition.' });
    }

    const updated = await updateRequisition(
      id,
      {
        status: req.body?.status,
        isPublishedToWebsite: req.body?.isPublishedToWebsite,
        publishedSocials: req.body?.publishedSocials,
        jobSummary: req.body?.jobSummary,
      },
      getActor(req)
    );
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update requisition' });
  }
});

app.post('/api/candidates', requireAuth, async (req: AuthRequest, res) => {
  try {
    const requisitionId = Number(req.body?.requisitionId);
    if (!Number.isInteger(requisitionId) || !req.body?.name || !req.body?.email) {
      return res.status(400).json({ error: 'Requisition, candidate name, and email are required.' });
    }

    const reqRes = await db
      .select()
      .from(jobRequisitions)
      .where(eq(jobRequisitions.id, requisitionId))
      .limit(1);
    if (reqRes.length === 0) return res.status(404).json({ error: 'Requisition not found.' });
    if (!canAccessDepartment(req, reqRes[0].departmentId)) {
      return res.status(403).json({ error: 'Unauthorized to add candidates to this requisition.' });
    }

    const created = await createCandidate(
      {
        requisitionId,
        name: String(req.body.name),
        email: String(req.body.email),
        currentTitle: String(req.body.currentTitle || ''),
        source: String(req.body.source || 'Direct'),
        stage: String(req.body.stage || 'Applied'),
        location: String(req.body.location || ''),
        compensationExpectation: String(req.body.compensationExpectation || ''),
        notes: String(req.body.notes || ''),
      },
      getActor(req)
    );
    res.status(201).json(created);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to add candidate' });
  }
});

app.patch('/api/candidates/:id/stage', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const stage = String(req.body?.stage || '');
    const allowedStages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];
    if (!Number.isInteger(id) || !allowedStages.includes(stage)) {
      return res.status(400).json({ error: 'Valid candidate ID and pipeline stage required.' });
    }

    const candRes = await db.select().from(candidates).where(eq(candidates.id, id)).limit(1);
    if (candRes.length === 0) return res.status(404).json({ error: 'Candidate not found.' });

    const reqRes = await db
      .select()
      .from(jobRequisitions)
      .where(eq(jobRequisitions.id, candRes[0].requisitionId))
      .limit(1);
    if (reqRes.length > 0 && !canAccessDepartment(req, reqRes[0].departmentId)) {
      return res.status(403).json({
        error: 'You can only advance candidates within your assigned department.',
      });
    }

    const result = await updateCandidateStage(id, stage, getActor(req));
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to advance candidate stage' });
  }
});

// Approvals & Audit Trail
app.get('/api/approvals', requireAuth, async (_req: AuthRequest, res) => {
  try {
    const items = await getApprovalRequests();
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch approvals' });
  }
});

app.post('/api/approvals', requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      requestType,
      departmentId,
      employeeId,
      toDepartmentId,
      title,
      justification,
      requestedTargetHeadcount,
      requestedBudget,
      requestedRoleTitle,
      requestedUrgency,
    } = req.body || {};

    const deptIdNum = Number(departmentId);
    if (!requestType || !Number.isInteger(deptIdNum) || !title || !justification) {
      return res.status(400).json({ error: 'Request type, department, title, and justification are required.' });
    }

    if (
      req.dbUser!.role === 'DEPARTMENT_HEAD' &&
      requestType !== 'DEPARTMENT_TRANSFER' &&
      !canAccessDepartment(req, deptIdNum)
    ) {
      return res.status(403).json({
        error: 'Department Heads can only submit staffing requests for their own department.',
      });
    }

    const created = await createApprovalRequest(
      {
        requestType,
        departmentId: deptIdNum,
        employeeId: employeeId ? Number(employeeId) : null,
        toDepartmentId: toDepartmentId ? Number(toDepartmentId) : null,
        title: String(title),
        justification: String(justification),
        requestedTargetHeadcount:
          requestedTargetHeadcount !== undefined && requestedTargetHeadcount !== null
            ? Number(requestedTargetHeadcount)
            : null,
        requestedBudget:
          requestedBudget !== undefined && requestedBudget !== null ? Number(requestedBudget) : null,
        requestedRoleTitle: requestedRoleTitle ? String(requestedRoleTitle) : null,
        requestedUrgency: requestedUrgency ? String(requestedUrgency) : null,
      },
      req.dbUser!
    );
    res.status(201).json(created);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to submit request' });
  }
});

app.post('/api/approvals/:id/review', requireAuth, requireCeo, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const decision = req.body?.decision;
    if (!Number.isInteger(id) || (decision !== 'Approved' && decision !== 'Rejected')) {
      return res.status(400).json({ error: 'Valid request ID and decision (Approved/Rejected) required.' });
    }

    const updated = await reviewApprovalRequest(
      id,
      decision,
      String(req.body?.reviewerNotes || ''),
      getActor(req)
    );
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to process approval' });
  }
});

app.get('/api/audit', requireAuth, async (req: AuthRequest, res) => {
  try {
    const actionFilter = typeof req.query.action === 'string' ? req.query.action : undefined;
    const logs = await getAuditLogs(actionFilter);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch audit log' });
  }
});

// RBAC User Role Management (CEO Only)
app.get('/api/users', requireAuth, requireCeo, async (_req: AuthRequest, res) => {
  try {
    const list = await listUsersWithDepartments();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch users' });
  }
});

app.patch('/api/users/:id/role', requireAuth, requireCeo, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const role = req.body?.role;
    const departmentId =
      req.body?.departmentId !== undefined && req.body?.departmentId !== null
        ? Number(req.body.departmentId)
        : null;

    if (!Number.isInteger(id) || (role !== 'CEO' && role !== 'DEPARTMENT_HEAD')) {
      return res.status(400).json({ error: 'Valid user ID and role (CEO or DEPARTMENT_HEAD) required.' });
    }

    const updated = await updateUserAccessRole(id, role, departmentId, getActor(req));
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update user role' });
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
