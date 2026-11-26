import { eq, sql } from 'drizzle-orm';
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

let seedPromise: Promise<void> | null = null;
let isSeeded = false;

export async function ensureSeeded(): Promise<void> {
  if (isSeeded) return;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      const existing = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(departments);

      const legacyCheck = await db
        .select({ id: employees.id })
        .from(employees)
        .where(
          sql`${employees.email} IN ('elena.vance@cadence.io', 'chukwudi.okafor@ekopulse.ng')`
        )
        .limit(1);

      const needsInitialSeed = (existing[0]?.count ?? 0) === 0;
      const needsRefreshSeed = legacyCheck.length > 0;

      if (!needsInitialSeed && !needsRefreshSeed) {
        isSeeded = true;
        return;
      }

      await db.transaction(async (tx) => {
        if (needsRefreshSeed) {
          await tx.delete(auditLogs);
          await tx.delete(approvalRequests);
          await tx.delete(candidates);
          await tx.delete(jobRequisitions);
          await tx.delete(onboardingTasks);
          await tx.delete(employees);
          await tx.delete(departments);
        } else {
          const recheck = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(departments);
          if ((recheck[0]?.count ?? 0) > 0) return;
        }

        const insertedDepts = await tx
          .insert(departments)
          .values([
            {
              name: 'Core Engineering',
              code: 'ENG',
              leadName: 'Ibrahim Danjuma',
              description:
                'Global payment rails, distributed ledger architecture, and core platform delivery.',
              targetHeadcount: 18,
              allocatedBudget: 485000000,
              priority: 'Critical',
              location: 'Maitama, Abuja / Global Remote',
            },
            {
              name: 'Product Management',
              code: 'PRD',
              leadName: 'Amina Bello',
              description:
                'Enterprise product strategy, regulatory roadmap, and cross-border merchant discovery.',
              targetHeadcount: 6,
              allocatedBudget: 168000000,
              priority: 'High',
              location: 'Wuse II, Abuja',
            },
            {
              name: 'Design & Research',
              code: 'DES',
              leadName: 'Sadiq Abubakar',
              description:
                'Global design systems, field user research, and accessible product architecture.',
              targetHeadcount: 5,
              allocatedBudget: 124000000,
              priority: 'Normal',
              location: 'Barnawa, Kaduna',
            },
            {
              name: 'Enterprise Sales',
              code: 'SLS',
              leadName: 'Zainab Usman',
              description:
                'Commercial banking partnerships, global enterprise accounts, and regional expansion.',
              targetHeadcount: 10,
              allocatedBudget: 275000000,
              priority: 'Critical',
              location: 'Abuja / Victoria Island, Lagos',
            },
            {
              name: 'Security & Infrastructure',
              code: 'SEC',
              leadName: 'Aliyu Mohammed',
              description:
                'Cloud reliability, PCI-DSS compliance, zero-trust security, and DevSecOps.',
              targetHeadcount: 6,
              allocatedBudget: 192000000,
              priority: 'High',
              location: 'Asokoro, Abuja',
            },
            {
              name: 'People & Operations',
              code: 'OPS',
              leadName: 'Halima Suleiman',
              description:
                'Global talent acquisition, PAYE & pension payroll operations, and workplace enablement.',
              targetHeadcount: 5,
              allocatedBudget: 105000000,
              priority: 'Normal',
              location: 'Nassarawa, Kano',
            },
          ])
          .returning();

        const deptByCode = new Map(insertedDepts.map((d) => [d.code, d]));
        const engId = deptByCode.get('ENG')!.id;
        const prdId = deptByCode.get('PRD')!.id;
        const desId = deptByCode.get('DES')!.id;
        const slsId = deptByCode.get('SLS')!.id;
        const secId = deptByCode.get('SEC')!.id;
        const opsId = deptByCode.get('OPS')!.id;

        await tx
          .update(users)
          .set({ departmentId: engId })
          .where(sql`${users.role} = 'DEPARTMENT_HEAD' AND ${users.departmentId} IS NULL`);

        const seedEmployees = await tx
          .insert(employees)
          .values([
            // Core Engineering (13 filled vs 18 target -> gap 5)
            { employeeCode: 'EMP-1001', name: 'Ibrahim Danjuma', email: 'ibrahim.danjuma@meridianglobal.io', role: 'VP of Engineering', departmentId: engId, managerName: 'Executive Leadership', startDate: '2022-03-14', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L8 · ₦48.0M–₦60.0M', location: 'Maitama, Abuja' },
            { employeeCode: 'EMP-1002', name: 'Abdullahi Sani', email: 'abdullahi.sani@meridianglobal.io', role: 'Principal Systems Architect', departmentId: engId, managerName: 'Ibrahim Danjuma', startDate: '2022-06-01', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L7 · ₦36.0M–₦45.0M', location: 'Nassarawa, Kano' },
            { employeeCode: 'EMP-1003', name: 'Fatima Garba', email: 'fatima.garba@meridianglobal.io', role: 'Staff Backend Engineer', departmentId: engId, managerName: 'Ibrahim Danjuma', startDate: '2023-01-16', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L6 · ₦26.0M–₦34.0M', location: 'Remote - Abuja' },
            { employeeCode: 'EMP-1004', name: 'Musa Abdulkadir', email: 'musa.abdulkadir@meridianglobal.io', role: 'Senior Frontend Engineer', departmentId: engId, managerName: 'Abdullahi Sani', startDate: '2023-04-10', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L5 · ₦18.5M–₦24.0M', location: 'Zaria, Kaduna' },
            { employeeCode: 'EMP-1005', name: 'Hauwa Ibrahim', email: 'hauwa.ibrahim@meridianglobal.io', role: 'Senior Data Engineer', departmentId: engId, managerName: 'Fatima Garba', startDate: '2023-08-21', employmentType: 'Full-Time', status: 'On Leave', compensationBand: 'L5 · ₦18.5M–₦24.0M', location: 'Wuse II, Abuja' },
            { employeeCode: 'EMP-1006', name: 'Kabiru Bala', email: 'kabiru.bala@meridianglobal.io', role: 'Platform Engineer', departmentId: engId, managerName: 'Abdullahi Sani', startDate: '2024-02-05', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L4 · ₦12.0M–₦16.5M', location: 'Sokoto, SK' },
            { employeeCode: 'EMP-1007', name: 'Bilkisu Shehu', email: 'bilkisu.shehu@meridianglobal.io', role: 'Distributed Systems Engineer', departmentId: engId, managerName: 'Fatima Garba', startDate: '2024-05-13', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L5 · ₦18.5M–₦24.0M', location: 'Kano, KN' },
            { employeeCode: 'EMP-1008', name: 'Nuhu Tanko', email: 'nuhu.tanko@meridianglobal.io', role: 'Senior Full-Stack Engineer', departmentId: engId, managerName: 'Abdullahi Sani', startDate: '2024-09-02', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L5 · ₦18.5M–₦24.0M', location: 'Jos, Plateau' },
            { employeeCode: 'EMP-1009', name: 'Rukayya Aliyu', email: 'rukayya.aliyu@meridianglobal.io', role: 'Backend Engineer II', departmentId: engId, managerName: 'Fatima Garba', startDate: '2025-01-20', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L4 · ₦12.0M–₦16.5M', location: 'Katsina, KT' },
            { employeeCode: 'EMP-1010', name: 'Mustapha Babangida', email: 'mustapha.babangida@meridianglobal.io', role: 'Frontend Performance Specialist', departmentId: engId, managerName: 'Abdullahi Sani', startDate: '2025-06-09', employmentType: 'Contract', status: 'Active', compensationBand: 'C2 · ₦15.0M–₦19.5M', location: 'Remote - Global' },
            { employeeCode: 'EMP-1011', name: 'Safiya Yakubu', email: 'safiya.yakubu@meridianglobal.io', role: 'ML Infrastructure Engineer', departmentId: engId, managerName: 'Ibrahim Danjuma', startDate: '2026-10-12', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L5 · ₦19.0M–₦25.0M', location: 'Abuja, FCT' },
            { employeeCode: 'EMP-1012', name: 'Salisu Idris', email: 'salisu.idris@meridianglobal.io', role: 'API Platform Engineer', departmentId: engId, managerName: 'Fatima Garba', startDate: '2026-11-16', employmentType: 'Full-Time', status: 'Onboarding', compensationBand: 'L4 · ₦12.0M–₦16.5M', location: 'Kaduna, KD' },
            { employeeCode: 'EMP-1013', name: 'Khadija Yusuf', email: 'khadija.yusuf@meridianglobal.io', role: 'QA Automation Lead', departmentId: engId, managerName: 'Ibrahim Danjuma', startDate: '2026-11-23', employmentType: 'Full-Time', status: 'Onboarding', compensationBand: 'L5 · ₦17.0M–₦22.0M', location: 'Abuja, FCT' },

            // Product Management (4 filled vs 6 target -> gap 2)
            { employeeCode: 'EMP-1014', name: 'Amina Bello', email: 'amina.bello@meridianglobal.io', role: 'VP of Product', departmentId: prdId, managerName: 'Executive Leadership', startDate: '2022-04-04', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L8 · ₦44.0M–₦55.0M', location: 'Wuse II, Abuja' },
            { employeeCode: 'EMP-1015', name: 'Jibril Hassan', email: 'jibril.hassan@meridianglobal.io', role: 'Group Product Manager', departmentId: prdId, managerName: 'Amina Bello', startDate: '2023-03-15', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L6 · ₦25.0M–₦32.0M', location: 'Victoria Island, Lagos' },
            { employeeCode: 'EMP-1016', name: 'Asmau Umar', email: 'asmau.umar@meridianglobal.io', role: 'Senior Technical PM', departmentId: prdId, managerName: 'Amina Bello', startDate: '2024-07-08', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L5 · ₦18.0M–₦23.5M', location: 'Abuja, FCT' },
            { employeeCode: 'EMP-1017', name: 'Yakubu Danjuma', email: 'yakubu.danjuma@meridianglobal.io', role: 'Product Operations Manager', departmentId: prdId, managerName: 'Jibril Hassan', startDate: '2025-03-03', employmentType: 'Full-Time', status: 'On Leave', compensationBand: 'L4 · ₦12.0M–₦15.5M', location: 'Minna, Niger' },

            // Design & Research (5 filled vs 5 target -> gap 0)
            { employeeCode: 'EMP-1018', name: 'Sadiq Abubakar', email: 'sadiq.abubakar@meridianglobal.io', role: 'Head of Design', departmentId: desId, managerName: 'Executive Leadership', startDate: '2022-08-15', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L7 · ₦32.0M–₦40.0M', location: 'Barnawa, Kaduna' },
            { employeeCode: 'EMP-1019', name: 'Zuwaira Bello', email: 'zuwaira.bello@meridianglobal.io', role: 'Staff Product Designer', departmentId: desId, managerName: 'Sadiq Abubakar', startDate: '2023-05-22', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L6 · ₦22.0M–₦28.0M', location: 'Abuja, FCT' },
            { employeeCode: 'EMP-1020', name: 'Aminu Bayero', email: 'aminu.bayero@meridianglobal.io', role: 'Design Systems Lead', departmentId: desId, managerName: 'Sadiq Abubakar', startDate: '2024-01-15', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L5 · ₦17.5M–₦22.0M', location: 'Kano, KN' },
            { employeeCode: 'EMP-1021', name: 'Aisha Abdullahi', email: 'aisha.abdullahi@meridianglobal.io', role: 'Senior UX Researcher', departmentId: desId, managerName: 'Sadiq Abubakar', startDate: '2024-11-04', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L5 · ₦16.5M–₦21.0M', location: 'Bauchi, BA' },
            { employeeCode: 'EMP-1022', name: 'Hadiza Maikano', email: 'hadiza.maikano@meridianglobal.io', role: 'Product Designer II', departmentId: desId, managerName: 'Zuwaira Bello', startDate: '2025-08-18', employmentType: 'Part-Time', status: 'Active', compensationBand: 'L4 · ₦10.5M–₦13.5M', location: 'Jos, Plateau' },

            // Enterprise Sales (6 filled vs 10 target -> gap 4)
            { employeeCode: 'EMP-1023', name: 'Zainab Usman', email: 'zainab.usman@meridianglobal.io', role: 'CRO / VP Enterprise Sales', departmentId: slsId, managerName: 'Executive Leadership', startDate: '2022-02-07', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L8 · ₦46.0M–₦58.0M', location: 'Maitama, Abuja' },
            { employeeCode: 'EMP-1024', name: 'Nasiru Dikko', email: 'nasiru.dikko@meridianglobal.io', role: 'Enterprise Account Executive', departmentId: slsId, managerName: 'Zainab Usman', startDate: '2023-07-10', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L5 · ₦19.5M–₦26.0M', location: 'Victoria Island, Lagos' },
            { employeeCode: 'EMP-1025', name: 'Fauziya Galadima', email: 'fauziya.galadima@meridianglobal.io', role: 'Regional Sales Director', departmentId: slsId, managerName: 'Zainab Usman', startDate: '2023-10-02', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L6 · ₦26.0M–₦34.0M', location: 'Kano, KN' },
            { employeeCode: 'EMP-1026', name: 'Umar Farouk', email: 'umar.farouk@meridianglobal.io', role: 'Solutions Architect', departmentId: slsId, managerName: 'Zainab Usman', startDate: '2024-06-17', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L5 · ₦18.5M–₦24.0M', location: 'Abuja, FCT' },
            { employeeCode: 'EMP-1027', name: 'Ismaila Kaita', email: 'ismaila.kaita@meridianglobal.io', role: 'Mid-Market Account Executive', departmentId: slsId, managerName: 'Fauziya Galadima', startDate: '2025-04-14', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L4 · ₦13.5M–₦18.0M', location: 'Kaduna, KD' },
            { employeeCode: 'EMP-1028', name: 'Bashir Lawal', email: 'bashir.lawal@meridianglobal.io', role: 'Sales Enablement Specialist', departmentId: slsId, managerName: 'Zainab Usman', startDate: '2026-11-18', employmentType: 'Full-Time', status: 'Onboarding', compensationBand: 'L4 · ₦11.5M–₦15.0M', location: 'Abuja, FCT' },

            // Security & Infrastructure (4 filled vs 6 target -> gap 2)
            { employeeCode: 'EMP-1029', name: 'Aliyu Mohammed', email: 'aliyu.mohammed@meridianglobal.io', role: 'CISO & Head of Infrastructure', departmentId: secId, managerName: 'Executive Leadership', startDate: '2022-09-05', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L7 · ₦36.0M–₦45.0M', location: 'Asokoro, Abuja' },
            { employeeCode: 'EMP-1030', name: 'Rahama Gambo', email: 'rahama.gambo@meridianglobal.io', role: 'Staff Site Reliability Engineer', departmentId: secId, managerName: 'Aliyu Mohammed', startDate: '2023-11-13', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L6 · ₦25.0M–₦32.0M', location: 'Maiduguri, Borno' },
            { employeeCode: 'EMP-1031', name: 'Bello Tambuwal', email: 'bello.tambuwal@meridianglobal.io', role: 'Cloud Security Engineer', departmentId: secId, managerName: 'Aliyu Mohammed', startDate: '2024-08-19', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L5 · ₦18.5M–₦24.0M', location: 'Abuja, FCT' },
            { employeeCode: 'EMP-1032', name: 'Maryam Danladi', email: 'maryam.danladi@meridianglobal.io', role: 'CBN & PCI-DSS Compliance Lead', departmentId: secId, managerName: 'Aliyu Mohammed', startDate: '2025-02-10', employmentType: 'Full-Time', status: 'On Leave', compensationBand: 'L5 · ₦17.0M–₦22.0M', location: 'Abuja, FCT' },

            // People & Operations (4 filled vs 5 target -> gap 1)
            { employeeCode: 'EMP-1033', name: 'Halima Suleiman', email: 'halima.suleiman@meridianglobal.io', role: 'VP of People & Operations', departmentId: opsId, managerName: 'Executive Leadership', startDate: '2022-05-02', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L7 · ₦30.0M–₦38.0M', location: 'Nassarawa, Kano' },
            { employeeCode: 'EMP-1034', name: 'Yusufari Kyari', email: 'yusufari.kyari@meridianglobal.io', role: 'Senior Finance & PAYE Controller', departmentId: opsId, managerName: 'Halima Suleiman', startDate: '2023-02-20', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L5 · ₦17.5M–₦22.5M', location: 'Abuja, FCT' },
            { employeeCode: 'EMP-1035', name: 'Tariq Mohammed', email: 'tariq.mohammed@meridianglobal.io', role: 'Technical Recruiter Lead', departmentId: opsId, managerName: 'Halima Suleiman', startDate: '2024-03-11', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L5 · ₦15.5M–₦20.0M', location: 'Yola, Adamawa' },
            { employeeCode: 'EMP-1036', name: 'Maimuna Alkali', email: 'maimuna.alkali@meridianglobal.io', role: 'People Operations Partner', departmentId: opsId, managerName: 'Halima Suleiman', startDate: '2025-05-19', employmentType: 'Full-Time', status: 'Active', compensationBand: 'L4 · ₦10.5M–₦14.0M', location: 'Gombe, GM' },
          ])
          .returning();

        const onboardingEmps = seedEmployees.filter((e) => e.status === 'Onboarding');
        for (const emp of onboardingEmps) {
          await tx.insert(onboardingTasks).values([
            {
              employeeId: emp.id,
              title: 'Laptop Dispatch & Corporate SSO Provisioning',
              category: 'IT & Access',
              completed: true,
              dueDate: emp.startDate,
              completedAt: new Date(),
            },
            {
              employeeId: emp.id,
              title: 'PAYE Tax ID, PenCom RSA & HMO Enrollment',
              category: 'HR & Compliance',
              completed: true,
              dueDate: emp.startDate,
              completedAt: new Date(),
            },
            {
              employeeId: emp.id,
              title: 'NDPR Data Privacy & Security Policy Sign-Off',
              category: 'HR & Compliance',
              completed: false,
              dueDate: '2026-12-04',
            },
            {
              employeeId: emp.id,
              title: 'Department Architecture & Playbook Walkthrough',
              category: 'Orientation',
              completed: false,
              dueDate: '2026-12-07',
            },
            {
              employeeId: emp.id,
              title: '30-60-90 Day Success Plan Alignment',
              category: 'Manager Setup',
              completed: false,
              dueDate: '2026-12-11',
            },
          ]);
        }

        const seededReqs = await tx
          .insert(jobRequisitions)
          .values([
            {
              reqCode: 'REQ-201',
              departmentId: engId,
              roleTitle: 'Staff Distributed Systems Engineer',
              hiringManager: 'Ibrahim Danjuma',
              urgency: 'Critical',
              headcountNeeded: 2,
              filledHires: 0,
              targetStartDate: '2026-12-15',
              compensationBand: 'L6 · ₦26.0M–₦34.0M',
              location: 'Abuja / Global Remote',
              employmentType: 'Full-Time',
              jobSummary:
                'Architect high-throughput global payment settlement rails and multi-region failover services powering millions of daily transactions.',
              isPublishedToWebsite: true,
              publishedSocials: 'LinkedIn,X,WhatsApp',
              status: 'Open',
            },
            {
              reqCode: 'REQ-202',
              departmentId: engId,
              roleTitle: 'Senior Go / Core Ledger Engineer',
              hiringManager: 'Abdullahi Sani',
              urgency: 'Critical',
              headcountNeeded: 2,
              filledHires: 0,
              targetStartDate: '2027-01-05',
              compensationBand: 'L5 · ₦18.5M–₦24.0M',
              location: 'Kano / Remote',
              employmentType: 'Full-Time',
              jobSummary:
                'Build double-entry reconciliation engines, real-time webhook pipelines, and idempotent settlement microservices in Go and PostgreSQL.',
              isPublishedToWebsite: true,
              publishedSocials: 'LinkedIn,X',
              status: 'Open',
            },
            {
              reqCode: 'REQ-203',
              departmentId: slsId,
              roleTitle: 'Strategic Enterprise Account Executive',
              hiringManager: 'Zainab Usman',
              urgency: 'Critical',
              headcountNeeded: 2,
              filledHires: 0,
              targetStartDate: '2026-12-10',
              compensationBand: 'L6 · ₦26.0M–₦34.0M OTE',
              location: 'Abuja / Lagos',
              employmentType: 'Full-Time',
              jobSummary:
                'Lead commercial growth across Tier-1 financial institutions, FMCG conglomerates, and global enterprise treasury teams.',
              isPublishedToWebsite: true,
              publishedSocials: 'LinkedIn,WhatsApp',
              status: 'Open',
            },
            {
              reqCode: 'REQ-204',
              departmentId: slsId,
              roleTitle: 'Senior Solutions Consultant',
              hiringManager: 'Fauziya Galadima',
              urgency: 'High',
              headcountNeeded: 2,
              filledHires: 0,
              targetStartDate: '2027-01-12',
              compensationBand: 'L5 · ₦18.5M–₦24.0M',
              location: 'Kano / Abuja',
              employmentType: 'Full-Time',
              jobSummary:
                'Partner with enterprise technical buyers to scope API integrations, settlement workflows, and custom compliance reporting.',
              isPublishedToWebsite: true,
              publishedSocials: 'LinkedIn',
              status: 'Open',
            },
            {
              reqCode: 'REQ-205',
              departmentId: prdId,
              roleTitle: 'Principal Merchant Payments Product Manager',
              hiringManager: 'Amina Bello',
              urgency: 'High',
              headcountNeeded: 1,
              filledHires: 0,
              targetStartDate: '2027-01-06',
              compensationBand: 'L6 · ₦25.0M–₦32.0M',
              location: 'Wuse II, Abuja',
              employmentType: 'Full-Time',
              jobSummary:
                'Own the checkout, virtual accounts, and automated merchant reconciliation roadmap for Meridian Global business accounts.',
              isPublishedToWebsite: true,
              publishedSocials: 'LinkedIn,X',
              status: 'Open',
            },
            {
              reqCode: 'REQ-206',
              departmentId: secId,
              roleTitle: 'Senior Application Security Engineer',
              hiringManager: 'Aliyu Mohammed',
              urgency: 'High',
              headcountNeeded: 2,
              filledHires: 0,
              targetStartDate: '2027-01-19',
              compensationBand: 'L5 · ₦19.0M–₦24.5M',
              location: 'Asokoro, Abuja',
              employmentType: 'Full-Time',
              jobSummary:
                'Drive threat modeling, SAST/DAST automation, and PCI-DSS v4.0 security audits across all global financial APIs.',
              isPublishedToWebsite: true,
              publishedSocials: 'LinkedIn,X,WhatsApp',
              status: 'Open',
            },
            {
              reqCode: 'REQ-207',
              departmentId: opsId,
              roleTitle: 'Technical Talent Sourcer',
              hiringManager: 'Halima Suleiman',
              urgency: 'Normal',
              headcountNeeded: 1,
              filledHires: 0,
              targetStartDate: '2027-02-01',
              compensationBand: 'L4 · ₦11.5M–₦15.0M',
              location: 'Nassarawa, Kano',
              employmentType: 'Full-Time',
              jobSummary:
                'Partner with Engineering and Product hiring managers to source top-tier talent across Northern Nigeria, Lagos, and global remote hubs.',
              isPublishedToWebsite: false,
              publishedSocials: '',
              status: 'Open',
            },
          ])
          .returning();

        const reqByCode = new Map(seededReqs.map((r) => [r.reqCode, r]));

        await tx.insert(candidates).values([
          {
            requisitionId: reqByCode.get('REQ-201')!.id,
            name: 'Suleiman Magaji',
            email: 'suleiman.magaji@example.com',
            currentTitle: 'Senior Payments Engineer at Paystack',
            source: 'Referral',
            stage: 'Offer',
            location: 'Abuja, NG',
            compensationExpectation: 'L6 · ₦30.5M',
            notes: 'Strong consensus from architecture panel; ready for final offer sign-off.',
          },
          {
            requisitionId: reqByCode.get('REQ-201')!.id,
            name: 'Hafsat Waziri',
            email: 'hafsat.waziri@example.com',
            currentTitle: 'Staff Infrastructure Engineer at Flutterwave',
            source: 'LinkedIn',
            stage: 'Interview',
            location: 'Kaduna, NG',
            compensationExpectation: 'L6 · ₦29.0M',
            notes: 'Completed distributed systems design round with top marks.',
          },
          {
            requisitionId: reqByCode.get('REQ-201')!.id,
            name: 'Abubakar Gusau',
            email: 'abubakar.gusau@example.com',
            currentTitle: 'Backend Tech Lead at Moniepoint',
            source: 'Careers Website',
            stage: 'Screening',
            location: 'Abuja, NG',
            compensationExpectation: 'L6 · ₦28.0M',
            notes: 'Technical screen scheduled with Abdullahi Sani.',
          },
          {
            requisitionId: reqByCode.get('REQ-202')!.id,
            name: 'Kabir Adamu',
            email: 'kabir.adamu@example.com',
            currentTitle: 'Core Ledger Engineer at Kuda',
            source: 'Direct',
            stage: 'Interview',
            location: 'Kano, NG',
            compensationExpectation: 'L5 · ₦22.0M',
            notes: 'Deep Go, PostgreSQL, and idempotent ledger experience.',
          },
          {
            requisitionId: reqByCode.get('REQ-202')!.id,
            name: 'Nafisa Katsina',
            email: 'nafisa.katsina@example.com',
            currentTitle: 'Backend Engineer at Interswitch',
            source: 'LinkedIn',
            stage: 'Applied',
            location: 'Katsina, NG',
            compensationExpectation: 'L5 · ₦20.5M',
            notes: 'Applied via LinkedIn job post.',
          },
          {
            requisitionId: reqByCode.get('REQ-203')!.id,
            name: 'Jamila Bako',
            email: 'jamila.bako@example.com',
            currentTitle: 'Enterprise Sales Lead at PiggyVest Business',
            source: 'Agency',
            stage: 'Offer',
            location: 'Abuja, NG',
            compensationExpectation: 'L6 · ₦31.0M OTE',
            notes: 'Closed ₦18B TPV enterprise pipeline in FY25; verbal alignment.',
          },
          {
            requisitionId: reqByCode.get('REQ-203')!.id,
            name: 'Usman Maiyaki',
            email: 'usman.maiyaki@example.com',
            currentTitle: 'Strategic Accounts at Andela',
            source: 'Referral',
            stage: 'Interview',
            location: 'Lagos, NG',
            compensationExpectation: 'L6 · ₦29.5M OTE',
            notes: 'Executive mock pitch set for Friday.',
          },
          {
            requisitionId: reqByCode.get('REQ-203')!.id,
            name: 'Farida Gumel',
            email: 'farida.gumel@example.com',
            currentTitle: 'Senior Relationship Manager at Jaiz Bank',
            source: 'LinkedIn',
            stage: 'Applied',
            location: 'Kano, NG',
            compensationExpectation: 'L6 · ₦28.0M OTE',
            notes: 'Strong Tier-1 corporate banking relationships.',
          },
          {
            requisitionId: reqByCode.get('REQ-204')!.id,
            name: 'Mubarak Daura',
            email: 'mubarak.daura@example.com',
            currentTitle: 'Solutions Architect at Interswitch',
            source: 'Careers Website',
            stage: 'Screening',
            location: 'Kaduna, NG',
            compensationExpectation: 'L5 · ₦21.0M',
            notes: 'Strong enterprise pre-sales track record across Northern Nigeria & Abuja.',
          },
          {
            requisitionId: reqByCode.get('REQ-205')!.id,
            name: 'Khadijah Sani',
            email: 'khadijah.sani@example.com',
            currentTitle: 'Principal PM at Carbon',
            source: 'Referral',
            stage: 'Interview',
            location: 'Abuja, NG',
            compensationExpectation: 'L6 · ₦28.5M',
            notes: 'Product case study presentation rated 4.8/5.',
          },
          {
            requisitionId: reqByCode.get('REQ-205')!.id,
            name: 'Tanimu Yola',
            email: 'tanimu.yola@example.com',
            currentTitle: 'Senior PM at FairMoney',
            source: 'Direct',
            stage: 'Screening',
            location: 'Abuja, NG',
            compensationExpectation: 'L6 · ₦27.0M',
            notes: 'Discovery call completed.',
          },
          {
            requisitionId: reqByCode.get('REQ-206')!.id,
            name: 'Haruna Garba',
            email: 'haruna.garba@example.com',
            currentTitle: 'AppSec Lead at OPay',
            source: 'Direct',
            stage: 'Offer',
            location: 'Abuja, NG',
            compensationExpectation: 'L5 · ₦23.0M',
            notes: 'Offer letter approved by CISO; awaiting final confirmation.',
          },
          {
            requisitionId: reqByCode.get('REQ-206')!.id,
            name: 'Auwalu Ringim',
            email: 'auwalu.ringim@example.com',
            currentTitle: 'Security Engineer at Cowrywise',
            source: 'LinkedIn',
            stage: 'Applied',
            location: 'Kano, NG',
            compensationExpectation: 'L5 · ₦20.0M',
            notes: 'Applied this week via Careers Website.',
          },
          {
            requisitionId: reqByCode.get('REQ-207')!.id,
            name: 'Amina Kankia',
            email: 'amina.kankia@example.com',
            currentTitle: 'Senior Talent Partner at SeamlessHR',
            source: 'Referral',
            stage: 'Screening',
            location: 'Kano, NG',
            compensationExpectation: 'L4 · ₦13.5M',
            notes: 'Great fit for engineering and executive sourcing.',
          },
        ]);

        const empByCode = new Map(seedEmployees.map((e) => [e.employeeCode, e]));

        await tx.insert(approvalRequests).values([
          {
            requestType: 'STAFFING_INCREASE',
            status: 'Pending',
            requesterName: 'Ibrahim Danjuma',
            requesterEmail: 'ibrahim.danjuma@meridianglobal.io',
            departmentId: engId,
            title: 'Expand Core Engineering Target Headcount (+3 FTE)',
            justification:
              'Global multi-currency settlement upgrade requires two additional core ledger engineers and one reliability lead to meet Tier-1 partner SLA commitments.',
            requestedTargetHeadcount: 21,
            requestedBudget: 565000000,
          },
          {
            requestType: 'DEPARTMENT_TRANSFER',
            status: 'Pending',
            requesterName: 'Zainab Usman',
            requesterEmail: 'zainab.usman@meridianglobal.io',
            departmentId: engId,
            employeeId: empByCode.get('EMP-1006')!.id,
            toDepartmentId: secId,
            title: 'Transfer Kabiru Bala to Security & Infrastructure',
            justification:
              'Kabiru has been leading zero-trust Kubernetes ingress hardening and is ready to transition permanently into the Abuja SRE & Security team.',
            requestedRoleTitle: 'Senior Infrastructure Engineer',
          },
          {
            requestType: 'NEW_REQUISITION',
            status: 'Pending',
            requesterName: 'Amina Bello',
            requesterEmail: 'amina.bello@meridianglobal.io',
            departmentId: prdId,
            title: 'Open Requisition: Global Treasury Product Manager',
            justification:
              'Dedicated PM needed for multi-currency NGN/USD/GBP corporate treasury reporting integrations.',
            requestedRoleTitle: 'Senior Product Manager, Treasury',
            requestedUrgency: 'High',
          },
        ]);

        await tx.insert(auditLogs).values([
          {
            actorName: 'Ibrahim Danjuma',
            actorEmail: 'ibrahim.danjuma@meridianglobal.io',
            actorRole: 'DEPARTMENT_HEAD',
            action: 'EMPLOYEE_CREATED',
            entityType: 'Employee',
            entityId: empByCode.get('EMP-1013')!.id,
            summary: 'Onboarded Khadija Yusuf as QA Automation Lead in Core Engineering',
            details: 'EMP-1013 · Abuja, FCT · 5 onboarding tasks assigned',
          },
          {
            actorName: 'Zainab Usman',
            actorEmail: 'zainab.usman@meridianglobal.io',
            actorRole: 'DEPARTMENT_HEAD',
            action: 'EMPLOYEE_CREATED',
            entityType: 'Employee',
            entityId: empByCode.get('EMP-1028')!.id,
            summary: 'Onboarded Bashir Lawal as Sales Enablement Specialist in Enterprise Sales',
            details: 'EMP-1028 · Abuja, FCT · Status: Onboarding',
          },
          {
            actorName: 'Ibrahim Danjuma',
            actorEmail: 'ibrahim.danjuma@meridianglobal.io',
            actorRole: 'DEPARTMENT_HEAD',
            action: 'REQUEST_SUBMITTED',
            entityType: 'Approval',
            summary: 'Submitted staffing increase request for Core Engineering (18 -> 21 FTE)',
            details: 'Requested budget adjustment to ₦565,000,000',
          },
          {
            actorName: 'Aliyu Mohammed',
            actorEmail: 'aliyu.mohammed@meridianglobal.io',
            actorRole: 'DEPARTMENT_HEAD',
            action: 'CANDIDATE_STAGE_CHANGED',
            entityType: 'Candidate',
            summary: 'Advanced Haruna Garba to Offer stage for Senior Application Security Engineer',
            details: 'REQ-206 · Security & Infrastructure',
          },
          {
            actorName: 'Sadiq Abubakar',
            actorEmail: 'sadiq.abubakar@meridianglobal.io',
            actorRole: 'DEPARTMENT_HEAD',
            action: 'DEPARTMENT_UPDATED',
            entityType: 'Department',
            entityId: desId,
            summary: 'Design & Research reached 100% approved staffing target (5 / 5 FTE)',
            details: 'Priority normalized to Normal',
          },
        ]);
      });

      isSeeded = true;
    } catch (error) {
      console.error('Error seeding database:', error);
      seedPromise = null;
      throw error;
    }
  })();

  return seedPromise;
}
