/**
 * PHASE 1 SPIKE state. Uses the Schema v5 builder (no decorators, ADR-0004).
 */
import { type SchemaType, schema, t } from "@colyseus/schema";

export const SpikePlayer = schema(
  {
    name: t.string(),
    x: t.float32().default(0),
    z: t.float32().default(0),
    yaw: t.float32().default(0),
    /** Private to the owning client via StateView (spike for inventory privacy). */
    secretNote: t.string().view(),
  },
  "SpikePlayer",
);
export type SpikePlayer = SchemaType<typeof SpikePlayer>;

export const SpikeState = schema(
  {
    tick: t.uint32().default(0),
    players: t.map(SpikePlayer),
  },
  "SpikeState",
);
export type SpikeState = SchemaType<typeof SpikeState>;
