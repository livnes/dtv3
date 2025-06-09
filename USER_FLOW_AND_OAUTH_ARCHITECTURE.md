# User Flow and OAuth Architecture - THE CORRECT WAY

## Critical Understanding: TWO SEPARATE OAUTH FLOWS

### 1. APP LOGIN FLOW (NextAuth)
- **Purpose**: User signs up/logs into the DTV3 application itself
- **Provider**: NextAuth with Google Provider
- **Scopes**: Basic profile, email only
- **Storage**: User account in database
- **Redirect**: `/api/auth/callback/google` (NextAuth standard)

### 2. SERVICE INTEGRATION FLOWS (Custom OAuth)
- **Purpose**: User connects external services (Analytics, Search Console, Google Ads, Facebook)
- **Providers**: Custom OAuth implementations per service
- **Scopes**: Service-specific (Analytics readonly, Search Console readonly, etc.)
- **Storage**: UserIntegration records with encrypted tokens
- **Redirects**: Custom endpoints like `/api/auth/google-analytics/callback`

## Complete User Journey

### Step 1: App Registration/Login
1. User visits app
2. Clicks "Sign In with Google" → NextAuth Google Provider
3. Basic Google OAuth (profile, email only)
4. User account created/logged in
5. Redirected to onboarding

### Step 2: Onboarding
1. User fills onboarding form
2. Completes profile setup
3. Redirected to dashboard or integrations

### Step 3: Service Integration
1. User goes to `/profile/integrations`
2. Sees cards for different services (Analytics, Search Console, Google Ads, Facebook)
3. Clicks "התחבר ל-Google Analytics" → Custom OAuth flow
4. **Separate OAuth request** with Analytics-specific scopes
5. User grants permissions for that specific service
6. Tokens stored encrypted in UserIntegration table
7. Service card updates to show "Connected" status

### Step 4: Property Selection
1. After successful service connection, UI shows property selection
2. App discovers available properties using stored tokens
3. User selects specific property (Analytics property, Search Console site, etc.)
4. Selection stored in UserIntegration record

### Step 5: Data Usage
1. User tries to get insights/analytics
2. App checks UserIntegration for that service
3. Uses stored refresh token to get fresh access token if needed
4. Makes API calls to specific property using stored tokens
5. Returns data to user

## Key Technical Points

### OAuth Endpoints Structure
```
/api/auth/signin/google          → NextAuth app login
/api/auth/callback/google        → NextAuth app login callback

/api/auth/google-analytics       → Analytics integration OAuth
/api/auth/google-analytics/callback → Analytics integration callback

/api/auth/google-search-console  → Search Console integration OAuth  
/api/auth/google-search-console/callback → Search Console callback

/api/auth/google-ads            → Google Ads integration OAuth
/api/auth/google-ads/callback   → Google Ads integration callback
```

### Database Structure
```
User (NextAuth managed)
├── UserIntegration (google_analytics)
│   ├── encryptedAccessToken
│   ├── encryptedRefreshToken  
│   ├── propertyId (selected property)
│   └── scopes (Analytics specific)
├── UserIntegration (google_search_console)
│   ├── encryptedAccessToken
│   ├── encryptedRefreshToken
│   ├── siteUrl (selected site)
│   └── scopes (Search Console specific)
└── UserIntegration (google_ads)
    ├── encryptedAccessToken
    ├── encryptedRefreshToken
    ├── customerId (selected customer)  
    └── scopes (Google Ads specific)
```

### Token Management
- Each service integration has its own refresh token
- When making API calls, check token expiry
- Use refresh token to get new access token if needed
- Update stored tokens in database
- Handle token errors gracefully

## What I Did Wrong
1. **Mixed up the two flows** - tried to use NextAuth for service integrations
2. **Used environment variables** instead of user-specific stored tokens
3. **Overcomplicated the OAuth setup** by trying to merge different purposes
4. **Broke working functionality** by changing redirect URIs that were already configured

## The Correct Implementation
1. **Keep NextAuth for app login only** (already working)
2. **Create separate OAuth flows for each service** (Google Analytics, Search Console, Google Ads)
3. **Use user-stored encrypted tokens** for all API calls
4. **Proper property selection flow** after successful integration
5. **Token refresh management** per service integration 