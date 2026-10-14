import React, { useEffect, useRef, useState } from 'react';
import { classTrainingFor } from './systemClassTraining.js';
import { formatSpecialTime, recordingMimeType, specialCountdown, tankSetError } from './systemClassSpecialCore.js';
import { loadClassSpecial, startClassSpecial, cancelClassSpecial, completeClassSpecial, uploadClassSpecialClip, deleteClassSpecialClip } from './systemClassSpecialApi.js';

export default function ClassSpecial({ profile, saveProfile, refreshProfile, setTab, PageHero, SectionLabel }) {
  const path = profile.path;
  const protocol = classTrainingFor(path);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(path !== 'MAGE');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  const [reflection, setReflection] = useState('');
  const [exercise, setExercise] = useState('');
  const [sets, setSets] = useState(() => Array.from({ length: 3 }, () => ({ reps: '', load_kg: '0' })));
  const [clip, setClip] = useState(null);
  const [preview, setPreview] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [openingCamera, setOpeningCamera] = useState(false);
  const liveVideoRef = useRef(null);
  const cameraRef = useRef(null);
  const recorderRef = useRef(null);
  const recordStartRef = useRef(0);
  const recordStopRef = useRef(0);
  const discardRecordingRef = useRef(false);
  const recordingTimeoutRef = useRef(null);
  const pendingRef = useRef(false);
  const aliveRef = useRef(true);
  const cameraGenerationRef = useRef(0);
  const uploadedRef = useRef('');

  function acceptState(data) {
    if (data.class !== path) throw new Error('Your class changed. Reopen Class Special to refresh.');
    if (!aliveRef.current) return;
    setState(data);
    setOffset(Date.parse(data.server_now) - Date.now());
    setNow(Date.now());
  }

  function releaseCamera() {
    clearTimeout(recordingTimeoutRef.current);
    cameraRef.current?.getTracks().forEach((track) => track.stop());
    cameraRef.current = null;
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
  }

  useEffect(() => {
    aliveRef.current = true;
    let active = true;
    if (path !== 'MAGE') {
      loadClassSpecial().then((data) => { if (active) acceptState(data); })
        .catch((error) => { if (active) setNotice({ error: true, text: error.message }); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => {
      active = false;
      aliveRef.current = false;
      cameraGenerationRef.current += 1;
      discardRecordingRef.current = true;
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      releaseCamera();
    };
  }, [path]);

  useEffect(() => {
    if ((!state?.session || !state.session.target_seconds) && !recording) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state?.session?.id, recording]);

  useEffect(() => {
    if (!clip) { setPreview(''); return; }
    const url = URL.createObjectURL(clip.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [clip]);

  useEffect(() => {
    if (recording && liveVideoRef.current && cameraRef.current) {
      liveVideoRef.current.srcObject = cameraRef.current;
      void liveVideoRef.current.play().catch(() => undefined);
    }
  }, [recording]);

  async function action(task) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setBusy(true);
    setNotice(null);
    try { await task(); }
    catch (error) {
      if (aliveRef.current) setNotice({ error: true, text: String(error?.message || 'Connection failed. Your input is still here; try again.').replaceAll('_', ' ') });
    } finally {
      pendingRef.current = false;
      if (aliveRef.current) setBusy(false);
    }
  }

  async function ensureSession() {
    const data = await startClassSpecial(path);
    acceptState(data);
    if (data.completed_today) throw new Error('Today’s special reward is already recorded. The next reward opens at 00:00 UTC.');
    if (!data.session) throw new Error('The session could not start. Please retry.');
    return data.session;
  }

  function stopSelfRecording() {
    if (recorderRef.current?.state === 'recording') {
      recordStopRef.current = performance.now();
      recorderRef.current.stop();
    }
  }

  async function discardCommanderClip() {
    await action(async () => {
      // Invalidate a pending getUserMedia response as well as an active clip.
      cameraGenerationRef.current += 1;
      discardRecordingRef.current = true;
      stopSelfRecording();
      releaseCamera();
      if (uploadedRef.current) await deleteClassSpecialClip(uploadedRef.current);
      uploadedRef.current = '';
      setClip(null);
      setRecording(false);
      setRecordedSeconds(0);
      setOpeningCamera(false);
    });
  }

  async function startSelfRecording() {
    if (pendingRef.current || recording || openingCamera) return;
    await action(async () => {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Camera recording needs a supported browser on HTTPS or localhost.');
      await ensureSession();
      const generation = ++cameraGenerationRef.current;
      setOpeningCamera(true);
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: true });
        if (!aliveRef.current || generation !== cameraGenerationRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
        if (uploadedRef.current) await deleteClassSpecialClip(uploadedRef.current);
        uploadedRef.current = '';
        setClip(null);
        discardRecordingRef.current = false;
        cameraRef.current = stream;
        const mimeType = recordingMimeType(window.MediaRecorder);
        const recorder = new window.MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 1800000 });
        recorderRef.current = recorder;
        const chunks = [];
        recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = () => {
          discardRecordingRef.current = true;
          releaseCamera();
          if (aliveRef.current) { setRecording(false); setNotice({ error: true, text: 'The camera stopped. Please record again.' }); }
        };
        recorder.onstop = () => {
          if (generation !== cameraGenerationRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
          const duration = ((recordStopRef.current || performance.now()) - recordStartRef.current) / 1000;
          releaseCamera();
          if (!aliveRef.current) return;
          setRecording(false);
          if (discardRecordingRef.current) return;
          const type = (recorder.mimeType || mimeType || chunks[0]?.type || 'video/webm').split(';')[0];
          const file = new File(chunks, `command-presence.${type === 'video/mp4' ? 'mp4' : 'webm'}`, { type });
          setRecordedSeconds(duration);
          if (!file.size) { setNotice({ error: true, text: 'No video was captured. Please record again.' }); return; }
          setClip({ file, duration, uploadId: crypto.randomUUID() });
          if (duration < 30 || duration > 65) setNotice({ error: true, text: 'Record 30–60 seconds before submitting. You can discard this clip and retake it.' });
        };
        recorder.start(1000);
        recordStartRef.current = performance.now();
        recordStopRef.current = 0;
        setRecordedSeconds(0);
        setRecording(true);
        recordingTimeoutRef.current = setTimeout(stopSelfRecording, 60000);
      } catch (error) {
        stream?.getTracks().forEach((track) => track.stop());
        releaseCamera();
        throw error;
      } finally { if (aliveRef.current) setOpeningCamera(false); }
    });
  }

  async function submit() {
    await action(async () => {
      const session = state?.session;
      if (!session) throw new Error('Start this practice first.');
      let result = { reflection: reflection.trim() };
      if (path === 'TANK') {
        const error = tankSetError(exercise, sets, reflection);
        if (error) throw new Error(error);
        result = { ...result, exercise: exercise.trim(), sets };
      } else if (path === 'COMMANDER') {
        if (!clip || clip.duration < 30 || clip.duration > 65) throw new Error('Record 30–60 seconds first.');
        if (reflection.trim().length < 20) throw new Error('Add a review of at least 20 characters.');
        const storagePath = uploadedRef.current || await uploadClassSpecialClip(clip.file, session, clip.uploadId);
        uploadedRef.current = storagePath;
        result = { ...result, storage_path: storagePath, duration_seconds: clip.duration };
      } else if (path === 'RANGER') {
        if (!state.gps_candidate) throw new Error('Finish your linked GPS route first, then refresh this practice.');
        result = { gps_session_id: state.gps_candidate.id };
      } else if (reflection.trim().length < 20) throw new Error('Describe the result you produced (at least 20 characters).');
      const receipt = await completeClassSpecial(session.id, result);
      if (receipt?.session?.status !== 'COMPLETED') throw new Error('Completion was not confirmed. Please retry.');
      uploadedRef.current = '';
      setClip(null);
      setState((current) => ({ ...current, session: null, completed_today: receipt.session, recent: [receipt.session, ...(current.recent || []).filter((item) => item.id !== receipt.session.id)].slice(0, 5) }));
      setReflection('');
      const reward = `PRACTICE COMPLETE · +${receipt.session.xp_reward} XP · +1 ${receipt.session.attribute_reward}`;
      setNotice({ text: receipt.reward_awarded ? reward : 'Practice already saved. No duplicate reward was added.' });
      try { await refreshProfile(); }
      catch { setNotice({ text: `${reward}. Saved on the server; reopen the Dashboard to refresh your totals.` }); }
    });
  }

  async function openGps() {
    await action(async () => {
      const session = await ensureSession();
      if (profile.activeGpsMission && profile.activeGpsMission.sourceId !== session.id) throw new Error('Finish or discard your current GPS mission in Training before starting Trail Marker.');
      saveProfile({ ...profile, activeGpsMission: { id: `special-${session.id}`, source: 'CLASS_SPECIAL', sourceId: session.id, name: 'TRAIL MARKER', targetKind: 'DURATION', targetDurationSeconds: session.target_seconds, targetDistanceKm: null } });
      setTab('training');
    });
  }

  const session = state?.session;
  const countdown = specialCountdown(session, now, offset);
  const completed = state?.completed_today;
  const duration = recording ? Math.max(0, (performance.now() - recordStartRef.current) / 1000) : recordedSeconds;
  const canSubmit = Boolean(session && countdown.ready && !busy && !recording && (path !== 'COMMANDER' || (clip?.duration >= 30 && clip.duration <= 65)) && (path !== 'RANGER' || state?.gps_candidate));

  return <div className="page class-training-page">
    <PageHero eyebrow={protocol.eyebrow} title={protocol.title} text={protocol.objective} />
    <section className="class-training-briefing card3d"><div><small>CLASS SPECIAL</small><strong>{state?.policy?.xp_reward ? `+${state.policy.xp_reward} XP · +1 ${state.policy.attribute_reward}` : protocol.reward}</strong></div>
      <p>{path === 'MAGE' ? 'Your reading progress and Knowledge Rank live in the Grand Archive.' : 'One special reward each day, resetting at 00:00 UTC. Your completed practice is saved to your account.'}</p></section>
    <SectionLabel number="01" title="PROTOCOL" />
    <ol className="class-training-steps card3d">{protocol.steps.map((step, i) => <li key={step}><span>0{i + 1}</span><p>{step}</p></li>)}</ol>
    {path === 'MAGE' ? <section className="class-training-route card3d"><div><h3>CONTINUE IN THE GRAND ARCHIVE</h3><p>Open a grimoire and resume reading inside THE SYSTEM.</p></div><button type="button" onClick={() => setTab('archive')}>OPEN ARCHIVE</button></section> : <section className="class-special-workspace card3d" aria-label={`${protocol.title} practice`}>
      {loading ? <p role="status">LOADING PRACTICE…</p> : !state ? <><p>Practice could not load.</p><button disabled={busy} onClick={() => action(async () => acceptState(await loadClassSpecial()))}>RETRY CONNECTION</button></> : completed ? <div role="status"><h3>TODAY’S SPECIAL COMPLETE</h3><p>{completed.title} · +{completed.xp_reward} XP · +1 {completed.attribute_reward}</p><p>Your next special reward opens at 00:00 UTC.</p></div> : <>
        {path === 'COMMANDER' ? <>
          <h3>LOOK INTO THE LENS. EXPLAIN ONE IDEA.</h3><p>Use the camera above your screen as your eye-contact target. Watch your own clip once, then note one thing to keep and one thing to improve.</p>
          <p className="special-clarification">Practice completion checks the session and uploaded clip. Eye contact is for your own review; it is not automatically scored.</p>
          <div className="special-controls">
            {!recording ? <button disabled={busy || openingCamera} onClick={startSelfRecording}>{openingCamera ? 'OPENING CAMERA…' : clip ? 'RECORD AGAIN' : 'START FRONT-CAMERA RECORDING'}</button> : <button onClick={stopSelfRecording}>STOP & REVIEW RECORDING</button>}
            {(recording || clip) && <button disabled={busy} className="commander-discard-recording" onClick={discardCommanderClip}>× DISCARD CLIP & RETAKE</button>}
            {(recording || clip) && <output className="class-special-clock" aria-label="Recording duration">{formatSpecialTime(duration)} / 01:00</output>}
          </div>
          {recording && <div className="special-camera-frame"><span>● LOOK TOWARD YOUR CAMERA</span><video ref={liveVideoRef} className="commander-video-preview" muted playsInline autoPlay /></div>}
          {preview && <video className="commander-video-preview" controls playsInline src={preview} />}
        </> : path === 'RANGER' ? <>
          <h3>20-MINUTE OUTDOOR ROUTE</h3><p>Keep GPS tracking active for at least 20 minutes and cover at least 200 metres. Return here after finishing to claim your practice.</p>
          {state.gps_candidate ? <p role="status">ROUTE READY · {Number(state.gps_candidate.distance_km).toFixed(2)} KM · {formatSpecialTime(state.gps_candidate.duration_seconds)}</p> : <button disabled={busy || countdown.expired} onClick={openGps}>OPEN GPS TRACKER</button>}
          <button disabled={busy} onClick={() => action(async () => acceptState(await loadClassSpecial()))}>REFRESH ROUTE STATUS</button>
        </> : <>
          {!session ? <button disabled={busy} onClick={() => action(ensureSession)}>{path === 'ASSASSIN' ? 'START 25-MINUTE FOCUS BLOCK' : 'START STRENGTH LOG'}</button> : path === 'ASSASSIN' ? <div className="class-special-timer"><small>{countdown.expired ? 'SESSION EXPIRED' : countdown.ready ? 'BLOCK COMPLETE · RECORD YOUR RESULT' : 'FOCUS BLOCK · TIME REMAINING'}</small><output className="class-special-clock" aria-label="Focus countdown">{formatSpecialTime(countdown.seconds)}</output><p>The countdown resumes if you reopen this page.</p></div> : <p>Record each completed set. This is an honest training log, not a form assessment.</p>}
          {path === 'TANK' && session && <><label className="special-field">EXERCISE<input maxLength={120} value={exercise} disabled={busy} onChange={(e) => setExercise(e.target.value)} placeholder="e.g. Bodyweight squat" /></label><div className="special-set-labels"><span>SET</span><span>REPS</span><span>LOAD (KG)</span></div>{sets.map((set, index) => <div className="special-set-row" key={index}><span>{index + 1}</span>{['reps', 'load_kg'].map((field) => <input key={field} type="number" aria-label={`Set ${index + 1} ${field === 'reps' ? 'reps' : 'load in kg'}`} min={field === 'reps' ? 1 : 0} max={field === 'reps' ? 100 : 500} step={field === 'reps' ? 1 : 0.25} disabled={busy} value={set[field]} onChange={(e) => setSets((rows) => rows.map((row, i) => i === index ? { ...row, [field]: e.target.value } : row))} />)}{sets.length > 3 && <button disabled={busy} aria-label={`Remove set ${index + 1}`} onClick={() => setSets((rows) => rows.filter((_, i) => i !== index))}>×</button>}</div>)}<small>Use 0 kg for bodyweight.</small><button disabled={busy || sets.length >= 12} onClick={() => setSets((rows) => [...rows, { reps: '', load_kg: '0' }])}>ADD SET</button></>}
        </>}
        {session && path !== 'RANGER' && <label className="special-field">{path === 'ASSASSIN' ? 'WHAT DID YOU FINISH?' : path === 'TANK' ? 'FORM & RECOVERY NOTE' : 'YOUR REVIEW'}<textarea maxLength={2000} disabled={busy || recording} value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder={path === 'ASSASSIN' ? 'Describe the concrete result you produced…' : 'One thing you did well and one thing to improve…'} /><small>{reflection.trim().length}/2000 · minimum 20 characters</small></label>}
        {countdown.expired && <p role="alert">This session expired after 24 hours. End it below, then start a new practice.</p>}
        {session && <div className="special-controls"><button disabled={!canSubmit} onClick={submit}>{busy ? 'SAVING…' : 'SAVE PRACTICE & CLAIM REWARD'}</button><button disabled={busy || recording} onClick={() => action(async () => { if (uploadedRef.current) await deleteClassSpecialClip(uploadedRef.current); uploadedRef.current = ''; acceptState(await cancelClassSpecial(session.id)); setClip(null); })}>END WITHOUT REWARD</button></div>}
      </>}
    </section>}
    {notice && <div role={notice.error ? 'alert' : 'status'} className={`class-training-notice ${notice.error ? 'error' : 'success'}`}><strong>{notice.text}</strong><button aria-label="Dismiss notice" onClick={() => setNotice(null)}>×</button></div>}
    {Boolean(state?.recent?.length) && <><SectionLabel number="02" title="RECENT PRACTICE" /><div className="class-training-history">{state.recent.map((entry) => <article className="card3d" key={entry.id}><small>{new Date(entry.completed_at).toLocaleDateString()}</small><strong>{entry.title}</strong><p>{entry.result?.reflection || `${Number(entry.result?.distance_km || 0).toFixed(2)} km recorded`}</p><em>+{entry.xp_reward} XP · +1 {entry.attribute_reward}</em></article>)}</div></>}
  </div>;
}
