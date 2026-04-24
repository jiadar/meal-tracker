from django.db import transaction
from django.shortcuts import render
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .emails import send_password_reset_email, send_verification_email
from .models import (
    Day,
    ExerciseLog,
    Food,
    Meal,
    NapLog,
    Recipe,
    RecipeIngredient,
    SleepLog,
    User,
    UserTargets,
    WeightGoal,
)
from .permissions import IsEmailVerified, IsOwner
from .serializers import (
    ChangePasswordSerializer,
    DaySerializer,
    EmailLoginTokenSerializer,
    ExerciseLogSerializer,
    FoodSerializer,
    MealSerializer,
    NapLogSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RecipeIngredientSerializer,
    RecipeSerializer,
    RegisterSerializer,
    SleepLogSerializer,
    UserSerializer,
    UserTargetsSerializer,
    WeightGoalSerializer,
)
from .tokens import (
    EMAIL_VERIFY_MAX_AGE,
    EMAIL_VERIFY_PURPOSE,
    PASSWORD_RESET_MAX_AGE,
    PASSWORD_RESET_PURPOSE,
    read_token,
)


def _tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


# ---------- Auth ----------


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def health(_request):
    return Response({"status": "ok"})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsEmailVerified])
def today(request):
    profile = request.user.profile
    local_date = profile.today()
    return Response(
        {"date": local_date.isoformat(), "timezone": profile.timezone}
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsEmailVerified])
def month_summary_view(request, year, month):
    from calendar import monthrange
    from datetime import date as _date

    from .nutrition import month_summary

    try:
        start = _date(year, month, 1)
        end = _date(year, month, monthrange(year, month)[1])
    except ValueError:
        return Response(
            {"errors": [{"code": "invalid", "field": None, "message": "Invalid year/month."}]},
            status=400,
        )

    days_qs = Day.objects.filter(user=request.user, date__gte=start, date__lte=end)
    bmr = request.user.profile.bmr
    data = month_summary(days_qs, bmr)
    data["year"] = year
    data["month"] = month
    return Response(data)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        send_verification_email(user)
        return Response(
            {"user": UserSerializer(user).data, "tokens": _tokens_for(user)},
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    serializer_class = EmailLoginTokenSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


class LogoutView(APIView):
    def post(self, request):
        refresh = request.data.get("refresh")
        if not refresh:
            return Response(
                {"detail": "refresh token required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            RefreshToken(refresh).blacklist()
        except TokenError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_205_RESET_CONTENT)


class LogoutAllView(APIView):
    def post(self, request):
        count = 0
        for outstanding in OutstandingToken.objects.filter(user=request.user):
            try:
                RefreshToken(outstanding.token).blacklist()
                count += 1
            except TokenError:
                continue
        return Response({"blacklisted": count}, status=status.HTTP_200_OK)


class MeView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

    def perform_destroy(self, instance):
        for outstanding in OutstandingToken.objects.filter(user=instance):
            try:
                RefreshToken(outstanding.token).blacklist()
            except TokenError:
                continue
        instance.delete()


class ChangePasswordView(APIView):
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Password changed."})


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = request.query_params.get("token", "")
        user_id = read_token(token, EMAIL_VERIFY_PURPOSE, EMAIL_VERIFY_MAX_AGE)
        if user_id is None:
            return render(
                request,
                "api/verify_email.html",
                {"success": False, "message": "Invalid or expired verification link."},
                status=400,
            )
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return render(
                request,
                "api/verify_email.html",
                {"success": False, "message": "User not found."},
                status=404,
            )
        if not user.is_email_verified:
            user.is_email_verified = True
            user.save(update_fields=["is_email_verified"])
        return render(
            request,
            "api/verify_email.html",
            {"success": True, "message": "Email verified. You can close this tab."},
        )


class ResendVerificationView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "email_verify_resend"

    def post(self, request):
        user = request.user
        if user.is_email_verified:
            return Response({"detail": "Already verified."})
        send_verification_email(user)
        return Response({"detail": "Verification email sent."})


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower().strip()
        user = User.objects.filter(email__iexact=email).first()
        if user is not None:
            send_password_reset_email(user)
        return Response({"detail": "If the account exists, a reset email has been sent."})


class PasswordResetFormView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = request.query_params.get("token", "")
        user_id = read_token(token, PASSWORD_RESET_PURPOSE, PASSWORD_RESET_MAX_AGE)
        return render(
            request,
            "api/password_reset_form.html",
            {"token": token, "valid": user_id is not None},
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_id = read_token(
            serializer.validated_data["token"],
            PASSWORD_RESET_PURPOSE,
            PASSWORD_RESET_MAX_AGE,
        )
        if user_id is None:
            return Response(
                {"detail": "Invalid or expired token."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND
            )
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        return Response({"detail": "Password reset."})


# ---------- Domain ----------


class UserTargetsView(generics.RetrieveUpdateAPIView):
    """GET/PATCH the authenticated user's single Targets row."""

    serializer_class = UserTargetsSerializer
    permission_classes = [permissions.IsAuthenticated, IsEmailVerified]

    def get_object(self):
        targets, _ = UserTargets.objects.get_or_create(user=self.request.user)
        return targets


class OwnedViewSet(viewsets.ModelViewSet):
    """Base: a viewset whose queryset is filtered to request.user and creates
    attach request.user automatically."""

    permission_classes = [permissions.IsAuthenticated, IsEmailVerified, IsOwner]
    model_user_field = "user"  # override to "day" etc. for indirect ownership

    def get_queryset(self):
        return self.model.objects.filter(**{self.model_user_field: self.request.user})

    def perform_create(self, serializer):
        if self.model_user_field == "user":
            serializer.save(user=self.request.user)
        else:
            serializer.save()


class FoodViewSet(OwnedViewSet):
    serializer_class = FoodSerializer
    model = Food

    def get_queryset(self):
        qs = super().get_queryset()
        name = self.request.query_params.get("name")
        if name:
            qs = qs.filter(name__icontains=name)
        return qs


class RecipeViewSet(OwnedViewSet):
    serializer_class = RecipeSerializer
    model = Recipe

    def get_queryset(self):
        return Recipe.objects.filter(food__user=self.request.user).select_related("food")

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=["post"])
    def recompute(self, request, pk=None):
        recipe = self.get_object()
        recipe.recompute_food_nutrition()
        return Response(FoodSerializer(recipe.food).data)


class RecipeIngredientViewSet(OwnedViewSet):
    serializer_class = RecipeIngredientSerializer
    model = RecipeIngredient

    def get_queryset(self):
        qs = RecipeIngredient.objects.filter(recipe__food__user=self.request.user)
        recipe_id = self.request.query_params.get("recipe")
        if recipe_id:
            qs = qs.filter(recipe_id=recipe_id)
        return qs.select_related("food", "recipe__food")

    def perform_create(self, serializer):
        with transaction.atomic():
            instance = serializer.save()
            instance.recipe.recompute_food_nutrition()

    def perform_update(self, serializer):
        with transaction.atomic():
            instance = serializer.save()
            instance.recipe.recompute_food_nutrition()

    def perform_destroy(self, instance):
        recipe = instance.recipe
        with transaction.atomic():
            instance.delete()
            recipe.recompute_food_nutrition()


class DayViewSet(OwnedViewSet):
    serializer_class = DaySerializer
    model = Day

    def get_serializer_class(self):
        from .serializers import DayCreateSerializer
        if self.action == "create":
            return DayCreateSerializer
        return DaySerializer

    def get_queryset(self):
        qs = (
            super().get_queryset()
            .prefetch_related("meals__food", "exercises")
            .select_related("sleep", "nap", "user__profile")
        )
        date_from = self.request.query_params.get("from")
        date_to = self.request.query_params.get("to")
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        return qs


class MealViewSet(OwnedViewSet):
    serializer_class = MealSerializer
    model = Meal

    def get_queryset(self):
        qs = Meal.objects.filter(day__user=self.request.user).select_related("food", "day")
        day = self.request.query_params.get("day")
        if day:
            qs = qs.filter(day_id=day)
        return qs

    def perform_create(self, serializer):
        serializer.save()


class SleepLogViewSet(OwnedViewSet):
    serializer_class = SleepLogSerializer
    model = SleepLog

    def get_queryset(self):
        return SleepLog.objects.filter(day__user=self.request.user).select_related("day")

    def perform_create(self, serializer):
        serializer.save()


class NapLogViewSet(OwnedViewSet):
    serializer_class = NapLogSerializer
    model = NapLog

    def get_queryset(self):
        return NapLog.objects.filter(day__user=self.request.user).select_related("day")

    def perform_create(self, serializer):
        serializer.save()


class ExerciseLogViewSet(OwnedViewSet):
    serializer_class = ExerciseLogSerializer
    model = ExerciseLog

    def get_queryset(self):
        qs = ExerciseLog.objects.filter(day__user=self.request.user).select_related("day")
        day = self.request.query_params.get("day")
        if day:
            qs = qs.filter(day_id=day)
        return qs

    def perform_create(self, serializer):
        serializer.save()


class WeightGoalViewSet(OwnedViewSet):
    serializer_class = WeightGoalSerializer
    model = WeightGoal
