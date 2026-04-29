require('dotenv').config();
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'uninms',
  user:     process.env.DB_USER     || 'uninms_user',
  password: process.env.DB_PASSWORD || 'uninms_dev_password',
  ssl:      false,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ensureUser({ fullName, email, password, departmentId, roles: roleNames }) {
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows[0]) return { id: existing.rows[0].id, created: false };

  const hash = await bcrypt.hash(password, 12);

  const { rows: [user] } = await pool.query(
    `INSERT INTO users (full_name, email, department_id, status)
     VALUES ($1, $2, $3, 'active') RETURNING id`,
    [fullName, email, departmentId]
  );

  await pool.query(
    'INSERT INTO user_credentials (user_id, password_hash, email_verified) VALUES ($1, $2, true)',
    [user.id, hash]
  );

  for (const roleName of roleNames) {
    const { rows: [role] } = await pool.query('SELECT id FROM roles WHERE name = $1', [roleName]);
    if (role) {
      await pool.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [user.id, role.id]
      );
    }
  }

  await pool.query(
    'INSERT INTO reward_levels (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
    [user.id]
  );

  return { id: user.id, created: true };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const run = async () => {
  console.log('\n🌱  UniNMS — Seeding database\n');

  // ── Roles ─────────────────────────────────────────────────────────────────
  const roles = [
    'student', 'lecturer', 'researcher', 'admin', 'management',
    'super_admin', 'community_rep', 'industry_partner',
  ];
  for (const name of roles) {
    await pool.query('INSERT INTO roles (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
  }
  console.log('  ✓  Roles seeded');

  // ── University ────────────────────────────────────────────────────────────
  const { rows: [uni] } = await pool.query(`
    INSERT INTO universities (name, short_name, state, type, nuc_id)
    VALUES ('University of Nigeria, Nsukka', 'UNN', 'Enugu', 'federal', 'NUC-001')
    ON CONFLICT DO NOTHING RETURNING id
  `);
  const universityId = uni?.id || (await pool.query('SELECT id FROM universities LIMIT 1')).rows[0]?.id;
  console.log(`  ✓  University seeded (${universityId})`);

  // ── Faculty & Departments ─────────────────────────────────────────────────
  const { rows: [fac] } = await pool.query(`
    INSERT INTO faculties (university_id, name) VALUES ($1, 'Faculty of Physical Sciences')
    ON CONFLICT DO NOTHING RETURNING id`, [universityId]
  );
  const facultyId = fac?.id || (await pool.query('SELECT id FROM faculties LIMIT 1')).rows[0]?.id;

  const { rows: [cscDep] } = await pool.query(`
    INSERT INTO departments (faculty_id, name, code) VALUES ($1, 'Computer Science', 'CSC')
    ON CONFLICT DO NOTHING RETURNING id`, [facultyId]
  );
  const cscId = cscDep?.id || (await pool.query("SELECT id FROM departments WHERE code='CSC' LIMIT 1")).rows[0]?.id;

  const { rows: [mathDep] } = await pool.query(`
    INSERT INTO departments (faculty_id, name, code) VALUES ($1, 'Mathematics', 'MTH')
    ON CONFLICT DO NOTHING RETURNING id`, [facultyId]
  );
  const mathId = mathDep?.id || (await pool.query("SELECT id FROM departments WHERE code='MTH' LIMIT 1")).rows[0]?.id;

  console.log(`  ✓  Departments seeded`);

  // ── Seed Users ────────────────────────────────────────────────────────────
  const users = [
    {
      fullName:     'UniNMS Administrator',
      email:        'admin@uninms.edu.ng',
      password:     'Admin@UniNMS2024!',
      departmentId: cscId,
      roles:        ['admin', 'super_admin'],
    },
    {
      fullName:     'Dr. Ngozi Okonkwo',
      email:        'lecturer@uninms.edu.ng',
      password:     'Lecturer@1234!',
      departmentId: cscId,
      roles:        ['lecturer'],
    },
    {
      fullName:     'Prof. Emeka Chukwu',
      email:        'researcher@uninms.edu.ng',
      password:     'Research@1234!',
      departmentId: mathId,
      roles:        ['researcher'],
    },
    {
      fullName:     'Amaka Nwosu',
      email:        'student@uninms.edu.ng',
      password:     'Student@1234!',
      departmentId: cscId,
      roles:        ['student'],
    },
    {
      fullName:     'Dr. Chidi Eze',
      email:        'management@uninms.edu.ng',
      password:     'Manage@1234!',
      departmentId: cscId,
      roles:        ['management'],
    },
    {
      fullName:     'Funke Adeyemi',
      email:        'community@uninms.edu.ng',
      password:     'Community@1234!',
      departmentId: mathId,
      roles:        ['community_rep'],
    },
    {
      fullName:     'TechBridge Nigeria',
      email:        'industry@uninms.edu.ng',
      password:     'Industry@1234!',
      departmentId: cscId,
      roles:        ['industry_partner'],
    },
  ];

  console.log('\n  ── Test accounts ───────────────────────────────────────────');
  console.log('  Role              Email                         Password');
  console.log('  ─────────────────────────────────────────────────────────────');

  for (const u of users) {
    const { created } = await ensureUser(u);
    const status = created ? '✓ created' : '⏭ exists ';
    const roleLabel = u.roles.join('+').padEnd(17);
    console.log(`  ${status}  ${roleLabel}  ${u.email.padEnd(30)}  ${u.password}`);
  }

  console.log('  ─────────────────────────────────────────────────────────────\n');

  // ── Sample Tags ───────────────────────────────────────────────────────────
  const tags = [
    'machine learning', 'artificial intelligence', 'natural language processing',
    'public health', 'agriculture', 'renewable energy',
    'cybersecurity', 'blockchain', 'mobile computing', 'data science',
  ];
  for (const name of tags) {
    await pool.query('INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
  }
  console.log(`  ✓  ${tags.length} tags seeded`);

  // ── Institution subscription (enables plagiarism + all features for UNN) ──
  await pool.query(`
    INSERT INTO institution_subscriptions
      (university_id, plan_name, features, valid_until)
    VALUES (
      $1, 'pro',
      '{"plagiarism":true,"semantic_search":true,"recommendations":true,"analytics":true,"journals":true}'::jsonb,
      NOW() + INTERVAL '2 years'
    )
    ON CONFLICT (university_id) DO NOTHING`,
    [universityId]
  ).catch(() => {}); // table may not exist in all migration states
  console.log('  ✓  Institution subscription seeded');

  console.log('\n✅  Seed complete\n');
  await pool.end();
};

run().catch(err => { console.error('Seed failed:', err.message); process.exit(1); });
