CREATE TABLE IF NOT EXISTS s (
  id   TEXT PRIMARY KEY,      -- sha256 ของรหัสเชื่อม (เดารหัสจาก id ไม่ได้)
  th   TEXT NOT NULL,         -- sha256 ของ token (ใช้ยืนยันสิทธิ์ ไม่เก็บ token ตรงๆ)
  rev  INTEGER NOT NULL,      -- เลขรุ่น ใช้กันเขียนทับกันตอนสองเครื่องซิงก์พร้อมกัน
  data TEXT NOT NULL,         -- ข้อมูลที่เข้ารหัสจากฝั่งแอปแล้ว เซิร์ฟเวอร์อ่านไม่ออก
  at   INTEGER NOT NULL
);
