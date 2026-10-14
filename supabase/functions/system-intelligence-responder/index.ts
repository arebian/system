import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const RATE_BUCKETS = new Map<string, { count: number; resetAt: number }>();

function consumeRateLimit(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  const bucket = RATE_BUCKETS.get(key);

  if (!bucket || now >= bucket.resetAt) {
    RATE_BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

function cleanText(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

async function fetchJson(url: URL, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const text = await response.text();
    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (!response.ok) {
      throw Object.assign(
        new Error(payload?.error?.message || payload?.message || `UPSTREAM_${response.status}`),
        { status: response.status, upstream: payload },
      );
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeYoutubeItem(item: any) {
  const videoId = cleanText(item?.id?.videoId, 64);
  if (!videoId) return null;
  const snippet = item?.snippet || {};
  return {
    type: "tutorial",
    provider: "YOUTUBE",
    video_id: videoId,
    title: cleanText(snippet?.title, 240),
    description: cleanText(snippet?.description, 600),
    channel: cleanText(snippet?.channelTitle, 160),
    thumbnail:
      cleanText(snippet?.thumbnails?.high?.url, 500) ||
      cleanText(snippet?.thumbnails?.medium?.url, 500) ||
      cleanText(snippet?.thumbnails?.default?.url, 500),
    embed_url: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`,
  };
}

function normalizeBook(item: any) {
  const info = item?.volumeInfo || {};
  const access = item?.accessInfo || {};
  const id = cleanText(item?.id, 128);
  if (!id) return null;
  const images = info?.imageLinks || {};
  const embeddable = Boolean(access?.embeddable);
  return {
    type: "book",
    provider: "GOOGLE_BOOKS",
    volume_id: id,
    title: cleanText(info?.title, 240),
    subtitle: cleanText(info?.subtitle, 240),
    authors: Array.isArray(info?.authors)
      ? info.authors.map((v: unknown) => cleanText(v, 140)).filter(Boolean).slice(0, 8)
      : [],
    description: cleanText(info?.description, 1200),
    page_count: clampInt(info?.pageCount, 0, 100000, 0),
    categories: Array.isArray(info?.categories)
      ? info.categories.map((v: unknown) => cleanText(v, 120)).filter(Boolean).slice(0, 8)
      : [],
    thumbnail:
      cleanText(images?.large, 500) ||
      cleanText(images?.medium, 500) ||
      cleanText(images?.small, 500) ||
      cleanText(images?.thumbnail, 500) ||
      cleanText(images?.smallThumbnail, 500),
    embeddable,
    viewability: cleanText(access?.viewability, 64).toUpperCase(),
    public_domain: Boolean(access?.publicDomain),
    access_view_status: cleanText(access?.accessViewStatus, 64),
    reader_mode: embeddable ? "GOOGLE_EMBED" : "METADATA_ONLY",
  };
}

async function searchTutorials(args: any) {
  const key = cleanText(Deno.env.get("YOUTUBE_API_KEY"), 512);
  if (!key) {
    return {
      configured: false,
      warning: "YOUTUBE_API_KEY_MISSING",
      items: [],
    };
  }
  const query = cleanText(args?.query, 180);
  if (!query) return { configured: true, items: [] };
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(clampInt(args?.max_results, 1, 5, 3)));
  url.searchParams.set("order", "relevance");
  url.searchParams.set("safeSearch", "moderate");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("videoSyndicated", "true");
  url.searchParams.set("relevanceLanguage", "en");
  url.searchParams.set("regionCode", "KE");
  url.searchParams.set("key", key);
  const data = await fetchJson(url);
  return {
    configured: true,
    query,
    items: (Array.isArray(data?.items) ? data.items : [])
      .map(normalizeYoutubeItem)
      .filter(Boolean),
  };
}

async function searchBooks(args: any) {
  const query = cleanText(args?.query, 220);
  if (!query) return { configured: true, items: [] };
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(clampInt(args?.max_results, 1, 8, 5)));
  url.searchParams.set("printType", "books");
  url.searchParams.set("projection", "full");
  url.searchParams.set("orderBy", "relevance");
  const key = cleanText(Deno.env.get("GOOGLE_BOOKS_API_KEY"), 512);
  if (key) url.searchParams.set("key", key);
  const data = await fetchJson(url);
  return {
    configured: true,
    query,
    items: (Array.isArray(data?.items) ? data.items : [])
      .map(normalizeBook)
      .filter(Boolean),
  };
}

async function lookupBook(args: any) {
  const id = cleanText(args?.volume_id, 128);
  if (!id) return { configured: true, book: null };
  const url = new URL(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(id)}`);
  const key = cleanText(Deno.env.get("GOOGLE_BOOKS_API_KEY"), 512);
  if (key) url.searchParams.set("key", key);
  const data = await fetchJson(url);
  return { configured: true, book: normalizeBook(data) };
}

const tools = [
  {
    type: "function",
    name: "search_tutorials",
    description:
      "Search for an embeddable YouTube tutorial when the player asks to see a demonstration, exercise form, technique video, or tutorial. Results are rendered inside THE SYSTEM.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Specific tutorial search query." },
        max_results: { type: "integer", minimum: 1, maximum: 5 },
      },
      required: ["query", "max_results"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "search_books",
    description:
      "Search Google Books when the player asks to find a book, locate a book for the Grand Archive, or asks for a readable book source. Prefer results that can be embedded inside THE SYSTEM.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Book title, author, subject, or search query." },
        max_results: { type: "integer", minimum: 1, maximum: 8 },
      },
      required: ["query", "max_results"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "lookup_book",
    description: "Look up full metadata for one Google Books volume ID.",
    parameters: {
      type: "object",
      properties: {
        volume_id: { type: "string" },
      },
      required: ["volume_id"],
      additionalProperties: false,
    },
    strict: true,
  },
];

function extractOutputText(response: any) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }
  const chunks: string[] = [];
  for (const item of Array.isArray(response?.output) ? response.output : []) {
    if (item?.type !== "message") continue;
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (part?.type === "output_text" && typeof part?.text === "string") {
        chunks.push(part.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

function collectFunctionCalls(response: any) {
  return (Array.isArray(response?.output) ? response.output : []).filter(
    (item: any) => item?.type === "function_call" && item?.name && item?.call_id,
  );
}

function safeArgs(raw: unknown) {
  try {
    const parsed = JSON.parse(String(raw || "{}"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function compactResource(resource: any) {
  return JSON.parse(JSON.stringify(resource));
}

function cleanGuidanceSnapshot(raw: unknown) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, any>
    : {};
  const rawBoss = source.active_boss && typeof source.active_boss === "object"
    ? source.active_boss as Record<string, any>
    : null;
  const rawMusts = Array.isArray(source.active_musts) ? source.active_musts : [];

  return {
    class: cleanText(source.class || source.path, 32).toUpperCase(),
    level: clampInt(source.level, 1, 100000, 1),
    xp: clampInt(source.xp, 0, 100000000, 0),
    streak: clampInt(source.streak, 0, 100000, 0),
    momentum: clampInt(source.momentum, 0, 100000, 0),
    completedQuests: clampInt(source.completed_quests, 0, 1000000, 0),
    fuelGoal: cleanText(source.fuel_goal, 16).toUpperCase(),
    dailyMinutes: clampInt(source.daily_minutes, 0, 180, 0),
    fuelToday: {
      calories: clampInt(source.fuel_today?.calories, 0, 30000, 0),
      protein: clampInt(source.fuel_today?.protein, 0, 3000, 0),
      calorieTarget: clampInt(source.calorie_target, 0, 10000, 0),
      proteinTarget: clampInt(source.protein_target, 0, 1000, 0),
    },
    recovery: source.recovery && typeof source.recovery === "object"
      ? {target:cleanText(source.recovery.target,80),task:cleanText(source.recovery.task,400)} : null,
    raidEntryKeyDetected: Boolean(source.raid_entry_key_detected),
    activeBoss: rawBoss
      ? {
          name: cleanText(rawBoss.name, 160),
          rank: cleanText(rawBoss.rank, 16).toUpperCase(),
          hp: clampInt(rawBoss.hp, 0, 100000000, 0),
          maxHp: clampInt(rawBoss.max_hp, 0, 100000000, 0),
        }
      : null,
    activeMusts: rawMusts
      .slice(0, 4)
      .map((item: any) => ({
        name: cleanText(item?.name, 160),
        expiresAt: cleanText(item?.expires_at, 80),
      }))
      .filter((item: any) => item.name),
  };
}

function builtInAnswer(message: string, context: any, awareness: any, clientContext: any = {}) {
  const q = message.toLowerCase();
  const backendPlayer = context?.profile || context?.player || {};
  const snapshot = cleanGuidanceSnapshot(clientContext);
  const player = {
    ...snapshot,
    name: cleanText(backendPlayer?.name, 80),
    path: cleanText(
      backendPlayer?.path || backendPlayer?.class || snapshot.class || "COMMANDER",
      32,
    ).toUpperCase(),
    level: clampInt(backendPlayer?.level ?? snapshot.level, 1, 100000, 1),
    xp: clampInt(backendPlayer?.xp ?? snapshot.xp, 0, 100000000, 0),
    streak: clampInt(backendPlayer?.streak ?? snapshot.streak, 0, 100000, 0),
    momentum: clampInt(backendPlayer?.momentum ?? snapshot.momentum, 0, 100000, 0),
  };
  const name = cleanText(player?.name, 80);
  const prefix = name ? `${name}, ` : "";

  if (q.includes("planche")) {
    return `${prefix}a planche is a gymnastics strength hold where the body stays horizontal and parallel to the floor while the hands support the full bodyweight. Build toward it gradually with wrist preparation, lean holds, scapular control and tuck-planche progressions. Do not push through sharp wrist, elbow or shoulder pain.`;
  }

  if (
    q.includes("fuel system") ||
    q.includes("calorie") ||
    q.includes("protein") ||
    q.includes("bulk") ||
    q.includes("cut")
  ) {
    const path = cleanText(player?.path || player?.class || "COMMANDER", 32).toUpperCase();
    return `${prefix}the Fuel System is your ${path} meal planner and calorie/protein log. Choose CUT, MAINTAIN or BULK once; THE SYSTEM keeps your class, gives a class-specific meal rhythm and food plan, then you log the portions you actually eat. It is advisory and does not award progression.`;
  }

  if (q.includes("book") || q.includes("archive") || q.includes("reading")) {
    return `${prefix}the Grand Archive opens an authorized Google Books preview or full edition inside THE SYSTEM when that edition is legally embeddable. If a publisher or your region does not allow the preview, import a PDF copy you own and continue in the same reader.`;
  }

  if (q.includes("active time") || q.includes("time today")) {
    const label = awareness?.activeTodayLabel || awareness?.active_today_label;
    return label
      ? `${prefix}active time today is ${label}. System Awareness only counts visible, non-idle app activity.`
      : `${prefix}System Awareness has not produced an active-time reading yet.`;
  }

  if (q.includes("scapular pull") || q.includes("scap pull")) {
    return `${prefix}a scapular pull is a straight-arm hanging shoulder-blade movement. Hang with elbows straight, pull the shoulder blades down and slightly back so your body rises a few centimeters, pause, then return under control. If you asked for a tutorial, THE SYSTEM will try to attach an in-app video.`;
  }

  if (/\b(how (can|do|to).*(level|progress)|level up|leveling|level easily|fastest.*level|easily.*level|progress faster)\b/.test(q)) {
    const mustCopy = player.activeMusts.length
      ? ` You have ${player.activeMusts.length} active Must directive${player.activeMusts.length === 1 ? "" : "s"}; finish those before accepting another.`
      : " You have no active Must directive, so accept one only when you can finish its full 24-hour commitment.";
    return `${prefix}you are Level ${player.level} with ${player.xp} XP and a ${player.streak}-day streak. The simplest legitimate level-up loop is: 1) finish available Daily and Class quests, 2) complete the Adaptive directive when it fits your current focus, 3) submit the real proof the quest asks for, and 4) use verified Training or GPS only where the quest requires it.${mustCopy} I cannot grant XP or bypass proof.`;
  }

  if (/\b(quest|quests|daily|must quest|adaptive quest|adaptive directive|proof|structural check)\b/.test(q)) {
    return `${prefix}Quest Board guide: Daily and Class quests are repeatable progression; an accepted Must Quest has an exact 24-hour authoritative deadline; the Adaptive Quest is THE SYSTEM's current best-fit recommendation. Use the proof method shown in the quest popup and mark only the concrete result you produced. You currently have ${player.activeMusts.length} active Must directive${player.activeMusts.length === 1 ? "" : "s"}.`;
  }

  if (/\b(gps|walk|run|distance|location mission)\b/.test(q)) {
    return `${prefix}for a GPS mission, start it from the relevant Quest or Training action, allow browser location access, keep THE SYSTEM open while you move, then finish the mission in the app. The backend verifies the recorded action; use manual proof only when that specific quest offers it.`;
  }

  if (/\b(class special|special class|commander.*record|record myself|eye contact|camera|video proof)\b/.test(q)) {
    return `${prefix}Class Special follows your current class: Commander records a private 30–60 second clip, reviews eye contact and adds a reflection for 35 XP and +1 Charisma; Tank records at least three sets, reps, load and a form note for 45 XP and +1 Strength; Assassin finishes a 25-minute focus timer and a result note for 40 XP and +1 Focus; Ranger completes a linked 20-minute GPS route of at least 200 metres for 40 XP and +1 Endurance. These four specials have one reward per account per UTC day. Mage uses the Grand Archive and its existing reading rules. The backend confirms every reward; camera eye contact and strength form are self-reviewed, not automatically assessed.`;
  }

  if (/\b(trophy|trophies|achievement|title|inventory|raid key|boss key|key gate)\b/.test(q)) {
    const key = player.raidEntryKeyDetected ? "DETECTED" : "NOT DETECTED";
    return `${prefix}Inventory holds earned items and the Raid Entry Key. Trophy Room displays verified achievements and equipable titles; it does not create them. Your Raid Entry Key status is ${key}. ${player.raidEntryKeyDetected ? "You can request a System-selected Boss from Quests, but the backend makes the final decision." : "The key is backend-awarded; the current Boss Gate requirement is Level 5 plus a 3-day Daily streak."}`;
  }

  if (q.includes("boss")) {
    const boss = context?.active_boss || context?.activeBoss || player.activeBoss;
    if (boss) {
      const name = cleanText(boss?.name || boss?.title, 160) || "ACTIVE BOSS";
      const hp = clampInt(boss?.hp, 0, 100000000, 0);
      const maxHp = clampInt(boss?.max_hp ?? boss?.maxHp, 0, 100000000, 0);
      return `${prefix}your active Boss is ${name}${maxHp ? ` at ${hp || maxHp}/${maxHp} HP` : ""}. Complete its listed objectives through verified actions; Boss damage and victory remain backend-authoritative.`;
    }
    return player.raidEntryKeyDetected
      ? `${prefix}no active Boss is visible. Your Raid Entry Key is detected, so open Quests → Boss Gate and request the next System-selected Boss.`
      : `${prefix}no active Boss is visible. The Boss Gate is locked until the backend awards the Raid Entry Key; the current requirement is Level 5 plus a 3-day Daily streak.`;
  }

  if (/\b(routine|sleep|shift|profile|settings|light mode|dark mode)\b/.test(q)) {
    return `${prefix}open the profile control in the top-right corner for Interface, sound and Sleep / Shift routine settings. Your routine stores the wake plan you choose; it does not silently alter quests or progression.`;
  }

  if (/\b(log|logs|journey|performance log|wealth log)\b/.test(q)) {
    return `${prefix}Journey keeps your logged real-world work visible over time. Use the appropriate performance or wealth log to record what actually happened. Logs support reflection and analysis; they do not award XP by themselves unless a separate backend-verified quest or skill accepts that action.`;
  }

  if (q.includes("xp") || q.includes("level") || q.includes("progress")) {
    return `${prefix}you are currently Level ${player.level} with ${player.xp} XP, a ${player.streak}-day streak and ${player.completedQuests} recorded quest completion${player.completedQuests === 1 ? "" : "s"}. I can explain the safest next progression route, but I cannot grant XP, change levels or bypass verified completion.`;
  }

  return `${prefix}I can answer broad questions about how THE SYSTEM works: levels and XP, streaks, Quest Board proof and timers, Adaptive directives, Training, GPS, Boss and Raid Key gates, Class Special, Fuel, Grand Archive books, Inventory, Journey logs, trophies, routines and settings. Ask naturally—for example: “How do I level up from here?”`;
}

function publicModelWarning(error: any) {
  const status = Number(error?.status || 0);
  if (status === 401 || status === 403) return "OPENAI_AUTH_FAILED";
  if (status === 429) return "OPENAI_RATE_LIMITED";
  if (status === 504) return "OPENAI_TIMEOUT";
  return "OPENAI_RESPONSE_FAILED";
}

async function runTool(name: string, args: any) {
  if (name === "search_tutorials") return await searchTutorials(args);
  if (name === "search_books") return await searchBooks(args);
  if (name === "lookup_book") return await lookupBook(args);
  return { error: "UNKNOWN_TOOL" };
}

async function openAiResponse({
  apiKey,
  model,
  input,
  instructions,
}: {
  apiKey: string;
  model: string;
  input: any[];
  instructions: string;
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions,
        input,
        tools,
        tool_choice: "auto",
        reasoning: { effort: "low" },
        max_output_tokens: 1400,
        store: false,
      }),
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw Object.assign(new Error("OPENAI_TIMEOUT"), { status: 504 });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw Object.assign(
      new Error(payload?.error?.message || `OPENAI_${response.status}`),
      { status: response.status, upstream: payload },
    );
  }
  return payload;
}

async function runOpenAiAgent({
  apiKey,
  model,
  input,
  instructions,
}: {
  apiKey: string;
  model: string;
  input: any[];
  instructions: string;
}) {
  let workingInput = [...input];
  const resources: any[] = [];
  let lastResponse: any = null;

  for (let round = 0; round < 3; round += 1) {
    const response = await openAiResponse({ apiKey, model, input: workingInput, instructions });
    lastResponse = response;
    const calls = collectFunctionCalls(response);

    if (!calls.length) {
      return {
        answer: extractOutputText(response),
        response,
        resources,
      };
    }

    const outputs = [];
    for (const call of calls) {
      const args = safeArgs(call.arguments);
      let result: any;
      try {
        result = await runTool(call.name, args);
      } catch (error: any) {
        result = { error: cleanText(error?.message, 240) || "TOOL_FAILED" };
      }

      if (call.name === "search_tutorials" && Array.isArray(result?.items)) {
        resources.push(...result.items.slice(0, 4).map(compactResource));
      }
      if (call.name === "search_books" && Array.isArray(result?.items)) {
        resources.push(...result.items.slice(0, 5).map(compactResource));
      }
      if (call.name === "lookup_book" && result?.book) {
        resources.push(compactResource(result.book));
      }

      outputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(result),
      });
    }

    workingInput = [
      ...workingInput,
      ...(Array.isArray(response?.output) ? response.output : []),
      ...outputs,
    ];
  }

  return {
    answer: extractOutputText(lastResponse),
    response: lastResponse,
    resources,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "AUTH_REQUIRED" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: "INVALID_SESSION" }, 401);

  const rate = consumeRateLimit(userData.user.id, 12);
  if (!rate.allowed) {
    return json(
      {
        error: "RATE_LIMITED",
        code: "RATE_LIMITED",
        details: { retry_after_seconds: rate.retryAfterSeconds },
      },
      429,
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const message = cleanText(body?.message, 4000);
  if (!message) return json({ error: "INVALID_MESSAGE" }, 400);

  const awareness = body?.awareness && typeof body.awareness === "object"
    ? body.awareness
    : null;

  // This is guidance-only context from the current browser view. It is never
  // used to authorize, award or unlock anything; Supabase remains authoritative.
  const clientGuidance = cleanGuidanceSnapshot(body?.player_context);

  let threadId = body?.thread_id ? cleanText(body.thread_id, 180) : null;
  if (!threadId) {
    const { data, error } = await supabase.rpc("system_intelligence_create_thread", {
      p_title: "SYSTEM INTELLIGENCE",
      p_context: { source: "FLOATING_CORE", mode: "API_CORE_2_5" },
    });
    if (error) return json({ error: error.message }, 400);
    threadId = cleanText(data?.id || data?.thread_id || data, 180);
  }

  const { error: messageError } = await supabase.rpc("system_intelligence_add_message", {
    p_thread_id: threadId,
    p_role: "user",
    p_content: message,
    p_metadata: { source: "FLOATING_CORE", mode: "API_CORE_2_5" },
  });
  if (messageError) return json({ error: messageError.message }, 400);

  const { data: context, error: contextError } = await supabase.rpc("system_intelligence_context");
  if (contextError) return json({ error: contextError.message }, 400);

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: transcriptRows } = await service
    .from("system_intelligence_messages")
    .select("role,content,created_at")
    .eq("thread_id", threadId)
    .eq("user_id", userData.user.id)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true })
    .limit(18);

  const transcript = (Array.isArray(transcriptRows) ? transcriptRows : [])
    .map((row: any) => ({
      role: row.role === "assistant" ? "assistant" : "user",
      content: cleanText(row.content, 5000),
    }))
    .filter((row: any) => row.content);

  const player = context?.profile || context?.player || {};
  const { data: creditRows } = await supabase.from("attribute_credit_ledger")
    .select("credits_awarded,credits_spent").eq("user_id", userData.user.id).limit(1000);
  const unspentCredits = Array.isArray(creditRows) ? creditRows.reduce((sum:any,row:any) => sum + Math.max(0, Number(row.credits_awarded) - Number(row.credits_spent)), 0) : null;
  const contextBlock = JSON.stringify({
    player: {
      name: player?.name || null,
      class: player?.path || player?.class || null,
      level: player?.level || null,
      xp: player?.xp ?? null,
      streak: player?.streak ?? null,
      momentum: player?.momentum ?? null,
    },
    attributes: context?.attributes || player?.attributes || null,
    active_boss: context?.active_boss || context?.activeBoss || null,
    active_quests: context?.active_quests || context?.activeQuests || null,
    unspent_attribute_credits: unspentCredits,
    routine: context?.routine || null,
    foundation_plan: player?.profile_data?.foundationScan || null,
    fuel_plan: player?.profile_data?.fuel || null,
    browser_guidance_snapshot: clientGuidance,
    awareness,
  }).slice(0, 18000);

  const instructions = `You are SYSTEM INTELLIGENCE inside THE SYSTEM, a serious real-life RPG application.\n\nVOICE: concise, calm, authoritative and practical. Do not sound cheesy. Address the player naturally.\n\nPLAYER CONTEXT: ${contextBlock}\n\nAPP DOMAIN:\n- Dashboard, attributes, levels, XP, streaks, momentum and progression strategy.\n- Quest Board: Daily, Class, Must (exact 24-hour authoritative window), Adaptive directives, proof, training and GPS missions.\n- Boss Gate and Raid Entry Key, Class Special, Fuel System, Grand Archive, Inventory, Journey logs, Trophy Room, routines and settings.\n- Explain both what a feature does and how the player uses it. For broad questions such as “How do I level up?” give a short, legitimate step-by-step route tailored to the supplied context.\n\nCLASS PRACTICE RULES:\nClass Special follows your current class: Commander records a private 30–60 second clip, reviews eye contact and adds a reflection for 35 XP and +1 Charisma; Tank records at least three sets, reps, load and a form note for 45 XP and +1 Strength; Assassin finishes a 25-minute focus timer and a result note for 40 XP and +1 Focus; Ranger completes a linked 20-minute GPS route of at least 200 metres for 40 XP and +1 Endurance. These four specials have one reward per account per UTC day. Mage uses the Grand Archive and its existing reading rules. The backend confirms every reward; camera eye contact and strength form are self-reviewed, not automatically assessed.\nCore attributes: Commander Charisma/Discipline/Focus; Tank Strength/Endurance/Discipline; Mage Intelligence/Focus/Creativity; Assassin Speed/Focus/Discipline; Ranger Endurance/Speed/Recovery.\n\nAUTHORITY RULES:\n- You may analyze, explain, recommend, teach, plan and search approved content tools.\n- You NEVER claim XP, complete quests, apply penalties, grant Boss damage, unlock ranks or change authoritative progression. Supabase/backend verification controls those actions.\n- Treat the browser guidance snapshot as display context only; never use it to authorize a gate, award a result or override Supabase state.\n- If the player asks to see an exercise/tutorial/demo, use search_tutorials so playable videos can render inside THE SYSTEM instead of sending them away.\n- If the player asks for books or Archive sources, use search_books. Prefer embeddable results and explain when only a preview is legally available.\n- Never claim copyrighted commercial book text is available in full unless the source actually provides legal access.\n- For potentially serious injury/medical symptoms, do not diagnose; recommend appropriate professional care when warranted.\n- If a request is ambiguous, give the most useful safe answer rather than inventing backend state.\n\nThe player should feel that one intelligence layer understands how their whole System works, not only exercises.`;

  const apiKey = cleanText(Deno.env.get("OPENAI_API_KEY"), 2048);
  const model = cleanText(Deno.env.get("OPENAI_MODEL"), 128) || "gpt-5.6-terra";
  let answer = "";
  let resources: any[] = [];
  let modelConnected = false;
  let mode = apiKey ? "OPENAI_RESPONSE_PENDING" : "OPENAI_API_KEY_MISSING";
  let modelUsed: string | null = null;
  let modelError: string | null = apiKey ? null : "OPENAI_API_KEY_MISSING";

  if (apiKey) {
    try {
      const result = await runOpenAiAgent({
        apiKey,
        model,
        input: transcript,
        instructions,
      });
      answer = cleanText(result.answer, 12000);
      resources = result.resources.slice(0, 8);
      modelConnected = Boolean(answer || resources.length);
      mode = modelConnected ? "OPENAI_RESPONSES_API" : "BUILT_IN_GUIDANCE";
      modelUsed = modelConnected ? model : null;
    } catch (error: any) {
      console.error("OPENAI SYSTEM INTELLIGENCE FAILED", error);
      modelError = publicModelWarning(error);
      mode = "OPENAI_RESPONSE_ERROR";
    }
  }

  if (!answer) {
    answer = builtInAnswer(message, context, awareness, clientGuidance);
    if (!modelConnected && mode === "OPENAI_RESPONSE_PENDING") {
      mode = "BUILT_IN_GUIDANCE";
    }
  }

  const { error: insertError } = await service
    .from("system_intelligence_messages")
    .insert({
      thread_id: threadId,
      user_id: userData.user.id,
      role: "assistant",
      content: answer,
      metadata: {
        mode,
        model: modelUsed,
        resource_count: resources.length,
        resources,
        model_error: modelError,
      },
    });

  if (insertError) return json({ error: insertError.message }, 500);

  return json({
    data: {
      thread_id: threadId,
      online: true,
      model_connected: modelConnected,
      mode,
      model: modelUsed,
      answer,
      resources,
      configuration: {
        openai: Boolean(apiKey),
        youtube: Boolean(cleanText(Deno.env.get("YOUTUBE_API_KEY"), 512)),
        google_books: Boolean(cleanText(Deno.env.get("GOOGLE_BOOKS_API_KEY"), 512)),
        google_books_provider: true,
      },
      warning: modelError,
    },
  });
});
