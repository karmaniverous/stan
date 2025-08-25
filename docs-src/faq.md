---
title: FAQ
---

# FAQ

## Do I need to re‑upload the full archive every time?
Typically no. Upload the full `archive.tar` once at the start of a thread, then attach `archive.diff.tar` for subsequent iterations. Start a fresh chat and reattach when the context window is exhausted.

## What if my repo contains binaries or large files?
STAN excludes binaries and flags large text files. Add glob excludes in `stan.config.yml` when you don’t want them included.

## Why plain unified diffs?
They’re portable, auditable, and tooling‑friendly. STAN’s FEEDBACK handshake improves diffs automatically on failure.

## Can I run STAN in CI?
Yes. The CLI is deterministic: run scripts and generate archives in a job, then upload as artifacts or publish to your documentation workflows.

## Is there a library API?
STAN exports modules, but the primary interface is the CLI. The docs site includes project documents and typed API pages if you need deeper integration.
