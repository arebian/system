import { supabase } from "./supabaseClient.js";
import { initializeProfileOnBackend } from "./systemCloud.js";
import { normalizeProfile } from "./systemProfileCore.js";

export async function getCloudUser() {
  const {
    data,
    error,
  } =
    await supabase.auth.getSession();

  if (error) {
    console.error(
      "SYSTEM AUTH ERROR:",
      error.message
    );

    return null;
  }

  return (
    data?.session?.user ||
    null
  );
}

export async function syncProfileToCloud(
  profile
) {
  if (!profile) {
    return {
      ok: false,
      skipped: true,
    };
  }

  try {
    await initializeProfileOnBackend(
      profile
    );

    window.dispatchEvent(
      new CustomEvent(
        "system-cloud-status",
        {
          detail: {
            status:
              "SYNCED",
          },
        }
      )
    );

    return {
      ok: true,
    };
  } catch (error) {
    console.error(
      "SAFE PROFILE IDENTITY SYNC FAILED:",
      error
    );

    return {
      ok: false,
      error,
    };
  }
}

export async function loadProfileFromCloud(user) {
  if (!user) {
    return null;
  }

  const [
    profileResult,
    attributeResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "profiles"
        )
        .select("*")
        .eq(
          "id",
          user.id
        )
        .maybeSingle(),

      supabase
        .from(
          "attributes"
        )
        .select("*")
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle(),
    ]);

  if (
    profileResult.error
  ) {
    throw (
      profileResult.error
    );
  }

  if (
    attributeResult.error
  ) {
    throw (
      attributeResult.error
    );
  }

  const data =
    profileResult.data;

  if (!data) {
    return null;
  }

  const cloudAttributes =
    attributeResult.data
      ? {
        STRENGTH:
          attributeResult.data.strength,

        SPEED:
          attributeResult.data.speed,

        ENDURANCE:
          attributeResult.data.endurance,

        INTELLIGENCE:
          attributeResult.data.intelligence,

        FOCUS:
          attributeResult.data.focus,

        DISCIPLINE:
          attributeResult.data.discipline,

        WEALTH:
          attributeResult.data.wealth,

        CHARISMA:
          attributeResult.data.charisma,

        CREATIVITY:
          attributeResult.data.creativity,

        RECOVERY:
          attributeResult.data.recovery,
      }
      : null;

  const normalized =
    normalizeProfile({
      ...(data.profile_data ||
        {}),

      name:
        data.name,

      age:
        data.age,

      path:
        data.class,

      level:
        data.level,

      xp:
        data.xp,

      streak:
        data.streak,

      momentum:
        data.momentum,

      fingerprint:
        data.fingerprint,

      ...(cloudAttributes
        ? {
          attributes:
            cloudAttributes,
        }
        : {}),
    });

  if (
    !attributeResult.data
  ) {
    void syncProfileToCloud(
      normalized
    );
  }

  return normalized;
}
