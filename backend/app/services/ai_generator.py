"""
AI Generator
------------
Takes the structured investigation output and generates:
1. Internal Post-Mortem document
2. Regulatory Notification draft (if required)

Key design decision: AI generates language and judgment.
Logic layer generates facts. They never mix.

📖 Learn about Claude API: https://docs.anthropic.com/en/api/getting-started
📖 Learn about prompt engineering: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview
"""

import anthropic
import json
import os
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def generate_postmortem(investigation: dict) -> dict:
    """
    Generates a structured internal post-mortem document.
    All facts come from the investigation pipeline — AI only writes.
    """

    scenario = investigation["scenario_name"]
    root_cause = investigation["root_cause"]
    scope = investigation["scope"]
    anomalies = investigation["anomalies"]
    regulatory = investigation["regulatory"]

    # Build a rich context block for Claude
    # This is called "grounding" — we give the AI all the facts
    context = f"""
INCIDENT FACTS (verified by automated detection pipeline):

Incident Name: {scenario}
Root Cause Service: {root_cause['root_cause_service_name']} ({root_cause['confidence']:.0%} confidence)
Root Cause Reasoning: {' → '.join(root_cause['reasoning'])}

Affected Services ({anomalies['critical_count']} critical):
{chr(10).join([f"- {a['service_name']}: latency {a['current_latency_ms']}ms (normal: {a['normal_latency_ms']}ms), error rate {a['current_error_rate']:.1%} (normal: {a['normal_error_rate']:.1%})" for a in anomalies['anomalies']])}

Healthy Services (confirmed unaffected):
{chr(10).join([f"- {s['service_name']}" for s in anomalies['healthy_services']])}

Business Impact:
- Duration: {scope['duration_minutes']} minutes
- Transactions affected: {scope['affected_transactions']:,}
- Financial exposure: ${scope['financial_exposure_cad']:,.0f} CAD
- Client accounts impacted: ~{scope['estimated_accounts_impacted']:,}

Internal Severity: {regulatory['internal_severity']['level']} — {regulatory['internal_severity']['label']}
Regulatory Status: {regulatory['summary']}
"""

    prompt = f"""You are a senior Site Reliability Engineer at FinCore, Canada's largest fintech company with 3M+ users and $100B+ in assets.

Write a professional internal post-mortem document for this incident.

{context}

Generate a post-mortem with EXACTLY this JSON structure (return only valid JSON, no markdown):
{{
  "title": "Post-Mortem: [incident name] — [date placeholder]",
  "severity": "{regulatory['internal_severity']['level']}",
  "status": "Draft — Pending Human Review",
  "executive_summary": "2-3 sentence summary of what happened, impact, and current status",
  "timeline": [
    {{"time": "T+0:00", "event": "First anomaly detected"}},
    {{"time": "T+X:XX", "event": "..."}}
  ],
  "root_cause_analysis": {{
    "primary_cause": "Clear technical explanation of root cause",
    "contributing_factors": ["factor 1", "factor 2"],
    "detection_method": "How the system detected this"
  }},
  "impact": {{
    "client_impact": "Plain language description of client-facing impact",
    "financial_impact": "Dollar figure and context",
    "regulatory_impact": "Whether regulatory reporting is required"
  }},
  "what_went_well": ["item 1", "item 2"],
  "what_went_wrong": ["item 1", "item 2"],
  "action_items": [
    {{"priority": "P1", "action": "Immediate action required", "owner": "TBD", "due": "24hrs"}},
    {{"priority": "P2", "action": "Short-term fix", "owner": "TBD", "due": "1 week"}}
  ],
  "ai_confidence_note": "Brief note on what the AI is confident about vs what needs human verification"
}}"""

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()

    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    return {
        "document_type": "internal_postmortem",
        "generated": True,
        "requires_human_approval": True,
        "content": json.loads(raw),
    }


