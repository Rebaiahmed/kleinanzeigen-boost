# Reported Bugs & Issues

## Bug #1: Reply Template Injection - Session Token Retrieval Fails
**Status**: ⚠️ OPEN  
**Severity**: High  
**Component**: Extension - Messaging (ka-messaging.ts)  
**Date Reported**: 2026-06-14

### Description
The "📋 Vorlage einfügen" button is successfully injected and clickable on Kleinanzeigen messaging pages, but when clicked, it fails to fetch templates because the session token cannot be retrieved.

### Logs Observed
```
[AB-messaging] Found 1 textarea(s)
[AB-messaging] Button clicked
[AB-messaging] No session token available
```

### Root Cause Analysis
- Background script's `GET_SESSION_TOKEN` message handler may not be responding
- Session storage may be empty or inaccessible from content script
- localStorage fallback not working as expected
- Token might not be stored in extension storage at all

### Attempted Fixes
1. ✅ Improved textarea detection
2. ✅ Added logging to identify issue
3. ✅ Added localStorage fallback
4. ✅ Added timeout protection to message handler
5. ❌ Still fails - token retrieval incomplete

### Reproduction Steps
1. Log into AnzeigenBoost
2. Navigate to Kleinanzeigen messaging page
3. Click "📋 Vorlage einfügen" button
4. Modal appears but templates fail to load
5. Console shows "No session token available"

### Next Steps to Investigate
- [ ] Check how token is stored when user logs in
- [ ] Verify chrome.storage APIs are working in content script
- [ ] Check if content script has proper permissions
- [ ] Investigate if token is being passed to extension properly
- [ ] Consider using direct postMessage instead of chrome.runtime.sendMessage

---

## Bug #2: Per-Repost Analytics Feature Flag Not Applied
**Status**: ⚠️ OPEN  
**Severity**: Low  
**Component**: Frontend - Analytics (AdCard.tsx)  
**Date Reported**: 2026-06-14

### Description
Analytics panel shows mock per-repost data but feature flag `enableAnalytics` may not be properly controlled via environment variables.

### Status
- Feature flag infrastructure in place
- Mock data displays correctly when `flags.enableAnalytics = true`
- Gating logic working in AdCard component
- Need to verify backend flag serialization

---

## Summary Statistics
- **Total Bugs**: 2
- **Open**: 2
- **High Severity**: 1
- **Low Severity**: 1

## Priority Fixes
1. 🔴 **HIGH** - Session token retrieval in extension messaging
2. 🟡 **LOW** - Analytics feature flag verification
