# PhaiBay Dashboard

Dashboard cho PhaiBay Analytics — React + Vite + TypeScript + Tailwind CSS + Recharts.

Tính năng: tổng quan (users, new users, sessions, engagement), danh sách events + chi tiết param, Explore (metric × breakdown), Funnel, Retention cohort, DebugView realtime, quản lý app / API key, đổi mật khẩu admin. Filter theo ngày, app version, country, platform, OS, device, ngôn ngữ, event param và user property.

## Chạy local

```bash
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:8080
npm run dev               # http://localhost:5173
```

Đăng nhập bằng tài khoản admin của server.
Ô **Server** ở màn đăng nhập cho phép trỏ sang server khác mà không cần build lại.

## Deploy Vercel

1. Import repo vào Vercel (Framework: Vite — tự nhận).
2. Environment variable: `VITE_API_URL=https://analytics.your-domain.com`
3. Deploy. `vercel.json` đã có rewrite cho SPA routing.

> Vercel chạy HTTPS nên server PhaiBay **phải có HTTPS** (domain + reverse proxy như Caddy/Nginx, hoặc Cloudflare Tunnel), nếu không trình duyệt sẽ chặn (mixed content).
> Trên server có thể giới hạn origin: `PB_CORS_ORIGIN=https://your-dashboard.vercel.app`.

## Scripts

| Lệnh | |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + build ra `dist/` |
| `npm run preview` | Xem bản build |
