from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def _flatten(errors, out, parent_field=None):
    """Walk a DRF error payload and emit flat {code, field, message} dicts."""
    if isinstance(errors, dict):
        for field, value in errors.items():
            if field == "non_field_errors":
                _flatten(value, out, parent_field)
            else:
                full = f"{parent_field}.{field}" if parent_field else field
                _flatten(value, out, full)
    elif isinstance(errors, list):
        for item in errors:
            _flatten(item, out, parent_field)
    else:
        code = getattr(errors, "code", None) or "validation_error"
        out.append(
            {
                "code": code,
                "field": parent_field,
                "message": str(errors),
            }
        )


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return response

    data = response.data
    errors = []

    if isinstance(data, dict) and set(data.keys()) == {"detail"} and not isinstance(data["detail"], (list, dict)):
        code = getattr(data["detail"], "code", None) or "error"
        errors.append({"code": code, "field": None, "message": str(data["detail"])})
    else:
        _flatten(data, errors)

    response.data = {"errors": errors}
    return response
