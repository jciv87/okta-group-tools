# UX Improvements - Prioritized

## 🔴 Critical (Fix Now)

### 1. Step Numbering Confusion
**Problem:** Steps restart after workflow selection
```
Step 1: Configure → Step 2: Select Workflow → Step 2: Select User ❌
```

**Fix:** Continue numbering through entire flow
```
Step 1: Configure → Step 2: Select Workflow → Step 3: Select User ✓
```

### 2. Wrong Language in Rule Workflow
**Problem:** Says "remove from the user" when modifying rules
**Fix:** Change to "remove from this rule"

### 3. No Manifest Browser
**Problem:** Users must type full path to manifest files
**Fix:** Add list selector showing recent manifests with timestamps

## 🟡 Important (Fix Soon)

### 4. Missing User Impact Count for Rules
**Problem:** Rule changes don't show how many users will be affected
**Fix:** Query and display: "⚠️  This will affect approximately 150 users"

### 5. Immutable Rule Detection is Reactive
**Problem:** Only discovers rule is locked after user makes selections
**Fix:** Check rule mutability upfront and warn before selections

### 6. File Loading UX
**Problem:** If file not found, loops asking for path with no context
**Fix:** Show example path, allow 'back' to return to interactive mode

## 🟢 Nice to Have (Future)

### 7. Manifest Age Validation
**Problem:** Old manifests might not reflect current state
**Fix:** Warn if manifest is >30 days old

### 8. Progress Indicators
**Problem:** Users don't know how many steps remain
**Fix:** Show "Step 3 of 6" style progress

### 9. Early Exit Detection
**Problem:** "No changes" detected after multiple prompts
**Fix:** Detect earlier and offer to restart

## Implementation Priority

**Sprint 1 (Critical):**
- Fix step numbering throughout all workflows
- Add manifest browser to reset workflow
- Fix "remove from user" → "remove from rule" language

**Sprint 2 (Important):**
- Add user count to rule impact summary
- Detect immutable rules upfront
- Improve file loading UX

**Sprint 3 (Nice to Have):**
- Add manifest age warnings
- Add progress indicators
- Improve early exit handling
