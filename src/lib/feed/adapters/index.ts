import type { FeedAdapter } from "../types";
import { floortradeAdapter } from "./floortrade";
import { vinyliaAdapter } from "./vinylia";
import { nordicAdapter } from "./nordic";

export const ADAPTERS: Record<string, FeedAdapter> = {
  floortrade: floortradeAdapter,
  vinylia: vinyliaAdapter,
  nordic: nordicAdapter,
};
