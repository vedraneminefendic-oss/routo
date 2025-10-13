import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="border-t bg-card mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Offertverktyget. Alla rättigheter förbehållna.</p>
          <div className="flex gap-6">
            <Link 
              to="/privacy" 
              className="hover:text-foreground transition-colors"
            >
              Integritetspolicy
            </Link>
            <Link 
              to="/terms" 
              className="hover:text-foreground transition-colors"
            >
              Användarvillkor
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
