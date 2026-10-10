import Logo from '../../components/Logo';
import { Button } from '../../components/ui';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center px-6 text-center">
      <Logo className="h-8" />
      <p className="mt-10 text-sm font-medium text-brand-700">404</p>
      <h1 className="text-3xl mt-2">Page not found</h1>
      <p className="text-ink-muted mt-2 max-w-sm">The page you're looking for doesn't exist or has been moved.</p>
      <Button to="/" className="mt-6">
        Back to home
      </Button>
    </div>
  );
}
