import type { GroupCodeRecord, GroupCodeRepo } from "../../src/ports/repositories";

export class InMemoryGroupCodeRepo implements GroupCodeRepo {
  private readonly codes = new Map<string, GroupCodeRecord>();

  async createCode(code: string, record: GroupCodeRecord): Promise<void> {
    if (this.codes.has(code)) {
      throw new Error(`InMemoryGroupCodeRepo: code ${code} already exists`);
    }
    this.codes.set(code, { ...record });
  }

  async getCode(code: string): Promise<GroupCodeRecord | null> {
    const record = this.codes.get(code);
    return record ? { ...record } : null;
  }

  async deleteCode(code: string): Promise<void> {
    this.codes.delete(code);
  }
}
