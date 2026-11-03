import { Component } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import { applyTextScale } from './lib/ui.js'

applyTextScale()
try { sessionStorage.removeItem('bs-reload') } catch { /* ไม่มี sessionStorage */ }

class Boundary extends Component {
  state = { err: null }
  static getDerivedStateFromError(err) { return { err } }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <main className="crash">
        <h1>มีบางอย่างผิดพลาด</h1>
        <p className="mute">ข้อมูลของคุณยังอยู่ในเครื่อง ลองโหลดหน้าใหม่ ถ้ายังไม่หายให้สำรองข้อมูลแล้วล้างค่า</p>
        <button className="btn pri" onClick={() => location.reload()}>โหลดใหม่</button>
        <button className="btn ghost" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([localStorage.getItem('brightside:v1') || '{}'])); a.download = 'brightside-backup.json'; a.click() }}>ดาวน์โหลดข้อมูลสำรอง</button>
      </main>
    )
  }
}

createRoot(document.getElementById('root')).render(<Boundary><App /></Boundary>)

// ใช้งานออฟไลน์ (เฉพาะ production)
if (import.meta.env.PROD && 'serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
