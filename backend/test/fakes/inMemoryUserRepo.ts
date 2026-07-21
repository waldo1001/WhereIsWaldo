import type { GroupMembershipIndexEntry, UserProfile, UserRepo } from "../../src/ports/repositories";

export class InMemoryUserRepo implements UserRepo {
  private readonly profiles = new Map<string, UserProfile>();
  private readonly groupMemberships = new Map<string, Map<string, GroupMembershipIndexEntry>>();

  seed(userId: string, profile: UserProfile): void {
    this.profiles.set(userId, { ...profile });
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const profile = this.profiles.get(userId);
    return profile ? { ...profile } : null;
  }

  async createProfile(userId: string, profile: UserProfile): Promise<void> {
    this.profiles.set(userId, { ...profile });
  }

  async updateProfile(userId: string, patch: Partial<UserProfile>): Promise<void> {
    const existing = this.profiles.get(userId);
    if (!existing) {
      throw new Error(`InMemoryUserRepo: no profile for ${userId}`);
    }
    this.profiles.set(userId, { ...existing, ...patch });
  }

  async deleteProfile(userId: string): Promise<void> {
    this.profiles.delete(userId);
  }

  async addGroupMembership(userId: string, entry: GroupMembershipIndexEntry): Promise<void> {
    const existing = this.groupMemberships.get(userId) ?? new Map();
    existing.set(entry.groupId, { ...entry });
    this.groupMemberships.set(userId, existing);
  }

  async listGroupMemberships(userId: string): Promise<GroupMembershipIndexEntry[]> {
    const existing = this.groupMemberships.get(userId);
    return existing ? [...existing.values()].map((e) => ({ ...e })) : [];
  }

  async removeGroupMembership(userId: string, groupId: string): Promise<void> {
    this.groupMemberships.get(userId)?.delete(groupId);
  }
}
