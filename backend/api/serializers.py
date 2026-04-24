from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

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
    UserProfile,
    UserTargets,
    WeightGoal,
)


# ---------- Auth / Profile ----------


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = (
            "display_name",
            "timezone",
            "bmr",
            "onboarded_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def validate_timezone(self, value):
        import zoneinfo
        try:
            zoneinfo.ZoneInfo(value)
        except zoneinfo.ZoneInfoNotFoundError:
            raise serializers.ValidationError(f"Unknown timezone: {value}")
        return value


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer()

    class Meta:
        model = User
        fields = ("id", "email", "is_email_verified", "date_joined", "profile")
        read_only_fields = ("id", "email", "is_email_verified", "date_joined")

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", None)
        instance = super().update(instance, validated_data)
        if profile_data is not None:
            profile = instance.profile
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()
        return instance


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    display_name = serializers.CharField(required=False, allow_blank=True, max_length=100)

    def validate_email(self, value):
        normalized = value.lower().strip()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return normalized

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        display_name = validated_data.pop("display_name", "")
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
        )
        if display_name:
            user.profile.display_name = display_name
            user.profile.save(update_fields=["display_name", "updated_at"])
        return user


class EmailLoginTokenSerializer(TokenObtainPairSerializer):
    username_field = User.USERNAME_FIELD

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["email"] = user.email
        token["is_email_verified"] = user.is_email_verified
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Incorrect password.")
        return value

    def validate_new_password(self, value):
        validate_password(value, user=self.context["request"].user)
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value


# ---------- Targets ----------


class UserTargetsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserTargets
        fields = [
            "id",
            "fat_pct_low", "fat_pct_high",
            "sat_fat_pct_low", "sat_fat_pct_high",
            "carb_pct_low", "carb_pct_high",
            "protein_pct_low", "protein_pct_high",
            "added_sugar_pct_low", "added_sugar_pct_high",
            "cholesterol_low", "cholesterol_high",
            "sodium_low", "sodium_high",
            "fiber_low", "fiber_high",
            "protein_min",
            "creatine_min",
            "sleep_hours_low", "sleep_hours_high",
            "sleep_quality_low", "sleep_quality_high",
            "created_at", "updated_at",
        ]
        read_only_fields = ("id", "created_at", "updated_at")


# ---------- Food / Recipe ----------


