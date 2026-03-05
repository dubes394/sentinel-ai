"""
Root Cause Tracer
-----------------
Given a list of failing services, traces the dependency graph
backwards to find the most likely origin of the incident.

Think of it like: if 3 services are failing and one of them
has no dependencies, that's probably where it started.
"""


def trace_root_cause(anomalies: list, services_data: dict) -> dict:
    """
    Traces backwards through service dependencies to find root cause.
    Returns root cause with confidence score and reasoning chain.
    """
    if not anomalies:
        return {"root_cause": None, "confidence": 0, "reasoning": []}

    service_map = {s["id"]: s for s in services_data["services"]}
    critical_services = {
        a["service_id"] for a in anomalies if a["severity"] == "critical"
    }
    all_anomalous = {a["service_id"] for a in anomalies}

    reasoning = []
    candidates = []

    for svc_id in critical_services:
        svc = service_map.get(svc_id)
        if not svc:
            continue

        dependencies = svc.get("dependencies", [])

        # Count how many of this service's dependencies are also failing
        failing_deps = [d for d in dependencies if d in all_anomalous]
        healthy_deps = [d for d in dependencies if d not in all_anomalous]

        # If a service has NO failing dependencies but IS failing itself
        # it's likely the origin
        if not failing_deps:
            score = 0.90
            reason = (
                f"{svc['name']} is critical with no failing upstream dependencies — "
                f"likely origin of incident"
            )
        elif len(failing_deps) == len(dependencies):
            score = 0.40
            reason = (
                f"{svc['name']} is critical but all its dependencies "
                f"({', '.join(failing_deps)}) are also failing — likely downstream victim"
            )
        else:
            score = 0.60
            reason = (
                f"{svc['name']} is critical with {len(failing_deps)} of "
                f"{len(dependencies)} dependencies also failing"
            )

        reasoning.append(reason)
        candidates.append(
            {
                "service_id": svc_id,
                "service_name": svc["name"],
                "confidence_score": score,
                "dependencies_failing": failing_deps,
                "dependencies_healthy": healthy_deps,
                "reason": reason,
            }
        )

    if not candidates:
        # Fall back to most severe anomaly
        worst = anomalies[0]
        return {
            "root_cause_service_id": worst["service_id"],
            "root_cause_service_name": worst["service_name"],
            "confidence": 0.50,
            "reasoning": [
                "No clear upstream origin found — defaulting to most degraded service"
            ],
            "all_candidates": [],
        }

    # Pick highest confidence candidate
    best = max(candidates, key=lambda x: x["confidence_score"])

    # Build human-readable reasoning chain
    reasoning_chain = [
        f"Detected {len(all_anomalous)} anomalous services: {', '.join(all_anomalous)}",
        f"Traced dependency graph backwards from each critical service",
        best["reason"],
        f"Conclusion: {best['service_name']} is the most probable origin "
        f"({best['confidence_score']:.0%} confidence)",
    ]

    return {
        "root_cause_service_id": best["service_id"],
        "root_cause_service_name": best["service_name"],
        "confidence": best["confidence_score"],
        "reasoning": reasoning_chain,
        "all_candidates": candidates,
    }
