/** ไอคอนไฟ streak: เปลวสองชั้น (ชั้นนอกใช้สีตามข้อความ ชั้นในสว่าง) — ใช้แทน Flame ของ lucide ที่เป็นเส้นบางๆ ไม่สวย */
export default function StreakIcon({ size = 24, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="streak-ico" {...rest}>
      <path fill="currentColor" d="M12.6 1.8c.5 3.3 4.7 5.3 5.5 9.9.5 2.9-.4 5.6-2.4 7.4-1 .9-2.3 1.5-3.7 1.5-3.2 0-5.8-2.5-5.8-5.7 0-2.3 1.1-4 2.4-5.2.2 1.3.9 2.2 1.8 2.6-.5-3.5-.2-7.4 2.2-10.5z" />
      <path fill="#fff" fillOpacity="0.92" d="M12 21c-2 0-3.5-1.5-3.5-3.4 0-1.6 1-2.6 1.9-3.6.4 1.1 1.1 1.6 1.8 1.9.2-1.4 1-2.3 1.8-3 .7 1.1 1.5 2.2 1.5 3.7 0 2.2-1.6 4.4-3.5 4.4z" />
    </svg>
  )
}
