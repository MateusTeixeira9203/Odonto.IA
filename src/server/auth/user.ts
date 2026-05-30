import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type AuthenticatedUser = {
  id: string;
  email?: string;
};

type RequireUserResult = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: AuthenticatedUser;
};

export async function requireUser(): Promise<RequireUserResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return {
    supabase,
    user: { id: user.id, email: user.email ?? undefined },
  };
}
