"""Email service — SMTP delivery and HTML template rendering.

Synchronous service.  ``send_email()`` calls ``_send_smtp()`` directly
(no asyncio).
"""
from __future__ import annotations

import html as html_mod
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional

from flask import current_app

logger = logging.getLogger(__name__)


class EmailService:
    """Handles composing and sending alert emails via SMTP."""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
    ) -> bool:
        """Send an email synchronously via SMTP.

        Args:
            to_email: Recipient email address.
            subject: Email subject line.
            html_body: HTML body content.

        Returns:
            ``True`` on success, ``False`` on failure.
        """
        return self._send_smtp(to_email, subject, html_body)

    def send_verification_email(
        self,
        to_email: str,
        verification_token: str,
        base_url: Optional[str] = None,
    ) -> bool:
        """Send a subscription verification email.

        Args:
            to_email: Recipient email address.
            verification_token: The token to embed in the link.
            base_url: Application base URL. Falls back to config.

        Returns:
            ``True`` on success, ``False`` on failure.
        """
        if base_url is None:
            base_url = current_app.config.get(
                "BASE_URL", "http://localhost:5000"
            )

        verify_url = (
            f"{base_url}/api/v1/subscriptions/verify/{verification_token}"
        )

        subject = "Verify your Catastrophe Mapping alert subscription"
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Catastrophe Mapping Alerts</h2>
            <p>Thank you for subscribing to catastrophe alerts!</p>
            <p>Please click the button below to verify your email address:</p>
            <p style="text-align: center; margin: 30px 0;">
                <a href="{verify_url}"
                   style="background-color: #2563eb; color: white; padding: 12px 24px;
                          text-decoration: none; border-radius: 6px; display: inline-block;">
                    Verify Email
                </a>
            </p>
            <p style="color: #6b7280; font-size: 14px;">
                If you did not request this subscription, you can safely ignore
                this email.
            </p>
        </body>
        </html>
        """
        return self.send_email(to_email, subject, html_body)

    def send_alert_email(
        self,
        to_email: str,
        event_type: str,
        event_data: dict,
        unsubscribe_token: str,
        base_url: Optional[str] = None,
    ) -> bool:
        """Send a catastrophe alert email.

        Selects the correct HTML template based on *event_type*.

        Args:
            to_email: Recipient email address.
            event_type: One of ``"earthquake"``, ``"hurricane"``,
                ``"wildfire"``, ``"severe_weather"``.
            event_data: Dict of event-specific fields for the template.
            unsubscribe_token: Token for the unsubscribe link.
            base_url: Application base URL.  Falls back to config.

        Returns:
            ``True`` on success, ``False`` on failure.
        """
        subject, html_body = self._build_alert_email(
            event_type, event_data, unsubscribe_token, base_url
        )
        return self.send_email(to_email, subject, html_body)

    # ------------------------------------------------------------------
    # Alert email builder
    # ------------------------------------------------------------------

    def _build_alert_email(
        self,
        event_type: str,
        event_data: dict,
        unsubscribe_token: str,
        base_url: Optional[str] = None,
    ) -> tuple[str, str]:
        """Build subject and HTML body for an alert email.

        Args:
            event_type: Event type key.
            event_data: Event fields for the template.
            unsubscribe_token: Unsubscribe link token.
            base_url: Application base URL.

        Returns:
            Tuple of (subject, html_body).
        """
        if base_url is None:
            base_url = current_app.config.get(
                "BASE_URL", "http://localhost:5000"
            )

        unsubscribe_url = (
            f"{base_url}/api/v1/subscriptions/unsubscribe/{unsubscribe_token}"
        )

        template_map = {
            "earthquake": self._get_earthquake_html,
            "hurricane": self._get_hurricane_html,
            "wildfire": self._get_wildfire_html,
            "severe_weather": self._get_severe_weather_html,
        }

        builder = template_map.get(event_type, self._get_earthquake_html)
        subject, content_html = builder(event_data)

        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">&#9888; Catastrophe Alert</h2>
            {content_html}
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">
                You are receiving this email because you subscribed to
                catastrophe alerts.
                <a href="{unsubscribe_url}">Unsubscribe</a>
            </p>
        </body>
        </html>
        """
        return subject, html_body

    # ------------------------------------------------------------------
    # HTML template helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _get_earthquake_html(data: dict) -> tuple[str, str]:
        """Build HTML content for an earthquake alert.

        Args:
            data: Earthquake event fields.

        Returns:
            Tuple of (subject, html_fragment).
        """
        magnitude = html_mod.escape(str(data.get("magnitude", "?")))
        place = html_mod.escape(str(data.get("place", "Unknown location")))
        depth = html_mod.escape(str(data.get("depth_km", "?")))
        event_time = html_mod.escape(str(data.get("event_time", "")))

        subject = f"Earthquake Alert: M{magnitude} — {place}"
        html = f"""
        <h3 style="color: #b91c1c;">Earthquake Detected</h3>
        <table style="border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 8px; font-weight: bold;">Magnitude</td>
                <td style="padding: 8px;">{magnitude}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Location</td>
                <td style="padding: 8px;">{place}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Depth</td>
                <td style="padding: 8px;">{depth} km</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Time</td>
                <td style="padding: 8px;">{event_time}</td></tr>
        </table>
        """
        return subject, html

    @staticmethod
    def _get_hurricane_html(data: dict) -> tuple[str, str]:
        """Build HTML content for a hurricane alert.

        Args:
            data: Hurricane event fields.

        Returns:
            Tuple of (subject, html_fragment).
        """
        name = html_mod.escape(str(data.get("name", "Unknown")))
        category = html_mod.escape(str(data.get("category", "?")))
        wind = html_mod.escape(str(data.get("max_wind_mph", "?")))
        pressure = html_mod.escape(str(data.get("min_pressure_mb", "N/A")))
        classification = html_mod.escape(str(data.get("classification", "Tropical Cyclone")))

        subject = f"Hurricane Alert: {name} — Category {category}"
        html = f"""
        <h3 style="color: #7c2d12;">{classification}: {name}</h3>
        <table style="border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 8px; font-weight: bold;">Category</td>
                <td style="padding: 8px;">{category}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Max Wind</td>
                <td style="padding: 8px;">{wind} mph</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Pressure</td>
                <td style="padding: 8px;">{pressure} mb</td></tr>
        </table>
        """
        return subject, html

    @staticmethod
    def _get_wildfire_html(data: dict) -> tuple[str, str]:
        """Build HTML content for a wildfire alert.

        Args:
            data: Wildfire event fields.

        Returns:
            Tuple of (subject, html_fragment).
        """
        name = html_mod.escape(str(data.get("name", "Unnamed Fire")))
        acres = html_mod.escape(str(data.get("acres_burned", "Unknown")))
        containment = html_mod.escape(str(data.get("containment_percent", "Unknown")))
        confidence = html_mod.escape(str(data.get("confidence", "?")))

        subject = f"Wildfire Alert: {name}"
        html = f"""
        <h3 style="color: #c2410c;">Wildfire Detected</h3>
        <table style="border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 8px; font-weight: bold;">Name</td>
                <td style="padding: 8px;">{name}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Acres Burned</td>
                <td style="padding: 8px;">{acres}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Containment</td>
                <td style="padding: 8px;">{containment}%</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Confidence</td>
                <td style="padding: 8px;">{confidence}%</td></tr>
        </table>
        """
        return subject, html

    @staticmethod
    def _get_severe_weather_html(data: dict) -> tuple[str, str]:
        """Build HTML content for a severe weather alert.

        Args:
            data: Severe weather event fields.

        Returns:
            Tuple of (subject, html_fragment).
        """
        event_type = data.get("event_type", "Severe Weather")
        location = html_mod.escape(str(data.get("location", "Unknown location")))
        description = html_mod.escape(str(data.get("description", "")))
        severity = html_mod.escape(str(data.get("severity", "Unknown")))

        display_type = html_mod.escape(event_type.replace("_", " ").title())
        subject = f"Severe Weather Alert: {display_type} — {location}"
        html = f"""
        <h3 style="color: #4338ca;">{display_type}</h3>
        <table style="border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 8px; font-weight: bold;">Type</td>
                <td style="padding: 8px;">{display_type}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Location</td>
                <td style="padding: 8px;">{location}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Severity</td>
                <td style="padding: 8px;">{severity}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Description</td>
                <td style="padding: 8px;">{description}</td></tr>
        </table>
        """
        return subject, html

    # ------------------------------------------------------------------
    # SMTP transport
    # ------------------------------------------------------------------

    @staticmethod
    def _send_smtp(
        to_email: str,
        subject: str,
        html_body: str,
    ) -> bool:
        """Deliver an email via SMTP.

        Settings are read from the Flask application config
        (``SETTINGS`` object).

        Args:
            to_email: Recipient address.
            subject: Message subject.
            html_body: Message body (HTML).

        Returns:
            ``True`` on success, ``False`` on failure.
        """
        settings = current_app.config["SETTINGS"]

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.FROM_NAME} <{settings.FROM_EMAIL}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))

        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.ehlo()
                if settings.SMTP_PORT == 587:
                    server.starttls()
                    server.ehlo()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(
                    settings.FROM_EMAIL, [to_email], msg.as_string()
                )
            logger.info("Email sent to %s: %s", to_email, subject)
            return True
        except Exception:
            logger.exception("Failed to send email to %s", to_email)
            return False
