/**
 * Auto-create IT admin accounts for all universities that don't have one.
 * Run: node scripts/seed-it-admins.js
 *
 * Default credentials per university:
 *   Email:    admin@<shortname>.edu.ng   (lowercase, sanitised)
 *   Password: ITAdmin@2025               (must be changed on first login)
 *
 * Outputs a credentials report to: scripts/it-admin-credentials.csv
 */
require('dotenv').config();
const { Pool }  = require('pg');
const bcrypt    = require('bcryptjs');
const fs        = require('fs');
const path      = require('path');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const DEFAULT_PASSWORD = 'ITAdmin@2025';

function slugify(str) {
  return (str ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')   // remove non-alphanumeric
    .slice(0, 20);
}

async function run() {
  const client = await pool.connect();
  try {
    // Get role id for 'admin'
    const { rows: [adminRole] } = await client.query(
      "SELECT id FROM roles WHERE name = 'admin'"
    );
    if (!adminRole) throw new Error('Role "admin" not found in database');

    // Find all universities without an IT admin account
    const { rows: unis } = await client.query(`
      SELECT u.id, u.name, u.short_name
      FROM universities u
      WHERE u.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM users usr
          JOIN user_roles ur ON ur.user_id = usr.id
          WHERE ur.role_id = $1
            AND usr.university_id = u.id
            AND usr.deleted_at IS NULL
        )
      ORDER BY u.name
    `, [adminRole.id]);

    console.log(`\nFound ${unis.length} universities without an IT admin\n`);

    if (unis.length === 0) {
      console.log('✓ All universities already have IT admins.');
      return;
    }

    const hash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
    const credentials = [];
    let created = 0, skipped = 0;

    for (const uni of unis) {
      const slug  = slugify(uni.short_name || uni.name);
      const email = `admin@${slug}.edu.ng`;

      // Skip if email already taken
      const { rows: [existing] } = await client.query(
        'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [email]
      );
      if (existing) {
        // Try with a number suffix
        let found = false;
        for (let i = 2; i <= 9; i++) {
          const altEmail = `admin${i}@${slug}.edu.ng`;
          const { rows: [alt] } = await client.query(
            'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [altEmail]
          );
          if (!alt) {
            // Use this email
            const { rows: [user] } = await client.query(
              `INSERT INTO users (full_name, email, university_id, status, subscription_verified)
               VALUES ($1, $2, $3, 'active', TRUE) RETURNING id`,
              [`IT Admin`, altEmail, uni.id]
            );
            await client.query(
              'INSERT INTO user_credentials (user_id, password_hash) VALUES ($1, $2)',
              [user.id, hash]
            );
            await client.query(
              'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
              [user.id, adminRole.id]
            );
            credentials.push({ university: uni.name, short: uni.short_name, email: altEmail, password: DEFAULT_PASSWORD });
            console.log(`  ✓ ${uni.name.padEnd(60)} → ${altEmail}`);
            created++;
            found = true;
            break;
          }
        }
        if (!found) {
          console.log(`  ✗ SKIPPED ${uni.name} — could not generate unique email`);
          skipped++;
        }
        continue;
      }

      const { rows: [user] } = await client.query(
        `INSERT INTO users (full_name, email, university_id, status, subscription_verified)
         VALUES ($1, $2, $3, 'active', TRUE) RETURNING id`,
        ['IT Admin', email, uni.id]
      );
      await client.query(
        'INSERT INTO user_credentials (user_id, password_hash) VALUES ($1, $2)',
        [user.id, hash]
      );
      await client.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
        [user.id, adminRole.id]
      );

      credentials.push({ university: uni.name, short: uni.short_name, email, password: DEFAULT_PASSWORD });
      console.log(`  ✓ ${uni.name.padEnd(60)} → ${email}`);
      created++;
    }

    // Write credentials CSV
    const csvPath = path.join(__dirname, 'it-admin-credentials.csv');
    const csvLines = [
      'University,Short Name,Email,Default Password',
      ...credentials.map(c =>
        `"${c.university}","${c.short}","${c.email}","${c.password}"`
      ),
    ];
    fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');

    console.log(`\n✓ Created: ${created}  Skipped: ${skipped}`);
    console.log(`✓ Credentials saved to: scripts/it-admin-credentials.csv`);
    console.log(`\nDefault password for all: ${DEFAULT_PASSWORD}`);
    console.log('Distribute credentials securely and ask each admin to change their password.\n');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err.message); process.exit(1); });
