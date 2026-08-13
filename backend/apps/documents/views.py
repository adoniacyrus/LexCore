import mimetypes
import os
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cases.models import Case
from apps.cases.permissions import IsCaseParticipant
from .models import Document
from .permissions import IsDocumentAuthorized
from .serializers import DocumentSerializer


def _get_case(case_id_or_ref):
    """Lookup Case by numeric PK or case_reference."""
    if str(case_id_or_ref).isdigit():
        return get_object_or_404(Case, pk=int(case_id_or_ref))
    return get_object_or_404(Case, case_reference=case_id_or_ref)


class CaseDocumentsView(APIView):
    """
    GET /api/cases/<case_id>/documents/
    POST /api/cases/<case_id>/documents/
    Handles listing and uploading documents for a specific Case.
    Enforces Case-level access control via IsCaseParticipant.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def get(self, request, case_id):
        case = _get_case(case_id)
        # Check that caller is a participant of the case
        permission = IsCaseParticipant()
        if not permission.has_object_permission(request, self, case):
            return Response(
                {"detail": "You do not have permission to access this case."},
                status=status.HTTP_403_FORBIDDEN,
            )

        documents = Document.objects.filter(case=case).order_by("-uploaded_at")
        serializer = DocumentSerializer(documents, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, case_id):
        case = _get_case(case_id)
        # Check that caller has participant access to upload
        permission = IsCaseParticipant()
        if not permission.has_object_permission(request, self, case):
            return Response(
                {"detail": "You do not have permission to upload to this case."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = DocumentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Force case and uploaded_by context derivation from backend state
        document = serializer.save(case=case, uploaded_by=request.user)

        return Response(DocumentSerializer(document).data, status=status.HTTP_201_CREATED)


class DocumentDetailView(APIView):
    """
    GET /api/documents/<pk>/
    DELETE /api/documents/<pk>/
    Handles downloading/viewing and deleting documents.
    Enforces object-level document permission checks.
    """

    permission_classes = [IsAuthenticated, IsDocumentAuthorized]

    def get(self, request, pk):
        document = get_object_or_404(Document, pk=pk)
        self.check_object_permissions(request, document)

        # Fetch mime type of document file
        content_type, _ = mimetypes.guess_type(document.file.name)
        if not content_type:
            content_type = "application/octet-stream"

        # Determine disposition: inline for PDFs and images to support direct browser rendering
        ext = os.path.splitext(document.file.name)[1].lower()
        is_inline = ext in {".pdf", ".jpg", ".jpeg", ".png"}

        # Open file in read binary mode
        file_handle = document.file.open("rb")
        response = FileResponse(
            file_handle,
            content_type=content_type,
            as_attachment=not is_inline,
            filename=os.path.basename(document.file.name),
        )
        return response

    def delete(self, request, pk):
        document = get_object_or_404(Document, pk=pk)
        self.check_object_permissions(request, document)

        # Remove physical file from storage
        if document.file:
            document.file.delete(save=False)
        document.delete()

        return Response(
            {"detail": "Document deleted successfully."},
            status=status.HTTP_204_NO_CONTENT,
        )