def generate_regulatory_notification(investigation: dict) -> dict:
    """
    Generates a draft regulatory notification.
    CRITICAL: This document must NEVER be sent without human review and approval.
    This is the hard stop in our system.
    """

    regulatory = investigation["regulatory"]
    scope = investigation["scope"]
    root_cause = investigation["root_cause"]

    if not regulatory["mandatory_reporting_required"]:
        return {
            "document_type": "regulatory_notification",
            "generated": False,
            "reason": "No mandatory reporting triggered — notification not required",
            "requires_human_approval": False,
        }

    # Get the most urgent obligation
    triggered = [r for r in regulatory["triggered_obligations"] if r.get("triggered")]
    if not triggered:
        return {
            "document_type": "regulatory_notification",
            "generated": False,
            "reason": "Regulatory thresholds met but suppressed by maintenance window",
            "requires_human_approval": False,
        }

    primary_obligation = triggered[0]

    context = f"""
REGULATORY OBLIGATION TRIGGERED: {primary_obligation['id']}
Regulator: {primary_obligation['regulator']}
Rule: {primary_obligation['rule']}
Required Action: {primary_obligation['required_action']}
Notification Window: Within {primary_obligation['notification_window_hours']} hours

INCIDENT DETAILS:
Root Cause: {root_cause['root_cause_service_name']}
Duration: {scope['duration_minutes']} minutes
Transactions Affected: {scope['affected_transactions']:,}
Financial Exposure: ${scope['financial_exposure_cad']:,.0f} CAD
Accounts Impacted: ~{scope['estimated_accounts_impacted']:,}
"""

    prompt = f"""You are a compliance officer at FinCore drafting a regulatory notification.

{context}

Generate a formal regulatory notification with EXACTLY this JSON structure (return only valid JSON, no markdown):
{{
  "title": "Operational Incident Report — {primary_obligation['regulator']}",
  "reference_id": "WS-INC-[PLACEHOLDER]",
  "to": "{primary_obligation['regulator']} — Compliance Division",
  "from": "FinCore Inc. — Chief Compliance Officer",
  "date": "[DATE — REQUIRES HUMAN COMPLETION]",
  "subject": "Mandatory Operational Incident Report under {primary_obligation['rule']}",
  "body_sections": [
    {{
      "heading": "1. Nature of Incident",
      "content": "Formal description of the operational incident"
    }},
    {{
      "heading": "2. Timeline and Duration",
      "content": "When it started, when detected, when resolved"
    }},
    {{
      "heading": "3. Client and Financial Impact",
      "content": "Number of accounts, transactions, and dollar exposure"
    }},
    {{
      "heading": "4. Root Cause",
      "content": "Technical root cause in plain regulatory language"
    }},
    {{
      "heading": "5. Remediation Actions",
      "content": "What was done to resolve the incident"
    }},
    {{
      "heading": "6. Preventive Measures",
      "content": "What will prevent recurrence"
    }}
  ],
  "human_review_flags": [
    "Items that MUST be verified by a human before submission"
  ],
  "legal_disclaimer": "DRAFT ONLY — This document requires review and approval by Legal and Compliance before submission to any regulatory body. Submission without human authorization is prohibited."
}}"""

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    return {
        "document_type": "regulatory_notification",
        "generated": True,
        "requires_human_approval": True,
        "hard_stop": "THIS DOCUMENT CANNOT BE SUBMITTED WITHOUT HUMAN APPROVAL",
        "obligation": primary_obligation,
        "content": json.loads(raw),
    }


def generate_all_documents(investigation: dict) -> dict:
    """
    Master function — generates all required documents in parallel context.
    Called by the API route.
    """
    postmortem = generate_postmortem(investigation)

    regulatory_notification = generate_regulatory_notification(investigation)

    return {
        "postmortem": postmortem,
        "regulatory_notification": regulatory_notification,
        "generation_complete": True,
        "human_approval_required": True,
        "message": "AI has completed document drafting. Human review and approval required before any action.",
    }
