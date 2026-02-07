"""
Email service for sending alert notifications.
Uses SMTP - can be configured for SendGrid, SES, or any SMTP provider.
"""
from __future__ import annotations

import asyncio
import logging
import smtplib
import ssl
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import escape
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.utils.privacy import mask_email

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending email alerts."""
    
    def __init__(self):
        self.smtp_host = getattr(settings, 'SMTP_HOST', 'localhost')
        self.smtp_port = getattr(settings, 'SMTP_PORT', 587)
        self.smtp_user = getattr(settings, 'SMTP_USER', None)
        self.smtp_password = getattr(settings, 'SMTP_PASSWORD', None)
        self.from_email = getattr(settings, 'FROM_EMAIL', 'alerts@catastrophe-mapping.com')
        self.from_name = getattr(settings, 'FROM_NAME', 'Catastrophe Mapping Alerts')
    
    def _get_earthquake_html(self, event: Dict[str, Any]) -> str:
        """Generate HTML for earthquake alert."""
        return f"""
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 16px 0;">
            <h2 style="color: #92400e; margin: 0 0 8px 0;">🔴 Earthquake Alert</h2>
            <p style="font-size: 24px; font-weight: bold; color: #78350f; margin: 0;">
                Magnitude {escape(str(event.get('magnitude', 'N/A')))}
            </p>
            <p style="color: #92400e; margin: 8px 0;">{escape(str(event.get('place', 'Unknown location')))}</p>
            <p style="color: #a16207; font-size: 14px;">
                Depth: {escape(str(event.get('depth_km', 'N/A')))} km<br>
                Time: {escape(str(event.get('event_time', 'Unknown')))}
            </p>
        </div>
        """
    
    def _get_hurricane_html(self, event: Dict[str, Any]) -> str:
        """Generate HTML for hurricane alert."""
        category = event.get('category')
        cat_text = f"Category {escape(str(category))}" if category else "Tropical Storm"
        return f"""
        <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 16px; margin: 16px 0;">
            <h2 style="color: #1e40af; margin: 0 0 8px 0;">🌀 Hurricane Alert</h2>
            <p style="font-size: 24px; font-weight: bold; color: #1e3a8a; margin: 0;">
                {escape(str(event.get('name', 'Unknown')))} - {cat_text}
            </p>
            <p style="color: #1e40af; margin: 8px 0;">{escape(str(event.get('classification', '')))}</p>
            <p style="color: #3730a3; font-size: 14px;">
                Max winds: {escape(str(event.get('max_wind_mph', 'N/A')))} mph<br>
                Location: {escape(str(event.get('latitude', 'N/A')))}°, {escape(str(event.get('longitude', 'N/A')))}°
            </p>
        </div>
        """
    
    def _get_wildfire_html(self, event: Dict[str, Any]) -> str:
        """Generate HTML for wildfire alert."""
        return f"""
        <div style="background: #ffedd5; border-left: 4px solid #f97316; padding: 16px; margin: 16px 0;">
            <h2 style="color: #c2410c; margin: 0 0 8px 0;">🔥 Wildfire Alert</h2>
            <p style="font-size: 20px; font-weight: bold; color: #9a3412; margin: 0;">
                {escape(str(event.get('name', 'Active Fire Detected')))}
            </p>
            <p style="color: #c2410c; font-size: 14px; margin: 8px 0;">
                Fire Radiative Power: {escape(str(event.get('frp', 'N/A')))} MW<br>
                Confidence: {escape(str(event.get('confidence', 'N/A')))}%<br>
                Location: {escape(str(event.get('latitude', 'N/A')))}°, {escape(str(event.get('longitude', 'N/A')))}°
            </p>
        </div>
        """
    
    def _get_severe_weather_html(self, event: Dict[str, Any]) -> str:
        """Generate HTML for severe weather alert."""
        event_type_raw = event.get('event_type', 'severe weather')
        emoji_map = {'tornado': '🌪️', 'flooding': '🌊', 'hail': '🧊'}
        emoji = emoji_map.get(event_type_raw, '⚡')
        
        color_map = {
            'tornado': ('#f3e8ff', '#9333ea', '#7c3aed'),
            'flooding': ('#dbeafe', '#2563eb', '#1d4ed8'),
            'hail': ('#cffafe', '#0891b2', '#0e7490'),
        }
        colors = color_map.get(event_type_raw, ('#f3f4f6', '#4b5563', '#374151'))
        
        return f"""
        <div style="background: {colors[0]}; border-left: 4px solid {colors[1]}; padding: 16px; margin: 16px 0;">
            <h2 style="color: {colors[2]}; margin: 0 0 8px 0;">{emoji} {escape(event_type_raw.title())} Alert</h2>
            <p style="font-size: 18px; font-weight: bold; color: {colors[2]}; margin: 0;">
                {escape(str(event.get('location', 'Unknown location')))}
            </p>
            <p style="color: {colors[1]}; margin: 8px 0;">{escape(str(event.get('description', '')))}</p>
            <p style="color: {colors[1]}; font-size: 14px;">
                Severity: {escape(str(event.get('severity', 'N/A')))}<br>
                Expires: {escape(str(event.get('expires_at', 'N/A')))}
            </p>
        </div>
        """
    
    def _build_alert_email(
        self,
        events: List[Dict[str, Any]],
        subscriber_email: str,
        unsubscribe_token: str
    ) -> tuple:
        """Build a complete alert email with multiple events."""
        
        event_html = ""
        event_summary = []
        
        for event in events:
            event_type = event.get('type', 'unknown')
            if event_type == 'earthquake':
                event_html += self._get_earthquake_html(event)
                event_summary.append(f"M{event.get('magnitude', '?')} Earthquake")
            elif event_type == 'hurricane':
                event_html += self._get_hurricane_html(event)
                event_summary.append(f"Hurricane {event.get('name', 'Unknown')}")
            elif event_type == 'wildfire':
                event_html += self._get_wildfire_html(event)
                event_summary.append("Wildfire")
            elif event_type in ('tornado', 'flooding', 'hail'):
                event_html += self._get_severe_weather_html(event)
                event_summary.append(event_type.title())
        
        subject = f"🚨 Catastrophe Alert: {', '.join(event_summary[:3])}"
        if len(event_summary) > 3:
            subject += f" (+{len(event_summary) - 3} more)"
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
            <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 24px;">🚨 Catastrophe Alert</h1>
                <p style="margin: 8px 0 0 0; opacity: 0.9;">{len(events)} new event(s) matching your criteria</p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                {event_html}
                
                <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px;">
                        View all events on our 
                        <a href="https://catastrophe-mapping.com" style="color: #dc2626;">live map</a>
                    </p>
                </div>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
                <p>You're receiving this because you subscribed to catastrophe alerts.</p>
                <p>
                    <a href="https://catastrophe-mapping.com/api/subscriptions/unsubscribe/{unsubscribe_token}" 
                       style="color: #9ca3af;">Unsubscribe</a> | 
                    <a href="https://catastrophe-mapping.com/alerts/preferences" 
                       style="color: #9ca3af;">Manage Preferences</a>
                </p>
            </div>
        </body>
        </html>
        """
        
        # Plain text version
        text_parts = [f"🚨 CATASTROPHE ALERT - {len(events)} new event(s)\n"]
        for event in events:
            event_type = event.get('type', 'unknown')
            if event_type == 'earthquake':
                text_parts.append(f"\n🔴 EARTHQUAKE: M{event.get('magnitude')} - {event.get('place')}")
            elif event_type == 'hurricane':
                text_parts.append(f"\n🌀 HURRICANE: {event.get('name')} - {event.get('classification')}")
            elif event_type == 'wildfire':
                text_parts.append(f"\n🔥 WILDFIRE: {event.get('name', 'Active Fire')}")
            else:
                text_parts.append(f"\n⚡ {event_type.upper()}: {event.get('location', 'Unknown')}")
        
        text_parts.append(f"\n\nView all events: https://catastrophe-mapping.com")
        text_parts.append(f"\nUnsubscribe: https://catastrophe-mapping.com/api/subscriptions/unsubscribe/{unsubscribe_token}")
        
        text = "\n".join(text_parts)
        
        return subject, html, text
    
    async def send_alert_email(
        self,
        to_email: str,
        events: List[Dict[str, Any]],
        unsubscribe_token: str
    ) -> bool:
        """Send an alert email with one or more events."""
        
        subject, html, text = self._build_alert_email(events, to_email, unsubscribe_token)
        
        return await self.send_email(to_email, subject, html, text)
    
    async def send_verification_email(self, to_email: str, token: str) -> bool:
        """Send email verification link."""
        
        verify_url = f"https://catastrophe-mapping.com/api/subscriptions/verify/{token}"
        
        subject = "Verify your Catastrophe Mapping Alert Subscription"
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #1f2937; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="margin: 0;">🌍 Catastrophe Mapping</h1>
            </div>
            <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                <h2 style="color: #1f2937;">Verify Your Email</h2>
                <p style="color: #4b5563;">Click the button below to confirm your subscription to catastrophe alerts:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{verify_url}" 
                       style="background: #dc2626; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                        Verify Email Address
                    </a>
                </div>
                <p style="color: #6b7280; font-size: 14px;">
                    If you didn't request this, you can safely ignore this email.
                </p>
            </div>
        </body>
        </html>
        """
        
        text = f"""
        Verify your Catastrophe Mapping Alert Subscription
        
        Click the link below to confirm your subscription:
        {verify_url}
        
        If you didn't request this, you can safely ignore this email.
        """
        
        return await self.send_email(to_email, subject, html, text)
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html: str,
        text: str
    ) -> bool:
        """Send an email via SMTP."""
        
        # For development, just log the email
        if not self.smtp_user or self.smtp_host == 'localhost':
            logger.info(
                "Email (dev mode) TO=%s SUBJECT=%s BODY=%s",
                mask_email(to_email),
                subject,
                text[:500],
            )
            return True
        
        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{self.from_name} <{self.from_email}>"
            message["To"] = to_email
            
            message.attach(MIMEText(text, "plain"))
            message.attach(MIMEText(html, "html"))
            
            # Run SMTP in thread pool to not block
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, self._send_smtp, message, to_email)
            
            return True
        except Exception as e:
            logger.error("Error sending email to %s: %s", mask_email(to_email), e)
            return False
    
    def _send_smtp(self, message: MIMEMultipart, to_email: str):
        """Synchronous SMTP send."""
        context = ssl.create_default_context()
        
        with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
            server.starttls(context=context)
            if self.smtp_user and self.smtp_password:
                server.login(self.smtp_user, self.smtp_password)
            server.sendmail(self.from_email, to_email, message.as_string())


# Singleton instance
email_service = EmailService()
