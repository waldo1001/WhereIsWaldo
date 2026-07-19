import type { Clock } from "../../ports/support";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
