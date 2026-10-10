import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import logoIcon from '../assets/logo-icon.png';

export default function Logo({ to = '/', className = 'h-8', iconOnly = false }) {
  return (
    <Link to={to} className="inline-flex items-center shrink-0" aria-label="CareSync home">
      <img src={iconOnly ? logoIcon : logo} alt="CareSync" className={className} />
    </Link>
  );
}
