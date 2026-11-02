// brightside-sync: เก็บ "ข้อมูลที่เข้ารหัสแล้ว" หนึ่งก้อนต่อหนึ่งรหัสเชื่อม
// เซิร์ฟเวอร์ไม่เห็นรหัสเชื่อมและไม่มีกุญแจถอดรหัส · สิทธิ์ = token ที่คำนวณจากรหัสเชื่อมฝั่งแอป
const ORIGINS = ['https://kasdx92389.github.io', 'http://localhost:5173', 'http://localhost:4173', 'http://localhost:4179']
const MAX_BODY = 1_500_000
const HEX64 = /^[0-9a-f]{64}$/

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || ''
    const cors = {
      'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    }
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'content-type': 'application/json', 'cache-control': 'no-store' } })
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const id = new URL(req.url).pathname.match(/^\/s\/([0-9a-f]{64})$/)?.[1]
    const token = (req.headers.get('authorization') || '').replace(/^Bearer /, '')
    if (!id || !HEX64.test(token)) return json({ error: 'bad request' }, 400)

    const th = await sha256(token)
    const row = await env.DB.prepare('SELECT th, rev, data FROM s WHERE id = ?').bind(id).first()
    if (row && row.th !== th) return json({ error: 'forbidden' }, 403)

    if (req.method === 'GET') return row ? json({ rev: row.rev, data: row.data }) : json({ error: 'not found' }, 404)

    if (req.method === 'DELETE') {
      if (row) await env.DB.prepare('DELETE FROM s WHERE id = ?').bind(id).run()
      return json({ ok: true })
    }

    if (req.method === 'PUT') {
      const text = await req.text()
      if (text.length > MAX_BODY) return json({ error: 'too large' }, 413)
      let body
      try { body = JSON.parse(text) } catch { return json({ error: 'bad json' }, 400) }
      if (typeof body.data !== 'string' || !Number.isInteger(body.baseRev) || body.baseRev < 0) return json({ error: 'bad body' }, 400)
      const now = Date.now()

      if (!row) {
        if (body.baseRev !== 0) return json({ error: 'not found' }, 404)
        const r = await env.DB.prepare('INSERT OR IGNORE INTO s (id, th, rev, data, at) VALUES (?, ?, 1, ?, ?)').bind(id, th, body.data, now).run()
        if (r.meta.changes === 1) return json({ rev: 1 })
      } else {
        // เขียนได้เมื่อรุ่นตรงกับที่ฝั่งแอปเห็นล่าสุดเท่านั้น (compare-and-set)
        const r = await env.DB.prepare('UPDATE s SET data = ?, rev = rev + 1, at = ? WHERE id = ? AND rev = ?').bind(body.data, now, id, body.baseRev).run()
        if (r.meta.changes === 1) return json({ rev: body.baseRev + 1 })
      }
      const cur = await env.DB.prepare('SELECT rev, data FROM s WHERE id = ?').bind(id).first()
      return json({ error: 'conflict', rev: cur.rev, data: cur.data }, 409)
    }
    return json({ error: 'method not allowed' }, 405)
  },
}
