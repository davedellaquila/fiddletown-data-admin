#!/bin/bash

# SSA Admin Database Setup Script
# This script helps set up the database schema in Supabase

echo "🍇 SSA Admin Database Setup"
echo "=============================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the ssa-admin directory"
    exit 1
fi

echo "📋 Setup Options:"
echo "1. Create new database from schema.sql"
echo "2. Run individual migration"
echo "3. Verify database setup"
echo "4. Exit"
echo ""

read -p "Choose an option (1-4): " choice

case $choice in
    1)
        echo ""
        echo "📝 Setting up database from schema.sql..."
        echo ""
        echo "Please follow these steps:"
        echo "1. Go to your Supabase project dashboard"
        echo "2. Navigate to SQL Editor"
        echo "3. Copy the contents of database/schema.sql"
        echo "4. Paste and run the SQL script"
        echo ""
        echo "📁 Schema file location: database/schema.sql"
        echo ""
        read -p "Press Enter when you've completed the setup..."
        ;;
    2)
        echo ""
        echo "📝 Available migrations:"
        ls -la database/migrations/
        echo ""
        read -p "Enter migration filename (e.g., 001_initial_schema.sql): " migration
        if [ -f "database/migrations/$migration" ]; then
            echo "📁 Migration file: database/migrations/$migration"
            echo "Please run this in your Supabase SQL Editor"
        else
            echo "❌ Migration file not found"
        fi
        ;;
    3)
        echo ""
        echo "🔍 Verifying database setup..."
        echo ""
        echo "Check that these tables exist in your Supabase project:"
        echo "✅ locations"
        echo "✅ events" 
        echo "✅ routes"
        echo ""
        echo "Check that these storage buckets exist:"
        echo "✅ event-images"
        echo "✅ gpx-files"
        echo ""
        echo "Check that RLS is enabled on all tables"
        echo ""
        ;;
    4)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Create your .env.local file with Supabase credentials"
echo "2. Test the authentication flow"
echo "3. Start the development server: npm run dev"
echo ""
