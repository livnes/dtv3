# COMPLETE OAUTH GUIDE - LESSONS LEARNED

## 🎯 CRITICAL UNDERSTANDING: TWO SEPARATE OAUTH FLOWS

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

## 🚨 CRITICAL MISTAKES TO AVOID

### ❌ Mistake #1: Mixing App Login with Service Integration
**WRONG**: Using NextAuth for service integrations
**CORRECT**: NextAuth for app login, custom OAuth for service integrations

### ❌ Mistake #2: Using Environment Variables for User Data
**WRONG**: Using `process.env.GOOGLE_ACCESS_TOKEN` for user API calls
**CORRECT**: Using encrypted tokens from UserIntegration database

### ❌ Mistake #3: Duplicating OAuth Logic
**WRONG**: Creating new OAuth clients in every function
**CORRECT**: Using existing service classes like `AnalyticsService.fromUser(userId)`

### ❌ Mistake #4: Wrong Token Exchange Method
**WRONG**: Using `oauth2Client.getToken(code)` (causes invalid_grant)
**CORRECT**: Using direct HTTP POST to `https://oauth2.googleapis.com/token`

### ❌ Mistake #5: Redirect URI Mismatches
**WRONG**: Inconsistent redirect URIs between code and Google Cloud Console
**CORRECT**: Exact match between OAuth request and Google Cloud Console

## ✅ CORRECT OAUTH IMPLEMENTATION

### Environment Variables (App-Level Only)
```bash
GOOGLE_CLIENT_ID=your-app-client-id
GOOGLE_CLIENT_SECRET=your-app-client-secret
NEXTAUTH_URL=http://localhost:3000

# Required for Google Ads integration (must apply to Google first)
GOOGLE_ADS_DEVELOPER_TOKEN=your-ads-developer-token
```

### Database Schema (User-Level)
```sql
UserIntegration {
  userId                String    -- User who owns this integration
  providerName          String    -- 'google_analytics', 'google_search_console', 'google_ads'
  accountId             String    -- Selected property/site/customer ID
  accountName           String?   -- Account display name
  propertyName          String?   -- Property display name
  encryptedAccessToken  String    -- User's encrypted access token
  encryptedRefreshToken String?   -- User's encrypted refresh token
  tokenExpiresAt        DateTime? -- When tokens expire
  scopes                String    -- JSON string of granted scopes
  isActive              Boolean   -- Whether this integration is active
}
```

### OAuth Endpoints Structure
```
/api/auth/signin/google                    → NextAuth app login
/api/auth/callback/google                  → NextAuth app login callback

/api/auth/google-analytics                 → Analytics integration OAuth
/api/auth/google-analytics/callback        → Analytics integration callback

/api/auth/google-search-console            → Search Console integration OAuth  
/api/auth/google-search-console/callback   → Search Console callback

/api/auth/google-ads                       → Google Ads integration OAuth ✅ IMPLEMENTED
/api/auth/google-ads/callback              → Google Ads integration callback ✅ IMPLEMENTED
```

### Correct Service Pattern
```javascript
export class AnalyticsService {
    constructor(credentials) {
        this.credentials = credentials;
        this.analytics = google.analyticsdata({ version: 'v1beta', auth: credentials });
    }

    static async fromUser(userId) {
        // Get user's integration from database
        const integration = await prisma.userIntegration.findFirst({
            where: {
                userId: userId,
                providerName: 'google_analytics',
                isActive: true
            }
        });

        if (!integration) {
            throw new Error('No Google Analytics integration found');
        }

        // Decrypt the stored tokens
        const accessToken = decrypt(integration.encryptedAccessToken);
        const refreshToken = integration.encryptedRefreshToken ? decrypt(integration.encryptedRefreshToken) : null;

        // Create OAuth2 client with DECRYPTED tokens
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,      // ✅ App credentials from env
            process.env.GOOGLE_CLIENT_SECRET   // ✅ App credentials from env
        );

        oauth2Client.setCredentials({
            access_token: accessToken,          // ✅ User tokens from database
            refresh_token: refreshToken,        // ✅ User tokens from database
            expiry_date: integration.tokenExpiresAt?.getTime()
        });

        return new AnalyticsService(oauth2Client);
    }
}
```

