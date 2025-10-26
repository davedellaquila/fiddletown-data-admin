# Database Setup Guide

This directory contains the database schema and setup files for the SSA Admin application.

## Files

- `schema.sql` - Complete database schema with tables, indexes, policies, and functions
- `migrations/` - Individual migration files for incremental updates
- `README.md` - This setup guide

## Quick Setup

### 1. Create Database from Scratch

If you're setting up a new Supabase project:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `schema.sql`
4. Click **Run** to execute the script
5. Verify all tables were created successfully

### 2. Verify Setup

After running the schema, check that these tables exist:
- `locations` - For wineries and businesses
- `events` - For community events
- `routes` - For recreational routes and trails

### 3. Test Authentication

1. Go to **Authentication** → **Settings** in your Supabase dashboard
2. Enable **Email** authentication
3. Configure your email templates if needed
4. Test the magic link authentication

## Database Schema Overview

### Tables

#### Locations Table
- **Purpose**: Manage wineries and business locations
- **Key Fields**: name, slug, region, short_description, website_url, status
- **Features**: Soft delete, status management, sort ordering

#### Events Table  
- **Purpose**: Manage community events and activities
- **Key Fields**: name, slug, host_org, start_date, end_date, location, status
- **Features**: Date/time support, recurrence, image URLs

#### Routes Table
- **Purpose**: Manage recreational routes and trails
- **Key Fields**: name, slug, duration_minutes, difficulty, gpx_url, status
- **Features**: GPX file support, difficulty levels, waypoints

### Security

- **Row Level Security (RLS)** enabled on all tables
- **Authentication required** for all write operations
- **Public read access** for all data
- **User ownership** tracking for audit purposes

### Storage

- **event-images** bucket for event photos
- **gpx-files** bucket for route GPX files
- **Public access** for file downloads

## Environment Setup

Create a `.env.local` file in your project root:

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Troubleshooting

### Common Issues

1. **"Unable to send magic link" error**
   - Check your Supabase URL and API key
   - Verify email authentication is enabled
   - Check browser console for detailed error messages

2. **RLS policy errors**
   - Ensure RLS is enabled on all tables
   - Check that policies are properly created
   - Verify user authentication is working

3. **File upload issues**
   - Check storage bucket permissions
   - Verify file size limits
   - Ensure proper CORS configuration

### Debug Steps

1. Check browser console for error messages
2. Verify Supabase project settings
3. Test authentication flow
4. Check RLS policies in Supabase dashboard

## Maintenance

### Regular Tasks

1. **Monitor storage usage** - Clean up unused files
2. **Review RLS policies** - Ensure security is maintained
3. **Check indexes** - Monitor query performance
4. **Backup data** - Regular exports of important data

### Updates

When updating the schema:

1. Create a new migration file in `migrations/`
2. Test the migration on a development database
3. Apply to production during maintenance window
4. Update this documentation

## Support

For issues with the database setup:

1. Check the Supabase documentation
2. Review the error logs in your browser console
3. Verify your environment variables
4. Test with a fresh Supabase project if needed
