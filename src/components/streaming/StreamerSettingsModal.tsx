import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Settings, MessageCircle, Link as LinkIcon, Users, Shield, Clock, Check, Ban, MessageSquareOff, Timer } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { getSupabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { ModeratorsManager } from './ModeratorsManager';
import { ModerationPanel } from './ModerationPanel';

interface StreamerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamerId: string;
}

interface StreamSettings {
  chatEnabled: boolean;
  chatDelaySeconds: number;
  subscribersOnly: boolean;
  linksAllowed: boolean;
  linksModeratorOnly: boolean;
}

const DELAY_OPTIONS = [
  { value: 0, label: 'Sem atraso' },
  { value: 2, label: '2 segundos' },
  { value: 5, label: '5 segundos' },
  { value: 10, label: '10 segundos' },
  { value: 30, label: '30 segundos' }
];

type TabType = 'settings' | 'moderators' | 'moderation';

export const StreamerSettingsModal: React.FC<StreamerSettingsModalProps> = ({
  isOpen,
  onClose,
  streamerId
}) => {
  const [settings, setSettings] = useState<StreamSettings>({
    chatEnabled: true,
    chatDelaySeconds: 0,
    subscribersOnly: false,
    linksAllowed: true,
    linksModeratorOnly: false
  });
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('settings');

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, streamerId]);

  const loadSettings = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = getSupabase() as any;
      const { data, error } = await supabase
        .from('streamer_settings')
        .select('*')
        .eq('streamer_id', streamerId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings({
          chatEnabled: data.chat_enabled ?? true,
          chatDelaySeconds: data.chat_delay_seconds ?? 0,
          subscribersOnly: data.subscribers_only ?? false,
          linksAllowed: data.links_allowed ?? true,
          linksModeratorOnly: data.links_moderator_only ?? false
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast.error('Erro ao carregar configurações');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = getSupabase() as any;
      const { error } = await supabase
        .from('streamer_settings')
        .upsert({
          streamer_id: streamerId,
          chat_enabled: settings.chatEnabled,
          chat_delay_seconds: settings.chatDelaySeconds,
          subscribers_only: settings.subscribersOnly,
          links_allowed: settings.linksAllowed,
          links_moderator_only: settings.linksModeratorOnly,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'streamer_id'
        });

      if (error) throw error;

      toast.success('Configurações salvas com sucesso!');
      onClose();
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'settings' as TabType, label: 'Configurações', icon: Settings },
    { id: 'moderators' as TabType, label: 'Moderadores', icon: Users },
    { id: 'moderation' as TabType, label: 'Moderação', icon: Shield }
  ];

  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-black overflow-hidden flex flex-col">
      {/* Header fixo no topo */}
      <div className="flex-shrink-0 bg-gradient-to-b from-black via-black/98 to-transparent backdrop-blur-xl border-b border-white/[0.08]">
        <div className="w-full px-8 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/[0.03] rounded-xl border border-white/[0.05]">
                <Settings className="h-5 w-5 text-white/80" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-xl font-light text-white/95 tracking-wide">
                  Gerenciamento de Live
                </h2>
                <p className="text-[13px] text-white/50 font-light mt-0.5">
                  Configure e gerencie suas transmissões
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] rounded-xl transition-all duration-200 active:scale-95"
              aria-label="Fechar"
            >
              <X className="h-5 w-5 text-white/80" strokeWidth={1.5} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[13px] font-light transition-all ${
                    activeTab === tab.id
                      ? 'bg-white/[0.1] text-white/95 border border-white/[0.15]'
                      : 'bg-white/[0.02] text-white/60 border border-white/[0.05] hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Conteúdo scrollável */}
      <div className="flex-1 overflow-y-auto minimal-scrollbar">
        <div className="w-full px-8 py-10">
          {/* Tab: Configurações */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Coluna Esquerda - Chat */}
            <div className="space-y-6">
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-4 w-4 text-white/60" strokeWidth={1.5} />
                  <h3 className="text-base font-light text-white/80 tracking-wide">Configurações de Chat</h3>
                </div>

                <div className="h-[0.5px] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

                {/* Chat Enabled */}
                <div className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/[0.05] rounded-2xl">
                  <div className="space-y-1">
                    <Label className="text-[14px] font-light text-white/90">Habilitar Chat</Label>
                    <p className="text-[12px] text-white/40 font-extralight">
                      Permite que espectadores enviem mensagens
                    </p>
                  </div>
                  <Switch
                    checked={settings.chatEnabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, chatEnabled: checked })}
                  />
                </div>

                {/* Chat Delay */}
                <div className="p-5 bg-white/[0.02] border border-white/[0.05] rounded-2xl space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-white/60" strokeWidth={1.5} />
                    <Label className="text-[14px] font-light text-white/90">Atraso do Chat</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {DELAY_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        onClick={() => setSettings({ ...settings, chatDelaySeconds: option.value })}
                        className={`px-4 py-3 rounded-xl text-[13px] font-light transition-all ${
                          settings.chatDelaySeconds === option.value
                            ? 'bg-white/[0.12] text-white/95 border border-white/[0.15]'
                            : 'bg-white/[0.03] text-white/60 border border-white/[0.05] hover:bg-white/[0.05]'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subscribers Only */}
                <div className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/[0.05] rounded-2xl">
                  <div className="space-y-1">
                    <Label className="text-[14px] font-light text-white/90">Apenas Inscritos</Label>
                    <p className="text-[12px] text-white/40 font-extralight">
                      Somente inscritos podem comentar
                    </p>
                  </div>
                  <Switch
                    checked={settings.subscribersOnly}
                    onCheckedChange={(checked) => setSettings({ ...settings, subscribersOnly: checked })}
                  />
                </div>
              </div>
            </div>

            {/* Coluna Direita - Links */}
            <div className="space-y-6">
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <LinkIcon className="h-4 w-4 text-white/60" strokeWidth={1.5} />
                  <h3 className="text-base font-light text-white/80 tracking-wide">Configurações de Links</h3>
                </div>

                <div className="h-[0.5px] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

                {/* Links Allowed */}
                <div className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/[0.05] rounded-2xl">
                  <div className="space-y-1">
                    <Label className="text-[14px] font-light text-white/90">Permitir Links</Label>
                    <p className="text-[12px] text-white/40 font-extralight">
                      Usuários podem enviar links no chat
                    </p>
                  </div>
                  <Switch
                    checked={settings.linksAllowed}
                    onCheckedChange={(checked) => setSettings({ ...settings, linksAllowed: checked })}
                  />
                </div>

                {/* Links Moderator Only */}
                <div className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/[0.05] rounded-2xl">
                  <div className="flex items-center gap-3 flex-1">
                    <Shield className="h-4 w-4 text-white/60 flex-shrink-0" strokeWidth={1.5} />
                    <div className="space-y-1">
                      <Label className="text-[14px] font-light text-white/90">Apenas Moderadores e Dono</Label>
                      <p className="text-[12px] text-white/40 font-extralight">
                        Somente moderadores e o dono podem enviar links
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.linksModeratorOnly}
                    onCheckedChange={(checked) => {
                      // Se ativar "Apenas Moderadores", desmarcar "Permitir Links"
                      if (checked) {
                        setSettings({ 
                          ...settings, 
                          linksAllowed: false,
                          linksModeratorOnly: true 
                        });
                      } else {
                        setSettings({ 
                          ...settings, 
                          linksModeratorOnly: false 
                        });
                      }
                    }}
                  />
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-3xl p-8">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl mt-0.5 flex-shrink-0">
                    <Shield className="h-5 w-5 text-blue-400/80" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-[14px] font-medium text-white/90 mb-2">Nota Importante</h4>
                    <p className="text-[12px] text-white/60 font-light leading-relaxed">
                      Estas configurações serão aplicadas como padrão em todas as suas novas transmissões. Você poderá ajustá-las individualmente durante cada live através do painel de configurações da transmissão.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Tab: Moderadores */}
          {activeTab === 'moderators' && (
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-8">
              <ModeratorsManager streamerId={streamerId} />
            </div>
          )}

          {/* Tab: Moderação */}
          {activeTab === 'moderation' && (
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-8">
              <ModerationPanel streamerId={streamerId} />
            </div>
          )}
        </div>
      </div>

      {/* Footer fixo na parte inferior - apenas para Settings */}
      {activeTab === 'settings' && (
        <div className="flex-shrink-0 bg-gradient-to-t from-black via-black/98 to-transparent backdrop-blur-xl border-t border-white/[0.08]">
          <div className="w-full px-8 py-6 flex justify-end gap-4">
            <button
              onClick={onClose}
              className="h-12 px-6 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] rounded-2xl text-[14px] font-light text-white/80 tracking-wide transition-all duration-200 active:scale-95"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="h-12 px-8 bg-white/[0.95] hover:bg-white text-black rounded-2xl text-[14px] font-medium tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-black/20 border-t-black" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" strokeWidth={2} />
                  Salvar Configurações
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
};
