import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API = "http://localhost:8000/api";

// ── Reusable UI primitives ──────────────────────────────────────────
const Card = ({ children, className = "" }) => (
  <div style={{
    background: "#111827", border: "1px solid #1f2937",
    borderRadius: 8, padding: 20, marginBottom: 16
  }} className={className}>{children}</div>
);

const Badge = ({ children, color }) => {
  const colors = {
    red: { bg: "#2d1515", text: "#fc8181", border: "#5a2020" },
    green: { bg: "#0f2d1f", text: "#48bb78", border: "#1a5c3a" },
    yellow: { bg: "#2d2000", text: "#f6ad55", border: "#5a4000" },
    blue: { bg: "#0f1f3d", text: "#63b3ed", border: "#1a3a7a" },
    gray: { bg: "#1a1f2e", text: "#a0aec0", border: "#2d3748" },
  };
  const c = colors[color] || colors.gray;
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600,
      textTransform: "uppercase", letterSpacing: 0.5
    }}>{children}</span>
  );
};

const Metric = ({ label, value, sub, color = "#e2e8f0" }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontSize: 28, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    {sub && <div style={{ fontSize: 10, color: "#4b5563", marginTop: 2 }}>{sub}</div>}
  </div>
);

const StatusDot = ({ status }) => {
  const color = status === "healthy" ? "#48bb78" : status === "critical" ? "#fc8181" : "#f6ad55";
  const pulse = status === "critical";
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: color, marginRight: 8, flexShrink: 0,
      boxShadow: pulse ? `0 0 6px ${color}` : "none"
    }} />
  );
};

