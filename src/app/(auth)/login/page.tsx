import { LoginForm } from "./login-form";

interface LoginPageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const redirectTo = params.redirectTo ?? "/dashboard";

  return <LoginForm redirectTo={redirectTo} />;
}
