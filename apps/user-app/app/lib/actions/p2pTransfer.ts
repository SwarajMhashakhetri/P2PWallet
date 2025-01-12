"use server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth";
import prisma from "@repo/db/client";

type TransferResponse = {
    message: string;
};

interface SessionUser {
    id: string;
}

 interface Balance {
    userId: number;
    amount: number;
}

export async function p2pTransfer(to: string, amount: number): Promise<TransferResponse> {
    const session = await getServerSession(authOptions);
    const from: string | undefined = (session?.user as SessionUser)?.id;

    if (!from) {
        return { message: "Error while sending" };
    }

    const toUser = await prisma.user.findFirst({
        where: { number: to },
    });

    if (!toUser) {
        return { message: "User not found" };
    }

    try {
        await prisma.$transaction(async (tx) => {
            // Lock "from" user's balance
            const fromBalance = (await tx.$queryRaw<Balance[]>`
                SELECT * FROM "Balance" WHERE "userId" = ${Number(from)} FOR UPDATE
            `)[0];

            if (!fromBalance || fromBalance.amount < amount) {
                throw new Error("Insufficient funds");
            }

            // Lock "to" user's balance
            await tx.$queryRaw`
                SELECT * FROM "Balance" WHERE "userId" = ${toUser.id} FOR UPDATE
            `;

            // Deduct amount from "from" user's balance
            await tx.balance.update({
                where: { userId: Number(from) },
                data: { amount: { decrement: amount } },
            });

            // Add amount to "to" user's balance
            await tx.balance.update({
                where: { userId: toUser.id },
                data: { amount: { increment: amount } },
            });

            await tx.p2pTransfer.create({
                data: {
                    amount,
                    timestamp: new Date(),
                    fromUserId: Number(from),
                    toUserId: toUser.id,
                },
            });
        });

        return { message: "Transfer successful" };
    } catch (error) {
        console.error(error);
        return { message: error instanceof Error ? error.message : "Transaction failed" };
    }
}
