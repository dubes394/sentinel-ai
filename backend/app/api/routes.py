# Add these imports at the top of routes.py
from app.services.anomaly_detector import detect_anomalies
from app.services.root_cause_tracer import trace_root_cause
from app.services.scope_calculator import calculate_scope
from app.services.regulatory_checker import check_regulatory_obligations
from app.services.ai_generator import generate_all_documents

from fastapi import FastAPI, HTTPException
from fastapi.routing import APIRouter
from pydantic import BaseModel

import json, os

router = APIRouter()

# Load our mock data once at startup
with open("app/data/services.json") as f:
    SERVICES_DATA = json.load(f)

with open("app/data/incidents.json") as f:
    INCIDENTS_DATA = json.load(f)

# In-memory state (current active incident)
current_incident = {"active": False, "scenario": None}


class IncidentTrigger(BaseModel):
    scenario_id: str


@router.get("/services")
def get_services():
    return SERVICES_DATA


@router.get("/status")
def get_status():
    """Returns current system status — normal or incident metrics"""
    if not current_incident["active"]:
        # Return normal metrics
        normal = {}
        for svc in SERVICES_DATA["services"]:
            normal[svc["id"]] = {
                "latency_ms": svc["normal_latency_ms"],
                "error_rate": svc["normal_error_rate"],
                "status": "healthy",
            }
        return {"incident_active": False, "metrics": normal}
    else:
        scenario = current_incident["scenario"]
        metrics = {}
        for svc_id, m in scenario["metrics"].items():
            svc = next(s for s in SERVICES_DATA["services"] if s["id"] == svc_id)
            is_critical = (
                m["latency_ms"] > svc["critical_threshold_latency"]
                or m["error_rate"] > svc["critical_threshold_error_rate"]
            )
            metrics[svc_id] = {
                **m,
                "status": (
                    "critical"
                    if is_critical
                    else (
                        "degraded"
                        if m["error_rate"] > svc["normal_error_rate"] * 3
                        else "healthy"
                    )
                ),
            }
        return {
            "incident_active": True,
            "scenario": scenario,
            "metrics": metrics,
            "maintenance_window": scenario["maintenance_window"],
        }


@router.post("/trigger-incident")
def trigger_incident(body: IncidentTrigger):
    scenario = next(
        (s for s in INCIDENTS_DATA["scenarios"] if s["id"] == body.scenario_id), None
    )
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    current_incident["active"] = True
    current_incident["scenario"] = scenario
    return {"triggered": True, "scenario": scenario["name"]}


@router.post("/reset")
def reset():
    current_incident["active"] = False
    current_incident["scenario"] = None
    return {"reset": True}


@router.get("/scenarios")
def get_scenarios():
    return [
        {"id": s["id"], "name": s["name"], "description": s["description"]}
        for s in INCIDENTS_DATA["scenarios"]
    ]


@router.get("/investigate")
def investigate():
    """
    Master endpoint — runs the full investigation pipeline.
    This is the brain of the system.
    """
    if not current_incident["active"]:
        return {"active": False, "message": "No active incident"}

    scenario = current_incident["scenario"]
    metrics = {}

    for svc_id, m in scenario["metrics"].items():
        metrics[svc_id] = m

    # Step 1: Detect anomalies
    anomaly_report = detect_anomalies(metrics, SERVICES_DATA)

    # Step 2: Trace root cause
    root_cause = trace_root_cause(anomaly_report["anomalies"], SERVICES_DATA)

    # Step 3: Calculate scope
    scope = calculate_scope(scenario)

    # Step 4: Check regulatory obligations
    regulatory = check_regulatory_obligations(scope, scenario)

    return {
        "scenario_name": scenario["name"],
        "maintenance_window": scenario["maintenance_window"],
        "anomalies": anomaly_report,
        "root_cause": root_cause,
        "scope": scope,
        "regulatory": regulatory,
        "pipeline_complete": True,
    }


@router.post("/generate-documents")
def generate_documents():
    """
    Runs full investigation pipeline then generates AI documents.
    This is the core value of the system.
    """
    if not current_incident["active"]:
        raise HTTPException(status_code=400, detail="No active incident to investigate")

    scenario = current_incident["scenario"]

    # Run full pipeline
    anomaly_report = detect_anomalies(scenario["metrics"], SERVICES_DATA)
    root_cause = trace_root_cause(anomaly_report["anomalies"], SERVICES_DATA)
    scope = calculate_scope(scenario)
    regulatory = check_regulatory_obligations(scope, scenario)

    investigation = {
        "scenario_name": scenario["name"],
        "root_cause": root_cause,
        "scope": scope,
        "anomalies": anomaly_report,
        "regulatory": regulatory,
    }

    # Generate AI documents
    documents = generate_all_documents(investigation)

    return {"investigation": investigation, "documents": documents}
