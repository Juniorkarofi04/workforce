import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  code: text('code').notNull().unique(),
  leadName: text('lead_name').notNull(),
  description: text('description').notNull().default(''),
  targetHeadcount: integer('target_headcount').notNull().default(0),
  allocatedBudget: integer('allocated_budget').notNull().default(0),
  priority: text('priority').notNull().default('Normal'), // 'Critical' | 'High' | 'Normal'
  location: text('location').notNull().default('Global'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  role: text('role').notNull().default('DEPARTMENT_HEAD'), // 'CEO' | 'DEPARTMENT_HEAD'
  departmentId: integer('department_id').references(() => departments.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  employeeCode: text('employee_code').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: text('role').notNull(),
  departmentId: integer('department_id')
    .references(() => departments.id, { onDelete: 'restrict' })
    .notNull(),
  managerName: text('manager_name').notNull().default('Executive Leadership'),
  startDate: text('start_date').notNull(),
  employmentType: text('employment_type').notNull().default('Full-Time'), // 'Full-Time' | 'Part-Time' | 'Contract'
  status: text('status').notNull().default('Active'), // 'Active' | 'On Leave' | 'Onboarding'
  compensationBand: text('compensation_band').notNull(),
  location: text('location').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const onboardingTasks = pgTable('onboarding_tasks', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id')
    .references(() => employees.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  category: text('category').notNull().default('General'),
  completed: boolean('completed').notNull().default(false),
  dueDate: text('due_date').notNull(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const jobRequisitions = pgTable('job_requisitions', {
  id: serial('id').primaryKey(),
  reqCode: text('req_code').notNull().unique(),
  departmentId: integer('department_id')
    .references(() => departments.id, { onDelete: 'cascade' })
    .notNull(),
  roleTitle: text('role_title').notNull(),
  hiringManager: text('hiring_manager').notNull(),
  urgency: text('urgency').notNull().default('High'), // 'Critical' | 'High' | 'Normal'
  headcountNeeded: integer('headcount_needed').notNull().default(1),
  filledHires: integer('filled_hires').notNull().default(0),
  targetStartDate: text('target_start_date').notNull(),
  compensationBand: text('compensation_band').notNull().default('L4 · ₦11.5M–₦15.0M'),
  location: text('location').notNull().default('Victoria Island, Lagos'),
  employmentType: text('employment_type').notNull().default('Full-Time'),
  jobSummary: text('job_summary').notNull().default(''),
  isPublishedToWebsite: boolean('is_published_to_website').notNull().default(true),
  publishedSocials: text('published_socials').notNull().default('LinkedIn,X'),
  status: text('status').notNull().default('Open'), // 'Open' | 'Filled' | 'Paused'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const candidates = pgTable('candidates', {
  id: serial('id').primaryKey(),
  requisitionId: integer('requisition_id')
    .references(() => jobRequisitions.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  currentTitle: text('current_title').notNull().default(''),
  source: text('source').notNull().default('Direct'),
  stage: text('stage').notNull().default('Applied'), // 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Hired' | 'Rejected'
  location: text('location').notNull().default('London, UK'),
  compensationExpectation: text('compensation_expectation').notNull().default(''),
  notes: text('notes').notNull().default(''),
  hiredEmployeeId: integer('hired_employee_id').references(() => employees.id, { onDelete: 'set null' }),
  appliedAt: timestamp('applied_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const approvalRequests = pgTable('approval_requests', {
  id: serial('id').primaryKey(),
  requestType: text('request_type').notNull(), // 'STAFFING_INCREASE' | 'DEPARTMENT_TRANSFER' | 'NEW_REQUISITION'
  status: text('status').notNull().default('Pending'), // 'Pending' | 'Approved' | 'Rejected'
  requesterUserId: integer('requester_user_id').references(() => users.id, { onDelete: 'set null' }),
  requesterName: text('requester_name').notNull(),
  requesterEmail: text('requester_email').notNull(),
  departmentId: integer('department_id')
    .references(() => departments.id, { onDelete: 'cascade' })
    .notNull(),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'set null' }),
  toDepartmentId: integer('to_department_id').references(() => departments.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  justification: text('justification').notNull(),
  requestedTargetHeadcount: integer('requested_target_headcount'),
  requestedBudget: integer('requested_budget'),
  requestedRoleTitle: text('requested_role_title'),
  requestedUrgency: text('requested_urgency'),
  reviewerName: text('reviewer_name'),
  reviewerNotes: text('reviewer_notes'),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorName: text('actor_name').notNull(),
  actorEmail: text('actor_email').notNull(),
  actorRole: text('actor_role').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: integer('entity_id'),
  summary: text('summary').notNull(),
  details: text('details').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const departmentsRelations = relations(departments, ({ many }) => ({
  employees: many(employees),
  requisitions: many(jobRequisitions),
  users: many(users),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  department: one(departments, {
    fields: [employees.departmentId],
    references: [departments.id],
  }),
  onboardingTasks: many(onboardingTasks),
}));

export const onboardingTasksRelations = relations(onboardingTasks, ({ one }) => ({
  employee: one(employees, {
    fields: [onboardingTasks.employeeId],
    references: [employees.id],
  }),
}));

export const jobRequisitionsRelations = relations(jobRequisitions, ({ one, many }) => ({
  department: one(departments, {
    fields: [jobRequisitions.departmentId],
    references: [departments.id],
  }),
  candidates: many(candidates),
}));

export const candidatesRelations = relations(candidates, ({ one }) => ({
  requisition: one(jobRequisitions, {
    fields: [candidates.requisitionId],
    references: [jobRequisitions.id],
  }),
}));
