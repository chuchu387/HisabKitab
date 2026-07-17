import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand";
import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-3 sm:p-4">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-5">
          <BrandLogo />
          <div>
            <CardTitle className="text-xl">Sign in to HisabKitab</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Manage accounting, expenses, projects, and reports from one workspace.</p>
          </div>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
