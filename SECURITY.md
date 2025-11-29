# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Codetographer, please report it responsibly:

1. **Do NOT open a public issue** for security vulnerabilities
2. Use [GitHub Security Advisories](https://github.com/Kelvination/codetographer/security/advisories/new) to report the vulnerability privately
3. Alternatively, contact the maintainers directly

## What to Include

When reporting a vulnerability, please include:

- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Any suggested fixes (if applicable)

## Response Timeline

- We will acknowledge receipt of your report within 48 hours
- We will provide an initial assessment within 7 days
- We will work with you to understand and resolve the issue

## Scope

This security policy applies to the Codetographer VS Code extension and its associated components in this repository.

Since Codetographer is a local visualization tool that reads `.cgraph` files, the primary security considerations are:
- Malicious content in `.cgraph` files
- Path traversal in file location references
- XSS in the webview rendering

Thank you for helping keep Codetographer secure.
