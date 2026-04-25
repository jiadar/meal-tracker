import { Navigate, createBrowserRouter } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Placeholder } from "@/components/Placeholder";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { VerifyPendingPage } from "@/features/auth/VerifyPendingPage";
import { DayDetailPage } from "@/features/days/DayDetailPage";
import { FoodsPage } from "@/features/foods/FoodsPage";
import { MonthPage } from "@/features/month/MonthPage";
import { OnboardingPage } from "@/features/onboarding/OnboardingPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { SleepPage } from "@/features/sleep/SleepPage";
import { WeightPage } from "@/features/weight/WeightPage";

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
          { path: "/month", element: <MonthPage /> },
          { path: "/foods", element: <FoodsPage /> },
          { path: "/recipes", element: <Placeholder title="Recipes" /> },
          { path: "/weight", element: <WeightPage /> },
          { path: "/sleep", element: <SleepPage /> },
          { path: "/goals", element: <Placeholder title="Goals" /> },
          { path: "/settings", element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
