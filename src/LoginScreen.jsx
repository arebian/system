import React from "react";
import { useState, useRef, useEffect } from "react";
import AccessShell from "./AccessShell.jsx";
import { recoveryMessage } from "./systemErrors.js";
import { reportSystemError } from "./systemErrorReporter.js";
import { withAppTimeout } from "./systemRequest.js";
import { isFoundationScanReady, foundationHeightToCm, getFoundationFuelRecommendation, getFoundationClassSuggestions, buildFoundationProfileData, getFoundationOpeningPlan, FOUNDATION_FOCUS_OPTIONS, FOUNDATION_EXPERIENCE_OPTIONS, FOUNDATION_ACTIVITY_OPTIONS, FOUNDATION_TIME_OPTIONS, FOUNDATION_MEAL_OPTIONS, FOUNDATION_OBSTACLE_OPTIONS, FOUNDATION_FOOD_PREFERENCE_OPTIONS, FOUNDATION_FOOD_BUDGET_OPTIONS, FOUNDATION_EQUIPMENT_OPTIONS } from "./systemFoundationScan.js";
import { FUEL_GOALS } from "./systemFuel.js";
import { normalizeProfile, createFingerprint, PATHS } from "./systemProfileCore.js";
import { syncProfileToCloud } from "./systemProfileApi.js";

