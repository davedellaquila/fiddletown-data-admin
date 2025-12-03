# Banner Ads - Admin Guide

## Overview

The Banner Ads system allows you to manage advertising vendors and their banner advertisements on the events page. The system includes vendor management, ad creation, scheduling, and tracking capabilities.

## Accessing the Ads Module

1. Log in to the SSA Admin application
2. Click on **"Ads"** in the sidebar navigation (or press ⌘5 / Ctrl5)
3. You'll see three tabs: **Vendors**, **Ads**, and **Tracking**

## Managing Vendors

### Creating a New Vendor

1. Click on the **"Vendors"** tab
2. Click the **"New Vendor"** button
3. Fill in the vendor information:
   - **Vendor Name** (required): The name of the advertising vendor
   - **Contact Email**: Email address for the vendor contact
   - **Contact Phone**: Phone number for the vendor contact
   - **Notes**: Any additional notes about the vendor
   - **Status**: Choose Draft, Published, or Archived
4. Click **"Save"** to create the vendor

### Editing a Vendor

1. Click on any vendor in the list to open the edit dialog
2. Make your changes
3. Click **"Save"**

### Vendor Status

- **Draft**: Vendor is not yet active
- **Published**: Vendor is active and can be used for ads
- **Archived**: Vendor is no longer active

### Publishing/Archiving Vendors

- Click the **"Publish"** button next to a draft vendor to make it active
- Click the **"Archive"** button to archive a published vendor
- Click **"Delete"** to soft-delete a vendor (can be recovered from database if needed)

## Managing Ads

### Creating a New Ad

1. Click on the **"Ads"** tab
2. Optionally filter by vendor using the dropdown at the top
3. Click the **"New Ad"** button
4. Fill in the ad information:

   **Basic Information:**
   - **Vendor** (required): Select the vendor from the dropdown
   - **Ad Name** (required): A descriptive name for this ad version
   - **Image URL** (required): The URL to the desktop/full-size ad image
   - **Mobile Image URL** (optional): Separate image optimized for mobile devices. If not provided, the main image will be used
   - **Target URL** (required): The URL where users will be directed when they click the ad

   **Display Settings:**
   - **Position**: Choose where the ad appears
     - **Header**: Mobile-friendly ad at the top of the page
     - **Body**: Full-width ad within the event listings
   - **Priority**: Higher numbers are shown more frequently (default: 100)

   **Scheduling (Optional):**
   - **Start Date**: When the ad should start appearing (leave blank for immediate start)
   - **End Date**: When the ad should stop appearing (leave blank for no end date)

   **Status:**
   - **Status**: Choose Draft, Published, or Archived
   - **Sort Order**: Numeric value for ordering (lower numbers appear first)

5. Click **"Save"** to create the ad

### Image Requirements

- **Desktop Image**: Recommended size 728x90 pixels (leaderboard) or full-width banner
- **Mobile Image**: Recommended size 320x50 pixels or similar mobile-friendly dimensions
- Images should be in JPG, PNG, or WebP format
- Ensure images are optimized for web (compressed but high quality)

### Editing an Ad

1. Click on any ad in the list to open the edit dialog
2. Make your changes
3. Click **"Save"**

### Ad Status

- **Draft**: Ad is created but not displayed on the site
- **Published**: Ad is active and will appear on the events page (if within date range)
- **Archived**: Ad is no longer displayed

### Publishing/Archiving Ads

- Click the **"Publish"** button next to a draft ad to make it active
- Click the **"Archive"** button to archive a published ad
- Click **"Delete"** to soft-delete an ad

### Multiple Ad Versions

Each vendor can have multiple ad versions. This allows you to:
- Test different creative approaches
- Rotate ads for variety
- Create seasonal or time-specific versions
- A/B test different designs

The system will automatically select which ad to display based on priority and scheduling.

## Viewing Tracking Data

### Accessing Tracking

1. Click on the **"Tracking"** tab
2. You'll see overall statistics and per-ad performance

### Tracking Metrics

**Overall Statistics:**
- **Total Impressions**: Number of times ads were displayed
- **Total Clicks**: Number of times ads were clicked
- **Click-Through Rate (CTR)**: Percentage of impressions that resulted in clicks

**Per-Ad Statistics:**
- View impressions, clicks, and CTR for each individual ad
- See which ads are performing best

### Date Range Filtering

1. Use the date range inputs at the top of the Tracking tab
2. Select a start date and end date
3. Click **"Refresh"** to update the statistics for that period

### Understanding Metrics

- **Impressions**: An impression is recorded when an ad becomes visible on the user's screen
- **Clicks**: A click is recorded when a user clicks on an ad
- **CTR**: Calculated as (Clicks / Impressions) × 100

## Best Practices

### Creating Effective Ads

1. **Clear Call-to-Action**: Make it obvious what users should do
2. **High-Quality Images**: Use crisp, professional images
3. **Mobile Optimization**: Always provide a mobile-specific image for better mobile experience
4. **Relevant Content**: Ensure ads are relevant to the events page audience
5. **Appropriate Sizing**: Follow recommended image dimensions

### Managing Multiple Ads

1. **Use Priority Wisely**: Set higher priority for ads you want to show more often
2. **Schedule Strategically**: Use start/end dates for seasonal campaigns
3. **Test and Iterate**: Create multiple versions and track which perform best
4. **Regular Review**: Check tracking data regularly to optimize performance

### Vendor Management

1. **Keep Contact Info Updated**: Ensure vendor contact information is current
2. **Use Notes**: Document important information about vendors in the notes field
3. **Status Management**: Use draft status for new vendors before going live

## Troubleshooting

### Ad Not Appearing

1. Check that the ad status is **"Published"**
2. Verify the start date (if set) is in the past
3. Verify the end date (if set) is in the future
4. Check that the vendor status is **"Published"**
5. Ensure image URLs are accessible and valid

### Tracking Not Working

1. Tracking is automatic - no action needed
2. Data may take a few moments to appear
3. Ensure ads are published and visible on the site
4. Check browser console for any JavaScript errors

### Image Issues

1. Verify image URLs are publicly accessible
2. Check image format (JPG, PNG, or WebP)
3. Ensure images are not too large (optimize for web)
4. Test image URLs in a browser to confirm they load

## Keyboard Shortcuts

- **⌘5 / Ctrl5**: Navigate to Ads module

## Technical Notes

- Ads are cached for performance
- Tracking uses Intersection Observer for accurate impression tracking
- Click tracking opens links in new tabs
- Device type (mobile/desktop/tablet) is automatically detected for tracking

