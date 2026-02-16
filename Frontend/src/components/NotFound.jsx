import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import LetterGlitch from './LetterGlitch';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

const NotFound = () => {
  useEffect(() => {
    // Disable scrolling on body when 404 page is mounted
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    return () => {
      // Re-enable scrolling when component unmounts
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center h-screen w-screen overflow-hidden fixed inset-0">
      {/* LetterGlitch background */}
      <div className="absolute inset-0 z-0 h-full w-full">
        <LetterGlitch
          glitchSpeed={50}
          centerVignette={true}
          outerVignette={false}
          smooth={true}
        />
      </div>
      
      {/* Content overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 space-y-6">
        <div className="space-y-4">
          <h1 className="text-8xl md:text-9xl font-bold text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]">
            404
          </h1>
          <h2 className="text-3xl md:text-4xl font-semibold text-white">
            Page Not Found
          </h2>
          <p className="text-lg md:text-xl text-white max-w-md">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        
        <Link to="/">
          <Button 
            size="lg" 
            className="mt-8 bg-white text-black hover:bg-white/90 shadow-lg"
          >
            <Home className="mr-2 h-4 w-4" />
            Go Back Home
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
