# React Portfolio Dashboard

A React-based dashboard application built with Vite for viewing productivity metrics and analytics.

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn package manager

## Installation

1. **Clone the repository** (if applicable) or navigate to the project directory:
   ```bash
   cd react_port
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```
   or
   ```bash
   yarn install
   ```

3. **Create environment file**:
   Create a `.env` file in the project root directory with the following content:
   ```env
   VITE_API_BASE_URL=your_api_base_url_here
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
   
   Replace the placeholders with your actual values:
   - `VITE_API_BASE_URL`: Your backend API base URL (e.g., `https://api.example.com` or `http://localhost:8000`)
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous/public key

## Authentication

The application uses **Google OAuth** via Supabase for authentication. Users must sign in with their Google account to access the dashboard.

### Google OAuth Setup

1. **Configure Supabase OAuth**:
   - Go to your Supabase project dashboard
   - Navigate to **Authentication** → **Providers**
   - Enable **Google** provider
   - Add your Google OAuth credentials (Client ID and Client Secret)
   - Add your redirect URL (e.g., `http://localhost:5173` for development)

2. **Sign In Flow**:
   - When you open the application, you'll see a login page
   - Click "Sign in with Google"
   - You'll be redirected to Google to authenticate
   - After successful authentication, you'll be redirected back to the application
   - The application will automatically:
     - Exchange the OAuth code for a Supabase session token
     - Validate the token with your backend API
     - Retrieve your user role from the backend
     - Store the authentication state

3. **User Registration**:
   - Users must be registered in your backend database
   - If a user authenticates with Google but their email is not in the database, they will see an "Access denied" message
   - Contact your administrator to add your email to the system

### Logging Out

- Click the **Settings** icon in the top-right corner
- Select **Log out** from the dropdown menu
- This will clear your session and redirect you to the login page

## Running the Application

### Development Mode

Start the development server:
```bash
npm run dev
```
or
```bash
yarn dev
```

The application will be available at `http://localhost:5173` (or the port shown in the terminal).

### Building for Production

Create a production build:
```bash
npm run build
```
or
```bash
yarn build
```

The built files will be in the `dist` directory.

### Preview Production Build

Preview the production build locally:
```bash
npm run preview
```
or
```bash
yarn preview
```

## Project Structure

```
react_port/
├── src/
│   ├── components/      # React components
│   │   ├── Login.jsx    # Google OAuth login component
│   │   └── ...
│   ├── contexts/        # React contexts
│   │   └── AuthContext.jsx  # Authentication context
│   ├── lib/             # Library configurations
│   │   └── supabase.js  # Supabase client configuration
│   ├── utils/           # Utility functions (API, etc.)
│   ├── assets/          # Static assets
│   └── App.jsx          # Main application component
├── public/              # Public assets
├── .env                 # Environment variables (create this)
├── vite.config.js       # Vite configuration
└── package.json         # Dependencies and scripts
```

## Troubleshooting

### Authentication Issues

- **"Access denied. Your email is not registered"**:
  - Your Google account email is not in the backend database
  - Contact your administrator to add your email to the system

- **"Could not generate login URL"**:
  - Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correctly set in your `.env` file
  - Verify your Supabase project is active and Google OAuth is enabled

- **OAuth redirect not working**:
  - Ensure the redirect URL in Supabase matches your application URL (e.g., `http://localhost:5173`)
  - Check that the redirect URL is added to your Supabase project's allowed redirect URLs

### API Connection Issues

- Verify your `.env` file contains the correct `VITE_API_BASE_URL`
- Check that the API server is running and accessible
- Review the browser console for detailed error messages
- Ensure CORS is properly configured on the API server

### Environment Variables Not Loading

- Make sure the `.env` file is in the project root directory
- Restart the development server after creating or modifying `.env`
- Environment variables must start with `VITE_` to be accessible in the application

## Technologies Used

- React 19
- Vite 7
- Supabase (Authentication & OAuth)
- Axios (HTTP client)
- Tailwind CSS
- Radix UI components
- Recharts & Plotly.js (data visualization)
- Framer Motion (animations)

## License

This project is private and proprietary.
