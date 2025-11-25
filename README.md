# Project "Chameleon" – n8n Cloud Automation Blueprint (v2.2)

This document describes the end-to-end automation blueprint for **Project Chameleon**, an API-first content pipeline for a modern animation studio, designed to run entirely in **n8n Cloud (web UI)**. Every workflow, trigger, and integration below is expressed using n8n concepts and cloud-accessible services—no local file paths or shell access required.

---
## 0. Core Principles (n8n Translation)

- **Single Source of Truth (SSoT):** ShotGrid (or Ftrack) holds all projects, assets, shots, tasks, statuses, timestamps, and links. All workflows read/write through its REST API.
- **API-First Integration:** Use n8n HTTP Request, Webhook, and vendor nodes. When no node exists, integrate via HTTP + Function transforms.
- **Automate Repetition, Keep Humans in Loop:** Automate tagging, validation, submissions, QC, transcoding, packaging. Approvals and creative choices flow through statuses, review playlists, and Slack/email prompts.
- **Data & Observability:** Each workflow logs execution metadata back to SSoT plus a metrics sink (Sheets/Notion/BI API). Capture job IDs, durations, status transitions, and error traces.
- **Elastic Compute:** Heavy work (render, transcode) is delegated to APIs (Deadline/AWS MediaConvert/etc.). Workflows monitor queue depth and can scale cloud resources up/down through provider APIs.

---
## 1. Canonical Data Model (shared JSON fields)

```json
{
  "project_id": "proj-001",
  "show_id": "show-01",
  "episode_id": "ep-101",
  "sequence_id": "seq-010",
  "shot_id": "sh-010_020",
  "asset": { "asset_id": "ast-001", "asset_type": "character|prop|set|fx" },
  "task": {
    "task_id": "tk-123",
    "task_type": "layout|animation|lighting|comp|review|delivery",
    "status": "Not Started|In Progress|Pending Review|Approved|Ready for Render|Ready for Comp|Delivered"
  },
  "version_id": "v###",
  "users": { "artist_id": "usr-01", "supervisor_id": "usr-02" },
  "media": { "file_url": "https://...", "storage": "s3|gcs|dam" },
  "audit": { "source": "webhook|manual", "script_version": "commit-sha" }
}
```

---
## 2. Chameleon Core Router (global entry workflow)

**Workflow Name:** `CHM-Core-Router`

- **Trigger:** `Webhook` node subscribed to ShotGrid event stream, Git webhooks, DAM publish webhooks, and render callbacks. Payload stored as `event_payload`.
- **Normalization:** `Function` node maps incoming payloads into the canonical data model (IDs, entity type, action, version, user, source system).
- **Routing:** `Switch` node on `event_payload.entity_type` and `event_payload.action` routes to downstream workflows via `HTTP Request` calls to n8n Execute Workflow endpoints:
  - Script events → `CHM-PreProd-Script-Ingestion`
  - Asset publish → `CHM-PreProd-Asset-Publish`
  - Task status change/layout → `CHM-Prod-Scene-Assembly`
  - Animation publish → `CHM-Prod-Dailies-Generation`
  - Ready for render → `CHM-Post-Render-Management`
  - Render complete → `CHM-Post-QC-Comp-Prep`
  - Editorial EDL/XML → `CHM-Editorial-Conform`
  - Picture lock / delivery flags → Finalization workflows
- **Error Handling:**
  - `Try/Catch` style via `Error Trigger` node routing to `Set` + `HTTP Request` (log to SSoT `event_log` table and to metrics sink).
  - `Slack` notification with event context + stacktrace link.
- **Security:** Validate webhook signatures (Git, ShotGrid, DAM) in `Function` node; reject unknown origins with `IF` → `Respond to Webhook` (401).

---
## 3. Phase 1 – Pre-Production & Asset Ingestion

### 1.1 Script Ingestion — `CHM-PreProd-Script-Ingestion`
- **Trigger:** `Webhook` from Git provider delivering repo, branch, file path, commit SHA.
- **Node Flow:**
  1. `HTTP Request` → Git API: fetch script blob (`.fdx/.pdf/.txt`).
  2. `Function` (`Script Parser`): call external NLP/LLM API; outputs `scenes[]`, `characters[]`, `locations[]`, `props[]`, `script_hash`.
  3. `IF` (new vs revision) using `script_hash` vs last stored hash in ShotGrid (`HTTP Request` lookup).
  4. `HTTP Request` → ShotGrid: create/patch tasks per scene (storyboard, visdev, asset modeling) linking `script_version` and `sequence_id`.
  5. `HTTP Request` → storage API (S3/Drive) to store artifact + metadata.
  6. `HTTP Request` → ShotGrid `script_log` entity recording impacts and timestamps.
  7. `Slack`/`Email`: notify showrunner & dept leads with change summary + diff URL.
- **Logging & Errors:**
  - On NLP failure: `IF` → mark script record `status=ingest_failed`, send alert, and attach error message to ShotGrid note.
  - Metrics `Set` node to capture parse duration, created tasks count; push via `HTTP Request` to metrics sink.

