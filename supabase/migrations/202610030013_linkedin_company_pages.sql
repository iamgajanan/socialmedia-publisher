-- LinkedIn Company Page destinations use the existing social account model.
-- The LinkedIn organization URN/ID and role are stored in metadata so one
-- authenticated LinkedIn member can own both a personal destination and one
-- or more Company Page destinations without changing the publishing model.

create index if not exists socialmedia_social_accounts_workspace_user_platform_status_idx
  on public.socialmedia_social_accounts(workspace_id, socialmedia_user_id, platform, status);

create index if not exists socialmedia_social_accounts_linkedin_org_id_idx
  on public.socialmedia_social_accounts((metadata ->> 'linkedin_organization_id'))
  where platform = 'linkedin' and metadata ->> 'linkedin_account_type' = 'organization';

comment on column public.socialmedia_social_accounts.metadata is
  'Provider-specific metadata. LinkedIn organization accounts store linkedin_account_type, linkedin_organization_id, linkedin_organization_urn, linkedin_author_urn, and linkedin_role.';
