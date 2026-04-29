/**
 * UniNMS — Journal Harvester
 *
 * Sources:
 *   kashere   — kasherejose.ng (custom scraper)
 *   openjnl   — openjournalsnigeria.org.ng (OAI-PMH)
 *   njol      — nigerianjournalsonline.com (OAI-PMH)
 *   all       — all of the above
 *
 * Usage:
 *   node harvest.js                     (kashere only)
 *   node harvest.js --source openjnl
 *   node harvest.js --source njol
 *   node harvest.js --source all
 */

require('dotenv').config({ path: '../uninms-backend/.env' });
const { Pool } = require('pg');
const xml2js   = require('xml2js');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'uninms',
  user:     process.env.DB_USER     || 'uninms_user',
  password: process.env.DB_PASSWORD || 'uninms_dev_password',
  ssl:      false,
});

// ── Fetch helper ──────────────────────────────────────────────────────────────
async function fetchURL(url, retries = 3) {
  const { default: fetch } = await import('node-fetch');
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; UniNMS-Harvester/1.0; academic research; +https://uninms.edu.ng)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  };
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { timeout: 30000, headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
}

// ── Insert document ───────────────────────────────────────────────────────────
async function insertDoc(doc, userId) {
  const dup = await pool.query(
    `SELECT id FROM documents WHERE title=$1 AND deleted_at IS NULL LIMIT 1`,
    [doc.title]
  );
  if (dup.rows[0]) return null;

  const { rows:[d] } = await pool.query(
    `INSERT INTO documents
       (uploader_id,title,abstract,doc_type,visibility,doi,storage_url,is_published,virus_scan_status,published_at)
     VALUES ($1,$2,$3,'research_paper','public',$4,$5,true,'clean',$6) RETURNING id`,
    [userId, doc.title.slice(0,499), doc.abstract?.slice(0,3000)||null,
     doc.doi||null, doc.sourceUrl||null, doc.publishedAt||null]
  );

  for (const tag of (doc.tags||[]).slice(0,10)) {
    const t = tag.trim().toLowerCase().slice(0,99);
    if (t.length < 2) continue;
    try {
      const { rows:[tg] } = await pool.query(
        `INSERT INTO tags(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
        [t]
      );
      await pool.query(
        `INSERT INTO document_tags(document_id,tag_id,auto_tagged) VALUES($1,$2,true) ON CONFLICT DO NOTHING`,
        [d.id, tg.id]
      );
    } catch {}
  }
  return d.id;
}

// ── OAI-PMH generic harvester ─────────────────────────────────────────────────
async function harvestOAI(name, baseUrl, limit = 500, userId) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Harvesting: ${name}`);
  console.log(`OAI:        ${baseUrl}`);
  console.log('─'.repeat(60));

  let imported=0, skipped=0, errors=0, token=null, page=0;

  do {
    page++;
    const url = token
      ? `${baseUrl}?verb=ListRecords&resumptionToken=${encodeURIComponent(token)}`
      : `${baseUrl}?verb=ListRecords&metadataPrefix=oai_dc`;

    console.log(`  Page ${page}...`);

    let parsed;
    try {
      const xml = await fetchURL(url);
      parsed = await new xml2js.Parser({ explicitArray:false }).parseStringPromise(xml);
    } catch (err) {
      console.log(`  Fetch error: ${err.message}`);
      break;
    }

    const lr = parsed?.['OAI-PMH']?.ListRecords;
    if (!lr) {
      const err = parsed?.['OAI-PMH']?.error;
      if (err) console.log(`  OAI error: ${typeof err==='object'?err._:err}`);
      break;
    }

    const records = lr.record ? (Array.isArray(lr.record)?lr.record:[lr.record]) : [];
    console.log(`  ${records.length} records`);

    for (const rec of records) {
      try {
        const md = rec.metadata?.['oai_dc:dc'];
        if (!md || rec.header?.['$']?.status==='deleted') continue;

        const g = f => {
          const v = md[f]; if(!v) return null;
          const x = Array.isArray(v)?v[0]:v;
          return (typeof x==='object'?x._:x)||null;
        };

        const title = g('dc:title');
        if (!title||title.length<5) continue;

        const descs = md['dc:description'];
        const abstract = descs
          ? (Array.isArray(descs)?descs:[descs])
              .map(d=>typeof d==='object'?d._:d).filter(Boolean)
              .find(d=>!d.startsWith('http')&&d.length>20) || null
          : null;

        const subjs = md['dc:subject'];
        const tags = subjs
          ? (Array.isArray(subjs)?subjs:[subjs])
              .map(s=>typeof s==='object'?s._:s).filter(Boolean)
              .flatMap(s=>s.split(/[,;]/))
              .map(t=>t.trim().toLowerCase())
              .filter(t=>t.length>2&&t.length<100).slice(0,10)
          : [];

        const dcIds = md['dc:identifier'];
        let doi=null, sourceUrl=null;
        if (dcIds) {
          (Array.isArray(dcIds)?dcIds:[dcIds]).forEach(id=>{
            const s=typeof id==='object'?id._:id; if(!s) return;
            if(s.includes('doi.org')) doi=s.replace(/https?:\/\/doi\.org\//i,'');
            if(s.startsWith('http')&&!sourceUrl) sourceUrl=s;
          });
        }

        const dateStr = g('dc:date');
        let publishedAt=null;
        if(dateStr) try{ publishedAt=new Date(dateStr).toISOString(); }catch{}

        const ins = await insertDoc({title,abstract,tags,doi,sourceUrl,publishedAt}, userId);
        ins ? imported++ : skipped++;
        if(imported>0&&imported%20===0) process.stdout.write(`  Imported ${imported}...\r`);
      } catch { errors++; }
    }

    const rt = lr.resumptionToken;
    token = rt ? (typeof rt==='object'?rt._:rt)||null : null;
    if (token) await new Promise(r=>setTimeout(r,1500));
    if (imported+skipped >= limit) { console.log(`\n  Reached ${limit} record limit`); break; }

  } while (token);

  console.log(`\n  ✓ Done  Imported: ${imported} | Skipped: ${skipped} | Errors: ${errors}`);
  return { imported, skipped, errors };
}

// ── Kashere web scraper ───────────────────────────────────────────────────────
function extractKashere(html, id) {
  const pick = (...ps) => { for(const p of ps){ const m=html.match(p); if(m?.[1]?.trim().length>4) return m[1].trim(); } return null; };

  const rawTitle = pick(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{5,400})["']/i,
    /<h1[^>]*>([^<]{5,400})<\/h1>/i,
    /<h2[^>]*>([^<]{5,400})<\/h2>/i,
    /<title>([^<]{5,200})<\/title>/i
  );
  if (!rawTitle) return null;
  const title = rawTitle.replace(/\s*[-|–]\s*Kashere.*$/i,'').replace(/\s*[-|–]\s*KJSE.*$/i,'').trim();
  if (title.length<5) return null;

  const abstract = pick(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{30,2000})["']/i,
    /abstract[^>]*>([\s\S]{30,2000}?)<\//i
  )?.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()||null;

  const keyStr = pick(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i);
  const tags = keyStr ? keyStr.split(/[,;]/).map(t=>t.trim().toLowerCase()).filter(t=>t.length>2) : [];

  const dateStr = pick(/(\d{4}-\d{2}-\d{2})/, /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})/i);
  let publishedAt=null;
  if(dateStr) try{ publishedAt=new Date(dateStr).toISOString(); }catch{}

  const doiM = html.match(/doi[:\s]+(10\.\d{4,}\/[^\s"'<]+)/i);

  return { title, abstract, tags, doi:doiM?.[1]?.trim()||null,
           sourceUrl:`https://www.kasherejose.ng/publication/${id}`, publishedAt };
}

async function harvestKashere(userId) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log('Harvesting: Kashere Journal of Science & Education');
  console.log('Method: Web scraper (/publication/N)');
  console.log('─'.repeat(60));

  let imported=0, skipped=0, errors=0, notFound=0;

  for (let id=1; id<=300; id++) {
    if (notFound>=15) { console.log('  15 consecutive misses — stopping'); break; }
    try {
      const html = await fetchURL(`https://www.kasherejose.ng/publication/${id}`);
      const doc  = extractKashere(html, id);
      if (!doc) { notFound++; continue; }
      notFound=0;
      const ins = await insertDoc(doc, userId);
      ins ? imported++ : skipped++;
      if(imported>0&&imported%5===0) process.stdout.write(`  Imported ${imported}...\r`);
      await new Promise(r=>setTimeout(r,700));
    } catch(err) {
      if(err.message.includes('404')) { notFound++; }
      else { errors++; if(errors<=3) console.log(`  Error ${id}: ${err.message}`); }
    }
  }

  console.log(`\n  ✓ Done  Imported: ${imported} | Skipped: ${skipped} | Errors: ${errors}`);
  return { imported, skipped, errors };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const src  = args.find(a=>a.startsWith('--source='))?.split('=')[1]
    || (args.includes('--source') ? args[args.indexOf('--source')+1] : 'kashere');

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  UniNMS Journal Harvester   source:', src);
  console.log('═══════════════════════════════════════════════════════════');

  let { rows:[u] } = await pool.query(
    `SELECT id FROM users WHERE email='harvester@uninms.system' AND deleted_at IS NULL`
  );
  if (!u) {
    const { rows:[nu] } = await pool.query(
      `INSERT INTO users(full_name,email,status)
       VALUES('UniNMS Bot','harvester@uninms.system','active') RETURNING id`
    );
    u=nu;
  }

  const total = { imported:0, skipped:0, errors:0 };
  const add   = r => { total.imported+=r.imported; total.skipped+=r.skipped; total.errors+=r.errors; };

  // Nigerian Journals Online — OAI-PMH
  const NJOL = 'http://www.nigerianjournalsonline.com/index.php/index/oai';
  // Open Journals Nigeria — OAI-PMH
  const OJN  = 'https://www.openjournalsnigeria.org.ng/index.php/index/oai';

  if (src==='kashere' || src==='all') add(await harvestKashere(u.id));
  if (src==='njol'    || src==='all') add(await harvestOAI('Nigerian Journals Online', NJOL, 500, u.id));
  if (src==='openjnl' || src==='all') add(await harvestOAI('Open Journals Nigeria',   OJN,  500, u.id));

  if (!['kashere','njol','openjnl','all'].includes(src)) {
    console.log('Unknown source. Use: kashere | njol | openjnl | all');
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  Total imported: ${total.imported}`);
  console.log(`  Total skipped:  ${total.skipped}`);
  console.log(`  Total errors:   ${total.errors}`);
  console.log('═══════════════════════════════════════════════════════════\n');
  await pool.end();
}

main().catch(err=>{ console.error('Fatal:',err.message); process.exit(1); });
