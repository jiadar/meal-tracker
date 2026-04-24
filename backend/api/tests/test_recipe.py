from decimal import Decimal

import pytest

from api.models import Food, Recipe, RecipeIngredient, User


@pytest.fixture
def olive_oil(user):
    return Food.objects.create(
        user=user, name="Olive Oil", calories=884, fat=100, sat_fat=14,
    )


@pytest.fixture
def tomato(user):
    return Food.objects.create(
        user=user, name="Tomato", calories=18, fat=0.2, carbs=3.9,
    )


@pytest.fixture
def dish(user):
    return Food.objects.create(user=user, name="Simple Sauce")


@pytest.mark.django_db
def test_create_recipe_requires_own_food(auth_client, user):
    other = User.objects.create_user(email="other@example.com", password="OtherPass!1")
    other_food = Food.objects.create(user=other, name="Stranger Dish")
    resp = auth_client.post(
        "/api/v1/recipes/",
        {"food": str(other_food.id), "instructions": "hi"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_create_recipe_and_ingredients_recomputes_food_nutrition(
    auth_client, user, olive_oil, tomato, dish
):
    recipe_resp = auth_client.post(
        "/api/v1/recipes/",
        {
            "food": str(dish.id),
            "instructions": "Mix oil with crushed tomato.",
            "servings": 2,
            "prep_time_minutes": 5,
            "cook_time_minutes": 15,
        },
        format="json",
    )
    assert recipe_resp.status_code == 201
    recipe_id = recipe_resp.json()["id"]

    auth_client.post(
        "/api/v1/recipe-ingredients/",
        {"recipe": recipe_id, "food": str(olive_oil.id), "grams": 10, "position": 0},
        format="json",
    )
    auth_client.post(
        "/api/v1/recipe-ingredients/",
        {"recipe": recipe_id, "food": str(tomato.id), "grams": 90, "position": 1},
        format="json",
    )

    dish.refresh_from_db()
    assert dish.is_composite is True
    # 10g olive oil @ 884 cal/100g = 88.4 cal; 90g tomato @ 18 cal/100g = 16.2 cal
    # Total 104.6 cal over 100g total -> 104.6 cal per 100g
    assert dish.calories == Decimal("104.6000")
    assert dish.fat == Decimal("10.1800")


@pytest.mark.django_db
def test_recompute_endpoint_refreshes_nutrition(auth_client, user, olive_oil, tomato, dish):
    recipe = Recipe.objects.create(food=dish)
    RecipeIngredient.objects.create(recipe=recipe, food=olive_oil, grams=10, position=0)
    RecipeIngredient.objects.create(recipe=recipe, food=tomato, grams=90, position=1)

    # dish.calories is still 0 because we bypassed the viewset
    dish.refresh_from_db()
    assert dish.calories == Decimal("0.0000")

    resp = auth_client.post(f"/api/v1/recipes/{recipe.id}/recompute/")
    assert resp.status_code == 200
    dish.refresh_from_db()
    assert dish.calories == Decimal("104.6000")


@pytest.mark.django_db
def test_recompute_with_total_grams_produced(auth_client, user, olive_oil, tomato, dish):
    # Cooking loses water: start with 100g ingredients but yield is 80g
    recipe = Recipe.objects.create(food=dish, total_grams_produced=Decimal("80"))
    RecipeIngredient.objects.create(recipe=recipe, food=olive_oil, grams=10, position=0)
    RecipeIngredient.objects.create(recipe=recipe, food=tomato, grams=90, position=1)

    recipe.recompute_food_nutrition()
    dish.refresh_from_db()
    # 104.6 cal total / 80g * 100 = 130.75 cal/100g
    assert dish.calories == Decimal("130.7500")


@pytest.mark.django_db
def test_ingredient_update_recomputes(auth_client, user, olive_oil, tomato, dish):
    recipe = Recipe.objects.create(food=dish)
    ing = RecipeIngredient.objects.create(recipe=recipe, food=olive_oil, grams=10, position=0)
    RecipeIngredient.objects.create(recipe=recipe, food=tomato, grams=90, position=1)
    recipe.recompute_food_nutrition()
    dish.refresh_from_db()
    assert dish.calories == Decimal("104.6000")

    resp = auth_client.patch(
        f"/api/v1/recipe-ingredients/{ing.id}/", {"grams": 20}, format="json"
    )
    assert resp.status_code == 200
    dish.refresh_from_db()
    # 20g oil @ 884 + 90g tomato @ 18 = 176.8+16.2 = 193 cal over 110g -> 175.4545 cal/100g
    assert dish.calories == Decimal("175.4545")


@pytest.mark.django_db
def test_ingredient_delete_recomputes(auth_client, user, olive_oil, tomato, dish):
    recipe = Recipe.objects.create(food=dish)
    ing_oil = RecipeIngredient.objects.create(recipe=recipe, food=olive_oil, grams=10, position=0)
    RecipeIngredient.objects.create(recipe=recipe, food=tomato, grams=90, position=1)
    recipe.recompute_food_nutrition()

    resp = auth_client.delete(f"/api/v1/recipe-ingredients/{ing_oil.id}/")
    assert resp.status_code == 204
    dish.refresh_from_db()
    # only 90g tomato @ 18 cal/100g left -> still 18 cal/100g
    assert dish.calories == Decimal("18.0000")


@pytest.mark.django_db
def test_cannot_list_other_users_recipes(auth_client):
    other = User.objects.create_user(email="other@example.com", password="OtherPass!1")
    their_food = Food.objects.create(user=other, name="Their Dish")
    Recipe.objects.create(food=their_food)
    resp = auth_client.get("/api/v1/recipes/")
    assert resp.json()["count"] == 0


@pytest.mark.django_db
def test_recipe_ingredient_must_belong_to_same_user(auth_client, user, dish):
    other = User.objects.create_user(email="other@example.com", password="OtherPass!1")
    other_food = Food.objects.create(user=other, name="Stranger Ingredient", calories=50)
    recipe = Recipe.objects.create(food=dish)

    resp = auth_client.post(
        "/api/v1/recipe-ingredients/",
        {"recipe": str(recipe.id), "food": str(other_food.id), "grams": 10},
        format="json",
    )
    assert resp.status_code == 400
