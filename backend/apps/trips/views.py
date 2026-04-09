"""
Trip views.
"""
import hashlib
import logging

from django.conf import settings
from pydantic import ValidationError as PydanticValidationError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from services.baidu_poi_service import BaiduAPIError
from services.itinerary_schema import ItineraryDraftV1
from services.llm_client import (
    LLMBadResponseError,
    LLMTimeoutError,
    LLMUnavailableError,
    chat_completion,
    user_message_for_llm_failure,
)
from services.llm_itinerary_prompt import build_messages
from services.llm_response_json import LLMJSONParseError, parse_assistant_json
from services.smart_trip_builder import commit_draft

from .models import Trip
from .serializers import (
    SmartTripCommitRequestSerializer,
    SmartTripDraftRequestSerializer,
    TripCreateSerializer,
    TripSerializer,
)

logger = logging.getLogger(__name__)


def _user_text_log_extra(user_text: str) -> dict:
    h = hashlib.sha256(user_text.encode('utf-8')).hexdigest()[:16]
    return {'user_text_len': len(user_text), 'user_text_sha256_16': h}


class TripViewSet(viewsets.ModelViewSet):
    """
    Trip ViewSet - provides CRUD operations for Trips.

    list: GET /api/v1/trips/
    create: POST /api/v1/trips/
    retrieve: GET /api/v1/trips/{id}/
    update: PUT /api/v1/trips/{id}/
    destroy: DELETE /api/v1/trips/{id}/
    """
    queryset = Trip.objects.all()

    def get_serializer_class(self):
        if self.action == 'create':
            return TripCreateSerializer
        return TripSerializer

    def get_queryset(self):
        queryset = Trip.objects.all()

        destination = self.request.query_params.get('destination', None)
        if destination:
            queryset = queryset.filter(destination__icontains=destination)

        return queryset.prefetch_related('routes__route_pois__poi')

    @action(detail=False, methods=['post'], url_path='ai-draft')
    def ai_draft(self, request):
        """POST /api/v1/trips/ai-draft/ — LLM structured draft, no Trip persisted."""
        ser = SmartTripDraftRequestSerializer(data=request.data)
        if not ser.is_valid():
            return Response(
                {
                    'error': 'bad_request',
                    'message': '请求参数无效',
                    'details': ser.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_text = ser.validated_data['user_text']
        extra = _user_text_log_extra(user_text)

        try:
            messages = build_messages(user_text)
            raw = chat_completion(messages, timeout=settings.LLM_TIMEOUT)
            data = parse_assistant_json(raw)
            draft = ItineraryDraftV1.model_validate(data)
        except PydanticValidationError as e:
            logger.info('Draft validation failed', extra=extra)
            return Response(
                {
                    'error': 'draft_validation_failed',
                    'message': '行程草案不符合约定格式',
                    'details': e.errors(),
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        except LLMJSONParseError as e:
            logger.info('LLM JSON parse failed', extra=extra)
            return Response(
                {
                    'error': 'draft_validation_failed',
                    'message': str(e),
                    'details': {},
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        except LLMTimeoutError:
            logger.warning('LLM timeout', extra=extra)
            return Response(
                {'error': 'llm_timeout', 'message': '生成行程超时，请稍后重试', 'details': {}},
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )
        except (LLMUnavailableError, LLMBadResponseError) as e:
            logger.warning('LLM unavailable', extra={**extra, 'err': str(e)})
            msg, err_details = user_message_for_llm_failure(e)
            return Response(
                {'error': 'llm_unavailable', 'message': msg, 'details': err_details},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({'draft': draft.model_dump(mode='json')})

    @action(detail=False, methods=['post'], url_path='ai-commit')
    def ai_commit(self, request):
        """POST /api/v1/trips/ai-commit/ — persist draft as Trip/Routes/POIs."""
        ser = SmartTripCommitRequestSerializer(data=request.data)
        if not ser.is_valid():
            return Response(
                {
                    'error': 'bad_request',
                    'message': '请求参数无效',
                    'details': ser.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_draft = ser.validated_data['draft']
        trip_meta = ser.validated_data.get('trip')
        if not trip_meta:
            trip_meta = {}

        try:
            draft = ItineraryDraftV1.model_validate(raw_draft)
        except PydanticValidationError as e:
            return Response(
                {
                    'error': 'draft_validation_failed',
                    'message': '行程草案不符合约定格式',
                    'details': e.errors(),
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        try:
            trip, warnings = commit_draft(draft, trip_meta)
        except BaiduAPIError as e:
            logger.warning('Baidu unavailable during ai-commit', extra={'err': str(e)})
            return Response(
                {'error': 'baidu_unavailable', 'message': '地图服务暂不可用，请稍后重试', 'details': {}},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        payload = {
            'trip': TripSerializer(trip).data,
            'warnings': warnings,
        }
        return Response(payload, status=status.HTTP_201_CREATED)
