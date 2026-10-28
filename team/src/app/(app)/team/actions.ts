"use server";

import { revalidatePath } from "next/cache";
import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";
import { createClient } from "@/lib/supabase/server";

export interface DeleteEmployeeResult {
  ok: boolean;
  message: string;
}

/**
 * Admin-only: remove a member's sign-in and everything that belongs to them.
 * The database function does the work in one transaction (the rows cascade
 * from the auth user) and re-checks that the caller is an admin.
 */
export async function deleteEmployeeAccount(employeeId: string): Promise<DeleteEmployeeResult> {
  const me = await getOrBootstrapCurrentEmployee();
  if (!me) return { ok: false, message: "Not authenticated." };
  if (me.role !== "admin") return { ok: false, message: "Only admins can delete users." };
  if (typeof employeeId !== "string" || employeeId.length === 0) {
    return { ok: false, message: "Invalid employee id." };
  }

  const supabase = await createClient();
  const { data: email, error } = await supabase.rpc("delete_employee_account", {
    p_employee_id: employeeId,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/team");
  revalidatePath("/dashboard");
  return { ok: true, message: `Deleted ${email}.` };
}
