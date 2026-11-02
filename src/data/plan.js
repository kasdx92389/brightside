import { byId } from './exercises.js'

const t = (id, sets, reps) => ({ id, sets, reps })
const train = (name, focus, items) => ({ kind: 'train', name, focus, items })
const REST = { kind: 'rest', name: 'พัก', focus: 'พักผ่อนเต็มที่', items: [] }
const WALK = { kind: 'walk', name: 'พัก · เดิน', focus: 'เดินเร็วหรือกิจกรรมเบาๆ', items: [t('brisk-walk', 1, '40–60 นาที')] }
const TM = t('treadmill-intervals', 1, '20 นาที')

// ตารางของผู้ใช้ — PPL 5 วัน (จาก Artifact "ตารางฝึก PPL ฉบับปรับปรุง")
export const PPL = {
  name: 'PPL 5 วัน',
  source: 'ppl',
  days: [
    train('Push 1', 'อก ไหล่ หลังแขน', [t('db-bench-press', 3, '10–12'), t('db-shoulder-press', 3, '10–12'), t('triceps-pushdown', 3, '10–12'), t('pushup', 3, 'จนหมดแรง'), TM]),
    train('Pull 1', 'หลัง หน้าแขน', [t('lat-pulldown', 3, '10–12'), t('db-row', 3, '10–12'), t('db-curl', 3, '10–12'), t('hammer-curl', 3, '10–12'), t('face-pull', 3, '12–15'), TM]),
    train('Legs & Abs', 'ขา หน้าท้อง', [t('goblet-squat', 3, '10–12'), t('db-lunge', 3, '10–12'), t('lying-leg-raise', 3, '12–15'), t('crunch', 3, '12–15')]),
    train('Push 2', 'อกบน ไหล่ข้าง หลังแขน', [t('incline-db-press', 3, '10–12'), t('lateral-raise', 3, '12–15'), t('overhead-triceps-ext', 3, '10–12'), t('triceps-pushdown', 3, '12–15'), TM]),
    train('Pull 2 + RDL', 'หลัง หน้าแขน หลังขา', [t('vbar-pulldown', 3, '10–12'), t('db-row', 3, '10–12'), t('db-curl', 3, '10–12'), t('face-pull', 3, '12–15'), t('db-rdl', 3, '10–12'), TM]),
    WALK,
    REST,
  ],
}

// ───────── ตัวออกแบบโปรแกรมอัตโนมัติ ─────────
const ALLOWED = { gym: ['bw', 'db', 'bb', 'cable', 'machine'], db: ['bw', 'db'], home: ['bw'] }

// รายการเรียงตามความเหมาะสม — ตัวกรองอุปกรณ์/ระดับจะตัดที่ใช้ไม่ได้ออกเอง
const POOL = {
  chestPress: ['barbell-bench', 'db-bench-press', 'machine-chest-press', 'pushup', 'incline-pushup'],
  chestIncline: ['incline-db-press', 'cable-crossover', 'db-fly', 'incline-pushup', 'pushup'],
  shoulderPress: ['barbell-ohp', 'arnold-press', 'db-shoulder-press'],
  lateral: ['lateral-raise', 'reverse-fly', 'face-pull'],
  triceps: ['triceps-pushdown', 'close-grip-bench', 'overhead-triceps-ext', 'bench-dips', 'skullcrusher'],
  vertPull: ['pullup', 'lat-pulldown', 'vbar-pulldown', 'chinup', 'inverted-row'],
  horizPull: ['barbell-row', 'seated-cable-row', 'db-row', 'inverted-row', 'superman'],
  rearDelt: ['face-pull', 'reverse-fly', 'superman'],
  biceps: ['barbell-curl', 'db-curl', 'hammer-curl'],
  squat: ['barbell-squat', 'goblet-squat', 'leg-press', 'bodyweight-squat'],
  hinge: ['rdl-barbell', 'db-rdl', 'glute-bridge', 'hyperextension'],
  lunge: ['db-lunge', 'db-step-up', 'jump-squat', 'bodyweight-squat'],
  legIso: ['leg-curl', 'leg-extension', 'glute-bridge'],
  calves: ['calf-raise', 'jump-squat'],
  glute: ['hip-thrust', 'glute-bridge'],
  core1: ['crunch', 'cable-crunch', 'reverse-crunch', 'dead-bug'],
  core2: ['plank', 'lying-leg-raise', 'side-bridge', 'russian-twist'],
  proPush: ['plyo-pushup', 'push-press', 'handstand-pushup', 'single-arm-pushup'],
  proPull: ['muscle-up', 'barbell-deadlift'],
  proLegs: ['front-squat', 'sumo-deadlift', 'pistol-squat', 'overhead-squat'],
  proFull: ['power-clean', 'kettlebell-swing', 'farmers-walk'],
  cardio: ['treadmill-intervals', 'rope-jumping', 'brisk-walk'],
}

