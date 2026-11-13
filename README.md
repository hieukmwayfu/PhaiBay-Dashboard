# PhaiBay Dashboard

Dashboard cho PhaiBay Analytics — React + Vite + TypeScript + Tailwind CSS + Recharts.

Tính năng: tổng quan (users, new users, sessions, events), danh sách events + chi tiết param, Explore (metric × breakdown), Funnel, DebugView realtime, quản lý app (app key cố định, có thể là package name). Filter theo ngày, app version, country, platform, OS, device, ngôn ngữ, event param và user property.

## AI phân tích (tab "AI phân tích" trong mỗi app)

- **Đăng nhập OpenRouter** (OAuth PKCE): ai đăng nhập tài khoản nào thì dùng credit / giới hạn của tài khoản đó; chọn được GPT, Claude, Gemini… (chỉ hiện model hỗ trợ gọi tool). Key chỉ lưu trong trình duyệt (`localStorage`), không qua server PhaiBay.
- AI có các tool **chỉ đọc** (`src/lib/aiTools.ts`): `list_apps`, `get_overview`, `list_events`, `list_params`, `get_breakdown`, `get_timeseries`, `get_funnel`, `get_recent_events`. Tool chạy trong trình duyệt, gọi API PhaiBay bằng phiên đăng nhập dashboard, mặc định theo app + khoảng ngày + bộ lọc đang chọn.
- Nút **Phân tích ngay** và các câu hỏi mẫu; hiện tool đã gọi, chi phí mỗi câu trả lời, credit còn lại.
- Callback đăng nhập là chính URL trang (localhost hoặc HTTPS), không cần cấu hình gì trên OpenRouter.
- Lưu ý: số liệu AI đọc được gửi tới OpenRouter và nhà cung cấp model đã chọn.

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
