// Read-only tools the AI can call to fetch PhaiBay data. They run in the browser and call the
// PhaiBay API with the dashboard session, so the model only ever sees what this user can see.
import { api, appsSummary, type Query } from "./api";
import type { ToolDef } from "./openrouter";

export interface ToolCtx {
  appId: number;
  appName: string;
  appKey: string;
  from: string;
  to: string;
  /** current dashboard filters as API query params (country=VN, p.level=gte:5, ...) */
  filters: Query;
}

const DATE = { type: "string", description: "YYYY-MM-DD. Mặc định: khoảng ngày đang chọn trên dashboard." };
const FILTERS = {
  type: "object",
  description:
    "Bộ lọc (tuỳ chọn), ghi đè bộ lọc đang chọn. Key: event, version, country, platform, os, device, lang " +
    "(nhiều giá trị cách nhau dấu phẩy, '(not set)' = rỗng), 'p.<param>' cho event param, 'u.<prop>' cho user property. " +
    "Giá trị param có thể kèm toán tử: 'eq:', 'ne:', 'gt:', 'gte:', 'lt:', 'lte:', 'contains:' (vd {\"p.level\":\"gte:10\"}).",
  additionalProperties: { type: "string" },
};
const DIM =
  "Chiều phân tích: event, version, country, platform, os, device, lang, day, 'p.<param>' (event param), 'u.<prop>' (user property).";
const METRIC = "count (số event, mặc định), users (user duy nhất), sessions, sum:<param>, avg:<param>, min:<param>, max:<param>.";

interface Tool {
  def: ToolDef;
  run: (a: Record<string, unknown>, c: ToolCtx) => Promise<unknown>;
}

const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []): ToolDef => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});

function base(a: Record<string, unknown>, c: ToolCtx): Query {
  const q: Query = { app: c.appId, from: (a.from as string) || c.from, to: (a.to as string) || c.to };
  const f = (a.filters as Record<string, string> | undefined) ?? c.filters;
  for (const [k, v] of Object.entries(f ?? {})) if (v != null && v !== "") q[k] = v as string;
  return q;
}

const TOOLS: Tool[] = [
  {
    def: fn("list_apps", "Danh sách mọi app kèm users, user mới, sessions, events, users theo ngày và thời điểm event gần nhất trong khoảng ngày.", { from: DATE, to: DATE }),
    run: async (a, c) => {
      const r = await appsSummary((a.from as string) || c.from, (a.to as string) || c.to);
      return { ...r, apps: r.apps.map((x) => ({ ...x, last_event_at: x.last_event_at ? new Date(x.last_event_at).toISOString() : null })) };
    },
  },
  {
    def: fn("get_overview", "Tổng quan app đang chọn: tổng và theo ngày của events, users (active), new_users (lần đầu thấy), sessions.", { from: DATE, to: DATE, filters: FILTERS }),
    run: (a, c) => api("/api/overview", base(a, c)),
  },
  {
    def: fn("list_events", "Mọi tên event trong khoảng: số lần và số user.", { from: DATE, to: DATE, filters: FILTERS }),
    run: (a, c) => api("/api/events", base(a, c)),
  },
  {
    def: fn("list_params", "Các key event param (hoặc user property nếu kind=user) xuất hiện, kèm số lần và có phải số không.", {
      event: { type: "string", description: "Chỉ xét event này (tuỳ chọn)." },
      kind: { type: "string", enum: ["event", "user"], description: "event = event param (mặc định), user = user property." },
      from: DATE, to: DATE, filters: FILTERS,
    }),
    run: (a, c) => {
      const q = base(a, c);
      if (a.event) q.event = a.event as string;
      if (a.kind === "user") q.kind = "user";
      return api("/api/params", q);
    },
  },
  {
    def: fn("get_breakdown", "Bảng xếp hạng theo 1 chiều: mỗi giá trị kèm metric, count, users. Dùng cho top quốc gia, version, phân bố level, …", {
      dim: { type: "string", description: DIM },
      metric: { type: "string", description: METRIC },
      event: { type: "string", description: "Chỉ xét event này (tuỳ chọn)." },
      limit: { type: "integer", description: "Số dòng tối đa (mặc định 50, tối đa 200)." },
      from: DATE, to: DATE, filters: FILTERS,
    }, ["dim"]),
    run: (a, c) => {
      const q = base(a, c);
      q.dim = a.dim as string;
      q.metric = (a.metric as string) || "count";
      q.limit = Math.min(200, Number(a.limit) || 50);
      if (a.event) q.event = a.event as string;
      return api("/api/breakdown", q);
    },
  },
  {
    def: fn("get_timeseries", "Chuỗi theo ngày của 1 metric, có thể tách theo top N giá trị của 1 chiều (breakdown).", {
      metric: { type: "string", description: METRIC },
      breakdown: { type: "string", description: "Chiều để tách series (tuỳ chọn). " + DIM },
      event: { type: "string", description: "Chỉ xét event này (tuỳ chọn)." },
      limit: { type: "integer", description: "Số series tối đa khi có breakdown (mặc định 5, tối đa 10)." },
      from: DATE, to: DATE, filters: FILTERS,
    }),
    run: (a, c) => {
      const q = base(a, c);
      q.metric = (a.metric as string) || "count";
      if (a.breakdown) q.breakdown = a.breakdown as string;
      if (a.event) q.event = a.event as string;
      q.limit = Math.min(10, Number(a.limit) || 5);
      return api("/api/timeseries", q);
    },
  },
  {
    def: fn("get_funnel", "Funnel đóng có thứ tự: bao nhiêu user làm bước 1, rồi bước 2 sau đó, … kèm tỉ lệ chuyển đổi.", {
      steps: { type: "array", items: { type: "string" }, description: "2–10 tên event theo thứ tự." },
      window_hours: { type: "integer", description: "Thời gian tối đa từ bước 1 (giờ), 0 = không giới hạn." },
      from: DATE, to: DATE, filters: FILTERS,
    }, ["steps"]),
    run: (a, c) => {
      const q = base(a, c);
      delete q.event;
      q.steps = ((a.steps as string[]) || []).join(",");
      q.window_hours = Number(a.window_hours) || 0;
      return api("/api/funnel", q);
    },
  },
  {
    def: fn("get_recent_events", "Event thô mới nhất (thời gian, tên, params, user, version, platform, quốc gia, thiết bị). Dùng để soi chi tiết hoặc 1 user cụ thể.", {
      limit: { type: "integer", description: "Số event (mặc định 50, tối đa 200)." },
      user: { type: "string", description: "Lọc theo user_id hoặc uid (tuỳ chọn)." },
      event: { type: "string", description: "Lọc theo tên event (tuỳ chọn)." },
      from: DATE, to: DATE, filters: FILTERS,
    }),
    run: (a, c) => {
      const q = base(a, c);
      q.limit = Math.min(200, Number(a.limit) || 50);
      if (a.user) q.user = a.user as string;
      if (a.event) q.event = a.event as string;
      return api("/api/stream", q);
    },
  },
];