const DAY = {
  push: ['Push', 'อก ไหล่ หลังแขน', ['chestPress', 'chestIncline', 'shoulderPress', 'lateral', 'triceps', 'triceps'], 'proPush'],
  pull: ['Pull', 'หลัง หน้าแขน', ['vertPull', 'horizPull', 'rearDelt', 'biceps', 'biceps'], 'proPull'],
  legs: ['Legs', 'ขา ก้น หน้าท้อง', ['squat', 'hinge', 'lunge', 'legIso', 'calves', 'core2'], 'proLegs'],
  upper: ['Upper', 'ร่างกายส่วนบน', ['chestPress', 'horizPull', 'shoulderPress', 'vertPull', 'biceps', 'triceps'], 'proPush'],
  lower: ['Lower', 'ร่างกายส่วนล่าง', ['squat', 'hinge', 'glute', 'legIso', 'calves', 'core1'], 'proLegs'],
  fullA: ['Full Body A', 'ทั้งตัว', ['squat', 'chestPress', 'horizPull', 'shoulderPress', 'core1'], 'proFull'],
  fullB: ['Full Body B', 'ทั้งตัว', ['hinge', 'chestIncline', 'vertPull', 'lateral', 'core2'], 'proFull'],
}
const SPLIT = {
  3: { at: [0, 2, 4], seq: ['fullA', 'fullB', 'fullA'] },
  4: { at: [0, 1, 3, 4], seq: ['upper', 'lower', 'upper', 'lower'] },
  5: { at: [0, 1, 2, 3, 4], seq: ['push', 'pull', 'legs', 'upper', 'lower'] },
  6: { at: [0, 1, 2, 3, 4, 5], seq: ['push', 'pull', 'legs', 'push', 'pull', 'legs'] },
}

const timed = /วินาที|นาที|เมตร/
export function parseRx(rx) {
  const m = rx.match(/^(\d+)\s*×\s*(.+)$/)
  return m ? [Number(m[1]), m[2]] : [1, rx]
}

/** @param {{goal:'lose'|'fit'|'muscle', level:1|2|3, days:3|4|5|6, equip:'gym'|'db'|'home'}} o */
export function generatePlan({ goal, level, days, equip }) {
  const ok = (e) => ALLOWED[equip].includes(e.eq) && e.lv <= level
  const use = {} // จำนวนครั้งที่ใช้ท่าในสัปดาห์นี้ → สลับท่าเมื่อวันซ้ำ
  const pick = (pool, taken) => {
    const c = POOL[pool].map((id) => byId[id]).filter((e) => e && ok(e) && !taken.includes(e.id))
    if (!c.length) return null
    const e = c.reduce((a, b) => ((use[b.id] || 0) < (use[a.id] || 0) ? b : a))
    use[e.id] = (use[e.id] || 0) + 1
    return e
  }
  const volume = (e) => {
    if (timed.test(e.rx) || e.lv === 3) return parseRx(e.rx)
    const sets = goal === 'muscle' && e.k === 'c' && level >= 2 ? 4 : 3
    const reps = goal === 'lose' ? '12–15' : goal === 'fit' ? '10–12' : e.k === 'c' ? (level === 1 ? '8–12' : '6–10') : '10–15'
    return [sets, reps]
  }

  const { at, seq } = SPLIT[days]
  const cardioMin = level === 1 ? '15 นาที' : '20 นาที'
  const week = Array.from({ length: 7 }, (_, i) => {
    const s = at.indexOf(i)
    if (s < 0) return i === 6 || goal === 'muscle' ? REST : WALK
    const [name, focus, slots, pro] = DAY[seq[s]]
    const taken = []
    const items = (level === 3 ? [...slots, pro] : slots).flatMap((p) => {
      const e = pick(p, taken)
      if (!e) return []
      taken.push(e.id)
      return [t(e.id, ...volume(e))]
    })
    if (goal !== 'muscle') {
      const c = pick('cardio', taken)
      if (c) items.push(t(c.id, 1, cardioMin))
    }
    const same = seq.filter((x) => x === seq[s]).length
    const nth = seq.slice(0, s + 1).filter((x) => x === seq[s]).length
    return train(same > 1 && days !== 3 ? `${name} ${nth}` : name, focus, items)
  })
  const label = { lose: 'ลดไขมัน', fit: 'ฟิตทั่วไป', muscle: 'สร้างกล้ามเนื้อ' }[goal]
  return { name: `${days} วัน · ${label}`, source: 'generated', days: week }
}

export const minutesOf = (day) =>
  Math.round(day.items.reduce((s, it) => {
    const m = String(it.reps).match(/(\d+)(?:–(\d+))?\s*นาที/)
    return s + (m ? Number(m[2] || m[1]) : it.sets * 2.5)
  }, 0))

export const itemLabel = (it) => (it.sets > 1 || /^\d/.test(it.reps) && !/นาที/.test(it.reps) ? `${it.sets} × ${it.reps}` : it.reps)
