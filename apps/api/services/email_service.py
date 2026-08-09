import os
import json
import logging
from typing import Dict, Any

import requests

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_API_URL = "https://api.resend.com/emails"
FROM_EMAIL = os.getenv("FROM_EMAIL", "onboarding@resend.dev")  # Verify domain in Resend

class EmailService:
    @staticmethod
    async def send_interview_scheduled(candidate_email: str, interview_data: Dict[str, Any]):
        """Send interview scheduled notification"""
        try:
            subject = f"Interview Scheduled: {interview_data.get('jobTitle', 'Position')}"
            html_content = f"""
            <h2>Interview Scheduled</h2>
            <p>Dear Candidate,</p>
            <p>Your interview has been scheduled for:</p>
            <ul>
                <li><strong>Position:</strong> {interview_data.get('jobTitle', 'Position')}</li>
                <li><strong>Company:</strong> {interview_data.get('company', 'Company')}</li>
                <li><strong>Date:</strong> {interview_data.get('scheduledAt', 'Date')}</li>
                <li><strong>Duration:</strong> {interview_data.get('durationMinutes', 30)} minutes</li>
            </ul>
            <p>Please join the interview room at the scheduled time using the link provided by your recruiter.</p>
            <p>Best regards,</p>
            <p>The Hiring Team</p>
            """

            return await EmailService._send_email(
                to_emails=[candidate_email],
                subject=subject,
                html_content=html_content
            )
        except Exception as e:
            logger.error(f"Failed to send interview scheduled email: {e}")
            return {"status": "failed", "error": str(e)}

    @staticmethod
    async def send_interview_reminder(candidate_email: str, interview_data: Dict[str, Any], hours_before: int):
        """Send interview reminder notification"""
        try:
            subject = f"Interview Reminder: {interview_data.get('jobTitle', 'Position')} in {hours_before} hours"
            html_content = f"""
            <h2>Interview Reminder</h2>
            <p>Dear Candidate,</p>
            <p>This is a reminder that your interview for <strong>{interview_data.get('jobTitle', 'Position')}</strong> is scheduled in {hours_before} hours.</p>
            <ul>
                <li><strong>Position:</strong> {interview_data.get('jobTitle', 'Position')}</li>
                <li><strong>Company:</strong> {interview_data.get('company', 'Company')}</li>
                <li><strong>Date:</strong> {interview_data.get('scheduledAt', 'Date')}</li>
                <li><strong>Duration:</strong> {interview_data.get('durationMinutes', 30)} minutes</li>
            </ul>
            <p>Please prepare to join the interview room at the scheduled time.</p>
            <p>Best regards,</p>
            <p>The Hiring Team</p>
            """

            return await EmailService._send_email(
                to_emails=[candidate_email],
                subject=subject,
                html_content=html_content
            )
        except Exception as e:
            logger.error(f"Failed to send interview reminder email: {e}")
            return {"status": "failed", "error": str(e)}

    @staticmethod
    async def send_interview_missed(candidate_email: str, interview_data: Dict[str, Any]):
        """Send interview missed notification"""
        try:
            subject = f"Missed Interview: {interview_data.get('jobTitle', 'Position')}"
            html_content = f"""
            <h2>Missed Interview Notification</h2>
            <p>Dear Candidate,</p>
            <p>We noticed that you did not attend your scheduled interview for:</p>
            <ul>
                <li><strong>Position:</strong> {interview_data.get('jobTitle', 'Position')}</li>
                <li><strong>Company:</strong> {interview_data.get('company', 'Company')}</li>
                <li><strong>Scheduled Date:</strong> {interview_data.get('scheduledAt', 'Date')}</li>
            </ul>
            <p>If you believe this is in error or wish to reschedule, please contact your recruiter immediately.</p>
            <p>Best regards,</p>
            <p>The Hiring Team</p>
            """

            return await EmailService._send_email(
                to_emails=[candidate_email],
                subject=subject,
                html_content=html_content
            )
        except Exception as e:
            logger.error(f"Failed to send interview missed email: {e}")
            return {"status": "failed", "error": str(e)}

    @staticmethod
    async def _send_email(to_emails: list, subject: str, html_content: str) -> Dict[str, Any]:
        """Send email via Resend API"""
        if not RESEND_API_KEY:
            logger.warning("RESEND_API_KEY not set, simulating email send")
            # Simulate sending for development
            logger.info(f"SIMULATED EMAIL to {to_emails}: {subject}")
            return {"status": "sent", "simulated": True}

        payload = {
            "from": FROM_EMAIL,
            "to": to_emails,
            "subject": subject,
            "html": html_content
        }

        headers = {
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json"
        }

        try:
            response = requests.post(RESEND_API_URL, json=payload, headers=headers)
            response.raise_for_status()
            logger.info(f"Email sent successfully to {to_emails}")
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to send email via Resend: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Resend API response: {e.response.text}")
            return {"status": "failed", "error": str(e)}