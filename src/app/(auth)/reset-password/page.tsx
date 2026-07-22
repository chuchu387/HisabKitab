import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export default async function ResetPasswordPage({ searchParams }: any) {
  const params = await searchParams;
  const token = typeof params?.token === "string" ? params.token : "";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-3 sm:p-4">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-5">
          <BrandLogo href="/login" />
          <div>
            <CardTitle className="text-xl">Create a new password</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Use the reset link from your email. Links expire after 30 minutes.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {token ? <ResetPasswordForm token={token} /> : <p className="text-sm text-destructive">Reset token is missing.</p>}
          <Link href="/login" className="block text-center text-sm font-medium text-primary hover:underline">
            Back to login
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
