import React from "react";
import { Component, useState, useRef, useEffect } from "react";
import { withAppTimeout, AUTH_BOOT_TIMEOUT_MS } from "./systemRequest.js";
import { supabase } from "./supabaseClient.js";
import { normalizeProfile } from "./systemProfileCore.js";
import { bootstrapAuthoritativeProfile, hydrateStructuredProfile } from "./systemCloud.js";
import { loadProfileFromCloud, syncProfileToCloud } from "./systemProfileApi.js";
import { CloudBootScreen, AuthScreen } from "./AuthScreen.jsx";
import "./styles/system.css";
import "./styles/stability.css";
import { reportSystemError } from "./systemErrorReporter.js";
import { recoveryMessage } from "./systemErrors.js";
const SystemGame = React.lazy(() => import("./SystemGame.jsx"));

export class SystemRuntimeBoundary extends Component {
  constructor(props) {
    super(props);

    this.state = {
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      error,
    };
  }

  componentDidCatch(error, info) {
    void reportSystemError(error, "RUNTIME");
    console.error(
      "SYSTEM RUNTIME FAILURE:",
      error,
      info
    );
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const message =
      this.state.error?.message ||
      "UNKNOWN RUNTIME ERROR";

    return (
      <div className="system-runtime-failure">
        <div className="system-runtime-failure-card">
          <span>
            SYSTEM RECOVERY MODE
          </span>

          <h1>
            INTERFACE FAILURE DETECTED
          </h1>

          <p>
            {recoveryMessage(this.state.error)}
          </p>

          <code>
            {message}
          </code>

          <div className="system-runtime-actions">
            <button
              type="button"
              onClick={() =>
                window.location.reload()
              }
            >
              RELOAD SYSTEM
            </button>

            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem(
                    "systemProfile"
                  );
                } catch (storageError) {
                  console.warn(
                    "SYSTEM CACHE RESET DEGRADED:",
                    storageError
                  );
                }

                window.location.reload();
              }}
            >
              RESET LOCAL CHARACTER CACHE
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export function SystemAppRuntime() {
  const [authReady,setAuthReady]=useState(false);
  const [user,setUser]=useState(null);
  const [gameReady,setGameReady]=useState(false);
  const [bootMessage,setBootMessage]=useState("CONNECTING TO SYSTEM CLOUD...");
  const activeUserIdRef=useRef(null);

  useEffect(()=>{
    let active=true;

    async function bootAuth(){
      try {
        const {
          data,
          error,
        }=await withAppTimeout(
          supabase.auth.getSession(),
          AUTH_BOOT_TIMEOUT_MS,
          "AUTH_SESSION_TIMEOUT"
        );

        if(!active)return;

        if(error){
          console.error(
            "SYSTEM AUTH BOOT ERROR:",
            error.message
          );
        }

        const sessionUser=
          data?.session?.user||null;

        activeUserIdRef.current=
          sessionUser?.id||null;

        setUser(sessionUser);
        setAuthReady(true);
      } catch (error) {
        if(!active)return;

        console.error(
          "SYSTEM AUTH BOOT FAILED:",
          error
        );
        activeUserIdRef.current=null;
        setUser(null);
        setBootMessage(
          "AUTH LINK DEGRADED • PLEASE SIGN IN AGAIN"
        );
        setAuthReady(true);
      }
    }

    void bootAuth();

    const {data:listener}=
      supabase.auth.onAuthStateChange(
        (event,session)=>{
          if(!active)return;

          const nextUser=
            session?.user||null;

          const nextId=
            nextUser?.id||null;

          const changedUser=
            nextId !==
            activeUserIdRef.current;

          activeUserIdRef.current=
            nextId;

          setUser(nextUser);
          setAuthReady(true);

          // V8 reset gameReady on EVERY auth event.
          // TOKEN_REFRESHED could therefore put the app back
          // on the cloud loader without re-running prepareGame.
          // Only reset when the actual signed-in account changes.
          if(changedUser){
            setGameReady(false);
          }

          if(event==="SIGNED_OUT"){
            setGameReady(false);
          }
        }
      );

    return ()=>{
      active=false;
      listener?.subscription?.unsubscribe();
    };
  },[]);

  useEffect(()=>{
    let active=true;

    function publishCloudProfile(
      nextProfile
    ){
      if(
        !nextProfile ||
        !active
      ){
        return;
      }

      try{
        localStorage.setItem(
          "systemProfile",
          JSON.stringify(
            nextProfile
          )
        );
      }catch(storageError){
        console.warn(
          "SYSTEM LOCAL CACHE UPDATE FAILED:",
          storageError
        );
      }

      window.dispatchEvent(
        new CustomEvent(
          "system-cloud-profile",
          {
            detail:
              nextProfile,
          }
        )
      );
    }

    async function prepareGame(){
      if(!user){
        setGameReady(false);
        return;
      }

      let cachedProfile=null;

      try{
        const cachedRaw=
          localStorage.getItem(
            "systemProfile"
          );

        if(cachedRaw){
          cachedProfile=
            normalizeProfile(
              JSON.parse(
                cachedRaw
              )
            );
        }
      }catch(cacheError){
        console.warn(
          "SYSTEM LOCAL CACHE INVALID:",
          cacheError
        );

        localStorage.removeItem(
          "systemProfile"
        );
      }

      // Returning players should not stare at an authorization screen
      // while the cloud performs a full structured hydrate.
      if(
        cachedProfile &&
        active
      ){
        setBootMessage(
          "SYSTEM READY • CLOUD SYNCING IN BACKGROUND..."
        );
        setGameReady(true);
      }else{
        setBootMessage(
          "PREPARING AUTHORITATIVE PLAYER STATE..."
        );
      }

      try{
        let cloudProfile=null;

        try{
          cloudProfile=
            await bootstrapAuthoritativeProfile();
        }catch(apiError){
          console.warn(
            "SYSTEM API BOOTSTRAP DEGRADED — USING LEGACY CLOUD READ:",
            apiError
          );

          cloudProfile=
            await loadProfileFromCloud(
              user
            );
        }

        if(!active){
          return;
        }

        if(cloudProfile){
          const normalizedCloud=
            normalizeProfile(
              cloudProfile
            );

          publishCloudProfile(
            normalizedCloud
          );

          // New devices can enter as soon as the authoritative core
          // profile is available. The larger structured profile follows.
          if(!cachedProfile){
            setGameReady(true);
          }

          try{
            const hydratedProfile=
              await hydrateStructuredProfile(
                cloudProfile
              );

            if(!active){
              return;
            }

            publishCloudProfile(
              normalizeProfile(
                hydratedProfile
              )
            );
          }catch(hydrateError){
            console.warn(
              "STRUCTURED PROFILE HYDRATE DEFERRED:",
              hydrateError
            );
          }
        }else if(cachedProfile){
          try{
            await syncProfileToCloud(
              cachedProfile
            );
          }catch(migrationError){
            console.error(
              "LOCAL PROFILE MIGRATION FAILED:",
              migrationError
            );
          }
        }else{
          // Authenticated new player: open registration instead of
          // holding an empty cloud gate indefinitely.
          setGameReady(true);
        }
      }catch(error){
        console.error(
          "SYSTEM CLOUD PREP FAILED:",
          error
        );

        setBootMessage(
          cachedProfile
            ? "CLOUD SYNC DEGRADED • LOCAL SYSTEM ACTIVE"
            : "CLOUD LINK DEGRADED • OPENING REGISTRATION"
        );

        if(active){
          setGameReady(true);
        }
      }
    }

    void prepareGame();

    return ()=>{
      active=false;
    };
  },[user?.id]);

  if(!authReady){
    return (
      <>
        <CloudBootScreen/>
      </>
    );
  }

  if(!user){
    return (
      <>
        <AuthScreen/>
      </>
    );
  }

  if(!gameReady){
    return (
      <>
        <CloudBootScreen
          message={bootMessage}
        />
      </>
    );
  }

  return (
    <SystemGame
      key={user.id}
    />
  );
}

export default function App() { return <SystemRuntimeBoundary><React.Suspense fallback={<CloudBootScreen />}><SystemAppRuntime /></React.Suspense></SystemRuntimeBoundary>; }
