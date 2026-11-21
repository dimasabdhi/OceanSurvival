/**
 * World room protocol (docs/MULTIPLAYER_DESIGN.md §9). Every client→server payload has
 * a zod schema here; the server validates with Colyseus `validate()`.
 */
import { type SchemaType, schema, t } from "@colyseus/schema";
import { z } from "zod";

export const WORLD_ROOM_NAME = "world";
/** Phase 2: a single development world. World management (create/list) arrives in Phase 8. */
export const DEFAULT_WORLD_ID = "dev-world";

/** Custom close codes (Colyseus reserves 4000–4010). */
export const CloseCodes = {
  /** The same player joined again from another tab/device; the old session is closed. */
  DuplicateSession: 4100,
  /** Repeated protocol abuse (flooding). */
  ProtocolAbuse: 4101,
} as const;

/** Per-fixed-step player input. Flat primitives only (Colyseus `defineInput`). */
export const PlayerInput = schema(
  {
    moveX: t.int8(),
    moveZ: t.int8(),
    yaw: t.float32(),
    pitch: t.float32(),
    buttons: t.uint8(),
  },
  "PlayerInput",
);
export type PlayerInput = SchemaType<typeof PlayerInput>;

export const PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{16}$/;
export const PLAYER_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export const PlayerName = z
  .string()
  .trim()
  .min(2)
  .max(24)
  .regex(/^[\p{L}\p{N} _.-]+$/u, "nama hanya boleh huruf, angka, spasi, _ . -");

export const WorldJoinOptions = z
  .object({
    worldId: z.string().regex(/^[a-z0-9-]{1,32}$/),
    playerId: z.string().regex(PLAYER_ID_PATTERN),
    token: z.string().regex(PLAYER_TOKEN_PATTERN),
    name: PlayerName,
  })
  .strict();
export type WorldJoinOptions = z.infer<typeof WorldJoinOptions>;

// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
export const ChatSend = z
  .object({
    text: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine((s) => !CONTROL_CHARS.test(s), "control characters are not allowed"),
  })
  .strict();
export type ChatSend = z.infer<typeof ChatSend>;

/** Server → client message payloads. */
export interface ChatBroadcast {
  from: string;
  text: string;
}
export interface ServerNotice {
  kind: "shutdown" | "rate-limited";
}
