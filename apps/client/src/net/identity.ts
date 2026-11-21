/**
 * Guest identity (SECURITY_DESIGN T1): a random public `playerId` and a secret
 * 32-byte `token`, generated once per browser and kept in localStorage. The server
 * stores only SHA-256(token). Clearing site data = a new player.
 */
const STORAGE_KEY = "oceansurvival.identity.v1";
const NAME_KEY = "oceansurvival.playerName";
/** Max simultaneous tabs (each gets its own player profile). */
const MAX_PROFILES = 8;

/** Storage key for a profile (profile 1 keeps the original key). */
const keyFor = (base: string, profile: number) => (profile === 1 ? base : `${base}.p${profile}`);

/**
 * Picks a player profile for this tab. Each open tab holds a Web Lock on its profile,
 * so a second tab becomes a second player instead of kicking the first (the server
 * allows one live session per player). Tab 1 always reuses profile 1, so a single
 * player keeps the same identity (and saved position) across reloads and restarts.
 */
export async function acquireProfile(): Promise<number> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!locks) return 1;
  for (let p = 1; p <= MAX_PROFILES; p++) {
    const got = await new Promise<boolean>((resolve) => {
      void locks.request(`oceansurvival.profile.${p}`, { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(false);
          return;
        }
        resolve(true);
        return new Promise<void>(() => undefined); // held until the tab closes
      });
    });
    if (got) return p;
  }
  return 1;
}
const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

export interface Identity {
  playerId: string;
  token: string;
}

function randomId(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const b of bytes) out += ID_ALPHABET[b & 63];
  return out;
}

function randomTokenHex(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function isValid(v: unknown): v is Identity {
  const o = v as Identity | null;
  return (
    typeof o?.playerId === "string" &&
    /^[A-Za-z0-9_-]{16}$/.test(o.playerId) &&
    typeof o.token === "string" &&
    /^[a-f0-9]{64}$/.test(o.token)
  );
}

/** Returns the stored identity, creating one if missing or invalid. */
export function loadIdentity(profile = 1): Identity {
  const key = keyFor(STORAGE_KEY, profile);
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (isValid(parsed)) return parsed;
  } catch {
    // unavailable or corrupt storage: fall through to a fresh identity
  }
  const identity = { playerId: randomId(16), token: randomTokenHex() };
  try {
    localStorage.setItem(key, JSON.stringify(identity));
  } catch {
    // private mode: identity lives for this tab only
  }
  return identity;
}

export function loadPlayerName(profile = 1): string {
  try {
    const name = localStorage.getItem(keyFor(NAME_KEY, profile));
    if (name) return name;
  } catch {
    // ignore
  }
  return `Pelaut-${Math.floor(Math.random() * 9000 + 1000)}`;
}

export function savePlayerName(name: string, profile = 1): void {
  try {
    localStorage.setItem(keyFor(NAME_KEY, profile), name);
  } catch {
    // ignore
  }
}
