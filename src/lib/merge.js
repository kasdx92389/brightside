// รวมข้อมูลสองเครื่องทีละรายการ (ไม่ทับทั้งก้อน)
// state.mod = { 'profile': ts, 'plan': ts, 'favs': ts, 'deloadUntil': ts, 'logs/2026-11-02': ts, 'w/<date>': ts, 'm/<date>': ts }
// ทุกรายการเลือกฝั่งที่ ts ใหม่กว่า · ถ้ารายการนั้นถูกลบ ts ใหม่กว่าจะชนะและรายการหายไป (ไม่ต้องมี tombstone แยก)
// ข้อมูลเก่าก่อนมีระบบซิงก์ไม่มี ts (=0): ถ้าฝั่งใดฝั่งหนึ่งมีก็เอา (union) ถ้าชนกันให้ฝั่ง a (เครื่องนี้) ก่อน

const SCALARS = ['profile', 'plan', 'favs', 'myFoods', 'deloadUntil']
const has = (v) => v !== undefined && v !== null

/** ใส่ ts ให้ทุกรายการที่ต่างจากเดิม — เรียกทุกครั้งที่ state เปลี่ยนโดยผู้ใช้ */
export function stamp(a, b, now = Date.now()) {
  if (a === b) return b
  const mod = { ...(b.mod ?? a.mod) }
  for (const k of SCALARS) if (a[k] !== b[k]) mod[k] = now
  for (const d of new Set([...Object.keys(a.logs), ...Object.keys(b.logs)])) if (a.logs[d] !== b.logs[d]) mod['logs/' + d] = now
  for (const [pre, key] of [['w/', 'weights'], ['m/', 'measures']]) {
    const A = new Map(a[key].map((x) => [x.date, x])), B = new Map(b[key].map((x) => [x.date, x]))
    for (const d of new Set([...A.keys(), ...B.keys()])) if (A.get(d) !== B.get(d)) mod[pre + d] = now
  }
  return { ...b, mod }
}

/** ใส่ ts ให้ข้อมูลเดิมทั้งหมด (ตอนสร้างรหัสเชื่อม: เครื่องนี้ชนะข้อมูลเก่าที่ไม่มี ts) */
export function stampAll(s, now = Date.now()) {
  const mod = { ...s.mod }
  for (const k of SCALARS) if (has(s[k])) mod[k] = mod[k] || now
  for (const d of Object.keys(s.logs)) mod['logs/' + d] = mod['logs/' + d] || now
  for (const x of s.weights) mod['w/' + x.date] = mod['w/' + x.date] || now
  for (const x of s.measures) mod['m/' + x.date] = mod['m/' + x.date] || now
  return { ...s, mod }
}

const pick = (key, a, b, getA, getB) => {
  const ta = a.mod?.[key] ?? 0, tb = b.mod?.[key] ?? 0
  if (tb > ta) return { v: getB(), t: tb }
  if (ta > tb) return { v: getA(), t: ta }
  const va = getA()
  return { v: has(va) ? va : getB(), t: ta }
}

export function merge(a, b) {
  const mod = {}
  const out = { ...a, createdAt: [a.createdAt, b.createdAt].filter(Boolean).sort()[0] }
  for (const k of SCALARS) {
    const { v, t } = pick(k, a, b, () => a[k], () => b[k])
    out[k] = has(v) ? v : (k === 'favs' || k === 'myFoods' ? [] : null)
    if (t) mod[k] = t
  }
  const keyed = (pre, field, list) => {
    const dates = new Set([...list(a).map((x) => x.date), ...list(b).map((x) => x.date), ...Object.keys({ ...a.mod, ...b.mod }).filter((k) => k.startsWith(pre)).map((k) => k.slice(pre.length))])
    const get = (s, d) => list(s).find((x) => x.date === d)
    const res = []
    for (const d of dates) {
      const { v, t } = pick(pre + d, a, b, () => get(a, d), () => get(b, d))
      if (t) mod[pre + d] = t
      if (has(v)) res.push(v)
    }
    out[field] = res.sort((x, y) => x.date.localeCompare(y.date))
  }
  keyed('w/', 'weights', (s) => s.weights)
  keyed('m/', 'measures', (s) => s.measures)

  out.logs = {}
  const days = new Set([...Object.keys(a.logs), ...Object.keys(b.logs), ...Object.keys({ ...a.mod, ...b.mod }).filter((k) => k.startsWith('logs/')).map((k) => k.slice(5))])
  for (const d of days) {
    const { v, t } = pick('logs/' + d, a, b, () => a.logs[d], () => b.logs[d])
    if (t) mod['logs/' + d] = t
    if (has(v)) out.logs[d] = v
  }
  return { ...out, mod }
}
