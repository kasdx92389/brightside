// แทนที่ service worker ของแอปเดิมบน github.io (แบบ stale-while-revalidate ที่ค้างอยู่ในมือถือ):
// ล้างแคชเก่า โหลดทุกหน้าที่เปิดอยู่ซ้ำ แล้วเลิกลงทะเบียนตัวเอง
// โหลดซ้ำจะไปดึงหน้าเด้ง (index.html ใหม่) จากเครือข่าย ซึ่งพาไป brightside.sudomont.com อีกที
// (client.navigate() สั่งได้เฉพาะ URL ในโดเมนเดียวกัน จึงเด้งข้ามโดเมนจากตรงนี้ไม่ได้)
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  await Promise.all((await caches.keys()).map((k) => caches.delete(k)))
  const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  // โหลดซ้ำก่อนเลิกลงทะเบียน: หน้าที่หลุดจากการควบคุมแล้วจะ navigate ไม่ได้
  await Promise.all(pages.map((c) => c.navigate(c.url).catch(() => {})))
  await self.registration.unregister()
})()))
