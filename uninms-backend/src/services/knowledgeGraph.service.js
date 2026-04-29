'use strict';

/**
 * Knowledge Graph Service
 *
 * Provides:
 *   - getNationalResearchMap  — nodes (universities, tags) + edges (co-authorship, tag overlap)
 *   - findCollaborators       — suggest researchers by shared tag interest
 *   - getTopResearchers       — ranked by citation count, optionally filtered by tag/university
 */

const { pool } = require('../config/database');

// ─────────────────────────────────────────────────────────────────────────────
// getNationalResearchMap
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a lightweight graph suitable for frontend visualisation.
 *
 * Nodes:
 *   - type: 'university'  — id, name, state, doc_count, researcher_count
 *   - type: 'tag'         — id, name, doc_count
 *
 * Edges:
 *   - type: 'university_tag' — university produces documents tagged with this tag
 *
 * @param {{ universityId?: string, researchArea?: string, limit?: number }} opts
 */
async function getNationalResearchMap({ universityId, researchArea, limit = 100 } = {}) {
  // ── University nodes ──────────────────────────────────────────────────────
  const uniParams = [];
  let   uniWhere  = 'uni.deleted_at IS NULL';
  if (universityId) { uniParams.push(universityId); uniWhere += ` AND uni.id = $${uniParams.length}`; }

  const { rows: uniRows } = await pool.query(
    `SELECT uni.id, uni.name, uni.state, uni.type,
            COUNT(DISTINCT d.id)   AS doc_count,
            COUNT(DISTINCT u.id)   AS researcher_count
     FROM universities uni
     LEFT JOIN faculties fac ON fac.university_id = uni.id
     LEFT JOIN departments dep ON dep.faculty_id = fac.id
     LEFT JOIN users u ON u.department_id = dep.id AND u.deleted_at IS NULL
     LEFT JOIN documents d ON d.uploader_id = u.id AND d.deleted_at IS NULL AND d.is_published = true
     WHERE ${uniWhere}
     GROUP BY uni.id, uni.name, uni.state, uni.type
     ORDER BY doc_count DESC
     LIMIT $${uniParams.length + 1}`,
    [...uniParams, limit]
  );

  // ── Tag nodes (top tags by document count) ────────────────────────────────
  const tagParams = [];
  let   tagWhere  = 'd.deleted_at IS NULL AND d.is_published = true';
  if (researchArea) { tagParams.push(`%${researchArea}%`); tagWhere += ` AND t.name ILIKE $${tagParams.length}`; }

  const { rows: tagRows } = await pool.query(
    `SELECT t.id, t.name, COUNT(DISTINCT dt.document_id) AS doc_count
     FROM tags t
     JOIN document_tags dt ON dt.tag_id = t.id
     JOIN documents d ON d.id = dt.document_id AND ${tagWhere}
     GROUP BY t.id, t.name
     ORDER BY doc_count DESC
     LIMIT $${tagParams.length + 1}`,
    [...tagParams, Math.min(limit, 50)]
  );

  // ── Edges: university → tag ───────────────────────────────────────────────
  const { rows: edgeRows } = await pool.query(
    `SELECT fac.university_id, dt.tag_id, COUNT(*) AS weight
     FROM document_tags dt
     JOIN documents d ON d.id = dt.document_id AND d.deleted_at IS NULL AND d.is_published = true
     JOIN users u ON u.id = d.uploader_id AND u.deleted_at IS NULL
     JOIN departments dep ON dep.id = u.department_id
     JOIN faculties fac ON fac.id = dep.faculty_id
     GROUP BY fac.university_id, dt.tag_id
     HAVING COUNT(*) > 0
     ORDER BY weight DESC
     LIMIT 500`
  );

  const nodes = [
    ...uniRows.map(r => ({ id: r.id, type: 'university', label: r.name, state: r.state, uniType: r.type, docCount: parseInt(r.doc_count), researcherCount: parseInt(r.researcher_count) })),
    ...tagRows.map(r => ({ id: r.id, type: 'tag',        label: r.name, docCount: parseInt(r.doc_count) })),
  ];

  const edges = edgeRows.map(r => ({
    source: r.university_id,
    target: r.tag_id,
    type:   'university_tag',
    weight: parseInt(r.weight),
  }));

  return { nodes, edges, stats: { universities: uniRows.length, tags: tagRows.length, edges: edgeRows.length } };
}

