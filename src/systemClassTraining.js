/* =========================================================
   THE SYSTEM 2.6 — CLASS TRAINING DEFINITIONS
   This module only defines training. The backend remains responsible for
   deciding whether a submitted skill attempt earns progression.
   ========================================================= */

export const CLASS_TRAINING = {
  COMMANDER: {
    id: "command-presence",
    title: "COMMAND PRESENCE",
    eyebrow: "COMMANDER SPECIAL // CHARISMA PRACTICE",
    proofType: "VIDEO",
    reward: "PRIVATE CHARISMA PRACTICE",
    objective: "Record yourself privately for 30–60 seconds. Introduce yourself, explain one idea clearly, and keep eye contact with your own camera lens.",
    steps: [
      "Open the front camera. No audience and no outside video are involved.",
      "Record yourself speaking for 30–60 seconds while looking into the lens.",
      "Watch it once. Name one thing you did well and one thing to improve.",
      "Submit the recording with a short reflection.",
    ],
    skillTerms: ["charisma", "public speaking", "communication", "leadership", "confidence", "presentation", "social"],
  },
  MAGE: {
    id: "grand-archive",
    title: "THE GRAND ARCHIVE",
    eyebrow: "MAGE SPECIAL // KNOWLEDGE PROGRESSION",
    proofType: "LEARNING",
    reward: "OFFICIAL ARCHIVE PROGRESSION",
    objective: "Choose a ranked book, read, log a real session and explain what changed in your thinking.",
    steps: ["Open the Archive.", "Select an unlocked grimoire.", "Read and log a real session.", "Clear it with a reflection when the official requirements are met."],
  },
  RANGER: {
    id: "trail-marker",
    title: "TRAIL MARKER",
    eyebrow: "RANGER SPECIAL // GPS FIELD PROOF",
    proofType: "PERFORMANCE",
    reward: "DAILY CLASS PRACTICE",
    objective: "Complete one outdoor movement session and leave a clean GPS trail that proves distance, pace and discipline.",
    steps: ["Open the linked GPS movement tracker.", "Choose a safe outdoor route.", "Move for 20 minutes, covering at least 200 metres.", "Finish tracking, then return here to save your practice."],
  },
  ASSASSIN: {
    id: "silent-target",
    title: "SILENT TARGET",
    eyebrow: "ASSASSIN SPECIAL // DEEP FOCUS",
    proofType: "RESULT",
    reward: "DAILY CLASS PRACTICE",
    objective: "Turn one 25-minute distraction-free block into a visible, concrete result.",
    steps: ["Choose one task worth finishing.", "Remove the distraction before the timer begins.", "Work silently until the block ends.", "Submit the result, not just the intention."],
  },
  TANK: {
    id: "iron-ledger",
    title: "IRON LEDGER",
    eyebrow: "TANK SPECIAL // REPEATABLE STRENGTH",
    proofType: "PERFORMANCE",
    reward: "DAILY CLASS PRACTICE",
    objective: "Build strength that can be repeated: record honest sets, reps and the adjustment you made for form or recovery.",
    steps: ["Start your strength log.", "Complete strength work with controlled form.", "Record at least three real sets, reps and load.", "Save your log with the form or recovery adjustment you made."],
  },
};

export function classTrainingFor(path) {
  const key = String(path || "COMMANDER").toUpperCase();
  return CLASS_TRAINING[key] || CLASS_TRAINING.COMMANDER;
}

export function findClassTrainingSkill(skills, path, terms = []) {
  const className = String(path || "").toUpperCase();
  const words = terms.map((term) => String(term).toLowerCase());

  return (Array.isArray(skills) ? skills : []).find((skill) => {
    const affinity = String(skill?.class_affinity || "").toUpperCase();
    const text = [
      skill?.name,
      skill?.description,
      skill?.progression_group,
      skill?.category,
    ]
      .join(" ")
      .toLowerCase();

    const charisma = String(skill?.primary_attribute || skill?.progression_group || "").toUpperCase();
    return affinity.includes(className) && (className !== "COMMANDER" || charisma === "CHARISMA") && words.some((word) => text.includes(word));
  }) || null;
}
