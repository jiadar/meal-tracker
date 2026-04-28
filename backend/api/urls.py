from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views
from .chat import views as chat_views

router = DefaultRouter()
router.register("foods", views.FoodViewSet, basename="food")
router.register("recipes", views.RecipeViewSet, basename="recipe")
router.register("recipe-ingredients", views.RecipeIngredientViewSet, basename="recipe-ingredient")
router.register("days", views.DayViewSet, basename="day")
router.register("meals", views.MealViewSet, basename="meal")
router.register("sleep-logs", views.SleepLogViewSet, basename="sleep-log")
router.register("nap-logs", views.NapLogViewSet, basename="nap-log")
router.register("exercise-logs", views.ExerciseLogViewSet, basename="exercise-log")
router.register("weight-goals", views.WeightGoalViewSet, basename="weight-goal")

urlpatterns = [
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    path("health/", views.health, name="health"),
    path("today/", views.today, name="today"),
    path(
        "months/<int:year>-<int:month>/summary/",
        views.month_summary_view,
        name="month-summary",
    ),
    path("auth/config/", views.AuthConfigView.as_view(), name="auth-config"),
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/logout-all/", views.LogoutAllView.as_view(), name="logout-all"),
    path("auth/me/", views.MeView.as_view(), name="me"),
    path("auth/password/change/", views.ChangePasswordView.as_view(), name="password-change"),
    path("auth/password/reset/", views.PasswordResetRequestView.as_view(), name="password-reset"),
    path(
        "auth/password/reset/form/",
        views.PasswordResetFormView.as_view(),
        name="password-reset-form",
    ),
    path(
        "auth/password/reset/confirm/",
        views.PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
    path("auth/verify-email/", views.VerifyEmailView.as_view(), name="verify-email"),
    path(
        "auth/verify-email/resend/",
        views.ResendVerificationView.as_view(),
        name="verify-email-resend",
    ),
    path("targets/", views.UserTargetsView.as_view(), name="targets"),
    path("chat/", chat_views.chat_view, name="chat"),
    path("", include(router.urls)),
]