class FoodSerializer(serializers.ModelSerializer):
    has_recipe = serializers.SerializerMethodField()

    class Meta:
        model = Food
        fields = [
            "id", "name", "is_composite", "has_recipe",
            "calories", "fat", "sat_fat", "cholesterol", "sodium",
            "carbs", "fiber", "sugar", "add_sugar", "protein",
            "created_at", "updated_at",
        ]
        read_only_fields = ("id", "has_recipe", "created_at", "updated_at")

    def get_has_recipe(self, obj):
        return hasattr(obj, "recipe")

    def validate_name(self, value):
        user = self.context["request"].user
        qs = Food.objects.filter(user=user, name=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("You already have a food with this name.")
        return value


class RecipeIngredientSerializer(serializers.ModelSerializer):
    food_name = serializers.CharField(source="food.name", read_only=True)

    class Meta:
        model = RecipeIngredient
        fields = ("id", "recipe", "food", "food_name", "grams", "note", "position")
        read_only_fields = ("id", "food_name")

    def validate_food(self, value):
        user = self.context["request"].user
        if value.user_id != user.id:
            raise serializers.ValidationError("Ingredient food must belong to you.")
        return value

    def validate_recipe(self, value):
        user = self.context["request"].user
        if value.food.user_id != user.id:
            raise serializers.ValidationError("Recipe must belong to you.")
        return value


class RecipeSerializer(serializers.ModelSerializer):
    ingredients = RecipeIngredientSerializer(many=True, read_only=True)

    class Meta:
        model = Recipe
        fields = [
            "id", "food",
            "servings", "total_grams_produced",
            "prep_time_minutes", "cook_time_minutes",
            "instructions", "notes", "source_url",
            "ingredients",
            "created_at", "updated_at",
        ]
        read_only_fields = ("id", "ingredients", "created_at", "updated_at")

    def validate_food(self, value):
        user = self.context["request"].user
        if value.user_id != user.id:
            raise serializers.ValidationError("Recipe food must belong to you.")
        return value


# ---------- Day nested children ----------


class MealSerializer(serializers.ModelSerializer):
    food_name = serializers.CharField(source="food.name", read_only=True)
    nutrition = serializers.SerializerMethodField()
    food_per_100g = serializers.SerializerMethodField()

    class Meta:
        model = Meal
        fields = (
            "id", "day", "food", "food_name", "grams", "position",
            "nutrition", "food_per_100g",
        )
        read_only_fields = ("id", "food_name", "nutrition", "food_per_100g")

    def get_nutrition(self, obj):
        from .nutrition import nutrients_for_meal
        return {k: float(v) for k, v in nutrients_for_meal(obj).items()}

    def get_food_per_100g(self, obj):
        return {
            "calories": float(obj.food.calories),
            "fat": float(obj.food.fat),
            "sat_fat": float(obj.food.sat_fat),
            "cholesterol": float(obj.food.cholesterol),
            "sodium": float(obj.food.sodium),
            "carbs": float(obj.food.carbs),
            "fiber": float(obj.food.fiber),
            "sugar": float(obj.food.sugar),
            "add_sugar": float(obj.food.add_sugar),
            "protein": float(obj.food.protein),
        }

    def validate(self, attrs):
        user = self.context["request"].user
        day = attrs.get("day") or getattr(self.instance, "day", None)
        food = attrs.get("food") or getattr(self.instance, "food", None)
        if day and day.user_id != user.id:
            raise serializers.ValidationError({"day": "Day must belong to you."})
        if food and food.user_id != user.id:
            raise serializers.ValidationError({"food": "Food must belong to you."})
        return attrs


class SleepLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SleepLog
        fields = ("id", "day", "hours", "quality", "bedtime", "wake", "meds")
        read_only_fields = ("id",)

    def validate_day(self, value):
        user = self.context["request"].user
        if value.user_id != user.id:
            raise serializers.ValidationError("Day must belong to you.")
        return value


class NapLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = NapLog
        fields = ("id", "day", "hours", "start_time")
        read_only_fields = ("id",)

    def validate_day(self, value):
        user = self.context["request"].user
        if value.user_id != user.id:
            raise serializers.ValidationError("Day must belong to you.")
        return value


class ExerciseLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExerciseLog
        fields = ("id", "day", "activity", "duration_minutes", "calories", "position")
        read_only_fields = ("id",)

    def validate_day(self, value):
        user = self.context["request"].user
        if value.user_id != user.id:
            raise serializers.ValidationError("Day must belong to you.")
        return value


# ---------- Day (with read-only nested summary) ----------


class DaySerializer(serializers.ModelSerializer):
    meals = MealSerializer(many=True, read_only=True)
    sleep = SleepLogSerializer(read_only=True)
    nap = NapLogSerializer(read_only=True)
    exercises = ExerciseLogSerializer(many=True, read_only=True)
    summary = serializers.SerializerMethodField()

    class Meta:
        model = Day
        fields = [
            "id", "date", "location", "weight_lbs", "creatine_mg",
            "meals", "sleep", "nap", "exercises",
            "summary",
            "created_at", "updated_at",
        ]
        read_only_fields = (
            "id", "meals", "sleep", "nap", "exercises",
            "summary", "created_at", "updated_at",
        )

    def get_summary(self, obj):
        from .nutrition import day_summary
        bmr = obj.user.profile.bmr if hasattr(obj.user, "profile") else 1970
        return day_summary(obj, bmr)

    def validate_date(self, value):
        user = self.context["request"].user
        qs = Day.objects.filter(user=user, date=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("You already have a day recorded for this date.")
        return value


class DayCreateSerializer(DaySerializer):
    """Same as DaySerializer but `date` can default to user's local today on create."""

    date = serializers.DateField(required=False)

    def validate_date(self, value):
        return super().validate_date(value)

    def create(self, validated_data):
        if "date" not in validated_data or validated_data["date"] is None:
            user = self.context["request"].user
            validated_data["date"] = user.profile.today()
        return super().create(validated_data)


# ---------- Weight Goal ----------


class WeightGoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeightGoal
        fields = [
            "id", "start_date", "end_date",
            "start_weight", "goal_weight", "active",
            "created_at", "updated_at",
        ]
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        start = attrs.get("start_date") or getattr(self.instance, "start_date", None)
        end = attrs.get("end_date") or getattr(self.instance, "end_date", None)
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "end_date must be >= start_date."})
        return attrs
