import type { GroupMember, GroupMeta, GroupRepo } from "../../src/ports/repositories";

export class InMemoryGroupRepo implements GroupRepo {
  private readonly meta = new Map<string, GroupMeta>();
  private readonly members = new Map<string, Map<string, GroupMember>>();

  async createGroupMeta(meta: GroupMeta): Promise<void> {
    if (this.meta.has(meta.groupId)) {
      throw new Error(`InMemoryGroupRepo: group ${meta.groupId} already exists`);
    }
    this.meta.set(meta.groupId, { ...meta });
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
