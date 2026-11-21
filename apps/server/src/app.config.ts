import { SPIKE_ROOM_NAME } from "@oceansurvival/shared";
import { defineRoom, defineServer } from "colyseus";
import { SpikeRoom } from "./rooms/SpikeRoom";

/**
 * Colyseus server definition (rooms only). Network binding happens in index.ts so
 * tests (@colyseus/testing `boot`) can reuse this without opening a public port.
 */
export const server = defineServer({
  rooms: {
    [SPIKE_ROOM_NAME]: defineRoom(SpikeRoom),
  },
});

export default server;
