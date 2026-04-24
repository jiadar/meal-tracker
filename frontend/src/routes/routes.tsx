import { Navigate, createBrowserRouter } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Placeholder } from "@/components/Placeholder";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { VerifyPendingPage } from "@/features/auth/VerifyPendingPage";
import { DayDetailPage } from "@/features/days/DayDetailPage";
import { OnboardingPage } from "@/features/onboarding/OnboardingPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/verify-pending", element: <VerifyPendingPage /> },
      { path: "/onboarding", element: <OnboardingPage /> },
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <DayDetailPage /> },
          { path: "/month", element: <Placeholder title="Month" /> },
          { path: "/foods", element: <Placeholder title="Foods" /> },
          { path: "/recipes", element: <Placeholder title="Recipes" /> },
          { path: "/weight", element: <Placeholder title="Weight" /> },
          { path: "/sleep", element: <Placeholder title="Sleep" /> },
          { path: "/goals", element: <Placeholder title="Goals" /> },
          { path: "/settings", element: <Placeholder title="Settings" /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
