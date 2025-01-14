import GoogleProvider from "next-auth/providers/google";
import db from "@repo/db/client";
import { AuthOptions } from "next-auth";

export const authOptions: AuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        }),
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            console.log("Sign-in attempt:", { user, account, profile });

            if (!user?.email) {
                console.error("Sign-in failed: Missing email");
                return false;
            }

            try {
                await db.merchant.upsert({
                    select: { id: true },
                    where: { email: user.email },
                    create: {
                        email: user.email,
                        name: user.name || "Unknown",
                        auth_type: account?.provider === "google" ? "Google" : "Github",
                    },
                    update: {
                        name: user.name || "Unknown",
                        auth_type: account?.provider === "google" ? "Google" : "Github",
                    },
                });

                return true; 
            } catch (error) {
                console.error("Database error during sign-in:", error);
                return false; 
            }
        },
    },
    secret: process.env.NEXTAUTH_SECRET || "secret",
};
