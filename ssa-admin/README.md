# SSA Admin - Fiddletown Data Management

A comprehensive data management application for the Shenandoah School of Art (SSA) Fiddletown location, built with React, TypeScript, and Supabase.

## 🏗️ Project Structure

This project uses a modern, scalable architecture with shared components and utilities:

```
ssa-admin/
├── src/
│   ├── shared/                 # Shared components and utilities
│   │   ├── components/         # Reusable UI components
│   │   │   ├── BaseDataModule.tsx    # Base module with CRUD operations
│   │   │   ├── DataTable.tsx         # Generic table with sticky headers
│   │   │   └── StickyToolbar.tsx     # Reusable sticky toolbar
│   │   ├── hooks/              # Custom React hooks
│   │   │   └── useDataModule.ts      # Data management hook
│   │   ├── types/              # TypeScript type definitions
│   │   ├── utils/              # Utility functions
│   │   │   ├── csv.ts          # CSV import/export utilities
│   │   │   └── validation.ts   # Input validation utilities
│   │   └── config/              # Module configurations
│   │       └── modules.ts      # Pre-configured module settings
│   ├── features/               # Feature modules
│   │   ├── Events.tsx          # Events management
│   │   ├── Locations.tsx       # Locations management
│   │   ├── Routes.tsx          # Routes management
│   │   └── LocationsRefactored.tsx  # Example refactored module
│   ├── components/             # App-specific components
│   │   ├── LoadingScreen.tsx   # Startup loading screen
│   │   └── StartupLogo.tsx     # Animated logo component
│   ├── lib/                    # External service integrations
│   │   └── supabaseClient.ts   # Supabase configuration
│   └── utils/                  # App-specific utilities
│       ├── slug.ts             # URL slug generation
│       └── validation.ts        # Input validation
├── database/                   # Database schema and migrations
│   ├── schema.sql             # Complete database schema
│   ├── migrations/            # Database migration scripts
│   └── setup.sh               # Database setup script
└── tests/                     # Test files
    ├── __tests__/             # Integration tests
    └── setup.ts               # Test configuration
```

## 🚀 Key Features

### **Sticky Headers & Navigation**
- **Sticky Toolbar** - Action buttons, search controls, and column headers remain visible while scrolling
- **Perfect Alignment** - Column headers align exactly with table columns using CSS Grid
- **Consistent Behavior** - All modules (Events, Locations, Routes) have identical sticky behavior

### **Shared Architecture**
- **BaseDataModule** - All modules inherit from a shared base component
- **useDataModule Hook** - Centralized data management with CRUD operations
- **Reusable Components** - StickyToolbar, DataTable, and validation utilities
- **Type Safety** - Full TypeScript support with shared interfaces

### **Data Management**
- **CRUD Operations** - Create, Read, Update, Delete with Supabase integration
- **Import/Export** - CSV import and export functionality
- **Search & Filter** - Real-time search and date filtering
- **Bulk Operations** - Multi-select actions for batch processing

## 🛠️ Development Setup

### **Prerequisites**
- Node.js 18+ 
- npm or yarn
- Supabase account

### **Installation**
```bash
cd ssa-admin
npm install
```

### **Environment Setup**
Create `.env.local` with your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### **Database Setup**
```bash
# Run the database setup script
./database/setup.sh
```

### **Development Server**
```bash
npm run dev
```

## 🧪 Testing

### **Run Tests**
```bash
npm run test              # Run tests once
npm run test:watch        # Watch mode
npm run test:ui           # Visual test runner
npm run test:coverage     # Coverage report
```

### **Test Structure**
- **Unit Tests** - Utility functions and components
- **Integration Tests** - Full module functionality
- **Component Tests** - UI component behavior

## 📊 Module Configuration

Each module is configured in `src/shared/config/modules.ts`:

```typescript
export const eventsConfig: ModuleConfig = {
  tableName: 'events',
  displayName: 'Events',
  icon: '📅',
  searchFields: ['name', 'host_org', 'location'],
  importFields: ['name', 'slug', 'host_org', 'start_date', ...],
  exportFields: ['name', 'slug', 'host_org', 'start_date', ...],
  columns: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'start_date', label: 'Start', type: 'date' },
    // ... more columns
  ]
}
```

## 🎨 UI/UX Features

### **Dark/Light Mode**
- Automatic theme switching
- Consistent color schemes
- Accessible contrast ratios

### **Responsive Design**
- Mobile-friendly layouts
- Flexible grid systems
- Touch-friendly interactions

### **Loading States**
- Startup loading screen with progress
- Skeleton loading for data
- Smooth transitions

## 🔧 Architecture Benefits

### **DRY Principle**
- No code duplication across modules
- Shared utilities and components
- Consistent behavior patterns

### **Maintainability**
- Single source of truth for common functionality
- Easy to add new modules
- Centralized bug fixes

### **Scalability**
- Easy to add new data types
- Extensible component system
- Modular architecture

## 📝 Adding New Modules

1. **Create Module Config** in `src/shared/config/modules.ts`
2. **Define Types** in `src/shared/types.ts`
3. **Create Component** using `BaseDataModule`
4. **Add to App** in `src/App.tsx`

Example:
```typescript
// 1. Add to modules.ts
export const newModuleConfig: ModuleConfig = {
  tableName: 'new_table',
  displayName: 'New Module',
  icon: '🆕',
  // ... configuration
}

// 2. Add to App.tsx
import NewModule from './features/NewModule'

// 3. Use BaseDataModule
<BaseDataModule
  config={newModuleConfig}
  darkMode={darkMode}
  renderForm={renderNewModuleForm}
/>
```

## 🚀 Deployment

### **Build for Production**
```bash
npm run build
```

### **Preview Build**
```bash
npm run preview
```

## 📚 Documentation

- **API Documentation** - See `src/shared/` for component APIs
- **Database Schema** - See `database/schema.sql`
- **Test Coverage** - Run `npm run test:coverage`

## 🤝 Contributing

1. **Follow the Architecture** - Use shared components and utilities
2. **Add Tests** - Write tests for new functionality
3. **Update Documentation** - Keep README and comments current
4. **Use TypeScript** - Maintain type safety throughout

## 📄 License

This project is part of the SSA Fiddletown Data Management system.

---

**Built with ❤️ for the Shenandoah School of Art**