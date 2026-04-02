import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

interface LiveStreamPermissionContextType {
  canStartLive: boolean;
  canViewLive: boolean;
  canCommentLive: boolean;
  isLoading: boolean;
  userRole: string | null;
  isAdmin: boolean;
}

const LiveStreamPermissionContext = createContext<LiveStreamPermissionContextType>({
  canStartLive: false,
  canViewLive: true,
  canCommentLive: true,
  isLoading: true,
  userRole: null,
  isAdmin: false
});

export const useLiveStreamPermission = () => useContext(LiveStreamPermissionContext);

interface LiveStreamPermissionProviderProps {
  children: ReactNode;
}

export const LiveStreamPermissionProvider: React.FC<LiveStreamPermissionProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<LiveStreamPermissionContextType>({
    canStartLive: false,
    canViewLive: true,
    canCommentLive: true,
    isLoading: true,
    userRole: null,
    isAdmin: false
  });

  useEffect(() => {
    const checkUserPermissions = async () => {
      if (!user) {
        setPermissions({
          canStartLive: false,
          canViewLive: true,
          canCommentLive: true,
          isLoading: false,
          userRole: null,
          isAdmin: false
        });
        return;
      }

      try {
        // Verificar is_admin na tabela user_profiles (fonte única de verdade)
        let isAdminUser = false;
        try {
          const { data: profile, error: profileError } = await (getSupabase() as SupabaseClient)
            .from('user_profiles')
            .select('is_admin')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!profileError && profile) {
            isAdminUser = profile.is_admin === true;
          }
        } catch {}

        const canStart = isAdminUser;
        const userRole = isAdminUser ? 'admin' : null;

        setPermissions({
          canStartLive: canStart,
          canViewLive: true,
          canCommentLive: true,
          isLoading: false,
          userRole,
          isAdmin: isAdminUser
        });
      } catch {
        setPermissions({
          canStartLive: false,
          canViewLive: true,
          canCommentLive: true,
          isLoading: false,
          userRole: null,
          isAdmin: false
        });
      }
    };

    checkUserPermissions();
  }, [user]);

  return (
    <LiveStreamPermissionContext.Provider value={permissions}>
      {children}
    </LiveStreamPermissionContext.Provider>
  );
}; 