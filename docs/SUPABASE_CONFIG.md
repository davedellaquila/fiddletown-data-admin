# Supabase Configuration Guide

This guide explains how to configure Supabase credentials for both the web and iOS applications.

## Web Application

### Step 1: Create `.env.local` file

Create a file named `.env.local` in the `web/` directory:

```bash
cd web
touch .env.local
```

### Step 2: Add your Supabase credentials

Edit `web/.env.local` and add:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Where to find these values:**
1. Go to your Supabase project dashboard: https://app.supabase.com
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **Project URL** (this is your `VITE_SUPABASE_URL`)
5. Copy the **anon/public** key (this is your `VITE_SUPABASE_ANON_KEY`)

### Step 3: Restart the dev server

After creating/updating `.env.local`, restart your development server:

```bash
npm run dev
```

**Note**: The `.env.local` file is already in `.gitignore`, so your credentials won't be committed to git.

---

## iOS Application

You have two options for configuring Supabase credentials in the iOS app:

### Option 1: Info.plist (Recommended)

#### Step 1: Add Info.plist to your Xcode project

1. In Xcode, right-click on the `SSA-Admin` folder (or your app target)
2. Select **New File...**
3. Choose **Property List** (or search for "plist")
4. Name it `Info.plist`
5. Make sure it's added to your app target

#### Step 2: Add Supabase keys to Info.plist

1. Open `Info.plist` in Xcode
2. Right-click and select **Add Row**
3. Add the following keys:

| Key | Type | Value |
|-----|------|-------|
| `SUPABASE_URL` | String | `https://YOUR-PROJECT-ID.supabase.co` |
| `SUPABASE_ANON_KEY` | String | `your-anon-key-here` |

**In Xcode's plist editor**, it will look like:
```
Information Property List
  ├─ SUPABASE_URL (String): https://YOUR-PROJECT-ID.supabase.co
  └─ SUPABASE_ANON_KEY (String): your-anon-key-here
```

#### Step 3: Verify the keys are accessible

The app will automatically read these values from Info.plist. You can verify by checking the console output when the app starts.

### Option 2: Environment Variables (Alternative)

If you prefer using environment variables:

1. In Xcode, go to **Product** → **Scheme** → **Edit Scheme...**
2. Select **Run** on the left
3. Go to the **Arguments** tab
4. Under **Environment Variables**, add:
   - `SUPABASE_URL` = `https://YOUR-PROJECT-ID.supabase.co`
   - `SUPABASE_ANON_KEY` = `your-anon-key-here`

**Note**: Environment variables are scheme-specific and won't be shared across team members.

---

## Finding Your Supabase Credentials

1. **Log in to Supabase**: https://app.supabase.com
2. **Select your project** (or create a new one)
3. **Go to Settings** → **API**
4. **Copy the following**:
   - **Project URL**: This is your `SUPABASE_URL`
     - Example: `https://abcdefghijklmnop.supabase.co`
   - **anon/public key**: This is your `SUPABASE_ANON_KEY`
     - Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

## Security Notes

### Web App
- ✅ `.env.local` is already in `.gitignore`
- ✅ Never commit `.env.local` to git
- ✅ Use different keys for development and production

### iOS App
- ✅ Info.plist values are included in the app bundle
- ⚠️ The anon key is public by design (it's safe to include in client apps)
- ⚠️ Row Level Security (RLS) policies protect your data
- ✅ Never commit actual credentials to git (use placeholders in example files)

---

## Troubleshooting

### Web App Issues

**Problem**: "Missing Supabase environment variables!"
- **Solution**: Make sure `.env.local` exists in the `web/` directory
- **Solution**: Restart the dev server after creating/updating `.env.local`
- **Solution**: Check that variable names start with `VITE_`

**Problem**: "Invalid Supabase URL"
- **Solution**: Make sure the URL includes `https://` and ends with `.supabase.co`
- **Solution**: Check for typos in the project ID

### iOS App Issues

**Problem**: App crashes with "Missing Supabase configuration"
- **Solution**: Make sure Info.plist exists and is added to your target
- **Solution**: Verify the keys are named exactly `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- **Solution**: Check that values are set (not empty)

**Problem**: Can't find Info.plist
- **Solution**: Modern Xcode projects may not have Info.plist by default
- **Solution**: Create one manually (see Option 1 above)
- **Solution**: Or use environment variables (Option 2)

---

## Example Files

### `.env.local.example` (for web)

Create `web/.env.local.example` as a template (this can be committed to git):

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Info.plist Template (for iOS)

If creating Info.plist manually, use this structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>SUPABASE_URL</key>
    <string>https://YOUR-PROJECT-ID.supabase.co</string>
    <key>SUPABASE_ANON_KEY</key>
    <string>your-anon-key-here</string>
</dict>
</plist>
```

---

## Quick Reference

| Platform | File Location | Key Names |
|----------|---------------|-----------|
| **Web** | `web/.env.local` | `VITE_SUPABASE_URL`<br>`VITE_SUPABASE_ANON_KEY` |
| **iOS** | `Info.plist` (in Xcode) | `SUPABASE_URL`<br>`SUPABASE_ANON_KEY` |

---

## Next Steps

After configuring Supabase credentials:

1. **Web**: Run `npm run dev` in the `web/` directory
2. **iOS**: Build and run the app in Xcode
3. Both apps should now connect to your Supabase database

If you encounter any issues, check the console/logs for error messages.

