'use strict';

/**
 * Seed all Nigerian universities (Federal, State, Private)
 * into the universities table and create default subscription records.
 *
 * Run: node scripts/seed-universities.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'uninms',
  user:     process.env.DB_USER     || 'uninms_user',
  password: process.env.DB_PASSWORD || 'uninms_dev_password',
  ssl:      false,
});

// ── Nigerian Universities ─────────────────────────────────────────────────────
// type: 'federal' | 'state' | 'private'
const UNIVERSITIES = [
  // ── FEDERAL UNIVERSITIES ──────────────────────────────────────────────────
  { name: 'University of Lagos',                                     short_name: 'UNILAG',      state: 'Lagos',      type: 'federal' },
  { name: 'University of Ibadan',                                    short_name: 'UI',          state: 'Oyo',        type: 'federal' },
  { name: 'Ahmadu Bello University',                                 short_name: 'ABU',         state: 'Kaduna',     type: 'federal' },
  { name: 'University of Nigeria, Nsukka',                           short_name: 'UNN',         state: 'Enugu',      type: 'federal' },
  { name: 'Obafemi Awolowo University',                              short_name: 'OAU',         state: 'Osun',       type: 'federal' },
  { name: 'University of Benin',                                     short_name: 'UNIBEN',      state: 'Edo',        type: 'federal' },
  { name: 'University of Ilorin',                                    short_name: 'UNILORIN',    state: 'Kwara',      type: 'federal' },
  { name: 'University of Port Harcourt',                             short_name: 'UNIPORT',     state: 'Rivers',     type: 'federal' },
  { name: 'University of Maiduguri',                                 short_name: 'UNIMAID',     state: 'Borno',      type: 'federal' },
  { name: 'University of Calabar',                                   short_name: 'UNICAL',      state: 'Cross River',type: 'federal' },
  { name: 'University of Jos',                                       short_name: 'UNIJOS',      state: 'Plateau',    type: 'federal' },
  { name: 'University of Abuja',                                     short_name: 'UNIABUJA',    state: 'FCT',        type: 'federal' },
  { name: 'Bayero University, Kano',                                 short_name: 'BUK',         state: 'Kano',       type: 'federal' },
  { name: 'Nnamdi Azikiwe University',                               short_name: 'UNIZIK',      state: 'Anambra',    type: 'federal' },
  { name: 'Usman Danfodiyo University',                              short_name: 'UDUSOK',      state: 'Sokoto',     type: 'federal' },
  { name: 'Abubakar Tafawa Balewa University',                       short_name: 'ATBU',        state: 'Bauchi',     type: 'federal' },
  { name: 'Federal University of Technology, Akure',                 short_name: 'FUTA',        state: 'Ondo',       type: 'federal' },
  { name: 'Federal University of Technology, Minna',                 short_name: 'FUTMINNA',    state: 'Niger',      type: 'federal' },
  { name: 'Federal University of Technology, Owerri',                short_name: 'FUTO',        state: 'Imo',        type: 'federal' },
  { name: 'Federal University of Agriculture, Abeokuta',             short_name: 'FUNAAB',      state: 'Ogun',       type: 'federal' },
  { name: 'Federal University of Agriculture, Makurdi',              short_name: 'FUAM',        state: 'Benue',      type: 'federal' },
  { name: 'Michael Okpara University of Agriculture, Umudike',       short_name: 'MOUAU',       state: 'Abia',       type: 'federal' },
  { name: 'Federal University of Petroleum Resources, Effurun',      short_name: 'FUPRE',       state: 'Delta',      type: 'federal' },
  { name: 'National Open University of Nigeria',                     short_name: 'NOUN',        state: 'FCT',        type: 'federal' },
  { name: 'Nigerian Defence Academy',                                short_name: 'NDA',         state: 'Kaduna',     type: 'federal' },
  { name: 'Alex Ekwueme Federal University, Ndufu-Alike',            short_name: 'AE-FUNAI',    state: 'Ebonyi',     type: 'federal' },
  { name: 'Federal University, Dutse',                               short_name: 'FUD',         state: 'Jigawa',     type: 'federal' },
  { name: 'Federal University, Dutsin-Ma',                           short_name: 'FUDMA',       state: 'Katsina',    type: 'federal' },
  { name: 'Federal University, Gashua',                              short_name: 'FUGASHUA',    state: 'Yobe',       type: 'federal' },
  { name: 'Federal University, Gusau',                               short_name: 'FUGUSAU',     state: 'Zamfara',    type: 'federal' },
  { name: 'Federal University, Kashere',                             short_name: 'FUKASHERE',   state: 'Gombe',      type: 'federal' },
  { name: 'Federal University, Lafia',                               short_name: 'FULAFIA',     state: 'Nasarawa',   type: 'federal' },
  { name: 'Federal University, Lokoja',                              short_name: 'FULOKOJA',    state: 'Kogi',       type: 'federal' },
  { name: 'Federal University, Otuoke',                              short_name: 'FUOTUOKE',    state: 'Bayelsa',    type: 'federal' },
  { name: 'Federal University, Oye-Ekiti',                           short_name: 'FUOYE',       state: 'Ekiti',      type: 'federal' },
  { name: 'Federal University, Wukari',                              short_name: 'FUWUKARI',    state: 'Taraba',     type: 'federal' },
  { name: 'Federal University, Birnin Kebbi',                        short_name: 'FUBK',        state: 'Kebbi',      type: 'federal' },
  { name: 'Modibbo Adama University',                                short_name: 'MAU',         state: 'Adamawa',    type: 'federal' },
  { name: 'Nigerian Army University Biu',                            short_name: 'NAUB',        state: 'Borno',      type: 'federal' },
  { name: 'Air Force Institute of Technology',                       short_name: 'AFIT',        state: 'Kaduna',     type: 'federal' },
  { name: 'Federal University of Health Sciences, Otukpo',           short_name: 'FUHSO',       state: 'Benue',      type: 'federal' },
  { name: 'Federal University of Health Sciences, Azare',            short_name: 'FUHSAZ',      state: 'Bauchi',     type: 'federal' },
  { name: 'University of Delta',                                     short_name: 'UNIDEL',      state: 'Delta',      type: 'federal' },

  // ── STATE UNIVERSITIES ────────────────────────────────────────────────────
  { name: 'Lagos State University',                                  short_name: 'LASU',        state: 'Lagos',      type: 'state' },
  { name: 'Lagos State University of Science and Technology',        short_name: 'LASUSTECH',   state: 'Lagos',      type: 'state' },
  { name: 'Lagos State University of Education',                     short_name: 'LASUED',      state: 'Lagos',      type: 'state' },
  { name: 'Rivers State University',                                 short_name: 'RSU',         state: 'Rivers',     type: 'state' },
  { name: 'Ignatius Ajuru University of Education',                  short_name: 'IAUE',        state: 'Rivers',     type: 'state' },
  { name: 'Delta State University',                                  short_name: 'DELSU',       state: 'Delta',      type: 'state' },
  { name: 'Delta State University of Science and Technology',        short_name: 'DSUST',       state: 'Delta',      type: 'state' },
  { name: 'Ambrose Alli University',                                 short_name: 'AAU',         state: 'Edo',        type: 'state' },
  { name: 'Edo State University, Uzairue',                           short_name: 'EDSU',        state: 'Edo',        type: 'state' },
  { name: 'Ekiti State University',                                  short_name: 'EKSU',        state: 'Ekiti',      type: 'state' },
  { name: 'Afe Babalola University, Ado-Ekiti',                      short_name: 'ABUAD',       state: 'Ekiti',      type: 'private' },
  { name: 'Kwara State University',                                  short_name: 'KWASU',       state: 'Kwara',      type: 'state' },
  { name: 'Al-Hikmah University',                                    short_name: 'ALHIKMAH',    state: 'Kwara',      type: 'private' },
  { name: 'Osun State University',                                   short_name: 'UNIOSUN',     state: 'Osun',       type: 'state' },
  { name: 'Olabisi Onabanjo University',                             short_name: 'OOU',         state: 'Ogun',       type: 'state' },
  { name: 'Tai Solarin University of Education',                     short_name: 'TASUED',      state: 'Ogun',       type: 'state' },
  { name: 'Ladoke Akintola University of Technology',                short_name: 'LAUTECH',     state: 'Oyo',        type: 'state' },
  { name: 'Oyo State Technical University',                          short_name: 'TECH-U',      state: 'Oyo',        type: 'state' },
  { name: 'Adekunle Ajasin University',                              short_name: 'AAUA',        state: 'Ondo',       type: 'state' },
  { name: 'Ondo State University of Science and Technology',         short_name: 'OSUSTECH',    state: 'Ondo',       type: 'state' },
  { name: 'Kogi State University',                                   short_name: 'KSU',         state: 'Kogi',       type: 'state' },
  { name: 'Confluence University of Science and Technology',         short_name: 'CUSTECH',     state: 'Kogi',       type: 'state' },
  { name: 'Anambra State University',                                short_name: 'ANSU',        state: 'Anambra',    type: 'state' },
  { name: 'Chukwuemeka Odumegwu Ojukwu University',                  short_name: 'COOU',        state: 'Anambra',    type: 'state' },
  { name: 'Imo State University',                                    short_name: 'IMSU',        state: 'Imo',        type: 'state' },
  { name: 'Abia State University',                                   short_name: 'ABSU',        state: 'Abia',       type: 'state' },
  { name: 'Enugu State University of Science and Technology',        short_name: 'ESUT',        state: 'Enugu',      type: 'state' },
  { name: 'Cross River University of Technology',                    short_name: 'CRUTECH',     state: 'Cross River',type: 'state' },
  { name: 'Akwa Ibom State University',                              short_name: 'AKSU',        state: 'Akwa Ibom',  type: 'state' },
  { name: 'Benue State University',                                  short_name: 'BSU',         state: 'Benue',      type: 'state' },
  { name: 'Kogi State Technical University',                         short_name: 'KOGITECH',    state: 'Kogi',       type: 'state' },
  { name: 'Niger Delta University',                                  short_name: 'NDU',         state: 'Bayelsa',    type: 'state' },
  { name: 'Isaac Jasper Boro College of Education',                  short_name: 'IJBCOE',      state: 'Bayelsa',    type: 'state' },
  { name: 'Plateau State University',                                short_name: 'PLASU',       state: 'Plateau',    type: 'state' },
  { name: 'Nasarawa State University',                               short_name: 'NSUK',        state: 'Nasarawa',   type: 'state' },
  { name: 'Ibrahim Badamasi Babangida University',                   short_name: 'IBBU',        state: 'Niger',      type: 'state' },
  { name: 'Adamawa State University',                                short_name: 'ADSU',        state: 'Adamawa',    type: 'state' },
  { name: 'Taraba State University',                                 short_name: 'TSU',         state: 'Taraba',     type: 'state' },
  { name: 'Gombe State University',                                  short_name: 'GSU',         state: 'Gombe',      type: 'state' },
  { name: 'Yobe State University',                                   short_name: 'YSU',         state: 'Yobe',       type: 'state' },
  { name: 'Sokoto State University',                                 short_name: 'SSU',         state: 'Sokoto',     type: 'state' },
  { name: 'Kebbi State University of Science and Technology',        short_name: 'KSUSTA',      state: 'Kebbi',      type: 'state' },
  { name: 'Zamfara State University',                                short_name: 'ZSU',         state: 'Zamfara',    type: 'state' },
  { name: 'Northwest University, Kano',                              short_name: 'NWU',         state: 'Kano',       type: 'state' },
  { name: 'Kano State University of Science and Technology',         short_name: 'KUST',        state: 'Kano',       type: 'state' },
  { name: 'Kaduna State University',                                 short_name: 'KASU',        state: 'Kaduna',     type: 'state' },
  { name: 'Al-Qalam University',                                     short_name: 'AQU',         state: 'Katsina',    type: 'private' },
  { name: 'Katsina University',                                      short_name: 'KTU',         state: 'Katsina',    type: 'state' },

  // ── PRIVATE UNIVERSITIES ─────────────────────────────────────────────────
  { name: 'Covenant University',                                     short_name: 'CU',          state: 'Ogun',       type: 'private' },
  { name: 'Babcock University',                                      short_name: 'BU',          state: 'Ogun',       type: 'private' },
  { name: 'Pan-Atlantic University',                                 short_name: 'PAU',         state: 'Lagos',      type: 'private' },
  { name: 'American University of Nigeria',                          short_name: 'AUN',         state: 'Adamawa',    type: 'private' },
  { name: 'Bells University of Technology',                          short_name: 'BELLSTECH',   state: 'Ogun',       type: 'private' },
  { name: 'Bowen University',                                        short_name: 'BOWEN',       state: 'Osun',       type: 'private' },
  { name: 'Landmark University',                                     short_name: 'LMU',         state: 'Kwara',      type: 'private' },
  { name: 'Lead City University',                                    short_name: 'LCU',         state: 'Oyo',        type: 'private' },
  { name: 'Crawford University',                                     short_name: 'CU-FAITH',    state: 'Ogun',       type: 'private' },
  { name: 'Achievers University',                                    short_name: 'ACHIEUNI',    state: 'Ondo',       type: 'private' },
  { name: 'Baze University',                                         short_name: 'BAZE',        state: 'FCT',        type: 'private' },
  { name: 'Veritas University',                                      short_name: 'VERITAS',     state: 'FCT',        type: 'private' },
  { name: 'Nile University of Nigeria',                              short_name: 'NUN',         state: 'FCT',        type: 'private' },
  { name: 'Caleb University',                                        short_name: 'CALEB',       state: 'Lagos',      type: 'private' },
  { name: 'Augustine University',                                    short_name: 'AUGUSTINE',   state: 'Lagos',      type: 'private' },
  { name: 'Anchor University',                                       short_name: 'AUL',         state: 'Lagos',      type: 'private' },
  { name: 'Trinity University',                                      short_name: 'TU',          state: 'Lagos',      type: 'private' },
  { name: 'Benson Idahosa University',                               short_name: 'BIU',         state: 'Edo',        type: 'private' },
  { name: 'Igbinedion University, Okada',                            short_name: 'IUO',         state: 'Edo',        type: 'private' },
  { name: 'Samuel Adegboyega University',                            short_name: 'SAU',         state: 'Edo',        type: 'private' },
  { name: 'Wellspring University',                                   short_name: 'WELLSPRING',  state: 'Edo',        type: 'private' },
  { name: 'Redeemer\'s University',                                  short_name: 'RUN',         state: 'Osun',       type: 'private' },
  { name: 'Fountain University',                                     short_name: 'FOUNTAIN',    state: 'Osun',       type: 'private' },
  { name: 'Kings University',                                        short_name: 'KU',          state: 'Osun',       type: 'private' },
  { name: 'Oduduwa University',                                      short_name: 'OUI',         state: 'Osun',       type: 'private' },
  { name: 'Joseph Ayo Babalola University',                          short_name: 'JABU',        state: 'Ekiti',      type: 'private' },
  { name: 'Mountain Top University',                                 short_name: 'MTU',         state: 'Ogun',       type: 'private' },
  { name: 'McPherson University',                                    short_name: 'MU',          state: 'Ogun',       type: 'private' },
  { name: 'Chrisland University',                                    short_name: 'CHRISLAND',   state: 'Ogun',       type: 'private' },
  { name: 'Christopher University',                                  short_name: 'CUI',         state: 'Ogun',       type: 'private' },
  { name: 'Crescent University',                                     short_name: 'CRESCENT',    state: 'Ogun',       type: 'private' },
  { name: 'Hallmark University',                                     short_name: 'HALLMARK',    state: 'Ogun',       type: 'private' },
  { name: 'Southwestern University',                                 short_name: 'SWU',         state: 'Ogun',       type: 'private' },
  { name: 'Ajayi Crowther University',                               short_name: 'ACU',         state: 'Oyo',        type: 'private' },
  { name: 'Dominican University',                                    short_name: 'DUI',         state: 'Oyo',        type: 'private' },
  { name: 'Kola Daisi University',                                   short_name: 'KDU',         state: 'Oyo',        type: 'private' },
  { name: 'Precious Cornerstone University',                         short_name: 'PCU',         state: 'Oyo',        type: 'private' },
  { name: 'Caritas University',                                      short_name: 'CARITASUNI',  state: 'Enugu',      type: 'private' },
  { name: 'Coal City University',                                    short_name: 'CCU',         state: 'Enugu',      type: 'private' },
  { name: 'Godfrey Okoye University',                                short_name: 'GOUNI',       state: 'Enugu',      type: 'private' },
  { name: 'Renaissance University',                                  short_name: 'RENUNI',      state: 'Anambra',    type: 'private' },
  { name: 'Paul University',                                         short_name: 'PAULUNI',     state: 'Anambra',    type: 'private' },
  { name: 'Tansian University',                                      short_name: 'TANSIAN',     state: 'Anambra',    type: 'private' },
  { name: 'Ave Maria University',                                    short_name: 'AMU',         state: 'Anambra',    type: 'private' },
  { name: 'Legacy University, Okija',                                short_name: 'LEGACY',      state: 'Anambra',    type: 'private' },
  { name: 'Madonna University',                                      short_name: 'MADONNA',     state: 'Anambra',    type: 'private' },
  { name: 'Spiritan University',                                     short_name: 'SPIRITAN',    state: 'Abia',       type: 'private' },
  { name: 'Gregory University, Uturu',                               short_name: 'GUU',         state: 'Abia',       type: 'private' },
  { name: 'Clifford University',                                     short_name: 'CLIFFORD',    state: 'Abia',       type: 'private' },
  { name: 'Hezekiah University',                                     short_name: 'HEZEKIAH',    state: 'Imo',        type: 'private' },
  { name: 'Evangel University',                                      short_name: 'EVANGEL',     state: 'Ebonyi',     type: 'private' },
  { name: 'Rhema University',                                        short_name: 'RHEMA',       state: 'Rivers',     type: 'private' },
  { name: 'Arthur Jarvis University',                                short_name: 'AJU',         state: 'Cross River',type: 'private' },
  { name: 'Edwin Clark University',                                  short_name: 'ECU',         state: 'Delta',      type: 'private' },
  { name: 'Michael and Cecilia Ibru University',                     short_name: 'MCIBRU',      state: 'Delta',      type: 'private' },
  { name: 'Novena University',                                       short_name: 'NOVENA',      state: 'Delta',      type: 'private' },
  { name: 'Western Delta University',                                short_name: 'WDU',         state: 'Delta',      type: 'private' },
  { name: 'Bingham University',                                      short_name: 'BINGHAM',     state: 'Nasarawa',   type: 'private' },
  { name: 'Salem University',                                        short_name: 'SALEM',       state: 'Kogi',       type: 'private' },
  { name: 'Summit University, Offa',                                 short_name: 'SUMMIT',      state: 'Kwara',      type: 'private' },
  { name: 'Kwararafa University',                                    short_name: 'KWU',         state: 'Taraba',     type: 'private' },
  { name: 'Skyline University Nigeria',                              short_name: 'SUN',         state: 'Kano',       type: 'private' },
  { name: 'El-Rai University',                                       short_name: 'ELRAI',       state: 'Kaduna',     type: 'private' },
  { name: 'Wesley University',                                       short_name: 'WESLEY',      state: 'Ondo',       type: 'private' },
];

async function run() {
  let inserted = 0;
  let skipped  = 0;

  for (const uni of UNIVERSITIES) {
    // Upsert — skip if name already exists
    const { rows: [existing] } = await pool.query(
      'SELECT id FROM universities WHERE name = $1 AND deleted_at IS NULL',
      [uni.name]
    );

    if (existing) { skipped++; continue; }

    const { rows: [row] } = await pool.query(
      `INSERT INTO universities (name, short_name, state, type)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [uni.name, uni.short_name, uni.state, uni.type]
    );

    // Create default subscription (trial plan)
    await pool.query(
      `INSERT INTO institution_subscriptions
         (university_id, plan, status, max_users, max_storage_gb)
       VALUES ($1, 'free', 'trial', 100, 5)
       ON CONFLICT (university_id) DO NOTHING`,
      [row.id]
    );

    inserted++;
  }

  return { inserted, skipped, total: UNIVERSITIES.length };
}

run()
  .then(({ inserted, skipped, total }) => {
    console.log(`\n✓ Done!`);
    console.log(`  Total universities in list : ${total}`);
    console.log(`  Inserted                   : ${inserted}`);
    console.log(`  Already existed (skipped)  : ${skipped}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
