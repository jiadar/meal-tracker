.PHONY: up down build logs test test-cov shell migrate makemigrations superuser

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f web

test:
	docker compose exec web pytest

test-cov:
	docker compose exec web pytest --cov=api --cov-report=term-missing

shell:
	docker compose exec web python manage.py shell

migrate:
	docker compose exec web python manage.py migrate

makemigrations:
	docker compose exec web python manage.py makemigrations

superuser:
	docker compose exec web python manage.py createsuperuser
