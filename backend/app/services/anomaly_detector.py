"""
Anomaly Detector
---------------
Compares current metrics against normal baselines.
Flags services that are behaving outside normal parameters.

Concept: We're doing simple threshold detection here.
In production, this would be ML-based (z-score, LSTM forecasting).
For our demo, threshold detection is honest and explainable.
"""


def detect_anomalies(current_metrics: dict, services_data: dict) -> dict:
    """
    Takes current metrics and baseline service definitions.
    Returns a structured anomaly report.
    """
    anomalies = []
    healthy = []

    service_map = {s["id"]: s for s in services_data["services"]}

    for svc_id, metrics in current_metrics.items():
        svc = service_map.get(svc_id)
        if not svc:
            continue

        issues = []
        severity = "healthy"

        # Check latency
        latency = metrics["latency_ms"]
        normal_latency = svc["normal_latency_ms"]
        latency_ratio = latency / normal_latency

        if latency > svc["critical_threshold_latency"]:
            issues.append(
                {
                    "type": "latency",
                    "detail": f"Latency {latency}ms is {latency_ratio:.1f}x above normal ({normal_latency}ms)",
                    "severity": "critical",
                }
            )
            severity = "critical"
        elif latency_ratio > 3:
            issues.append(
                {
                    "type": "latency",
                    "detail": f"Latency {latency}ms is {latency_ratio:.1f}x above normal ({normal_latency}ms)",
                    "severity": "warning",
                }
            )
            if severity != "critical":
                severity = "warning"

        # Check error rate
        error_rate = metrics["error_rate"]
        normal_error = svc["normal_error_rate"]
        error_ratio = error_rate / normal_error if normal_error > 0 else 0

        if error_rate > svc["critical_threshold_error_rate"]:
            issues.append(
                {
                    "type": "error_rate",
                    "detail": f"Error rate {error_rate:.1%} is {error_ratio:.0f}x above normal ({normal_error:.1%})",
                    "severity": "critical",
                }
            )
            severity = "critical"
        elif error_ratio > 5:
            issues.append(
                {
                    "type": "error_rate",
                    "detail": f"Error rate {error_rate:.1%} is {error_ratio:.0f}x above normal ({normal_error:.1%})",
                    "severity": "warning",
                }
            )
            if severity != "critical":
                severity = "warning"

        result = {
            "service_id": svc_id,
            "service_name": svc["name"],
            "severity": severity,
            "issues": issues,
            "current_latency_ms": latency,
            "current_error_rate": error_rate,
            "normal_latency_ms": normal_latency,
            "normal_error_rate": normal_error,
        }

        if issues:
            anomalies.append(result)
        else:
            healthy.append(result)

    return {
        "anomalies": sorted(
            anomalies, key=lambda x: 0 if x["severity"] == "critical" else 1
        ),
        "healthy_services": healthy,
        "critical_count": sum(1 for a in anomalies if a["severity"] == "critical"),
        "warning_count": sum(1 for a in anomalies if a["severity"] == "warning"),
    }
