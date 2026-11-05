import React from 'react';
import { Building2, Palette, Rocket, FilePenLine } from 'lucide-react';
import { ArcReactorLogo } from './ArcReactorLogo';

interface WelcomeHeroProps {
  onSelectPrompt: (prompt: string) => void;
}

export const WelcomeHero: React.FC<WelcomeHeroProps> = ({ onSelectPrompt }) => {
  const suggestions = [
    {
      icon: <Building2 className="w-5 h-5 text-cyan-400" />,
      title: 'What is full form of DHA?',
      prompt: 'What is the full form of DHA? Please explain its meaning in terms of Pakistan Defence Housing Authority as well as biological biochemistry (Docosahexaenoic Acid).',
      bgHover: 'hover:border-cyan-500/50 hover:bg-cyan-950/20',
    },
    {
      icon: <Palette className="w-5 h-5 text-purple-400" />,
      title: 'Generate DALL-E 3 Artwork',
      prompt: 'Generate image of a futuristic cyberpunk Lahore skyline at night with neon lights and flying vehicles.',
      bgHover: 'hover:border-purple-500/50 hover:bg-purple-950/20',
    },
    {
      icon: <Rocket className="w-5 h-5 text-emerald-400" />,
      title: 'Elon Musk & Tech News',
      prompt: 'What are the latest breaking news and developments regarding Elon Musk, SpaceX, xAI, and Tesla today?',
      bgHover: 'hover:border-emerald-500/50 hover:bg-emerald-950/20',
    },
    {
      icon: <FilePenLine className="w-5 h-5 text-amber-400" />,
      title: 'Draft a Leave Application / Letter',
      prompt: 'Please draft a formal, polished student leave application addressed to the Principal of LGS Paragon Lahore requesting 2 days leave for family commitment.',
      bgHover: 'hover:border-amber-500/50 hover:bg-amber-950/20',
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 max-w-4xl mx-auto w-full select-none">
      {/* Central Glowing Arc Reactor Logo */}
      <div className="mb-6 relative">
        <ArcReactorLogo size="lg" glow={true} />
      </div>

      {/* Hero Title */}
      <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-3 text-center">
        Hello, I am JARVIS
      </h1>

      {/* Hero Subtitle */}
      <p className="text-sm md:text-base text-slate-300 text-center max-w-2xl mb-8 leading-relaxed">
        Created and developed by{' '}
        <span className="text-cyan-400 font-semibold">
          Abdullah Waheed (LGS Paragon, Lahore)
        </span>
        . Ask questions, search world news, generate artwork with DALL-E 3, solve math,
        or upload up to 10 files!
      </p>

      {/* 2x2 Suggestion Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 w-full max-w-2xl">
        {suggestions.map((item, index) => (
          <button
            key={index}
            onClick={() => onSelectPrompt(item.prompt)}
            className={`flex items-center gap-3.5 p-3.5 md:p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-left transition-all duration-200 cursor-pointer shadow-sm group ${item.bgHover}`}
          >
            <div className="p-2 rounded-lg bg-slate-800/80 group-hover:scale-110 transition-transform shrink-0">
              {item.icon}
            </div>
            <span className="text-xs md:text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
              {item.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
