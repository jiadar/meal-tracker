import uuid
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_email_verified", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    username = None
    email = models.EmailField(unique=True)
    is_email_verified = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email


class UserProfile(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="profile"
    )
    display_name = models.CharField(max_length=100, blank=True)
    timezone = models.CharField(max_length=64, default="UTC")
    bmr = models.PositiveIntegerField(default=1970)
    onboarded_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile({self.user.email})"

    def tzinfo(self):
        import zoneinfo
        try:
            return zoneinfo.ZoneInfo(self.timezone)
        except zoneinfo.ZoneInfoNotFoundError:
            return zoneinfo.ZoneInfo("UTC")

    def today(self):
        from django.utils import timezone as dj_tz
        return dj_tz.now().astimezone(self.tzinfo()).date()


NUTRIENT_FIELDS = (
    "calories",
    "fat",
    "sat_fat",
    "cholesterol",
    "sodium",
    "carbs",
    "fiber",
    "sugar",
    "add_sugar",
    "protein",
)


class UserTargets(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="targets"
    )

    # Percentage-of-calories targets (stored as whole numbers: 20 = 20%)
    fat_pct_low = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("20"))
    fat_pct_high = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("35"))
    sat_fat_pct_low = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    sat_fat_pct_high = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("10"))
    carb_pct_low = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("45"))
    carb_pct_high = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("65"))
    protein_pct_low = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("10"))
    protein_pct_high = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("35"))
    added_sugar_pct_low = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    added_sugar_pct_high = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("10"))

    # Absolute-amount targets
    cholesterol_low = models.DecimalField(max_digits=6, decimal_places=1, default=Decimal("0"))
    cholesterol_high = models.DecimalField(max_digits=6, decimal_places=1, default=Decimal("200"))
    sodium_low = models.DecimalField(max_digits=7, decimal_places=1, default=Decimal("0"))
    sodium_high = models.DecimalField(max_digits=7, decimal_places=1, default=Decimal("2300"))
    fiber_low = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal("28"))
    fiber_high = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal("34"))
    protein_min = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal("90"))
    creatine_min = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal("5"))

    # Sleep targets
    sleep_hours_low = models.DecimalField(max_digits=4, decimal_places=2, default=Decimal("8"))
    sleep_hours_high = models.DecimalField(max_digits=4, decimal_places=2, default=Decimal("10"))
    sleep_quality_low = models.PositiveSmallIntegerField(
        default=4, validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    sleep_quality_high = models.PositiveSmallIntegerField(
        default=5, validators=[MinValueValidator(1), MaxValueValidator(5)]
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Targets({self.user.email})"


class Food(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="foods"
    )
    name = models.CharField(max_length=200)
    is_composite = models.BooleanField(default=False)

    # Per-100g nutrients
    calories = models.DecimalField(max_digits=10, decimal_places=4, default=Decimal("0"))
    fat = models.DecimalField(max_digits=10, decimal_places=4, default=Decimal("0"))
    sat_fat = models.DecimalField(max_digits=10, decimal_places=4, default=Decimal("0"))
    cholesterol = models.DecimalField(max_digits=10, decimal_places=4, default=Decimal("0"))
    sodium = models.DecimalField(max_digits=10, decimal_places=4, default=Decimal("0"))
    carbs = models.DecimalField(max_digits=10, decimal_places=4, default=Decimal("0"))
    fiber = models.DecimalField(max_digits=10, decimal_places=4, default=Decimal("0"))
    sugar = models.DecimalField(max_digits=10, decimal_places=4, default=Decimal("0"))
    add_sugar = models.DecimalField(max_digits=10, decimal_places=4, default=Decimal("0"))
    protein = models.DecimalField(max_digits=10, decimal_places=4, default=Decimal("0"))

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("user", "name")]
        ordering = ["name"]

    def __str__(self):
        return self.name


class Recipe(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    food = models.OneToOneField(Food, on_delete=models.CASCADE, related_name="recipe")
    servings = models.PositiveIntegerField(null=True, blank=True)
    total_grams_produced = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    prep_time_minutes = models.PositiveIntegerField(null=True, blank=True)
    cook_time_minutes = models.PositiveIntegerField(null=True, blank=True)
    instructions = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    source_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def recompute_food_nutrition(self):
        """Recalculate per-100g values on the linked Food from ingredients."""
        ingredients = list(self.ingredients.select_related("food").all())
        if not ingredients:
            return

        total_grams = (
            self.total_grams_produced
            if self.total_grams_produced
            else sum((i.grams for i in ingredients), Decimal("0"))
        )
        if total_grams <= 0:
            return

        totals = {f: Decimal("0") for f in NUTRIENT_FIELDS}
        for ing in ingredients:
            factor = ing.grams / Decimal("100")
            for field in NUTRIENT_FIELDS:
                totals[field] += getattr(ing.food, field) * factor

        for field in NUTRIENT_FIELDS:
            per_100g = (totals[field] / total_grams * Decimal("100")).quantize(Decimal("0.0001"))
            setattr(self.food, field, per_100g)

        self.food.is_composite = True
        self.food.save()


class RecipeIngredient(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name="ingredients")
    food = models.ForeignKey(Food, on_delete=models.PROTECT, related_name="+")
    grams = models.DecimalField(max_digits=10, decimal_places=2)
    note = models.CharField(max_length=200, blank=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position"]
        unique_together = [("recipe", "position")]


class Day(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="days"
    )
    date = models.DateField()
    location = models.CharField(max_length=20, default="SD", blank=True)
    weight_lbs = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    creatine_mg = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("user", "date")]
        ordering = ["-date"]

    def __str__(self):
        return f"{self.user.email} — {self.date}"


class Meal(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    day = models.ForeignKey(Day, on_delete=models.CASCADE, related_name="meals")
    food = models.ForeignKey(Food, on_delete=models.PROTECT, related_name="+")
    grams = models.DecimalField(max_digits=10, decimal_places=2)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position"]


class SleepLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    day = models.OneToOneField(Day, on_delete=models.CASCADE, related_name="sleep")
    hours = models.DecimalField(max_digits=4, decimal_places=2)
    quality = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    bedtime = models.TimeField()
    wake = models.TimeField()
    meds = models.BooleanField(default=False)


class NapLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    day = models.OneToOneField(Day, on_delete=models.CASCADE, related_name="nap")
    hours = models.DecimalField(max_digits=4, decimal_places=2)
    start_time = models.TimeField()


class ExerciseLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    day = models.ForeignKey(Day, on_delete=models.CASCADE, related_name="exercises")
    activity = models.CharField(max_length=200)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    calories = models.PositiveIntegerField(default=0)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position"]


class WeightGoal(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="weight_goals"
    )
    start_date = models.DateField()
    end_date = models.DateField()
    start_weight = models.DecimalField(max_digits=5, decimal_places=1)
    goal_weight = models.DecimalField(max_digits=5, decimal_places=1)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date"]


@receiver(post_save, sender=User)
def create_user_related(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
        UserTargets.objects.create(user=instance)
