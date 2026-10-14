import React from "react";
import { useState, useRef, useEffect } from "react";
import { PATHS, uid } from "./systemProfileCore.js";
import { normalizeFuelState, getFuelProtocol, summarizeFuelDay } from "./systemFuel.js";
import { todayKey } from "./systemProfileCore.js";
import { xpRequired } from "./systemProgressionCore.js";
import { reportSystemError } from "./systemErrorReporter.js";
import { hasRaidEntryKey } from "./systemBossCore.js";
import { getSystemIntelligenceContext, getSystemIntelligenceStatus, getSystemIntelligenceHistory } from "./systemCloud.js";
import { askSystemIntelligenceApi, searchSystemTutorials, searchSystemBooks } from "./systemExternal.js";

export function SystemTutorialEmbed({ resource }) {
  const [playing, setPlaying] = useState(false);

  if (!resource?.video_id) {
    return null;
  }

  return (
    <article className="system-tutorial-resource">
      <div className="system-tutorial-resource-media">
        {playing ? (
          <iframe
            title={resource.title || "Tutorial"}
            src={`${resource.embed_url}?autoplay=1&rel=0&modestbranding=1`}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className="system-tutorial-resource-preview"
            onClick={() => setPlaying(true)}
            aria-label={`Play ${resource.title || "tutorial"} inside THE SYSTEM`}
          >
            {resource.thumbnail ? (
              <img src={resource.thumbnail} alt="" />
            ) : (
              <span className="system-tutorial-resource-placeholder">▶</span>
            )}
            <i>▶</i>
          </button>
        )}
      </div>

      <div className="system-tutorial-resource-copy">
        <small>IN-SYSTEM TUTORIAL // YOUTUBE</small>
        <strong>{resource.title || "TUTORIAL"}</strong>
        <span>{resource.channel || "VIDEO SOURCE"}</span>
        {!playing && (
          <button type="button" onClick={() => setPlaying(true)}>
            PLAY HERE
          </button>
        )}
      </div>
    </article>
  );
}

export function SystemBookResourceCard({ resource, setTab, setOpen }) {
  if (!resource?.volume_id) {
    return null;
  }

  return (
    <article className="system-book-resource">
      {resource.thumbnail ? (
        <img src={resource.thumbnail} alt="" />
      ) : (
        <div className="system-book-resource-cover">✧</div>
      )}

      <div>
        <small>
          GOOGLE BOOKS // {resource.embeddable ? "EMBEDDABLE" : "CATALOG"}
        </small>
        <strong>{resource.title || "BOOK"}</strong>
        <span>
          {Array.isArray(resource.authors) && resource.authors.length
            ? resource.authors.join(", ")
            : "UNKNOWN AUTHOR"}
        </span>
        <em>{resource.viewability || "METADATA"}</em>

        {setTab && (
          <button
            type="button"
            onClick={() => {
              setTab("archive");
              setOpen?.(false);
            }}
          >
            OPEN GRAND ARCHIVE
          </button>
        )}
      </div>
    </article>
  );
}

