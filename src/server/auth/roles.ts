import { redirect } from "next/navigation";
import { requireClinicContext } from "./clinic";
import type { ClinicContext, ClinicRole } from "./clinic";

export async function requireRole(
  allowedRoles: ClinicRole[]
): Promise<ClinicContext> {
  const context = await requireClinicContext();

  if (!allowedRoles.includes(context.role)) {
    redirect("/dashboard");
  }

  return context;
}
