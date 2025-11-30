import React from 'react';
import { 
  Calculator, FlaskConical, Languages, BookOpen, Palette,
  Briefcase, Music, Code, Globe, Lightbulb
} from 'lucide-react';

export const IconRenderer = ({ name, className }: { name: string; className?: string }) => {
  const icons: Record<string, React.ReactNode> = {
    Calculator: <Calculator className={className} />,
    FlaskConical: <FlaskConical className={className} />,
    Languages: <Languages className={className} />,
    BookOpen: <BookOpen className={className} />,
    Palette: <Palette className={className} />,
    Briefcase: <Briefcase className={className} />,
    Music: <Music className={className} />,
    Code: <Code className={className} />,
    Globe: <Globe className={className} />,
    Lightbulb: <Lightbulb className={className} />,
  };
  return <>{icons[name] || <BookOpen className={className} />}</>;
};