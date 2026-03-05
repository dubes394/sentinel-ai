"""
Regulatory Obligation Checker
------------------------------
Determines whether an incident triggers mandatory regulatory reporting.

Real Canadian regulations referenced:
- FINTRAC: operational incidents affecting AML monitoring capability
- OSC: material system failures affecting client assets
- Internal SLA: P1/P2/P3 classification

📖 Learn more: https://www.fintrac-canafe.gc.ca/guidance-directives/compliance-conformite/Guide4/4-eng
"""

REGULATORY_RULES = [
    {
        "id": "FINTRAC-OPS-1",
        "regulator": "FINTRAC",
        "rule": "Operational incident affecting transaction monitoring",
        "threshold_transactions": 500,
        "threshold_duration_minutes": 60,
        "threshold_financial_cad": 500_000,
        "notification_window_hours": 72,
        "description": "FINTRAC requires notification when AML/compliance monitoring is impaired at scale",
        "required_action": "Submit operational incident report within 72 hours",
    },
    {
        "id": "OSC-SYS-1",
        "regulator": "OSC",
        "rule": "Material system failure affecting client accounts",
        "threshold_transactions": 1000,
        "threshold_duration_minutes": 30,
        "threshold_financial_cad": 1_000_000,
        "notification_window_hours": 24,
        "description": "OSC requires notification of material failures affecting client asset access",
        "required_action": "Submit material system failure report within 24 hours",
    },
]

SEVERITY_RULES = [
    {
        "level": "P1",
        "label": "Critical",
        "condition": "Payment processing down > 5 min OR financial exposure > $1M",
    },
    {
        "level": "P2",
        "label": "High",
        "condition": "Degraded performance affecting > 100 transactions",
    },
    {
        "level": "P3",
        "label": "Medium",
        "condition": "Minor degradation, self-resolving",
    },
]


def check_regulatory_obligations(scope: dict, scenario: dict) -> dict:
    """
    Checks scope against regulatory thresholds.
    Returns list of triggered obligations and internal severity.
    """
    triggered = []
    not_triggered = []

    txns = scope["affected_transactions"]
    duration = scope["duration_minutes"]
    exposure = scope["financial_exposure_cad"]
    maintenance = scenario.get("maintenance_window", False)

    for rule in REGULATORY_RULES:
        reasons_triggered = []
        reasons_clear = []

        if txns >= rule["threshold_transactions"]:
            reasons_triggered.append(
                f"{txns:,} transactions affected (threshold: {rule['threshold_transactions']:,})"
            )
        else:
            reasons_clear.append(
                f"Only {txns:,} transactions affected (threshold: {rule['threshold_transactions']:,})"
            )

        if duration >= rule["threshold_duration_minutes"]:
            reasons_triggered.append(
                f"Duration {duration} min exceeds {rule['threshold_duration_minutes']} min threshold"
            )
        else:
            reasons_clear.append(
                f"Duration {duration} min is under {rule['threshold_duration_minutes']} min threshold"
            )

        if exposure >= rule["threshold_financial_cad"]:
            reasons_triggered.append(
                f"${exposure:,.0f} CAD exposure exceeds ${rule['threshold_financial_cad']:,.0f} threshold"
            )
        else:
            reasons_clear.append(
                f"${exposure:,.0f} CAD exposure is under ${rule['threshold_financial_cad']:,.0f} threshold"
            )

        is_triggered = len(reasons_triggered) >= 2  # At least 2 thresholds must be met

        if is_triggered and not maintenance:
            triggered.append(
                {
                    **rule,
                    "triggered": True,
                    "reasons": reasons_triggered,
                    "suppressed_by_maintenance": False,
                }
            )
        elif is_triggered and maintenance:
            triggered.append(
                {
                    **rule,
                    "triggered": False,
                    "suppressed_by_maintenance": True,
                    "reasons": reasons_triggered,
                    "suppression_note": "Thresholds met but incident occurred during scheduled maintenance window — reporting suppressed per policy",
                }
            )
        else:
            not_triggered.append({**rule, "triggered": False, "reasons": reasons_clear})

    # Determine internal severity
    if exposure >= 1_000_000 or duration >= 5:
        severity = SEVERITY_RULES[0]  # P1
    elif txns >= 100:
        severity = SEVERITY_RULES[1]  # P2
    else:
        severity = SEVERITY_RULES[2]  # P3

    mandatory_reporting = any(r["triggered"] for r in triggered)

    return {
        "mandatory_reporting_required": mandatory_reporting,
        "maintenance_window_active": maintenance,
        "internal_severity": severity,
        "triggered_obligations": triggered,
        "clear_obligations": not_triggered,
        "summary": (
            "⚠️ MANDATORY REGULATORY REPORTING REQUIRED"
            if mandatory_reporting
            else (
                "✅ No mandatory external reporting required"
                if not maintenance
                else "🔧 Maintenance window active — reporting suppressed"
            )
        ),
    }
