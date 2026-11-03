import { useMemo, useState } from 'react'
import { Droplets, Beef, Zap, Wheat, Droplet, Plus, Minus, X, Search, Lightbulb } from 'lucide-react'
import { Seg } from './ui.jsx'
import { FOODS, FOOD_CATS, foodById } from '../data/foods.js'
import { targets, MEAL_SLOTS } from '../lib/calc.js'
import { addDays } from '../lib/coach.js'
import { patchFood, addFood, removeFood } from '../store.js'

const ML = 250 // 1 แก้ว
const PORTIONS = [[0.5, '½'], [1, '1'], [1.5, '1½'], [2, '2']]
const SLOTS = MEAL_SLOTS.map(([n], i) => [i, n])
const r1 = (v) => Math.round(v * 10) / 10
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const slotNow = () => { const h = new Date().getHours(); return h < 10 ? 0 : h < 15 ? 1 : h < 18 ? 3 : 2 }

/** อาหารที่ช่วยเติมโปรตีนที่ยังขาด โดยไม่เกินพลังงานที่เหลือ — เรียงตามโปรตีนต่อแคลอรี่ ไม่ซ้ำหมวด */
export function suggestFoods(remP, remK) {
  if (remP < 10) return []
  const seen = new Set()
  return FOODS.filter((f) => ['meat', 'dish', 'dairy', 'plant', 'meal'].includes(f.cat) && f.p >= 8 && f.p <= remP + 10 && f.k <= Math.max(150, remK))
    .sort((a, b) => b.p / b.k - a.p / a.k)
    .filter((f) => !seen.has(f.cat) && seen.add(f.cat))
    .slice(0, 3)
}

function Bar({ icon: Icon, label, value, goal, unit, over }) {
  const pct = goal ? value / goal : 0
  const cls = pct >= 1.1 && over ? 'over' : pct >= 1 ? 'full' : ''
  return (
    <div className="meter">
      <div className="row between">
        <span className="row" style={{ gap: '0.5rem' }}><Icon aria-hidden="true" /><b>{label}</b></span>
        <span className="mute sm"><b className="num" style={{ fontSize: '1.25rem', color: cls === 'over' ? 'var(--warn-fg)' : pct >= 1 ? 'var(--ok-fg)' : 'var(--text)' }}>{Math.round(value).toLocaleString()}</b> / {Math.round(goal).toLocaleString()} {unit}</span>
      </div>
      <div className="bar" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax={Math.round(goal)} aria-valuenow={Math.round(value)}><i style={{ width: `${clamp(pct, 0, 1) * 100}%` }} className={cls} /></div>
    </div>
  )
}

