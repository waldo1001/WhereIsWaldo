import type { PushMessage, PushSendOutcome, PushSender } from "../../src/ports/pushSender";

/** Recording PushSender fake: captures every send() call, returns a configurable outcome. */
export class FakePushSender implements PushSender {
  readonly sent: PushMessage[] = [];
  private outcome: PushSendOutcome = "ok";

  /** Test control: subsequent send() calls resolve with this outcome (default "ok"). */
  setOutcome(outcome: PushSendOutcome): void {
    this.outcome = outcome;
  }

  async send(message: PushMessage): Promise<PushSendOutcome> {
    this.sent.push({ ...message, data: { ...message.data } });
    return this.outcome;
  }
}