### 1.2 Asset Creation & Ingestion — `CHM-PreProd-Asset-Publish`
- **Trigger:** `Webhook` from DCC publish tool or scheduled poll of DAM via `HTTP Request` (cron expression in n8n Scheduler node).
- **Node Flow:**
  1. `Function/Set` (`Validate Metadata`): enforce naming convention, ensure `asset_type`, `project_id`, `sequence_id|shot_id` present.
  2. `HTTP Request` (`Asset Validation Service`): optional deep checks (file size, renderable formats, checksums).
  3. `IF` (validation failed): update ShotGrid status to `Publish Rejected`, notify artist via `Slack/Email`, respond with failure.
  4. `HTTP Request` (`Register in DAM`): create asset version entry with `asset_id`, `version_id`, `file_url`, `checksum`.
  5. `HTTP Request` (`Update ShotGrid Status`): set to **Pending Review**, link DAM ID, create/assign review task to supervisor.
  6. `Slack/Email`: supervisor notification with deep link to DAM + ShotGrid.
- **Logging & Errors:** attach validation report to ShotGrid note; capture latency and validation outcome to metrics sink.

---
## 4. Phase 2 – Production (Shot Assembly & Animation)

### 2.1 Scene Assembly — `CHM-Prod-Scene-Assembly`
- **Trigger:** `Webhook` from ShotGrid when layout task status = `In Progress`.
- **Node Flow:**
  1. `HTTP Request` (`Fetch Required Assets`): query ShotGrid/DAM for approved assets tied to `shot_id`/`sequence_id`.
  2. `Function` (`Scene Blueprint`): build JSON payload with asset refs, cameras, frame range, default render settings.
  3. `HTTP Request` (`DCC Scene Builder API`): submit blueprint; service returns `scene_path` and `job_id`.
  4. `HTTP Request` (`Update ShotGrid`): attach `scene_path`, set sub-status `Scene Auto-Built`, log `job_id`.
  5. `Slack` notification to layout artist with scene link.
- **Error Handling:** if builder API fails, set task to `Blocked`, add error note, and notify pipeline TD channel.

### 2.2 Daily Review Generation — `CHM-Prod-Dailies-Generation`
- **Trigger:** `Webhook` from animation publish tool carrying `shot_id`, `version_id`, `playblast_path` or source scene link.
- **Node Flow:**
  1. `HTTP Request` (`Submit Playblast/Preview`): send to render/preview service; capture `queue_id`.
  2. `HTTP Request` (Loop or Wait-For-Webhook): monitor until `status=complete`.
  3. `HTTP Request` (`Transcode to MP4`): call transcoding API (MediaConvert/FFmpeg service) for review format + burn-ins.
  4. `HTTP Request` (`Upload to Review System`): push MP4 to ShotGrid RV/SyncSketch; add to daily playlist.
  5. `HTTP Request` (`Update ShotGrid`): attach review media to `shot_id`+`version_id`, set task `Pending Review`.
  6. `Slack/Email`: ping supervisors with playlist link and change summary.
- **Error Handling:** if render/transcode fails, mark task note with failure reason, set status `Needs Repair`, and auto-retry with capped attempts using `IF` + counter in `Set` node.

---
## 5. Phase 3 – Post-Production (Lighting, Rendering, Compositing)

### 3.1 Render Farm Management — `CHM-Post-Render-Management`
- **Trigger:** `Webhook` when shot status → `Ready for Final Render`.
- **Node Flow:**
  1. `HTTP Request` (`Fetch Render Config`): pull AOVs, frames, resolution, pool, priority from ShotGrid/config service.
  2. `HTTP Request` (`Submit Render Job`): send to Deadline/AWS; store `render_job_id`, output path template.
  3. `HTTP Request` or Wait Webhook (`Monitor Queue`): poll/await completion; collect progress percentages.
  4. `Function` (`Cloud Bursting Logic`): if queue depth/ETA exceeds threshold, `HTTP Request` to cloud provider to scale instances up; scale down when jobs finish.
  5. `HTTP Request` (`Update ShotGrid`): record start/end timestamps, farm utilization metrics, render output path; set status `Rendering` → `Render Complete`.
- **Error Handling:** on failure, set status `Render Failed`, attach log URL, notify lighting lead; auto-resubmit if policy allows.

### 3.2 Post-Render QC & Compositing Prep — `CHM-Post-QC-Comp-Prep`
- **Trigger:** Webhook from render manager on job completion, or poll results from previous workflow.
- **Node Flow:**
  1. `HTTP Request` (`Fetch Rendered Frames`): list frames and metadata from storage API.
  2. `Function` (`QC Script`): verify frame count/continuity, detect corrupt/missing frames; output `qc_status`, `issues[]`.
  3. `IF` (QC pass/fail):
     - Fail → update ShotGrid note/status `QC Failed`, notify comp/lighting, optionally trigger re-render.
     - Pass → continue.
  4. `HTTP Request` (`Update Ready for Comp`): set shot status `Ready for Comp`, record QC report URL.
  5. `HTTP Request` (`Generate Nuke Comp Template`): call comp-template service; receive `nuke_script_url`.
  6. `HTTP Request` (`Attach Comp Script`): store script link in ShotGrid and notify comp team.
