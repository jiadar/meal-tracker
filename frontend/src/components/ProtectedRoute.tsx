import { Center, Loader } from "@mantine/core";
import { Navigate, Outlet, useLocation } from "react-router";
import { useMe } from "@/features/auth/api";
import { useAuthStore } from "@/lib/authStore";

/**
 * Gates the authenticated app:
 *  - no refresh token → /login
 *  - refresh token, still loading /me → spinner
 *  - unverified user → /verify-pending (unless already there)
 *  - verified but not onboarded → /onboarding (unless already there)
 *  - otherwise → render children
 */
export function ProtectedRoute() {
  const location = useLocation();
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const { data: user, isLoading, error } = useMe();

  if (!refreshToken) return <Navigate to="/login" replace state={{ from: location }} />;

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (error) {
    return <Navigate to="/login" replace />;
  }

  if (!user) return null;

  if (!user.is_email_verified && location.pathname !== "/verify-pending") {
    return <Navigate to="/verify-pending" replace />;
  }

  if (
    user.is_email_verified &&
    !user.profile.onboarded_at &&
    location.pathname !== "/onboarding"
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
