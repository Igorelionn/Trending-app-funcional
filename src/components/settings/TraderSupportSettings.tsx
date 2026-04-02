import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, Hash, Check, ChevronRight, X, Loader2 } from "lucide-react";
import { traderLinkService } from "@/services/traderLinkService";
import { validateSupporterCode, registerSupporterCodeUsage } from "@/lib/admin-api";
import { supporterInfoService } from "@/services/supporterInfoService";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";

const TraderSupportSettings = () => {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [supporterCode, setSupporterCode] = useState<string>("");
  const [isUsingDefault, setIsUsingDefault] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [validating, setValidating] = useState<boolean>(false);
  const [codeStatus, setCodeStatus] = useState<'idle' | 'valid' | 'invalid' | 'expired'>('idle');
  const [codeDescription, setCodeDescription] = useState<string | null>(null);
  const [specialMessage, setSpecialMessage] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  const debouncedCode = useDebounce(supporterCode, 600);

  useEffect(() => {
    if (isExpanded) loadPreferences();
  }, [isExpanded]);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    if (!isMounted || isUsingDefault) return;

    if (!debouncedCode || !debouncedCode.trim()) {
      setCodeStatus('idle');
      setCodeDescription(null);
      setDaysRemaining(null);
      savePreferences('');
      return;
    }

    const validate = async () => {
      setValidating(true);
      try {
        console.log('🔍 Validando código:', debouncedCode);
        const result = await validateSupporterCode(debouncedCode);
        setCodeStatus(result.valid ? 'valid' : 'invalid');
        setCodeDescription(result.description);
        setSpecialMessage(result.special_message);
        setDisplayName(result.display_name);
        if (result.valid) {
          console.log('✅ Código válido, registrando uso...');
          // Registrar o uso do código
          const registerResult = await registerSupporterCodeUsage(debouncedCode);
          if (registerResult.success) {
            console.log('✅ Uso do código registrado com sucesso!');
          } else {
            console.error('❌ Erro ao registrar uso:', registerResult.error);
          }
          savePreferences(debouncedCode);
        }
      } catch (err) {
        console.error('❌ Erro na validação:', err);
        setCodeStatus('invalid');
      } finally {
        setValidating(false);
      }
    };
    validate();
  }, [debouncedCode, isUsingDefault]);

  useEffect(() => {
    if (!isMounted) return;
    if (isUsingDefault) {
      savePreferences('');
    }
  }, [isUsingDefault]);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const { data: preferences } = await traderLinkService.getUserPreferences();
      if (preferences) {
        const code = String(preferences.supporter_code || '');

        setSupporterCode(code);
        setIsUsingDefault(!code || !code.trim());
        setDaysRemaining(null); // Código nunca expira
        if (code && code.trim()) {
          console.log('🔍 Carregando preferências, código encontrado:', code);
          const result = await validateSupporterCode(code);
          setCodeStatus(result.valid ? 'valid' : 'invalid');
          setCodeDescription(result.description);
          setSpecialMessage(result.special_message);
          setDisplayName(result.display_name);
          // Registrar o uso do código
          if (result.valid) {
            console.log('✅ Código válido ao carregar, registrando uso...');
            const registerResult = await registerSupporterCodeUsage(code);
            if (registerResult.success) {
              console.log('✅ Uso registrado ao carregar preferências!');
            } else {
              console.error('❌ Erro ao registrar uso ao carregar:', registerResult.error);
            }
          }
        }
      }
    } catch (error) {
      console.error("Erro ao carregar preferências do trader:", error);
    } finally {
      setLoading(false);
      setIsMounted(true);
    }
  };

  const savePreferences = async (code: string) => {
    if (!isMounted) return;
    try {
      const success = await traderLinkService.updateTraderPreferences(
        '', undefined, code.toUpperCase().trim()
      );
      if (!success) {
        toast.error("Erro ao salvar as preferências");
      } else {
        // Limpar cache para forçar reload das informações do apoiador
        supporterInfoService.clearCache();
      }
    } catch (error) {
      console.error("Erro ao salvar preferências:", error);
    }
  };

  const toggleDefaultLink = (e?: React.MouseEvent | React.ChangeEvent<HTMLInputElement>) => {
    if (e) e.preventDefault();
    const newValue = !isUsingDefault;
    setIsUsingDefault(newValue);
    if (newValue) {
      setSupporterCode("");
      setCodeStatus('idle');
      setCodeDescription(null);
      setDaysRemaining(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-black/10 transition-colors duration-200 group"
      >
        <div className="flex items-center space-x-2">
          <div className={cn(
            "relative p-1 rounded-full transition-colors duration-300",
            isExpanded ? "bg-purple-600/20" : "bg-black/20 group-hover:bg-purple-600/10"
          )}>
            <Heart className={cn(
              "h-4 w-4 transition-colors duration-300",
              isExpanded ? "text-purple-600" : "text-white/70 group-hover:text-purple-500/80"
            )} />
          </div>
          <h3 className="text-base font-medium text-white/90">{t('trader.support.title')}</h3>
        </div>

        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="h-4 w-4 text-white/50" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pt-3 pb-2.5 px-3.5 space-y-4 border-t border-white/5">
              <div className="flex items-start space-x-2">
                <p className="text-xs text-white/70 leading-relaxed">
                  {t('trader.support.description')}
                </p>
              </div>

              {/* Use default toggle */}
              <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-white/5 p-2.5 hover:border-white/10 transition-all duration-300">
                <div className="flex items-center space-x-2.5">
                  <div className="relative" onClick={toggleDefaultLink} style={{ zIndex: 10 }}>
                    <input
                      type="checkbox"
                      id="use-default"
                      checked={isUsingDefault}
                      onChange={toggleDefaultLink}
                      className="peer absolute opacity-0 w-0 h-0 cursor-pointer"
                      style={{ zIndex: 20 }}
                    />
                    <label
                      htmlFor="use-default"
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-md border transition-all duration-300 cursor-pointer",
                        isUsingDefault
                          ? "border-purple-600/50 bg-purple-600/20"
                          : "border-white/10 bg-black/30 hover:bg-black/50"
                      )}
                      style={{ zIndex: 30 }}
                    >
                      {isUsingDefault && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", bounce: 0.5 }}
                        >
                          <Check className="h-2.5 w-2.5 text-purple-400" />
                        </motion.div>
                      )}
                    </label>
                    {isUsingDefault && (
                      <motion.div
                        className="absolute -inset-1 rounded-md bg-purple-600/10 blur-sm cursor-pointer"
                        onClick={toggleDefaultLink}
                        animate={{ opacity: [0.4, 0.6, 0.4] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        style={{ zIndex: 5 }}
                      />
                    )}
                  </div>
                  <span
                    onClick={toggleDefaultLink}
                    className={cn(
                      "text-xs cursor-pointer transition-colors duration-300",
                      isUsingDefault ? "text-purple-400/90" : "text-white/70"
                    )}
                  >
                    {t('trader.support.use.default')}
                  </span>
                </div>

                {isUsingDefault && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.3 }}
                    className="mt-2 pl-6 text-xs text-white/60"
                  >
                    {t('trader.support.default.info')}
                  </motion.div>
                )}
              </div>

              {/* Supporter code input */}
              <div className={cn(
                "space-y-1.5 transition-opacity duration-300",
                isUsingDefault ? "opacity-50" : "opacity-100"
              )}>
                <Label htmlFor="supporter-code" className="text-xs text-white/60 flex items-center">
                  <Hash className="h-3.5 w-3.5 mr-1.5 text-purple-600/80" />
                  Código de apoiador
                </Label>

                <div className="relative">
                  <Input
                    id="supporter-code"
                    type="text"
                    value={supporterCode}
                    onChange={(e) => {
                      setSupporterCode(e.target.value.toUpperCase());
                      setCodeStatus('idle');
                    }}
                    placeholder="Ex: TRADER123"
                    className={cn(
                      "bg-black/30 border-white/10 h-9 rounded-lg py-0 px-2.5 pr-9",
                      "hover:bg-black/40 transition-all duration-300",
                      "text-xs text-white/80 placeholder:text-white/20 font-mono uppercase tracking-wider",
                      "focus:outline-none focus:bg-black/40 focus:border-white/15",
                      isUsingDefault ? "cursor-not-allowed" : "shadow-inner",
                      codeStatus === 'valid' && "border-emerald-500/30",
                      codeStatus === 'invalid' && supporterCode && "border-red-500/30"
                    )}
                    disabled={isUsingDefault || loading}
                  />

                  {/* Status indicator */}
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    {validating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30" />
                    ) : codeStatus === 'valid' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : codeStatus === 'invalid' && supporterCode ? (
                      <X className="h-3.5 w-3.5 text-red-400/70" />
                    ) : null}
                  </div>
                </div>

                {/* Validation feedback */}
                <AnimatePresence>
                  {codeStatus === 'valid' && specialMessage && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-[10px] text-emerald-400/70 pl-0.5"
                    >
                      {specialMessage}
                    </motion.p>
                  )}
                  {codeStatus === 'invalid' && supporterCode && !validating && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-[10px] text-red-400/60 pl-0.5"
                    >
                      Código inválido ou inativo
                    </motion.p>
                  )}
                  {codeStatus === 'expired' && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-[10px] text-amber-400/60 pl-0.5"
                    >
                      Código expirado. Insira novamente para renovar por mais 30 dias.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TraderSupportSettings;
