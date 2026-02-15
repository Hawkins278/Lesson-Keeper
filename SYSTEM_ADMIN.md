# LessonKeeper — System Administration Guide

## Security

### Authentication & Sessions

- Authentication is handled through Replit's OpenID Connect (OIDC) integration, a standards-based identity protocol. Session tokens are stored server-side in PostgreSQL, and session cookies are configured with `httpOnly: true` (preventing JavaScript access) and `secure: true` (ensuring cookies only travel over HTTPS).
- Sessions last 7 days. If a user's access needs to be revoked, be aware they could retain access for up to 7 days until their session expires. However, the role check on every admin request mitigates this for admin-level operations — demoting an admin takes effect on their next API call, not at session expiry.

### Role-Based Access Control

- All admin-only routes (editing lessons/projects, managing users, reference data, scoring configuration) use server-side middleware that verifies the user's role from the database on every request — not just from the session token.
- A minimum of 2 admin accounts is enforced at all times. Admins cannot remove themselves or reduce the admin count below 2.
- The first user to register is automatically assigned the admin role. Subsequent users default to the "user" role unless promoted by an existing admin.

### Public Endpoint

- The `/api/public/top-subcategories` endpoint is accessible without authentication. It exposes only subcategory names, parent category names, and current risk scores (top 3). No lesson details, project names, or user information is included. This powers the landing page display for unauthenticated visitors.

### Input Handling

- User-supplied text (lesson names, descriptions, key learnings) is stored as-is and rendered through React, which automatically escapes HTML to prevent cross-site scripting (XSS).
- Excel exports include user-supplied text directly in cells. While theoretically susceptible to formula injection (e.g., cell content starting with `=`), modern versions of Excel display warnings before executing any such content.
- File uploads are restricted to 10MB maximum size.
- Input validation is applied on all create/update endpoints, including required field checks, type validation, and duplicate detection.

### Data Protection

- No secrets or API keys are exposed in client-side code or API responses.
- Error responses include contextual messages (e.g., "No user found with that email") to aid usability. Be aware that these could theoretically help an attacker enumerate valid accounts, though this is low risk for a team tool.
- CSV user exports properly escape special characters to prevent CSV injection.

### Object Storage (Avatars)

- User avatar uploads are stored via Replit's object storage integration using a presigned URL flow.
- Uploaded avatars are set to "public" visibility so profile images can be displayed. Anyone with the direct object URL can view a user's avatar image. No other user data is stored in object storage.

### Areas for Future Consideration

- **Rate limiting**: There is currently no application-level rate limiting. Replit's infrastructure provides some baseline protection, but high-volume requests to export endpoints (which perform heavy database queries and Excel generation) are not throttled. For small team use this is low risk; for larger deployments, consider adding rate limiting.
- **Audit logging**: There is currently no record of who performed admin actions (user promotions/demotions, scoring config changes, reference data modifications). For larger teams or compliance requirements, adding an audit trail would improve accountability.
- **Session invalidation**: There is no mechanism to force-expire a specific user's session immediately. If immediate access revocation is required, the session record would need to be manually removed from the `sessions` database table.
