import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import RegisterForm from "@/components/auth/RegisterForm";

export default async function RegisterPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <RegisterForm />
    </main>
  );
}
