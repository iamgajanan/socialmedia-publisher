# LinkedIn OAuth configuration

OmniSocial supports personal LinkedIn publishing with the self-serve `Share on LinkedIn` product.

Company Page discovery/publishing requires the LinkedIn Community Management API permissions. Those organization scopes must not be requested from applications that have not been granted the corresponding LinkedIn API access.

## Production configuration

Use the personal scopes while organization access is pending:

`LINKEDIN_OAUTH_SCOPES=openid profile email w_member_social`

`LINKEDIN_ORGANIZATION_ACCESS_ENABLED=false`

After LinkedIn grants the required organization API access, configure:

`LINKEDIN_OAUTH_SCOPES=openid profile email w_member_social r_organization_admin w_organization_social`

`LINKEDIN_ORGANIZATION_ACCESS_ENABLED=true`

Users must reconnect LinkedIn after changing OAuth scopes so LinkedIn can issue a token with the newly requested permissions.
