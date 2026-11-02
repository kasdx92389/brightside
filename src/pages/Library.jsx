import { useMemo, useState } from 'react'
import { Search, Heart } from 'lucide-react'
import { EXERCISES, GROUPS, LEVELS, EQUIP, byId } from '../data/exercises.js'
import { Media, Seg } from '../components/ui.jsx'
import ExerciseSheet from '../components/ExerciseSheet.jsx'
import { useStore, toggleFav } from '../store.js'

const norm = (s) => s.toLowerCase().replace(/\s+/g, '')

/** คลัง: ท่าทั้งหมดตั้งแต่เบสิกถึงมืออาชีพ · onPick = โหมดเลือกท่าสำหรับเพิ่มลงโปรแกรม */
export default function Library({ openId, onPick, toast }) {
  const [q, setQ] = useState('')
  const [lv, setLv] = useState(0)
  const [g, setG] = useState('')
  const [eq, setEq] = useState('')
  const [onlyFav, setOnlyFav] = useState(false)
  const favs = useStore((s) => s.favs)

  const list = useMemo(() => {
    const n = norm(q)
    return EXERCISES.filter((e) =>
      (!lv || e.lv === lv) && (!g || e.g === g) && (!eq || e.eq === eq) && (!onlyFav || favs.includes(e.id)) &&
      (!n || norm(`${e.th}${e.en}${e.m}`).includes(n)))
  }, [q, lv, g, eq, onlyFav, favs])

  const active = lv || g || eq || q || onlyFav
  const clear = () => { setQ(''); setLv(0); setG(''); setEq(''); setOnlyFav(false) }

  return (
    <div className={onPick ? 'col' : 'page wide'}>
      {!onPick && (
        <header className="page-head">
          <div><span className="eyebrow">{EXERCISES.length} ท่า</span><h1>คลัง</h1></div>
        </header>
      )}
      <div className="search">
        <Search aria-hidden="true" />
        <input className="input" type="search" placeholder="ค้นหาท่า กล้ามเนื้อ หรือชื่ออังกฤษ" aria-label="ค้นหาท่า" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Seg label="ระดับ" value={lv} onChange={setLv} options={[[0, 'ทั้งหมด'], ...LEVELS]} />

      <div className="gtiles" role="group" aria-label="กลุ่มกล้ามเนื้อ">
        {GROUPS.map(([k, t]) => (
          <button key={k} className="gtile" aria-pressed={g === k} onClick={() => setG(g === k ? '' : k)}>{t}</button>
        ))}
      </div>

      <div className="row between wrap">
        <p className="mute sm grow" role="status">พบ {list.length} ท่า{active && <button className="link" onClick={clear}>ล้างตัวกรอง</button>}</p>
        <button className="btn sm grow-0" aria-pressed={onlyFav} onClick={() => setOnlyFav(!onlyFav)} style={onlyFav ? { borderColor: 'var(--pri)', background: 'var(--pri-soft)' } : undefined}><Heart fill={onlyFav ? 'currentColor' : 'none'} /> โปรด{favs.length ? ` ${favs.length}` : ''}</button>
        <select className="input sel" aria-label="อุปกรณ์" value={eq} onChange={(e) => setEq(e.target.value)}>
          <option value="">อุปกรณ์: ทั้งหมด</option>
          {Object.entries(EQUIP).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
      </div>
      {list.length ? (
        <div className="lib-grid">
          {list.map((e) => {
            const body = (
              <>
                <div className="thumbbox">
                  <Media ex={e} />
                  <span className={`lvl l${e.lv}`}><i /><i /><i />{LEVELS[e.lv - 1][1]}</span>
                </div>
                <div className="body">
                  <b className="title">{e.th}</b>
                  <span className="target"><span className="mute">ฝึก</span> {e.m.split(' · ').slice(0, 2).join(' · ')}</span>
                  <div className="foot">
                    <span>{EQUIP[e.eq]}</span>
                    <span className="num">{e.rx.replace('ต่อข้าง', '/ข้าง').replace('วินาที', 'วิ').replace('เมตร', 'ม.')}</span>
                  </div>
                </div>
              </>
            )
            const on = favs.includes(e.id)
            return (
              <div className="cardwrap" key={e.id}>
                {onPick ? <button className="excard" onClick={() => onPick(e)}>{body}</button> : <a className="excard" href={`#/lib/${e.id}`}>{body}</a>}
                <button className="fav" aria-pressed={on} aria-label={`${on ? 'เลิกบันทึก' : 'บันทึกเป็นท่าโปรด'} ${e.th}`} onClick={() => toggleFav(e.id)}><Heart fill={on ? 'currentColor' : 'none'} /></button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center' }}>
          <p>{onlyFav && !favs.length ? 'ยังไม่มีท่าโปรด กดรูปหัวใจที่การ์ดท่าเพื่อบันทึก' : 'ไม่พบท่าที่ตรงกับตัวกรอง'}</p>
          <button className="btn sm" style={{ marginTop: '0.75rem' }} onClick={clear}>ล้างตัวกรอง</button>
        </div>
      )}
      {!onPick && <ExerciseSheet ex={byId[openId]} toast={toast} onClose={() => (location.hash = '#/lib')} />}
    </div>
  )
}
