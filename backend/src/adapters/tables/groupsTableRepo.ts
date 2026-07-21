// specs/002 §2.10 `Groups` table. Integration-tested later against Azurite; no unit tests
// here (thin adapter, excluded from mutation).

import { odata, RestError } from "@azure/data-tables";
import { createTableClient } from "./tableClientFactory";
import type { GroupExpiryPolicy, GroupMember, GroupMeta, GroupRepo, GroupRole } from "../../ports/repositories";

const META_ROW_KEY = "meta";
const MEMBER_PREFIX = "member:";

function isNotFound(err: unknown): boolean {
  return err instanceof RestError && err.statusCode === 404;
}

export class TableGroupRepo implements GroupRepo {
  private readonly client = createTableClient("Groups");

  async createGroupMeta(meta: GroupMeta): Promise<void> {
    await this.client.createEntity({
      partitionKey: meta.groupId,
      rowKey: META_ROW_KEY,
      name: meta.name,
      ownerUserId: meta.ownerUserId,
      createdAt: meta.createdAt,
      endsAt: meta.endsAt,
      expiryPolicy: meta.expiryPolicy,
      code: meta.code,
    });
  }

  async getGroupMeta(groupId: string): Promise<GroupMeta | null> {
    try {
      const entity = await this.client.getEntity(groupId, META_ROW_KEY);
      return {
        groupId,
        name: String(entity.name),
        ownerUserId: String(entity.ownerUserId),
        createdAt: String(entity.createdAt),
        endsAt: String(entity.endsAt),
        expiryPolicy: entity.expiryPolicy as GroupExpiryPolicy,
        code: String(entity.code),
      };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async addMember(groupId: string, member: GroupMember): Promise<void> {
    await this.client.createEntity({
      partitionKey: groupId,
      rowKey: `${MEMBER_PREFIX}${member.userId}`,
      role: member.role,
      displayName: member.displayName,
      joinedAt: member.joinedAt,
    });
  }

  async listMembers(groupId: string): Promise<GroupMember[]> {
    const members: GroupMember[] = [];
    const entities = this.client.listEntities({
      queryOptions: {
        filter: odata`PartitionKey eq ${groupId} and RowKey ge ${MEMBER_PREFIX} and RowKey lt ${"member;"}`,
      },
    });
    for await (const entity of entities) {
      members.push({
        userId: String(entity.rowKey).slice(MEMBER_PREFIX.length),
        role: entity.role as GroupRole,
        displayName: String(entity.displayName),
        joinedAt: String(entity.joinedAt),
      });
    }
    return members;
  }

  async getMember(groupId: string, userId: string): Promise<GroupMember | null> {
    try {
      const entity = await this.client.getEntity(groupId, `${MEMBER_PREFIX}${userId}`);
      return {
        userId,
        role: entity.role as GroupRole,
        displayName: String(entity.displayName),
        joinedAt: String(entity.joinedAt),
      };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }
}
