# Privacy and Retention Documentation

## Privacy Principles

### 1. Data Minimization
- Store only what's necessary for security decisions
- Never store raw message content
- Use hashes for cross-group matching

### 2. Purpose Limitation
- User profiles serve security scoring only
- Threat indicators serve threat detection only
- No advertising, analytics, or third-party sharing

### 3. Isolation
- Group user profiles are isolated per group
- Global intelligence uses anonymized hashes
- No group can see another group's private data

## Retention Schedule

| Data Type | Retention Period |
|-----------|------------------|
| User Risk Profiles | 90 days after last activity |
| Group User Profiles | 90 days after last activity |
| Threat Indicators (WATCH) | 30 days inactive |
| Threat Indicators (BLOCK) | Indefinite |
| Violation Records | 365 days |

## What Gets Deleted

- User risk profile removed or anonymized on request
- Group user profiles for that user in all groups removed
- Threat indicator associations cleared
- Violation records retained (audit trail) but anonymized