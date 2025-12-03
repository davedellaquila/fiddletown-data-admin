# SSA Admin iPad App

Native iPadOS SwiftUI application for managing SSA (Fiddletown) data.

## Setup Instructions

1. Open Xcode
2. Create a new project:
   - Choose "App" template
   - Product Name: `SSAAdminiPad`
   - Interface: SwiftUI
   - Language: Swift
   - Platform: iPad
3. Save the project in this `ios-app/` directory
4. The project structure should match the folders created here

## Dependencies

Add the following Swift Package dependencies in Xcode:

- Supabase Swift SDK: `https://github.com/supabase/supabase-swift`

## Environment Configuration

Create a `Config.plist` or use environment variables for:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key

## Project Structure

- `App/`: Main app entry point and root views
- `Features/`: Feature modules (Locations, Events, Routes, OCRTest)
- `Shared/`: Shared code (Models, Services, Utils, Components)
- `Auth/`: Authentication views
- `Resources/`: Assets and configuration files




