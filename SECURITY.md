# Security Policy

Kavio treats templates, assets, URLs, fonts, SVGs, and renderer
inputs as untrusted data.

## Dependency Policy

- Use Corepack pnpm with the configured package age gate.
- Do not bypass `minimumReleaseAge`.
- Do not run package lifecycle scripts merely to inspect a package.
- Prefer existing runtime capabilities before adding dependencies.
- Keep lockfile churn small and reviewable.

## Product Threat Model

The renderer must defend against:

- SSRF through user-supplied asset URLs.
- Arbitrary code execution through templates.
- Browser sandbox escapes through malicious media, fonts, or SVGs.
- Resource exhaustion through large canvases, long timelines, or many assets.
- Multi-tenant data leakage in future hosted deployments.

The MVP format must remain data-only. Browser-only custom code should be treated
as trusted application code, not user-generated template content.

## Reporting

Please report suspected vulnerabilities privately to the project maintainers
before public disclosure.