export function SystemIntelligenceFloat({
  profile,
  open,
  setOpen,
  awareness,
  setTab,
}) {
  const classData =
    PATHS[
      profile.path
    ] ||
    PATHS.COMMANDER;


  const exerciseGuideLibrary = [
    {
      terms: [
        "scapular pull",
        "scap pull",
        "scapular pull-up",
      ],
      name:
        "SCAPULAR PULL-UP",
      provider:
        "WATCH DEMO",
      url:
        "https://www.youtube.com/results?search_query=scapular+pull+up+proper+form+tutorial",
      icon:
        "↗",
    },
    {
      terms: [
        "incline push-up",
        "incline push up",
      ],
      name:
        "INCLINE PUSH-UP",
      provider:
        "VISUAL GUIDE",
      url:
        "https://musclewiki.com/exercise/incline-push-up",
      icon:
        "◫",
    },
    {
      terms: [
        "push-up",
        "push up",
        "pushup",
      ],
      name:
        "PUSH-UP",
      provider:
        "VISUAL GUIDE",
      url:
        "https://musclewiki.com/exercise/push-up",
      icon:
        "◫",
    },
    {
      terms: [
        "bodyweight squat",
        "squat",
      ],
      name:
        "BODYWEIGHT SQUAT",
      provider:
        "VISUAL GUIDE",
      url:
        "https://musclewiki.com/exercise/bodyweight-squat",
      icon:
        "◫",
    },
    {
      terms: [
        "forearm plank",
      ],
      name:
        "FOREARM PLANK",
      provider:
        "VISUAL GUIDE",
      url:
        "https://musclewiki.com/exercise/forearm-plank",
      icon:
        "◫",
    },
    {
      terms: [
        "hand plank",
        "plank",
      ],
      name:
        "PLANK",
      provider:
        "VISUAL GUIDE",
      url:
        "https://musclewiki.com/exercise/hand-plank",
      icon:
        "◫",
    },
    {
      terms: [
        "pull-up",
        "pull up",
        "pullup",
      ],
      name:
        "PULL-UP",
      provider:
        "WATCH DEMO",
      url:
        "https://www.youtube.com/results?search_query=pull+up+proper+form+tutorial",
      icon:
        "↗",
    },
    {
      terms: [
        "bulgarian split squat",
        "split squat",
      ],
      name:
        "BULGARIAN SPLIT SQUAT",
      provider:
        "WATCH DEMO",
      url:
        "https://www.youtube.com/results?search_query=bulgarian+split+squat+proper+form+tutorial",
      icon:
        "↗",
    },
    {
      terms: [
        "walking lunge",
        "walking lunges",
        "lunge",
        "lunges",
      ],
      name:
        "WALKING LUNGE",
      provider:
        "WATCH DEMO",
      url:
        "https://www.youtube.com/results?search_query=walking+lunge+proper+form+tutorial",
      icon:
        "↗",
    },
    {
      terms: [
        "pike push-up",
        "pike push up",
      ],
      name:
        "PIKE PUSH-UP",
      provider:
        "WATCH DEMO",
      url:
        "https://www.youtube.com/results?search_query=pike+push+up+proper+form+tutorial",
      icon:
        "↗",
    },
    {
      terms: [
        "burpee",
        "burpees",
      ],
      name:
        "BURPEE",
      provider:
        "WATCH DEMO",
      url:
        "https://www.youtube.com/results?search_query=burpee+proper+form+tutorial",
      icon:
        "↗",
    },
  ];

  function exerciseGuideForText(
    text
  ) {
    const normalized =
      String(
        text ||
        ""
      ).toLowerCase();

    return (
      exerciseGuideLibrary.find(
        (guide) =>
          guide.terms.some(
            (term) =>
              normalized.includes(
                term
              )
          )
      ) ||
      null
    );
  }

  const [
    status,
    setStatus,
  ] = useState(null);

  const [
    threadId,
    setThreadId,
  ] = useState(
    () =>
      localStorage.getItem(
        "systemIntelligenceThread"
      ) || ""
  );

  const [
    messages,
    setMessages,
  ] = useState([]);


  const historyStorageKey =
    "systemIntelligenceHistoryV2";

  const [
    historyOpen,
    setHistoryOpen,
  ] = useState(false);

  const [
    localChatId,
    setLocalChatId,
  ] = useState(
    () =>
      localStorage.getItem(
        "systemIntelligenceLocalChatId"
      ) ||
      uid(
        "AI-CHAT"
      )
  );

  const [
    chatHistory,
    setChatHistory,
  ] = useState(
    () => {
      try {
        const parsed =
          JSON.parse(
            localStorage.getItem(
              "systemIntelligenceHistoryV2"
            ) ||
            "[]"
          );

        return Array.isArray(
          parsed
        )
          ? parsed
          : [];
      } catch {
        return [];
      }
    }
  );

  const [
    input,
    setInput,
  ] = useState("");

  const [
    sending,
    setSending,
  ] = useState(false);

  const aiSessionRef =
    useRef(null);

  const [
    aiMode,
    setAiMode,
  ] = useState(
    "CHECKING"
  );

  const [
    aiDownload,
    setAiDownload,
  ] = useState(
    0
  );

  const [
    connectionChecking,
    setConnectionChecking,
  ] = useState(false);

  const localTranscriptKey =
    "systemIntelligenceLocalTranscript";

  function loadLocalTranscript() {
    try {
      const raw =
        localStorage.getItem(
          localTranscriptKey
        );

      const parsed =
        raw
          ? JSON.parse(
              raw
            )
          : [];

      return Array.isArray(
        parsed
      )
        ? parsed
        : [];
    } catch {
      return [];
    }
  }

  function persistLocalTranscript(
    nextMessages,
    linkedThreadId = threadId
  ) {
    const trimmed =
      nextMessages.slice(
        -60
      );

    try {
      localStorage.setItem(
        localTranscriptKey,
        JSON.stringify(
          trimmed
        )
      );

      localStorage.setItem(
        "systemIntelligenceLocalChatId",
        localChatId
      );

      const firstUser =
        trimmed.find(
          (message) =>
            message.role ===
              "user"
        );

      const title =
        String(
          firstUser?.content ||
          "New conversation"
        )
          .trim()
          .slice(
            0,
            58
          );

      const nextHistory = [
        {
          id:
            localChatId,
          title:
            title ||
            "New conversation",
          updatedAt:
            new Date()
              .toISOString(),
          threadId:
            linkedThreadId ||
            null,
          messages:
            trimmed,
        },
        ...chatHistory.filter(
          (chat) =>
            chat.id !==
            localChatId
        ),
      ].slice(
        0,
        30
      );

      setChatHistory(
        nextHistory
      );

      localStorage.setItem(
        historyStorageKey,
        JSON.stringify(
          nextHistory
        )
      );
    } catch {
      // Chat continues even if browser storage is unavailable.
    }
  }

  function startNewIntelligenceChat() {
    try {
      aiSessionRef.current
        ?.destroy?.();
    } catch {
      // Some browser model implementations do not expose destroy.
    }

    aiSessionRef.current =
      null;

    const nextId =
      uid(
        "AI-CHAT"
      );

    setLocalChatId(
      nextId
    );

    setMessages(
      []
    );

    setInput(
      ""
    );

    setThreadId(
      ""
    );

    setHistoryOpen(
      false
    );

    localStorage.removeItem(
      localTranscriptKey
    );

    localStorage.removeItem(
      "systemIntelligenceThread"
    );

    localStorage.setItem(
      "systemIntelligenceLocalChatId",
      nextId
    );
  }

  function openHistoryChat(
    chat
  ) {
    if (!chat) {
      return;
    }

    try {
      aiSessionRef.current
        ?.destroy?.();
    } catch {}

    aiSessionRef.current =
      null;

    setLocalChatId(
      chat.id
    );

    setMessages(
      Array.isArray(
        chat.messages
      )
        ? chat.messages
        : []
    );

    const linkedThread =
      String(
        chat.threadId ||
        ""
      );

    setThreadId(
      linkedThread
    );

    if (linkedThread) {
      localStorage.setItem(
        "systemIntelligenceThread",
        linkedThread
      );
    } else {
      localStorage.removeItem(
        "systemIntelligenceThread"
      );
    }

    setHistoryOpen(
      false
    );

    localStorage.setItem(
      localTranscriptKey,
      JSON.stringify(
        Array.isArray(
          chat.messages
        )
          ? chat.messages
          : []
      )
    );

    localStorage.setItem(
      "systemIntelligenceLocalChatId",
      chat.id
    );
  }


  function intelligencePlayerContext() {
    const activeBoss =
      Array.isArray(profile.bossQuests)
        ? profile.bossQuests.find(
            (item) =>
              item.status ===
              "ACTIVE"
          )
        : null;

    const activeMusts =
      Object.values(
        profile.mustState || {}
      )
        .filter(
          (state) =>
            state?.accepted &&
            !state?.completed &&
            !state?.failed
        )
        .slice(0, 4)
        .map((state) => ({
          name: String(state?.name || "MUST DIRECTIVE").slice(0, 160),
          expires_at: state?.expiresAt || null,
        }));

    const fuel =
      normalizeFuelState(profile.fuel);

    return {
      class: String(profile.path || "COMMANDER").toUpperCase(),
      level: Number(profile.level || 1),
      xp: Number(profile.xp || 0),
      streak: Number(profile.streak || 0),
      momentum: Number(profile.momentum || 0),
      attributes: profile.attributes || {},
      active_boss: activeBoss
        ? {
            name: String(activeBoss.name || "BOSS").slice(0, 160),
            rank: activeBoss.rank || null,
            hp: Number(activeBoss.hp ?? activeBoss.maxHp ?? 0),
            max_hp: Number(activeBoss.maxHp ?? 0),
          }
        : null,
      active_musts: activeMusts,
      completed_quests: Array.isArray(profile.questLog)
        ? profile.questLog.length
        : 0,
      raid_entry_key_detected: hasRaidEntryKey(profile),
      fuel_goal: fuel.goal || null,
      fuel_today: summarizeFuelDay(fuel.logs[todayKey()], fuel.calorieTarget, fuel.proteinTarget),
      calorie_target: fuel.calorieTarget,
      protein_target: fuel.proteinTarget,
      xp_required: xpRequired(profile.level),
      recovery: awareness?.recoveryDirective ? {target:awareness.recoveryDirective.target, task:awareness.recoveryDirective.task} : null,
      daily_minutes: Number(profile.foundationScan?.dailyMinutes || 0),
    };
  }


  function fallbackSystemAnswer(
    question
  ) {
    const q =
      String(
        question ||
        ""
      ).toLowerCase();

    const level =
      Number(profile.level || 1);

    const xp =
      Number(profile.xp || 0);

    const currentStreak =
      Number(profile.streak || 0);

    const activeBoss =
      Array.isArray(profile.bossQuests)
        ? profile.bossQuests.find(
            (item) =>
              item.status ===
              "ACTIVE"
          )
        : null;

    const activeMustCount =
      Object.values(
        profile.mustState || {}
      ).filter(
        (state) =>
          state?.accepted &&
          !state?.completed &&
          !state?.failed
      ).length;

    const raidKeyDetected =
      hasRaidEntryKey(profile);

    if (
      /\b(how (can|do|to).*(level|progress)|level up|leveling|level easily|fastest.*level|easily.*level|progress faster)\b/.test(
        q
      )
    ) {
      return `You are Level ${level} with ${xp} XP and a ${currentStreak}-day streak. The fastest legitimate route is consistency, not a shortcut: 1) complete the available Daily and Class quests, 2) accept only a Must Quest you can genuinely finish inside its 24-hour window, 3) complete the Adaptive directive when it matches your weakest or class-focused attribute, and 4) log real training/GPS proof when that is the quest requirement. ${activeMustCount ? `You currently have ${activeMustCount} active Must directive${activeMustCount === 1 ? "" : "s"}; finish those first.` : "You have no active Must directive, so choose one only when you are ready to complete it."} Chat cannot grant XP; verified completion remains backend-authoritative.`;
    }

    if (
      /\b(quest|quests|daily|must quest|adaptive quest|adaptive directive|proof|structural check)\b/.test(
        q
      )
    ) {
      return `Quest Board guide: Daily and Class quests are your repeatable progression loop; an accepted Must Quest has an exact 24-hour authoritative deadline; Adaptive Quest is the System's best-fit recommendation for your current profile. Use the proof method shown in the quest popup and only mark the real result you produced. You currently have ${activeMustCount} active Must directive${activeMustCount === 1 ? "" : "s"}.`;
    }

    if (
      /\b(gps|walk|run|distance|location mission)\b/.test(
        q
      )
    ) {
      return "For a GPS mission, open the relevant Quest or Training action, allow location access in the browser, start the mission before moving, then finish it in THE SYSTEM when you are done. GPS evidence and any resulting progression are verified by the existing backend flow; if location is unavailable, use only the manual-proof path that the quest itself offers.";
    }

    if (
      /\b(trophy|trophies|achievement|title|inventory|raid key|boss key|key gate)\b/.test(
        q
      )
    ) {
      return `Inventory holds earned items and the Raid Entry Key. Trophy Room displays verified achievements and equipable titles; it does not create them. Your Raid Entry Key status is ${raidKeyDetected ? "DETECTED" : "NOT DETECTED"}. ${raidKeyDetected ? "You can request a Boss from the Quest Board, but the backend still validates the gate." : "The Boss gate opens only after the backend awards the key—currently Level 5 plus a 3-day Daily streak is required."}`;
    }

    if (
      /\b(class special|special class|commander.*record|record myself|eye contact|camera|video proof)\b/.test(
        q
      )
    ) {
      return "Class Special follows your current class: Commander records a private 30\u201360 second clip, reviews eye contact and adds a reflection for 35 XP and +1 Charisma; Tank records at least three sets, reps, load and a form note for 45 XP and +1 Strength; Assassin finishes a 25-minute focus timer and a result note for 40 XP and +1 Focus; Ranger completes a linked 20-minute GPS route of at least 200 metres for 40 XP and +1 Endurance. These four specials have one reward per account per UTC day. Mage uses the Grand Archive and its existing reading rules. The backend confirms every reward; camera eye contact and strength form are self-reviewed, not automatically assessed.";
    }

    if (
      /\b(routine|sleep|shift|profile|settings|light mode|dark mode)\b/.test(
        q
      )
    ) {
      return "Open the profile control in the top-right corner for Interface, sound and your Sleep / Shift routine. The routine stores the wake plan you choose; it does not silently change quests or progression. Use the light/dark switch there when you want to change the visual interface.";
    }

    if (
      /\b(log|logs|journey|performance log|wealth log)\b/.test(
        q
      )
    ) {
      return "Journey keeps your logged real-world work visible over time. Use the relevant performance or wealth log to record what actually happened. Logs support reflection and analysis; they do not award XP by themselves unless a separate backend-verified quest or skill accepts the action.";
    }

    if (q.includes("planche")) {
      return "A planche is a gymnastics strength hold where your body stays horizontal and parallel to the floor while your hands support your full weight. Build it gradually through wrist preparation, lean holds, scapular control and progressions such as tuck planche. Do not force it through wrist, elbow or shoulder pain.";
    }

    if (
      q.includes("fuel system") ||
      q.includes("calorie") ||
      q.includes("protein") ||
      q.includes("bulk") ||
      q.includes("cut")
    ) {
      const activeGoal =
        normalizeFuelState(profile.fuel).goal ||
        "NOT SELECTED";
      const activeProtocol =
        getFuelProtocol(
          profile.path,
          activeGoal === "NOT SELECTED" ? "MAINTAIN" : activeGoal
        );
      return `Fuel System is a ${profile.path}-specific meal planner and calorie/protein log. Your current goal is ${activeGoal}. ${activeProtocol.mealRhythm}. Select CUT, MAINTAIN or BULK once; THE SYSTEM keeps your class and gives the right meal rhythm, then you log the portions you actually eat.`;
    }

    if (
      q.includes("book") ||
      q.includes("archive") ||
      q.includes("reading")
    ) {
      return "The Grand Archive checks Google Books and Open Library when you open a book. A legally readable Open Library / Internet Archive edition loads inside THE SYSTEM; a borrow-only edition opens its verified provider page, and a publisher or region-restricted title still lets you import a PDF copy you own.";
    }

    if (
      q.includes(
        "scapular pull"
      ) ||
      q.includes(
        "scap pull"
      )
    ) {
      return "Scapular pulls: hang from a pull-up bar with straight elbows. Without bending your arms, pull your shoulder blades down and slightly together so your body rises a few centimeters. Pause, then return to a relaxed hang under control. Start with 2–3 sets of 5–8 clean reps. Stop if you feel sharp shoulder pain.";
    }

    if (
      q.includes(
        "push up"
      ) ||
      q.includes(
        "push-up"
      )
    ) {
      return "For a clean push-up: hands slightly wider than shoulder width, body in one straight line, brace your core and glutes, lower until your chest is close to the floor, then press up without letting the hips sag. Use an incline if full reps break your form.";
    }

    if (
      q.includes(
        "plank"
      )
    ) {
      return "Plank setup: elbows below shoulders, ribs pulled down, glutes lightly squeezed and body straight from head to heels. Think about pulling your elbows toward your toes without moving them. End the set when your lower back starts sagging.";
    }

    if (
      q.includes(
        "squat"
      )
    ) {
      return "For bodyweight squats: feet around shoulder width, brace first, sit down and slightly back while letting the knees track in the same direction as your toes. Keep the whole foot planted and stand by driving the floor away.";
    }

    if (q.includes("active time") || q.includes("how long have i been active") || q.includes("time today")) {
      return awareness
        ? `Active time today: ${awareness.activeTodayLabel}. ${awareness.activeNow ? "The counter is running because the app is visible and you are active." : "The counter is currently paused because the app is hidden or activity has been idle."}`
        : "System Awareness has not collected an active-time reading yet.";
    }

    if (q.includes("briefing") || q.includes("system status") || q.includes("my status")) {
      return awareness?.briefing?.summary || `Player ${profile.name}. Level ${Number(profile.level || 1)}. Class ${profile.path}.`;
    }

    if (q.includes("trend") || q.includes("improving") || q.includes("declining")) {
      if (awareness?.trends?.status !== "ACTIVE") {
        return "System Awareness is still collecting multi-day snapshots. Keep using the app across multiple days so a real progression trend can be calculated.";
      }
      const improving = awareness.trends.improving;
      const declining = awareness.trends.declining;
      return `Trend memory: ${improving ? `${improving.name} is up ${improving.delta}.` : "No positive attribute movement detected in the stored window."} ${declining ? `${declining.name} is down ${Math.abs(declining.delta)}.` : "No declining attribute detected."}`;
    }

    if (q.includes("recovery directive") || q.includes("recover from failure")) {
      return awareness?.recoveryDirective
        ? `${awareness.recoveryDirective.reason}. Recommended recovery directive: ${awareness.recoveryDirective.task} This is advisory and does not award XP.`
        : "No recovery directive is required. Recent activity and momentum are inside normal System parameters.";
    }

    if (
      q.includes(
        "what should i train"
      ) ||
      q.includes(
        "what should i do"
      ) ||
      q.includes(
        "today"
      )
    ) {
      return `Current directive: prioritize your active quests and any available ${profile.path} training that is not locked. If recovery feels poor, choose the lowest-intensity valid session rather than forcing a max-effort workout.`;
    }

    if (
      q.includes(
        "boss"
      )
    ) {
      return activeBoss
        ? `Active Boss: ${activeBoss.name}. Current HP: ${Number(activeBoss.hp ?? activeBoss.maxHp ?? 0)}/${Number(activeBoss.maxHp ?? 0)}. Complete its objectives and use verified training/GPS actions to reduce HP.`
        : raidKeyDetected
          ? "No active Boss is visible. Your Raid Entry Key is detected, so open Quests → Boss Gate and request the next System-selected Boss. The backend makes the final assignment."
          : "No active Boss is visible. The Boss gate is locked until the backend awards the Raid Entry Key; the current requirement is Level 5 plus a 3-day Daily streak.";
    }

    if (
      q.includes(
        "xp"
      ) ||
      q.includes(
        "level"
      )
    ) {
      return `You are Level ${Number(profile.level || 1)} with ${Number(profile.xp || 0)} current XP. Progression rewards are verified by the backend; System Intelligence cannot grant XP directly.`;
    }

    return `I can answer app-related questions using your current System state: how to level up, XP and streaks, Quest Board proof and timers, Adaptive directives, training, GPS, Boss and Raid Key status, class specials, Fuel, Archive books, Inventory, Journey logs, trophies, routines and settings. You are currently Level ${level}, ${profile.path}. Ask naturally—for example: “How do I level up from here?” or “Why is my Boss gate locked?”`;
  }

  async function ensureOnDeviceAi() {
    if (
      aiSessionRef.current
    ) {
      return aiSessionRef.current;
    }

    if (
      typeof window ===
        "undefined" ||
      typeof window.LanguageModel ===
        "undefined"
    ) {
      setAiMode(
        "GUIDANCE"
      );
      return null;
    }

    try {
      const options = {
        expectedInputs: [
          {
            type:
              "text",
            languages: [
              "en",
            ],
          },
        ],
        expectedOutputs: [
          {
            type:
              "text",
            languages: [
              "en",
            ],
          },
        ],
      };

      const availability =
        await window.LanguageModel.availability(
          options
        );

      if (
        availability ===
        "unavailable"
      ) {
        setAiMode(
          "GUIDANCE"
        );
        return null;
      }

      setAiMode(
        availability ===
          "downloading" ||
        availability ===
          "downloadable"
          ? "DOWNLOADING"
          : "LOCAL_AI"
      );

      let context =
        null;

      try {
        const response =
          await getSystemIntelligenceContext();

        context =
          response?.data ||
          null;
      } catch {
        context =
          null;
      }

      const initialPrompts = [
        {
          role:
            "system",
          content:
            "You are SYSTEM INTELLIGENCE, an in-app guidance core for a real-world progression RPG. Be concise, practical and calm. Answer broad questions about how THE SYSTEM works and how the player can progress: levels and XP, streaks, Daily/Must/Adaptive quests and proof, training, GPS, Boss and Raid Key gates, class specials, Fuel, Grand Archive books, inventory, Journey logs, trophies, routines and settings. Turn a broad progression question into 2–5 concrete next actions that fit the supplied player state. Never claim XP, mastery, rewards, Boss damage or quest completion unless the supplied player state confirms it. Do not invent health diagnoses. For sharp pain or injury, advise stopping and seeking appropriate professional care. Current player context: " +
            JSON.stringify(
              {
                ...(context || {
                  class:
                    profile.path,
                  level:
                    profile.level,
                  xp:
                    profile.xp,
                  attributes:
                    profile.attributes,
                }),
                awareness:
                  awareness?.context || null,
              }
            ),
        },
      ];

      const transcript =
        loadLocalTranscript()
          .slice(
            -12
          )
          .filter(
            (item) =>
              item?.role ===
                "user" ||
              item?.role ===
                "assistant"
          )
          .map(
            (item) => ({
              role:
                item.role,
              content:
                String(
                  item.content ||
                  ""
                ),
            })
          );

      initialPrompts.push(
        ...transcript
      );

      const session =
        await window.LanguageModel.create({
          ...options,
          initialPrompts,
          monitor(monitor) {
            monitor.addEventListener(
              "downloadprogress",
              (event) => {
                const percent =
                  Math.round(
                    Number(
                      event.loaded ||
                      0
                    ) *
                      100
                  );

                setAiDownload(
                  percent
                );
                setAiMode(
                  "DOWNLOADING"
                );
              }
            );
          },
        });

      aiSessionRef.current =
        session;

      setAiDownload(
        100
      );
      setAiMode(
        "LOCAL_AI"
      );

      return session;
    } catch (error) {
      console.warn(
        "ON-DEVICE SYSTEM INTELLIGENCE UNAVAILABLE:",
        error
      );

      setAiMode(
        "GUIDANCE"
      );

      return null;
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    let alive =
      true;

    async function connect() {
      let cloudCoreReady =
        false;

      const localMessages =
        loadLocalTranscript();

      if (
        alive &&
        localMessages.length
      ) {
        setMessages(
          localMessages
        );
      }

      try {
        const response =
          await getSystemIntelligenceStatus();

        const nextStatus =
          response?.data ||
          null;

        cloudCoreReady =
          Boolean(
            nextStatus?.model_connected
          );

        if (alive) {
          setStatus(
            nextStatus
          );

          if (cloudCoreReady) {
            setAiMode(
              "CLOUD_AI"
            );
          }
        }

        if (
          threadId &&
          !localMessages.length
        ) {
          const history =
            await getSystemIntelligenceHistory(
              threadId
            );

          if (
            alive
          ) {
            setMessages(
              history?.data ||
              []
            );
          }
        }
      } catch (error) {
        console.error(
          "SYSTEM INTELLIGENCE MEMORY CONNECT FAILED:",
          error
        );

        if (alive) {
          setStatus({
            online:
              false,
            model_connected:
              false,
          });
        }
      }

      if (
        alive &&
        !cloudCoreReady
      ) {
        void ensureOnDeviceAi();
      }
    }

    connect();

    return () => {
      alive =
        false;
    };
  }, [
    open,
    threadId,
  ]);

  async function checkIntelligenceConnection() {
    if (connectionChecking) {
      return;
    }

    setConnectionChecking(true);

    try {
      const response =
        await getSystemIntelligenceStatus();

      const nextStatus =
        response?.data ||
        {
          online: false,
          model_connected: false,
        };

      setStatus(nextStatus);

      if (nextStatus?.model_connected) {
        setAiMode("CLOUD_AI");
      } else {
        void ensureOnDeviceAi();
      }
    } catch (connectionError) {
      console.warn(
        "SYSTEM INTELLIGENCE CONNECTION CHECK FAILED:",
        connectionError
      );

      setStatus({
        online: false,
        model_connected: false,
      });
    } finally {
      setConnectionChecking(false);
    }
  }


  function wantsTutorialResources(question) {
    const q = String(question || "").toLowerCase();
    return Boolean(
      exerciseGuideForText(question) ||
      /\b(tutorial|video|show me|demonstrate|proper form|form check|how to do|how do i do|technique)\b/.test(q)
    );
  }

  function wantsBookResources(question) {
    const q = String(question || "").toLowerCase();
    return /\b(book|books|read|reading|archive|author|novel|biography)\b/.test(q) &&
      /\b(find|search|show|recommend|open|read|source|preview|book|archive)\b/.test(q);
  }

  async function sendMessage() {
    const content = input.trim();

    if (!content || sending) {
      return;
    }

    setSending(true);
    setInput("");

    const optimistic = {
      id: "LOCAL-USER-" + Date.now(),
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };

    const withUser = [...messages, optimistic];
    setMessages(withUser);
    persistLocalTranscript(withUser);

    let answer = "";
    let resources = [];
    let cloudSucceeded = false;
    let conversationThreadId =
      threadId ||
      "";

    try {
      try {
        const apiResult = await askSystemIntelligenceApi({
          message: content,
          threadId: threadId || null,
          awareness: awareness?.context || awareness || null,
          playerContext: intelligencePlayerContext(),
        });

        cloudSucceeded = Boolean(apiResult);
        answer = String(apiResult?.answer || "").trim();
        resources = Array.isArray(apiResult?.resources)
          ? apiResult.resources
          : [];

        const returnedThread = String(apiResult?.thread_id || "").trim();
        if (returnedThread) {
          conversationThreadId = returnedThread;
        }
        if (returnedThread && returnedThread !== threadId) {
          setThreadId(returnedThread);
          localStorage.setItem("systemIntelligenceThread", returnedThread);
        }

        setStatus((previous) => ({
          ...(previous || {}),
          online: apiResult?.online !== false,
          model_connected: Boolean(apiResult?.model_connected),
          api_mode: apiResult?.mode || null,
          model: apiResult?.model || null,
          configuration: apiResult?.configuration || null,
          warning: apiResult?.warning || null,
        }));

        if (apiResult?.model_connected) {
          setAiMode("CLOUD_AI");
        } else if (aiMode !== "LOCAL_AI" && aiMode !== "DOWNLOADING") {
          setAiMode("GUIDANCE");
        }
      } catch (apiError) {
        void reportSystemError(apiError, "AI");
        setStatus(previous => ({...(previous || {}), online:false, model_connected:false, warning:"The AI connection is unavailable. Built-in app guidance is active; you can resend your question when connected."}));
        setAiMode("GUIDANCE");
        console.warn("SYSTEM AI API DEGRADED:", apiError);
      }

      // Guarantee the user's requested in-app tutorial experience even if
      // the model did not choose the tutorial tool itself.
      if (
        wantsTutorialResources(content) &&
        !resources.some((item) => item?.type === "tutorial")
      ) {
        try {
          const guide = exerciseGuideForText(content);
          const tutorialQuery = guide
            ? `${guide.name} proper form tutorial`
            : content;
          const tutorials = await searchSystemTutorials(tutorialQuery, {
            maxResults: 3,
            regionCode: "KE",
            language: "en",
          });
          resources = [...resources, ...tutorials.slice(0, 3)];
        } catch (tutorialError) {
          console.warn("IN-SYSTEM TUTORIAL SEARCH DEGRADED:", tutorialError);
        }
      }

      if (
        wantsBookResources(content) &&
        !resources.some((item) => item?.type === "book")
      ) {
        try {
          const books = await searchSystemBooks(content, { maxResults: 5 });
          resources = [...resources, ...books.slice(0, 5)];
        } catch (bookError) {
          console.warn("SYSTEM BOOK SEARCH DEGRADED:", bookError);
        }
      }

      // If the server is unreachable, preserve the existing on-device AI
      // as a privacy-friendly fallback. The cloud API remains first choice.
      if (!answer && !cloudSucceeded) {
        const session = await ensureOnDeviceAi();
        if (session) {
          try {
            answer = String(
              await session.prompt(
                awareness?.context
                  ? "LIVE SYSTEM AWARENESS: " +
                      JSON.stringify(awareness.context) +
                      "\nPLAYER MESSAGE: " +
                      content
                  : content
              )
            ).trim();
          } catch (promptError) {
            console.warn("LOCAL AI PROMPT FAILED:", promptError);
          }
        }
      }

      if (!answer) {
        answer = fallbackSystemAnswer(content);
      }

      const assistantMessage = {
        id: "LOCAL-SYSTEM-" + Date.now(),
        role: "assistant",
        content: answer,
        resources,
        sourceQuestion: content,
        created_at: new Date().toISOString(),
      };

      const finalMessages = [...withUser, assistantMessage];
      setMessages(finalMessages);
      persistLocalTranscript(
        finalMessages,
        conversationThreadId
      );
    } catch (error) {
      console.error("SYSTEM INTELLIGENCE RESPONSE FAILED:", error);

      const fallback = fallbackSystemAnswer(content);
      const finalMessages = [
        ...withUser,
        {
          id: "SYSTEM-FALLBACK-" + Date.now(),
          role: "assistant",
          content: fallback,
          resources,
          sourceQuestion: content,
          created_at: new Date().toISOString(),
        },
      ];

      setMessages(finalMessages);
      persistLocalTranscript(
        finalMessages,
        conversationThreadId
      );
    } finally {
      setSending(false);
    }
  }

  const aiSetupRequired =
    status?.mode ===
      "OPENAI_API_KEY_MISSING" ||
    status?.configuration?.openai ===
      false;

  const aiCoreWarning =
    status?.warning &&
    status.warning !==
      "OPENAI_API_KEY_MISSING"
      ? String(status.warning)
      : "";


  return (
    <div
      className={
        "system-intelligence-float " +
        (
          open
            ? "is-open"
            : ""
        )
      }
    >
      {open && (
        <section
          className="system-intelligence-float-panel"
          aria-label="System Intelligence"
        >
          <div className="system-intelligence-float-head">
            <div className="system-intelligence-avatar">
              {classData.icon}
            </div>

            <div>
              <small className="system-intelligence-kicker">
                GUIDANCE CORE
              </small>

              <strong className="system-intelligence-title">
                SYSTEM INTELLIGENCE
              </strong>
            </div>

            <div className="system-intelligence-head-actions">
              <button
                type="button"
                onClick={
                  startNewIntelligenceChat
                }
              >
                NEW CHAT
              </button>

              <button
                type="button"
                className={
                  historyOpen
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setHistoryOpen(
                    !historyOpen
                  )
                }
              >
                HISTORY
              </button>

              <button
                type="button"
                className="system-intelligence-close"
                onClick={() =>
                  setOpen(false)
                }
                aria-label="Close System Intelligence"
              >
                ×
              </button>
            </div>
          </div>

          <div className="system-intelligence-status">
            <i />

            <span>
              {aiMode ===
                "CLOUD_AI"
                ? "ONLINE // OPENAI API CORE"
                : aiMode ===
                    "LOCAL_AI"
                  ? "ONLINE // ON-DEVICE AI FALLBACK"
                  : aiMode ===
                      "DOWNLOADING"
                    ? "INITIALIZING LOCAL AI // " +
                      aiDownload +
                      "%"
                    : aiSetupRequired
                      ? "BUILT-IN GUIDANCE // AI UNAVAILABLE"
                    : status?.online
                      ? "ONLINE // GUIDANCE FALLBACK"
                      : status ? "BUILT-IN GUIDANCE // CONNECTION UNAVAILABLE" : "CONNECTING // SYSTEM CORE"}
            </span>
          </div>

          <div className="system-intelligence-message">
            <span className="system-intelligence-speaker">
              SYSTEM
            </span>

            <p>
              {aiMode ===
                "CLOUD_AI"
                ? "AI Core is connected. Ask anything about how your System works—progression, XP, quests, training, GPS, Boss gates, class specials, Fuel, Archive books, logs or trophies—and request supported tutorials directly in this panel."
                : aiMode ===
                    "LOCAL_AI"
                  ? "On-device intelligence is active as a fallback. Ask about exercises, substitutions, skills, quests, Boss progress or your training."
                  : aiMode ===
                      "DOWNLOADING"
                    ? "Chrome is preparing the local fallback model. Cloud System Intelligence remains the preferred path when configured."
                    : aiSetupRequired
                      ? "Live AI isn’t connected right now. Built-in guidance can still explain your quests, class, XP, Fuel and Archive."
                      : aiCoreWarning
                        ? "The live AI connection could not finish the last response. Built-in guidance is available. Check the connection, then resend your question."
                        : "Built-in guidance is active. Ask about your progression, quests, Boss gates, Fuel, Archive, logs or trophies."}
            </p>

            {(aiSetupRequired || aiCoreWarning) && (
              <button
                type="button"
                onClick={
                  checkIntelligenceConnection
                }
                disabled={
                  connectionChecking
                }
              >
                {connectionChecking
                  ? "CHECKING..."
                  : "CHECK CONNECTION"}
              </button>
            )}
          </div>

          {historyOpen ? (
            <div className="system-intelligence-history">
              <div className="system-intelligence-history-head">
                <small>
                  CONVERSATION ARCHIVE
                </small>

                <strong>
                  HISTORY
                </strong>
              </div>

              {chatHistory.length ===
              0 ? (
                <div className="system-intelligence-history-empty">
                  No previous conversations yet.
                </div>
              ) : (
                chatHistory.map(
                  (chat) => (
                    <button
                      type="button"
                      key={
                        chat.id
                      }
                      className={
                        chat.id ===
                        localChatId
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        openHistoryChat(
                          chat
                        )
                      }
                    >
                      <span>
                        {
                          chat.title
                        }
                      </span>

                      <small>
                        {chat.updatedAt
                          ? new Date(
                              chat.updatedAt
                            ).toLocaleString()
                          : ""}
                      </small>
                    </button>
                  )
                )
              )}
            </div>
          ) : (
            <div className="system-intelligence-chat-log">
              {messages.map(
                (message) => {
                  const messageResources =
                    Array.isArray(
                      message.resources
                    )
                      ? message.resources
                      : [];

                  const tutorialResources =
                    messageResources.filter(
                      (item) =>
                        item?.type ===
                        "tutorial"
                    );

                  const bookResources =
                    messageResources.filter(
                      (item) =>
                        item?.type ===
                        "book"
                    );

                  return (
                    <div
                      key={
                        message.id
                      }
                      className={
                        "system-intelligence-chat-message " +
                        message.role
                      }
                    >
                      <span>
                        {message.role ===
                        "user"
                          ? "PLAYER"
                          : "SYSTEM"}
                      </span>

                      <p>
                        {
                          message.content
                        }
                      </p>

                      {tutorialResources.length > 0 && (
                        <div className="system-intelligence-resource-stack">
                          {tutorialResources.map((resource) => (
                            <SystemTutorialEmbed
                              key={
                                resource.video_id ||
                                resource.title
                              }
                              resource={resource}
                            />
                          ))}
                        </div>
                      )}

                      {bookResources.length > 0 && (
                        <div className="system-intelligence-book-stack">
                          {bookResources.map((resource) => (
                            <SystemBookResourceCard
                              key={
                                resource.volume_id ||
                                resource.title
                              }
                              resource={resource}
                              setTab={setTab}
                              setOpen={setOpen}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}

          <div
            className={
              historyOpen
                ? "system-intelligence-input-row is-hidden"
                : "system-intelligence-input-row"
            }
          >
            <input
              value={input}
              placeholder={
                sending
                  ? "SYSTEM INTELLIGENCE IS THINKING..."
                  : "ASK SYSTEM INTELLIGENCE..."
              }
              onChange={(event) =>
                setInput(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  sendMessage();
                }
              }}
              aria-label="System Intelligence input"
            />

            <button
              type="button"
              disabled={
                sending ||
                !input.trim()
              }
              onClick={
                sendMessage
              }
            >
              {sending
                ? "…"
                : "↑"}
            </button>
          </div>
        </section>
      )}

      <button
        type="button"
        className="system-intelligence-launcher"
        onClick={() =>
          setOpen(!open)
        }
        aria-expanded={open}
        aria-label={
          open
            ? "Close System Intelligence"
            : "Open System Intelligence"
        }
        title="SYSTEM INTELLIGENCE"
      >
        <span className="system-intelligence-launcher-icon">
          {classData.icon}
        </span>

        <i
          className={
            status?.online
              ? "system-intelligence-online-dot"
              : "system-intelligence-offline-dot"
          }
        />
      </button>
    </div>
  );
}
