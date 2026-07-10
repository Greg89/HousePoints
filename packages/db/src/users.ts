import type { Prisma, PrismaClient } from "@prisma/client";

type UserDisplayNameClient = Pick<PrismaClient | Prisma.TransactionClient, "user">;

export async function updateUserDisplayName<TSelect extends Prisma.UserSelect>(
  client: UserDisplayNameClient,
  input: {
    userId: string;
    displayName: string;
    select: TSelect;
    data?: Omit<Prisma.UserUpdateInput, "displayName">;
  },
): Promise<Prisma.UserGetPayload<{ select: TSelect }>> {
  return client.user.update({
    where: { id: input.userId },
    data: {
      ...input.data,
      displayName: input.displayName,
    },
    select: input.select,
  }) as Promise<Prisma.UserGetPayload<{ select: TSelect }>>;
}
