import { Navigate, createBrowserRouter } from "react-router";
import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { VerifyPendingPage } from "@/features/auth/VerifyPendingPage";
import { DayDetailPage } from "@/features/days/DayDetailPage";
import { ChatPage } from "@/features/chat/ChatPage";
import { FoodsPage } from "@/features/foods/FoodsPage";
import { GoalsPage } from "@/features/goals/GoalsPage";
import { MonthPage } from "@/features/month/MonthPage";
import { OnboardingPage } from "@/features/onboarding/OnboardingPage";
import { RecipesPage } from "@/features/recipes/RecipesPage";
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
          { path: "/chat", element: <ChatPage /> },
          { path: "/month", element: <MonthPage /> },
          { path: "/foods", element: <FoodsPage /> },
          { path: "/recipes", element: <RecipesPage /> },
          { path: "/weight", element: <WeightPage /> },
          { path: "/sleep", element: <SleepPage /> },
          { path: "/goals", element: <GoalsPage /> },
          { path: "/settings", element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
