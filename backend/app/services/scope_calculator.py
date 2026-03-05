"""
Scope Calculator
----------------
Calculates the blast radius of an incident.
Answers: how many transactions? how much money? how many users?
This is what makes the demo feel REAL — specific numbers, not estimates.
"""


def calculate_scope(scenario: dict) -> dict:
    """
    Given incident scenario data, calculates full business impact.
    """
    duration = scenario.get("duration_minutes", 0)
    txns_per_min = scenario.get("transactions_per_minute", 0)
    avg_value = scenario.get("avg_transaction_value", 0)

    affected_transactions = int(duration * txns_per_min)
    financial_exposure = affected_transactions * avg_value

    # Estimate unique accounts (assume avg 3 txns per account during incident)
    estimated_accounts = (
        max(1, affected_transactions // 3) if affected_transactions > 0 else 0
    )

    return {
        "duration_minutes": duration,
        "affected_transactions": affected_transactions,
        "financial_exposure_cad": financial_exposure,
        "estimated_accounts_impacted": estimated_accounts,
        "transactions_per_minute": txns_per_min,
        "avg_transaction_value_cad": avg_value,
        "summary": (
            f"{affected_transactions:,} transactions affected over {duration} minutes, "
            f"representing ${financial_exposure:,.0f} CAD in exposure "
            f"across ~{estimated_accounts:,} client accounts"
        ),
    }
