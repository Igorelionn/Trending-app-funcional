import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { SignalNotificationControl } from "@/components/SignalNotificationControl";
import { motion } from "framer-motion";
import { User } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const Profile = () => {
  const { t } = useLanguage();

  return (
    <Layout>
      {/* Background com gradiente */}
      <div className="fixed inset-0 bg-black z-[-1]">
        <div className="absolute inset-0 bg-gradient-to-bl from-slate-950 via-black to-slate-950"></div>
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] bg-center opacity-[0.02]"></div>
      </div>

      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="border-none shadow-xl bg-gradient-to-b from-black/50 to-black/20 backdrop-blur-sm rounded-xl">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800/10">
                  <User className="w-4 h-4 text-slate-400" />
                </div>
                <CardTitle className="text-xl font-semibold text-white/90">
                  {t('profile.title') || "Meu Perfil"}
                </CardTitle>
              </div>
              <CardDescription className="text-white/60">
                {t('profile.description') || "Gerencie sua foto de perfil e informações pessoais"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileSettings />
            </CardContent>
          </Card>
          
          {/* Controle de Notificações de Sinais */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6"
          >
            <SignalNotificationControl />
          </motion.div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Profile; 