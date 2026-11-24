import type { Role } from "@/types/db";
import type { DefaultSession } from "next-auth";

/** Admin / Head of Department viewing Orbit as another person (read only). */
export type ViewAsInfo = {
  /** The real signed-in admin. */
  realId: string;
  realName: string;
  realRole: Role;
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
    /** Set while an Admin / HOD views as `user` (read only). */
    viewAs?: ViewAsInfo;
    /** Only sent with unstable_update: start (a user id) or stop (null) viewing as. */
    viewAsUserId?: number | null;
  }

  interface User {
    id: string;
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    /** Person being viewed as (only for admin / hoo). */
    viewAsId?: number;
    viewAs?: { id: number; name: string; email: string; role: Role };
  }
}
