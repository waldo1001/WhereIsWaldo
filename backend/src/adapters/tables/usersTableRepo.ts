// specs/002 §2.2 `Users` table — the auth hot path. Integration-tested later; no unit
// tests here (thin adapter, excluded from mutation).

import { RestError } from "@azure/data-tables";
import { createTableClient } from "./tableClientFactory";
import type { Role, UserProfile, UserRepo } from "../../ports/repositories";

const PROFILE_ROW_KEY = "profile";

function isNotFound(err: unknown): boolean {
  return err instanceof RestError && err.statusCode === 404;
}

export class TableUserRepo implements UserRepo {
  private readonly client = createTableClient("Users");

  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const entity = await this.client.getEntity(userId, PROFILE_ROW_KEY);
      return {
        familyId: String(entity.familyId),
        role: entity.role as Role,
        displayName: String(entity.displayName),
      };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async createProfile(userId: string, profile: UserProfile): Promise<void> {
    await this.client.createEntity({
      partitionKey: userId,
      rowKey: PROFILE_ROW_KEY,
      familyId: profile.familyId,
      role: profile.role,
      displayName: profile.displayName,
    });
  }

  async updateProfile(userId: string, patch: Partial<UserProfile>): Promise<void> {
    await this.client.updateEntity({ partitionKey: userId, rowKey: PROFILE_ROW_KEY, ...patch }, "Merge");
  }

  async deleteProfile(userId: string): Promise<void> {
    await this.client.deleteEntity(userId, PROFILE_ROW_KEY);
  }
}
