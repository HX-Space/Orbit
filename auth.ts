import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { compare } from "bcryptjs";
import { query, queryOne } from "@/lib/db";
import { logOrbitAction } from "@/lib/orbit-log";
import type { Role } from "@/types/db";

const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

type DbUserAuthRow = {
  id: number;
  full_name: string;
  email: string;
  password_hash: string;
  role: Role;
};

const VIEW_AS_ROLES: Role[] = ["admin", "hoo"];

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Emails match whatever the capitals or spaces (many are stored as
        // "FirstLast@alpha.com"). If two people differ only by capitals, only
        // the exact spelling signs in.
        const matches = await query<DbUserAuthRow>(
          `SELECT id, full_name, email, password_hash, role
           FROM temp_users
           WHERE LOWER(TRIM(email)) = LOWER($1)
             AND is_active = TRUE
             AND employment_status <> 'deactivated'`,
          [email]
        );
        const user =
          matches.length === 1
            ? matches[0]
            : matches.find((row) => row.email.trim() === email);
        if (!user) return null;

        const ok = await compare(password, user.password_hash);
        if (!ok) return null;

        await logOrbitAction({
          action: "sign_in",
          resource: "auth",
          summary: `Signed in (${user.email})`,
          actor: {
            id: user.id,
            name: user.full_name,
            email: user.email,
            role: user.role,
          },
        });

        return {
          id: String(user.id),
          email: user.email,
          name: user.full_name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role;
        delete token.viewAsId;
        delete token.viewAs;
        return token;
      }

      // Keep role in sync with temp_users so HOO/admin permissions stay current.
      const userId = Number(token.id);
      if (Number.isFinite(userId)) {
        let row: { role: Role } | null;
        try {
          row = await queryOne<{ role: Role }>(
            `SELECT role FROM temp_users
              WHERE id = $1
                AND is_active = TRUE
                AND employment_status <> 'deactivated'`,
            [userId]
          );
        } catch {
          // Keep the existing token role if the DB is briefly unavailable.
          return token;
        }
        // Deactivated or deleted: end the session now instead of when it expires.
        if (!row) return null;
        token.role = row.role;
      }

      // "View as": an Admin / HOD sees Orbit as another person, read only.
      // token.id / token.role always stay the real admin.
      if (trigger === "update" && session && "viewAsUserId" in session) {
        const next = Number(session.viewAsUserId);
        if (
          session.viewAsUserId != null &&
          Number.isFinite(next) &&
          next !== userId &&
          VIEW_AS_ROLES.includes(token.role as Role)
        ) {
          token.viewAsId = next;
        } else {
          delete token.viewAsId;
        }
      }
      if (token.viewAsId && !VIEW_AS_ROLES.includes(token.role as Role)) {
        delete token.viewAsId;
      }
      if (token.viewAsId) {
        const target = await queryOne<{ id: number; full_name: string; email: string; role: Role }>(
          `SELECT id, full_name, email, role FROM temp_users WHERE id = $1`,
          [token.viewAsId]
        ).catch(() => null);
        if (target) {
          token.viewAs = {
            id: target.id,
            name: target.full_name,
            email: target.email,
            role: target.role,
          };
        } else {
          delete token.viewAsId;
          delete token.viewAs;
        }
      } else {
        delete token.viewAs;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        if (token.viewAs) {
          // Every page sees the viewed person; viewAs keeps the real admin.
          session.viewAs = {
            realId: token.id as string,
            realName: session.user.name ?? "",
            realRole: token.role as Role,
          };
          const viewed = token.viewAs as { id: number; name: string; email: string; role: Role };
          session.user.id = String(viewed.id);
          session.user.role = viewed.role;
          session.user.name = viewed.name;
          session.user.email = viewed.email;
        }
      }
      return session;
    },
  },
});