- **Logging:** QC metrics (frame count, duration, error types) pushed to metrics sink via `HTTP Request`.

---
## 6. Phase 4 – Editorial & Sound

### 4.1 Conforming the Edit — `CHM-Editorial-Conform`
- **Trigger:** `Webhook` with new EDL/XML from editorial system or Scheduler + `HTTP Request` polling shared storage.
- **Node Flow:**
  1. `HTTP Request` (`Fetch EDL/XML`).
  2. `Function` (`Parse Edit List`): convert to structured shot list with timecodes.
  3. `HTTP Request` (`Fetch Previous Edit`): retrieve prior version (ShotGrid/object storage).
  4. `Function` (`Diff Engine`): produce `new_shots[]`, `retimed_shots[]`, `removed_shots[]`.
  5. `HTTP Request` (`Update Shot Statuses`):
     - New → `Not Started`
     - Retimed → `Needs Review`/`Re-Work`
     - Removed → close/flag
  6. `Slack/Email`: notify supervisors + impacted departments with summarized diff and links.
- **Error Handling:** malformed EDL/XML triggers rejection note, status `Conform Failed`, and alert to editorial TD.

---
## 7. Phase 5 – Finalization & Distribution

### 5.1 Automated Mastering & Transcoding — `CHM-Final-Mastering-Transcode`
- **Trigger:** ShotGrid status where episode `picture_locked=true` AND `final_qc=passed` (Webhook or poll).
- **Node Flow:**
  1. `HTTP Request` (`Fetch Locked Timeline`): pull master sequence reference.
  2. `HTTP Request` (`Submit Transcode Jobs`): MediaConvert/encoder API with profiles (4K ProRes, HD H.264, platform specs); capture `job_ids`.
  3. `HTTP Request` or Webhook (`Monitor Jobs`): track progress; on completion retrieve output URLs.
  4. `HTTP Request` (`Register Master Deliverables`): write outputs and metadata to ShotGrid deliverables entity.
- **Error Handling:** failed transcode → mark `Transcode Failed`, notify finishing team, and optionally retry limited times.

### 5.2 Packaging & Delivery — `CHM-Final-Packaging-Delivery`
- **Trigger:** ShotGrid flag `ready_for_delivery=true` for episode/master bundle.
- **Node Flow:**
  1. `HTTP Request` (`Gather Deliverables`): collect video masters, audio stems, subtitles, metadata.
  2. `Function` (`Build Delivery Package`): JSON defining IMF/DPP/etc. structure, checksums, targets.
  3. `HTTP Request` (`Packaging Service`): assemble package; return `package_url` and manifest.
  4. `HTTP Request` (`High-Speed Transfer`): initiate Aspera/Signiant transfer to client endpoints.
  5. `Function` (`Checksum & Verification`): validate integrity; record results.
  6. `HTTP Request` (`Update Delivery Log`): store delivery status, timestamps, tracking IDs in ShotGrid.
  7. `Slack/Email`: alert distribution, production, and client reps with package status and tracking.
- **Error Handling:** if delivery fails, set status `Delivery Failed`, include reason, schedule retry or escalate.

---
## 8. Cross-Cutting Concerns

- **Credentials:** Use n8n credential vault for ShotGrid, Git, DAM, render farm, cloud provider, Slack/email; reference via node credential selectors.
- **Retries & Timeouts:** Configure HTTP nodes with retry/backoff; wrap long operations with `Wait` + `Error Trigger` to capture timeouts.
- **Idempotency:** Use `version_id` + `script_hash` + `render_job_id` to prevent duplicate writes; gate updates with `IF` nodes checking existing records.
- **Audit Trails:** Every workflow posts an `event_log` record (entity, action, status, duration, user, request IDs) to SSoT and metrics sink.
- **Security:** Validate webhook signatures, enforce HTTPS endpoints, and limit payload scopes; store no secrets in Function node code.

---
## 9. How to Build in n8n Cloud (implementation notes)

- Each workflow above is independent; the **Core Router** calls them via n8n's *Execute Workflow* URLs so they can be developed and deployed separately.
- Prefer *Webhook* triggers where supported; fall back to *Scheduler + HTTP Request* polling when systems lack webhook support.
- Use **Function** nodes only for data shaping/validation; avoid long-running logic—delegate to external APIs.
- Leverage **IF/Switch** for branching on statuses and error paths; always end with explicit `Respond to Webhook` nodes when acting as HTTP entrypoints.
- For observability, attach **Execution Data** to metrics sink and maintain **Slack alert channels** per department (layout/anim/lighting/comp/editorial/delivery).
