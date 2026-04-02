import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { motion } from 'framer-motion';

interface SettingsSectionProps {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  accentColor?: string;
  minimal?: boolean;
}

export function SettingsSection({ 
  title, 
  description, 
  icon, 
  children, 
  className,
  accentColor = "slate",
  minimal = false
}: SettingsSectionProps) {
  // Se for o modo minimal, usar um estilo mais simples
  if (minimal) {
    return (
      <div className={cn("w-full", className)}>
        <div className="flex items-center gap-2.5 mb-3 pb-2 border-b border-white/5">
          <div className="p-1.5 rounded-md bg-black/60 border border-white/5 shadow-sm">
            {icon}
          </div>
          <div>
            <span className="text-white/90 text-sm font-medium">{title}</span>
            <p className="text-white/50 text-xs">{description}</p>
          </div>
        </div>
        <div className="pl-1">
          {children}
        </div>
      </div>
    );
  }

  // Design padrão com menos efeitos
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "rounded-lg overflow-hidden relative",
        className
      )}
    >
      <Card className="border border-white/5 bg-black shadow-sm relative z-10 overflow-hidden">
        <div className="relative z-10">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-black border border-white/5 shadow-sm">
                {icon}
              </div>
              <div>
                <CardTitle className="text-base font-medium text-white/90">
                  {title}
                </CardTitle>
                <CardDescription className="text-white/60 text-xs mt-1">
                  {description}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <Separator className="bg-white/5" />
          <CardContent className="pt-4 relative z-10">
            <div className="relative z-10">
              {children}
            </div>
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );
} 