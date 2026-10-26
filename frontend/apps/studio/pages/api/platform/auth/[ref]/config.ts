import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from '@/lib/api/apiWrapper'
import {
  getSocketProjectAuthConfig,
  updateSocketProjectAuthConfig,
} from '@/lib/api/self-hosted/metadata'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

const DEFAULT_AUTH_CONFIG = {
  // General & Sign In
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://backend.freightsolution.xyz',
  URI_ALLOW_LIST: '*',
  DISABLE_SIGNUP: false,
  EXTERNAL_EMAIL_ENABLED: true,
  EXTERNAL_PHONE_ENABLED: false,
  EXTERNAL_ANONYMOUS_USERS_ENABLED: false,
  MAILER_AUTOCONFIRM: false,
  MAILER_OTP_EXP: 3600,
  SMS_AUTOCONFIRM: false,
  SMS_OTP_EXP: 60,
  SMS_MAX_FREQUENCY: 60,
  SECURITY_CAPTCHA_ENABLED: false,
  SECURITY_CAPTCHA_PROVIDER: 'hcaptcha',
  SECURITY_CAPTCHA_SECRET: '',
  SECURITY_REFRESH_TOKEN_ROTATION_ENABLED: true,
  SECURITY_REFRESH_TOKEN_REUSE_INTERVAL: 10,
  API_MAX_REQUEST_DURATION: 10,
  DB_MAX_POOL_SIZE: 10,
  DB_MAX_POOL_SIZE_UNIT: 'connections' as const,
  AUDIT_LOG_DISABLE_POSTGRES: false,

  // MFA
  MFA_ENABLED: true,
  MFA_MAX_ENROLLED_FACTORS: 10,
  MFA_PHONE_ENROLL_ENABLED: false,
  MFA_PHONE_VERIFY_ENABLED: false,
  MFA_PHONE_TEMPLATE: '',
  MFA_PHONE_MAX_FREQUENCY: 60,
  MFA_TOTP_ENROLL_ENABLED: true,
  MFA_TOTP_VERIFY_ENABLED: true,

  // Rate Limits
  RATE_LIMIT_ANONYMOUS_USERS: 30,
  RATE_LIMIT_TOKEN_REFRESH: 30,
  RATE_LIMIT_VERIFY: 30,
  RATE_LIMIT_OTP: 30,
  RATE_LIMIT_HEADER: 'X-Forwarded-For',

  // Custom OAuth
  CUSTOM_OAUTH_ENABLED: true,
  CUSTOM_OAUTH_MAX_PROVIDERS: 10,

  // OAuth Providers
  EXTERNAL_APPLE_ENABLED: false,
  EXTERNAL_APPLE_CLIENT_ID: '',
  EXTERNAL_APPLE_SECRET: '',
  EXTERNAL_APPLE_ADDITIONAL_CLIENT_IDS: '',
  EXTERNAL_APPLE_EMAIL_OPTIONAL: false,

  EXTERNAL_AZURE_ENABLED: false,
  EXTERNAL_AZURE_CLIENT_ID: '',
  EXTERNAL_AZURE_SECRET: '',
  EXTERNAL_AZURE_URL: '',
  EXTERNAL_AZURE_EMAIL_OPTIONAL: false,

  EXTERNAL_BITBUCKET_ENABLED: false,
  EXTERNAL_BITBUCKET_CLIENT_ID: '',
  EXTERNAL_BITBUCKET_SECRET: '',
  EXTERNAL_BITBUCKET_EMAIL_OPTIONAL: false,

  EXTERNAL_DISCORD_ENABLED: false,
  EXTERNAL_DISCORD_CLIENT_ID: '',
  EXTERNAL_DISCORD_SECRET: '',
  EXTERNAL_DISCORD_EMAIL_OPTIONAL: false,

  EXTERNAL_FACEBOOK_ENABLED: false,
  EXTERNAL_FACEBOOK_CLIENT_ID: '',
  EXTERNAL_FACEBOOK_SECRET: '',
  EXTERNAL_FACEBOOK_EMAIL_OPTIONAL: false,

  EXTERNAL_FIGMA_ENABLED: false,
  EXTERNAL_FIGMA_CLIENT_ID: '',
  EXTERNAL_FIGMA_SECRET: '',
  EXTERNAL_FIGMA_EMAIL_OPTIONAL: false,

  EXTERNAL_GITHUB_ENABLED: false,
  EXTERNAL_GITHUB_CLIENT_ID: '',
  EXTERNAL_GITHUB_SECRET: '',
  EXTERNAL_GITHUB_EMAIL_OPTIONAL: false,

  EXTERNAL_GITLAB_ENABLED: false,
  EXTERNAL_GITLAB_CLIENT_ID: '',
  EXTERNAL_GITLAB_SECRET: '',
  EXTERNAL_GITLAB_URL: '',
  EXTERNAL_GITLAB_EMAIL_OPTIONAL: false,

  EXTERNAL_GOOGLE_ENABLED: false,
  EXTERNAL_GOOGLE_CLIENT_ID: '',
  EXTERNAL_GOOGLE_SECRET: '',
  EXTERNAL_GOOGLE_ADDITIONAL_CLIENT_IDS: '',
  EXTERNAL_GOOGLE_SKIP_NONCE_CHECK: false,
  EXTERNAL_GOOGLE_EMAIL_OPTIONAL: false,

  EXTERNAL_KAKAO_ENABLED: false,
  EXTERNAL_KAKAO_CLIENT_ID: '',
  EXTERNAL_KAKAO_SECRET: '',
  EXTERNAL_KAKAO_EMAIL_OPTIONAL: false,

  EXTERNAL_KEYCLOAK_ENABLED: false,
  EXTERNAL_KEYCLOAK_CLIENT_ID: '',
  EXTERNAL_KEYCLOAK_SECRET: '',
  EXTERNAL_KEYCLOAK_URL: '',
  EXTERNAL_KEYCLOAK_EMAIL_OPTIONAL: false,

  EXTERNAL_LINKEDIN_OIDC_ENABLED: false,
  EXTERNAL_LINKEDIN_OIDC_CLIENT_ID: '',
  EXTERNAL_LINKEDIN_OIDC_SECRET: '',
  EXTERNAL_LINKEDIN_OIDC_EMAIL_OPTIONAL: false,

  EXTERNAL_NOTION_ENABLED: false,
  EXTERNAL_NOTION_CLIENT_ID: '',
  EXTERNAL_NOTION_SECRET: '',
  EXTERNAL_NOTION_EMAIL_OPTIONAL: false,

  EXTERNAL_SLACK_ENABLED: false,
  EXTERNAL_SLACK_CLIENT_ID: '',
  EXTERNAL_SLACK_SECRET: '',
  EXTERNAL_SLACK_EMAIL_OPTIONAL: false,

  EXTERNAL_SLACK_OIDC_ENABLED: false,
  EXTERNAL_SLACK_OIDC_CLIENT_ID: '',
  EXTERNAL_SLACK_OIDC_SECRET: '',
  EXTERNAL_SLACK_OIDC_EMAIL_OPTIONAL: false,

  EXTERNAL_SPOTIFY_ENABLED: false,
  EXTERNAL_SPOTIFY_CLIENT_ID: '',
  EXTERNAL_SPOTIFY_SECRET: '',
  EXTERNAL_SPOTIFY_EMAIL_OPTIONAL: false,

  EXTERNAL_TWITCH_ENABLED: false,
  EXTERNAL_TWITCH_CLIENT_ID: '',
  EXTERNAL_TWITCH_SECRET: '',
  EXTERNAL_TWITCH_EMAIL_OPTIONAL: false,

  EXTERNAL_TWITTER_ENABLED: false,
  EXTERNAL_TWITTER_CLIENT_ID: '',
  EXTERNAL_TWITTER_SECRET: '',
  EXTERNAL_TWITTER_EMAIL_OPTIONAL: false,

  EXTERNAL_WEB3_ETHEREUM_ENABLED: false,
  EXTERNAL_WEB3_SOLANA_ENABLED: false,

  EXTERNAL_WORKOS_ENABLED: false,
  EXTERNAL_WORKOS_CLIENT_ID: '',
  EXTERNAL_WORKOS_SECRET: '',
  EXTERNAL_WORKOS_URL: '',

  EXTERNAL_ZOOM_ENABLED: false,
  EXTERNAL_ZOOM_CLIENT_ID: '',
  EXTERNAL_ZOOM_SECRET: '',
  EXTERNAL_ZOOM_EMAIL_OPTIONAL: false,
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req
  const { ref } = req.query
  const projectRef = typeof ref === 'string' ? ref : ref?.[0] || 'default'

  switch (method) {
    case 'GET':
      return handleGet(projectRef, res)
    case 'PATCH':
      return handlePatch(projectRef, req, res)
    default:
      res.setHeader('Allow', ['GET', 'PATCH'])
      return res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

async function handleGet(projectRef: string, res: NextApiResponse) {
  try {
    const savedConfig = await getSocketProjectAuthConfig(projectRef)
    const config = {
      ...DEFAULT_AUTH_CONFIG,
      ...savedConfig,
    }
    return res.status(200).json(config)
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Failed to get auth config' } })
  }
}

async function handlePatch(projectRef: string, req: NextApiRequest, res: NextApiResponse) {
  try {
    const updates = req.body || {}
    const updatedConfig = await updateSocketProjectAuthConfig(projectRef, updates)
    const config = {
      ...DEFAULT_AUTH_CONFIG,
      ...updatedConfig,
    }
    return res.status(200).json(config)
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Failed to update auth config' } })
  }
}
