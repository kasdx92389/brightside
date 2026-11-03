// การตั้งค่าหน้าตาที่เก็บต่อเครื่อง (ไม่ซิงก์ข้ามเครื่อง เพราะแต่ละหน้าจอต้องการขนาดต่างกัน)
const KEY = 'brightside:ui'
export const TEXT_SCALES = [[100, 'ปกติ'], [115, 'ใหญ่'], [130, 'ใหญ่มาก']]
export const getTextScale = () => {
  try { const v = Number(JSON.parse(localStorage.getItem(KEY))?.scale); return TEXT_SCALES.some(([s]) => s === v) ? v : 100 } catch { return 100 }
}
export const applyTextScale = (v = getTextScale()) => { document.documentElement.style.fontSize = v + '%' }
export const setTextScale = (v) => {
  try { localStorage.setItem(KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(KEY) || '{}'), scale: v })) } catch { /* โหมดส่วนตัว: ใช้เฉพาะรอบนี้ */ }
  applyTextScale(v)
}

// วิธีใส่ปริมาณอาหาร: 'u' ตามหน่วย · 'g' ชั่งเป็นกรัม (คนมีเครื่องชั่งจะได้เปิดเป็นกรัมทุกครั้ง)
export const getWeighMode = () => {
  try { return JSON.parse(localStorage.getItem(KEY))?.weigh === 'g' ? 'g' : 'u' } catch { return 'u' }
}
export const setWeighMode = (m) => {
  try { localStorage.setItem(KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(KEY) || '{}'), weigh: m })) } catch { /* ใช้เฉพาะรอบนี้ */ }
}
