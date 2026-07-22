import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-3 sm:p-4">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-5">
          <BrandLogo href="/login" />
          <div>
            <CardTitle className="text-xl">Reset your password</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Enter your account email and we will send a secure reset link.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ForgotPasswordForm />
          <Link href="/login" className="block text-center text-sm font-medium text-primary hover:underline">
            Back to login
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