// ── Main App ────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("dashboard"); // dashboard | investigation | documents
  const [systemStatus, setSystemStatus] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [investigation, setInvestigation] = useState(null);
  const [documents, setDocuments] = useState(null);
  const [loading, setLoading] = useState("");
  const [approvals, setApprovals] = useState({ postmortem: false, notification: false });

  // Poll system status every 2 seconds
  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/status`);
      setSystemStatus(res.data);
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchStatus();
    axios.get(`${API}/scenarios`).then(r => setScenarios(r.data));
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const triggerIncident = async (scenarioId) => {
    setInvestigation(null);
    setDocuments(null);
    setApprovals({ postmortem: false, notification: false });
    await axios.post(`${API}/trigger-incident`, { scenario_id: scenarioId });
    await fetchStatus();
    setView("dashboard");
  };

  const runInvestigation = async () => {
    setLoading("investigating");
    try {
      const res = await axios.get(`${API}/investigate`);
      setInvestigation(res.data);
      setView("investigation");
    } finally { setLoading(""); }
  };

  const generateDocuments = async () => {
    setLoading("generating");
    try {
      const res = await axios.post(`${API}/generate-documents`);
      setInvestigation(res.data.investigation);
      setDocuments(res.data.documents);
      setView("documents");
    } finally { setLoading(""); }
  };

  const reset = async () => {
    await axios.post(`${API}/reset`);
    setInvestigation(null);
    setDocuments(null);
    setApprovals({ postmortem: false, notification: false });
    setView("dashboard");
    await fetchStatus();
  };

  const incidentActive = systemStatus?.incident_active;
  const maintenanceWindow = systemStatus?.maintenance_window;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a" }}>
      {/* Top Bar */}
      <div style={{
        background: "#0d1117", borderBottom: "1px solid #1f2937",
        padding: "12px 24px", display: "flex", alignItems: "center",
        justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16
          }}>⚡</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#f9fafb" }}>Sentinel AI</div>
            <div style={{ fontSize: 10, color: "#6b7280" }}>FinCore Infrastructure Reliability Copilot</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {incidentActive && !maintenanceWindow && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fc8181", display: "inline-block", animation: "pulse 1s infinite" }} />
              <span style={{ color: "#fc8181", fontSize: 12, fontWeight: 600 }}>INCIDENT ACTIVE</span>
            </div>
          )}
          {maintenanceWindow && (
            <Badge color="blue">Maintenance Window</Badge>
          )}
          <Badge color={incidentActive ? "red" : "green"}>
            {incidentActive ? "Degraded" : "All Systems Normal"}
          </Badge>
        </div>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 57px)" }}>
        {/* Sidebar */}
        <div style={{
          width: 200, background: "#0d1117", borderRight: "1px solid #1f2937",
          padding: "16px 12px", display: "flex", flexDirection: "column", gap: 4, flexShrink: 0
        }}>
          {[
            { id: "dashboard", icon: "◉", label: "Dashboard" },
            { id: "investigation", icon: "🔍", label: "Investigation" },
            { id: "documents", icon: "📄", label: "Documents" },
          ].map(item => (
            <button key={item.id} onClick={() => setView(item.id)} style={{
              background: view === item.id ? "#1f2937" : "transparent",
              border: "none", color: view === item.id ? "#f9fafb" : "#6b7280",
              padding: "8px 12px", borderRadius: 6, cursor: "pointer",
              textAlign: "left", fontSize: 13, display: "flex", alignItems: "center", gap: 8
            }}>
              <span>{item.icon}</span> {item.label}
              {item.id === "investigation" && investigation && (
                <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#48bb78" }} />
              )}
              {item.id === "documents" && documents && (
                <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#f6ad55" }} />
              )}
            </button>
          ))}

          <div style={{ marginTop: "auto", borderTop: "1px solid #1f2937", paddingTop: 12 }}>
            <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Simulate Incident</div>
            {scenarios.map(s => (
              <button key={s.id} onClick={() => triggerIncident(s.id)} style={{
                background: "transparent", border: "1px solid #1f2937",
                color: "#9ca3af", padding: "6px 10px", borderRadius: 6,
                cursor: "pointer", fontSize: 11, width: "100%", textAlign: "left",
                marginBottom: 4, lineHeight: 1.3
              }}>{s.name}</button>
            ))}
            {incidentActive && (
              <button onClick={reset} style={{
                background: "transparent", border: "1px solid #374151",
                color: "#6b7280", padding: "6px 10px", borderRadius: 6,
                cursor: "pointer", fontSize: 11, width: "100%", marginTop: 4
              }}>↺ Reset System</button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>

          {/* ── DASHBOARD VIEW ── */}
          {view === "dashboard" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb" }}>System Health</h1>
                <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
                  Real-time monitoring across FinCore's payment infrastructure
                </p>
              </div>

              {/* Service Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                {systemStatus && Object.entries(systemStatus.metrics || {}).map(([id, m]) => (
                  <Card key={id}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <StatusDot status={m.status} />
                        <span style={{ fontWeight: 600, fontSize: 13, color: "#f9fafb" }}>
                          {id.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ")}
                        </span>
                      </div>
                      <Badge color={m.status === "healthy" ? "green" : m.status === "critical" ? "red" : "yellow"}>
                        {m.status}
                      </Badge>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div style={{ background: "#0a0e1a", borderRadius: 6, padding: "8px 12px" }}>
                        <div style={{
                          fontSize: 18, fontWeight: 700,
                          color: m.latency_ms > 2000 ? "#fc8181" : m.latency_ms > 500 ? "#f6ad55" : "#48bb78"
                        }}>{m.latency_ms}ms</div>
                        <div style={{ fontSize: 10, color: "#6b7280" }}>LATENCY</div>
                      </div>
                      <div style={{ background: "#0a0e1a", borderRadius: 6, padding: "8px 12px" }}>
                        <div style={{
                          fontSize: 18, fontWeight: 700,
                          color: m.error_rate > 0.05 ? "#fc8181" : m.error_rate > 0.01 ? "#f6ad55" : "#48bb78"
                        }}>{(m.error_rate * 100).toFixed(1)}%</div>
                        <div style={{ fontSize: 10, color: "#6b7280" }}>ERROR RATE</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Action Panel */}
              {incidentActive && (
                <Card>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 16 }}>
                          {maintenanceWindow ? "🔧" : "🚨"}
                        </span>
                        <span style={{ fontWeight: 700, color: maintenanceWindow ? "#63b3ed" : "#fc8181", fontSize: 15 }}>
                          {maintenanceWindow ? "Maintenance Window Active" : "Incident Detected"}
                        </span>
                      </div>
                      <p style={{ color: "#9ca3af", fontSize: 12 }}>
                        {maintenanceWindow
                          ? "Metrics anomalies detected but suppressed — scheduled maintenance window is active. No action required."
                          : "Anomalies detected across multiple services. Run AI investigation to identify root cause and generate response documents."}
                      </p>
                    </div>
                    {!maintenanceWindow && (
                      <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 16 }}>
                        <button onClick={runInvestigation} disabled={!!loading} style={{
                          background: "#1d4ed8", color: "white", border: "none",
                          padding: "10px 18px", borderRadius: 6, cursor: loading ? "not-allowed" : "pointer",
                          fontWeight: 600, fontSize: 13, opacity: loading ? 0.6 : 1
                        }}>
                          {loading === "investigating" ? "⏳ Investigating..." : "🔍 Run Investigation"}
                        </button>
                        <button onClick={generateDocuments} disabled={!!loading} style={{
                          background: "#7c3aed", color: "white", border: "none",
                          padding: "10px 18px", borderRadius: 6, cursor: loading ? "not-allowed" : "pointer",
                          fontWeight: 600, fontSize: 13, opacity: loading ? 0.6 : 1
                        }}>
                          {loading === "generating" ? "⏳ Generating..." : "⚡ Full Analysis + Draft Docs"}
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {!incidentActive && (
                <Card>
                  <div style={{ textAlign: "center", padding: "20px 0", color: "#6b7280" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                    <div style={{ fontWeight: 600, color: "#48bb78", marginBottom: 4 }}>All Systems Operational</div>
                    <div style={{ fontSize: 12 }}>Use the sidebar to simulate an incident scenario</div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ── INVESTIGATION VIEW ── */}
          {view === "investigation" && investigation && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb" }}>AI Investigation Report</h1>
                <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>{investigation.scenario_name}</p>
              </div>

              {/* Root Cause */}
              <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span>🎯</span>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Root Cause Analysis</span>
                  <Badge color="blue">{(investigation.root_cause.confidence * 100).toFixed(0)}% confidence</Badge>
                </div>
                <div style={{
                  background: "#0a0e1a", borderRadius: 8, padding: 16,
                  borderLeft: "3px solid #3b82f6", marginBottom: 12
                }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#63b3ed", marginBottom: 4 }}>
                    {investigation.root_cause.root_cause_service_name}
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: 12 }}>Identified as primary failure origin</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {investigation.root_cause.reasoning.map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ color: "#3b82f6", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}.</span>
                      <span style={{ color: "#d1d5db", fontSize: 13 }}>{r}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Scope */}
              <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span>📊</span>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Blast Radius</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                  <Metric label="Transactions" value={investigation.scope.affected_transactions.toLocaleString()} color="#fc8181" />
                  <Metric label="Financial Exposure" value={`$${(investigation.scope.financial_exposure_cad / 1000000).toFixed(1)}M`} sub="CAD" color="#f6ad55" />
                  <Metric label="Accounts Impacted" value={`~${investigation.scope.estimated_accounts_impacted.toLocaleString()}`} color="#f6ad55" />
                  <Metric label="Duration" value={`${investigation.scope.duration_minutes}min`} color="#a78bfa" />
                </div>
              </Card>

              {/* Regulatory */}
              <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span>⚖️</span>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Regulatory Obligations</span>
                  <Badge color={investigation.regulatory.mandatory_reporting_required ? "red" : "green"}>
                    {investigation.regulatory.summary}
                  </Badge>
                </div>
                {investigation.regulatory.triggered_obligations.map((ob, i) => (
                  <div key={i} style={{
                    background: ob.triggered ? "#1a0a0a" : "#0a1a0a",
                    border: `1px solid ${ob.triggered ? "#5a1a1a" : "#1a3a1a"}`,
                    borderRadius: 8, padding: 14, marginBottom: 8
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: ob.triggered ? "#fc8181" : "#48bb78" }}>
                        {ob.regulator} — {ob.id}
                      </span>
                      <Badge color={ob.triggered ? "red" : "green"}>
                        {ob.triggered ? `Report within ${ob.notification_window_hours}hrs` : "Not triggered"}
                      </Badge>
                    </div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{ob.rule}</div>
                    {ob.reasons && ob.reasons.map((r, j) => (
                      <div key={j} style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>• {r}</div>
                    ))}
                  </div>
                ))}
              </Card>

              <button onClick={generateDocuments} disabled={!!loading} style={{
                background: "linear-gradient(135deg, #7c3aed, #3b82f6)",
                color: "white", border: "none", padding: "12px 24px",
                borderRadius: 8, cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 600, fontSize: 14, width: "100%", opacity: loading ? 0.6 : 1
              }}>
                {loading === "generating" ? "⏳ Claude is drafting documents..." : "⚡ Generate Post-Mortem & Regulatory Notification"}
              </button>
            </div>
          )}

          {/* ── DOCUMENTS VIEW ── */}
          {view === "documents" && documents && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb" }}>AI-Generated Documents</h1>
                <div style={{
                  background: "#1a0f00", border: "1px solid #5a3a00",
                  borderRadius: 8, padding: 12, marginTop: 10,
                  display: "flex", alignItems: "center", gap: 8
                }}>
                  <span>⚠️</span>
                  <span style={{ color: "#f6ad55", fontSize: 12, fontWeight: 600 }}>
                    HUMAN REVIEW REQUIRED — No document may be submitted or acted upon without explicit human approval
                  </span>
                </div>
              </div>

              {/* Post-Mortem */}
              {documents.postmortem?.generated && (
                <Card>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span>📋</span>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>Internal Post-Mortem</span>
                      <Badge color="yellow">Draft</Badge>
                      <Badge color={documents.postmortem.content.severity === "P1" ? "red" : "yellow"}>
                        {documents.postmortem.content.severity}
                      </Badge>
                    </div>
                  </div>

                  <div style={{ background: "#0a0e1a", borderRadius: 8, padding: 16, marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>EXECUTIVE SUMMARY</div>
                    <p style={{ color: "#d1d5db", fontSize: 13, lineHeight: 1.6 }}>
                      {documents.postmortem.content.executive_summary}
                    </p>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8, textTransform: "uppercase" }}>Timeline</div>
                    {documents.postmortem.content.timeline.map((t, i) => (
                      <div key={i} style={{ display: "flex", gap: 12, marginBottom: 6, alignItems: "flex-start" }}>
                        <span style={{ color: "#3b82f6", fontSize: 11, fontFamily: "monospace", flexShrink: 0, marginTop: 2 }}>{t.time}</span>
                        <span style={{ color: "#9ca3af", fontSize: 12 }}>{t.event}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8, textTransform: "uppercase" }}>Action Items</div>
                    {documents.postmortem.content.action_items.map((a, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "flex-start", gap: 8,
                        background: "#0a0e1a", borderRadius: 6, padding: "8px 12px", marginBottom: 6
                      }}>
                        <Badge color={a.priority === "P1" ? "red" : "yellow"}>{a.priority}</Badge>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: "#e2e8f0" }}>{a.action}</div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Due: {a.due}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{
                    background: "#0f1f0f", border: "1px solid #1a3a1a",
                    borderRadius: 6, padding: 10, marginBottom: 12
                  }}>
                    <div style={{ fontSize: 10, color: "#48bb78", marginBottom: 3, textTransform: "uppercase" }}>AI Confidence Note</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{documents.postmortem.content.ai_confidence_note}</div>
                  </div>

                  <button
                    onClick={() => setApprovals(a => ({ ...a, postmortem: true }))}
                    disabled={approvals.postmortem}
                    style={{
                      background: approvals.postmortem ? "#0f2d1f" : "#1d4ed8",
                      color: approvals.postmortem ? "#48bb78" : "white",
                      border: `1px solid ${approvals.postmortem ? "#1a5c3a" : "transparent"}`,
                      padding: "10px 20px", borderRadius: 6,
                      cursor: approvals.postmortem ? "default" : "pointer",
                      fontWeight: 600, fontSize: 13, width: "100%"
                    }}>
                    {approvals.postmortem ? "✅ Approved by Human Reviewer" : "👤 Approve Post-Mortem for Distribution"}
                  </button>
                </Card>
              )}

              {/* Regulatory Notification */}
              {documents.regulatory_notification?.generated && (
                <Card>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span>📨</span>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>Regulatory Notification</span>
                      <Badge color="red">Requires Approval</Badge>
                    </div>
                  </div>

                  <div style={{
                    background: "#1a0505", border: "1px solid #5a1515",
                    borderRadius: 8, padding: 14, marginBottom: 12
                  }}>
                    <div style={{ fontSize: 11, color: "#fc8181", marginBottom: 8, fontWeight: 600 }}>
                      {documents.regulatory_notification.hard_stop}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                      <div><span style={{ color: "#6b7280" }}>TO: </span><span style={{ color: "#e2e8f0" }}>{documents.regulatory_notification.content.to}</span></div>
                      <div><span style={{ color: "#6b7280" }}>FROM: </span><span style={{ color: "#e2e8f0" }}>{documents.regulatory_notification.content.from}</span></div>
                      <div style={{ gridColumn: "1/-1" }}><span style={{ color: "#6b7280" }}>RE: </span><span style={{ color: "#e2e8f0" }}>{documents.regulatory_notification.content.subject}</span></div>
                    </div>
                  </div>

                  {documents.regulatory_notification.content.body_sections.map((s, i) => (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>{s.heading}</div>
                      <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>{s.content}</div>
                    </div>
                  ))}

                  <div style={{ background: "#0f1a2e", border: "1px solid #1a3a5c", borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: "#63b3ed", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>
                      Human Review Flags
                    </div>
                    {documents.regulatory_notification.content.human_review_flags.map((f, i) => (
                      <div key={i} style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>⚑ {f}</div>
                    ))}
                  </div>

                  <div style={{ fontSize: 10, color: "#6b7280", fontStyle: "italic", marginBottom: 12 }}>
                    {documents.regulatory_notification.content.legal_disclaimer}
                  </div>

                  <button
                    onClick={() => setApprovals(a => ({ ...a, notification: true }))}
                    disabled={approvals.notification || !approvals.postmortem}
                    style={{
                      background: approvals.notification ? "#0f2d1f" : (!approvals.postmortem ? "#1a1a1a" : "#7c3aed"),
                      color: approvals.notification ? "#48bb78" : (!approvals.postmortem ? "#4b5563" : "white"),
                      border: `1px solid ${approvals.notification ? "#1a5c3a" : "transparent"}`,
                      padding: "10px 20px", borderRadius: 6,
                      cursor: (approvals.notification || !approvals.postmortem) ? "not-allowed" : "pointer",
                      fontWeight: 600, fontSize: 13, width: "100%"
                    }}>
                    {approvals.notification
                      ? "✅ Approved for Regulatory Submission"
                      : !approvals.postmortem
                      ? "🔒 Approve Post-Mortem First"
                      : "👤 Approve Regulatory Notification for Submission"}
                  </button>
                </Card>
              )}

              {documents.regulatory_notification && !documents.regulatory_notification.generated && (
                <Card>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>
                      {systemStatus?.maintenance_window ? "🔧" : "✅"}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, color: "#48bb78" }}>No Regulatory Notification Required</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                        {documents.regulatory_notification.reason}
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Empty states */}
          {view === "investigation" && !investigation && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#6b7280" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>No Investigation Yet</div>
              <div style={{ fontSize: 12 }}>Trigger an incident and click "Run Investigation"</div>
            </div>
          )}
          {view === "documents" && !documents && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#6b7280" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>No Documents Generated Yet</div>
              <div style={{ fontSize: 12 }}>Run a full analysis to generate AI documents</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}