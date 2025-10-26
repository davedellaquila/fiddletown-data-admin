# Loading Screen Components

This directory contains components for the startup loading sequence of the SSA Admin application.

## Components

### LoadingScreen.tsx
The main loading screen component that displays during application startup. Features:
- Animated progress bar with percentage indicator
- Step-by-step loading messages
- Smooth animations and transitions
- Responsive design

### StartupLogo.tsx
A sophisticated animated logo component for the loading screen. Features:
- Rotating grape emoji (🍇) representing the wine country theme
- Pulsing ring animation
- Shimmer background effect
- Inner glow animation
- Smooth scale-in animation

## Usage

The loading screen is automatically displayed during the initial application load. It shows:
1. **Initializing...** (0-20%)
2. **Loading application...** (20-40%)
3. **Connecting to database...** (40-60%)
4. **Initializing components...** (60-80%)
5. **Preparing interface...** (80-100%)
6. **Ready!** (100%)

## Styling

The loading screen uses:
- Gradient background (purple to blue)
- Glassmorphism effects with backdrop blur
- CSS animations for smooth transitions
- Responsive design for all screen sizes
- Dark/light mode support

## Animation Timeline

- **0.2s**: Logo slides in from bottom
- **0.4s**: Progress bar appears
- **0.6s**: Loading text fades in
- **Continuous**: Logo rotates, progress bar glows, dots bounce

The entire loading sequence takes approximately 1.5 seconds to complete, providing a smooth user experience during the application startup.
