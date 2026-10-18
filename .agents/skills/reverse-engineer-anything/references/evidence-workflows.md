# Evidence, Confidence, and Verification Workflows

## 1. Structure of REA Evidence JSON
REA produces structured Evidence for all observations. Every record contains:
- `evidence_id`: Unique identifier (e.g. `ev_307a01...`) used as a stable reference.
- `subject`: File path, format, and SHA-256 digest.
- `provider`: Identification of the analysis engine that produced the result.
- `confidence`: Level of certainty (`observed`, `inferred`, `hypothesis`).
- `authority`: Authority tier (`shipped-artifact`, `runtime-observation`, `static-analysis`).
- `normalized_result`: The clean, structured data extracted from the target.
- `limitations`: Explicit statement of what the analysis could NOT prove.

## 2. Evidence Principles for Agents
When reporting reverse-engineering findings to the user:
1. **Never Hallucinate Architecture**: Cite the exact file name, line, or `evidence_id` for each finding.
2. **Distinguish Observations from Hypotheses**:
   - An *observation* is directly read from bytes (e.g. "SHA-256 is xyz", "fuse runAsNode is 0").
   - A *hypothesis* is a plausible interpretation that requires follow-up probes.
3. **Record Unknowns**:
   If an analysis provider is missing (e.g. Ghidra not on PATH) or an artifact is partially analyzed, clearly state the limitation instead of pretending full analysis succeeded.
