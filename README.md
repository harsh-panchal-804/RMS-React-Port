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
   ```
   
   Replace `your_api_base_url_here` with your actual API base URL (e.g., `https://api.example.com` or `http://localhost:8000`).

## Setting the Authentication Token

The application requires an authentication token to be stored in the browser's localStorage. You can set the token using one of the following methods:

### Method 1: Using the Application UI

1. Start the development server (see "Running the Application" below)
2. Open the application in your browser
3. Look for the token input field in the dashboard interface
4. Enter your authentication token
5. Click the "Set Token" button

The token will be automatically stored in localStorage and the application will start fetching data.

### Method 2: Using Browser Console (Manual)

1. Open the application in your browser
2. Open the browser's Developer Console:
   - **Chrome/Edge**: Press `F12` or `Ctrl+Shift+I` (Windows/Linux) / `Cmd+Option+I` (Mac)
   - **Firefox**: Press `F12` or `Ctrl+Shift+K` (Windows/Linux) / `Cmd+Option+K` (Mac)
   - **Safari**: Press `Cmd+Option+C` (Mac)

3. In the console, run the following command:
   ```javascript
   localStorage.setItem('token', 'your_token_here');
   localStorage.setItem('userRole', 'ADMIN');
   ```
   
   Replace `your_token_here` with your actual authentication token.

4. Refresh the page to apply the changes.

### Method 3: Using Browser DevTools Application Tab

1. Open the application in your browser
2. Open Developer Tools (`F12`)
3. Navigate to the **Application** tab (Chrome/Edge) or **Storage** tab (Firefox)
4. In the left sidebar, expand **Local Storage**
5. Click on your application's URL
6. Add or edit the following entries:
   - Key: `token`, Value: `your_token_here`
   - Key: `userRole`, Value: `ADMIN`
6. Refresh the page

### Token Format Notes

- The token should be a valid JWT (JSON Web Token) or Supabase access token
- If your token includes a "Bearer " prefix, the application will automatically remove it
- The token typically starts with "eyJ..." for JWT tokens
- Make sure the token is not expired

### Clearing the Token

To clear the stored token:

**Using Browser Console:**
```javascript
localStorage.removeItem('token');
localStorage.removeItem('userRole');
```

**Using the Application UI:**
- Click the "Clear Token" button in the dashboard interface

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
│   ├── utils/           # Utility functions (API, etc.)
│   ├── assets/          # Static assets
│   └── App.jsx          # Main application component
├── public/              # Public assets
├── .env                 # Environment variables (create this)
├── vite.config.js       # Vite configuration
└── package.json         # Dependencies and scripts
```

## Troubleshooting

### Token Not Working

- Ensure the token is valid and not expired
- Check the browser console for error messages
- Verify that `VITE_API_BASE_URL` is correctly set in your `.env` file
- Make sure the token has the correct permissions for the API endpoints

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
- Axios (HTTP client)
- Tailwind CSS
- Radix UI components
- Recharts & Plotly.js (data visualization)
- Framer Motion (animations)

## License

This project is private and proprietary.