### Correct OAuth Callback Implementation
```javascript
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        // Verify session and state
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.id !== state) {
            return NextResponse.redirect(new URL('/profile/integrations?error=invalid_state', request.url));
        }

        // ✅ CORRECT: Direct HTTP token exchange (prevents invalid_grant)
        const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/google-analytics/callback`;
        
        const tokenRequestBody = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            code: code
        });

        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: tokenRequestBody.toString()
        });

        const tokens = await response.json();

        // Store encrypted tokens in database
        const integrationData = {
            accountId: 'pending_property_selection',
            encryptedAccessToken: encrypt(tokens.access_token),
            encryptedRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
            tokenExpiresAt: new Date(Date.now() + (tokens.expires_in * 1000)),
            scopes: JSON.stringify(['https://www.googleapis.com/auth/analytics.readonly']),
            isActive: true
        };

        await prisma.userIntegration.upsert({
            where: {
                userId_providerName: {
                    userId: session.user.id,
                    providerName: 'google_analytics'
                }
            },
            update: integrationData,
            create: {
                userId: session.user.id,
                providerName: 'google_analytics',
                ...integrationData
            }
        });

        // ✅ NEW: Automatically discover properties after OAuth
        try {
            console.log('🔄 Triggering automatic property discovery...');
            const discoveryResult = await syncAnalyticsProperties(session.user.id);

            if (discoveryResult.success) {
                console.log('✅ Auto-discovery completed:', {
                    totalProperties: discoveryResult.properties?.length || 0,
                    changes: discoveryResult.changes
                });
            }
        } catch (discoveryError) {
            console.warn('⚠️ Auto-discovery failed (user can refresh manually):', discoveryError.message);
        }

        return NextResponse.redirect(new URL('/profile/integrations?success=analytics_connected', request.url));
    } catch (error) {
        console.error('OAuth callback error:', error);
        return NextResponse.redirect(new URL('/profile/integrations?error=oauth_callback_failed', request.url));
    }
}
```

## 🔧 GOOGLE CLOUD CONSOLE SETUP

### Required Redirect URIs
Add these to your Google Cloud Console OAuth application:

```
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/auth/google-analytics/callback  
http://localhost:3000/api/auth/google-search-console/callback
http://localhost:3000/api/auth/google-ads/callback
```

### Required APIs to Enable
- Google Analytics Reporting API
- Google Analytics Admin API  
- Google Search Console API
- Google Ads API ⚠️ **Requires Developer Token**

### Google Ads Implementation ✅ COMPLETE
Google Ads OAuth works exactly like Analytics and Search Console:

1. **OAuth Flow**: User clicks "התחבר ל-Google Ads" → authorizes access
2. **Auto-Discovery**: Immediately syncs accessible customer accounts via REST API  
3. **Real API Calls**: Uses direct Google Ads API v20 with OAuth tokens
4. **Direct HTTP Token Exchange**: Uses proper token exchange to prevent invalid_grant

**Developer Token**: Required and configured. Shows real customer accounts when available, empty when user has no Google Ads accounts.

## 🔄 COMMON ISSUES & SOLUTIONS

### Issue: `invalid_grant` Error
**Cause**: Using `oauth2Client.getToken(code)` method
**Solution**: Use direct HTTP POST to `https://oauth2.googleapis.com/token`

### Issue: Infinite Loading Loop  
**Cause**: Auto-discovery triggering itself repeatedly
**Solution**: Add discovery prevention flags and conditional re-fetch logic

### Issue: Properties Not Showing
**Cause**: Using environment variables instead of user tokens
**Solution**: Use `AnalyticsService.fromUser(userId)` pattern

### Issue: Redirect URI Mismatch
**Cause**: URL in code doesn't match Google Cloud Console
**Solution**: Ensure exact match between OAuth request and console configuration

## 📋 TESTING CHECKLIST

### OAuth Flow Testing
- [ ] App login works (NextAuth)
- [ ] Service connection works (custom OAuth)
- [ ] Tokens are encrypted and stored
- [ ] Properties are auto-discovered after OAuth ✨ NEW
- [ ] Real property names appear immediately (not "pending")
- [ ] API calls use user tokens
- [ ] Refresh tokens work properly

### Integration Testing
- [x] Analytics properties load ✅ WORKING
- [x] Search Console sites load ✅ FIXED (was broken by invalid_grant)
- [x] Google Ads customers load ✅ WORKING
- [x] Property selection works ✅ WORKING
- [x] Data fetching works with selected properties ✅ WORKING  
- [x] Auto-discovery works for all three services ✅ WORKING

## 🎯 SUCCESS INDICATORS

When OAuth is working correctly:
1. ✅ No `invalid_grant` errors
2. ✅ Integration cards show "Connected" status
3. ✅ Properties appear in dropdowns with real names **immediately** after OAuth ✨
4. ✅ No "pending_property_selection" visible to users
5. ✅ API calls return actual user data
6. ✅ No infinite loading loops
7. ✅ Token refresh happens automatically
8. ✅ No environment variable confusion

## 📚 KEY TAKEAWAYS

1. **Separation of Concerns**: App login ≠ Service integration
2. **Token Storage**: Always use encrypted database storage for user tokens
3. **Service Pattern**: Use `.fromUser(userId)` pattern consistently  
4. **Direct HTTP**: Use direct token exchange to avoid library issues
5. **Exact Matching**: Redirect URIs must match exactly
6. **Prevention Logic**: Add safeguards against infinite loops
7. **Error Handling**: Provide specific error messages for debugging

This guide should prevent future OAuth confusion and ensure consistent implementation! 🎯 