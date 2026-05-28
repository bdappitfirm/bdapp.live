import logging
import traceback
from django.http import JsonResponse
from django.conf import settings

logger = logging.getLogger(__name__)

class GlobalExceptionHandlerMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            response = self.get_response(request)
            return response
        except Exception as e:
            # Log the error
            logger.error(f"Unhandled exception: {str(e)}")
            logger.error(traceback.format_exc())

            # Return a JSON response instead of a 500 HTML page
            error_data = {
                "detail": "An unexpected server error occurred. Please try again later.",
                "error_type": e.__class__.__name__
            }
            
            # Include more info in debug mode
            if settings.DEBUG:
                error_data["message"] = str(e)
                error_data["traceback"] = traceback.format_exc()

            return JsonResponse(error_data, status=500)
