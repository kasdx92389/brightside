// ดึงรูปท่าจาก free-exercise-db (Unlicense) ลง public/ex — รันซ้ำได้ ข้ามไฟล์ที่มีแล้ว
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs'

const src = readFileSync(new URL('../src/data/exercises.js', import.meta.url), 'utf8')
const ids = [...src.matchAll(/^\s*E\('[^']+', '([^']+)'/gm)].map((m) => m[1])
const RAW = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'
let fail = 0
await Promise.all(ids.flatMap((id) => [0, 1].map(async (n) => {
  const out = new URL(`../public/ex/${id}/${n}.jpg`, import.meta.url)
  if (existsSync(out)) return
  const r = await fetch(`${RAW}${id}/${n}.jpg`)
  if (!r.ok) { fail++; console.error('FAIL', id, n, r.status); return }
  mkdirSync(new URL('.', out), { recursive: true })
  writeFileSync(out, Buffer.from(await r.arrayBuffer()))
})))
console.log(`${ids.length} exercises, ${fail} failed`)