export function LoginScreen({
  onComplete,
}) {
  const [name, setName] =
    useState("");

  const [age, setAge] =
    useState("");

  const [gender, setGender] =
    useState("");

  const [path, setPath] =
    useState("");

  const [stage, setStage] =
    useState("IDENTITY");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const inFlight = useRef(false);
  const panelRef = useRef(null);
  useEffect(() => {
    if (stage !== "IDENTITY") panelRef.current?.scrollIntoView({block:"start", behavior:"instant"});
  }, [stage]);

  const [focusGoals, setFocusGoals] = useState([]);
  const primaryFocus = focusGoals[0] || "";

  const [experience, setExperience] =
    useState("");

  const [activityLevel, setActivityLevel] =
    useState("");

  const [mainObstacle, setMainObstacle] =
    useState("");

  const [dailyMinutes, setDailyMinutes] =
    useState(0);

  const [weightKg, setWeightKg] =
    useState("");

  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const heightCm = foundationHeightToCm(heightFeet, heightInches);
  const heightStarted = heightFeet !== "" || heightInches !== "";
  const metricsReady = weightKg !== "" && Number(weightKg) >= 30 && Number(weightKg) <= 350 && (!heightStarted || heightCm !== null);

  const [mealsPerDay, setMealsPerDay] =
    useState("");

  const [equipment, setEquipment] =
    useState("");

  const [foodPreference, setFoodPreference] =
    useState("");

  const [foodBudget, setFoodBudget] =
    useState("");

  const [fuelGoal, setFuelGoal] =
    useState("");

  const scanInput = {
    primaryFocus,
    focusGoals,
    experience,
    activityLevel,
    mainObstacle,
    dailyMinutes,
    weightKg,
    heightCm,
    mealsPerDay,
    equipment,
    foodPreference,
    foodBudget,
  };

  const scanReady =
    isFoundationScanReady(
      scanInput
    );

  const fuelRecommendation =
    getFoundationFuelRecommendation(
      scanInput
    );

  const classSuggestions =
    getFoundationClassSuggestions(
      scanInput
    );

  const selectedFuelGoal =
    FUEL_GOALS.includes(
      fuelGoal
    )
      ? fuelGoal
      : fuelRecommendation.goal;

  const foundationProfileData =
    buildFoundationProfileData(
      scanInput,
      selectedFuelGoal
    );

  const openingPlan =
    getFoundationOpeningPlan({
      value: scanInput,
      path,
      fuelGoal: selectedFuelGoal,
    });

  const identityReady =
    name.trim() &&
    Number(age) >= 13 &&
    Number(age) <= 100 &&
    ["MALE", "FEMALE"].includes(
      gender
    );

  const stageOrder = [
    "IDENTITY",
    "FOUNDATION",
    "ROUTINE",
    "FUEL",
    "CLASS",
    "BRIEF",
  ];

  const stageIndex =
    stageOrder.indexOf(stage);

  function moveToFoundation() {
    if (identityReady) {
      setStage("FOUNDATION");
    }
  }

  function moveToClass() {
    if (scanReady) {
      setStage("CLASS");
    }
  }

  function moveToBrief() {
    if (!path) {
      return;
    }

    if (!fuelGoal) {
      setFuelGoal(
        fuelRecommendation.goal
      );
    }

    setStage("BRIEF");
  }

  function moveBack() {
    const previous =
      stageOrder[
        Math.max(0, stageIndex - 1)
      ];

    setStage(previous);
  }

  async function submit() {
    if (inFlight.current) return;
    const numericAge =
      Number(age);

    if (
      !name.trim() ||
      numericAge < 13 ||
      numericAge > 100 ||
      !["MALE", "FEMALE"].includes(
        gender
      ) ||
      !path ||
      !scanReady
    ) {
      return;
    }

    const cleanName =
      name
        .trim()
        .toUpperCase();

    const profile =
      normalizeProfile({
        name: cleanName,
        age: numericAge,
        gender,
        path,
        fingerprint:
          createFingerprint(
            cleanName,
            numericAge,
            path
          ),
        foundationScan:
          foundationProfileData,
        fuel: {
          goal: selectedFuelGoal,
          calorieTarget:
            foundationProfileData.estimatedCalorieTarget,
          proteinTarget:
            foundationProfileData.estimatedProteinTarget,
          logs: {},
        },
      });

    inFlight.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const result = await withAppTimeout(syncProfileToCloud(profile), 20000, "PROFILE_SAVE_TIMEOUT");
      if (!result?.ok) throw result?.error || new Error("PROFILE_SAVE_FAILED");
      // Enter only after identity and foundation answers have reached the backend.
      // Progression still comes from the subsequent authoritative profile refresh.
      try { localStorage.setItem("systemProfile", JSON.stringify(profile)); } catch { /* cloud remains authoritative */ }
      onComplete(profile);
    } catch (error) {
      void reportSystemError(error, "AUTH");
      setSaveError(recoveryMessage(error, "AUTH"));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <AccessShell foundation>
      <div className="login-panel" ref={panelRef} aria-busy={saving}>

        <div
          className="foundation-progress"
          aria-label={
            "Registration step " +
            String(stageIndex + 1) +
            " of " +
            String(stageOrder.length)
          }
        >
          {stageOrder.map((item, index) => (
            <span
              key={item}
              className={
                index <= stageIndex
                  ? "active"
                  : ""
              }
            >
              {String(index + 1).padStart(2, "0")} {item}
            </span>
          ))}
        </div>

        {stage === "IDENTITY" && (
          <section className="foundation-stage">
            <small>PLAYER IDENTITY</small>
            <h2>THE SYSTEM NEEDS A NAME.</h2>
            <p className="login-help">
              Start with the essentials. Your class remains your choice in the next phase.
            </p>

            <label>PLAYER NAME</label>
            <input
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="ENTER NAME"
              autoComplete="nickname"
            />

            <label>PLAYER AGE</label>
            <input
              type="number"
              min="13"
              max="100"
              value={age}
              onChange={(event) =>
                setAge(event.target.value)
              }
              placeholder="ENTER AGE"
            />

            <label>PLAYER GENDER</label>
            <p className="login-help">
              Used for profile identity and the initialization voice. It does not change progression.
            </p>

            <div className="gender-grid">
              {[
                ["MALE", "♂", "MALE VOICE"],
                ["FEMALE", "♀", "FEMALE VOICE"],
              ].map(([value, icon, voiceLabel]) => (
                <button
                  type="button"
                  key={value}
                  className={
                    gender === value
                      ? "gender-card selected"
                      : "gender-card"
                  }
                  aria-pressed={gender === value}
                  onClick={() => setGender(value)}
                >
                  <span>{icon}</span>
                  <strong>{value}</strong>
                  <small>{voiceLabel}</small>
                  {gender === value && (
                    <em className="gender-selected-state">✓ SELECTED</em>
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="initialize"
              disabled={!identityReady}
              onClick={moveToFoundation}
            >
              BEGIN FOUNDATION SCAN
            </button>
          </section>
        )}

        {stage === "FOUNDATION" && (
          <section className="foundation-stage">
            <small>PLAYER FOUNDATION SCAN</small>
            <h2>BUILD A PLAN THAT FITS REAL LIFE.</h2>
            <p className="login-help">
              These answers guide your Fuel, recovery and opening plan. They never select your class.
            </p>

            <label id="foundation-focus-label">WHAT DO YOU WANT TO IMPROVE?</label>
            <p className="login-help" id="foundation-focus-help">Choose every goal that matters to you. Your first selection is the main priority; tap a selected goal again to remove it.</p>
            <div className="foundation-option-grid focus-grid" role="group" aria-labelledby="foundation-focus-label" aria-describedby="foundation-focus-help">
              {FOUNDATION_FOCUS_OPTIONS.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={
                    focusGoals.includes(item.value)
                      ? "foundation-option selected"
                      : "foundation-option"
                  }
                  aria-pressed={focusGoals.includes(item.value)}
                  onClick={() => setFocusGoals(goals => goals.includes(item.value) ? goals.filter(goal => goal !== item.value) : [...goals, item.value])}
                >
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                  {focusGoals.includes(item.value) && <em className="foundation-focus-state">{primaryFocus === item.value ? "✓ MAIN PRIORITY" : "✓ ALSO SELECTED"}</em>}
                </button>
              ))}
            </div>

            {primaryFocus && <p className="foundation-focus-summary"><strong>{focusGoals.length} {focusGoals.length === 1 ? "GOAL" : "GOALS"} SELECTED</strong><span>Main priority: {FOUNDATION_FOCUS_OPTIONS.find(item => item.value === primaryFocus)?.label.toLowerCase()}.</span></p>}

            <label>YOUR STARTING EXPERIENCE</label>
            <div className="foundation-option-grid">
              {FOUNDATION_EXPERIENCE_OPTIONS.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={
                    experience === item.value
                      ? "foundation-option selected"
                      : "foundation-option"
                  }
                  aria-pressed={experience === item.value}
                  onClick={() => setExperience(item.value)}
                >
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </button>
              ))}
            </div>

            <label>YOUR STARTING MEASUREMENTS</label>
            <p className="login-help">
              Your weight is required to estimate Fuel targets. Height is optional; enter it in feet and inches. You still choose your class.
            </p>
            <div className="foundation-metric-grid">
              <label>
                CURRENT WEIGHT (KG) · REQUIRED
                <input
                  type="number"
                  min="30"
                  max="350"
                  step="0.1"
                  required
                  value={weightKg}
                  onChange={(event) => setWeightKg(event.target.value)}
                  placeholder="e.g. 61"
                />
              </label>
              <fieldset className="foundation-height-fields">
                <legend>HEIGHT · OPTIONAL</legend>
                <div className="foundation-height-pair">
                  <label>HEIGHT (FEET)<input type="number" min="4" max="7" step="1" value={heightFeet} onChange={event => setHeightFeet(event.target.value)} placeholder="e.g. 5" /></label>
                  <label>HEIGHT (INCHES)<input type="number" min="0" max="11" step="1" value={heightInches} onChange={event => setHeightInches(event.target.value)} placeholder="e.g. 9" /></label>
                </div>
              </fieldset>
            </div>
            {heightStarted && heightCm === null && <p className="foundation-metric-note" role="status">Enter a height from 4′ 0″ to 7′ 6″, using whole feet and 0–11 inches.</p>}
            {weightKg !== "" && (Number(weightKg) < 30 || Number(weightKg) > 350) && <p className="foundation-metric-note" role="status">Enter your weight between 30 and 350 kg.</p>}

            <div className="foundation-actions">
              <button type="button" className="foundation-back" disabled={saving} onClick={moveBack}>
                BACK
              </button>
              <button type="button" className="initialize" disabled={!primaryFocus || !experience || !metricsReady} onClick={() => setStage("ROUTINE")}>
                CONTINUE
              </button>
            </div>
          </section>
        )}

        {stage === "ROUTINE" && (
          <section className="foundation-stage">
            <small>REAL-LIFE ROUTINE</small>
            <h2>THE PLAN MUST FIT YOUR DAYS.</h2>

            <label>HOW ACTIVE ARE YOU OUTSIDE TRAINING?</label>
            <div className="foundation-option-grid">
              {FOUNDATION_ACTIVITY_OPTIONS.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={
                    activityLevel === item.value
                      ? "foundation-option selected"
                      : "foundation-option"
                  }
                  aria-pressed={activityLevel === item.value}
                  onClick={() => setActivityLevel(item.value)}
                >
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </button>
              ))}
            </div>

            <label>REALISTIC TIME EACH DAY</label>
            <div className="foundation-chip-grid">
              {FOUNDATION_TIME_OPTIONS.map((minutes) => (
                <button
                  type="button"
                  key={minutes}
                  className={
                    dailyMinutes === minutes
                      ? "foundation-chip selected"
                      : "foundation-chip"
                  }
                  aria-pressed={dailyMinutes === minutes}
                  onClick={() => setDailyMinutes(minutes)}
                >
                  {minutes} MIN
                </button>
              ))}
            </div>

            <label>WHAT MOST OFTEN GETS IN THE WAY?</label>
            <div className="foundation-chip-grid">
              {FOUNDATION_OBSTACLE_OPTIONS.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={
                    mainObstacle === item.value
                      ? "foundation-chip selected"
                      : "foundation-chip"
                  }
                  aria-pressed={mainObstacle === item.value}
                  onClick={() => setMainObstacle(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <label>WHAT TRAINING ACCESS DO YOU HAVE?</label>
            <div className="foundation-option-grid equipment-grid">
              {FOUNDATION_EQUIPMENT_OPTIONS.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={
                    equipment === item.value
                      ? "foundation-option selected"
                      : "foundation-option"
                  }
                  aria-pressed={equipment === item.value}
                  onClick={() => setEquipment(item.value)}
                >
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </button>
              ))}
            </div>

            <div className="foundation-actions">
              <button type="button" className="foundation-back" onClick={moveBack}>
                BACK
              </button>
              <button type="button" className="initialize" disabled={!activityLevel || !dailyMinutes || !mainObstacle || !equipment} onClick={() => setStage("FUEL")}>
                CONTINUE TO FUEL
              </button>
            </div>
          </section>
        )}

        {stage === "FUEL" && (
          <section className="foundation-stage">
            <small>FOOD & RECOVERY</small>
            <h2>A ROUTINE YOU CAN KEEP.</h2>
            <p className="login-help">Choose your usual meal rhythm and preferences. Your Fuel goal is yours to confirm in the final brief.</p>
            <label>YOUR USUAL MEAL RHYTHM</label>
            <div className="foundation-chip-grid">
              {FOUNDATION_MEAL_OPTIONS.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={
                    mealsPerDay === item.value
                      ? "foundation-chip selected"
                      : "foundation-chip"
                  }
                  aria-pressed={mealsPerDay === item.value}
                  onClick={() => setMealsPerDay(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <label>FOOD PREFERENCES</label>
            <div className="foundation-chip-grid">
              {FOUNDATION_FOOD_PREFERENCE_OPTIONS.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={
                    foodPreference === item.value
                      ? "foundation-chip selected"
                      : "foundation-chip"
                  }
                  aria-pressed={foodPreference === item.value}
                  onClick={() => setFoodPreference(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <label>FOOD ROUTINE BUDGET</label>
            <div className="foundation-option-grid">
              {FOUNDATION_FOOD_BUDGET_OPTIONS.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={
                    foodBudget === item.value
                      ? "foundation-option selected"
                      : "foundation-option"
                  }
                  aria-pressed={foodBudget === item.value}
                  onClick={() => setFoodBudget(item.value)}
                >
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </button>
              ))}
            </div>

            <div className="foundation-actions">
              <button type="button" className="foundation-back" onClick={moveBack}>BACK</button>
              <button type="button" className="initialize" disabled={!scanReady} onClick={moveToClass}>SEE CLASS IDEAS</button>
            </div>
          </section>
        )}

        {stage === "CLASS" && (
          <section className="foundation-stage">
            <small>CLASS CHOICE</small>
            <h2>CHOOSE THE PATH YOU WANT TO BUILD.</h2>
            <p className="login-help">
              THE SYSTEM found some possible fits from your scan. They are ideas only. Your class is always your decision.
            </p>

            <div className="foundation-signal">
              <small>FOUNDATION SIGNAL</small>
              <strong>
                {classSuggestions.map((item) => item.path).join(" • ")}
              </strong>
              <span>
                Based on your stated focus, routine and training access.
              </span>
            </div>

            <div className="path-grid foundation-path-grid">
              {Object.values(PATHS).map((item) => {
                const signal = classSuggestions.find((suggestion) => suggestion.path === item.name);

                return (
                  <button
                    type="button"
                    key={item.name}
                    className={
                      path === item.name
                        ? "path-card selected"
                        : "path-card"
                    }
                    style={{ "--card-accent": item.accent }}
                    onClick={() => setPath(item.name)}
                  >
                    <span>{item.icon}</span>
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                    {signal ? (
                      <em>SCAN FIT: {signal.reason}</em>
                    ) : (
                      <em>PRIMARY: {item.bonus}</em>
                    )}
                  </button>
                );
              })}
            </div>

            {path && (
              <div className="selected-class" style={{ borderColor: PATHS[path].accent }}>
                <strong>{PATHS[path].icon} {path} CHOSEN</strong>
                <p>{PATHS[path].identity}</p>
              </div>
            )}

            <div className="foundation-actions">
              <button type="button" className="foundation-back" onClick={moveBack}>
                BACK
              </button>
              <button type="button" className="initialize" disabled={!path} onClick={moveToBrief}>
                REVIEW FOUNDATION BRIEF
              </button>
            </div>
          </section>
        )}

        {stage === "BRIEF" && (
          <section className="foundation-stage foundation-brief">
            <small>PLAYER FOUNDATION BRIEF</small>
            <h2>YOUR FIRST WEEK HAS A SHAPE.</h2>

            <div className="foundation-focus-summary">
              <strong>YOUR GOALS</strong>
              {focusGoals.map((goal, index) => <span key={goal}>{index === 0 ? "Main priority: " : "Also: "}{FOUNDATION_FOCUS_OPTIONS.find(item => item.value === goal)?.label.toLowerCase()}.</span>)}
            </div>

            <article className="foundation-result">
              <small>FUEL DIRECTION SUGGESTED</small>
              <strong>{fuelRecommendation.goal}</strong>
              <p>{fuelRecommendation.reason}</p>
              <span>
                You decide the direction. THE SYSTEM uses this only to build your Fuel starting point.
              </span>
            </article>

            <label>CONFIRM YOUR CURRENT FUEL DIRECTION</label>
            <div className="foundation-goal-grid">
              {FUEL_GOALS.map((goal) => (
                <button
                  type="button"
                  key={goal}
                  className={
                    selectedFuelGoal === goal
                      ? "foundation-goal selected"
                      : "foundation-goal"
                  }
                  aria-pressed={selectedFuelGoal === goal}
                  onClick={() => setFuelGoal(goal)}
                >
                  <small>{goal === fuelRecommendation.goal ? "SYSTEM START" : "PLAYER CHOICE"}</small>
                  <strong>{goal}</strong>
                </button>
              ))}
            </div>

            {fuelRecommendation.hasBodyMetrics ? (
              <div className="foundation-targets">
                <span>
                  <small>STARTING CALORIES</small>
                  <strong>{foundationProfileData.estimatedCalorieTarget} KCAL</strong>
                </span>
                <span>
                  <small>STARTING PROTEIN</small>
                  <strong>{foundationProfileData.estimatedProteinTarget}G</strong>
                </span>
              </div>
            ) : (
              <p className="login-help foundation-metric-note">
                Add your weight in Fuel later when you want personal calorie and protein estimates.
              </p>
            )}

            <div className="foundation-chosen-path" style={{ borderColor: PATHS[path].accent }}>
              <span>{PATHS[path].icon}</span>
              <div>
                <small>PLAYER-CHOSEN CLASS</small>
                <strong>{path}</strong>
              </div>
            </div>

            <label>OPENING DIRECTIVES</label>
            <div className="foundation-directive-list">
              {openingPlan.map((directive, index) => (
                <article key={directive.type}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <small>{directive.type}</small>
                    <strong>{directive.title}</strong>
                    <p>{directive.detail}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="foundation-actions">
              <button type="button" className="foundation-back" onClick={moveBack}>
                BACK
              </button>
              <button type="button" className="initialize" disabled={saving} onClick={submit}>
                {saving ? "SAVING YOUR PLAN…" : "INITIALIZE SYSTEM"}
              </button>
            </div>
          </section>
        )}
        {saveError && <div className="auth-message" role="alert">{saveError} Your answers are still here. Try saving again.</div>}
      </div>
    </AccessShell>
  );
}