// ─────────────────────────────────────────────────────────────────────────────
// findCollaborators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Suggest researchers who share the most tags with the given user.
 *
 * @param {string} userId
 * @param {number} limit
 */
async function findCollaborators(userId, limit = 10) {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.bio,
            dep.name AS department_name,
            uni.name AS university_name,
            COUNT(DISTINCT dt2.tag_id) AS shared_tag_count,
            array_agg(DISTINCT t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL) AS shared_tags
     FROM users u
     JOIN documents d2   ON d2.uploader_id = u.id   AND d2.deleted_at IS NULL AND d2.is_published = true
     JOIN document_tags dt2 ON dt2.document_id = d2.id
     JOIN document_tags dt1 ON dt1.tag_id = dt2.tag_id
     JOIN documents d1   ON d1.id = dt1.document_id AND d1.uploader_id = $1
     JOIN tags t         ON t.id  = dt2.tag_id
     LEFT JOIN departments dep ON dep.id = u.department_id
     LEFT JOIN faculties   fac ON fac.id = dep.faculty_id
     LEFT JOIN universities uni ON uni.id = fac.university_id
     WHERE u.id != $1 AND u.deleted_at IS NULL AND u.status = 'active'
     GROUP BY u.id, u.full_name, u.bio, dep.name, uni.name
     ORDER BY shared_tag_count DESC
     LIMIT $2`,
    [userId, parseInt(limit)]
  );

  return rows.map(r => ({
    ...r,
    shared_tag_count: parseInt(r.shared_tag_count),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// getTopResearchers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return top researchers ranked by total citations, optionally scoped to a
 * tag name or university.
 *
 * @param {{ tagName?: string, universityId?: string, limit?: number }} opts
 */
async function getTopResearchers({ tagName, universityId, limit = 20 } = {}) {
  const params = [];
  const joins  = [];
  const where  = ['u.deleted_at IS NULL', 'u.status = \'active\'', 'd.deleted_at IS NULL', 'd.is_published = true'];

  if (tagName) {
    params.push(`%${tagName}%`);
    joins.push(`JOIN document_tags dt ON dt.document_id = d.id`);
    joins.push(`JOIN tags t ON t.id = dt.tag_id AND t.name ILIKE $${params.length}`);
  }
  if (universityId) {
    params.push(universityId);
    joins.push(`JOIN departments dep2 ON dep2.id = u.department_id`);
    joins.push(`JOIN faculties fac2 ON fac2.id = dep2.faculty_id AND fac2.university_id = $${params.length}`);
  }

  params.push(parseInt(limit));

  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.bio, u.orcid_id,
            dep.name AS department_name,
            uni.name AS university_name,
            COUNT(DISTINCT d.id)           AS doc_count,
            COALESCE(SUM(d.citation_count), 0) AS total_citations,
            COALESCE(AVG(d.average_peer_rating) FILTER (WHERE d.average_peer_rating IS NOT NULL), 0) AS avg_rating
     FROM users u
     JOIN documents d ON d.uploader_id = u.id
     ${joins.join('\n     ')}
     LEFT JOIN departments dep ON dep.id = u.department_id
     LEFT JOIN faculties   fac ON fac.id = dep.faculty_id
     LEFT JOIN universities uni ON uni.id = fac.university_id
     WHERE ${where.join(' AND ')}
     GROUP BY u.id, u.full_name, u.bio, u.orcid_id, dep.name, uni.name
     ORDER BY total_citations DESC, doc_count DESC
     LIMIT $${params.length}`,
    params
  );

  return rows.map((r, i) => ({
    rank:             i + 1,
    id:               r.id,
    full_name:        r.full_name,
    bio:              r.bio,
    orcid_id:         r.orcid_id,
    department_name:  r.department_name,
    university_name:  r.university_name,
    doc_count:        parseInt(r.doc_count),
    total_citations:  parseInt(r.total_citations),
    avg_rating:       parseFloat(parseFloat(r.avg_rating).toFixed(2)),
  }));
}

module.exports = { getNationalResearchMap, findCollaborators, getTopResearchers };
