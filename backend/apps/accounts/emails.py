"""
Reusable transactional email helpers for LexCore.

Uses Django templates under templates/emails/ and the configured SMTP backend.
"""

from email.utils import formataddr, make_msgid

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string


def _frontend_url() -> str:
    return getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/")


def _from_email() -> str:
    """
    Prefer a display-name From header.

    Gmail SMTP must authenticate as EMAIL_HOST_USER; the address part of From
    should match that mailbox to avoid spoofing filters.
    """
    address = (
        getattr(settings, "DEFAULT_FROM_EMAIL", None)
        or getattr(settings, "EMAIL_HOST_USER", None)
        or "noreply@lexcore.local"
    )
    # If DEFAULT_FROM_EMAIL already includes a display name, keep it.
    if "<" in address and ">" in address:
        return address

    name = getattr(settings, "EMAIL_FROM_NAME", "LexCore Chambers")
    return formataddr((name, address))


def _reply_to() -> list[str]:
    reply = getattr(settings, "EMAIL_REPLY_TO", None) or getattr(
        settings, "EMAIL_HOST_USER", None
    )
    if not reply:
        return []
    if "<" in reply and ">" in reply:
        return [reply]
    name = getattr(settings, "EMAIL_FROM_NAME", "LexCore Chambers")
    return [formataddr((name, reply))]


def send_lexcore_email(
    *,
    subject: str,
    to_email: str,
    template_name: str,
    context: dict,
    plain_template_name: str | None = None,
):
    """
    Send a multipart (text + HTML) transactional email via configured SMTP.

    template_name: HTML template path, e.g. "emails/employee_welcome.html"
    plain_template_name: optional .txt twin; defaults to same stem with .txt
    """
    if plain_template_name is None:
        if template_name.endswith(".html"):
            plain_template_name = f"{template_name[:-5]}.txt"
        else:
            plain_template_name = f"{template_name}.txt"

    html_message = render_to_string(template_name, context)
    plain_message = render_to_string(plain_template_name, context)

    message = EmailMultiAlternatives(
        subject=subject,
        body=plain_message,
        from_email=_from_email(),
        to=[to_email],
        reply_to=_reply_to() or None,
    )
    message.attach_alternative(html_message, "text/html")

    host_user = getattr(settings, "EMAIL_HOST_USER", "") or ""
    msg_domain = host_user.split("@")[-1] if "@" in host_user else "lexcore.app"

    # Deliverability-friendly headers for transactional mail.
    message.extra_headers = {
        "Message-ID": make_msgid(domain=msg_domain),
        "X-Auto-Response-Suppress": "OOF, AutoReply",
        "Auto-Submitted": "auto-generated",
        "X-Entity-Ref-ID": make_msgid(domain=msg_domain).strip("<>"),
        "X-Mailer": "LexCore Chambers Portal",
    }

    return message.send(fail_silently=False)


def send_employee_welcome_email(*, user, temporary_password):
    """Welcome email for newly provisioned internal employees."""
    login_url = f"{_frontend_url()}/login"
    context = {
        "employee_name": user.full_name,
        "employee_email": user.email,
        "temporary_password": temporary_password,
        "login_url": login_url,
    }
    return send_lexcore_email(
        subject="Welcome to LexCore — your chambers account",
        to_email=user.email,
        template_name="emails/employee_welcome.html",
        context=context,
    )


def send_client_welcome_email(*, user, temporary_password):
    """Welcome email for clients provisioned by an administrator."""
    login_url = f"{_frontend_url()}/login"
    context = {
        "client_name": user.full_name,
        "client_email": user.email,
        "temporary_password": temporary_password,
        "login_url": login_url,
    }
    return send_lexcore_email(
        subject="Welcome to LexCore — your client portal account",
        to_email=user.email,
        template_name="emails/client_welcome.html",
        context=context,
    )


def send_password_reset_email(*, user, reset_url: str):
    """Password-reset email with branded template."""
    context = {
        "employee_name": user.full_name,
        "employee_email": user.email,
        "reset_url": reset_url,
    }
    return send_lexcore_email(
        subject="Reset your LexCore password",
        to_email=user.email,
        template_name="emails/password_reset.html",
        context=context,
    )


def send_forced_password_reset_email(*, user, temporary_password):
    """Admin-forced password reset with a new temporary password."""
    login_url = f"{_frontend_url()}/login"
    context = {
        "employee_name": user.full_name,
        "employee_email": user.email,
        "temporary_password": temporary_password,
        "login_url": login_url,
    }
    return send_lexcore_email(
        subject="Your LexCore password was reset",
        to_email=user.email,
        template_name="emails/force_password_reset.html",
        context=context,
    )
