import { useSyncExternalStore } from 'react'
import { getState, replaceState, onLocalChange } from '../store.js'
import { merge, stampAll } from './merge.js'
import { syncOnce, peek, newSecret, validSecret, deleteCloud, SyncError } from './syncCore.js'

// ที่อยู่ Worker ตั้งตอน build: VITE_SYNC_URL=https://….workers.dev  (ว่าง = ซ่อนฟีเจอร์ซิงก์ทั้งหมด)
export const SYNC_URL = (import.meta.env.VITE_SYNC_URL || '').replace(/\/$/, '')

const KEY = 'brightside:sync' // { secret, last } — รหัสเชื่อมอยู่ในเครื่องนี้เท่านั้น
const cfg = () => { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } }
const save = (c) => localStorage.setItem(KEY, JSON.stringify(c))

let status = { linked: !!cfg(), busy: false, last: cfg()?.last ?? null, error: '' }
const subs = new Set()
const set = (p) => { status = { ...status, ...p }; subs.forEach((f) => f()) }
export const useSync = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => status)
export const getSecret = () => cfg()?.secret ?? ''
export const joinUrl = (secret) => `${location.origin}${location.pathname}#/sync/${secret}`

let running = false, again = false, timer, knownRev = null, dirty = false
const schedule = (ms = 1000) => { clearTimeout(timer); timer = setTimeout(() => runSync().catch(() => {}), ms) }

/** ซิงก์หนึ่งรอบ · mustExist = ตอนเชื่อมเครื่องใหม่ ต้องมีรหัสนี้บนคลาวด์อยู่แล้ว */
export async function runSync({ mustExist = false } = {}) {
  const c = cfg()
  if (!c || !SYNC_URL) return
  if (running) { again = true; return }
  running = true
  set({ busy: true, error: '' })
  dirty = false
  try {
    const before = getState()
    const { state, rev } = await syncOnce({ url: SYNC_URL, secret: c.secret, local: before, mustExist })
    // ผู้ใช้อาจแก้ข้อมูลระหว่างรอเครือข่าย → รวมกับค่าล่าสุดอีกครั้ง (merge ซ้ำได้ ไม่เสียอะไร)
    const now = getState()
    const next = now === before ? state : merge(now, state)
    if (JSON.stringify(next) !== JSON.stringify(now)) replaceState(next)
    knownRev = rev
    const last = Date.now()
    save({ ...c, last })
    set({ last })
  } catch (e) {
    dirty = true // ลองใหม่ในรอบเช็กถัดไป
    set({ error: e instanceof SyncError ? e.message : 'ซิงก์ไม่สำเร็จ' })
    throw e
  } finally {
    running = false
    set({ busy: false })
    if (again) { again = false; schedule(0) }
  }
}

const clear = () => { localStorage.removeItem(KEY); knownRev = null; set({ linked: false, last: null, error: '' }) }

/** เครื่องแรก: สร้างรหัสเชื่อมและส่งข้อมูลขึ้นไป · ข้อมูลของเครื่องนี้ชนะข้อมูลเก่าที่ชนกันตอนเชื่อมครั้งแรก */
export async function createLink() {
  const secret = newSecret()
  replaceState(stampAll(getState()))
  save({ secret, last: null })
  set({ linked: true })
  try { await runSync() } catch (e) { clear(); throw e }
  return secret
}

/** เครื่องที่สอง: ใส่รหัสจากเครื่องแรก (ถ้ารหัสผิด/ไม่พบ จะไม่สร้างอะไรบนคลาวด์) */
export async function joinLink(secret) {
  secret = secret.trim().split(/[/#\s]/).filter(Boolean).pop() || ''
  if (!validSecret(secret)) throw new SyncError('bad', 'รหัสเชื่อมไม่ถูกต้อง ต้องยาว 43 ตัวอักษร')
  save({ secret, last: null })
  set({ linked: true })
  try { await runSync({ mustExist: true }) } catch (e) { clear(); throw e }
}

export const unlink = clear // ข้อมูลในเครื่องนี้ยังอยู่ ข้อมูลบนคลาวด์ยังอยู่
export async function unlinkAndDeleteCloud() {
  await deleteCloud({ url: SYNC_URL, secret: getSecret() })
  clear()
}

let started = false
/** เรียกครั้งเดียวตอนเปิดแอป */
export function startSync() {
  if (started || !SYNC_URL) return
  started = true
  onLocalChange(() => cfg() && ((dirty = true), schedule()))
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && cfg() && schedule(500))
  addEventListener('online', () => cfg() && schedule(500))
  // ใกล้เรียลไทม์: ทุก 5 วินาทีที่แอปเปิดอยู่ ถามแค่เลขรุ่นบนคลาวด์ (เบา) · เปลี่ยนเมื่อไหร่ค่อยซิงก์เต็มรอบ
  setInterval(async () => {
    if (document.visibilityState !== 'visible' || !cfg() || running || !navigator.onLine) return
    try {
      if (dirty || knownRev === null || await peek({ url: SYNC_URL, secret: cfg().secret, rev: knownRev })) await runSync()
    } catch { /* เงียบ: รอบหน้าลองใหม่ */ }
  }, 5000)
  if (cfg()) schedule(300)
}