/** อาหารและน้ำของวัน: เป้ารายบุคคล · แตะเพิ่มอาหารได้เลย · แนะนำสิ่งที่ควรกินต่อ */
export default function FoodTracker({ date, log, logs, profile, train, isToday, toast }) {
  const t = targets(profile)
  const f = log?.food || {}
  const items = f.items || []
  const water = Number(f.water) || 0
  const wg = t.glasses(train)
  const proteinGoal = Math.round((t.protein[0] + t.protein[1]) / 2)
  const [slot, setSlot] = useState(slotNow)
  const [portion, setPortion] = useState(1)
  const [cat, setCat] = useState('recent')
  const [q, setQ] = useState('')
  const [custom, setCustom] = useState({ n: '', k: '', p: '', c: '', f: '' })

  const recents = useMemo(() => {
    const n = {}
    for (let i = 0; i < 14; i++) for (const it of logs[addDays(date, -i)]?.food?.items || []) n[it.id] = (n[it.id] || 0) + 1
    return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([id]) => foodById[id]).filter(Boolean).slice(0, 12)
  }, [logs, date])
  const tab = cat === 'recent' && !recents.length ? 'rice' : cat
  const key = q.trim().toLowerCase()
  const shown = key ? FOODS.filter((x) => x.n.toLowerCase().includes(key)) : tab === 'recent' ? recents : FOODS.filter((x) => x.cat === tab)

  const add = (food, qty = portion) => {
    addFood(date, { id: food.id, n: food.n, q: qty, s: slot, k: Math.round(food.k * qty), p: r1(food.p * qty), c: r1(food.c * qty), f: r1(food.f * qty) })
    toast?.(`เพิ่ม ${food.n}${qty !== 1 ? ` ×${qty}` : ''} แล้ว`)
  }
  const addCustom = () => {
    const v = (s) => Math.max(0, Number(s) || 0)
    if (!v(custom.k) || v(custom.k) > 5000) return toast?.('ใส่พลังงาน (kcal) 1–5,000')
    addFood(date, { id: 'custom', n: custom.n.trim() || 'อาหารกำหนดเอง', q: 1, s: slot, k: Math.round(v(custom.k)), p: r1(v(custom.p)), c: r1(v(custom.c)), f: r1(v(custom.f)) })
    setCustom({ n: '', k: '', p: '', c: '', f: '' })
    toast?.('เพิ่มอาหารแล้ว')
  }
  const drink = (ml) => patchFood(date, { water: Math.round(Math.max(0, water + ml / ML) * 100) / 100 })

  const remK = t.kcal - (f.kcal || 0), remP = proteinGoal - (f.protein || 0)
  const sugg = isToday ? suggestFoods(remP, remK) : []
  const h = new Date().getHours() + new Date().getMinutes() / 60
  const expected = wg * clamp((h - 7) / 14, 0, 1) // ควรดื่มทยอยตลอดวัน 07:00–21:00
  const pace = !isToday ? '' : water >= wg ? 'ดื่มครบเป้าแล้ว เก่งมาก' : expected - water >= 1
    ? `ตอนนี้ควรดื่มแล้วราว ${Math.round(expected * ML).toLocaleString()} มล. ตามอยู่ ${Math.round((expected - water) * ML)} มล. ดื่มสักแก้วเลย`
    : 'จังหวะดี ดื่มต่อเนื่องตลอดวัน อย่ารอจนกระหาย'

  return (
    <details className="card nutri" open={isToday}>
      <summary className="row between" style={{ cursor: 'pointer', minHeight: 44 }}>
        <h2>อาหารและน้ำ</h2>
        <span className="mute sm">{Math.round(water * ML).toLocaleString()}/{(wg * ML).toLocaleString()} มล. · {Math.round(f.kcal || 0).toLocaleString()}/{t.kcal.toLocaleString()} kcal</span>
      </summary>
      <div className="col" style={{ gap: '1.25rem', marginTop: '1rem' }}>
        <section className="col" style={{ gap: '0.5rem' }}>
          <Bar icon={Droplets} label="น้ำดื่ม" value={water * ML} goal={wg * ML} unit="มล." />
          <div className="drinks">
            <button className="btn sm" aria-label="ลดน้ำ 250 มล." onClick={() => drink(-ML)}><Minus /></button>
            {[250, 500, 600].map((ml) => <button key={ml} className="btn sm" onClick={() => drink(ml)}><Plus /> {ml}</button>)}
          </div>
          <p className="hint">{train ? `วันนี้วันฝึก เป้าน้ำ +500 มล. ดื่ม 400–600 มล. ก่อนฝึก 2 ชม. และจิบระหว่างฝึก · ` : ''}{pace}</p>
        </section>

        <section className="col" style={{ gap: '0.75rem' }}>
          <Bar icon={Zap} label="พลังงาน" value={f.kcal || 0} goal={t.kcal} unit="kcal" over />
          <Bar icon={Beef} label="โปรตีน" value={f.protein || 0} goal={proteinGoal} unit="g" />
          <Bar icon={Wheat} label="คาร์บ" value={f.carb || 0} goal={t.carb} unit="g" />
          <Bar icon={Droplet} label="ไขมัน" value={f.fat || 0} goal={t.fat} unit="g" over />
          <p className="hint">เหลือ {remK > 0 ? `${remK.toLocaleString()} kcal` : 'พลังงานเกินเป้าแล้ว'} · โปรตีนอีก {Math.max(0, remP)} g · เป้าของคุณคำนวณจาก BMI อายุ และเป้าหมาย (ดูรายละเอียดที่หน้า “ฉัน”)</p>
        </section>

        {sugg.length > 0 && (
          <section className="nudge sugg-box">
            <span className="row" style={{ gap: '0.5rem' }}><Lightbulb aria-hidden="true" /> <b>โปรตีนยังขาด {Math.max(0, remP)} g ลองกิน</b></span>
            <span className="sugg">
              {sugg.map((x) => <button key={x.id} className="btn sm" onClick={() => add(x, 1)}><span className="row" style={{ gap: '0.5rem' }}><Plus /> {x.n}</span><span className="mute">+{x.p} g</span></button>)}
            </span>
          </section>
        )}

        <section className="col" style={{ gap: '0.625rem' }}>
          <h3>เพิ่มอาหาร</h3>
          <Seg label="มื้อ" value={slot} onChange={setSlot} options={SLOTS} />
          <div className="row" style={{ gap: '0.5rem' }}>
            <span className="mute sm" style={{ flex: 'none' }}>ปริมาณ ×</span>
            <div className="grow"><Seg label="ปริมาณ" value={portion} onChange={setPortion} options={PORTIONS} /></div>
          </div>
          <div className="search">
            <Search aria-hidden="true" />
            <input className="input" type="search" placeholder="ค้นหาอาหาร เช่น ข้าวมันไก่" aria-label="ค้นหาอาหาร" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {!key && (
            <div className="chips" role="group" aria-label="หมวดอาหาร">
              {recents.length > 0 && <button aria-pressed={tab === 'recent'} onClick={() => setCat('recent')}>กินบ่อย</button>}
              {FOOD_CATS.map(([k, label]) => <button key={k} aria-pressed={tab === k} onClick={() => setCat(k)}>{label}</button>)}
            </div>
          )}
          <div className="foods">
            {shown.map((x) => (
              <button key={x.id} className="food" onClick={() => add(x)}>
                <b>{x.n}</b>
                <span className="mute xs">{x.u}</span>
                <span className="xs"><b className="num">{Math.round(x.k * portion)}</b> kcal · P {r1(x.p * portion)}</span>
              </button>
            ))}
            {!shown.length && <p className="mute sm">ไม่พบอาหาร ลองกรอกเองด้านล่าง</p>}
          </div>
          <details>
            <summary className="more">กรอกเอง (ฉลากอาหาร / เมนูอื่น)</summary>
            <div className="col" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
              <input className="input" placeholder="ชื่ออาหาร" aria-label="ชื่ออาหาร" value={custom.n} onChange={(e) => setCustom({ ...custom, n: e.target.value })} maxLength={40} />
              <div className="two">
                {[['k', 'พลังงาน (kcal)'], ['p', 'โปรตีน (g)'], ['c', 'คาร์บ (g)'], ['f', 'ไขมัน (g)']].map(([k, label]) => (
                  <input key={k} className="input" type="number" inputMode="decimal" min="0" placeholder={label} aria-label={label} value={custom[k]} onChange={(e) => setCustom({ ...custom, [k]: e.target.value })} />
                ))}
              </div>
              <button className="btn sm" onClick={addCustom}><Plus /> เพิ่ม</button>
            </div>
          </details>
        </section>

        <section className="col" style={{ gap: '0.5rem' }}>
          <h3>กินไปแล้ววันนี้</h3>
          {items.length === 0 && <p className="mute sm">ยังไม่ได้บันทึก แตะอาหารด้านบนเพื่อเพิ่ม</p>}
          {MEAL_SLOTS.map(([name], si) => {
            const rows = items.map((it, i) => [it, i]).filter(([it]) => (it.s ?? 1) === si)
            if (!rows.length) return null
            return (
              <div key={name} className="col" style={{ gap: '0.25rem' }}>
                <div className="row between"><b>{name}</b><span className="mute xs">{rows.reduce((n, [it]) => n + it.k, 0)} kcal · P {r1(rows.reduce((n, [it]) => n + it.p, 0))} g</span></div>
                {rows.map(([it, i]) => (
                  <div key={i} className="row between sm" style={{ minHeight: 40 }}>
                    <span className="grow">{it.n}{it.q !== 1 && <span className="mute"> ×{it.q}</span>}</span>
                    <span className="mute xs">{it.k} kcal · P {it.p}</span>
                    <button className="icon-btn" aria-label={`ลบ ${it.n}`} onClick={() => removeFood(date, i)}><X /></button>
                  </div>
                ))}
              </div>
            )
          })}
          <p className="hint">ค่าสารอาหารเป็นค่าประมาณต่อหน่วยบริโภคทั่วไป ปริมาณจริงต่างกันได้ ใช้เป็นแนวทาง ไม่ต้องแม่นทุกกรัม ขอให้ใกล้เคียงและสม่ำเสมอ</p>
        </section>
      </div>
    </details>
  )
}
