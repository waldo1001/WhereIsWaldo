import type { UserProfile, UserRepo } from "../../src/ports/repositories";

export class InMemoryUserRepo implements UserRepo {
  private readonly profiles = new Map<string, UserProfile>();

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
}
