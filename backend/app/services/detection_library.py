"""Seed data for prompt templates and the detection library.

In production this would be backed by a datastore. It is served from the backend
so the frontend never hardcodes domain content and both stay in sync.
"""

from __future__ import annotations

from app.schemas import DetectionRule, PromptTemplate

PROMPT_TEMPLATES: list[PromptTemplate] = [
    PromptTemplate(
        id="analyze-datadog-rule",
        title="Analyze this Datadog rule",
        description="Full 12-section detection review of a Datadog Security Monitoring rule.",
        category="Datadog",
        prompt="Analyze this Datadog Security Monitoring rule and produce the full review:\n\n<paste rule query here>",
    ),
    PromptTemplate(
        id="reduce-false-positives",
        title="Reduce false positives",
        description="Cut FPs with narrow, coverage-preserving exclusions only.",
        category="Tuning",
        prompt="Reduce false positives for this rule without reducing detection coverage. Justify every exclusion:\n\n<paste rule here>",
    ),
    PromptTemplate(
        id="optimize-security-monitoring",
        title="Optimize Security Monitoring rule",
        description="Improve signal quality and maintainability.",
        category="Datadog",
        prompt="Optimize this Datadog Security Monitoring rule for signal quality and maintainability:\n\n<paste rule here>",
    ),
    PromptTemplate(
        id="review-sigma",
        title="Review Sigma rule",
        description="Assess a Sigma rule and suggest production-ready tuning.",
        category="Sigma",
        prompt="Review this Sigma rule and recommend production-ready tuning:\n\n```yaml\n<paste sigma rule here>\n```",
    ),
    PromptTemplate(
        id="explain-alert",
        title="Explain this alert",
        description="Translate a raw alert/log into intent, risk, and next steps.",
        category="Triage",
        prompt="Explain this alert: what triggered it, likely intent, and whether it is a true or false positive:\n\n<paste alert / log here>",
    ),
    PromptTemplate(
        id="map-mitre",
        title="Map to MITRE ATT&CK",
        description="Map detection logic to concrete ATT&CK techniques.",
        category="MITRE",
        prompt="Map this detection to MITRE ATT&CK techniques (IDs + rationale). Flag any weak mappings:\n\n<paste rule here>",
    ),
    PromptTemplate(
        id="review-ocsf",
        title="Review OCSF query",
        description="Validate an OCSF query and improve precision.",
        category="OCSF",
        prompt="Review this OCSF query for correctness and precision, then improve it:\n\n<paste OCSF query here>",
    ),
    PromptTemplate(
        id="improve-datadog-detection",
        title="Improve Datadog Detection",
        description="Raise detection quality end-to-end.",
        category="Datadog",
        prompt="Improve this Datadog detection end-to-end (logic, FPs, MITRE, maintainability):\n\n<paste rule here>",
    ),
]

DETECTION_LIBRARY: list[DetectionRule] = [
    DetectionRule(
        id="impossible-travel-signin",
        name="Interactive sign-in from unexpected geography",
        platform="Datadog Cloud SIEM (OCSF)",
        mitre=["T1078"],
        description="Interactive user logon while excluding service/system accounts and corp VPN.",
        query=(
            "@ocsf.class_uid:3002 @ocsf.activity_name:Logon @ocsf.user.email_addr:@\n"
            "-@ocsf.user.type:(System OR Service)\n"
            "-@threat_intel.results.category:corp_vpn"
        ),
    ),
    DetectionRule(
        id="noninteractive-signin-filter",
        name="Interactive sign-in (hosting/non-interactive excluded)",
        platform="Datadog Cloud SIEM (OCSF)",
        mitre=["T1078", "T1078.004"],
        description="Same intent, tuned to drop non-interactive log sources and hosting ASNs.",
        query=(
            "@ocsf.class_uid:3002 @ocsf.activity_name:Logon @ocsf.user.email_addr:@\n"
            "-@ocsf.user.type:(System OR Service)\n"
            "-@threat_intel.results.category:corp_vpn\n"
            "-@ocsf.metadata.log_name:NonInteractiveUserSignInLogs\n"
            "-@network.client.geoip.as.type:hosting"
        ),
    ),
]