export const TOOL_DEFS: ToolDef[] = TOOLS.map((t) => t.def);

const MAX_RESULT = 14000; // chars sent back to the model per tool call

/** Runs a tool call and returns the JSON string handed back to the model (errors included, so it can recover). */
export async function runTool(name: string, argsJson: string, ctx: ToolCtx): Promise<{ text: string; ok: boolean }> {
  const t = TOOLS.find((x) => x.def.function.name === name);
  if (!t) return { text: JSON.stringify({ error: `unknown tool ${name}` }), ok: false };
  let args: Record<string, unknown> = {};
  try {
    args = argsJson ? JSON.parse(argsJson) : {};
  } catch {
    return { text: JSON.stringify({ error: "arguments không phải JSON hợp lệ" }), ok: false };
  }
  try {
    const data = await t.run(args, ctx);
    let text = JSON.stringify(data);
    if (text.length > MAX_RESULT) text = text.slice(0, MAX_RESULT) + `... [cắt bớt, tổng ${text.length} ký tự; hãy thu hẹp limit / bộ lọc]`;
    return { text, ok: true };
  } catch (e) {
    return { text: JSON.stringify({ error: (e as Error).message }), ok: false };
  }
}

export function systemPrompt(c: ToolCtx) {
  const f = Object.entries(c.filters).filter(([k]) => !["app", "from", "to"].includes(k));
  return `Bạn là chuyên gia phân tích dữ liệu game (game analytics) trong dashboard PhaiBay.
App đang xem: "${c.appName}" (app_key ${c.appKey}, id ${c.appId}).
Hôm nay: ${new Date().toISOString().slice(0, 10)}. Khoảng ngày đang chọn: ${c.from} → ${c.to}.
Bộ lọc đang bật: ${f.length ? f.map(([k, v]) => `${k}=${v}`).join(", ") : "không có"}.

Dữ liệu: event do game gửi qua Unity SDK (giống Firebase Analytics). Mỗi event có name, params, user_id (id cài đặt),
uid (id tài khoản, tuỳ chọn), session_id, app_version, platform, os, device, country, lang, user properties.
"users" = số user duy nhất có event; "new_users" = user lần đầu xuất hiện; "sessions" = số session_id khác nhau.

Cách làm việc:
- LUÔN lấy số liệu bằng tool trước khi kết luận. Không bịa số. Nếu thiếu dữ liệu, nói rõ.
- Gọi nhiều tool khi cần (vd list_events trước để biết tên event, list_params để biết param).
- Muốn so sánh với kỳ trước thì gọi lại tool với from/to của kỳ trước.
- Trả lời bằng tiếng Việt, ngắn gọn, có cấu trúc: tiêu đề nhỏ, gạch đầu dòng, bảng markdown khi có nhiều số.
- Nêu insight cụ thể (con số, % thay đổi) và đề xuất hành động cho game designer / PM.`;
}
