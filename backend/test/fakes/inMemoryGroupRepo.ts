import { randomUUID } from "node:crypto";
import type { GroupMember, GroupMeta, GroupMetaAssertOutcome, GroupRepo } from "../../src/ports/repositories";

export class InMemoryGroupRepo implements GroupRepo {
  private readonly meta = new Map<string, GroupMeta>();
  private readonly members = new Map<string, Map<string, GroupMember>>();

  private freshEtag(): string {
    // Simulates Table Storage's ETag rotation: every successful write to the `meta` row
    // (create, patch/rotate, or B12's no-op conditional touch) gets a brand-new token.
    return `etag-${randomUUID()}`;
  }

  async createGroupMeta(meta: GroupMeta): Promise<void> {
    if (this.meta.has(meta.groupId)) {
      throw new Error(`InMemoryGroupRepo: group ${meta.groupId} already exists`);
    }
    this.meta.set(meta.groupId, { ...meta, etag: this.freshEtag() });
    this.members.set(meta.groupId, new Map());
  }

  async getGroupMeta(groupId: string): Promise<GroupMeta | null> {
    const meta = this.meta.get(groupId);
    return meta ? { ...meta } : null;
  }

  async addMember(groupId: string, member: GroupMember): Promise<void> {
    const roster = this.members.get(groupId);
    if (!roster) {
      throw new Error(`InMemoryGroupRepo: no group ${groupId}`);
    }
    roster.set(member.userId, { ...member });
  }

  async listMembers(groupId: string): Promise<GroupMember[]> {
    const roster = this.members.get(groupId);
    return roster ? [...roster.values()].map((m) => ({ ...m })) : [];
  }

  async getMember(groupId: string, userId: string): Promise<GroupMember | null> {
    const member = this.members.get(groupId)?.get(userId);
    return member ? { ...member } : null;
  }

  async updateGroupMeta(
    groupId: string,
    patch: Partial<Pick<GroupMeta, "name" | "endsAt" | "code">>,
  ): Promise<GroupMeta> {
    const existing = this.meta.get(groupId);
    if (!existing) {
      throw new Error(`InMemoryGroupRepo: no group ${groupId}`);
    }
    const updated = { ...existing, ...patch, etag: this.freshEtag() };
    this.meta.set(groupId, updated);
    return { ...updated };
  }

  async deleteGroupMeta(groupId: string): Promise<void> {
    this.meta.delete(groupId);
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    this.members.get(groupId)?.delete(userId);
  }

  async assertGroupMetaUnchanged(groupId: string, etag: string): Promise<GroupMetaAssertOutcome> {
    const current = this.meta.get(groupId);
    if (!current || current.etag !== etag) {
      return "conflict";
    }
    // Mirrors the real adapter's no-op conditional merge: succeeding still rotates the ETag.
    this.meta.set(groupId, { ...current, etag: this.freshEtag() });
    return "ok";
  }

  /**
   * Test-only seam: deletes ONLY the meta row, leaving member rows in place. Simulates a
   * crash mid-sweep (002 §4.1 deletes member rows + meta together; a crash between them can
   * leave a member row orphaned) so getGroupDetail's defense-in-depth meta-missing check is
   * independently observable from its membership-missing check.
   */
  deleteMetaOnlyForTest(groupId: string): void {
    this.meta.delete(groupId);
  }
}
